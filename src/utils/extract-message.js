/**
 * Extracts the relevant fields from a Twilio WhatsApp webhook body.
 * Twilio sends form-urlencoded data with these fields.
 */
function extractMessage(body) {
  return {
    from: body.From,           // e.g. "whatsapp:+5491112345678"
    to: body.To,               // e.g. "whatsapp:+14155238886"
    text: (body.Body || '').trim(),
    profileName: body.ProfileName || '',
  };
}

module.exports = { extractMessage };
