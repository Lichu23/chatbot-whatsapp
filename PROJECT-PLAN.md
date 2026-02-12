# WhatsApp Business Onboarding Bot — Project Plan

## Project Overview

A WhatsApp chatbot that onboards restaurant/food-delivery businesses through a conversational flow, and then serves as a complete ordering system for customers. Admins register via unique invite codes, configure their business step-by-step, and manage their data and orders through WhatsApp commands. Customers can browse the menu, build a cart, choose delivery/pickup, pay, and track their order — all via WhatsApp. Built with Node.js, Twilio (WhatsApp), Ollama (local AI), and Supabase (database).

---

## Requirements Summary

| Requirement | Decision |
|---|---|
| Business type | Restaurants / Food delivery |
| Admin registration | Unique invite codes — the code itself is the first message |
| Customer ordering | Any non-admin message when business is active → order flow |
| Inactive business | "El negocio se está configurando, volvé pronto." |
| Conversation style | Strict step-by-step (one topic per message) |
| Product entry (admin) | Free text — AI parses natural language |
| Product ordering (customer) | Free text — AI parses products + quantities |
| Post-onboarding editing | Yes — commands to re-enter any step |
| Order management | Admin commands to view, update status, confirm payments |
| Delivery zones | Admin types zone name + price (e.g. "Centro $500") |
| Business hours check | Customer orders blocked outside business hours |
| AI engine | Ollama (local) |
| Messaging | Twilio WhatsApp API |
| Database | Supabase (PostgreSQL) |
| Scope | **MVP: single business per Twilio number** (multi-tenant later) |

---

## Data Model

### Table: `invite_codes`

Unique codes generated ahead of time. Each code can only be used once.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| code | TEXT | Unique, e.g. "REST-A7X9" |
| used_by_phone | TEXT | NULL until claimed |
| used_at | TIMESTAMPTZ | NULL until claimed |
| created_at | TIMESTAMPTZ | Auto |

### Table: `admins`

One row per registered business owner.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| phone | TEXT | Unique, E.164 format |
| name | TEXT | WhatsApp profile name |
| invite_code_id | UUID | FK → invite_codes |
| created_at | TIMESTAMPTZ | Auto |

### Table: `user_states`

Tracks where each admin is in the onboarding flow.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| phone | TEXT | Unique, FK → admins.phone |
| current_step | TEXT | One of the step constants |
| business_id | UUID | FK → businesses, set after step 1 |
| updated_at | TIMESTAMPTZ | Auto |

### Table: `businesses`

Core business profile.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| admin_phone | TEXT | Unique, FK → admins.phone |
| business_name | TEXT | **Required** |
| business_hours | TEXT | **Required** (e.g. "Lun-Vie 11:00-23:00") |
| business_address | TEXT | Only required if has_pickup = true |
| has_delivery | BOOLEAN | Default false |
| has_pickup | BOOLEAN | Default false |
| accepts_cash | BOOLEAN | Default true |
| accepts_transfer | BOOLEAN | Default true |
| accepts_deposit | BOOLEAN | Default false (partial deposit via bank transfer) |
| deposit_percent | INTEGER | Percentage for deposit (e.g. 30, 50). NULL if no deposit |
| is_active | BOOLEAN | Default false, true after onboarding |
| updated_at | TIMESTAMPTZ | Auto |

### Table: `bank_details`

Argentine bank data for payouts.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| business_id | UUID | Unique, FK → businesses |
| alias | TEXT | **Required** (e.g. "mi.negocio.mp") |
| cbu | TEXT | **Required** (22-digit CBU/CVU) |
| account_holder | TEXT | **Required** |
| updated_at | TIMESTAMPTZ | Auto |

### Table: `delivery_zones`

One row per zone. Only exists if the business has delivery.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| business_id | UUID | FK → businesses |
| zone_name | TEXT | **Required** (e.g. "Centro") |
| price | NUMERIC | **Required** (e.g. 500.00) |
| created_at | TIMESTAMPTZ | Auto |

### Table: `products`

Menu items.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| business_id | UUID | FK → businesses |
| name | TEXT | **Required** |
| description | TEXT | Optional |
| price | NUMERIC | **Required** |
| category | TEXT | Optional (e.g. "Pizzas", "Bebidas") |
| is_available | BOOLEAN | Default true |
| created_at | TIMESTAMPTZ | Auto |
| updated_at | TIMESTAMPTZ | Auto |

### Table: `conversation_memory`

Stores chat history per step for AI context.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| phone | TEXT | Not unique (one per phone+step) |
| step | TEXT | Step name |
| messages | JSONB | Array of {role, content} |
| updated_at | TIMESTAMPTZ | Auto |
| | | UNIQUE(phone, step) |

### Table: `orders`

Customer orders. Each order belongs to a business.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| order_number | SERIAL | Human-readable (#1, #2, ...) |
| business_id | UUID | FK → businesses |
| client_phone | TEXT | E.164 format |
| client_name | TEXT | Optional (WhatsApp profile name) |
| client_address | TEXT | Required if delivery |
| items | JSONB | Array of {product_id, name, qty, price, subtotal} |
| subtotal | NUMERIC | Total of items (without delivery) |
| delivery_zone_id | UUID | FK → delivery_zones (NULL if pickup) |
| delivery_price | NUMERIC | Zone price (0 if pickup) |
| grand_total | NUMERIC | subtotal + delivery_price |
| payment_method | TEXT | 'cash', 'transfer', or 'deposit' |
| deposit_amount | NUMERIC | If deposit, calculated as deposit_percent% of grand_total |
| payment_status | TEXT | 'pending', 'confirmed', 'rejected' (default 'pending') |
| order_status | TEXT | 'nuevo', 'preparando', 'en_camino', 'entregado', 'cancelado' (default 'nuevo') |
| notes | TEXT | Optional customer notes (e.g. "sin cebolla") |
| created_at | TIMESTAMPTZ | Auto |
| updated_at | TIMESTAMPTZ | Auto |

### Table: `customer_states`

Tracks where each customer is in the ordering flow + temporary cart.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| phone | TEXT | Unique, E.164 format |
| business_id | UUID | FK → businesses |
| current_step | TEXT | One of the customer step constants |
| cart | JSONB | Temp cart: [{product_id, name, qty, price}] |
| selected_zone_id | UUID | FK → delivery_zones (temp selection) |
| delivery_method | TEXT | 'delivery' or 'pickup' (temp selection) |
| updated_at | TIMESTAMPTZ | Auto |

---

## Onboarding Flow (Step by Step)

### Message Routing (before any step)

The invite code IS the registration trigger. No "hello" prompt — if someone sends a valid code, they become an admin. Everything else is routed based on context.

```
Message comes in
  │
  ├─ Known admin (mid-onboarding) → Continue current step
  │
  ├─ Known admin (completed) → Handle commands (EDITAR, VER, PEDIDOS, etc.)
  │
  ├─ Message matches invite code format?
  │    │
  │    ├─ Valid & unused → Register admin, start onboarding
  │    ├─ Already used   → "Este código ya fue utilizado."
  │    └─ Invalid code   → Treat as customer (below)
  │
  └─ Customer (any other message)
       │
       ├─ Business active → Customer ordering flow
       │
       └─ Business not active / not set up
            → "El negocio se está configurando, volvé pronto."
```

**Important:** Admins are told the invite code in advance (outside WhatsApp — email, in person, etc.). Their first message to the bot IS the code.

**Bot message on valid code:**
> ✅ ¡Registro exitoso! Vamos a configurar tu negocio paso a paso.
>
> **Paso 1 de 8:** ¿Cuál es el nombre de tu negocio?

### MVP Scope Note

This MVP handles **one business per Twilio number**. Multi-tenant routing (one shared number, multiple businesses) is planned for a future version. The architecture is designed so this can be added later without rewriting the core onboarding flow.

### Step 1 — Business Name

- Bot asks for business name
- Admin types name (free text, no AI needed — direct save)
- Validate: non-empty string

**Bot prompt:** "¿Cuál es el nombre de tu negocio?"
**Bot confirmation:** "✅ Nombre guardado: *{name}*"

### Step 2 — Business Hours

- Bot asks for hours
- Admin types hours naturally (e.g. "lunes a viernes de 11 a 23, sábados de 12 a 24")
- AI normalises the format
- Validate: non-empty

**Bot prompt:** "¿Cuál es tu horario de atención? (Ej: Lunes a Viernes 11:00-23:00)"
**Bot confirmation:** "✅ Horario guardado: *{hours}*"

### Step 3 — Delivery / Pickup Options

- Bot asks: "¿Tu negocio ofrece delivery, retiro en local, o ambos?"
- Admin picks one of three options
- If pickup → Bot asks for address (Step 3b)
- If delivery → Skip address, move to zones (Step 4)
- If both → Ask address, then zones

**Bot prompt:** "¿Cómo entregás los pedidos?\n\n1️⃣ Delivery\n2️⃣ Retiro en local\n3️⃣ Ambos"
**Bot on "2" or "3":** "¿Cuál es la dirección de tu local?"
**Bot confirmation:** "✅ Configuración de entrega guardada."

### Step 4 — Payment Methods

- Bot asks how the business accepts payments (numbered options 1-4)
- Admin picks one option
- No AI needed — direct numbered selection
- Saves `accepts_cash`, `accepts_transfer`, `accepts_deposit` booleans to `businesses`
- If option 4 (with deposit) → asks for deposit percentage

**Bot prompt:** "¿Qué métodos de pago aceptás?\n\n1️⃣ Solo efectivo\n2️⃣ Solo transferencia bancaria\n3️⃣ Ambos (efectivo y transferencia)\n4️⃣ Ambos + seña (depósito parcial por transferencia)"

**Mapping:**
- 1 → cash=true, transfer=false, deposit=false
- 2 → cash=false, transfer=true, deposit=false
- 3 → cash=true, transfer=true, deposit=false
- 4 → cash=true, transfer=true, deposit=true → **then asks:** "¿Qué porcentaje de seña pedís? (ej: 30, 50)"

**Bot confirmation:** "✅ Métodos de pago guardados: *{readable description}*"

### Step 5 — Delivery Zones (only if has_delivery = true)

- Bot asks admin to list zones with prices
- AI parses entries like "Centro $500, Zona Norte $800, Macrocentro $600"
- Each zone becomes a row in `delivery_zones`
- Validate: at least 1 zone with name + price

**Bot prompt:** "Escribí tus zonas de delivery con el precio de cada una.\nEj: Centro $500, Norte $800, Macrocentro $600"
**Bot confirmation:**
> ✅ Zonas de delivery guardadas:
> • Centro — $500
> • Norte — $800
> • Macrocentro — $600

### Step 6 — Bank Data

- Bot asks for alias, CBU, and account holder name
- AI extracts the three fields from natural language
- Validate: all three required

**Bot prompt:** "Necesito tus datos bancarios para los cobros:\n• Alias\n• CBU/CVU\n• Titular de la cuenta"
**Bot confirmation:** "✅ Datos bancarios guardados."

### Step 7 — Product Catalog

- Bot asks admin to describe products
- Admin sends free text (one or many products per message)
- AI extracts: name, description, price, category, availability
- Products saved one by one
- Admin sends **LISTO** to finish

**Bot prompt:** "Ahora vamos a cargar tu menú. Describí tus productos y yo los organizo.\nEj: 'Pizza Muzzarella grande $5500, tiene muzzarella y salsa de tomate, categoría Pizzas'\n\nCuando termines, escribí *LISTO*."

**Bot per batch:**
> ✅ Guardé 2 productos:
> • Pizza Muzzarella — $5500 (Pizzas)
> • Empanadas x6 — $4200 (Empanadas)
>
> Seguí agregando o escribí *LISTO*.

### Step 8 — Review & Activate

- Bot compiles a full summary of all data
- Asks admin to confirm or go back to edit

**Bot message:**
> 📋 **Resumen de tu negocio:**
>
> 🏪 *Pizza Express*
> ⏰ Lun-Vie 11:00-23:00, Sáb 12:00-24:00
> 📍 Av. Corrientes 1234 (retiro en local)
> 🚚 Delivery: Centro $500, Norte $800
> 💳 Pagos: Efectivo y Transferencia (con seña del 30%)
> 🏦 Banco: alias mi.pizza | CBU 0000...1234 | Titular: Juan Pérez
>
> 📦 **Menú (3 productos):**
> • Pizza Muzzarella — $5500
> • Empanadas x6 — $4200
> • Coca-Cola 1.5L — $2000
>
> ¿Está todo bien? Respondé *CONFIRMAR* para activar o *EDITAR* para modificar algo.

On **CONFIRMAR**: activate business, mark onboarding complete.

---

## Customer Ordering Flow

Once a business is active (`is_active = true`), any non-admin message triggers the ordering flow.

### Customer Message Routing

```
Customer message comes in
  │
  ├─ Has active customer_state? → Continue current order step
  │
  └─ New customer (no state)
       │
       ├─ Check business hours → Outside hours? → "Estamos cerrados" + horario
       │
       └─ Inside hours → Greeting + invite to order/view menu
```

### Customer Step 1 — Greeting & Hours Check

- Bot greets with business name
- Checks if current time falls within business hours
- If outside hours → inform customer, show schedule, end
- If inside hours → show welcome message + options

**Bot (inside hours):**
> 👋 ¡Hola! Bienvenido a *Pizza Express*
> ⏰ Horario: Lun-Vie 11:00-23:00, Sáb 12:00-00:00
>
> Escribí *MENÚ* para ver nuestros productos o decinos directamente qué querés pedir.

**Bot (outside hours):**
> 🕐 *Pizza Express* está cerrado en este momento.
> ⏰ Nuestro horario: Lun-Vie 11:00-23:00, Sáb 12:00-00:00
>
> ¡Volvé cuando estemos abiertos!

### Customer Step 2 — Menu Display / Order by Text

**Option A — Customer says "MENÚ":**
> 📦 *Menú de Pizza Express:*
>
> 🍕 *Pizzas:*
> • Pizza Muzzarella — $5500
> • Pizza Napolitana — $6200
>
> 🥟 *Empanadas:*
> • Empanadas de Carne x6 — $4200
>
> 🥤 *Bebidas:*
> • Coca-Cola 1.5L — $2000
>
> Escribí lo que querés pedir (ej: "2 muzzarella y 1 coca")

**Option B — Customer orders directly:**
> "quiero 2 pizzas muzzarella y unas empanadas"

AI extracts: [{name: "Pizza Muzzarella", qty: 2, price: 5500}, {name: "Empanadas de Carne x6", qty: 1, price: 4200}]

### Customer Step 3 — Cart Management

After AI parses the order, show the cart:

> 🛒 *Tu pedido:*
> • 2x Pizza Muzzarella — $11.000
> • 1x Empanadas de Carne x6 — $4.200
>
> 📋 Subtotal: *$15.200*
>
> ¿Querés agregar algo más?
> Respondé *SÍ* para seguir, *QUITAR 1* para eliminar un item, o *SEGUIR* para continuar.

Customer can:
- Add more items (free text → AI parses → add to cart)
- Remove items ("QUITAR 2" removes item #2)
- Modify quantities ("CAMBIAR 1 a 3" changes item 1 qty to 3)
- Continue to delivery step ("SEGUIR")

### Customer Step 4 — Delivery Method

Based on business config:

**If both delivery and pickup:**
> 🚚 ¿Cómo querés recibir tu pedido?
>
> 1️⃣ Delivery
> 2️⃣ Retiro en local (📍 Av. Corrientes 1234, CABA)

**If delivery only:** Skip this step, go directly to zone selection.
**If pickup only:** Skip this step, show address confirmation.

### Customer Step 4b — Delivery Zone Selection (if delivery)

> 🚚 *Zonas de delivery:*
> 1️⃣ Centro — $500
> 2️⃣ Almagro — $600
> 3️⃣ Caballito — $800
> 4️⃣ Flores — $1000
>
> ¿En qué zona estás? Respondé con el número.

After selection:
> ¿Cuál es tu dirección de entrega?

### Customer Step 4c — Delivery Address (if delivery)

Customer sends address as free text. Direct save.

### Customer Step 5 — Order Summary + Delivery Total

> 📋 *Resumen de tu pedido:*
>
> 🛒 2x Pizza Muzzarella — $11.000
> 🛒 1x Empanadas de Carne x6 — $4.200
> 📋 Subtotal: $15.200
> 🚚 Delivery (Centro): $500
> 💰 **Total: $15.700**

### Customer Step 6 — Payment Method

Show only the payment options enabled by the admin:

**Example (cash + transfer + deposit):**
> 💳 ¿Cómo querés pagar?
>
> 1️⃣ Efectivo (pagás al recibir)
> 2️⃣ Transferencia bancaria (total: $15.700)
> 3️⃣ Seña por transferencia (30%: $4.710)

**If customer selects transfer or deposit:**
> 🏦 *Datos para transferir:*
> • Alias: pizza.express.mp
> • CBU: 0000003100092810733816
> • Titular: Juan Carlos Pérez
>
> 💰 Monto a transferir: *$15.700* (o *$4.710* si es seña)
>
> Cuando hayas transferido, respondé *LISTO*.

### Customer Step 7 — Order Confirmation

> ✅ ¡Pedido confirmado! 🎉
>
> 📦 Pedido #47
> 💰 Total: $15.700
> 💳 Pago: Transferencia bancaria
> 🚚 Delivery a: Av. Rivadavia 3456, Centro
>
> Te avisamos cuando tu pedido esté en preparación.
> Podés consultar el estado escribiendo *ESTADO #47*.
> Para cancelar, escribí *CANCELAR #47* (antes de que el local confirme).

### Customer Step 8 — Status Check & Cancellation

**Customer:** "ESTADO #47"
> 📦 Pedido #47 — Estado: *Preparando* 🍳
> Se notificará cuando esté en camino.

**Customer:** "CANCELAR #47"
> ❌ Pedido #47 cancelado.

(Only allowed before admin confirms/starts preparing.)

---

## Post-Onboarding Commands (Admin)

Once onboarding is complete, admin can send these commands anytime:

### Business Management

| Command | Action |
|---|---|
| `EDITAR NOMBRE` | Re-enter business name |
| `EDITAR HORARIO` | Re-enter business hours |
| `EDITAR DIRECCIÓN` | Re-enter pickup address |
| `EDITAR ENTREGA` | Re-configure delivery/pickup |
| `EDITAR PAGOS` | Re-configure payment methods |
| `EDITAR ZONAS` | Re-enter delivery zones |
| `EDITAR BANCO` | Re-enter bank details |
| `EDITAR MENÚ` | Enter product edit mode |
| `AGREGAR PRODUCTO` | Add new product(s) |
| `ELIMINAR PRODUCTO` | Remove a product (bot lists them with numbers) |
| `PAUSAR PRODUCTO` | Toggle product availability |
| `VER MENÚ` | Show current menu |
| `VER NEGOCIO` | Show full business summary |
| `AYUDA` | Show available commands |

### Order Management

| Command | Action |
|---|---|
| `VER PEDIDOS` | List pending/new orders |
| `VER PEDIDO #123` | View full order details |
| `ESTADO PEDIDO #123 preparando` | Change order status (preparando/en_camino/entregado/cancelado) |
| `CONFIRMAR PAGO #123` | Mark transfer/deposit as received |
| `RECHAZAR PEDIDO #123` | Reject order (with optional reason) |
| `VENTAS HOY` | Sales summary for today |
| `VENTAS SEMANA` | Sales summary for this week |
| `VENTAS MES` | Sales summary for this month |

During edit mode, the bot re-enters the relevant step. On completion, it returns to the "completed" state.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Express Server                             │
│                                                                   │
│  POST /webhook/whatsapp ──→ Extract Message ──→ Router            │
│                                                    │              │
│                     ┌──────────────────────────────┤              │
│                     ▼                              ▼              │
│              Known admin?                   Is invite code?       │
│              │         │                    │            │         │
│             YES        NO                  YES          NO        │
│              │         │                    │            │         │
│              ▼         │              Register admin     │         │
│        Route by Step   │              Start onboarding   │         │
│          │  │  │  │    │                                 ▼         │
│   ┌──────┘  │  │  └──┐ │                          Customer        │
│   ▼         ▼  ▼     ▼ │                          message         │
│ Business  Bank Zones Products                        │            │
│  Info     Data       (loop)            ┌─────────────┤            │
│   │         │   │      │               ▼             ▼            │
│   └─────────┴───┴──────┘         Biz active?    Not ready         │
│              │                    │              "Volvé            │
│        ┌─────┴─────┐             ▼               pronto"          │
│        ▼           ▼        Customer Order                        │
│     Ollama     Supabase      Flow                                 │
│   (localhost)  (cloud)       │  │  │  │                           │
│        │           │         ▼  ▼  ▼  ▼                           │
│        └─────┬─────┘    Menu Cart Pay Confirm                     │
│              ▼              │    │   │    │                        │
│       Twilio Response       └────┴───┴────┘                       │
│       (WhatsApp msg)         → Notify Admin                       │
└──────────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/
├── index.js                    # Express server
├── config/
│   └── index.js                # Env vars, step constants, payment options
├── routes/
│   └── webhook.js              # POST /webhook/whatsapp
├── services/
│   ├── workflow.js             # Admin orchestration — processMessage()
│   ├── customer-workflow.js    # Customer ordering flow
│   ├── registration.js         # Invite code validation & admin creation
│   ├── ollama.js               # AI extraction (zones, products, bank, hours, orders)
│   ├── twilio.js               # Send WhatsApp messages
│   └── database.js             # All Supabase CRUD operations
└── utils/
    ├── extract-message.js      # Parse Twilio webhook body
    ├── validators.js           # Required field checks per step
    ├── commands.js             # Post-onboarding command parser (admin + customer)
    └── hours.js                # Business hours parsing & checking
```

---

## Where Ollama (AI) Is Needed

| Step | AI needed? | Why |
|---|---|---|
| Registration | ❌ No | Exact code match |
| Business name | ❌ No | Direct text save |
| Business hours | ✅ Yes | Normalise natural language ("lunes a viernes de 11 a 23") |
| Delivery/Pickup | ❌ No | Numbered option (1/2/3) |
| Payment methods | ❌ No | Numbered option (1/2/3/4) |
| Pickup address | ❌ No | Direct text save |
| Delivery zones | ✅ Yes | Parse "Centro $500, Norte $800" into structured data |
| Bank data | ✅ Yes | Extract alias, CBU, holder from a paragraph |
| Products (admin) | ✅ Yes | Parse names, prices, categories from free text |
| Commands | ❌ No | Keyword matching |
| **Customer order** | **✅ Yes** | **Parse "2 muzzarella y 1 coca" into cart items** |
| Customer address | ❌ No | Direct text save |
| Payment selection | ❌ No | Numbered option |

---

## Implementation Order

### Phase 1 — Foundation ✅
1. Express server + Twilio webhook
2. Supabase schema (run SQL)
3. Config + environment setup
4. Message extractor utility

### Phase 2 — Registration ✅
5. Invite code table + seed script
6. Registration flow (code validation → admin creation)
7. Twilio response messages (Spanish)

### Phase 3 — Onboarding Steps (no AI) ✅
8. Business name step (direct save)
9. Delivery/pickup selection (numbered options)
10. Payment methods step (numbered options)
11. Pickup address step (direct save)
12. User state management (step tracking)

### Phase 4 — Onboarding Steps (with AI) ✅
13. Ollama service + JSON parser
14. Business hours extraction
15. Delivery zones extraction
16. Bank data extraction
17. Product catalog extraction + loop

### Phase 5 — Review & Activation ✅
18. Summary builder
19. Confirmation flow
20. Business activation

### Phase 6 — Post-Onboarding Commands ✅
21. Command parser
22. Edit mode for each data section (including EDITAR PAGOS)
23. Product management (add/remove/pause)
24. View commands (menu, business summary)

### Phase 7 — Database Preparation (Orders)
25. Create `orders` table
26. Create `customer_states` table
27. Add database CRUD for orders and customer states

### Phase 8 — Message Routing Update
28. Modify routing: active business → customer order flow
29. Keep "volvé pronto" for inactive businesses

### Phase 9 — Customer Flow Steps (no AI)
30. Greeting + business hours check
31. Menu display
32. Delivery method selection
33. Delivery zone selection + price
34. Payment method selection
35. Bank details display (if transfer/deposit)
36. Order confirmation

### Phase 10 — Customer Flow Steps (with AI)
37. Natural language order parsing (AI → cart items)
38. Cart management (add/remove/modify/subtotal)
39. Customer address input

### Phase 11 — Order Completion & Notifications
40. Save order to database
41. Admin notification (order details via WhatsApp)
42. Customer confirmation message
43. Customer status check (ESTADO #123)
44. Customer cancellation (before admin confirmation)

### Phase 12 — Admin Order Commands
45. VER PEDIDOS — list orders
46. VER PEDIDO #123 — order details
47. ESTADO PEDIDO #123 — change status
48. CONFIRMAR PAGO #123 — confirm payment
49. RECHAZAR PEDIDO #123 — reject order
50. VENTAS HOY/SEMANA/MES — sales summary

### Phase 13 — Testing & Adjustments
51-57. Full scenario testing + message polish

### Phase 14 — Optional Improvements (Future)
58-62. Quick replies, dropdowns, Meta catalog, auto alerts, payment proof

---

## Decisions Log

| Question | Decision |
|---|---|
| Language | All Spanish (Argentine) |
| Invite code format | `REST-XXXX` (4 alphanumeric chars) |
| Invite code creation | CLI script: `node generate-codes.js 10` |
| Product limits | 100 per business |
| CBU validation | No — save as-is |
| Payment methods | 4 options: cash, transfer, both, both+deposit |
| Deposit percentage | Asked on option 4, saved in businesses.deposit_percent |
| Order numbering | Sequential per business (SERIAL) |
| Order cancellation | Customer can cancel before admin confirms |
| Status tracking | Customer can check via "ESTADO #N" |
| Admin notifications | Auto-sent on new order via WhatsApp |
| Timezone | Argentina (UTC-3) |
