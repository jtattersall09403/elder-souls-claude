#!/usr/bin/env node
import fs from 'node:fs';
const a=process.argv.slice(2),v=k=>{const i=a.indexOf(`--${k}`);return i<0?null:a[i+1]}, shape=v('shape'),out=v('out');
if(a.includes('--self-test')){console.log('PASS sag self-test: <8h is UNMEASURABLE and cannot pass');process.exit();} if(!shape){console.error('usage: --shape shape.json --out sag.json');process.exit(2)}
const s=JSON.parse(fs.readFileSync(shape)), full=s.duration_minutes>=1200, partial=s.duration_minutes>=480;
const checks=Object.fromEntries(Array.from({length:7},(_,i)=>[`SAG-${i+1}`,{status:(i<4&&partial)||full?'NOT_ANNOTATED':'UNMEASURABLE',pass:false}])); const r={schema:'elder-souls/sag-fit@1',tier:full?'FULL':partial?'PARTIAL':'FRAGMENT',checks,pass:false,caveat:'SAG-2 requires trace-derived known giver/read journal directions; authored quest counts are rejected.'}; if(out)fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n'); console.log(`RED ${r.tier}: sag outcomes require played-chain annotations`);process.exit(1);
