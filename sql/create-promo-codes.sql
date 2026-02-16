-- ══════════════════════════════════════
-- Promo Codes table
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  max_uses INT DEFAULT NULL,  -- NULL = unlimited
  current_uses INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT NULL,  -- NULL = never expires
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(business_id, code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_promo_codes_business ON promo_codes(business_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_lookup ON promo_codes(business_id, code, is_active);

-- RLS
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on promo_codes"
  ON promo_codes FOR ALL
  USING (true)
  WITH CHECK (true);
