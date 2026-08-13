#!/usr/bin/env node
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../../game/vendor/three/three.module.js';
import {buildSettlementExterior,planSettlement} from '../../game/src/render/exterior.js';

const ROOT=path.resolve(import.meta.dirname,'../..'),read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const list=p=>fs.readdirSync(path.join(ROOT,p)).filter(x=>x.endsWith('.json')).sort();
const interiors={};for(const f of list('game/data/world/interiors')){const d=read(`game/data/world/interiors/${f}`),a=Array.isArray(d)?d:(d.interiors||[d]);for(const x of a)interiors[x.id]=x;}
const wet=new Set(['helstrom','lilmoth','thorn']),failures=[],check=(v,m)=>{if(!v)failures.push(m);},perSettlement=[];
let occupations=0,regionalRouteParts=0,deletedSlabs=0;
const counts=root=>{const out={};root.traverse(o=>{const p='world-art-street:';if(!o.name?.startsWith(p))return;const label=o.name.split(':').at(-1);out[label]=(out[label]||0)+1;});return out;};

for(const f of list('game/data/world/settlements')){
  const doc=read(`game/data/world/settlements/${f}`),plan=planSettlement(doc,interiors),live=new THREE.Group(),deleted=new THREE.Group();
  const summary=buildSettlementExterior(live,plan,()=>0),deletedSummary=buildSettlementExterior(deleted,plan,()=>0,{regionalPublicRealm:false});
  const a=counts(live),b=counts(deleted),route=wet.has(doc.id)?(a['arrival-board']||0):(a['arrival-cobble']||0);
  check(summary.public_realm.regional_route===true,`${doc.id}: regional route not exposed`);
  check(summary.public_realm.approach_occupation===4,`${doc.id}: approach occupation ${summary.public_realm.approach_occupation}/4`);
  const expectedRoute=wet.has(doc.id)?42:350;
  check(route===expectedRoute,`${doc.id}: regional arrival pieces ${route}/${expectedRoute}`);
  check((a['arrival-spine']||0)===0,`${doc.id}: retained ${(a['arrival-spine']||0)} runway slabs`);
  check(deletedSummary.public_realm.regional_route===false,`${doc.id}: delete arm still reports regional route`);
  check((b['arrival-spine']||0)===14,`${doc.id}: delete arm restored ${(b['arrival-spine']||0)}/14 slabs`);
  check((a['approach-workpost']||0)===4&&(a['approach-marker']||0)===4&&(a['approach-vessel']||0)===4&&(a['approach-goods']||0)===8,
    `${doc.id}: approach occupation consumers incomplete`);
  occupations+=summary.public_realm.approach_occupation;regionalRouteParts+=route;deletedSlabs+=b['arrival-spine']||0;
  perSettlement.push({id:doc.id,route:wet.has(doc.id)?'continuous-board-and-lashing':'dense-laid-cobble',arrivalParts:route,
    approachOccupation:summary.public_realm.approach_occupation,causeways:summary.public_realm.causeways,features:summary.public_realm.features});
}
check(perSettlement.length===8,`settlement population ${perSettlement.length}/8`);
const report={schema:'elder-souls/w1-30-settlement-public-realm@1',result:failures.length?'RED':'GREEN',
  population:{settlements:perSettlement.length,approachOccupationClusters:occupations,regionalArrivalParts:regionalRouteParts},
  deleteControl:{formerRunwaySlabsRestored:deletedSlabs,approachOccupationRemoved:occupations},perSettlement,failures};
console.log(JSON.stringify(report,null,2));if(failures.length)process.exit(1);
