import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const downloads=[
  ['vendor/aframe.min.js','https://raw.githubusercontent.com/andrewsegas/incarna/main/vendor/aframe.min.js','0729eeb5e37481bb39059c3e6161ec45f644854e5b658b64fe45ff2c3f9c6f33'],
  ['assets/avatars/AvatarSample_B.vrm','https://raw.githubusercontent.com/pixiv/ChatVRM/main/public/AvatarSample_B.vrm','ffbd8c92a9e67c0a948f69c7a2eec91e5c282c9ae70e9184309fc164d74cbc27'],
  ['assets/avatars/AvatarSample_A.vrm','https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/stable/AvatarSample_A.vrm','b86b0b8a66d48911431d6f920a5211a974226f83aa672eca3f3dfade58ac346e']
];
const sha256=(file)=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for(const [relative,url,expectedHash] of downloads){
  const file=path.join(root,relative);if(fs.existsSync(file)&&sha256(file)===expectedHash)continue;
  fs.mkdirSync(path.dirname(file),{recursive:true});console.log(`downloading runtime asset: ${relative}`);
  const response=await fetch(url);if(!response.ok)throw new Error(`download ${relative}: ${response.status}`);
  fs.writeFileSync(file,Buffer.from(await response.arrayBuffer()));
  if(sha256(file)!==expectedHash)throw new Error(`checksum mismatch: ${relative}`);
}
if(!fs.existsSync(path.join(root,'assets/scene/ground_grass_01.glb'))){
  const result=spawnSync(process.execPath,[path.join(root,'scripts/generate-scene-assets.mjs')],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
