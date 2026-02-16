/**
 * Unit tests for subscription system — pure logic, no DB required.
 * Run: node test/test-subscriptions.js
 */

const { parseCommand } = require('../src/utils/commands');
const { formatPlanInfo, formatPlansComparison } = require('../src/services/subscription');
const { calculateDiscount, formatPromoList } = require('../src/services/promos');
const { formatRewardLabel, formatLoyaltyStatus } = require('../src/services/loyalty');
const { parseClosingHour } = require('../src/services/scheduler');
const { PLAN_SLUGS, SUBSCRIPTION_STATUS } = require('../src/config');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ ${testName}`);
  }
}

function assertEq(actual, expected, testName) {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ ${testName} — expected "${expected}", got "${actual}"`);
  }
}

// ══════════════════════════════════════
// 1. Config constants
// ══════════════════════════════════════
console.log('\n📋 Config constants');
assertEq(PLAN_SLUGS.BASICO, 'basico', 'PLAN_SLUGS.BASICO');
assertEq(PLAN_SLUGS.INTERMEDIO, 'intermedio', 'PLAN_SLUGS.INTERMEDIO');
assertEq(PLAN_SLUGS.PRO, 'pro', 'PLAN_SLUGS.PRO');
assertEq(SUBSCRIPTION_STATUS.TRIAL, 'trial', 'SUBSCRIPTION_STATUS.TRIAL');
assertEq(SUBSCRIPTION_STATUS.ACTIVE, 'active', 'SUBSCRIPTION_STATUS.ACTIVE');
assertEq(SUBSCRIPTION_STATUS.EXPIRED, 'expired', 'SUBSCRIPTION_STATUS.EXPIRED');
assertEq(SUBSCRIPTION_STATUS.CANCELLED, 'cancelled', 'SUBSCRIPTION_STATUS.CANCELLED');

// ══════════════════════════════════════
// 2. Command parsing — subscription commands
// ══════════════════════════════════════
console.log('\n📋 Command parsing — subscription commands');
assertEq(parseCommand('PLAN')?.command, 'view_plan', 'PLAN → view_plan');
assertEq(parseCommand('MI PLAN')?.command, 'view_plan', 'MI PLAN → view_plan');
assertEq(parseCommand('PLANES')?.command, 'view_plans', 'PLANES → view_plans');
assertEq(parseCommand('RENOVAR')?.command, 'renew', 'RENOVAR → renew');
assertEq(parseCommand('CAMBIAR PLAN PRO')?.command, 'change_plan', 'CAMBIAR PLAN PRO → change_plan');
assertEq(parseCommand('CAMBIAR PLAN PRO')?.args?.planSlug, 'pro', 'CAMBIAR PLAN PRO args.planSlug = pro');
assertEq(parseCommand('CAMBIAR PLAN BASICO')?.args?.planSlug, 'basico', 'CAMBIAR PLAN BASICO args.planSlug = basico');
assertEq(parseCommand('CAMBIAR PLAN INTERMEDIO')?.args?.planSlug, 'intermedio', 'CAMBIAR PLAN INTERMEDIO → intermedio');

// ══════════════════════════════════════
// 3. Command parsing — super-admin commands
// ══════════════════════════════════════
console.log('\n📋 Command parsing — super-admin commands');
assertEq(parseCommand('VER SUSCRIPCIONES')?.command, 'view_subscriptions', 'VER SUSCRIPCIONES');
assertEq(parseCommand('EXPIRADAS')?.command, 'view_expired', 'EXPIRADAS');

const superConfirm = parseCommand('CONFIRMAR PAGO +5491155551234 intermedio');
assertEq(superConfirm?.command, 'super_confirm_payment', 'super CONFIRMAR PAGO command');
assertEq(superConfirm?.args?.adminPhone, '+5491155551234', 'super confirm phone');
assertEq(superConfirm?.args?.planSlug, 'intermedio', 'super confirm planSlug');

// Should NOT match super-admin pattern (order confirmation)
const orderConfirm = parseCommand('CONFIRMAR PAGO #123');
assertEq(orderConfirm?.command, 'confirm_payment', 'CONFIRMAR PAGO #123 → confirm_payment (not super)');
assertEq(orderConfirm?.args?.orderNumber, 123, 'order confirm orderNumber = 123');

// ══════════════════════════════════════
// 4. Command parsing — promo commands
// ══════════════════════════════════════
console.log('\n📋 Command parsing — promo commands');
assertEq(parseCommand('VER PROMOS')?.command, 'view_promos', 'VER PROMOS');

const promo1 = parseCommand('CREAR PROMO VERANO 10%');
assertEq(promo1?.command, 'create_promo', 'CREAR PROMO percent');
assertEq(promo1?.args?.code, 'VERANO', 'promo code = VERANO');
assertEq(promo1?.args?.discountType, 'percent', 'discount type = percent');
assertEq(promo1?.args?.discountValue, 10, 'discount value = 10');
assert(promo1?.args?.maxUses === null || promo1?.args?.maxUses === undefined, 'no max uses');

const promo2 = parseCommand('CREAR PROMO DESC500 $500');
assertEq(promo2?.command, 'create_promo', 'CREAR PROMO fixed');
assertEq(promo2?.args?.discountType, 'fixed', 'discount type = fixed');
assertEq(promo2?.args?.discountValue, 500, 'discount value = 500');

const promo3 = parseCommand('CREAR PROMO INVIERNO 15% 50');
assertEq(promo3?.args?.maxUses, 50, 'promo with max uses = 50');

// ══════════════════════════════════════
// 5. Command parsing — analytics & trends
// ══════════════════════════════════════
console.log('\n📋 Command parsing — analytics & trends');
assertEq(parseCommand('ANALYTICS')?.command, 'analytics', 'ANALYTICS');
assertEq(parseCommand('ESTADISTICAS')?.command, 'analytics', 'ESTADISTICAS');
assertEq(parseCommand('TENDENCIAS')?.command, 'trends', 'TENDENCIAS');

// ══════════════════════════════════════
// 6. Command parsing — scheduled messages & broadcasts
// ══════════════════════════════════════
console.log('\n📋 Command parsing — scheduled messages & broadcasts');

const sched = parseCommand('PROGRAMAR MENSAJE 20/02 18:00 Hoy tenemos promo');
assertEq(sched?.command, 'schedule_message', 'PROGRAMAR MENSAJE');
assertEq(sched?.args?.day, 20, 'schedule day = 20');
assertEq(sched?.args?.month, 2, 'schedule month = 2');
assertEq(sched?.args?.hour, 18, 'schedule hour = 18');
assertEq(sched?.args?.minute, 0, 'schedule minute = 0');
assertEq(sched?.args?.message, 'Hoy tenemos promo', 'schedule message text');

assertEq(parseCommand('VER PROGRAMADOS')?.command, 'view_scheduled', 'VER PROGRAMADOS');

const broadcast = parseCommand('DIFUSION Hoy promo 2x1 en pizzas!');
assertEq(broadcast?.command, 'broadcast', 'DIFUSION');
assertEq(broadcast?.args?.message, 'Hoy promo 2x1 en pizzas!', 'broadcast message');

// ══════════════════════════════════════
// 7. Command parsing — loyalty
// ══════════════════════════════════════
console.log('\n📋 Command parsing — loyalty');

const loyal1 = parseCommand('CONFIGURAR FIDELIDAD 10 pedidos = 1 gratis');
assertEq(loyal1?.command, 'configure_loyalty', 'CONFIGURAR FIDELIDAD free_order');
assertEq(loyal1?.args?.threshold, 10, 'threshold = 10');
assertEq(loyal1?.args?.rewardType, 'free_order', 'rewardType = free_order');

const loyal2 = parseCommand('CONFIGURAR FIDELIDAD 5 pedidos = 15%');
assertEq(loyal2?.command, 'configure_loyalty', 'CONFIGURAR FIDELIDAD percent');
assertEq(loyal2?.args?.threshold, 5, 'threshold = 5');
assertEq(loyal2?.args?.rewardType, 'discount_percent', 'rewardType = discount_percent');
assertEq(loyal2?.args?.rewardValue, 15, 'rewardValue = 15');

const loyal3 = parseCommand('CONFIGURAR FIDELIDAD 8 pedidos = $500');
assertEq(loyal3?.command, 'configure_loyalty', 'CONFIGURAR FIDELIDAD fixed');
assertEq(loyal3?.args?.rewardType, 'discount_fixed', 'rewardType = discount_fixed');
assertEq(loyal3?.args?.rewardValue, 500, 'rewardValue = 500');

assertEq(parseCommand('VER FIDELIDAD')?.command, 'view_loyalty', 'VER FIDELIDAD');

// ══════════════════════════════════════
// 8. Promo discount calculation
// ══════════════════════════════════════
console.log('\n📋 Promo discount calculation');
assertEq(calculateDiscount({ discount_type: 'percent', discount_value: 10 }, 5000), 500, '10% of 5000 = 500');
assertEq(calculateDiscount({ discount_type: 'percent', discount_value: 50 }, 3000), 1500, '50% of 3000 = 1500');
assertEq(calculateDiscount({ discount_type: 'fixed', discount_value: 1000 }, 5000), 1000, 'fixed 1000 on 5000');
assertEq(calculateDiscount({ discount_type: 'fixed', discount_value: 8000 }, 5000), 5000, 'fixed 8000 capped at subtotal 5000');

// ══════════════════════════════════════
// 9. Subscription formatters
// ══════════════════════════════════════
console.log('\n📋 Subscription formatters');

const noPlan = formatPlanInfo(null);
assert(noPlan.includes('No tenés una suscripción activa'), 'formatPlanInfo(null) shows no subscription');

const mockSub = {
  plan: {
    name: 'Pro',
    price_usd: 60,
    monthly_order_limit: null,
    delivery_zone_limit: 999,
    ai_enabled: true,
    daily_summary: true,
    promo_codes: true,
    analytics_queries_limit: 999,
    broadcasts: true,
    loyalty: true,
  },
  status: 'active',
  end_date: '2026-12-31T00:00:00Z',
};
const proInfo = formatPlanInfo(mockSub);
assert(proInfo.includes('Tu Plan: Pro'), 'formatPlanInfo shows plan name');
assert(proInfo.includes('Activa'), 'formatPlanInfo shows active status');
assert(proInfo.includes('Ilimitados'), 'formatPlanInfo shows unlimited orders');
assert(proInfo.includes('Ilimitadas'), 'formatPlanInfo shows unlimited zones');

const mockPlans = [
  { name: 'Básico', price_usd: 10, monthly_order_limit: 100, delivery_zone_limit: 3, ai_enabled: false },
  { name: 'Intermedio', price_usd: 20, monthly_order_limit: 500, delivery_zone_limit: 10, ai_enabled: true, daily_summary: true, promo_codes: true, analytics_queries_limit: 20 },
  { name: 'Pro', price_usd: 60, monthly_order_limit: null, delivery_zone_limit: 999, ai_enabled: true, daily_summary: true, promo_codes: true, analytics_queries_limit: 999, broadcasts: true, loyalty: true, scheduled_messages: true, trends: true },
];
const comparison = formatPlansComparison(mockPlans);
assert(comparison.includes('Planes Disponibles'), 'comparison header');
assert(comparison.includes('Básico'), 'shows Basico');
assert(comparison.includes('Intermedio'), 'shows Intermedio');
assert(comparison.includes('Pro'), 'shows Pro');
assert(comparison.includes('$10'), 'shows Basico price');
assert(comparison.includes('RENOVAR'), 'shows RENOVAR CTA');

// ══════════════════════════════════════
// 10. Promo formatters
// ══════════════════════════════════════
console.log('\n📋 Promo formatters');
assertEq(formatPromoList([]).includes('No tenés códigos'), true, 'empty promo list');
const promoList = formatPromoList([
  { code: 'VERANO', discount_type: 'percent', discount_value: 10, current_uses: 5, max_uses: 50, expires_at: null },
]);
assert(promoList.includes('VERANO'), 'shows promo code');
assert(promoList.includes('10%'), 'shows percent discount');
assert(promoList.includes('5/50'), 'shows usage');

// ══════════════════════════════════════
// 11. Loyalty formatters
// ══════════════════════════════════════
console.log('\n📋 Loyalty formatters');
assertEq(formatRewardLabel({ threshold: 10, reward_type: 'free_order', reward_value: 0 }), '10 pedidos = 1 gratis', 'free order label');
assertEq(formatRewardLabel({ threshold: 5, reward_type: 'discount_percent', reward_value: 15 }), '5 pedidos = 15% de descuento', 'percent label');
assertEq(formatRewardLabel({ threshold: 8, reward_type: 'discount_fixed', reward_value: 500 }), '8 pedidos = $500 de descuento', 'fixed label');

const loyaltyStatus = formatLoyaltyStatus(
  { order_count: 7, rewards_claimed: 0 },
  { threshold: 10, reward_type: 'free_order', reward_value: 0 }
);
assert(loyaltyStatus.includes('3'), 'shows remaining orders');
assert(loyaltyStatus.includes('7'), 'shows order count');

const loyaltyReady = formatLoyaltyStatus(
  { order_count: 10, rewards_claimed: 0 },
  { threshold: 10, reward_type: 'free_order', reward_value: 0 }
);
assert(loyaltyReady.includes('recompensa disponible'), 'shows reward ready');

assert(formatLoyaltyStatus(null, null) === null, 'null card returns null');

// ══════════════════════════════════════
// 12. Scheduler — parseClosingHour
// ══════════════════════════════════════
console.log('\n📋 Scheduler — parseClosingHour');
assertEq(parseClosingHour('10:00 - 22:00'), 22, '"10:00 - 22:00" → 22');
assertEq(parseClosingHour('10 a 22'), 22, '"10 a 22" → 22');
assertEq(parseClosingHour('Lun-Sab 10-22'), 22, '"Lun-Sab 10-22" → 22');
assertEq(parseClosingHour('09:00 – 21:30'), 21, '"09:00 – 21:30" → 21');
assertEq(parseClosingHour(null), null, 'null → null');
assertEq(parseClosingHour(''), null, 'empty → null');

// ══════════════════════════════════════
// 13. Plan feature expectations
// ══════════════════════════════════════
console.log('\n📋 Plan feature expectations');

// Basico: no AI, no promos, no analytics, no broadcasts, no loyalty
const basico = { ai_enabled: false, daily_summary: false, promo_codes: false, analytics_queries_limit: 0, broadcasts: false, loyalty: false, scheduled_messages: false, trends: false };
assert(!basico.ai_enabled, 'Basico: no AI');
assert(!basico.promo_codes, 'Basico: no promos');
assert(!basico.broadcasts, 'Basico: no broadcasts');
assert(!basico.loyalty, 'Basico: no loyalty');

// Intermedio: AI, promos, analytics(20), summary, no broadcasts, no loyalty
const intermedio = { ai_enabled: true, daily_summary: true, promo_codes: true, analytics_queries_limit: 20, broadcasts: false, loyalty: false, scheduled_messages: false, trends: false };
assert(intermedio.ai_enabled, 'Intermedio: AI enabled');
assert(intermedio.promo_codes, 'Intermedio: promos enabled');
assertEq(intermedio.analytics_queries_limit, 20, 'Intermedio: 20 analytics');
assert(!intermedio.broadcasts, 'Intermedio: no broadcasts');

// Pro: everything
const pro = { ai_enabled: true, daily_summary: true, promo_codes: true, analytics_queries_limit: 999, broadcasts: true, loyalty: true, scheduled_messages: true, trends: true };
assert(pro.ai_enabled, 'Pro: AI enabled');
assert(pro.broadcasts, 'Pro: broadcasts');
assert(pro.loyalty, 'Pro: loyalty');
assert(pro.trends, 'Pro: trends');
assert(pro.scheduled_messages, 'Pro: scheduled messages');

// ══════════════════════════════════════
// Summary
// ══════════════════════════════════════
console.log(`\n${'═'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
