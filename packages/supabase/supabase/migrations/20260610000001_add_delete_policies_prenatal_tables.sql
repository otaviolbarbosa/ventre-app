-- ============================================================
-- Add missing DELETE RLS policies for prenatal card tables
-- Affected: pregnancy_evolutions, ultrasounds, lab_exam_results, other_exams
-- ============================================================

-- pregnancy_evolutions
CREATE POLICY "Team members can delete pregnancy evolutions"
  ON public.pregnancy_evolutions FOR DELETE
  USING (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Enterprise staff can delete enterprise pregnancy evolutions"
  ON public.pregnancy_evolutions FOR DELETE
  USING (
    public.is_enterprise_patient(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

-- ultrasounds
CREATE POLICY "Team members can delete ultrasounds"
  ON public.ultrasounds FOR DELETE
  USING (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Enterprise staff can delete enterprise ultrasounds"
  ON public.ultrasounds FOR DELETE
  USING (
    public.is_enterprise_patient(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

-- lab_exam_results
CREATE POLICY "Team members can delete lab exam results"
  ON public.lab_exam_results FOR DELETE
  USING (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Enterprise staff can delete enterprise lab exam results"
  ON public.lab_exam_results FOR DELETE
  USING (
    public.is_enterprise_patient(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

-- other_exams
CREATE POLICY "Team members can delete other exams"
  ON public.other_exams FOR DELETE
  USING (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Enterprise staff can delete enterprise other exams"
  ON public.other_exams FOR DELETE
  USING (
    public.is_enterprise_patient(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );
