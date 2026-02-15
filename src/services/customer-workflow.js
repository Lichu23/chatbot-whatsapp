const db = require('./database');
const { sendMessage, sendButtons, sendList, sendCatalogList } = require('./whatsapp');
const { extractOrderItems } = require('./ai');
const { config, CUSTOMER_STEPS } = require('../config');

/**
 * Main customer orchestration — routes customer messages through the ordering flow.
 * Called when a non-admin messages and the business is active.
 */
async function processCustomerMessage(message, business, phoneConfig) {
  const pc = phoneConfig || null;
  const { from, text, profileName } = message;
  console.log(`\n🛒 processCustomerMessage: from=${from}, text="${text}", business=${business.business_name}`);

  // Check for ESTADO/CANCELAR commands first (work even without state)
  const statusMatch = text.trim().match(/^ESTADO\s+#?(\d+)$/i);
  if (statusMatch) {
    return handleCustomerStatusCheck(pc, from, parseInt(statusMatch[1], 10), business);
  }
  const cancelMatch = text.trim().match(/^CANCELAR\s+#?(\d+)$/i);
  if (cancelMatch) {
    return handleCustomerCancelOrder(pc, from, parseInt(cancelMatch[1], 10), business);
  }

  // Handle native cart orders (WhatsApp Add to Cart checkout)
  if (message.nativeCart) {
    console.log('🛒 Native cart order received:', JSON.stringify(message.nativeCart));
    const existingState = await db.getCustomerState(from, business.id);
    return handleNativeCartOrder(pc, from, message.nativeCart, business, profileName, existingState);
  }

  // Check if customer has an existing state (mid-order)
  const state = await db.getCustomerState(from, business.id);

  if (state) {
    console.log(`🛒 Customer state found: step=${state.current_step}`);
    return handleCustomerStep(pc, from, text, state, business, profileName, message);
  }

  // New customer — start fresh
  console.log('🛒 New customer — starting order flow');
  return startCustomerFlow(pc, from, text, business, profileName);
}

/**
 * Start a new customer flow: greet + check hours.
 */
async function startCustomerFlow(pc, phone, text, business, profileName) {
  // Check business hours
  if (!isWithinBusinessHours(business.business_hours)) {
    return sendMessage(pc, phone,
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

  // If customer typed MENÚ directly, skip greeting and show catalog
  const normalized = text.trim().toUpperCase();
  if (normalized === 'MENÚ' || normalized === 'MENU') {
    return sendCustomerMenu(pc, phone, business.id, business.business_name);
  }

  return sendMessage(pc, phone,
    `👋 ¡Hola! Bienvenido/a a *${business.business_name}*\n` +
    `⏰ Horario: ${business.business_hours}\n\n` +
    'Escribí *MENÚ* para ver nuestros productos o elegí directamente desde el catálogo 🛒'
  );
}

/**
 * Route customer to the correct step handler.
 */
async function handleCustomerStep(pc, phone, text, state, business, profileName, message) {
  const { current_step } = state;

  // Check for customer commands first (ESTADO #N, CANCELAR #N)
  const statusMatch = text.trim().match(/^ESTADO\s+#?(\d+)$/i);
  if (statusMatch) {
    return handleCustomerStatusCheck(pc, phone, parseInt(statusMatch[1], 10), business);
  }

  const cancelMatch = text.trim().match(/^CANCELAR\s+#?(\d+)$/i);
  if (cancelMatch) {
    return handleCustomerCancelOrder(pc, phone, parseInt(cancelMatch[1], 10), business);
  }

  switch (current_step) {
    case CUSTOMER_STEPS.VIEWING_MENU:
      return handleViewingMenu(pc, phone, text, state, business, profileName);
    case CUSTOMER_STEPS.BUILDING_CART:
      return handleBuildingCart(pc, phone, text, state, business);
    case CUSTOMER_STEPS.DELIVERY_METHOD:
      return handleCustomerDeliveryMethod(pc, phone, text, state, business);
    case CUSTOMER_STEPS.DELIVERY_ZONE:
      return handleCustomerDeliveryZone(pc, phone, text, state, business);
    case CUSTOMER_STEPS.DELIVERY_ADDRESS:
      return handleCustomerDeliveryAddress(pc, phone, text, state, business);
    case CUSTOMER_STEPS.PAYMENT_METHOD:
      return handleCustomerPaymentMethod(pc, phone, text, state, business);
    case CUSTOMER_STEPS.AWAITING_TRANSFER:
      return handleAwaitingTransfer(pc, phone, text, state, business);
    case CUSTOMER_STEPS.ORDER_CONFIRMED:
      // Order already confirmed — treat as new interaction
      await db.deleteCustomerState(phone, business.id);
      return startCustomerFlow(pc, phone, text, business, profileName);

    default:
      await db.deleteCustomerState(phone, business.id);
      return startCustomerFlow(pc, phone, text, business, profileName);
  }
}

// ══════════════════════════════════════
// STEP 1: VIEWING MENU
// ══════════════════════════════════════

async function handleViewingMenu(pc, phone, text, state, business, profileName) {
  const normalized = text.trim().toUpperCase();

  // Show menu
  if (normalized === 'MENÚ' || normalized === 'MENU') {
    return sendCustomerMenu(pc, phone, business.id, business.business_name);
  }

  // Product selected from list menu
  if (text.startsWith('product_')) {
    return handleProductFromList(pc, phone, text, state, business);
  }

  // Any other text → parse as an order via AI
  return handleOrderByText(pc, phone, text, state, business);
}

async function sendCustomerMenu(pc, phone, businessId, businessName) {
  const products = await db.getProductsByBusiness(businessId);
  const available = products.filter((p) => p.is_available);

  if (available.length === 0) {
    return sendMessage(pc, phone, '📦 No hay productos disponibles en este momento.');
  }

  const grouped = {};
  for (const p of available) {
    const cat = p.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  }

  // Use catalogId from phoneConfig if available, fallback to global config
  const catalogId = pc?.catalogId || config.catalog.id;

  // If catalog is configured and products have retailer_ids, send catalog message
  const catalogProducts = available.filter((p) => p.retailer_id);
  if (catalogId && catalogProducts.length > 0) {
    const catalogGrouped = {};
    for (const p of catalogProducts) {
      const cat = p.category || 'General';
      if (!catalogGrouped[cat]) catalogGrouped[cat] = [];
      catalogGrouped[cat].push(p);
    }

    const sections = Object.entries(catalogGrouped).map(([cat, items]) => ({
      title: cat,
      product_items: items.map((p) => ({ product_retailer_id: p.retailer_id })),
    }));

    // WhatsApp product_list supports up to 30 products and 10 sections
    if (sections.length <= 10 && catalogProducts.length <= 30) {
      return sendCatalogList(pc, phone,
        `Menú de ${businessName}`,
        'Elegí lo que quieras y agregalo al carrito 🛒',
        catalogId,
        sections
      );
    }
  }

  // Fallback: interactive list (max 10 rows)
  if (available.length <= 10) {
    const sections = Object.entries(grouped).map(([cat, items]) => ({
      title: cat,
      rows: items.map((p) => ({
        id: `product_${p.id}`,
        title: p.name.substring(0, 24),
        description: `$${p.price}`,
      })),
    }));

    return sendList(pc, phone,
      `📦 *Menú de ${businessName}*\n\nElegí un producto para agregarlo al carrito 🛒`,
      'Ver menú',
      sections
    );
  }

  // Fallback: text menu for large catalogs
  const lines = [`📦 *Menú de ${businessName}:*\n`];
  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`*${cat}:*`);
    for (const p of items) {
      lines.push(`• ${p.name} — $${p.price}`);
    }
    lines.push('');
  }
  lines.push('Elegí lo que quieras y agregalo al carrito 🛒');
  return sendMessage(pc, phone, lines.join('\n'));
}

/**
 * AI-powered order parsing — extracts products + quantities from customer free text.
 * Matches against the real product catalog using AI.
 */
async function handleOrderByText(pc, phone, text, state, business) {
  // Fetch available products for AI matching
  const products = await db.getProductsByBusiness(business.id);
  const available = products.filter((p) => p.is_available);

  if (available.length === 0) {
    return sendMessage(pc, phone, '📦 No hay productos disponibles en este momento.');
  }

  let result;
  try {
    result = await extractOrderItems(text, available);
  } catch (error) {
    console.error('🤖 ❌ AI order parsing failed:', error.message);
    return sendMessage(pc, phone,
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
    return sendMessage(pc, phone, msg);
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

  return sendButtons(pc, phone, msg, CART_BUTTONS);
}

// ══════════════════════════════════════
// STEP 2: BUILDING CART
// ══════════════════════════════════════

async function handleBuildingCart(pc, phone, text, state, business) {
  const normalized = text.trim().toUpperCase();

  // Cancel order
  if (normalized === 'CANCELAR') {
    await db.deleteCustomerState(phone, business.id);
    return sendMessage(pc, phone, '❌ Pedido cancelado.');
  }

  // Continue to delivery step
  if (normalized === 'SEGUIR') {
    return advanceToDelivery(pc, phone, state, business);
  }

  // Any other message — remind them to use buttons or reopen their cart
  return sendButtons(pc, phone,
    '⚠️ Si querés agregar más productos, abrí tu carrito desde el catálogo y agregá lo que te falte.\n\n' +
    'Cuando estés listo, tocá *Confirmar pedido*.',
    CART_BUTTONS
  );
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
  lines.push('\nPodés agregar más productos desde el catálogo.');

  return lines.join('\n');
}

/**
 * Handle a native cart order from WhatsApp's built-in cart.
 * Maps catalog items to DB products and creates the cart directly (no AI needed).
 */
async function handleNativeCartOrder(pc, phone, nativeCart, business, profileName, existingState) {
  // Check business hours
  if (!isWithinBusinessHours(business.business_hours)) {
    return sendMessage(pc, phone,
      `🕐 *${business.business_name}* está cerrado en este momento.\n` +
      `⏰ Nuestro horario: ${business.business_hours}\n\n` +
      '¡Volvé cuando estemos abiertos!'
    );
  }

  const products = await db.getProductsByBusiness(business.id);
  const available = products.filter((p) => p.is_available);

  // Start with existing cart if we have one
  const cart = (existingState?.cart || []).filter((item) => !item._order_context);
  const notFound = [];

  const paused = [];
  for (const item of nativeCart.items) {
    const product = available.find((p) => p.retailer_id === item.product_retailer_id);
    if (product) {
      const qty = Math.max(1, Math.round(item.quantity || 1));

      // Merge with existing cart item if present
      const existing = cart.find((c) => c.product_id === product.id);
      if (existing) {
        existing.qty += qty;
        existing.subtotal = existing.price * existing.qty;
      } else {
        cart.push({
          product_id: product.id,
          name: product.name,
          price: Number(product.price),
          qty,
          subtotal: Number(product.price) * qty,
        });
      }
    } else {
      // Check if the product exists but is paused
      const pausedProduct = products.find((p) => p.retailer_id === item.product_retailer_id && !p.is_available);
      if (pausedProduct) {
        paused.push(pausedProduct.name);
      } else {
        notFound.push(item.product_retailer_id);
      }
    }
  }

  if (cart.length === 0) {
    if (paused.length > 0) {
      return sendMessage(pc, phone, `⚠️ ${paused.join(', ')} no está disponible en este momento.\n\nEscribí *MENÚ* para ver los productos disponibles.`);
    }
    return sendMessage(pc, phone, '⚠️ No pudimos procesar tu carrito. Escribí *MENÚ* para ver los productos disponibles.');
  }

  // Create/update customer state with the merged cart
  await db.upsertCustomerState(phone, {
    business_id: business.id,
    current_step: CUSTOMER_STEPS.BUILDING_CART,
    cart,
    selected_zone_id: existingState?.selected_zone_id || null,
    delivery_method: existingState?.delivery_method || null,
  });

  let msg = buildCartDisplay(cart);
  if (paused.length > 0) {
    msg = `⚠️ No disponible: ${paused.join(', ')}\n\n` + msg;
  } else if (notFound.length > 0) {
    msg = `⚠️ Algunos productos no se encontraron.\n\n` + msg;
  }

  return sendButtons(pc, phone, msg, CART_BUTTONS);
}

/**
 * Handle a product selected from the interactive list menu.
 * Adds 1 unit to the cart without AI parsing.
 */
async function handleProductFromList(pc, phone, text, state, business) {
  const productId = text.replace('product_', '');
  const products = await db.getProductsByBusiness(business.id);
  const product = products.find((p) => p.id === productId && p.is_available);

  if (!product) {
    return sendMessage(pc, phone, '⚠️ Producto no disponible. Escribí *MENÚ* para ver los productos.');
  }

  const cart = state.cart || [];
  const existing = cart.find((c) => c.product_id === productId);

  if (existing) {
    existing.qty += 1;
    existing.subtotal = existing.price * existing.qty;
  } else {
    cart.push({
      product_id: product.id,
      name: product.name,
      price: Number(product.price),
      qty: 1,
      subtotal: Number(product.price),
    });
  }

  await db.upsertCustomerState(phone, {
    ...stateFields(state),
    cart,
    current_step: CUSTOMER_STEPS.BUILDING_CART,
  });

  return sendButtons(pc, phone, buildCartDisplay(cart), CART_BUTTONS);
}

const CART_BUTTONS = [
  { id: 'SEGUIR', title: 'Confirmar pedido' },
  { id: 'CANCELAR', title: 'Cancelar' },
];

// ══════════════════════════════════════
// STEP 3: DELIVERY METHOD
// ══════════════════════════════════════

async function advanceToDelivery(pc, phone, state, business) {
  const cart = state.cart || [];
  if (cart.length === 0) {
    await db.updateCustomerStep(phone, CUSTOMER_STEPS.VIEWING_MENU, business.id);
    return sendMessage(pc, phone,
      '⚠️ Tu carrito está vacío.\n' +
      'Escribí *MENÚ* para ver nuestros productos o decinos qué querés pedir.'
    );
  }

  const hasDelivery = business.has_delivery;
  const hasPickup = business.has_pickup;

  // Both options
  if (hasDelivery && hasPickup) {
    await db.updateCustomerStep(phone, CUSTOMER_STEPS.DELIVERY_METHOD, business.id);
    const address = business.business_address ? `\n📍 ${business.business_address}` : '';
    return sendButtons(pc, phone,
      `🚚 ¿Cómo querés recibir tu pedido?`,
      [
        { id: '1', title: 'Delivery' },
        { id: '2', title: 'Retiro en local' },
      ]
    );
  }

  // Delivery only → go to zone selection
  if (hasDelivery) {
    await db.upsertCustomerState(phone, {
      ...stateFields(state),
      delivery_method: 'delivery',
      current_step: CUSTOMER_STEPS.DELIVERY_ZONE,
    });
    return showDeliveryZones(pc, phone, business.id);
  }

  // Pickup only → skip to payment
  await db.upsertCustomerState(phone, {
    ...stateFields(state),
    delivery_method: 'pickup',
    current_step: CUSTOMER_STEPS.PAYMENT_METHOD,
  });
  return showOrderSummaryAndPayment(pc, phone, state, business, 'pickup', null);
}

async function handleCustomerDeliveryMethod(pc, phone, text, state, business) {
  const option = text.trim();
  const normalized = option.toUpperCase();

  if (normalized === 'CANCELAR') {
    await db.deleteCustomerState(phone, business.id);
    return sendMessage(pc, phone, '❌ Pedido cancelado.');
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
    return showDeliveryZones(pc, phone, business.id);
  }

  if (isPickup) {
    await db.upsertCustomerState(phone, {
      ...stateFields(state),
      delivery_method: 'pickup',
      current_step: CUSTOMER_STEPS.PAYMENT_METHOD,
    });
    return showOrderSummaryAndPayment(pc, phone, state, business, 'pickup', null);
  }

  const address = business.business_address ? `\n📍 ${business.business_address}` : '';
  return sendButtons(pc, phone,
    `⚠️ Elegí una opción:${address}`,
    [
      { id: '1', title: 'Delivery' },
      { id: '2', title: 'Retiro en local' },
    ]
  );
}

// ══════════════════════════════════════
// STEP 4: DELIVERY ZONE
// ══════════════════════════════════════

async function showDeliveryZones(pc, phone, businessId) {
  const zones = await db.getZonesByBusiness(businessId);

  if (zones.length === 0) {
    return sendMessage(pc, phone, '⚠️ No hay zonas de delivery configuradas. Contactá al local.');
  }

  return sendList(pc, phone,
    '🚚 ¿En qué zona estás?\n\nEscribí *CANCELAR* para cancelar el pedido.',
    'Ver zonas',
    [
      {
        title: 'Zonas de delivery',
        rows: zones.map((z, i) => ({
          id: String(i + 1),
          title: z.zone_name,
          description: `$${z.price}`,
        })),
      },
    ]
  );
}

async function handleCustomerDeliveryZone(pc, phone, text, state, business) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.deleteCustomerState(phone, business.id);
    return sendMessage(pc, phone, '❌ Pedido cancelado.');
  }

  const zones = await db.getZonesByBusiness(business.id);
  const num = parseInt(text.trim(), 10);

  if (isNaN(num) || num < 1 || num > zones.length) {
    return sendMessage(pc, phone, `⚠️ Elegí un número del 1 al ${zones.length}.\nEscribí *CANCELAR* para cancelar el pedido.`);
  }

  const selectedZone = zones[num - 1];

  await db.upsertCustomerState(phone, {
    ...stateFields(state),
    selected_zone_id: selectedZone.id,
    current_step: CUSTOMER_STEPS.DELIVERY_ADDRESS,
  });

  return sendMessage(pc, phone, '📍 Escribí tu dirección de entrega.\nEj: _"San Martín 450, 2do piso B"_\n\nEscribí *CANCELAR* para cancelar el pedido.');
}

// ══════════════════════════════════════
// STEP 5: DELIVERY ADDRESS
// ══════════════════════════════════════

async function handleCustomerDeliveryAddress(pc, phone, text, state, business) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.deleteCustomerState(phone, business.id);
    return sendMessage(pc, phone, '❌ Pedido cancelado.');
  }

  if (!text || text.trim().length === 0 || text === '__LOCATION__') {
    return sendMessage(pc, phone, '⚠️ Necesito tu dirección para el delivery.\n\nEscribí tu dirección, ej: _"San Martín 450, 2do piso B"_\nEscribí *CANCELAR* para cancelar el pedido.');
  }

  const address = text.trim();

  await db.updateCustomerStep(phone, CUSTOMER_STEPS.PAYMENT_METHOD, business.id);

  const updatedState = await db.getCustomerState(phone, business.id);
  return showOrderSummaryAndPayment(pc, phone, updatedState, business, 'delivery', address);
}

// ══════════════════════════════════════
// STEP 6: ORDER SUMMARY + PAYMENT
// ══════════════════════════════════════

async function showOrderSummaryAndPayment(pc, phone, state, business, method, address) {
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
  const paymentOptions = [];
  let optionNum = 1;

  if (business.accepts_cash) {
    const desc = method === 'pickup' ? 'Pagás al retirar' : 'Pagás al recibir';
    paymentOptions.push({ num: optionNum, method: 'cash', label: 'Efectivo', description: desc });
    optionNum++;
  }

  if (business.accepts_transfer) {
    paymentOptions.push({ num: optionNum, method: 'transfer', label: 'Transferencia', description: `Total: $${formatPrice(grandTotal)}` });
    optionNum++;
  }

  if (business.accepts_deposit && business.deposit_percent) {
    const depositAmount = Math.ceil(grandTotal * business.deposit_percent / 100);
    paymentOptions.push({ num: optionNum, method: 'deposit', label: `Seña ${business.deposit_percent}%`, description: `$${formatPrice(depositAmount)}` });
    optionNum++;
  }

  // Store order context in cart metadata for next step
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
  await db.updateCustomerCart(phone, cartWithContext, business.id);

  lines.push('\n💳 *¿Cómo querés pagar?*');

  // If only 1 payment option, use buttons; otherwise use list
  if (paymentOptions.length === 1) {
    return sendButtons(pc, phone, lines.join('\n'),
      [{ id: String(paymentOptions[0].num), title: paymentOptions[0].label }]
    );
  }

  return sendList(pc, phone, lines.join('\n'), 'Elegir pago',
    [
      {
        title: 'Métodos de pago',
        rows: paymentOptions.map((o) => ({
          id: String(o.num),
          title: o.label,
          ...(o.description && { description: o.description }),
        })),
      },
    ]
  );
}

// ══════════════════════════════════════
// STEP 7: PAYMENT METHOD
// ══════════════════════════════════════

async function handleCustomerPaymentMethod(pc, phone, text, state, business) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.deleteCustomerState(phone, business.id);
    return sendMessage(pc, phone, '❌ Pedido cancelado.');
  }

  const cart = state.cart || [];
  const contextItem = cart.find((item) => item._order_context);

  if (!contextItem) {
    // Lost context — restart
    await db.deleteCustomerState(phone, business.id);
    return sendMessage(pc, phone, '⚠️ Algo salió mal. Escribí *HOLA* para empezar de nuevo.');
  }

  const { payment_options, grand_total } = contextItem;
  const num = parseInt(text.trim(), 10);

  const selected = payment_options.find((o) => o.num === num);
  if (!selected) {
    return sendMessage(pc, phone, `⚠️ Elegí una opción del 1 al ${payment_options.length}.\nEscribí *CANCELAR* para cancelar el pedido.`);
  }

  // If transfer or deposit → show bank details
  if (selected.method === 'transfer' || selected.method === 'deposit') {
    const bank = await db.getBankDetails(business.id);
    if (!bank) {
      return sendMessage(pc, phone, '⚠️ No hay datos bancarios configurados. Contactá al local.');
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
    await db.updateCustomerCart(phone, updatedCart, business.id);
    await db.updateCustomerStep(phone, CUSTOMER_STEPS.AWAITING_TRANSFER, business.id);

    return sendButtons(pc, phone,
      '🏦 *Datos para transferir:*\n' +
      `• Alias: ${bank.alias}\n` +
      `• CBU: ${bank.cbu}\n` +
      `• Titular: ${bank.account_holder}\n\n` +
      amountText + '\n\n' +
      'Cuando hayas transferido, tocá *Ya transferí*.',
      [
        { id: 'LISTO', title: 'Ya transferí' },
        { id: 'CANCELAR', title: 'Cancelar pedido' },
      ]
    );
  }

  // Cash payment — confirm order directly
  const updatedCart = cart.map((item) =>
    item._order_context ? { ...item, selected_payment: 'cash' } : item
  );
  await db.updateCustomerCart(phone, updatedCart, business.id);
  return confirmAndSaveOrder(pc, phone, state, business);
}

// ══════════════════════════════════════
// STEP 8: AWAITING TRANSFER
// ══════════════════════════════════════

async function handleAwaitingTransfer(pc, phone, text, state, business) {
  const normalized = text.trim().toUpperCase();

  if (normalized === 'LISTO') {
    return confirmAndSaveOrder(pc, phone, state, business);
  }

  if (normalized === 'CANCELAR') {
    await db.deleteCustomerState(phone, business.id);
    return sendMessage(pc, phone,
      '❌ Pedido cancelado.\n\n' +
      'Si querés hacer un nuevo pedido, escribí *MENÚ* o decinos qué querés pedir.'
    );
  }

  return sendButtons(pc, phone,
    'Cuando hayas transferido, tocá *Ya transferí*.',
    [
      { id: 'LISTO', title: 'Ya transferí' },
      { id: 'CANCELAR', title: 'Cancelar pedido' },
    ]
  );
}

// ══════════════════════════════════════
// ORDER CONFIRMATION + SAVE
// ══════════════════════════════════════

async function confirmAndSaveOrder(pc, phone, state, business) {
  const cart = state.cart || [];
  const contextItem = cart.find((item) => item._order_context);

  if (!contextItem) {
    await db.deleteCustomerState(phone, business.id);
    return sendMessage(pc, phone, '⚠️ Algo salió mal. Escribí *HOLA* para empezar de nuevo.');
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
  await db.updateCustomerStep(phone, CUSTOMER_STEPS.ORDER_CONFIRMED, business.id);

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

  await sendMessage(pc, phone, lines.join('\n'));

  // Notify admin
  await notifyAdminNewOrder(pc, order, realItems, contextItem, business, phone, paymentMethod, depositAmount);

  return;
}

async function notifyAdminNewOrder(pc, order, items, context, business, clientPhone, paymentMethod, depositAmount) {
  const adminPhone = business.admin_phone;

  const now = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const lines = [`🔔 *Nuevo pedido #${order.order_number}*\n`];
  lines.push(`📱 Cliente: ${clientPhone}`);
  lines.push(`🕐 ${now}`);

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
    await sendMessage(pc, adminPhone, lines.join('\n'));
    console.log(`📩 Admin notified about order #${order.order_number}`);
  } catch (error) {
    console.error(`❌ Failed to notify admin about order #${order.order_number}:`, error.message);
  }
}

// ══════════════════════════════════════
// CUSTOMER COMMANDS (ESTADO / CANCELAR)
// ══════════════════════════════════════

async function handleCustomerStatusCheck(pc, phone, orderNumber, business) {
  const order = await db.getOrderByClientAndNumber(phone, orderNumber, business.id);
  if (!order) {
    return sendMessage(pc, phone, `⚠️ No encontré el pedido #${orderNumber}.`);
  }

  const isConfirmed = order.payment_status === 'confirmed';
  const isCancelled = order.order_status === 'cancelado';

  let label;
  if (isCancelled) {
    label = 'Cancelado ❌';
  } else if (isConfirmed) {
    label = 'Confirmado ✅';
  } else {
    label = 'Pendiente ⏳';
  }

  return sendMessage(pc, phone, `Pedido #${orderNumber} — Estado: *${label}*`);
}

async function handleCustomerCancelOrder(pc, phone, orderNumber, business) {
  const order = await db.getOrderByClientAndNumber(phone, orderNumber, business.id);
  if (!order) {
    return sendMessage(pc, phone, `⚠️ No encontré el pedido #${orderNumber}.`);
  }

  if (order.order_status !== 'nuevo') {
    const statusLabels = {
      preparando: 'en preparación',
      en_camino: 'en camino',
      entregado: 'entregado',
      cancelado: 'cancelado',
    };
    const label = statusLabels[order.order_status] || order.order_status;
    return sendMessage(pc, phone,
      `⚠️ El pedido #${orderNumber} ya está *${label}* y no se puede cancelar.\n` +
      'Si necesitás ayuda, contactá al local.'
    );
  }

  await db.updateOrderStatus(order.id, 'cancelado');
  await sendMessage(pc, phone, `❌ Pedido #${orderNumber} cancelado.`);

  // Notify admin
  try {
    await sendMessage(pc, business.admin_phone,
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
