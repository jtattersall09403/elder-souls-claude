#!/usr/bin/env node
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../../game/vendor/three/three.module.js';
import {buildSettlementExterior,planSettlement,settlementApproach} from '../../game/src/render/exterior.js';

const ROOT=path.resolve(import.meta.dirname,'../..'),read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const list=p=>fs.readdirSync(path.join(ROOT,p)).filter(x=>x.endsWith('.json')).sort();
const interiors={};for(const f of list('game/data/world/interiors')){const d=read(`game/data/world/interiors/${f}`),a=Array.isArray(d)?d:(d.interiors||[d]);for(const x of a)interiors[x.id]=x;}
const wet=new Set(['helstrom','lilmoth','thorn']),failures=[],check=(v,m)=>{if(!v)failures.push(m);},perSettlement=[];
let occupations=0,regionalRouteParts=0,deletedSlabs=0,clearApproaches=0,legacyCollisions=0;
const counts=root=>{const out={};root.traverse(o=>{const p='world-art-street:';if(!o.name?.startsWith(p))return;const label=o.name.split(':').at(-1);out[label]=(out[label]||0)+1;});return out;};

for(const f of list('game/data/world/settlements')){
  const doc=read(`game/data/world/settlements/${f}`),plan=planSettlement(doc,interiors),live=new THREE.Group(),deleted=new THREE.Group();
  const summary=buildSettlementExterior(live,plan,()=>0),deletedSummary=buildSettlementExterior(deleted,plan,()=>0,{regionalPublicRealm:false});
  const approach=settlementApproach(plan),legacyApproach=settlementApproach(plan,false),builtApproach=summary.public_realm.approach;
  const a=counts(live),b=counts(deleted),route=wet.has(doc.id)?(a['arrival-board']||0):(a['arrival-cobble']||0);
  check(summary.public_realm.regional_route===true,`${doc.id}: regional route not exposed`);
  check(summary.public_realm.approach_occupation===7,`${doc.id}: approach occupation ${summary.public_realm.approach_occupation}/7`);
  const expectedRoute=wet.has(doc.id)?42:350;
  check(route===expectedRoute,`${doc.id}: regional arrival pieces ${route}/${expectedRoute}`);
  check((a['arrival-spine']||0)===0,`${doc.id}: retained ${(a['arrival-spine']||0)} runway slabs`);
  check(deletedSummary.public_realm.regional_route===false,`${doc.id}: delete arm still reports regional route`);
  check((b['arrival-spine']||0)===14,`${doc.id}: delete arm restored ${(b['arrival-spine']||0)}/14 slabs`);
  check((a['approach-work-mat']||0)===7&&(a['approach-workpost']||0)===2&&(a['approach-marker']||0)===2&&
    (a['approach-cart-deck']||0)===2&&(a['approach-rack-beam']||0)===2&&(a['approach-vendor-counter']||0)===1,
    `${doc.id}: approach occupation consumers incomplete`);
  check(approach.focus_clearance>=2,`${doc.id}: civic focus clearance ${approach.focus_clearance}m`);
  check(approach.clearance>=.15,`${doc.id}: route clearance ${approach.clearance}m`);
  check(Math.abs(approach.yaw-Math.atan2(approach.direction[0],approach.direction[1]))<1e-9,`${doc.id}: route yaw is not tangent-aligned`);
  check(JSON.stringify(builtApproach)===JSON.stringify(approach),`${doc.id}: shipping summary does not consume clearance approach`);
  occupations+=summary.public_realm.approach_occupation;regionalRouteParts+=route;deletedSlabs+=b['arrival-spine']||0;
  if(approach.clearance>=.15)clearApproaches++;if(legacyApproach.clearance<0)legacyCollisions++;
  perSettlement.push({id:doc.id,route:wet.has(doc.id)?'continuous-board-and-lashing':'dense-laid-cobble',arrivalParts:route,
    approachOccupation:summary.public_realm.approach_occupation,causeways:summary.public_realm.causeways,features:summary.public_realm.features,
    approach:{focus:approach.focus,focusOffset:approach.focus_offset,focusClearance:approach.focus_clearance,bearingCandidate:approach.candidate,bend:approach.bend,clearance:approach.clearance},legacyClearance:legacyApproach.clearance});
}
check(perSettlement.length===8,`settlement population ${perSettlement.length}/8`);
check(clearApproaches===8,`clear approach population ${clearApproaches}/8`);
check(legacyCollisions===6,`fixed southwest delete arm collisions ${legacyCollisions}/6`);
const report={schema:'elder-souls/w1-30-settlement-public-realm@1',result:failures.length?'RED':'GREEN',
  population:{settlements:perSettlement.length,approachOccupationClusters:occupations,regionalArrivalParts:regionalRouteParts,clearApproaches},
  deleteControl:{formerRunwaySlabsRestored:deletedSlabs,approachOccupationRemoved:occupations,fixedSouthwestCollisions:legacyCollisions},perSettlement,failures};
console.log(JSON.stringify(report,null,2));if(failures.length)process.exit(1);
