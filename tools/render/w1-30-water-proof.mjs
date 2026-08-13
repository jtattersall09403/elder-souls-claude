#!/usr/bin/env node
// Hardware, frame-exact water/shore review. It finds a real wet/dry boundary from the shipping
// WorldField, captures stationary motion and a tide displacement at 1920x1080, and records every
// source-frame hash. PNG sequences are authoritative; MP4 is only a convenient moving review.
'use strict';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
import {launchGame} from '../lib/browser.mjs';import {parseArgs,ensureDir} from '../lib/cli.mjs';
const args=parseArgs(),out=path.resolve(String(args.out||'/tmp/w1-30-water-proof'));ensureDir(out);const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const h=await launchGame({...args,width:Number(args.width||1920),height:Number(args.height||1080),timeout:Number(args.timeout||240000)});
const report={schema:'elder-souls/w1-30-water-proof@1',seed:Number(args.seed||3030),window:[Number(args.width||1920),Number(args.height||1080)],browser:null,site:null,sequences:[],errors:h.errors,result:'RED'};
async function shot(dir,i){await h.h('renderFrame');const b=Buffer.from(String(await h.h('screenshot')).split(',')[1],'base64'),file=path.join(dir,`f${String(i).padStart(4,'0')}.png`);fs.writeFileSync(file,b);return{file,sha256:sha(b),frame:await h.h('getFrame'),water:await h.h('getWaterAt',report.site.wet.x,report.site.wet.z)};}
async function sequence(id,count,setup){const dir=path.join(out,id);ensureDir(dir);await setup();const frames=[];for(let i=0;i<count;i++){await h.h('stepFrames',1);frames.push(await shot(dir,i));}const video=path.join(out,`${id}.mp4`),cmd=['-y','-loglevel','error','-framerate','60','-i',path.join(dir,'f%04d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p',video],enc=spawnSync('ffmpeg',cmd,{encoding:'utf8'});if(enc.status!==0)throw new Error(enc.stderr);report.sequences.push({id,count,dir,video,videoSha256:sha(fs.readFileSync(video)),frames});}
try{
 await h.h('ready');const viewport=await h.h('setDevicePixelRatio',1);report.canvas=viewport.buffer;if(viewport.buffer[0]!==report.window[0]||viewport.buffer[1]!==report.window[1])throw new Error(`native canvas ${viewport.buffer.join('x')} != requested ${report.window.join('x')}`);await h.h('setSeed',report.seed);await h.h('setRenderRate',0);await h.h('setUIVisible',false);await h.h('loadState','default');await h.h('setWeather','clear');await h.h('setTimeOfDay',8.5);
 // Scan a deterministic 600 m square around the Deep Marshes label. Choose the closest
 // horizontally adjacent wet/dry pair so both surfaces fill the grazing camera.
 const cx=Number(args.cx||3123),cz=Number(args.cz||3715),step=5,candidates=[];for(let z=cz-300;z<=cz+300;z+=step)for(let x=cx-300;x<=cx+300;x+=step)candidates.push({x,z});
 const states=[];for(let i=0;i<candidates.length;i+=240){const part=candidates.slice(i,i+240);states.push(...await h.page.evaluate(P=>P.map(p=>({p,w:window.__HARNESS.getWaterAt(p.x,p.z)})),part));}
 let pair=null,best=-Infinity;const by=new Map(states.map(s=>[`${s.p.x},${s.p.z}`,s]));for(const s of states)if(s.w&&s.w.surface_y!==null)for(const [dx,dz] of [[step,0],[0,step]]){const n=by.get(`${s.p.x+dx},${s.p.z+dz}`);if(n&&(!n.w||n.w.surface_y===null)){
   // Prefer a substantial pool over a one-cell wet sliver. Score the count of wet samples in a
   // 30 m neighbourhood behind the boundary and the local depth; this still derives entirely
   // from shipping waterAt, but gives the grazing frame enough real water for visual/M12 review.
   let support=0;for(let oz=-30;oz<=30;oz+=step)for(let ox=-30;ox<=30;ox+=step){const q=by.get(`${s.p.x+ox},${s.p.z+oz}`);if(q?.w?.surface_y!==null)support++;}
   const score=support+Number(s.w.depth_m||0)*20;if(score>best){best=score;pair={wet:s.p,dry:n.p,water:s.w,support};}
 }}
 if(!pair)throw new Error('no real wet/dry Deep Marsh boundary found');report.site=pair;
 const dx=pair.wet.x-pair.dry.x,dz=pair.wet.z-pair.dry.z,L=Math.hypot(dx,dz)||1,nx=dx/L,nz=dz/L;
 // Keep the permanently visible third-person player in the scene but move it to the side of
 // the water study, so its body cannot cover the wet/dry transition or M12 sampling bands.
 await h.h('teleport',pair.dry.x-nz*18,pair.dry.z+nx*18,{});await h.h('stepFrames',18);
 const mx=(pair.wet.x+pair.dry.x)/2,mz=(pair.wet.z+pair.dry.z)/2,y=(await h.h('getTerrainAt',pair.dry.x,pair.dry.z)).y;
 // Elevated shoreline view keeps the same real wet/dry pair but sees over the dense shipped
 // aquatic understorey. The previous 1.45 m grazing view proved vegetation density while hiding
 // every water pixel, so it could not support the water/material judgement this ledger names.
 const pose=()=>h.h('camera',{pos:[mx-nx*10,y+4.6,mz-nz*10],look:[mx+nx*13,(pair.water.surface_y||y)-.05,mz+nz*13],fov:55,mode:'free'});
 await pose();await h.h('renderFrame');const mask=Buffer.from(String(await h.h('screenshotWaterMask')).split(',')[1],'base64');const maskFile=path.join(out,'water-mask.png');fs.writeFileSync(maskFile,mask);report.waterMask={file:maskFile,sha256:sha(mask),source:'live object-id pass over shipping water:* meshes'};
 await sequence('stationary-water-30',30,async()=>{await h.h('setTide','RISING');await pose();});
 await sequence('tide-low-to-high',30,async()=>{await h.h('setTide','LOW');await pose();});await h.h('setTide','HIGH');await sequence('tide-high-settled',12,pose);
 report.browser={version:h.browser.version(),chromiumArgs:h.chromiumArgs};report.result=report.errors.length?'RED':'GREEN';
}finally{await h.close();fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({result:report.result,site:report.site,sequences:report.sequences.map(s=>({id:s.id,count:s.count,video:s.video}))},null,2));if(report.result!=='GREEN')process.exitCode=1;
