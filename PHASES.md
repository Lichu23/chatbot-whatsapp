# Implementation Phases

---

## Phase 1 — Foundation ✅
- [x] 1. Express server + Twilio webhook
- [x] 2. Supabase schema (run SQL)
- [x] 3. Config + environment setup
- [x] 4. Message extractor utility

## Phase 2 — Registration ✅
- [x] 5. Invite code table + seed script
- [x] 6. Registration flow (code validation → admin creation)
- [x] 7. Twilio response messages (Spanish)

## Phase 3 — Onboarding Steps (no AI) ✅
- [x] 8. Business name step (direct save)
- [x] 9. Delivery/pickup selection (numbered options)
- [x] 10. Payment methods step (numbered options 1-4)
- [x] 11. Pickup address step (direct save)
- [x] 12. User state management (step tracking)

## Phase 4 — Onboarding Steps (with AI) ✅
- [x] 13. Ollama service + JSON parser
- [x] 14. Business hours extraction
- [x] 15. Delivery zones extraction
- [x] 16. Bank data extraction
- [x] 17. Product catalog extraction + loop

## Phase 5 — Review & Activation ✅
- [x] 18. Summary builder (includes payment methods line)
- [x] 19. Confirmation flow
- [x] 20. Business activation

## Phase 6 — Post-Onboarding Commands ✅
- [x] 21. Command parser (includes EDITAR PAGOS)
- [x] 22. Edit mode for each data section
- [x] 23. Product management (add/remove/pause)
- [x] 24. View commands (menu, business summary)

---

# Client Ordering Flow

## Phase 7 — Database Preparation (Orders) ✅
- [x] 25. Create `orders` table (linked to business, client phone, items, totals, payment, status)
- [x] 26. Create `customer_states` table (step tracking + temp cart for clients)
- [x] 27. Add database CRUD functions for orders and customer states
- [x] 27b. Add `CUSTOMER_STEPS` constants to config

## Phase 8 — Message Routing Update ✅
- [x] 28. Modify routing: if business is active → start customer order flow
- [x] 29. Keep "volvé pronto" message only when business is NOT active

## Phase 9 — Customer Flow Steps (no AI) ✅
- [x] 30. Greeting + business hours check (if outside hours → inform and end)
- [x] 31. Menu display (show available products grouped by category with prices)
- [x] 32. Delivery method selection (based on admin config: delivery/pickup/both)
- [x] 33. Delivery zone selection + price calculation (if delivery)
- [x] 34. Payment method selection (only admin-enabled options)
- [x] 35. Bank details display (if transfer or deposit selected)
- [x] 36. Order confirmation prompt

## Phase 10 — Customer Flow Steps (with AI) ✅
- [x] 37. Natural language order parsing (AI extracts products + quantities from free text)
- [x] 38. Cart management (add, remove, modify quantities, show subtotal)
- [x] 39. Customer address input (if delivery)

## Phase 11 — Order Completion & Notifications ✅
- [x] 40. Save order to database
- [x] 41. Send order notification to admin (order #, total, payment, products, client phone)
- [x] 42. Send confirmation to customer (order received, will be notified of updates)
- [x] 43. Customer order status check ("ESTADO #123")
- [x] 44. Customer cancellation (before admin confirmation)

## Phase 12 — Admin Order Commands ✅
- [x] 45. `VER PEDIDOS` — list pending/new orders
- [x] 46. `VER PEDIDO #123` — view order details
- [x] 47. `ESTADO PEDIDO #123 preparando/en_camino/entregado/cancelado` — change status
- [x] 48. `CONFIRMAR PAGO #123` — confirm transfer/deposit received
- [x] 49. `RECHAZAR PEDIDO #123` — reject/cancel with optional reason
- [x] 50. `VENTAS HOY/SEMANA/MES` — sales summary

## Phase 13 — Testing & Adjustments ✅
- [x] 51. Test: pickup only + cash flow
- [x] 52. Test: delivery + transfer with deposit flow
- [x] 53. Test: after-hours order attempt
- [x] 54. Test: cart with multiple products
- [x] 55. Test: customer cancellation
- [x] 56. Test: admin payment confirmation + status updates
- [x] 57. Message polish (clear, friendly, Argentine Spanish)

## Phase 14 — Groq API for Fast AI Parsing ✅
- [x] 58. Create Groq service (`src/services/groq.js`) with `chatJSON` function using Groq REST API
- [x] 59. Add `GROQ_API_KEY` to config + `.env`
- [x] 60. Migrate `extractProducts` (admin product loading) from Ollama to Groq
- [x] 61. Migrate `extractOrderItems` (customer order parsing) from Ollama to Groq
- [x] 62. Add Ollama fallback if Groq fails or is rate-limited
- [x] 63. Test: Groq API verified working (423ms response time)
- [x] 64. Test: customer orders via Groq (420ms, catalog matching verified)

## Phase 15 — Interactive Messages (Buttons & Lists) ✅

### 15a — Interactive Message Helpers ✅
- [x] 65. Add `sendButtons(to, body, buttons[])` to `whatsapp.js` (interactive reply buttons, max 3)
- [x] 66. Add `sendList(to, body, buttonText, sections[])` to `whatsapp.js` (interactive list, max 10 rows)
- [x] 67. Handle button/list replies in `extract-message.js` (interactive message type parsing)

### 15b — Buttons in Customer Flow ✅
- [x] 68. Cart actions: `Confirmar pedido` / `Agregar más` / `Cancelar` (BUILDING_CART step)
- [x] 69. Delivery method: `Delivery` / `Retiro en local` (DELIVERY_METHOD step)
- [x] 70. Awaiting transfer: `Ya transferí` / `Cancelar pedido` (AWAITING_TRANSFER step)

### 15c — Buttons in Admin Flow ✅
- [x] 71. Hours/zones/bank confirm: `Sí, continuar` / `Escribir de nuevo`
- [x] 72. Review: `Confirmar` / `Editar`
- [x] 73. Delivery method: `Delivery` / `Retiro en local` / `Ambos` (onboarding + edit)

### 15d — Lists in Customer Flow ✅
- [x] 74. Delivery zone selection (list with zone + price rows)
- [x] 75. Payment method selection (list with enabled payment rows)
- [x] 76. Menu display (list with sections by category, tap-to-add-to-cart)

### 15e — Lists in Admin Flow ✅
- [x] 77. Payment methods (list with 4 options, used in onboarding + edit)
- [x] 78. Edit menu (list with 7 options in sections: Configuración / Menú)
- [x] 79. Delete/pause product (list with product rows grouped by category)

## Phase 16 — Meta Product Catalog ✅

### 16a — Catalog Link (DB ↔ Meta) ✅
- [x] 80. Add `retailer_id` column to `products` table (SQL migration + DB function)
- [x] 81. Admin command `VINCULAR CATÁLOGO` — link products to catalog Content IDs
- [x] 82. Add `CATALOG_ID` to config + `.env`

### 16b — Catalog Messages in Customer Flow ✅
- [x] 83. Add `sendProduct(to, catalogId, retailerId)` to `whatsapp.js`
- [x] 84. Add `sendCatalogList(to, header, body, catalogId, sections)` to `whatsapp.js`
- [x] 85. Replace text menu with catalog product list when products have retailer_ids
- [x] 86. Fallback to interactive list / text menu when no catalog configured

### 16c — Native Cart Handling ✅
- [x] 87. Parse `order` message type in `extract-message.js` (native cart checkout)
- [x] 88. Map native cart items to DB products by `retailer_id`
- [x] 89. Feed native cart into existing order flow (skip AI, go to cart → delivery → payment)
- [x] 90. Native cart merge on "Agregar más" (append new items instead of replacing)

### 16d — Location Request for Delivery Address ✅
- [x] 91. Add `sendLocationRequest(to, body)` to `whatsapp.js` (native map picker)
- [x] 92. Handle `location` message type in `extract-message.js` (lat/lng/address)
- [x] 93. Customer delivery address step uses location request with text fallback

## Phase 17 — Future Improvements
- [ ] 94. Automatic admin re-alerts for unconfirmed orders
- [ ] 95. Customer order history ("MIS PEDIDOS")
- [ ] 96. Proof of payment image attachment

---

# Production — Multi-Number Architecture

> See `ProdPlan.md` for full expense breakdown, timeline, and client onboarding checklist.

## Phase 18 — Multi-Number Database & Config ✅

### 18a — Database Schema Changes ✅
- [x] 97. Create `phone_numbers` table: `id`, `meta_phone_number_id`, `meta_whatsapp_token`, `catalog_id`, `display_name`, `business_id` (nullable, linked after onboarding), `is_active`, `created_at`
- [x] 98. Add `phone_number_id` FK to `businesses` table (references `phone_numbers.id`)
- [x] 99. Add `phone_number_id` FK to `invite_codes` table (so each code is tied to a specific number)
- [x] 100. Migrate `catalog_id` from `.env` to per-business in `phone_numbers` table

### 18b — Dynamic Config Loader ✅
- [x] 101. Create `getPhoneConfig(metaPhoneNumberId)` in `database.js` — fetches token, catalog_id, and business info from DB instead of `.env`
- [x] 102. Keep `config.meta` and `config.catalog` as fallback defaults for dev/single-number mode (production uses per-number configs from DB)
- [x] 103. Add in-memory cache for phone configs (avoid DB query on every message, refresh every 5 min)

## Phase 19 — Webhook Routing by Phone Number ✅

### 19a — Inbound Message Routing ✅
- [x] 104. Extract `metadata.phone_number_id` from the Meta webhook payload in `extract-message.js` (Meta already sends this field)
- [x] 105. Pass `phoneNumberId` through the message object to `processMessage()`
- [x] 106. In `workflow.js` → `processMessage()`: look up the phone config from DB, pass the credentials downstream instead of using global config
- [x] 107. In `workflow.js` → `getActiveBusiness()` call: replace the current "get first active business" with a lookup by `phone_number_id` — each number maps to exactly one business

### 19b — Outbound Messages with Dynamic Credentials ✅
- [x] 108. Refactor `whatsapp.js`: every function (`sendMessage`, `sendButtons`, `sendList`, `sendProduct`, `sendCatalogList`, `sendLocationRequest`) takes a `phoneConfig` parameter instead of using global `config.meta`
- [x] 109. Update all callers in `workflow.js`, `customer-workflow.js`, `registration.js` to pass `phoneConfig`
- [x] 110. Refactor `markAsReadAndTyping` to accept `phoneConfig`

## Phase 20 — Per-Business Catalog Support ✅

- [x] 111. Refactor `sync-catalog.js` to read `catalog_id` and `meta_whatsapp_token` from the `phone_numbers` table instead of `.env`
- [x] 112. Update `sendCatalogList` and `sendProduct` calls in `customer-workflow.js` to use the business's `catalog_id` from DB
- [x] 113. Create script `scripts/setup-number.js` — registers a phone number in the DB: takes `meta_phone_number_id`, `display_name`, generates an invite code, and stores everything

## Phase 21 — Admin Setup Script & Tooling ✅

- [x] 114. Create `scripts/setup-number.js`: interactive CLI that:
  - Asks for `meta_phone_number_id` and `display_name`
  - Inserts into `phone_numbers` table
  - Generates an invite code linked to that number
  - Outputs the invite code and `wa.me/` link
- [x] 115. Create `scripts/set-profile.js`: sets the WhatsApp Business Profile (picture, about, category) via the Meta API for a given phone number
- [x] 116. Update `scripts/generate-codes.js` to accept an optional `--phone-number-id` flag to link codes to a specific number
- [x] 117. Create `scripts/list-numbers.js`: lists all registered phone numbers, their linked businesses, and status

## Phase 22 — Registration Flow Update ✅

- [x] 118. Update `tryRegister()`: when a customer sends an invite code, look up which phone number the code belongs to and link the new business to that number
- [x] 119. On registration, auto-set `phone_numbers.business_id` to the newly created business
- [x] 120. Validate that each phone number can only have one business (prevent double registration)

## Phase 23 — Customer Routing Update ✅

- [x] 121. In `customer-workflow.js`: instead of `getActiveBusiness()`, use the phone number from the webhook to find the correct business
- [x] 122. Update `customer_states` table: add `business_id` column so a customer's state is per-business (a person can be a customer of multiple businesses)
- [x] 123. Update all customer state queries to filter by `business_id`

## Phase 24 — Production Hardening ✅

### 24a — Security & Reliability ✅
- [x] 124. Validate Meta webhook signature (`X-Hub-Signature-256` header) to reject forged requests
- [x] 125. Add rate limiting per phone number (prevent message flooding)
- [x] 126. Add error recovery: if a message fails to process, log it to a `failed_messages` table for retry
- [x] 127. Add health check endpoint that verifies Supabase + Groq connectivity

### 24b — Monitoring & Logging ✅
- [x] 128. Structured logging (JSON format) with business_id and phone_number_id in every log line
- [x] 129. Add a `webhook_logs` table to store raw payloads for debugging (optional, with auto-cleanup after 7 days)
- [x] 130. Error alerting: send yourself a WhatsApp message when a critical error occurs (use one of the registered numbers)

### 24c — Graceful Degradation ✅
- [x] 131. If Groq is down, fall back to Ollama; if both are down, ask the customer to type structured orders
- [x] 132. If Meta API returns 429 (rate limit), queue the message and retry after delay
- [x] 133. Connection pooling / keep-alive for Supabase and Meta API calls (Node.js 18+ fetch uses keep-alive by default)

## Phase 25 — Testing Multi-Number ✅

- [x] 134. Test: two businesses on different numbers, both receive and process orders independently
- [x] 135. Test: customer orders from Business A, then orders from Business B — states are separate
- [x] 136. Test: admin of Business A cannot see orders from Business B
- [x] 137. Test: invite code for Number A cannot be used on Number B
- [x] 138. Test: catalog products show correctly per business (different menus, different prices)
- [x] 139. Test: webhook signature validation rejects invalid requests

## Phase 26 — Future Production Improvements
- [ ] 140. Admin dashboard (web panel) for you to manage all businesses, numbers, and billing
- [ ] 141. Auto-billing: track conversation counts per business, generate monthly invoices
- [ ] 142. Subscription management: auto-disable businesses that don't pay after trial
- [ ] 143. Business analytics: order volume, popular products, peak hours (per business)
- [ ] 144. Multi-language support (configurable per business)
- [ ] 145. Automatic admin re-alerts for unconfirmed orders
- [ ] 146. Customer order history ("MIS PEDIDOS")
- [ ] 147. Proof of payment image attachment
