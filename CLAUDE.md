# CLAUDE.md — Project Instructions

## What is this project?
WhatsApp chatbot platform for food businesses (restaurants, bakeries, etc.) in Argentina/Spain. Businesses onboard via WhatsApp, customers order via WhatsApp. Everything happens inside WhatsApp — no frontend needed (except a landing page).

## Tech Stack
- **Runtime:** Node.js 18+ (CommonJS)
- **Server:** Express 5.x — single webhook route
- **Database:** Supabase (PostgreSQL) via `@supabase/supabase-js` v2
- **WhatsApp:** Meta Cloud API (Graph API v21.0) — NOT Twilio
- **LLM:** Cascading chain: Groq → Cerebras → Mistral → OpenRouter (all free tiers, auto-fallback on 429)
- **Frontend:** Separate Next.js + Tailwind app in `/frontend/` (landing page only)
- **No TypeScript, no ORM, no Redis, no Docker**

## Project Structure
```
src/
  index.js              — Express server entry
  config/index.js       — All constants (STEPS, CUSTOMER_STEPS, PLAN_SLUGS)
  routes/webhook.js     — POST/GET /webhook/whatsapp, /health, rate limit, signature validation
  services/
    workflow.js         — Admin state machine (onboarding + edit + commands)
    customer-workflow.js — Customer ordering state machine
    database.js         — All Supabase queries (~100 functions)
    whatsapp.js         — Meta API: sendMessage, sendButtons, sendList, sendCatalogList, etc.
    llm.js              — Cascading LLM with auto-fallback
    ai.js               — AI prompts: extractHours, extractZones, extractProducts, classifyAdminIntent
    subscription.js     — Plan gating, order limits, feature access
    promos.js           — Promo code CRUD + validation
    loyalty.js          — Stamp card system
    analytics.js        — Top products, repeat rate, peak hours, trends
    catalog.js          — Meta Catalog API: sync, visibility, availability
    scheduler.js        — 15-min interval: daily summaries + scheduled messages
    registration.js     — Invite code validation + admin creation
  utils/
    commands.js         — Exact command parser (PEDIDOS, VER PEDIDOS, CREAR PROMO, etc.)
    extract-message.js  — Parse Meta webhook payload → normalized message
sql/                    — Individual migration files (run in Supabase SQL editor)
scripts/                — CLI tools: setup-number, sync-catalog, generate-codes, etc.
```

## Key Architecture Decisions
- **State machine pattern:** Every admin/customer has `current_step` in DB. Each message advances state.
- **Multi-number:** `phone_numbers` table stores per-number credentials. Webhook routes by `metadata.phone_number_id`.
- **Per-business isolation:** All queries include `business_id`. Customer states are `(phone, business_id)` unique.
- **No workers/queues:** Single Node.js process handles everything.
- **LLM responses:** Always `response_format: { type: "json_object" }` for structured output.

## Coding Conventions
- Language: JavaScript (CommonJS `require`/`module.exports`)
- All user-facing text is in **Spanish** (Argentine Spanish)
- Database column names: `snake_case`
- JS variables: `camelCase`
- WhatsApp interactive messages: max 3 buttons, max 10 list rows
- State transitions: `db.updateCustomerStep()` or `db.upsertCustomerState()`
- Order context is stored as a special cart item with `_order_context: true` flag
- Prices formatted with `formatPrice()` using `es-AR` locale

## Environment Variables
See `.env.example` for all variables. Key ones:
- `META_WHATSAPP_TOKEN`, `META_PHONE_NUMBER_ID`, `META_APP_SECRET` — WhatsApp API
- `SUPABASE_URL`, `SUPABASE_KEY` — Database
- `GROQ_API_KEY` (+ optional CEREBRAS/MISTRAL/OPENROUTER) — LLM
- `ALERT_PHONE` — Super-admin phone for error alerts + admin commands

## SQL Migrations
Run in Supabase SQL Editor in this order:
1. `supabase/schema.sql` (base tables)
2. `sql/create-phone-numbers.sql`
3. `sql/add-retailer-id.sql`
4. `sql/create-subscriptions.sql`
5. `sql/customer-states-per-business.sql`
6. `sql/create-promo-codes.sql`
7. `sql/create-analytics-usage.sql`
8. `sql/create-loyalty.sql`
9. `sql/create-scheduled-messages.sql`
10. `sql/failed-messages.sql`
11. `sql/webhook-logs.sql`
12. `sql/add-order-scheduling.sql`

## Commands
- `npm start` — Production
- `npm run dev` — Development (auto-reload with `--watch`)
- `node scripts/setup-number.js <phoneNumberId> "Name"` — Register a WhatsApp number
- `node scripts/sync-catalog.js` — Sync Meta catalog products
- `node scripts/generate-codes.js` — Generate invite codes
- `node test/test-subscriptions.js` — Run unit tests
