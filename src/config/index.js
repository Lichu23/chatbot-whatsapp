require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,

  // Fallback defaults for dev/single-number mode.
  // Production uses per-number configs from the phone_numbers DB table (see database.js getPhoneConfig).
  meta: {
    token: process.env.META_WHATSAPP_TOKEN,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID,
    verifyToken: process.env.META_VERIFY_TOKEN || 'my_verify_token_123',
    apiVersion: process.env.META_API_VERSION || 'v21.0',
    appSecret: process.env.META_APP_SECRET,
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
  },

  // Cascading LLM providers — tries in order: Groq → Cerebras → Mistral → OpenRouter
  // On 429 rate limit, instantly falls to the next provider.
  llm: {
    groqKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    cerebrasKey: process.env.CEREBRAS_API_KEY,
    cerebrasModel: process.env.CEREBRAS_MODEL || 'llama3.1-8b',
    mistralKey: process.env.MISTRAL_API_KEY,
    mistralModel: process.env.MISTRAL_MODEL || 'mistral-small-latest',
    openrouterKey: process.env.OPENROUTER_API_KEY,
    openrouterModel: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
  },

  // Fallback for dev/single-number mode. Production reads catalog_id from phone_numbers table.
  catalog: {
    id: process.env.CATALOG_ID,
  },

  timezone: process.env.TIMEZONE || 'America/Argentina/Buenos_Aires',

  alertPhone: process.env.ALERT_PHONE,
};

// Invite code format: REST-XXXX (4 alphanumeric chars)
const INVITE_CODE_REGEX = /^REST-[A-Z0-9]{4}$/i;

const STEPS = {
  BUSINESS_NAME: 'business_name',
  BUSINESS_HOURS: 'business_hours',
  BUSINESS_HOURS_CONFIRM: 'business_hours_confirm',
  DELIVERY_METHOD: 'delivery_method',
  PICKUP_ADDRESS: 'pickup_address',
  PAYMENT_METHODS: 'payment_methods',
  DEPOSIT_PERCENT: 'deposit_percent',
  DELIVERY_ZONES: 'delivery_zones',
  DELIVERY_ZONES_CONFIRM: 'delivery_zones_confirm',
  BANK_DATA: 'bank_data',
  BANK_DATA_CONFIRM: 'bank_data_confirm',
  PRODUCTS: 'products',
  REVIEW: 'review',
  COMPLETED: 'completed',

  // Edit-mode steps (post-onboarding)
  EDIT_NAME: 'edit_name',
  EDIT_HOURS: 'edit_hours',
  EDIT_HOURS_CONFIRM: 'edit_hours_confirm',
  EDIT_DELIVERY: 'edit_delivery',
  EDIT_ADDRESS: 'edit_address',
  EDIT_PAYMENTS: 'edit_payments',
  EDIT_DEPOSIT_PERCENT: 'edit_deposit_percent',
  EDIT_ZONES: 'edit_zones',
  EDIT_ZONES_CONFIRM: 'edit_zones_confirm',
  EDIT_BANK: 'edit_bank',
  EDIT_BANK_CONFIRM: 'edit_bank_confirm',
  EDIT_PRODUCTS: 'edit_products',

  // Product management steps
  DELETE_PRODUCT: 'delete_product',
  PAUSE_PRODUCT: 'pause_product',
  PAUSE_PRODUCT_ACTION: 'pause_product_action',
  EDIT_PRODUCT_SELECT: 'edit_product_select',
  EDIT_PRODUCT_FIELD: 'edit_product_field',
  EDIT_PRODUCT_VALUE: 'edit_product_value',
  LINK_CATALOG: 'link_catalog',
};

// Customer ordering flow steps
const CUSTOMER_STEPS = {
  GREETING: 'c_greeting',
  VIEWING_MENU: 'c_viewing_menu',
  BUILDING_CART: 'c_building_cart',
  DELIVERY_METHOD: 'c_delivery_method',
  DELIVERY_ZONE: 'c_delivery_zone',
  DELIVERY_ADDRESS: 'c_delivery_address',
  ORDER_SUMMARY: 'c_order_summary',
  PAYMENT_METHOD: 'c_payment_method',
  AWAITING_TRANSFER: 'c_awaiting_transfer',
  ORDER_CONFIRMED: 'c_order_confirmed',
};

const PLAN_SLUGS = {
  BASICO: 'basico',
  INTERMEDIO: 'intermedio',
  PRO: 'pro',
};

const SUBSCRIPTION_STATUS = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

const PAYMENT_OPTIONS = {
  '1': { accepts_cash: true, accepts_transfer: false, accepts_deposit: false, label: 'Solo efectivo' },
  '2': { accepts_cash: false, accepts_transfer: true, accepts_deposit: false, label: 'Solo transferencia bancaria' },
  '3': { accepts_cash: true, accepts_transfer: true, accepts_deposit: false, label: 'Efectivo y Transferencia' },
  '4': { accepts_cash: true, accepts_transfer: true, accepts_deposit: true, label: 'Efectivo y Transferencia (con opción de seña)' },
};

function getPaymentLabel(business) {
  const { accepts_cash, accepts_transfer, accepts_deposit, deposit_percent } = business;
  if (accepts_cash && accepts_transfer && accepts_deposit) {
    if (deposit_percent) return `Efectivo y Transferencia (con seña del ${deposit_percent}%)`;
    return 'Efectivo y Transferencia (con opción de seña)';
  }
  if (accepts_cash && accepts_transfer) return 'Efectivo y Transferencia';
  if (accepts_cash) return 'Solo efectivo';
  if (accepts_transfer) return 'Solo transferencia bancaria';
  return 'No configurado';
}

module.exports = { config, INVITE_CODE_REGEX, STEPS, CUSTOMER_STEPS, PLAN_SLUGS, SUBSCRIPTION_STATUS, PAYMENT_OPTIONS, getPaymentLabel };
