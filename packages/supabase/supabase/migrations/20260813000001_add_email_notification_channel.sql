-- Adds the "email" value to notification_channel so notification_log can record
-- email sends (patient invite emails, phase 1). Kept in its own migration/transaction
-- because a new enum value can't be used in the same transaction that adds it.
ALTER TYPE public.notification_channel ADD VALUE IF NOT EXISTS 'email';
