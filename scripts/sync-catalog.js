/**
 * Sync products from Meta catalog into the Supabase database.
 * Also activates the business and notifies the admin via WhatsApp.
 *
 * This script is a fallback for when auto-sync on confirm fails.
 * Normally, products are imported automatically when the admin confirms onboarding.
 *
 * Credentials are resolved from the DB (phone_numbers table) when available,
 * with fallback to .env values for dev/single-number mode.
 *
 * Usage: node scripts/sync-catalog.js <business_id>
 *
 * To find your business_id, check Supabase → businesses table.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { syncCatalogToDatabase } = require('../src/services/catalog');

const API_VERSION = process.env.META_API_VERSION || 'v21.0';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const businessId = process.argv[2];

if (!businessId) {
  console.log('Usage: node scripts/sync-catalog.js <business_id>');
  console.log('\nFind your business_id in Supabase → businesses table.');
  process.exit(1);
}

/**
 * Resolve META_TOKEN and CATALOG_ID from the DB (phone_numbers table),
 * falling back to .env values when the business has no linked phone number.
 */
async function resolveCredentials(bizId) {
  const { data: business, error: bizErr } = await supabase
    .from('businesses')
    .select('phone_number_id')
    .eq('id', bizId)
    .single();

  if (bizErr) {
    console.error('Error fetching business:', bizErr.message);
    process.exit(1);
  }

  if (business.phone_number_id) {
    const { data: phoneRow, error: phoneErr } = await supabase
      .from('phone_numbers')
      .select('meta_whatsapp_token, catalog_id')
      .eq('id', business.phone_number_id)
      .single();

    if (!phoneErr && phoneRow) {
      const token = phoneRow.meta_whatsapp_token;
      const catalogId = phoneRow.catalog_id;

      if (token && catalogId) {
        console.log('Using credentials from DB (phone_numbers table).');
        return { token, catalogId };
      }
    }
  }

  const token = process.env.META_WHATSAPP_TOKEN;
  const catalogId = process.env.CATALOG_ID;

  if (!token || !catalogId) {
    console.error('No credentials found in DB or .env. Set META_WHATSAPP_TOKEN and CATALOG_ID in .env, or link a phone number with token and catalog_id.');
    process.exit(1);
  }

  console.log('Using credentials from .env (no linked phone number with catalog in DB).');
  return { token, catalogId };
}

async function main() {
  const { token, catalogId } = await resolveCredentials(businessId);

  console.log(`\nSyncing catalog ${catalogId} for business ${businessId}...\n`);

  const result = await syncCatalogToDatabase(businessId, token, catalogId);

  console.log(`\nDone!`);
  console.log(`  Inserted: ${result.inserted}`);
  console.log(`  Linked:   ${result.updated}`);
  console.log(`  Skipped:  ${result.skipped}`);
  console.log(`  Total:    ${result.total}`);

  if (result.total === 0) {
    console.log('\nNo products found. Check your catalog and token permissions.');
    return;
  }

  // Activate the business
  const { data: biz, error: bizUpdateErr } = await supabase
    .from('businesses')
    .update({ is_active: true })
    .eq('id', businessId)
    .select('business_name, admin_phone, phone_number_id')
    .single();

  if (bizUpdateErr) {
    console.error('Error activating business:', bizUpdateErr.message);
    return;
  }

  console.log(`\n  Business "${biz.business_name}" is now ACTIVE.`);

  // Notify admin via WhatsApp
  if (!biz.admin_phone) {
    console.log('  No admin phone found — skipping WhatsApp notification.');
    return;
  }

  let phoneNumberId = null;
  let whatsappToken = token;

  if (biz.phone_number_id) {
    const { data: phoneRow } = await supabase
      .from('phone_numbers')
      .select('meta_phone_number_id, meta_whatsapp_token')
      .eq('id', biz.phone_number_id)
      .single();

    if (phoneRow) {
      phoneNumberId = phoneRow.meta_phone_number_id;
      whatsappToken = phoneRow.meta_whatsapp_token;
    }
  }

  if (!phoneNumberId) phoneNumberId = process.env.META_PHONE_NUMBER_ID;

  if (!phoneNumberId || !whatsappToken) {
    console.log('  No phone config found — skipping WhatsApp notification.');
    return;
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: biz.admin_phone,
          type: 'text',
          text: {
            body:
              `🎉 *¡Tu negocio está activo!*\n\n` +
              `*${biz.business_name}* ya está listo para recibir pedidos.\n\n` +
              `📦 Se importaron ${result.total} productos desde tu catálogo.\n\n` +
              `🤖 *Soy tu asistente.* Podés preguntarme lo que necesites:\n` +
              `• "Quiero cambiar el horario"\n` +
              `• "Cuántos pedidos tengo?"\n` +
              `• "Cómo agrego un producto?"\n\n` +
              `Escribí *AYUDA* para ver todas las opciones.`,
          },
        }),
      }
    );

    const data = await res.json();
    if (res.ok) {
      console.log(`  WhatsApp notification sent to admin (${biz.admin_phone}).`);
    } else {
      console.error('  Failed to send WhatsApp notification:', data.error?.message || JSON.stringify(data));
    }
  } catch (err) {
    console.error('  Failed to send WhatsApp notification:', err.message);
  }
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
