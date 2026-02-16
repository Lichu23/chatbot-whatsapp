const db = require('./database');
const ai = require('./ai');
const subscription = require('./subscription');
const { tryRegister } = require('./registration');
const { sendMessage, sendButtons, sendList, sendTemplate } = require('./whatsapp');
const { processCustomerMessage } = require('./customer-workflow');
const { syncCatalogToDatabase, setProductVisibility, setProductAvailability, updateProductFields } = require('./catalog');
const { config, STEPS, PAYMENT_OPTIONS, getPaymentLabel } = require('../config');
const promos = require('./promos');
const analytics = require('./analytics');
const loyalty = require('./loyalty');
const { parseCommand } = require('../utils/commands');

const CUSTOMER_MSG = 'El negocio se está configurando, volvé pronto.';

// Temporary in-memory store for pause product selection (phone → productId)
const pauseProductSelection = new Map();
// Temporary in-memory store for edit product selection (phone → { productId, field })
const editProductSelection = new Map();

/**
 * Main orchestration — routes every incoming message to the right handler.
 */
async function processMessage(message) {
  const { from, text, profileName, phoneConfig } = message;
  console.log(`\n🔄 processMessage: from=${from}, text="${text}"`);

  const admin = await db.findAdmin(from);
  console.log(`👤 Admin lookup: ${admin ? `found (${admin.name})` : 'not found'}`);

  if (admin) {
    const state = await db.getUserState(from);
    console.log(`📍 User state: ${state ? `step=${state.current_step}, business=${state.business_id}` : 'no state'}`);

    if (!state) {
      console.log('⚠️  Admin exists but no state — sending customer message');
      return sendMessage(phoneConfig, from, CUSTOMER_MSG);
    }

    if (state.current_step === STEPS.COMPLETED) {
      console.log('🎯 Routing to command handler');
      return handleCommand(phoneConfig, from, text, state.business_id);
    }

    console.log(`🎯 Routing to step handler: ${state.current_step}`);
    return handleStep(phoneConfig, from, text, state);
  }

  // Not an admin — try registration first
  console.log('🆕 Not an admin — trying registration...');
  const result = await tryRegister(from, text, profileName);
  console.log(`🆕 Registration result: ${JSON.stringify({ success: result.success, isCode: result.isCode })}`);

  if (result.isCode) {
    return sendMessage(phoneConfig, from, result.message);
  }

  // Not a code — check if there's an active business for customer ordering
  let activeBusiness = null;
  if (message.phoneNumberId) {
    activeBusiness = await db.getBusinessByPhoneNumberId(message.phoneNumberId);
  }
  if (!activeBusiness) {
    activeBusiness = await db.getActiveBusiness();
  }

  if (activeBusiness) {
    // Check if the business subscription is still active
    const sub = await subscription.getActiveSubscription(activeBusiness.id);
    if (!sub) {
      return sendMessage(phoneConfig, from,
        '⚠️ Este negocio no está disponible en este momento. Por favor intentá más tarde.'
      );
    }
    console.log(`🛒 Active business found: ${activeBusiness.business_name} — routing to customer flow`);
    return processCustomerMessage(message, activeBusiness, phoneConfig);
  }

  console.log('⚠️  No active business — sending "volvé pronto"');
  return sendMessage(phoneConfig, from, CUSTOMER_MSG);
}

// ══════════════════════════════════════
// STEP ROUTER (onboarding + edit mode)
// ══════════════════════════════════════

async function handleStep(pc, phone, text, state) {
  const { current_step, business_id } = state;

  switch (current_step) {
    // ── Onboarding steps ──
    case STEPS.BUSINESS_NAME:
      return handleBusinessName(pc, phone, text, business_id);
    case STEPS.BUSINESS_HOURS:
      return handleBusinessHours(pc, phone, text, business_id);
    case STEPS.BUSINESS_HOURS_CONFIRM:
      return handleBusinessHoursConfirm(pc, phone, text, business_id);
    case STEPS.DELIVERY_METHOD:
      return handleDeliveryMethod(pc, phone, text, business_id);
    case STEPS.PICKUP_ADDRESS:
      return handlePickupAddress(pc, phone, text, business_id);
    case STEPS.PAYMENT_METHODS:
      return handlePaymentMethods(pc, phone, text, business_id);
    case STEPS.DEPOSIT_PERCENT:
      return handleDepositPercent(pc, phone, text, business_id);
    case STEPS.DELIVERY_ZONES:
      return handleDeliveryZones(pc, phone, text, business_id);
    case STEPS.DELIVERY_ZONES_CONFIRM:
      return handleDeliveryZonesConfirm(pc, phone, text, business_id);
    case STEPS.BANK_DATA:
      return handleBankData(pc, phone, text, business_id);
    case STEPS.BANK_DATA_CONFIRM:
      return handleBankDataConfirm(pc, phone, text, business_id);
    case STEPS.PRODUCTS:
      return handleProducts(pc, phone, text, business_id);
    case STEPS.REVIEW:
      return handleReview(pc, phone, text, business_id);

    // ── Edit-mode steps (post-onboarding) ──
    case STEPS.EDIT_NAME:
      return handleEditName(pc, phone, text, business_id);
    case STEPS.EDIT_HOURS:
      return handleEditHours(pc, phone, text, business_id);
    case STEPS.EDIT_HOURS_CONFIRM:
      return handleEditHoursConfirm(pc, phone, text, business_id);
    case STEPS.EDIT_DELIVERY:
      return handleEditDelivery(pc, phone, text, business_id);
    case STEPS.EDIT_ADDRESS:
      return handleEditAddress(pc, phone, text, business_id);
    case STEPS.EDIT_PAYMENTS:
      return handleEditPayments(pc, phone, text, business_id);
    case STEPS.EDIT_DEPOSIT_PERCENT:
      return handleEditDepositPercent(pc, phone, text, business_id);
    case STEPS.EDIT_ZONES:
      return handleEditZones(pc, phone, text, business_id);
    case STEPS.EDIT_ZONES_CONFIRM:
      return handleEditZonesConfirm(pc, phone, text, business_id);
    case STEPS.EDIT_BANK:
      return handleEditBank(pc, phone, text, business_id);
    case STEPS.EDIT_BANK_CONFIRM:
      return handleEditBankConfirm(pc, phone, text, business_id);
    case STEPS.EDIT_PRODUCTS:
      return handleEditProducts(pc, phone, text, business_id);
    case STEPS.DELETE_PRODUCT:
      return handleDeleteProduct(pc, phone, text, business_id);
    case STEPS.PAUSE_PRODUCT:
      return handlePauseProduct(pc, phone, text, business_id);
    case STEPS.PAUSE_PRODUCT_ACTION:
      return handlePauseProductAction(pc, phone, text, business_id);
    case STEPS.EDIT_PRODUCT_SELECT:
      return handleEditProductSelect(pc, phone, text, business_id);
    case STEPS.EDIT_PRODUCT_FIELD:
      return handleEditProductField(pc, phone, text, business_id);
    case STEPS.EDIT_PRODUCT_VALUE:
      return handleEditProductValue(pc, phone, text, business_id);
    case STEPS.LINK_CATALOG:
      return handleLinkCatalog(pc, phone, text, business_id);

    default:
      return sendMessage(pc, phone, '⚠️ Estado desconocido. Escribí *AYUDA*.');
  }
}

// ══════════════════════════════════════
// ONBOARDING STEP HANDLERS (Steps 1-8)
// ══════════════════════════════════════

// ── Step 1: Business Name ──

async function handleBusinessName(pc, phone, text, businessId) {
  if (!text || text.trim().length === 0) {
    return sendMessage(pc, phone, '⚠️ El nombre no puede estar vacío. ¿Cuál es el nombre de tu negocio?');
  }

  const name = text.trim();
  await db.updateBusiness(businessId, { business_name: name });
  await db.updateUserStep(phone, STEPS.BUSINESS_HOURS);

  return sendMessage(pc, phone,
    `✅ Nombre guardado: *${name}*\n\n` +
    '**Paso 2 de 7** — ¿Cuál es tu horario de atención?\n' +
    'Ej: Lunes a Viernes 11:00-23:00, Sábados 12:00-24:00'
  );
}

// ── Step 2: Business Hours (AI) ──

async function handleBusinessHours(pc, phone, text, businessId) {
  const parsed = await parseHours(text);
  if (!parsed) {
    return sendMessage(pc, phone,
      '🤔 No pude interpretar el horario. Probá con un formato como:\n' +
      '"Lunes a Viernes 11:00-23:00, Sábados 12:00-24:00"'
    );
  }

  await db.updateBusiness(businessId, { business_hours: parsed });
  await db.updateUserStep(phone, STEPS.BUSINESS_HOURS_CONFIRM);

  return sendButtons(pc, phone,
    `✅ Horario guardado:\n*${parsed}*\n\n¿Está bien?`,
    [
      { id: 'si', title: 'Sí, continuar' },
      { id: 'no', title: 'Escribir de nuevo' },
    ]
  );
}

async function handleBusinessHoursConfirm(pc, phone, text, businessId) {
  if (isYes(text)) {
    await db.updateUserStep(phone, STEPS.DELIVERY_METHOD);
    return sendButtons(pc, phone,
      '**Paso 3 de 7** — ¿Cómo entregás los pedidos?',
      [
        { id: '1', title: 'Delivery' },
        { id: '2', title: 'Retiro en local' },
        { id: '3', title: 'Ambos' },
      ]
    );
  }
  await db.updateUserStep(phone, STEPS.BUSINESS_HOURS);
  return handleBusinessHours(pc, phone, text, businessId);
}

// ── Step 3: Delivery / Pickup ──

async function handleDeliveryMethod(pc, phone, text, businessId) {
  const option = text.trim();

  if (option === '1') {
    await db.updateBusiness(businessId, { has_delivery: true, has_pickup: false });
    await db.updateUserStep(phone, STEPS.PAYMENT_METHODS);
    return sendPaymentMethodsList(pc, phone, '✅ Configuración guardada: solo delivery.\n\n**Paso 4 de 7** — ¿Qué métodos de pago aceptás?');
  }
  if (option === '2') {
    await db.updateBusiness(businessId, { has_delivery: false, has_pickup: true });
    await db.updateUserStep(phone, STEPS.PICKUP_ADDRESS);
    return sendMessage(pc, phone, '¿Cuál es la dirección de tu local?');
  }
  if (option === '3') {
    await db.updateBusiness(businessId, { has_delivery: true, has_pickup: true });
    await db.updateUserStep(phone, STEPS.PICKUP_ADDRESS);
    return sendMessage(pc, phone, '¿Cuál es la dirección de tu local? (para retiro en local)');
  }
  return sendButtons(pc, phone, '⚠️ Elegí una opción:',
    [
      { id: '1', title: 'Delivery' },
      { id: '2', title: 'Retiro en local' },
      { id: '3', title: 'Ambos' },
    ]
  );
}

// ── Step 3b: Pickup Address ──

async function handlePickupAddress(pc, phone, text, businessId) {
  if (!text || text.trim().length === 0) {
    return sendMessage(pc, phone, '⚠️ La dirección no puede estar vacía. ¿Cuál es la dirección de tu local?');
  }

  const address = text.trim();
  const business = await db.getBusinessByPhone(phone);
  await db.updateBusiness(businessId, { business_address: address });
  await db.updateUserStep(phone, STEPS.PAYMENT_METHODS);

  const lines = [];
  if (business.has_delivery) lines.push('• 🚚 Delivery: Sí');
  if (business.has_pickup) lines.push('• 🏪 Retiro en local: Sí');
  lines.push(`• 📍 Dirección: ${address}`);

  return sendPaymentMethodsList(pc, phone,
    '✅ Configuración de entrega guardada:\n' + lines.join('\n') + '\n\n**Paso 4 de 7** — ¿Qué métodos de pago aceptás?'
  );
}

// ── Step 4: Payment Methods ──

const PAYMENT_LIST_SECTIONS = [
  {
    title: 'Métodos de pago',
    rows: [
      { id: '1', title: 'Solo efectivo' },
      { id: '2', title: 'Solo transferencia' },
      { id: '3', title: 'Efectivo y transferencia' },
      { id: '4', title: 'Ambos + seña', description: 'Depósito parcial por transferencia' },
    ],
  },
];

function sendPaymentMethodsList(pc, phone, header) {
  return sendList(pc, phone, header, 'Elegir método', PAYMENT_LIST_SECTIONS);
}

async function handlePaymentMethods(pc, phone, text, businessId) {
  const selected = PAYMENT_OPTIONS[text.trim()];
  if (!selected) {
    return sendPaymentMethodsList(pc, phone, '⚠️ Elegí una opción:');
  }

  const { label, ...fields } = selected;
  await db.updateBusiness(businessId, fields);

  // If option 4 (with deposit), ask for percentage
  if (text.trim() === '4') {
    await db.updateUserStep(phone, STEPS.DEPOSIT_PERCENT);
    return sendMessage(pc, phone,
      `✅ Métodos de pago: *${label}*\n\n` +
      '¿Qué porcentaje de seña pedís? (ej: 30, 50)\n' +
      'Esto es lo que el cliente paga por adelantado via transferencia.'
    );
  }

  return advanceAfterPayment(pc, phone, businessId, label);
}

async function handleDepositPercent(pc, phone, text, businessId) {
  const num = parseInt(text.trim(), 10);
  if (isNaN(num) || num < 1 || num > 100) {
    return sendMessage(pc, phone, '⚠️ Ingresá un número entre 1 y 100 (ej: 30, 50):');
  }

  await db.updateBusiness(businessId, { deposit_percent: num });
  const business = await db.getBusinessByPhone(phone);
  const label = getPaymentLabel(business);
  return advanceAfterPayment(pc, phone, businessId, label);
}

async function advanceAfterPayment(pc, phone, businessId, label) {
  const business = await db.getBusinessByPhone(phone);

  if (business.has_delivery) {
    await db.updateUserStep(phone, STEPS.DELIVERY_ZONES);
    return sendMessage(pc, phone,
      `✅ Métodos de pago guardados: *${label}*\n\n` +
      '**Paso 5 de 7** — Escribí tus zonas de delivery con el precio de cada una.\n' +
      'Ej: Centro $500, Norte $800, Macrocentro $600'
    );
  }

  await db.updateUserStep(phone, STEPS.BANK_DATA);
  return sendMessage(pc, phone, `✅ Métodos de pago guardados: *${label}*\n\n` + bankDataPrompt());
}

// ── Step 5: Delivery Zones (AI) ──

async function handleDeliveryZones(pc, phone, text, businessId) {
  const zones = await parseZones(text);
  if (!zones) {
    return sendMessage(pc, phone, '⚠️ Necesito el precio para cada zona. Probá así:\n"Centro $500, Almagro $600, Caballito $800"');
  }

  // Check zone limit (replaceZones replaces all, so check new count vs limit)
  const sub = await subscription.getActiveSubscription(businessId);
  const zoneLimit = sub?.plan?.delivery_zone_limit || 3;
  if (zones.length > zoneLimit) {
    return sendMessage(pc, phone,
      `⚠️ Tu plan permite hasta *${zoneLimit}* zonas de delivery. ` +
      `Estás intentando agregar ${zones.length}.\n\n` +
      `Enviá *PLANES* para ver opciones de upgrade.`
    );
  }

  await db.replaceZones(businessId, zones);
  await db.updateUserStep(phone, STEPS.DELIVERY_ZONES_CONFIRM);
  const zoneLines = zones.map((z) => `• ${z.zone_name} — $${z.price}`).join('\n');
  return sendButtons(pc, phone,
    `✅ Zonas de delivery guardadas:\n${zoneLines}\n\n¿Está bien?`,
    [
      { id: 'si', title: 'Sí, continuar' },
      { id: 'no', title: 'Escribir de nuevo' },
    ]
  );
}

async function handleDeliveryZonesConfirm(pc, phone, text, businessId) {
  if (isYes(text)) {
    await db.updateUserStep(phone, STEPS.BANK_DATA);
    return sendMessage(pc, phone, bankDataPrompt());
  }
  await db.updateUserStep(phone, STEPS.DELIVERY_ZONES);
  return handleDeliveryZones(pc, phone, text, businessId);
}

// ── Step 6: Bank Data (AI) ──

function bankDataPrompt() {
  return '**Paso 6 de 7** — Necesito tus datos bancarios para los cobros:\n• Alias\n• CBU/CVU\n• Titular de la cuenta';
}

async function handleBankData(pc, phone, text, businessId) {
  const result = await parseBankData(text);
  if (!result) return sendMessage(pc, phone, '⚠️ No pude interpretar los datos. Enviá todos los datos juntos:\nAlias, CBU/CVU y Titular.');

  const missing = [];
  if (!result.alias) missing.push('• Alias');
  if (!result.cbu) missing.push('• CBU/CVU');
  if (!result.account_holder) missing.push('• Titular de la cuenta');

  if (missing.length > 0) {
    return sendMessage(pc, phone, '⚠️ Faltan datos obligatorios:\n' + missing.join('\n') + '\n\nEnviá todos los datos juntos:\nAlias, CBU/CVU y Titular.');
  }

  await db.upsertBankDetails(businessId, result);
  await db.updateUserStep(phone, STEPS.BANK_DATA_CONFIRM);

  return sendButtons(pc, phone,
    '✅ Datos bancarios guardados:\n' +
    `• Alias: ${result.alias}\n• CBU: ${result.cbu}\n• Titular: ${result.account_holder}\n\n` +
    '¿Está bien?',
    [
      { id: 'si', title: 'Sí, continuar' },
      { id: 'no', title: 'Escribir de nuevo' },
    ]
  );
}

async function handleBankDataConfirm(pc, phone, text, businessId) {
  if (isYes(text)) {
    await db.updateUserStep(phone, STEPS.REVIEW);
    return sendButtons(pc, phone, await buildReviewSummary(businessId),
      [
        { id: 'CONFIRMAR', title: 'Confirmar' },
        { id: 'EDITAR', title: 'Editar' },
      ]
    );
  }
  await db.updateUserStep(phone, STEPS.BANK_DATA);
  return handleBankData(pc, phone, text, businessId);
}

// ── Step 7: Products (AI + loop) ──

async function handleProducts(pc, phone, text, businessId) {
  if (text.trim().toUpperCase() === 'LISTO') {
    const products = await db.getProductsByBusiness(businessId);
    if (products.length === 0) {
      return sendMessage(pc, phone, '⚠️ Necesitás cargar al menos un producto antes de continuar.\nDescribí tus productos o escribí *LISTO* cuando termines.');
    }
    await db.updateUserStep(phone, STEPS.REVIEW);
    return sendButtons(pc, phone, await buildReviewSummary(businessId),
      [
        { id: 'CONFIRMAR', title: 'Confirmar' },
        { id: 'EDITAR', title: 'Editar' },
      ]
    );
  }
  return addProductsFromText(pc, phone, text, businessId, 'Seguí agregando o escribí *LISTO*.');
}

// ── Step 8: Review & Activate ──

async function buildReviewSummary(businessId) {
  const business = await db.getBusinessById(businessId);
  const zones = await db.getZonesByBusiness(businessId);
  const bank = await db.getBankDetails(businessId);
  const products = await db.getProductsByBusiness(businessId);

  const lines = ['📋 **Paso 7 de 7 — Resumen de tu negocio:**\n'];
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
  } else {
    lines.push('\n📦 *Menú:* Pendiente — el administrador de la plataforma importará tus productos desde el catálogo de WhatsApp. Te avisaremos cuando estén listos.');
  }

  lines.push('\n¿Está todo bien?');
  return lines.join('\n');
}

async function handleReview(pc, phone, text, businessId) {
  const normalized = text.trim().toUpperCase();

  if (normalized === 'CONFIRMAR') {
    const business = await db.getBusinessByPhone(phone);

    // Auto-sync catalog from Meta
    let syncResult = null;
    if (business.phone_number_id) {
      const phoneConfig = await db.getPhoneConfigById(business.phone_number_id);
      if (phoneConfig?.catalogId && phoneConfig?.token) {
        try {
          await sendMessage(pc, phone, '⏳ Importando productos desde tu catálogo de WhatsApp...');
          syncResult = await syncCatalogToDatabase(businessId, phoneConfig.token, phoneConfig.catalogId);
          console.log(`📦 Catalog sync: ${syncResult.inserted} inserted, ${syncResult.updated} linked, ${syncResult.skipped} skipped`);
        } catch (error) {
          console.error('📦 Catalog sync failed:', error.message);
        }
      }
    }

    // Auto-create 30-day Intermedio trial
    let trialSub = null;
    try {
      trialSub = await subscription.createTrialSubscription(businessId);
      console.log(`🆓 Trial created for business ${businessId}, expires ${trialSub.end_date}`);
    } catch (err) {
      console.error('🆓 Failed to create trial:', err.message);
    }

    const trialEndStr = trialSub
      ? new Date(trialSub.end_date).toLocaleDateString('es-AR')
      : null;

    if (syncResult && syncResult.total > 0) {
      // Products imported — activate business
      await db.updateBusiness(businessId, { is_active: true });
      await db.updateUserStep(phone, STEPS.COMPLETED);

      let msg = '🎉 *¡Tu negocio está activo!*\n\n' +
        `*${business.business_name}* ya está listo para recibir pedidos.\n\n` +
        `📦 Se importaron ${syncResult.total} productos desde tu catálogo.\n\n`;

      if (trialSub) {
        msg += `🆓 *Prueba gratuita activada: Plan ${trialSub.plan.name}*\n` +
          `Tenés 30 días gratis con IA, resumen diario, promos y más.\n` +
          `Vence: ${trialEndStr}\n\n`;
      }

      msg += '🤖 *Soy tu asistente.* Podés preguntarme lo que necesites de forma natural:\n' +
        '• "Quiero cambiar el horario"\n' +
        '• "Cuántos pedidos tengo?"\n' +
        '• "Cómo agrego un producto?"\n\n' +
        '📋 Para pausar un producto: *PAUSAR PRODUCTO*\n' +
        '📋 Para confirmar un pago: *CONFIRMAR PAGO #N*\n\n' +
        'Escribí *AYUDA* en cualquier momento para ver más opciones.';

      return sendMessage(pc, phone, msg);
    }

    // No products synced — keep inactive, wait for manual sync
    await db.updateUserStep(phone, STEPS.COMPLETED);

    let msg = '✅ *¡Configuración completada!*\n\n' +
      `*${business.business_name}* quedó registrado correctamente.\n\n`;

    if (trialSub) {
      msg += `🆓 *Prueba gratuita activada: Plan ${trialSub.plan.name}*\n` +
        `Tenés 30 días gratis con IA, resumen diario, promos y más.\n` +
        `Vence: ${trialEndStr}\n\n`;
    }

    msg += '⚠️ No pudimos importar productos del catálogo automáticamente. ' +
      'El administrador de la plataforma los importará manualmente. ' +
      'Te avisaremos cuando tu negocio esté listo para recibir pedidos.\n\n' +
      '🤖 Mientras tanto, podés preguntarme lo que necesites.\n' +
      'Escribí *AYUDA* para ver las opciones disponibles.';

    return sendMessage(pc, phone, msg);
  }

  if (normalized === 'EDITAR') {
    return sendEditMenu(pc, phone);
  }

  // Handle edit selection (1-6)
  const editMap = { '1': STEPS.BUSINESS_NAME, '2': STEPS.BUSINESS_HOURS, '3': STEPS.DELIVERY_METHOD, '4': STEPS.PAYMENT_METHODS, '5': STEPS.DELIVERY_ZONES, '6': STEPS.BANK_DATA };
  const editPrompts = {
    '1': '¿Cuál es el nuevo nombre de tu negocio?',
    '2': '¿Cuál es tu nuevo horario de atención?\nEj: Lunes a Viernes 11:00-23:00, Sábados 12:00-24:00',
    '3': '¿Cómo entregás los pedidos?\n\n1️⃣ Delivery\n2️⃣ Retiro en local\n3️⃣ Ambos',
    '4': '¿Qué métodos de pago aceptás?\n\n1️⃣ Solo efectivo\n2️⃣ Solo transferencia bancaria\n3️⃣ Ambos (efectivo y transferencia)\n4️⃣ Ambos + seña (depósito parcial por transferencia)',
    '5': 'Escribí tus zonas de delivery con el precio de cada una.\nEj: Centro $500, Norte $800, Macrocentro $600',
    '6': 'Necesito tus datos bancarios:\n• Alias\n• CBU/CVU\n• Titular de la cuenta',
  };

  const option = text.trim();
  if (editMap[option]) {
    await db.updateUserStep(phone, editMap[option]);
    return sendMessage(pc, phone, editPrompts[option]);
  }

  return sendButtons(pc, phone, '¿Qué querés hacer?',
    [
      { id: 'CONFIRMAR', title: 'Confirmar' },
      { id: 'EDITAR', title: 'Editar' },
    ]
  );
}

function sendEditMenu(pc, phone) {
  return sendList(pc, phone, '¿Qué querés modificar?', 'Ver opciones', [
    {
      title: 'Configuración',
      rows: [
        { id: '1', title: 'Nombre' },
        { id: '2', title: 'Horario' },
        { id: '3', title: 'Entrega', description: 'Delivery / retiro en local' },
        { id: '4', title: 'Métodos de pago' },
        { id: '5', title: 'Zonas de delivery' },
        { id: '6', title: 'Datos bancarios' },
      ],
    },
  ]);
}

// ══════════════════════════════════════
// POST-ONBOARDING COMMAND HANDLER
// ══════════════════════════════════════

async function handleCommand(pc, phone, text, businessId) {
  // 0. Check subscription expiry — notify admin but allow subscription commands
  const activeSub = await subscription.getActiveSubscription(businessId);
  const normalizedUpper = text.trim().toUpperCase();
  const isSubCommand = /^(PLAN|PLANES|RENOVAR|CAMBIAR\s+PLAN)/i.test(normalizedUpper);
  const isSuperAdmin = phone === config.alertPhone;

  if (!activeSub && !isSubCommand && !isSuperAdmin) {
    await sendMessage(pc, phone,
      '⚠️ *Tu suscripción expiró.*\n\n' +
      'Tus clientes no pueden hacer pedidos hasta que renueves.\n' +
      'Enviá *PLAN* para ver tu estado o *RENOVAR* para pagar.'
    );
    return;
  }

  // 1. Try exact commands first (order commands with #N need precision)
  const parsed = parseCommand(text);

  if (parsed) {
    const business = await db.getBusinessById(businessId);
    return executeIntent(pc, phone, parsed.command.toLowerCase(), parsed.args || {}, business, businessId);
  }

  // 2. Check if AI is enabled for this business's plan
  const hasAI = await subscription.checkFeatureAccess(businessId, 'ai_enabled');
  const business = await db.getBusinessById(businessId);

  if (!hasAI) {
    // Basic plan: no AI — respond with unrecognized command message
    return sendMessage(pc, phone,
      '⚠️ Comando no reconocido. Enviá *AYUDA* para ver los comandos disponibles.'
    );
  }

  // 3. AI-enabled plan — use AI to classify intent
  console.log(`🤖 AI intent classification for: "${text.substring(0, 80)}"`);
  const { intent, args } = await ai.classifyAdminIntent(text);
  console.log(`🤖 AI classified intent: ${intent}`, args || '');

  // 4. Handle AI-classified intents
  if (intent === 'general_question' || intent === 'help') {
    const context = await buildBusinessContext(businessId, business);
    const answer = await ai.answerAdminQuestion(text, context);
    return sendMessage(pc, phone, answer);
  }

  if (intent === 'greeting') {
    return sendMessage(pc, phone,
      `👋 ¡Hola! Soy tu asistente de *${business.business_name}*.\n\n` +
      'Preguntame lo que necesites o escribí *AYUDA* para ver ejemplos.'
    );
  }

  // Map AI intents to existing actions
  return executeIntent(pc, phone, intent, args || {}, business, businessId);
}

/**
 * Execute a classified intent (from exact command or AI classification).
 */
async function executeIntent(pc, phone, intent, args, business, businessId) {
  switch (intent) {
    case 'ayuda': {
      const sub = await subscription.getActiveSubscription(businessId);
      const hasAI = sub?.plan?.ai_enabled || false;
      return sendMessage(pc, phone, helpText(hasAI));
    }

    case 'add_product': {
      const contactPhone = config.alertPhone || 'soporte';
      return sendMessage(pc, phone,
        '📦 *Agregar producto al catálogo*\n\n' +
        'Para agregar un producto nuevo, envianos la siguiente info a:\n' +
        `📲 *${contactPhone}*\n\n` +
        '• Nombre del producto\n' +
        '• Precio\n' +
        '• Descripción (opcional)\n' +
        '• Foto del producto\n\n' +
        'Nosotros lo cargamos en tu catálogo y queda listo para que tus clientes lo vean.'
      );
    }

    case 'edit_name': {
      await db.updateUserStep(phone, STEPS.EDIT_NAME);
      return sendMessage(pc, phone, `Tu nombre actual es: *${business.business_name}*\n\nEscribí el nuevo nombre:`);
    }
    case 'edit_hours': {
      await db.updateUserStep(phone, STEPS.EDIT_HOURS);
      return sendMessage(pc, phone, `Tu horario actual: *${business.business_hours}*\n\nEscribí el nuevo horario:`);
    }
    case 'edit_address': {
      await db.updateUserStep(phone, STEPS.EDIT_ADDRESS);
      return sendMessage(pc, phone, `Tu dirección actual: *${business.business_address || 'No configurada'}*\n\nEscribí la nueva dirección:`);
    }
    case 'edit_delivery': {
      await db.updateUserStep(phone, STEPS.EDIT_DELIVERY);
      const lines = ['Tu configuración actual:'];
      lines.push(`• 🚚 Delivery: ${business.has_delivery ? 'Sí' : 'No'}`);
      lines.push(`• 🏪 Retiro en local: ${business.has_pickup ? 'Sí' : 'No'}`);
      if (business.business_address) lines.push(`• 📍 Dirección: ${business.business_address}`);
      lines.push('\n¿Cómo entregás los pedidos?');
      return sendButtons(pc, phone, lines.join('\n'),
        [
          { id: '1', title: 'Delivery' },
          { id: '2', title: 'Retiro en local' },
          { id: '3', title: 'Ambos' },
        ]
      );
    }
    case 'edit_payments': {
      await db.updateUserStep(phone, STEPS.EDIT_PAYMENTS);
      return sendPaymentMethodsList(pc, phone,
        `Tu configuración actual: *${getPaymentLabel(business)}*\n\n¿Qué métodos de pago aceptás?`
      );
    }
    case 'edit_zones': {
      await db.updateUserStep(phone, STEPS.EDIT_ZONES);
      const zones = await db.getZonesByBusiness(businessId);
      let msg = '';
      if (zones.length > 0) {
        msg = 'Tus zonas actuales:\n' + zones.map((z) => `• ${z.zone_name} — $${z.price}`).join('\n') + '\n\n';
      }
      msg += 'Escribí las zonas de nuevo (esto reemplaza todas las zonas anteriores):';
      return sendMessage(pc, phone, msg);
    }
    case 'edit_bank': {
      await db.updateUserStep(phone, STEPS.EDIT_BANK);
      const bank = await db.getBankDetails(businessId);
      let msg = '';
      if (bank) {
        msg = 'Tus datos bancarios actuales:\n' +
          `• Alias: ${bank.alias}\n• CBU: ${bank.cbu}\n• Titular: ${bank.account_holder}\n\n`;
      }
      msg += 'Enviá los nuevos datos (alias, CBU/CVU y titular):';
      return sendMessage(pc, phone, msg);
    }
    case 'sync_catalog': {
      return handleSyncCatalog(pc, phone, business);
    }
    case 'pause_product': {
      await db.updateUserStep(phone, STEPS.PAUSE_PRODUCT);
      const products = await db.getProductsByBusiness(businessId);
      if (products.length === 0) {
        await db.updateUserStep(phone, STEPS.COMPLETED);
        return sendMessage(pc, phone, '📦 Tu menú está vacío.');
      }
      if (products.length <= 10) {
        return sendProductList(pc, phone, products, '📦 ¿Qué producto querés pausar/activar?', 'Elegir producto');
      }
      // Too many products for interactive list — ask admin to type the name
      return sendMessage(pc, phone,
        '📦 *¿Qué producto querés pausar/activar?*\n\n' +
        'Escribí el nombre del producto (ej: "pizza muzzarella").\n\n' +
        'Escribí *CANCELAR* para salir.'
      );
    }
    case 'edit_product': {
      await db.updateUserStep(phone, STEPS.EDIT_PRODUCT_SELECT);
      const products = await db.getProductsByBusiness(businessId);
      if (products.length === 0) {
        await db.updateUserStep(phone, STEPS.COMPLETED);
        return sendMessage(pc, phone, '📦 Tu menú está vacío.');
      }
      if (products.length <= 10) {
        return sendProductList(pc, phone, products, '✏️ *¿Qué producto querés editar?*', 'Elegir producto');
      }
      return sendMessage(pc, phone,
        '✏️ *¿Qué producto querés editar?*\n\n' +
        'Escribí el nombre del producto (ej: "pizza muzzarella").\n\n' +
        'Escribí *CANCELAR* para salir.'
      );
    }
    case 'view_menu':
      return sendMessage(pc, phone, await buildViewMenu(businessId));
    case 'view_business':
      return sendMessage(pc, phone, await buildViewBusiness(businessId));

    // ── Order management commands ──
    case 'view_orders':
      return handleViewOrders(pc, phone, businessId);
    case 'view_order':
      return handleViewOrder(pc, phone, businessId, args.orderNumber);
    case 'order_status':
      return handleOrderStatus(pc, phone, businessId, args.orderNumber, args.status);
    case 'confirm_payment':
      return handleConfirmPayment(pc, phone, businessId, args.orderNumber);
    case 'reject_order':
      return handleRejectOrder(pc, phone, businessId, args.orderNumber, args.reason);
    case 'sales_summary': {
      const period = args.period || 'hoy';
      return handleSalesSummary(pc, phone, businessId, period);
    }

    // ── Subscription commands ──
    case 'view_plan': {
      const sub = await subscription.getActiveSubscription(businessId);
      let text = subscription.formatPlanInfo(sub);
      if (sub?.plan) {
        const month = new Date().toISOString().slice(0, 7);
        const countRow = await db.getMonthlyOrderCount(businessId, month);
        const current = countRow ? countRow.order_count : 0;
        const limit = sub.plan.monthly_order_limit;
        text += `\n\n📊 *Uso este mes:* ${current}/${limit || '∞'} pedidos`;
      }
      return sendMessage(pc, phone, text);
    }
    case 'view_plans': {
      const plans = await db.getSubscriptionPlans();
      return sendMessage(pc, phone, subscription.formatPlansComparison(plans));
    }
    case 'renew': {
      const sub = await subscription.getActiveSubscription(businessId);
      const plans = await db.getSubscriptionPlans();
      let msg = '💳 *Renovar Suscripción*\n\n';
      if (sub?.plan) {
        msg += `Tu plan actual: *${sub.plan.name}* (vence ${new Date(sub.end_date).toLocaleDateString('es-AR')})\n\n`;
      }
      msg += '*Planes disponibles:*\n';
      for (const p of plans) {
        msg += `• *${p.name}* — $${p.price_usd} USD/mes\n`;
      }
      msg += '\n*Para pagar:*\n';
      msg += '1. Transferí el monto a:\n';
      msg += `   📲 Contactá al soporte: ${config.alertPhone || 'No configurado'}\n`;
      msg += '2. Enviá el comprobante de pago\n';
      msg += '3. Indicá qué plan querés\n\n';
      msg += 'O enviá *CAMBIAR PLAN basico/intermedio/pro* para solicitar un cambio.';
      return sendMessage(pc, phone, msg);
    }
    case 'change_plan': {
      const { planSlug } = args;
      if (!planSlug) {
        const plans = await db.getSubscriptionPlans();
        let msg = '📋 *¿A qué plan querés cambiar?*\n\n';
        for (const p of plans) {
          msg += `• *${p.name}* — $${p.price_usd} USD/mes\n`;
        }
        msg += '\nEscribí *CAMBIAR PLAN basico*, *CAMBIAR PLAN intermedio* o *CAMBIAR PLAN pro*';
        return sendMessage(pc, phone, msg);
      }
      const plan = await db.getPlanBySlug(planSlug);
      if (!plan) {
        return sendMessage(pc, phone, '⚠️ Plan no encontrado. Opciones: *basico*, *intermedio*, *pro*');
      }
      // Notify super-admin about plan change request
      if (config.alertPhone) {
        const biz = business || await db.getBusinessById(businessId);
        await sendMessage(pc, config.alertPhone,
          `📋 *Solicitud de cambio de plan*\n\n` +
          `Negocio: ${biz.business_name}\n` +
          `Admin: ${phone}\n` +
          `Plan solicitado: *${plan.name}* ($${plan.price_usd} USD/mes)\n\n` +
          `Para activar: *CONFIRMAR PAGO ${phone} ${planSlug}*`
        );
      }
      return sendMessage(pc, phone,
        `✅ *Solicitud enviada*\n\n` +
        `Plan: *${plan.name}* — $${plan.price_usd} USD/mes\n\n` +
        `Nuestro equipo procesará tu solicitud. ` +
        `Si ya transferiste, enviá el comprobante y lo activamos.`
      );
    }

    // ── Promo code commands (Intermediate + Pro) ──
    case 'create_promo': {
      const hasPromos = await subscription.checkFeatureAccess(businessId, 'promo_codes');
      if (!hasPromos) {
        return sendMessage(pc, phone, '⚠️ Los códigos de descuento están disponibles en los planes *Intermedio* y *Pro*.\nEnviá *PLANES* para ver opciones.');
      }
      const { code, discountType, discountValue, maxUses } = args || {};
      if (!code || !discountType || !discountValue) {
        return sendMessage(pc, phone,
          '🎟️ *Crear código de descuento*\n\n' +
          'Formato: *CREAR PROMO código 10%* o *CREAR PROMO código $500*\n' +
          'Opcional: agregar límite de usos al final\n\n' +
          'Ejemplos:\n' +
          '• *CREAR PROMO VERANO 10%*\n' +
          '• *CREAR PROMO AMIGOS $500 50*'
        );
      }
      try {
        const promo = await promos.createPromo(businessId, code, discountType, discountValue, maxUses);
        const discountLabel = discountType === 'percent' ? `${discountValue}%` : `$${discountValue}`;
        const usesLabel = maxUses ? `${maxUses} usos máx.` : 'Usos ilimitados';
        return sendMessage(pc, phone,
          `✅ *Promo creada*\n\n` +
          `Código: *${promo.code}*\n` +
          `Descuento: ${discountLabel}\n` +
          `${usesLabel}`
        );
      } catch (err) {
        if (err.code === '23505') {
          return sendMessage(pc, phone, `⚠️ Ya existe un código *${code}* para tu negocio.`);
        }
        throw err;
      }
    }
    case 'view_promos': {
      const hasPromos = await subscription.checkFeatureAccess(businessId, 'promo_codes');
      if (!hasPromos) {
        return sendMessage(pc, phone, '⚠️ Los códigos de descuento están disponibles en los planes *Intermedio* y *Pro*.\nEnviá *PLANES* para ver opciones.');
      }
      const activePromos = await promos.getActivePromos(businessId);
      return sendMessage(pc, phone, promos.formatPromoList(activePromos));
    }

    // ── Analytics ──
    case 'analytics': {
      const limit = await analytics.checkAnalyticsLimit(businessId);
      if (!limit.allowed) {
        if (limit.limit === 0) {
          return sendMessage(pc, phone, '⚠️ Las consultas analytics están disponibles en los planes *Intermedio* y *Pro*.\nEnviá *PLANES* para ver opciones.');
        }
        return sendMessage(pc, phone,
          `⚠️ Alcanzaste tu límite de consultas analytics este mes (${limit.current}/${limit.limit}).\n` +
          `Enviá *PLANES* para ver opciones de upgrade.`
        );
      }
      const report = await analytics.buildFullReport(businessId);
      await analytics.incrementUsage(businessId);
      const remaining = limit.limit ? `\n\n📊 Consultas restantes: ${limit.limit - limit.current - 1}/${limit.limit}` : '';
      return sendMessage(pc, phone, report + remaining);
    }

    case 'trends': {
      const hasTrends = await subscription.checkFeatureAccess(businessId, 'trends');
      if (!hasTrends) {
        return sendMessage(pc, phone, '⚠️ Las tendencias están disponibles en el plan *Pro*.\nEnviá *PLANES* para ver opciones.');
      }
      const trendsReport = await analytics.buildTrendsReport(businessId);
      return sendMessage(pc, phone, trendsReport);
    }

    // ── Scheduled messages (Pro only) ──
    case 'schedule_message': {
      const hasScheduled = await subscription.checkFeatureAccess(businessId, 'scheduled_messages');
      if (!hasScheduled) {
        return sendMessage(pc, phone, '⚠️ Los mensajes programados están disponibles en el plan *Pro*.\nEnviá *PLANES* para ver opciones.');
      }
      const { day, month: m, hour, minute, message: msgText } = args;
      if (!msgText || msgText.length < 3) {
        return sendMessage(pc, phone, '⚠️ Formato: *PROGRAMAR MENSAJE dd/mm HH:MM tu mensaje*\nEj: PROGRAMAR MENSAJE 20/02 18:00 ¡Hoy tenemos promo 2x1!');
      }
      const year = new Date().getFullYear();
      const sendAt = new Date(year, m - 1, day, hour, minute);
      if (sendAt <= new Date()) {
        return sendMessage(pc, phone, '⚠️ La fecha debe ser en el futuro.');
      }
      const customers = await db.getUniqueCustomerPhones(businessId);
      if (customers.length === 0) {
        return sendMessage(pc, phone, '⚠️ No tenés clientes aún. Los mensajes se envían a clientes que hayan hecho pedidos.');
      }
      const scheduled = await db.createScheduledMessage(businessId, msgText, customers, sendAt);
      const dateStr = sendAt.toLocaleString('es-AR', { timeZone: config.timezone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return sendMessage(pc, phone,
        `✅ *Mensaje programado*\n\n` +
        `📅 Envío: ${dateStr}\n` +
        `👥 Destinatarios: ${customers.length} clientes\n` +
        `💬 Mensaje: "${msgText}"`
      );
    }
    case 'view_scheduled': {
      const hasScheduled = await subscription.checkFeatureAccess(businessId, 'scheduled_messages');
      if (!hasScheduled) {
        return sendMessage(pc, phone, '⚠️ Los mensajes programados están disponibles en el plan *Pro*.\nEnviá *PLANES* para ver opciones.');
      }
      const pending = await db.getScheduledMessagesByBusiness(businessId);
      if (pending.length === 0) {
        return sendMessage(pc, phone, '📅 No tenés mensajes programados.');
      }
      let msg = '📅 *Mensajes programados:*\n\n';
      for (const m of pending) {
        const dateStr = new Date(m.send_at).toLocaleString('es-AR', { timeZone: config.timezone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const phones = m.recipient_phones || [];
        msg += `• ${dateStr} — ${phones.length} destinatarios\n  "${m.message.substring(0, 50)}${m.message.length > 50 ? '...' : ''}"\n\n`;
      }
      return sendMessage(pc, phone, msg);
    }

    // ── Broadcast (Pro only) ──
    case 'broadcast': {
      const hasBroadcasts = await subscription.checkFeatureAccess(businessId, 'broadcasts');
      if (!hasBroadcasts) {
        return sendMessage(pc, phone, '⚠️ Las difusiones están disponibles en el plan *Pro*.\nEnviá *PLANES* para ver opciones.');
      }
      const { message: broadcastMsg } = args || {};
      if (!broadcastMsg || broadcastMsg.length < 3) {
        return sendMessage(pc, phone,
          '📢 *Enviar difusión a todos tus clientes*\n\n' +
          'Formato: *DIFUSION tu mensaje aquí*\n' +
          'Ej: *DIFUSION ¡Hoy tenemos promo 2x1 en pizzas!*'
        );
      }
      const customers = await db.getUniqueCustomerPhones(businessId);
      if (customers.length === 0) {
        return sendMessage(pc, phone, '⚠️ No tenés clientes aún. Las difusiones se envían a clientes que hayan hecho pedidos.');
      }
      await sendMessage(pc, phone, `📢 Enviando difusión a ${customers.length} clientes...`);

      const biz = business || await db.getBusinessById(businessId);
      const fullMsg = `📢 *${biz.business_name}*\n\n${broadcastMsg}`;
      let sentCount = 0;
      let failedCount = 0;

      for (const custPhone of customers) {
        try {
          // Try free-form message first (works within 24h window)
          await sendMessage(pc, custPhone, fullMsg);
          sentCount++;
        } catch (err) {
          // Outside 24h window — try template as fallback
          try {
            await sendTemplate(pc, custPhone);
            sentCount++;
          } catch (templateErr) {
            console.error(`❌ Broadcast failed for ${custPhone}:`, templateErr.message);
            failedCount++;
          }
        }
      }

      return sendMessage(pc, phone,
        `✅ *Difusión completada*\n\n` +
        `📨 Enviados: ${sentCount}/${customers.length}\n` +
        (failedCount > 0 ? `❌ Fallidos: ${failedCount}\n` : '') +
        `💬 "${broadcastMsg.substring(0, 80)}${broadcastMsg.length > 80 ? '...' : ''}"`
      );
    }

    // ── Loyalty (Pro only) ──
    case 'configure_loyalty': {
      const hasLoyalty = await subscription.checkFeatureAccess(businessId, 'loyalty');
      if (!hasLoyalty) {
        return sendMessage(pc, phone, '⚠️ El programa de fidelización está disponible en el plan *Pro*.\nEnviá *PLANES* para ver opciones.');
      }
      const { threshold, rewardType, rewardValue } = args || {};
      if (!threshold || threshold < 2) {
        return sendMessage(pc, phone,
          '⚠️ Formato: *CONFIGURAR FIDELIDAD N pedidos = recompensa*\n\n' +
          'Ejemplos:\n' +
          '• *CONFIGURAR FIDELIDAD 10 pedidos = 1 gratis*\n' +
          '• *CONFIGURAR FIDELIDAD 5 pedidos = 15%*\n' +
          '• *CONFIGURAR FIDELIDAD 8 pedidos = $500*'
        );
      }
      await db.upsertLoyaltyConfig(businessId, threshold, rewardType, rewardValue);
      const label = loyalty.formatRewardLabel({ threshold, reward_type: rewardType, reward_value: rewardValue });
      return sendMessage(pc, phone,
        `✅ *Programa de fidelidad configurado*\n\n🏆 ${label}\n\n` +
        'Los clientes acumulan pedidos automáticamente y reciben su recompensa al alcanzar la meta.'
      );
    }
    case 'view_loyalty': {
      const hasLoyalty = await subscription.checkFeatureAccess(businessId, 'loyalty');
      if (!hasLoyalty) {
        return sendMessage(pc, phone, '⚠️ El programa de fidelización está disponible en el plan *Pro*.\nEnviá *PLANES* para ver opciones.');
      }
      const loyaltyConfig = await db.getLoyaltyConfig(businessId);
      if (!loyaltyConfig) {
        return sendMessage(pc, phone,
          '🏆 No tenés un programa de fidelidad configurado.\n\n' +
          'Configuralo con: *CONFIGURAR FIDELIDAD 10 pedidos = 1 gratis*'
        );
      }
      const label = loyalty.formatRewardLabel(loyaltyConfig);
      return sendMessage(pc, phone,
        `🏆 *Programa de fidelidad*\n\n` +
        `Regla: ${label}\n\n` +
        'Los clientes acumulan pedidos automáticamente.'
      );
    }

    // ── Super-admin commands (ALERT_PHONE only) ──
    case 'super_confirm_payment': {
      if (phone !== config.alertPhone) {
        return sendMessage(pc, phone, '⚠️ Este comando es solo para el administrador de la plataforma.');
      }
      const { adminPhone, planSlug } = args;
      const targetBiz = await db.getBusinessByAdminPhone(adminPhone);
      if (!targetBiz) {
        return sendMessage(pc, phone, `⚠️ No se encontró negocio con el teléfono ${adminPhone}`);
      }
      const activated = await subscription.confirmPayment(targetBiz.id, planSlug, 1);
      return sendMessage(pc, phone,
        `✅ *Suscripción activada*\n\n` +
        `Negocio: ${targetBiz.business_name}\n` +
        `Plan: *${activated.plan.name}* ($${activated.plan.price_usd} USD/mes)\n` +
        `Vence: ${new Date(activated.end_date).toLocaleDateString('es-AR')}\n` +
        `Admin: ${adminPhone}`
      );
    }
    case 'view_subscriptions': {
      if (phone !== config.alertPhone) {
        return sendMessage(pc, phone, '⚠️ Este comando es solo para el administrador de la plataforma.');
      }
      const businesses = await db.getAllBusinessesWithSubscriptions();
      if (businesses.length === 0) {
        return sendMessage(pc, phone, '📋 No hay negocios registrados.');
      }
      let msg = '📋 *Suscripciones*\n\n';
      for (const biz of businesses) {
        const sub = biz.subscription;
        const planName = sub?.plan?.name || 'Sin plan';
        const status = sub?.status || 'none';
        const endStr = sub?.end_date ? new Date(sub.end_date).toLocaleDateString('es-AR') : '—';
        msg += `*${biz.business_name}*\n`;
        msg += `  Plan: ${planName} | Estado: ${status} | Vence: ${endStr}\n`;
        msg += `  Tel: ${biz.admin_phone}\n\n`;
      }
      return sendMessage(pc, phone, msg);
    }
    case 'view_expired': {
      if (phone !== config.alertPhone) {
        return sendMessage(pc, phone, '⚠️ Este comando es solo para el administrador de la plataforma.');
      }
      const { expired, expiringSoon } = await db.getExpiringSubscriptions(7);
      let msg = '⚠️ *Suscripciones expiradas y por vencer*\n\n';
      if (expired.length === 0 && expiringSoon.length === 0) {
        return sendMessage(pc, phone, '✅ No hay suscripciones expiradas ni por vencer.');
      }
      if (expired.length > 0) {
        msg += '❌ *Expiradas:*\n';
        for (const s of expired) {
          const bizName = s.business?.business_name || 'Desconocido';
          const adminPh = s.business?.admin_phone || '?';
          msg += `• ${bizName} — venció ${new Date(s.end_date).toLocaleDateString('es-AR')} (${adminPh})\n`;
        }
        msg += '\n';
      }
      if (expiringSoon.length > 0) {
        msg += '⏳ *Vencen pronto (7 días):*\n';
        for (const s of expiringSoon) {
          const bizName = s.business?.business_name || 'Desconocido';
          const adminPh = s.business?.admin_phone || '?';
          msg += `• ${bizName} — vence ${new Date(s.end_date).toLocaleDateString('es-AR')} (${adminPh})\n`;
        }
      }
      return sendMessage(pc, phone, msg);
    }

    default: {
      // Unknown intent — answer as general question
      const context = await buildBusinessContext(businessId, business);
      const answer = await ai.answerAdminQuestion('', context);
      return sendMessage(pc, phone, answer);
    }
  }
}

/**
 * Build business context string for AI general question handler.
 */
async function buildBusinessContext(businessId, business) {
  const zones = await db.getZonesByBusiness(businessId);
  const bank = await db.getBankDetails(businessId);
  const products = await db.getProductsByBusiness(businessId);
  const active = products.filter((p) => p.is_available).length;
  const paused = products.filter((p) => !p.is_available).length;

  const lines = [];
  lines.push(`Nombre: ${business.business_name}`);
  lines.push(`Horario: ${business.business_hours}`);
  if (business.business_address) lines.push(`Dirección: ${business.business_address}`);
  lines.push(`Delivery: ${business.has_delivery ? 'Sí' : 'No'}`);
  lines.push(`Retiro en local: ${business.has_pickup ? 'Sí' : 'No'}`);
  if (zones.length > 0) {
    lines.push(`Zonas de delivery: ${zones.map((z) => `${z.zone_name} $${z.price}`).join(', ')}`);
  }
  lines.push(`Pagos: ${getPaymentLabel(business)}`);
  if (bank) lines.push(`Banco: Alias ${bank.alias}, Titular ${bank.account_holder}`);
  lines.push(`Productos: ${active} activos, ${paused} pausados`);
  lines.push(`Estado: ${business.is_active ? 'Activo' : 'Inactivo'}`);

  return lines.join('\n');
}

// ══════════════════════════════════════
// EDIT-MODE STEP HANDLERS
// ══════════════════════════════════════

async function handleEditName(pc, phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '❌ Edición cancelada.');
  }
  if (!text || text.trim().length === 0) {
    return sendMessage(pc, phone, '⚠️ El nombre no puede estar vacío. Escribí el nuevo nombre o *CANCELAR* para salir.');
  }
  const name = text.trim();
  await db.updateBusiness(businessId, { business_name: name });
  await db.updateUserStep(phone, STEPS.COMPLETED);
  return sendMessage(pc, phone, `✅ Nombre actualizado: *${name}*`);
}

async function handleEditHours(pc, phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '❌ Edición cancelada.');
  }
  const parsed = await parseHours(text);
  if (!parsed) {
    return sendMessage(pc, phone, '🤔 No pude interpretar el horario. Probá con un formato como:\n"Lunes a Viernes 11:00-23:00, Sábados 12:00-24:00"\n\nO escribí *CANCELAR* para salir.');
  }
  await db.updateBusiness(businessId, { business_hours: parsed });
  await db.updateUserStep(phone, STEPS.COMPLETED);
  return sendMessage(pc, phone, `✅ Horario actualizado: *${parsed}*`);
}

async function handleEditHoursConfirm(pc, phone, text, businessId) {
  // Not used in edit mode — edit hours saves directly
  return handleEditHours(pc, phone, text, businessId);
}

async function handleEditDelivery(pc, phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '❌ Edición cancelada.');
  }
  const option = text.trim();
  if (option === '1') {
    await db.updateBusiness(businessId, { has_delivery: true, has_pickup: false });
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '✅ Actualizado: solo delivery (sin retiro en local).');
  }
  if (option === '2') {
    await db.updateBusiness(businessId, { has_delivery: false, has_pickup: true });
    await db.updateUserStep(phone, STEPS.EDIT_ADDRESS);
    return sendMessage(pc, phone, '¿Cuál es la dirección de tu local?');
  }
  if (option === '3') {
    await db.updateBusiness(businessId, { has_delivery: true, has_pickup: true });
    await db.updateUserStep(phone, STEPS.EDIT_ADDRESS);
    return sendMessage(pc, phone, '¿Cuál es la dirección de tu local? (para retiro en local)');
  }
  return sendButtons(pc, phone, '⚠️ Elegí una opción (o escribí *CANCELAR*):',
    [
      { id: '1', title: 'Delivery' },
      { id: '2', title: 'Retiro en local' },
      { id: '3', title: 'Ambos' },
    ]
  );
}

async function handleEditAddress(pc, phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '❌ Edición cancelada.');
  }
  if (!text || text.trim().length === 0) {
    return sendMessage(pc, phone, '⚠️ La dirección no puede estar vacía. Escribí la dirección o *CANCELAR*.');
  }
  await db.updateBusiness(businessId, { business_address: text.trim() });
  await db.updateUserStep(phone, STEPS.COMPLETED);
  return sendMessage(pc, phone, `✅ Dirección actualizada: *${text.trim()}*`);
}

async function handleEditPayments(pc, phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '❌ Edición cancelada.');
  }
  const selected = PAYMENT_OPTIONS[text.trim()];
  if (!selected) {
    return sendPaymentMethodsList(pc, phone, '⚠️ Elegí una opción (o escribí *CANCELAR*):');
  }
  const { label, ...fields } = selected;
  await db.updateBusiness(businessId, fields);

  // If option 4 (with deposit), ask for percentage
  if (text.trim() === '4') {
    await db.updateUserStep(phone, STEPS.EDIT_DEPOSIT_PERCENT);
    return sendMessage(pc, phone,
      `✅ Métodos de pago: *${label}*\n\n` +
      '¿Qué porcentaje de seña pedís? (ej: 30, 50)\n\nO escribí *CANCELAR* para salir.'
    );
  }

  // Clear deposit_percent if switching away from option 4
  await db.updateBusiness(businessId, { deposit_percent: null });
  await db.updateUserStep(phone, STEPS.COMPLETED);
  return sendMessage(pc, phone, `✅ Métodos de pago actualizados: *${label}*`);
}

async function handleEditDepositPercent(pc, phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '❌ Edición cancelada.');
  }
  const num = parseInt(text.trim(), 10);
  if (isNaN(num) || num < 1 || num > 100) {
    return sendMessage(pc, phone, '⚠️ Ingresá un número entre 1 y 100 (ej: 30, 50):\n\nO escribí *CANCELAR* para salir.');
  }
  await db.updateBusiness(businessId, { deposit_percent: num });
  const business = await db.getBusinessById(businessId);
  await db.updateUserStep(phone, STEPS.COMPLETED);
  return sendMessage(pc, phone, `✅ Métodos de pago actualizados: *${getPaymentLabel(business)}*`);
}

async function handleEditZones(pc, phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '❌ Edición cancelada.');
  }
  const zones = await parseZones(text);
  if (!zones) {
    return sendMessage(pc, phone, '⚠️ Necesito el precio para cada zona. Probá así:\n"Centro $500, Almagro $600, Caballito $800"\n\nO escribí *CANCELAR* para salir.');
  }

  // Check zone limit
  const sub = await subscription.getActiveSubscription(businessId);
  const zoneLimit = sub?.plan?.delivery_zone_limit || 3;
  if (zones.length > zoneLimit) {
    return sendMessage(pc, phone,
      `⚠️ Tu plan permite hasta *${zoneLimit}* zonas de delivery. ` +
      `Estás intentando agregar ${zones.length}.\n\n` +
      `Enviá *PLANES* para ver opciones de upgrade.`
    );
  }

  await db.replaceZones(businessId, zones);
  await db.updateUserStep(phone, STEPS.COMPLETED);
  const zoneLines = zones.map((z) => `• ${z.zone_name} — $${z.price}`).join('\n');
  return sendMessage(pc, phone, `✅ Zonas actualizadas:\n${zoneLines}`);
}

async function handleEditZonesConfirm(pc, phone, text, businessId) {
  return handleEditZones(pc, phone, text, businessId);
}

async function handleEditBank(pc, phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '❌ Edición cancelada.');
  }
  const result = await parseBankData(text);
  if (!result) return sendMessage(pc, phone, '⚠️ No pude interpretar los datos. Enviá todos los datos juntos:\nAlias, CBU/CVU y Titular.\n\nO escribí *CANCELAR* para salir.');

  const missing = [];
  if (!result.alias) missing.push('• Alias');
  if (!result.cbu) missing.push('• CBU/CVU');
  if (!result.account_holder) missing.push('• Titular de la cuenta');

  if (missing.length > 0) {
    return sendMessage(pc, phone, '⚠️ Faltan datos obligatorios:\n' + missing.join('\n') + '\n\nEnviá todos los datos juntos:\nAlias, CBU/CVU y Titular.');
  }

  await db.upsertBankDetails(businessId, result);
  await db.updateUserStep(phone, STEPS.COMPLETED);
  return sendMessage(pc, phone,
    '✅ Datos bancarios actualizados:\n' +
    `• Alias: ${result.alias}\n• CBU: ${result.cbu}\n• Titular: ${result.account_holder}`
  );
}

async function handleEditBankConfirm(pc, phone, text, businessId) {
  return handleEditBank(pc, phone, text, businessId);
}

/**
 * Send a product list as an interactive list message.
 * Falls back to text if >10 products (WhatsApp list limit).
 */
function sendProductList(pc, phone, products, body, buttonText) {
  if (products.length <= 10) {
    const grouped = {};
    for (const p of products) {
      const cat = p.category || 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    }

    let index = 0;
    const sections = Object.entries(grouped).map(([cat, items]) => ({
      title: cat,
      rows: items.map((p) => {
        index++;
        const status = p.is_available ? '' : ' (pausado)';
        return {
          id: String(index),
          title: p.name.substring(0, 24),
          description: `$${p.price}${status}`,
        };
      }),
    }));

    return sendList(pc, phone, body, buttonText, sections);
  }

  // Fallback for large menus
  const list = products.map((p, i) =>
    `${i + 1}. ${p.name} — $${p.price} (${p.category || 'General'}) ${p.is_available ? '✔️' : '⏸️'}`
  ).join('\n');
  return sendMessage(pc, phone, `${body}\n\n${list}\n\nRespondé con el número:`);
}

// ── Link Catalog ──

async function sendCatalogLinkList(pc, phone, businessId) {
  const products = await db.getProductsByBusiness(businessId);
  if (products.length === 0) {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '📦 Tu menú está vacío. Agregá productos primero.');
  }

  const unlinked = products.filter((p) => !p.retailer_id);
  const linked = products.filter((p) => p.retailer_id);

  const lines = ['📦 *Vincular productos al catálogo de WhatsApp:*\n'];

  if (linked.length > 0) {
    lines.push(`✅ Vinculados (${linked.length}):`);
    for (const p of linked) {
      lines.push(`• ${p.name} → ${p.retailer_id}`);
    }
    lines.push('');
  }

  if (unlinked.length > 0) {
    lines.push(`⏳ Sin vincular (${unlinked.length}):`);
    for (let i = 0; i < unlinked.length; i++) {
      lines.push(`${i + 1}. ${unlinked[i].name} — $${unlinked[i].price}`);
    }
    lines.push('\nRespondé con el número + Content ID:');
    lines.push('Ej: *1 f4n9eeoo6o*');
    lines.push('\nEscribí *LISTO* para salir.');
  } else {
    lines.push('✅ Todos los productos están vinculados.');
    await db.updateUserStep(phone, STEPS.COMPLETED);
  }

  return sendMessage(pc, phone, lines.join('\n'));
}

async function handleLinkCatalog(pc, phone, text, businessId) {
  const normalized = text.trim().toUpperCase();

  if (normalized === 'LISTO' || normalized === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '✅ Vinculación finalizada.');
  }

  // Parse: "1 f4n9eeoo6o" (number + retailer_id)
  const match = text.trim().match(/^(\d+)\s+(\S+)$/);
  if (!match) {
    return sendMessage(pc, phone, '⚠️ Formato: número + Content ID\nEj: *1 f4n9eeoo6o*\n\nO escribí *LISTO* para salir.');
  }

  const products = await db.getProductsByBusiness(businessId);
  const unlinked = products.filter((p) => !p.retailer_id);
  const index = parseInt(match[1], 10) - 1;
  const retailerId = match[2];

  if (index < 0 || index >= unlinked.length) {
    return sendMessage(pc, phone, `⚠️ Número inválido. Elegí entre 1 y ${unlinked.length}.`);
  }

  const product = unlinked[index];
  await db.updateProductRetailerId(product.id, retailerId);

  // Check remaining
  const remaining = unlinked.length - 1;
  if (remaining === 0) {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, `✅ *${product.name}* vinculado → ${retailerId}\n\n🎉 ¡Todos los productos están vinculados al catálogo!`);
  }

  await sendMessage(pc, phone, `✅ *${product.name}* vinculado → ${retailerId}`);
  return sendCatalogLinkList(pc, phone, businessId);
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

async function handleEditProducts(pc, phone, text, businessId) {
  const normalized = text.trim().toUpperCase();

  if (normalized === 'LISTO' || normalized === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    const products = await db.getProductsByBusiness(businessId);
    return sendMessage(pc, phone, `✅ Menú actualizado. Tu menú tiene ${products.length} productos.`);
  }

  // Handle ELIMINAR N
  const deleteMatch = normalized.match(/^ELIMINAR\s+(\d+)$/);
  if (deleteMatch) {
    const products = await db.getProductsByBusiness(businessId);
    const index = parseInt(deleteMatch[1], 10) - 1;
    if (index < 0 || index >= products.length) {
      return sendMessage(pc, phone, `⚠️ Número inválido. Elegí entre 1 y ${products.length}.`);
    }
    const product = products[index];
    await db.deleteProduct(product.id);
    return sendMessage(pc, phone, `✅ *${product.name}* eliminada del menú.\n\n` + await buildProductListForEdit(businessId));
  }

  // Try to add products with AI
  return addProductsFromText(pc, phone, text, businessId, 'Seguí editando o escribí *LISTO* para salir.');
}

// ── Delete Product (by number) ──

async function handleDeleteProduct(pc, phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '❌ Operación cancelada.');
  }

  const num = parseInt(text.trim(), 10);
  const products = await db.getProductsByBusiness(businessId);

  if (isNaN(num) || num < 1 || num > products.length) {
    return sendMessage(pc, phone, `⚠️ Respondé con un número del 1 al ${products.length}, o *CANCELAR*.`);
  }

  const product = products[num - 1];
  await db.deleteProduct(product.id);
  await db.updateUserStep(phone, STEPS.COMPLETED);
  return sendMessage(pc, phone, `✅ *${product.name}* eliminada del menú.`);
}

// ── Pause Product (by number) ──

async function handlePauseProduct(pc, phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '❌ Operación cancelada.');
  }

  const products = await db.getProductsByBusiness(businessId);
  let selected = null;

  // Try number selection first (from interactive list, ≤10 products)
  const num = parseInt(text.trim(), 10);
  if (!isNaN(num) && num >= 1 && num <= products.length) {
    selected = products[num - 1];
  }

  // Text input — fuzzy match by name (for large menus)
  if (!selected) {
    const input = text.trim().toLowerCase();
    selected = products.find((p) => p.name.toLowerCase() === input)
      || products.find((p) => p.name.toLowerCase().includes(input))
      || products.find((p) => input.includes(p.name.toLowerCase()));
  }

  if (!selected) {
    if (products.length <= 10) {
      return sendMessage(pc, phone, `⚠️ Respondé con un número del 1 al ${products.length}, o *CANCELAR*.`);
    }
    return sendMessage(pc, phone,
      '⚠️ No encontré ese producto.\n\n' +
      'Escribí el nombre tal como aparece en tu menú (ej: "pizza muzzarella").\n' +
      'Escribí *CANCELAR* para salir.'
    );
  }

  // Product is currently paused → reactivate directly (no need to ask)
  if (!selected.is_available) {
    return reactivateProduct(pc, phone, selected, businessId);
  }

  // Product is active → ask what to do
  await db.updateUserStep(phone, STEPS.PAUSE_PRODUCT_ACTION);
  pauseProductSelection.set(phone, selected.id);

  return sendButtons(pc, phone,
    `¿Qué querés hacer con *${selected.name}*?`,
    [
      { id: 'OCULTAR', title: 'Ocultar del catálogo' },
      { id: 'SIN_STOCK', title: 'Mostrar sin stock' },
      { id: 'CANCELAR', title: 'Cancelar' },
    ]
  );
}

/**
 * Handle the action choice after selecting a product to pause.
 */
async function handlePauseProductAction(pc, phone, text, businessId) {
  const normalized = text.trim().toUpperCase();

  if (normalized === 'CANCELAR') {
    pauseProductSelection.delete(phone);
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '❌ Operación cancelada.');
  }

  const productId = pauseProductSelection.get(phone);

  if (!productId) {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '⚠️ Algo salió mal. Usá *PAUSAR PRODUCTO* de nuevo.');
  }

  const products = await db.getProductsByBusiness(businessId);
  const product = products.find((p) => p.id === productId);

  if (!product) {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '⚠️ Producto no encontrado. Usá *PAUSAR PRODUCTO* de nuevo.');
  }

  if (normalized === 'OCULTAR') {
    // Hide from catalog + mark unavailable in DB
    await db.toggleProductAvailability(product.id);
    pauseProductSelection.delete(phone);
    await db.updateUserStep(phone, STEPS.COMPLETED);
    await updateCatalogVisibility(product, businessId, 'staging');
    return sendMessage(pc, phone,
      `⏸️ *${product.name}* oculto del catálogo.\n` +
      'Los clientes no lo verán ni en el menú ni en el catálogo.\n\n' +
      'Para reactivarlo, usá *PAUSAR PRODUCTO* y seleccionalo de nuevo.'
    );
  }

  if (normalized === 'SIN_STOCK') {
    // Mark as out of stock in catalog + unavailable in DB
    await db.toggleProductAvailability(product.id);
    pauseProductSelection.delete(phone);
    await db.updateUserStep(phone, STEPS.COMPLETED);
    await updateCatalogAvailability(product, businessId, 'out of stock');
    return sendMessage(pc, phone,
      `⏸️ *${product.name}* marcado como *sin stock*.\n` +
      'Los clientes lo verán en el catálogo pero no podrán pedirlo.\n\n' +
      'Para reactivarlo, usá *PAUSAR PRODUCTO* y seleccionalo de nuevo.'
    );
  }

  return sendButtons(pc, phone,
    '⚠️ Elegí una opción:',
    [
      { id: 'OCULTAR', title: 'Ocultar del catálogo' },
      { id: 'SIN_STOCK', title: 'Mostrar sin stock' },
      { id: 'CANCELAR', title: 'Cancelar' },
    ]
  );
}

/**
 * Reactivate a paused product — restore in DB + catalog.
 */
async function reactivateProduct(pc, phone, product, businessId) {
  await db.toggleProductAvailability(product.id);
  await db.updateUserStep(phone, STEPS.COMPLETED);

  // Restore in catalog: set visible + in stock
  await updateCatalogVisibility(product, businessId, 'published');
  await updateCatalogAvailability(product, businessId, 'in stock');

  return sendMessage(pc, phone,
    `✅ *${product.name}* reactivado. Ya aparecerá en el menú y en el catálogo.`
  );
}

/**
 * Update product visibility in Meta catalog (published/staging).
 */
async function updateCatalogVisibility(product, businessId, visibility) {
  if (!product.retailer_id) return;
  try {
    const business = await db.getBusinessById(businessId);
    if (!business?.phone_number_id) return;
    const phoneConfig = await db.getPhoneConfigById(business.phone_number_id);
    if (!phoneConfig?.catalogId || !phoneConfig?.token) return;
    await setProductVisibility(phoneConfig.token, phoneConfig.catalogId, product.retailer_id, visibility === 'published');
  } catch (err) {
    console.error(`📦 Failed to update catalog visibility for ${product.name}:`, err.message);
  }
}

/**
 * Update product availability in Meta catalog (in stock/out of stock).
 */
async function updateCatalogAvailability(product, businessId, availability) {
  if (!product.retailer_id) return;
  try {
    const business = await db.getBusinessById(businessId);
    if (!business?.phone_number_id) return;
    const phoneConfig = await db.getPhoneConfigById(business.phone_number_id);
    if (!phoneConfig?.catalogId || !phoneConfig?.token) return;
    await setProductAvailability(phoneConfig.token, phoneConfig.catalogId, product.retailer_id, availability);
  } catch (err) {
    console.error(`📦 Failed to update catalog availability for ${product.name}:`, err.message);
  }
}

// ══════════════════════════════════════
// ORDER MANAGEMENT COMMANDS (Phase 12)
// ══════════════════════════════════════

// Step 45: VER PEDIDOS — list pending/new orders
async function handleViewOrders(pc, phone, businessId) {
  const orders = await db.getPendingOrders(businessId);

  if (orders.length === 0) {
    return sendMessage(pc, phone, '📦 No hay pedidos pendientes.');
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
  return sendMessage(pc, phone, lines.join('\n'));
}

// Step 46: VER PEDIDO #123 — view order details
async function handleViewOrder(pc, phone, businessId, orderNumber) {
  const order = await db.getOrderByNumber(businessId, orderNumber);
  if (!order) {
    return sendMessage(pc, phone, `⚠️ No encontré el pedido #${orderNumber}.`);
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

  return sendMessage(pc, phone, lines.join('\n'));
}

// Step 47: ESTADO PEDIDO #123 preparando — change order status
async function handleOrderStatus(pc, phone, businessId, orderNumber, newStatus) {
  const validStatuses = ['preparando', 'en_camino', 'entregado', 'cancelado'];
  if (!validStatuses.includes(newStatus)) {
    return sendMessage(pc, phone,
      `⚠️ Estado inválido: "${newStatus}"\n\n` +
      'Estados válidos: *preparando*, *en_camino*, *entregado*, *cancelado*'
    );
  }

  const order = await db.getOrderByNumber(businessId, orderNumber);
  if (!order) {
    return sendMessage(pc, phone, `⚠️ No encontré el pedido #${orderNumber}.`);
  }

  if (order.order_status === 'cancelado') {
    return sendMessage(pc, phone, `⚠️ El pedido #${orderNumber} está cancelado y no se puede modificar.`);
  }
  if (order.order_status === 'entregado') {
    return sendMessage(pc, phone, `⚠️ El pedido #${orderNumber} ya fue entregado.`);
  }

  await db.updateOrderStatus(order.id, newStatus);

  const statusLabels = {
    preparando: '🍳 Preparando',
    en_camino: '🛵 En camino',
    entregado: '✅ Entregado',
    cancelado: '❌ Cancelado',
  };

  await sendMessage(pc, phone, `✅ Pedido #${orderNumber} actualizado: *${statusLabels[newStatus]}*`);

  // Notify customer of status change
  try {
    const customerStatusLabels = {
      preparando: '🍳 ¡Tu pedido se está preparando!',
      en_camino: '🛵 ¡Tu pedido está en camino!',
      entregado: '✅ ¡Tu pedido fue entregado! Gracias por tu compra.',
      cancelado: '❌ Tu pedido fue cancelado por el local.',
    };
    await sendMessage(pc, order.client_phone,
      `📦 Pedido #${orderNumber} — ${customerStatusLabels[newStatus]}`
    );
  } catch (error) {
    console.error(`❌ Failed to notify customer about status change:`, error.message);
  }
}

// Step 48: CONFIRMAR PAGO #123 — confirm transfer/deposit received
async function handleConfirmPayment(pc, phone, businessId, orderNumber) {
  const order = await db.getOrderByNumber(businessId, orderNumber);
  if (!order) {
    return sendMessage(pc, phone, `⚠️ No encontré el pedido #${orderNumber}.`);
  }

  if (order.payment_status === 'confirmed') {
    return sendMessage(pc, phone, `⚠️ El pago del pedido #${orderNumber} ya está confirmado.`);
  }

  await db.updatePaymentStatus(order.id, 'confirmed');
  await sendMessage(pc, phone, `✅ Pago confirmado para el pedido #${orderNumber}.`);

  // Notify customer
  try {
    await sendMessage(pc, order.client_phone,
      `✅ Pedido #${orderNumber} — ¡Tu pago fue confirmado! Gracias.`
    );
  } catch (error) {
    console.error(`❌ Failed to notify customer about payment confirmation:`, error.message);
  }
}

// Step 49: RECHAZAR PEDIDO #123 — reject/cancel with optional reason
async function handleRejectOrder(pc, phone, businessId, orderNumber, reason) {
  const order = await db.getOrderByNumber(businessId, orderNumber);
  if (!order) {
    return sendMessage(pc, phone, `⚠️ No encontré el pedido #${orderNumber}.`);
  }

  if (order.order_status === 'cancelado') {
    return sendMessage(pc, phone, `⚠️ El pedido #${orderNumber} ya está cancelado.`);
  }
  if (order.order_status === 'entregado') {
    return sendMessage(pc, phone, `⚠️ El pedido #${orderNumber} ya fue entregado y no se puede rechazar.`);
  }

  await db.updateOrderStatus(order.id, 'cancelado');
  await sendMessage(pc, phone, `❌ Pedido #${orderNumber} rechazado.`);

  // Notify customer
  try {
    let msg = `❌ Pedido #${orderNumber} — Tu pedido fue cancelado por el local.`;
    if (reason) {
      msg += `\nMotivo: ${reason}`;
    }
    await sendMessage(pc, order.client_phone, msg);
  } catch (error) {
    console.error(`❌ Failed to notify customer about rejection:`, error.message);
  }
}

// Step 50: VENTAS HOY/SEMANA/MES — sales summary
async function handleSalesSummary(pc, phone, businessId, period) {
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
      return sendMessage(pc, phone, '⚠️ Usá: *VENTAS HOY*, *VENTAS SEMANA* o *VENTAS MES*');
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

  return sendMessage(pc, phone, lines.join('\n'));
}

// ── EDIT PRODUCT flow (3 steps: select → choose field → enter value) ──

async function handleEditProductSelect(pc, phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    editProductSelection.delete(phone);
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '❌ Operación cancelada.');
  }

  const products = await db.getProductsByBusiness(businessId);
  let selected = null;

  const num = parseInt(text.trim(), 10);
  if (!isNaN(num) && num >= 1 && num <= products.length) {
    selected = products[num - 1];
  }

  if (!selected) {
    const input = text.trim().toLowerCase();
    selected = products.find((p) => p.name.toLowerCase() === input)
      || products.find((p) => p.name.toLowerCase().includes(input))
      || products.find((p) => input.includes(p.name.toLowerCase()));
  }

  if (!selected) {
    if (products.length <= 10) {
      return sendMessage(pc, phone, `⚠️ Respondé con un número del 1 al ${products.length}, o *CANCELAR*.`);
    }
    return sendMessage(pc, phone,
      '⚠️ No encontré ese producto.\n\n' +
      'Escribí el nombre tal como aparece en tu menú.\n' +
      'Escribí *CANCELAR* para salir.'
    );
  }

  editProductSelection.set(phone, { productId: selected.id });
  await db.updateUserStep(phone, STEPS.EDIT_PRODUCT_FIELD);

  return sendButtons(pc, phone,
    `✏️ *${selected.name}* — $${selected.price}\n${selected.description || '(sin descripción)'}\n\n¿Qué querés modificar?`,
    [
      { id: 'NOMBRE', title: 'Nombre' },
      { id: 'PRECIO', title: 'Precio' },
      { id: 'DESCRIPCION', title: 'Descripción' },
    ]
  );
}

async function handleEditProductField(pc, phone, text, businessId) {
  const normalized = text.trim().toUpperCase();

  if (normalized === 'CANCELAR') {
    editProductSelection.delete(phone);
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '❌ Operación cancelada.');
  }

  const selection = editProductSelection.get(phone);
  if (!selection) {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '⚠️ Algo salió mal. Usá *EDITAR PRODUCTO* de nuevo.');
  }

  const fieldMap = {
    'NOMBRE': 'name',
    '1': 'name',
    'PRECIO': 'price',
    '2': 'price',
    'DESCRIPCION': 'description',
    'DESCRIPCIÓN': 'description',
    '3': 'description',
  };

  const field = fieldMap[normalized];
  if (!field) {
    return sendButtons(pc, phone,
      '⚠️ Elegí una opción:',
      [
        { id: 'NOMBRE', title: 'Nombre' },
        { id: 'PRECIO', title: 'Precio' },
        { id: 'DESCRIPCION', title: 'Descripción' },
      ]
    );
  }

  selection.field = field;
  editProductSelection.set(phone, selection);
  await db.updateUserStep(phone, STEPS.EDIT_PRODUCT_VALUE);

  const prompts = {
    name: '✏️ Escribí el nuevo *nombre* del producto:',
    price: '✏️ Escribí el nuevo *precio* (solo el número, ej: 5500):',
    description: '✏️ Escribí la nueva *descripción* del producto:',
  };

  return sendMessage(pc, phone, prompts[field] + '\n\nO escribí *CANCELAR* para salir.');
}

async function handleEditProductValue(pc, phone, text, businessId) {
  if (text.trim().toUpperCase() === 'CANCELAR') {
    editProductSelection.delete(phone);
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '❌ Operación cancelada.');
  }

  const selection = editProductSelection.get(phone);
  if (!selection || !selection.field) {
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '⚠️ Algo salió mal. Usá *EDITAR PRODUCTO* de nuevo.');
  }

  const { productId, field } = selection;
  const products = await db.getProductsByBusiness(businessId);
  const product = products.find((p) => p.id === productId);

  if (!product) {
    editProductSelection.delete(phone);
    await db.updateUserStep(phone, STEPS.COMPLETED);
    return sendMessage(pc, phone, '⚠️ Producto no encontrado. Usá *EDITAR PRODUCTO* de nuevo.');
  }

  // Validate and prepare the update
  const update = {};
  let displayValue;

  if (field === 'price') {
    const price = parseFloat(text.trim().replace(/[^0-9.,]/g, '').replace(',', '.'));
    if (isNaN(price) || price <= 0) {
      return sendMessage(pc, phone, '⚠️ Ingresá un precio válido (solo números, ej: 5500).');
    }
    update.price = Math.round(price);
    displayValue = `$${update.price}`;
  } else if (field === 'name') {
    const name = text.trim();
    if (name.length < 2) {
      return sendMessage(pc, phone, '⚠️ El nombre debe tener al menos 2 caracteres.');
    }
    update.name = name;
    displayValue = name;
  } else {
    update.description = text.trim();
    displayValue = text.trim();
  }

  // Update in local DB
  await db.updateProduct(productId, update);

  // Try to update in Meta catalog too
  let catalogNote = '';
  if (product.retailer_id) {
    try {
      const business = await db.getBusinessById(businessId);
      if (business?.phone_number_id) {
        const phoneConfig = await db.getPhoneConfigById(business.phone_number_id);
        if (phoneConfig?.catalogId && phoneConfig?.token) {
          await updateProductFields(
            phoneConfig.token,
            phoneConfig.catalogId,
            product.retailer_id,
            update
          );
          catalogNote = '\n📋 Catálogo de WhatsApp actualizado.';
        }
      }
    } catch (err) {
      console.error('⚠️ Failed to update Meta catalog:', err.message);
      catalogNote = '\n⚠️ No se pudo actualizar el catálogo de WhatsApp. Los cambios se ven en el menú del bot.';
    }
  }

  editProductSelection.delete(phone);
  await db.updateUserStep(phone, STEPS.COMPLETED);

  const fieldLabels = { name: 'Nombre', price: 'Precio', description: 'Descripción' };
  return sendMessage(pc, phone,
    `✅ *${product.name}* actualizado\n\n` +
    `${fieldLabels[field]}: *${displayValue}*${catalogNote}`
  );
}

// Step: SINCRONIZAR — re-sync products from Meta catalog
async function handleSyncCatalog(pc, phone, business) {
  if (!business.phone_number_id) {
    return sendMessage(pc, phone, '⚠️ Tu negocio no tiene un número de WhatsApp vinculado.');
  }

  const phoneConfig = await db.getPhoneConfigById(business.phone_number_id);
  if (!phoneConfig?.catalogId || !phoneConfig?.token) {
    return sendMessage(pc, phone, '⚠️ No se encontró el catálogo o el token. Contactá al administrador de la plataforma.');
  }

  await sendMessage(pc, phone, '⏳ Sincronizando productos desde tu catálogo de WhatsApp...');

  try {
    const result = await syncCatalogToDatabase(business.id, phoneConfig.token, phoneConfig.catalogId);

    if (result.total === 0) {
      return sendMessage(pc, phone, '⚠️ No se encontraron productos en el catálogo. Verificá que tu catálogo tenga productos en Commerce Manager.');
    }

    const lines = ['✅ *Catálogo sincronizado*\n'];
    if (result.inserted > 0) lines.push(`📦 Nuevos: ${result.inserted}`);
    if (result.updated > 0) lines.push(`🔗 Vinculados: ${result.updated}`);
    if (result.skipped > 0) lines.push(`⏭️ Ya existían: ${result.skipped}`);
    lines.push(`\n📋 Total: ${result.total} productos en tu menú.`);

    return sendMessage(pc, phone, lines.join('\n'));
  } catch (error) {
    console.error('📦 Catalog sync failed:', error.message);
    return sendMessage(pc, phone, '❌ Error al sincronizar el catálogo. Contactá al administrador de la plataforma.');
  }
}

// ══════════════════════════════════════
// VIEW COMMANDS
// ══════════════════════════════════════

function helpText(hasAI = true) {
  if (hasAI) {
    return '🤖 *¡Soy tu asistente!*\n\n' +
      'Podés escribirme lo que necesites de forma natural, por ejemplo:\n\n' +
      '💬 *Preguntame cosas como:*\n' +
      '• "Quiero cambiar el horario"\n' +
      '• "Cuántos pedidos tengo hoy?"\n' +
      '• "Cuánto vendí esta semana?"\n' +
      '• "Cómo agrego un producto?"\n' +
      '• "Quiero ver mi configuración"\n\n' +
      '📋 *Comandos rápidos:*\n' +
      '• *PAUSAR PRODUCTO* — Activar/desactivar un producto\n' +
      '• *SINCRONIZAR* — Actualizar productos del catálogo\n' +
      '• *CONFIRMAR PAGO #N* — Confirmar pago de un pedido\n' +
      '• *RECHAZAR PEDIDO #N* — Rechazar un pedido\n' +
      '• *ESTADO PEDIDO #N preparando* — Cambiar estado\n\n' +
      '💼 *Suscripción:*\n' +
      '• *PLAN* — Ver tu plan actual y uso\n' +
      '• *PLANES* — Comparar planes disponibles\n' +
      '• *RENOVAR* — Instrucciones de pago\n' +
      '• *CAMBIAR PLAN basico/intermedio/pro*\n\n' +
      '💡 También podés escribir *AYUDA* en cualquier momento para ver este mensaje.';
  }

  // Basic plan: commands-only help
  return '📋 *Comandos disponibles:*\n\n' +
    '🛒 *Pedidos:*\n' +
    '• *VER PEDIDOS* — Ver pedidos pendientes\n' +
    '• *VER PEDIDO #N* — Detalle de un pedido\n' +
    '• *ESTADO PEDIDO #N preparando* — Cambiar estado\n' +
    '• *CONFIRMAR PAGO #N* — Confirmar pago recibido\n' +
    '• *RECHAZAR PEDIDO #N* — Rechazar un pedido\n' +
    '• *VENTAS HOY/SEMANA/MES* — Resumen de ventas\n\n' +
    '📦 *Productos:*\n' +
    '• *VER MENÚ* — Ver tu menú\n' +
    '• *AGREGAR PRODUCTO* — Solicitar agregar un producto\n' +
    '• *EDITAR PRODUCTO* — Cambiar precio/nombre de un producto\n' +
    '• *PAUSAR PRODUCTO* — Activar/desactivar un producto\n' +
    '• *SINCRONIZAR* — Actualizar del catálogo\n\n' +
    '⚙️ *Configuración:*\n' +
    '• *VER NEGOCIO* — Ver tu configuración\n\n' +
    '💼 *Suscripción:*\n' +
    '• *PLAN* — Ver tu plan actual y uso\n' +
    '• *PLANES* — Comparar planes disponibles\n' +
    '• *RENOVAR* — Instrucciones de pago\n' +
    '• *CAMBIAR PLAN basico/intermedio/pro*';
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
    const result = await ai.extractBusinessHours(text);
    return result.hours || null;
  } catch {
    return null;
  }
}

async function parseZones(text) {
  try {
    const result = await ai.extractDeliveryZones(text);
    const zones = result.zones || [];
    if (zones.length === 0 || zones.some((z) => !z.zone_name || !z.price)) return null;
    return zones;
  } catch {
    return null;
  }
}

async function parseBankData(text) {
  try {
    return await ai.extractBankData(text);
  } catch {
    return null;
  }
}

async function addProductsFromText(pc, phone, text, businessId, continueMsg) {
  let result;
  try {
    result = await ai.extractProducts(text);
  } catch {
    return sendMessage(pc, phone, '⚠️ No pude interpretar los productos. Probá incluyendo el precio, ej:\n"Pizza grande $5500, categoría Pizzas"');
  }

  const products = (result.products || []).filter((p) => p.name && p.price > 0);

  if (products.length === 0) {
    const noPrice = (result.products || []).filter((p) => p.name && (!p.price || p.price === 0));
    if (noPrice.length > 0) {
      const names = noPrice.map((p) => `• ${p.name} — sin precio`).join('\n');
      return sendMessage(pc, phone, `⚠️ No pude detectar el precio de estos productos:\n${names}\n\nProbá incluyendo el precio, ej: "Pizza grande $5500"`);
    }
    return sendMessage(pc, phone, '⚠️ No pude extraer ningún producto. Probá con un formato como:\n"Pizza Muzzarella $5500, categoría Pizzas"');
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

  return sendMessage(pc, phone, reply);
}

module.exports = { processMessage };
