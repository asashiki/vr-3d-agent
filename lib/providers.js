'use strict';

const { normalizePlan } = require('./scene-planner');

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}
async function jsonRequest(url, options, timeoutMs = 20000) {
  const timeout = timeoutSignal(timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: timeout.signal });
    if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
    return await response.json();
  } finally { timeout.clear(); }
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
function createLLMProvider(env, catalog) {
  const provider = (env.LLM_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : 'replay')).toLowerCase();
  if (provider === 'openai') return async ({ text, scene, errors }) => {
    if (!env.OPENAI_API_KEY) throw new Error('PROVIDER_NOT_CONFIGURED');
    const base = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const data = await jsonRequest(`${base}/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: env.OPENAI_MODEL || 'gpt-4o-mini', temperature: .2, response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: systemPrompt(catalog) }, { role: 'user', content: JSON.stringify({ request: text, scene, previousErrors: errors }) }
      ] })
    }, Number(env.PROVIDER_TIMEOUT_MS || 20000));
    return normalizePlan(extractJson(data.choices?.[0]?.message?.content));
  };
  if (provider === 'openclaw') return async ({ text, scene, errors }) => {
    if (!env.OPENCLAW_URL) throw new Error('PROVIDER_NOT_CONFIGURED');
    const data = await jsonRequest(`${env.OPENCLAW_URL.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(env.OPENCLAW_TOKEN ? { authorization: `Bearer ${env.OPENCLAW_TOKEN}` } : {}) },
      body: JSON.stringify({ model: env.OPENCLAW_MODEL || 'openclaw/main', messages: [
        { role: 'system', content: systemPrompt(catalog) }, { role: 'user', content: JSON.stringify({ request: text, scene, previousErrors: errors }) }
      ] })
    }, Number(env.PROVIDER_TIMEOUT_MS || 20000));
    return normalizePlan(extractJson(data.choices?.[0]?.message?.content));
  };
  return null;
}
module.exports = { createLLMProvider, extractJson, jsonRequest, systemPrompt };
