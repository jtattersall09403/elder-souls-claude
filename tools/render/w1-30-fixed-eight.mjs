#!/usr/bin/env node
// Builder-side native capture of RI-VIS02's fixed eight. This does not perform the critic's
// comparison or award a score; it produces deterministic shipping pixels and provenance at a
// height where RI-VIS03 M5 can take its required native 1024x1024 window without resampling.
'use strict';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {launchGame} from '../lib/browser.mjs';import {parseArgs,ensureDir} from '../lib/cli.mjs';
import {launchArgAudit,readRenderer,t1Verdict} from '../lib/absence.mjs';
const a=parseArgs(),out=path.resolve(String(a.out||'/tmp/w1-30-fixed-eight'));ensureDir(out);
const W=Number(a.width||1920),H=Number(a.height||1080),seed=Number(a.seed||3030),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const h=await launchGame({...a,width:W,height:H,timeout:Number(a.timeout||300000)});
const report={schema:'elder-souls/w1-30-fixed-eight@1',result:'RED',seed,nativeWindow:[W,H],shots:[],errors:h.errors};
async function settle(n=180){let s=await h.h('getProvinceStats'),f=0;while(s.tilesQueued>0&&f<n){await h.h('stepFrames',6);f+=6;s=await h.h('getProvinceStats');}return{frames:f,stats:s};}
async function cam(pos,look,fov=58){await h.h('camera',{pos,look,fov,mode:'free'});await h.h('renderFrame');}
async function place(x,z,eye,look,fov=58){await h.h('teleport',x,z,{});await h.h('stepFrames',24);const t=await h.h('getTerrainAt',x,z),y=t.y;await cam([x+eye[0],y+eye[1],z+eye[2]],[x+look[0],y+look[1],z+look[2]],fov);return{terrain:t,position:[x,z],camera:await h.h('camera',{}),settled:await settle()};}
async function shot(id,profile,setup){const observation=await setup();await h.h('renderFrame');const b=Buffer.from(String(await h.h('screenshot')).split(',')[1],'base64'),file=path.join(out,`${id}.png`);fs.writeFileSync(file,b);const frame=await h.h('getFrame'),stats=await h.h('getWorldStats');report.shots.push({id,profile,file,sha256:sha(b),frame,observation,budgets:{drawCalls:stats.drawCalls,triangles:stats.triangles,programs:stats.programs,geometryMB:stats.geometryMB,textureMB:stats.textureMB,vfx:stats.vfx}});console.log(`${id}: f${frame} ${sha(b).slice(0,12)}`);}
try{
 await h.h('ready');await h.h('setSeed',seed);await h.h('setRenderRate',0);await h.h('setUIVisible',false);
 const ri=await readRenderer(h),la=launchArgAudit(h.chromiumArgs);report.browser={version:h.browser.version(),chromiumArgs:h.chromiumArgs};report.hardware={renderer:ri,launch:la,attestation:t1Verdict(ri.unmaskedRenderer||ri.renderer||'','desktop-discrete',{launch:la,pageRenderer:ri.unmaskedRenderer||ri.renderer||''})};
 await shot('exterior_marsh_dusk','exterior_lowlight',async()=>{await h.h('loadState','default');await h.h('setUIVisible',false);await h.h('setTimeOfDay',18.5);await h.h('setWeather','fog');return place(3123,3715,[-14,4.8,-12],[18,2.4,24],61);});
 await shot('foliage_dense','exterior_daylight',async()=>{await h.h('loadState','default');await h.h('setUIVisible',false);await h.h('setTimeOfDay',9);await h.h('setWeather','heavy_rain');return place(1118,3487.5,[-8,3.0,-7],[15,4.1,19],63);});
 await shot('exterior_marsh_noon','exterior_daylight',async()=>{await h.h('setTimeOfDay',12);await h.h('setWeather','clear');return place(3123,3715,[-18,5.2,-15],[24,2.8,31],62);});
 await shot('water_edge','exterior_lowlight',async()=>{await h.h('loadState','water_shallows');await h.h('setUIVisible',false);await h.h('setTimeOfDay',6.4);await h.h('setWeather','dawn_mist');await h.h('stepFrames',24);await cam([8,3.5,-7],[0,.35,5],55);return{camera:await h.h('camera',{}),conditions:await h.h('getEnvConditions')};});
 await shot('interior_rootway','interior_darkemissive',async()=>{await h.h('loadState','dungeon_primary');await h.h('setUIVisible',false);await h.h('stepFrames',18);await cam([0,1.72,-6.8],[0,1.35,6.5],58);return{camera:await h.h('camera',{}),conditions:await h.h('getEnvConditions')};});
 await shot('character_closeup','character_closeup',async()=>{await h.h('loadState','arena_flat');await h.h('setUIVisible',false);await h.h('setTimeOfDay',10);await h.h('setWeather','clear');await h.h('stepFrames',12);const p=(await h.h('snapshot')).player.pos;await cam([p[0]+2.2,p[1]+1.55,p[2]-2.55],[p[0],p[1]+1.08,p[2]],47);return{camera:await h.h('camera',{}),combat:await h.h('getCombatState')};});
 await shot('xanmeer_vista','exterior_daylight',async()=>{await h.h('loadState','default');await h.h('setUIVisible',false);await h.h('setTimeOfDay',10.5);await h.h('setWeather','clear');return place(2820,4140,[-26,11,-22],[34,3,42],58);});
 await shot('combat_midfight','character_closeup',async()=>{await h.h('loadState','arena_duel');await h.h('setUIVisible',false);await h.h('setTimeOfDay',11);await h.h('setWeather','clear');await h.h('stepFrames',8);const p=(await h.h('snapshot')).player.pos;await cam([p[0]+3.8,p[1]+2.0,p[2]-4.4],[p[0],p[1]+1.0,p[2]+2.0],52);await h.h('queueInputs',[{f:2,press:['light']},{f:4,release:['light']}]);await h.h('stepFrames',28);return{camera:await h.h('camera',{}),combat:await h.h('getCombatState'),action:{label:'straight-sword light active/recovery',frameRange:[1,28],rate:'60 f@60'}};});
 report.result=report.shots.length===8&&!report.errors.length&&(!h.hardwareGpuRequested||report.hardware.attestation.tier_h_admissible===true)?'GREEN':'RED';
}finally{await h.close();fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({result:report.result,manifest:path.join(out,'manifest.json'),shots:report.shots.length},null,2));if(report.result!=='GREEN')process.exitCode=1;
