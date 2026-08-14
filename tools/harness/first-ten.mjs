#!/usr/bin/env node
/**
 * first-ten.mjs — the first ten minutes, measured rather than described.
 *
 * The three defects a player meets before anything else (D1 buried camera, D2 rain indoors,
 * D3 people who are not where the conversation is) each get a NUMBER and a SEQUENCE, taken
 * from the running game through the real input pipeline. Run it with `--tag before`, make the
 * change, run it with `--tag after`, and the two manifests are directly comparable.
 *
 *   node tools/harness/first-ten.mjs --tag before
 *   node tools/harness/first-ten.mjs --tag after
 *   node tools/harness/first-ten.mjs --tag null-d3 --only d3     (a null control)
 *
 * WHY IT MEASURES WHAT IT MEASURES. Each number is the player's own complaint, not a proxy
 * that a change could satisfy without helping:
 *
 *   D1  `player_visible_px` — the frame rendered twice from ONE camera pose, once normally and
 *       once with the player's materials set to `colorWrite:false`, and the differing pixels
 *       counted. That is exactly "can I see my character", which is what being buried under a
 *       deck takes away. Borrowed wholesale from `vt-seethrough.mjs` §1.1 so the two agree.
 *   D2  `streaks_under_cover` — every live precipitation streak is raycast STRAIGHT UP against
 *       the scene's solid geometry. A streak with a hit overhead is a raindrop falling indoors.
 *       This is the defect's definition, so a fix cannot satisfy it by accident.
 *   D3  `visible_bodies_at_origin` — NPC meshes that are `visible` in the scene graph while
 *       standing within 50 m of the world origin, which is 5.8 km from the town they belong to.
 *       Plus `residents_in_town`, so hiding everybody cannot be mistaken for placing them.
 *
 * SwiftShader. Every frame this writes is software GL; nothing here is evidence about
 * driver-specific filtering or MSAA. Labelled in the manifest, not only in a comment.
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const TAG = String(args.tag || 'run');
const ONLY = args.only ? String(args.only).split(',') : null;
const want = (d) => !ONLY || ONLY.includes(d);
const OUT = path.resolve(REPO, args.out || `reports/first-ten-minutes/${TAG}`);
const FRAMES = path.join(OUT, 'frames');
fs.mkdirSync(FRAMES, { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);

const manifest = { tag: TAG, when: new Date().toISOString(), canvas: `${CW}x${CH}`, renderer_string: null, swiftshader: null, d1: null, d2: null, d3: null };

const g = await launchGame({ entry: 'game/index.html', width: 1280, height: 720 });
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 90000 });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view'); c.width = w; c.height = h;
  window.__ENGINE.renderer.setSize(w, h);
}, { w: CW, h: CH });

// Never claim GPU. Read the live context's own answer and stamp it.
manifest.renderer_string = await g.page.evaluate(() => {
  const gl = window.__ENGINE.renderer.renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
});
manifest.swiftshader = /swiftshader|llvmpipe|software/i.test(manifest.renderer_string || '');

let shotN = 0;
async function shot(label) {
  const d = await g.h('screenshot');
  const f = `${TAG}-${String(shotN++).padStart(3, '0')}-${label}.png`;
  fs.writeFileSync(path.join(FRAMES, f), Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64'));
  return f;
}

/**
 * The player's visible pixel count from the camera pose we are standing in RIGHT NOW.
 * Two renders, one pose, only the player's materials changed — so the difference is the
 * player and nothing else. `vt-seethrough.mjs` established the method; this is the one-sided
 * half of it (we want "how much of them can I see", not "how much shows through").
 */
async function playerVisiblePx() {
  return g.page.evaluate(() => {
    const R = window.__ENGINE.renderer;
    const root = R.player || R.scene.getObjectByName('player');
    const gl = R.renderer;
    const grab = () => {
      R.renderer.render(R.scene, R.camera);
      const c = gl.domElement;
      const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height;
      cv.getContext('2d').drawImage(c, 0, 0);
      return cv.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    };
    const touched = [];
    if (root) root.traverse((o) => { if (o.isMesh && o.material) touched.push([o, o.material.colorWrite, o.material.depthWrite, o.material.depthTest]); });
    const ship = grab();
    for (const [o] of touched) { o.material.colorWrite = false; o.material.depthWrite = false; o.material.depthTest = false; }
    const gone = grab();
    for (const [o, cw, dw, dt] of touched) { o.material.colorWrite = cw; o.material.depthWrite = dw; o.material.depthTest = dt; }
    let n = 0;
    for (let i = 0; i < ship.length; i += 4) {
      if (ship[i] !== gone[i] || ship[i + 1] !== gone[i + 1] || ship[i + 2] !== gone[i + 2]) n++;
    }
    return { visible_px: n, total_px: ship.length / 4, meshes: touched.length };
  });
}

/** Every live rain streak, raycast straight up. A hit overhead means it is falling indoors. */
async function streaksUnderCover() {
  return g.page.evaluate(() => {
    const THREE = window.__THREE || window.THREE;
    const R = window.__ENGINE.renderer;
    const sky = R.sky || R.skyRig || null;
    const rain = R.scene.getObjectByName('weather-precipitation-bounded-320');
    if (!rain) return { error: 'no precipitation object in the scene' };
    if (!rain.visible) return { visible: false, live: 0, under_cover: 0 };
    const pos = rain.geometry.attributes.position;
    const range = rain.geometry.drawRange.count;
    const live = Math.floor(range / 2);
    // Solid world geometry only. The rain object, the player and the sky dome are not roofs.
    const solids = [];
    R.scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      if (o === rain) return;
      const n = String(o.name || '');
      if (n.startsWith('npc:') || n.startsWith('prop:') || n === 'player' || n.includes('sky') || n.includes('dome') || n.includes('reflect')) return;
      let p = o.parent, skip = false;
      while (p) { const pn = String(p.name || ''); if (pn === 'player' || pn.startsWith('npc:')) { skip = true; break; } p = p.parent; }
      if (!skip) solids.push(o);
    });
    const rc = new THREE.Raycaster();
    rc.far = 60;
    const up = new THREE.Vector3(0, 1, 0);
    const o = new THREE.Vector3();
    let under = 0;
    for (let i = 0; i < live; i++) {
      o.set(pos.getX(i * 2), pos.getY(i * 2), pos.getZ(i * 2)).add(rain.position);
      rc.set(o, up);
      const hits = rc.intersectObjects(solids, false);
      if (hits.length && hits[0].distance > 0.05) under++;
    }
    return { visible: true, live, under_cover: under, solids: solids.length };
  });
}

/** Where everybody actually is, and whether their body is in the scene. */
async function census() {
  return g.page.evaluate(() => {
    const E = window.__ENGINE; const sim = E.sim; const R = E.renderer;
    const P = sim.player.pos;
    const near = (p) => Math.hypot(p[0], p[2]) < 50;
    const rows = sim.npcs.map((n) => {
      const mesh = R.npcMeshes.get(n.eid);
      return {
        eid: n.eid, settlement: n.settlement || null, at: n.at === undefined ? null : n.at,
        pos: n.pos.map((v) => Math.round(v * 100) / 100),
        sched: (n.schedule || []).length, post: n.post ? (n.post.settlement || n.post.site || 'yes') : null,
        present: n.present, sim_visible: n.visible !== false,
        mesh_visible: mesh ? !!mesh.visible : null,
        at_origin: near(n.pos),
        dist_to_player_m: Math.round(Math.hypot(n.pos[0] - P[0], n.pos[2] - P[2])),
      };
    });
    const drawn = rows.filter((r) => r.mesh_visible);
    return {
      player_pos: P.map((v) => Math.round(v * 10) / 10),
      env_interior: sim.env.interior, hour: Math.round(sim.env.timeOfDay * 100) / 100,
      npcs: rows.length,
      at_origin_coords: rows.filter((r) => r.at_origin).length,
      visible_bodies_at_origin: drawn.filter((r) => r.at_origin).length,
      visible_bodies: drawn.length,
      residents_in_town: drawn.filter((r) => !r.at_origin && r.dist_to_player_m < 400).length,
      offenders: drawn.filter((r) => r.at_origin).map((r) => ({ eid: r.eid, pos: r.pos, at: r.at, sched: r.sched, post: r.post, settlement: r.settlement })),
      rows,
    };
  });
}

const walk = async (frames) => {
  // The real input pipeline: the same closed ACTIONS set a keyboard drives.
  for (let i = 0; i < frames; i += 10) {
    await g.h('queueInputs', [{ move: [0, 1] }]);
    await g.h('stepFrames', 10);
  }
};

// ---------------------------------------------------------------------------------------
// D3 first, because it needs nothing but a boot and a settlement crossing.
// ---------------------------------------------------------------------------------------
if (want('d3')) {
  await g.h('stepFrames', 30);              // cross into Lilmoth; `stepSettlement` populates it
  const c = await census();
  const shots = [];
  shots.push(await shot('d3-lilmoth-street'));
  // And a look at the world origin itself, where the misplaced bodies are standing.
  await g.page.evaluate(() => {
    const R = window.__ENGINE.renderer;
    R.camera.position.set(14, 6, 14); R.camera.lookAt(0, 1.2, 0);
    R.renderer.render(R.scene, R.camera);
  });
  shots.push(await shot('d3-world-origin-orbit'));
  manifest.d3 = { ...c, shots, rows: undefined, rows_saved: 'census-rows.json' };
  fs.writeFileSync(path.join(OUT, 'census-rows.json'), JSON.stringify(c.rows, null, 1));
  console.log(JSON.stringify({ d3: { npcs: c.npcs, at_origin_coords: c.at_origin_coords, visible_bodies_at_origin: c.visible_bodies_at_origin, residents_in_town: c.residents_in_town } }));
}

// ---------------------------------------------------------------------------------------
// D1 + D2: hold forward from the spawn point and photograph the whole walk.
// ---------------------------------------------------------------------------------------
if (want('d1') || want('d2')) {
  await g.h('restoreState');                 // back to the spawn point, whatever D3 did
  await g.h('setWeather', 'rain');           // D2 needs precipitation to exist to be wrong
  await g.h('stepFrames', 12);
  const steps = [];
  for (let f = 0; f <= 600; f += 60) {
    if (f > 0) await walk(60);
    const vis = await playerVisiblePx();
    const rainR = await streaksUnderCover();
    const snap = await g.h('snapshot');
    const cam = (snap && snap.camera) || {};
    const file = await shot(`walk-f${String(f).padStart(4, '0')}`);
    steps.push({
      frame: f, file,
      player_visible_px: vis.visible_px, player_visible_pct: Math.round((vis.visible_px / vis.total_px) * 1000) / 10,
      arm_len: cam.armLen, clip_through: cam.clipThrough,
      rain_live: rainR.live, rain_under_cover: rainR.under_cover,
    });
    console.log(JSON.stringify(steps[steps.length - 1]));
  }
  const worst = steps.reduce((a, b) => (b.player_visible_px < a.player_visible_px ? b : a));
  manifest.d1 = { steps, worst_frame: worst.frame, worst_player_visible_px: worst.player_visible_px, worst_player_visible_pct: worst.player_visible_pct };
  const covered = steps.filter((s) => s.rain_under_cover > 0);
  manifest.d2 = {
    steps: steps.map((s) => ({ frame: s.frame, live: s.rain_live, under_cover: s.rain_under_cover })),
    worst_under_cover: Math.max(0, ...steps.map((s) => s.rain_under_cover || 0)),
    frames_with_indoor_rain: covered.length,
  };
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(JSON.stringify({ wrote: path.relative(REPO, OUT), renderer: manifest.renderer_string, swiftshader: manifest.swiftshader }));
await g.close();
