#!/usr/bin/env node
'use strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(`../../${p}`,import.meta.url),'utf8');
const fail=[];
const foundation=read('game/src/render/visual-foundation.js');
const features=['lighting','shadows','materials','atmosphere','vegetation','animation','postprocess','streaming','ao','ibl','sky','vfx','palette','silhouette','architecture','creature','composition','weirdness','mood','flora','artMaterials'];
for(const f of features) if(!new RegExp(`\\b${f}:`).test(foundation)) fail.push(`missing owned path declaration: ${f}`);
// Parse the explicit consumer rows, then prove both the shipping module and its observable exist.
// VISUAL_FEATURES is intentionally excluded: a feature-name key can no longer satisfy this gate.
const table=foundation.slice(foundation.indexOf('export const FEATURE_CONSUMERS'),foundation.indexOf('const FAMILY'));
let consumers=0;
for(const f of features){
 const m=table.match(new RegExp(`\\b${f}: \\[(['\"])([^'\"]+)\\1, (['\"])([^'\"]+)\\3\\]`));
 if(!m){fail.push(`missing real consumer contract: ${f}`);continue;}
 const path=`game/src/${m[2]}`, token=m[4]; let source='';
 try{source=read(path);}catch{fail.push(`${f}: consumer module absent ${path}`);continue;}
 if(!source.includes(token)) fail.push(`${f}: observable '${token}' absent from ${path}`); else consumers++;
}
const boards=JSON.parse(read('game/data/visual/styleboards.json'));
if(boards.regions.length!==13) fail.push(`styleboard regions ${boards.regions.length}/13`);
if(boards.settlements.length!==8) fail.push(`styleboard settlements ${boards.settlements.length}/8`);
for(const row of [...boards.regions,...boards.settlements]) for(const k of ['dominant_materials','contrast_material','silhouette_motif','inexplicable_element','atmosphere_response','forbidden_generic_forms']) if(!row[k]||(Array.isArray(row[k])&&!row[k].length)) fail.push(`${row.id}: empty ${k}`);
for(const p of ['game/src/render/scene.js','game/src/render/interior.js','game/src/world/province.js']) if(!read(p).includes('worldMaterial')) fail.push(`${p}: shared material path bypass`);
for(const [p,t] of [['game/src/engine.js','out.visualStyleboards'],['game/src/render/renderer.js','setVisualStyleboards'],['game/src/world/province.js','material.userData.styleboard']]) if(!read(p).includes(t)) fail.push(`${p}: styleboard has no live production consumer`);
const basic=[];
for(const p of ['game/src/render/scene.js','game/src/render/interior.js','game/src/render/places.js','game/src/render/renderer.js']) {
 const s=read(p); for(const m of s.matchAll(/new THREE\.MeshBasicMaterial/g)) basic.push(`${p}:${s.slice(0,m.index).split('\n').length}`);
}
// Basic is admitted only for visible light bulbs/flames, projected impact residue and UI-like hum labels.
if(basic.length>14) fail.push(`unbounded Basic material sites: ${basic.length}`);
const result={gate:'W1-30-builder-cheap',result:fail.length?'RED':'GREEN',ownedPathsWithVerifiedConsumers:`${consumers}/21`,styleboards:`${boards.regions.length}+${boards.settlements.length}`,sharedMaterialConsumers:3,styleboardConsumerChain:3,boundedBasicSites:basic,failures:fail};
console.log(JSON.stringify(result,null,2)); if(fail.length) process.exit(1);
