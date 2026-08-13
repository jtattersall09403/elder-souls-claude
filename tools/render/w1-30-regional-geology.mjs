#!/usr/bin/env node
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import {WorldField} from '../../game/src/world/field.js';
import {Province} from '../../game/src/world/province.js';
import {regionArt} from '../../game/src/render/world-art.js';

const ROOT=path.resolve(import.meta.dirname,'../..'),read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const regionsDoc=read('game/data/world/regions.json');
const field=new WorldField(read('game/data/world/terrain.json'),regionsDoc,read('game/data/world/water.json'));
const province=new Province(field),failures=[],check=(v,m)=>{if(!v)failures.push(m);};
const controlArg=Object.fromEntries(['disable-geology'].map(k=>[k,'true']));
check(String(controlArg['disable-geology'])==='true','hyphenated visual control argument is not consumed');

// A region centroid is an administrative centroid and may be open sea (both coastal records are).
// Find the closest dry, region-owned playable focus on a deterministic ten-metre polar lattice.
const focusFor=r=>{
  const [cx,cz]=r.centroid_m,candidates=[];
  for(let radius=0;radius<=480;radius+=10)for(let i=0;i<48;i++){
    const a=i/48*Math.PI*2,x=cx+Math.cos(a)*radius,z=cz+Math.sin(a)*radius;
    if(x<0||z<0||x>=field.sizeX||z>=field.sizeZ||field.regionAt(x,z).id!==r.id||!field.isLandAt(x,z))continue;
    candidates.push({x,z,depth:field.depthAt(x,z),radius});
  }
  candidates.sort((a,b)=>a.depth-b.depth||a.radius-b.radius||a.x-b.x||a.z-b.z);
  return candidates[0];
};

const perRegion=[],grammars=new Set(),geometrySignatures=new Set();let liveInstances=0,liveMeshes=0;
for(const r of regionsDoc.regions){
  const focus=focusFor(r);check(focus,`${r.id}: no region-owned land focus`);if(!focus)continue;
  province.geologyAt=null;
  const count=province.updateGeology(focus.x,focus.z),meshes=province.geologyGroup.children.filter(x=>x.isInstancedMesh);
  const own=meshes.filter(x=>x.userData.worldArt?.region===r.id),art=regionArt(r.id);
  check(count>0,`${r.id}: geology population is empty`);
  check(own.length===1,`${r.id}: expected one own-region instanced mesh, got ${own.length}`);
  check(own[0]?.userData.worldArt?.terrain===art.terrain,`${r.id}: terrain grammar was not consumed`);
  if(own[0]){
    const g=own[0].geometry,p=g.getAttribute('position');
    geometrySignatures.add(`${p.count}:${g.index?.count||0}:${[...p.array].slice(0,24).map(v=>v.toFixed(3)).join(',')}`);
  }
  grammars.add(art.terrain);liveInstances+=count;liveMeshes+=meshes.length;
  perRegion.push({id:r.id,terrainGrammar:art.terrain,focus:[+focus.x.toFixed(1),+focus.z.toFixed(1)],centroidOffsetM:focus.radius,
    instances:count,meshRegions:meshes.map(x=>x.userData.worldArt.region).sort()});
}

// Literal delete-the-fix: retain the field, skin/cover registries and Province, cut only the
// production draw seam, force a rebuild, and require the geology population to become empty.
province.drawGeology=false;province.geologyAt=null;
const deleted=province.updateGeology(perRegion[0].focus[0],perRegion[0].focus[1]);
check(deleted===0&&province.geologyGroup.children.length===0,'delete control retained regional geology');
check(perRegion.length===13,`regional population ${perRegion.length}/13`);
check(grammars.size===13,`terrain grammar population ${grammars.size}/13`);
check(geometrySignatures.size===13,`constructed geometry signatures ${geometrySignatures.size}/13`);
check(liveMeshes<=26,`regional geology draw population unexpectedly high: ${liveMeshes}`);

const report={schema:'elder-souls/w1-30-regional-geology@1',result:failures.length?'RED':'GREEN',
  population:{regions:perRegion.length,terrainGrammars:grammars.size,constructedForms:geometrySignatures.size,instances:liveInstances,instancedMeshes:liveMeshes},
  constraints:{worldAnchoredLattice:true,cameraCentredHole:false,lowStepScaleRelief:true,rebuildM:14,settlementClearanceM:10,drawsPerRegionMax:1},
  deleteControl:{drawGeology:false,instances:deleted,geologyMeshes:province.geologyGroup.children.length},perRegion,failures};
console.log(JSON.stringify(report,null,2));
province.dispose();
if(failures.length)process.exit(1);
