#!/usr/bin/env node
// One reusable browser, nine bounded W1-30 shipping-path observations. Binary frames are always
// transient; the JSON manifest carries build/seed/action/frame/rate/hash and budget provenance.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {PNG} from '../node_modules/pngjs/lib/png.js';
import {launchGame} from '../lib/browser.mjs';
import {parseArgs,ensureDir} from '../lib/cli.mjs';
const args=parseArgs(), out=path.resolve(String(args.out||'/tmp/w1-30-live-proof'));
ensureDir(out);
const handle=await launchGame({...args,width:Number(args.width||320),height:Number(args.height||180),timeout:Number(args.timeout||180000)});
const rows=[];
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const inspect=(b)=>{const p=PNG.sync.read(b), colours=new Set();let l=0,min=255,max=0;for(let i=0;i<p.data.length;i+=4){const y=.299*p.data[i]+.587*p.data[i+1]+.114*p.data[i+2];l+=y;min=Math.min(min,y);max=Math.max(max,y);colours.add((p.data[i]<<16)|(p.data[i+1]<<8)|p.data[i+2]);}return{meanLuma:+(l/(p.width*p.height)).toFixed(2),range:+(max-min).toFixed(2),uniqueColours:colours.size};};
async function shot(id,label,setup,action={label:'settled appearance',seed:3030,frameRange:null,playbackRate:'60 f@60'}){
  const observation=await setup(); await handle.h('renderFrame');
  const url=await handle.h('screenshot'), b=Buffer.from(String(url).replace(/^data:image\/png;base64,/,''),'base64');
  const file=path.join(out,`${String(rows.length+1).padStart(2,'0')}-${id}.png`);fs.writeFileSync(file,b);
  const frame=await handle.h('getFrame'), stats=await handle.h('getWorldStats');
  rows.push({id,label,file,sha256:digest(b),frame,action:{...action,frameRange:action.frameRange||[frame,frame]},pixels:inspect(b),observation,stats:{drawCalls:stats.drawCalls,triangles:stats.triangles,programs:stats.programs,geometryMB:stats.geometryMB,textureMB:stats.textureMB,vfx:stats.vfx,streaming:stats.streaming}});
  fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({schema:'elder-souls/w1-30-live-progress@1',rows},null,2)+'\n');
}
try{
  await handle.h('ready'); await handle.h('setSeed',3030);
  await shot('exterior-day','exterior daylight vista',async()=>{await handle.h('loadState','default');await handle.h('setTimeOfDay',12);await handle.h('setWeather','clear');await handle.h('stepFrames',8);const on=digest(Buffer.from(String(await handle.h('screenshot')).split(',')[1],'base64'));await handle.h('setVisualFeature','postprocess',false);await handle.h('renderFrame');const off=digest(Buffer.from(String(await handle.h('screenshot')).split(',')[1],'base64'));await handle.h('setVisualFeature','postprocess',true);await handle.h('renderFrame');return{conditions:await handle.h('getEnvConditions'),mechanismPerturbation:{feature:'postprocess',shippingHash:on,disabledHash:off,changed:on!==off}};});
  await shot('exterior-low','low-light exterior',async()=>{await handle.h('setTimeOfDay',1);await handle.h('setWeather','fog');await handle.h('stepFrames',8);return await handle.h('getEnvConditions');});
  await shot('interior-emissive','dark/emissive interior',async()=>{await handle.h('loadState','thorn-hall');await handle.h('setWeather','clear');await handle.h('stepFrames',8);return await handle.h('getEnvConditions');});
  await shot('settlement-transition','settlement street/interior transition',async()=>{await handle.h('loadState','town-thorn');await handle.h('setWeather','clear');const before=await handle.h('getWorldStats');const entered=await handle.h('enterInterior','thorn-hall');await handle.h('stepFrames',4);return{entered,beforeRegion:before.region,after:(await handle.h('getWorldStats')).interior};});
  await shot('combat-motion','combat action and recovery',async()=>{await handle.h('loadState','arena_duel');await handle.h('setWeather','clear');await handle.h('queueInputs',[{f:2,press:['light']},{f:4,release:['light']}]);await handle.h('stepFrames',34);return await handle.h('getCombatState');},{label:'straight-sword light attack active/recovery',seed:3030,frameRange:[1,34],playbackRate:'60 f@60'});
  await shot('character-creature','player/creature close-up',async()=>{const p=(await handle.h('snapshot')).player.pos;await handle.h('camera',{pos:[p[0]+1.15,p[1]+1.38,p[2]-1.15],look:[p[0],p[1]+1.05,p[2]],fov:48,mode:'free'});await handle.h('stepFrames',5);return{combat:await handle.h('getCombatState'),camera:(await handle.h('snapshot')).camera};});
  await shot('vegetation-atmosphere','vegetation/atmosphere',async()=>{await handle.h('loadState','town-thorn');await handle.h('setTimeOfDay',9);await handle.h('setWeather','fog');await handle.h('stepFrames',12);const stats=await handle.h('getWorldStats');return{conditions:await handle.h('getEnvConditions'),vegetationInstances:stats.streaming.instances,groundCoverInstances:stats.streaming.groundCoverInstances};});
  await shot('spell-impact','spell release/impact/residue late frame',async()=>{await handle.h('loadState','arena_duel');await handle.h('setWeather','clear');await handle.h('setWillpower',100);await handle.h('setMagicSkills',{sorcery:100,root_speech:100,warding:100,veiling:100});await handle.h('setCatalyst','great_staff');await handle.h('learnSpell','marshfire');await handle.h('setAttuned',['marshfire']);const cast=await handle.h('pressCast',26);await handle.h('renderFrame');const release=(await handle.h('getWorldStats')).vfx, releasePng=Buffer.from(String(await handle.h('screenshot')).split(',')[1],'base64');fs.writeFileSync(path.join(out,'08a-spell-release.png'),releasePng);await handle.h('stepFrames',20);const impact=(await handle.h('getWorldStats')).vfx, impactPng=Buffer.from(String(await handle.h('screenshot')).split(',')[1],'base64');fs.writeFileSync(path.join(out,'08b-spell-impact.png'),impactPng);await handle.h('stepFrames',80);return{cast,releaseVfx:release,impactVfx:impact,lateVfx:(await handle.h('getWorldStats')).vfx,releaseFrame:{sha256:digest(releasePng),pixels:inspect(releasePng)},impactFrame:{sha256:digest(impactPng),pixels:inspect(impactPng)}};},{label:'marshfire release through late residue',seed:3030,frameRange:[1,126],playbackRate:'60 f@60'});
  await shot('walked-stream-seam','walked streamed boundary',async()=>{await handle.h('loadState','town-thorn');const start=await handle.h('getProvinceStats');const walked=await handle.h('walkPath',[[3885,871.58],[3915,871.58]],{speed:'jog',maxFrames:1200,arrive_m:3});const end=await handle.h('getProvinceStats');return{arrival:'walked',walked,start,end};},{label:'walked across the x=3900 tile boundary, no placed arrival claim',seed:3030,frameRange:null,playbackRate:'60 f@60'});
  const refusal=await handle.page.evaluate(()=>{try{return{cleanRefusal:false,value:window.__HARNESS.castNow('__w1_30_missing_spell__')}}catch(e){return{cleanRefusal:true,message:String(e&&e.message||e)}}});
  const lumaFloors={'exterior-day':10,'exterior-low':2,'interior-emissive':5,'settlement-transition':5,'combat-motion':8,'character-creature':8,'vegetation-atmosphere':8,'spell-impact':8,'walked-stream-seam':4};
  const vegetation=rows.find(r=>r.id==='vegetation-atmosphere');
  const report={schema:'elder-souls/w1-30-live-proof@2',result:rows.length===9&&rows.every(r=>r.pixels.uniqueColours>32&&r.pixels.range>8&&r.pixels.meanLuma>=lumaFloors[r.id])&&rows[0].observation.mechanismPerturbation.changed&&rows.find(r=>r.id==='spell-impact').observation.impactVfx.systems>=3&&vegetation.observation.vegetationInstances>1000&&vegetation.observation.groundCoverInstances>100&&refusal.cleanRefusal&&handle.errors.length===0?'GREEN':'RED',build:handle.buildInfo,browser:handle.browser.version(),chromiumArgs:handle.chromiumArgs,lumaFloors,rows,refusal,pageErrors:handle.errors};
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({result:report.result,manifest:path.join(out,'manifest.json'),shots:rows.map(r=>({id:r.id,sha256:r.sha256,pixels:r.pixels}))},null,2));if(report.result!=='GREEN'||report.pageErrors.length)process.exitCode=1;
} finally {await handle.close();}
