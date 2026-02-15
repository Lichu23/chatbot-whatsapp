-- Phase 18: Multi-Number Database Schema
-- Creates the phone_numbers table and adds FK columns to businesses and invite_codes

CREATE TABLE phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_phone_number_id TEXT UNIQUE NOT NULL,
  meta_whatsapp_token TEXT NOT NULL,
  catalog_id TEXT,
  display_name TEXT,
  business_id UUID REFERENCES businesses(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add phone_number_id FK to businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS phone_number_id UUID REFERENCES phone_numbers(id);

-- Add phone_number_id FK to invite_codes
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS phone_number_id UUID REFERENCES phone_numbers(id);

-- Index for fast webhook routing
CREATE INDEX IF NOT EXISTS idx_phone_numbers_meta_id ON phone_numbers(meta_phone_number_id);

-- RLS (matches pattern from all other tables)
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON phone_numbers FOR ALL TO service_role USING (true) WITH CHECK (true);
