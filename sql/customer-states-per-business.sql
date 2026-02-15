-- Migration: Make customer_states per-business
-- A customer can now have separate order states for different businesses.

-- 1. Drop the old UNIQUE constraint on phone only
ALTER TABLE customer_states DROP CONSTRAINT IF EXISTS customer_states_phone_key;

-- 2. Add a new UNIQUE constraint on (phone, business_id)
ALTER TABLE customer_states ADD CONSTRAINT customer_states_phone_business_unique UNIQUE (phone, business_id);

-- 3. Create an index for faster lookups by phone + business_id
CREATE INDEX IF NOT EXISTS idx_customer_states_phone_business ON customer_states (phone, business_id);
