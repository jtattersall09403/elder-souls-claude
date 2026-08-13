#!/usr/bin/env node
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../../game/vendor/three/three.module.js';
import {buildSettlementExterior,planSettlement} from '../../game/src/render/exterior.js';

const ROOT=path.resolve(import.meta.dirname,'../..'),read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const list=p=>fs.readdirSync(path.join(ROOT,p)).filter(x=>x.endsWith('.json')).sort();
const interiors={};for(const f of list('game/data/world/interiors')){const d=read(`game/data/world/interiors/${f}`),a=Array.isArray(d)?d:(d.interiors||[d]);for(const x of a)interiors[x.id]=x;}
const failures=[],check=(v,m)=>{if(!v)failures.push(m);},perSettlement=[];
let buildings=0,ordinary=0,relieved=0,modules=0,entryApertures=0,deletedGroups=0;
for(const f of list('game/data/world/settlements')){
  const doc=read(`game/data/world/settlements/${f}`),plan=planSettlement(doc,interiors),live=new THREE.Group(),deleted=new THREE.Group();
  const summary=buildSettlementExterior(live,plan,()=>0),deletedSummary=buildSettlementExterior(deleted,plan,()=>0,{facadeRelief:false});
  const rows=summary.drawn.filter(x=>!x.structure_feature),deletedRows=deletedSummary.drawn.filter(x=>!x.structure_feature);
  buildings+=plan.buildings.length;ordinary+=rows.length;
  const liveGroups=rows.filter(x=>live.getObjectByName(`facade-relief:${x.id}`));
  const deadGroups=deletedRows.filter(x=>deleted.getObjectByName(`facade-relief:${x.id}`));
  for(const row of rows){
    const rec=row.facade_relief;check(rec?.faces===4,`${doc.id}/${row.id}: relief covers ${rec?.faces||0}/4 faces`);
    check(rec?.modules>=20,`${doc.id}/${row.id}: only ${rec?.modules||0} relief modules`);
    modules+=rec?.modules||0;entryApertures+=rec?.entry_apertures||0;
  }
  check(liveGroups.length===rows.length,`${doc.id}: shipping relief groups ${liveGroups.length}/${rows.length}`);
  check(deadGroups.length===0,`${doc.id}: delete arm retained ${deadGroups.length} relief groups`);
  check(summary.facade_relief_buildings===rows.length,`${doc.id}: summary relief population ${summary.facade_relief_buildings}/${rows.length}`);
  check(deletedSummary.facade_relief_buildings===0,`${doc.id}: delete summary retained relief`);
  relieved+=liveGroups.length;deletedGroups+=deadGroups.length;
  perSettlement.push({id:doc.id,buildings:plan.buildings.length,ordinary:rows.length,relieved:liveGroups.length,
    modules:rows.reduce((n,x)=>n+(x.facade_relief?.modules||0),0),entryApertures:rows.reduce((n,x)=>n+(x.facade_relief?.entry_apertures||0),0)});
}
check(perSettlement.length===8,`settlement population ${perSettlement.length}/8`);
check(relieved===ordinary,`relieved building population ${relieved}/${ordinary}`);
check(deletedGroups===0,`delete arm retained ${deletedGroups} groups`);
const report={schema:'elder-souls/w1-30-settlement-facades@1',result:failures.length?'RED':'GREEN',
  population:{settlements:perSettlement.length,buildings,ordinaryBuildings:ordinary,relievedBuildings:relieved,modules,entryApertures},
  deleteControl:{reliefGroups:deletedGroups,removedBuildings:ordinary,removedModules:modules},perSettlement,failures};
console.log(JSON.stringify(report,null,2));if(failures.length)process.exit(1);
