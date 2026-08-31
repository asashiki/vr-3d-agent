(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PocketWorld = Object.assign(root.PocketWorld || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const DEFAULT_TRAY = Object.freeze({ position: [-0.72, 0.5, -1.9], rotation: [0, 0, 0], scale: 0.72, visible: false });
  const DEFAULT_AVATAR = Object.freeze({ position: [0.55, 0, -1.6], rotation: [0, -15, 0], scale: 0.72, visible: true });
  const hydrateScene = (value) => {
    const scene = clone(value);
    scene.tray = { ...clone(DEFAULT_TRAY), ...(scene.tray || {}) };
    scene.avatar = { ...clone(DEFAULT_AVATAR), ...(scene.avatar || {}) };
    return scene;
  };
  const defaultScene = () => ({
    version: 1,
    sceneId: `scene-${Date.now().toString(36)}`,
    title: '未命名小世界',
    tray: clone(DEFAULT_TRAY),
    avatar: clone(DEFAULT_AVATAR),
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
      this.scene = hydrateScene(options.initialScene || defaultScene());
      this.history = [];
      this.listeners = new Set();
      this.maxHistory = options.maxHistory || 50;
    }

    snapshot() { return clone(this.scene); }
    subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    emit(meta = {}) { const state = this.snapshot(); for (const listener of this.listeners) listener(state, meta); }
    validateScene(scene) {
      return scene && scene.version === 1 && scene.tray && scene.avatar && Array.isArray(scene.objects) &&
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
      this.scene = hydrateScene(scene);
      this.emit(meta);
      return this.snapshot();
    }
    restore(scene, meta = {}) {
      if (!this.validateScene(scene)) throw new Error('invalid scene graph');
      this.scene = hydrateScene(scene);
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
      const parsed = hydrateScene(JSON.parse(raw));
      if (!this.validateScene(parsed)) throw new Error('saved scene is invalid');
      this.replace(parsed, { tool: 'load_scene' });
      return this.snapshot();
    }
  }

  return { SceneStore, MemoryStorage, defaultScene };
});
