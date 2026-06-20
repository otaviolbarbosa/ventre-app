-- ============================================================
-- Replace responsible (free text) with created_by on pregnancy_evolutions
-- Foreign key referencing public.users(id), auto-filled by the action.
-- ============================================================

ALTER TABLE public.pregnancy_evolutions
  DROP COLUMN responsible;

ALTER TABLE public.pregnancy_evolutions
  ADD COLUMN created_by uuid
  REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX pregnancy_evolutions_created_by_idx ON public.pregnancy_evolutions(created_by);
