const db = require('./database');
const subscription = require('./subscription');
const { sendMessage } = require('./whatsapp');
const { config } = require('../config');

// Track which businesses already received today's summary (reset daily)
const sentToday = new Set();
let lastResetDate = '';

function formatPrice(n) {
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Parse closing hour from business_hours text.
 * Supports formats like: "10:00 - 22:00", "10 a 22", "10hs a 22hs", "Lun-Sab 10-22"
 * Returns the closing hour as an integer (0-23), or null if unparseable.
 */
function parseClosingHour(businessHours) {
  if (!businessHours) return null;

  // Try "HH:MM - HH:MM" or "HH - HH"
  const rangeMatch = businessHours.match(/(\d{1,2})(?::(\d{2}))?\s*[-–aA]\s*(\d{1,2})(?::(\d{2}))?/);
  if (rangeMatch) {
    return parseInt(rangeMatch[3], 10);
  }

  return null;
}

/**
 * Build daily summary message for a business.
 */
async function buildDailySummary(business) {
  // Get today's start in Argentina time
  const now = new Date();
  const argNow = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
  const todayStart = new Date(argNow);
  todayStart.setHours(0, 0, 0, 0);

  const orders = await db.getOrdersSince(business.id, todayStart);

  if (orders.length === 0) {
    return `📊 *Resumen del día — ${business.business_name}*\n\nNo hubo pedidos hoy.`;
  }

  const confirmed = orders.filter((o) => o.payment_status === 'confirmed' && o.order_status !== 'cancelado');
  const pending = orders.filter((o) => ['nuevo', 'preparando', 'en_camino'].includes(o.order_status));
  const cancelled = orders.filter((o) => o.order_status === 'cancelado');
  const totalRevenue = confirmed.reduce((sum, o) => sum + Number(o.grand_total), 0);

  // Top 3 products from all non-cancelled orders
  const productCounts = {};
  for (const order of orders.filter((o) => o.order_status !== 'cancelado')) {
    const items = order.items || [];
    for (const item of items) {
      const key = item.name;
      if (!productCounts[key]) productCounts[key] = { name: key, qty: 0, revenue: 0 };
      productCounts[key].qty += item.qty;
      productCounts[key].revenue += item.subtotal || (item.price * item.qty);
    }
  }

  const topProducts = Object.values(productCounts)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 3);

  const lines = [`📊 *Resumen del día — ${business.business_name}*\n`];
  lines.push(`📦 Total pedidos: ${orders.length}`);
  lines.push(`✅ Confirmados: ${confirmed.length}`);
  if (pending.length > 0) lines.push(`⏳ Pendientes: ${pending.length}`);
  if (cancelled.length > 0) lines.push(`❌ Cancelados: ${cancelled.length}`);
  lines.push(`\n💰 *Facturación: $${formatPrice(totalRevenue)}*`);

  if (topProducts.length > 0) {
    lines.push('\n🏆 *Top productos:*');
    for (let i = 0; i < topProducts.length; i++) {
      const p = topProducts[i];
      const medal = ['🥇', '🥈', '🥉'][i];
      lines.push(`${medal} ${p.name} — ${p.qty} uds ($${formatPrice(p.revenue)})`);
    }
  }

  if (pending.length > 0) {
    lines.push(`\n⚠️ Tenés *${pending.length}* pedido${pending.length > 1 ? 's' : ''} pendiente${pending.length > 1 ? 's' : ''}.`);
  }

  return lines.join('\n');
}

/**
 * Check all businesses and send daily summary if it's their closing time.
 * Runs every 15 minutes.
 */
async function checkAndSendSummaries() {
  try {
    // Reset sent tracker at midnight
    const now = new Date();
    const argNow = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
    const todayStr = argNow.toISOString().slice(0, 10);

    if (todayStr !== lastResetDate) {
      sentToday.clear();
      lastResetDate = todayStr;
    }

    const currentHour = argNow.getHours();
    const businesses = await db.getAllActiveBusinesses();

    for (const business of businesses) {
      if (sentToday.has(business.id)) continue;

      // Check if business has daily_summary feature
      const hasSummary = await subscription.checkFeatureAccess(business.id, 'daily_summary');
      if (!hasSummary) continue;

      // Check if current hour matches closing hour
      const closingHour = parseClosingHour(business.business_hours);
      if (closingHour === null || currentHour !== closingHour) continue;

      // Send summary
      console.log(`📊 Sending daily summary to ${business.business_name}`);
      const summary = await buildDailySummary(business);

      // Get phone config for sending
      let pc = null;
      if (business.phone_number_id) {
        pc = await db.getPhoneConfigById(business.phone_number_id);
      }

      await sendMessage(pc, business.admin_phone, summary);
      sentToday.add(business.id);
    }
  } catch (error) {
    console.error('❌ Scheduler error:', error.message);
  }
}

/**
 * Check for pending scheduled messages and send them.
 */
async function checkAndSendScheduledMessages() {
  try {
    const messages = await db.getPendingScheduledMessages();
    if (messages.length === 0) return;

    for (const msg of messages) {
      console.log(`📨 Sending scheduled message for ${msg.business?.business_name || msg.business_id}`);

      // Mark as sending
      await db.updateScheduledMessageStatus(msg.id, 'sending', 0, 0);

      // Get phone config for sending
      let pc = null;
      if (msg.business?.phone_number_id) {
        pc = await db.getPhoneConfigById(msg.business.phone_number_id);
      }

      const phones = msg.recipient_phones || [];
      let sentCount = 0;
      let failedCount = 0;

      for (const phone of phones) {
        try {
          await sendMessage(pc, phone, msg.message);
          sentCount++;
        } catch (err) {
          console.error(`❌ Failed to send to ${phone}:`, err.message);
          failedCount++;
        }
      }

      await db.updateScheduledMessageStatus(msg.id, 'sent', sentCount, failedCount);
      console.log(`📨 Scheduled message sent: ${sentCount} ok, ${failedCount} failed`);

      // Notify admin about the result
      if (msg.business?.admin_phone) {
        await sendMessage(pc, msg.business.admin_phone,
          `✅ *Mensaje programado enviado*\n\n` +
          `📨 Enviados: ${sentCount}/${phones.length}\n` +
          (failedCount > 0 ? `❌ Fallidos: ${failedCount}\n` : '') +
          `💬 "${msg.message.substring(0, 80)}${msg.message.length > 80 ? '...' : ''}"`
        );
      }
    }
  } catch (error) {
    console.error('❌ Scheduled messages error:', error.message);
  }
}

const CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes

function start() {
  console.log('⏰ Scheduler started (daily summaries + scheduled messages, checks every 15 min)');
  // Run immediately on start, then every 15 minutes
  checkAndSendSummaries();
  checkAndSendScheduledMessages();
  setInterval(() => {
    checkAndSendSummaries();
    checkAndSendScheduledMessages();
  }, CHECK_INTERVAL);
}

module.exports = { start, parseClosingHour, buildDailySummary };
