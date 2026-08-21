ALTER TABLE public.pregnancies
  ADD COLUMN birth_mode_active boolean NOT NULL DEFAULT false,
  ADD COLUMN birth_mode_activated_at timestamptz,
  ADD COLUMN birth_mode_activated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN birth_mode_ended_at timestamptz;

CREATE INDEX IF NOT EXISTS pregnancies_birth_mode_active_idx
  ON public.pregnancies (birth_mode_active) WHERE birth_mode_active = true;
