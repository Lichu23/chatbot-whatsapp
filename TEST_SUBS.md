  ---                                                                                                                             
  1. Run SQL migrations (in Supabase SQL Editor, in this order)
                                                                                                                                    -- Run these one at a time in Supabase Dashboard > SQL Editor                                                                   

  Order: 1
  File: sql/create-subscriptions.sql
  What it creates: subscription_plans + business_subscriptions + monthly_order_counts + seeds 3 plans
  ────────────────────────────────────────
  Order: 2
  File: sql/create-promo-codes.sql
  What it creates: promo_codes table
  ────────────────────────────────────────
  Order: 3
  File: sql/create-analytics-usage.sql
  What it creates: analytics_usage table
  ────────────────────────────────────────
  Order: 4
  File: sql/create-scheduled-messages.sql
  What it creates: scheduled_messages table
  ────────────────────────────────────────
  Order: 5
  File: sql/create-loyalty.sql
  What it creates: loyalty_config + loyalty_cards tables

  Copy-paste each file's content into the Supabase SQL Editor and run them. After running create-subscriptions.sql, verify the 3  
  plans exist:

  SELECT slug, name, price_usd FROM subscription_plans;
  -- Should show: basico/$10, intermedio/$20, pro/$60

  ---
  2. Run setup-number.js

  node scripts/setup-number.js <your_phone_number_id> "Your Business Name" --catalog-id <your_catalog_id>

  Then send the invite code from WhatsApp, complete the 7-step onboarding, and confirm. On confirmation, the bot auto-creates an  
  Intermedio trial (30 days).

  ---
  3. SQL to test each plan

  Once your business is active, grab your business ID:

  SELECT id, business_name FROM businesses WHERE is_active = true;

  Then use these to switch plans. Replace YOUR_BUSINESS_ID with the actual UUID.

  Switch to Basico (test restrictions)

  UPDATE business_subscriptions
  SET status = 'cancelled', updated_at = now()
  WHERE business_id = 'YOUR_BUSINESS_ID' AND status != 'cancelled';

  INSERT INTO business_subscriptions (id, business_id, plan_id, status, start_date, end_date)
  VALUES (
    gen_random_uuid(),
    'YOUR_BUSINESS_ID',
    (SELECT id FROM subscription_plans WHERE slug = 'basico'),
    'active',
    now(),
    now() + interval '30 days'
  );

  What to test: AI blocked, CREAR PROMO blocked, ANALYTICS blocked, TENDENCIAS blocked, DIFUSION blocked, CONFIGURAR FIDELIDAD    
  blocked. Customer ordering works (up to 100/month). PLAN, PLANES, RENOVAR work.

  Switch to Intermedio (test mid-tier)

  UPDATE business_subscriptions
  SET status = 'cancelled', updated_at = now()
  WHERE business_id = 'YOUR_BUSINESS_ID' AND status != 'cancelled';

  INSERT INTO business_subscriptions (id, business_id, plan_id, status, start_date, end_date)
  VALUES (
    gen_random_uuid(),
    'YOUR_BUSINESS_ID',
    (SELECT id FROM subscription_plans WHERE slug = 'intermedio'),
    'active',
    now(),
    now() + interval '30 days'
  );

  What to test: AI works, CREAR PROMO works, ANALYTICS works (20/month). TENDENCIAS blocked, DIFUSION blocked, CONFIGURAR
  FIDELIDAD blocked.

  Switch to Pro (test everything unlocked)

  UPDATE business_subscriptions
  SET status = 'cancelled', updated_at = now()
  WHERE business_id = 'YOUR_BUSINESS_ID' AND status != 'cancelled';

  INSERT INTO business_subscriptions (id, business_id, plan_id, status, start_date, end_date)
  VALUES (
    gen_random_uuid(),
    'YOUR_BUSINESS_ID',
    (SELECT id FROM subscription_plans WHERE slug = 'pro'),
    'active',
    now(),
    now() + interval '30 days'
  );

  What to test: Everything works — ANALYTICS, TENDENCIAS, DIFUSION, CONFIGURAR FIDELIDAD, PROGRAMAR MENSAJE, CREAR PROMO.

  Test expired subscription

  UPDATE business_subscriptions
  SET end_date = now() - interval '1 day', updated_at = now()
  WHERE business_id = 'YOUR_BUSINESS_ID' AND status IN ('trial', 'active');

  What to test: Admin gets "tu suscripcion ha expirado" message. Customer ordering blocked.

  Reset back to fresh trial

  DELETE FROM business_subscriptions WHERE business_id = 'YOUR_BUSINESS_ID';
  DELETE FROM monthly_order_counts WHERE business_id = 'YOUR_BUSINESS_ID';
  DELETE FROM analytics_usage WHERE business_id = 'YOUR_BUSINESS_ID';

  INSERT INTO business_subscriptions (id, business_id, plan_id, status, start_date, end_date)
  VALUES (
    gen_random_uuid(),
    'YOUR_BUSINESS_ID',
    (SELECT id FROM subscription_plans WHERE slug = 'intermedio'),
    'trial',
    now(),
    now() + interval '30 days'
  );
