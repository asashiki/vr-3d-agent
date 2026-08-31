(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PocketWorld = Object.assign(root.PocketWorld || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ACTIONS = ['Relax', 'Thinking', 'Surprised', 'Clapping', 'LookAround', 'Goodbye', 'Jump', 'StepForward', 'StepBack'];
  const TOOLS = ['list_assets','inspect_scene','place_asset','move_asset','rotate_asset','scale_asset','remove_asset','duplicate_asset','set_color','clear_scene','undo','save_scene','load_scene','play_avatar_action','speak'];
  const VEC3_SCHEMA = { type:'array', minItems:3, maxItems:3, items:{ type:'number' } };
  const ID_SCHEMA = { type:'string', pattern:'^[A-Za-z0-9][A-Za-z0-9-_]{0,63}$' };
  const INSTANCE_SCHEMA = { type:'object', required:['instanceId','assetId','position','rotation','scale'], properties:{ instanceId:ID_SCHEMA, assetId:{type:'string'}, position:VEC3_SCHEMA, rotation:VEC3_SCHEMA, scale:VEC3_SCHEMA, color:{type:'string'}, locked:{type:'boolean'} } };
  const SCENE_SCHEMA = { type:'object', required:['version','sceneId','tray','avatar','objects'], properties:{ version:{const:1}, sceneId:{type:'string'}, title:{type:'string'}, tray:{type:'object'}, avatar:{type:'object'}, objects:{type:'array',items:INSTANCE_SCHEMA} } };
  const input = (properties={},required=[]) => ({ type:'object', additionalProperties:true, properties, required });
  const output = (properties,required=Object.keys(properties)) => ({ type:'object', additionalProperties:false, properties, required });
  const TOOL_SCHEMAS = Object.freeze({
    list_assets: { input:input({category:{type:'string'},tag:{type:'string'}}), output:output({assets:{type:'array',items:{type:'object'}}}) },
    inspect_scene: { input:input(), output:output({scene:SCENE_SCHEMA}) },
    place_asset: { input:input({assetId:{type:'string'},instanceId:ID_SCHEMA,position:VEC3_SCHEMA,rotation:VEC3_SCHEMA,scale:VEC3_SCHEMA},['assetId','instanceId','position']), output:output({instance:INSTANCE_SCHEMA}) },
    move_asset: { input:input({instanceId:ID_SCHEMA,position:VEC3_SCHEMA},['instanceId','position']), output:output({instance:INSTANCE_SCHEMA}) },
    rotate_asset: { input:input({instanceId:ID_SCHEMA,rotation:VEC3_SCHEMA},['instanceId','rotation']), output:output({instance:INSTANCE_SCHEMA}) },
    scale_asset: { input:input({instanceId:ID_SCHEMA,scale:VEC3_SCHEMA},['instanceId','scale']), output:output({instance:INSTANCE_SCHEMA}) },
    remove_asset: { input:input({instanceId:ID_SCHEMA},['instanceId']), output:output({removed:{type:'string'}}) },
    duplicate_asset: { input:input({instanceId:ID_SCHEMA,newInstanceId:ID_SCHEMA,position:VEC3_SCHEMA},['instanceId','newInstanceId']), output:output({instance:INSTANCE_SCHEMA}) },
    set_color: { input:input({instanceId:ID_SCHEMA,color:{type:'string',pattern:'^#[0-9A-Fa-f]{6}$'}},['instanceId','color']), output:output({instance:INSTANCE_SCHEMA}) },
    clear_scene: { input:input(), output:output({removedCount:{type:'integer',minimum:0}}) },
    undo: { input:input(), output:output({restored:{type:'boolean'}}) },
    save_scene: { input:input({title:{type:'string',maxLength:80}}), output:output({scene:SCENE_SCHEMA}) },
    load_scene: { input:input(), output:output({scene:SCENE_SCHEMA}) },
    play_avatar_action: { input:input({action:{type:'string',enum:ACTIONS}},['action']), output:output({action:{type:'string',enum:ACTIONS}}) },
    speak: { input:input({text:{type:'string',minLength:1,maxLength:500},emotion:{type:'string',enum:['neutral','happy','sad','angry','surprised']}},['text']), output:output({text:{type:'string'}}) }
  });
  const ok = (data) => ({ ok: true, code: 'OK', data });
  const fail = (code, message, details) => ({ ok: false, code, message, ...(details ? { details } : {}) });
  const vec3 = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
  const inside = ([x,y,z]) => Math.abs(x) <= .9 && y >= 0 && y <= .65 && Math.abs(z) <= .6;
  const scaleOk = (value) => vec3(value) && value.every((n) => n >= .05 && n <= 2);

  class SceneToolRegistry {
    constructor({ catalog, store, onEvent, onSpeak, onAction } = {}) {
      if (!catalog || !store) throw new TypeError('catalog and store are required');
      this.catalog = catalog;
      this.store = store;
      this.onEvent = onEvent || (() => {});
      this.onSpeak = onSpeak || (() => {});
      this.onAction = onAction || (() => {});
    }
    names() { return [...TOOLS]; }
    schemas() { return TOOL_SCHEMAS; }
    getObject(id) { return this.store.scene.objects.find((item) => item.instanceId === id); }
    overlaps(candidate, ignoreId) {
      const asset = this.catalog.get(candidate.assetId);
      if (!asset || asset.tags.includes('ground')) return null;
      const radius = Math.max(...(asset.footprint || [.1,.1])) * .42;
      return this.store.scene.objects.find((item) => {
        if (item.instanceId === ignoreId) return false;
        const other = this.catalog.get(item.assetId);
        if (!other || other.tags.includes('ground')) return false;
        const otherRadius = Math.max(...(other.footprint || [.1,.1])) * .42;
        const dx = item.position[0] - candidate.position[0], dz = item.position[2] - candidate.position[2];
        return Math.hypot(dx, dz) < (radius + otherRadius) * .72;
      }) || null;
    }
    execute(command = {}) {
      const name = command.tool;
      let result;
      try { result = this.run(name, command); }
      catch (error) { result = fail('INTERNAL_ERROR', error.message); }
      this.onEvent({ at: new Date().toISOString(), tool: name || 'unknown', input: { ...command }, result });
      return result;
    }
    run(name, input) {
      if (!TOOLS.includes(name)) return fail('UNKNOWN_TOOL', `Unknown tool: ${name || '(missing)'}`);
      if (name === 'list_assets') return ok({ assets: this.catalog.list(input).map(({ shape, color, ...asset }) => asset) });
      if (name === 'inspect_scene') return ok({ scene: this.store.snapshot() });
      if (name === 'undo') return this.store.undo() ? ok({ restored: true }) : fail('NOTHING_TO_UNDO', 'No earlier scene state');
      if (name === 'save_scene') {
        if (input.title) this.store.mutate((scene) => { scene.title = String(input.title).slice(0, 80); }, { tool: name });
        return ok({ scene: this.store.save() });
      }
      if (name === 'load_scene') { const scene = this.store.load(); return scene ? ok({ scene }) : fail('NO_SAVED_SCENE', 'No saved scene'); }
      if (name === 'clear_scene') { const count = this.store.scene.objects.length; this.store.mutate((scene) => { scene.objects = []; }, { tool: name }); return ok({ removedCount: count }); }
      if (name === 'play_avatar_action') {
        if (!ACTIONS.includes(input.action)) return fail('INVALID_ACTION', `Allowed actions: ${ACTIONS.join(', ')}`);
        this.onAction(input.action); return ok({ action: input.action });
      }
      if (name === 'speak') {
        if (!input.text || typeof input.text !== 'string') return fail('INVALID_INPUT', 'text is required');
        this.onSpeak(input.text, input.emotion || 'neutral'); return ok({ text: input.text });
      }
      if (name === 'place_asset') return this.place(input);
      const existing = this.getObject(input.instanceId);
      if (!existing) return fail('INSTANCE_NOT_FOUND', `Unknown instance: ${input.instanceId}`);
      if (name === 'remove_asset') {
        this.store.mutate((scene) => { scene.objects = scene.objects.filter((item) => item.instanceId !== input.instanceId); }, { tool: name });
        return ok({ removed: input.instanceId });
      }
      if (name === 'duplicate_asset') {
        if (!input.newInstanceId || this.getObject(input.newInstanceId)) return fail('DUPLICATE_INSTANCE_ID', 'newInstanceId must be unique');
        return this.place({ ...existing, tool: 'place_asset', instanceId: input.newInstanceId, position: input.position || existing.position });
      }
      if (name === 'move_asset') {
        if (!vec3(input.position)) return fail('INVALID_VECTOR', 'position must contain three finite numbers');
        if (!inside(input.position)) return fail('OUT_OF_BOUNDS', 'position is outside the World Tray');
        const overlap = this.overlaps({ ...existing, position: input.position }, input.instanceId);
        if (overlap) return fail('SEVERE_OVERLAP', `Would overlap ${overlap.instanceId}`);
        this.store.mutate((scene) => { scene.objects.find((item) => item.instanceId === input.instanceId).position = [...input.position]; }, { tool: name });
      } else if (name === 'rotate_asset') {
        if (!vec3(input.rotation)) return fail('INVALID_VECTOR', 'rotation must contain three finite numbers');
        this.store.mutate((scene) => { scene.objects.find((item) => item.instanceId === input.instanceId).rotation = [...input.rotation]; }, { tool: name });
      } else if (name === 'scale_asset') {
        if (!scaleOk(input.scale)) return fail('SCALE_OUT_OF_BOUNDS', 'scale values must be between 0.05 and 2');
        this.store.mutate((scene) => { scene.objects.find((item) => item.instanceId === input.instanceId).scale = [...input.scale]; }, { tool: name });
      } else if (name === 'set_color') {
        if (!/^#[0-9a-f]{6}$/i.test(input.color || '')) return fail('INVALID_COLOR', 'color must be #RRGGBB');
        this.store.mutate((scene) => { scene.objects.find((item) => item.instanceId === input.instanceId).color = input.color; }, { tool: name });
      }
      return ok({ instance: { ...this.getObject(input.instanceId) } });
    }
    place(input) {
      if (!this.catalog.has(input.assetId)) return fail('ASSET_NOT_FOUND', `Unknown asset: ${input.assetId}`);
      if (!input.instanceId || !/^[a-z0-9][a-z0-9-_]{0,63}$/i.test(input.instanceId)) return fail('INVALID_INSTANCE_ID', 'instanceId is required and must be URL-safe');
      if (this.getObject(input.instanceId)) return fail('DUPLICATE_INSTANCE_ID', `Instance exists: ${input.instanceId}`);
      if (this.store.scene.objects.length >= 40) return fail('SCENE_CAPACITY', 'Scene is limited to 40 objects');
      if (!vec3(input.position)) return fail('INVALID_VECTOR', 'position must contain three finite numbers');
      if (!inside(input.position)) return fail('OUT_OF_BOUNDS', 'position is outside the World Tray');
      const asset = this.catalog.get(input.assetId);
      const scale = input.scale || asset.defaultScale || [1,1,1];
      if (!scaleOk(scale)) return fail('SCALE_OUT_OF_BOUNDS', 'scale values must be between 0.05 and 2');
      const instance = { instanceId: input.instanceId, assetId: input.assetId, position: [...input.position], rotation: vec3(input.rotation) ? [...input.rotation] : [0,0,0], scale: [...scale], locked: false };
      const overlap = this.overlaps(instance);
      if (overlap) return fail('SEVERE_OVERLAP', `Would overlap ${overlap.instanceId}`);
      this.store.mutate((scene) => {
        scene.objects.push(instance);
        scene.tray.visible = true;
      }, { tool: 'place_asset' });
      return ok({ instance: { ...instance } });
    }
  }

  return { SceneToolRegistry, TOOL_SCHEMAS, TOOL_NAMES: TOOLS, AVATAR_ACTIONS: ACTIONS };
});
