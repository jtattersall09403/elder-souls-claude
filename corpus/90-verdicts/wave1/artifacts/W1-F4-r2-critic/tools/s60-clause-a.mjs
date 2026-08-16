/**
 * S60 clause (a), computed INSIDE a configuration rather than inherited from another one.
 * `key_off` mean|d|rgb >= 2.0x `env_off` mean|d|rgb, ON THE LIT SUBSET — pixels the shadow map
 * reports unoccluded, i.e. pixels where switching the shadow off brightens them by <= tau.
 * Reported as a curve over tau, on the sealed judged crop (S64's domain) AND the full frame.
 * Written by the F4 r2 critic from ARBITRATION S60 and S64; not imported from the round's tool.
 */
import { execFileSync } from 'node:child_process';
const CROP = [300, 150, 512, 512], W = 1920, H = 1080;
const raw = (p) => execFileSync('ffmpeg', ['-loglevel','error','-i',p,'-f','rawvideo','-pix_fmt','rgb24','-'], { maxBuffer: 1<<28 });
const crop = (b) => { const [x0,y0,cw,ch]=CROP; const o=Buffer.alloc(cw*ch*3); for(let y=0;y<ch;y++) b.copy(o,y*cw*3,((y0+y)*W+x0)*3,((y0+y)*W+x0+cw)*3); return o; };
const luma = (b,i) => 0.2126*b[i*3]+0.7152*b[i*3+1]+0.0722*b[i*3+2];
function clauseA(base, soff, koff, eoff) {
  const n = Math.min(base.length, soff.length, koff.length, eoff.length)/3;
  const out = {};
  for (const tau of [1,2,4,8,16]) {
    let litN=0, litK=0, litE=0, area=0;
    for (let i=0;i<n;i++) {
      const dk=(Math.abs(base[i*3]-koff[i*3])+Math.abs(base[i*3+1]-koff[i*3+1])+Math.abs(base[i*3+2]-koff[i*3+2]))/3;
      const de=(Math.abs(base[i*3]-eoff[i*3])+Math.abs(base[i*3+1]-eoff[i*3+1])+Math.abs(base[i*3+2]-eoff[i*3+2]))/3;
      if (luma(soff,i)-luma(base,i) > tau) area++; else { litN++; litK+=dk; litE+=de; }
    }
    out[`tau${tau}`] = {
      lit_fraction: +(litN/n).toFixed(5),
      lit_key: +(litK/Math.max(1,litN)).toFixed(4),
      lit_env: +(litE/Math.max(1,litN)).toFixed(4),
      lit_ratio: +((litK/Math.max(1,litN))/Math.max(1e-9,litE/Math.max(1,litN))).toFixed(4),
      cast_shadow_area: +(area/n).toFixed(5),
    };
  }
  return out;
}
const d = process.argv[2];
const F = (n) => raw(`${d}/${n}.png`);
const b=F('y1-moonkey-lummatched'), s=F('y1-shadows_off'), k=F('y1-key_off'), e=F('y1-env_off');
console.log(JSON.stringify({
  configuration: 'y1-moonkey-lummatched — key recoloured to sky.js:644 0x8ca9d8 with intensity x1.4478 so Rec.709 luminous output is unchanged',
  bar: 'S60 clause (a): lit_ratio >= 2.0. S64: the sealed judged crop is the domain; the full frame is reported alongside.',
  sealed_judged_crop: clauseA(crop(b),crop(s),crop(k),crop(e)),
  full_frame: clauseA(b,s,k,e),
}, null, 1));
