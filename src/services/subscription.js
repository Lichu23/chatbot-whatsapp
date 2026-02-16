const { PLAN_SLUGS, SUBSCRIPTION_STATUS } = require('../config');
const db = require('./database');

async function createTrialSubscription(businessId) {
  const plan = await db.getPlanBySlug(PLAN_SLUGS.INTERMEDIO);
  if (!plan) throw new Error('Plan intermedio not found');

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  return db.createSubscription(businessId, plan.id, SUBSCRIPTION_STATUS.TRIAL, endDate);
}

async function getActiveSubscription(businessId) {
  const sub = await db.getBusinessSubscription(businessId);
  if (!sub) return null;

  // Check if expired
  if (new Date(sub.end_date) < new Date()) {
    await db.updateSubscriptionStatus(sub.id, SUBSCRIPTION_STATUS.EXPIRED);
    return null;
  }

  return sub;
}

async function checkFeatureAccess(businessId, feature) {
  const sub = await getActiveSubscription(businessId);
  if (!sub || !sub.plan) return false;
  return !!sub.plan[feature];
}

async function checkOrderLimit(businessId) {
  const sub = await getActiveSubscription(businessId);
  if (!sub || !sub.plan) return { allowed: false, current: 0, limit: 0 };

  const limit = sub.plan.monthly_order_limit;
  if (limit === null) return { allowed: true, current: 0, limit: null }; // unlimited

  const month = new Date().toISOString().slice(0, 7); // '2026-02'
  const countRow = await db.getMonthlyOrderCount(businessId, month);
  const current = countRow ? countRow.order_count : 0;

  return { allowed: current < limit, current, limit };
}

async function checkZoneLimit(businessId) {
  const sub = await getActiveSubscription(businessId);
  if (!sub || !sub.plan) return { allowed: false, current: 0, limit: 0 };

  const limit = sub.plan.delivery_zone_limit;
  const zones = await db.getZonesByBusiness(businessId);
  const current = zones.length;

  return { allowed: current < limit, current, limit };
}

async function confirmPayment(businessId, planSlug, months = 1) {
  const plan = await db.getPlanBySlug(planSlug);
  if (!plan) throw new Error(`Plan '${planSlug}' not found`);

  // Cancel any existing non-cancelled subscription
  const existing = await db.getBusinessSubscription(businessId);
  if (existing) {
    await db.updateSubscriptionStatus(existing.id, SUBSCRIPTION_STATUS.CANCELLED);
  }

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + (30 * months));

  return db.createSubscription(businessId, plan.id, SUBSCRIPTION_STATUS.ACTIVE, endDate);
}

function formatPlanInfo(subscription) {
  if (!subscription || !subscription.plan) {
    return '❌ No tenés una suscripción activa.\nEnviá *PLANES* para ver las opciones.';
  }

  const { plan, status, end_date } = subscription;
  const endStr = new Date(end_date).toLocaleDateString('es-AR');
  const statusLabels = {
    [SUBSCRIPTION_STATUS.TRIAL]: '🆓 Prueba gratuita',
    [SUBSCRIPTION_STATUS.ACTIVE]: '✅ Activa',
    [SUBSCRIPTION_STATUS.EXPIRED]: '⚠️ Expirada',
    [SUBSCRIPTION_STATUS.CANCELLED]: '❌ Cancelada',
  };

  let text = `📋 *Tu Plan: ${plan.name}*\n`;
  text += `Estado: ${statusLabels[status] || status}\n`;
  text += `Precio: $${plan.price_usd} USD/mes\n`;
  text += `Vence: ${endStr}\n\n`;
  text += `📦 Pedidos/mes: ${plan.monthly_order_limit || 'Ilimitados'}\n`;
  text += `🗺️ Zonas de delivery: ${plan.delivery_zone_limit >= 999 ? 'Ilimitadas' : plan.delivery_zone_limit}\n`;
  text += `🤖 IA habilitada: ${plan.ai_enabled ? 'Sí' : 'No'}\n`;
  text += `📊 Resumen diario: ${plan.daily_summary ? 'Sí' : 'No'}\n`;
  text += `🎟️ Códigos promo: ${plan.promo_codes ? 'Sí' : 'No'}\n`;
  text += `📈 Consultas analytics: ${plan.analytics_queries_limit || 'No'}\n`;
  text += `📢 Difusiones: ${plan.broadcasts ? 'Sí' : 'No'}\n`;
  text += `🏆 Fidelización: ${plan.loyalty ? 'Sí' : 'No'}`;

  return text;
}

function formatPlansComparison(plans) {
  let text = '📋 *Planes Disponibles*\n\n';

  for (const plan of plans) {
    const orders = plan.monthly_order_limit || 'Ilimitados';
    const zones = plan.delivery_zone_limit >= 999 ? 'Ilimitadas' : plan.delivery_zone_limit;

    text += `*${plan.name}* — $${plan.price_usd} USD/mes\n`;
    text += `  📦 ${orders} pedidos/mes\n`;
    text += `  🗺️ ${zones} zonas de delivery\n`;
    text += `  🤖 IA: ${plan.ai_enabled ? 'Sí' : 'No'}`;
    if (plan.daily_summary) text += ` | 📊 Resumen diario`;
    if (plan.promo_codes) text += ` | 🎟️ Promos`;
    if (plan.analytics_queries_limit > 0) text += ` | 📈 ${plan.analytics_queries_limit >= 999 ? '∞' : plan.analytics_queries_limit} analytics`;
    if (plan.broadcasts) text += ` | 📢 Difusiones`;
    if (plan.loyalty) text += ` | 🏆 Fidelización`;
    if (plan.scheduled_messages) text += ` | ⏰ Mensajes prog.`;
    if (plan.trends) text += ` | 📉 Tendencias`;
    text += '\n\n';
  }

  text += 'Enviá *RENOVAR* para activar o cambiar tu plan.';
  return text;
}

module.exports = {
  createTrialSubscription,
  getActiveSubscription,
  checkFeatureAccess,
  checkOrderLimit,
  checkZoneLimit,
  confirmPayment,
  formatPlanInfo,
  formatPlansComparison,
};
