import { ENDPOINTS, request, getJSON } from './api';
import { speedToRate } from '../utils/formatters';

/**
 * STT contract (backend/stt_service/router.py):
 *   POST /stt  multipart/form-data, file field named "file_path"
 *   query: translation (bool), language_detection (bool)
 *   -> { segments: string[], detected_language?, language_probability? }
 */
export async function transcribeAudio(blob, { translation = false, signal } = {}) {
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  const form = new FormData();
  form.append('file_path', blob, `recording.${ext}`);
  const qs = new URLSearchParams({
    translation: String(translation),
    language_detection: String(translation),
  });
  const res = await request(`${ENDPOINTS.stt}?${qs}`, { method: 'POST', body: form, signal });
  const data = await res.json();
  const segments = Array.isArray(data?.segments) ? data.segments : [];
  return {
    text: segments.map((s) => String(s).trim()).filter(Boolean).join(' ').trim(),
    translated: data?.translated === true,
    detectedLanguage: typeof data?.detected_language === 'string' ? data.detected_language : null,
  };
}

/**
 * TTS contract (backend/tts_service/router.py):
 *   POST /tts  JSON {text, voice, rate: "+0%", volume: "+0%"} -> audio/mpeg
 *   GET  /tts/available_voices -> { "Available Voices": n, Voices: [{Voice, Gender}] }
 */
export async function synthesizeSpeech(text, { voice, speed = 1, signal } = {}) {
  const res = await request(ENDPOINTS.tts, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, rate: speedToRate(speed), volume: '+0%' }),
    signal,
  });
  const blob = await res.blob();
  if (!blob.size) throw new Error('The TTS service returned empty audio.');
  return blob;
}

export async function fetchVoices(signal) {
  const data = await getJSON(ENDPOINTS.ttsVoices, signal);
  const list = Array.isArray(data?.Voices) ? data.Voices : [];
  return list
    .filter((v) => v && v.Voice)
    .map((v) => ({ id: v.Voice, gender: v.Gender || '' }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function checkSpeechServices() {
  const probe = async (path) => {
    try {
      await getJSON(path);
      return true;
    } catch {
      return false;
    }
  };
  const [stt, tts] = await Promise.all([probe(ENDPOINTS.sttLanguages), probe(ENDPOINTS.ttsVoices)]);
  return { stt, tts };
}
