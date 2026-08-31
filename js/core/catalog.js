(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PocketWorld = Object.assign(root.PocketWorld || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  class AssetCatalog {
    constructor(manifest) {
      if (!manifest || !Array.isArray(manifest.assets)) throw new TypeError('manifest.assets is required');
      this.version = manifest.version || 1;
      this.assets = manifest.assets.map((asset) => Object.freeze({ ...asset }));
      this.byId = new Map(this.assets.map((asset) => [asset.id, asset]));
      if (this.byId.size !== this.assets.length) throw new Error('duplicate asset id in manifest');
    }

    static async load(url = 'ASSET_MANIFEST.json') {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`catalog ${response.status}`);
      return new AssetCatalog(await response.json());
    }

    has(id) { return this.byId.has(id); }
    get(id) { return this.byId.get(id) || null; }
    list(query = {}) {
      const category = query.category && String(query.category).toLowerCase();
      const tag = query.tag && String(query.tag).toLowerCase();
      return this.assets.filter((asset) => (!category || asset.category === category) &&
        (!tag || asset.tags.some((item) => item.toLowerCase() === tag)));
    }
  }

  return { AssetCatalog };
});
