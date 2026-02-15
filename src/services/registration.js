const { INVITE_CODE_REGEX, STEPS } = require('../config');
const db = require('./database');

/**
 * Attempts to register an admin with the given invite code.
 * Returns { success, message, admin? }
 */
async function tryRegister(phone, text, profileName) {
  console.log(`🔑 tryRegister: phone=${phone}, text="${text}", profileName="${profileName}"`);

  // Check if message matches invite code format
  if (!INVITE_CODE_REGEX.test(text)) {
    console.log('🔑 Text does not match invite code format');
    return { success: false, isCode: false };
  }

  // Look up the code in the database
  console.log('🔑 Looking up invite code in DB...');
  const code = await db.findInviteCode(text);

  if (!code) {
    console.log('🔑 Code not found in DB');
    // Format matches but code doesn't exist — treat as customer
    return { success: false, isCode: false };
  }

  console.log('🔑 Code found:', JSON.stringify(code));

  if (code.used_by_phone) {
    // Code already used
    return {
      success: false,
      isCode: true,
      message: '❌ Este código ya fue utilizado. Si necesitás uno nuevo, contactá al administrador del sistema.',
    };
  }

  // If code is linked to a phone number, validate that number doesn't already have a business
  if (code.phone_number_id) {
    const phoneConfig = await db.getPhoneConfigById(code.phone_number_id);

    if (phoneConfig && phoneConfig.businessId) {
      console.log(`🔑 Phone number ${phoneConfig.metaPhoneNumberId} already has business ${phoneConfig.businessId}`);
      return {
        success: false,
        isCode: true,
        message: '❌ Este número de WhatsApp ya tiene un negocio registrado. Contactá al administrador del sistema.',
      };
    }
  }

  // Valid unused code — register the admin
  await db.markCodeAsUsed(code.id, phone);
  const admin = await db.createAdmin(phone, profileName, code.id);
  const business = await db.createBusiness(phone);
  await db.createUserState(phone, STEPS.BUSINESS_NAME, business.id);

  // Link business to the phone number from the invite code
  if (code.phone_number_id) {
    try {
      await db.linkBusinessToPhoneNumber(code.phone_number_id, business.id);
      console.log(`🔑 Business ${business.id} linked to phone number ${code.phone_number_id}`);
    } catch (error) {
      console.error('🔑 Failed to link business to phone number:', error.message);
      // Non-critical — registration still succeeds, can be linked manually later
    }
  }

  return {
    success: true,
    isCode: true,
    admin,
    message:
      '✅ ¡Registro exitoso! Vamos a configurar tu negocio paso a paso.\n\n' +
      '**Paso 1 de 7** — ¿Cuál es el nombre de tu negocio?',
  };
}

module.exports = { tryRegister };
