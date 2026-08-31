import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
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
const avatarB=path.join(root,'assets/avatars/AvatarSample_B.vrm');
if(fs.existsSync(avatarB)){
  const data=fs.readFileSync(avatarB);const jsonLength=data.readUInt32LE(12);const gltf=JSON.parse(data.toString('utf8',20,20+jsonLength));
  if(!gltf.extensions?.VRMC_vrm)throw new Error('AvatarSample_B must be VRM 1.0');
  const hash=createHash('sha256').update(data).digest('hex');
  if(hash!=='ffbd8c92a9e67c0a948f69c7a2eec91e5c282c9ae70e9184309fc164d74cbc27')throw new Error('AvatarSample_B checksum mismatch');
}
console.log(`project check passed: ${scripts.length} scripts, ${manifest.assets.length} GLBs, 4 JSON files${fs.existsSync(avatarB)?', VRM 1.0 avatar verified':''}`);
