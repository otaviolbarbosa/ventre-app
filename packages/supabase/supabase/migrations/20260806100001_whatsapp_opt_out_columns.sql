ALTER TABLE public.patients
  ADD COLUMN whatsapp_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.notification_settings
  ADD COLUMN whatsapp_enabled boolean NOT NULL DEFAULT true;
