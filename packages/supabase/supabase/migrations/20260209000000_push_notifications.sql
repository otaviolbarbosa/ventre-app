-- Push Notifications Schema
-- Tables: push_subscriptions, notifications, notification_settings, scheduled_notifications

-- Enum for notification types
CREATE TYPE public.notification_type AS ENUM (
  'appointment_created',
  'appointment_updated',
  'appointment_cancelled',
  'appointment_reminder',
  'team_invite_received',
  'team_invite_accepted',
  'document_uploaded',
  'evolution_added',
  'dpp_approaching'
);

-- ============================================
-- 1. push_subscriptions - FCM tokens per device
-- ============================================
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  fcm_token text NOT NULL UNIQUE,
  device_info jsonb DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user_active ON public.push_subscriptions(user_id, is_active);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

-- ============================================
-- 2. notifications - Notification history
-- ============================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  sent_at timestamptz DEFAULT now(),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages all notifications"
  ON public.notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- ============================================
-- 3. notification_settings - User preferences
-- ============================================
CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  appointment_created boolean NOT NULL DEFAULT true,
  appointment_updated boolean NOT NULL DEFAULT true,
  appointment_cancelled boolean NOT NULL DEFAULT true,
  appointment_reminder boolean NOT NULL DEFAULT true,
  team_invite_received boolean NOT NULL DEFAULT true,
  team_invite_accepted boolean NOT NULL DEFAULT true,
  document_uploaded boolean NOT NULL DEFAULT true,
  evolution_added boolean NOT NULL DEFAULT true,
  dpp_approaching boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own settings"
  ON public.notification_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;

-- Auto-create default settings for new users
CREATE OR REPLACE FUNCTION public.create_default_notification_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notification_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_created_notification_settings
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_notification_settings();

-- ============================================
-- 4. scheduled_notifications - Reminder queue
-- ============================================
CREATE TABLE public.scheduled_notifications (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  notification_type public.notification_type NOT NULL,
  reference_id uuid NOT NULL,
  reference_type text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  payload jsonb DEFAULT '{}',
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_scheduled_unique
  ON public.scheduled_notifications(notification_type, reference_id, scheduled_for)
  WHERE processed_at IS NULL;

CREATE INDEX idx_scheduled_pending
  ON public.scheduled_notifications(scheduled_for)
  WHERE processed_at IS NULL;

ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Only service_role can access scheduled_notifications
CREATE POLICY "Service role manages scheduled notifications"
  ON public.scheduled_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.scheduled_notifications TO service_role;

-- Create default notification_settings for existing users
INSERT INTO public.notification_settings (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;
