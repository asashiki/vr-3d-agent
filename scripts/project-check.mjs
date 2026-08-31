import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'ASSET_MANIFEST.json'),'utf8'));
if(manifest.assets.length!==30)throw new Error(`expected 30 assets, got ${manifest.assets.length}`);
for(const asset of manifest.assets){
  const file=path.join(root,asset.file);const data=fs.readFileSync(file);
  if(data.readUInt32LE(0)!==0x46546c67||data.readUInt32LE(4)!==2)throw new Error(`invalid GLB: ${asset.file}`);
}
const scripts=[];
for(const dir of ['js','lib','tests','scripts']){
  const walk=(folder)=>{for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const full=path.join(folder,entry.name);if(entry.isDirectory())walk(full);else if(/\.(?:js|mjs)$/.test(entry.name))scripts.push(full);}};walk(path.join(root,dir));
}
for(const file of scripts)execFileSync(process.execPath,['--check',file],{stdio:'ignore'});
for(const json of ['ASSET_MANIFEST.json','actions.json','agents.example.json','fixtures/garden-replay.json'])JSON.parse(fs.readFileSync(path.join(root,json),'utf8'));
console.log(`project check passed: ${scripts.length} scripts, ${manifest.assets.length} GLBs, 4 JSON files`);
