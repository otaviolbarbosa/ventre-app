-- New status for patient-submitted payments pending professional confirmation.
ALTER TYPE public.installment_status ADD VALUE IF NOT EXISTS 'em_analise';
