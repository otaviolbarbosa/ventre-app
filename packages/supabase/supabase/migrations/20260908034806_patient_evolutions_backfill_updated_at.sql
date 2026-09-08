-- The updated_at column added in 20260908000000_patient_evolutions_edit_history
-- defaulted every existing row to the migration's run time instead of its
-- original created_at. Backfill only rows that have never actually been
-- edited (empty edited_content) — leave already-edited rows' real updated_at
-- untouched.
UPDATE public.patient_evolutions
SET updated_at = created_at
WHERE cardinality(edited_content) = 0;
