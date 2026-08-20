CREATE OR REPLACE FUNCTION public.set_patient_id_from_pregnancy() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  SELECT patient_id INTO NEW.patient_id
  FROM public.pregnancies
  WHERE id = NEW.pregnancy_id;

  IF NEW.patient_id IS NULL THEN
    RAISE EXCEPTION 'pregnancy_id % não corresponde a nenhuma gestação válida', NEW.pregnancy_id;
  END IF;

  RETURN NEW;
END;
$$;
