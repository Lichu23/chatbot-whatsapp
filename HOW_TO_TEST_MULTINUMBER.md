# How to Add a New Business (Multi-Number)

## The Big Picture

Each business gets its own WhatsApp phone number **with a catalog**. The workflow has two roles:

- **You (platform admin):** Register the phone number + catalog, generate an invite code, and send it to the business owner.
- **Business owner (admin):** Texts the invite code to the WhatsApp number and completes the onboarding chat.

---

## Prerequisites: The Catalog

Every business **must** have a WhatsApp catalog. The catalog is what allows customers to:

- See products with images, descriptions, and prices inside WhatsApp
- Tap "Add to Cart" and build orders natively
- Browse by category without leaving the chat

### How the catalog works end-to-end

```
Meta Commerce Manager          Your Database            WhatsApp Chat
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ You create the   │     │ sync-catalog.js  │     │ Customer sees    │
│ catalog with     │────>│ imports products  │────>│ product cards    │
│ products, images │     │ + retailer_ids   │     │ with "Add to     │
│ and prices       │     │ into products    │     │ Cart" button     │
└──────────────────┘     │ table            │     └──────────────────┘
                         └──────────────────┘
```

1. **You** create the catalog in [Meta Commerce Manager](https://business.facebook.com/commerce) with products, images, and prices
2. **You** link it to the WhatsApp phone number in Meta Dashboard > WhatsApp > API Setup > "Catalog"
3. **You** run `setup-number.js` with `--catalog-id` so the bot knows which catalog belongs to this number
4. **You** run `sync-catalog.js` to import the catalog products into the database (so the bot can match orders)
5. **The bot** sends `product_list` messages with real catalog items — customers see images and "Add to Cart"

### Where to find the Catalog ID

1. Go to [Meta Commerce Manager](https://business.facebook.com/commerce)
2. Select your catalog
3. The **Catalog ID** is the numeric ID in the URL bar (e.g. `826714529178321`)

---

## Step-by-Step Workflow

### Step 1 — You: Register the phone number + catalog

You need three things:

| Value              | Where to find it                                                    |
| ------------------ | ------------------------------------------------------------------- |
| Phone Number ID    | Meta Dashboard > WhatsApp > API Setup > under the phone number      |
| Catalog ID         | Commerce Manager > your catalog > numeric ID in the URL             |
| Token              | Meta Dashboard > WhatsApp > API Setup > "Temporary access token"    |

Run the setup script:

```bash
# Token from .env
node scripts/setup-number.js 984012674799843 "Pizzeria Don Juan" --catalog-id 826714529178321

# With explicit token
node scripts/setup-number.js 984012674799843 "Pizzeria Don Juan" --catalog-id 826714529178321 --token EAAGz0BAx...
```

This does three things:
1. Inserts a row in `phone_numbers` table (with the catalog linked)
2. Generates an invite code (e.g. `REST-4J4K`)
3. Prints a wa.me link you can share

Output:

```
========================================
  Phone Number ID: 9840126747992222
  Display Name:    Pizzeria Don Juan
  Catalog ID:      126314529178321
  DB Row ID:       abfb6099-b052-...
  Invite Code:     REST-4J4K
  wa.me Link:      https://wa.me/5491112345678?text=REST-4J4K
========================================
```

### Step 2 — You: Send the invite code to the business owner

Share the invite code (`REST-4J4K`) or the wa.me link with the business owner. Tell them:

> "Send this code to the WhatsApp number to start setting up your business."

### Step 3 — Business owner: Text the invite code

The business owner sends `REST-4J4K` to the WhatsApp number from their personal phone. The bot responds:

> "Registration successful! Let's set up your business step by step."
> "**Step 1 of 8** -- What is the name of your business?"

### Step 4 — Business owner: Complete the 7-step onboarding

The bot guides them through a conversational setup:

| Step | What they configure            | Example input                                       |
| ---- | ------------------------------ | --------------------------------------------------- |
| 1    | Business name                  | "Pizzeria Don Juan"                                 |
| 2    | Business hours                 | "Monday to Friday 11:00-23:00, Saturday 12:00-24:00"|
| 3    | Delivery / pickup / both       | Tap a button                                        |
| 3b   | Pickup address (if applicable) | "San Martin 450"                                    |
| 4    | Payment methods                | Cash / transfer / both / both + deposit             |
| 5    | Delivery zones + prices        | "Centro $500, Norte $800"                            |
| 6    | Bank details (alias, CBU)      | "Alias: pizzajuan, CBU: 123..., Titular: Juan Perez"|
| 7    | Review + confirm               | Tap "Confirm"                                       |

Products are **not** added manually during onboarding. When the admin taps "Confirm" in Step 7, the bot **automatically**:

1. Fetches all products from the Meta catalog
2. Imports them into the database (with `retailer_id` for native cart support)
3. Activates the business
4. Sends "¡Tu negocio está activo!" with the product count

If the auto-sync fails (bad token, catalog permissions), the business stays inactive and you can fix it and run `sync-catalog.js` manually later.

### Step 5 — You (optional): Set the WhatsApp profile

```bash
node scripts/set-profile.js 123012674799843 --about "Pedidos por WhatsApp" --category "Restaurant"
```

---

## What Customers See (thanks to the catalog)

When a customer texts the WhatsApp number, the bot sends the menu as a **product_list message** using the catalog. The customer sees:

1. Product cards with **images, names, and prices** (from the Meta catalog)
2. An **"Add to Cart"** button on each product
3. A native WhatsApp **cart** where they can adjust quantities
4. A **checkout** button that sends the cart to the bot as a native order

This is much better than a plain text menu — it looks professional and customers can order without typing.

If a customer prefers, they can also type their order in natural language (e.g. "2 muzzarella y 1 coca") and the AI will match it against the catalog.

---

## Useful Scripts Reference

| Script                  | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| `setup-number.js`       | Register a phone number + catalog + generate invite code  |
| `sync-catalog.js`       | Re-sync products from Meta catalog (auto-runs on confirm) |
| `generate-codes.js`     | Generate additional invite codes for a number             |
| `list-numbers.js`       | List all registered numbers, businesses, and codes        |
| `set-profile.js`        | Set WhatsApp Business Profile (about, category, etc.)     |

### Generate extra invite codes

```bash
# 5 codes linked to a specific number
node scripts/generate-codes.js 5 --phone-number-id 123012674799843

# 10 unlinked codes
node scripts/generate-codes.js 10
```

### Check the current state

```bash
node scripts/list-numbers.js
```

---

## Testing with Only One Meta Test Number

During development you only have one test number from Meta. Here's how to still test multi-number:

### Real flow (1 business)

1. `node scripts/setup-number.js <your_test_phone_number_id> "Test Business" --catalog-id <your_catalog_id>`
2. Send the invite code from your WhatsApp to the test number
3. Complete the onboarding chat — when you confirm, products are imported automatically
4. From a different WhatsApp number (or the same, after deleting your customer state), place an order

### Simulated second business (database-only)

You can test the routing logic without a second real number:

```bash
# 1. Register a fake number (use a fake catalog ID too)
node scripts/setup-number.js FAKE_NUMBER_2 "Test Business 2" --catalog-id FAKE_CATALOG
```

Then simulate an incoming message with curl:

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "phone_number_id": "FAKE_NUMBER_2",
            "display_phone_number": "5491100000000"
          },
          "messages": [{
            "from": "5491199999999",
            "id": "wamid.test123",
            "timestamp": "1700000000",
            "type": "text",
            "text": { "body": "REST-XXXX" }
          }]
        }
      }]
    }]
  }'
```

Replace `REST-XXXX` with the code generated for `FAKE_NUMBER_2`.

The full flow runs in your server (DB routing, business creation, onboarding state). The only thing that fails is the outbound WhatsApp reply (since the number doesn't exist in Meta), but you'll see everything in the server logs.

---

## Testing Subscription Plans

Every business gets an **Intermedio trial (30 days)** automatically when onboarding completes. To test different plans and feature gating, use the SQL commands below.

### Plan Feature Matrix

| Feature | Basico ($10) | Intermedio ($20) | Pro ($60) |
| --- | --- | --- | --- |
| Monthly orders | 100 | 500 | Unlimited |
| Delivery zones | 3 | 10 | Unlimited |
| AI (natural language) | -- | Yes | Yes |
| Daily summary | -- | Yes | Yes |
| Promo codes | -- | Yes | Yes |
| Analytics queries/mo | 0 | 20 | Unlimited |
| Broadcasts | -- | -- | Yes |
| Loyalty program | -- | -- | Yes |
| Scheduled messages | -- | -- | Yes |
| Trend graphs | -- | -- | Yes |

### Step 1 — Find your business ID

```sql
SELECT id, business_name FROM businesses WHERE is_active = true;
```

### Step 2 — Check current subscription

```sql
SELECT bs.id, bs.status, bs.start_date, bs.end_date, sp.slug, sp.name
FROM business_subscriptions bs
JOIN subscription_plans sp ON sp.id = bs.plan_id
WHERE bs.business_id = 'YOUR_BUSINESS_ID'
ORDER BY bs.created_at DESC
LIMIT 1;
```

### Step 3 — Switch to a different plan

To test a specific plan, cancel the current subscription and create a new one:

```sql
-- Cancel existing subscription
UPDATE business_subscriptions
SET status = 'cancelled', updated_at = now()
WHERE business_id = 'YOUR_BUSINESS_ID' AND status != 'cancelled';

-- Activate Basico (to test feature restrictions)
INSERT INTO business_subscriptions (id, business_id, plan_id, status, start_date, end_date)
VALUES (
  gen_random_uuid(),
  'YOUR_BUSINESS_ID',
  (SELECT id FROM subscription_plans WHERE slug = 'basico'),
  'active',
  now(),
  now() + interval '30 days'
);
```

Replace `'basico'` with `'intermedio'` or `'pro'` to test other plans.

### Step 4 — Test each plan

#### Testing Basico

After switching to Basico, verify these are **blocked**:

| Send this (as admin) | Expected response |
| --- | --- |
| A natural-language message (AI intent) | Should NOT use AI classification |
| `CREAR PROMO VERANO 10%` | "Tu plan no incluye esta funcionalidad" |
| `ANALYTICS` | Blocked (0 analytics queries) |
| `TENDENCIAS` | Blocked (Pro only) |
| `DIFUSION Hola a todos` | Blocked (Pro only) |
| `CONFIGURAR FIDELIDAD 10 pedidos = 1 gratis` | Blocked (Pro only) |
| `PROGRAMAR MENSAJE 20/03 18:00 Hola` | Blocked (Pro only) |

And these **work**:

| Send this | Expected |
| --- | --- |
| `PLAN` | Shows "Básico" plan info |
| `PLANES` | Shows all 3 plans comparison |
| `RENOVAR` | Shows renewal/upgrade options |
| Customer places an order | Works (up to 100/month) |

#### Testing Intermedio

After switching to Intermedio, verify:

| Send this | Expected |
| --- | --- |
| `CREAR PROMO VERANO 10%` | Creates promo (promo_codes enabled) |
| `VER PROMOS` | Lists promos |
| `ANALYTICS` | Shows analytics report (up to 20/month) |
| `TENDENCIAS` | Blocked (Pro only) |
| `DIFUSION Hola` | Blocked (Pro only) |
| `CONFIGURAR FIDELIDAD 10 pedidos = 1 gratis` | Blocked (Pro only) |
| AI intent (e.g. "cuantos pedidos tengo hoy") | AI classifies the intent |

#### Testing Pro

After switching to Pro, **everything** should work:

| Send this | Expected |
| --- | --- |
| `ANALYTICS` | Full report, unlimited queries |
| `TENDENCIAS` | 8-week trend graphs |
| `DIFUSION Promo 2x1 hoy!` | Sends to all customers |
| `CONFIGURAR FIDELIDAD 10 pedidos = 1 gratis` | Configures loyalty |
| `VER FIDELIDAD` | Shows loyalty config |
| `PROGRAMAR MENSAJE 20/03 18:00 Hola` | Schedules message |
| `VER PROGRAMADOS` | Lists scheduled messages |
| `CREAR PROMO VERANO 10%` | Creates promo |

### Step 5 — Test order limits

To test that order limits are enforced, artificially set the monthly count close to the limit:

```sql
-- Set Basico business to 99 orders this month (limit is 100)
INSERT INTO monthly_order_counts (id, business_id, month, order_count)
VALUES (gen_random_uuid(), 'YOUR_BUSINESS_ID', to_char(now(), 'YYYY-MM'), 99)
ON CONFLICT (business_id, month) DO UPDATE SET order_count = 99;
```

Now place one order (should work), then a second (should be blocked with "order limit reached").

### Step 6 — Test subscription expiry

Force-expire a subscription to test the expiry flow:

```sql
UPDATE business_subscriptions
SET end_date = now() - interval '1 day', updated_at = now()
WHERE business_id = 'YOUR_BUSINESS_ID' AND status IN ('trial', 'active');
```

Next time the admin or a customer sends a message, `getActiveSubscription` will detect the expiry, update status to `expired`, and:
- Admin sees: "Tu suscripcion ha expirado" with renewal instructions
- Customer ordering: blocked until renewed

### Step 7 — Test super-admin payment confirmation

From the **super-admin phone** (configured in `.env` as `SUPER_ADMIN_PHONE`):

```
CONFIRMAR PAGO +5491155551234 pro
```

This activates a Pro subscription for 1 month for the business whose admin phone is `+5491155551234`.

### Automated tests

```bash
# Unit tests (no DB required) — 100 tests
node test/test-subscriptions.js

# Integration tests (requires Supabase + migrations)
node test/verify-subscriptions.js
```

### Reset subscription data

```sql
-- Reset subscription to fresh trial
DELETE FROM business_subscriptions WHERE business_id = 'YOUR_BUSINESS_ID';
DELETE FROM monthly_order_counts WHERE business_id = 'YOUR_BUSINESS_ID';
DELETE FROM analytics_usage WHERE business_id = 'YOUR_BUSINESS_ID';

-- Re-create trial (Intermedio, 30 days)
INSERT INTO business_subscriptions (id, business_id, plan_id, status, start_date, end_date)
VALUES (
  gen_random_uuid(),
  'YOUR_BUSINESS_ID',
  (SELECT id FROM subscription_plans WHERE slug = 'intermedio'),
  'trial',
  now(),
  now() + interval '30 days'
);
```

---

## Resetting Test Data

### Reset everything for a phone number

```sql
DELETE FROM customers WHERE phone = 'YOUR_WHATSAPP_NUMBER';
DELETE FROM invite_codes WHERE phone_number_id = (SELECT id FROM phone_numbers WHERE meta_phone_number_id = '123012674799843');
DELETE FROM phone_numbers WHERE meta_phone_number_id = '123012674799843';
```

Then re-run `setup-number.js`.

### Reset only your customer state (re-do onboarding chat)

```sql
DELETE FROM customers WHERE phone = 'YOUR_WHATSAPP_NUMBER';
```

Then text the invite code again.
