-- ============================================================
-- Pregnancies: Prenatal Fields
-- Adds obstetric history counts and professional info columns
-- to the pregnancies table.
-- ============================================================

ALTER TABLE public.pregnancies
  ADD COLUMN gestations_count      smallint,
  ADD COLUMN deliveries_count      smallint,
  ADD COLUMN cesareans_count       smallint,
  ADD COLUMN abortions_count       smallint,
  ADD COLUMN initial_weight_kg     numeric,
  ADD COLUMN initial_bmi           numeric;
