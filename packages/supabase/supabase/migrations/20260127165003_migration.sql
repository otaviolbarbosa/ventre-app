
-- Drop the trigger that updates gestational_week
DROP TRIGGER IF EXISTS "update_patient_gestational_week" ON "public"."patients";

-- Drop the trigger function
DROP FUNCTION IF EXISTS "public"."update_gestational_week"();

-- Drop the calculate function
DROP FUNCTION IF EXISTS "public"."calculate_gestational_week"(date);

-- Remove gestational_week column
ALTER TABLE "public"."patients" DROP COLUMN IF EXISTS "gestational_week";

-- Add dum (data da última menstruação) column
ALTER TABLE "public"."patients" ADD COLUMN "dum" date;

-- Populate dum from existing due_date (dum = due_date - 280 days)
UPDATE "public"."patients" SET "dum" = "due_date" - INTERVAL '280 days' WHERE "due_date" IS NOT NULL;

-- Create trigger function to auto-calculate dum when due_date changes
CREATE OR REPLACE FUNCTION "public"."update_patient_dum"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.due_date IS NOT NULL THEN
    NEW.dum := NEW.due_date - INTERVAL '280 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER "update_patient_dum_trigger"
  BEFORE INSERT OR UPDATE OF "due_date" ON "public"."patients"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."update_patient_dum"();
