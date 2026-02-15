/**
 * Set WhatsApp Business Profile for a phone number via the Meta API.
 *
 * Usage:
 *   node scripts/set-profile.js <meta_phone_number_id> [options]
 *
 * Options:
 *   --about "text"       About / description text (max 139 chars)
 *   --category "text"    Business category (e.g. "Restaurant")
 *   --address "text"     Business address
 *   --email "text"       Business email
 *   --website "url"      Website URL (up to 2, comma-separated)
 *   --token TOKEN        Meta API token (defaults to META_WHATSAPP_TOKEN in .env)
 *
 * Examples:
 *   node scripts/set-profile.js 123456789 --about "Pedidos por WhatsApp" --category "Restaurant"
 *   node scripts/set-profile.js 123456789 --about "Tu comida favorita" --website "https://mi-negocio.com"
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const API_VERSION = process.env.META_API_VERSION || 'v21.0';

// ── Parse arguments ──

const args = process.argv.slice(2);

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

// First positional arg (skip flags)
let metaPhoneNumberId = null;
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    i++; // skip flag value
  } else {
    metaPhoneNumberId = args[i];
    break;
  }
}

const about = getFlag('--about');
const category = getFlag('--category');
const address = getFlag('--address');
const email = getFlag('--email');
const websiteRaw = getFlag('--website');
const tokenFlag = getFlag('--token');

if (!metaPhoneNumberId) {
  console.log('Usage: node scripts/set-profile.js <meta_phone_number_id> [options]');
  console.log('\nOptions:');
  console.log('  --about "text"       About / description (max 139 chars)');
  console.log('  --category "text"    Business category');
  console.log('  --address "text"     Business address');
  console.log('  --email "text"       Business email');
  console.log('  --website "url"      Website URL (comma-separated for multiple)');
  console.log('  --token TOKEN        Meta API token (default: META_WHATSAPP_TOKEN from .env)');
  console.log('\nExamples:');
  console.log('  node scripts/set-profile.js 123456789 --about "Pedidos por WhatsApp"');
  console.log('  node scripts/set-profile.js 123456789 --about "Tu comida" --category "Restaurant"');
  process.exit(1);
}

if (!about && !category && !address && !email && !websiteRaw) {
  console.error('Error: provide at least one option (--about, --category, --address, --email, --website).');
  process.exit(1);
}

// ── Resolve token ──

async function resolveToken(phoneId) {
  if (tokenFlag) return tokenFlag;

  // Try DB
  const { data } = await supabase
    .from('phone_numbers')
    .select('meta_whatsapp_token')
    .eq('meta_phone_number_id', phoneId)
    .single();

  if (data?.meta_whatsapp_token) return data.meta_whatsapp_token;

  // Fallback to .env
  if (process.env.META_WHATSAPP_TOKEN) return process.env.META_WHATSAPP_TOKEN;

  console.error('No token found. Use --token, register the number in DB, or set META_WHATSAPP_TOKEN in .env.');
  process.exit(1);
}

// ── Main ──

async function main() {
  const token = await resolveToken(metaPhoneNumberId);

  // Build profile payload
  const profile = {};
  if (about) profile.about = about;
  if (category) profile.vertical = category;
  if (address) profile.address = address;
  if (email) profile.email = email;
  if (websiteRaw) profile.websites = websiteRaw.split(',').map((w) => w.trim());

  console.log(`\nSetting WhatsApp Business Profile for ${metaPhoneNumberId}...`);
  console.log('  Payload:', JSON.stringify(profile, null, 2));

  const res = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${metaPhoneNumberId}/whatsapp_business_profile`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...profile }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error('\nMeta API error:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log('\nProfile updated successfully!');

  // Fetch and display the current profile
  const getRes = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${metaPhoneNumberId}/whatsapp_business_profile?fields=about,address,vertical,email,websites`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const getResData = await getRes.json();

  if (getResData.data?.[0]) {
    const p = getResData.data[0];
    console.log('\nCurrent profile:');
    if (p.about) console.log(`  About:    ${p.about}`);
    if (p.vertical) console.log(`  Category: ${p.vertical}`);
    if (p.address) console.log(`  Address:  ${p.address}`);
    if (p.email) console.log(`  Email:    ${p.email}`);
    if (p.websites?.length) console.log(`  Websites: ${p.websites.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
