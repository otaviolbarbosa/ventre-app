-- ============================================================
-- Enterprise billing fees (taxas/impostos/descontos configuráveis)
-- Gestores configuram taxas fixas (cents) ou percentuais que serão
-- aplicadas automaticamente a novas cobranças (Phase 3 — fora deste
-- escopo). Esta migration cria apenas a fundação de schema:
-- a tabela de configuração e a coluna de snapshot imutável em billings.
-- ============================================================

CREATE TYPE public.billing_fee_type AS ENUM ('fixed', 'percentage');

CREATE TABLE public.enterprise_billing_fees (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  enterprise_id uuid NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  name text NOT NULL,
  fee_type public.billing_fee_type NOT NULL,
  value numeric(12,3) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT enterprise_billing_fees_value_range_check CHECK (
    (fee_type = 'percentage' AND value > 0 AND value <= 100)
    OR
    (fee_type = 'fixed' AND value > 0)
  )
);

CREATE INDEX idx_enterprise_billing_fees_enterprise_id
  ON public.enterprise_billing_fees (enterprise_id);

CREATE INDEX idx_enterprise_billing_fees_enterprise_active
  ON public.enterprise_billing_fees (enterprise_id, is_active);

CREATE TRIGGER handle_enterprise_billing_fees_updated_at
  BEFORE UPDATE ON public.enterprise_billing_fees
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.enterprise_billing_fees ENABLE ROW LEVEL SECURITY;

-- Staff (manager ou secretary) podem visualizar as taxas da própria empresa
CREATE POLICY "Staff can view enterprise billing fees"
  ON public.enterprise_billing_fees FOR SELECT TO authenticated
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );

-- Apenas managers (não secretaries) podem criar taxas — requisito explícito do PRD
CREATE POLICY "Managers can create enterprise billing fees"
  ON public.enterprise_billing_fees FOR INSERT TO authenticated
  WITH CHECK (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type = 'manager'
        AND enterprise_id IS NOT NULL
    )
  );

-- Apenas managers podem editar/desativar taxas (is_active, name, value)
CREATE POLICY "Managers can update enterprise billing fees"
  ON public.enterprise_billing_fees FOR UPDATE TO authenticated
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type = 'manager'
        AND enterprise_id IS NOT NULL
    )
  )
  WITH CHECK (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type = 'manager'
        AND enterprise_id IS NOT NULL
    )
  );

CREATE POLICY "service_role_manage_enterprise_billing_fees"
  ON public.enterprise_billing_fees FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.enterprise_billing_fees TO authenticated;
GRANT ALL ON public.enterprise_billing_fees TO service_role;

-- ============================================================
-- Snapshot imutável das taxas aplicadas a uma cobrança no momento
-- da criação. Array de objetos pois múltiplas taxas podem se aplicar.
-- Populado pela lógica de cálculo na Phase 3 — aqui apenas o schema.
-- Shape esperado (documentado para a Phase 3, não validado em DB):
--   [{ fee_id, name, fee_type, value, base_amount_cents, computed_amount_cents }]
-- ============================================================
ALTER TABLE public.billings
  ADD COLUMN applied_billing_fees jsonb NOT NULL DEFAULT '[]';
