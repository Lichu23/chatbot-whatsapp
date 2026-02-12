const { Router } = require('express');
const { extractMessage } = require('../utils/extract-message');
const { processMessage } = require('../services/workflow');

const router = Router();

router.post('/webhook/whatsapp', async (req, res) => {
  try {
    console.log('\n══════════════════════════════════════');
    console.log('📩 Incoming webhook:', JSON.stringify(req.body, null, 2));

    const message = extractMessage(req.body);
    console.log('📋 Extracted message:', JSON.stringify(message));

    if (!message.from || !message.text) {
      console.log('⚠️  Missing from or text, returning 400');
      return res.sendStatus(400);
    }

    await processMessage(message);

    console.log('✅ Message processed successfully');
    res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).set('Content-Type', 'text/xml').send('<Response></Response>');
  }
});

module.exports = router;
