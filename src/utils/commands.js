/**
 * Parse exact admin commands (critical actions that need precision).
 * Returns { command, args } or null if not a recognized command.
 *
 * Non-command messages are handled by AI intent classification in workflow.js.
 */
function parseCommand(text) {
  const normalized = text.trim().toUpperCase();

  // Exact keyword commands
  const commands = {
    'AYUDA': 'ayuda',
    'PAUSAR PRODUCTO': 'pause_product',
    'SINCRONIZAR': 'sync_catalog',
    'SINCRONIZAR CATÁLOGO': 'sync_catalog',
    'SINCRONIZAR CATALOGO': 'sync_catalog',
    'VER PEDIDOS': 'view_orders',
    'VER MENÚ': 'view_menu',
    'VER MENU': 'view_menu',
    'VER NEGOCIO': 'view_business',
    'PLAN': 'view_plan',
    'MI PLAN': 'view_plan',
    'PLANES': 'view_plans',
    'RENOVAR': 'renew',
    'VER SUSCRIPCIONES': 'view_subscriptions',
    'EXPIRADAS': 'view_expired',
    'VER PROMOS': 'view_promos',
    'ANALYTICS': 'analytics',
    'ESTADÍSTICAS': 'analytics',
    'ESTADISTICAS': 'analytics',
    'TENDENCIAS': 'trends',
    'CREAR PROMO': 'create_promo',
    'DIFUSION': 'broadcast',
    'DIFUSIÓN': 'broadcast',
    'FIDELIDAD': 'view_loyalty',
    'CONFIGURAR FIDELIDAD': 'configure_loyalty',
    'EDITAR PRODUCTO': 'edit_product',
    'AGREGAR PRODUCTO': 'add_product',
  };

  const command = commands[normalized];
  if (command) return { command };

  // Pattern-based commands with arguments (order management needs exact #N)

  // VER PEDIDO #123
  const viewOrderMatch = normalized.match(/^VER\s+PEDIDO\s+#?(\d+)$/);
  if (viewOrderMatch) return { command: 'view_order', args: { orderNumber: parseInt(viewOrderMatch[1], 10) } };

  // ESTADO PEDIDO #123 preparando (with status)
  const orderStatusMatch = normalized.match(/^ESTADO\s+PEDIDO\s+#?(\d+)\s+(\S+)$/);
  if (orderStatusMatch) return { command: 'order_status', args: { orderNumber: parseInt(orderStatusMatch[1], 10), status: orderStatusMatch[2].toLowerCase() } };

  // ESTADO PEDIDO #123 (without status — show current status)
  const orderStatusNoArgs = normalized.match(/^ESTADO\s+PEDIDO\s+#?(\d+)$/);
  if (orderStatusNoArgs) return { command: 'view_order', args: { orderNumber: parseInt(orderStatusNoArgs[1], 10) } };

  // CONFIRMAR PAGO +5493XXX intermedio (super-admin: activate subscription)
  const superConfirmMatch = normalized.match(/^CONFIRMAR\s+PAGO\s+(\+?\d{10,15})\s+(BASICO|BÁSICO|INTERMEDIO|PRO)$/);
  if (superConfirmMatch) {
    return {
      command: 'super_confirm_payment',
      args: {
        adminPhone: superConfirmMatch[1],
        planSlug: superConfirmMatch[2].toLowerCase().replace('á', 'a'),
      },
    };
  }

  // CONFIRMAR PAGO #123 (admin: confirm order payment)
  const confirmPayMatch = normalized.match(/^CONFIRMAR\s+PAGO\s+#?(\d+)$/);
  if (confirmPayMatch) return { command: 'confirm_payment', args: { orderNumber: parseInt(confirmPayMatch[1], 10) } };

  // RECHAZAR PEDIDO #123 (optional reason after)
  const rejectMatch = normalized.match(/^RECHAZAR\s+PEDIDO\s+#?(\d+)(.*)$/);
  if (rejectMatch) {
    const reason = text.trim().replace(/^RECHAZAR\s+PEDIDO\s+#?\d+\s*/i, '').trim() || null;
    return { command: 'reject_order', args: { orderNumber: parseInt(rejectMatch[1], 10), reason } };
  }

  // VENTAS HOY / VENTAS SEMANA / VENTAS MES
  const salesMatch = normalized.match(/^VENTAS\s+(HOY|SEMANA|MES)$/);
  if (salesMatch) return { command: 'sales_summary', args: { period: salesMatch[1].toLowerCase() } };

  // CAMBIAR PLAN basico/intermedio/pro
  const changePlanMatch = normalized.match(/^CAMBIAR\s+PLAN\s+(BASICO|BÁSICO|INTERMEDIO|PRO)$/);
  if (changePlanMatch) {
    const slug = changePlanMatch[1].toLowerCase().replace('á', 'a');
    return { command: 'change_plan', args: { planSlug: slug } };
  }

  // CAMBIAR PLAN (without specifying which plan)
  if (normalized === 'CAMBIAR PLAN') {
    return { command: 'change_plan', args: { planSlug: null } };
  }

  // CONFIGURAR FIDELIDAD 10 pedidos = 1 gratis / 10 pedidos = 15% / 10 pedidos = $500
  const loyaltyMatch = text.trim().match(/^CONFIGURAR\s+FIDELIDAD\s+(\d+)\s+pedidos?\s*=\s*(?:1\s+gratis|(\d+)%|\$(\d+(?:[.,]\d+)?))/i);
  if (loyaltyMatch) {
    const threshold = parseInt(loyaltyMatch[1], 10);
    let rewardType, rewardValue;
    if (loyaltyMatch[2]) {
      rewardType = 'discount_percent';
      rewardValue = parseFloat(loyaltyMatch[2]);
    } else if (loyaltyMatch[3]) {
      rewardType = 'discount_fixed';
      rewardValue = parseFloat(loyaltyMatch[3].replace(',', '.'));
    } else {
      rewardType = 'free_order';
      rewardValue = 0;
    }
    return { command: 'configure_loyalty', args: { threshold, rewardType, rewardValue } };
  }

  // VER FIDELIDAD
  if (normalized === 'VER FIDELIDAD') {
    return { command: 'view_loyalty' };
  }

  // DIFUSION mensaje — broadcast to all past customers
  const broadcastMatch = text.trim().match(/^DIFUSI[OÓ]N\s+(.+)$/i);
  if (broadcastMatch) {
    return { command: 'broadcast', args: { message: broadcastMatch[1].trim() } };
  }

  // PROGRAMAR MENSAJE dd/mm HH:MM texto
  const scheduleMatch = text.trim().match(/^PROGRAMAR\s+MENSAJE\s+(\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2})\s+(.+)$/i);
  if (scheduleMatch) {
    const day = parseInt(scheduleMatch[1], 10);
    const month = parseInt(scheduleMatch[2], 10);
    const hour = parseInt(scheduleMatch[3], 10);
    const minute = parseInt(scheduleMatch[4], 10);
    const message = scheduleMatch[5].trim();
    return { command: 'schedule_message', args: { day, month, hour, minute, message } };
  }

  // VER PROGRAMADOS
  if (normalized === 'VER PROGRAMADOS') {
    return { command: 'view_scheduled' };
  }

  // CREAR PROMO VERANO 10% or CREAR PROMO VERANO $500 (optional max uses: CREAR PROMO VERANO 10% 50)
  const createPromoMatch = text.trim().match(/^CREAR\s+PROMO\s+(\S+)\s+(?:\$(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)%)\s*(\d+)?$/i);
  if (createPromoMatch) {
    const code = createPromoMatch[1].toUpperCase();
    let discountType, discountValue;
    if (createPromoMatch[2]) {
      discountType = 'fixed';
      discountValue = parseFloat(createPromoMatch[2].replace(',', '.'));
    } else {
      discountType = 'percent';
      discountValue = parseFloat(createPromoMatch[3].replace(',', '.'));
    }
    const maxUses = createPromoMatch[4] ? parseInt(createPromoMatch[4], 10) : null;
    return { command: 'create_promo', args: { code, discountType, discountValue, maxUses } };
  }

  // AGREGAR PRODUCTO nombre | precio | categoria (strict format for Basic plan)
  const addProductMatch = text.trim().match(/^AGREGAR\s+PRODUCTO\s+(.+?)\s*\|\s*\$?(\d+(?:[.,]\d+)?)\s*(?:\|\s*(.+))?$/i);
  if (addProductMatch) {
    return {
      command: 'add_product',
      args: {
        name: addProductMatch[1].trim(),
        price: parseFloat(addProductMatch[2].replace(',', '.')),
        category: addProductMatch[3] ? addProductMatch[3].trim() : null,
      },
    };
  }

  return null;
}

module.exports = { parseCommand };
