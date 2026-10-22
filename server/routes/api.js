import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { sseClients, broadcastEvent, handleSSEConnection } from '../services/sse.js';
import { synthesizeWithEdgeTTS } from '../services/tts.js';
import { askGroqAI } from '../services/ai.js';

export const apiRouter = express.Router();

// Health Check
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

apiRouter.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// JWT SSO Endpoint
apiRouter.get('/app/jwt/get', (req, res) => {
  const token = jwt.sign(
    { sub: 'talkinghead-user', name: 'User', iat: Math.floor(Date.now() / 1000) },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
  res.json({ jwt: token });
});

// SSE Event Stream for frontend avatar clients
apiRouter.get('/api/events', handleSSEConnection);

// POST /api/speak
apiRouter.post('/api/speak', (req, res) => {
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
apiRouter.get('/api/speak', (req, res) => {
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
apiRouter.post('/api/stop', (req, res) => {
  const notified = broadcastEvent('stop', {});
  res.json({ status: 'ok', message: 'Stop dispatched', activeClients: notified });
});

// POST /api/gesture
apiRouter.post('/api/gesture', (req, res) => {
  const { gesture, duration } = req.body || {};
  if (!gesture) return res.status(400).json({ error: 'Field "gesture" is required.' });
  const notified = broadcastEvent('gesture', { gesture, duration: duration || 2000 });
  res.json({ status: 'ok', gesture, activeClients: notified });
});

// POST /api/mood
apiRouter.post('/api/mood', (req, res) => {
  const { mood } = req.body || {};
  if (!mood) return res.status(400).json({ error: 'Field "mood" is required.' });
  const notified = broadcastEvent('mood', { mood });
  res.json({ status: 'ok', mood, activeClients: notified });
});

// POST /api/camera
apiRouter.post('/api/camera', (req, res) => {
  const { frame, camera, view } = req.body || {};
  const target = frame || camera || view || 'head';
  const notified = broadcastEvent('camera', { camera: target });
  res.json({ status: 'ok', camera: target, activeClients: notified });
});

// POST /api/mode
apiRouter.post('/api/mode', (req, res) => {
  const { mode, camera, view, frame } = req.body || {};
  if (!mode) return res.status(400).json({ error: 'Field "mode" is required ("service" or "full").' });
  const isService = (mode === 'service' || mode === 'avatar' || mode === 'minimal');
  const targetMode = isService ? 'service' : 'full';
  const targetCamera = camera || view || frame || (isService ? 'head' : null);
  const notified = broadcastEvent('setMode', { mode: targetMode, camera: targetCamera });
  res.json({ status: 'ok', mode: targetMode, camera: targetCamera, activeClients: notified });
});

// POST /api/tts
apiRouter.post('/api/tts', async (req, res) => {
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

// POST /api/chat (Qwen 3 27B on Groq)
apiRouter.post('/api/chat', async (req, res) => {
  if (!config.isGroqConfigured()) {
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

    const { answer, model } = await askGroqAI({
      prompt: userPrompt,
      systemPrompt
    });

    const notified = broadcastEvent('speak', {
      text: answer,
      camera: targetCamera,
      mood: mood || 'happy',
      gesture: gesture || null,
      voice: voice || null,
      flush: Boolean(flush)
    });

    res.json({
      status: 'ok',
      model,
      prompt: userPrompt.trim(),
      response: answer,
      camera: targetCamera,
      avatarClientsNotified: notified
    });
  } catch (err) {
    console.error('[Service AI] Exception:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/status
apiRouter.get('/api/status', (req, res) => {
  res.json({
    status: 'ready',
    activeAvatarClients: sseClients.size,
    defaultAIModel: `${config.defaultAIModel} (Groq)`,
    defaultCameraFraming: 'head',
    groqConfigured: config.isGroqConfigured(),
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
