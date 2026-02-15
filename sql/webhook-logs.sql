-- Phase 24, Item 129: Webhook logs table for debugging
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number_id TEXT,
  sender_phone TEXT,
  message_type TEXT,
  raw_payload JSONB,
  processed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_webhook_logs_created_at ON webhook_logs (created_at);

-- Auto-cleanup: delete logs older than 7 days (run via pg_cron or application-level timer)
-- DELETE FROM webhook_logs WHERE created_at < now() - interval '7 days';
