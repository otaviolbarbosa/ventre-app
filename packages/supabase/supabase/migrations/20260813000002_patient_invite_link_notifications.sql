-- Patient invite links (self-registration + link-existing) currently only create a row
-- in patient_invite_links; delivery of the invite (e-mail / WhatsApp) requires the
-- professional to manually click a button in PatientInviteShareModal. This migration adds
-- a trigger that enqueues the invite for automatic delivery on both channels, mirroring the
-- pgmq producer pattern already used for appointment/DPP reminders and team invites.
--
-- email_notifications: new queue, no consumer yet (added in the same app deploy that adds
-- this migration — see apps/web/app/api/cron/process-notification-queues/route.ts).
SELECT pgmq.create('email_notifications');

CREATE OR REPLACE FUNCTION public.notify_on_patient_invite_link_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_type text;
BEGIN
  v_notification_type := CASE NEW.invite_type
    WHEN 'new_patient' THEN 'patient_self_registration_invite'
    ELSE 'patient_link_existing_invite'
  END;

  IF NEW.email IS NOT NULL THEN
    BEGIN
      PERFORM public.enqueue_notification(
        'email_notifications', v_notification_type, 'patient_invite_link', NEW.id,
        'invite', NEW.id
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_on_patient_invite_link_created: email enqueue failed for invite %: %', NEW.id, SQLERRM;
    END;
  END IF;

  IF NEW.phone IS NOT NULL THEN
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', v_notification_type, 'patient_invite_link', NEW.id,
        'invite', NEW.id
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_on_patient_invite_link_created: whatsapp enqueue failed for invite %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_patient_invite_link_created_notify ON public.patient_invite_links;
CREATE TRIGGER on_patient_invite_link_created_notify
  AFTER INSERT ON public.patient_invite_links
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_patient_invite_link_created();
