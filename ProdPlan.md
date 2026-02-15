# Production Plan — WhatsApp Onboarding Chatbot as a Service

---

## How It Works

You sell a **WhatsApp ordering bot** to small businesses (restaurants, bakeries, etc.).
Each client gets their own WhatsApp number with their brand name, profile picture, and product catalog.
You manage all the infrastructure. The client only interacts through WhatsApp.

---

## Expenses Breakdown

### One-Time Setup Costs (you pay once)

| Item | Cost | Why |
|---|---|---|
| Meta Business verification | Free | Required to message >250 users/day. You upload your ID/business docs. |
| Supabase project | Free | Free tier: 500MB, 50K rows. More than enough to start. |
| Groq API key | Free | Free tier: 30 req/min. Handles AI parsing for orders/products. |
| Domain name (optional) | ~$10/year | For your webhook URL. Not required if using Railway/Render subdomain. |

**Total one-time: ~$0-10**

### Per-Client Setup Costs (each new business you onboard)

| Item | Cost | Why |
|---|---|---|
| SIM card / virtual number | $2-5 | Each business needs a unique phone number not already on WhatsApp. |
| Meta catalog creation | Free | You create a product catalog in Meta Commerce Manager for each business. |
| Profile picture + display name | Free | Set via Meta WhatsApp Manager or API. Name is reviewed by Meta (takes minutes to 48h). |

**Total per client: ~$2-5**

### Monthly Recurring Costs

| Item | Free Tier | When You Start Paying | Cost Beyond Free |
|---|---|---|---|
| **Hosting** (Railway/Render/VPS) | Railway: $5 credit/mo; Render: free but sleeps | Immediately — you need always-on for webhooks | $5-7/mo for a single always-on instance |
| **Supabase** | 500MB, 50K rows, 500K edge function calls | When you exceed 50K rows (~30+ active businesses) | $25/mo (Pro plan) |
| **Groq API** | 30 requests/min, 14,400/day | Very unlikely to exceed with <50 businesses | $0.05-0.10 per 1M tokens |
| **Meta conversations** | 1,000 free conversations/month **per phone number** | When a single business exceeds 1,000 convos/month | $0.01-0.08 per conversation (varies by country) |

### Monthly Cost Scenarios

#### Scenario 1: Free Trial — 3 businesses, ~100 orders/month total

| Item | Cost |
|---|---|
| Hosting | $5-7 |
| Supabase | $0 |
| Groq | $0 |
| Meta conversations (3 numbers x ~100 convos each = 300 total) | $0 (each number has 1,000 free) |
| SIM cards (one-time, already bought) | — |
| **Total monthly** | **$5-7** |

#### Scenario 2: Growing — 10 businesses, ~500 orders/month total

| Item | Cost |
|---|---|
| Hosting | $7 |
| Supabase | $0 |
| Groq | $0 |
| Meta conversations (10 x ~200 convos = 2,000 total) | $0 (each number has its own 1,000 free) |
| **Total monthly** | **~$7** |

This is the key insight: **each phone number gets 1,000 free conversations independently**, so 10 clients = 10,000 free conversations/month.

#### Scenario 3: Scaling — 30 businesses, some popular ones

| Item | Cost |
|---|---|
| Hosting (may need a bigger instance) | $10-20 |
| Supabase (approaching 50K rows) | $0-25 |
| Groq | $0 |
| Meta conversations (a few busy businesses exceeding 1,000) | $5-20 |
| **Total monthly** | **$15-65** |

---

## When You Spend the Most Money

1. **Day 1**: Hosting starts (~$5-7/mo). This is your only cost from the beginning.
2. **Per client**: $2-5 for a SIM card. Negligible.
3. **At ~30 businesses**: Supabase may need the Pro plan ($25/mo).
4. **When a business gets popular (>1,000 conversations/month)**: Meta starts charging. This is when you should already be charging the client.

**The free trial period (1 month) costs you almost nothing** — $5-7 hosting + a SIM card per client. The free tiers of Meta, Supabase, and Groq absorb everything.

---

## Offering a One-Month Free Trial

### What the client gets for free:
- A dedicated WhatsApp number with their business name and logo
- Full product catalog with prices (native WhatsApp catalog + shopping cart)
- Automated ordering bot (their customers can browse, order, and pay)
- All admin commands (manage orders, products, hours, delivery, payments)

### What you absorb during the trial:
- Hosting: $5-7/mo (shared across all clients)
- SIM card: $2-5 (one-time)
- Meta conversations: almost certainly $0 (within free tier)

### After the trial, charge:
- Suggested: $15-30/month per business (covers costs + profit)
- Your margin at 10 clients paying $20/mo: $200 revenue - $7 costs = **$193/mo profit**

---

## Steps Before You Can Onboard ANY Client

These are the one-time infrastructure steps you must complete first.

### 1. Meta Business Setup (~1-3 days for verification)

1. **Create a Meta Business Account** at business.facebook.com (or use an existing one)
2. **Create a Meta App** (type: Business) at developers.facebook.com
3. **Add the WhatsApp product** to the app
4. **Complete Business Verification** — upload government ID or business registration docs. Meta reviews this in 1-3 business days. This lets you message >250 unique users/day and add multiple phone numbers.
5. **Generate a System User access token** (permanent token, not the 24h test token):
   - Go to Business Settings → System Users → Add
   - Create a System User with Admin role
   - Assign the WhatsApp app to the System User
   - Generate a permanent token with `whatsapp_business_messaging` and `whatsapp_business_management` permissions
6. **Note**: The test phone number Meta gives you is for development only — do NOT use it in production.

### 2. Server Deployment (~30 minutes)

1. **Push the code** to a Git repo (GitHub, GitLab, etc.)
2. **Deploy to Railway, Render, or a VPS**:
   - Railway: connect the repo, it auto-deploys
   - Render: similar, connect repo and set environment
   - VPS: install Node.js, clone repo, use PM2 to keep it running
3. **Set environment variables** on the hosting platform (from `.env`)
4. **Verify the server is reachable**: visit `https://your-server.com/health`

### 3. Supabase Setup (~15 minutes)

1. **Create a Supabase project** (free tier)
2. **Run all SQL migrations** to create tables: `invite_codes`, `admins`, `user_states`, `businesses`, `products`, `delivery_zones`, `bank_details`, `customer_states`, `orders`
3. **Add the new `phone_numbers` table** (see Phase 18 in PHASES.md) for multi-number support
4. **Copy the Supabase URL and anon/service key** into your environment variables

### 4. Groq API (~2 minutes)

1. **Sign up** at console.groq.com
2. **Create an API key**
3. **Add it** to your environment variables as `GROQ_API_KEY`

### 5. Webhook Configuration (~5 minutes)

1. In Meta App Dashboard → WhatsApp → Configuration
2. Set **Callback URL** to `https://your-server.com/webhook/whatsapp`
3. Set **Verify Token** to match your `META_VERIFY_TOKEN` environment variable
4. **Subscribe** to the `messages` webhook field
5. Verify the webhook is connected (Meta sends a GET request, your server responds with the challenge)

---

## Steps Before Giving the Chatbot to EACH Client

This is the per-client checklist you follow every time you onboard a new business.

### 1. Register a Phone Number (~10-15 minutes)

1. **Buy a SIM card** (or virtual number) that is NOT already on WhatsApp
2. In Meta Business Manager → WhatsApp Manager → Phone Numbers → **Add Phone Number**
3. **Verify the number** with the SMS code Meta sends
4. The number is now registered under the Cloud API

### 2. Set the Business Profile (~5-10 minutes)

1. **Set the display name** — In WhatsApp Manager → Phone Numbers → click the number → Edit.
   - Must follow Meta's naming policy (real business name, not generic like "Restaurant")
   - Meta reviews the name — takes minutes to 48 hours
2. **Set the profile picture** — via the WhatsApp Manager dashboard or the API:
   - Ask the client for their logo (square image, at least 640x640px)
   - Upload it in WhatsApp Manager or via the Profile API
3. **Set the description/about** — e.g., "Pedidos online por WhatsApp" or the client's tagline
4. **Set the business category** — Restaurant, Bakery, etc.

### 3. Create the Meta Product Catalog (~15-30 minutes)

1. Go to **Meta Commerce Manager** → Create a catalog → Type: E-commerce
2. **Add products manually** or via spreadsheet (CSV upload):
   - Product name
   - Price (in local currency)
   - Description (optional)
   - Image (the client should provide product photos)
   - Content ID / Retailer ID (you'll use this to link with your database)
3. **Connect the catalog** to the WhatsApp Business Account:
   - Commerce Manager → Settings → Business Assets → WhatsApp → link to the phone number
4. **Wait for catalog review** — Meta reviews each product (usually fast, but can take up to 24h for the first catalog)

### 4. Configure the Database for This Business (~5 minutes)

1. **Generate an invite code**: `node scripts/generate-codes.js 1`
2. **Store the phone number's credentials** in the new `phone_numbers` table:
   - `meta_phone_number_id` (from Meta dashboard)
   - `meta_whatsapp_token` (your System User token — same for all numbers under your account)
   - `catalog_id` (from Meta Commerce Manager)
3. **Note the invite code** to give to the client

### 5. Sync the Catalog (~2 minutes)

1. Run `node scripts/sync-catalog.js <business_id>` to pull products from Meta catalog into your database
2. Verify the products are synced: check the `products` table in Supabase

### 6. Client Onboarding (~10 minutes, the client does this)

1. **Send the invite code** to the client (e.g., "Tu código es REST-A3K7. Mandalo al número +34 XXX XXX XXX")
2. The client texts the code to their assigned WhatsApp number
3. **The bot guides them through onboarding**:
   - Business name, hours, delivery method, zones, payment methods, bank details
   - Products are already loaded from the catalog — the client can review and adjust
4. The client confirms and the business is **active**

### 7. Final Verification (~5 minutes)

1. **Test as a customer**: text "hola" from a different phone to the business's number
2. Verify:
   - The catalog shows with product images and prices
   - The native WhatsApp cart works (add to cart → checkout)
   - The order goes through (delivery/pickup, payment, confirmation)
   - The admin (client) receives the order notification
3. **Share the ordering link** with the client: `wa.me/XXXXXXXXXXX`
   - The client can share this link on social media, menus, business cards, etc.

---

## What the Client NEVER Needs to Do

- Create a Meta or Facebook account
- Set up any technology
- Use a computer
- Install any app (they already have WhatsApp)
- Learn a dashboard or admin panel

**Everything is managed through WhatsApp chat.**

---

## Summary Timeline for Onboarding a New Client

| Step | Who | Time |
|---|---|---|
| Buy SIM + register number | You | 15 min |
| Set display name + picture | You | 10 min (+ up to 48h Meta review) |
| Create product catalog | You (with client's product info) | 15-30 min |
| Sync catalog + generate invite code | You | 5 min |
| Client completes onboarding via WhatsApp | Client | 10 min |
| You verify everything works | You | 5 min |
| **Total active work** | | **~1 hour** |
| **Calendar time (Meta reviews)** | | **1-2 days** |
