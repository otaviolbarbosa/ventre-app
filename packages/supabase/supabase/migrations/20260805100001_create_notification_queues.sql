-- Notification queues (Supabase Queues / pgmq)
-- push_notifications: Firebase channel, migrated from scheduled_notifications (shadow mode this phase)
-- whatsapp_notifications: Meta Cloud API channel, no consumer yet (arrives in Phase 2)
SELECT pgmq.create('push_notifications');
SELECT pgmq.create('whatsapp_notifications');
