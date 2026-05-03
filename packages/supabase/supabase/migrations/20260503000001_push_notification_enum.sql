-- New notification types for trigger-based push notifications
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction block in PG < 12
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'patient_added';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'team_member_added';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'obstetric_history_updated';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'risk_factors_updated';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'pregnancy_evolution_added';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'lab_exam_added';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'other_exam_added';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ultrasound_added';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'vaccine_updated';
