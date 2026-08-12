#!/usr/bin/env node
'use strict';
import fs from 'node:fs'; import {execFileSync} from 'node:child_process'; import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url), read=p=>fs.readFileSync(new URL(p,root),'utf8');
const renderer=read('game/src/render/renderer.js'), sky=read('game/src/render/sky.js'), foundation=read('game/src/render/visual-foundation.js'),province=read('game/src/world/province.js'),actor=read('game/src/render/actor.js'),vfx=read('game/src/render/spell-vfx.js');
const run=p=>{try{return JSON.parse(execFileSync(process.execPath,[fileURLToPath(new URL(p,root))],{encoding:'utf8'}));}catch{return{result:'RED'};}};
const assetGate=run('tools/render/w1-30-assets.mjs'),populationGate=run('tools/render/w1-30-visual-populations.mjs');
const predicates={
  boundedCompositor:['WebGLRenderTarget','DepthTexture','worldBeforeUI:true'].every(x=>renderer.includes(x)),
  workingSabotage:['setVisualFeature','uAO.value=this.quality.ao','shadowMap.enabled=!!enabled'].every(x=>renderer.includes(x)),
  coupledCelestials:['uSunDir','this.moon.position.copy(dir).multiplyScalar(-120)'].every(x=>sky.includes(x)),
  stableShadows:['Math.round(focus.x/texel)','shadow.camera.updateProjectionMatrix'].every(x=>sky.includes(x)),
  genuineIBL:['EquirectangularReflectionMapping','scene.environment=this.features.ibl'].every(x=>sky.includes(x)),
  physicalFamilies:['MeshStandardMaterial','MeshPhysicalMaterial','aoMap: procedural.height','normalMap:authored?.normal','roughnessMap: authored?.rough','envMapIntensity','wetness:'].every(x=>foundation.includes(x)),
  ownedConsumers:(foundation.slice(foundation.indexOf('FEATURE_CONSUMERS'),foundation.indexOf('const FAMILY')).match(/\b\w+: \[/g)||[]).length===21,
  authoredAssets:assetGate.result==='GREEN'&&assetGate.assets===4&&assetGate.files===35&&assetGate.bytes>6_000_000,
  visualPopulation:populationGate.references?.manifestRecords===808&&populationGate.world?.regions?.length===13&&populationGate.world?.settlements?.length===8&&populationGate.world?.interiors?.count===115,
  productionPooling:province.includes('STYLE_MATERIAL_CACHE')&&actor.includes('_equipmentMaterialCache'),
  familyFormsAndVfxLight:actor.includes('actor-family-form:')&&vfx.includes('spell-vfx:practical:'),
};
const redControls={}; for(const token of ['WebGLRenderTarget','DepthTexture','setVisualFeature','EquirectangularReflectionMapping','Math.round(focus.x/texel)','normalMap:authored?.normal','STYLE_MATERIAL_CACHE','actor-family-form:','spell-vfx:practical:']) {const s=[renderer,sky,foundation,province,actor,vfx].find(x=>x.includes(token));redControls[token]=!!s&&!s.replaceAll(token,'__SABOTAGED__').includes(token);}
let testedCommit='unknown';try{testedCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
const green=Object.values(predicates).every(Boolean)&&Object.values(redControls).every(Boolean);
console.log(JSON.stringify({schema:'elder-souls/w1-30-builder-aggregate@2',testedCommit,predicates,uniqueRedControls:redControls,assets:{result:assetGate.result,files:assetGate.files,bytes:assetGate.bytes},population:{references:populationGate.references?.manifestRecords,regions:populationGate.world?.regions?.length,settlements:populationGate.world?.settlements?.length,interiors:populationGate.world?.interiors?.count},result:green?'GREEN':'RED'},null,2));if(!green)process.exit(1);
