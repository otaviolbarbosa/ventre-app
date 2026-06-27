-- Create dedicated addresses table
CREATE TABLE public.addresses (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  zipcode text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT addresses_pkey PRIMARY KEY (id),
  CONSTRAINT addresses_patient_id_unique UNIQUE (patient_id)
);

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view addresses"
  ON public.addresses FOR SELECT
  USING (
    public.is_team_member(patient_id)
    OR public.is_enterprise_patient(patient_id)
    OR (SELECT user_id FROM public.patients WHERE id = patient_id) = auth.uid()
  );

CREATE POLICY "Team members can insert addresses"
  ON public.addresses FOR INSERT
  WITH CHECK (
    public.is_team_member(patient_id)
    OR public.is_enterprise_staff()
  );

CREATE POLICY "Team members can update addresses"
  ON public.addresses FOR UPDATE
  USING  (public.is_team_member(patient_id) OR public.is_enterprise_patient(patient_id))
  WITH CHECK (public.is_team_member(patient_id) OR public.is_enterprise_patient(patient_id));

CREATE POLICY "Team members can delete addresses"
  ON public.addresses FOR DELETE
  USING (public.is_team_member(patient_id) OR public.is_enterprise_patient(patient_id));

GRANT ALL ON TABLE public.addresses TO anon, authenticated, service_role;

-- Migrate existing address data from patients to addresses table
INSERT INTO public.addresses (patient_id, user_id, street, number, complement, neighborhood, city, state, zipcode)
SELECT
  id,
  user_id,
  street,
  number,
  complement,
  neighborhood,
  city,
  state,
  zipcode
FROM public.patients
WHERE COALESCE(street, number, complement, neighborhood, city, state, zipcode) IS NOT NULL;

-- Drop individual address columns from patients
ALTER TABLE public.patients
  DROP COLUMN IF EXISTS street,
  DROP COLUMN IF EXISTS number,
  DROP COLUMN IF EXISTS complement,
  DROP COLUMN IF EXISTS neighborhood,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS zipcode;
