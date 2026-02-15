-- Phase 24, Item 126: Error recovery — failed_messages table
CREATE TABLE IF NOT EXISTS failed_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number_id TEXT,
  sender_phone TEXT,
  raw_payload JSONB,
  error_message TEXT,
  error_stack TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  retried BOOLEAN DEFAULT false
);

CREATE INDEX idx_failed_messages_created_at ON failed_messages (created_at);
CREATE INDEX idx_failed_messages_retried ON failed_messages (retried) WHERE retried = false;
