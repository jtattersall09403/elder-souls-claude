#!/usr/bin/env node
/**
 * f10-r10c-look.mjs — the F10 r10 critic's LOOKING tool.
 *
 * The character directive binds critics as hard as builders: *"critics must [look at actual
 * screenshots and motion captures] as well"*, and stills at native scale are not a look. At the
 * capture's own framing a 1920x1080 CP frame is 376 px per metre, so the 5.2 mm left/right ankle
 * difference this round declined to chase is **1.96 px** and the 7.96 mm drop it did make is
 * **3.0 px**. Neither is judgeable without magnification, and magnification without a stated
 * scale is how "it looks fine" gets written down.
 *
 * So, per frame pair, this produces:
 *   1. a magnified crop of the region under test, BEFORE above AFTER, with the px-per-metre and
 *      the millimetre-per-pixel printed into the manifest;
 *   2. a difference mask, so a change too small to SEE is still LOCATED;
 *   3. the pixel statistics that say whether the two arms are the same picture.
 *
 * It owns no rasteriser, no rig and no model: it reads the PNGs the paid hardware run produced.
 *
 * Usage: node tools/visual/f10-r10c-look.mjs --run <pairDir> --out <dir>
 *        node tools/visual/f10-r10c-look.mjs --self-test
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

const PY = String.raw`
import sys, json, os, math
from PIL import Image

MODE = sys.argv[1]

def stats(A, B):
    W, H = A.size
    pa, pb = A.load(), B.load()
    changed = 0; sumd = 0; maxd = 0
    x0, y0, x1, y1 = W, H, -1, -1
    diff = Image.new('RGB', (W, H))
    dp = diff.load()
    for y in range(H):
        for x in range(W):
            r1,g1,b1 = pa[x,y]; r2,g2,b2 = pb[x,y]
            d = abs(r1-r2)+abs(g1-g2)+abs(b1-b2)
            if d:
                changed += 1; sumd += d
                if d > maxd: maxd = d
                if x < x0: x0 = x
                if y < y0: y0 = y
                if x > x1: x1 = x
                if y > y1: y1 = y
                v = min(255, d*3)
                dp[x,y] = (v, v//3, 0)
    return diff, {'changed_px': changed, 'changed_frac': round(changed/(W*H), 6),
                  'mean_delta_over_changed': round(sumd/changed, 2) if changed else 0,
                  'max_delta': maxd,
                  'bbox': [x0, y0, x1, y1] if x1 >= 0 else None}

if MODE == 'self-test':
    # Arm A: two identical frames must report ZERO changed pixels.
    a = Image.new('RGB', (40, 40), (10, 20, 30))
    _, s0 = stats(a, a.copy())
    armA = (s0['changed_px'] == 0 and s0['bbox'] is None)
    # Arm B: a single known pixel changed must be found, counted once, and located exactly.
    b = a.copy(); b.load()[7, 11] = (10, 20, 40)
    _, s1 = stats(a, b)
    armB = (s1['changed_px'] == 1 and s1['bbox'] == [7, 11, 7, 11] and s1['max_delta'] == 10)
    # Arm C: the two arms MUST disagree — an instrument that reports the same thing for an
    # identical pair and a different pair cannot be evidence of anything.
    armC = (s0['changed_px'] != s1['changed_px'])
    print(json.dumps({'arm_identical_reads_zero': armA, 'arm_one_known_pixel_is_found': armB,
                      'arms_disagree': armC, 'pass': armA and armB and armC}))
    sys.exit(0 if (armA and armB and armC) else 1)

run, out = sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)

# ── framing arithmetic, published rather than assumed ────────────────────────────────────────
FOV = 60.0
SUBJ = 1.78            # skeleton height_m, the CP box
FACE = 0.34            # REGION.face.box_m, the FP box
FILL = 0.62
def dist(box): return box / (2*FILL*math.tan(math.radians(FOV/2)))
def px_per_m(box, H): return H / (2*math.tan(math.radians(FOV/2))*dist(box))

rows = []
manifest = {'geometry': {}}

def do(slot, name, box, crop_frac, zoom, tag):
    fn = f'{slot}__player__{name}.png'
    pa = os.path.join(run, 'after', 'frames', fn)
    pb = os.path.join(run, 'before', 'frames', fn)
    if not (os.path.exists(pa) and os.path.exists(pb)):
        rows.append({'frame': fn, 'status': 'missing'}); return
    A = Image.open(pa).convert('RGB'); B = Image.open(pb).convert('RGB')
    W, H = A.size
    ppm = px_per_m(box, H)
    diff, s = stats(A, B)
    # crop_frac = (x0, y0, x1, y1) as fractions of the frame
    cx0, cy0, cx1, cy1 = [int(round(v*(W if i % 2 == 0 else H))) for i, v in enumerate(crop_frac)]
    ca = A.crop((cx0, cy0, cx1, cy1)); cb = B.crop((cx0, cy0, cx1, cy1))
    cd = diff.crop((cx0, cy0, cx1, cy1))
    cw, ch = ca.size
    za = ca.resize((cw*zoom, ch*zoom), Image.NEAREST)
    zb = cb.resize((cw*zoom, ch*zoom), Image.NEAREST)
    zd = cd.resize((cw*zoom, ch*zoom), Image.NEAREST)
    sheet = Image.new('RGB', (cw*zoom, ch*zoom*3 + 8), (24, 24, 28))
    sheet.paste(zb, (0, 0))
    sheet.paste(za, (0, ch*zoom + 4))
    sheet.paste(zd, (0, ch*zoom*2 + 8))
    sheet.save(os.path.join(out, f'{tag}__{slot}-{name}__BEFORE-top_AFTER-mid_DIFF-bottom__{zoom}x.png'))
    row = {'frame': fn, 'tag': tag, 'canvas': [W, H], 'px_per_m': round(ppm, 1),
           'mm_per_px': round(1000.0/ppm, 3), 'camera_dist_m': round(dist(box), 3),
           'crop_px': [cx0, cy0, cx1, cy1], 'zoom': zoom}
    row.update(s)
    rows.append(row)

# CP — the whole figure. FEET crop: bottom fifth, middle third.
for n in ['yaw000', 'yaw090', 'yaw180']:
    do('CP', n, SUBJ, (0.36, 0.76, 0.64, 0.97), 6, 'FEET')
# CP — whole figure at 2x, so the stance is judged as a figure and not as a pair of ankles.
for n in ['yaw000', 'yaw090']:
    do('CP', n, SUBJ, (0.30, 0.05, 0.70, 0.99), 2, 'FIGURE')
# FP — the face. The eye sits upper-middle at every bearing.
for n in ['b000', 'b045', 'b090', 'b180']:
    do('FP', n, FACE, (0.28, 0.20, 0.72, 0.62), 5, 'FACE')

manifest['geometry'] = {
    'CP_camera_dist_m': round(dist(SUBJ), 3), 'FP_camera_dist_m': round(dist(FACE), 3),
    'gameplay_free_arm_m': 4.10,
    'note': 'CAMERA_CONST.arm_free_m = 4.10 m is the arm a player actually orbits at; the CP capture stands CLOSER than that, so it is a MORE generous test of visibility than gameplay, not a less generous one.',
}
manifest['frames'] = rows
open(os.path.join(out, 'look.json'), 'w').write(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'frames': len(rows), 'out': out}, indent=2))
`;

if (args['self-test']) {
  const r = spawnSync('python3', ['-c', PY, 'self-test'], { stdio: 'inherit' });
  process.exit(r.status === null ? 1 : r.status);
}

const RUN = path.resolve(args.run || '.');
const OUT = path.resolve(args.out || 'reports/visual-truth/f10-r10c-look');
fs.mkdirSync(OUT, { recursive: true });
const r = spawnSync('python3', ['-c', PY, 'run', RUN, OUT], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
