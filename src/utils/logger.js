const { config } = require('../config');

// Rate-limit error alerts: max 1 every 5 minutes
let lastAlertAt = 0;
const ALERT_COOLDOWN = 5 * 60 * 1000;

function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const line = JSON.stringify(entry);

  if (level === 'error') {
    console.error(line);
    sendAlertIfConfigured(message, meta);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function info(message, meta) { log('info', message, meta); }
function warn(message, meta) { log('warn', message, meta); }
function error(message, meta) { log('error', message, meta); }

/**
 * Send a WhatsApp alert to ALERT_PHONE on critical errors.
 * Rate-limited to 1 message per 5 minutes.
 */
function sendAlertIfConfigured(message, meta) {
  if (!config.alertPhone) return;

  const now = Date.now();
  if (now - lastAlertAt < ALERT_COOLDOWN) return;
  lastAlertAt = now;

  // Lazy-require to avoid circular dependency
  const { sendMessage } = require('../services/whatsapp');

  // Use the first available phone config (global config for alerts)
  const alertPhoneConfig = {
    metaPhoneNumberId: config.meta.phoneNumberId,
    token: config.meta.token,
  };

  const text = `⚠️ ERROR ALERT\n${message}\n${meta.phone_number_id ? `Phone: ${meta.phone_number_id}` : ''}`.trim();

  // Fire-and-forget — don't let alert failures cascade
  sendMessage(alertPhoneConfig, config.alertPhone, text).catch((err) => {
    console.error('Failed to send error alert:', err.message);
  });
}

module.exports = { info, warn, error };
