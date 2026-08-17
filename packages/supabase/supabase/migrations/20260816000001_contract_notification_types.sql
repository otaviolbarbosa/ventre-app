-- New notification types for contract dual-signature flow (Fase 4)
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction block with other DDL
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_ready_for_signature';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_change_requested';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_fully_signed';
