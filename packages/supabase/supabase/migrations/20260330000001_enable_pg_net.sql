-- Enable pg_net extension to allow HTTP calls from PostgreSQL functions
-- Required by process_scheduled_notifications() which uses net.http_post()
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Enable pgmq extension (PostgreSQL Message Queue)
CREATE EXTENSION IF NOT EXISTS pgmq;
