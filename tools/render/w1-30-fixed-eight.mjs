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
const requested=new Set(String(a.only||'').split(',').map(x=>x.trim()).filter(Boolean));
const include=id=>requested.size===0||requested.has(id);
const disabledFeatures=String(a.disableFeatures||'').split(',').map(x=>x.trim()).filter(Boolean);
const h=await launchGame({...a,width:W,height:H,timeout:Number(a.timeout||300000)});
const report={schema:'elder-souls/w1-30-fixed-eight@1',result:'RED',seed,nativeWindow:[W,H],shots:[],errors:h.errors};
async function settle(){const before=await h.h('getProvinceStats'),drain=await h.h('streamAround',before.streaming?before.streaming.focusX:0,before.streaming?before.streaming.focusZ:0);let s=await h.h('getProvinceStats');const q=s.streaming.tilesQueued,res=s.streaming.tilesResident;if(q>0||res<25)throw new Error(`province did not settle: queued=${q} resident=${res}`);return{frames:0,drain,stats:s};}
async function cam(pos,look,fov=58){await h.h('camera',{pos,look,fov,mode:'free'});await h.h('renderFrame');}
async function place(x,z,eye,look,fov=58){await h.h('teleport',x,z,{});await h.h('stepFrames',2);const drain=await h.h('streamAround',x,z),s=await h.h('getProvinceStats');if(s.streaming.tilesQueued>0||s.streaming.tilesResident<25)throw new Error(`province did not settle at ${x},${z}: queued=${s.streaming.tilesQueued} resident=${s.streaming.tilesResident}`);const t=await h.h('getTerrainAt',x,z),y=t.y;await cam([x+eye[0],y+eye[1],z+eye[2]],[x+look[0],y+look[1],z+look[2]],fov);return{terrain:t,position:[x,z],camera:await h.h('camera',{}),settled:{frames:0,drain,stats:s}};}
async function shot(id,profile,setup){const observation=await setup();await h.h('renderFrame');const b=Buffer.from(String(await h.h('screenshot')).split(',')[1],'base64'),file=path.join(out,`${id}.png`);fs.writeFileSync(file,b);let waterMask=null;if(a.waterMask){const mb=Buffer.from(String(await h.h('screenshotWaterMask')).split(',')[1],'base64'),mf=path.join(out,`${id}-water-mask.png`);fs.writeFileSync(mf,mb);waterMask={file:mf,sha256:sha(mb)};}const frame=await h.h('getFrame'),stats=await h.h('getWorldStats');report.shots.push({id,profile,file,sha256:sha(b),waterMask,frame,observation,budgets:{drawCalls:stats.drawCalls,triangles:stats.triangles,programs:stats.programs,geometryMB:stats.geometryMB,textureMB:stats.textureMB,vfx:stats.vfx}});console.log(`${id}: f${frame} ${sha(b).slice(0,12)}`);}
try{
 await h.h('ready');const viewport=await h.h('setDevicePixelRatio',1);report.canvas=viewport.buffer;if(viewport.buffer[0]!==W||viewport.buffer[1]!==H)throw new Error(`native canvas ${viewport.buffer.join('x')} != requested ${W}x${H}`);await h.h('setSeed',seed);await h.h('setRenderRate',0);await h.h('setUIVisible',false);
 for(const feature of disabledFeatures)await h.h('setVisualFeature',feature,false);
 report.disabledFeatures=disabledFeatures;
 const ri=await readRenderer(h),la=launchArgAudit(h.chromiumArgs);report.browser={version:h.browser.version(),chromiumArgs:h.chromiumArgs};report.hardware={renderer:ri,launch:la,attestation:t1Verdict(ri.unmaskedRenderer||ri.renderer||'','desktop-discrete',{launch:la,pageRenderer:ri.unmaskedRenderer||ri.renderer||''})};
 if(include('exterior_marsh_dusk'))await shot('exterior_marsh_dusk','exterior_lowlight',async()=>{await h.h('loadState','default');await h.h('setUIVisible',false);await h.h('setTimeOfDay',18.1);await h.h('setWeather','clear');return place(3173,3280,[-18,4.8,13],[24,2.4,-25],61);});
 if(include('foliage_dense'))await shot('foliage_dense','exterior_daylight',async()=>{await h.h('loadState','default');await h.h('setUIVisible',false);await h.h('setTimeOfDay',9);await h.h('setWeather','heavy_rain');return place(1118,3487.5,[-8,3.0,-7],[15,4.1,19],63);});
 if(include('exterior_marsh_noon'))await shot('exterior_marsh_noon','exterior_daylight',async()=>{await h.h('loadState','default');await h.h('setUIVisible',false);await h.h('setTimeOfDay',12);await h.h('setWeather','clear');return place(3173,3280,[-15,5.2,12],[25,2.8,-26],62);});
 if(include('water_edge'))await shot('water_edge','exterior_lowlight',async()=>{await h.h('loadState','default');await h.h('setUIVisible',false);await h.h('setTimeOfDay',6.4);await h.h('setWeather','dawn_mist');return place(3438,2896,[-6,3.1,5],[33,3.6,-38],55);});
 if(include('interior_rootway'))await shot('interior_rootway','interior_darkemissive',async()=>{await h.h('loadState','dungeon_primary');await h.h('setUIVisible',false);await h.h('stepFrames',18);await cam([1.45,1.72,-7.4],[-.45,1.30,9.5],58);return{camera:await h.h('camera',{}),conditions:await h.h('getEnvConditions')};});
 if(include('character_closeup'))await shot('character_closeup','character_closeup',async()=>{await h.h('loadState','arena_flat');await h.h('setUIVisible',false);await h.h('setTimeOfDay',10);await h.h('setWeather','clear');await h.h('stepFrames',12);const p=(await h.h('snapshot')).player.pos;await cam([p[0]+2.2,p[1]+1.55,p[2]-2.55],[p[0],p[1]+1.08,p[2]],47);return{camera:await h.h('camera',{}),combat:await h.h('getCombatState')};});
 if(include('xanmeer_vista'))await shot('xanmeer_vista','exterior_daylight',async()=>{await h.h('loadState','default');await h.h('setUIVisible',false);await h.h('setTimeOfDay',10.5);await h.h('setWeather','clear');return place(3477,2857.5,[-23,8.2,24],[0,5.4,0],58);});
 if(include('combat_midfight'))await shot('combat_midfight','character_closeup',async()=>{await h.h('loadState','arena_duel');await h.h('setUIVisible',false);await h.h('setTimeOfDay',11);await h.h('setWeather','clear');await h.h('stepFrames',8);const p=(await h.h('snapshot')).player.pos;await cam([p[0]+3.8,p[1]+2.0,p[2]-4.4],[p[0],p[1]+1.0,p[2]+2.0],52);await h.h('queueInputs',[{f:2,press:['light']},{f:4,release:['light']}]);await h.h('stepFrames',28);return{camera:await h.h('camera',{}),combat:await h.h('getCombatState'),action:{label:'straight-sword light active/recovery',frameRange:[1,28],rate:'60 f@60'}};});
 const expected=requested.size||8;
 report.result=report.shots.length===expected&&!report.errors.length&&(!h.hardwareGpuRequested||report.hardware.attestation.tier_h_admissible===true)?'GREEN':'RED';
}finally{await h.close();fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({result:report.result,manifest:path.join(out,'manifest.json'),shots:report.shots.length},null,2));if(report.result!=='GREEN')process.exitCode=1;
