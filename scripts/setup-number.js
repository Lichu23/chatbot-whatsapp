/**
 * Register a new phone number in the database and generate an invite code.
 *
 * ── Where to find each value ──────────────────────────────────────────
 *
 *   1. Go to https://developers.facebook.com → Your App → WhatsApp → API Setup
 *
 *   2. Phone Number ID  → Under "Send and receive messages", next to your
 *      test number you'll see "Phone number ID: 123456789012345"
 *
 *   3. Token            → On the same page, click "Generate" under
 *      "Temporary access token" (valid 24 hours).
 *      Looks like: EAAGz0BAx0r4BO...
 *
 *   4. Catalog ID       → Go to Meta Commerce Manager
 *      (https://business.facebook.com/commerce) → your catalog →
 *      the numeric ID in the URL bar (e.g. 826714529178321).
 *      This is REQUIRED so customers see the WhatsApp product catalog
 *      with images, prices, and "Add to Cart" buttons.
 *
 * ── Usage ─────────────────────────────────────────────────────────────
 *
 *   node scripts/setup-number.js <phone_number_id> <display_name> --catalog-id <ID> [--token TOKEN]
 *
 * ── Examples ──────────────────────────────────────────────────────────
 *
 *   # Token from .env
 *   node scripts/setup-number.js 381047558413095 "Mi Restaurante" --catalog-id 826714529178321
 *
 *   # Explicit token (useful if you just regenerated a 24h token)
 *   node scripts/setup-number.js 381047558413095 "Mi Restaurante" --catalog-id 826714529178321 --token EAAGz0BAx0r4BO...
 *
 * ── What it does ──────────────────────────────────────────────────────
 *
 *   1. Inserts a row into the `phone_numbers` table in Supabase
 *   2. Generates an invite code (e.g. REST-K7M2) linked to that number
 *   3. Prints a wa.me link you can share with the business owner
 *
 * ── Prerequisites ─────────────────────────────────────────────────────
 *
 *   Make sure your .env has at least:
 *     SUPABASE_URL=https://xxx.supabase.co
 *     SUPABASE_KEY=eyJ...
 *     META_WHATSAPP_TOKEN=EAAGz0BAx0r4BO...   (optional if you pass --token)
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ── Parse arguments ──

const args = process.argv.slice(2);

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

// Positional args (skip flags)
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    i++; // skip flag value
  } else {
    positional.push(args[i]);
  }
}

const metaPhoneNumberId = positional[0];
const displayName = positional[1];
const token = getFlag('--token') || process.env.META_WHATSAPP_TOKEN;
const catalogId = getFlag('--catalog-id');

if (!metaPhoneNumberId || !displayName || !catalogId) {
  console.log('Usage: node scripts/setup-number.js <meta_phone_number_id> <display_name> --catalog-id <ID> [--token TOKEN]');
  console.log('\nAll three values are required:');
  console.log('  <meta_phone_number_id>  From Meta Dashboard > WhatsApp > API Setup');
  console.log('  <display_name>          Business name (in quotes)');
  console.log('  --catalog-id <ID>       From Meta Commerce Manager (numeric ID in URL)');
  console.log('\nExamples:');
  console.log('  node scripts/setup-number.js 123456789 "Mi Negocio" --catalog-id 9876');
  console.log('  node scripts/setup-number.js 123456789 "Mi Negocio" --catalog-id 9876 --token EAAx...');
  process.exit(1);
}

if (!token) {
  console.error('No token provided. Use --token or set META_WHATSAPP_TOKEN in .env.');
  process.exit(1);
}

// ── Invite code generator (matches generate-codes.js pattern) ──

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

function generateCode() {
  let code = 'REST-';
  for (let i = 0; i < 4; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

// ── Main ──

async function main() {
  console.log(`\nRegistering phone number...`);
  console.log(`  Meta Phone Number ID: ${metaPhoneNumberId}`);
  console.log(`  Display Name: ${displayName}`);
  console.log(`  Catalog ID: ${catalogId}`);

  // Check if already exists
  const { data: existing } = await supabase
    .from('phone_numbers')
    .select('id')
    .eq('meta_phone_number_id', metaPhoneNumberId)
    .single();

  if (existing) {
    console.error(`\nError: Phone number ${metaPhoneNumberId} is already registered (id: ${existing.id}).`);
    process.exit(1);
  }

  // Insert phone number
  const { data: phoneRow, error: phoneErr } = await supabase
    .from('phone_numbers')
    .insert({
      meta_phone_number_id: metaPhoneNumberId,
      meta_whatsapp_token: token,
      catalog_id: catalogId,
      display_name: displayName,
      is_active: true,
    })
    .select()
    .single();

  if (phoneErr) {
    console.error('Error inserting phone number:', phoneErr.message);
    process.exit(1);
  }

  console.log(`\n  Phone number registered (id: ${phoneRow.id})`);

  // Generate and insert invite code linked to this phone number
  const code = generateCode();
  const { data: codeRow, error: codeErr } = await supabase
    .from('invite_codes')
    .insert({
      code,
      phone_number_id: phoneRow.id,
    })
    .select()
    .single();

  if (codeErr) {
    console.error('Error inserting invite code:', codeErr.message);
    process.exit(1);
  }

  // Try to get the actual phone number for the wa.me link
  let waLink = '(send the invite code to the WhatsApp number)';
  try {
    const res = await fetch(
      `https://graph.facebook.com/${process.env.META_API_VERSION || 'v21.0'}/${metaPhoneNumberId}?fields=display_phone_number`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (data.display_phone_number) {
      const digits = data.display_phone_number.replace(/[^0-9]/g, '');
      waLink = `https://wa.me/${digits}?text=${encodeURIComponent(code)}`;
    }
  } catch {
    // Non-critical — just skip the wa.me link
  }

  console.log('\n========================================');
  console.log('  Setup complete!');
  console.log('========================================');
  console.log(`  Phone Number ID: ${metaPhoneNumberId}`);
  console.log(`  Display Name:    ${displayName}`);
  console.log(`  Catalog ID:      ${catalogId}`);
  console.log(`  DB Row ID:       ${phoneRow.id}`);
  console.log(`  Invite Code:     ${codeRow.code}`);
  console.log(`  wa.me Link:      ${waLink}`);
  console.log('========================================\n');
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
