-- Billing Module Schema
-- Tables: billings, installments, payments, installments_scheduled_notifications, billing_notification_preferences

-- ============================================
-- Enums
-- ============================================
CREATE TYPE public.payment_method AS ENUM (
  'credito',
  'debito',
  'pix',
  'boleto',
  'dinheiro',
  'outro'
);

CREATE TYPE public.billing_status AS ENUM (
  'pendente',
  'pago',
  'atrasado',
  'cancelado'
);

CREATE TYPE public.installment_status AS ENUM (
  'pendente',
  'pago',
  'atrasado',
  'cancelado'
);

CREATE TYPE public.installments_notification_type AS ENUM (
  'due_in_7_days',
  'due_in_3_days',
  'due_today',
  'overdue'
);

CREATE TYPE public.installments_notification_status AS ENUM (
  'pending',
  'sent',
  'cancelled',
  'failed'
);

-- ============================================
-- 1. billings
-- ============================================
CREATE TABLE public.billings (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.users(id),
  description text NOT NULL,
  total_amount bigint NOT NULL,
  paid_amount bigint NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL,
  installment_count integer NOT NULL DEFAULT 1 CHECK (installment_count BETWEEN 1 AND 10),
  installment_interval integer NOT NULL DEFAULT 1 CHECK (installment_interval BETWEEN 1 AND 4),
  status public.billing_status NOT NULL DEFAULT 'pendente',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billings_patient_id ON public.billings(patient_id);
CREATE INDEX idx_billings_professional_id ON public.billings(professional_id);
CREATE INDEX idx_billings_status ON public.billings(status);
CREATE INDEX idx_billings_created_at ON public.billings(created_at DESC);

ALTER TABLE public.billings ENABLE ROW LEVEL SECURITY;

-- Team members and patient can view
CREATE POLICY "Team and patient can view billings"
  ON public.billings
  FOR SELECT
  USING (
    public.is_team_member(patient_id)
    OR EXISTS (
      SELECT 1 FROM public.patients
      WHERE patients.id = billings.patient_id
      AND patients.user_id = auth.uid()
    )
  );

-- Team members can create
CREATE POLICY "Team members can create billings"
  ON public.billings
  FOR INSERT
  WITH CHECK (public.is_team_member(patient_id));

-- Only the professional who created can update
CREATE POLICY "Professional can update own billings"
  ON public.billings
  FOR UPDATE
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

-- Only the professional who created can delete
CREATE POLICY "Professional can delete own billings"
  ON public.billings
  FOR DELETE
  USING (professional_id = auth.uid());

-- Service role full access
CREATE POLICY "Service role manages all billings"
  ON public.billings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billings TO authenticated;
GRANT ALL ON public.billings TO service_role;

CREATE TRIGGER handle_billings_updated_at
  BEFORE UPDATE ON public.billings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 2. installments
-- ============================================
CREATE TABLE public.installments (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  billing_id uuid NOT NULL REFERENCES public.billings(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  amount bigint NOT NULL,
  due_date date NOT NULL,
  paid_at timestamptz,
  paid_amount bigint NOT NULL DEFAULT 0,
  payment_method public.payment_method,
  payment_link text,
  status public.installment_status NOT NULL DEFAULT 'pendente',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (billing_id, installment_number)
);

CREATE INDEX idx_installments_billing_id ON public.installments(billing_id);
CREATE INDEX idx_installments_status ON public.installments(status);
CREATE INDEX idx_installments_due_date ON public.installments(due_date);

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

-- Viewable via billing access (team + patient)
CREATE POLICY "Team and patient can view installments"
  ON public.installments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.billings b
      WHERE b.id = installments.billing_id
      AND (
        public.is_team_member(b.patient_id)
        OR EXISTS (
          SELECT 1 FROM public.patients p
          WHERE p.id = b.patient_id
          AND p.user_id = auth.uid()
        )
      )
    )
  );

-- Only service_role can INSERT/UPDATE/DELETE (created programmatically)
CREATE POLICY "Service role manages installments"
  ON public.installments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.installments TO authenticated;
GRANT ALL ON public.installments TO service_role;

CREATE TRIGGER handle_installments_updated_at
  BEFORE UPDATE ON public.installments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 3. payments
-- ============================================
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  installment_id uuid NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  paid_at timestamptz NOT NULL,
  paid_amount bigint NOT NULL,
  payment_method public.payment_method NOT NULL,
  registered_by uuid NOT NULL REFERENCES public.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_installment_id ON public.payments(installment_id);
CREATE INDEX idx_payments_paid_at ON public.payments(paid_at);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Viewable via billing access
CREATE POLICY "Team and patient can view payments"
  ON public.payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.installments i
      JOIN public.billings b ON b.id = i.billing_id
      WHERE i.id = payments.installment_id
      AND (
        public.is_team_member(b.patient_id)
        OR EXISTS (
          SELECT 1 FROM public.patients p
          WHERE p.id = b.patient_id
          AND p.user_id = auth.uid()
        )
      )
    )
  );

-- Team members can insert, must be registered_by themselves
CREATE POLICY "Team members can register payments"
  ON public.payments
  FOR INSERT
  WITH CHECK (
    registered_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.installments i
      JOIN public.billings b ON b.id = i.billing_id
      WHERE i.id = payments.installment_id
      AND public.is_team_member(b.patient_id)
    )
  );

-- Service role full access
CREATE POLICY "Service role manages all payments"
  ON public.payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

-- ============================================
-- 4. installments_scheduled_notifications
-- ============================================
CREATE TABLE public.installments_scheduled_notifications (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  installment_id uuid NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type public.installments_notification_type NOT NULL,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  status public.installments_notification_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_isn_status_scheduled ON public.installments_scheduled_notifications(status, scheduled_for);
CREATE INDEX idx_isn_user_id ON public.installments_scheduled_notifications(user_id);
CREATE INDEX idx_isn_installment_id ON public.installments_scheduled_notifications(installment_id);

ALTER TABLE public.installments_scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Only service_role
CREATE POLICY "Service role manages installment notifications"
  ON public.installments_scheduled_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.installments_scheduled_notifications TO service_role;

CREATE TRIGGER handle_isn_updated_at
  BEFORE UPDATE ON public.installments_scheduled_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 5. billing_notification_preferences
-- ============================================
CREATE TABLE public.billing_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  enable_billing_reminders boolean NOT NULL DEFAULT true,
  enable_payment_confirmations boolean NOT NULL DEFAULT true,
  reminder_days_before integer[] NOT NULL DEFAULT '{7,3,1}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own billing preferences"
  ON public.billing_notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role manages billing preferences"
  ON public.billing_notification_preferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.billing_notification_preferences TO authenticated;
GRANT ALL ON public.billing_notification_preferences TO service_role;

CREATE TRIGGER handle_bnp_updated_at
  BEFORE UPDATE ON public.billing_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
