import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

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

export function resolveEdgeVoice(requestedVoice, languageCode) {
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

/**
 * Synthesize speech with free Microsoft Edge Neural TTS with word boundary timestamps.
 * @param {string} ssmlOrText - Plain text or SSML to synthesize
 * @param {string} [voiceName] - Voice name or preset
 * @param {string} [langCode] - Language code
 * @param {object} [prosody] - Optional prosody settings
 * @returns {Promise<{ audioContent: string, timepoints: Array }>} Base64 audio and viseme timepoints
 */
export async function synthesizeWithEdgeTTS(ssmlOrText, voiceName, langCode, prosody = null) {
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
