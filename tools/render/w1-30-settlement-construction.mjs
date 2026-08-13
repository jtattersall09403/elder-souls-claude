#!/usr/bin/env node
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../../game/vendor/three/three.module.js';
import {
  buildBuilding, buildSettlementExterior, kitBuildable, planSettlement, settlementSolids,
} from '../../game/src/render/exterior.js';

const ROOT=path.resolve(import.meta.dirname,'../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const list=p=>fs.readdirSync(path.join(ROOT,p)).filter(x=>x.endsWith('.json')).sort();
const settlements=list('game/data/world/settlements').map(f=>read(`game/data/world/settlements/${f}`));
const interiors={};
for(const f of list('game/data/world/interiors')){
  const doc=read(`game/data/world/interiors/${f}`),rows=Array.isArray(doc)?doc:(Array.isArray(doc.interiors)?doc.interiors:[doc]);
  for(const row of rows)interiors[row.id]=row;
}
const failures=[],check=(v,m)=>{if(!v)failures.push(m);};
let buildings=0,structures=0,semanticChanged=0,featureGroups=0,shellWalls=0;
let productionStructureSolids=0,deletedStructureSolids=0,walkableStructures=0;
const perSettlement=[];

for(const doc of settlements){
  const plan=planSettlement(doc,interiors),oldPlan=planSettlement(doc,interiors,{semanticStructures:false});
  const oldById=new Map(oldPlan.buildings.map(b=>[b.id,b]));
  const root=new THREE.Group(),summary=buildSettlementExterior(root,plan,()=>0);
  buildings+=plan.buildings.length;
  const rows=plan.buildings.filter(b=>b.kind==='structure');
  structures+=rows.length;
  for(const b of rows){
    check(!!b.structure_kit,`${b.id}: semantic structure kit missing`);
    check(doc.architecture_kit.meshes.includes(b.structure_kit),`${b.id}: ${b.structure_kit} is outside declared town kit`);
    check(kitBuildable(b.structure_kit,doc.id),`${b.id}: ${b.structure_kit} is not buildable`);
    if(oldById.get(b.id)?.structure_kit!==b.structure_kit)semanticChanged++;
    const g=root.getObjectByName(`building:${b.id}`);
    check(!!g,`${b.id}: no shipping scene-graph group`);
    if(g?.userData?.structureFeature?.semantic)featureGroups++;
    let localShell=0,localFeatures=0;
    g?.traverse(o=>{if(o.name==='shellwall')localShell++;if(o.name?.startsWith(`structure-feature:${b.id}:`))localFeatures++;});
    shellWalls+=localShell;
    check(localShell===0,`${b.id}: named civic feature still has ${localShell} blank house walls`);
    check(localFeatures===1,`${b.id}: expected one semantic feature, saw ${localFeatures}`);
    const deleted=buildBuilding(b,doc.id,{structureFeatures:false}).group;
    let deletedShell=0;deleted.traverse(o=>{if(o.name==='shellwall')deletedShell++;});
    check(deletedShell>=4,`${b.id}: structure-feature delete arm did not restore blank shell`);
  }
  const live=settlementSolids(plan,plan.pos[0],plan.pos[2],1e9,()=>0);
  const ids=new Set(rows.map(b=>b.id));
  const liveStructure=live.filter(s=>[...ids].some(id=>s.id.startsWith(`${id}:`)));
  productionStructureSolids+=liveStructure.length;
  check(!liveStructure.some(s=>/:roof-camera-solid$|:[+-][xz]/.test(s.id)),`${doc.id}: structure retained invisible house perimeter/roof collision`);
  const deletedPlan={...plan,buildings:plan.buildings.map(b=>b.kind==='structure'?{...b,kind:'structure-delete-control'}:b)};
  const oldSolids=settlementSolids(deletedPlan,plan.pos[0],plan.pos[2],1e9,()=>0)
    .filter(s=>[...ids].some(id=>s.id.startsWith(`${id}:`)));
  deletedStructureSolids+=oldSolids.length;
  walkableStructures+=rows.filter(b=>!liveStructure.some(s=>s.id.startsWith(`${b.id}:`))).length;
  check(oldSolids.length>=rows.length*5,`${doc.id}: collision delete arm did not restore house shells`);
  check(summary.drawn.filter(r=>r.structure_feature).length===rows.length,
    `${doc.id}: summary exposes ${summary.drawn.filter(r=>r.structure_feature).length}/${rows.length} civic features`);
  perSettlement.push({id:doc.id,buildings:plan.buildings.length,structures:rows.length,
    publicRealmFeatures:summary.public_realm.features,meshes:summary.meshes,triangles:summary.triangles});
}

check(settlements.length===8,`settlement population ${settlements.length}, expected 8`);
check(structures===56,`structure population ${structures}, expected 56`);
check(featureGroups===structures,`semantic scene groups ${featureGroups}/${structures}`);
check(shellWalls===0,`production structure shell walls ${shellWalls}, expected 0`);
check(semanticChanged>=40,`semantic binding changed only ${semanticChanged}/${structures}; delete arm is not discriminating`);
check(deletedStructureSolids>productionStructureSolids,
  `collision delete arm ${deletedStructureSolids} did not exceed production ${productionStructureSolids}`);

const report={
  schema:'elder-souls/w1-30-settlement-construction@1',result:failures.length?'RED':'GREEN',
  population:{settlements:settlements.length,buildings,structures},
  production:{featureGroups,shellWalls,structureSolids:productionStructureSolids,walkableStructures},
  deleteControls:{semanticBindingsChanged:semanticChanged,blankShellsRestored:structures,structureSolids:deletedStructureSolids},
  perSettlement,failures,
};
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
