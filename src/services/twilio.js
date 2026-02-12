const twilio = require('twilio');
const { config } = require('../config');

const client = twilio(config.twilio.accountSid, config.twilio.authToken);

async function sendMessage(to, body) {
  console.log(`📤 Sending message to ${to}:`);
  console.log(`   "${body.substring(0, 100)}${body.length > 100 ? '...' : ''}"`);

  try {
    const message = await client.messages.create({
      from: config.twilio.whatsappNumber,
      to,
      body,
    });

    console.log(`📤 Message sent OK — SID: ${message.sid}`);
    return message;
  } catch (error) {
    console.error(`📤 ❌ Failed to send message to ${to}:`, error.message);
    throw error;
  }
}

module.exports = { sendMessage };
