CREATE TYPE public.birth_membrane_rupture_type AS ENUM ('espontanea', 'artificial');

ALTER TABLE public.birth_membrane_ruptures
  ADD COLUMN rupture_type public.birth_membrane_rupture_type,
  ADD COLUMN fluid_type_at_rupture public.birth_amniotic_fluid_type;
