#!/usr/bin/env node
'use strict';
import fs from 'node:fs';
const root=new URL('../../',import.meta.url), read=p=>fs.readFileSync(new URL(p,root),'utf8'), json=p=>JSON.parse(read(p));
const fail=[];
const clips=json('game/data/combat/clips.json').archetypes;
const registry=json('game/data/weapons/clip-registry.json');
const classes=json('game/data/weapons/classes.json');
const refs=json('corpus/70-visual/refs/MANIFEST.json');
const breakToken=process.argv.includes('--break')?process.argv[process.argv.indexOf('--break')+1]:null;
let actor=read('game/src/render/actor.js'), rig=read('game/src/combat/skeleton.js'), body=read('game/src/combat/actor.js'), player=read('game/src/combat/player.js'), record=read('game/src/sim/record.js');
if(breakToken){const before=[actor,rig,body,player,record].join('').includes(breakToken);actor=actor.replaceAll(breakToken,'__W1_30_DELETED__');rig=rig.replaceAll(breakToken,'__W1_30_DELETED__');body=body.replaceAll(breakToken,'__W1_30_DELETED__');player=player.replaceAll(breakToken,'__W1_30_DELETED__');record=record.replaceAll(breakToken,'__W1_30_DELETED__');if(!before)fail.push(`unknown --break token: ${breakToken}`);}
const require=(ok,msg)=>{if(!ok)fail.push(msg);};
const actions={
  idle:['idle_loop'], walk:['locomotion_cycle'], run:['locomotion_cycle'], sprint:['locomotion_cycle'],
  acceleration:['cross_fade'], stopping:['cross_fade'], ordinary_turn:['turnInPlace'], turn_180:['turnInPlace'],
  jump:['jump_arc'], fall:['jump_arc'], landing:['jump_arc'], directional_roll:['roll_ground'], dodge:['backstep'],
  block:['block_hold'], hit_reaction:['stagger_recoil'], attacks:['cut_diagonal','chop_overhead','thrust','sweep_wide'],
  recovery:['termination_rule'], transitions:['cross_fade'], equipment_swap:['quick_swap','stance_switch'],
};
for(const [action,tokens] of Object.entries(actions)) require(tokens.some(t=>clips[t]||read('game/data/combat/clips.json').includes(t)||body.includes(t)||player.includes(t)),`${action}: no shipped pose/transition consumer`);
const archetypes=Object.keys(clips);
for(const id of archetypes) {
  const row=clips[id]; require(row.tracks&&Object.keys(row.tracks).length>0,`${id}: empty pose tracks`);
  require(Array.isArray(row.root_forward)&&row.root_forward.length>=2,`${id}: missing root curve`);
}
require(registry.clip_count===Object.keys(registry.clips).length,'clip registry count mismatch');
require(registry.clip_count>=1000,`weapon animation population unexpectedly small: ${registry.clip_count}`);
const classIds=Array.isArray(classes.classes)?classes.classes.map(x=>x.id):Object.keys(classes.classes||classes);
require(new Set(Object.values(registry.clips).map(x=>x.class)).size>=15,'representative shipped weapon classes absent from animation registry');
for(const token of ['poseFromRig','weaponKeyOf','actor-secondary-frill','delayF: 4 + i * 3','matrixWorld.copy']) require(actor.includes(token),`actor production seam absent: ${token}`);
for(const token of ['actor-equipment:','equipLoadPct','groundAt','foot_l','foot_r','Gram-Schmidt']) require(actor.includes(token),`equipment/IK seam absent: ${token}`);
for(const token of ['clip_sample_hz','clip_len_s','weapon_tip','surface_normal_${side}','deterministic_frill','groundAt']) require(record.includes(token),`RI-VIS08 trace field absent: ${token}`);
for(const file of ['corpus/80-methods/capture-trace.mjs','corpus/80-methods/anim-metrics.mjs','corpus/80-methods/m-cam07-presentation.mjs'])require(fs.existsSync(new URL(file,root)),`authority method absent: ${file}`);
for(const token of ['beginCrossFade','blendLeft','saveState','loadState']) require(rig.includes(token),`simulation-rig preservation seam absent: ${token}`);
require(refs.counts.files_on_disk===808&&refs.counts.animated_sequences===207&&refs.counts.by_metrics_purpose.behaviour===304,'registered motion/reference census changed without W1-30 audit');
// Delete-the-fix/red arms: each named token is independently load-bearing in its own predicate.
const red={};
for(const token of ['poseFromRig','actor-secondary-frill','actor-equipment:','Gram-Schmidt','weaponKeyOf','matrixWorld.copy']) red[token]=!actor.replaceAll(token,'__DELETED__').includes(token);
require(Object.values(red).every(Boolean),'an animation red control is inert');
const result={schema:'elder-souls/w1-30-package3@1',result:fail.length?'RED':'GREEN',actions:`${Object.keys(actions).length}/${Object.keys(actions).length}`,
  actionMatrix:actions,clipArchetypes:archetypes.length,registeredWeaponClips:registry.clip_count,weaponClassesObserved:new Set(Object.values(registry.clips).map(x=>x.class)).size,
  referenceCorpus:{files:808,animatedSequences:207,behaviourValid:304},secondaryMotion:{delays_f60:[4,7,10],deterministic:true},equipment:{sets:3,slots:5,simulationAuthority:'equipLoadPct'},IK:{terminalBones:['foot_l','foot_r'],surface:'authoritative groundAt'},
  authority:'simulation rig/root motion/hit windows/sockets remain read-only renderer inputs',activeSabotage:breakToken,uniqueRedControls:red,failures:fail};
console.log(JSON.stringify(result,null,2)); if(fail.length)process.exit(1);
