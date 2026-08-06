#!/usr/bin/env node
/**
 * partial-dispersion.mjs — RI-WLD04's machine analogue on a shot pack that is still capturing.
 *
 * `region-dispersion.mjs` is the real tool and it reads `ANSWERS.json`, which `province-shots.mjs`
 * only writes when all 117 frames are done. This one labels the frames from province-shots' OWN
 * capture log instead, so the day pass can be measured while the night pass is still running. It
 * exists because a 117-frame capture takes an hour on the software rasteriser and a builder who
 * cannot see the day number until the end cannot act on it.
 *
 * It computes exactly the two descriptors `region-dispersion.mjs` does, with the same code, over
 * ours and Morrowind alike. Use `region-dispersion.mjs` for anything a verdict cites; use this to
 * see where you are.
 *
 * Usage: node tools/world/partial-dispersion.mjs <path-to-province-shots-log>
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const ROOT='/home/user/elder-souls-claude/';
const logPath=process.argv[2];
if(!logPath) { process.stderr.write('usage: node tools/world/partial-dispersion.mjs <province-shots log>\n'); process.exit(2); }
const log=readFileSync(logPath,'utf8');
const items=[];
let idx=0;
for(const line of log.split('\n')){
  const m=/^\[harness\]\s+(day|night|worst)\s+([a-z-]+)\s+(\d+)\/117/.exec(line.trim());
  if(!m) continue;
  const n=Number(m[3]);
  const file=ROOT+`reports/region-shots/capture-${String(n).padStart(3,'0')}.png`;
  if(!existsSync(file)) continue;
  items.push({file, pass:m[1], region:m[2]});
}
console.log('labelled frames:', items.length, 'day', items.filter(i=>i.pass==='day').length, 'night', items.filter(i=>i.pass==='night').length);
function gray(file,W,H){return execFileSync('ffmpeg',['-loglevel','error','-i',file,'-vf',`scale=${W}:${H}`,'-f','rawvideo','-pix_fmt','gray','-'],{maxBuffer:1<<26});}
function rgb(file,W,H){return execFileSync('ffmpeg',['-loglevel','error','-i',file,'-vf',`scale=${W}:${H}`,'-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:1<<26});}
function rawD(file){const W=64,H=36,GW=4,GH=4;const px=rgb(file,W,H);
 const lin=c=>(c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4)); const fn=t=>(t>0.008856?Math.cbrt(t):7.787*t+16/116);
 const acc=Array.from({length:GW*GH},()=>[0,0,0,0]);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*3;
  const r=lin(px[i]/255),g=lin(px[i+1]/255),b=lin(px[i+2]/255);
  const X=(0.4124*r+0.3576*g+0.1805*b)/0.95047,Y=0.2126*r+0.7152*g+0.0722*b,Z=(0.0193*r+0.1192*g+0.9505*b)/1.08883;
  const c=Math.min(GH-1,Math.floor(y/H*GH))*GW+Math.min(GW-1,Math.floor(x/W*GW));
  acc[c][0]+=116*fn(Y)-16;acc[c][1]+=500*(fn(X)-fn(Y));acc[c][2]+=200*(fn(Y)-fn(Z));acc[c][3]++;}
 return acc.flatMap(c=>[c[0]/c[3],c[1]/c[3],c[2]/c[3]]);}
function strD(file){const W=160,H=90,GW=6,GH=4;const g=gray(file,W,H);const at=(x,y)=>g[y*W+x];
 const acc=Array.from({length:GW*GH},()=>[0,0,0]);
 for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
  const gx=(at(x+1,y-1)+2*at(x+1,y)+at(x+1,y+1))-(at(x-1,y-1)+2*at(x-1,y)+at(x-1,y+1));
  const gy=(at(x-1,y+1)+2*at(x,y+1)+at(x+1,y+1))-(at(x-1,y-1)+2*at(x,y-1)+at(x+1,y-1));
  const c=Math.min(GH-1,Math.floor(y/H*GH))*GW+Math.min(GW-1,Math.floor(x/W*GW));
  acc[c][0]+=Math.hypot(gx,gy);acc[c][1]+=at(x,y);acc[c][2]++;}
 const e=acc.map(c=>c[0]/c[2]),mu=acc.map(c=>c[1]/c[2]);
 const norm=v=>{const m=v.reduce((a,b)=>a+b)/v.length;const sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length)||1;return v.map(x=>(x-m)/sd*20);};
 return [...norm(e),...norm(mu)];}
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function analyse(list){const by=new Map();for(const it of list){if(!by.has(it.region))by.set(it.region,[]);by.get(it.region).push(it.d);}
 const regions=[...by.keys()].sort(); const cent=ds=>ds[0].map((_,i)=>ds.reduce((s,d)=>s+d[i],0)/ds.length);
 const C=new Map(regions.map(r=>[r,cent(by.get(r))]));
 let inter=0,np=0;for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++){inter+=dist(C.get(regions[i]),C.get(regions[j]));np++;}inter/=np;
 let intra=0,ni=0;for(const r of regions)for(const d of by.get(r)){intra+=dist(d,C.get(r));ni++;}intra/=ni;
 let ok=0;for(const it of list){const c2=new Map(regions.map(r=>{const ds=by.get(r).filter(d=>d!==it.d);return[r,ds.length?cent(ds):null];}));
  let best=null,bd=Infinity;for(const r of regions){const c=c2.get(r);if(!c)continue;const dd=dist(it.d,c);if(dd<bd){bd=dd;best=r;}}if(best===it.region)ok++;}
 return {regions:regions.length,images:list.length,loo:+(ok/list.length).toFixed(4),chance:+(1/regions.length).toFixed(4),fisher:+(inter/intra).toFixed(3)};}
const MWDIR=ROOT+'corpus/70-visual/refs/morrowind/REF-A21-regions';
const MW=(await import('node:fs')).readdirSync(MWDIR).filter(f=>/\.(jpg|jpeg|png)$/i.test(f)).map(f=>({file:MWDIR+'/'+f,region:f.split('__')[0]}));
for(const g of [['day'],['night']]){
  const sub=items.filter(i=>i.pass===g[0]);
  if(sub.length<13) { console.log(g[0],'-- only',sub.length,'frames, skipped'); continue; }
  for(const it of sub){ it.raw=rawD(it.file); it.str=strD(it.file); }
  console.log(g[0],'RAW      ',JSON.stringify(analyse(sub.map(s=>({region:s.region,d:s.raw})))));
  console.log(g[0],'STRUCTURE',JSON.stringify(analyse(sub.map(s=>({region:s.region,d:s.str})))));
}
for(const it of MW){ it.raw=rawD(it.file); it.str=strD(it.file); }
console.log('morrowind RAW      ',JSON.stringify(analyse(MW.map(s=>({region:s.region,d:s.raw})))));
console.log('morrowind STRUCTURE',JSON.stringify(analyse(MW.map(s=>({region:s.region,d:s.str})))));
