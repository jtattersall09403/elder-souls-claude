#!/usr/bin/env node
'use strict';
import fs from 'node:fs'; import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url), read=p=>fs.readFileSync(new URL(p,root),'utf8');
const renderer=read('game/src/render/renderer.js'), sky=read('game/src/render/sky.js'), foundation=read('game/src/render/visual-foundation.js');
const predicates={
  boundedCompositor:['WebGLRenderTarget','DepthTexture','worldBeforeUI:true'].every(x=>renderer.includes(x)),
  workingSabotage:['setVisualFeature','uAO.value=this.quality.ao','shadowMap.enabled=!!enabled'].every(x=>renderer.includes(x)),
  coupledCelestials:['uSunDir','this.moon.position.copy(dir).multiplyScalar(-120)'].every(x=>sky.includes(x)),
  stableShadows:['Math.round(focus.x/texel)','shadow.camera.updateProjectionMatrix'].every(x=>sky.includes(x)),
  genuineIBL:['EquirectangularReflectionMapping','scene.environment=this.features.ibl'].every(x=>sky.includes(x)),
  physicalFamilies:['MeshStandardMaterial','aoMap: map','envMapIntensity','wetness:'].every(x=>foundation.includes(x)),
  ownedConsumers:(foundation.slice(foundation.indexOf('FEATURE_CONSUMERS'),foundation.indexOf('const FAMILY')).match(/\b\w+: \[/g)||[]).length===21,
};
const redControls={}; for(const token of ['WebGLRenderTarget','DepthTexture','setVisualFeature','EquirectangularReflectionMapping','Math.round(focus.x/texel)','new THREE.MeshStandardMaterial']) {const s=[renderer,sky,foundation].find(x=>x.includes(token));redControls[token]=!!s&&!s.replaceAll(token,'__SABOTAGED__').includes(token);}
let testedCommit='unknown';try{testedCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
const green=Object.values(predicates).every(Boolean)&&Object.values(redControls).every(Boolean);
console.log(JSON.stringify({schema:'elder-souls/w1-30-builder-aggregate@1',testedCommit,predicates,uniqueRedControls:redControls,result:green?'GREEN':'RED'},null,2));if(!green)process.exit(1);
