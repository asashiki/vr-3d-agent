'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../ASSET_MANIFEST.json');
const { AssetCatalog } = require('../js/core/catalog');
const { SceneStore, MemoryStorage } = require('../js/core/scene-store');
const { SceneToolRegistry, TOOL_NAMES } = require('../js/core/tool-registry');
const { AgentLoop } = require('../js/core/agent-loop');
const { deterministicPlan, normalizePlan } = require('../lib/scene-planner');
const { extractJson, createSTTProvider, createTTSProvider } = require('../lib/providers');

function setup() {
  const catalog = new AssetCatalog(manifest);
  const store = new SceneStore({ storage:new MemoryStorage() });
  const events=[];
  const tools = new SceneToolRegistry({ catalog, store, onEvent:(event)=>events.push(event) });
  return { catalog, store, tools, events };
}
test('catalog contains 30 uniquely licensed assets', () => {
  const { catalog }=setup(); assert.equal(catalog.assets.length,30); assert.equal(new Set(catalog.assets.map((a)=>a.id)).size,30);
  assert.ok(catalog.assets.every((asset)=>asset.license&&asset.source&&asset.file.endsWith('.glb')));
});
test('registry exposes exactly the 15 approved tools', () => {
  const { tools }=setup(); assert.deepEqual(tools.names(),TOOL_NAMES); assert.equal(tools.names().length,15);
  for(const name of tools.names()){assert.equal(tools.schemas()[name].input.type,'object');assert.equal(tools.schemas()[name].output.type,'object');}
});
test('invalid tool and missing asset return stable errors without mutation', () => {
  const { tools,store }=setup();
  assert.equal(tools.execute({tool:'run_code'}).code,'UNKNOWN_TOOL');
  assert.equal(tools.execute({tool:'place_asset',assetId:'imaginary',instanceId:'x',position:[0,0,0]}).code,'ASSET_NOT_FOUND');
  assert.equal(store.scene.objects.length,0);
});
test('duplicate id, bounds, scale and overlap are validated', () => {
  const { tools }=setup();
  assert.ok(tools.execute({tool:'place_asset',assetId:'tree_round_01',instanceId:'tree',position:[0,.04,0]}).ok);
  assert.equal(tools.execute({tool:'place_asset',assetId:'tree_round_01',instanceId:'tree',position:[.5,.04,0]}).code,'DUPLICATE_INSTANCE_ID');
  assert.equal(tools.execute({tool:'place_asset',assetId:'rock_round_01',instanceId:'far',position:[2,.04,0]}).code,'OUT_OF_BOUNDS');
  assert.equal(tools.execute({tool:'scale_asset',instanceId:'tree',scale:[10,10,10]}).code,'SCALE_OUT_OF_BOUNDS');
  assert.equal(tools.execute({tool:'place_asset',assetId:'rock_round_01',instanceId:'overlap',position:[.01,.04,.01]}).code,'SEVERE_OVERLAP');
});
test('scene save, load and undo round-trip', () => {
  const { tools,store }=setup();
  tools.execute({tool:'place_asset',assetId:'bench_wood_01',instanceId:'bench',position:[0,.04,0]});
  tools.execute({tool:'save_scene',title:'saved'}); tools.execute({tool:'clear_scene'}); assert.equal(store.scene.objects.length,0);
  assert.ok(tools.execute({tool:'load_scene'}).ok); assert.equal(store.scene.objects[0].instanceId,'bench');
  tools.execute({tool:'move_asset',instanceId:'bench',position:[.4,.04,.2]}); assert.ok(tools.execute({tool:'undo'}).ok);
  assert.deepEqual(store.scene.objects[0].position,[0,.04,0]);
});
test('scene state keeps a clean MR layout and hydrates older saves', () => {
  const storage = new MemoryStorage();
  const store = new SceneStore({ storage });
  assert.equal(store.scene.tray.visible, false);
  assert.deepEqual(store.scene.tray.position, [-0.72, 0.5, -1.9]);
  assert.deepEqual(store.scene.avatar.position, [0.55, 0, -1.6]);
  storage.setItem('pocket-world.scene.v1', JSON.stringify({
    version:1, sceneId:'old', title:'old', tray:{position:[0,.72,-1.8],rotation:[0,0,0],scale:1}, objects:[]
  }));
  assert.ok(store.load());
  assert.ok(store.scene.avatar);
  assert.equal(store.scene.tray.visible, false);
});
test('garden replay creates a bounded scene and targeted follow-up', async () => {
  const { tools,store }=setup(); const loop=new AgentLoop({planner:deterministicPlan,tools});
  const first=await loop.run('在我面前搭一个治愈系小花园，有一棵树、一张长椅、两盏灯和一些花。');
  assert.ok(first.ok); assert.ok(store.scene.objects.length>=5);
  const before=store.snapshot(); const second=await loop.run('把左边的灯移到树旁边，树缩小一点，删掉右边的石头。');
  assert.ok(second.ok); assert.equal(store.scene.objects.some((item)=>item.instanceId==='rock-right'),false);
  assert.deepEqual(store.scene.objects.find((item)=>item.instanceId==='bench-main'),before.objects.find((item)=>item.instanceId==='bench-main'));
});
test('agent command and repair budgets terminate', async () => {
  const { tools }=setup(); let calls=0;
  const badPlanner=async()=>{calls++;return {say:'x',emotion:'neutral',avatarAction:'Relax',commands:Array(15).fill({tool:'inspect_scene'})};};
  const result=await new AgentLoop({planner:badPlanner,tools,maxRepairs:2}).run('x');
  assert.equal(result.ok,false); assert.equal(result.code,'COMMAND_BUDGET_EXCEEDED'); assert.equal(calls,3);
});
test('failed agent batch rolls back before a successful repair', async () => {
  const { tools,store }=setup();let calls=0;
  const planner=async()=>++calls===1
    ? {say:'retry',emotion:'neutral',avatarAction:'Thinking',commands:[{tool:'place_asset',assetId:'tree_round_01',instanceId:'temporary',position:[0,.04,0]},{tool:'place_asset',assetId:'missing',instanceId:'bad',position:[.5,.04,0]}]}
    : {say:'fixed',emotion:'happy',avatarAction:'Clapping',commands:[{tool:'place_asset',assetId:'bench_wood_01',instanceId:'final',position:[0,.04,0]}]};
  const result=await new AgentLoop({planner,tools,maxRepairs:2}).run('repair');
  assert.equal(result.ok,true);assert.equal(calls,2);assert.equal(store.scene.objects.some((item)=>item.instanceId==='temporary'),false);assert.equal(store.scene.objects[0].instanceId,'final');
});
test('model JSON fences parse and output is normalized', () => {
  const value=extractJson('```json\n{"say":"ok","commands":[]}\n```'); assert.equal(value.say,'ok');
  assert.equal(normalizePlan({...value,emotion:'invalid',avatarAction:'invalid'}).emotion,'neutral');
});
test('voice movement requests normalize to executable avatar actions', () => {
  assert.equal(deterministicPlan({text:'往前走一步',scene:{objects:[]}}).avatarAction,'StepForward');
  assert.equal(deterministicPlan({text:'退后一步',scene:{objects:[]}}).avatarAction,'StepBack');
  assert.equal(deterministicPlan({text:'跳一下',scene:{objects:[]}}).avatarAction,'Jump');
});
test('normalizePlan coerces OpenAI-compatible alias command shapes', () => {
  const plan=normalizePlan({
    say:'放一棵树', emotion:'happy', avatarAction:'Clapping',
    commands:[{action:'place_asset',asset:'tree_round_01',position:{x:0,y:.04,z:-.12},scale:1}]
  });
  assert.equal(plan.commands[0].tool,'place_asset');
  assert.equal(plan.commands[0].assetId,'tree_round_01');
  assert.equal(plan.commands[0].instanceId,'tree_round-1');
  assert.deepEqual(plan.commands[0].position,[0,.04,-.12]);
  assert.deepEqual(plan.commands[0].scale,[1,1,1]);
});
test('neutral STT and TTS adapters use server-only provider credentials', async () => {
  const calls=[];const fakeFetch=async(url,options)=>{calls.push({url,options});return url.endsWith('/audio/transcriptions')?new Response(JSON.stringify({text:'你好'}),{status:200,headers:{'content-type':'application/json'}}):new Response(Uint8Array.from([1,2,3]),{status:200});};
  const env={OPENAI_API_KEY:'server-secret',OPENAI_BASE_URL:'https://provider.test/v1',STT_PROVIDER:'openai',TTS_PROVIDER:'openai'};
  assert.equal((await createSTTProvider(env,fakeFetch)({audio:Buffer.from([1]),mimeType:'audio/webm'})).text,'你好');
  assert.equal((await createTTSProvider(env,fakeFetch)({text:'你好'})).audioBase64,'AQID');
  assert.equal(calls.length,2);assert.match(calls[0].options.headers.authorization,/server-secret/);assert.equal(JSON.parse(calls[1].options.body).response_format,'mp3');
});
test('Quest STT keeps a server fallback for an older browser setting', async () => {
  const fakeFetch=async()=>new Response(JSON.stringify({text:'移动到这边'}),{status:200,headers:{'content-type':'application/json'}});
  const provider=createSTTProvider({STT_PROVIDER:'browser',STT_API_KEY:'stt-secret',STT_BASE_URL:'https://stt.test/v1'},fakeFetch);
  assert.equal(typeof provider,'function');
  assert.equal((await provider({audio:Buffer.from([1])})).text,'移动到这边');
  assert.equal(createSTTProvider({STT_PROVIDER:'disabled',STT_API_KEY:'stt-secret'},fakeFetch),null);
});
test('MiniMax TTS adapter posts to T2A v2 and decodes hex audio', async () => {
  const calls=[];
  const fakeFetch=async(url,options)=>{
    calls.push({url,options});
    return new Response(JSON.stringify({
      base_resp:{status_code:0,status_msg:'success'},
      data:{audio:Buffer.from([1,2,3]).toString('hex')}
    }),{status:200,headers:{'content-type':'application/json'}});
  };
  const env={TTS_PROVIDER:'minimax',MINIMAX_API_KEY:'mm-secret',MINIMAX_VOICE_ID:'MaiClone'};
  const result=await createTTSProvider(env,fakeFetch)({text:'你好花园'});
  assert.equal(result.provider,'minimax');
  assert.equal(result.mimeType,'audio/mpeg');
  assert.equal(result.audioBase64,'AQID');
  assert.match(calls[0].url,/t2a_v2/);
  assert.match(calls[0].options.headers.authorization,/mm-secret/);
  assert.equal(JSON.parse(calls[0].options.body).voice_setting.voice_id,'MaiClone');
});
