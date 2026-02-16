-- ══════════════════════════════════════
-- Loyalty system tables
-- ══════════════════════════════════════

-- Loyalty configuration per business
CREATE TABLE IF NOT EXISTS loyalty_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  threshold INT NOT NULL DEFAULT 10,          -- orders needed for reward
  reward_type TEXT NOT NULL DEFAULT 'free_order' CHECK (reward_type IN ('free_order', 'discount_percent', 'discount_fixed')),
  reward_value NUMERIC NOT NULL DEFAULT 0,    -- 0 for free_order, % or $ for discounts
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Loyalty cards — one per customer per business
CREATE TABLE IF NOT EXISTS loyalty_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  order_count INT NOT NULL DEFAULT 0,
  rewards_claimed INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(business_id, customer_phone)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_config_business ON loyalty_config(business_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_business ON loyalty_cards(business_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_lookup ON loyalty_cards(business_id, customer_phone);

-- RLS
ALTER TABLE loyalty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on loyalty_config"
  ON loyalty_config FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on loyalty_cards"
  ON loyalty_cards FOR ALL USING (true) WITH CHECK (true);
