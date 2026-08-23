-- Compare the pregnancy id as text instead of casting the folder-name segment to uuid.
-- If Postgres evaluates the uuid cast before the bucket_id = 'partograph' filter, a
-- differently-shaped folder name in another bucket could raise a cast error.
DROP POLICY IF EXISTS "View partograph images" ON storage.objects;
DROP POLICY IF EXISTS "Upload partograph images" ON storage.objects;

-- SELECT: team members of the pregnancy's patient, or the patient themselves.
CREATE POLICY "View partograph images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'partograph'
  AND EXISTS (
    SELECT 1 FROM public.pregnancies preg
    JOIN public.patients pat ON pat.id = preg.patient_id
    WHERE preg.id::text = (storage.foldername(storage.objects.name))[1]
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
    WHERE preg.id::text = (storage.foldername(storage.objects.name))[1]
      AND (public.is_team_member(pat.id) OR pat.user_id = auth.uid())
  )
);
