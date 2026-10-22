// Comprehensive Endpoints Test Suite for TalkingHead
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

async function runTests() {
  console.log(`\n======================================================`);
  console.log(`🧪 Starting TalkingHead Endpoints Test Suite`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`======================================================\n`);

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`• ${name}... `);
      await fn();
      console.log(`✅ PASS`);
      passed++;
    } catch (err) {
      console.log(`❌ FAIL`);
      console.error(`  Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Health check
  await test('GET /health', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(`Expected status: ok, got: ${data.status}`);
  });

  // 2. API Health check
  await test('GET /api/health', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(`Expected status: ok, got: ${data.status}`);
  });

  // 3. API Status
  await test('GET /api/status', async () => {
    const res = await fetch(`${BASE_URL}/api/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ready') throw new Error(`Expected status: ready, got: ${data.status}`);
    if (!data.defaultAIModel.includes('qwen')) throw new Error(`Expected Qwen model, got: ${data.defaultAIModel}`);
  });

  // 4. JWT Token Generation
  await test('GET /app/jwt/get', async () => {
    const res = await fetch(`${BASE_URL}/app/jwt/get`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.jwt || typeof data.jwt !== 'string') throw new Error('JWT token missing or invalid');
  });

  // 5. POST /api/speak
  await test('POST /api/speak', async () => {
    const res = await fetch(`${BASE_URL}/api/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Automated test message for avatar speech.',
        mood: 'happy',
        gesture: 'thumbup',
        camera: 'upper'
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(`Expected status: ok, got: ${data.status}`);
  });

  // 6. GET /api/speak
  await test('GET /api/speak (query string)', async () => {
    const res = await fetch(`${BASE_URL}/api/speak?text=Quick+test&mood=happy&gesture=ok`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(`Expected status: ok, got: ${data.status}`);
  });

  // 7. POST /api/gesture
  await test('POST /api/gesture', async () => {
    const res = await fetch(`${BASE_URL}/api/gesture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gesture: 'thumbup', duration: 2500 })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok' || data.gesture !== 'thumbup') throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
  });

  // 8. POST /api/mood
  await test('POST /api/mood', async () => {
    const res = await fetch(`${BASE_URL}/api/mood`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood: 'happy' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok' || data.mood !== 'happy') throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
  });

  // 9. POST /api/camera
  await test('POST /api/camera', async () => {
    const res = await fetch(`${BASE_URL}/api/camera`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame: 'upper' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok' || data.camera !== 'upper') throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
  });

  // 10. POST /api/mode
  await test('POST /api/mode (toggle service view)', async () => {
    const res = await fetch(`${BASE_URL}/api/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'service', camera: 'head' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok' || data.mode !== 'service') throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
  });

  // 11. POST /api/stop
  await test('POST /api/stop', async () => {
    const res = await fetch(`${BASE_URL}/api/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
  });

  // 12. Edge Neural TTS synthesis
  await test('POST /api/tts (Free Edge Neural TTS)', async () => {
    const res = await fetch(`${BASE_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello, this is a voice synthesis test.', voice: 'en-US-JennyNeural' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.audioContent || data.audioContent.length < 500) throw new Error('Audio content empty or corrupted');
  });

  // 13. AI Chat via Qwen 3 27B on Groq
  await test('POST /api/chat (Qwen 3 27B on Groq)', async () => {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Say: Test passed successfully!' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(`Expected status: ok, got: ${data.status}`);
    if (!data.response || data.response.trim().length === 0) throw new Error('AI response was empty');
  });

  // 14. OpenAI Chat Completions Proxy
  await test('POST /openai/v1/chat/completions (OpenAI Proxy -> Qwen 3 27B)', async () => {
    const res = await fetch(`${BASE_URL}/openai/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'groq-qwen-27b',
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 20
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) throw new Error('Malformed OpenAI response');
  });

  // 15. OpenAI Moderations
  await test('POST /openai/v1/moderations', async () => {
    const res = await fetch(`${BASE_URL}/openai/v1/moderations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'test text' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) throw new Error('Malformed moderations response');
  });

  // 16. Static assets
  await test('Static asset serving (/index.html)', async () => {
    const res = await fetch(`${BASE_URL}/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (!html.includes('Talking Head')) throw new Error('HTML title not found in response');
  });

  console.log(`\n======================================================`);
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
