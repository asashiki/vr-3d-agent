'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { deterministicPlan } = require('./lib/scene-planner');
const { createLLMProvider } = require('./lib/providers');

const ROOT = __dirname;
const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/markdown; charset=utf-8','.vrm':'model/gltf-binary','.vrma':'application/octet-stream','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml' };

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && !line.trim().startsWith('#')) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* .env is optional */ }
  return env;
}
function sendJson(res, status, value) {
  res.writeHead(status, { 'content-type':'application/json; charset=utf-8','cache-control':'no-store' });
  res.end(JSON.stringify(value));
}
function readJson(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; if (body.length > limit) reject(new Error('BODY_TOO_LARGE')); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('INVALID_JSON')); } });
    req.on('error', reject);
  });
}
function safeFile(urlPath) {
  const decoded = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  const file = path.resolve(ROOT, `.${decoded}`);
  return file === ROOT || file.startsWith(`${ROOT}${path.sep}`) ? file : null;
}
function createServer(options = {}) {
  const env = { ...loadEnv(), ...(options.env || {}) };
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'ASSET_MANIFEST.json'), 'utf8'));
  const livePlanner = options.planner === undefined ? createLLMProvider(env, manifest.assets) : options.planner;
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/api/health') return sendJson(res, 200, { ok:true, mode:livePlanner ? 'live-with-replay-fallback' : 'replay', provider:env.LLM_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : 'replay') });
      if (url.pathname === '/api/catalog') return sendJson(res, 200, manifest);
      if (url.pathname === '/api/plan' && req.method === 'POST') {
        const body = await readJson(req);
        if (!body.text || typeof body.text !== 'string') return sendJson(res, 400, { error:'TEXT_REQUIRED' });
        const input = { text:body.text.slice(0,2000), scene:body.scene || {}, errors:Array.isArray(body.errors) ? body.errors : [] };
        if (livePlanner) {
          try { return sendJson(res, 200, { plan:await livePlanner(input), source:'live' }); }
          catch (error) { return sendJson(res, 200, { plan:deterministicPlan(input), source:'replay-fallback', warning:error.message }); }
        }
        return sendJson(res, 200, { plan:deterministicPlan(input), source:'replay' });
      }
      if (url.pathname.startsWith('/api/')) return sendJson(res, 404, { error:'API_NOT_FOUND' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error:'METHOD_NOT_ALLOWED' });
      const file = safeFile(url.pathname);
      if (!file) return sendJson(res, 403, { error:'FORBIDDEN' });
      fs.stat(file, (error, stat) => {
        if (error || !stat.isFile()) return sendJson(res, 404, { error:'NOT_FOUND' });
        res.writeHead(200, { 'content-type':MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'x-content-type-options':'nosniff', 'cache-control':file.endsWith('.html') ? 'no-cache' : 'public, max-age=3600' });
        if (req.method === 'HEAD') return res.end();
        fs.createReadStream(file).pipe(res);
      });
    } catch (error) {
      const status = error.message === 'BODY_TOO_LARGE' ? 413 : error.message === 'INVALID_JSON' ? 400 : 500;
      sendJson(res, status, { error:error.message || 'INTERNAL_ERROR' });
    }
  });
}
if (require.main === module) {
  const port = Number(loadEnv().PORT || 8080);
  createServer().listen(port, '0.0.0.0', () => console.log(`Pocket World Agent: http://localhost:${port}`));
}
module.exports = { createServer, loadEnv, safeFile };
