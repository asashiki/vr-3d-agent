(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PocketWorld = Object.assign(root.PocketWorld || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const defaultScene = () => ({
    version: 1,
    sceneId: `scene-${Date.now().toString(36)}`,
    title: '未命名小世界',
    tray: { position: [0, 0.72, -1.8], rotation: [0, 0, 0], scale: 1 },
    objects: [],
    updatedAt: new Date().toISOString()
  });

  class MemoryStorage {
    constructor() { this.values = new Map(); }
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
    setItem(key, value) { this.values.set(key, String(value)); }
    removeItem(key) { this.values.delete(key); }
  }

  class SceneStore {
    constructor(options = {}) {
      this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : new MemoryStorage());
      this.key = options.key || 'pocket-world.scene.v1';
      this.scene = clone(options.initialScene || defaultScene());
      this.history = [];
      this.listeners = new Set();
      this.maxHistory = options.maxHistory || 50;
    }

    snapshot() { return clone(this.scene); }
    subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    emit(meta = {}) { const state = this.snapshot(); for (const listener of this.listeners) listener(state, meta); }
    validateScene(scene) {
      return scene && scene.version === 1 && scene.tray && Array.isArray(scene.objects) &&
        scene.objects.every((item) => item && typeof item.instanceId === 'string' && typeof item.assetId === 'string');
    }
    mutate(mutator, meta = {}) {
      const before = this.snapshot();
      const draft = this.snapshot();
      mutator(draft);
      if (!this.validateScene(draft)) throw new Error('invalid scene graph');
      this.history.push(before);
      if (this.history.length > this.maxHistory) this.history.shift();
      draft.updatedAt = new Date().toISOString();
      this.scene = draft;
      this.emit(meta);
      return this.snapshot();
    }
    replace(scene, meta = {}) {
      if (!this.validateScene(scene)) throw new Error('invalid scene graph');
      const before = this.snapshot();
      this.history.push(before);
      this.scene = clone(scene);
      this.emit(meta);
      return this.snapshot();
    }
    restore(scene, meta = {}) {
      if (!this.validateScene(scene)) throw new Error('invalid scene graph');
      this.scene = clone(scene);
      this.emit(meta);
      return this.snapshot();
    }
    undo() {
      if (!this.history.length) return false;
      this.scene = this.history.pop();
      this.emit({ tool: 'undo' });
      return true;
    }
    save() { this.storage.setItem(this.key, JSON.stringify(this.scene)); return this.snapshot(); }
    load() {
      const raw = this.storage.getItem(this.key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!this.validateScene(parsed)) throw new Error('saved scene is invalid');
      this.replace(parsed, { tool: 'load_scene' });
      return this.snapshot();
    }
  }

  return { SceneStore, MemoryStorage, defaultScene };
});
