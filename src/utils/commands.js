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

  // CONFIRMAR PAGO #123
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

  return null;
}

module.exports = { parseCommand };
