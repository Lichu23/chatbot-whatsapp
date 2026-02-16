-- ══════════════════════════════════════
-- Analytics Usage tracking table
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS analytics_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  month TEXT NOT NULL,  -- '2026-02'
  query_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(business_id, month)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analytics_usage_business ON analytics_usage(business_id);
CREATE INDEX IF NOT EXISTS idx_analytics_usage_lookup ON analytics_usage(business_id, month);

-- RLS
ALTER TABLE analytics_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on analytics_usage"
  ON analytics_usage FOR ALL
  USING (true)
  WITH CHECK (true);
