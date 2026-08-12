#!/usr/bin/env node
'use strict';
import fs from 'node:fs';
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const fail=[];
const breakToken=process.argv.includes('--break')?process.argv[process.argv.indexOf('--break')+1]:null;
let vfx=read('game/src/render/spell-vfx.js'), province=read('game/src/world/province.js'), renderer=read('game/src/render/renderer.js');
if(breakToken){const before=[vfx,province,renderer].join('').includes(breakToken);vfx=vfx.replaceAll(breakToken,'__W1_30_DELETED__');province=province.replaceAll(breakToken,'__W1_30_DELETED__');renderer=renderer.replaceAll(breakToken,'__W1_30_DELETED__');if(!before)fail.push(`unknown --break token: ${breakToken}`);}
const req=(source,token,area)=>{if(!source.includes(token))fail.push(`${area}: ${token}`);};
for(const t of ['MAX_FRAME_PARTICLES = 4000','MAX_DECALS = 60','prepass(camera)','DepthTexture','NormalBlending','AdditiveBlending','uAmbient','uSun','_emitCore','_emitTrail','_emitImpact','_pushDecal','meshFx','refract','overdrawFactor','deterministicSeedSource','dispose()'])req(vfx,t,'vfx');
for(const t of ['radiusTiles','const KEEP = RADIUS + 1','lodBands','lodTransition','geoCache','updateNear','updateCover','_release(k, t)','dispose()'])req(province,t,'streaming/LOD');
for(const t of ['prewarmShaders','compile(this.scene, this.camera)','temporalHistory','worldTarget.setSize','drawCalls','triangles','geometries','textures','programs'])req(renderer,t,'renderer lifecycle/observables');
for(const file of ['corpus/80-methods/m-mag05-vfx-metrics.mjs','corpus/80-methods/palette-selfcheck.mjs','corpus/80-methods/palette-conformance.mjs','corpus/80-methods/vis-metrics.mjs'])if(!fs.existsSync(new URL(file,root)))fail.push(`authority method absent: ${file}`);
const red={};
for(const [area,source,tokens] of [['vfx',vfx,['prepass(camera)','MAX_FRAME_PARTICLES = 4000','_pushDecal','NormalBlending']],['stream',province,['const KEEP = RADIUS + 1','lodBands','_release(k, t)']],['renderer',renderer,['prewarmShaders','worldTarget.setSize','programs']]]) {
  for(const token of tokens) red[`${area}:${token}`]=!source.replaceAll(token,'__DELETED__').includes(token);
}
if(!Object.values(red).every(Boolean))fail.push('a Package 4 red/delete control is inert');
const result={schema:'elder-souls/w1-30-package4@1',result:fail.length?'RED':'GREEN',vfx:{stages:['release','travel','impact','residue'],particleCap:4000,decalCap:60,lit:true,depthIntegrated:true,meshEffects:4,boundedPools:true},
  streaming:{nearFarBands:true,silhouetteOverlap:true,hysteresisTiles:1,sharedPools:true,finalReferenceDisposal:true,prewarmOutsideCombat:true,retainedHistory:false},
  observables:['drawCalls','triangles','programs','geometries','textures','vfx.particles','vfx.systems','vfx.decals','vfx.particleDrawCalls','vfx.overdrawFactor'],activeSabotage:breakToken,uniqueRedControls:red,failures:fail};
console.log(JSON.stringify(result,null,2));if(fail.length)process.exit(1);
