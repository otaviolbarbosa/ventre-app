-- Push notification triggers: DB events → send-notification edge function
-- Each trigger calls the edge function via pg_net (fire-and-forget)

-- ============================================================
-- 1. New columns in notification_settings
-- ============================================================
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS patient_added             boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS team_member_added          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS obstetric_history_updated  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS risk_factors_updated       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pregnancy_evolution_added  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lab_exam_added             boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS other_exam_added           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ultrasound_added           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vaccine_updated            boolean NOT NULL DEFAULT true;

-- ============================================================
-- 2. Helper: enqueue an HTTP call to the send-notification function
-- ============================================================
CREATE OR REPLACE FUNCTION public.call_send_notification(p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url     := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-notification',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
               ),
    body    := p_payload
  );
EXCEPTION WHEN OTHERS THEN
  NULL; -- fire-and-forget: never fail the originating transaction
END;
$$;

-- ============================================================
-- 3a. appointments — real-time events (create / update / cancel)
--     A separate trigger already handles reminder scheduling.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'appointment_created';

  ELSIF NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM 'cancelada' THEN
    v_event := 'appointment_cancelled';

  ELSIF NEW.date IS DISTINCT FROM OLD.date
     OR NEW.time IS DISTINCT FROM OLD.time
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.location IS DISTINCT FROM OLD.location THEN
    v_event := 'appointment_updated';

  ELSE
    RETURN NEW; -- no notification for status → realizada or other minor updates
  END IF;

  PERFORM public.call_send_notification(jsonb_build_object(
    'event',        v_event,
    'triggered_by', auth.uid()::text,
    'data',         jsonb_build_object(
                      'appointment_id',  NEW.id::text,
                      'patient_id',      NEW.patient_id::text,
                      'professional_id', NEW.professional_id::text,
                      'date',            NEW.date::text,
                      'time',            NEW.time::text,
                      'status',          NEW.status
                    )
  ));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_appointment_realtime_notify ON public.appointments;
CREATE TRIGGER on_appointment_realtime_notify
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_appointment();

-- ============================================================
-- 3b. billings INSERT — billing_created
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_billing_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.call_send_notification(jsonb_build_object(
    'event',        'billing_created',
    'triggered_by', auth.uid()::text,
    'data',         jsonb_build_object(
                      'billing_id',       NEW.id::text,
                      'patient_id',       NEW.patient_id::text,
                      'splitted_billing', NEW.splitted_billing,
                      'description',      NEW.description,
                      'total_amount',     NEW.total_amount
                    )
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_billing_created_notify ON public.billings;
CREATE TRIGGER on_billing_created_notify
  AFTER INSERT ON public.billings
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_billing_created();

-- ============================================================
-- 3c. payments INSERT — billing_payment_received
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_payment_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.call_send_notification(jsonb_build_object(
    'event',        'billing_payment_received',
    'triggered_by', auth.uid()::text,
    'data',         jsonb_build_object(
                      'payment_id',     NEW.id::text,
                      'installment_id', NEW.installment_id::text,
                      'paid_amount',    NEW.paid_amount,
                      'payment_method', NEW.payment_method
                    )
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_payment_notify ON public.payments;
CREATE TRIGGER on_payment_notify
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_payment_received();

-- ============================================================
-- 3d. team_members INSERT — patient_added (first member) or team_member_added
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_team_member_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_count int;
BEGIN
  SELECT COUNT(*) INTO v_team_count
  FROM public.team_members
  WHERE patient_id = NEW.patient_id;

  PERFORM public.call_send_notification(jsonb_build_object(
    'event',        CASE WHEN v_team_count <= 1 THEN 'patient_added' ELSE 'team_member_added' END,
    'triggered_by', auth.uid()::text,
    'data',         jsonb_build_object(
                      'patient_id',       NEW.patient_id::text,
                      'professional_id',  NEW.professional_id::text,
                      'professional_type', NEW.professional_type
                    )
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_team_member_added_notify ON public.team_members;
CREATE TRIGGER on_team_member_added_notify
  AFTER INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_team_member_added();

-- ============================================================
-- 3e. team_invites INSERT — team_invite_received
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_team_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invited_professional_id IS NOT NULL THEN
    PERFORM public.call_send_notification(jsonb_build_object(
      'event',        'team_invite_received',
      'triggered_by', auth.uid()::text,
      'data',         jsonb_build_object(
                        'invite_id',                NEW.id::text,
                        'patient_id',               NEW.patient_id::text,
                        'invited_professional_id',  NEW.invited_professional_id::text,
                        'invited_by',               NEW.invited_by::text
                      )
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_team_invite_notify ON public.team_invites;
CREATE TRIGGER on_team_invite_notify
  AFTER INSERT ON public.team_invites
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_team_invite();

-- ============================================================
-- 3f. patient_evolutions INSERT — evolution_added
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_evolution_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.call_send_notification(jsonb_build_object(
    'event',        'evolution_added',
    'triggered_by', auth.uid()::text,
    'data',         jsonb_build_object(
                      'patient_id',      NEW.patient_id::text,
                      'professional_id', NEW.professional_id::text
                    )
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_evolution_added_notify ON public.patient_evolutions;
CREATE TRIGGER on_evolution_added_notify
  AFTER INSERT ON public.patient_evolutions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_evolution_added();

-- ============================================================
-- 3g. patient_documents INSERT — document_uploaded
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_document_uploaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.call_send_notification(jsonb_build_object(
    'event',        'document_uploaded',
    'triggered_by', auth.uid()::text,
    'data',         jsonb_build_object(
                      'document_id', NEW.id::text,
                      'patient_id',  NEW.patient_id::text,
                      'uploaded_by', NEW.uploaded_by::text,
                      'file_name',   NEW.file_name
                    )
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_document_uploaded_notify ON public.patient_documents;
CREATE TRIGGER on_document_uploaded_notify
  AFTER INSERT ON public.patient_documents
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_document_uploaded();

-- ============================================================
-- 3h. patient_obstetric_history INSERT OR UPDATE — obstetric_history_updated
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_obstetric_history_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.call_send_notification(jsonb_build_object(
    'event',        'obstetric_history_updated',
    'triggered_by', auth.uid()::text,
    'data',         jsonb_build_object(
                      'patient_id', NEW.patient_id::text
                    )
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_obstetric_history_notify ON public.patient_obstetric_history;
CREATE TRIGGER on_obstetric_history_notify
  AFTER INSERT OR UPDATE ON public.patient_obstetric_history
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_obstetric_history_updated();

-- ============================================================
-- 3i. pregnancy_risk_factors INSERT OR UPDATE — risk_factors_updated
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_risk_factors_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.call_send_notification(jsonb_build_object(
    'event',        'risk_factors_updated',
    'triggered_by', auth.uid()::text,
    'data',         jsonb_build_object(
                      'pregnancy_id', NEW.pregnancy_id::text
                    )
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_risk_factors_notify ON public.pregnancy_risk_factors;
CREATE TRIGGER on_risk_factors_notify
  AFTER INSERT OR UPDATE ON public.pregnancy_risk_factors
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_risk_factors_updated();

-- ============================================================
-- 3j. pregnancy_evolutions INSERT — pregnancy_evolution_added
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_pregnancy_evolution_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.call_send_notification(jsonb_build_object(
    'event',        'pregnancy_evolution_added',
    'triggered_by', auth.uid()::text,
    'data',         jsonb_build_object(
                      'pregnancy_id', NEW.pregnancy_id::text,
                      'evolution_id', NEW.id::text
                    )
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_pregnancy_evolution_notify ON public.pregnancy_evolutions;
CREATE TRIGGER on_pregnancy_evolution_notify
  AFTER INSERT ON public.pregnancy_evolutions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_pregnancy_evolution_added();

-- ============================================================
-- 3k. lab_exam_results INSERT — lab_exam_added
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_lab_exam_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.call_send_notification(jsonb_build_object(
    'event',        'lab_exam_added',
    'triggered_by', auth.uid()::text,
    'data',         jsonb_build_object(
                      'pregnancy_id', NEW.pregnancy_id::text,
                      'exam_id',      NEW.id::text
                    )
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_lab_exam_notify ON public.lab_exam_results;
CREATE TRIGGER on_lab_exam_notify
  AFTER INSERT ON public.lab_exam_results
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_lab_exam_added();

-- ============================================================
-- 3l. other_exams INSERT — other_exam_added
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_other_exam_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.call_send_notification(jsonb_build_object(
    'event',        'other_exam_added',
    'triggered_by', auth.uid()::text,
    'data',         jsonb_build_object(
                      'pregnancy_id', NEW.pregnancy_id::text,
                      'exam_id',      NEW.id::text
                    )
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_other_exam_notify ON public.other_exams;
CREATE TRIGGER on_other_exam_notify
  AFTER INSERT ON public.other_exams
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_other_exam_added();

-- ============================================================
-- 3m. ultrasounds INSERT — ultrasound_added
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_ultrasound_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.call_send_notification(jsonb_build_object(
    'event',        'ultrasound_added',
    'triggered_by', auth.uid()::text,
    'data',         jsonb_build_object(
                      'pregnancy_id',  NEW.pregnancy_id::text,
                      'ultrasound_id', NEW.id::text
                    )
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_ultrasound_notify ON public.ultrasounds;
CREATE TRIGGER on_ultrasound_notify
  AFTER INSERT ON public.ultrasounds
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_ultrasound_added();

-- ============================================================
-- 3n. vaccine_records INSERT OR UPDATE — vaccine_updated
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_vaccine_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.call_send_notification(jsonb_build_object(
    'event',        'vaccine_updated',
    'triggered_by', auth.uid()::text,
    'data',         jsonb_build_object(
                      'pregnancy_id', NEW.pregnancy_id::text,
                      'vaccine_id',   NEW.id::text,
                      'vaccine_name', NEW.vaccine_name
                    )
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_vaccine_notify ON public.vaccine_records;
CREATE TRIGGER on_vaccine_notify
  AFTER INSERT OR UPDATE ON public.vaccine_records
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_vaccine_updated();
