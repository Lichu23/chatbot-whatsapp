/**
 * Integration verification for subscription system against Supabase.
 * Run: node test/verify-subscriptions.js
 *
 * Requires: .env with SUPABASE_URL and SUPABASE_KEY
 * Requires: SQL migrations already run (subscription_plans seeded)
 */

const db = require('../src/services/database');
const subscription = require('../src/services/subscription');
const analytics = require('../src/services/analytics');
const { PLAN_SLUGS, SUBSCRIPTION_STATUS } = require('../src/config');

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition, testName) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ ${testName}`);
  }
}

function skip(testName) {
  skipped++;
  console.log(`  ⏭️  ${testName} (skipped — requires test data)`);
}

async function run() {
  console.log('\n🔌 Connecting to Supabase...');

  // ══════════════════════════════════════
  // 1. Health check
  // ══════════════════════════════════════
  console.log('\n📋 Database health');
  try {
    const health = await db.healthCheck();
    assert(health, 'Supabase connection OK');
  } catch (err) {
    console.error('  ❌ Supabase connection failed:', err.message);
    console.error('\nCannot continue without database connection.');
    process.exit(1);
  }

  // ══════════════════════════════════════
  // 2. Subscription plans exist
  // ══════════════════════════════════════
  console.log('\n📋 Subscription plans');
  let plans;
  try {
    plans = await db.getSubscriptionPlans();
    assert(plans && plans.length === 3, `3 plans exist (got ${plans?.length || 0})`);
  } catch (err) {
    console.error('  ❌ getSubscriptionPlans failed:', err.message);
    console.log('\n⚠️  Run sql/create-subscriptions.sql first.');
    process.exit(1);
  }

  if (plans && plans.length === 3) {
    const basico = plans.find((p) => p.slug === 'basico');
    const intermedio = plans.find((p) => p.slug === 'intermedio');
    const pro = plans.find((p) => p.slug === 'pro');

    assert(basico, 'Basico plan exists');
    assert(intermedio, 'Intermedio plan exists');
    assert(pro, 'Pro plan exists');

    if (basico) {
      assert(basico.price_usd === 10 || basico.price_usd === '10', `Basico price = $10 (got ${basico.price_usd})`);
      assert(basico.monthly_order_limit === 100, `Basico order limit = 100 (got ${basico.monthly_order_limit})`);
      assert(basico.delivery_zone_limit === 3, `Basico zone limit = 3`);
      assert(!basico.ai_enabled, 'Basico: AI disabled');
      assert(!basico.promo_codes, 'Basico: promos disabled');
      assert(!basico.broadcasts, 'Basico: broadcasts disabled');
      assert(!basico.loyalty, 'Basico: loyalty disabled');
    }

    if (intermedio) {
      assert(intermedio.price_usd === 20 || intermedio.price_usd === '20', `Intermedio price = $20`);
      assert(intermedio.monthly_order_limit === 500, `Intermedio order limit = 500`);
      assert(intermedio.delivery_zone_limit === 10, `Intermedio zone limit = 10`);
      assert(intermedio.ai_enabled, 'Intermedio: AI enabled');
      assert(intermedio.daily_summary, 'Intermedio: daily summary enabled');
      assert(intermedio.promo_codes, 'Intermedio: promos enabled');
      assert(intermedio.analytics_queries_limit === 20, `Intermedio: 20 analytics queries`);
      assert(!intermedio.broadcasts, 'Intermedio: broadcasts disabled');
      assert(!intermedio.loyalty, 'Intermedio: loyalty disabled');
    }

    if (pro) {
      assert(pro.price_usd === 60 || pro.price_usd === '60', `Pro price = $60`);
      assert(pro.monthly_order_limit === null, `Pro: unlimited orders`);
      assert(pro.delivery_zone_limit >= 999, `Pro: unlimited zones`);
      assert(pro.ai_enabled, 'Pro: AI enabled');
      assert(pro.broadcasts, 'Pro: broadcasts enabled');
      assert(pro.loyalty, 'Pro: loyalty enabled');
      assert(pro.trends, 'Pro: trends enabled');
      assert(pro.scheduled_messages, 'Pro: scheduled messages enabled');
    }
  }

  // ══════════════════════════════════════
  // 3. Plan lookup
  // ══════════════════════════════════════
  console.log('\n📋 Plan lookup');
  const basicoPlan = await db.getPlanBySlug(PLAN_SLUGS.BASICO);
  assert(basicoPlan?.slug === 'basico', 'getPlanBySlug(basico) works');

  const intermedioPlan = await db.getPlanBySlug(PLAN_SLUGS.INTERMEDIO);
  assert(intermedioPlan?.slug === 'intermedio', 'getPlanBySlug(intermedio) works');

  const proPlan = await db.getPlanBySlug(PLAN_SLUGS.PRO);
  assert(proPlan?.slug === 'pro', 'getPlanBySlug(pro) works');

  const nullPlan = await db.getPlanBySlug('nonexistent');
  assert(nullPlan === null, 'getPlanBySlug(nonexistent) returns null');

  // ══════════════════════════════════════
  // 4. Subscription service functions (require active business)
  // ══════════════════════════════════════
  console.log('\n📋 Subscription service (requires active business)');

  // Try to find an existing business
  let testBusiness;
  try {
    testBusiness = await db.getActiveBusiness();
  } catch (e) { /* no active business */ }

  if (testBusiness) {
    console.log(`  Using test business: ${testBusiness.business_name} (${testBusiness.id})`);

    const sub = await subscription.getActiveSubscription(testBusiness.id);
    if (sub) {
      assert(sub.plan !== undefined, 'getActiveSubscription returns plan data');
      assert(sub.status !== undefined, 'getActiveSubscription returns status');
      assert(sub.end_date !== undefined, 'getActiveSubscription returns end_date');
      console.log(`  Current plan: ${sub.plan?.name}, status: ${sub.status}`);

      // Test feature access
      const hasAI = await subscription.checkFeatureAccess(testBusiness.id, 'ai_enabled');
      assert(typeof hasAI === 'boolean', `checkFeatureAccess returns boolean (${hasAI})`);

      // Test order limit
      const orderLimit = await subscription.checkOrderLimit(testBusiness.id);
      assert(typeof orderLimit.allowed === 'boolean', 'checkOrderLimit returns allowed');
      assert(typeof orderLimit.current === 'number', 'checkOrderLimit returns current');
      console.log(`  Order limit: ${orderLimit.current}/${orderLimit.limit || '∞'} (allowed: ${orderLimit.allowed})`);

      // Test zone limit
      const zoneLimit = await subscription.checkZoneLimit(testBusiness.id);
      assert(typeof zoneLimit.allowed === 'boolean', 'checkZoneLimit returns allowed');
      console.log(`  Zone limit: ${zoneLimit.current}/${zoneLimit.limit} (allowed: ${zoneLimit.allowed})`);

      // Test analytics limit
      const analyticsLimit = await analytics.checkAnalyticsLimit(testBusiness.id);
      assert(typeof analyticsLimit.allowed === 'boolean', 'checkAnalyticsLimit returns allowed');
      console.log(`  Analytics limit: ${analyticsLimit.current}/${analyticsLimit.limit || '∞'} (allowed: ${analyticsLimit.allowed})`);

      // Test formatPlanInfo
      const planInfo = subscription.formatPlanInfo(sub);
      assert(planInfo.includes(sub.plan.name), 'formatPlanInfo includes plan name');
    } else {
      skip('getActiveSubscription (no subscription found — run onboarding first)');
      skip('checkFeatureAccess');
      skip('checkOrderLimit');
      skip('checkZoneLimit');
      skip('checkAnalyticsLimit');
      skip('formatPlanInfo');
    }
  } else {
    skip('All subscription service tests (no active business)');
  }

  // ══════════════════════════════════════
  // 5. Format functions with real plan data
  // ══════════════════════════════════════
  console.log('\n📋 Format functions with real plan data');
  if (plans && plans.length > 0) {
    const comparison = subscription.formatPlansComparison(plans);
    assert(comparison.includes('Planes Disponibles'), 'formatPlansComparison header');
    assert(comparison.includes('$10') || comparison.includes('10'), 'comparison includes basico price');
    assert(comparison.includes('RENOVAR'), 'comparison includes RENOVAR CTA');
  }

  // ══════════════════════════════════════
  // Summary
  // ══════════════════════════════════════
  console.log(`\n${'═'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log(`${'═'.repeat(40)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('\n💥 Unexpected error:', err);
  process.exit(1);
});
