import express from 'express';
import { config } from '../config.js';
import { normalizeGroqModel } from '../services/ai.js';

export const openaiRouter = express.Router();

// OpenAI-compatible Chat Proxy → Groq
openaiRouter.post('/v1/chat/completions', async (req, res) => {
  if (!config.isGroqConfigured()) {
    return res.status(500).json({ error: { message: 'GROQ_API_KEY not configured in .env' } });
  }

  try {
    const body = req.body || {};
    const model = normalizeGroqModel(body.model);

    const groqBody = {
      ...body,
      model,
      max_tokens: Math.min(body.max_tokens || 800, 800)
    };

    delete groqBody.presence_penalty;
    delete groqBody.frequency_penalty;

    console.log(`[Groq] Chat completion -> model: ${model}, stream: ${Boolean(body.stream)}`);

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.groqApiKey}`
      },
      body: JSON.stringify(groqBody)
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error(`[Groq] Error ${groqRes.status}:`, errText);
      return res.status(groqRes.status).json({ error: { message: errText } });
    }

    if (body.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const reader = groqRes.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            break;
          }
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      } catch (streamErr) {
        console.error('[Groq] Stream error:', streamErr.message);
        res.end();
      }
    } else {
      const data = await groqRes.json();
      res.json(data);
    }
  } catch (err) {
    console.error('[Groq] Proxy error:', err.message);
    res.status(500).json({ error: { message: err.message } });
  }
});

// OpenAI Moderations mock (returns unflagged)
openaiRouter.post('/v1/moderations', (req, res) => {
  const input = req.body?.input || [];
  const results = (Array.isArray(input) ? input : [input]).map(() => ({
    flagged: false,
    categories: {},
    category_scores: {}
  }));
  res.json({ id: 'mod-mock', model: 'text-moderation', results });
});

// OpenAI Audio Transcriptions Proxy (Groq Whisper)
openaiRouter.post('/v1/audio/transcriptions', async (req, res) => {
  if (!config.isGroqConfigured()) {
    return res.status(500).json({ error: { message: 'GROQ_API_KEY not configured' } });
  }

  try {
    const contentType = req.headers['content-type'];
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Authorization': `Bearer ${config.groqApiKey}`
      },
      body: rawBody
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return res.status(groqRes.status).json({ error: { message: errText } });
    }

    const data = await groqRes.json();
    res.json(data);
  } catch (err) {
    console.error('[Groq/Whisper] Error:', err.message);
    res.status(500).json({ error: { message: err.message } });
  }
});
