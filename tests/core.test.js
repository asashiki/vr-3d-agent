'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../ASSET_MANIFEST.json');
const { AssetCatalog } = require('../js/core/catalog');
const { SceneStore, MemoryStorage } = require('../js/core/scene-store');
const { SceneToolRegistry, TOOL_NAMES } = require('../js/core/tool-registry');
const { AgentLoop } = require('../js/core/agent-loop');
const { deterministicPlan, normalizePlan } = require('../lib/scene-planner');
const { extractJson } = require('../lib/providers');

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
test('model JSON fences parse and output is normalized', () => {
  const value=extractJson('```json\n{"say":"ok","commands":[]}\n```'); assert.equal(value.say,'ok');
  assert.equal(normalizePlan({...value,emotion:'invalid',avatarAction:'invalid'}).emotion,'neutral');
});
