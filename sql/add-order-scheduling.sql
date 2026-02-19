-- Phase 39: Order Scheduling (Instant vs Advance Orders)
-- Adds order mode configuration to businesses and delivery_date to orders.

-- Add order mode columns to businesses
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS order_mode TEXT DEFAULT 'instant',
  ADD COLUMN IF NOT EXISTS min_advance_days INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_advance_days INT DEFAULT 30;

-- Add delivery_date to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_date DATE DEFAULT NULL;
