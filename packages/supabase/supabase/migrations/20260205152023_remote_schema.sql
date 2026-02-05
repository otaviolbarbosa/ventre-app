alter table "supabase_migrations"."schema_migrations" add column "created_by" text;

alter table "supabase_migrations"."schema_migrations" add column "idempotency_key" text;

alter table "supabase_migrations"."schema_migrations" add column "rollback" text[];

CREATE UNIQUE INDEX schema_migrations_idempotency_key_key ON supabase_migrations.schema_migrations USING btree (idempotency_key);

alter table "supabase_migrations"."schema_migrations" add constraint "schema_migrations_idempotency_key_key" UNIQUE using index "schema_migrations_idempotency_key_key";


