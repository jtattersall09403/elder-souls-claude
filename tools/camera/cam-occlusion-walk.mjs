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
async function measureFrame(wantRef) {
  return g.page.evaluate((wantRef) => {
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
    const grab = () => {
      R.three.render(R.scene, R.camera);
      const c = R.three.domElement;
      const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height;
      cv.getContext('2d').drawImage(c, 0, 0);
      return cv.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    };
    const diffCount = (a, b) => {
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
      return n;
    };

    root.visible = true;  const withP = grab();
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
      occludedPx, refPx, totalPx: withP.length / 4,
      armLen: c.armLen, armHit: c.armHit, clipThrough: c.clipThrough,
      playerPos: sim.player.pos.slice(), cameraPos: c.pos.slice(),
    };
  }, wantRef);
}

const rows = [];
let lastRef = null;
for (let i = 0; i <= FRAMES; i++) {
  const f = FROM + i;
  if (i > 0) await g.h('stepFrames', 1);
  const wantRef = i % REF_EVERY === 0;
  const m = await measureFrame(wantRef);
  if (wantRef) lastRef = m.refPx; else m.refPx = lastRef;
  const ratio = m.refPx > 0 ? m.occludedPx / m.refPx : null;
  const occluded = ratio !== null ? ratio < 0.35 : null;
  rows.push({ frame: f, occludedPx: m.occludedPx, refPx: m.refPx, ratio, occluded,
    armLen: m.armLen, armHit: m.armHit, clipThrough: m.clipThrough,
    playerPos: m.playerPos, cameraPos: m.cameraPos });
  if (i % 25 === 0) console.log(JSON.stringify(rows[rows.length - 1]));
}

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
  method: 'root.visible pixel diff, RI-MTH04 Appendix A (body+shadow; not the material colorWrite method)',
  fade_forced_to: 1.0,
  bar: { longest_run_max: 6, mean_max: 0.03 },
  longest_run_frames: longest, longest_run_at: longestAt,
  mean_occluded: Math.round(meanOccluded * 1000) / 1000,
  pass_longest_run: longest <= 6,
  pass_mean: meanOccluded <= 0.03,
  rows,
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(JSON.stringify({
  wrote: path.relative(REPO, path.join(OUT, 'manifest.json')),
  longest_run_frames: longest, longest_run_at: longestAt, mean_occluded: manifest.mean_occluded,
  pass: manifest.pass_longest_run && manifest.pass_mean,
}));
await g.close();
process.exit(manifest.pass_longest_run && manifest.pass_mean ? 0 : 1);
