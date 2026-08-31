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
    `emotion: neutral|happy|sad|angry|surprised. avatarAction: Relax|Thinking|Surprised|Clapping|LookAround|Goodbye|Jump|StepForward|StepBack. ` +
    `Use StepForward when the user asks Mira to come closer or step forward, StepBack when asked to move away, and Jump when asked to jump.\n` +
    `Each command is an object with key "tool" (not "action"). Example: {"tool":"place_asset","assetId":"tree_round_01","instanceId":"tree-main","position":[0,0.04,-0.12],"rotation":[0,0,0],"scale":[0.32,0.62,0.32]}.\n` +
    `Commands may only use: list_assets, inspect_scene, place_asset, move_asset, rotate_asset, scale_asset, remove_asset, duplicate_asset, set_color, clear_scene, undo, save_scene, load_scene, play_avatar_action, speak.\n` +
    `place_asset requires assetId, a unique instanceId, and position as a 3-number array. Never use {x,y,z} objects. Scale is [x,y,z] not a single number.\n` +
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
  const configured = (env.STT_PROVIDER || 'auto').toLowerCase();
  const apiKey = env.STT_API_KEY || env.OPENAI_API_KEY;
  if (['off', 'disabled', 'none'].includes(configured)) return null;
  // Quest Browser does not expose the Web Speech recognition API. Even when an
  // older .env still says "browser", keep a server MediaRecorder fallback when
  // compatible credentials exist.
  if (!apiKey || !['auto', 'browser', 'openai'].includes(configured)) return null;
  return async ({ audio, mimeType = 'audio/webm', fileName = 'speech.webm' }) => {
    if (!apiKey) throw new Error('STT_NOT_CONFIGURED');
    const form = new FormData();
    form.set('model', env.STT_MODEL || env.OPENAI_STT_MODEL || 'whisper-1');
    form.set('file', new Blob([audio], { type: mimeType }), fileName);
    const base = (env.STT_BASE_URL || env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const response = await request(`${base}/audio/transcriptions`, {
      method: 'POST', headers: { authorization: `Bearer ${apiKey}` }, body: form
    }, Number(env.PROVIDER_TIMEOUT_MS || 20000), fetchImpl);
    const data = await response.json();
    if (!data.text) throw new Error('STT_EMPTY_RESULT');
    return { text: String(data.text), provider: 'openai' };
  };
}

function createTTSProvider(env, fetchImpl = fetch) {
  const provider = (env.TTS_PROVIDER || (env.MINIMAX_API_KEY ? 'minimax' : env.ELEVENLABS_API_KEY ? 'elevenlabs' : env.OPENAI_API_KEY ? 'openai' : 'browser')).toLowerCase();
  if (provider === 'minimax') return async ({ text, voice }) => {
    if (!env.MINIMAX_API_KEY) throw new Error('TTS_NOT_CONFIGURED');
    const endpoint = (env.MINIMAX_API_BASE_URL || 'https://api.minimaxi.com/v1/t2a_v2').replace(/\/$/, '');
    const voiceId = voice || env.MINIMAX_VOICE_ID || env.MINIMAX_VOICE_ID_MAI || 'MaiClone';
    const format = env.MINIMAX_AUDIO_FORMAT || 'mp3';
    const url = env.MINIMAX_GROUP_ID
      ? `${endpoint}?GroupId=${encodeURIComponent(env.MINIMAX_GROUP_ID)}`
      : endpoint;
    const data = await jsonRequest(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.MINIMAX_API_KEY}` },
      body: JSON.stringify({
        model: env.MINIMAX_MODEL || 'speech-2.8-hd',
        text,
        stream: false,
        voice_setting: {
          voice_id: voiceId,
          speed: Number(env.MINIMAX_VOICE_SPEED || 1),
          vol: Number(env.MINIMAX_VOICE_VOLUME || 1),
          pitch: Number(env.MINIMAX_VOICE_PITCH || 0)
        },
        audio_setting: {
          sample_rate: Number(env.MINIMAX_SAMPLE_RATE || 32000),
          bitrate: Number(env.MINIMAX_BITRATE || 128000),
          format,
          channel: Number(env.MINIMAX_CHANNEL || 1)
        }
      })
    }, Number(env.PROVIDER_TIMEOUT_MS || 20000), fetchImpl);
    const status = data.base_resp?.status_code;
    if (status !== undefined && status !== 0) throw new Error(`TTS_MINIMAX_${status}`);
    if (!data.data?.audio) throw new Error('TTS_EMPTY_RESULT');
    return {
      audioBase64: Buffer.from(data.data.audio, 'hex').toString('base64'),
      mimeType: format === 'mp3' ? 'audio/mpeg' : `audio/${format}`,
      alignment: null,
      provider: 'minimax'
    };
  };
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
