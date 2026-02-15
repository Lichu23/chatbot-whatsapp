const { config } = require('../config');

/**
 * Cascading LLM provider — tries each provider in order until one succeeds.
 * All providers use the OpenAI-compatible chat completions API.
 *
 * Chain: Groq → Cerebras → Mistral → OpenRouter
 * On 429 (rate limit) or network error, instantly falls to the next provider.
 */

function getProviders() {
  const providers = [];

  if (config.llm.groqKey) {
    providers.push({
      name: 'Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: config.llm.groqKey,
      model: config.llm.groqModel,
    });
  }

  if (config.llm.cerebrasKey) {
    providers.push({
      name: 'Cerebras',
      baseUrl: 'https://api.cerebras.ai/v1',
      apiKey: config.llm.cerebrasKey,
      model: config.llm.cerebrasModel,
    });
  }

  if (config.llm.mistralKey) {
    providers.push({
      name: 'Mistral',
      baseUrl: 'https://api.mistral.ai/v1',
      apiKey: config.llm.mistralKey,
      model: config.llm.mistralModel,
    });
  }

  if (config.llm.openrouterKey) {
    providers.push({
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: config.llm.openrouterKey,
      model: config.llm.openrouterModel,
    });
  }

  return providers;
}

/**
 * Call a single provider's chat completions endpoint.
 * Returns the parsed JSON response or throws on error.
 */
async function callProvider(provider, systemPrompt, userMessage) {
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const error = new Error(`${provider.name} error: ${res.status} ${res.statusText}`);
    error.status = res.status;
    error.body = body;
    throw error;
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

/**
 * Try each provider in sequence. On 429 or network error, try the next one.
 * Returns the raw text response from whichever provider succeeds.
 */
async function chatJSON(systemPrompt, userMessage) {
  const providers = getProviders();

  if (providers.length === 0) {
    throw new Error('No LLM providers configured. Set at least GROQ_API_KEY in .env');
  }

  const shortMsg = userMessage.substring(0, 80) + (userMessage.length > 80 ? '...' : '');

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    console.log(`⚡ [${provider.name}] request — model: ${provider.model}`);
    console.log(`   User message: "${shortMsg}"`);

    try {
      const raw = await callProvider(provider, systemPrompt, userMessage);
      console.log(`⚡ [${provider.name}] response: "${raw.substring(0, 150)}${raw.length > 150 ? '...' : ''}"`);

      // Strip ```json ... ``` wrappers
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      console.log(`⚡ [${provider.name}] parsed JSON OK`);
      return parsed;
    } catch (error) {
      const isRateLimit = error.status === 429;
      const isServerError = error.status >= 500;
      const isNetwork = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.cause?.code === 'ECONNREFUSED';
      const shouldFallback = isRateLimit || isServerError || isNetwork;

      if (shouldFallback && i < providers.length - 1) {
        console.warn(`⚡ [${provider.name}] ${isRateLimit ? '429 rate limited' : `error (${error.status || error.code})`} — falling back to ${providers[i + 1].name}`);
        continue;
      }

      // Last provider or non-retryable error — throw
      console.error(`⚡ [${provider.name}] ❌ failed:`, error.message);
      throw error;
    }
  }
}

module.exports = { chatJSON };
