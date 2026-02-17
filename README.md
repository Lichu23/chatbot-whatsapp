# WhatsApp Ordering System for Small Businesses (Argentina-focused)

**Modern multi-tenant WhatsApp commerce platform** built for Argentine small/medium businesses (delivery, pickup, local payment methods).

Businesses onboard via WhatsApp → configure menu, hours, zones, payments → receive & manage orders via commands + AI → all powered by **Meta WhatsApp Business Platform (Cloud API)**.

**Replaced Twilio** with official **Meta Cloud API** (2025+ architecture).

## ✨ Key Features

- **Multi-number / multi-business** architecture (one server → many WhatsApp Business numbers)
- **Self-service onboarding** via invite code → guided flow (text + AI extraction)
- **Interactive messages**: buttons, lists, native catalog, location picker
- **Meta Product Catalog** integration (native WhatsApp cart + checkout)
- **AI-powered**:
  - Product catalog extraction from photos/text (Groq + Ollama fallback)
  - Natural language order parsing (Groq fast JSON mode)
- **Subscription tiers** (Basico / Intermedio / Pro) with feature gating
  - Basico: commands only, order/zone limits
  - Intermedio: AI + analytics (limited) + promos
  - Pro: broadcasts, loyalty cards, scheduled messages, unlimited
- **Order flow**: menu → cart → delivery/pickup → zone → payment → native location / bank info
- **Admin commands**: manage orders, products, status, sales summaries, analytics
- **Argentine Spanish** messaging (friendly, local tone)
- **Security & production hardening**: webhook signature validation, rate limiting, structured logging, error recovery

## 🛠 Tech Stack (February 2026)

| Layer              | Technology                          | Purpose / Notes                                      |
|--------------------|-------------------------------------|------------------------------------------------------|
| Backend            | Node.js 18+ / Express               | Core server & webhook handler                        |
| Messaging          | Meta WhatsApp Cloud API             | Official replacement for Twilio                      |
| Database           | Supabase (PostgreSQL)               | Schema, CRUD, realtime subscriptions possible        |
| AI / JSON Parsing  | Groq API (fast) + Ollama (fallback) | Product extraction & natural language order parsing  |
| Interactive UI     | WhatsApp interactive messages       | Buttons (max 3), Lists (max 10), Catalog, Location   |
| Scheduler          | setInterval / cron-like             | Daily summaries, scheduled messages (Pro)            |
| Authentication     | Invite codes → phone number linking | Multi-tenant isolation                               |
| Environment        | dotenv + per-number config in DB    | Dynamic credentials (no global .env in prod)         |
| Logging & Monitoring | Structured JSON logs + Supabase table | Failed messages retry queue, error alerts via WA   |
| Hosting (typical)  | Railway / Render / VPS              | Webhook needs public HTTPS                           |

## Current Status (February 2026)

✅ Fully functional single- & multi-number mode  
✅ Meta Cloud API + interactive messages + native catalog/cart  
✅ Subscription system + trial + gating  
✅ Groq primary AI + Ollama fallback  
✅ Argentine payment flows (transfer/deposit/cash)  
🚧 Advance/instant order scheduling (in progress)

## Project Structure (simplified)

```text
src/
├── config/             # constants, steps, plans
├── services/
│   ├── database.js     # Supabase client & queries
│   ├── whatsapp.js     # Meta API send helpers (dynamic credentials)
│   ├── groq.js         # Fast JSON chat completions
│   ├── subscription.js # Plan checks & gating
│   ├── analytics.js
│   └── ...             # other services
├── workflows/
│   ├── registration.js
│   ├── admin-workflow.js
│   ├── customer-workflow.js
│   └── ...             # other workflows
└── scripts/            # CLI helpers
    ├── setup-number.js
    ├── set-profile.js
    ├── generate-codes.js
    └── ...
```
## Setup (Development)

1. Clone repo
2. `npm install`
3. Copy `.env.example` → `.env` and fill:
   - `SUPABASE_URL` & `SUPABASE_KEY`
   - `GROQ_API_KEY`
   - (optional) default `META_PHONE_NUMBER_ID` / `META_ACCESS_TOKEN` for dev mode
4. Run migrations (SQL files in `/sql`)
5. `npm run dev`

> Production uses **database-stored credentials** per phone number (see `getPhoneConfig()` logic).

## Important Notes

- Uses **official Meta WhatsApp Business Platform Cloud API** (no Twilio anymore)
- Complies with Meta policies: webhook signature validation, opt-in, template usage where required
- Designed for **Argentina**: transfer/deposit payments, local Spanish, delivery zones with prices
- **Not** a generic open-source bot — business SaaS platform with monetization logic

## License

Private / proprietary © 2026 — contact for licensing, white-label, or collaboration opportunities.

Made with ❤️ for Argentine emprendedores.
