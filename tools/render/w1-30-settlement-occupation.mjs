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
  const d=read(`game/data/world/interiors/${f}`),a=Array.isArray(d)?d:(d.interiors||[d]);
  for(const x of a)interiors[x.id]=x;
}
const occupationLabels=new Set([
  'approach-work-mat','approach-workpost','approach-marker','approach-vessel','approach-goods',
  'approach-cart-deck','approach-cart-rail','approach-cart-wheel','approach-cart-handle','approach-cart-load',
  'approach-rack-post','approach-rack-beam','approach-rack-textile','approach-rack-basket',
  'approach-vendor-counter','approach-vendor-post','approach-vendor-awning','approach-vendor-wares',
]);
const failures=[],check=(v,m)=>{if(!v)failures.push(m);},perSettlement=[];
const counts=root=>{
  const out={};
  root.traverse(o=>{
    const p='world-art-street:';
    if(!o.name?.startsWith(p))return;
    const label=o.name.split(':').at(-1);
    out[label]=(out[label]||0)+1;
  });
  return out;
};
const occupationModules=c=>[...occupationLabels].reduce((n,k)=>n+(c[k]||0),0);
let liveClusters=0,liveModules=0,deletedModules=0,retainedRouteParts=0;
for(const f of list('game/data/world/settlements')){
  const doc=read(`game/data/world/settlements/${f}`),plan=planSettlement(doc,interiors);
  const live=new THREE.Group(),deleted=new THREE.Group();
  const summary=buildSettlementExterior(live,plan,()=>0);
  const deleteSummary=buildSettlementExterior(deleted,plan,()=>0,{settlementOccupation:false});
  const a=counts(live),b=counts(deleted),modules=occupationModules(a),removed=modules-occupationModules(b);
  const wet=['helstrom','lilmoth','thorn'].includes(doc.id);
  const liveRoute=wet?(a['arrival-board']||0):(a['arrival-cobble']||0);
  const deletedRoute=wet?(b['arrival-board']||0):(b['arrival-cobble']||0);
  check(summary.public_realm.occupation_enabled===true,`${doc.id}: occupation consumer disabled`);
  check(summary.public_realm.approach_occupation===7,`${doc.id}: clusters ${summary.public_realm.approach_occupation}/7`);
  const expectedMats=wet?21:63,expectedModules=wet?75:117;
  check(modules===expectedModules,`${doc.id}: occupation modules ${modules}/${expectedModules}`);
  check((a['approach-work-mat']||0)===expectedMats,`${doc.id}: founded work mat parts ${(a['approach-work-mat']||0)}/${expectedMats}`);
  check((a['approach-workpost']||0)===2&&(a['approach-marker']||0)===2,`${doc.id}: marker family incomplete`);
  check((a['approach-cart-deck']||0)===2&&(a['approach-cart-wheel']||0)===4,`${doc.id}: cart family incomplete`);
  check((a['approach-rack-beam']||0)===2&&(a['approach-rack-textile']||0)===6,`${doc.id}: rack family incomplete`);
  check((a['approach-vendor-counter']||0)===1&&(a['approach-vendor-wares']||0)===4,`${doc.id}: vendor family incomplete`);
  check(deleteSummary.public_realm.occupation_enabled===false,`${doc.id}: delete arm still enables occupation`);
  check(deleteSummary.public_realm.approach_occupation===0,`${doc.id}: delete arm retained clusters`);
  check(occupationModules(b)===0,`${doc.id}: delete arm retained occupation modules`);
  check(liveRoute===deletedRoute,`${doc.id}: occupation delete arm changed route population`);
  liveClusters+=summary.public_realm.approach_occupation;liveModules+=modules;deletedModules+=removed;retainedRouteParts+=deletedRoute;
  perSettlement.push({id:doc.id,clusters:summary.public_realm.approach_occupation,modules,
    families:{markers:a['approach-marker']||0,carts:a['approach-cart-deck']||0,racks:a['approach-rack-beam']||0,vendors:a['approach-vendor-counter']||0},
    routePartsAfterDelete:deletedRoute});
}
check(perSettlement.length===8,`settlement population ${perSettlement.length}/8`);
check(liveClusters===56,`occupied clusters ${liveClusters}/56`);
check(liveModules===810,`occupation modules ${liveModules}/810`);
check(deletedModules===810,`delete arm removed ${deletedModules}/810 modules`);
check(retainedRouteParts===1876,`delete arm route population ${retainedRouteParts}/1876`);
const report={schema:'elder-souls/w1-30-settlement-occupation@1',result:failures.length?'RED':'GREEN',
  population:{settlements:perSettlement.length,clusters:liveClusters,modules:liveModules,families:['marker','handcart','drying-rack','vendor-bay']},
  deleteControl:{occupationModulesRemoved:deletedModules,regionalRoutePartsRetained:retainedRouteParts},perSettlement,failures};
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
