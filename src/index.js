const express = require('express');
const { config } = require('./config');
const webhookRouter = require('./routes/webhook');
const db = require('./services/database');
const scheduler = require('./services/scheduler');

const app = express();

// Meta sends JSON payloads — capture raw body for webhook signature validation
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

app.use(webhookRouter);

app.listen(config.port, () => {
  console.log(`\n🚀 Server running on port ${config.port}`);
  console.log(`   Meta Phone ID: ${config.meta.phoneNumberId}`);
  console.log(`   Supabase URL:  ${config.supabase.url}`);
  const llmProviders = [];
  if (config.llm.groqKey) llmProviders.push('Groq');
  if (config.llm.cerebrasKey) llmProviders.push('Cerebras');
  if (config.llm.mistralKey) llmProviders.push('Mistral');
  if (config.llm.openrouterKey) llmProviders.push('OpenRouter');
  console.log(`   LLM chain:     ${llmProviders.length > 0 ? llmProviders.join(' → ') : 'NONE (set at least GROQ_API_KEY)'}`);
  console.log(`   Signature:     ${config.meta.appSecret ? 'enabled' : 'disabled (no META_APP_SECRET)'}`);
  console.log(`   Alert phone:   ${config.alertPhone || 'not configured'}`);
  console.log(`   Waiting for messages...\n`);

  // Cleanup old webhook logs every 24 hours
  setInterval(() => {
    db.cleanupWebhookLogs().catch((err) => console.error('Webhook log cleanup failed:', err.message));
  }, 24 * 60 * 60 * 1000);

  // Start daily summary scheduler
  scheduler.start();
});
