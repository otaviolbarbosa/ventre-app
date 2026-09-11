-- Allow the authoring professional to edit an evolution's content/is_public,
-- preserving prior versions in edited_content for audit purposes. The original
-- migration (20260207000000_patient_evolutions.sql) made evolutions immutable
-- by design (no UPDATE/DELETE policy) — this migration deliberately reverses
-- that for the authoring professional only, everyone else stays read-only.

ALTER TABLE "public"."patient_evolutions"
    ADD COLUMN "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    ADD COLUMN "edited_content" jsonb[] DEFAULT '{}' NOT NULL;

-- Snapshot the pre-edit content/is_public/updated_at into edited_content and
-- bump updated_at, but only when content or is_public actually changed.
CREATE OR REPLACE FUNCTION "public"."save_patient_evolution_edit_history"()
RETURNS trigger AS $$
BEGIN
  NEW.edited_content := OLD.edited_content || jsonb_build_object(
    'content', OLD.content,
    'is_public', OLD.is_public,
    'updated_at', OLD.updated_at
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "save_patient_evolution_edit_history"
  BEFORE UPDATE ON "public"."patient_evolutions"
  FOR EACH ROW
  WHEN (
    OLD.content IS DISTINCT FROM NEW.content
    OR OLD.is_public IS DISTINCT FROM NEW.is_public
  )
  EXECUTE FUNCTION "public"."save_patient_evolution_edit_history"();

-- Block edits to anything other than content/is_public — RLS WITH CHECK can't
-- compare against OLD, so this closes that gap (mirrors the immutability
-- trigger pattern used for signed contracts).
CREATE OR REPLACE FUNCTION "public"."prevent_patient_evolution_immutable_field_changes"()
RETURNS trigger AS $$
BEGIN
  IF (OLD.id IS DISTINCT FROM NEW.id)
     OR (OLD.patient_id IS DISTINCT FROM NEW.patient_id)
     OR (OLD.professional_id IS DISTINCT FROM NEW.professional_id)
     OR (OLD.created_at IS DISTINCT FROM NEW.created_at) THEN
    RAISE EXCEPTION 'Apenas o conteúdo e a visibilidade da evolução podem ser editados';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "prevent_patient_evolution_immutable_field_changes"
  BEFORE UPDATE ON "public"."patient_evolutions"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."prevent_patient_evolution_immutable_field_changes"();

-- UPDATE: somente a profissional autora
CREATE POLICY "Edit patient evolutions" ON "public"."patient_evolutions"
    FOR UPDATE
    USING ("professional_id" = "auth"."uid"())
    WITH CHECK ("professional_id" = "auth"."uid"());
