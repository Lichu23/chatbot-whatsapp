const db = require('./database');

async function createPromo(businessId, code, discountType, discountValue, maxUses) {
  return db.createPromoCode(businessId, code, discountType, discountValue, maxUses, null);
}

async function getActivePromos(businessId) {
  return db.getActivePromoCodes(businessId);
}

async function validatePromo(businessId, code) {
  const promo = await db.getPromoByCode(businessId, code);

  if (!promo) {
    return { valid: false, promo: null, error: 'Código de descuento no válido.' };
  }

  // Check uses limit
  if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
    return { valid: false, promo, error: 'Este código ya alcanzó su límite de usos.' };
  }

  // Check expiry
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { valid: false, promo, error: 'Este código de descuento expiró.' };
  }

  return { valid: true, promo, error: null };
}

async function applyPromo(promoId) {
  return db.incrementPromoUses(promoId);
}

function calculateDiscount(promo, subtotal) {
  if (promo.discount_type === 'percent') {
    return Math.round(subtotal * promo.discount_value / 100);
  }
  // Fixed discount — cap at subtotal
  return Math.min(promo.discount_value, subtotal);
}

function formatPromoList(promos) {
  if (promos.length === 0) {
    return '🎟️ No tenés códigos de descuento activos.';
  }

  let text = '🎟️ *Códigos de descuento activos:*\n\n';

  for (const p of promos) {
    const discount = p.discount_type === 'percent'
      ? `${p.discount_value}%`
      : `$${p.discount_value}`;
    const uses = p.max_uses !== null
      ? `${p.current_uses}/${p.max_uses} usos`
      : `${p.current_uses} usos`;
    const expiry = p.expires_at
      ? `Vence: ${new Date(p.expires_at).toLocaleDateString('es-AR')}`
      : 'Sin vencimiento';

    text += `• *${p.code}* — ${discount} de descuento\n`;
    text += `  ${uses} | ${expiry}\n\n`;
  }

  return text;
}

module.exports = {
  createPromo,
  getActivePromos,
  validatePromo,
  applyPromo,
  calculateDiscount,
  formatPromoList,
};
