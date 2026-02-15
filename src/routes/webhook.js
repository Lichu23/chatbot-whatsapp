const { Router } = require('express');
const crypto = require('crypto');
const { config } = require('../config');
const { extractMessage } = require('../utils/extract-message');
const logger = require('../utils/logger');
const { processMessage } = require('../services/workflow');
const { markAsReadAndTyping } = require('../services/whatsapp');
const db = require('../services/database');

const router = Router();

// ── Rate Limiter (per sender phone number) ──

const rateLimitMap = new Map(); // key: phone, value: { count, windowStart }
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW = 60 * 1000; // 60 seconds

// Cleanup old rate-limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [phone, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW * 2) {
      rateLimitMap.delete(phone);
    }
  }
}, 5 * 60 * 1000);

function isRateLimited(phone) {
  const now = Date.now();
  let entry = rateLimitMap.get(phone);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    entry = { count: 1, windowStart: now };
    rateLimitMap.set(phone, entry);
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

// ── Webhook Signature Validation ──

function verifySignature(req) {
  const appSecret = config.meta.appSecret;
  if (!appSecret) {
    logger.warn('META_APP_SECRET not set — skipping webhook signature validation (dev mode)');
    return true;
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Health check — verifies Supabase + LLM provider connectivity.
 */
router.get('/health', async (req, res) => {
  const checks = { supabase: 'ok', llm: 'ok' };
  let status = 'ok';

  // Check Supabase
  try {
    await db.healthCheck();
  } catch (err) {
    checks.supabase = `error: ${err.message}`;
    status = 'error';
  }

  // Check LLM providers
  const providers = [];
  if (config.llm.groqKey) providers.push('Groq');
  if (config.llm.cerebrasKey) providers.push('Cerebras');
  if (config.llm.mistralKey) providers.push('Mistral');
  if (config.llm.openrouterKey) providers.push('OpenRouter');

  if (providers.length === 0) {
    checks.llm = 'no_api_keys';
    if (status === 'ok') status = 'degraded';
  } else {
    checks.llm = `${providers.length} providers: ${providers.join(', ')}`;
  }

  const code = status === 'error' ? 503 : 200;
  res.status(code).json({ status, checks, timestamp: new Date().toISOString() });
});

/**
 * GET — Meta webhook verification.
 */
router.get('/webhook/whatsapp', (req, res) => {
  console.log('📥 GET /webhook/whatsapp — query:', JSON.stringify(req.query));

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.meta.verifyToken) {
    console.log('✅ Webhook verified by Meta');
    return res.status(200).send(challenge);
  }

  console.log('❌ Webhook verification failed — token mismatch');
  return res.sendStatus(403);
});

/**
 * POST — Incoming messages from Meta WhatsApp Cloud API.
 */
router.post('/webhook/whatsapp', async (req, res) => {
  try {
    // Validate webhook signature
    if (!verifySignature(req)) {
      logger.warn('Webhook signature validation failed — rejecting request');
      return res.sendStatus(403);
    }

    logger.info('Webhook received', { path: '/webhook/whatsapp' });
    console.log('📩 Body:', JSON.stringify(req.body, null, 2));

    // Respond 200 quickly — Meta retries if it doesn't get a fast response
    res.sendStatus(200);

    const message = extractMessage(req.body);

    if (!message) {
      console.log('⚠️  Not a text message or no message data — skipping');
      return;
    }

    console.log('📋 Extracted message:', JSON.stringify(message));

    // Log webhook asynchronously (fire-and-forget)
    db.logWebhook(
      message.phoneNumberId,
      message.from,
      message.text === '__NATIVE_CART__' ? 'order' : message.location ? 'location' : message.interactiveReply ? 'interactive' : 'text',
      req.body
    ).catch((err) => console.error('Failed to log webhook:', err.message));

    // Rate limiting per sender phone
    if (isRateLimited(message.from)) {
      logger.warn('Rate limited', { phone: message.from, phone_number_id: message.phoneNumberId });
      return;
    }

    // Resolve per-number credentials (falls back to .env config if no DB row)
    let phoneConfig = null;
    if (message.phoneNumberId) {
      phoneConfig = await db.getPhoneConfig(message.phoneNumberId);
    }
    if (!phoneConfig) {
      phoneConfig = {
        metaPhoneNumberId: config.meta.phoneNumberId,
        token: config.meta.token,
        catalogId: config.catalog.id,
      };
    }
    message.phoneConfig = phoneConfig;

    // Mark as read + show typing bubble (single API call)
    await markAsReadAndTyping(phoneConfig, message.messageId);

    await processMessage(message);
    logger.info('Message processed', { phone_number_id: message.phoneNumberId, sender: message.from });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    logger.error('Webhook processing failed', {
      error: error.message,
      phone_number_id: req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id,
    });

    // Log to failed_messages table
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    db.logFailedMessage(
      value?.metadata?.phone_number_id || null,
      msg?.from || null,
      req.body,
      error
    ).catch((err) => console.error('Failed to log failed message:', err.message));

    if (!res.headersSent) res.sendStatus(200);
  }
});

/**
 * Catch-all — log any other requests hitting the server.
 */
router.all('/{*splat}', (req, res) => {
  console.log(`⚠️  Unmatched request: ${req.method} ${req.url}`);
  res.sendStatus(404);
});

module.exports = router;
