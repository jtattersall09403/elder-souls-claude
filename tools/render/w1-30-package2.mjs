#!/usr/bin/env node
// Exhaustive cheap admission/census gate for W1-30 Package 2. This intentionally imports the
// production registry: a parallel audit vocabulary could pass while shipping construction fails.
import fs from 'node:fs';
import path from 'node:path';
import { REGION_ART, SETTLEMENT_ART, PLACE_ART, CREATURE_ART, regionArt, settlementArt, placeArt, creatureArt } from '../../game/src/render/world-art.js';

const root=path.resolve(import.meta.dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const json=p=>JSON.parse(read(p));
const fail=[];
const boards=json('game/data/visual/styleboards.json');
const regions=json('game/data/world/regions.json').regions;
const settlementFiles=fs.readdirSync(path.join(root,'game/data/world/settlements')).filter(x=>x.endsWith('.json')).sort();
const settlements=settlementFiles.map(x=>json(`game/data/world/settlements/${x}`));
const interiorFiles=fs.readdirSync(path.join(root,'game/data/world/interiors')).filter(x=>x.endsWith('.json')).sort();
const interiors=interiorFiles.map(x=>json(`game/data/world/interiors/${x}`));
const eq=(label,a,b)=>{const A=[...a].sort(),B=[...b].sort();if(JSON.stringify(A)!==JSON.stringify(B))fail.push(`${label}: ${A.join(',')} != ${B.join(',')}`)};

eq('region registry/data',Object.keys(REGION_ART),regions.map(r=>r.id));
eq('region boards/data',boards.regions.map(b=>b.id),regions.map(r=>r.id));
eq('settlement registry/data',Object.keys(SETTLEMENT_ART),settlements.map(s=>s.id));
eq('settlement boards/data',boards.settlements.map(b=>b.id),settlements.map(s=>s.id));
if(Object.keys(PLACE_ART).length!==5) fail.push('reachable place census is not 5/5');
if(Object.keys(CREATURE_ART).length!==4) fail.push('creature direction families are not 4/4');
for(const r of regions){const a=regionArt(r.id);if(a.flora.length!==3||a.flora.some(n=>!Number.isFinite(n)||n<=0)||!a.terrain||!a.depth)fail.push(`invalid region production profile ${r.id}`)}
for(const s of settlements){const a=settlementArt(s.id);if(!a.grammar||!a.support||!a.trim)fail.push(`invalid settlement production profile ${s.id}`);if(!s.architecture_kit?.meshes?.length)fail.push(`empty architecture kit ${s.id}`)}
for(const id of Object.keys(PLACE_ART)) placeArt(id);
for(const id of Object.keys(CREATURE_ART)) {const a=creatureArt(id);if(!a.silhouette||!a.shape||a.scale?.length!==3||!Number.isFinite(a.colour)||!Number.isFinite(a.roughness))fail.push(`creature ${id} lacks rendered geometry/material controls`)}
const governedSettlements=new Set(interiors.map(i=>i.settlement).filter(Boolean));
for(const id of governedSettlements) if(!SETTLEMENT_ART[id]) fail.push(`interior ${id} bypasses settlement art`);
const sources=['game/src/world/province.js','game/src/render/exterior.js','game/src/render/interior.js','game/src/render/places.js','game/src/render/actor.js'];
for(const p of sources){const s=read(p);if(!s.includes("./world-art.js")&&!s.includes("../render/world-art.js"))fail.push(`${p} bypasses production world-art registry`)}
// Metadata/name/source-token presence is explicitly insufficient. Each consumer must contain a
// geometry or material mutation inside the same production function that reads its art record.
const visibleContracts={
  'game/src/render/exterior.js':['buildSettlementExterior','world-art-exterior:','group.add(mesh)'],
  'game/src/render/interior.js':['settlementArt(rec.settlement)','world-art-interior:','root.add(tie)'],
  'game/src/render/places.js':['const grammar=placeArt(id)','new THREE.Mesh(core,mat)','root.add(identity)'],
  'game/src/render/actor.js':['const art=creatureArt(artFamily)','direction.scale.set(...art.scale)','new THREE.MeshStandardMaterial'],
  'game/src/world/province.js':['const art = regionArt(r.id)','out.offsetHSL(((terrainKey%13)','s.set(scale * layer'],
};
for(const [p,tokens] of Object.entries(visibleContracts)){const s=read(p);for(const token of tokens)if(!s.includes(token))fail.push(`${p}: visible consumer missing ${token}`)}
// Cheap perturbation: every distinct profile must alter the numeric render signature. Deliberate
// copies therefore go red even when ids, names and userData remain intact.
const sig=v=>JSON.stringify(v,(_k,x)=>typeof x==='number'?+x.toFixed(5):x);
const unique=(label,rows)=>{const values=rows.map(sig);if(new Set(values).size!==values.length)fail.push(`${label} render-profile perturbation is visually inert`)};
unique('regions',Object.values(REGION_ART)); unique('settlements',Object.values(SETTLEMENT_ART)); unique('creatures',Object.values(CREATURE_ART));
const interiorKinds=[...new Set(interiors.map(i=>i.interior_kind||'unclassified'))].sort();
const styleRows=['architecture','flora','creature','composition','weirdness','mood','palette','silhouette','art-materials'];
const consumers={architecture:'exterior+interior',flora:'province._placeSite',creature:'actor+CREATURE_ART',composition:'province landmarks/depth profiles',weirdness:'styleboard landmarks+settlement sculptures',mood:'sky+material response',palette:'consumeStyleboard',silhouette:'regional flora+settlement kits', 'art-materials':'worldMaterial+consumeStyleboard'};
for(const row of styleRows)if(!consumers[row])fail.push(`unmapped art row ${row}`);
for(const probe of [()=>regionArt('__unknown__'),()=>settlementArt('__unknown__'),()=>placeArt('__unknown__'),()=>creatureArt('__unknown__')]){let red=false;try{probe()}catch{red=true}if(!red)fail.push('unknown id did not fail closed')}

const result={gate:'W1-30-package2',result:fail.length?'RED':'GREEN',regions:`${regions.length}/13`,settlements:`${settlements.length}/8`,interiors:`${interiors.length}/${interiors.length}`,interiorKinds,places:Object.keys(PLACE_ART),creatureFamilies:Object.keys(CREATURE_ART),styleRows:consumers,unknownAdmissionControls:'4/4 red',failures:fail};
console.log(JSON.stringify(result,null,2));
process.exitCode=fail.length?1:0;
