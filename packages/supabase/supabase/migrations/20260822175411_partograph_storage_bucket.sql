-- Storage bucket for partograma template overlays, one folder per pregnancy id.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('partograph', 'partograph', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- SELECT: team members of the pregnancy's patient, or the patient themselves.
CREATE POLICY "View partograph images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'partograph'
  AND EXISTS (
    SELECT 1 FROM public.pregnancies preg
    JOIN public.patients pat ON pat.id = preg.patient_id
    WHERE preg.id = (storage.foldername(name))[1]::uuid
      AND (public.is_team_member(pat.id) OR pat.user_id = auth.uid())
  )
);

-- INSERT: team members of the pregnancy's patient, or the patient themselves.
CREATE POLICY "Upload partograph images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'partograph'
  AND EXISTS (
    SELECT 1 FROM public.pregnancies preg
    JOIN public.patients pat ON pat.id = preg.patient_id
    WHERE preg.id = (storage.foldername(name))[1]::uuid
      AND (public.is_team_member(pat.id) OR pat.user_id = auth.uid())
  )
);
