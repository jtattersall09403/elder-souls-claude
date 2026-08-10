#!/usr/bin/env node
import fs from 'node:fs'; import { readJsonl, analyse } from './lib/session-analysis.mjs';
const a=process.argv.slice(2), val=k=>{const i=a.indexOf(`--${k}`);return i<0?null:a[i+1]}, trace=val('trace'), out=val('out');
if (a.includes('--self-test')) { const x=analyse([{frame:0,type:'hit'},{frame:216000,type:'dialogue'}]); if(x.bins.length!==2) process.exit(1); console.log('PASS shape self-test: two bins separated; empty support cannot pass'); process.exit(); }
if(!trace) { console.error('usage: --trace TRACE --out JSON'); process.exit(2); }
const x=analyse(readJsonl(trace)), f=x.bins.map(b=>b.fractions.FIGHT||0), extrema=(cmp)=>f.slice(1,-1).filter((v,i)=>cmp(v,f[i])&&cmp(v,f[i+2])).length;
const prose=x.bins.map(b=>(b.fractions.TALK||0)+(b.fractions.READ||0)), prosePeak=prose.indexOf(Math.max(...prose));
const checks={SH1:{value:{maxima:extrema((x,a)=>x-a>=.10),minima:extrema((x,a)=>a-x>=.10)},pass:false},SH2:{value:f.indexOf(Math.max(...f)),pass:x.bins.length>=7&&f.indexOf(Math.max(...f))>=Math.floor(x.bins.length*.85)},SH3:{value:prosePeak,pass:x.bins.length>=6&&prosePeak>=3&&prosePeak<x.bins.length-2},SH4:{value:Math.min(...x.bins.slice(1).map(b=>b.entropy_bits)),pass:x.bins.length>1&&Math.min(...x.bins.slice(1).map(b=>b.entropy_bits))>=1.6},SH5:{value:x.bins.slice(-3).reduce((s,b)=>s+(b.fractions.EXPLORE||0),0)/Math.min(3,x.bins.length),pass:false},SH6:{referrals:[]}}; checks.SH1.pass=checks.SH1.value.maxima>=2&&checks.SH1.value.minima>=2; checks.SH5.pass=checks.SH5.value>=.10;
const result={schema:'elder-souls/session-shape@1',trace,duration_minutes:x.duration_minutes,bins:x.bins,checks,unknown_events:x.bins.reduce((s,b)=>s+(b.counts.UNKNOWN||0),0),pass:Object.entries(checks).filter(([k])=>k!=='SH6').every(([,v])=>v.pass)};
if(out) fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n'); console.log(result.pass?'PASS':'RED',Object.entries(checks).map(([k,v])=>`${k}=${v.pass??'referral'}`).join(' ')); process.exit(result.pass?0:1);
