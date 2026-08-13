#!/usr/bin/env node
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../../game/vendor/three/three.module.js';
import {buildSettlementExterior,planSettlement} from '../../game/src/render/exterior.js';

const ROOT=path.resolve(import.meta.dirname,'../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const list=p=>fs.readdirSync(path.join(ROOT,p)).filter(x=>x.endsWith('.json')).sort();
const interiors={};
for(const f of list('game/data/world/interiors')){
  const doc=read(`game/data/world/interiors/${f}`),rows=Array.isArray(doc)?doc:(doc.interiors||[doc]);
  for(const row of rows)interiors[row.id]=row;
}
const failures=[],check=(v,m)=>{if(!v)failures.push(m);};
const names=(root,prefix)=>{const out=[];root.traverse(o=>{if(o.name?.startsWith(prefix))out.push(o.name);});return out.sort();};
const logicalTriangles=root=>{let n=0;root.traverse(o=>{if(!o.isMesh||!o.geometry)return;const g=o.geometry,one=g.index?g.index.count/3:g.attributes.position.count/3;n+=o.userData.logicalTriangles??one*(o.isInstancedMesh?o.count:1);});return Math.round(n);};
const meshCount=root=>{let n=0;root.traverse(o=>{if(o.isMesh)n++;});return n;};
const bounds=root=>{root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(root),s=new THREE.Vector3();b.getSize(s);return [s.x,s.y,s.z];};

const perSettlement=[];
let baselineMeshes=0,productionMeshes=0,drawsSaved=0,batches=0,instances=0;
for(const f of list('game/data/world/settlements')){
  const doc=read(`game/data/world/settlements/${f}`),plan=planSettlement(doc,interiors);
  const baseline=new THREE.Group(),reference=new THREE.Group(),production=new THREE.Group();
  buildSettlementExterior(baseline,plan,()=>0);
  buildSettlementExterior(reference,plan,()=>0,{buildingBatch:false});
  const liveSummary=buildSettlementExterior(production,plan,()=>0,{settlementBatch:true});
  const baseMeshes=meshCount(baseline),liveMeshes=meshCount(production),compression=liveSummary.mesh_compression;
  const baseTris=logicalTriangles(reference),liveTris=logicalTriangles(production);
  const baseBuildings=names(reference,'building:'),liveBuildings=names(production,'building:');
  const baseKit=names(reference,'kit:'),liveKit=names(production,'kit:');
  const baseDoors=names(reference,'door:'),liveDoors=names(production,'door:');
  check(JSON.stringify(baseBuildings)===JSON.stringify(liveBuildings),`${doc.id}: building identities changed`);
  check(JSON.stringify(baseKit)===JSON.stringify(liveKit),`${doc.id}: kit identities changed`);
  check(JSON.stringify(baseDoors)===JSON.stringify(liveDoors),`${doc.id}: door identities changed`);
  check(baseTris===liveTris,`${doc.id}: logical triangles changed ${baseTris} -> ${liveTris}`);
  const baseBounds=bounds(reference),liveBounds=bounds(production),boundsDelta=Math.max(...baseBounds.map((x,i)=>Math.abs(x-liveBounds[i])));
  check(boundsDelta<.002,`${doc.id}: rendered bounds changed by ${boundsDelta.toFixed(4)} m`);
  check(liveMeshes<=140,`${doc.id}: ${liveMeshes} render meshes exceeds 140`);
  check(compression?.drawsSaved===liveSummary.logical_meshes-liveMeshes,
    `${doc.id}: compression accounting mismatch ${compression?.drawsSaved} vs ${liveSummary.logical_meshes-liveMeshes}`);
  baselineMeshes+=baseMeshes;productionMeshes+=liveMeshes;drawsSaved+=compression?.drawsSaved||0;
  batches+=compression?.batches||0;instances+=compression?.instances||0;
  perSettlement.push({id:doc.id,buildings:plan.buildings.length,baselineMeshes:baseMeshes,
    productionMeshes:liveMeshes,reductionPct:+((1-liveMeshes/baseMeshes)*100).toFixed(1),
    batches:compression?.batches||0,instances:compression?.instances||0,logicalTriangles:liveTris});
}
const reductionPct=(1-productionMeshes/baselineMeshes)*100;
check(perSettlement.length===8,`settlement population ${perSettlement.length}/8`);
check(reductionPct>=85,`whole-population mesh reduction ${reductionPct.toFixed(1)}%, expected >=85%`);
check(drawsSaved>10_000,`settlement batching saves only ${drawsSaved} submissions`);

const report={schema:'elder-souls/w1-30-settlement-batching@1',result:failures.length?'RED':'GREEN',
  population:{settlements:perSettlement.length,buildings:perSettlement.reduce((n,x)=>n+x.buildings,0)},
  production:{baselineMeshes,renderMeshes:productionMeshes,reductionPct:+reductionPct.toFixed(1),batches,instances,drawsSaved},
  deleteControl:{settlementBatchFalseMeshes:baselineMeshes,delta:baselineMeshes-productionMeshes},
  invariants:['building identities','kit identities','door identities','logical triangles','rendered bounds'],
  perSettlement,failures};
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
