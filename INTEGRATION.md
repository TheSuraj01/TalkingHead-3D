# 🤖 TalkingHead as a Service: 3D Visual Interface for Chatbots & AI Assistants

> Turn any conversational AI, LLM pipeline, or chatbot into an **expressive, real-time 3D talking avatar** with realistic lip-sync, gestures, and zero-cost Neural TTS.

---

## 🌟 Overview

TalkingHead is designed to function as the **visual presentation layer (UI)** for your AI applications:
- **Headless & Microservice Ready**: Run the server as a background service; connect your chat backend or assistant via lightweight JSON payloads.
- **Bi-directional Integration**: Control the avatar via **HTTP REST**, **SSE (Server-Sent Events)**, or **Browser `iframe` `postMessage`**.
- **Real-Time Lip-Sync & TTS**: Powered by built-in viseme calculation and **100% Free Microsoft Edge Neural voices** (no API keys required).
- **LLM-Powered**: Out-of-the-box integration with **Qwen 3 27B (`qwen/qwen3.8-27b`) on Groq** for ultra-fast conversational answers.

```
┌──────────────────────────────────────┐
│  Your Chatbot / AI Assistant Backend │
│  (Python, Node.js, LangChain, etc.)  │
└──────────────────┬───────────────────┘
                   │
                   │ POST /api/speak (JSON Payload)
                   ▼
┌──────────────────────────────────────┐
│       TalkingHead Server             │
│       (Node.js / Express)            │
└──────────────────┬───────────────────┘
                   │
                   │ SSE Stream (/api/events) or WebSocket
                   ▼
┌──────────────────────────────────────┐
│       TalkingHead 3D Canvas          │
│   (Web UI, Standalone or <iframe>)   │
│   • 3D Avatar Rendering (Three.js)   │
│   • Neural TTS Audio & Lip-Sync      │
│   • Moods, Gestures, & Camera Framings
└──────────────────────────────────────┘
```

---

## 📦 JSON Payload Reference

### `POST /api/speak`
Dispatches speech, expression, gesture, and camera commands to the 3D avatar:

```json
{
  "text": "Hello! I am your AI personal assistant. How can I assist you today?",
  "mood": "happy",
  "gesture": "thumbup",
  "camera": "head",
  "voice": "en-US-JennyNeural",
  "flush": true
}
```

#### Payload Fields:
| Field | Type | Options / Examples | Description |
|---|---|---|---|
| `text` | `string` | *(Required)* Any plain text or SSML | The text the avatar will speak with synchronized lips. |
| `mood` | `string` | `neutral`, `happy`, `sad`, `angry`, `fear`, `disgust`, `love`, `sleep` | Facial expression during speech. |
| `gesture` | `string` | `handup`, `ok`, `index`, `thumbup`, `thumbdown`, `side`, `shrug`, `namaste` | Body gesture played during speech. |
| `camera` | `string` | `head` (close-up), `upper` (chest), `mid` (waist), `full` (full body) | Camera framing of the avatar. |
| `voice` | `string` | `en-US-JennyNeural`, `en-US-GuyNeural`, `en-GB-SoniaNeural`, `es-ES-ElviraNeural`, etc. | Edge Neural Voice to use. |
| `rate` | `number` | `-0.5` to `1.0` (default: `0.0`) | Speech playback speed multiplier. |
| `pitch` | `number` | `-0.5` to `0.5` (default: `0.0`) | Pitch modulation. |
| `flush` | `boolean` | `true` or `false` | If `true`, interrupts any currently playing speech immediately. |

---

### `POST /api/chat`
Sends a prompt directly to the integrated LLM (**Qwen 3 27B on Groq**). The avatar automatically speaks the response:

```json
{
  "prompt": "Explain quantum computing in two simple sentences.",
  "systemPrompt": "You are a concise, friendly science tutor avatar.",
  "mood": "happy",
  "camera": "upper"
}
```

---

### Additional Service Endpoints

- **Quick Trigger**: `GET /api/speak?text=Hello+world&mood=happy`
- **Interrupt / Stop**: `POST /api/stop`
- **Trigger Gesture**: `POST /api/gesture` with `{"gesture": "thumbup", "duration": 2000}`
- **Set Mood**: `POST /api/mood` with `{"mood": "neutral"}`
- **Camera View**: `POST /api/camera` with `{"frame": "upper"}`
- **Service Mode Toggle**: `POST /api/mode` with `{"mode": "service"}` *(Hides all menus for a clean, borderless 3D viewport)*

---

## 💻 Integration Recipes

### 1. Python (LangChain, FastAPI, or Assistant Backend)
```python
import requests

def make_avatar_speak(text: str, mood: str = "happy", gesture: str = "ok"):
    url = "http://localhost:3000/api/speak"
    payload = {
        "text": text,
        "mood": mood,
        "gesture": gesture,
        "camera": "head",
        "flush": True
    }
    response = requests.post(url, json=payload)
    return response.json()

# Example: Hook into your chatbot loop
bot_reply = "Welcome back! All systems are running smoothly."
make_avatar_speak(bot_reply, mood="happy", gesture="thumbup")
```

---

### 2. Node.js / TypeScript (Discord, Slack, or Web Chatbot)
```typescript
import axios from 'axios';

async function triggerAvatarSpeech(message: string, mood = 'neutral') {
  await axios.post('http://localhost:3000/api/speak', {
    text: message,
    mood: mood,
    camera: 'upper'
  });
}

// In your chat handler:
triggerAvatarSpeech("Here is the latest financial report you requested.", "happy");
```

---

### 3. Embed into an Existing Web Chatbot via `<iframe>` (`postMessage`)
You can embed TalkingHead right inside your chatbot web page:

```html
<!-- Embedded Avatar Frame in Minimal Service View -->
<iframe id="avatarFrame" src="http://localhost:3000?mode=service" width="400" height="400" style="border:none;"></iframe>

<script>
  const avatar = document.getElementById('avatarFrame');

  function sendToAvatar(text, mood = 'happy', gesture = null) {
    avatar.contentWindow.postMessage({
      type: 'speak',
      text: text,
      mood: mood,
      gesture: gesture,
      camera: 'head'
    }, '*');
  }

  // When your chatbot generates an answer:
  sendToAvatar("I found 3 flights matching your criteria!", "happy", "ok");
</script>
```

---

### 4. cURL (Command Line / Shell Scripts)
```bash
curl -X POST http://localhost:3000/api/speak \
     -H "Content-Type: application/json" \
     -d '{"text": "Deployment completed successfully!", "mood": "happy", "gesture": "thumbup"}'
```

---

## 🛠️ Minimal Service Mode
When using TalkingHead purely as a UI for your chatbot, press **`F2`** or call:
```bash
curl -X POST http://localhost:3000/api/mode -H "Content-Type: application/json" -d '{"mode": "service"}'
```
This hides all control sidebars, giving you a clean, sleek 3D avatar viewport ready for streaming, screen recording, or embedding in production dashboards.
