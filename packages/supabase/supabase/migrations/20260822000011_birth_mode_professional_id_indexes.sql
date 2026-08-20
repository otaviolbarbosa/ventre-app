CREATE INDEX IF NOT EXISTS pregnancies_birth_mode_activated_by_idx ON public.pregnancies (birth_mode_activated_by);

CREATE INDEX IF NOT EXISTS birth_membrane_ruptures_professional_id_idx ON public.birth_membrane_ruptures (professional_id);
CREATE INDEX IF NOT EXISTS birth_contractions_professional_id_idx ON public.birth_contractions (professional_id);
CREATE INDEX IF NOT EXISTS birth_cervical_dilations_professional_id_idx ON public.birth_cervical_dilations (professional_id);
CREATE INDEX IF NOT EXISTS birth_fetal_stations_professional_id_idx ON public.birth_fetal_stations (professional_id);
CREATE INDEX IF NOT EXISTS birth_fetal_heart_rates_professional_id_idx ON public.birth_fetal_heart_rates (professional_id);
CREATE INDEX IF NOT EXISTS birth_amniotic_fluid_records_professional_id_idx ON public.birth_amniotic_fluid_records (professional_id);
CREATE INDEX IF NOT EXISTS birth_medication_administrations_professional_id_idx ON public.birth_medication_administrations (professional_id);
