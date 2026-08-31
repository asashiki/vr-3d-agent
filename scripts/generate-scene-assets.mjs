import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'ASSET_MANIFEST.json'), 'utf8'));
const output = path.join(root, 'assets', 'scene');
fs.mkdirSync(output, { recursive: true });

function hex(value) {
  const n = Number.parseInt(value.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
}

function geometry(shape) {
  // Low-poly silhouettes are deliberately tiny and Quest-friendly.
  if (shape === 'cone' || shape === 'tree' || shape === 'lamp' || shape === 'flower') {
    const sides = shape === 'flower' ? 6 : 8;
    const p = [[0, 1, 0], [0, 0, 0]];
    for (let i = 0; i < sides; i++) p.push([Math.cos(i * Math.PI * 2 / sides) * .5, 0, Math.sin(i * Math.PI * 2 / sides) * .5]);
    const idx = [];
    for (let i = 0; i < sides; i++) { const a = 2 + i, b = 2 + ((i + 1) % sides); idx.push(0, a, b, 1, b, a); }
    return [p, idx];
  }
  if (shape === 'icosphere' || shape === 'cylinder') {
    const sides = 10, p = [];
    for (let y = 0; y <= 1; y++) for (let i = 0; i < sides; i++) p.push([Math.cos(i*Math.PI*2/sides)*.5, y, Math.sin(i*Math.PI*2/sides)*.5]);
    const idx=[];
    for(let i=0;i<sides;i++){const n=(i+1)%sides;idx.push(i,n,sides+i,n,sides+n,sides+i);}
    return [p,idx];
  }
  const p=[[-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5],[-.5,1,-.5],[.5,1,-.5],[.5,1,.5],[-.5,1,.5]];
  const idx=[0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0];
  return [p,idx];
}

function makeGlb(asset) {
  const [positions, indices] = geometry(asset.shape);
  const pos = Buffer.alloc(positions.length * 12);
  positions.flat().forEach((v, i) => pos.writeFloatLE(v, i * 4));
  const ind = Buffer.alloc(indices.length * 2);
  indices.forEach((v, i) => ind.writeUInt16LE(v, i * 2));
  const pad = (4 - (pos.length % 4)) % 4;
  const bin = Buffer.concat([pos, Buffer.alloc(pad), ind, Buffer.alloc((4 - ind.length % 4) % 4)]);
  const gltf = {
    asset: { version: '2.0', generator: 'Pocket World Agent procedural CC0 generator' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: asset.name }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ name: asset.id, pbrMetallicRoughness: { baseColorFactor: hex(asset.color), roughnessFactor: .86, metallicFactor: 0 } }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.length, target: 34962 }, { buffer: 0, byteOffset: pos.length + pad, byteLength: ind.length, target: 34963 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length, type: 'VEC3', min: [-.5,0,-.5], max: [.5,1,.5] },
      { bufferView: 1, componentType: 5123, count: indices.length, type: 'SCALAR' }
    ]
  };
  let json = Buffer.from(JSON.stringify(gltf));
  json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67,0); head.writeUInt32LE(2,4); head.writeUInt32LE(12+8+json.length+8+bin.length,8);
  const jh=Buffer.alloc(8); jh.writeUInt32LE(json.length,0); jh.writeUInt32LE(0x4e4f534a,4);
  const bh=Buffer.alloc(8); bh.writeUInt32LE(bin.length,0); bh.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([head,jh,json,bh,bin]);
}

for (const asset of manifest.assets) fs.writeFileSync(path.join(root, asset.file), makeGlb(asset));
console.log(`generated ${manifest.assets.length} CC0 GLB assets in ${output}`);
