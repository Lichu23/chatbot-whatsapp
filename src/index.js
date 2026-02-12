const express = require('express');
const { config } = require('./config');
const webhookRouter = require('./routes/webhook');

const app = express();

// Twilio sends form-urlencoded data
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(webhookRouter);

app.listen(config.port, () => {
  console.log(`\n🚀 Server running on port ${config.port}`);
  console.log(`   Twilio number: ${config.twilio.whatsappNumber}`);
  console.log(`   Supabase URL:  ${config.supabase.url}`);
  console.log(`   Ollama URL:    ${config.ollama.url}`);
  console.log(`   Ollama model:  ${config.ollama.model}`);
  console.log(`   Waiting for messages...\n`);
});
