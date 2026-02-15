/**
 * List all registered phone numbers, their linked businesses, and status.
 *
 * Usage: node scripts/list-numbers.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function main() {
  // Fetch all phone numbers
  const { data: numbers, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching phone numbers:', error.message);
    process.exit(1);
  }

  if (numbers.length === 0) {
    console.log('\nNo phone numbers registered yet.');
    console.log('Use: node scripts/setup-number.js <meta_phone_number_id> <display_name>');
    return;
  }

  // Fetch all businesses to match by phone_number_id
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, business_name, phone_number_id, is_active');

  // Fetch invite codes linked to phone numbers
  const { data: codes } = await supabase
    .from('invite_codes')
    .select('code, phone_number_id, used');

  console.log(`\n  Registered phone numbers: ${numbers.length}\n`);
  console.log('─'.repeat(70));

  for (const num of numbers) {
    const biz = businesses?.find((b) => b.phone_number_id === num.id);
    const linkedCodes = codes?.filter((c) => c.phone_number_id === num.id) || [];
    const unusedCodes = linkedCodes.filter((c) => !c.used);

    console.log(`\n  Phone Number ID: ${num.meta_phone_number_id}`);
    console.log(`  Display Name:   ${num.display_name}`);
    console.log(`  DB Row ID:      ${num.id}`);
    console.log(`  Status:         ${num.is_active ? 'Active' : 'Inactive'}`);
    console.log(`  Catalog ID:     ${num.catalog_id || '(none)'}`);
    console.log(`  Token:          ${num.meta_whatsapp_token ? num.meta_whatsapp_token.slice(0, 12) + '...' : '(none)'}`);

    if (biz) {
      console.log(`  Business:       ${biz.business_name} (id: ${biz.id}, ${biz.is_active ? 'active' : 'inactive'})`);
    } else {
      console.log(`  Business:       (not linked — awaiting registration)`);
    }

    if (linkedCodes.length > 0) {
      const codesDisplay = linkedCodes.map((c) => `${c.code}${c.used ? ' (used)' : ''}`).join(', ');
      console.log(`  Invite Codes:   ${codesDisplay}`);
    } else {
      console.log(`  Invite Codes:   (none)`);
    }

    console.log('─'.repeat(70));
  }

  // Summary
  const linked = numbers.filter((n) => businesses?.some((b) => b.phone_number_id === n.id)).length;
  const unlinked = numbers.length - linked;
  console.log(`\n  Summary: ${linked} linked to a business, ${unlinked} awaiting registration.\n`);
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
