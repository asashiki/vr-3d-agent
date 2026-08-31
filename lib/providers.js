'use strict';

const { normalizePlan } = require('./scene-planner');

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}
async function request(url, options, timeoutMs = 20000, fetchImpl = fetch) {
  const timeout = timeoutSignal(timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: timeout.signal });
    if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
    return response;
  } finally { timeout.clear(); }
}
async function jsonRequest(url, options, timeoutMs = 20000, fetchImpl = fetch) {
  return (await request(url, options, timeoutMs, fetchImpl)).json();
}
function extractJson(value) {
  const text = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(text);
}
function systemPrompt(catalog) {
  return `You are Mira, a spatial co-builder. Return JSON only with keys say, emotion, avatarAction, commands.\n` +
    `emotion: neutral|happy|sad|angry|surprised. avatarAction: Relax|Thinking|Surprised|Clapping|LookAround|Goodbye.\n` +
    `Commands may only use: list_assets, inspect_scene, place_asset, move_asset, rotate_asset, scale_asset, remove_asset, duplicate_asset, set_color, clear_scene, undo, save_scene, load_scene, play_avatar_action, speak.\n` +
    `At most 14 commands. Positions stay within x ±0.9, y 0..0.65, z ±0.6. Scale values stay 0.05..2. Never output code.\n` +
    `Allowed assets: ${catalog.map((asset) => asset.id).join(', ')}.`;
}
function createLLMProvider(env, catalog, fetchImpl = fetch) {
  const provider = (env.LLM_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : 'replay')).toLowerCase();
  if (provider === 'openai') return async ({ text, scene, errors }) => {
    if (!env.OPENAI_API_KEY) throw new Error('PROVIDER_NOT_CONFIGURED');
    const base = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const data = await jsonRequest(`${base}/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: env.OPENAI_MODEL || 'gpt-4o-mini', temperature: .2, response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: systemPrompt(catalog) }, { role: 'user', content: JSON.stringify({ request: text, scene, previousErrors: errors }) }
      ] })
    }, Number(env.PROVIDER_TIMEOUT_MS || 20000), fetchImpl);
    return normalizePlan(extractJson(data.choices?.[0]?.message?.content));
  };
  if (provider === 'openclaw') return async ({ text, scene, errors }) => {
    if (!env.OPENCLAW_URL) throw new Error('PROVIDER_NOT_CONFIGURED');
    const data = await jsonRequest(`${env.OPENCLAW_URL.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(env.OPENCLAW_TOKEN ? { authorization: `Bearer ${env.OPENCLAW_TOKEN}` } : {}) },
      body: JSON.stringify({ model: env.OPENCLAW_MODEL || 'openclaw/main', messages: [
        { role: 'system', content: systemPrompt(catalog) }, { role: 'user', content: JSON.stringify({ request: text, scene, previousErrors: errors }) }
      ] })
    }, Number(env.PROVIDER_TIMEOUT_MS || 20000), fetchImpl);
    return normalizePlan(extractJson(data.choices?.[0]?.message?.content));
  };
  return null;
}

function createSTTProvider(env, fetchImpl = fetch) {
  const provider = (env.STT_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : 'browser')).toLowerCase();
  if (provider !== 'openai') return null;
  return async ({ audio, mimeType = 'audio/webm', fileName = 'speech.webm' }) => {
    if (!env.OPENAI_API_KEY) throw new Error('STT_NOT_CONFIGURED');
    const form = new FormData();
    form.set('model', env.OPENAI_STT_MODEL || 'whisper-1');
    form.set('file', new Blob([audio], { type: mimeType }), fileName);
    const base = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const response = await request(`${base}/audio/transcriptions`, {
      method: 'POST', headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form
    }, Number(env.PROVIDER_TIMEOUT_MS || 20000), fetchImpl);
    const data = await response.json();
    if (!data.text) throw new Error('STT_EMPTY_RESULT');
    return { text: String(data.text), provider: 'openai' };
  };
}

function createTTSProvider(env, fetchImpl = fetch) {
  const provider = (env.TTS_PROVIDER || (env.ELEVENLABS_API_KEY ? 'elevenlabs' : env.OPENAI_API_KEY ? 'openai' : 'browser')).toLowerCase();
  if (provider === 'elevenlabs') return async ({ text }) => {
    if (!env.ELEVENLABS_API_KEY) throw new Error('TTS_NOT_CONFIGURED');
    const voice = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    const response = await request(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'xi-api-key': env.ELEVENLABS_API_KEY },
      body: JSON.stringify({ text, model_id: env.ELEVENLABS_MODEL || 'eleven_flash_v2_5', output_format: env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128' })
    }, Number(env.PROVIDER_TIMEOUT_MS || 20000), fetchImpl);
    const data = await response.json();
    if (!data.audio_base64) throw new Error('TTS_EMPTY_RESULT');
    return { audioBase64: data.audio_base64, mimeType: 'audio/mpeg', alignment: data.alignment || data.normalized_alignment || null, provider: 'elevenlabs' };
  };
  if (provider === 'openai') return async ({ text }) => {
    if (!env.OPENAI_API_KEY) throw new Error('TTS_NOT_CONFIGURED');
    const base = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const response = await request(`${base}/audio/speech`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts', voice: env.OPENAI_TTS_VOICE || 'alloy', input: text, response_format: 'mp3' })
    }, Number(env.PROVIDER_TIMEOUT_MS || 20000), fetchImpl);
    return { audioBase64: Buffer.from(await response.arrayBuffer()).toString('base64'), mimeType: 'audio/mpeg', alignment: null, provider: 'openai' };
  };
  return null;
}

module.exports = { createLLMProvider, createSTTProvider, createTTSProvider, extractJson, jsonRequest, request, systemPrompt };
