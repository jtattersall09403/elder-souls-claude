import { readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const W=160,H=90;
function gray(file){
  const raw=execFileSync('ffmpeg',['-loglevel','error','-i',file,'-vf',`scale=${W}:${H}`,'-f','rawvideo','-pix_fmt','gray','-'],{maxBuffer:1<<26});
  return raw;
}
function chromaMean(file){ // mean saturation, to show how much of the signal is tint
  const raw=execFileSync('ffmpeg',['-loglevel','error','-i',file,'-vf',`scale=${W}:${H}`,'-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:1<<26});
  let s=0;for(let i=0;i<raw.length;i+=3){const mx=Math.max(raw[i],raw[i+1],raw[i+2]),mn=Math.min(raw[i],raw[i+1],raw[i+2]);s+=mx?(mx-mn)/mx:0;}
  return s/(raw.length/3);
}
// STRUCTURE ONLY: per-cell Sobel edge density + per-cell L variance, both z-scored per image.
function structDesc(file){
  const g=gray(file);
  const at=(x,y)=>g[y*W+x];
  const GW=6,GH=4;
  const acc=Array.from({length:GW*GH},()=>[0,0,0,0]); // edge, var-sum, mean-sum, n
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
    const gx=(at(x+1,y-1)+2*at(x+1,y)+at(x+1,y+1))-(at(x-1,y-1)+2*at(x-1,y)+at(x-1,y+1));
    const gy=(at(x-1,y+1)+2*at(x,y+1)+at(x+1,y+1))-(at(x-1,y-1)+2*at(x,y-1)+at(x+1,y-1));
    const m=Math.hypot(gx,gy);
    const c=Math.min(GH-1,Math.floor(y/H*GH))*GW+Math.min(GW-1,Math.floor(x/W*GW));
    acc[c][0]+=m; acc[c][2]+=at(x,y); acc[c][3]++;
  }
  const e=acc.map(c=>c[0]/c[3]); const mu=acc.map(c=>c[2]/c[3]);
  const norm=(v)=>{const m=v.reduce((a,b)=>a+b)/v.length;const sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length)||1;return v.map(x=>(x-m)/sd*20);};
  return [...norm(e), ...norm(mu)];
}
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function analyse(items){
  const by=new Map(); for(const it of items){ if(!by.has(it.region))by.set(it.region,[]); by.get(it.region).push(it.d); }
  const regions=[...by.keys()].sort();
  const cent=(ds)=>ds[0].map((_,i)=>ds.reduce((s,d)=>s+d[i],0)/ds.length);
  const C=new Map(regions.map(r=>[r,cent(by.get(r))]));
  let inter=0,np=0; for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++){inter+=dist(C.get(regions[i]),C.get(regions[j]));np++;} inter/=np;
  let intra=0,ni=0; for(const r of regions)for(const d of by.get(r)){intra+=dist(d,C.get(r));ni++;} intra/=ni;
  let ok=0; for(const it of items){ const c2=new Map(regions.map(r=>{const ds=by.get(r).filter(d=>d!==it.d);return[r,ds.length?cent(ds):null];}));
    let best=null,bd=Infinity; for(const r of regions){const c=c2.get(r);if(!c)continue;const dd=dist(it.d,c);if(dd<bd){bd=dd;best=r;}} if(best===it.region)ok++; }
  return {regions:regions.length,images:items.length,loo:+(ok/items.length).toFixed(4),chance:+(1/regions.length).toFixed(4),fisher:+(inter/intra).toFixed(3)};
}
const ANS=JSON.parse(readFileSync('reports/region-shots/ANSWERS.json','utf8'));
const OURS=ANS.shots.filter(s=>s.pass==='day').map(s=>({file:join('reports/region-shots',s.frame),region:s.region}));
const MWDIR='corpus/70-visual/refs/morrowind/REF-A21-regions';
const MW=readdirSync(MWDIR).filter(f=>/\.(jpg|jpeg|png)$/i.test(f)).map(f=>({file:join(MWDIR,f),region:f.split('__')[0]}));
for(const it of [...OURS,...MW]) it.d=structDesc(it.file);
const o=analyse(OURS), m=analyse(MW);
console.log('STRUCTURE-ONLY (Sobel edge density + luminance layout, colour and exposure removed)');
console.log('  ours_day  ', JSON.stringify(o));
console.log('  morrowind ', JSON.stringify(m));
const oc=OURS.map(x=>chromaMean(x.file)), mc=MW.map(x=>chromaMean(x.file));
const mean=v=>+(v.reduce((a,b)=>a+b)/v.length).toFixed(3);
console.log('mean saturation: ours_day',mean(oc),' morrowind',mean(mc));
writeFileSync('corpus/90-verdicts/wave1/artifacts/W1-01-r2/critic-structure-only.json',JSON.stringify({
 schema:'critic/structure-only@1',
 note:'Region identity with colour and exposure removed. Descriptor = 6x4 grid of Sobel edge density plus 6x4 luminance layout, both z-scored per image, so only silhouette/prop density/composition survive.',
 ours_day:o, morrowind:m, mean_saturation:{ours_day:mean(oc),morrowind:mean(mc)}},null,1)+'\n');
