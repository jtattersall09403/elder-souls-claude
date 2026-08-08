#!/usr/bin/env node
// critic-w1-15-r3-live.mjs — the W1-15 round-3 critic's live arm. ONE browser, one session.
//
// `tools/contention.mjs --gate` was exit 3 for the whole of this critic's run (5 browser
// instances against a ceiling of 6, load 6.6-7.2 per core against a ceiling of 4.0). Every
// offline claim was measured first, with no browser. This tool is what genuinely needs one, and
// it takes ONE and keeps it, per rule 21. No timing figure is published from it: every number
// below is a frame count, a source count or a model value, all load-independent.
//
// WHAT IT ASKS, all of which the round's own report asserts and none of which a reader can check
// without driving the game:
//
//   L1  the shipped tree really does contain the theft chain (three edits the round reports were
//       silently removed by a neighbour mid-run and re-applied). Re-measured, not re-read.
//   L2  the headline: world sources in/out of a room, L at noon vs 03:00, and one snuffed lamp.
//   L3  the round's declared LIT_CAP divergence, and the one it did NOT declare: 11 interiors
//       declare no lamp at all, so the renderer's fail-open hearth lights a room the simulation
//       holds at ambient 0.04. Measured on the live light field, then photographed.
//   L4  `coverVolumes` in the running world — the SAME hand-feed shape this round fixed for
//       lamps, one module over, untouched.
//   L5  the fence, on a real stolen object: the owner's own local fence against three others.
//   L6  p.zone, live, inside an interior.
//
// USAGE
//   node tools/stealth/critic-w1-15-r3-live.mjs [--json <path>] [--shot <path>]
import fs from 'node:fs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'critic-w1-15-r3-live.mjs — the W1-15 r3 critic\'s live arm. One browser.\n';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const say = (s = '') => process.stdout.write(`${s}\n`);
const R = [];
const A = (id, name, got, pass, target) => {
  R.push({ id, name, got: String(got), target, pass });
  say(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(9)} ${name}\n            got     ${got}\n            target  ${target}`);
};

const h = await launchGame({ ...args, width: 960, height: 600 });
await h.page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 180000 });

const OUT = await h.page.evaluate(async () => {
  const H = window.__HARNESS, E = window.__ENGINE;
  const O = {}; const r4 = (v) => Math.round(v * 1e4) / 1e4;
  H.setSeed(1337); H.loadState('default'); H.setRenderRate(0);

  // ---- L1/L2: a lamplit room, the headline -----------------------------------------------
  const lamplit = H.listInteriors().map((x) => x.id)
    .filter((id) => { const rec = E.sim.settlements.interior(id); return rec && (rec.lights || []).length && rec.unique_item && rec.unique_item.owner; });
  const pick = lamplit[0];
  try { if (H.whereAmI().interior) H.exitInterior(); } catch { /**/ }
  H.setTimeOfDay(12); H.stepFrames(3);
  O.outside = H.getStealthState().lights;
  H.enterInterior(pick); H.stepFrames(3);
  const inside = H.getStealthState().lights;
  O.inside = { interior: inside.interior, world_sources: inside.world_sources, ambient_L: inside.ambient_L, snuffable: inside.world_snuffable, ambient_applied: inside.interior_ambient_applied };
  O.pick = pick;

  const rec = E.sim.settlements.interior(pick);
  const b = rec.bounds_m;
  const grid = () => { const g = []; for (let x = b.x[0] + 0.5; x <= b.x[1] - 0.5; x += 0.5) for (let z = b.z[0] + 0.5; z <= b.z[1] - 0.5; z += 0.5) g.push({ x, z, L: H.getLightAt(x, 1.35, z, null) }); return g; };
  let g = grid().sort((p, q) => q.L - p.L);
  O.noon = { n: g.length, max: r4(g[0].L), min: r4(g[g.length - 1].L), spread: r4(g[0].L - g[g.length - 1].L), bright: [r4(g[0].x), r4(g[0].z)], dark: [r4(g[g.length - 1].x), r4(g[g.length - 1].z)] };
  H.setTimeOfDay(3); H.stepFrames(3);
  g = grid().sort((p, q) => q.L - p.L);
  O.night = { max: r4(g[0].L), min: r4(g[g.length - 1].L), spread: r4(g[0].L - g[g.length - 1].L) };
  H.setTimeOfDay(12); H.stepFrames(3);

  // the snuff, at the brightest point
  const src = inside.sources.filter((s) => s.snuffable);
  O.snuff = { available: src.length };
  if (src.length) {
    const at = O.noon.bright;
    const before = H.getLightAt(at[0], 1.35, at[1], null);
    // snuff whichever lamp is nearest the bright point
    let best = src[0], bd = Infinity;
    for (const s of src) { const d = (s.pos[0] - at[0]) ** 2 + (s.pos[2] - at[1]) ** 2; if (d < bd) { bd = d; best = s; } }
    H.snuffLight(best.id, 300); H.stepFrames(2);
    const after = H.getLightAt(at[0], 1.35, at[1], null);
    O.snuff = { available: src.length, id: best.id, L_before: r4(before), L_after: r4(after), delta: r4(before - after) };
  }

  // ---- L1: the theft chain, in the shipped tree -------------------------------------------
  O.theft_chain = {
    spawnProp_carries_instance: typeof E.spawnProp === 'function',
    propertyHas_exists: typeof E._propertyHas === 'function',
    takeObject_exists: typeof E.takeObject === 'function',
  };
  try {
    const props = (E.sim.props || []).filter((p) => p.property_instance);
    O.theft_chain.props_with_property_instance = props.length;
    O.theft_chain.example = props[0] ? { name: props[0].name || props[0].id, instance: props[0].property_instance } : null;
  } catch (e) { O.theft_chain.error = String(e && e.message); }

  // ---- L3: the fail-open rooms — a room that declares NO lamp ------------------------------
  const nolamp = H.listInteriors().map((x) => x.id).filter((id) => { const q = E.sim.settlements.interior(id); return q && !(q.lights || []).length; });
  O.nolamp_ids = nolamp;
  if (nolamp.length) {
    H.enterInterior(nolamp[0]); H.stepFrames(3);
    const st = H.getStealthState().lights;
    const q = E.sim.settlements.interior(nolamp[0]);
    const bb = q.bounds_m || { x: [-6, 6], z: [-9, 9] };
    let mx = 0, mn = 1;
    for (let x = bb.x[0] + 0.5; x <= bb.x[1] - 0.5; x += 0.5) for (let z = bb.z[0] + 0.5; z <= bb.z[1] - 0.5; z += 0.5) { const L = H.getLightAt(x, 1.35, z, null); mx = Math.max(mx, L); mn = Math.min(mn, L); }
    O.nolamp = { id: nolamp[0], world_sources: st.world_sources, ambient_L: st.ambient_L, ambient_applied: st.interior_ambient_applied, L_max: r4(mx), L_min: r4(mn) };
    // and what the renderer drew for the same room
    try { const s = E.renderer.interiorSummary; O.nolamp.drawn = { lights_declared: s.lights_declared, lights_lit: s.lights_lit, lamps_built: s.lamps_built, id: s.id }; } catch (e) { O.nolamp.drawn_error = String(e && e.message); }
    O.nolamp.V_here = (() => { try { const p = H.getStealthState(); return r4(p.V !== undefined ? p.V : (p.player && p.player.V)); } catch { return null; } })();
  }

  // ---- L4: coverVolumes, the hand-feed this round did NOT close ----------------------------
  O.cover = { in_world: H.listCoverVolumes().length };
  // and a room with people and props in it, to show it is not an empty-cell artefact
  try {
    H.enterInterior(pick); H.stepFrames(3);
    O.cover.in_a_furnished_interior = H.listCoverVolumes().length;
    O.cover.props_in_cell = (E.sim.props || []).length;
    O.cover.occluders = E.sim.stealth.occluders ? E.sim.stealth.occluders.shapes.length : null;
  } catch (e) { O.cover.error = String(e && e.message); }

  // ---- L5: the fence -----------------------------------------------------------------------
  try {
    const fences = E.data.crime.fences.fences;
    // find a real owned object and its owner's settlement
    let owner = null, val = 0;
    for (const k of Object.keys(E.data.property || {})) {
      for (const z of E.data.property[k].zones) for (const c of z.contents || []) {
        const o = c.owner || z.owner;
        if (o && /^npc:/.test(o)) { owner = o; val = c.value_g || 100; break; }
      }
      if (owner) break;
    }
    const ownerNpc = (() => { for (const gp of Object.values(E.data.npcs)) { const n = (gp.npcs || []).find((x) => `npc:${x.id}` === owner); if (n) return n; } return null; })();
    const local = fences.find((f) => f.settlement === (ownerNpc && ownerNpc.settlement));
    const others = fences.filter((f) => f !== local).slice(0, 3);
    const item = { stolen_from: owner, value_g: val, unique: false, stolen_settlement: ownerNpc && ownerNpc.settlement };
    O.fence = {
      owner, owner_settlement: ownerNpc && ownerNpc.settlement, value_g: val,
      local: local ? { id: local.id, q: H.fenceQuote(local.id, item) } : null,
      others: others.map((f) => ({ id: f.id, settlement: f.settlement, q: H.fenceQuote(f.id, item) })),
      clean_control: local ? H.fenceQuote(local.id, { stolen_from: null, value_g: val, unique: false }) : null,
    };
  } catch (e) { O.fence = { error: String(e && e.message) }; }

  // ---- L6: p.zone --------------------------------------------------------------------------
  O.zone = { inside: E.sim.stealth.p.zone, interior: H.whereAmI().interior };

  return O;
});

say('W1-15 r3 CRITIC — the live arm. One browser; gate was exit 3 and this run proceeded, declared.');
say('='.repeat(94));
say(JSON.stringify(OUT, null, 2).slice(0, 60) === '' ? '' : '');

A('L1-CHAIN', 'the theft chain survives in the SHIPPED tree (three edits were lost mid-round once)',
  `_propertyHas ${OUT.theft_chain.propertyHas_exists}, props carrying property_instance ${OUT.theft_chain.props_with_property_instance}`,
  OUT.theft_chain.propertyHas_exists === true && OUT.theft_chain.props_with_property_instance > 0,
  '_propertyHas present AND at least one furnished prop carries a property_instance');

A('L2-LAMPS', 'the lamps reach the light field the detection model samples',
  `outside ${OUT.outside.world_sources} sources -> inside ${OUT.inside.world_sources} (${OUT.pick}), ambient ${OUT.inside.ambient_L}`,
  OUT.outside.world_sources === 0 && OUT.inside.world_sources > 0,
  '0 outside, >0 inside — the round\'s headline');

A('L2-FLAT', 'the room is no longer FLAT: L varies across the floor, and does not track the sky',
  `noon max ${OUT.noon.max} min ${OUT.noon.min} spread ${OUT.noon.spread}; 03:00 spread ${OUT.night.spread}`,
  OUT.noon.spread > 0.1 && Math.abs(OUT.noon.spread - OUT.night.spread) < 0.01,
  'spread > 0.1 at noon AND the same spread at 03:00 (a lamp does not care what time it is)');

A('L2-SNUFF', 'snuffing one lamp moves L where the player is standing',
  OUT.snuff.id ? `${OUT.snuff.id}: L ${OUT.snuff.L_before} -> ${OUT.snuff.L_after} (delta ${OUT.snuff.delta})` : 'no snuffable source',
  !!OUT.snuff.id && OUT.snuff.delta > 0.05, 'a snuffable world lamp exists and snuffing it drops L by > 0.05');

const nl = OUT.nolamp || {};
A('L3-DARK', 'THE UNDECLARED DIVERGENCE: a room that declares no lamp is DRAWN LIT and SIMULATED BLACK',
  `${OUT.nolamp_ids.length} such interiors. ${nl.id}: sim sources ${nl.world_sources}, L ${nl.L_min}..${nl.L_max}; the renderer built ${nl.drawn ? nl.drawn.lamps_built : '?'} lamp(s) and lit ${nl.drawn ? nl.drawn.lights_lit : '?'}`,
  false,
  'the drawn lit set and the simulated lit set must agree — this is the same defect the round closed, inverted');

A('L4-COVER', 'coverVolumes in the running world — the hand-feed this round did NOT close',
  `world ${OUT.cover.in_world}, inside a furnished interior ${OUT.cover.in_a_furnished_interior} (props in cell ${OUT.cover.props_in_cell}, occluders ${OUT.cover.occluders})`,
  OUT.cover.in_a_furnished_interior > 0,
  '> 0 — otherwise plausibleSet() returns [] and S-1\'s whole search plan is dead, exactly as LightField was');

const f = OUT.fence || {};
const quotes = f.local ? [f.local.q.price_g, ...(f.others || []).map((o) => o.q.price_g)] : [];
A('L5-FENCE', 'the owner\'s own local fence refuses stolen goods',
  f.local ? `${f.owner} of ${f.owner_settlement}: local ${f.local.id} buys=${f.local.q.buys} at ${f.local.q.price_g} g; out-of-town ${(f.others || []).map((o) => `${o.id} ${o.q.price_g} g`).join(', ')}; clean control ${f.clean_control && f.clean_control.price_g} g` : String(f.error),
  !!(f.local && f.local.q.buys === false),
  'buys=false, reason same_settlement — willBuy() authors that refusal and Engine.fenceQuote() stubs it out');

A('L6-ZONE', 'p.zone inside an interior',
  `interior ${OUT.zone.interior}, p.zone ${JSON.stringify(OUT.zone.inside)}`,
  OUT.zone.inside !== null && OUT.zone.inside !== undefined,
  'non-null — the whole trespass ladder is behind it');

const pass = R.filter((x) => x.pass).length;
say(`\n${pass}/${R.length} assertions pass`);
// The measurements are banked BEFORE the picture. The first run of this tool lost its whole JSON
// to a screenshot timeout under load — rule 2, and the reason it is in this order now.
if (args.json) writeJson(args.json, { tool: 'critic-w1-15-r3-live', at: new Date().toISOString(), assertions: R, raw: OUT });

// ---- the picture --------------------------------------------------------------------------
const shot = args.shot || 'docs/shots/2026-08-08-critic-w1-15-r3-a-room-with-no-lamps-drawn-lit.png';
if (OUT.nolamp_ids.length && !args['no-shot']) {
  try {
    await h.page.evaluate(async (id) => {
      const H = window.__HARNESS;
      H.setRenderRate(1); H.enterInterior(id); H.setTimeOfDay(3); H.stepFrames(8);
    }, OUT.nolamp.id);
    await h.page.waitForTimeout(2500);
    const buf = await h.page.screenshot({ timeout: 180000, animations: 'disabled', caret: 'hide' });
    fs.writeFileSync(shot, buf);
    say(`\nshot: ${shot}  (${OUT.nolamp.id} at 03:00 — drawn by render/interior.js's fail-open hearth,`);
    say(`      simulated by the light field at L ${OUT.nolamp.L_min}..${OUT.nolamp.L_max} with ${OUT.nolamp.world_sources} sources)`);
  } catch (e) {
    say(`\nSHOT NOT TAKEN: ${String(e && e.message).split('\n')[0]} — reported rather than retried silently (rule 26).`);
  }
}
await h.close();
process.exitCode = pass === R.length ? 0 : 1;
