const { createClient } = require('@supabase/supabase-js');
const { config, STEPS } = require('../config');

const supabase = createClient(config.supabase.url, config.supabase.key);

// ── Phone Config Cache ──

const phoneConfigCache = {}; // key: metaPhoneNumberId, value: { config, fetchedAt }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function clearPhoneConfigCache() {
  for (const key of Object.keys(phoneConfigCache)) {
    delete phoneConfigCache[key];
  }
}

// ── Health Check ──

async function healthCheck() {
  const { error } = await supabase.from('businesses').select('id').limit(1);
  if (error) throw error;
}

// ── Failed Messages ──

async function logFailedMessage(phoneNumberId, senderPhone, payload, error) {
  const { error: insertErr } = await supabase.from('failed_messages').insert({
    phone_number_id: phoneNumberId,
    sender_phone: senderPhone,
    raw_payload: payload,
    error_message: error?.message || String(error),
    error_stack: error?.stack || null,
  });
  if (insertErr) throw insertErr;
}

// ── Webhook Logs ──

async function logWebhook(phoneNumberId, senderPhone, messageType, payload) {
  const { error } = await supabase.from('webhook_logs').insert({
    phone_number_id: phoneNumberId,
    sender_phone: senderPhone,
    message_type: messageType,
    raw_payload: payload,
  });
  if (error) throw error;
}

async function cleanupWebhookLogs() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from('webhook_logs').delete().lt('created_at', cutoff);
  if (error) throw error;
}

// ── Phone Numbers ──

async function getPhoneConfig(metaPhoneNumberId) {
  const cached = phoneConfigCache[metaPhoneNumberId];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.config;
  }

  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('meta_phone_number_id', metaPhoneNumberId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;

  const phoneConfig = {
    id: data.id,
    metaPhoneNumberId: data.meta_phone_number_id,
    token: data.meta_whatsapp_token,
    catalogId: data.catalog_id,
    displayName: data.display_name,
    businessId: data.business_id,
    isActive: data.is_active,
  };

  phoneConfigCache[metaPhoneNumberId] = { config: phoneConfig, fetchedAt: Date.now() };
  return phoneConfig;
}

async function getPhoneConfigById(id) {
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;

  return {
    id: data.id,
    metaPhoneNumberId: data.meta_phone_number_id,
    token: data.meta_whatsapp_token,
    catalogId: data.catalog_id,
    displayName: data.display_name,
    businessId: data.business_id,
    isActive: data.is_active,
  };
}

async function getBusinessByPhoneNumberId(metaPhoneNumberId) {
  const phoneConfig = await getPhoneConfig(metaPhoneNumberId);
  if (!phoneConfig || !phoneConfig.businessId) return null;

  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', phoneConfig.businessId)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ── Invite Codes ──

async function findInviteCode(code) {
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function markCodeAsUsed(codeId, phone) {
  const { error } = await supabase
    .from('invite_codes')
    .update({ used_by_phone: phone, used_at: new Date().toISOString() })
    .eq('id', codeId);

  if (error) throw error;
}

// ── Admins ──

async function findAdmin(phone) {
  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .eq('phone', phone)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function createAdmin(phone, name, inviteCodeId) {
  const { data, error } = await supabase
    .from('admins')
    .insert({ phone, name, invite_code_id: inviteCodeId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── User States ──

async function getUserState(phone) {
  const { data, error } = await supabase
    .from('user_states')
    .select('*')
    .eq('phone', phone)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function createUserState(phone, step, businessId = null) {
  const { data, error } = await supabase
    .from('user_states')
    .insert({
      phone,
      current_step: step,
      business_id: businessId,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateUserStep(phone, step) {
  const { error } = await supabase
    .from('user_states')
    .update({ current_step: step, updated_at: new Date().toISOString() })
    .eq('phone', phone);

  if (error) throw error;
}

// ── Businesses ──

async function createBusiness(adminPhone) {
  const { data, error } = await supabase
    .from('businesses')
    .insert({ admin_phone: adminPhone })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getBusinessById(businessId) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function getBusinessByPhone(adminPhone) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('admin_phone', adminPhone)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function getActiveBusiness() {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function updateBusiness(businessId, fields) {
  const { error } = await supabase
    .from('businesses')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', businessId);

  if (error) throw error;
}

// ── Delivery Zones ──

async function getZonesByBusiness(businessId) {
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at');

  if (error) throw error;
  return data || [];
}

async function replaceZones(businessId, zones) {
  // Delete existing zones
  const { error: delError } = await supabase
    .from('delivery_zones')
    .delete()
    .eq('business_id', businessId);

  if (delError) throw delError;

  if (zones.length === 0) return [];

  // Insert new zones
  const rows = zones.map((z) => ({
    business_id: businessId,
    zone_name: z.zone_name,
    price: z.price,
  }));

  const { data, error } = await supabase
    .from('delivery_zones')
    .insert(rows)
    .select();

  if (error) throw error;
  return data;
}

// ── Bank Details ──

async function getBankDetails(businessId) {
  const { data, error } = await supabase
    .from('bank_details')
    .select('*')
    .eq('business_id', businessId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function upsertBankDetails(businessId, details) {
  const { data, error } = await supabase
    .from('bank_details')
    .upsert(
      {
        business_id: businessId,
        alias: details.alias,
        cbu: details.cbu,
        account_holder: details.account_holder,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'business_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Products ──

async function getProductsByBusiness(businessId) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at');

  if (error) throw error;
  return data || [];
}

async function insertProducts(businessId, products) {
  const rows = products.map((p) => ({
    business_id: businessId,
    name: p.name,
    description: p.description || null,
    price: p.price,
    category: p.category || null,
    ...(p.retailer_id && { retailer_id: p.retailer_id }),
  }));

  const { data, error } = await supabase
    .from('products')
    .insert(rows)
    .select();

  if (error) throw error;
  return data;
}

async function deleteProduct(productId) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) throw error;
}

async function toggleProductAvailability(productId) {
  // Get current state
  const { data: product, error: getErr } = await supabase
    .from('products')
    .select('is_available')
    .eq('id', productId)
    .single();

  if (getErr) throw getErr;

  const { error } = await supabase
    .from('products')
    .update({
      is_available: !product.is_available,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId);

  if (error) throw error;
  return !product.is_available;
}

async function updateProductRetailerId(productId, retailerId) {
  const { error } = await supabase
    .from('products')
    .update({ retailer_id: retailerId, updated_at: new Date().toISOString() })
    .eq('id', productId);

  if (error) throw error;
}

// ── Customer States ──

async function getCustomerState(phone, businessId = null) {
  let query = supabase
    .from('customer_states')
    .select('*')
    .eq('phone', phone);

  if (businessId) {
    query = query.eq('business_id', businessId);
  }

  const { data, error } = await query.single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function upsertCustomerState(phone, fields) {
  const { data, error } = await supabase
    .from('customer_states')
    .upsert(
      {
        phone,
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'phone,business_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateCustomerStep(phone, step, businessId = null) {
  let query = supabase
    .from('customer_states')
    .update({ current_step: step, updated_at: new Date().toISOString() })
    .eq('phone', phone);

  if (businessId) query = query.eq('business_id', businessId);
  const { error } = await query;
  if (error) throw error;
}

async function updateCustomerCart(phone, cart, businessId = null) {
  let query = supabase
    .from('customer_states')
    .update({ cart, updated_at: new Date().toISOString() })
    .eq('phone', phone);

  if (businessId) query = query.eq('business_id', businessId);
  const { error } = await query;
  if (error) throw error;
}

async function deleteCustomerState(phone, businessId = null) {
  let query = supabase
    .from('customer_states')
    .delete()
    .eq('phone', phone);

  if (businessId) query = query.eq('business_id', businessId);
  const { error } = await query;
  if (error) throw error;
}

// ── Orders ──

async function createOrder(order) {
  const { data, error } = await supabase
    .from('orders')
    .insert({
      business_id: order.business_id,
      client_phone: order.client_phone,
      client_name: order.client_name || null,
      client_address: order.client_address || null,
      items: order.items,
      subtotal: order.subtotal,
      delivery_zone_id: order.delivery_zone_id || null,
      delivery_price: order.delivery_price || 0,
      grand_total: order.grand_total,
      payment_method: order.payment_method,
      deposit_amount: order.deposit_amount || null,
      notes: order.notes || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getOrderByNumber(businessId, orderNumber) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('business_id', businessId)
    .eq('order_number', orderNumber)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function getOrdersByBusiness(businessId, statusFilter = null) {
  let query = supabase
    .from('orders')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('order_status', statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getPendingOrders(businessId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('business_id', businessId)
    .in('order_status', ['nuevo', 'preparando', 'en_camino'])
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function updateOrderStatus(orderId, status) {
  const { error } = await supabase
    .from('orders')
    .update({ order_status: status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) throw error;
}

async function updatePaymentStatus(orderId, status) {
  const { error } = await supabase
    .from('orders')
    .update({ payment_status: status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) throw error;
}

async function getOrderByClientAndNumber(clientPhone, orderNumber, businessId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('business_id', businessId)
    .eq('client_phone', clientPhone)
    .eq('order_number', orderNumber)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function getSalesSummary(businessId, since) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('business_id', businessId)
    .gte('created_at', since.toISOString());

  if (error) throw error;
  const orders = data || [];

  const delivered = orders.filter((o) => o.order_status === 'entregado');
  const cancelled = orders.filter((o) => o.order_status === 'cancelado');
  const inProgress = orders.filter((o) => ['nuevo', 'preparando', 'en_camino'].includes(o.order_status));
  const confirmed = orders.filter((o) => o.payment_status === 'confirmed' && o.order_status !== 'cancelado');

  // Revenue from confirmed (paid) non-cancelled orders
  const totalRevenue = confirmed.reduce((sum, o) => sum + Number(o.grand_total), 0);
  const transferRevenue = confirmed
    .filter((o) => o.payment_method === 'transfer' || o.payment_method === 'deposit')
    .reduce((sum, o) => sum + Number(o.grand_total), 0);
  const cashRevenue = confirmed
    .filter((o) => o.payment_method === 'cash')
    .reduce((sum, o) => sum + Number(o.grand_total), 0);

  return {
    total: orders.length,
    delivered: delivered.length,
    confirmed: confirmed.length,
    cancelled: cancelled.length,
    inProgress: inProgress.length,
    totalRevenue,
    transferRevenue,
    cashRevenue,
  };
}

async function linkBusinessToPhoneNumber(phoneNumberRowId, businessId) {
  // Set business_id on phone_numbers row
  const { error: phoneErr } = await supabase
    .from('phone_numbers')
    .update({ business_id: businessId })
    .eq('id', phoneNumberRowId);

  if (phoneErr) throw phoneErr;

  // Set phone_number_id on businesses row
  const { error: bizErr } = await supabase
    .from('businesses')
    .update({ phone_number_id: phoneNumberRowId, updated_at: new Date().toISOString() })
    .eq('id', businessId);

  if (bizErr) throw bizErr;

  // Invalidate cache for this phone number
  for (const [key, cached] of Object.entries(phoneConfigCache)) {
    if (cached.config?.id === phoneNumberRowId) {
      delete phoneConfigCache[key];
      break;
    }
  }
}

module.exports = {
  // Health & logging
  healthCheck,
  logFailedMessage,
  logWebhook,
  cleanupWebhookLogs,
  // Phone numbers
  getPhoneConfig,
  getPhoneConfigById,
  getBusinessByPhoneNumberId,
  clearPhoneConfigCache,
  linkBusinessToPhoneNumber,
  findInviteCode,
  markCodeAsUsed,
  findAdmin,
  createAdmin,
  getUserState,
  createUserState,
  updateUserStep,
  createBusiness,
  getBusinessById,
  getBusinessByPhone,
  getActiveBusiness,
  updateBusiness,
  getZonesByBusiness,
  replaceZones,
  getBankDetails,
  upsertBankDetails,
  getProductsByBusiness,
  insertProducts,
  deleteProduct,
  toggleProductAvailability,
  updateProductRetailerId,
  // Customer states
  getCustomerState,
  upsertCustomerState,
  updateCustomerStep,
  updateCustomerCart,
  deleteCustomerState,
  // Orders
  createOrder,
  getOrderByNumber,
  getOrdersByBusiness,
  getPendingOrders,
  updateOrderStatus,
  updatePaymentStatus,
  getOrderByClientAndNumber,
  getSalesSummary,
};
