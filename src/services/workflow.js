const db = require('./database');
const ollama = require('./ollama');
const { tryRegister } = require('./registration');
const { sendMessage } = require('./twilio');
const { processCustomerMessage } = require('./customer-workflow');
const { config, STEPS, PAYMENT_OPTIONS, getPaymentLabel } = require('../config');
const { parseCommand } = require('../utils/commands');

const CUSTOMER_MSG = 'El negocio se está configurando, volvé pronto.';

/**
 * Main orchestration — routes every incoming message to the right handler.
 */
async function processMessage(message) {
  const { from, text, profileName } = message;
  console.log(`\n🔄 processMessage: from=${from}, text="${text}"`);

  const admin = await db.findAdmin(from);
  console.log(`👤 Admin lookup: ${admin ? `found (${admin.name})` : 'not found'}`);

  if (admin) {
    const state = await db.getUserState(from);
    console.log(`📍 User state: ${state ? `step=${state.current_step}, business=${state.business_id}` : 'no state'}`);

    if (!state) {
      console.log('⚠️  Admin exists but no state — sending customer message');
      return sendMessage(from, CUSTOMER_MSG);
    }

    if (state.current_step === STEPS.COMPLETED) {
      console.log('🎯 Routing to command handler');
      return handleCommand(from, text, state.business_id);
    }

    console.log(`🎯 Routing to step handler: ${state.current_step}`);
    return handleStep(from, text, state);
  }

  // Not an admin — try registration first
  console.log('🆕 Not an admin — trying registration...');
  const result = await tryRegister(from, text, profileName);
  console.log(`🆕 Registration result: ${JSON.stringify({ success: result.success, isCode: result.isCode })}`);

  if (result.isCode) {
    return sendMessage(from, result.message);
  }

  // Not a code — check if there's an active business for customer ordering
  const activeBusiness = await db.getActiveBusiness();
  if (activeBusiness) {
    console.log(`🛒 Active business found: ${activeBusiness.business_name} — routing to customer flow`);
    return processCustomerMessage(message, activeBusiness);
  }

  console.log('⚠️  No active business — sending "volvé pronto"');
  return sendMessage(from, CUSTOMER_MSG);
}

// ══════════════════════════════════════
// STEP ROUTER (onboarding + edit mode)
// ══════════════════════════════════════

async function handleStep(phone, text, state) {
  const { current_step, business_id } = state;

  switch (current_step) {
    // ── Onboarding steps ──
    case STEPS.BUSINESS_NAME:
      return handleBusinessName(phone, text, business_id);
    case STEPS.BUSINESS_HOURS:
      return handleBusinessHours(phone, text, business_id);
    case STEPS.BUSINESS_HOURS_CONFIRM:
      return handleBusinessHoursConfirm(phone, text, business_id);
    case STEPS.DELIVERY_METHOD:
      return handleDeliveryMethod(phone, text, business_id);
    case STEPS.PICKUP_ADDRESS:
      return handlePickupAddress(phone, text, business_id);
    case STEPS.PAYMENT_METHODS:
      return handlePaymentMethods(phone, text, business_id);
    case STEPS.DEPOSIT_PERCENT:
      return handleDepositPercent(phone, text, business_id);
    case STEPS.DELIVERY_ZONES:
      return handleDeliveryZones(phone, text, business_id);
    case STEPS.DELIVERY_ZONES_CONFIRM:
      return handleDeliveryZonesConfirm(phone, text, business_id);
    case STEPS.BANK_DATA:
      return handleBankData(phone, text, business_id);
    case STEPS.BANK_DATA_CONFIRM:
      return handleBankDataConfirm(phone, text, business_id);
    case STEPS.PRODUCTS:
      return handleProducts(phone, text, business_id);
    case STEPS.REVIEW:
      return handleReview(phone, text, business_id);

    // ── Edit-mode steps (post-onboarding) ──
    case STEPS.EDIT_NAME:
      return handleEditName(phone, text, business_id);
    case STEPS.EDIT_HOURS:
      return handleEditHours(phone, text, business_id);
    case STEPS.EDIT_HOURS_CONFIRM:
      return handleEditHoursConfirm(phone, text, business_id);
    case STEPS.EDIT_DELIVERY:
      return handleEditDelivery(phone, text, business_id);
    case STEPS.EDIT_ADDRESS:
      return handleEditAddress(phone, text, business_id);
    case STEPS.EDIT_PAYMENTS:
      return handleEditPayments(phone, text, business_id);
    case STEPS.EDIT_DEPOSIT_PERCENT:
      return handleEditDepositPercent(phone, text, business_id);
    case STEPS.EDIT_ZONES:
      return handleEditZones(phone, text, business_id);
    case STEPS.EDIT_ZONES_CONFIRM:
      return handleEditZonesConfirm(phone, text, business_id);
    case STEPS.EDIT_BANK:
      return handleEditBank(phone, text, business_id);
    case STEPS.EDIT_BANK_CONFIRM:
      return handleEditBankConfirm(phone, text, business_id);
    case STEPS.EDIT_PRODUCTS:
      return handleEditProducts(phone, text, business_id);
    case STEPS.DELETE_PRODUCT:
      return handleDeleteProduct(phone, text, business_id);
    case STEPS.PAUSE_PRODUCT:
      return handlePauseProduct(phone, text, business_id);

    default:
      return sendMessage(phone, '⚠️ Estado desconocido. Escribí *AYUDA*.');
  }
}

// ══════════════════════════════════════
// ONBOARDING STEP HANDLERS (Steps 1-8)
// ══════════════════════════════════════

// ── Step 1: Business Name ──

async function handleBusinessName(phone, text, businessId) {
  if (!text || text.trim().length === 0) {
    return sendMessage(phone, '⚠️ El nombre no puede estar vacío. ¿Cuál es el nombre de tu negocio?');
  }

  const name = text.trim();
  await db.updateBusiness(businessId, { business_name: name });
  await db.updateUserStep(phone, STEPS.BUSINESS_HOURS);

  return sendMessage(phone,
    `✅ Nombre guardado: *${name}*\n\n` +
    '**Paso 2 de 8** — ¿Cuál es tu horario de atención?\n' +
    'Ej: Lunes a Viernes 11:00-23:00, Sábados 12:00-24:00'
  );
}

// ── Step 2: Business Hours (AI) ──

async function handleBusinessHours(phone, text, businessId) {
  const parsed = await parseHours(text);
  if (!parsed) {
    return sendMessage(phone,
      '🤔 No pude interpretar el horario. Probá con un formato como:\n' +
      '"Lunes a Viernes 11:00-23:00, Sábados 12:00-24:00"'
    );
  }

  await db.updateBusiness(businessId, { business_hours: parsed });
  await db.updateUserStep(phone, STEPS.BUSINESS_HOURS_CONFIRM);

  return sendMessage(phone,
    `✅ Horario guardado:\n*${parsed}*\n\n` +
    '¿Está bien? Respondé *SÍ* para continuar o escribí el horario de nuevo.'
  );
}

async function handleBusinessHoursConfirm(phone, text, businessId) {
  if (isYes(text)) {
    await db.updateUserStep(phone, STEPS.DELIVERY_METHOD);
    return sendMessage(phone,
      '**Paso 3 de 8** — ¿Cómo entregás los pedidos?\n\n' +
      '1️⃣ Delivery\n2️⃣ Retiro en local\n3️⃣ Ambos'
    );
  }
  await db.updateUserStep(phone, STEPS.BUSINESS_HOURS);
  return handleBusinessHours(phone, text, businessId);
}

// ── Step 3: Delivery / Pickup ──

async function handleDeliveryMethod(phone, text, businessId) {
  const option = text.trim();

  if (option === '1') {
    await db.updateBusiness(businessId, { has_delivery: true, has_pickup: false });
    await db.updateUserStep(phone, STEPS.PAYMENT_METHODS);
    return sendMessage(phone, '✅ Configuración guardada: solo delivery.\n\n' + paymentMethodsPrompt());
  }
  if (option === '2') {
    await db.updateBusiness(businessId, { has_delivery: false, has_pickup: true });
    await db.updateUserStep(phone, STEPS.PICKUP_ADDRESS);
    return sendMessage(phone, '¿Cuál es la dirección de tu local?');
  }
  if (option === '3') {
    await db.updateBusiness(businessId, { has_delivery: true, has_pickup: true });
    await db.updateUserStep(phone, STEPS.PICKUP_ADDRESS);
    return sendMessage(phone, '¿Cuál es la dirección de tu local? (para retiro en local)');
  }
  return sendMessage(phone, '⚠️ Elegí una opción:\n\n1️⃣ Delivery\n2️⃣ Retiro en local\n3️⃣ Ambos');
}

// ── Step 3b: Pickup Address ──

async function handlePickupAddress(phone, text, businessId) {
  if (!text || text.trim().length === 0) {
    return sendMessage(phone, '⚠️ La dirección no puede estar vacía. ¿Cuál es la dirección de tu local?');
  }

  const address = text.trim();
  const business = await db.getBusinessByPhone(phone);
  await db.updateBusiness(businessId, { business_address: address });
  await db.updateUserStep(phone, STEPS.PAYMENT_METHODS);

  const lines = [];
  if (business.has_delivery) lines.push('• 🚚 Delivery: Sí');
  if (business.has_pickup) lines.push('• 🏪 Retiro en local: Sí');
  lines.push(`• 📍 Dirección: ${address}`);

  return sendMessage(phone,
    '✅ Configuración de entrega guardada:\n' + lines.join('\n') + '\n\n' + paymentMethodsPrompt()
  );
}

// ── Step 4: Payment Methods ──

function paymentMethodsPrompt() {
  return '**Paso 4 de 8** — ¿Qué métodos de pago aceptás?\n\n' +
    '1️⃣ Solo efectivo\n2️⃣ Solo transferencia bancaria\n' +
    '3️⃣ Ambos (efectivo y transferencia)\n4️⃣ Ambos + seña (depósito parcial por transferencia)';
}

async function handlePaymentMethods(phone, text, businessId) {
  const selected = PAYMENT_OPTIONS[text.trim()];
  if (!selected) {
    return sendMessage(phone,
      '⚠️ Elegí una opción del 1 al 4:\n\n' +
      '1️⃣ Solo efectivo\n2️⃣ Solo transferencia bancaria\n' +
      '3️⃣ Ambos (efectivo y transferencia)\n4️⃣ Ambos + seña (depósito parcial por transferencia)'
    );
  }

  const { label, ...fields } = selected;
  await db.updateBusiness(businessId, fields);

  // If option 4 (with deposit), ask for percentage
  if (text.trim() === '4') {
    await db.updateUserStep(phone, STEPS.DEPOSIT_PERCENT);
    return sendMessage(phone,
      `✅ Métodos de pago: *${label}*\n\n` +
      '¿Qué porcentaje de seña pedís? (ej: 30, 50)\n' +
      'Esto es lo que el cliente paga por adelantado via transferencia.'
    );
  }

  return advanceAfterPayment(phone, businessId, label);
}

async function handleDepositPercent(phone, text, businessId) {
  const num = parseInt(text.trim(), 10);
  if (isNaN(num) || num < 1 || num > 100) {
    return sendMessage(phone, '⚠️ Ingresá un número entre 1 y 100 (ej: 30, 50):');
  }

  await db.updateBusiness(businessId, { deposit_percent: num });
  const business = await db.getBusinessByPhone(phone);
  const label = getPaymentLabel(business);
  return advanceAfterPayment(phone, businessId, label);
}

async function advanceAfterPayment(phone, businessId, label) {
  const business = await db.getBusinessByPhone(phone);

  if (business.has_delivery) {
    await db.updateUserStep(phone, STEPS.DELIVERY_ZONES);
    return sendMessage(phone,
      `✅ Métodos de pago guardados: *${label}*\n\n` +
      '**Paso 5 de 8** — Escribí tus zonas de delivery con el precio de cada una.\n' +
      'Ej: Centro $500, Norte $800, Macrocentro $600'
    );
  }

  await db.updateUserStep(phone, STEPS.BANK_DATA);
  return sendMessage(phone, `✅ Métodos de pago guardados: *${label}*\n\n` + bankDataPrompt());
}

// ── Step 5: Delivery Zones (AI) ──

async function handleDeliveryZones(phone, text, businessId) {
  const zones = await parseZones(text);
  if (!zones) {
    return sendMessage(phone, '⚠️ Necesito el precio para cada zona. Probá así:\n"Centro $500, Almagro $600, Caballito $800"');
  }
  await db.replaceZones(businessId, zones);
  await db.updateUserStep(phone, STEPS.DELIVERY_ZONES_CONFIRM);
  const zoneLines = zones.map((z) => `• ${z.zone_name} — $${z.price}`).join('\n');
  return sendMessage(phone, `✅ Zonas de delivery guardadas:\n${zoneLines}\n\n¿Está bien? Respondé *SÍ* para continuar o escribí las zonas de nuevo.`);
}

async function handleDeliveryZonesConfirm(phone, text, businessId) {
  if (isYes(text)) {
    await db.updateUserStep(phone, STEPS.BANK_DATA);
    return sendMessage(phone, bankDataPrompt());
  }
  await db.updateUserStep(phone, STEPS.DELIVERY_ZONES);
  return handleDeliveryZones(phone, text, businessId);
}

// ── Step 6: Bank Data (AI) ──

function bankDataPrompt() {
  return '**Paso 6 de 8** — Necesito tus datos bancarios para los cobros:\n• Alias\n• CBU/CVU\n• Titular de la cuenta';
}

async function handleBankData(phone, text, businessId) {
  const result = await parseBankData(text);
  if (!result) return sendMessage(phone, '⚠️ No pude interpretar los datos. Enviá todos los datos juntos:\nAlias, CBU/CVU y Titular.');

  const missing = [];
  if (!result.alias) missing.push('• Alias');
  if (!result.cbu) missing.push('• CBU/CVU');
  if (!result.account_holder) missing.push('• Titular de la cuenta');

  if (missing.length > 0) {
    return sendMessage(phone, '⚠️ Faltan datos obligatorios:\n' + missing.join('\n') + '\n\nEnviá todos los datos juntos:\nAlias, CBU/CVU y Titular.');
  }

  await db.upsertBankDetails(businessId, result);
  await db.updateUserStep(phone, STEPS.BANK_DATA_CONFIRM);

  return sendMessage(phone,
    '✅ Datos bancarios guardados:\n' +
    `• Alias: ${result.alias}\n• CBU: ${result.cbu}\n• Titular: ${result.account_holder}\n\n` +
    '¿Está bien? Respondé *SÍ* para continuar o escribí los datos de nuevo.'
  );
}

async function handleBankDataConfirm(phone, text, businessId) {
  if (isYes(text)) {
    await db.updateUserStep(phone, STEPS.PRODUCTS);
    return sendMessage(phone,
      '**Paso 7 de 8** — Ahora vamos a cargar tu menú.\n' +
      'Describí tus productos y yo los organizo.\n' +
      'Ej: "Pizza Muzzarella grande $5500, muzzarella y salsa de tomate, categoría Pizzas"\n\n' +
      'Cuando termines, escribí *LISTO*.'
    );
  }
  await db.updateUserStep(phone, STEPS.BANK_DATA);
  return handleBankData(phone, text, businessId);
}

// ── Step 7: Products (AI + loop) ──

async function handleProducts(phone, text, businessId) {
  if (text.trim().toUpperCase() === 'LISTO') {
    const products = await db.getProductsByBusiness(businessId);
    if (products.length === 0) {
      return sendMessage(phone, '⚠️ Necesitás cargar al menos un producto antes de continuar.\nDescribí tus productos o escribí *LISTO* cuando termines.');
    }
    await db.updateUserStep(phone, STEPS.REVIEW);
    return sendMessage(phone, await buildReviewSummary(businessId));
  }
  return addProductsFromText(phone, text, businessId, 'Seguí agregando o escribí *LISTO*.');
}

// ── Step 8: Review & Activate ──

async function buildReviewSummary(businessId) {
  const business = await db.getBusinessById(businessId);
  const zones = await db.getZonesByBusiness(businessId);
  const bank = await db.getBankDetails(businessId);
  const products = await db.getProductsByBusiness(businessId);

  const lines = ['📋 **Paso 8 de 8 — Resumen de tu negocio:**\n'];
  lines.push(`🏪 *${business.business_name}*`);
  lines.push(`⏰ ${business.business_hours}`);
  if (business.business_address) lines.push(`📍 ${business.business_address}`);
  if (zones.length > 0) {
    lines.push(`🚚 Delivery: ${zones.map((z) => `${z.zone_name} $${z.price}`).join(' · ')}`);
  }
  lines.push(`💳 Pagos: ${getPaymentLabel(business)}`);
  if (bank) lines.push(`🏦 Alias: ${bank.alias} · Titular: ${bank.account_holder}`);

  if (products.length > 0) {
    lines.push(`\n📦 **Menú (${products.length} productos):**`);
    const grouped = {};
    for (const p of products) {
      const cat = p.category || 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    }
    for (const [cat, items] of Object.entries(grouped)) {
      lines.push(`*${cat}:* ${items.map((i) => `${i.name} $${i.price}`).join(', ')}`);
    }
  }

  lines.push('\n¿Está todo bien?');
  lines.push('Respondé *CONFIRMAR* para activar o *EDITAR* para modificar algo.');
  return lines.join('\n');
}

async function handleReview(phone, text, businessId) {
  const normalized = text.trim().toUpperCase();

  if (normalized === 'CONFIRMAR') {
    await db.updateBusiness(businessId, { is_active: true });
    await db.updateUserStep(phone, STEPS.COMPLETED);
    const business = await db.getBusinessByPhone(phone);
    return sendMessage(phone,
      '🎉 *¡Tu negocio está activo!*\n\n' +
      `${business.business_name} ya está listo para recibir pedidos.\n\n` +
      'Podés modificar tu configuración en cualquier momento.\nEscribí *AYUDA* para ver los comandos disponibles.'
    );
  }

  if (normalized === 'EDITAR') {
    return sendMessage(phone, editMenuPrompt());
  }

  // Handle edit selection (1-7)
  const editMap = { '1': STEPS.BUSINESS_NAME, '2': STEPS.BUSINESS_HOURS, '3': STEPS.DELIVERY_METHOD, '4': STEPS.PAYMENT_METHODS, '5': STEPS.DELIVERY_ZONES, '6': STEPS.BANK_DATA, '7': STEPS.PRODUCTS };
  const editPrompts = {
    '1': '¿Cuál es el nuevo nombre de tu negocio?',
    '2': '¿Cuál es tu nuevo horario de atención?\nEj: Lunes a Viernes 11:00-23:00, Sábados 12:00-24:00',
    '3': '¿Cómo entregás los pedidos?\n\n1️⃣ Delivery\n2️⃣ Retiro en local\n3️⃣ Ambos',
    '4': '¿Qué métodos de pago aceptás?\n\n1️⃣ Solo efectivo\n2️⃣ Solo transferencia bancaria\n3️⃣ Ambos (efectivo y transferencia)\n4️⃣ Ambos + seña (depósito parcial por transferencia)',
    '5': 'Escribí tus zonas de delivery con el precio de cada una.\nEj: Centro $500, Norte $800, Macrocentro $600',
    '6': 'Necesito tus datos bancarios:\n• Alias\n• CBU/CVU\n• Titular de la cuenta',
    '7': '📦 Entraste en modo edición de menú.\nEscribí nuevos productos para agregar, o *LISTO* para volver al resumen.',
  };

  const option = text.trim();
  if (editMap[option]) {
    await db.updateUserStep(phone, editMap[option]);
    return sendMessage(phone, editPrompts[option]);
  }

  return sendMessage(phone, 'Respondé *CONFIRMAR* para activar o *EDITAR* para modificar algo.');
}

function editMenuPrompt() {
  return '¿Qué querés modificar?\n\n' +
    '1️⃣ Nombre\n2️⃣ Horario\n3️⃣ Entrega (delivery/retiro)\n' +
    '4️⃣ Métodos de pago\n5️⃣ Zonas de delivery\n6️⃣ Datos bancarios\n7️⃣ Menú (productos)';
}

// ══════════════════════════════════════
// POST-ONBOARDING COMMAND HANDLER
// ══════════════════════════════════════

async function handleCommand(phone, text, businessId) {
  const parsed = parseCommand(text);

  if (!parsed) {
    return sendMessage(phone, '👋 ¡Hola! Escribí *AYUDA* para ver los comandos disponibles.');
  }

  const business = await db.getBusinessById(businessId);

  switch (parsed.command) {
    case 'AYUDA':
      return sendMessage(phone, helpText());

    case 'EDIT_NAME': {
      await db.updateUserStep(phone, STEPS.EDIT_NAME);
      return sendMessage(phone, `Tu nombre actual es: *${business.business_name}*\n\nEscribí el nuevo nombre:`);
    }
    case 'EDIT_HOURS': {
      await db.updateUserStep(phone, STEPS.EDIT_HOURS);
      return sendMessage(phone, `Tu horario actual: *${business.business_hours}*\n\nEscribí el nuevo horario:`);
    }
    case 'EDIT_ADDRESS': {
      await db.updateUserStep(phone, STEPS.EDIT_ADDRESS);
      return sendMessage(phone, `Tu dirección actual: *${business.business_address || 'No configurada'}*\n\nEscribí la nueva dirección:`);
    }
    case 'EDIT_DELIVERY': {
      await db.updateUserStep(phone, STEPS.EDIT_DELIVERY);
      const lines = ['Tu configuración actual:'];
      lines.push(`• 🚚 Delivery: ${business.has_delivery ? 'Sí' : 'No'}`);
      lines.push(`• 🏪 Retiro en local: ${business.has_pickup ? 'Sí' : 'No'}`);
      if (business.business_address) lines.push(`• 📍 Dirección: ${business.business_address}`);
      lines.push('\n¿Cómo entregás los pedidos?\n\n1️⃣ Delivery\n2️⃣ Retiro en local\n3️⃣ Ambos');
      return sendMessage(phone, lines.join('\n'));
    }
    case 'EDIT_PAYMENTS': {
      await db.updateUserStep(phone, STEPS.EDIT_PAYMENTS);
      return sendMessage(phone,
        `Tu configuración actual: *${getPaymentLabel(business)}*\n\n` +
        '¿Qué métodos de pago aceptás?\n\n' +
        '1️⃣ Solo efectivo\n2️⃣ Solo transferencia bancaria\n' +
        '3️⃣ Ambos (efectivo y transferencia)\n4️⃣ Ambos + seña (depósito parcial por transferencia)'
      );
    }
    case 'EDIT_ZONES': {
      await db.updateUserStep(phone, STEPS.EDIT_ZONES);
      const zones = await db.getZonesByBusiness(businessId);
      let msg = '';
      if (zones.length > 0) {
        msg = 'Tus zonas actuales:\n' + zones.map((z) => `• ${z.zone_name} — $${z.price}`).join('\n') + '\n\n';
      }
      msg += 'Escribí las zonas de nuevo (esto reemplaza todas las zonas anteriores):';
      return sendMessage(phone, msg);
    }
    case 'EDIT_BANK': {
      await db.updateUserStep(phone, STEPS.EDIT_BANK);
      const bank = await db.getBankDetails(businessId);
      let msg = '';
      if (bank) {
        msg = 'Tus datos bancarios actuales:\n' +
          `• Alias: ${bank.alias}\n• CBU: ${bank.cbu}\n• Titular: ${bank.account_holder}\n\n`;
      }
      msg += 'Enviá los nuevos datos (alias, CBU/CVU y titular):';
      return sendMessage(phone, msg);
    }
    case 'EDIT_PRODUCTS':
    case 'ADD_PRODUCT': {
      await db.updateUserStep(phone, STEPS.EDIT_PRODUCTS);
      const addMsg = parsed.command === 'ADD_PRODUCT'
        ? 'Describí los productos que querés agregar.\nEj: "Milanesa napolitana $7500, categoría Platos principales"\n\nCuando termines, escribí *LISTO*.'
        : await buildProductListForEdit(businessId);
      return sendMessage(phone, addMsg);
    }
    case 'DELETE_PRODUCT': {
      await db.updateUserStep(phone, STEPS.DELETE_PRODUCT);
      const products = await db.getProductsByBusiness(businessId);
      if (products.length === 0) {
        await db.updateUserStep(phone, STEPS.COMPLETED);
        return sendMessage(phone, '📦 Tu menú está vacío.');
      }
      const list = products.map((p, i) => `${i + 1}. ${p.name} — $${p.price} (${p.category || 'General'}) ${p.is_available ? '✔️' : '⏸️'}`).join('\n');
      return sendMessage(phone, `📦 Tu menú:\n${list}\n\nRespondé con el número del producto a eliminar (ej: *3*):`);
    }
    case 'PAUSE_PRODUCT': {
      await db.updateUserStep(phone, STEPS.PAUSE_PRODUCT);
      const products = await db.getProductsByBusiness(businessId);
      if (products.length === 0) {
        await db.updateUserStep(phone, STEPS.COMPLETED);
        return sendMessage(phone, '📦 Tu menú está vacío.');
      }
      const list = products.map((p, i) => `${i + 1}. ${p.name} — $${p.price} (${p.category || 'General'}) ${p.is_available ? '✔️' : '⏸️'}`).join('\n');
      return sendMessage(phone, `📦 Tu menú:\n${list}\n\nRespondé con el número del producto a pausar/activar:`);
    }
    case 'VIEW_MENU':
      return sendMessage(phone, await buildViewMenu(businessId));
    case 'VIEW_BUSINESS':
      return sendMessage(phone, await buildViewBusiness(businessId));

    // ── Order management commands (Phase 12) ──
    case 'VIEW_ORDERS':
      return handleViewOrders(phone, businessId);
    case 'VIEW_ORDER':
      return handleViewOrder(phone, businessId, parsed.args.orderNumber);
    case 'ORDER_STATUS':
      return handleOrderStatus(phone, businessId, parsed.args.orderNumber, parsed.args.status);
    case 'CONFIRM_PAYMENT':
      return handleConfirmPayment(phone, businessId, parsed.args.orderNumber);
    case 'REJECT_ORDER':
      return handleRejectOrder(phone, businessId, parsed.args.orderNumber, parsed.args.reason);
    case 'SALES_SUMMARY':
      return handleSalesSummary(phone, businessId, parsed.args.period);

    default:
      return sendMessage(phone, '👋 ¡Hola! Escribí *AYUDA* para ver los comandos disponibles.');
  }
}

// ══════════════════════════════════════
// EDIT-MODE STEP HANDLERS
// ══════════════════════════════════════

async function handleEditName(phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(phone, '❌ Edición cancelada.');
  }
  if (!text || text.trim().length === 0) {
    return sendMessage(phone, '⚠️ El nombre no puede estar vacío. Escribí el nuevo nombre o *CANCELAR* para salir.');
  }
  const name = text.trim();
  await db.updateBusiness(businessId, { business_name: name });
  await db.updateUserStep(phone, STEPS.COMPLETED);
  return sendMessage(phone, `✅ Nombre actualizado: *${name}*`);
}

async function handleEditHours(phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(phone, '❌ Edición cancelada.');
  }
  const parsed = await parseHours(text);
  if (!parsed) {
    return sendMessage(phone, '🤔 No pude interpretar el horario. Probá con un formato como:\n"Lunes a Viernes 11:00-23:00, Sábados 12:00-24:00"\n\nO escribí *CANCELAR* para salir.');
  }
  await db.updateBusiness(businessId, { business_hours: parsed });
  await db.updateUserStep(phone, STEPS.COMPLETED);
  return sendMessage(phone, `✅ Horario actualizado: *${parsed}*`);
}

async function handleEditHoursConfirm(phone, text, businessId) {
  // Not used in edit mode — edit hours saves directly
  return handleEditHours(phone, text, businessId);
}

async function handleEditDelivery(phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(phone, '❌ Edición cancelada.');
  }
  const option = text.trim();
  if (option === '1') {
    await db.updateBusiness(businessId, { has_delivery: true, has_pickup: false });
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(phone, '✅ Actualizado: solo delivery (sin retiro en local).');
  }
  if (option === '2') {
    await db.updateBusiness(businessId, { has_delivery: false, has_pickup: true });
    await db.updateUserStep(phone, STEPS.EDIT_ADDRESS);
    return sendMessage(phone, '¿Cuál es la dirección de tu local?');
  }
  if (option === '3') {
    await db.updateBusiness(businessId, { has_delivery: true, has_pickup: true });
    await db.updateUserStep(phone, STEPS.EDIT_ADDRESS);
    return sendMessage(phone, '¿Cuál es la dirección de tu local? (para retiro en local)');
  }
  return sendMessage(phone, '⚠️ Elegí una opción:\n\n1️⃣ Delivery\n2️⃣ Retiro en local\n3️⃣ Ambos\n\nO escribí *CANCELAR* para salir.');
}

async function handleEditAddress(phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(phone, '❌ Edición cancelada.');
  }
  if (!text || text.trim().length === 0) {
    return sendMessage(phone, '⚠️ La dirección no puede estar vacía. Escribí la dirección o *CANCELAR*.');
  }
  await db.updateBusiness(businessId, { business_address: text.trim() });
  await db.updateUserStep(phone, STEPS.COMPLETED);
  return sendMessage(phone, `✅ Dirección actualizada: *${text.trim()}*`);
}

async function handleEditPayments(phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(phone, '❌ Edición cancelada.');
  }
  const selected = PAYMENT_OPTIONS[text.trim()];
  if (!selected) {
    return sendMessage(phone,
      '⚠️ Elegí una opción del 1 al 4:\n\n' +
      '1️⃣ Solo efectivo\n2️⃣ Solo transferencia bancaria\n' +
      '3️⃣ Ambos (efectivo y transferencia)\n4️⃣ Ambos + seña (depósito parcial por transferencia)\n\nO escribí *CANCELAR* para salir.'
    );
  }
  const { label, ...fields } = selected;
  await db.updateBusiness(businessId, fields);

  // If option 4 (with deposit), ask for percentage
  if (text.trim() === '4') {
    await db.updateUserStep(phone, STEPS.EDIT_DEPOSIT_PERCENT);
    return sendMessage(phone,
      `✅ Métodos de pago: *${label}*\n\n` +
      '¿Qué porcentaje de seña pedís? (ej: 30, 50)\n\nO escribí *CANCELAR* para salir.'
    );
  }

  // Clear deposit_percent if switching away from option 4
  await db.updateBusiness(businessId, { deposit_percent: null });
  await db.updateUserStep(phone, STEPS.COMPLETED);
  return sendMessage(phone, `✅ Métodos de pago actualizados: *${label}*`);
}

async function handleEditDepositPercent(phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(phone, '❌ Edición cancelada.');
  }
  const num = parseInt(text.trim(), 10);
  if (isNaN(num) || num < 1 || num > 100) {
    return sendMessage(phone, '⚠️ Ingresá un número entre 1 y 100 (ej: 30, 50):\n\nO escribí *CANCELAR* para salir.');
  }
  await db.updateBusiness(businessId, { deposit_percent: num });
  const business = await db.getBusinessById(businessId);
  await db.updateUserStep(phone, STEPS.COMPLETED);
  return sendMessage(phone, `✅ Métodos de pago actualizados: *${getPaymentLabel(business)}*`);
}

async function handleEditZones(phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(phone, '❌ Edición cancelada.');
  }
  const zones = await parseZones(text);
  if (!zones) {
    return sendMessage(phone, '⚠️ Necesito el precio para cada zona. Probá así:\n"Centro $500, Almagro $600, Caballito $800"\n\nO escribí *CANCELAR* para salir.');
  }
  await db.replaceZones(businessId, zones);
  await db.updateUserStep(phone, STEPS.COMPLETED);
  const zoneLines = zones.map((z) => `• ${z.zone_name} — $${z.price}`).join('\n');
  return sendMessage(phone, `✅ Zonas actualizadas:\n${zoneLines}`);
}

async function handleEditZonesConfirm(phone, text, businessId) {
  return handleEditZones(phone, text, businessId);
}

async function handleEditBank(phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(phone, '❌ Edición cancelada.');
  }
  const result = await parseBankData(text);
  if (!result) return sendMessage(phone, '⚠️ No pude interpretar los datos. Enviá todos los datos juntos:\nAlias, CBU/CVU y Titular.\n\nO escribí *CANCELAR* para salir.');

  const missing = [];
  if (!result.alias) missing.push('• Alias');
  if (!result.cbu) missing.push('• CBU/CVU');
  if (!result.account_holder) missing.push('• Titular de la cuenta');

  if (missing.length > 0) {
    return sendMessage(phone, '⚠️ Faltan datos obligatorios:\n' + missing.join('\n') + '\n\nEnviá todos los datos juntos:\nAlias, CBU/CVU y Titular.');
  }

  await db.upsertBankDetails(businessId, result);
  await db.updateUserStep(phone, STEPS.COMPLETED);
  return sendMessage(phone,
    '✅ Datos bancarios actualizados:\n' +
    `• Alias: ${result.alias}\n• CBU: ${result.cbu}\n• Titular: ${result.account_holder}`
  );
}

async function handleEditBankConfirm(phone, text, businessId) {
  return handleEditBank(phone, text, businessId);
}

// ── Edit Products / Add Products ──

async function buildProductListForEdit(businessId) {
  const products = await db.getProductsByBusiness(businessId);
  if (products.length === 0) {
    return '📦 Tu menú está vacío.\nEscribí productos para agregar o *LISTO* para salir.';
  }
  const list = products.map((p, i) =>
    `${i + 1}. ${p.name} — $${p.price} (${p.category || 'General'}) ${p.is_available ? '✔️' : '⏸️'}`
  ).join('\n');
  return `📦 Tu menú actual:\n${list}\n\n¿Qué querés hacer?\n• Escribí nuevos productos para agregar\n• Respondé *ELIMINAR 3* para borrar un producto (por número)\n• Respondé *LISTO* para salir`;
}

async function handleEditProducts(phone, text, businessId) {
  const normalized = text.trim().toUpperCase();

  if (normalized === 'LISTO' || normalized === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    const products = await db.getProductsByBusiness(businessId);
    return sendMessage(phone, `✅ Menú actualizado. Tu menú tiene ${products.length} productos.`);
  }

  // Handle ELIMINAR N
  const deleteMatch = normalized.match(/^ELIMINAR\s+(\d+)$/);
  if (deleteMatch) {
    const products = await db.getProductsByBusiness(businessId);
    const index = parseInt(deleteMatch[1], 10) - 1;
    if (index < 0 || index >= products.length) {
      return sendMessage(phone, `⚠️ Número inválido. Elegí entre 1 y ${products.length}.`);
    }
    const product = products[index];
    await db.deleteProduct(product.id);
    return sendMessage(phone, `✅ *${product.name}* eliminada del menú.\n\n` + await buildProductListForEdit(businessId));
  }

  // Try to add products with AI
  return addProductsFromText(phone, text, businessId, 'Seguí editando o escribí *LISTO* para salir.');
}

// ── Delete Product (by number) ──

async function handleDeleteProduct(phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(phone, '❌ Operación cancelada.');
  }

  const num = parseInt(text.trim(), 10);
  const products = await db.getProductsByBusiness(businessId);

  if (isNaN(num) || num < 1 || num > products.length) {
    return sendMessage(phone, `⚠️ Respondé con un número del 1 al ${products.length}, o *CANCELAR*.`);
  }

  const product = products[num - 1];
  await db.deleteProduct(product.id);
  await db.updateUserStep(phone, STEPS.COMPLETED);
  return sendMessage(phone, `✅ *${product.name}* eliminada del menú.`);
}

// ── Pause Product (by number) ──

async function handlePauseProduct(phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(phone, '❌ Operación cancelada.');
  }

  const num = parseInt(text.trim(), 10);
  const products = await db.getProductsByBusiness(businessId);

  if (isNaN(num) || num < 1 || num > products.length) {
    return sendMessage(phone, `⚠️ Respondé con un número del 1 al ${products.length}, o *CANCELAR*.`);
  }

  const product = products[num - 1];
  const nowAvailable = await db.toggleProductAvailability(product.id);
  await db.updateUserStep(phone, STEPS.COMPLETED);

  if (nowAvailable) {
    return sendMessage(phone, `✅ *${product.name}* reactivado. Ya aparecerá en el menú.`);
  }
  return sendMessage(phone, `⏸️ *${product.name}* pausado. No aparecerá en el menú para los clientes.\n\nPara reactivarlo, usá *PAUSAR PRODUCTO* y seleccionalo de nuevo.`);
}

// ══════════════════════════════════════
// ORDER MANAGEMENT COMMANDS (Phase 12)
// ══════════════════════════════════════

// Step 45: VER PEDIDOS — list pending/new orders
async function handleViewOrders(phone, businessId) {
  const orders = await db.getPendingOrders(businessId);

  if (orders.length === 0) {
    return sendMessage(phone, '📦 No hay pedidos pendientes.');
  }

  const lines = [`📦 *Pedidos pendientes (${orders.length}):*\n`];

  const statusLabels = {
    nuevo: '🆕 Nuevo',
    preparando: '🍳 Preparando',
    en_camino: '🛵 En camino',
  };

  for (const order of orders) {
    const status = statusLabels[order.order_status] || order.order_status;
    const items = (order.items || []).map((i) => `${i.qty}x ${i.name}`).join(', ');
    lines.push(`#${order.order_number} — ${status} — $${formatPrice(order.grand_total)}`);
    lines.push(`   📱 ${order.client_phone} · ${items}`);
  }

  lines.push('\nUsá *VER PEDIDO #N* para ver detalles.');
  return sendMessage(phone, lines.join('\n'));
}

// Step 46: VER PEDIDO #123 — view order details
async function handleViewOrder(phone, businessId, orderNumber) {
  const order = await db.getOrderByNumber(businessId, orderNumber);
  if (!order) {
    return sendMessage(phone, `⚠️ No encontré el pedido #${orderNumber}.`);
  }

  const statusLabels = {
    nuevo: '🆕 Nuevo',
    preparando: '🍳 Preparando',
    en_camino: '🛵 En camino',
    entregado: '✅ Entregado',
    cancelado: '❌ Cancelado',
  };

  const paymentLabels = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    deposit: 'Seña por transferencia',
  };

  const paymentStatusLabels = {
    pending: '⏳ Pendiente',
    confirmed: '✅ Confirmado',
  };

  const lines = [`📦 *Pedido #${orderNumber}*\n`];
  lines.push(`📱 Cliente: ${order.client_phone}`);
  if (order.client_address) lines.push(`📍 Dirección: ${order.client_address}`);
  lines.push(`📋 Estado: ${statusLabels[order.order_status] || order.order_status}`);

  lines.push('\n🛒 *Productos:*');
  for (const item of (order.items || [])) {
    lines.push(`• ${item.qty}x ${item.name} — $${formatPrice(item.price * item.qty)}`);
  }

  lines.push(`\n📋 Subtotal: $${formatPrice(order.subtotal)}`);
  if (order.delivery_price > 0) {
    lines.push(`🚚 Delivery: $${formatPrice(order.delivery_price)}`);
  }
  lines.push(`💰 *Total: $${formatPrice(order.grand_total)}*`);
  lines.push(`💳 Pago: ${paymentLabels[order.payment_method] || order.payment_method} — ${paymentStatusLabels[order.payment_status] || order.payment_status}`);

  if (order.deposit_amount) {
    lines.push(`💵 Seña: $${formatPrice(order.deposit_amount)}`);
  }

  const createdAt = new Date(order.created_at);
  lines.push(`\n🕐 Creado: ${createdAt.toLocaleString('es-AR', { timeZone: config.timezone })}`);

  return sendMessage(phone, lines.join('\n'));
}

// Step 47: ESTADO PEDIDO #123 preparando — change order status
async function handleOrderStatus(phone, businessId, orderNumber, newStatus) {
  const validStatuses = ['preparando', 'en_camino', 'entregado', 'cancelado'];
  if (!validStatuses.includes(newStatus)) {
    return sendMessage(phone,
      `⚠️ Estado inválido: "${newStatus}"\n\n` +
      'Estados válidos: *preparando*, *en_camino*, *entregado*, *cancelado*'
    );
  }

  const order = await db.getOrderByNumber(businessId, orderNumber);
  if (!order) {
    return sendMessage(phone, `⚠️ No encontré el pedido #${orderNumber}.`);
  }

  if (order.order_status === 'cancelado') {
    return sendMessage(phone, `⚠️ El pedido #${orderNumber} está cancelado y no se puede modificar.`);
  }
  if (order.order_status === 'entregado') {
    return sendMessage(phone, `⚠️ El pedido #${orderNumber} ya fue entregado.`);
  }

  await db.updateOrderStatus(order.id, newStatus);

  const statusLabels = {
    preparando: '🍳 Preparando',
    en_camino: '🛵 En camino',
    entregado: '✅ Entregado',
    cancelado: '❌ Cancelado',
  };

  await sendMessage(phone, `✅ Pedido #${orderNumber} actualizado: *${statusLabels[newStatus]}*`);

  // Notify customer of status change
  try {
    const customerStatusLabels = {
      preparando: '🍳 ¡Tu pedido se está preparando!',
      en_camino: '🛵 ¡Tu pedido está en camino!',
      entregado: '✅ ¡Tu pedido fue entregado! Gracias por tu compra.',
      cancelado: '❌ Tu pedido fue cancelado por el local.',
    };
    await sendMessage(order.client_phone,
      `📦 Pedido #${orderNumber} — ${customerStatusLabels[newStatus]}`
    );
  } catch (error) {
    console.error(`❌ Failed to notify customer about status change:`, error.message);
  }
}

// Step 48: CONFIRMAR PAGO #123 — confirm transfer/deposit received
async function handleConfirmPayment(phone, businessId, orderNumber) {
  const order = await db.getOrderByNumber(businessId, orderNumber);
  if (!order) {
    return sendMessage(phone, `⚠️ No encontré el pedido #${orderNumber}.`);
  }

  if (order.payment_status === 'confirmed') {
    return sendMessage(phone, `⚠️ El pago del pedido #${orderNumber} ya está confirmado.`);
  }

  await db.updatePaymentStatus(order.id, 'confirmed');
  await sendMessage(phone, `✅ Pago confirmado para el pedido #${orderNumber}.`);

  // Notify customer
  try {
    await sendMessage(order.client_phone,
      `✅ Pedido #${orderNumber} — ¡Tu pago fue confirmado! Gracias.`
    );
  } catch (error) {
    console.error(`❌ Failed to notify customer about payment confirmation:`, error.message);
  }
}

// Step 49: RECHAZAR PEDIDO #123 — reject/cancel with optional reason
async function handleRejectOrder(phone, businessId, orderNumber, reason) {
  const order = await db.getOrderByNumber(businessId, orderNumber);
  if (!order) {
    return sendMessage(phone, `⚠️ No encontré el pedido #${orderNumber}.`);
  }

  if (order.order_status === 'cancelado') {
    return sendMessage(phone, `⚠️ El pedido #${orderNumber} ya está cancelado.`);
  }
  if (order.order_status === 'entregado') {
    return sendMessage(phone, `⚠️ El pedido #${orderNumber} ya fue entregado y no se puede rechazar.`);
  }

  await db.updateOrderStatus(order.id, 'cancelado');
  await sendMessage(phone, `❌ Pedido #${orderNumber} rechazado.`);

  // Notify customer
  try {
    let msg = `❌ Pedido #${orderNumber} — Tu pedido fue cancelado por el local.`;
    if (reason) {
      msg += `\nMotivo: ${reason}`;
    }
    await sendMessage(order.client_phone, msg);
  } catch (error) {
    console.error(`❌ Failed to notify customer about rejection:`, error.message);
  }
}

// Step 50: VENTAS HOY/SEMANA/MES — sales summary
async function handleSalesSummary(phone, businessId, period) {
  const now = new Date();
  // Calculate Argentina time
  const argNow = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));

  let since;
  let periodLabel;

  switch (period) {
    case 'hoy':
      since = new Date(argNow);
      since.setHours(0, 0, 0, 0);
      periodLabel = 'hoy';
      break;
    case 'semana':
      since = new Date(argNow);
      since.setDate(since.getDate() - since.getDay()); // Start of week (Sunday)
      since.setHours(0, 0, 0, 0);
      periodLabel = 'esta semana';
      break;
    case 'mes':
      since = new Date(argNow.getFullYear(), argNow.getMonth(), 1);
      periodLabel = 'este mes';
      break;
    default:
      return sendMessage(phone, '⚠️ Usá: *VENTAS HOY*, *VENTAS SEMANA* o *VENTAS MES*');
  }

  const summary = await db.getSalesSummary(businessId, since);

  const lines = [`📊 *Ventas ${periodLabel}:*\n`];
  lines.push(`📦 Total pedidos: ${summary.total}`);
  lines.push(`✅ Confirmados: ${summary.confirmed}`);
  lines.push(`❌ Cancelados: ${summary.cancelled}`);
  lines.push(`\n💰 *Facturación (confirmados): $${formatPrice(summary.totalRevenue)}*`);

  if (summary.transferRevenue > 0) {
    lines.push(`🏦 Por transferencia: $${formatPrice(summary.transferRevenue)}`);
  }
  if (summary.cashRevenue > 0) {
    lines.push(`💵 En efectivo: $${formatPrice(summary.cashRevenue)}`);
  }

  return sendMessage(phone, lines.join('\n'));
}

// ══════════════════════════════════════
// VIEW COMMANDS
// ══════════════════════════════════════

function helpText() {
  return '📖 *Comandos disponibles:*\n\n' +
    '*Configuración:*\n' +
    '`EDITAR NOMBRE` — Cambiar nombre del negocio\n' +
    '`EDITAR HORARIO` — Cambiar horario\n' +
    '`EDITAR DIRECCIÓN` — Cambiar dirección\n' +
    '`EDITAR ENTREGA` — Cambiar delivery/retiro\n' +
    '`EDITAR PAGOS` — Cambiar métodos de pago\n' +
    '`EDITAR ZONAS` — Cambiar zonas y precios\n' +
    '`EDITAR BANCO` — Cambiar datos bancarios\n\n' +
    '*Menú:*\n' +
    '`AGREGAR PRODUCTO` — Agregar productos al menú\n' +
    '`ELIMINAR PRODUCTO` — Eliminar un producto\n' +
    '`PAUSAR PRODUCTO` — Pausar/activar un producto\n' +
    '`VER MENÚ` — Ver tu menú actual\n' +
    '`VER NEGOCIO` — Ver resumen del negocio\n\n' +
    '*Pedidos:*\n' +
    '`VER PEDIDOS` — Ver pedidos pendientes\n' +
    '`VER PEDIDO #123` — Ver detalle de un pedido\n' +
    '`ESTADO PEDIDO #123 preparando` — Cambiar estado\n' +
    '`CONFIRMAR PAGO #123` — Confirmar transferencia\n' +
    '`RECHAZAR PEDIDO #123` — Rechazar pedido\n' +
    '`VENTAS HOY` / `SEMANA` / `MES` — Resumen de ventas';
}

async function buildViewMenu(businessId) {
  const business = await db.getBusinessById(businessId);
  const products = await db.getProductsByBusiness(businessId);

  if (products.length === 0) return '📦 Tu menú está vacío.';

  const active = products.filter((p) => p.is_available);
  const paused = products.filter((p) => !p.is_available);

  const lines = [`📦 **Menú de ${business.business_name}** (${active.length} activos, ${paused.length} pausado${paused.length !== 1 ? 's' : ''}):\n`];

  const grouped = {};
  for (const p of products) {
    const cat = p.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  }

  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`*${cat}:*`);
    for (const p of items) {
      if (p.is_available) {
        lines.push(`• ${p.name} — $${p.price} ✔️`);
      } else {
        lines.push(`• ~~${p.name} — $${p.price}~~ ⏸️`);
      }
    }
  }

  return lines.join('\n');
}

async function buildViewBusiness(businessId) {
  const business = await db.getBusinessById(businessId);
  const zones = await db.getZonesByBusiness(businessId);
  const bank = await db.getBankDetails(businessId);
  const products = await db.getProductsByBusiness(businessId);

  const active = products.filter((p) => p.is_available).length;
  const paused = products.filter((p) => !p.is_available).length;

  const lines = [`📋 **Resumen de ${business.business_name}:**\n`];
  lines.push(`🏪 *${business.business_name}*`);
  lines.push(`⏰ ${business.business_hours}`);
  if (business.business_address) lines.push(`📍 ${business.business_address}`);
  if (zones.length > 0) {
    lines.push(`🚚 Delivery: ${zones.map((z) => `${z.zone_name} $${z.price}`).join(' · ')}`);
  }
  lines.push(`💳 Pagos: ${getPaymentLabel(business)}`);
  if (bank) lines.push(`🏦 Alias: ${bank.alias} · Titular: ${bank.account_holder}`);
  lines.push(`📦 Menú: ${active} activos, ${paused} pausado${paused !== 1 ? 's' : ''}`);
  lines.push(`✅ Estado: ${business.is_active ? 'Activo' : 'Inactivo'}`);

  return lines.join('\n');
}

// ══════════════════════════════════════
// SHARED HELPERS
// ══════════════════════════════════════

function formatPrice(n) {
  return Number(n).toLocaleString('es-AR');
}

function isYes(text) {
  const n = text.trim().toLowerCase();
  return n === 'si' || n === 'sí';
}

async function parseHours(text) {
  try {
    const result = await ollama.extractBusinessHours(text);
    return result.hours || null;
  } catch {
    return null;
  }
}

async function parseZones(text) {
  try {
    const result = await ollama.extractDeliveryZones(text);
    const zones = result.zones || [];
    if (zones.length === 0 || zones.some((z) => !z.zone_name || !z.price)) return null;
    return zones;
  } catch {
    return null;
  }
}

async function parseBankData(text) {
  try {
    return await ollama.extractBankData(text);
  } catch {
    return null;
  }
}

async function addProductsFromText(phone, text, businessId, continueMsg) {
  let result;
  try {
    result = await ollama.extractProducts(text);
  } catch {
    return sendMessage(phone, '⚠️ No pude interpretar los productos. Probá incluyendo el precio, ej:\n"Pizza grande $5500, categoría Pizzas"');
  }

  const products = (result.products || []).filter((p) => p.name && p.price > 0);

  if (products.length === 0) {
    const noPrice = (result.products || []).filter((p) => p.name && (!p.price || p.price === 0));
    if (noPrice.length > 0) {
      const names = noPrice.map((p) => `• ${p.name} — sin precio`).join('\n');
      return sendMessage(phone, `⚠️ No pude detectar el precio de estos productos:\n${names}\n\nProbá incluyendo el precio, ej: "Pizza grande $5500"`);
    }
    return sendMessage(phone, '⚠️ No pude extraer ningún producto. Probá con un formato como:\n"Pizza Muzzarella $5500, categoría Pizzas"');
  }

  await db.insertProducts(businessId, products);

  const saved = products.map((p) => {
    const cat = p.category ? ` (${p.category})` : '';
    return `• ${p.name} — $${p.price}${cat} ✔️`;
  }).join('\n');

  const total = await db.getProductsByBusiness(businessId);
  let reply = `✅ Guardé ${products.length} producto${products.length > 1 ? 's' : ''}:\n${saved}\n\n`;
  if (total.length > products.length) {
    reply += `Tu menú tiene ${total.length} productos. `;
  }
  reply += continueMsg;

  return sendMessage(phone, reply);
}

module.exports = { processMessage };
