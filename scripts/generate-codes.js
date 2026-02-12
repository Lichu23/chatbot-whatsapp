/**
 * Generate invite codes and insert them into Supabase.
 * Usage: node scripts/generate-codes.js [count]
 * Example: node scripts/generate-codes.js 10
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

async function main() {
  const count = parseInt(process.argv[2], 10) || 5;
  const codes = [];

  for (let i = 0; i < count; i++) {
    codes.push({ code: generateCode() });
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
}

main();
