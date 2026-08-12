#!/usr/bin/env node
// Cheap, deterministic breadth census for the W1-30 remediation matrix. This enumerates shipped
// populations; it deliberately does not award visual quality or replace live inspection.
'use strict';
import fs from 'node:fs';
import path from 'node:path';

const read=(p)=>JSON.parse(fs.readFileSync(p,'utf8'));
const jsonFiles=(d)=>fs.readdirSync(d).filter(f=>f.endsWith('.json')).sort();
const countBy=(rows,key)=>Object.fromEntries([...new Set(rows.map(r=>r[key]??'missing'))].sort()
  .map(v=>[v,rows.filter(r=>(r[key]??'missing')===v).length]));
const names=(d)=>jsonFiles(d).map(f=>f.replace(/\.json$/,''));

const regions=read('game/data/world/regions.json').regions;
const interiors=jsonFiles('game/data/world/interiors').map(f=>read(path.join('game/data/world/interiors',f)));
const enemies=jsonFiles('game/data/combat/enemies').map(f=>read(path.join('game/data/combat/enemies',f)));
const moves=jsonFiles('game/data/combat/movesets').map(f=>read(path.join('game/data/combat/movesets',f))).filter(r=>r.weapon_id);
const spells=read('game/data/magic/spells.json');
const vfx=read('game/data/magic/vfx.json');
const weather=read('game/data/world/weather.json');
const refs=read('corpus/70-visual/refs/MANIFEST.json').records;
const renderFiles=[...fs.readdirSync('game/src/render').filter(f=>f.endsWith('.js')).map(f=>`game/src/render/${f}`),
  'game/src/world/province.js','game/src/world/signature-geo.js'];
const constructors={};
for(const file of renderFiles){const s=fs.readFileSync(file,'utf8');constructors[file]={
  basic:(s.match(/MeshBasicMaterial/g)||[]).length,pbr:(s.match(/MeshStandardMaterial|MeshPhysicalMaterial|worldMaterial/g)||[]).length,
  box:(s.match(/BoxGeometry/g)||[]).length,cylinder:(s.match(/CylinderGeometry/g)||[]).length,
  organic:(s.match(/SphereGeometry|IcosahedronGeometry|DodecahedronGeometry|TubeGeometry/g)||[]).length};}
const productionAssets=[];
for(const root of ['game']){const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(png|jpe?g|webp|avif|gltf|glb|ktx2)$/i.test(p))productionAssets.push(p);}};walk(root);}

const profiles=['exterior_daylight','exterior_lowlight','interior_darkemissive','character_closeup','combat','material_closeup','ui'];
const referenceProfiles=Object.fromEntries(profiles.map(profile=>[profile,refs.filter(r=>r.profile===profile||r.path.startsWith(`modern/${profile}/`)).length]));
const out={
  schema:'elder-souls/w1-30-visual-populations@1',qualityJudgement:'not awarded by census',
  references:{manifestRecords:refs.length,animatedSequences:refs.filter(r=>r.animated).length,profiles:referenceProfiles},
  world:{regions:regions.map(r=>r.id),canopyShapes:countBy(regions.map(r=>r.props.canopy),'shape'),
    understoreyShapes:countBy(regions.map(r=>r.props.under),'shape'),coverShapes:countBy(regions.map(r=>r.props.cover),'shape'),
    weatherStates:[...new Set(weather.regions.flatMap(r=>r.states.map(s=>s.id)))].sort(),settlements:names('game/data/world/settlements'),
    interiors:{count:interiors.length,kinds:countBy(interiors,'interior_kind'),settlements:countBy(interiors,'settlement'),
      uniqueProps:new Set(interiors.flatMap(r=>r.props||[])).size}},
  characters:{enemyRecords:enemies.length,enemyArchetypes:countBy(enemies,'archetype'),enemyMaterials:countBy(enemies,'material'),
    creatureArtFamilies:['saxhleel','humanoid','beast','undead'],equipmentSets:['reed','chitin','xanmeer'],equipmentSlots:['head','chest','hands','legs','back']},
  weapons:{count:moves.length,classes:countBy(moves,'class')},
  magic:{spells:spells.spells?.length??spells.census?.total??0,vfxBriefs:Object.keys(vfx.per_effect_briefs||{}).sort(),stages:['release','travel','impact','residue']},
  assets:{productionMedia:productionAssets.sort(),count:productionAssets.length},constructors,
};
console.log(JSON.stringify(out,null,2));
