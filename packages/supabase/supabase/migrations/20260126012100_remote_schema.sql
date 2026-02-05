SET statement_timeout = 0;

SET lock_timeout = 0;

SET idle_in_transaction_session_timeout = 0;

SET client_encoding = 'UTF8';

SET standard_conforming_strings = on;

SELECT pg_catalog.set_config('search_path', '', false);

SET check_function_bodies = false;

SET xmloption = content;

SET client_min_messages = warning;

SET row_security = off;

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE TYPE "public"."appointment_status" AS ENUM (
    'agendada',
    'realizada',
    'cancelada'
);

ALTER TYPE "public"."appointment_status" OWNER TO "postgres";

CREATE TYPE "public"."appointment_type" AS ENUM (
    'consulta',
    'encontro'
);

ALTER TYPE "public"."appointment_type" OWNER TO "postgres";

CREATE TYPE "public"."professional_type" AS ENUM (
    'obstetra',
    'enfermeiro',
    'doula'
);

ALTER TYPE "public"."professional_type" OWNER TO "postgres";

CREATE TYPE "public"."user_type" AS ENUM (
    'professional',
    'patient'
);

ALTER TYPE "public"."user_type" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."calculate_gestational_week"("p_due_date" "date") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
declare
  conception_date date;
  weeks_pregnant int;
begin
  -- Calculate estimated conception date (40 weeks before due date)
  conception_date := p_due_date - interval '280 days';
  -- Calculate weeks since conception
  weeks_pregnant := extract(day from (current_date - conception_date)) / 7;
  -- Ensure it's within valid range (0-42 weeks)
  if weeks_pregnant < 0 then
    return 0;
  elsif weeks_pregnant > 42 then
    return 42;
  else
    return weeks_pregnant;
  end if;
end;
$$;

ALTER FUNCTION "public"."calculate_gestational_week"("p_due_date" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."is_team_member"("p_patient_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from public.team_members
    where patient_id = p_patient_id
    and professional_id = auth.uid()
  );
$$;

ALTER FUNCTION "public"."is_team_member"("p_patient_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_gestational_week"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.gestational_week := public.calculate_gestational_week(new.due_date);
  return new;
end;
$$;

ALTER FUNCTION "public"."update_gestational_week"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "time" time without time zone NOT NULL,
    "duration" integer,
    "type" "public"."appointment_type" NOT NULL,
    "status" "public"."appointment_status" DEFAULT 'agendada'::"public"."appointment_status" NOT NULL,
    "location" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."appointments" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."patient_invite_links" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid",
    "token" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."patient_invite_links" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."patients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "date_of_birth" "date" NOT NULL,
    "due_date" "date" NOT NULL,
    "gestational_week" integer,
    "address" "text",
    "observations" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."patients" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."team_invites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "invited_professional_id" "uuid" NOT NULL,
    "professional_type" "public"."professional_type" NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."team_invites" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "professional_type" "public"."professional_type" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."team_members" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "user_type" "public"."user_type" NOT NULL,
    "professional_type" "public"."professional_type",
    "avatar_url" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."users" OWNER TO "postgres";

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."patient_invite_links"
    ADD CONSTRAINT "patient_invite_links_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."patient_invite_links"
    ADD CONSTRAINT "patient_invite_links_token_key" UNIQUE ("token");

ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."team_invites"
    ADD CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_patient_id_professional_id_key" UNIQUE ("patient_id", "professional_id");

ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_patient_id_professional_type_key" UNIQUE ("patient_id", "professional_type");

ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

CREATE INDEX "idx_appointments_date" ON "public"."appointments" USING "btree" ("date");

CREATE INDEX "idx_appointments_patient" ON "public"."appointments" USING "btree" ("patient_id");

CREATE INDEX "idx_appointments_professional" ON "public"."appointments" USING "btree" ("professional_id");

CREATE INDEX "idx_patients_due_date" ON "public"."patients" USING "btree" ("due_date");

CREATE INDEX "idx_team_members_patient" ON "public"."team_members" USING "btree" ("patient_id");

CREATE INDEX "idx_team_members_professional" ON "public"."team_members" USING "btree" ("professional_id");

CREATE OR REPLACE TRIGGER "handle_appointments_updated_at" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

CREATE OR REPLACE TRIGGER "handle_patients_updated_at" BEFORE UPDATE ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

CREATE OR REPLACE TRIGGER "handle_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

CREATE OR REPLACE TRIGGER "update_patient_gestational_week" BEFORE INSERT OR UPDATE OF "due_date" ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."update_gestational_week"();

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id");

ALTER TABLE ONLY "public"."patient_invite_links"
    ADD CONSTRAINT "patient_invite_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");

ALTER TABLE ONLY "public"."patient_invite_links"
    ADD CONSTRAINT "patient_invite_links_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");

ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");

ALTER TABLE ONLY "public"."team_invites"
    ADD CONSTRAINT "team_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id");

ALTER TABLE ONLY "public"."team_invites"
    ADD CONSTRAINT "team_invites_invited_professional_id_fkey" FOREIGN KEY ("invited_professional_id") REFERENCES "public"."users"("id");

ALTER TABLE ONLY "public"."team_invites"
    ADD CONSTRAINT "team_invites_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE POLICY "Create appointments" ON "public"."appointments" FOR INSERT WITH CHECK ("public"."is_team_member"("patient_id"));

CREATE POLICY "Create invite links" ON "public"."patient_invite_links" FOR INSERT WITH CHECK ("public"."is_team_member"("patient_id"));

CREATE POLICY "Create team invites" ON "public"."team_invites" FOR INSERT WITH CHECK ("public"."is_team_member"("patient_id"));

CREATE POLICY "Delete appointments" ON "public"."appointments" FOR DELETE USING (("public"."is_team_member"("patient_id") OR ("professional_id" = "auth"."uid"())));

CREATE POLICY "Professionals can create patients" ON "public"."patients" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."user_type" = 'professional'::"public"."user_type")))));

CREATE POLICY "Professionals can view other professionals" ON "public"."users" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users" "users_1"
  WHERE (("users_1"."id" = "auth"."uid"()) AND ("users_1"."user_type" = 'professional'::"public"."user_type")))));

CREATE POLICY "Team members can delete team members" ON "public"."team_members" FOR DELETE USING ("public"."is_team_member"("patient_id"));

CREATE POLICY "Team members can insert team members" ON "public"."team_members" FOR INSERT WITH CHECK ("public"."is_team_member"("patient_id"));

CREATE POLICY "Team members can update patients" ON "public"."patients" FOR UPDATE USING ("public"."is_team_member"("id"));

CREATE POLICY "Team members can view patients" ON "public"."patients" FOR SELECT USING (("public"."is_team_member"("id") OR ("user_id" = "auth"."uid"())));

CREATE POLICY "Team members can view team" ON "public"."team_members" FOR SELECT USING (("public"."is_team_member"("patient_id") OR ("professional_id" = "auth"."uid"())));

CREATE POLICY "Update appointments" ON "public"."appointments" FOR UPDATE USING (("public"."is_team_member"("patient_id") OR ("professional_id" = "auth"."uid"())));

CREATE POLICY "Update invite links" ON "public"."patient_invite_links" FOR UPDATE USING (true);

CREATE POLICY "Update team invites" ON "public"."team_invites" FOR UPDATE USING (("invited_professional_id" = "auth"."uid"()));

CREATE POLICY "Users can insert own profile" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));

CREATE POLICY "Users can view own profile" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));

CREATE POLICY "View appointments" ON "public"."appointments" FOR SELECT USING (("public"."is_team_member"("patient_id") OR ("professional_id" = "auth"."uid"())));

CREATE POLICY "View invite links" ON "public"."patient_invite_links" FOR SELECT USING (("public"."is_team_member"("patient_id") OR ("created_by" = "auth"."uid"())));

CREATE POLICY "View team invites" ON "public"."team_invites" FOR SELECT USING (("public"."is_team_member"("patient_id") OR ("invited_professional_id" = "auth"."uid"()) OR ("invited_by" = "auth"."uid"())));

ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."patient_invite_links" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."patients" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."team_invites" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."calculate_gestational_week"("p_due_date" "date") TO "anon";

GRANT ALL ON FUNCTION "public"."calculate_gestational_week"("p_due_date" "date") TO "authenticated";

GRANT ALL ON FUNCTION "public"."calculate_gestational_week"("p_due_date" "date") TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";

GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";

GRANT ALL ON FUNCTION "public"."is_team_member"("p_patient_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."is_team_member"("p_patient_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_team_member"("p_patient_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."update_gestational_week"() TO "anon";

GRANT ALL ON FUNCTION "public"."update_gestational_week"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."update_gestational_week"() TO "service_role";

GRANT ALL ON TABLE "public"."appointments" TO "anon";

GRANT ALL ON TABLE "public"."appointments" TO "authenticated";

GRANT ALL ON TABLE "public"."appointments" TO "service_role";

GRANT ALL ON TABLE "public"."patient_invite_links" TO "anon";

GRANT ALL ON TABLE "public"."patient_invite_links" TO "authenticated";

GRANT ALL ON TABLE "public"."patient_invite_links" TO "service_role";

GRANT ALL ON TABLE "public"."patients" TO "anon";

GRANT ALL ON TABLE "public"."patients" TO "authenticated";

GRANT ALL ON TABLE "public"."patients" TO "service_role";

GRANT ALL ON TABLE "public"."team_invites" TO "anon";

GRANT ALL ON TABLE "public"."team_invites" TO "authenticated";

GRANT ALL ON TABLE "public"."team_invites" TO "service_role";

GRANT ALL ON TABLE "public"."team_members" TO "anon";

GRANT ALL ON TABLE "public"."team_members" TO "authenticated";

GRANT ALL ON TABLE "public"."team_members" TO "service_role";

GRANT ALL ON TABLE "public"."users" TO "anon";

GRANT ALL ON TABLE "public"."users" TO "authenticated";

GRANT ALL ON TABLE "public"."users" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

drop extension if exists "pg_net";
