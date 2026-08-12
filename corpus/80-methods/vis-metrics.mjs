#!/usr/bin/env node
// Authority-compatible RI-VIS03 front end over the literal M1-M12 implementation.
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const a=process.argv.slice(2);if(a.includes('--help')||a.includes('-h')){console.log('USAGE: vis-metrics.mjs --shot <png> --profile <profile> [--anti png] [--json out.json] OR --dolly <dir> --profile <profile> --json <out>');process.exit(0);}
const out=[];let input=null;
for(let i=0;i<a.length;i++){const k=a[i],v=a[i+1];if(k==='--shot'){input=v;i++;}else if(k==='--dolly'){const d=path.resolve(v);if(!fs.existsSync(d)){console.error(`missing dolly: ${d}`);process.exit(3);}const f=fs.readdirSync(d).filter(x=>/\.(png|jpe?g|webp|avif)$/i.test(x)).sort()[0];if(!f){console.error('dolly contains no decodable frames');process.exit(3);}input=path.join(d,f);out.push('--sequence',d);i++;}else if(k==='--json'&&v&&!v.startsWith('--')){out.push('--out',v,'--json');i++;}else out.push(k);}
if(!input){console.error('RI-VIS03 refuses: --shot or --dolly is required');process.exit(2);}out.unshift('--in',input);
const r=spawnSync(process.execPath,[path.resolve('tools/metrics/image-metrics.mjs'),...out],{stdio:'inherit'});process.exit(r.status===null?1:r.status);
