/**
 * Generate invite codes and insert them into Supabase.
 *
 * Usage: node scripts/generate-codes.js [count] [--phone-number-id ID]
 *
 * Examples:
 *   node scripts/generate-codes.js 10
 *   node scripts/generate-codes.js 5 --phone-number-id 123456789
 */
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion

function generateCode() {
  let code = 'REST-';
  for (let i = 0; i < 4; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

// ── Parse arguments ──

const args = process.argv.slice(2);

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

const phoneNumberId = getFlag('--phone-number-id');

// Positional args (skip flags)
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    i++; // skip flag value
  } else {
    positional.push(args[i]);
  }
}

const count = parseInt(positional[0], 10) || 5;

// ── Main ──

async function main() {
  // If --phone-number-id provided, resolve the DB row id
  let phoneNumberRowId = null;

  if (phoneNumberId) {
    const { data: phoneRow, error } = await supabase
      .from('phone_numbers')
      .select('id, display_name')
      .eq('meta_phone_number_id', phoneNumberId)
      .single();

    if (error || !phoneRow) {
      console.error(`Error: phone number ${phoneNumberId} not found in database.`);
      console.error('Register it first: node scripts/setup-number.js <meta_phone_number_id> <display_name>');
      process.exit(1);
    }

    phoneNumberRowId = phoneRow.id;
    console.log(`Linking codes to phone number: ${phoneRow.display_name} (${phoneNumberId})\n`);
  }

  const codes = [];
  for (let i = 0; i < count; i++) {
    const row = { code: generateCode() };
    if (phoneNumberRowId) row.phone_number_id = phoneNumberRowId;
    codes.push(row);
  }

  const { data, error } = await supabase
    .from('invite_codes')
    .insert(codes)
    .select();

  if (error) {
    console.error('Error inserting codes:', error.message);
    process.exit(1);
  }

  console.log(`Generated ${data.length} invite codes:`);
  data.forEach((row) => console.log(`  ${row.code}`));

  if (phoneNumberRowId) {
    console.log(`\nAll codes linked to phone number: ${phoneNumberId}`);
  }
}

main();
