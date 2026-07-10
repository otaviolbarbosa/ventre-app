-- Allow patients to read their own appointments and record self-confirmed attendance.
ALTER TABLE public.appointments ADD COLUMN confirmed_by_patient_at timestamptz;

DROP POLICY "View appointments" ON public.appointments;
CREATE POLICY "View appointments" ON public.appointments FOR SELECT USING (
  public.is_team_member(patient_id)
  OR professional_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.patients WHERE patients.id = appointments.patient_id AND patients.user_id = auth.uid())
);
