import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'talkinghead-secret-key';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// JWT Endpoint for frontend SSO flow
app.get('/app/jwt/get', (req, res) => {
  const token = jwt.sign(
    { sub: 'talkinghead-user', name: 'User', iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  res.json({ jwt: token });
});

// OpenAI-compatible Chat Proxy → Groq
app.post('/openai/v1/chat/completions', async (req, res) => {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY || GROQ_API_KEY === 'your-groq-api-key-here' || GROQ_API_KEY === 'your_groq_api_key_here') {
    return res.status(500).json({ error: { message: 'GROQ_API_KEY not configured in .env' } });
  }

  try {
    const body = req.body || {};

    // Normalize model names for Groq
    let model = body.model || 'qwen/qwen3.8-27b';
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
      model = 'qwen/qwen3.8-27b';
    }

    const groqBody = {
      ...body,
      model: model,
      max_tokens: Math.min(body.max_tokens || 800, 800)
    };

    delete groqBody.presence_penalty;
    delete groqBody.frequency_penalty;

    console.log(`[Groq] Chat completion -> model: ${model}, stream: ${Boolean(body.stream)}`);

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
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
app.post('/openai/v1/moderations', (req, res) => {
  const input = req.body?.input || [];
  const results = (Array.isArray(input) ? input : [input]).map(() => ({
    flagged: false,
    categories: {},
    category_scores: {}
  }));
  res.json({ id: 'mod-mock', model: 'text-moderation', results });
});

// OpenAI Audio Transcriptions Proxy (Groq Whisper)
app.post('/openai/v1/audio/transcriptions', async (req, res) => {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY || GROQ_API_KEY === 'your-groq-api-key-here' || GROQ_API_KEY === 'your_groq_api_key_here') {
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
        'Authorization': `Bearer ${GROQ_API_KEY}`
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

// Voice mapping to Microsoft Edge Neural voices
const VOICE_MAP = {
  'en-GB-Standard-A': 'en-GB-SoniaNeural',
  'en-GB-Standard-D': 'en-GB-RyanNeural',
  'en-US-Standard-C': 'en-US-JennyNeural',
  'en-US-Standard-E': 'en-US-GuyNeural',
  'fi-FI-Standard-A': 'fi-FI-SelmaNeural',
  'fr-FR-Standard-A': 'fr-FR-VivienneMultilingualNeural',
  'fr-FR-Standard-B': 'fr-FR-LucienMultilingualNeural',
  'de-DE-Standard-G': 'de-DE-SeraphinaMultilingualNeural',
  'de-DE-Standard-H': 'de-DE-FlorianMultilingualNeural',
  'pt-BR-Standard-A': 'pt-BR-FranciscaNeural',
  'pt-BR-Standard-B': 'pt-BR-AntonioNeural',
  'lv-LV-Standard-A': 'lv-LV-EveritaNeural',
  'lt-LT-Standard-A': 'lt-LT-OnaNeural'
};

function resolveEdgeVoice(requestedVoice, languageCode) {
  if (requestedVoice && requestedVoice.includes('Neural')) {
    return requestedVoice;
  }
  if (requestedVoice && VOICE_MAP[requestedVoice]) {
    return VOICE_MAP[requestedVoice];
  }
  const lang = (languageCode || requestedVoice || 'en-US').toLowerCase();
  if (lang.startsWith('en')) return 'en-US-JennyNeural';
  if (lang.startsWith('fi')) return 'fi-FI-SelmaNeural';
  if (lang.startsWith('fr')) return 'fr-FR-VivienneMultilingualNeural';
  if (lang.startsWith('de')) return 'de-DE-SeraphinaMultilingualNeural';
  if (lang.startsWith('pt')) return 'pt-BR-FranciscaNeural';
  if (lang.startsWith('es')) return 'es-ES-ElviraNeural';
  if (lang.startsWith('it')) return 'it-IT-ElsaNeural';
  if (lang.startsWith('ja')) return 'ja-JP-NanamiNeural';
  if (lang.startsWith('zh')) return 'zh-CN-XiaoxiaoNeural';
  return 'en-US-JennyNeural';
}

async function synthesizeWithEdgeTTS(ssmlOrText, voiceName, langCode, prosody = null) {
  const text = ssmlOrText || '';
  const cleanText = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) {
    return { audioContent: '', timepoints: [] };
  }

  const voice = resolveEdgeVoice(voiceName, langCode);
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
    wordBoundaryEnabled: true
  });

  const { audioStream, metadataStream } = tts.toStream(cleanText, prosody || undefined);

  const audioChunks = [];
  const words = [];

  audioStream.on('data', chunk => audioChunks.push(chunk));

  if (metadataStream) {
    metadataStream.on('data', chunk => {
      try {
        const parsed = JSON.parse(chunk.toString());
        if (parsed.Metadata) {
          for (const item of parsed.Metadata) {
            if (item.Type === 'WordBoundary') {
              words.push({
                text: item.Data?.text?.Text || '',
                timeSeconds: (item.Data?.Offset || 0) / 10000000
              });
            }
          }
        }
      } catch {}
    });
  }

  await new Promise((resolve, reject) => {
    audioStream.on('end', resolve);
    audioStream.on('error', reject);
  });

  const audioBuffer = Buffer.concat(audioChunks);
  const audioContent = audioBuffer.toString('base64');

  // Convert words to TalkingHead timepoints format
  const timepoints = [];
  for (let i = 1; i < words.length; i++) {
    timepoints.push({
      markName: String(i),
      timeSeconds: words[i].timeSeconds
    });
  }

  return { audioContent, timepoints };
}

// TTS Endpoint (/gtts/)
app.post('/gtts/', async (req, res) => {
  const GOOGLE_TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY;

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
      console.warn(`[GoogleTTS] Request returned status ${ttsRes.status}, falling back to free Edge TTS...`);
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

// Real-Time Avatar Service API (SSE & REST)
const sseClients = new Set();

function broadcastEvent(type, payload = {}) {
  const message = `data: ${JSON.stringify({ type, ...payload, timestamp: Date.now() })}\n\n`;
  let notified = 0;
  for (const client of sseClients) {
    try {
      if (client.res.writableEnded || client.res.destroyed) {
        sseClients.delete(client);
        continue;
      }
      client.res.write(message);
      notified++;
    } catch {
      sseClients.delete(client);
    }
  }
  return notified;
}

// SSE Event Stream for frontend avatar browser clients
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (res.flushHeaders) res.flushHeaders();

  const clientId = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
  const client = { id: clientId, res };
  sseClients.add(client);
  console.log(`[Service] Browser client connected (${clientId}). Active avatar clients: ${sseClients.size}`);

  res.write(`data: ${JSON.stringify({ type: 'connected', clientId, activeClients: sseClients.size })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      if (res.writableEnded || res.destroyed) {
        clearInterval(heartbeat);
        sseClients.delete(client);
        return;
      }
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(client);
    }
  }, 25000);

  const cleanup = () => {
    clearInterval(heartbeat);
    sseClients.delete(client);
    console.log(`[Service] Client disconnected (${clientId}). Active avatar clients: ${sseClients.size}`);
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
  res.on('error', cleanup);
});

// POST /api/speak
app.post('/api/speak', (req, res) => {
  const { text, mood, gesture, pose, voice, rate, pitch, flush, camera, view, frame } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Field "text" is required and cannot be empty.' });
  }

  const cleanText = text.trim();
  const targetCamera = camera || view || frame || 'head';

  const notified = broadcastEvent('speak', {
    text: cleanText,
    camera: targetCamera,
    mood: mood || null,
    gesture: gesture || null,
    pose: pose || null,
    voice: voice || null,
    rate: rate || null,
    pitch: pitch || null,
    flush: Boolean(flush)
  });

  res.json({
    status: 'ok',
    message: notified > 0 ? 'Sent to TalkingHead avatar' : 'Dispatched (open web UI to view avatar)',
    activeClients: notified,
    camera: targetCamera,
    text: cleanText
  });
});

// GET /api/speak?text=Hello+world
app.get('/api/speak', (req, res) => {
  const text = req.query.text || req.query.say || req.query.msg;
  if (!text) {
    return res.status(400).json({
      error: 'Query parameter "text" is required. Example: /api/speak?text=Hello+world&mood=happy&gesture=wave'
    });
  }

  const targetCamera = req.query.camera || req.query.view || req.query.frame || 'head';
  const notified = broadcastEvent('speak', {
    text: String(text).trim(),
    camera: targetCamera,
    mood: req.query.mood || null,
    gesture: req.query.gesture || null,
    pose: req.query.pose || null,
    voice: req.query.voice || null,
    flush: req.query.flush === 'true'
  });

  res.json({
    status: 'ok',
    message: notified > 0 ? 'Sent to TalkingHead avatar' : 'Dispatched (open web UI to view avatar)',
    activeClients: notified,
    camera: targetCamera,
    text: String(text).trim()
  });
});

// POST /api/stop
app.post('/api/stop', (req, res) => {
  const notified = broadcastEvent('stop', {});
  res.json({ status: 'ok', message: 'Stop dispatched', activeClients: notified });
});

// POST /api/gesture
app.post('/api/gesture', (req, res) => {
  const { gesture, duration } = req.body || {};
  if (!gesture) return res.status(400).json({ error: 'Field "gesture" is required.' });
  const notified = broadcastEvent('gesture', { gesture, duration: duration || 2000 });
  res.json({ status: 'ok', gesture, activeClients: notified });
});

// POST /api/mood
app.post('/api/mood', (req, res) => {
  const { mood } = req.body || {};
  if (!mood) return res.status(400).json({ error: 'Field "mood" is required.' });
  const notified = broadcastEvent('mood', { mood });
  res.json({ status: 'ok', mood, activeClients: notified });
});

// POST /api/tts
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice, lang } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Field "text" is required' });
    const result = await synthesizeWithEdgeTTS(text, voice, lang);
    res.json({
      format: 'audio/mp3',
      voice: voice || 'en-US-JennyNeural',
      audioContent: result.audioContent,
      timepoints: result.timepoints
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY || GROQ_API_KEY === 'your-groq-api-key-here' || GROQ_API_KEY === 'your_groq_api_key_here') {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured in .env' });
  }

  const { prompt, text, message, mood, gesture, voice, systemPrompt, flush, camera, view, frame } = req.body || {};
  const userPrompt = prompt || text || message;
  if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
    return res.status(400).json({ error: 'Field "prompt" is required.' });
  }

  try {
    const targetCamera = camera || view || frame || 'head';
    console.log(`[Service AI] Asking Groq AI: "${userPrompt.substring(0, 65)}..." (framing: ${targetCamera})`);
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.8-27b',
        messages: [
          {
            role: 'system',
            content: systemPrompt || 'You are TalkingHead, an expressive 3D AI avatar. Respond helpfully, naturally, and concisely in 2 to 3 spoken sentences without markdown formatting.'
          },
          {
            role: 'user',
            content: userPrompt.trim()
          }
        ],
        max_tokens: 450,
        temperature: 0.7
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error(`[Service AI] Groq error ${groqRes.status}:`, errText);
      return res.status(groqRes.status).json({ error: `Groq error: ${errText}` });
    }

    const groqData = await groqRes.json();
    const aiAnswer = groqData.choices?.[0]?.message?.content?.trim() || '';

    const notified = broadcastEvent('speak', {
      text: aiAnswer,
      camera: targetCamera,
      mood: mood || 'happy',
      gesture: gesture || null,
      voice: voice || null,
      flush: Boolean(flush)
    });

    res.json({
      status: 'ok',
      model: 'qwen/qwen3.8-27b',
      prompt: userPrompt.trim(),
      response: aiAnswer,
      camera: targetCamera,
      avatarClientsNotified: notified
    });

  } catch (err) {
    console.error('[Service AI] Exception:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mode
app.post('/api/mode', (req, res) => {
  const { mode, camera, view, frame } = req.body || {};
  if (!mode) return res.status(400).json({ error: 'Field "mode" is required ("service" or "full").' });
  const isService = (mode === 'service' || mode === 'avatar' || mode === 'minimal');
  const targetMode = isService ? 'service' : 'full';
  const targetCamera = camera || view || frame || (isService ? 'head' : null);
  const notified = broadcastEvent('setMode', { mode: targetMode, camera: targetCamera });
  res.json({ status: 'ok', mode: targetMode, camera: targetCamera, activeClients: notified });
});

// POST /api/camera
app.post('/api/camera', (req, res) => {
  const { frame, camera, view } = req.body || {};
  const target = frame || camera || view || 'head';
  const notified = broadcastEvent('camera', { camera: target });
  res.json({ status: 'ok', camera: target, activeClients: notified });
});

// GET /api/status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ready',
    activeAvatarClients: sseClients.size,
    defaultAIModel: 'qwen/qwen3.8-27b (Groq)',
    defaultCameraFraming: 'head',
    groqConfigured: Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your-groq-api-key-here' && process.env.GROQ_API_KEY !== 'your_groq_api_key_here'),
    ttsEngine: 'Microsoft Edge Neural TTS (Free 96kbps)',
    availableCameraFrames: ['head', 'upper', 'mid', 'full'],
    availableGestures: ['handup', 'ok', 'index', 'thumbup', 'thumbdown', 'side', 'shrug', 'namaste'],
    availableMoods: ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'love', 'sleep'],
    endpoints: {
      speak: 'POST /api/speak',
      chat: 'POST /api/chat',
      mode: 'POST /api/mode',
      camera: 'POST /api/camera',
      quickSpeak: 'GET /api/speak?text=...',
      stop: 'POST /api/stop',
      gesture: 'POST /api/gesture',
      mood: 'POST /api/mood',
      tts: 'POST /api/tts',
      events: 'GET /api/events',
      health: 'GET /health'
    }
  });
});

// Gemini Proxy
app.use('/gemini', async (req, res) => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
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

// Static Files
app.use(express.static(__dirname, {
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack || err.message);
  res.status(500).json({ error: { message: 'Internal server error' } });
});

// Start Server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`TalkingHead service running at http://localhost:${PORT}`);
});

// Graceful Shutdown
function handleShutdown(signal) {
  console.log(`\n[Server] Received ${signal}, closing gracefully...`);
  for (const client of sseClients) {
    try { client.res.end(); } catch {}
  }
  sseClients.clear();
  server.close(() => {
    console.log('[Server] Server closed cleanly.');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
