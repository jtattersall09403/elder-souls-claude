#!/usr/bin/env node
// One low-cost settled frame for the builder repair loop. This is intentionally not critic
// evidence; it exists so a red visual representative can be repaired without replaying the
// nine-scene aggregate on a software rasteriser.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {PNG} from '../node_modules/pngjs/lib/png.js';
import {launchGame} from '../lib/browser.mjs';
import {parseArgs,ensureDir} from '../lib/cli.mjs';

const a=parseArgs(),out=path.resolve(String(a.out||'/tmp/w1-30-visual-smoke'));
ensureDir(out);
const h=await launchGame({...a,width:Number(a.width||320),height:Number(a.height||180),timeout:Number(a.timeout||180000)});
try{
  await h.h('ready');await h.h('setSeed',Number(a.seed||3030));await h.h('loadState',String(a.state||'default'));
  await h.h('setTimeOfDay',Number(a.hour||12));await h.h('setWeather',String(a.weather||'clear'));await h.h('stepFrames',Number(a.frames||8));await h.h('renderFrame');
  // Optional inspection pose. The ordinary third-person pose remains the default, but a world
  // population capture must not silently become a close-up merely because an NPC occupies the
  // camera arm in that state. This goes through the public harness camera seam used by CAM07.
  if(a.eye&&a.look){let eye=String(a.eye).split(',').map(Number),look=String(a.look).split(',').map(Number);if(a.relative){const p=(await h.h('snapshot')).player.pos;eye=eye.map((v,i)=>v+p[i]);look=look.map((v,i)=>v+p[i]);}await h.h('camera',{pos:eye,look,fov:Number(a.fov||60),mode:'free'});await h.h('renderFrame');}
  const b=Buffer.from(String(await h.h('screenshot')).split(',')[1],'base64'),png=PNG.sync.read(b),file=path.join(out,`${String(a.state||'default')}.png`);
  fs.writeFileSync(file,b);let luma=0,min=255,max=0;const colours=new Set();for(let i=0;i<png.data.length;i+=4){const y=.299*png.data[i]+.587*png.data[i+1]+.114*png.data[i+2];luma+=y;min=Math.min(min,y);max=Math.max(max,y);colours.add((png.data[i]<<16)|(png.data[i+1]<<8)|png.data[i+2]);}
  const row={schema:'elder-souls/w1-30-visual-smoke@1',state:String(a.state||'default'),seed:Number(a.seed||3030),hour:Number(a.hour||12),weather:String(a.weather||'clear'),frame:await h.h('getFrame'),size:[png.width,png.height],sha256:crypto.createHash('sha256').update(b).digest('hex'),pixels:{meanLuma:+(luma/(png.width*png.height)).toFixed(2),range:+(max-min).toFixed(2),uniqueColours:colours.size},stats:await h.h('getWorldStats'),browser:h.browser.version(),chromiumArgs:h.chromiumArgs,pageErrors:h.errors};
  fs.writeFileSync(path.join(out,`${row.state}.json`),JSON.stringify(row,null,2)+'\n');console.log(JSON.stringify(row,null,2));if(h.errors.length)process.exitCode=1;
}finally{await h.close();}
