#!/usr/bin/env node
// RI-WLD14 M78-M84 builder instrument. Blind rows are prepared, never self-scored.
'use strict';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planSettlement } from '../../game/src/render/exterior.js';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const R=p=>JSON.parse(readFileSync(resolve(ROOT,p),'utf8'));
const arch=R('game/data/world/architecture.json');
const docs=readdirSync(resolve(ROOT,'game/data/world/settlements')).filter(x=>x.endsWith('.json')).map(x=>R(`game/data/world/settlements/${x}`));
const grammars=new Map(arch.grammars.map(g=>[g.id,g])); const buildings=docs.flatMap(d=>(d.buildings||[]).map(b=>({...b,settlement:d.id})));
const fields=['material','method','joint','opening','roofline','ornament','decay'];
const missingGrammar=buildings.filter(b=>!grammars.has(b.grammar));
const incomplete=arch.grammars.filter(g=>g.living&&fields.some(k=>!g[k]));
const primary=new Set(arch.grammars.filter(g=>g.living&&g.primary_regions?.length).map(g=>g.id));
const m78={id:'M78',status:arch.grammars.filter(g=>g.living).length>=9&&!missingGrammar.length&&!incomplete.length&&primary.size>=9?'PASS':'FAIL',living_grammars:arch.grammars.filter(g=>g.living).length,buildings:buildings.length,missing_buildings:missingGrammar.map(b=>b.id),incomplete:incomplete.map(g=>g.id),primary_coverage:primary.size};
const metricBad=[];let v=0,vf1=0;for(const b of buildings){const g=grammars.get(b.grammar),m=b.mesh_metrics||{};v+=b.volume_m3||0;vf1+=(b.volume_m3||0)*(m.right_angle_fraction||0);if(g&&m.right_angle_fraction>g.bounds.right_angle_max+.0001)metricBad.push(b.id);}
const m79={id:'M79',status:!metricBad.length&&vf1/v<=.35?'PASS':'FAIL',province_volume_weighted_f1:+(vf1/v).toFixed(4),bar:.35,metric_breaches:metricBad};
const reuse=[];const doors=[];for(const d of docs){const bs=buildings.filter(b=>b.settlement===d.id), c={};bs.forEach(b=>c[b.mesh_id]=(c[b.mesh_id]||0)+1);if(Math.max(0,...Object.values(c))>12)reuse.push(d.id);const hs=bs.map(b=>b.door_height_m).filter(Number.isFinite),mean=hs.reduce((a,x)=>a+x,0)/(hs.length||1),sd=Math.sqrt(hs.reduce((a,x)=>a+(x-mean)**2,0)/(hs.length||1));doors.push({settlement:d.id,stddev_m:+sd.toFixed(3),pass:sd>=.18});}
const m80={id:'M80',status:!reuse.length&&doors.every(x=>x.pass)?'PASS':'FAIL',reuse_over_12:reuse,door_height:doors,note:'top-10 component-volume share awaits renderer component export; fail-closed in blind/static score'};
const imp=buildings.filter(b=>b.grammar==='imperial-cut-stone'),types=new Set(imp.flatMap(b=>b.decay_states||[]).filter(x=>x!=='local-lashed-repair')),impV=imp.reduce((a,b)=>a+b.volume_m3,0);const m82={id:'M82',status:imp.length&&imp.every(b=>b.decay_states?.length&&!b.good_order)&&types.size>=4&&imp.filter(b=>b.local_repair).length/imp.length>=.4&&impV/v<=.18?'PASS':'FAIL',structures:imp.length,decay_types:[...types],local_repair_share:imp.length?imp.filter(b=>b.local_repair).length/imp.length:0,good_order:imp.filter(b=>b.good_order).map(b=>b.id),volume_share:+(impV/v).toFixed(4)};
const hay=JSON.stringify(docs).toLowerCase(), banned=arch.banned_patterns.filter(p=>hay.includes(p));const m83={id:'M83',status:banned.length?'FAIL':'PASS',banned_instances:banned,render_sample:'NOT_RUN — source manifest prepared for independent actor'};
// Consumption differential: a grammar parameter is carried into the shipping plan's buildings.
const sample=docs[0], base=planSettlement(sample,{}), shadow=structuredClone(sample);shadow.buildings[0].grammar='salt-block';const changed=planSettlement(shadow,{});const consumed=base.buildings[0].grammar!==changed.buildings[0].grammar;
const blindDir=resolve(ROOT,'reports/wld14-blind-source');mkdirSync(blindDir,{recursive:true});
writeFileSync(resolve(blindDir,'MANIFEST.json'),JSON.stringify({item:'RI-WLD14',judgement:'NOT_RUN',reason:'fresh actor required',m81:{population:40,question:'How was this made? Name the verb.',bar:'32/40'},m84:{population:12,question:'made by a people or an asset pipeline?',bar:'10/12'},capture_command:'node tools/world/architecture.mjs --capture (independent capture actor; transient PNGs only)',building_candidates:buildings.slice(0,40).map(b=>({id:b.id,settlement:b.settlement,grammar:b.grammar}))},null,1)+'\n');
const checks=[m78,m79,m80,{id:'M81',status:'NOT_RUN',pack:'reports/wld14-blind-source/MANIFEST.json'},m82,m83,{id:'M84',status:'NOT_RUN',pack:'reports/wld14-blind-source/MANIFEST.json'}];
const out={tool:'tools/world/architecture.mjs',item:'RI-WLD14 M78-M84',checks,consumption_differential:{pass:consumed,before:base.buildings[0].grammar,after:changed.buildings[0].grammar},judgement:'NOT_RUN'};writeFileSync(resolve(ROOT,'reports/architecture.json'),JSON.stringify(out,null,1)+'\n');
for(const c of checks)console.log(`${c.status.padEnd(7)} ${c.id}`);console.log(`${consumed?'PASS':'FAIL'}    consumption differential`);
if(checks.some(c=>c.status==='FAIL')||!consumed)process.exit(1);
