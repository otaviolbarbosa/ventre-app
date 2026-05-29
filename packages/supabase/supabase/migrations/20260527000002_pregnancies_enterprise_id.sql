-- ============================================================
-- pregnancies.enterprise_id — ancora principal de isolamento
-- A lógica muda de "quem criou o paciente pertence a qual empresa"
-- para "qual empresa está associada a esta gestação"
-- ============================================================

ALTER TABLE public.pregnancies
  ADD COLUMN enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE SET NULL;

CREATE INDEX pregnancies_enterprise_id_idx ON public.pregnancies(enterprise_id);

-- ============================================================
-- Backfill via staff (manager/secretary): usa users.enterprise_id
-- ============================================================
UPDATE public.pregnancies preg
SET enterprise_id = u.enterprise_id
FROM public.users u
WHERE u.id = preg.created_by
  AND u.user_type IN ('manager', 'secretary')
  AND u.enterprise_id IS NOT NULL;

-- ============================================================
-- Backfill via profissional: usa user_enterprises
-- (pega a primeira empresa se houver ambiguidade — situação rara pré-migration)
-- ============================================================
UPDATE public.pregnancies preg
SET enterprise_id = ue.enterprise_id
FROM public.user_enterprises ue
WHERE ue.user_id = preg.created_by
  AND preg.enterprise_id IS NULL;
