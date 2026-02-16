const db = require('./database');
const subscription = require('./subscription');
const { config } = require('../config');

function formatPrice(n) {
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Check if business can run an analytics query (within monthly limit).
 * Returns { allowed, current, limit } or { allowed: false, reason }.
 */
async function checkAnalyticsLimit(businessId) {
  const sub = await subscription.getActiveSubscription(businessId);
  if (!sub?.plan) return { allowed: false, current: 0, limit: 0 };

  const limit = sub.plan.analytics_queries_limit;
  if (!limit || limit === 0) return { allowed: false, current: 0, limit: 0 };
  if (limit >= 999) return { allowed: true, current: 0, limit: null }; // unlimited

  const month = new Date().toISOString().slice(0, 7);
  const usage = await db.getAnalyticsUsage(businessId, month);
  const current = usage ? usage.query_count : 0;

  return { allowed: current < limit, current, limit };
}

async function incrementUsage(businessId) {
  const month = new Date().toISOString().slice(0, 7);
  return db.incrementAnalyticsUsage(businessId, month);
}

// ── Query functions ──

async function topProducts(businessId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const orders = await db.getOrdersSince(businessId, since);

  const productStats = {};
  for (const order of orders.filter((o) => o.order_status !== 'cancelado')) {
    for (const item of (order.items || [])) {
      const key = item.name;
      if (!productStats[key]) productStats[key] = { name: key, qty: 0, revenue: 0 };
      productStats[key].qty += item.qty;
      productStats[key].revenue += item.subtotal || (item.price * item.qty);
    }
  }

  return Object.values(productStats).sort((a, b) => b.qty - a.qty).slice(0, 10);
}

async function repeatCustomerRate(businessId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const orders = await db.getOrdersSince(businessId, since);

  const customerOrders = {};
  for (const o of orders.filter((o) => o.order_status !== 'cancelado')) {
    customerOrders[o.client_phone] = (customerOrders[o.client_phone] || 0) + 1;
  }

  const total = Object.keys(customerOrders).length;
  if (total === 0) return { total: 0, repeating: 0, rate: 0 };

  const repeating = Object.values(customerOrders).filter((c) => c > 1).length;
  return { total, repeating, rate: Math.round((repeating / total) * 100) };
}

async function uniqueCustomers(businessId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const orders = await db.getOrdersSince(businessId, since);

  const phones = new Set();
  for (const o of orders.filter((o) => o.order_status !== 'cancelado')) {
    phones.add(o.client_phone);
  }
  return phones.size;
}

async function peakOrderingHours(businessId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const orders = await db.getOrdersSince(businessId, since);

  const hourCounts = {};
  for (const o of orders) {
    const hour = new Date(o.created_at).toLocaleString('en-US', {
      timeZone: config.timezone,
      hour: 'numeric',
      hour12: false,
    });
    const h = parseInt(hour, 10);
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  }

  return Object.entries(hourCounts)
    .map(([hour, count]) => ({ hour: parseInt(hour, 10), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

async function popularDays(businessId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const orders = await db.getOrdersSince(businessId, since);

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dayCounts = {};
  for (const o of orders) {
    const d = new Date(o.created_at).toLocaleString('en-US', {
      timeZone: config.timezone,
      weekday: 'long',
    });
    // Map English day to index
    const dayIndex = new Date(o.created_at).getDay();
    const dayName = dayNames[dayIndex];
    dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
  }

  return Object.entries(dayCounts)
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Full analytics report ──

async function buildFullReport(businessId) {
  const top = await topProducts(businessId);
  const repeat = await repeatCustomerRate(businessId);
  const unique = await uniqueCustomers(businessId);
  const peak = await peakOrderingHours(businessId);
  const days = await popularDays(businessId);

  const lines = ['📈 *Analytics — Últimos 30 días*\n'];

  // Top products
  if (top.length > 0) {
    lines.push('🏆 *Top productos:*');
    for (let i = 0; i < Math.min(top.length, 5); i++) {
      const p = top[i];
      lines.push(`  ${i + 1}. ${p.name} — ${p.qty} uds ($${formatPrice(p.revenue)})`);
    }
    lines.push('');
  }

  // Customers
  lines.push(`👥 *Clientes únicos:* ${unique}`);
  lines.push(`🔄 *Clientes recurrentes:* ${repeat.repeating}/${repeat.total} (${repeat.rate}%)`);
  lines.push('');

  // Peak hours
  if (peak.length > 0) {
    lines.push('⏰ *Horas pico:*');
    for (const p of peak.slice(0, 3)) {
      lines.push(`  ${p.hour}:00 — ${p.count} pedidos`);
    }
    lines.push('');
  }

  // Popular days
  if (days.length > 0) {
    lines.push('📅 *Días más activos:*');
    for (const d of days.slice(0, 3)) {
      lines.push(`  ${d.day} — ${d.count} pedidos`);
    }
  }

  return lines.join('\n');
}

// ── Trend data ──

/**
 * Build weekly trend for the last N weeks.
 * Returns array of { weekLabel, orders, revenue }.
 */
async function weeklyTrend(businessId, weeks = 8) {
  const since = new Date();
  since.setDate(since.getDate() - (weeks * 7));
  const orders = await db.getOrdersSince(businessId, since);
  const confirmed = orders.filter((o) => o.payment_status === 'confirmed' && o.order_status !== 'cancelado');

  // Group by week number
  const weekBuckets = {};
  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - ((weeks - i) * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const label = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
    weekBuckets[i] = { weekLabel: label, orders: 0, revenue: 0 };

    for (const o of orders) {
      const d = new Date(o.created_at);
      if (d >= weekStart && d < weekEnd) {
        weekBuckets[i].orders++;
      }
    }
    for (const o of confirmed) {
      const d = new Date(o.created_at);
      if (d >= weekStart && d < weekEnd) {
        weekBuckets[i].revenue += Number(o.grand_total);
      }
    }
  }

  return Object.values(weekBuckets);
}

/**
 * Build a text-based bar chart from values.
 */
function textBar(value, maxValue, width = 10) {
  if (maxValue === 0) return '';
  const filled = Math.round((value / maxValue) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/**
 * Build the full trends report.
 */
async function buildTrendsReport(businessId) {
  const trend = await weeklyTrend(businessId);

  const lines = ['📉 *Tendencias — Últimas 8 semanas*\n'];

  // Order trend
  const maxOrders = Math.max(...trend.map((w) => w.orders), 1);
  lines.push('📦 *Pedidos por semana:*');
  for (const w of trend) {
    lines.push(`  ${w.weekLabel.padEnd(6)} ${textBar(w.orders, maxOrders)} ${w.orders}`);
  }
  lines.push('');

  // Revenue trend
  const maxRevenue = Math.max(...trend.map((w) => w.revenue), 1);
  lines.push('💰 *Facturación por semana:*');
  for (const w of trend) {
    lines.push(`  ${w.weekLabel.padEnd(6)} ${textBar(w.revenue, maxRevenue)} $${formatPrice(w.revenue)}`);
  }
  lines.push('');

  // Growth percentage (last week vs previous)
  if (trend.length >= 2) {
    const last = trend[trend.length - 1];
    const prev = trend[trend.length - 2];

    const orderGrowth = prev.orders > 0
      ? Math.round(((last.orders - prev.orders) / prev.orders) * 100)
      : (last.orders > 0 ? 100 : 0);
    const revenueGrowth = prev.revenue > 0
      ? Math.round(((last.revenue - prev.revenue) / prev.revenue) * 100)
      : (last.revenue > 0 ? 100 : 0);

    const orderArrow = orderGrowth >= 0 ? '📈' : '📉';
    const revenueArrow = revenueGrowth >= 0 ? '📈' : '📉';

    lines.push('*Crecimiento vs semana anterior:*');
    lines.push(`  ${orderArrow} Pedidos: ${orderGrowth >= 0 ? '+' : ''}${orderGrowth}%`);
    lines.push(`  ${revenueArrow} Facturación: ${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth}%`);
  }

  return lines.join('\n');
}

module.exports = {
  checkAnalyticsLimit,
  incrementUsage,
  topProducts,
  repeatCustomerRate,
  uniqueCustomers,
  peakOrderingHours,
  popularDays,
  buildFullReport,
  buildTrendsReport,
};
