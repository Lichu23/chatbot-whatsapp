const llm = require('./llm');

/**
 * AI extraction services using cascading cloud LLM providers.
 * Groq → Cerebras → Mistral → OpenRouter (all free tiers).
 */

// ── Extraction Prompts ──

const HOURS_SYSTEM_PROMPT = `Sos un asistente que normaliza horarios de atención de restaurantes argentinos.
El usuario te va a escribir su horario de forma informal.
Respondé SOLO con un JSON válido con esta estructura:
{"hours": "Lun-Vie 11:00-23:00, Sáb 12:00-00:00"}
Usá formato 24hs. Abreviá los días: Lun, Mar, Mié, Jue, Vie, Sáb, Dom.
Si no podés interpretar el horario, respondé: {"hours": null}`;

async function extractBusinessHours(userText) {
  return llm.chatJSON(HOURS_SYSTEM_PROMPT, userText);
}

const ZONES_SYSTEM_PROMPT = `Sos un asistente que extrae zonas de delivery con precios.
El usuario va a escribir zonas y precios de forma informal (ej: "centro 500 pesos, almagro 600").
Respondé SOLO con un JSON válido con esta estructura:
{"zones": [{"zone_name": "Centro", "price": 500}, {"zone_name": "Almagro", "price": 600}]}
Capitalizá los nombres de las zonas. Los precios son números sin símbolo.
Si no podés extraer zonas con precios, respondé: {"zones": []}`;

async function extractDeliveryZones(userText) {
  return llm.chatJSON(ZONES_SYSTEM_PROMPT, userText);
}

const BANK_SYSTEM_PROMPT = `Sos un asistente que extrae datos bancarios argentinos de texto libre.
El usuario va a escribir su alias, CBU/CVU y nombre del titular.
Respondé SOLO con un JSON válido con esta estructura:
{"alias": "mi.alias", "cbu": "0000003100092810733816", "account_holder": "Juan Pérez"}
Si falta algún campo, poné null en su valor.`;

async function extractBankData(userText) {
  return llm.chatJSON(BANK_SYSTEM_PROMPT, userText);
}

const PRODUCTS_SYSTEM_PROMPT = `Sos un asistente que extrae productos de menú de restaurante.
El usuario describe productos de forma informal.
Respondé SOLO con un JSON válido con esta estructura:
{"products": [{"name": "Pizza Muzzarella", "description": "Con muzzarella y salsa", "price": 5500, "category": "Pizzas"}]}
- name: nombre capitalizado del producto (obligatorio)
- description: descripción breve o null si no se menciona
- price: número sin símbolo (obligatorio, poné 0 si no se menciona)
- category: categoría capitalizada o "General" si no se menciona
Si no podés extraer ningún producto, respondé: {"products": []}`;

async function extractProducts(userText) {
  return llm.chatJSON(PRODUCTS_SYSTEM_PROMPT, userText);
}

/**
 * Extract order items from customer free text, matched against the real product catalog.
 *
 * @param {string} userText - Customer's natural language order (e.g. "2 muzzarella y 1 coca")
 * @param {Array} products - Available products from DB [{id, name, price, category}, ...]
 * @returns {Promise<{items: Array<{product_id: string, name: string, qty: number}>}>}
 */
async function extractOrderItems(userText, products) {
  const catalog = products
    .map((p) => `- ID: ${p.id} | Nombre: "${p.name}" | Precio: $${p.price} | Categoría: ${p.category || 'General'}`)
    .join('\n');

  const system = `Sos un asistente que interpreta pedidos de clientes de un restaurante.
El cliente escribe lo que quiere pedir de forma informal en español argentino.
Tu tarea es extraer los productos y cantidades que el cliente quiere, haciendo match con el catálogo real del negocio.

CATÁLOGO DE PRODUCTOS DISPONIBLES:
${catalog}

REGLAS:
- Hacé match flexible (ej: "muzza" = "Muzzarella", "coca" = "Coca Cola", "fuga" = "Fugazza")
- Si el cliente no especifica cantidad, asumí 1
- Solo incluí productos que existan en el catálogo. Si algo no matchea, incluilo en "not_found"
- Respondé SOLO con un JSON válido con esta estructura:
{"items": [{"product_id": "uuid-del-producto", "name": "Nombre Exacto del Catálogo", "qty": 2}], "not_found": ["término que no matcheó"]}
- Si no podés interpretar nada, respondé: {"items": [], "not_found": []}
- NO inventes productos que no están en el catálogo`;

  try {
    return await llm.chatJSON(system, userText);
  } catch (err) {
    console.error('⚡ ❌ All LLM providers failed for extractOrderItems:', err.message);
    return { items: [], not_found: [], ai_unavailable: true };
  }
}

/**
 * Classify admin intent from natural language.
 * Returns { intent, args } where intent maps to an action.
 */
async function classifyAdminIntent(userText) {
  const system = `Sos un clasificador de intenciones para un chatbot de gestión de negocios gastronómicos.
El usuario es el ADMINISTRADOR del negocio. Analizá su mensaje y devolvé la intención.

INTENCIONES DISPONIBLES:
- "edit_name" — quiere cambiar el nombre del negocio
- "edit_hours" — quiere cambiar el horario de atención
- "edit_address" — quiere cambiar la dirección del local
- "edit_delivery" — quiere cambiar cómo entrega (delivery/retiro)
- "edit_payments" — quiere cambiar métodos de pago
- "edit_zones" — quiere cambiar zonas de delivery y precios
- "edit_bank" — quiere cambiar datos bancarios
- "view_menu" — quiere ver su menú/productos
- "view_business" — quiere ver el resumen de su negocio/configuración
- "view_orders" — quiere ver pedidos pendientes
- "sales_summary" — quiere ver ventas o estadísticas (args: period = "hoy", "semana" o "mes")
- "pause_product" — quiere pausar o reactivar un producto
- "sync_catalog" — quiere sincronizar/actualizar productos del catálogo
- "help" — quiere saber qué puede hacer o cómo funciona algo
- "analytics" — quiere estadísticas avanzadas: productos más vendidos, clientes recurrentes, horas pico, días populares
- "trends" — quiere ver tendencias, proyecciones, predicciones de ganancias futuras, comparar meses, evolución del negocio
- "create_promo" — quiere crear una promoción, código de descuento, oferta especial (ej: "crear promo", "quiero hacer una promo", "descuento")
- "view_promos" — quiere ver las promos activas
- "broadcast" — quiere enviar un mensaje masivo / difusión a todos los clientes (ej: "difusion", "enviar mensaje a todos", "mensaje masivo")
- "configure_loyalty" — quiere configurar o crear un programa de fidelización, recompensar clientes recurrentes, dar descuentos por fidelidad (ej: "fidelidad", "fidelizacion", "recompensar clientes")
- "view_loyalty" — quiere ver el programa de fidelización actual
- "edit_product" — quiere editar/modificar/cambiar el precio, nombre o descripción de un producto existente
- "add_product" — quiere agregar un producto nuevo al menú/catálogo
- "view_plan" — quiere ver su plan actual
- "view_plans" — quiere comparar los planes disponibles
- "change_plan" — quiere cambiar de plan (args: planSlug = "basico", "intermedio" o "pro" si lo menciona, o null si no especifica)
- "general_question" — tiene una pregunta general sobre la plataforma, su negocio, o necesita ayuda con algo que no es un comando directo
- "greeting" — es un saludo simple (hola, buenos días, etc.)

REGLAS:
- Si el mensaje es ambiguo, preferí "general_question"
- Si mencionan agregar un producto nuevo → "add_product"
- Si mencionan editar/cambiar precio/nombre/descripción de un producto existente → "edit_product"
- Si mencionan eliminar un producto → "general_question" (no pueden hacerlo desde el chat)
- Si mencionan "promo", "descuento", "oferta", "código" → "create_promo" (aunque no den los detalles completos)
- Si mencionan "fidelidad", "fidelización", "recompensar", "premiar clientes" → "configure_loyalty"
- Si mencionan "difusión", "difundir", "mensaje masivo", "enviar a todos" → "broadcast"
- Si mencionan "tendencias", "predicción", "proyección", "cuánto voy a ganar", "mes que viene" → "trends"
- Respondé SOLO con JSON válido:
{"intent": "edit_hours", "args": {}}
{"intent": "sales_summary", "args": {"period": "hoy"}}
{"intent": "change_plan", "args": {"planSlug": "pro"}}
{"intent": "general_question", "args": {}}`;

  try {
    return await llm.chatJSON(system, userText);
  } catch (err) {
    console.error('⚡ ❌ classifyAdminIntent failed:', err.message);
    return { intent: 'general_question', args: {} };
  }
}

/**
 * Answer a general admin question with business context.
 * Returns the AI's text response (not JSON).
 */
async function answerAdminQuestion(userText, businessContext) {
  const system = `Sos el asistente virtual de una plataforma de pedidos por WhatsApp para negocios gastronómicos argentinos.
El usuario es el ADMINISTRADOR de un negocio. Respondé en español argentino, de forma clara y breve.

DATOS ACTUALES DEL NEGOCIO:
${businessContext}

LO QUE EL ADMIN PUEDE HACER DESDE ESTE CHAT:
- Cambiar: nombre, horario, dirección, método de entrega, métodos de pago, zonas de delivery, datos bancarios
- Pausar o reactivar un producto (para que no aparezca en el menú temporalmente)
- Sincronizar productos del catálogo (si se agregaron productos en el catálogo de WhatsApp)
- Ver su menú, pedidos pendientes, resumen del negocio, ventas del día/semana/mes

FUNCIONES AVANZADAS DISPONIBLES (el admin debe usar los comandos exactos):
- *CREAR PROMO código 10%* — crear código de descuento (plan Intermedio/Pro)
- *DIFUSION mensaje* — enviar mensaje masivo a clientes (plan Pro)
- *CONFIGURAR FIDELIDAD 10 pedidos = 1 gratis* — programa de fidelización (plan Pro)
- *TENDENCIAS* — ver tendencias y proyecciones (plan Pro)
- *ANALYTICS* — estadísticas avanzadas (plan Intermedio/Pro)

LO QUE EL ADMIN NO PUEDE HACER DESDE ESTE CHAT (debe contactar al administrador de la plataforma):
- Agregar, eliminar o editar productos (nombre, precio, descripción, foto) — esto se gestiona desde el catálogo de WhatsApp en Meta Commerce Manager
- Cambiar el número de WhatsApp del negocio
- Resolver problemas técnicos

REGLAS:
- Respondé de forma directa y útil, máximo 3-4 líneas
- Si preguntan sobre promos, fidelidad, difusiones, tendencias o analytics, indicá el comando exacto que deben usar (ej: "Escribí *CREAR PROMO VERANO 10%* para crear una promo")
- Si preguntan algo que no pueden hacer desde el chat, explicá amablemente y sugerí contactar al administrador de la plataforma
- No uses markdown complejo, solo *negritas* y saltos de línea
- Respondé SOLO con JSON: {"answer": "tu respuesta aquí"}`;

  try {
    const result = await llm.chatJSON(system, userText);
    return result.answer || 'No pude procesar tu consulta. Escribí *AYUDA* para ver qué puedo hacer.';
  } catch (err) {
    console.error('⚡ ❌ answerAdminQuestion failed:', err.message);
    return 'No pude procesar tu consulta en este momento. Intentá de nuevo en unos segundos.';
  }
}

module.exports = {
  extractBusinessHours,
  extractDeliveryZones,
  extractBankData,
  extractProducts,
  extractOrderItems,
  classifyAdminIntent,
  answerAdminQuestion,
};
