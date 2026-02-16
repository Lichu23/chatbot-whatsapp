# Landing Page — Pricing Section Guidance

## Hero Section

**Headline:** "Automatizá tus pedidos por WhatsApp"
**Subheadline:** One sentence explaining the service — e.g., "Tu negocio recibe y gestiona pedidos automáticamente, sin apps ni instalaciones."

---

## 3-Column Pricing Cards

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│     BASICO      │  │   INTERMEDIO    │  │       PRO       │
│                 │  │  ★ RECOMENDADO  │  │                 │
│    $10/mes      │  │    $20/mes      │  │    $60/mes      │
│  ~$14.000 ARS   │  │  ~$28.000 ARS   │  │  ~$84.000 ARS   │
│                 │  │                 │  │                 │
│ ✓ Pedidos auto. │  │ ✓ Todo Básico + │  │ ✓ Todo Inter. + │
│ ✓ 100 pedidos   │  │ ✓ Asistente IA  │  │ ✓ Pedidos ilim. │
│ ✓ 3 zonas       │  │ ✓ 500 pedidos   │  │ ✓ Zonas ilim.   │
│ ✓ Todos los     │  │ ✓ 10 zonas      │  │ ✓ Difusiones    │
│   pagos         │  │ ✓ Resumen diario│  │ ✓ Fidelización  │
│ ✓ Reportes      │  │ ✓ Códigos promo │  │ ✓ Mensajes prog.│
│   básicos       │  │ ✓ Analytics     │  │ ✓ Analytics     │
│                 │  │                 │  │   ilimitados    │
│                 │  │                 │  │ ✓ Tendencias    │
│                 │  │                 │  │                 │
│  [Empezar]      │  │ [Probar GRATIS] │  │  [Contactar]   │
│                 │  │  30 días gratis │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Key Pricing Page Principles

1. **Intermediate card is visually highlighted** — colored border, "RECOMENDADO" badge, slightly larger or elevated
2. **"Probar GRATIS 30 días"** button ONLY on Intermediate — funnels everyone through Intermediate trial first
3. **Show ARS equivalent** — Argentine businesses think in pesos. Show USD + ARS at current rate
4. **Progressive feature lists** — each plan says "Todo [plan anterior] +" to avoid repeating features
5. **Pro shows "Contactar"** instead of direct signup — creates exclusivity feel, qualifies the lead
6. **Below the cards**: FAQ section addressing common objections

---

## FAQ Section

| Question | Answer |
|---|---|
| ¿Puedo cambiar de plan? | Sí, en cualquier momento |
| ¿Qué pasa después del período gratis? | Elegís tu plan, si no elegís se desactiva |
| ¿Cómo pago? | Transferencia bancaria mensual |
| ¿Puedo cancelar? | Sí, sin penalidad |

---

## CTA Buttons

| Plan | Button Text | Action |
|---|---|---|
| Basico | Empezar | `wa.me/YOUR_NUMBER?text=Quiero el plan Basico` |
| Intermedio | Probar GRATIS 30 días | `wa.me/YOUR_NUMBER?text=Quiero probar gratis` |
| Pro | Contactar | `wa.me/YOUR_NUMBER?text=Quiero info sobre el plan Pro` |

All CTAs open a WhatsApp conversation directly — no payment integration needed on the landing page.

---

## Tech Options for the Landing Page

| Option | Cost | Best For |
|---|---|---|
| Single HTML page on Vercel/Netlify | Free | Simplest, fastest to ship |
| Carrd.co | $19/year | No-code, quick setup |
| Framer / Webflow | Free–$15/mo | No-code with more design control |
| Next.js + Tailwind | Free hosting | If you want to iterate fast with code |

---

## Feature Comparison Table (for below the pricing cards)

| Feature | Basico | Intermedio | Pro |
|---|---|---|---|
| Pedidos automáticos | ✓ | ✓ | ✓ |
| Pedidos por mes | 100 | 500 | Ilimitados |
| Zonas de entrega | 3 | 10 | Ilimitadas |
| Métodos de pago | Todos | Todos | Todos |
| Comandos de gestión | ✓ | ✓ | ✓ |
| Asistente IA | — | ✓ | ✓ |
| Resumen diario | — | ✓ | ✓ |
| Códigos promo | — | ✓ | ✓ |
| Analytics | — | 20/mes | Ilimitados |
| Tendencias | — | — | ✓ |
| Difusiones WhatsApp | — | — | ✓ |
| Mensajes programados | — | — | ✓ |
| Fidelización clientes | — | — | ✓ |
