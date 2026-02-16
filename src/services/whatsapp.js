const { config } = require('../config');

/**
 * Build the base URL for the WhatsApp Cloud API using phoneConfig or global config.
 */
function getBaseUrl(phoneConfig) {
  const phoneNumberId = phoneConfig?.metaPhoneNumberId || config.meta.phoneNumberId;
  return `https://graph.facebook.com/${config.meta.apiVersion}/${phoneNumberId}`;
}

/**
 * Get the access token from phoneConfig or global config.
 */
function getToken(phoneConfig) {
  return phoneConfig?.token || config.meta.token;
}

/**
 * Wrapper around fetch that retries on 429 (rate limit).
 * Node.js 18+ fetch uses HTTP keep-alive by default — no extra config needed.
 */
async function metaApiFetch(url, options, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);

    if (res.status === 429 && attempt < retries) {
      const retryAfter = parseInt(res.headers.get('retry-after'), 10) || 5;
      console.warn(`⏳ Meta API 429 — retrying in ${retryAfter}s (attempt ${attempt + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }

    return res;
  }
}

/**
 * Mark a message as read + show typing indicator in a single API call.
 * The typing bubble disappears when we send a response or after 25 seconds.
 */
async function markAsReadAndTyping(phoneConfig, messageId) {
  try {
    const res = await metaApiFetch(`${getBaseUrl(phoneConfig)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken(phoneConfig)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
        typing_indicator: {
          type: 'text',
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.log(`⌨️  Typing indicator failed (non-critical): ${err}`);
    } else {
      console.log('⌨️  Typing indicator shown');
    }
  } catch (error) {
    console.log(`⌨️  Typing indicator error (non-critical): ${error.message}`);
  }
}

/**
 * Send a text message via the Meta WhatsApp Cloud API.
 */
async function sendMessage(phoneConfig, to, body) {
  console.log(`📤 Sending message to ${to}:`);
  console.log(`   "${body.substring(0, 100)}${body.length > 100 ? '...' : ''}"`);

  try {
    const res = await metaApiFetch(`${getBaseUrl(phoneConfig)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken(phoneConfig)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`📤 ❌ Meta API error:`, JSON.stringify(data));
      throw new Error(data.error?.message || 'Failed to send message');
    }

    const messageId = data.messages?.[0]?.id || 'unknown';
    console.log(`📤 Message sent OK — ID: ${messageId}`);
    return data;
  } catch (error) {
    console.error(`📤 ❌ Failed to send message to ${to}:`, error.message);
    throw error;
  }
}

/**
 * Send an interactive reply-buttons message (max 3 buttons).
 * @param {object|null} phoneConfig - Per-number credentials (or null for global config)
 * @param {string} to - Recipient phone number
 * @param {string} body - Message body text
 * @param {Array<{id: string, title: string}>} buttons - 1-3 buttons (title max 20 chars)
 */
async function sendButtons(phoneConfig, to, body, buttons) {
  console.log(`📤 Sending buttons to ${to}: [${buttons.map((b) => b.title).join(', ')}]`);

  try {
    const res = await metaApiFetch(`${getBaseUrl(phoneConfig)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken(phoneConfig)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: {
            buttons: buttons.map((b) => ({
              type: 'reply',
              reply: { id: b.id, title: b.title },
            })),
          },
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`📤 ❌ Meta API error (buttons):`, JSON.stringify(data));
      throw new Error(data.error?.message || 'Failed to send buttons');
    }

    const messageId = data.messages?.[0]?.id || 'unknown';
    console.log(`📤 Buttons sent OK — ID: ${messageId}`);
    return data;
  } catch (error) {
    console.error(`📤 ❌ Failed to send buttons to ${to}:`, error.message);
    throw error;
  }
}

/**
 * Send an interactive list message (max 10 rows across sections).
 * @param {object|null} phoneConfig - Per-number credentials (or null for global config)
 * @param {string} to - Recipient phone number
 * @param {string} body - Message body text
 * @param {string} buttonText - Text on the list-open button (max 20 chars)
 * @param {Array<{title: string, rows: Array<{id: string, title: string, description?: string}>}>} sections
 */
async function sendList(phoneConfig, to, body, buttonText, sections) {
  const rowCount = sections.reduce((sum, s) => sum + s.rows.length, 0);
  console.log(`📤 Sending list to ${to}: ${sections.length} section(s), ${rowCount} rows`);

  try {
    const res = await metaApiFetch(`${getBaseUrl(phoneConfig)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken(phoneConfig)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: body },
          action: {
            button: buttonText,
            sections: sections.map((s) => ({
              title: s.title,
              rows: s.rows.map((r) => ({
                id: r.id,
                title: r.title,
                description: r.description || undefined,
              })),
            })),
          },
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`📤 ❌ Meta API error (list):`, JSON.stringify(data));
      throw new Error(data.error?.message || 'Failed to send list');
    }

    const messageId = data.messages?.[0]?.id || 'unknown';
    console.log(`📤 List sent OK — ID: ${messageId}`);
    return data;
  } catch (error) {
    console.error(`📤 ❌ Failed to send list to ${to}:`, error.message);
    throw error;
  }
}

/**
 * Send a single product message from the catalog.
 * @param {object|null} phoneConfig - Per-number credentials (or null for global config)
 * @param {string} to - Recipient phone number
 * @param {string} body - Message body text
 * @param {string} catalogId - Meta catalog ID
 * @param {string} retailerId - Product's content ID / retailer_id in the catalog
 */
async function sendProduct(phoneConfig, to, body, catalogId, retailerId) {
  console.log(`📤 Sending product to ${to}: catalog=${catalogId}, product=${retailerId}`);

  try {
    const res = await metaApiFetch(`${getBaseUrl(phoneConfig)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken(phoneConfig)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'product',
          body: { text: body },
          action: {
            catalog_id: catalogId,
            product_retailer_id: retailerId,
          },
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`📤 ❌ Meta API error (product):`, JSON.stringify(data));
      throw new Error(data.error?.message || 'Failed to send product');
    }

    const messageId = data.messages?.[0]?.id || 'unknown';
    console.log(`📤 Product sent OK — ID: ${messageId}`);
    return data;
  } catch (error) {
    console.error(`📤 ❌ Failed to send product to ${to}:`, error.message);
    throw error;
  }
}

/**
 * Send a multi-product message from the catalog (up to 30 products in sections).
 * @param {object|null} phoneConfig - Per-number credentials (or null for global config)
 * @param {string} to - Recipient phone number
 * @param {string} header - Header text
 * @param {string} body - Body text
 * @param {string} catalogId - Meta catalog ID
 * @param {Array<{title: string, product_items: Array<{product_retailer_id: string}>}>} sections
 */
async function sendCatalogList(phoneConfig, to, header, body, catalogId, sections) {
  const productCount = sections.reduce((sum, s) => sum + s.product_items.length, 0);
  console.log(`📤 Sending catalog list to ${to}: ${sections.length} section(s), ${productCount} products`);

  try {
    const res = await metaApiFetch(`${getBaseUrl(phoneConfig)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken(phoneConfig)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'product_list',
          header: { type: 'text', text: header },
          body: { text: body },
          action: {
            catalog_id: catalogId,
            sections: sections.map((s) => ({
              title: s.title,
              product_items: s.product_items.map((p) => ({
                product_retailer_id: p.product_retailer_id,
              })),
            })),
          },
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`📤 ❌ Meta API error (catalog list):`, JSON.stringify(data));
      throw new Error(data.error?.message || 'Failed to send catalog list');
    }

    const messageId = data.messages?.[0]?.id || 'unknown';
    console.log(`📤 Catalog list sent OK — ID: ${messageId}`);
    return data;
  } catch (error) {
    console.error(`📤 ❌ Failed to send catalog list to ${to}:`, error.message);
    throw error;
  }
}

/**
 * Send a location request message. The customer sees a "Send location" button
 * that opens the native WhatsApp location picker.
 * @param {object|null} phoneConfig - Per-number credentials (or null for global config)
 * @param {string} to - Recipient phone number
 * @param {string} body - Message body text (e.g. "Compartí tu ubicación")
 */
async function sendLocationRequest(phoneConfig, to, body) {
  console.log(`📤 Sending location request to ${to}`);

  try {
    const res = await metaApiFetch(`${getBaseUrl(phoneConfig)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken(phoneConfig)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'location_request_message',
          body: { text: body },
          action: { name: 'send_location' },
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`📤 ❌ Meta API error (location request):`, JSON.stringify(data));
      throw new Error(data.error?.message || 'Failed to send location request');
    }

    const messageId = data.messages?.[0]?.id || 'unknown';
    console.log(`📤 Location request sent OK — ID: ${messageId}`);
    return data;
  } catch (error) {
    console.error(`📤 ❌ Failed to send location request to ${to}:`, error.message);
    throw error;
  }
}

/**
 * Send a template message (for outside 24h conversation window).
 * Uses the 'hello_world' template by default, or a custom template name.
 * Template messages can be sent at any time, unlike free-form messages.
 */
async function sendTemplate(phoneConfig, to, templateName = 'hello_world', languageCode = 'es', components = []) {
  console.log(`📤 Sending template "${templateName}" to ${to}`);

  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };

    if (components.length > 0) {
      payload.template.components = components;
    }

    const res = await metaApiFetch(`${getBaseUrl(phoneConfig)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken(phoneConfig)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`📤 ❌ Template send error:`, JSON.stringify(data));
      throw new Error(data.error?.message || 'Failed to send template');
    }

    const messageId = data.messages?.[0]?.id || 'unknown';
    console.log(`📤 Template sent OK — ID: ${messageId}`);
    return data;
  } catch (error) {
    console.error(`📤 ❌ Failed to send template to ${to}:`, error.message);
    throw error;
  }
}

module.exports = { sendMessage, sendButtons, sendList, sendProduct, sendCatalogList, sendLocationRequest, sendTemplate, markAsReadAndTyping };
