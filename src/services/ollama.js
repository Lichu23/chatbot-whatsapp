const { config } = require('../config');
const groq = require('./groq');

/**
 * Call Ollama's chat API with a system prompt and user message.
 * Returns the raw text response from the model.
 */
async function chat(systemPrompt, userMessage) {
  console.log(`🤖 Ollama request — model: ${config.ollama.model}`);
  console.log(`   User message: "${userMessage.substring(0, 80)}${userMessage.length > 80 ? '...' : ''}"`);

  const res = await fetch(`${config.ollama.url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollama.model || 'qwen2.5:7b',
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`🤖 ❌ Ollama error: ${res.status} ${res.statusText}`, body);
    throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  console.log(`🤖 Ollama response: "${data.message.content.substring(0, 150)}${data.message.content.length > 150 ? '...' : ''}"`);
  return data.message.content;
}

/**
 * Call Ollama and parse the response as JSON.
 * Strips markdown code fences if present.
 */
async function chatJSON(systemPrompt, userMessage) {
  const raw = await chat(systemPrompt, userMessage);

  // Strip ```json ... ``` or ``` ... ``` wrappers
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    console.log('🤖 Parsed JSON:', JSON.stringify(parsed));
    return parsed;
  } catch (error) {
    console.error('🤖 ❌ Failed to parse Ollama response as JSON');
    console.error('   Raw response:', raw);
    console.error('   Cleaned:', cleaned);
    throw error;
  }
}

// ── Extraction Prompts ──

const HOURS_SYSTEM_PROMPT = `Sos un asistente que normaliza horarios de atención de restaurantes argentinos.
El usuario te va a escribir su horario de forma informal.
Respondé SOLO con un JSON válido con esta estructura:
{"hours": "Lun-Vie 11:00-23:00, Sáb 12:00-00:00"}
Usá formato 24hs. Abreviá los días: Lun, Mar, Mié, Jue, Vie, Sáb, Dom.
Si no podés interpretar el horario, respondé: {"hours": null}`;

async function extractBusinessHours(userText) {
  if (config.groq.apiKey) {
    try {
      return await groq.chatJSON(HOURS_SYSTEM_PROMPT, userText);
    } catch (err) {
      console.warn('⚡ Groq failed for extractBusinessHours, falling back to Ollama:', err.message);
    }
  }
  return chatJSON(HOURS_SYSTEM_PROMPT, userText);
}

const ZONES_SYSTEM_PROMPT = `Sos un asistente que extrae zonas de delivery con precios.
El usuario va a escribir zonas y precios de forma informal (ej: "centro 500 pesos, almagro 600").
Respondé SOLO con un JSON válido con esta estructura:
{"zones": [{"zone_name": "Centro", "price": 500}, {"zone_name": "Almagro", "price": 600}]}
Capitalizá los nombres de las zonas. Los precios son números sin símbolo.
Si no podés extraer zonas con precios, respondé: {"zones": []}`;

async function extractDeliveryZones(userText) {
  if (config.groq.apiKey) {
    try {
      return await groq.chatJSON(ZONES_SYSTEM_PROMPT, userText);
    } catch (err) {
      console.warn('⚡ Groq failed for extractDeliveryZones, falling back to Ollama:', err.message);
    }
  }
  return chatJSON(ZONES_SYSTEM_PROMPT, userText);
}

const BANK_SYSTEM_PROMPT = `Sos un asistente que extrae datos bancarios argentinos de texto libre.
El usuario va a escribir su alias, CBU/CVU y nombre del titular.
Respondé SOLO con un JSON válido con esta estructura:
{"alias": "mi.alias", "cbu": "0000003100092810733816", "account_holder": "Juan Pérez"}
Si falta algún campo, poné null en su valor.`;

async function extractBankData(userText) {
  if (config.groq.apiKey) {
    try {
      return await groq.chatJSON(BANK_SYSTEM_PROMPT, userText);
    } catch (err) {
      console.warn('⚡ Groq failed for extractBankData, falling back to Ollama:', err.message);
    }
  }
  return chatJSON(BANK_SYSTEM_PROMPT, userText);
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
  if (config.groq.apiKey) {
    try {
      return await groq.chatJSON(PRODUCTS_SYSTEM_PROMPT, userText);
    } catch (err) {
      console.warn('⚡ Groq failed for extractProducts, falling back to Ollama:', err.message);
    }
  }
  return chatJSON(PRODUCTS_SYSTEM_PROMPT, userText);
}

/**
 * Extract order items from customer free text, matched against the real product catalog.
 * Returns matched items with quantities.
 *
 * @param {string} userText - Customer's natural language order (e.g. "2 muzzarella y 1 coca")
 * @param {Array} products - Available products from DB [{id, name, price, category}, ...]
 * @returns {Promise<{items: Array<{product_id: string, name: string, qty: number}>}>}
 */
async function extractOrderItems(userText, products) {
  // Build a product catalog string for the AI
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

  if (config.groq.apiKey) {
    try {
      return await groq.chatJSON(system, userText);
    } catch (err) {
      console.warn('⚡ Groq failed for extractOrderItems, falling back to Ollama:', err.message);
    }
  }
  try {
    return await chatJSON(system, userText);
  } catch (err) {
    console.error('🤖 ❌ Both Groq and Ollama failed for extractOrderItems:', err.message);
    return { items: [], not_found: [], ai_unavailable: true };
  }
}

module.exports = {
  chat,
  chatJSON,
  extractBusinessHours,
  extractDeliveryZones,
  extractBankData,
  extractProducts,
  extractOrderItems,
};
