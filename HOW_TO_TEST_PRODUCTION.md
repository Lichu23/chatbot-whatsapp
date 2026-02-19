# Production Testing Guide (Phases 18-25)

After running the automated test script (`node scripts/test-phase25.js`), follow this guide to verify everything works with real WhatsApp messages.

---

## Prerequisites

- Two WhatsApp phone numbers registered in Meta Business (Number A and Number B)
- Both numbers set up via `node scripts/setup-number.js`
- `.env` configured with `META_APP_SECRET`, `GROQ_API_KEY`, `ALERT_PHONE`
- Server running: `npm start`
- Two businesses onboarded (one per number)

---

## 1. Webhook Signature Validation

**Goal:** Verify Meta webhook signatures are checked.

1. Add `META_APP_SECRET` to `.env` (from Meta Dashboard → Settings → Basic → App Secret)
2. Restart the server
3. Run `node scripts/test-phase25.js` — tests 139a-139d should now test real signature validation:
   - Valid signature → 200
   - Invalid signature → 403
   - Missing signature → 403
   - Tampered body → 403
4. Send a real WhatsApp message → should still work (Meta signs requests with the same secret)

**Expected log:** No "skipping webhook signature validation" warning.

---

## 2. Multi-Number Message Routing

**Goal:** Messages to Number A go to Business A, messages to Number B go to Business B.

1. From your personal phone, send "hola" to **Number A**
2. Check server logs → should show `phone_number_id` matching Number A's Meta ID
3. You should receive Business A's greeting (its name, hours, menu)
4. From your personal phone (or another), send "hola" to **Number B**
5. Check server logs → should show Number B's Meta ID
6. You should receive Business B's greeting (different name, hours, menu)

**Pass if:** Each number responds with its own business info, not the other's.

---

## 3. Customer Order on Each Number

**Goal:** Complete a full order flow on each business independently.

### Order on Business A:
1. Send "MENÚ" to Number A → see Business A's products
2. Send "2 pizza muzzarella" (or whatever products A has)
3. Confirm the order → select delivery/pickup → select payment
4. Complete the order
5. From Business A's admin phone, send "VER PEDIDOS" → should show the order

### Order on Business B:
1. Send "MENÚ" to Number B → see Business B's products (different from A)
2. Order something from B's menu
3. Complete the order
4. From Business B's admin phone, send "VER PEDIDOS" → should show only B's order

**Pass if:** Each business shows its own menu and receives only its own orders.

---

## 4. Same Customer, Both Businesses

**Goal:** One customer can order from both businesses with separate states.

1. From the **same phone number**, send "hola" to Number A → start ordering
2. Add items to cart on Business A but **don't complete** the order yet
3. Now send "hola" to Number B → should start a fresh order flow (not continue A's cart)
4. Add different items to cart on Business B
5. Go back to Number A → your cart from step 2 should still be there
6. Complete both orders

**Pass if:** Carts and order states are completely separate between businesses.

---

## 5. Admin Order Isolation

**Goal:** Admin A can't see Admin B's orders.

1. From Admin A's phone, send "VER PEDIDOS" to Number A → should only show Business A orders
2. From Admin B's phone, send "VER PEDIDOS" to Number B → should only show Business B orders
3. From Admin A, try "VER PEDIDO #X" where X is an order number from Business B → should say "not found"
4. From Admin A, send "VENTAS HOY" → should only count Business A's sales

**Pass if:** Each admin only sees their own business data.

---

## 6. Invite Code Scoping

**Goal:** Invite codes are linked to specific phone numbers.

1. Generate a new invite code for Number A:
   ```
   node scripts/generate-codes.js --count 1 --phone-number-id <NUMBER_A_META_ID>
   ```
2. The code is now linked to Number A
3. Since Number A already has a business, sending this code should return:
   "Este número de WhatsApp ya tiene un negocio registrado"
4. The code's `phone_number_id` in the database should match Number A (verify via `scripts/list-numbers.js`)

**Pass if:** Codes are tied to specific numbers and double-registration is blocked.

---

## 7. Rate Limiting

**Goal:** Prevent message flooding (max 30 messages per 60 seconds per sender).

1. Send 30+ messages rapidly (within 60 seconds) to any number
2. After the 30th message, check server logs for:
   ```
   {"level":"warn","message":"Rate limited","phone":"54911..."}
   ```
3. The server should stop processing your messages but still return 200 to Meta
4. Wait 60 seconds → messages should process again

**Pass if:** Messages stop being processed after 30/minute, resume after the window.

---

## 8. Health Check

**Goal:** The `/health` endpoint reports system status.

1. Open in browser or curl:
   ```
   curl http://localhost:3000/health
   ```
2. Expected response:
   ```json
   {
     "status": "ok",
     "checks": { "supabase": "ok", "groq": "ok" },
     "timestamp": "2026-..."
   }
   ```
3. Remove `GROQ_API_KEY` from `.env`, restart → status should be `"degraded"`, groq: `"no_api_key"`
4. Put a wrong `SUPABASE_URL`, restart → status should be `"error"`

**Pass if:** Health check accurately reflects service availability.

---

## 9. Error Alerting

**Goal:** Receive WhatsApp alerts on critical errors.

1. Set `ALERT_PHONE` in `.env` to your personal phone number (with country code, e.g., `5491112345678`)
2. Restart the server
3. Trigger an error (e.g., temporarily break a database query or send a malformed webhook)
4. You should receive a WhatsApp message like:
   ```
   ⚠️ ERROR ALERT
   Webhook processing failed
   Phone: <phone_number_id>
   ```
5. Alerts are rate-limited to 1 every 5 minutes to avoid flooding

**Pass if:** You receive an alert message on your phone.

---

## 10. AI Fallback Chain

**Goal:** If Groq is down, the system falls back to Ollama, then to structured input.

### Test Groq → Ollama fallback:
1. Set an invalid `GROQ_API_KEY` in `.env` (e.g., `GROQ_API_KEY=invalid_key`)
2. Restart the server
3. Send an order message like "2 pizzas y una coca" to a business
4. Check logs for: `"Groq failed for extractOrderItems, falling back to Ollama"`
5. If Ollama is running locally, the order should still be parsed

### Test both down → structured input:
1. Remove `GROQ_API_KEY` and stop Ollama (`docker stop ollama` or kill the process)
2. Send an order message
3. The bot should ask the customer to type a structured order instead of crashing
4. Check logs for: `"Both Groq and Ollama failed"`

**Pass if:** The system degrades gracefully without crashing.

---

## 11. Admin Scripts

**Goal:** CLI scripts work correctly.

```bash
# List all registered numbers and their businesses
node scripts/list-numbers.js

# Register a new phone number (interactive)
node scripts/setup-number.js

# Set WhatsApp Business Profile (picture, about text)
node scripts/set-profile.js

# Generate invite codes for a specific number
node scripts/generate-codes.js --count 2 --phone-number-id <META_PHONE_ID>

# Sync Meta catalog products
node scripts/sync-catalog.js
```

**Pass if:** Each script runs without errors and produces expected output.

---

## 12. Per-Business Catalog

**Goal:** Each business shows its own WhatsApp catalog.

1. If Business A has products linked to a Meta catalog (via `VINCULAR CATÁLOGO`):
   - Customer messaging Number A should see catalog product cards
2. If Business B has no catalog linked:
   - Customer messaging Number B should see a text/list menu instead
3. Verify `catalog_id` is read from the `phone_numbers` table (not `.env`)

**Pass if:** Each business uses its own catalog (or falls back to text menu).

---

## 13. Order Scheduling (Phase 39)

**Goal:** Test instant vs advance order modes.

### Test instant mode (default):
1. Place a customer order normally — no date selection step should appear
2. Order flow: cart → delivery → address → payment (unchanged)

### Test advance mode:
1. From admin phone, send `PEDIDOS` → see current mode + options
2. Select "Por encargo" → enter day range (e.g., `3-30`)
3. Should confirm: "Modo de pedidos: Por encargo (3-30 días)"
4. Now place a customer order:
   - After delivery address (or pickup selection), customer sees date picker list
   - Select a date → date appears in order summary
   - Complete order → date shown in confirmation + admin notification
5. Check database: `SELECT delivery_date FROM orders ORDER BY created_at DESC LIMIT 1;`

### Switch back:
1. Admin sends `PEDIDOS` → select "Inmediato"
2. Customer order flow returns to normal (no date step)

**Pass if:** Date picker only shows in advance mode, date persists in order + notifications.

---

## Quick Reference

| # | Test | Time | Priority |
|---|------|------|----------|
| 1 | Webhook signature | 2 min | High |
| 2 | Multi-number routing | 3 min | High |
| 3 | Order on each number | 10 min | High |
| 4 | Same customer, both businesses | 5 min | High |
| 5 | Admin isolation | 3 min | High |
| 6 | Invite code scoping | 3 min | Medium |
| 7 | Rate limiting | 2 min | Medium |
| 8 | Health check | 1 min | Medium |
| 9 | Error alerting | 3 min | Medium |
| 10 | AI fallback | 5 min | Medium |
| 11 | Admin scripts | 5 min | Low |
| 12 | Catalog per business | 5 min | Low |
| 13 | Order scheduling | 5 min | Medium |

Total estimated time: ~50 minutes

---

## Automated Tests

Before manual testing, always run the automated script first:

```bash
node scripts/test-phase25.js
```

This verifies database isolation, phone config mapping, customer state separation, and webhook signature logic (29 automated checks).
