/**
 * Parse post-onboarding admin commands.
 * Returns { command, args } or null if not a recognized command.
 */
function parseCommand(text) {
  const normalized = text.trim().toUpperCase();

  const commands = {
    'AYUDA': 'AYUDA',
    'EDITAR NOMBRE': 'EDIT_NAME',
    'EDITAR HORARIO': 'EDIT_HOURS',
    'EDITAR DIRECCIÓN': 'EDIT_ADDRESS',
    'EDITAR DIRECCION': 'EDIT_ADDRESS',
    'EDITAR ENTREGA': 'EDIT_DELIVERY',
    'EDITAR PAGOS': 'EDIT_PAYMENTS',
    'EDITAR ZONAS': 'EDIT_ZONES',
    'EDITAR BANCO': 'EDIT_BANK',
    'EDITAR MENÚ': 'EDIT_PRODUCTS',
    'EDITAR MENU': 'EDIT_PRODUCTS',
    'AGREGAR PRODUCTO': 'ADD_PRODUCT',
    'ELIMINAR PRODUCTO': 'DELETE_PRODUCT',
    'PAUSAR PRODUCTO': 'PAUSE_PRODUCT',
    'VER MENÚ': 'VIEW_MENU',
    'VER MENU': 'VIEW_MENU',
    'VER NEGOCIO': 'VIEW_BUSINESS',
    'VER PEDIDOS': 'VIEW_ORDERS',
  };

  const command = commands[normalized];
  if (command) return { command };

  // Pattern-based commands with arguments

  // VER PEDIDO #123
  const viewOrderMatch = normalized.match(/^VER\s+PEDIDO\s+#?(\d+)$/);
  if (viewOrderMatch) return { command: 'VIEW_ORDER', args: { orderNumber: parseInt(viewOrderMatch[1], 10) } };

  // ESTADO PEDIDO #123 preparando (with status)
  const orderStatusMatch = normalized.match(/^ESTADO\s+PEDIDO\s+#?(\d+)\s+(\S+)$/);
  if (orderStatusMatch) return { command: 'ORDER_STATUS', args: { orderNumber: parseInt(orderStatusMatch[1], 10), status: orderStatusMatch[2].toLowerCase() } };

  // ESTADO PEDIDO #123 (without status — show current status)
  const orderStatusNoArgs = normalized.match(/^ESTADO\s+PEDIDO\s+#?(\d+)$/);
  if (orderStatusNoArgs) return { command: 'VIEW_ORDER', args: { orderNumber: parseInt(orderStatusNoArgs[1], 10) } };

  // CONFIRMAR PAGO #123
  const confirmPayMatch = normalized.match(/^CONFIRMAR\s+PAGO\s+#?(\d+)$/);
  if (confirmPayMatch) return { command: 'CONFIRM_PAYMENT', args: { orderNumber: parseInt(confirmPayMatch[1], 10) } };

  // RECHAZAR PEDIDO #123 (optional reason after)
  const rejectMatch = normalized.match(/^RECHAZAR\s+PEDIDO\s+#?(\d+)(.*)$/);
  if (rejectMatch) {
    const reason = text.trim().replace(/^RECHAZAR\s+PEDIDO\s+#?\d+\s*/i, '').trim() || null;
    return { command: 'REJECT_ORDER', args: { orderNumber: parseInt(rejectMatch[1], 10), reason } };
  }

  // VENTAS HOY / VENTAS SEMANA / VENTAS MES
  const salesMatch = normalized.match(/^VENTAS\s+(HOY|SEMANA|MES)$/);
  if (salesMatch) return { command: 'SALES_SUMMARY', args: { period: salesMatch[1].toLowerCase() } };

  return null;
}

module.exports = { parseCommand };
