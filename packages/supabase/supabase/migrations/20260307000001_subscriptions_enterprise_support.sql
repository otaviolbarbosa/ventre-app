-- Allow user_id to be nullable on subscriptions (enterprise subscriptions may not have a user)
ALTER TABLE subscriptions ALTER COLUMN user_id DROP NOT NULL;

-- Add enterprise_id as optional FK to enterprises
ALTER TABLE subscriptions ADD COLUMN enterprise_id uuid REFERENCES enterprises(id) ON DELETE SET NULL;
