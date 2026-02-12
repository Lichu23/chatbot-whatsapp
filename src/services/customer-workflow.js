const db = require('./database');
const { sendMessage } = require('./twilio');
const { extractOrderItems } = require('./ollama');
const { config, CUSTOMER_STEPS } = require('../config');

/**
 * Main customer orchestration — routes customer messages through the ordering flow.
 * Called when a non-admin messages and the business is active.
 */
async function processCustomerMessage(message, business) {
  const { from, text, profileName } = message;
  console.log(`\n🛒 processCustomerMessage: from=${from}, text="${text}", business=${business.business_name}`);

  // Check for ESTADO/CANCELAR commands first (work even without state)
  const statusMatch = text.trim().match(/^ESTADO\s+#?(\d+)$/i);
  if (statusMatch) {
    return handleCustomerStatusCheck(from, parseInt(statusMatch[1], 10), business);
  }
  const cancelMatch = text.trim().match(/^CANCELAR\s+#?(\d+)$/i);
  if (cancelMatch) {
    return handleCustomerCancelOrder(from, parseInt(cancelMatch[1], 10), business);
  }

  // Check if customer has an existing state (mid-order)
  const state = await db.getCustomerState(from);

  if (state) {
    console.log(`🛒 Customer state found: step=${state.current_step}`);
    return handleCustomerStep(from, text, state, business, profileName);
  }

  // New customer — start fresh
  console.log('🛒 New customer — starting order flow');
  return startCustomerFlow(from, text, business, profileName);
}

/**
 * Start a new customer flow: greet + check hours.
 */
async function startCustomerFlow(phone, text, business, profileName) {
  // Check business hours
  if (!isWithinBusinessHours(business.business_hours)) {
    return sendMessage(phone,
      `🕐 *${business.business_name}* está cerrado en este momento.\n` +
      `⏰ Nuestro horario: ${business.business_hours}\n\n` +
      '¡Volvé cuando estemos abiertos!'
    );
  }

  // Create customer state
  await db.upsertCustomerState(phone, {
    business_id: business.id,
    current_step: CUSTOMER_STEPS.VIEWING_MENU,
    cart: [],
    selected_zone_id: null,
    delivery_method: null,
  });

  return sendMessage(phone,
    `👋 ¡Hola! Bienvenido/a a *${business.business_name}*\n` +
    `⏰ Horario: ${business.business_hours}\n\n` +
    'Escribí *MENÚ* para ver nuestros productos o decinos directamente qué querés pedir.'
  );
}

/**
 * Route customer to the correct step handler.
 */
async function handleCustomerStep(phone, text, state, business, profileName) {
  const { current_step } = state;

  // Check for customer commands first (ESTADO #N, CANCELAR #N)
  const statusMatch = text.trim().match(/^ESTADO\s+#?(\d+)$/i);
  if (statusMatch) {
    return handleCustomerStatusCheck(phone, parseInt(statusMatch[1], 10), business);
  }

  const cancelMatch = text.trim().match(/^CANCELAR\s+#?(\d+)$/i);
  if (cancelMatch) {
    return handleCustomerCancelOrder(phone, parseInt(cancelMatch[1], 10), business);
  }

  switch (current_step) {
    case CUSTOMER_STEPS.VIEWING_MENU:
      return handleViewingMenu(phone, text, state, business, profileName);
    case CUSTOMER_STEPS.BUILDING_CART:
      return handleBuildingCart(phone, text, state, business);
    case CUSTOMER_STEPS.DELIVERY_METHOD:
      return handleCustomerDeliveryMethod(phone, text, state, business);
    case CUSTOMER_STEPS.DELIVERY_ZONE:
      return handleCustomerDeliveryZone(phone, text, state, business);
    case CUSTOMER_STEPS.DELIVERY_ADDRESS:
      return handleCustomerDeliveryAddress(phone, text, state, business);
    case CUSTOMER_STEPS.PAYMENT_METHOD:
      return handleCustomerPaymentMethod(phone, text, state, business);
    case CUSTOMER_STEPS.AWAITING_TRANSFER:
      return handleAwaitingTransfer(phone, text, state, business);
    case CUSTOMER_STEPS.ORDER_CONFIRMED:
      // Order already confirmed — treat as new interaction
      await db.deleteCustomerState(phone);
      return startCustomerFlow(phone, text, business, profileName);

    default:
      await db.deleteCustomerState(phone);
      return startCustomerFlow(phone, text, business, profileName);
  }
}

// ══════════════════════════════════════
// STEP 1: VIEWING MENU
// ══════════════════════════════════════

async function handleViewingMenu(phone, text, state, business, profileName) {
  const normalized = text.trim().toUpperCase();

  // Show menu
  if (normalized === 'MENÚ' || normalized === 'MENU') {
    const menuText = await buildCustomerMenu(business.id, business.business_name);
    return sendMessage(phone, menuText);
  }

  // Any other text → parse as an order via AI
  return handleOrderByText(phone, text, state, business);
}

async function buildCustomerMenu(businessId, businessName) {
  const products = await db.getProductsByBusiness(businessId);
  const available = products.filter((p) => p.is_available);

  if (available.length === 0) {
    return '📦 No hay productos disponibles en este momento.';
  }

  const lines = [`📦 *Menú de ${businessName}:*\n`];

  const grouped = {};
  for (const p of available) {
    const cat = p.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  }

  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`*${cat}:*`);
    for (const p of items) {
      lines.push(`• ${p.name} — $${p.price}`);
    }
    lines.push('');
  }

  lines.push('Escribí lo que querés pedir (ej: "2 muzzarella y 1 coca")');
  return lines.join('\n');
}

/**
 * AI-powered order parsing — extracts products + quantities from customer free text.
 * Matches against the real product catalog using Ollama.
 */
async function handleOrderByText(phone, text, state, business) {
  // Fetch available products for AI matching
  const products = await db.getProductsByBusiness(business.id);
  const available = products.filter((p) => p.is_available);

  if (available.length === 0) {
    return sendMessage(phone, '📦 No hay productos disponibles en este momento.');
  }

  let result;
  try {
    result = await extractOrderItems(text, available);
  } catch (error) {
    console.error('🤖 ❌ AI order parsing failed:', error.message);
    return sendMessage(phone,
      '⚠️ No pude interpretar tu pedido.\n\n' +
      'Probá de nuevo con algo como: "2 muzzarella y 1 coca"\n' +
      'O escribí *MENÚ* para ver nuestros productos.'
    );
  }

  const items = result.items || [];
  const notFound = result.not_found || [];

  if (items.length === 0) {
    let msg = '⚠️ No encontré productos en tu mensaje.\n\n';
    if (notFound.length > 0) {
      msg += `No tenemos: ${notFound.join(', ')}\n\n`;
    }
    msg += 'Probá de nuevo o escribí *MENÚ* para ver nuestros productos.';
    return sendMessage(phone, msg);
  }

  // Build cart items with prices from the real catalog
  const existingCart = state.cart || [];
  const newCart = [...existingCart];

  for (const item of items) {
    const product = available.find((p) => p.id === item.product_id);
    if (!product) continue; // Safety check

    const qty = Math.max(1, Math.round(item.qty || 1));

    // Check if product is already in cart — merge quantities
    const existing = newCart.find((c) => c.product_id === item.product_id);
    if (existing) {
      existing.qty += qty;
      existing.subtotal = existing.price * existing.qty;
    } else {
      newCart.push({
        product_id: product.id,
        name: product.name,
        price: Number(product.price),
        qty,
        subtotal: Number(product.price) * qty,
      });
    }
  }

  // Save cart and transition to BUILDING_CART
  await db.upsertCustomerState(phone, {
    ...stateFields(state),
    cart: newCart,
    current_step: CUSTOMER_STEPS.BUILDING_CART,
  });

  // Build response
  let msg = buildCartDisplay(newCart);

  if (notFound.length > 0) {
    msg = `⚠️ No encontré: ${notFound.join(', ')}\n\n` + msg;
  }

  return sendMessage(phone, msg);
}

// ══════════════════════════════════════
// STEP 2: BUILDING CART
// ══════════════════════════════════════

async function handleBuildingCart(phone, text, state, business) {
  const normalized = text.trim().toUpperCase();

  // Cancel order
  if (normalized === 'CANCELAR') {
    await db.deleteCustomerState(phone);
    return sendMessage(phone, '❌ Pedido cancelado.');
  }

  // Continue to delivery step
  if (normalized === 'SEGUIR') {
    return advanceToDelivery(phone, state, business);
  }

  // Remove item (allow optional product name after number, e.g. "QUITAR 1 empanada")
  const removeMatch = normalized.match(/^QUITAR\s+(\d+)(?:\s+.*)?$/);
  if (removeMatch) {
    const index = parseInt(removeMatch[1], 10) - 1;
    const cart = state.cart || [];

    if (index < 0 || index >= cart.length) {
      return sendMessage(phone, `⚠️ Número inválido. Elegí entre 1 y ${cart.length}.`);
    }

    const removed = cart[index];
    cart.splice(index, 1);

    if (cart.length === 0) {
      await db.updateCustomerCart(phone, []);
      await db.updateCustomerStep(phone, CUSTOMER_STEPS.VIEWING_MENU);
      return sendMessage(phone,
        `✅ *${removed.name}* eliminado del pedido.\n\n` +
        '🛒 Tu carrito está vacío.\n' +
        'Escribí *MENÚ* para ver nuestros productos o decinos qué querés pedir.'
      );
    }

    await db.updateCustomerCart(phone, cart);
    return sendMessage(phone,
      `✅ *${removed.name}* eliminado del pedido.\n\n` + buildCartDisplay(cart)
    );
  }

  // Change quantity (allow optional product name after, e.g. "CAMBIAR 2 A 3 empanadas")
  const changeMatch = normalized.match(/^CAMBIAR\s+(\d+)\s+A\s+(\d+)(?:\s+.*)?$/);
  if (changeMatch) {
    const index = parseInt(changeMatch[1], 10) - 1;
    const newQty = parseInt(changeMatch[2], 10);
    const cart = state.cart || [];

    if (index < 0 || index >= cart.length) {
      return sendMessage(phone, `⚠️ Número inválido. Elegí entre 1 y ${cart.length}.`);
    }
    if (newQty < 1) {
      return sendMessage(phone, '⚠️ La cantidad debe ser al menos 1. Usá *QUITAR* para eliminar.');
    }

    cart[index].qty = newQty;
    cart[index].subtotal = cart[index].price * newQty;
    await db.updateCustomerCart(phone, cart);
    return sendMessage(phone,
      `✅ Cantidad actualizada.\n\n` + buildCartDisplay(cart)
    );
  }

  // Show menu
  if (normalized === 'MENÚ' || normalized === 'MENU') {
    const menuText = await buildCustomerMenu(business.id, business.business_name);
    return sendMessage(phone, menuText);
  }

  // Customer wants to add more items
  if (normalized === 'SÍ' || normalized === 'SI') {
    return sendMessage(phone, 'Escribí lo que querés agregar:');
  }

  // Try to parse as additional order via AI
  return handleOrderByText(phone, text, state, business);
}

function buildCartDisplay(cart) {
  const lines = ['🛒 *Tu pedido:*'];
  let subtotal = 0;

  for (let i = 0; i < cart.length; i++) {
    const item = cart[i];
    const itemTotal = item.price * item.qty;
    subtotal += itemTotal;
    lines.push(`${i + 1}. ${item.qty}x ${item.name} — $${formatPrice(itemTotal)}`);
  }

  lines.push(`\n📋 Subtotal: *$${formatPrice(subtotal)}*`);
  lines.push('\n¿Querés agregar algo más?');
  lines.push('• *SÍ* — seguir agregando');
  lines.push('• *QUITAR 1* — eliminar un item');
  lines.push('• *CAMBIAR 1 A 3* — cambiar cantidad');
  lines.push('• *SEGUIR* — confirmar y continuar');
  lines.push('• *CANCELAR* — cancelar pedido');

  return lines.join('\n');
}

// ══════════════════════════════════════
// STEP 3: DELIVERY METHOD
// ══════════════════════════════════════

async function advanceToDelivery(phone, state, business) {
  const cart = state.cart || [];
  if (cart.length === 0) {
    await db.updateCustomerStep(phone, CUSTOMER_STEPS.VIEWING_MENU);
    return sendMessage(phone,
      '⚠️ Tu carrito está vacío.\n' +
      'Escribí *MENÚ* para ver nuestros productos o decinos qué querés pedir.'
    );
  }

  const hasDelivery = business.has_delivery;
  const hasPickup = business.has_pickup;

  // Both options
  if (hasDelivery && hasPickup) {
    await db.updateCustomerStep(phone, CUSTOMER_STEPS.DELIVERY_METHOD);
    const address = business.business_address ? ` (📍 ${business.business_address})` : '';
    return sendMessage(phone,
      '🚚 ¿Cómo querés recibir tu pedido? Seleccioná una opción:\n\n' +
      '1️⃣ Delivery\n' +
      `2️⃣ Retiro en local${address}\n\n` +
      'Escribí *1* o *2* (o el nombre de la opción).\n' +
      'Escribí *CANCELAR* para cancelar el pedido.'
    );
  }

  // Delivery only → go to zone selection
  if (hasDelivery) {
    await db.upsertCustomerState(phone, {
      ...stateFields(state),
      delivery_method: 'delivery',
      current_step: CUSTOMER_STEPS.DELIVERY_ZONE,
    });
    return showDeliveryZones(phone, business.id);
  }

  // Pickup only → skip to payment
  await db.upsertCustomerState(phone, {
    ...stateFields(state),
    delivery_method: 'pickup',
    current_step: CUSTOMER_STEPS.PAYMENT_METHOD,
  });
  return showOrderSummaryAndPayment(phone, state, business, 'pickup', null);
}

async function handleCustomerDeliveryMethod(phone, text, state, business) {
  const option = text.trim();
  const normalized = option.toUpperCase();

  if (normalized === 'CANCELAR') {
    await db.deleteCustomerState(phone);
    return sendMessage(phone, '❌ Pedido cancelado.');
  }

  // Accept number OR text for delivery
  const isDelivery = option === '1' || normalized === 'DELIVERY' || normalized === 'ENVÍO' || normalized === 'ENVIO';
  // Accept number OR text for pickup
  const isPickup = option === '2' || normalized === 'RETIRO' || normalized === 'RETIRO EN LOCAL' || normalized === 'LOCAL';

  if (isDelivery) {
    await db.upsertCustomerState(phone, {
      ...stateFields(state),
      delivery_method: 'delivery',
      current_step: CUSTOMER_STEPS.DELIVERY_ZONE,
    });
    return showDeliveryZones(phone, business.id);
  }

  if (isPickup) {
    await db.upsertCustomerState(phone, {
      ...stateFields(state),
      delivery_method: 'pickup',
      current_step: CUSTOMER_STEPS.PAYMENT_METHOD,
    });
    return showOrderSummaryAndPayment(phone, state, business, 'pickup', null);
  }

  const address = business.business_address ? ` (📍 ${business.business_address})` : '';
  return sendMessage(phone,
    '⚠️ Elegí una opción:\n\n' +
    '1️⃣ Delivery\n' +
    `2️⃣ Retiro en local${address}\n\n` +
    'Escribí *1* o *2* (o el nombre de la opción).\n' +
    'Escribí *CANCELAR* para cancelar el pedido.'
  );
}

// ══════════════════════════════════════
// STEP 4: DELIVERY ZONE
// ══════════════════════════════════════

async function showDeliveryZones(phone, businessId) {
  const zones = await db.getZonesByBusiness(businessId);

  if (zones.length === 0) {
    return sendMessage(phone, '⚠️ No hay zonas de delivery configuradas. Contactá al local.');
  }

  const lines = ['🚚 *Zonas de delivery:*'];
  for (let i = 0; i < zones.length; i++) {
    lines.push(`${i + 1}️⃣ ${zones[i].zone_name} — $${zones[i].price}`);
  }
  lines.push('\n¿En qué zona estás? Respondé con el número.');
  lines.push('Escribí *CANCELAR* para cancelar el pedido.');

  return sendMessage(phone, lines.join('\n'));
}

async function handleCustomerDeliveryZone(phone, text, state, business) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.deleteCustomerState(phone);
    return sendMessage(phone, '❌ Pedido cancelado.');
  }

  const zones = await db.getZonesByBusiness(business.id);
  const num = parseInt(text.trim(), 10);

  if (isNaN(num) || num < 1 || num > zones.length) {
    return sendMessage(phone, `⚠️ Elegí un número del 1 al ${zones.length}.\nEscribí *CANCELAR* para cancelar el pedido.`);
  }

  const selectedZone = zones[num - 1];

  await db.upsertCustomerState(phone, {
    ...stateFields(state),
    selected_zone_id: selectedZone.id,
    current_step: CUSTOMER_STEPS.DELIVERY_ADDRESS,
  });

  return sendMessage(phone, '📍 ¿Cuál es tu dirección de entrega?\n\nEscribí *CANCELAR* para cancelar el pedido.');
}

// ══════════════════════════════════════
// STEP 5: DELIVERY ADDRESS
// ══════════════════════════════════════

async function handleCustomerDeliveryAddress(phone, text, state, business) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.deleteCustomerState(phone);
    return sendMessage(phone, '❌ Pedido cancelado.');
  }

  if (!text || text.trim().length === 0) {
    return sendMessage(phone, '⚠️ Necesito tu dirección para el delivery.\nEscribí *CANCELAR* para cancelar el pedido.');
  }

  const address = text.trim();

  // Save address temporarily in state (we'll use it when creating the order)
  // We store it in cart metadata since customer_states doesn't have an address field
  // Actually, let's advance to payment and keep the address in the order flow
  await db.updateCustomerStep(phone, CUSTOMER_STEPS.PAYMENT_METHOD);

  // Get updated state with zone
  const updatedState = await db.getCustomerState(phone);
  return showOrderSummaryAndPayment(phone, updatedState, business, 'delivery', address);
}

// ══════════════════════════════════════
// STEP 6: ORDER SUMMARY + PAYMENT
// ══════════════════════════════════════

async function showOrderSummaryAndPayment(phone, state, business, method, address) {
  const cart = state.cart || [];
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  let deliveryPrice = 0;
  let zoneName = null;

  if (method === 'delivery' && state.selected_zone_id) {
    const zones = await db.getZonesByBusiness(business.id);
    const zone = zones.find((z) => z.id === state.selected_zone_id);
    if (zone) {
      deliveryPrice = Number(zone.price);
      zoneName = zone.zone_name;
    }
  }

  const grandTotal = subtotal + deliveryPrice;

  // Build summary
  const lines = ['📋 *Resumen de tu pedido:*\n'];

  for (const item of cart) {
    lines.push(`🛒 ${item.qty}x ${item.name} — $${formatPrice(item.price * item.qty)}`);
  }

  lines.push(`📋 Subtotal: $${formatPrice(subtotal)}`);

  if (method === 'delivery' && zoneName) {
    lines.push(`🚚 Delivery (${zoneName}): $${formatPrice(deliveryPrice)}`);
    if (address) lines.push(`📍 Dirección: ${address}`);
  } else if (method === 'pickup') {
    if (business.business_address) {
      lines.push(`🏪 Retiro en: ${business.business_address}`);
    }
  }

  lines.push(`💰 *Total: $${formatPrice(grandTotal)}*`);

  // Build payment options
  lines.push('\n💳 *¿Cómo querés pagar?*\n');

  const paymentOptions = [];
  let optionNum = 1;

  if (business.accepts_cash) {
    const label = method === 'pickup' ? 'Efectivo (pagás al retirar)' : 'Efectivo (pagás al recibir)';
    paymentOptions.push({ num: optionNum, method: 'cash', label });
    lines.push(`${optionNum}️⃣ ${label}`);
    optionNum++;
  }

  if (business.accepts_transfer) {
    paymentOptions.push({ num: optionNum, method: 'transfer', label: `Transferencia bancaria (total: $${formatPrice(grandTotal)})` });
    lines.push(`${optionNum}️⃣ Transferencia bancaria (total: $${formatPrice(grandTotal)})`);
    optionNum++;
  }

  if (business.accepts_deposit && business.deposit_percent) {
    const depositAmount = Math.ceil(grandTotal * business.deposit_percent / 100);
    paymentOptions.push({ num: optionNum, method: 'deposit', label: `Seña por transferencia (${business.deposit_percent}%: $${formatPrice(depositAmount)})` });
    lines.push(`${optionNum}️⃣ Seña por transferencia (${business.deposit_percent}%: $${formatPrice(depositAmount)})`);
    optionNum++;
  }

  // Store order context in cart metadata for next step
  // We save address + payment options mapping as extra data
  const orderContext = {
    subtotal,
    delivery_price: deliveryPrice,
    grand_total: grandTotal,
    zone_name: zoneName,
    address: address || null,
    delivery_method: method,
    payment_options: paymentOptions,
  };

  // Store context in cart (append as last item with special flag)
  const cartWithContext = [...cart, { _order_context: true, ...orderContext }];
  await db.updateCustomerCart(phone, cartWithContext);

  return sendMessage(phone, lines.join('\n'));
}

// ══════════════════════════════════════
// STEP 7: PAYMENT METHOD
// ══════════════════════════════════════

async function handleCustomerPaymentMethod(phone, text, state, business) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.deleteCustomerState(phone);
    return sendMessage(phone, '❌ Pedido cancelado.');
  }

  const cart = state.cart || [];
  const contextItem = cart.find((item) => item._order_context);

  if (!contextItem) {
    // Lost context — restart
    await db.deleteCustomerState(phone);
    return sendMessage(phone, '⚠️ Algo salió mal. Escribí *HOLA* para empezar de nuevo.');
  }

  const { payment_options, grand_total } = contextItem;
  const num = parseInt(text.trim(), 10);

  const selected = payment_options.find((o) => o.num === num);
  if (!selected) {
    return sendMessage(phone, `⚠️ Elegí una opción del 1 al ${payment_options.length}.\nEscribí *CANCELAR* para cancelar el pedido.`);
  }

  // If transfer or deposit → show bank details
  if (selected.method === 'transfer' || selected.method === 'deposit') {
    const bank = await db.getBankDetails(business.id);
    if (!bank) {
      return sendMessage(phone, '⚠️ No hay datos bancarios configurados. Contactá al local.');
    }

    let amountText;
    if (selected.method === 'deposit') {
      const depositAmount = Math.ceil(grand_total * business.deposit_percent / 100);
      const remaining = grand_total - depositAmount;
      amountText =
        `💰 Monto de la seña: *$${formatPrice(depositAmount)}* (${business.deposit_percent}% de $${formatPrice(grand_total)})\n` +
        `💰 Restante a pagar al recibir: *$${formatPrice(remaining)}*`;
    } else {
      amountText = `💰 Monto a transferir: *$${formatPrice(grand_total)}*`;
    }

    // Save payment method choice in context
    const updatedCart = cart.map((item) =>
      item._order_context ? { ...item, selected_payment: selected.method } : item
    );
    await db.updateCustomerCart(phone, updatedCart);
    await db.updateCustomerStep(phone, CUSTOMER_STEPS.AWAITING_TRANSFER);

    return sendMessage(phone,
      '🏦 *Datos para transferir:*\n' +
      `• Alias: ${bank.alias}\n` +
      `• CBU: ${bank.cbu}\n` +
      `• Titular: ${bank.account_holder}\n\n` +
      amountText + '\n\n' +
      'Cuando hayas transferido, respondé *LISTO*.\n' +
      'Para cancelar, escribí *CANCELAR*.'
    );
  }

  // Cash payment — confirm order directly
  const updatedCart = cart.map((item) =>
    item._order_context ? { ...item, selected_payment: 'cash' } : item
  );
  await db.updateCustomerCart(phone, updatedCart);
  return confirmAndSaveOrder(phone, state, business);
}

// ══════════════════════════════════════
// STEP 8: AWAITING TRANSFER
// ══════════════════════════════════════

async function handleAwaitingTransfer(phone, text, state, business) {
  const normalized = text.trim().toUpperCase();

  if (normalized === 'LISTO') {
    return confirmAndSaveOrder(phone, state, business);
  }

  if (normalized === 'CANCELAR') {
    await db.deleteCustomerState(phone);
    return sendMessage(phone,
      '❌ Pedido cancelado.\n\n' +
      'Si querés hacer un nuevo pedido, escribí *MENÚ* o decinos qué querés pedir.'
    );
  }

  return sendMessage(phone,
    'Cuando hayas transferido, respondé *LISTO*.\n' +
    'Para cancelar el pedido, escribí *CANCELAR*.'
  );
}

// ══════════════════════════════════════
// ORDER CONFIRMATION + SAVE
// ══════════════════════════════════════

async function confirmAndSaveOrder(phone, state, business) {
  const cart = state.cart || [];
  const contextItem = cart.find((item) => item._order_context);

  if (!contextItem) {
    await db.deleteCustomerState(phone);
    return sendMessage(phone, '⚠️ Algo salió mal. Escribí *HOLA* para empezar de nuevo.');
  }

  const realItems = cart.filter((item) => !item._order_context);
  const paymentMethod = contextItem.selected_payment || 'cash';
  const grandTotal = contextItem.grand_total;

  let depositAmount = null;
  if (paymentMethod === 'deposit' && business.deposit_percent) {
    depositAmount = Math.ceil(grandTotal * business.deposit_percent / 100);
  }

  // Save order
  const order = await db.createOrder({
    business_id: business.id,
    client_phone: phone,
    client_name: null,
    client_address: contextItem.address,
    items: realItems.map((item) => ({
      product_id: item.product_id,
      name: item.name,
      qty: item.qty,
      price: item.price,
      subtotal: item.price * item.qty,
    })),
    subtotal: contextItem.subtotal,
    delivery_zone_id: state.selected_zone_id || null,
    delivery_price: contextItem.delivery_price,
    grand_total: grandTotal,
    payment_method: paymentMethod,
    deposit_amount: depositAmount,
  });

  // Clean up customer state
  await db.updateCustomerStep(phone, CUSTOMER_STEPS.ORDER_CONFIRMED);

  // Build confirmation message
  const paymentLabels = {
    cash: 'Efectivo',
    transfer: 'Transferencia bancaria',
    deposit: depositAmount
      ? `Seña $${formatPrice(depositAmount)} (transferencia) + $${formatPrice(grandTotal - depositAmount)} (efectivo al recibir)`
      : 'Seña por transferencia',
  };

  const lines = ['📩 *¡Pedido recibido!*\n'];

  lines.push(`📦 Pedido #${order.order_number}`);
  lines.push(`💰 Total: $${formatPrice(grandTotal)}`);
  lines.push(`💳 Pago: ${paymentLabels[paymentMethod]}`);

  if (contextItem.delivery_method === 'delivery' && contextItem.address) {
    lines.push(`🚚 Delivery a: ${contextItem.address}${contextItem.zone_name ? `, ${contextItem.zone_name}` : ''}`);
  } else if (contextItem.delivery_method === 'pickup' && business.business_address) {
    lines.push(`🏪 Retiro en: ${business.business_address}`);
  }

  lines.push('\n⏳ *Tu pedido está pendiente de confirmación por el local.*');
  lines.push('Te avisamos cuando el local confirme tu pedido.');

  lines.push(`Podés consultar el estado escribiendo *ESTADO #${order.order_number}*.`);
  lines.push(`Para cancelar (antes de que el local confirme), escribí *CANCELAR #${order.order_number}*.`);

  await sendMessage(phone, lines.join('\n'));

  // Notify admin
  await notifyAdminNewOrder(order, realItems, contextItem, business, phone, paymentMethod, depositAmount);

  return;
}

async function notifyAdminNewOrder(order, items, context, business, clientPhone, paymentMethod, depositAmount) {
  const adminPhone = business.admin_phone;

  const lines = [`🔔 *Nuevo pedido #${order.order_number}*\n`];
  lines.push(`📱 Cliente: ${clientPhone}`);

  for (const item of items) {
    lines.push(`🛒 ${item.qty}x ${item.name} — $${formatPrice(item.price * item.qty)}`);
  }

  if (context.delivery_method === 'delivery') {
    lines.push(`🚚 Delivery (${context.zone_name || 'zona'}): $${formatPrice(context.delivery_price)}`);
    if (context.address) lines.push(`📍 ${context.address}`);
  } else {
    lines.push('🏪 Retiro en local');
  }

  lines.push(`💰 Total: $${formatPrice(context.grand_total)}`);

  const paymentLabels = {
    cash: 'Efectivo (⏳ pendiente de confirmación)',
    transfer: 'Transferencia bancaria (⏳ pendiente de confirmación)',
    deposit: `Seña $${formatPrice(depositAmount || 0)} (⏳ pendiente de confirmación)`,
  };

  lines.push(`💳 Pago: ${paymentLabels[paymentMethod]}`);

  if (paymentMethod === 'transfer' || paymentMethod === 'deposit') {
    lines.push(`\nRespondé *CONFIRMAR PAGO #${order.order_number}* cuando recibas la transferencia.`);
  } else {
    lines.push(`\nRespondé *CONFIRMAR PAGO #${order.order_number}* para confirmar el pedido.`);
  }
  lines.push(`Respondé *RECHAZAR PEDIDO #${order.order_number}* para cancelar.`);

  try {
    await sendMessage(adminPhone, lines.join('\n'));
    console.log(`📩 Admin notified about order #${order.order_number}`);
  } catch (error) {
    console.error(`❌ Failed to notify admin about order #${order.order_number}:`, error.message);
  }
}

// ══════════════════════════════════════
// CUSTOMER COMMANDS (ESTADO / CANCELAR)
// ══════════════════════════════════════

async function handleCustomerStatusCheck(phone, orderNumber, business) {
  const order = await db.getOrderByClientAndNumber(phone, orderNumber, business.id);
  if (!order) {
    return sendMessage(phone, `⚠️ No encontré el pedido #${orderNumber}.`);
  }

  const statusLabels = {
    nuevo: 'Nuevo 🆕',
    preparando: 'Preparando 🍳',
    en_camino: 'En camino 🛵',
    entregado: 'Entregado ✅',
    cancelado: 'Cancelado ❌',
  };

  const label = statusLabels[order.order_status] || order.order_status;
  return sendMessage(phone, `📦 Pedido #${orderNumber} — Estado: *${label}*`);
}

async function handleCustomerCancelOrder(phone, orderNumber, business) {
  const order = await db.getOrderByClientAndNumber(phone, orderNumber, business.id);
  if (!order) {
    return sendMessage(phone, `⚠️ No encontré el pedido #${orderNumber}.`);
  }

  if (order.order_status !== 'nuevo') {
    const statusLabels = {
      preparando: 'en preparación',
      en_camino: 'en camino',
      entregado: 'entregado',
      cancelado: 'cancelado',
    };
    const label = statusLabels[order.order_status] || order.order_status;
    return sendMessage(phone,
      `⚠️ El pedido #${orderNumber} ya está *${label}* y no se puede cancelar.\n` +
      'Si necesitás ayuda, contactá al local.'
    );
  }

  await db.updateOrderStatus(order.id, 'cancelado');
  await sendMessage(phone, `❌ Pedido #${orderNumber} cancelado.`);

  // Notify admin
  try {
    await sendMessage(business.admin_phone,
      `⚠️ El cliente ${phone} canceló el pedido #${orderNumber}.`
    );
  } catch (error) {
    console.error(`❌ Failed to notify admin about customer cancellation:`, error.message);
  }
}

// ══════════════════════════════════════
// HELPERS
// ══════════════════════════════════════

/**
 * Check if current time (Argentina UTC-3) falls within business hours.
 * Business hours format: "Lun-Vie 11:00-23:00, Sáb 12:00-00:00"
 * For MVP, this is a best-effort check. Returns true if parsing fails.
 */
function isWithinBusinessHours(hoursText) {
  if (!hoursText) return true;

  try {
    const now = new Date();
    // Argentina is UTC-3
    const argTime = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
    const currentDay = argTime.getDay(); // 0=Sun, 1=Mon, ...
    const currentHour = argTime.getHours();
    const currentMin = argTime.getMinutes();
    const currentTime = currentHour * 60 + currentMin;

    const dayMap = {
      dom: 0, lun: 1, mar: 2, mié: 3, mie: 3,
      jue: 4, vie: 5, sáb: 6, sab: 6,
    };

    // Parse segments like "Lun-Vie 11:00-23:00"
    const segments = hoursText.split(',').map((s) => s.trim());

    for (const segment of segments) {
      const match = segment.match(
        /^(\w+)(?:-(\w+))?\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/i
      );
      if (!match) continue;

      const [, dayStart, dayEnd, hStart, mStart, hEnd, mEnd] = match;

      const startDay = dayMap[dayStart.toLowerCase()];
      const endDay = dayEnd ? dayMap[dayEnd.toLowerCase()] : startDay;

      if (startDay === undefined) continue;

      // Check if current day is in range
      let dayInRange = false;
      if (startDay <= (endDay ?? startDay)) {
        dayInRange = currentDay >= startDay && currentDay <= (endDay ?? startDay);
      } else {
        // Wraps around (e.g. Sáb-Dom)
        dayInRange = currentDay >= startDay || currentDay <= (endDay ?? startDay);
      }

      if (!dayInRange) continue;

      const openTime = parseInt(hStart) * 60 + parseInt(mStart);
      const closeTime = parseInt(hEnd) * 60 + parseInt(mEnd);

      if (closeTime > openTime) {
        // Normal range (e.g. 11:00-23:00)
        if (currentTime >= openTime && currentTime < closeTime) return true;
      } else {
        // Crosses midnight (e.g. 20:00-02:00)
        if (currentTime >= openTime || currentTime < closeTime) return true;
      }
    }

    // If no segment matched, check if we just couldn't parse
    // Return true to avoid blocking orders due to parsing issues
    return segments.every((s) => !s.match(/\d{1,2}:\d{2}/)) ? true : false;
  } catch {
    // If parsing fails, allow orders
    return true;
  }
}

function formatPrice(n) {
  return Number(n).toLocaleString('es-AR');
}

/**
 * Extract reusable state fields for upsert.
 */
function stateFields(state) {
  return {
    business_id: state.business_id,
    cart: state.cart,
    selected_zone_id: state.selected_zone_id,
    delivery_method: state.delivery_method,
    current_step: state.current_step,
  };
}

module.exports = { processCustomerMessage };
