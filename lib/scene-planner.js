'use strict';

const ALLOWED_ACTIONS = ['Relax','Thinking','Surprised','Clapping','LookAround','Goodbye'];
const ALLOWED_EMOTIONS = ['neutral','happy','sad','angry','surprised'];
const TOOL_NAMES = ['list_assets','inspect_scene','place_asset','move_asset','rotate_asset','scale_asset','remove_asset','duplicate_asset','set_color','clear_scene','undo','save_scene','load_scene','play_avatar_action','speak'];

function asVec3(value) {
  if (Array.isArray(value) && value.length >= 3) return [Number(value[0]), Number(value[1]), Number(value[2])];
  if (value && typeof value === 'object') {
    const x = value.x ?? value[0], y = value.y ?? value[1], z = value.z ?? value[2];
    if ([x, y, z].every((n) => Number.isFinite(Number(n)))) return [Number(x), Number(y), Number(z)];
  }
  if (Number.isFinite(Number(value))) {
    const n = Number(value);
    return [n, n, n];
  }
  return undefined;
}
function slugId(value, fallback = 'obj') {
  const raw = String(value || fallback).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return (raw || fallback).slice(0, 64);
}
function normalizeCommand(command, index) {
  if (!command || typeof command !== 'object') return { tool: 'inspect_scene' };
  let tool = command.tool;
  if (!TOOL_NAMES.includes(tool)) {
    if (TOOL_NAMES.includes(command.action)) tool = command.action;
    else if (TOOL_NAMES.includes(command.name)) tool = command.name;
    else if (TOOL_NAMES.includes(command.command)) tool = command.command;
  }
  const out = { tool: TOOL_NAMES.includes(tool) ? tool : command.tool };
  const assetId = command.assetId || command.asset;
  if (assetId) out.assetId = String(assetId);
  if (command.instanceId || command.instance) out.instanceId = slugId(command.instanceId || command.instance);
  else if (out.tool === 'place_asset' && assetId) out.instanceId = slugId(`${String(assetId).replace(/_01$/, '')}-${index + 1}`);
  if (command.newInstanceId) out.newInstanceId = slugId(command.newInstanceId);
  if (command.position !== undefined) {
    const position = asVec3(command.position);
    if (position) out.position = position;
  }
  if (command.rotation !== undefined) {
    const rotation = asVec3(command.rotation);
    if (rotation) out.rotation = rotation;
  }
  if (command.scale !== undefined) {
    const scale = asVec3(command.scale);
    if (scale) out.scale = scale;
  }
  if (command.color) out.color = command.color;
  if (command.title) out.title = command.title;
  if (command.text) out.text = command.text;
  if (command.emotion) out.emotion = command.emotion;
  if (command.category) out.category = command.category;
  if (command.tag) out.tag = command.tag;
  if (out.tool === 'play_avatar_action') {
    const action = ALLOWED_ACTIONS.includes(command.action) ? command.action : (ALLOWED_ACTIONS.includes(command.avatarAction) ? command.avatarAction : 'Thinking');
    out.action = action;
  }
  return out;
}
function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.commands)) throw new Error('INVALID_PLAN');
  return {
    say: String(plan.say || '').slice(0, 280),
    emotion: ALLOWED_EMOTIONS.includes(plan.emotion) ? plan.emotion : 'neutral',
    avatarAction: ALLOWED_ACTIONS.includes(plan.avatarAction) ? plan.avatarAction : 'Thinking',
    commands: plan.commands.slice(0, 14).map(normalizeCommand)
  };
}

function deterministicPlan({ text = '', scene = {}, errors = [] }) {
  const words = String(text).toLowerCase();
  const objects = Array.isArray(scene.objects) ? scene.objects : [];
  const exists = (id) => objects.some((item) => item.instanceId === id);
  if (/保存|save/.test(words)) return normalizePlan({
    say: '好，长椅会保持你刚刚摆放的位置。我已经保存了这个小世界。', emotion: 'happy', avatarAction: 'Clapping',
    commands: [{ tool: 'save_scene', title: scene.title === '未命名小世界' ? '治愈系小花园' : scene.title }]
  });
  if (/载入|加载|恢复|load/.test(words)) return normalizePlan({
    say: '正在恢复你保存的小世界。', emotion: 'happy', avatarAction: 'LookAround', commands: [{ tool: 'load_scene' }]
  });
  if (/撤销|undo/.test(words)) return normalizePlan({
    say: '好的，我撤回上一步修改。', emotion: 'neutral', avatarAction: 'Thinking', commands: [{ tool: 'undo' }]
  });
  if (/灯.*树|树.*小|石头|rock|lamp/.test(words) && objects.length) {
    const commands = [];
    if (exists('lamp-left')) commands.push({ tool: 'move_asset', instanceId: 'lamp-left', position: [-.42, .04, -.12] });
    if (exists('tree-main')) commands.push({ tool: 'scale_asset', instanceId: 'tree-main', scale: [.25, .48, .25] });
    if (exists('rock-right')) commands.push({ tool: 'remove_asset', instanceId: 'rock-right' });
    return normalizePlan({ say: '调整好了：左边的灯靠近树，树更轻巧，右侧石头也移除了。', emotion: 'happy', avatarAction: 'Clapping', commands });
  }
  if (/清空|clear/.test(words)) return normalizePlan({ say: '我把托盘清空了。', emotion: 'neutral', avatarAction: 'Relax', commands: [{ tool: 'clear_scene' }] });
  const initial = objects.length ? [] : [{ tool: 'clear_scene' }];
  return normalizePlan({
    say: errors.length ? '我重新整理了布局，现在所有物件都在托盘范围内。' : '好呀。我会用树、长椅、两盏暖灯和花，把它搭成一个安静治愈的小花园。',
    emotion: 'happy', avatarAction: errors.length ? 'Clapping' : 'Thinking',
    commands: [...initial,
      { tool: 'place_asset', assetId: 'ground_grass_01', instanceId: 'ground-main', position: [0,0,0], scale: [1.8,.08,1.2] },
      { tool: 'place_asset', assetId: 'tree_round_01', instanceId: 'tree-main', position: [-.2,.04,-.12], scale: [.32,.62,.32] },
      { tool: 'place_asset', assetId: 'bench_wood_01', instanceId: 'bench-main', position: [.12,.04,.18], rotation: [0,-12,0], scale: [.42,.22,.18] },
      { tool: 'place_asset', assetId: 'lamp_warm_01', instanceId: 'lamp-left', position: [-.55,.04,.18], scale: [.12,.34,.12] },
      { tool: 'place_asset', assetId: 'lamp_warm_01', instanceId: 'lamp-right', position: [.55,.04,.18], scale: [.12,.34,.12] },
      { tool: 'place_asset', assetId: 'flower_pink_01', instanceId: 'flowers-pink', position: [-.58,.04,-.25], scale: [.16,.14,.16] },
      { tool: 'place_asset', assetId: 'flower_blue_01', instanceId: 'flowers-blue', position: [.48,.04,-.3], scale: [.16,.14,.16] },
      { tool: 'place_asset', assetId: 'rock_round_01', instanceId: 'rock-right', position: [.65,.04,-.08], scale: [.18,.12,.16] }
    ]
  });
}

module.exports = { deterministicPlan, normalizePlan, ALLOWED_ACTIONS, ALLOWED_EMOTIONS };
