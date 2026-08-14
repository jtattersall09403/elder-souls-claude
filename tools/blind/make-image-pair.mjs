#!/usr/bin/env node
/**
 * make-image-pair.mjs — the pair-CONSTRUCTION half of RI-VIS06 Protocol A.
 *
 * WHY THIS EXISTS AND WHY IT IS NOT make-pair.mjs
 * ----------------------------------------------
 * `tools/blind/make-pair.mjs` does the blind ASSEMBLY correctly — coin flip under a recorded
 * seed, A/B naming, PNG re-encode through one writer, key written outside the pack — and this
 * tool does not duplicate any of it. What make-pair.mjs does NOT do is the part RI-VIS06 §A and
 * §D actually require before assembly, and which decides whether the pack is blind at all:
 *
 *   §D "Resolution / aspect mismatch"  — our frame and the plate must arrive at IDENTICAL
 *                                        dimensions. make-pair.mjs copies whatever it is given.
 *   §D "Compression artefacts"         — "never mix a JPEG reference with a PNG capture".
 *                                        Every plate under refs/modern/ is a JPEG; every frame
 *                                        the Deck takes is a PNG. Decoding the JPEG to PNG does
 *                                        NOT remove its DCT blocking, it only renames the file.
 *   §D "HUD, watermark, subtitle"      — our Deck frames carry a shipped HUD drawn INTO the
 *                                        WebGL canvas (bars top-left, compass top-right, hotbar
 *                                        bottom-right), and there is no HUD-off mode: `minimal`
 *                                        still draws bars and compass. Three of the thirteen
 *                                        character_closeup plates carry burnt-in subtitles.
 *   §A "subject-neutral crop"          — the escape hatch the item itself provides, and the only
 *                                        way to satisfy the HUD row without a renderer change.
 *
 * So this tool crops both sides to the same native-pixel window (no resampling of either side —
 * a resize is itself a tell, and RI-VIS06 "How we lose" names resizing as the leak that teaches
 * you nothing about fidelity), and then, if asked, passes BOTH sides through the identical JPEG
 * quantiser so the compression channel carries the same artefacts on both arms rather than
 * marking one of them. Equalising a channel is not softening the test: the thing under
 * judgement is material response, light, shadow, edges and depth, and all of those survive a
 * shared q=95 round trip. What does not survive is "the blocky one is the reference".
 *
 * IT REPORTS THE CHANNEL IT CLOSED. `--stats` prints the blockiness, sharpness and tonal
 * statistics of each crop before and after, so a reviewer can see whether the round trip was
 * needed and whether it worked, rather than taking the word of the agent that ran it.
 *
 * USAGE
 *   node tools/blind/make-image-pair.mjs --in <img> --crop x,y,w,h --out <png> [--jpeg-q 95]
 *   node tools/blind/make-image-pair.mjs --stats <png> [<png> ...]
 *
 * It writes ONE normalised crop. Pairing, the coin flip and the sealed key stay in
 * make-pair.mjs, which is the audited tool for that job.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const args = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const k = argv[i].slice(2);
    args[k] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
  } else positional.push(argv[i]);
}

/** Decode any image to raw RGB via python/Pillow, which is the one decoder present on this box. */
function py(script, ...a) {
  return execFileSync('python3', ['-c', script, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });
}

const CROP_AND_WRITE = `
import sys, io, json
from PIL import Image
src, dst, box, q = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
x, y, w, h = [int(v) for v in box.split(',')]
im = Image.open(src).convert('RGB')
W, H = im.size
if x < 0 or y < 0 or x + w > W or y + h > H:
    print(json.dumps({'error': f'crop {box} does not fit inside {W}x{H}'})); sys.exit(2)
crop = im.crop((x, y, x + w, y + h))
note = 'native 1:1 crop, no resampling'
if q != 'none':
    # Both arms of the pack go through this identical quantiser. See the header.
    buf = io.BytesIO(); crop.save(buf, format='JPEG', quality=int(q), subsampling=0)
    buf.seek(0); crop = Image.open(buf).convert('RGB')
    note = f'native 1:1 crop, then a shared JPEG q={q} round trip (4:4:4), then PNG'
# Pillow writes no text chunks unless asked; this is the single PNG writer for BOTH arms.
crop.save(dst, format='PNG', optimize=False)
print(json.dumps({'ok': True, 'source_size': [W, H], 'crop': [x, y, w, h], 'note': note}))
`;

const STATS = `
import sys, json, math
from PIL import Image
out = []
for p in sys.argv[1:]:
    im = Image.open(p).convert('L')
    w, h = im.size
    px = im.load()
    # JPEG blockiness: mean |gradient| across the 8-pixel grid vs off-grid. A JPEG-quantised
    # image has stronger discontinuities exactly on the 8x8 boundaries; a PNG straight out of a
    # renderer has none. This is the discriminator §D's "compression artefacts" row is about,
    # and it is the reason a decoded-to-PNG JPEG is still a labelled arm.
    on = off = non = noff = 0.0
    for yy in range(h):
        for xx in range(1, w):
            d = abs(px[xx, yy] - px[xx - 1, yy])
            if xx % 8 == 0: on += d; non += 1
            else: off += d; noff += 1
    blockiness = (on / max(non, 1)) / max(off / max(noff, 1), 1e-9)
    # Edge energy: mean |Laplacian|, a plain sharpness proxy.
    lap = 0.0; n = 0
    for yy in range(1, h - 1):
        for xx in range(1, w - 1):
            lap += abs(4 * px[xx, yy] - px[xx - 1, yy] - px[xx + 1, yy] - px[xx, yy - 1] - px[xx, yy + 1]); n += 1
    hist = im.histogram()
    tot = sum(hist)
    mean = sum(i * c for i, c in enumerate(hist)) / tot / 255.0
    var = sum(((i / 255.0) - mean) ** 2 * c for i, c in enumerate(hist)) / tot
    out.append({'file': p, 'w': w, 'h': h,
                'blockiness_8px': round(blockiness, 4),
                'edge_energy': round(lap / max(n, 1), 3),
                'mean_luma': round(mean, 4), 'sd_luma': round(math.sqrt(var), 4),
                'distinct_levels': sum(1 for c in hist if c)})
print(json.dumps(out, indent=1))
`;

if (args.stats) {
  const files = [args.stats === true ? null : args.stats, ...positional].filter(Boolean);
  process.stdout.write(py(STATS, ...files));
  process.exit(0);
}

if (!args.in || !args.crop || !args.out) {
  console.error('usage: node tools/blind/make-image-pair.mjs --in <img> --crop x,y,w,h --out <png> [--jpeg-q 95|none]');
  console.error('       node tools/blind/make-image-pair.mjs --stats <png> [<png> ...]');
  process.exit(1);
}
fs.mkdirSync(path.dirname(path.resolve(String(args.out))), { recursive: true });
const q = args['jpeg-q'] === undefined ? '95' : String(args['jpeg-q']);
const res = JSON.parse(py(CROP_AND_WRITE, String(args.in), String(args.out), String(args.crop), q));
if (res.error) { console.error(res.error); process.exit(2); }
console.log(JSON.stringify({ ...res, out: String(args.out) }));
