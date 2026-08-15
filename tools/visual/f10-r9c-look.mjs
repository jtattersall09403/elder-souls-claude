#!/usr/bin/env node
/**
 * f10-r9c-look.mjs — the critic's LOOKING tool for the F10 r9 stance pair.
 *
 * The character directive binds critics as hard as builders: *"critics must [look at actual
 * screenshots and motion captures] as well"*, and `CRITIC-DOCTRINE` §1.3 step 1 is "render the thing
 * and look at it FIRST". A 960x540 frame in which the figure is ~230 px wide is not a look — a five
 * degree shoulder tilt at that scale is two pixels. So this builds, for each bearing:
 *
 *   1. a 2x nearest-neighbour crop of the figure box, BEFORE beside AFTER, for the eye;
 *   2. a difference mask, so a change too small to see is still *located*;
 *
 * and it prints the pixel statistics that say whether the two arms are the same picture. It is
 * deliberately dumb: no rasteriser of its own, no rig, no model. It reads the PNGs the paid
 * hardware run produced and nothing else.
 *
 * Usage: node tools/visual/f10-r9c-look.mjs --run <runDir> --out <dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const RUN = path.resolve(args.run || '.');
const OUT = path.resolve(args.out || 'reports/visual-truth/f10-r9c-look');
fs.mkdirSync(OUT, { recursive: true });

const PY = `
import sys, json, os
from PIL import Image

run, out = sys.argv[1], sys.argv[2]
rows = []
for slot, names in (('CP', ['yaw000','yaw045','yaw090','yaw135','yaw180','yaw225','yaw270','yaw315']),
                    ('FP', ['b000','b045','b090','b180'])):
    for n in names:
        fn = f'{slot}__player__{n}.png'
        pa = os.path.join(run, 'stance-pair', 'after', 'frames', fn)
        pb = os.path.join(run, 'stance-pair', 'before', 'frames', fn)
        if not (os.path.exists(pa) and os.path.exists(pb)):
            rows.append({'frame': fn, 'status': 'missing'}); continue
        A = Image.open(pa).convert('RGB'); B = Image.open(pb).convert('RGB')
        W, H = A.size
        pa_px = A.load(); pb_px = B.load()
        # difference statistics over the WHOLE frame, and the bounding box of every changed pixel
        changed = 0; maxd = 0; sumd = 0
        x0, y0, x1, y1 = W, H, -1, -1
        diff = Image.new('RGB', (W, H))
        dpx = diff.load()
        for y in range(H):
            for x in range(W):
                r1,g1,b1 = pa_px[x,y]; r2,g2,b2 = pb_px[x,y]
                d = abs(r1-r2)+abs(g1-g2)+abs(b1-b2)
                if d:
                    changed += 1; sumd += d
                    if d > maxd: maxd = d
                    if x < x0: x0 = x
                    if y < y0: y0 = y
                    if x > x1: x1 = x
                    if y > y1: y1 = y
                    v = min(255, d*4)
                    dpx[x,y] = (v, v//2, 0)
        rows.append({'frame': fn, 'slot': slot, 'changed_px': changed, 'changed_pct': round(100.0*changed/(W*H), 3),
                     'max_channel_sum_delta': maxd, 'mean_delta_over_changed': round(sumd/changed, 2) if changed else 0,
                     'changed_bbox': [x0,y0,x1,y1] if x1 >= 0 else None})
        diff.save(os.path.join(out, f'DIFF__{fn}'))
        # side-by-side 2x crop of the figure box (CP) or the head box (FP)
        if slot == 'CP':
            box = (340, 30, 620, 500)
        else:
            box = (300, 60, 660, 480)
        ca = A.crop(box); cb = B.crop(box)
        w, h = ca.size
        sheet = Image.new('RGB', (w*2*2 + 24, h*2), (16,16,16))
        sheet.paste(cb.resize((w*2, h*2), Image.NEAREST), (0,0))
        sheet.paste(ca.resize((w*2, h*2), Image.NEAREST), (w*2+24, 0))
        sheet.save(os.path.join(out, f'PAIR__{fn}'))
print(json.dumps(rows, indent=2))
`;

const r = spawnSync('python3', ['-c', PY, RUN, OUT], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (r.status !== 0) { process.stderr.write(r.stderr || ''); process.exit(1); }
fs.writeFileSync(path.join(OUT, 'look.json'), r.stdout);
process.stdout.write(r.stdout);
