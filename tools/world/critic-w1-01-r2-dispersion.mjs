#!/usr/bin/env node
/**
 * W1-01 round-2 critic instrument. Resolves the Fisher 3.01 -> 1.005 question by building the
 * LIKE-FOR-LIKE comparison the two runs never had, and by testing the instrument itself.
 *
 * Three descriptors over the same frames:
 *   raw   4x4 mean CIELAB                 (what critic-visual-dispersion.mjs uses)
 *   lnorm 4x4 CIELAB with per-image L centred+scaled  (removes global exposure/time-of-day)
 *   chrom 4x4 (a,b) only                  (pure palette+layout, no luminance at all)
 *
 * Four designs:
 *   pooled  everything, as shipped
 *   day     ours day pass only vs morrowind
 *   matched 9 regions x 3 images, both sides, 200 random draws, so region count, images per
 *           region and chance level are identical.
 */
import { readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const GW=4,GH=4,W=64,H=36;
function pixels(file){
  return execFileSync('ffmpeg',['-loglevel','error','-i',file,'-vf',`scale=${W}:${H}`,'-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:1<<26});
}
function lab(file){
  const raw=pixels(file);
  const lin=(c)=>(c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4));
  const f=(t)=>(t>0.008856?Math.cbrt(t):7.787*t+16/116);
  const acc=Array.from({length:GW*GH},()=>[0,0,0,0]);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*3;
    const r=lin(raw[i]/255),g=lin(raw[i+1]/255),b=lin(raw[i+2]/255);
    const X=(0.4124*r+0.3576*g+0.1805*b)/0.95047,Y=0.2126*r+0.7152*g+0.0722*b,Z=(0.0193*r+0.1192*g+0.9505*b)/1.08883;
    const L=116*f(Y)-16,A=500*(f(X)-f(Y)),B=200*(f(Y)-f(Z));
    const cell=Math.min(GH-1,Math.floor(y/H*GH))*GW+Math.min(GW-1,Math.floor(x/W*GW));
    acc[cell][0]+=L;acc[cell][1]+=A;acc[cell][2]+=B;acc[cell][3]++;
  }
  return acc.map(c=>[c[0]/c[3],c[1]/c[3],c[2]/c[3]]);
}
const raw_d   = (cells)=>cells.flat();
const chrom_d = (cells)=>cells.flatMap(c=>[c[1],c[2]]);
function lnorm_d(cells){
  const Ls=cells.map(c=>c[0]); const m=Ls.reduce((a,b)=>a+b)/Ls.length;
  const sd=Math.sqrt(Ls.reduce((a,b)=>a+(b-m)**2,0)/Ls.length)||1;
  // keep the SHAPE of the vertical luminance profile, drop absolute level and contrast
  return cells.flatMap(c=>[ (c[0]-m)/sd*20, c[1], c[2] ]);
}
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

function analyse(items){
  const by=new Map();
  for(const it of items){ if(!by.has(it.region)) by.set(it.region,[]); by.get(it.region).push(it.d); }
  const regions=[...by.keys()].sort();
  const cent=(ds)=>ds[0].map((_,i)=>ds.reduce((s,d)=>s+d[i],0)/ds.length);
  const C=new Map(regions.map(r=>[r,cent(by.get(r))]));
  let inter=0,np=0;
  for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++){inter+=dist(C.get(regions[i]),C.get(regions[j]));np++;}
  inter/=np;
  let intra=0,ni=0;
  for(const r of regions)for(const d of by.get(r)){intra+=dist(d,C.get(r));ni++;}
  intra/=ni;
  let correct=0; const conf=[];
  for(const it of items){
    const c2=new Map(regions.map(r=>{const ds=by.get(r).filter(d=>d!==it.d);return [r,ds.length?cent(ds):null];}));
    let best=null,bd=Infinity;
    for(const r of regions){const c=c2.get(r);if(!c)continue;const dd=dist(it.d,c);if(dd<bd){bd=dd;best=r;}}
    if(best===it.region)correct++;else conf.push({file:it.file,truth:it.region,predicted:best});
  }
  const pairs=[];
  for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++)pairs.push({a:regions[i],b:regions[j],d:+dist(C.get(regions[i]),C.get(regions[j])).toFixed(1)});
  pairs.sort((p,q)=>p.d-q.d);
  return {regions:regions.length,images:items.length,loo:+(correct/items.length).toFixed(4),chance:+(1/regions.length).toFixed(4),
    inter:+inter.toFixed(2),intra:+intra.toFixed(2),fisher:+(inter/intra).toFixed(3),closest:pairs.slice(0,5),confusions:conf.length};
}

// ---- load ----------------------------------------------------------------------------------
const ANS=JSON.parse(readFileSync('reports/region-shots/ANSWERS.json','utf8'));
const OURS=ANS.shots.map(s=>({file:join('reports/region-shots',s.frame),region:s.region,pass:s.pass,luma:s.mean_luma}));
const MWDIR='corpus/70-visual/refs/morrowind/REF-A21-regions';
const MW=readdirSync(MWDIR).filter(f=>/\.(jpg|jpeg|png)$/i.test(f))
  .map(f=>({file:join(MWDIR,f),region:f.split('__')[0],pass:'ref'}));
process.stderr.write(`ours ${OURS.length}  morrowind ${MW.length}\n`);
const cache=new Map();
const cells=(f)=>{ if(!cache.has(f)) cache.set(f,lab(f)); return cache.get(f); };
for(const it of [...OURS,...MW]) cells(it.file);

// Morrowind luma, to see whether their set is single-condition or mixed
const mwLuma=MW.map(m=>{const c=cells(m.file);return c.reduce((a,x)=>a+x[0],0)/c.length;});
const ourLumaByPass={};
for(const o of OURS){const c=cells(o.file);const L=c.reduce((a,x)=>a+x[0],0)/c.length;(ourLumaByPass[o.pass]=ourLumaByPass[o.pass]||[]).push(L);}
const stat=(v)=>({n:v.length,mean:+(v.reduce((a,b)=>a+b)/v.length).toFixed(1),sd:+Math.sqrt(v.reduce((a,b)=>a+(b-v.reduce((x,y)=>x+y)/v.length)**2,0)/v.length).toFixed(1),min:+Math.min(...v).toFixed(1),max:+Math.max(...v).toFixed(1)});

const DESC={raw:raw_d,lnorm:lnorm_d,chrom:chrom_d};
const out={schema:'critic/w1-01-r2-dispersion@1',measured_at:new Date().toISOString(),grid:'4x4',
  populations_note:'ours = reports/region-shots (117, 13 regions, 3 passes). morrowind = REF-A21-regions (39, 9 regions).',
  mean_L:{morrowind:stat(mwLuma),ours:Object.fromEntries(Object.entries(ourLumaByPass).map(([k,v])=>[k,stat(v)]))},
  designs:{}};

function build(items,desc){ return items.map(it=>({...it,d:desc(cells(it.file))})); }

for(const [dn,desc] of Object.entries(DESC)){
  const D={};
  D.ours_pooled  = analyse(build(OURS,desc));
  D.ours_day     = analyse(build(OURS.filter(o=>o.pass==='day'),desc));
  D.ours_night   = analyse(build(OURS.filter(o=>o.pass==='night'),desc));
  D.ours_worst   = analyse(build(OURS.filter(o=>o.pass==='worst'),desc));
  D.morrowind    = analyse(build(MW,desc));
  // matched: 9 regions x 3 images, 200 draws, both sides
  const draw=(items,seed)=>{
    let s=seed>>>0; const rnd=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
    const by=new Map(); for(const it of items){ if(!by.has(it.region))by.set(it.region,[]); by.get(it.region).push(it); }
    const regs=[...by.keys()]; for(let i=regs.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[regs[i],regs[j]]=[regs[j],regs[i]];}
    const pick=[];
    for(const r of regs.slice(0,9)){ const pool=by.get(r).slice();
      for(let i=pool.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
      pick.push(...pool.slice(0,3)); }
    return pick;
  };
  const matched=(items,desc)=>{
    const F=[],L=[];
    for(let k=0;k<200;k++){ const a=analyse(build(draw(items,1337+k),desc)); F.push(a.fisher); L.push(a.loo); }
    const mean=(v)=>+(v.reduce((a,b)=>a+b)/v.length).toFixed(3);
    const sd=(v)=>{const m=v.reduce((a,b)=>a+b)/v.length;return +Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length).toFixed(3);};
    v => v;
    return {design:'9 regions x 3 images, 200 random draws',fisher_mean:mean(F),fisher_sd:sd(F),loo_mean:mean(L),loo_sd:sd(L),chance:+(1/9).toFixed(4)};
  };
  D.matched_ours_day   = matched(OURS.filter(o=>o.pass==='day'),desc);
  D.matched_ours_pooled= matched(OURS,desc);
  D.matched_morrowind  = matched(MW,desc);
  out.designs[dn]=D;
  console.log(`\n=== descriptor ${dn} ===`);
  for(const [k,v] of Object.entries(D)){
    if(v.fisher_mean!==undefined) console.log(`  ${k.padEnd(22)} fisher ${v.fisher_mean} +/-${v.fisher_sd}   LOO ${(v.loo_mean*100).toFixed(1)}%  (chance ${(v.chance*100).toFixed(1)}%)`);
    else console.log(`  ${k.padEnd(22)} fisher ${String(v.fisher).padStart(6)}   LOO ${(v.loo*100).toFixed(1)}%  (chance ${(v.chance*100).toFixed(1)}%)  n=${v.images} regions=${v.regions}  inter ${v.inter} intra ${v.intra}`);
  }
}
writeFileSync('corpus/90-verdicts/wave1/artifacts/W1-01-r2/critic-dispersion-likeforlike.json',JSON.stringify(out,null,1)+'\n');
console.log('\nwrote corpus/90-verdicts/wave1/artifacts/W1-01-r2/critic-dispersion-likeforlike.json');
console.log('\nmean L: morrowind',JSON.stringify(out.mean_L.morrowind),'\n         ours',JSON.stringify(out.mean_L.ours));
