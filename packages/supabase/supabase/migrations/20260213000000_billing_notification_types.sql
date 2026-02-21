-- Extend notification_type enum with billing types
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction block
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'billing_created';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'billing_payment_received';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'billing_reminder';
