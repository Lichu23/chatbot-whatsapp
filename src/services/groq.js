const { config } = require('../config');

/**
 * Call Groq's chat API and parse the response as JSON.
 * Strips markdown code fences if present.
 */
async function chatJSON(systemPrompt, userMessage) {
  console.log(`⚡ Groq request — model: ${config.groq.model}`);
  console.log(`   User message: "${userMessage.substring(0, 80)}${userMessage.length > 80 ? '...' : ''}"`);

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.groq.apiKey}`,
    },
    body: JSON.stringify({
      model: config.groq.model,
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
    console.error(`⚡ ❌ Groq error: ${res.status} ${res.statusText}`, body);
    throw new Error(`Groq error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const raw = data.choices[0].message.content;
  console.log(`⚡ Groq response: "${raw.substring(0, 150)}${raw.length > 150 ? '...' : ''}"`);

  // Strip ```json ... ``` or ``` ... ``` wrappers just in case
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    console.log('⚡ Parsed JSON:', JSON.stringify(parsed));
    return parsed;
  } catch (error) {
    console.error('⚡ ❌ Failed to parse Groq response as JSON');
    console.error('   Raw response:', raw);
    throw error;
  }
}

module.exports = { chatJSON };
