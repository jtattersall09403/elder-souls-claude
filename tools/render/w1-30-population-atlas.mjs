#!/usr/bin/env node
// Native shipping-pixel atlas for the complete W1-30 world population. One persistent hardware
// browser visits all region centroids, all settlement centres and every generated interior.
// This is builder review evidence, not a fidelity score or a substitute for the fresh critic.
'use strict';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {launchGame} from '../lib/browser.mjs';import {parseArgs,ensureDir,REPO_ROOT} from '../lib/cli.mjs';
import {launchArgAudit,readRenderer,t1Verdict} from '../lib/absence.mjs';
const a=parseArgs(),out=path.resolve(String(a.out||'/tmp/w1-30-population-atlas'));ensureDir(out);
const W=Number(a.width||1280),H=Number(a.height||720),seed=Number(a.seed||3030),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(REPO_ROOT,p),'utf8'));
const regions=read('game/data/world/regions.json').regions;
const interiorDir=path.join(REPO_ROOT,'game/data/world/interiors');
const interiors=fs.readdirSync(interiorDir).filter(f=>f.endsWith('.json')).sort().map(f=>read(`game/data/world/interiors/${f}`));
const requested=new Set(String(a.only||'regions,settlements,interiors').split(',').map(x=>x.trim()).filter(Boolean));
const ids=new Set(String(a.ids||'').split(',').map(x=>x.trim()).filter(Boolean));
const disabledFeatures=String(a.disableFeatures||'').split(',').map(x=>x.trim()).filter(Boolean);
const h=await launchGame({...a,width:W,height:H,timeout:Number(a.timeout||600000)});
const report={schema:'elder-souls/w1-30-population-atlas@1',result:'RED',seed,nativeWindow:[W,H],browser:null,hardware:null,populations:{regions:[],settlements:[],interiors:[]},errors:h.errors};
const save=async(group,id,meta)=>{await h.h('renderFrame');const b=Buffer.from(String(await h.h('screenshot')).split(',')[1],'base64'),dir=path.join(out,group);ensureDir(dir);const file=path.join(dir,`${id}.png`);fs.writeFileSync(file,b);const stats=await h.h('getWorldStats');const row={id,file,sha256:sha(b),frame:await h.h('getFrame'),camera:await h.h('camera',{}),meta,budgets:{drawCalls:stats.drawCalls,triangles:stats.triangles,programs:stats.programs,geometryMB:stats.geometryMB,textureMB:stats.textureMB,vfx:stats.vfx}};report.populations[group].push(row);fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify(report,null,2)+'\n');console.log(`${group}/${id}: ${row.sha256.slice(0,12)}`);};
const settle=async(x,z)=>{await h.h('teleport',x,z,{});await h.h('stepFrames',2);const drain=await h.h('streamAround',x,z),stats=await h.h('getProvinceStats');
  // Province-edge centroids legitimately clip the 5x5 resident square (the northern edge is 20
  // tiles). Queue exhaustion is the settle predicate; requiring 25 fabricated a failure for a
  // completely drained boundary rather than detecting incomplete streaming.
  if(stats.streaming.tilesQueued||stats.streaming.tilesResident<12)throw new Error(`unsettled ${x},${z}: queued=${stats.streaming.tilesQueued} resident=${stats.streaming.tilesResident}`);return{drain,stats};};
try{
 await h.h('ready');const vp=await h.h('setDevicePixelRatio',1);report.canvas=vp.buffer;if(vp.buffer[0]!==W||vp.buffer[1]!==H)throw new Error(`native canvas ${vp.buffer.join('x')} != ${W}x${H}`);await h.h('setSeed',seed);await h.h('setRenderRate',0);await h.h('setUIVisible',false);for(const feature of disabledFeatures)await h.h('setVisualFeature',feature,false);report.disabledFeatures=disabledFeatures;
 const renderer=await readRenderer(h),launch=launchArgAudit(h.chromiumArgs),attestation=t1Verdict(renderer.unmaskedRenderer||renderer.renderer||'','desktop-discrete',{launch,pageRenderer:renderer.unmaskedRenderer||renderer.renderer||''});report.browser={version:h.browser.version(),chromiumArgs:h.chromiumArgs};report.hardware={renderer,launch,attestation};
 if(requested.has('regions'))for(const r of regions){await h.h('loadState','default');await h.h('setUIVisible',false);await h.h('setWeather','clear');await h.h('setTimeOfDay',10.5);const [x,z]=r.centroid_m,settled=await settle(x,z),t=await h.h('getTerrainAt',x,z),y=t.y;await h.h('camera',{pos:[x-28,y+8.5,z-24],look:[x+13,y+2.8,z+18],fov:61,mode:'free'});await save('regions',r.id,{name:r.name,centroid:r.centroid_m,terrain:t,water:r.water,canopy:r.props.canopy,under:r.props.under,cover:r.props.cover,settled});}
 if(requested.has('settlements')){const towns=await h.h('listSettlements');for(const town of towns){await h.h('loadState','default');await h.h('setUIVisible',false);await h.h('setWeather','clear');await h.h('setTimeOfDay',11);const pos=town.pos||town.centre||town.center,[x,z]=[pos[0],pos[2]??pos[1]],settled=await settle(x,z),r=Math.max(45,Math.min(95,Number(town.radius_m||town.radius||68))),cx=x-r*.52,cz=z-r*.52,t=await h.h('getTerrainAt',cx,cz),y=t.y;
   // Street-height approach, not an aerial census. The former +0.27*radius eye hid empty roads,
   // facade thickness and thresholds behind roof plans—the exact pixels this population exists
   // to audit. Aim through the public-realm centre from a deterministic diagonal approach.
   await h.h('camera',{pos:[cx,y+3.15,cz],look:[x,y+2.25,z],fov:61,mode:'free'});await save('settlements',town.id,{town,terrain:t,settled,capture:'street-height approach'});}}
 if(requested.has('interiors'))for(const rec of interiors.filter(r=>!ids.size||ids.has(r.id))){await h.h('enterInterior',rec.id);await h.h('setUIVisible',false);await h.h('stepFrames',2);const b=rec.bounds_m||{x:[-5,5],y:[0,3.2],z:[-5,5]},sx=b.x[1]-b.x[0],sz=b.z[1]-b.z[0],sy=b.y[1]-b.y[0],eye=Math.max(1.55,Math.min(2.3,b.y[0]+sy*.56));let pos,look;if(sx>=sz){pos=[b.x[0]+sx*.14,eye,b.z[1]-sz*.15];look=[b.x[1]-sx*.15,b.y[0]+sy*.39,b.z[0]+sz*.20];}else{pos=[b.x[0]+sx*.14,eye,b.z[0]+sz*.15];look=[b.x[1]-sx*.15,b.y[0]+sy*.39,b.z[1]-sz*.20];}await h.h('camera',{pos,look,fov:64,mode:'free'});await save('interiors',rec.id,{settlement:rec.settlement,kind:rec.interior_kind,bounds:b,props:(rec.props||[]).length,continuity:await h.h('getInteriorContinuity'),drawn:await h.h('getDrawnInterior')});}
 const expected={regions:requested.has('regions')?regions.length:0,settlements:requested.has('settlements')?8:0,interiors:requested.has('interiors')?(ids.size?interiors.filter(r=>ids.has(r.id)).length:interiors.length):0};report.expected=expected;report.result=report.errors.length===0&&Object.entries(expected).every(([k,n])=>report.populations[k].length===n)&&(!h.hardwareGpuRequested||attestation.tier_h_admissible===true)?'GREEN':'RED';
}finally{await h.close();fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({result:report.result,manifest:path.join(out,'manifest.json'),counts:Object.fromEntries(Object.entries(report.populations).map(([k,v])=>[k,v.length]))},null,2));if(report.result!=='GREEN')process.exitCode=1;
