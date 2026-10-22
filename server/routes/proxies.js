import express from 'express';
import { config } from '../config.js';
import { synthesizeWithEdgeTTS } from '../services/tts.js';

export const proxiesRouter = express.Router();

// TTS Endpoint (/gtts/) - Tries Google Cloud TTS, seamlessly falls back to Free Edge TTS
proxiesRouter.post('/gtts/', async (req, res) => {
  const GOOGLE_TTS_API_KEY = config.googleTtsApiKey;

  if (GOOGLE_TTS_API_KEY && GOOGLE_TTS_API_KEY !== 'your-google-tts-api-key-here' && GOOGLE_TTS_API_KEY.trim() !== '') {
    try {
      const ttsUrl = `https://eu-texttospeech.googleapis.com/v1beta1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`;
      const ttsRes = await fetch(ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      if (ttsRes.ok) {
        const data = await ttsRes.json();
        return res.json(data);
      }
      console.warn(`[GoogleTTS] Status ${ttsRes.status}, falling back to free Edge TTS...`);
    } catch (e) {
      console.warn('[GoogleTTS] Network error, falling back to free Edge TTS:', e.message);
    }
  }

  try {
    const ssml = req.body.input?.ssml || req.body.input?.text || '';
    const voiceName = req.body.voice?.name;
    const langCode = req.body.voice?.languageCode;

    const result = await synthesizeWithEdgeTTS(ssml, voiceName, langCode);
    res.json(result);
  } catch (err) {
    console.error('[EdgeTTS] Synthesis error:', err.message);
    res.status(500).json({ error: { message: err.message } });
  }
});

// Gemini Proxy
proxiesRouter.use('/gemini', async (req, res) => {
  const GEMINI_API_KEY = config.geminiApiKey;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: { message: 'GEMINI_API_KEY not configured in .env' } });
  }

  try {
    const targetPath = (req.originalUrl || req.url).replace(/^\/gemini\/?/, '');
    const separator = targetPath.includes('?') ? '&' : '?';
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetPath}${separator}key=${GEMINI_API_KEY}`;

    const geminiRes = await fetch(targetUrl, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(geminiRes.status).send(errText);
    }

    if (req.query.alt === 'sse' || targetPath.includes('alt=sse')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = geminiRes.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); break; }
        res.write(decoder.decode(value, { stream: true }));
      }
    } else {
      const data = await geminiRes.json();
      res.json(data);
    }
  } catch (err) {
    console.error('[Gemini] Proxy error:', err.message);
    res.status(500).json({ error: { message: err.message } });
  }
});
