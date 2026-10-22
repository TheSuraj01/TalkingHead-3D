import { config } from '../config.js';

/**
 * Normalize model names to Groq-supported identifiers.
 * Specifically routes all Qwen 27B variants to qwen/qwen3.8-27b.
 * @param {string} rawModel
 * @returns {string}
 */
export function normalizeGroqModel(rawModel) {
  let model = rawModel || config.defaultAIModel;
  if (model.startsWith('groq-')) {
    model = model.substring(5);
  }
  if (
    model === 'qwen-27b' ||
    model === 'qwen-3-27b' ||
    model === 'qwen3-27b' ||
    model === 'qwen3.8-27b' ||
    model === 'qwen/qwen3.8-27b' ||
    model === 'qwen-2.5-32b' ||
    model === 'qwen-32b' ||
    model === 'qwen-qwq-32b'
  ) {
    return 'qwen/qwen3.8-27b';
  }
  return model;
}

/**
 * Call Groq chat completions API with the normalized Qwen model.
 * @param {object} params
 * @returns {Promise<string>} AI answer text
 */
export async function askGroqAI({ prompt, systemPrompt, model = config.defaultAIModel, temperature = 0.7, maxTokens = 450 }) {
  if (!config.isGroqConfigured()) {
    throw new Error('GROQ_API_KEY is not configured in .env');
  }

  const selectedModel = normalizeGroqModel(model);

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.groqApiKey}`
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt || 'You are TalkingHead, an expressive 3D AI avatar. Respond helpfully, naturally, and concisely in 2 to 3 spoken sentences without markdown formatting.'
        },
        {
          role: 'user',
          content: prompt.trim()
        }
      ],
      max_tokens: maxTokens,
      temperature
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API Error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    answer: data.choices?.[0]?.message?.content?.trim() || '',
    model: selectedModel,
    usage: data.usage
  };
}
