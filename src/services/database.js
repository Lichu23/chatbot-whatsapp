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

async function getAllActiveBusinesses() {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('is_active', true);

  if (error) throw error;
  return data || [];
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

async function updateProduct(productId, fields) {
  const update = { updated_at: new Date().toISOString() };
  if (fields.name != null) update.name = fields.name;
  if (fields.price != null) update.price = fields.price;
  if (fields.description != null) update.description = fields.description;

  const { data, error } = await supabase
    .from('products')
    .update(update)
    .eq('id', productId)
    .select()
    .single();

  if (error) throw error;
  return data;
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

async function getOrdersSince(businessId, since) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('business_id', businessId)
    .gte('created_at', since.toISOString());

  if (error) throw error;
  return data || [];
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

// ── Subscriptions ──

async function getSubscriptionPlans() {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('price_usd');

  if (error) throw error;
  return data || [];
}

async function getPlanBySlug(slug) {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function getBusinessSubscription(businessId) {
  const { data, error } = await supabase
    .from('business_subscriptions')
    .select('*, plan:subscription_plans(*)')
    .eq('business_id', businessId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function createSubscription(businessId, planId, status, endDate) {
  const { data, error } = await supabase
    .from('business_subscriptions')
    .insert({
      business_id: businessId,
      plan_id: planId,
      status,
      end_date: endDate.toISOString(),
    })
    .select('*, plan:subscription_plans(*)')
    .single();

  if (error) throw error;
  return data;
}

async function updateSubscriptionStatus(subscriptionId, status) {
  const { error } = await supabase
    .from('business_subscriptions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', subscriptionId);

  if (error) throw error;
}

async function getMonthlyOrderCount(businessId, month) {
  const { data, error } = await supabase
    .from('monthly_order_counts')
    .select('*')
    .eq('business_id', businessId)
    .eq('month', month)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function incrementMonthlyOrderCount(businessId, month) {
  // Try to upsert: insert with count 1, or increment existing
  const existing = await getMonthlyOrderCount(businessId, month);

  if (existing) {
    const { error } = await supabase
      .from('monthly_order_counts')
      .update({ order_count: existing.order_count + 1 })
      .eq('id', existing.id);

    if (error) throw error;
    return existing.order_count + 1;
  }

  const { data, error } = await supabase
    .from('monthly_order_counts')
    .insert({ business_id: businessId, month, order_count: 1 })
    .select()
    .single();

  if (error) throw error;
  return data.order_count;
}

async function getAllBusinessesWithSubscriptions() {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, business_name, admin_phone, is_active')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Fetch subscriptions for each business
  const results = [];
  for (const biz of data) {
    const sub = await getBusinessSubscription(biz.id);
    results.push({ ...biz, subscription: sub });
  }
  return results;
}

async function getExpiringSubscriptions(daysAhead = 7) {
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);

  const { data, error } = await supabase
    .from('business_subscriptions')
    .select('*, plan:subscription_plans(*), business:businesses(id, business_name, admin_phone)')
    .in('status', ['active', 'trial'])
    .lte('end_date', future.toISOString())
    .order('end_date', { ascending: true });

  if (error) throw error;

  // Split into expired and expiring soon
  const expired = [];
  const expiringSoon = [];
  for (const sub of (data || [])) {
    if (new Date(sub.end_date) < now) {
      expired.push(sub);
    } else {
      expiringSoon.push(sub);
    }
  }
  return { expired, expiringSoon };
}

async function getBusinessByAdminPhone(adminPhone) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('admin_phone', adminPhone)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ── Promo Codes ──

async function createPromoCode(businessId, code, discountType, discountValue, maxUses, expiresAt) {
  const { data, error } = await supabase
    .from('promo_codes')
    .insert({
      business_id: businessId,
      code: code.toUpperCase(),
      discount_type: discountType,
      discount_value: discountValue,
      max_uses: maxUses || null,
      expires_at: expiresAt || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getActivePromoCodes(businessId) {
  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function getPromoByCode(businessId, code) {
  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('business_id', businessId)
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function incrementPromoUses(promoId) {
  // Get current, then increment
  const { data: promo, error: getError } = await supabase
    .from('promo_codes')
    .select('current_uses')
    .eq('id', promoId)
    .single();

  if (getError) throw getError;

  const { error } = await supabase
    .from('promo_codes')
    .update({ current_uses: promo.current_uses + 1, updated_at: new Date().toISOString() })
    .eq('id', promoId);

  if (error) throw error;
}

// ── Analytics Usage ──

async function getAnalyticsUsage(businessId, month) {
  const { data, error } = await supabase
    .from('analytics_usage')
    .select('*')
    .eq('business_id', businessId)
    .eq('month', month)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function incrementAnalyticsUsage(businessId, month) {
  const existing = await getAnalyticsUsage(businessId, month);

  if (existing) {
    const { error } = await supabase
      .from('analytics_usage')
      .update({ query_count: existing.query_count + 1, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (error) throw error;
    return existing.query_count + 1;
  }

  const { data, error } = await supabase
    .from('analytics_usage')
    .insert({ business_id: businessId, month, query_count: 1 })
    .select()
    .single();

  if (error) throw error;
  return data.query_count;
}

// ── Scheduled Messages ──

async function createScheduledMessage(businessId, message, recipientPhones, sendAt) {
  const { data, error } = await supabase
    .from('scheduled_messages')
    .insert({
      business_id: businessId,
      message,
      recipient_phones: recipientPhones,
      send_at: sendAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getPendingScheduledMessages() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('scheduled_messages')
    .select('*, business:businesses(id, business_name, admin_phone, phone_number_id)')
    .eq('status', 'pending')
    .lte('send_at', now)
    .order('send_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function updateScheduledMessageStatus(messageId, status, sentCount, failedCount) {
  const { error } = await supabase
    .from('scheduled_messages')
    .update({
      status,
      sent_count: sentCount,
      failed_count: failedCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId);

  if (error) throw error;
}

async function getScheduledMessagesByBusiness(businessId) {
  const { data, error } = await supabase
    .from('scheduled_messages')
    .select('*')
    .eq('business_id', businessId)
    .in('status', ['pending', 'sending'])
    .order('send_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function getUniqueCustomerPhones(businessId) {
  const { data, error } = await supabase
    .from('orders')
    .select('client_phone')
    .eq('business_id', businessId)
    .neq('order_status', 'cancelado');

  if (error) throw error;
  const phones = new Set((data || []).map((o) => o.client_phone));
  return [...phones];
}

// ── Loyalty ──

async function getLoyaltyConfig(businessId) {
  const { data, error } = await supabase
    .from('loyalty_config')
    .select('*')
    .eq('business_id', businessId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function upsertLoyaltyConfig(businessId, threshold, rewardType, rewardValue) {
  const { data, error } = await supabase
    .from('loyalty_config')
    .upsert({
      business_id: businessId,
      threshold,
      reward_type: rewardType,
      reward_value: rewardValue,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getLoyaltyCard(businessId, customerPhone) {
  const { data, error } = await supabase
    .from('loyalty_cards')
    .select('*')
    .eq('business_id', businessId)
    .eq('customer_phone', customerPhone)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function incrementLoyaltyCard(businessId, customerPhone) {
  const existing = await getLoyaltyCard(businessId, customerPhone);

  if (existing) {
    const { data, error } = await supabase
      .from('loyalty_cards')
      .update({ order_count: existing.order_count + 1, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('loyalty_cards')
    .insert({ business_id: businessId, customer_phone: customerPhone, order_count: 1 })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function claimLoyaltyReward(cardId) {
  // Get current card
  const { data: card, error: getErr } = await supabase
    .from('loyalty_cards')
    .select('*')
    .eq('id', cardId)
    .single();

  if (getErr) throw getErr;

  const { error } = await supabase
    .from('loyalty_cards')
    .update({
      rewards_claimed: card.rewards_claimed + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cardId);

  if (error) throw error;
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
  getAllActiveBusinesses,
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
  updateProduct,
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
  getOrdersSince,
  getSalesSummary,
  // Subscriptions
  getSubscriptionPlans,
  getPlanBySlug,
  getBusinessSubscription,
  createSubscription,
  updateSubscriptionStatus,
  getMonthlyOrderCount,
  incrementMonthlyOrderCount,
  getAllBusinessesWithSubscriptions,
  getExpiringSubscriptions,
  getBusinessByAdminPhone,
  // Promo codes
  createPromoCode,
  getActivePromoCodes,
  getPromoByCode,
  incrementPromoUses,
  // Analytics usage
  getAnalyticsUsage,
  incrementAnalyticsUsage,
  // Scheduled messages
  createScheduledMessage,
  getPendingScheduledMessages,
  updateScheduledMessageStatus,
  getScheduledMessagesByBusiness,
  getUniqueCustomerPhones,
  // Loyalty
  getLoyaltyConfig,
  upsertLoyaltyConfig,
  getLoyaltyCard,
  incrementLoyaltyCard,
  claimLoyaltyReward,
};
