#!/usr/bin/env node
// cam-occlusion-walk.mjs — RI-CAM01 SS C.1's own bar, measured densely, on the real world.
//
// WHY THIS FILE EXISTS. RI-CAM01 SS C.1's automatic-fail condition ("any run of
// player_occluded longer than 6 consecutive frames") is what caps RI-CAM01 at 2/10
// (corpus/90-verdicts/wave1/W1-FIRST-TEN-MINUTES-r1.md SS5, "d1-f360-camera-inside-a-tree").
// Nothing in this repo has ever measured THAT bar. `tools/camera/cam-probe.mjs`'s M2/M3/M4
// probes run against synthetic COLLISION-ONLY cells (cam-walk-cistern etc.) built from
// `sim.cell.sphereCast()`'s collision set — and a tree, per that verdict, is not in that set
// at all, so those probes cannot see a tree occluder even in principle.
// `tools/visual/occlusion-sightline-check.mjs` exercises the shipped method
// (`Province.updateOcclusion`) but against a SYNTHETIC one-tree scene, not the real walk, and
// it does not compute a player_occluded run.
//
// THE MEASURE, per SS C.1 exactly:
//   player_occluded[f] = 1 if the character's visible pixel count in the ID buffer is
//                        < 0.35 x its unoccluded pixel count at the SAME POSE, else 0
//                        (fade opacity forced to 1.0)
//
// PIXEL COUNTING METHOD — RI-MTH04 Appendix A. `tools/harness/first-ten.mjs#playerVisiblePx()`
// (the pre-existing D1 metric) toggles `material.colorWrite/depthWrite/depthTest` on the
// player's own meshes. Appendix A's finding is that those material INSTANCES are cached and
// shared across actors (`game/src/render/actor.js:473`), so mutating them can blank matching
// parts of every other actor wearing the same set, contaminating the pixel diff. This file
// uses `object.visible = false` instead (Appendix A's prescribed fix): it touches no material,
// only the player's own root, and cannot reach another actor. Two things stated per Appendix A:
//   - `root.visible = false` also removes the cast shadow, so this measures body+shadow, not
//     body alone. Reported as such below.
//   - this is not the see-through method (`vt-seethrough.mjs`), which legitimately needs to
//     swap materials to see partially through the character; that question is not this one.
//
// "UNOCCLUDED AT THE SAME POSE" is realised as: hide every other top-level `scene.children`
// entry (terrain, the province group carrying every tree, buildings, other NPCs, props, sky,
// water) except lights and the player root itself, then re-run the same visible/invisible diff.
// Only `.visible` is touched, on objects, never on a material, so nothing here can bleed into
// another actor either. Computed at a lower cadence (`--ref-every`) than the occluded count,
// since it depends only on camera distance/pitch/player pose, which change slowly on a
// straight walk; the occluded count is measured every sampled frame.
//
// THE CONTROL. `Province.prototype.updateOcclusion`'s own doc: "`occlusionSightline` is public
// and is the control arm: set it to false and the behaviour is bit-for-bit the behaviour of
// the commit before this one." That is this file's delete-the-fix: run the identical walk with
// `renderer.province.occlusionSightline = false` and confirm the run length rises back above 6
// while `arm_len` stays byte-identical between arms (`updateOcclusion` only sets `.visible` /
// hides instances for rendering; it is never read by `sim/camera.js#solveArm`, so a change here
// cannot be a disguised "shorten the arm generally" fix — the arm's own numbers must be
// unaffected, and this file checks that they are, not just that they *should* be).
//
// Usage:
//   node tools/camera/cam-occlusion-walk.mjs --tag <name> [--start debug|shipping]
//     [--frames 500] [--from 0] [--canvas 320x180] [--ref-every 10]
//     [--control old-bubble]     (occlusionSightline = false — the delete-the-fix arm)
//     [--out <dir>]
//
// Exit codes: 0 measured and bar met (longest run <= 6, both mean bars satisfied);
//             1 measured and the bar failed; 2 usage; 3 harness error.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { startOpening, DEBUG_SPAWN } from '../lib/opening.mjs';
import { metrics, classify } from '../visual/frame-liveness.mjs';
import { PNG } from 'pngjs';

const T0 = Date.now();
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const TAG = String(args.tag || 'run');
const START = String(args.start || 'debug'); // debug == the Lilmoth spawn the evidence frames were taken from
if (START !== 'shipping' && START !== 'debug') {
  console.error(`cam-occlusion-walk: --start must be 'shipping' or 'debug' (${DEBUG_SPAWN.settlement}); got '${START}'`);
  process.exit(2);
}
const FRAMES = Number(args.frames || 500);
const FROM = Number(args.from || 0);
const [CW, CH] = String(args.canvas || '320x180').split('x').map(Number);
const REF_EVERY = Number(args['ref-every'] || 10);
const CONTROL = args.control ? String(args.control) : null;
if (CONTROL && CONTROL !== 'old-bubble') { console.error(`cam-occlusion-walk: unknown --control '${CONTROL}' (only 'old-bubble' exists)`); process.exit(2); }
const OUT = path.resolve(REPO, args.out || `reports/cam-occlusion-walk/${TAG}`);
fs.mkdirSync(OUT, { recursive: true });

const g = await launchGame({ entry: 'game/index.html', width: 1280, height: 720 });
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 90000 });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view'); c.width = w; c.height = h;
  window.__ENGINE.renderer.setSize(w, h);
}, { w: CW, h: CH });

const opening = await startOpening(g, { start: START, label: `cam-occlusion-walk --tag ${TAG}` });
console.log(JSON.stringify({ start: START, at: opening }));

if (CONTROL === 'old-bubble') {
  await g.page.evaluate(() => { window.__ENGINE.renderer.province.occlusionSightline = false; });
}

// Same input pipeline as first-ten.mjs's D1/D2 walk, so this file's frame numbers line up with
// the evidence frames (`walk-f0360` etc.) named in the verdict.
await g.h('queueInputs', [{ f: 0, move: [0, 1] }]);
if (FROM > 0) await g.h('stepFrames', FROM);

/** Runs entirely inside the page. Returns one frame's measurement. */
async function measureFrame(wantRef, wantPng) {
  return g.page.evaluate(({ wantRef, wantPng }) => {
    const E = window.__ENGINE, R = E.renderer, sim = E.sim;
    const savedOpacity = sim.camera.charOpacity;
    sim.camera.charOpacity = 1;                 // SS C.1: "evaluated with the fade opacity forced to 1.0"
    R.three.shadowMap.autoUpdate = true;         // fresh shadows for THIS frame's canonical render
    E.loop.renderNow();                          // canonical render: applies fade, camera pose, province.updateOcclusion
    sim.camera.charOpacity = savedOpacity;

    // The canonical render above already recomputed the shadow map for this frame's true
    // light/geometry state. The extra raw renders below only toggle `.visible` on a handful of
    // objects to read back a pixel diff; letting WebGLShadowMap recompute on every one of them
    // (three.js's default: shadow map re-renders on every `.render()` call while
    // `shadowMap.autoUpdate` is true) was the dominant cost on a forest scene and is disabled
    // for exactly the calls made here, then re-enabled next frame before the next canonical
    // render.
    R.three.shadowMap.autoUpdate = false;

    const root = R.playerMesh;
    let lastCanvas = null;
    const grab = () => {
      R.three.render(R.scene, R.camera);
      const c = R.three.domElement;
      const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height;
      cv.getContext('2d').drawImage(c, 0, 0);
      lastCanvas = cv;
      return cv.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    };
    const diffCount = (a, b) => {
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
      return n;
    };

    root.visible = true;  const withP = grab();
    // HAZARDS §15: the frame the measurement is taken FROM is the frame that must be proved to be
    // a picture. This is that exact canvas — not a re-render, not a later screenshot.
    const png = wantPng ? lastCanvas.toDataURL('image/png') : null;
    root.visible = false; const withoutP = grab();
    root.visible = true;
    const occludedPx = diffCount(withP, withoutP);

    let refPx = null;
    if (wantRef) {
      const saved = [];
      for (const child of R.scene.children) {
        if (child === root || child.isLight) continue;
        saved.push([child, child.visible]);
        child.visible = false;
      }
      root.visible = true;  const isoWith = grab();
      root.visible = false; const isoWithout = grab();
      root.visible = true;
      for (const [child, v] of saved) child.visible = v;
      refPx = diffCount(isoWith, isoWithout);
    }

    const c = sim.camera;
    return {
      // The TRUE sim frame, read from the sim — never a label computed host-side. The host-side
      // label `FROM + i` silently drifted by 5 when a warm-up step was added ahead of the loop,
      // and a frame number that is a guess is how evidence stops lining up with the verdict it
      // is answering.
      simFrame: sim.frame,
      occludedPx, refPx, totalPx: withP.length / 4, png,
      armLen: c.armLen, armHit: c.armHit, clipThrough: c.clipThrough,
      playerPos: sim.player.pos.slice(), cameraPos: c.pos.slice(),
    };
  }, { wantRef, wantPng });
}

// INCREMENTAL WRITE. The predecessor of this run wrote `manifest.json` only at completion and the
// container restarted mid-walk: BOTH arms lost 100% of their frames and the measurement had to be
// started again from nothing. Every row is now appended to `rows.jsonl` the moment it is measured,
// so a restart costs the frames not yet taken and nothing else.
const JSONL = path.join(OUT, 'rows.jsonl');
fs.writeFileSync(JSONL, '');
const FRAMES_DIR = path.join(OUT, 'frames');
fs.mkdirSync(FRAMES_DIR, { recursive: true });

const rows = [];
const liveness_failures = [];
const ref_invalid = [];
let aborted = null;
let lastRef = null;
// WARM-UP. The reference arm needs a settled scene: at frame 0 the player root renders 0-161 px
// (measured both ways this session, non-deterministically), and REF_EVERY then carries that
// garbage forward. Step a few frames before the first measurement so the first reference is real.
await g.h('stepFrames', 5);
const wantRef_ = (i) => i % REF_EVERY === 0;
for (let i = 0; i <= FRAMES; i++) {
  const f = FROM + i;
  let m;
  // SURVIVE A FLEET-WIDE KILL. Both arms of the previous attempt died at elapsed 123 s with
  // "Target page, context or browser has been closed" — the signature of a sibling's
  // `pkill -f headless_shell` (HAZARDS §10), which is not this tool's to prevent. Crashing here
  // threw away every frame already measured and left no manifest at all, which is how this
  // measurement has now been lost twice. Stop the walk, keep the frames, and say in the manifest
  // that it is short.
  try {
    if (i > 0) await g.h('stepFrames', 1);
    m = await measureFrame(wantRef_(i), true);
  } catch (e) {
    aborted = { at_index: i, frames_measured: rows.length, reason: String(e && e.message || e) };
    console.error(`cam-occlusion-walk: walk ended early after ${rows.length} frame(s) — ${aborted.reason}`);
    break;
  }
  const wantRef = wantRef_(i);

  // HAZARDS §15, per frame and not per run: is this a picture of anything at all? Measured on the
  // exact canvas the pixel diff was taken from. `metrics`/`classify` are the shipped battery from
  // tools/visual/frame-liveness.mjs (subject test off: the subject question here is the
  // measurement itself — refPx — not a border-ring heuristic).
  const raw = Buffer.from(String(m.png).slice('data:image/png;base64,'.length), 'base64');
  const live = classify(metrics(PNG.sync.read(raw)), null, { subject: false });
  if (live.verdict !== 'LIVE') liveness_failures.push({ frame: f, verdict: live.verdict, why: live.why });
  // Keep every 10th frame on disk as inspectable evidence; the rest are gated and discarded.
  if (i % 20 === 0) fs.writeFileSync(path.join(FRAMES_DIR, `f${String(m.simFrame).padStart(4, '0')}.png`), raw);

  if (wantRef) lastRef = m.refPx; else m.refPx = lastRef;
  let ratio = m.refPx > 0 ? m.occludedPx / m.refPx : null;
  // REFERENCE INTEGRITY GUARD. `refPx` is the player's pixel count with every occluder removed, so
  // it is an upper bound by construction: `occludedPx > refPx` cannot happen on a sound reference.
  // The predecessor's own timing probe recorded ratio = 15.95 (occludedPx 2568 vs refPx 161) and
  // nobody read it — a reference sampled at frame 0, before the scene had settled, then carried
  // forward for REF_EVERY frames as if it were real. Silently it scores those frames `occluded:
  // false`, i.e. it manufactures a PASS out of a broken reference. Fail the frame instead.
  let refInvalid = null;
  if (ratio !== null && ratio > 1.05) { refInvalid = { frame: f, ratio, occludedPx: m.occludedPx, refPx: m.refPx }; ratio = null; }
  if (m.refPx === 0) refInvalid = refInvalid || { frame: f, ratio: null, occludedPx: m.occludedPx, refPx: 0 };
  if (refInvalid) ref_invalid.push(refInvalid);
  const occluded = ratio !== null ? ratio < 0.35 : null;
  const row = { frame: m.simFrame, label_frame: f, occludedPx: m.occludedPx, refPx: m.refPx, ratio, occluded,
    armLen: m.armLen, armHit: m.armHit, clipThrough: m.clipThrough,
    playerPos: m.playerPos, cameraPos: m.cameraPos,
    liveness: live.verdict, luma_span: undefined };
  rows.push(row);
  fs.appendFileSync(JSONL, JSON.stringify(row) + '\n');
  if (i % 25 === 0) console.log(JSON.stringify({ ...row, elapsed_s: Math.round((Date.now() - T0) / 1000) }));
}

// HAZARDS §16: prove the walk actually MOVED before trusting a single frame of it. `setInput` was
// never a harness verb and `call()` swallowed the failure, so a whole class of "motion" captures in
// this project photographed a stationary character and reported success. This is that check, on the
// walk's own recorded positions — not on a claim that `queueInputs` was called.
if (!rows.length) {
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({
    schema: 'elder-souls/cam-occlusion-walk@1', tag: TAG, when: new Date().toISOString(),
    control: CONTROL || 'none (shipped fix as-is)', aborted,
    verdict: 'NOT MEASURED — the walk produced zero frames. No number may be quoted from this run.',
  }, null, 1));
  console.error('cam-occlusion-walk: zero frames measured — nothing to report.');
  await g.close();
  process.exit(3);
}
const p0 = rows[0].playerPos, pN = rows[rows.length - 1].playerPos;
const displacement_m = Math.hypot(pN[0] - p0[0], pN[2] - p0[2]);
let movedFrames = 0;
for (let i = 1; i < rows.length; i++) {
  const a = rows[i - 1].playerPos, b = rows[i].playerPos;
  if (Math.hypot(b[0] - a[0], b[2] - a[2]) > 1e-4) movedFrames++;
}
const moved_frac = rows.length > 1 ? movedFrames / (rows.length - 1) : 0;

// Longest consecutive run of occluded===true, and where.
let run = 0, longest = 0, longestAt = null;
for (const r of rows) {
  if (r.occluded) { run++; if (run > longest) { longest = run; longestAt = { frame: r.frame - run + 1, to: r.frame, playerPos: r.playerPos }; } }
  else run = 0;
}
const meanOccluded = rows.filter((r) => r.occluded !== null).reduce((n, r) => n + (r.occluded ? 1 : 0), 0)
  / Math.max(1, rows.filter((r) => r.occluded !== null).length);

const manifest = {
  schema: 'elder-souls/cam-occlusion-walk@1', tag: TAG, when: new Date().toISOString(),
  start: START, opening, control: CONTROL || 'none (shipped fix as-is)',
  canvas: `${CW}x${CH}`, ref_every: REF_EVERY, from: FROM, frames: FRAMES,
  aborted,
  frames_measured: rows.length,
  sim_frame_window: [rows[0].frame, rows[rows.length - 1].frame],
  method: 'root.visible pixel diff, RI-MTH04 Appendix A (body+shadow; not the material colorWrite method)',
  fade_forced_to: 1.0,
  bar: { longest_run_max: 6, mean_max: 0.03 },
  longest_run_frames: longest, longest_run_at: longestAt,
  mean_occluded: Math.round(meanOccluded * 1000) / 1000,
  pass_longest_run: longest <= 6,
  pass_mean: meanOccluded <= 0.03,
  // The two integrity gates. A walk that did not move, or whose frames are not pictures, produces
  // a number that looks exactly like a passing measurement — see HAZARDS §§15 and 16.
  motion_proof: {
    displacement_m: Math.round(displacement_m * 1000) / 1000,
    frames_with_movement: movedFrames, frames_compared: rows.length - 1,
    moved_frac: Math.round(moved_frac * 1000) / 1000,
    verdict: displacement_m > 1.0 && moved_frac > 0.5 ? 'MOVED' : 'DID_NOT_MOVE — measurement void (HAZARDS §16)',
  },
  reference_gate: {
    frames_with_unsound_reference: ref_invalid.length,
    detail: ref_invalid.slice(0, 20),
    verdict: ref_invalid.length === 0 ? 'ALL_REFERENCES_SOUND'
      : 'SOME REFERENCES UNSOUND — those frames are scored null, not false',
  },
  liveness_gate: {
    frames_checked: rows.length, failures: liveness_failures.length,
    detail: liveness_failures.slice(0, 20),
    verdict: liveness_failures.length === 0 ? 'ALL_LIVE' : 'SOME_FRAMES_ARE_NOT_PICTURES (HAZARDS §15)',
  },
  elapsed_s: Math.round((Date.now() - T0) / 1000),
  rows,
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(JSON.stringify({
  wrote: path.relative(REPO, path.join(OUT, 'manifest.json')),
  longest_run_frames: longest, longest_run_at: longestAt, mean_occluded: manifest.mean_occluded,
  motion: manifest.motion_proof, liveness: manifest.liveness_gate.verdict,
  elapsed_s: manifest.elapsed_s,
  pass: manifest.pass_longest_run && manifest.pass_mean,
}));
await g.close();
process.exit(manifest.pass_longest_run && manifest.pass_mean ? 0 : 1);
