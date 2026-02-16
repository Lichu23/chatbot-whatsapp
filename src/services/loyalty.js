const db = require('./database');
const subscription = require('./subscription');

/**
 * Increment loyalty after a completed order.
 * Returns { card, rewardEarned, config } if a reward was just earned.
 */
async function incrementLoyalty(businessId, customerPhone) {
  const hasLoyalty = await subscription.checkFeatureAccess(businessId, 'loyalty');
  if (!hasLoyalty) return null;

  const config = await db.getLoyaltyConfig(businessId);
  if (!config) return null;

  const card = await db.incrementLoyaltyCard(businessId, customerPhone);

  // Check if they just earned a reward
  const ordersForReward = card.order_count - (card.rewards_claimed * config.threshold);
  const rewardEarned = ordersForReward >= config.threshold;

  return { card, rewardEarned, config };
}

/**
 * Check if customer has a pending (unclaimed) reward.
 */
async function checkPendingReward(businessId, customerPhone) {
  const hasLoyalty = await subscription.checkFeatureAccess(businessId, 'loyalty');
  if (!hasLoyalty) return null;

  const config = await db.getLoyaltyConfig(businessId);
  if (!config) return null;

  const card = await db.getLoyaltyCard(businessId, customerPhone);
  if (!card) return null;

  const totalRewardsEarned = Math.floor(card.order_count / config.threshold);
  const pendingRewards = totalRewardsEarned - card.rewards_claimed;

  if (pendingRewards <= 0) return null;

  return { card, config, pendingRewards };
}

/**
 * Apply (claim) a loyalty reward. Returns the discount amount.
 */
async function applyReward(businessId, customerPhone, subtotal) {
  const pending = await checkPendingReward(businessId, customerPhone);
  if (!pending) return 0;

  const { card, config } = pending;

  await db.claimLoyaltyReward(card.id);

  switch (config.reward_type) {
    case 'free_order':
      return subtotal; // 100% discount
    case 'discount_percent':
      return Math.round(subtotal * config.reward_value / 100);
    case 'discount_fixed':
      return Math.min(config.reward_value, subtotal);
    default:
      return 0;
  }
}

/**
 * Format reward description for display.
 */
function formatRewardLabel(config) {
  switch (config.reward_type) {
    case 'free_order':
      return `${config.threshold} pedidos = 1 gratis`;
    case 'discount_percent':
      return `${config.threshold} pedidos = ${config.reward_value}% de descuento`;
    case 'discount_fixed':
      return `${config.threshold} pedidos = $${config.reward_value} de descuento`;
    default:
      return `${config.threshold} pedidos`;
  }
}

/**
 * Format loyalty status for a customer.
 */
function formatLoyaltyStatus(card, config) {
  if (!card || !config) return null;

  const totalRewardsEarned = Math.floor(card.order_count / config.threshold);
  const pendingRewards = totalRewardsEarned - card.rewards_claimed;
  const progress = card.order_count % config.threshold;
  const remaining = progress === 0 && pendingRewards <= 0 ? config.threshold : config.threshold - progress;

  let text = `🏆 *Tu tarjeta de fidelidad*\n\n`;
  text += `Pedidos: ${card.order_count}\n`;
  text += `Recompensas canjeadas: ${card.rewards_claimed}\n`;
  text += `Programa: ${formatRewardLabel(config)}\n\n`;

  if (pendingRewards > 0) {
    text += '🎉 ¡Tenés una recompensa disponible! Se aplica automáticamente en tu próximo pedido.';
  } else {
    text += `Te faltan *${remaining}* pedido${remaining > 1 ? 's' : ''} para tu próxima recompensa.`;
  }

  return text;
}

module.exports = {
  incrementLoyalty,
  checkPendingReward,
  applyReward,
  formatRewardLabel,
  formatLoyaltyStatus,
};
