import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const downloads=[
  ['vendor/aframe.min.js','https://raw.githubusercontent.com/andrewsegas/incarna/main/vendor/aframe.min.js'],
  ['assets/avatars/AvatarSample_B.vrm','https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/stable/AvatarSample_B.vrm'],
  ['assets/avatars/AvatarSample_A.vrm','https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/stable/AvatarSample_A.vrm']
];
for(const [relative,url] of downloads){
  const file=path.join(root,relative);if(fs.existsSync(file)&&fs.statSync(file).size>1000)continue;
  fs.mkdirSync(path.dirname(file),{recursive:true});console.log(`downloading runtime asset: ${relative}`);
  const response=await fetch(url);if(!response.ok)throw new Error(`download ${relative}: ${response.status}`);
  fs.writeFileSync(file,Buffer.from(await response.arrayBuffer()));
}
if(!fs.existsSync(path.join(root,'assets/scene/ground_grass_01.glb'))){
  const result=spawnSync(process.execPath,[path.join(root,'scripts/generate-scene-assets.mjs')],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
