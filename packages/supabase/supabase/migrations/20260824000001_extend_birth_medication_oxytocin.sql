ALTER TABLE public.birth_medication_administrations
  ADD COLUMN oxytocin_concentration_u_per_l numeric(5,1) CHECK (oxytocin_concentration_u_per_l IS NULL OR oxytocin_concentration_u_per_l > 0),
  ADD COLUMN oxytocin_drip_rate_gtt_per_min smallint CHECK (oxytocin_drip_rate_gtt_per_min IS NULL OR oxytocin_drip_rate_gtt_per_min >= 0);
