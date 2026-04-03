-- Add admin user type. Reserved for the admin app — not assignable via the web app.
ALTER TYPE "public"."user_type" ADD VALUE IF NOT EXISTS 'admin';
