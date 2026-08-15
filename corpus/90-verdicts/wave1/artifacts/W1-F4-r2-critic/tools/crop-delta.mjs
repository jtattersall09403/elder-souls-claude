// Independent re-derivation of the F4 r2 light-budget ablation on the SEALED JUDGED CROP.
// Written from RI-VIS04 §3-D2 / S60 / S64 by the F4 r2 critic. Does not import the builder's tool.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const CROP = [300, 150, 512, 512];
const W = 1920, H = 1080;
function raw(p) {
  return execFileSync('ffmpeg', ['-loglevel','error','-i',p,'-f','rawvideo','-pix_fmt','rgb24','-'], { maxBuffer: 1<<28 });
}
function cropBuf(b, w, h, [x0,y0,cw,ch]) {
  const out = Buffer.alloc(cw*ch*3);
  for (let y=0;y<ch;y++) b.copy(out, y*cw*3, ((y0+y)*w + x0)*3, ((y0+y)*w + x0 + cw)*3);
  return out;
}
function meanAbsD(a,b){ let s=0; const n=Math.min(a.length,b.length); for(let i=0;i<n;i++) s+=Math.abs(a[i]-b[i]); return s/n; }
const dir = process.argv[2];
const files = fs.readdirSync(dir).filter(f=>f.endsWith('.png'));
const bufs = {};
for (const f of files) { const r = raw(path.join(dir,f)); bufs[f.replace('.png','')] = { full: r, crop: cropBuf(r, W, H, CROP) }; }
const base = bufs.base;
const out = { dir, crop: CROP, full: {}, sealed_crop: {} };
for (const k of Object.keys(bufs)) {
  if (k === 'base') continue;
  out.full[k] = +meanAbsD(base.full, bufs[k].full).toFixed(4);
  out.sealed_crop[k] = +meanAbsD(base.crop, bufs[k].crop).toFixed(4);
}
console.log(JSON.stringify(out, null, 1));
