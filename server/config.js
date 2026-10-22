import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'talkinghead-secret-key',
  groqApiKey: process.env.GROQ_API_KEY || '',
  googleTtsApiKey: process.env.GOOGLE_TTS_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  isGroqConfigured() {
    return Boolean(
      this.groqApiKey &&
      this.groqApiKey !== 'your-groq-api-key-here' &&
      this.groqApiKey !== 'your_groq_api_key_here'
    );
  },
  defaultAIModel: 'qwen/qwen3.8-27b',
  paths: {
    root: rootDir,
    dist: path.join(rootDir, 'dist'),
    public: path.join(rootDir, 'public')
  }
};
