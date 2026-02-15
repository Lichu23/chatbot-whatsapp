/**
 * Extracts the relevant fields from a Meta WhatsApp Cloud API webhook payload.
 * Meta sends deeply nested JSON.
 *
 * Returns { from, text, profileName, messageId } or null if not a valid message.
 */
function extractMessage(body) {
  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Only process actual messages (not statuses or other events)
    if (!value?.messages || value.messages.length === 0) {
      return null;
    }

    const message = value.messages[0];
    const contact = value.contacts?.[0];
    const phoneNumberId = value.metadata?.phone_number_id || null;

    // Handle text messages
    if (message.type === 'text') {
      return {
        from: message.from,
        text: (message.text?.body || '').trim(),
        profileName: contact?.profile?.name || '',
        messageId: message.id,
        phoneNumberId,
      };
    }

    // Handle native cart orders (customer uses WhatsApp's Add to Cart)
    if (message.type === 'order') {
      const order = message.order;
      return {
        from: message.from,
        text: '__NATIVE_CART__',
        profileName: contact?.profile?.name || '',
        messageId: message.id,
        phoneNumberId,
        nativeCart: {
          catalog_id: order?.catalog_id,
          items: (order?.product_items || []).map((item) => ({
            product_retailer_id: item.product_retailer_id,
            quantity: item.quantity,
            item_price: item.item_price,
            currency: item.currency,
          })),
        },
      };
    }

    // Handle location messages (customer shares location via map picker)
    if (message.type === 'location') {
      const loc = message.location;
      return {
        from: message.from,
        text: '__LOCATION__',
        profileName: contact?.profile?.name || '',
        messageId: message.id,
        phoneNumberId,
        location: {
          latitude: loc?.latitude,
          longitude: loc?.longitude,
          name: loc?.name || null,
          address: loc?.address || null,
        },
      };
    }

    // Handle interactive replies (button taps + list selections)
    if (message.type === 'interactive') {
      const interactive = message.interactive;
      // Button reply: { type: 'button_reply', button_reply: { id, title } }
      // List reply:   { type: 'list_reply',   list_reply:   { id, title, description } }
      const reply = interactive?.button_reply || interactive?.list_reply;
      if (reply) {
        return {
          from: message.from,
          text: reply.id,      // Use the button/list row ID as the text
          profileName: contact?.profile?.name || '',
          messageId: message.id,
          phoneNumberId,
          interactiveReply: true,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('⚠️  Failed to extract message:', error.message);
    return null;
  }
}

module.exports = { extractMessage };
