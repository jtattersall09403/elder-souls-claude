#!/usr/bin/env node
/**
 * critic-first-ten-play.mjs — the FIRST-TEN-MINUTES critic's own play session.
 *
 * Not a re-run of `tools/harness/first-ten.mjs`. That tool measures the three numbers the
 * builder chose; this one does what directive §2 asks and what found the defect in the first
 * place: spawn, walk, turn, enter a building, talk to somebody, take a fight — and photograph
 * all of it. Where it re-uses a method it says so.
 *
 * The load-bearing measurement here is NOT "where is the NPC". It is:
 *
 *   npc_visible_px — at the instant the dialogue panel is open, the frame is rendered twice
 *   from the identical camera pose with ONLY that NPC's materials set to `colorWrite:false`,
 *   and the differing pixels counted. That is literally "is there a body in front of me while
 *   I am talking to them", which is the complaint D3 records. A coordinate cannot satisfy it.
 *   Method borrowed from vt-seethrough.mjs §1.1 via first-ten.mjs, so all three agree.
 *
 * Phases (each writes into the manifest as it completes, so a crash still leaves evidence):
 *   spawn       — the first frame a player sees, plus a full 8-angle look-around
 *   walk        — hold forward 600 frames, D1's own test, with player_visible_px at each stop
 *   talk-far    — talk to Corvus Aldeyn from wherever the walk ended (the audit's own shot)
 *   talk-near   — walk up to the nearest outdoor NPC and talk: is there a body on screen?
 *   interior    — go through a door and look for the resident who lives there
 *   fade        — PERTURB c.charOpacity and count the player's pixels. The consumption test.
 *   fight       — spawn something and let it hit us
 *
 * SwiftShader unless --gpu; stamped fail-closed in the manifest either way.
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
const TAG = String(args.tag || 'critic');
const ONLY = args.only ? String(args.only).split(',') : null;
const want = (d) => !ONLY || ONLY.includes(d);
const OUT = path.resolve(REPO, args.out || `reports/first-ten-minutes-critic/${TAG}`);
const FRAMES = path.join(OUT, 'frames');
fs.mkdirSync(FRAMES, { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);

const M = { tag: TAG, when: new Date().toISOString(), canvas: `${CW}x${CH}`, renderer_string: null, swiftshader: null, phases: {} };
const save = () => fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(M, null, 1));

const g = await launchGame({ entry: 'game/index.html', width: 1280, height: 720, ...(args.gpu ? { hardwareGpu: true } : {}) });
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 90000 });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view'); c.width = w; c.height = h;
  window.__ENGINE.renderer.setSize(w, h);
}, { w: CW, h: CH });

// Fail closed: an unknown renderer is software (deck.mjs's lesson, restated in first-ten.mjs).
M.renderer_string = await g.page.evaluate(() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'unavailable: no webgl2 context';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch (e) { return `unavailable: ${e.message}`; }
});
M.swiftshader = /^unavailable|^unknown/i.test(M.renderer_string)
  || /swiftshader|llvmpipe|software|mesa/i.test(M.renderer_string);
save();

let shotN = 0;
async function shot(label) {
  const d = await g.h('screenshot');
  const f = `${TAG}-${String(shotN++).padStart(3, '0')}-${label}.png`;
  fs.writeFileSync(path.join(FRAMES, f), Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64'));
  return f;
}

/**
 * Pixels of ONE subtree, from the pose we are standing in right now. `which` picks the subtree:
 * 'player' is renderer.playerMesh, anything else is renderer.npcMeshes.get(which).
 * Two renders, one pose, only that subtree's materials touched.
 */
async function visiblePx(which) {
  return g.page.evaluate((w) => {
    const R = window.__ENGINE.renderer;
    const root = w === 'player' ? R.playerMesh : R.npcMeshes.get(w);
    if (!root) return { error: `no subtree for ${w}` };
    const grab = () => {
      R.three.render(R.scene, R.camera);
      const c = R.three.domElement;
      const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height;
      cv.getContext('2d').drawImage(c, 0, 0);
      return cv.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    };
    const touched = [];
    root.traverse((o) => { if (o.isMesh && o.material && !Array.isArray(o.material)) touched.push([o, o.material.colorWrite, o.material.depthWrite, o.material.depthTest]); });
    const ship = grab();
    for (const [o] of touched) { o.material.colorWrite = false; o.material.depthWrite = false; o.material.depthTest = false; }
    const gone = grab();
    for (const [o, cw, dw, dt] of touched) { o.material.colorWrite = cw; o.material.depthWrite = dw; o.material.depthTest = dt; }
    let n = 0;
    for (let i = 0; i < ship.length; i += 4) {
      if (ship[i] !== gone[i] || ship[i + 1] !== gone[i + 1] || ship[i + 2] !== gone[i + 2]) n++;
    }
    return { visible_px: n, total_px: ship.length / 4, meshes: touched.length, root_visible: !!root.visible };
  }, which);
}

/** Mean RGB of the frame — a cheap "did anything change at all" that a pose cannot fake. */
async function frameStats() {
  return g.page.evaluate(() => {
    const R = window.__ENGINE.renderer;
    R.three.render(R.scene, R.camera);
    const c = R.three.domElement;
    const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height;
    cv.getContext('2d').drawImage(c, 0, 0);
    const d = cv.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let r = 0, gg = 0, b = 0; const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    return { mean: [r / n, gg / n, b / n].map((v) => Math.round(v * 100) / 100), px: n };
  });
}

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
        sched: (n.schedule || []).length, present: n.present,
        mesh_visible: mesh ? !!mesh.visible : null,
        at_origin: near(n.pos),
        dist_m: Math.round(Math.hypot(n.pos[0] - P[0], n.pos[2] - P[2])),
      };
    });
    const drawn = rows.filter((r) => r.mesh_visible);
    return {
      player_pos: P.map((v) => Math.round(v * 10) / 10), interior: sim.env.interior,
      npcs: rows.length, at_origin_coords: rows.filter((r) => r.at_origin).length,
      visible_bodies_at_origin: drawn.filter((r) => r.at_origin).length,
      visible_bodies: drawn.length,
      drawn_within_60m: drawn.filter((r) => r.dist_m <= 60).map((r) => ({ eid: r.eid, d: r.dist_m, pos: r.pos })),
      rows,
    };
  });
}

const step = (n) => g.h('stepFrames', n);

// ---------------------------------------------------------------- spawn + look around
if (want('spawn')) {
  const p = { shots: [], look: [] };
  await step(6);
  p.shots.push(await shot('spawn-first-frame'));
  p.census_at_spawn = await census().then((c) => ({ ...c, rows: undefined }));
  // Eight angles, driven through the real look pipeline rather than by posing the camera.
  for (let i = 1; i <= 8; i++) {
    await g.h('queueInputs', [{ f: 0, look: [45 / 15, 0] }]);   // 45 deg over 15 frames
    await step(15);
    await g.h('queueInputs', [{ f: 0, look: [0, 0] }]);
    await step(3);
    const v = await visiblePx('player');
    p.look.push({ deg: i * 45, player_visible_px: v.visible_px, file: await shot(`spawn-look-${i * 45}`) });
  }
  M.phases.spawn = p; save();
  console.log(JSON.stringify({ spawn: p.look.map((l) => `${l.deg}:${l.player_visible_px}` ) }));
}

// ---------------------------------------------------------------- the ten-second walk (D1)
if (want('walk')) {
  const p = { steps: [] };
  await g.h('setWeather', 'rain');
  await step(12);
  await g.h('queueInputs', [{ f: 0, move: [0, 1] }]);
  for (let f = 0; f <= 600; f += 60) {
    if (f > 0) await step(60);
    const v = await visiblePx('player');
    // Read the LIVE sim camera, not the trace record. `snapshot()` returns `makeRecord()`, whose
    // camera block is named `arm_len_m` / `char_opacity` / `clip_through` — so a reader asking for
    // `cam.armLen` or `cam.clipThrough` gets `undefined` and publishes it as null without
    // complaint. `tools/harness/first-ten.mjs` does exactly that, which is why its D1 table has an
    // empty arm column at every one of its eleven stops.
    const cam = await g.page.evaluate(() => {
      const c = window.__ENGINE.sim.camera; const P = window.__ENGINE.sim.player;
      const r = (x) => (typeof x === 'number' ? Math.round(x * 1000) / 1000 : x);
      return { armLen: r(c.armLen), armDesired: r(c.armDesired), armHit: c.armHit, charOpacity: r(c.charOpacity), clipThrough: c.clipThrough, mode: c.mode, pos: P.pos.map((x) => Math.round(x * 10) / 10) };
    });
    p.steps.push({
      frame: f, file: await shot(`walk-f${String(f).padStart(4, '0')}`),
      player_visible_px: v.visible_px, player_visible_pct: Math.round((v.visible_px / v.total_px) * 1000) / 10,
      arm_len: cam.armLen, arm_desired: cam.armDesired, arm_hit: cam.armHit,
      char_opacity: cam.charOpacity, clip_through: cam.clipThrough,
      player_pos: cam.pos,
    });
    console.log(JSON.stringify(p.steps[p.steps.length - 1]));
  }
  await g.h('queueInputs', [{ f: 0, move: [0, 0] }]);
  await step(6);
  const worst = p.steps.reduce((a, b) => (b.player_visible_px < a.player_visible_px ? b : a));
  p.worst = { frame: worst.frame, px: worst.player_visible_px, pct: worst.player_visible_pct };
  M.phases.walk = p; save();
}

// ---------------------------------------------------------------- talk to somebody
// The D3 question, asked the way a player asks it. Two arms:
//   talk-far  — talk to the audit's own subject from where we happen to be standing
//   talk-near — walk up to the nearest drawn NPC and talk, which is what a player would do
if (want('talk')) {
  const p = { arms: [] };
  const c = await census();
  p.drawn_within_60m = c.drawn_within_60m;
  p.player_pos = c.player_pos;

  const arm = async (label, eid, approach) => {
    const a = { label, eid };
    try {
      if (approach) {
        const t = await g.page.evaluate((id) => {
          const n = window.__ENGINE.sim.npcs.find((x) => x.eid === id);
          return n ? n.pos.map(Number) : null;
        }, eid);
        if (!t) { a.error = 'not in world'; p.arms.push(a); return; }
        a.npc_pos = t.map((v) => Math.round(v * 10) / 10);
        // Stand 3.5 m away on the +x side and face them. Teleport rather than pathfind: the
        // question is what the frame looks like during the conversation, not whether the
        // navmesh works. Stated plainly because it is the one place a player's own route is
        // replaced by a jump.
        await g.h('teleport', t[0] + 3.5, t[2] + 0.5);
        await step(10);
        // Face the NPC through the real look pipeline: yaw toward them a degree at a time.
        for (let k = 0; k < 40; k++) {
          const d = await g.page.evaluate((id) => {
            const E = window.__ENGINE; const n = E.sim.npcs.find((x) => x.eid === id);
            const P = E.sim.player.pos; const c = E.sim.camera;
            const want = Math.atan2(n.pos[0] - P[0], n.pos[2] - P[2]) * 180 / Math.PI;
            const have = (c.yaw === undefined ? 0 : c.yaw) * 180 / Math.PI;
            let e = ((want - have + 540) % 360) - 180;
            return e;
          }, eid);
          if (Math.abs(d) < 3) break;
          await g.h('queueInputs', [{ f: 0, look: [Math.max(-3, Math.min(3, d)), 0] }]);
          await step(1);
        }
        await g.h('queueInputs', [{ f: 0, look: [0, 0] }]);
        await step(6);
      }
      const dist = await g.page.evaluate((id) => {
        const E = window.__ENGINE; const n = E.sim.npcs.find((x) => x.eid === id);
        const P = E.sim.player.pos;
        return n ? Math.round(Math.hypot(n.pos[0] - P[0], n.pos[2] - P[2]) * 10) / 10 : null;
      }, eid);
      a.distance_m = dist;
      const conv = await g.h('talkTo', eid);
      a.greeting = conv && conv.greeting ? String(conv.greeting).slice(0, 160) : null;
      a.topics = conv && conv.topics ? conv.topics.length : null;
      await step(4);
      a.file = await shot(`talk-${label}`);
      const v = await visiblePx(eid);
      a.npc_visible_px = v.visible_px === undefined ? null : v.visible_px;
      a.npc_mesh_present = !v.error;
      a.npc_root_visible = v.root_visible === undefined ? null : v.root_visible;
      a.total_px = v.total_px || null;
      a.error = v.error || undefined;
      await g.h('closeMenu').catch(() => {});
      await step(2);
    } catch (e) { a.error = String(e.message || e).slice(0, 240); }
    p.arms.push(a);
    console.log(JSON.stringify(a));
  };

  await arm('far-corvus', 'blackwood-company-factor', false);
  const nearest = c.drawn_within_60m.sort((x, y) => x.d - y.d)[0];
  if (nearest) await arm('near-walked-up', nearest.eid, true);
  await arm('near-corvus', 'blackwood-company-factor', true);
  M.phases.talk = p; save();
}

// ---------------------------------------------------------------- WHERE is the body?
// `npc_visible_px` is a count, and a count cannot tell you whether the pixels are a person
// standing in front of you or a sliver at the edge of the frame. This phase turns the number
// into a picture: the same two renders, differenced, with the differing pixels painted red and
// their bounding box reported, plus the NPC's own world point projected to screen coordinates
// through the engine's `projectPoint`. If the red is a human silhouette in the middle of the
// frame, D3 is fixed. If it is a smear at the horizon, the count was flattering.
if (want('talkproof')) {
  const p = { arms: [] };
  const targets = String(args.targets || 'blackwood-company-factor').split(',');
  for (const eid of targets) {
    const a = { eid };
    try {
      const t = await g.page.evaluate((id) => {
        const n = window.__ENGINE.sim.npcs.find((x) => x.eid === id);
        return n ? n.pos.map(Number) : null;
      }, eid);
      if (!t) { a.error = 'not in world'; p.arms.push(a); continue; }
      await g.h('teleport', t[0] + Number(args.standoff || 3.5), t[2] + 0.5);
      await step(10);
      for (let k = 0; k < 40; k++) {
        const d = await g.page.evaluate((id) => {
          const E = window.__ENGINE; const n = E.sim.npcs.find((x) => x.eid === id);
          const P = E.sim.player.pos; const c = E.sim.camera;
          const wnt = Math.atan2(n.pos[0] - P[0], n.pos[2] - P[2]) * 180 / Math.PI;
          const have = (c.yaw === undefined ? 0 : c.yaw);
          return ((wnt - have + 540) % 360) - 180;
        }, eid);
        if (Math.abs(d) < 3) break;
        await g.h('queueInputs', [{ f: 0, look: [Math.max(-3, Math.min(3, d)), 0] }]);
        await step(1);
      }
      await g.h('queueInputs', [{ f: 0, look: [0, 0] }]);
      await step(6);
      const conv = await g.h('talkTo', eid);
      a.greeting = conv && conv.greeting ? String(conv.greeting).slice(0, 120) : null;
      await step(4);
      a.file_plain = await shot(`proof-${eid}`);
      const r = await g.page.evaluate((id) => {
        const E = window.__ENGINE; const R = E.renderer;
        const root = R.npcMeshes.get(id);
        const n = E.sim.npcs.find((x) => x.eid === id);
        const P = E.sim.player.pos;
        const grab = () => {
          R.three.render(R.scene, R.camera);
          const c = R.three.domElement;
          const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height;
          cv.getContext('2d').drawImage(c, 0, 0);
          return cv.getContext('2d').getImageData(0, 0, c.width, c.height);
        };
        const touched = [];
        if (root) root.traverse((o) => { if (o.isMesh && o.material && !Array.isArray(o.material)) touched.push([o, o.material.colorWrite, o.material.depthWrite, o.material.depthTest]); });
        const ship = grab();
        for (const [o] of touched) { o.material.colorWrite = false; o.material.depthWrite = false; o.material.depthTest = false; }
        const gone = grab();
        for (const [o, cw, dw, dt] of touched) { o.material.colorWrite = cw; o.material.depthWrite = dw; o.material.depthTest = dt; }
        const W = ship.width, H = ship.height;
        const out = new ImageData(new Uint8ClampedArray(ship.data), W, H);
        let n0 = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, sx = 0, sy = 0;
        for (let i = 0, px = 0; i < ship.data.length; i += 4, px++) {
          const diff = ship.data[i] !== gone.data[i] || ship.data[i + 1] !== gone.data[i + 1] || ship.data[i + 2] !== gone.data[i + 2];
          if (!diff) continue;
          n0++;
          const x = px % W, y = (px / W) | 0;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          sx += x; sy += y;
          out.data[i] = 255; out.data[i + 1] = 0; out.data[i + 2] = 0; out.data[i + 3] = 255;
        }
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        cv.getContext('2d').putImageData(out, 0, 0);
        // Where the engine itself says the person is, in screen coordinates.
        let proj = null;
        try { proj = E.projectPoint(n.pos[0], n.pos[1] + 1.0, n.pos[2]); } catch (e) { proj = { error: String(e.message) }; }
        return {
          overlay: cv.toDataURL('image/png'),
          canvas: [W, H], diff_px: n0,
          bbox: n0 ? [x0, y0, x1, y1] : null,
          centroid: n0 ? [Math.round(sx / n0), Math.round(sy / n0)] : null,
          projected: proj,
          distance_m: Math.round(Math.hypot(n.pos[0] - P[0], n.pos[2] - P[2]) * 10) / 10,
          mesh_present: !!root, mesh_visible: root ? !!root.visible : null, meshes: touched.length,
          npc_pos: n.pos.map((v) => Math.round(v * 100) / 100), player_pos: P.map((v) => Math.round(v * 100) / 100),
        };
      }, eid);
      const f = `${TAG}-${String(shotN++).padStart(3, '0')}-proof-overlay-${eid}.png`;
      fs.writeFileSync(path.join(FRAMES, f), Buffer.from(String(r.overlay).replace(/^data:image\/png;base64,/, ''), 'base64'));
      delete r.overlay;
      Object.assign(a, r, { file_overlay: f });
      await g.h('closeMenu').catch(() => {});
      await step(2);
    } catch (e) { a.error = String(e.message || e).slice(0, 240); }
    p.arms.push(a);
    console.log(JSON.stringify(a));
  }
  M.phases.talkproof = p; save();
}

// ---------------------------------------------------------------- go inside
if (want('interior')) {
  const p = {};
  try {
    const doors = await g.page.evaluate(() => {
      const E = window.__ENGINE;
      const s = E.sim.settlement || E.sim.world || {};
      const out = [];
      try { for (const i of (E.listInteriors ? E.listInteriors() : [])) out.push(i); } catch { /* */ }
      return out;
    });
    p.doors_probe = Array.isArray(doors) ? doors.length : null;
    const target = String(args.interior || 'lilmoth-ledger-house');
    p.target = target;
    const r = await g.h('enterInterior', target);
    p.enter_result = r ? (typeof r === 'object' ? { ok: r.ok === undefined ? true : r.ok, id: r.id || null } : String(r)) : null;
    await step(20);
    p.file_inside = await shot('interior-inside');
    const c = await census();
    p.interior = c.interior;
    p.player_pos = c.player_pos;
    p.drawn_within_60m = c.drawn_within_60m;
    p.visible_bodies = c.visible_bodies;
    // The resident who is supposed to live here.
    const resident = String(args.resident || 'lilmoth-archivist-ledger');
    p.resident = resident;
    const row = c.rows.find((x) => x.eid === resident) || null;
    p.resident_row = row;
    if (row && row.mesh_visible) {
      const v = await visiblePx(resident);
      p.resident_visible_px = v.visible_px;
    } else p.resident_visible_px = 0;
    // And look around inside.
    p.look = [];
    for (let i = 1; i <= 4; i++) {
      await g.h('queueInputs', [{ f: 0, look: [90 / 15, 0] }]);
      await step(15);
      await g.h('queueInputs', [{ f: 0, look: [0, 0] }]);
      await step(3);
      p.look.push({ deg: i * 90, file: await shot(`interior-look-${i * 90}`) });
    }
  } catch (e) { p.error = String(e.message || e).slice(0, 300); }
  M.phases.interior = p; save();
  console.log(JSON.stringify({ interior: { id: p.interior, resident_px: p.resident_visible_px, err: p.error } }));
}

// ---------------------------------------------------------------- the charOpacity consumption test
// PERTURB the value and watch the entity change on screen. Not a grep, not a sweep.
if (want('fade')) {
  const p = { arms: [] };
  try {
    await g.h('camera', { mode: 'gameplay' });
    await step(10);
    for (const v of [1.0, 0.75, 0.5, 0.25, 0.0]) {
      // Write the field the way the sim writes it, then render through the SHIPPING path.
      await g.page.evaluate((x) => {
        const E = window.__ENGINE;
        E.sim.camera.charOpacity = x;
        E._criticFadeHold = x;
      }, v);
      // One shipping render. `screenshot` re-renders through the game's own path, which is
      // what makes this a consumption test rather than a poke at Three.
      const before = await g.page.evaluate(() => {
        const R = window.__ENGINE.renderer;
        const out = [];
        R.playerMesh.traverse((o) => { if (o.isMesh && o.material && !Array.isArray(o.material)) out.push({ n: o.material.name || '', t: !!o.material.transparent, o: o.material.opacity }); });
        return { meshes: out.length, transparent: out.filter((x) => x.t).length, fade_named: out.filter((x) => /camera-fade/.test(x.n)).length, opacities: [...new Set(out.map((x) => Math.round(x.o * 100) / 100))] };
      });
      const file = await shot(`fade-${String(v).replace('.', 'p')}`);
      const px = await visiblePx('player');
      const fs2 = await frameStats();
      p.arms.push({ charOpacity: v, file, materials: before, player_visible_px: px.visible_px, player_root_visible: px.root_visible, frame_mean: fs2.mean });
      console.log(JSON.stringify(p.arms[p.arms.length - 1]));
    }
    // Restore, and confirm the sim recomputes it (the value is per-frame, so one step is enough).
    await step(4);
    p.after_step_charOpacity = await g.page.evaluate(() => window.__ENGINE.sim.camera.charOpacity);
  } catch (e) { p.error = String(e.message || e).slice(0, 300); }
  M.phases.fade = p; save();
}

// ---------------------------------------------------------------- a fight
if (want('fight')) {
  const p = { shots: [] };
  try {
    const P = await g.page.evaluate(() => window.__ENGINE.sim.player.pos.map(Number));
    const sp = await g.h('spawn', 'inf_trash', P[0] + 5, P[2] + 5, {});
    const eid = sp && (sp.eid || sp.id || sp);
    p.eid = eid;
    await g.h('aggro', eid).catch(() => {});
    for (let i = 0; i < 6; i++) {
      await g.h('queueInputs', [{ f: 0, press: ['light'] }, { f: 2, release: ['light'] }]);
      await step(40);
      const st = await g.h('getCombatState').catch(() => null);
      p.shots.push({ i, file: await shot(`fight-${i}`), player_hp: st && st.player ? st.player.hp : null });
    }
  } catch (e) { p.error = String(e.message || e).slice(0, 300); }
  M.phases.fight = p; save();
}

save();
console.log(JSON.stringify({ wrote: path.relative(REPO, OUT), renderer: M.renderer_string, swiftshader: M.swiftshader }));
await g.close();
