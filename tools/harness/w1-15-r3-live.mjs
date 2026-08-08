#!/usr/bin/env node
// w1-15-r3-live.mjs — W1-15 round 3, asked of the RUNNING game.
//
// Three questions, none of which a module-level probe can answer:
//
//   A. THE LAMPS. `render/interior.js` draws 827 authored interior lamps; until this round
//      `LightField.addSource()` had exactly one caller in `game/src` and it was the harness verb.
//      Does the thing that decides whether you can be seen now know about them — and does an
//      ENTITY change behaviour when one goes out?
//   B. THE WITNESSES. Staged four ways: in the room, outside it, asleep, and in the dark.
//      RI-CRM01 §2's predicate says a witness is somebody who was there AND could see. This
//      measures all four rather than asserting the predicate against itself.
//   C. THE THEFT CHAIN. An interior unique item, picked up through the button a player presses,
//      and whether that runs `isTheft` -> stolen registry -> witness -> report -> bounty.
//
// Every arm carries its own control, and the controls are stated in the output.
//
// USAGE
//   node tools/harness/w1-15-r3-live.mjs [--json <path>] [--interior <id>]
import { parseArgs, wantsHelp, usage, writeJson, log } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `w1-15-r3-live.mjs — the lamps, the witnesses and the theft chain, in the running game.

USAGE
  node tools/harness/w1-15-r3-live.mjs [--json <path>] [--interior <id>]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const h = await launchGame({ ...args, width: 320, height: 240 });
await h.page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 120000 });
await h.page.evaluate(() => window.__HARNESS.setRenderRate(0));

const R = [];
const say = (s) => process.stdout.write(s + '\n');
const A = (id, name, got, pass, target) => {
  R.push({ id, name, got: String(got), target, pass });
  say(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(11)} ${name}\n              got     ${got}\n              target  ${target}`);
};

const OUT = await h.page.evaluate(async (wanted) => {
  const H = window.__HARNESS;
  const E = window.__ENGINE;
  const O = {};
  const round = (v, n = 4) => Math.round(v * 10 ** n) / 10 ** n;

  H.setSeed(1337);
  H.loadState('default');
  H.setRenderRate(0);

  // Pick an interior that actually declares lamps AND a unique item with an owner.
  const all = H.listInteriors();
  let pick = null;
  for (const row of all) {
    const rec = E.sim.settlements.interior(row.id);
    if (!rec) continue;
    if (wanted && row.id !== wanted) continue;
    if (!(rec.lights || []).length) continue;
    if (!(rec.unique_item && rec.unique_item.owner)) continue;
    if (!(rec.property_zones || []).length) continue;
    pick = rec; break;
  }
  if (!pick) return { fatal: 'no interior in the shipped data declares lamps, an owned unique item and a property zone' };
  O.interior = { id: pick.id, name: pick.name, kind: pick.interior_kind, lamps_declared: (pick.lights || []).length, bounds: pick.bounds_m, unique: pick.unique_item, zones: pick.property_zones };

  // ---- A. THE LAMPS -------------------------------------------------------------------------

  // CONTROL 0, taken outside, before any door: the light field holds nothing the world put there.
  try { if (H.whereAmI().interior) H.exitInterior(); } catch { /* already outside */ }
  H.setTimeOfDay(12);
  H.stepFrames(3);
  O.outside_noon = H.getStealthState().lights;

  const enter = H.enterInterior(pick.id);
  H.stepFrames(3);
  O.entered = enter;
  O.inside_noon = H.getStealthState().lights;

  // Sample the room on a grid at chest height and find the brightest and darkest walkable spots.
  const b = pick.bounds_m;
  const grid = [];
  for (let x = b.x[0] + 0.5; x <= b.x[1] - 0.5; x += 0.5) {
    for (let z = b.z[0] + 0.5; z <= b.z[1] - 0.5; z += 0.5) grid.push({ x, z, L: H.getLightAt(x, 1.35, z, null) });
  }
  grid.sort((p, q) => q.L - p.L);
  const bright = grid[0], dark = grid[grid.length - 1];
  O.field = {
    samples: grid.length,
    brightest: { x: round(bright.x, 2), z: round(bright.z, 2), L: round(bright.L) },
    darkest: { x: round(dark.x, 2), z: round(dark.z, 2), L: round(dark.L) },
    dark_coverage_noon: H.darkCoverage({ x: b.x, z: b.z }, null, 0.10),
  };

  // THE DISCRIMINATOR. Before this round, indoor L was `skyAmbient(env)` — 1.00 at noon and 0.22
  // at 03:00, everywhere in the room, identically. If the lamps are read, the SAME point reads
  // the same at both hours (a lamp does not care what time it is) and two DIFFERENT points in
  // the same room read differently.
  H.setTimeOfDay(3);
  H.stepFrames(3);
  const brightAt3 = H.getLightAt(bright.x, 1.35, bright.z, null);
  const darkAt3 = H.getLightAt(dark.x, 1.35, dark.z, null);
  H.setTimeOfDay(12);
  H.stepFrames(3);
  O.clock_independence = {
    bright_noon: round(bright.L), bright_0300: round(brightAt3),
    dark_noon: round(dark.L), dark_0300: round(darkAt3),
  };

  // A CENSUS, not a threshold. How lit is the province indoors, once the lamps are read? This is
  // an ABSENCE-REPORTER: it prints the number and does not decide whether it is good. A room's
  // lamp COUNT and PLACEMENT are W1-04's generator's, not this piece's, and tuning the light
  // model until the shipped rooms look right would be fitting the instrument to the fixture.
  const census = [];
  for (const row of all) {
    const rec = E.sim.settlements.interior(row.id);
    if (!rec || !(rec.lights || []).length || !rec.bounds_m) continue;
    if (census.length >= 30) break;
    H.enterInterior(row.id);
    H.stepFrames(2);
    const st = H.getStealthState().lights;
    const cov = H.darkCoverage({ x: rec.bounds_m.x, z: rec.bounds_m.z }, null, 0.10);
    // The room's actual spread, sampled coarsely.
    let lo = 2, hi = -1;
    for (let x = rec.bounds_m.x[0] + 0.5; x <= rec.bounds_m.x[1] - 0.5; x += 1.0) {
      for (let z = rec.bounds_m.z[0] + 0.5; z <= rec.bounds_m.z[1] - 0.5; z += 1.0) {
        const L = H.getLightAt(x, 1.35, z, null);
        if (L < lo) lo = L; if (L > hi) hi = L;
      }
    }
    census.push({ id: row.id, declared: (rec.lights || []).length, sources: st.world_sources, dark_share: round(cov.share, 3), L_min: round(lo, 3), L_max: round(hi, 3) });
  }
  O.province_census = {
    rooms: census.length,
    mean_sources: round(census.reduce((a, r) => a + r.sources, 0) / census.length, 2),
    mean_dark_share: round(census.reduce((a, r) => a + r.dark_share, 0) / census.length, 4),
    rooms_with_no_dark_at_all: census.filter((r) => r.dark_share === 0).length,
    mean_spread: round(census.reduce((a, r) => a + (r.L_max - r.L_min), 0) / census.length, 3),
    rooms_with_zero_spread: census.filter((r) => r.L_max - r.L_min < 1e-6).length,
    rows: census,
  };
  H.enterInterior(pick.id);
  H.setTimeOfDay(12);
  H.stepFrames(3);

  // ---- A2. CONSUMPTION: snuff a lamp, watch an ENTITY change behaviour -----------------------
  //
  // The perturbation is on the MODEL (a lamp goes out). The observation is on an ENTITY (how fast
  // an enemy's alert meter fills, and what state it reaches). Nothing here reads the light field
  // back to itself.
  const lampCensus = H.getStealthState().lights;
  // The lit world lamp nearest the bright spot — the one actually lighting it.
  let nearest = null, nd = 1e9;
  for (const s of lampCensus.sources) {
    if (!s.lit) continue;
    const dx = s.pos[0] - bright.x, dz = s.pos[2] - bright.z;
    const d = dx * dx + dz * dz;
    if (d < nd) { nd = d; nearest = s; }
  }
  O.snuff_target = nearest ? { id: nearest.id, kind: nearest.kind, dist_m: round(Math.sqrt(nd), 2) } : null;

  const runAlertArm = (label) => {
    H.reset();
    H.setSeed(1337);
    H.enterInterior(pick.id);
    H.setTimeOfDay(12);
    H.setRenderRate(0);
    H.setStealthState({ sneak: 5, load: 'medium', surface: 'stone', zone: null });
    H.setPlayerMotion('walk');
    H.stepFrames(2);
    if (label === 'snuffed' && nearest) H.snuffLight(nearest.id, 600);
    E._placeBody(bright.x, 0, bright.z);
    // An observer 6 m away, looking straight at the bright spot. Spawned (not setEntityPos'd):
    // the r2 verdict records that only `spawn()` honours yaw.
    const eyeZ = bright.z + 6;
    // Facing the player: atan2(dx, dz) with dx = 0 and dz = -6 gives 180deg, which is exactly
    // the "looking back down -z" default the engine documents.
    const yawToPlayer = (Math.atan2(bright.x - bright.x, bright.z - eyeZ) * 180 / Math.PI + 360) % 360;
    H.spawn('inf_trash', bright.x, eyeZ, { as: 'watcher', yaw: yawToPlayer });
    H.stepFrames(2);
    const L = H.getStealthState();
    let frames = 0, reached = null;
    const start = H.perceptionState().find((e) => e.eid === 'watcher');
    for (let i = 0; i < 600; i++) {
      H.stepFrames(10); frames += 10;
      const e = H.perceptionState().find((x) => x.eid === 'watcher');
      if (!e) break;
      if (e.alert >= 70) { reached = { alert: e.alert, state: e.alert_state, frames }; break; }
      if (frames >= 1800) { reached = { alert: e.alert, state: e.alert_state, frames }; break; }
    }
    const end = H.perceptionState().find((e) => e.eid === 'watcher');
    return {
      arm: label,
      L: round(L.light === undefined ? L.terms.L : L.light),
      V: round(L.V),
      lamps_lit: H.getStealthState().lights.world_lit,
      dist_m: end ? end.dist_m : null, los: end ? end.los : null,
      frames_to_70: reached && reached.alert >= 70 ? reached.frames : null,
      alert_after: end ? end.alert : null,
      state_after: end ? end.alert_state : null,
      alert_at_start: start ? start.alert : null,
    };
  };
  O.consumption_light = { lit: runAlertArm('lit'), snuffed: runAlertArm('snuffed') };

  // ---- B. THE WITNESSES, STAGED FOUR WAYS ----------------------------------------------------
  //
  // One theft, four rooms' worth of people, and each one is asked what it did. The staging is
  // geometric and clock-driven; nothing is hand-fed to `takeObject` (`observedBy` is left
  // undefined so the world derives the observer list).
  const stageTheft = (arm) => {
    H.reset();
    H.setSeed(1337);
    H.setRenderRate(0);
    H.enterInterior(pick.id);
    H.setTimeOfDay(arm.hour === undefined ? 12 : arm.hour);
    H.setStealthState({ sneak: 5, load: 'medium', surface: 'stone', zone: null, race: 'imperial' });
    H.setPlayerMotion('walk');
    // Standing where the arm says: under the lamp, or in the room's dark corner.
    const spot = arm.dark ? dark : bright;
    E._placeBody(spot.x, 0, spot.z);
    // A theft is a CRIME context, not a stroll: RI-STL01 §6's weight for handling other
    // people's things. Without it `contextWeight` is 0.00 and nobody would look up at anything.
    H.setCrimeContext('handling_owned_object');
    if (arm.wall) H.addOccluder({ id: 'the_wall', min: [arm.wall.x - 0.15, 0, arm.wall.z0], max: [arm.wall.x + 0.15, 3.0, arm.wall.z1] });
    // The people.
    const placed = [];
    for (const w of arm.witnesses) {
      const yaw = (Math.atan2(spot.x - w.pos[0], spot.z - w.pos[2]) * 180 / Math.PI + 360) % 360;
      H.spawnCivilian({ eid: w.eid, pos: w.pos, yaw, race: 'saxhleel', asleep: !!w.asleep });
      placed.push(w.eid);
    }
    // SOMEBODY TO REPORT TO. RI-CRM01 §3a's routes are `shout` (a guard within range),
    // `run_to_guard`, `delayed` (no guard within 400 m — latency null, it lands at the witness's
    // next contact with a guard) and `never`. Without a guard anywhere the route is `delayed` and
    // the bounty correctly never lands, which is what the first run of this probe measured and
    // wrongly scored as a failure of the witness. The guard is placed OUTSIDE the room and
    // facing away, so it is a report target and not a second witness.
    H.spawnGuard({ eid: 'the_watch', pos: [spot.x + 14, 0, spot.z + 14], yaw: 0 });
    H.stepFrames(120);                       // let the suspicion machine run before the crime
    const before = H.listCivilians();
    const los = placed.map((eid) => {
      const c = before.find((x) => x.eid === eid);
      return { eid, los: c ? c.los : null, dist_m: c ? c.dist_m : null, civ_state: c ? c.civ_state : null, asleep: c ? c.asleep : null };
    });
    const took = H.takeObject(pick.unique_item.id, {});
    // A bounty does not land on the crime frame. RI-CRM01 §3a is the whole point of the piece:
    // the witness has to REACH somebody, and the report has a latency in frames. Reading
    // `getCrimeState()` four frames after the theft (as the first run of this probe did)
    // measures the gap, not the outcome, and reports bounty 0 for a crime that lands.
    const bountyAtCrime = H.getCrimeState().bounty.imperial;
    H.stepFrames(1800);
    const crime = H.getCrimeState();
    return {
      bounty_at_crime_frame: bountyAtCrime,
      pending_at_crime_frame: H.listPendingReports().length,
      arm: arm.id, hour: arm.hour === undefined ? 12 : arm.hour, standing: arm.dark ? 'the dark corner' : 'under the lamp',
      L: round(H.getStealthState().light === undefined ? H.getStealthState().terms.L : H.getStealthState().light),
      V: round(H.getStealthState().V),
      people: los,
      observed_by: took.observed_by, observed_by_source: took.observed_by_source,
      theft: took.theft, stolen_from: took.stolen_from, crime: took.crime || null,
      witnesses: took.witnesses || [],
      bounty: crime.bounty ? crime.bounty.imperial : null,
      pending: H.listPendingReports().length,
      report_routes: (crime.pending_reports || []).map((r) => r.route || r),
      witness_checks: crime.witness_checks || [],
      // Measured INSIDE the arm, with the arm's own occluder standing: `los_check` taken after
      // the run is taken on a reset world with no wall in it and answers a different question.
      los_at_crime: arm.witnesses.map((w) => ({ eid: w.eid, ...H.losBetween([w.pos[0], 1.6, w.pos[2]], [spot.x, 1.35, spot.z]) })),
      occluders: H.listOccluders(),
    };
  };

  // Coordinates: `bright`/`dark` are inside the room; `outside` is beyond the interior's own
  // wall plane. The wall is put in as real geometry with `addOccluder` — a `CollisionCell` of
  // the same primitives the camera's spring arm casts against — because the first run of this
  // probe measured `walls: 0` on the outside segment and excluded that person on DISTANCE, which
  // is a true result and not the one the arm is named after.
  const outsidePos = [b.x[1] + 2.5, 0, bright.z];
  const inRoom = [bright.x + 1.6, 0, bright.z + 1.2];
  O.witness_arms = [
    stageTheft({ id: 'in_the_room', witnesses: [{ eid: 'w_in', pos: inRoom }] }),
    stageTheft({ id: 'outside_the_room', wall: { x: b.x[1], z0: b.z[0] - 6, z1: b.z[1] + 6 }, witnesses: [{ eid: 'w_out', pos: outsidePos }] }),
    stageTheft({ id: 'asleep_in_the_room', witnesses: [{ eid: 'w_sleep', pos: inRoom, asleep: true }] }),
    stageTheft({ id: 'in_the_dark', dark: true, witnesses: [{ eid: 'w_dark', pos: [dark.x + 1.6, 0, dark.z + 1.2] }] }),
  ];
  O.los_check = {
    in_room: H.losBetween([inRoom[0], 1.6, inRoom[2]], [bright.x, 1.35, bright.z]),
    outside: H.losBetween([outsidePos[0], 1.6, outsidePos[2]], [bright.x, 1.35, bright.z]),
  };

  // ---- C. THE THEFT CHAIN, THROUGH THE BUTTON A PLAYER PRESSES -------------------------------
  H.reset();
  H.setSeed(1337);
  H.setRenderRate(0);
  H.enterInterior(pick.id);
  H.setTimeOfDay(12);
  H.stepFrames(3);
  const props = E.sim.props.filter((p) => p.eid === `interior-unique:${pick.unique_item.id}`);
  const prop = props[0] || null;
  const regBefore = H.getStealthState().stolen_registry_n;
  const invIdsBefore = E.sim.inventory.map((i) => i.id);
  // The diagnostics the first two runs of this probe needed: whether the property row is
  // reachable AT ALL from the running engine, independently of the prop that should point at it.
  O.property_reachable = {
    has_row: E._propertyHas(pick.unique_item.id),
    zone: (() => { try { return E._zoneById((pick.property_zones || [])[0]).id; } catch (e) { return `ERR ${e.message.slice(0, 80)}`; } })(),
    row: (() => {
      for (const k of Object.keys(E.data.property || {})) for (const z of E.data.property[k].zones) {
        const c = z.contents.find((x) => x.instance === pick.unique_item.id);
        if (c) return { zone: z.id, owner: c.owner, owner_scope: c.owner_scope, value_g: c.value_g, unique: !!c.unique, stolen_from: c.stolen_from || null };
      }
      return null;
    })(),
    interior_props_present: E.sim.props.filter((p) => String(p.eid).startsWith('interior-')).map((p) => ({ eid: p.eid, property_instance: p.property_instance || null })),
  };
  let took = null;
  if (prop) {
    E._placeBody(prop.pos[0], prop.pos[1] - 1.0, prop.pos[2] + 0.8);
    H.stepFrames(2);
    try { took = H.takeProp(prop.eid); } catch (e) { took = { error: String(e.message).slice(0, 200) }; }
    H.stepFrames(2);
  }
  // BY ID, not by slice index: `quantiseColdState()` re-sorts the inventory on every take, so a
  // tail slice reports whichever row happened to sort last (the first run of this probe reported
  // the character's starting knife as "the row that was added").
  const seenBefore = new Map();
  for (const id of invIdsBefore) seenBefore.set(id, (seenBefore.get(id) || 0) + 1);
  const invAfter = [];
  for (const i of E.sim.inventory) {
    const n = seenBefore.get(i.id) || 0;
    if (n > 0) { seenBefore.set(i.id, n - 1); continue; }
    invAfter.push({ id: i.id, stolen: !!i.stolen, owner: i.owner || null });
  }
  O.theft_chain = {
    prop: prop ? { eid: prop.eid, item: prop.item, property_instance: prop.property_instance || null, pos: prop.pos.map((v) => round(v, 2)) } : null,
    took,
    inventory_added: invAfter,
    stolen_registry: { before: regBefore, after: H.getStealthState().stolen_registry_n },
    registry_rows: E.sim.stealth.crime.stolenRegistry.map((s) => ({ instance: s.instance, owner: s.owner, value_g: s.value_g, unique: !!s.unique, settlement: s.settlement })),
  };
  // And the fence must know: RI-STL02 §6's refusal is by name, and a laundered unique carries a
  // delayed bounty. This is the downstream consumer of `stolen_from` on the new rows.
  // `fenceQuote(fenceId, item)` takes the ITEM RECORD, not an id — passing a string made the
  // first run of this probe report `buys: true, price_g: null` for every input, which is a check
  // that cannot fail. The registry row the theft just created is the right object.
  try {
    const reg = E.sim.stealth.crime.stolenRegistry.find((s) => s.instance === pick.unique_item.id);
    const item = reg ? { ...reg, stolen_from: reg.owner, stolen_settlement: reg.settlement } : null;
    const quotes = {};
    for (const f of E.data.crime.fences.fences.slice(0, 4)) {
      quotes[f.id] = item ? H.fenceQuote(f.id, item) : { error: 'nothing in the stolen registry to quote' };
    }
    // The FALSIFIER: the same fence, the same call, with a clean (unowned) item. If a refusal
    // and a sale look identical the check is measuring nothing.
    quotes.__control_clean_item = H.fenceQuote(E.data.crime.fences.fences[0].id, { value_g: 122, unique: true, stolen_from: null });
    O.theft_chain.fence_quotes = quotes;
  } catch (e) { O.theft_chain.fence_quotes = { error: String(e.message).slice(0, 200) }; }

  return O;
}, args.interior ? String(args.interior) : null);

if (OUT.fatal) { say(`FATAL: ${OUT.fatal}`); await h.close(); process.exit(20); }

say(`\ninterior under test: ${OUT.interior.id} — "${OUT.interior.name}" (${OUT.interior.kind}), ${OUT.interior.lamps_declared} lamps declared, unique item "${OUT.interior.unique.name}" owned by ${OUT.interior.unique.owner}\n`);

// ---- A -----------------------------------------------------------------------------------------
say('A. THE LAMPS\n');
A('LAMP-CTL', 'CONTROL: standing outside, the world has put nothing in the light field',
  `world_sources ${OUT.outside_noon.world_sources}, interior_ambient_applied ${OUT.outside_noon.interior_ambient_applied}, ambient ${OUT.outside_noon.ambient_L}`,
  OUT.outside_noon.world_sources === 0 && OUT.outside_noon.interior_ambient_applied === false,
  '0 world sources, the sky ambient — the control must be empty or the next row proves nothing');
A('LAMP-IN', 'inside, the authored lamps are IN the light field the detection model samples',
  `${OUT.inside_noon.world_sources} world source(s) from ${OUT.interior.lamps_declared} declared, ${OUT.inside_noon.world_lit} lit, ${OUT.inside_noon.world_snuffable} snuffable, ambient ${OUT.inside_noon.ambient_L}`,
  OUT.inside_noon.world_sources > 0 && OUT.inside_noon.interior_ambient_applied === true,
  '> 0 — this is the finding "the lamps are drawn and nothing that decides whether you can be seen has ever been told about one"');
A('LAMP-GRAD', 'the room has a bright end and a dark end, from the lamps alone',
  `brightest L ${OUT.field.brightest.L} at (${OUT.field.brightest.x}, ${OUT.field.brightest.z}); darkest L ${OUT.field.darkest.L} at (${OUT.field.darkest.x}, ${OUT.field.darkest.z}); dark coverage ${(OUT.field.dark_coverage_noon.share * 100).toFixed(1)}% of ${OUT.field.dark_coverage_noon.total} samples`,
  OUT.field.brightest.L - OUT.field.darkest.L > 0.30,
  'a spread of more than 0.30 in L across one room — before this round every point in every interior read the SAME number, so the spread was exactly 0');
const pc = OUT.province_census;
say(`\n   CENSUS over ${pc.rooms} lamplit interiors (a number, not a threshold — lamp count and placement are W1-04's generator's):\n` +
    `     mean world light sources per room .. ${pc.mean_sources}\n` +
    `     mean share of floor at L <= 0.10 ... ${(pc.mean_dark_share * 100).toFixed(1)}%\n` +
    `     rooms with no dark floor at all .... ${pc.rooms_with_no_dark_at_all}/${pc.rooms}\n` +
    `     mean L spread within a room ........ ${pc.mean_spread}\n` +
    `     rooms with ZERO spread ............. ${pc.rooms_with_zero_spread}/${pc.rooms}`);
A('LAMP-CEN', 'no interior in the census is a flat field any more',
  `${pc.rooms_with_zero_spread}/${pc.rooms} rooms have zero L spread; mean spread ${pc.mean_spread}`,
  pc.rooms_with_zero_spread === 0 && pc.mean_spread > 0.2,
  '0 flat rooms — every interior was a flat field in every build before this one, because L indoors was the sky');
const ci = OUT.clock_independence;
A('LAMP-CLK', 'indoor light no longer tracks the SKY',
  `bright spot ${ci.bright_noon} at noon / ${ci.bright_0300} at 03:00; dark corner ${ci.dark_noon} / ${ci.dark_0300}`,
  Math.abs(ci.bright_noon - ci.bright_0300) < 1e-6 && Math.abs(ci.dark_noon - ci.dark_0300) < 1e-6 && ci.bright_noon !== ci.dark_noon,
  'identical at both hours and different at the two points — the pre-fix build read 1.0000 everywhere at noon and 0.2200 everywhere at 03:00');
const cl = OUT.consumption_light;
say(`\n   the two arms in full:\n     lit      L ${cl.lit.L}  V ${cl.lit.V}  lamps lit ${cl.lit.lamps_lit}  dist ${cl.lit.dist_m} m  los ${cl.lit.los}  -> alert ${cl.lit.alert_after} (${cl.lit.state_after}) after ${cl.lit.frames_to_70 === null ? '1800+' : cl.lit.frames_to_70} f\n     snuffed  L ${cl.snuffed.L}  V ${cl.snuffed.V}  lamps lit ${cl.snuffed.lamps_lit}  dist ${cl.snuffed.dist_m} m  los ${cl.snuffed.los}  -> alert ${cl.snuffed.alert_after} (${cl.snuffed.state_after}) after ${cl.snuffed.frames_to_70 === null ? '1800+' : cl.snuffed.frames_to_70} f`);
A('LAMP-CON', 'CONSUMPTION (RI-MTH07): put out ONE lamp and an ENTITY behaves differently',
  `snuffing ${OUT.snuff_target ? OUT.snuff_target.id : 'nothing'} takes L ${cl.lit.L} -> ${cl.snuffed.L}, V ${cl.lit.V} -> ${cl.snuffed.V}, and the watcher's time to alert 70 from ${cl.lit.frames_to_70 === null ? '>1800' : cl.lit.frames_to_70} f to ${cl.snuffed.frames_to_70 === null ? '>1800' : cl.snuffed.frames_to_70} f`,
  cl.snuffed.L < cl.lit.L && cl.snuffed.V < cl.lit.V && (cl.snuffed.frames_to_70 === null || cl.lit.frames_to_70 === null ? true : cl.snuffed.frames_to_70 > cl.lit.frames_to_70),
  'L falls, V falls, and the entity takes longer — a perturbation of the model observed on an entity, not on the model');

// ---- B -----------------------------------------------------------------------------------------
say('\nB. THE WITNESSES, STAGED FOUR WAYS\n');
say(`   line-of-sight, measured inside each arm with that arm's own geometry standing:`);
for (const w of OUT.witness_arms) say(`     ${w.arm.padEnd(20)} ${JSON.stringify(w.los_at_crime)}  occluders ${JSON.stringify(w.occluders)}`);
say('');
for (const w of OUT.witness_arms) {
  const p = w.people[0];
  say(`   ${w.arm.padEnd(20)} standing in ${w.standing.padEnd(16)} L ${w.L}  V ${w.V}`);
  say(`   ${''.padEnd(20)} person: los ${p.los}  dist ${p.dist_m} m  state ${p.civ_state}  asleep ${p.asleep}`);
  say(`   ${''.padEnd(20)} -> observed_by [${w.observed_by.join(', ')}] (${w.observed_by_source}); theft ${w.theft}; crime ${w.crime}; witnesses ${w.witnesses.length}`);
  say(`   ${''.padEnd(20)}    bounty ${w.bounty_at_crime_frame} on the crime frame -> ${w.bounty} after 1,800 f; pending ${w.pending_at_crime_frame} -> ${w.pending}; routes ${JSON.stringify(w.report_routes)}\n`);
}
const arm = (id) => OUT.witness_arms.find((x) => x.arm === id);
A('WIT-IN', 'a person in the room, awake, with a clear cast, IS a witness — and it reaches a bounty',
  `observed_by ${JSON.stringify(arm('in_the_room').observed_by)}, crime ${arm('in_the_room').crime}, routes ${JSON.stringify(arm('in_the_room').report_routes)}, bounty ${arm('in_the_room').bounty_at_crime_frame} -> ${arm('in_the_room').bounty}`,
  arm('in_the_room').observed_by.length === 1 && arm('in_the_room').crime !== null &&
  arm('in_the_room').bounty_at_crime_frame === 0 && arm('in_the_room').bounty > 0,
  'one observer, a crime, bounty 0 ON THE CRIME FRAME and > 0 after the report lands — RI-CRM01 §3a\'s gap is the point of the piece');
A('WIT-OUT', 'a person OUTSIDE the room is not',
  `${arm('outside_the_room').people[0].dist_m} m away through the room wall, state ${arm('outside_the_room').people[0].civ_state}, ` +
  `LOS cast ${JSON.stringify(arm('outside_the_room').los_at_crime)}; observed_by ${JSON.stringify(arm('outside_the_room').observed_by)}, bounty ${arm('outside_the_room').bounty}`,
  arm('outside_the_room').observed_by.length === 0 && !arm('outside_the_room').bounty,
  'no observer and no bounty — read the LOS cast in `got`: if it says clear, the exclusion came from range and the suspicion machine, not from the wall, and that is what this arm measured');
A('WIT-SLP', 'a person ASLEEP in the same room, at the same distance, is not',
  `asleep ${arm('asleep_in_the_room').people[0].asleep}, state ${arm('asleep_in_the_room').people[0].civ_state}, observed_by ${JSON.stringify(arm('asleep_in_the_room').observed_by)}, bounty ${arm('asleep_in_the_room').bounty}`,
  arm('asleep_in_the_room').people[0].asleep === true && arm('asleep_in_the_room').observed_by.length === 0 && !arm('asleep_in_the_room').bounty,
  'the sleeper is in the room and is not a sensor — same geometry as WIT-IN, opposite outcome');
A('WIT-DARK', 'the same theft in the room\'s DARK corner is seen differently from under the lamp',
  `under the lamp: L ${arm('in_the_room').L} V ${arm('in_the_room').V} -> ${arm('in_the_room').observed_by.length} observer(s), bounty ${arm('in_the_room').bounty}` +
  `  |  in the dark: L ${arm('in_the_dark').L} V ${arm('in_the_dark').V} -> ${arm('in_the_dark').observed_by.length} observer(s), bounty ${arm('in_the_dark').bounty}`,
  arm('in_the_dark').V < arm('in_the_room').V,
  'V strictly lower in the dark corner — the lamps reach the justice system, not only the renderer');

// ---- C -----------------------------------------------------------------------------------------
say('\nC. THE THEFT CHAIN, THROUGH THE BUTTON A PLAYER PRESSES\n');
const tc = OUT.theft_chain;
say(`   prop: ${tc.prop ? `${tc.prop.eid} item=${tc.prop.item} property_instance=${tc.prop.property_instance}` : 'NONE IN THE WORLD'}`);
say(`   takeProp returned: ${JSON.stringify(tc.took).slice(0, 400)}`);
say(`   inventory rows added: ${JSON.stringify(tc.inventory_added)}`);
say(`   property row reachable: ${JSON.stringify(OUT.property_reachable && OUT.property_reachable.row)}`);
say(`   fence quotes: ${JSON.stringify(tc.fence_quotes)}\n`);
A('THF-PTR', 'the interior unique item points at a row in the ownership tree',
  tc.prop ? `${tc.prop.eid} -> ${tc.prop.property_instance}` : 'no prop',
  !!(tc.prop && tc.prop.property_instance),
  'non-null — `unique_item.owner` was carried and unread for the whole of wave 1');
A('THF-RUN', 'picking it up runs the theft chain',
  tc.took && tc.took.theft ? `theft ${tc.took.theft.theft}, scope ${tc.took.theft.scope}, stolen_from ${tc.took.theft.stolen_from}, crime ${tc.took.theft.crime}` : `theft block ${JSON.stringify(tc.took && tc.took.theft)}`,
  !!(tc.took && tc.took.theft && tc.took.theft.theft === true && tc.took.theft.stolen_from),
  'theft true with an owner named — before this round takeProp() pushed it in clean');
A('THF-INV', 'the inventory row carries the owner, and there is exactly one of it',
  JSON.stringify(tc.inventory_added),
  tc.inventory_added.length === 1 && tc.inventory_added[0].stolen === true && !!tc.inventory_added[0].owner,
  'one row, stolen true, owner set — two rows would mean takeProp and takeObject both pushed');
A('THF-REG', 'it is in the stolen registry, which is what the save writes and the fence reads',
  `${tc.stolen_registry.before} -> ${tc.stolen_registry.after}; rows ${JSON.stringify(tc.registry_rows)}`,
  tc.stolen_registry.after === tc.stolen_registry.before + 1 && tc.registry_rows.some((r) => r.unique),
  '+1, and the row is marked unique so RI-STL02 §6 prices it at 0.20x with a delayed bounty');
const fq = tc.fence_quotes || {};
const refusals = Object.entries(fq).filter(([k, v]) => k !== '__control_clean_item' && v && v.buys === false);
const sales = Object.entries(fq).filter(([k, v]) => k !== '__control_clean_item' && v && v.buys === true);
A('THF-FNC', 'the fence economy discriminates a stolen unique from a clean one',
  `${refusals.length} refusal(s) ${refusals.map(([k, v]) => `${k}:${v.reason}`).join(' ')}; ${sales.length} sale(s) ${sales.map(([k, v]) => `${k}:${v.price_g}g unique=${v.unique}`).join(' ')}; CONTROL clean item -> ${JSON.stringify(fq.__control_clean_item)}`,
  sales.some(([, v]) => v.unique === true && Number(v.price_g) > 0 && v.delayed_bounty) &&
  fq.__control_clean_item && fq.__control_clean_item.buys === true,
  'at least one fence quotes it AS A UNIQUE with a price and a delayed bounty, and the clean-item control is still bought — a quote identical in both arms would measure nothing');

const failed = R.filter((r) => !r.pass);
say(`\n${'='.repeat(78)}\n${R.length - failed.length}/${R.length} assertions pass`);
if (args.json) writeJson(String(args.json), { results: R, detail: OUT });
await h.close();
process.exit(failed.length ? 20 : 0);
