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

## Phase 14 — Optional Improvements (Future)
- [ ] 58. Quick reply buttons for selections
- [ ] 59. Dropdown lists for menus/zones
- [ ] 60. Meta catalog integration (photos + native cart)
- [ ] 61. Automatic admin alerts for new orders
- [ ] 62. Proof of payment attachment (customer sends photo)
