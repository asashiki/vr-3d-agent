'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer, safeFile } = require('../server');

async function withServer(fn, options={planner:null}) {
  const server=createServer(options); await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
  try{return await fn(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise((resolve)=>server.close(resolve));}
}
test('health and static app are served',()=>withServer(async(base)=>{
  const health=await fetch(`${base}/api/health`).then((r)=>r.json()); assert.equal(health.ok,true); assert.equal(health.mode,'replay');
  const html=await fetch(base).then((r)=>r.text()); assert.match(html,/Pocket World Agent/);
}));
test('replay plan endpoint works without credentials',()=>withServer(async(base)=>{
  const response=await fetch(`${base}/api/plan`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'搭一个小花园',scene:{objects:[]}})});
  const body=await response.json(); assert.equal(response.status,200); assert.equal(body.source,'replay'); assert.ok(body.plan.commands.length>=5);
}));
test('live provider failure falls back deterministically',()=>withServer(async(base)=>{
  const body=await fetch(`${base}/api/plan`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'搭花园',scene:{objects:[]}})}).then((r)=>r.json());
  assert.equal(body.source,'replay-fallback'); assert.equal(body.warning,'offline');
},{planner:async()=>{throw new Error('offline');}}));
test('invalid requests and traversal are rejected',()=>withServer(async(base)=>{
  assert.equal((await fetch(`${base}/api/plan`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,400);
  assert.equal((await fetch(`${base}/api/nope`)).status,404);
  assert.equal(safeFile('/../../etc/passwd'),null);
}));
test('STT and TTS routes use injected provider adapters',()=>withServer(async(base)=>{
  const stt=await fetch(`${base}/api/stt`,{method:'POST',headers:{'content-type':'audio/webm'},body:Uint8Array.from([1,2])}).then((r)=>r.json());
  const tts=await fetch(`${base}/api/tts`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'你好'})}).then((r)=>r.json());
  assert.equal(stt.text,'转写');assert.equal(tts.audioBase64,'AQI=');
},{planner:null,sttProvider:async({audio})=>({text:audio.length===2?'转写':'错误',provider:'test'}),ttsProvider:async()=>({audioBase64:'AQI=',mimeType:'audio/mpeg',alignment:null,provider:'test'})}));
test('health advertises Quest server STT when an STT key exists',()=>withServer(async(base)=>{
  const health=await fetch(`${base}/api/health`).then((r)=>r.json());
  assert.equal(health.services.stt,true);
},{planner:null,env:{STT_PROVIDER:'auto',STT_API_KEY:'server-only'}}));
