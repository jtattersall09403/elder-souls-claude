#!/usr/bin/env node
'use strict';
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {parseArgs,ensureDir} from '../lib/cli.mjs';
const a=parseArgs(),input=path.resolve(String(a.input||'.')),out=path.resolve(String(a.out||path.join(input,'contact')));ensureDir(out);
const files=fs.readdirSync(input).filter(f=>/\.png$/i.test(f)).sort(),cols=Number(a.cols||5),rows=Number(a.rows||5),w=Number(a.width||320),h=Number(a.height||180),page=cols*rows;
for(let p=0;p<Math.ceil(files.length/page);p++){const set=files.slice(p*page,(p+1)*page),args=['-y','-loglevel','error'];for(const f of set)args.push('-i',path.join(input,f));const inputs=set.map((_,i)=>`[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2[v${i}]`).join(';'),chain=set.map((_,i)=>`[v${i}]`).join('');args.push('-filter_complex',`${inputs};${chain}xstack=inputs=${set.length}:layout=${set.map((_,i)=>`${(i%cols)*w}_${Math.floor(i/cols)*h}`).join('|')}:fill=black[out]`,'-map','[out]','-frames:v','1',path.join(out,`sheet-${String(p+1).padStart(2,'0')}.png`));const r=spawnSync('ffmpeg',args,{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);}
console.log(JSON.stringify({input,count:files.length,pages:Math.ceil(files.length/page),out},null,2));
