// Evaluate candidate subject-presence statistics against a REAL labelled set:
// the F10 hardware run, where the 17 frames of npc-lilmoth-apothecary-12 are known to be empty
// (she stands out at sea off the Lilmoth pier) and the other 76 are known to contain a subject.
import fs from 'node:fs'; import path from 'node:path'; import { PNG } from 'pngjs';
const RUN='reports/runpod-gpu/runs/f10-characters-hw3/artifacts/f10/hw';
const man=JSON.parse(fs.readFileSync(path.join(RUN,'manifest.json'),'utf8'));
const H=man.canvas[1], W=man.canvas[0];
const rows=[];
for(const r of man.rows){
  const fr=r.framing||{}; const h=fr.head?.ndc, f=fr.foot?.ndc;
  const p=path.join(RUN,'frames',r.file); if(!fs.existsSync(p)) continue;
  const png=PNG.sync.read(fs.readFileSync(p));
  // box: from projected head/foot when present, else centre fallback
  let box;
  if(h&&f){ const a=(1-h[1])/2*H, b=(1-f[1])/2*H;
    box={y0:Math.max(0,Math.round(Math.min(a,b))), y1:Math.min(png.height-1,Math.round(Math.max(a,b)))};
  } else box={y0:Math.round(png.height*0.15), y1:Math.round(png.height*0.9)};
  const bh=box.y1-box.y0+1;
  // CANDIDATE: centre-vs-flank. A figure occupies the middle columns of its own rows; the
  // flanking columns of the SAME rows are its immediate background. Scale-free, no colour set.
  const cw=Math.round(png.width*0.10);           // centre half-width
  const fw=Math.round(png.width*0.10);           // flank width, offset from centre
  const cx=Math.round(png.width/2);
  const lum=(x,y)=>{const i=(y*png.width+x)*4; return 0.2126*png.data[i]+0.7152*png.data[i+1]+0.0722*png.data[i+2];};
  const rgb=(x,y)=>{const i=(y*png.width+x)*4; return [png.data[i],png.data[i+1],png.data[i+2]];};
  let diffSum=0, n=0, rowsDiff=0;
  for(let y=box.y0;y<=box.y1;y++){
    let c=0,cn=0,l=0,ln=0;
    for(let x=cx-cw;x<=cx+cw;x++){ if(x<0||x>=png.width)continue; c+=lum(x,y); cn++; }
    for(let x=cx-cw-fw*2;x<cx-cw;x++){ if(x<0)continue; l+=lum(x,y); ln++; }
    for(let x=cx+cw+1;x<=cx+cw+fw*2;x++){ if(x>=png.width)continue; l+=lum(x,y); ln++; }
    if(!cn||!ln) continue;
    const d=Math.abs(c/cn-l/ln); diffSum+=d; n++; if(d>3) rowsDiff++;
  }
  const centre_flank_luma = n? diffSum/n : 0;
  const centre_flank_rows = n? rowsDiff/n : 0;
  // CANDIDATE 2: colour distance centre vs flank, in RGB, median over rows.
  const cd=[];
  for(let y=box.y0;y<=box.y1;y++){
    let cr=0,cg=0,cb=0,cn=0, lr=0,lg=0,lb=0,ln=0;
    for(let x=cx-cw;x<=cx+cw;x++){ if(x<0||x>=png.width)continue; const p2=rgb(x,y); cr+=p2[0];cg+=p2[1];cb+=p2[2];cn++; }
    for(let x=cx-cw-fw*2;x<cx-cw;x++){ if(x<0)continue; const p2=rgb(x,y); lr+=p2[0];lg+=p2[1];lb+=p2[2];ln++; }
    for(let x=cx+cw+1;x<=cx+cw+fw*2;x++){ if(x>=png.width)continue; const p2=rgb(x,y); lr+=p2[0];lg+=p2[1];lb+=p2[2];ln++; }
    if(!cn||!ln) continue;
    cd.push(Math.abs(cr/cn-lr/ln)+Math.abs(cg/cn-lg/ln)+Math.abs(cb/cn-lb/ln));
  }
  cd.sort((a,b)=>a-b);
  const centre_flank_rgb = cd.length? cd[cd.length>>1] : 0;
  // Normalise by the frame's OWN contrast. Night frames are globally low-contrast, so a raw
  // centre-vs-flank difference collapses on them and reads as "nobody there" — that confound is
  // 6 of the 9 false reds at the raw operating point. Dividing by the frame's pixel standard
  // deviation asks the scale-free question instead: does the centre stand out FOR THIS FRAME.
  let sum=0,sum2=0,np=0;
  for(let y=0;y<png.height;y+=2) for(let x=0;x<png.width;x+=2){ const v=lum(x,y); sum+=v; sum2+=v*v; np++; }
  const pstd=Math.sqrt(Math.max(0,sum2/np-(sum/np)**2));
  const cf_norm = pstd>0.5 ? centre_flank_luma/pstd : 0;
  const cf_rgb_norm = pstd>0.5 ? centre_flank_rgb/pstd : 0;
  rows.push({file:r.file, subject:r.subject, empty:r.subject==='npc-lilmoth-apothecary-12',
    pixel_std:+pstd.toFixed(3), cf_norm:+cf_norm.toFixed(4), cf_rgb_norm:+cf_rgb_norm.toFixed(4),
    boxed:Boolean(h&&f), bh, centre_flank_luma:+centre_flank_luma.toFixed(3),
    centre_flank_rows:+centre_flank_rows.toFixed(3), centre_flank_rgb:+centre_flank_rgb.toFixed(3)});
}
const emp=rows.filter(r=>r.empty), full=rows.filter(r=>!r.empty);
console.log(`frames=${rows.length}  known-empty=${emp.length}  known-full=${full.length}`);
for(const k of ['centre_flank_luma','centre_flank_rgb','cf_norm','cf_rgb_norm']){
  const e=emp.map(r=>r[k]).sort((a,b)=>a-b), f=full.map(r=>r[k]).sort((a,b)=>a-b);
  console.log(`${k.padEnd(20)} EMPTY min=${e[0]} med=${e[e.length>>1]} max=${e[e.length-1]}   FULL min=${f[0]} med=${f[f.length>>1]} max=${f[f.length-1]}`);
}
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/eval-subject.json', JSON.stringify(rows,null,1));
