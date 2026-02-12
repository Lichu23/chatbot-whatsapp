-- WhatsApp Onboarding Bot — Full Schema

-- 1. Invite codes
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  used_by_phone TEXT,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Admins
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  invite_code_id UUID REFERENCES invite_codes(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Businesses
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_phone TEXT UNIQUE NOT NULL REFERENCES admins(phone),
  business_name TEXT,
  business_hours TEXT,
  business_address TEXT,
  has_delivery BOOLEAN DEFAULT false,
  has_pickup BOOLEAN DEFAULT false,
  accepts_cash BOOLEAN DEFAULT true,
  accepts_transfer BOOLEAN DEFAULT true,
  accepts_deposit BOOLEAN DEFAULT false,
  deposit_percent INTEGER,
  is_active BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Bank details
CREATE TABLE bank_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID UNIQUE NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  cbu TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Delivery zones
CREATE TABLE delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  zone_name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  category TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. User states (onboarding step tracking)
CREATE TABLE user_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL REFERENCES admins(phone),
  current_step TEXT NOT NULL,
  business_id UUID REFERENCES businesses(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Conversation memory (AI context per step)
CREATE TABLE conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  step TEXT NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(phone, step)
);

-- 9. Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number SERIAL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_phone TEXT NOT NULL,
  client_name TEXT,
  client_address TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  delivery_zone_id UUID REFERENCES delivery_zones(id),
  delivery_price NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  deposit_amount NUMERIC,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  order_status TEXT NOT NULL DEFAULT 'nuevo',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Customer states (order flow step tracking + temp cart)
CREATE TABLE customer_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  current_step TEXT NOT NULL,
  cart JSONB DEFAULT '[]'::jsonb,
  selected_zone_id UUID REFERENCES delivery_zones(id),
  delivery_method TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════
-- Row Level Security (RLS)
-- Only the service_role can access data.
-- The anon role is blocked from all operations.
-- ══════════════════════════════════════════════

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_states ENABLE ROW LEVEL SECURITY;

-- service_role bypasses RLS automatically, so we only need
-- policies if we want anon access. Since this is a backend-only
-- app, we create no anon policies — all anon access is denied.

-- Policies for service_role (explicit, for clarity and as a safety net)
CREATE POLICY "service_role_all" ON invite_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON admins FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON businesses FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON bank_details FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON delivery_zones FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON products FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON user_states FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON conversation_memory FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON customer_states FOR ALL TO service_role USING (true) WITH CHECK (true);
