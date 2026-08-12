#!/usr/bin/env node
// Frame-exact W1-30 moving-output ledger. PNG sequences are authoritative; MP4 files are
// transient review derivatives only and are never used for pixel metrics.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {launchGame} from '../lib/browser.mjs';
import {launchArgAudit,readRenderer,t1Verdict} from '../lib/absence.mjs';
import {parseArgs,ensureDir,REPO_ROOT} from '../lib/cli.mjs';

const args=parseArgs();
const out=path.resolve(String(args.out||'/tmp/w1-30-motion-proof'));
ensureDir(out);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const roster=JSON.parse(fs.readFileSync(path.join(REPO_ROOT,'game/data/weapons/roster.json'),'utf8'));
const classes=JSON.parse(fs.readFileSync(path.join(REPO_ROOT,'game/data/weapons/classes.json'),'utf8')).classes;
const reps=[];
for(const cls of Object.keys(classes)){
  const weapon=roster.weapons.find(w=>w.class===cls&&w.baseline)||roster.weapons.find(w=>w.class===cls);
  if(!weapon)throw new Error(`no shipped representative for weapon class ${cls}`);
  reps.push({cls,weapon:weapon.id,total:Number(classes[cls].r1_total||90)});
}

const tap=(button,f=2)=>[{f,press:[button]},{f:f+2,release:[button]}];
const move=(v,from,to)=>[{f:from,move:v},{f:to,move:[0,0]}];
const scenarios=[
  {id:'idle-rear',label:'idle variant and deterministic secondary motion',frames:90,camera:'rear',script:[]},
  {id:'idle-orbit',label:'continuous close orbit proving head, armour and body attachment continuity',frames:120,camera:'orbit',script:[]},
  {id:'walk',label:'walk, acceleration and full stop',frames:150,camera:'rear',script:move([0,.45],12,118)},
  {id:'run',label:'run, acceleration and full stop',frames:150,camera:'rear',script:move([0,.90],12,118)},
  {id:'sprint',label:'sprint, acceleration and full stop',frames:170,camera:'rear',script:[...move([0,1],12,132),{f:12,press:['sprint']},{f:132,release:['sprint']}]},
  {id:'ordinary-turn',label:'ordinary directional turn',frames:120,camera:'rear',script:[{f:8,move:[0,.75]},{f:45,move:[.75,.35]},{f:92,move:[0,0]}]},
  {id:'turn-180',label:'full 180 degree turn and recovery',frames:150,camera:'rear',script:[{f:8,move:[0,.75]},{f:55,move:[0,-.75]},{f:115,move:[0,0]}]},
  {id:'jump-fall-land',label:'jump, fall, landing and transition',frames:120,camera:'side',script:tap('jump',10)},
  {id:'roll-forward',label:'forward directional roll and recovery',frames:100,camera:'rear',script:[{f:8,move:[0,1]},...tap('roll',10),{f:72,move:[0,0]}]},
  {id:'roll-left',label:'left directional roll and recovery',frames:100,camera:'rear',script:[{f:8,move:[-1,0]},...tap('roll',10),{f:72,move:[0,0]}]},
  {id:'roll-right',label:'right directional roll and recovery',frames:100,camera:'rear',script:[{f:8,move:[1,0]},...tap('roll',10),{f:72,move:[0,0]}]},
  {id:'dodge-backstep',label:'backstep dodge and recovery',frames:90,camera:'rear',script:tap('roll',10)},
  {id:'block',label:'block raise, hold and release',frames:110,camera:'front',script:[{f:10,press:['block']},{f:78,release:['block']}]},
  {id:'hit-reaction',label:'scripted physical hit and directional reaction',frames:110,camera:'front',script:[],hook:{frame:15,method:'damagePlayer',args:[16,{stagger:true,kind:'physical'}]}},
  {id:'equipment-swap',label:'right and left equipment swaps with attachment continuity',frames:150,camera:'rear',script:[...tap('swap_right',10),...tap('swap_left',75)]},
  {id:'slope-stair-ik',label:'walked stair/slope foot IK',frames:170,camera:'gameplay',state:'cam_stair',script:move([0,.55],10,145)},
  {id:'world-camera-motion',label:'ordinary exterior play with character and gameplay-camera motion',frames:180,camera:'gameplay',state:'default',script:[{f:8,move:[.25,.82]},{f:110,move:[-.35,.72]},{f:158,move:[0,0]}]},
  {id:'stream-boundary-motion',label:'native exterior walk across the x=3900 streamed tile boundary',frames:240,camera:'gameplay',state:'town-thorn',teleport:[3884,871.58],script:move([1,0],8,218)},
  {id:'creature-beast-motion',label:'shipped slitherfang family articulated lunge presentation',frames:150,camera:'subject-beast',state:'arena_flat',spawn:{id:'beast_slitherfang',x:0,z:3.8,as:'creature-beast'},enemyScript:[{f:18,move:'lunge'}],script:[]},
  {id:'creature-undead-motion',label:'shipped drowned family articulated chop presentation',frames:190,camera:'subject-undead',state:'arena_flat',spawn:{id:'drowned_lesser',x:0,z:3.8,as:'creature-undead'},enemyScript:[{f:18,move:'chop'}],script:[]},
];
for(const r of reps)scenarios.push({id:`attack-${r.cls.toLowerCase()}`,label:`${r.cls} representative light attack through recovery`,frames:Math.max(90,r.total+24),camera:'rear',weapon:r.weapon,weaponClass:r.cls,script:tap('light',10)});

const requested=String(args.only||'').split(',').map(x=>x.trim()).filter(Boolean);
const selected=requested.length?scenarios.filter(s=>requested.some(q=>s.id===q||s.id.startsWith(q))):scenarios;
if(!selected.length)throw new Error(`--only selected no scenarios; known: ${scenarios.map(s=>s.id).join(', ')}`);

const handle=await launchGame({...args,width:Number(args.width||1280),height:Number(args.height||720),timeout:Number(args.timeout||240000)});
const report={schema:'elder-souls/w1-30-motion-proof@1',result:'RED',seed:Number(args.seed||3030),playbackRate:'60 f@60',nativeWindow:[Number(args.width||1280),Number(args.height||720)],canvas:null,browser:null,hardware:null,encoder:null,scenarios:[],pageErrors:handle.errors};
const updateCamera=async mode=>{
  if(mode==='gameplay')return;
  const p=(await handle.h('snapshot')).player.pos;
  if(mode==='subject-beast')return handle.h('camera',{pos:[2.55,1.18,.30],look:[0,.66,3.8],fov:48,mode:'free'});
  if(mode==='subject-undead')return handle.h('camera',{pos:[3.15,1.58,-.15],look:[0,.94,3.8],fov:52,mode:'free'});
  const poses={rear:{pos:[p[0]+2.55,p[1]+1.72,p[2]-3.35],look:[p[0],p[1]+1.05,p[2]+.08],fov:48},front:{pos:[p[0]-2.45,p[1]+1.68,p[2]+3.25],look:[p[0],p[1]+1.04,p[2]],fov:48},side:{pos:[p[0]+3.35,p[1]+1.64,p[2]+.25],look:[p[0],p[1]+.98,p[2]+.12],fov:49}};
  await handle.h('camera',{...poses[mode],mode:'free'});
};
const orbitCamera=async(frame,total)=>{
  const p=(await handle.h('snapshot')).player.pos,a=-.65+(frame/Math.max(1,total-1))*1.30,r=3.55;
  await handle.h('camera',{pos:[p[0]+Math.sin(a)*r,p[1]+1.74,p[2]-Math.cos(a)*r],look:[p[0],p[1]+1.02,p[2]+.05],fov:47,mode:'free'});
};
try{
  await handle.h('ready');await handle.h('setSeed',report.seed);await handle.h('setRenderRate',0);await handle.h('setUIVisible',false);
  const renderer=await readRenderer(handle),launch=launchArgAudit(handle.chromiumArgs),attestation=t1Verdict(renderer.unmaskedRenderer||renderer.renderer||'','desktop-discrete',{launch,pageRenderer:renderer.unmaskedRenderer||renderer.renderer||''});
  report.browser={version:handle.browser.version(),chromiumArgs:handle.chromiumArgs};
  report.hardware={requested:handle.hardwareGpuRequested,renderer,launch,attestation};
  for(const spec of selected){
    const dir=path.join(out,spec.id);ensureDir(dir);
    await handle.h('loadState',spec.state||'arena_flat');await handle.h('setUIVisible',false);await handle.h('setWeather','clear');
    if(spec.teleport)await handle.h('teleport',spec.teleport[0],spec.teleport[1],{});
    if(spec.spawn)await handle.h('spawn',spec.spawn.id,spec.spawn.x,spec.spawn.z,{as:spec.spawn.as,yaw:180});
    if(spec.enemyScript)await handle.h('queueEnemyScript',spec.spawn.as,spec.enemyScript);
    if(spec.weapon)await handle.h('setLoadout',{weapon:spec.weapon});
    await handle.h('stepFrames',8);if(spec.camera==='gameplay')await handle.h('camera',null);else await updateCamera(spec.camera);
    await handle.h('queueInputs',spec.script);
    const start=await handle.h('getFrame'),frames=[];let attachmentMax=0,bodyOpaque=true,staticDirectionEmpty=true;
    for(let i=0;i<spec.frames;i++){
      if(spec.hook&&i===spec.hook.frame)await handle.h(spec.hook.method,...spec.hook.args);
      await handle.h('stepFrames',1);if(spec.camera==='orbit')await orbitCamera(i,spec.frames);else if(spec.camera!=='gameplay')await updateCamera(spec.camera);await handle.h('renderFrame');
      const data=String(await handle.h('screenshot')).replace(/^data:image\/png;base64,/,'');const b=Buffer.from(data,'base64');
      const filename=`f${String(i).padStart(4,'0')}.png`;fs.writeFileSync(path.join(dir,filename),b);
      const drawn=await handle.h('getDrawnGeometry'),combat=await handle.h('getCombatState');
      const subjectId=spec.spawn?`enemy:${spec.spawn.as}`:'player';
      const actor=drawn.actors.find(a=>a.id===subjectId)||{};
      const visibleSurfaces=[...(actor.body_materials||[]),...(actor.presentation||[])].filter(m=>m.visible);
      bodyOpaque=bodyOpaque&&visibleSurfaces.length>0&&visibleSurfaces.every(m=>!m.transparent&&m.opacity===1&&m.depthWrite);
      staticDirectionEmpty=staticDirectionEmpty&&actor.static_direction_children===0;
      if(actor.tip_vs_socket_b_mm!==undefined)attachmentMax=Math.max(attachmentMax,actor.tip_vs_socket_b_mm);
      const subjectCombat=spec.spawn?(combat.enemies||[]).find(e=>e.id===spec.spawn.as):combat.player;
      frames.push({i,simFrame:await handle.h('getFrame'),sha256:sha(b),subject:subjectId,state:subjectCombat&&subjectCombat.state||null,move:subjectCombat&&subjectCombat.move?(typeof subjectCombat.move==='string'?subjectCombat.move:subjectCombat.move.id):null,animFrame:subjectCombat&&subjectCombat.anim_frame||null,bones:actor.bones||null,presentation:actor.presentation||[],bodyMaterials:actor.body_materials||[],staticDirectionChildren:actor.static_direction_children,tipVsSocketBmm:actor.tip_vs_socket_b_mm??null});
    }
    const tracePath=path.join(dir,'frames.json');fs.writeFileSync(tracePath,JSON.stringify({schema:'elder-souls/w1-30-motion-frames@1',id:spec.id,seed:report.seed,startFrame:start,playbackRate:'60 f@60',camera:spec.camera,input:spec.script,frames},null,2)+'\n');
    const video=path.join(out,`${spec.id}.mp4`),ffargs=['-y','-loglevel','error','-framerate','60','-i',path.join(dir,'f%04d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p',video];
    const enc=spawnSync('ffmpeg',ffargs,{encoding:'utf8'});if(enc.status!==0)throw new Error(`ffmpeg ${spec.id}: ${enc.stderr}`);
    const row={id:spec.id,label:spec.label,state:spec.state||'arena_flat',weapon:spec.weapon||null,weaponClass:spec.weaponClass||null,frameRange:[start+1,start+spec.frames],frameCount:spec.frames,camera:spec.camera,input:spec.script,trace:tracePath,traceSha256:sha(fs.readFileSync(tracePath)),video,videoSha256:sha(fs.readFileSync(video)),encoderCommand:['ffmpeg',...ffargs].join(' '),controls:{bodyOpaque,staticDirectionEmpty,attachmentMaxMm:+attachmentMax.toFixed(4),attachmentPass:attachmentMax<=20}};
    report.scenarios.push(row);fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify(report,null,2)+'\n');console.log(`${spec.id}: ${spec.frames}f video=${row.videoSha256.slice(0,12)} opaque=${bodyOpaque} attachment=${row.controls.attachmentMaxMm}mm`);
  }
  const allClasses=new Set(report.scenarios.filter(s=>s.weaponClass).map(s=>s.weaponClass));
  const hardwareOk=!handle.hardwareGpuRequested||report.hardware.attestation.tier_h_admissible===true;
  report.encoder={name:'ffmpeg/libx264',purpose:'qualitative moving review only; PNG frames remain authoritative'};
  report.result=hardwareOk&&report.scenarios.every(s=>s.controls.bodyOpaque&&s.controls.staticDirectionEmpty&&s.controls.attachmentPass)&&(requested.length>0||allClasses.size===15)?'GREEN':'RED';
}finally{await handle.close();fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({result:report.result,manifest:path.join(out,'manifest.json'),scenarios:report.scenarios.length},null,2));
if(report.result!=='GREEN')process.exitCode=1;
