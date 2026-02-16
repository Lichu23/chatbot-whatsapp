-- Phase 26: Subscription System Tables
-- Creates subscription_plans, business_subscriptions, and monthly_order_counts

-- ── Subscription Plans ──

CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price_usd NUMERIC NOT NULL,
  monthly_order_limit INT,  -- NULL = unlimited
  delivery_zone_limit INT NOT NULL DEFAULT 3,
  ai_enabled BOOLEAN NOT NULL DEFAULT false,
  daily_summary BOOLEAN NOT NULL DEFAULT false,
  promo_codes BOOLEAN NOT NULL DEFAULT false,
  analytics_queries_limit INT NOT NULL DEFAULT 0,
  broadcasts BOOLEAN NOT NULL DEFAULT false,
  loyalty BOOLEAN NOT NULL DEFAULT false,
  scheduled_messages BOOLEAN NOT NULL DEFAULT false,
  trends BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON subscription_plans FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Business Subscriptions ──

CREATE TABLE business_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'trial',
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_business_subscriptions_business ON business_subscriptions(business_id);
CREATE INDEX idx_business_subscriptions_status ON business_subscriptions(status);

ALTER TABLE business_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON business_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Monthly Order Counts ──

CREATE TABLE monthly_order_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  month TEXT NOT NULL,  -- format: '2026-02'
  order_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, month)
);

CREATE INDEX idx_monthly_order_counts_lookup ON monthly_order_counts(business_id, month);

ALTER TABLE monthly_order_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON monthly_order_counts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Seed Plans ──

INSERT INTO subscription_plans (slug, name, price_usd, monthly_order_limit, delivery_zone_limit, ai_enabled, daily_summary, promo_codes, analytics_queries_limit, broadcasts, loyalty, scheduled_messages, trends)
VALUES
  ('basico', 'Básico', 10, 100, 3, false, false, false, 0, false, false, false, false),
  ('intermedio', 'Intermedio', 20, 500, 10, true, true, true, 20, false, false, false, false),
  ('pro', 'Pro', 60, NULL, 999, true, true, true, 999, true, true, true, true);
