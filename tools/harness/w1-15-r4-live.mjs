#!/usr/bin/env node
// w1-15-r4-live.mjs — W1-15 round 4, asked of the RUNNING game, in ONE browser.
//
// Six things, each of which was measured absent by the round-3 critic and each of which is
// answered here by perturbing the model and watching an entity or a verb change (`RI-MTH07`,
// mandatory under `ARBITRATION.md` §3).
//
//   A. THE ROOM AGREES WITH ITSELF. The eleven rooms round 3 pinned at the `unlit` row 0.0400 at
//      every hour, read live, at four hours. And the derived ambient's own working.
//   B. THE FENCE KNOWS WHOSE THING THIS IS. `Engine.fenceQuote()` passed `npcById: () => null`,
//      so all four refusals were dead for the 1,787 person-owned objects in the tree. Driven over
//      EVERY object against EVERY fence, with a clean-item control.
//   C. `p.zone` HAS A PRODUCER. 233 authored zones behind zero writers anywhere in `game/src`.
//      Walked, not asserted: the body moves and the zone the world reports moves with it.
//   D. `coverVolumes` HAS A PRODUCER. Round 3's own headline defect, one module over: its only
//      caller in `game/src` was the harness verb, so `Search.plan` was always empty.
//   E. UNIDENTIFIED IS A KIND, NOT A MAGNITUDE. Two partial reports worth hundreds of gold must
//      leave the guard band alone AND raise the settlement's alarm AND the zone's memory.
//   F. THE PICTURE. A room a player would think is lit, which is the only form this defect has
//      ever been legible in.
//
// USAGE
//   node tools/harness/w1-15-r4-live.mjs [--json <path>] [--shot <path>]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `w1-15-r4-live.mjs — the shared lit set, the fence, the zone, the cover and the ledger.

USAGE
  node tools/harness/w1-15-r4-live.mjs [--json <path>] [--shot <path>]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const h = await launchGame({ ...args, width: 960, height: 600 });
await h.page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 120000 });
await h.page.evaluate(() => window.__HARNESS.setRenderRate(0));

const R = [];
const say = (s) => process.stdout.write(s + '\n');
const A = (id, name, got, pass, target) => {
  R.push({ id, name, got: String(got), target, pass });
  say(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(9)} ${name}\n            got     ${got}\n            target  ${target}`);
};

const OUT = await h.page.evaluate(async () => {
  const H = window.__HARNESS;
  const E = window.__ENGINE;
  const O = {};
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  H.setSeed(1337);
  H.loadState('default');
  H.setRenderRate(0);

  // ---- A. THE ELEVEN ROOMS, LIVE ------------------------------------------------------------
  // Not the offline grid — the actual running world, entered through the door, sampled where the
  // body is standing, at four hours. `helstrom-apothecary` is the room in the round-3 critic's
  // screenshot: hearth light on the beams, two readable windows, three visible people, L 0.0400.
  const DARK_ROOM = 'helstrom-apothecary';
  H.enterInterior(DARK_ROOM);
  H.stepFrames(3);
  O.dark_room = { id: DARK_ROOM, hours: {} };
  for (const hour of [3, 9, 12, 21]) {
    H.setTimeOfDay(hour);
    H.stepFrames(3);
    const st = H.getStealthState();
    O.dark_room.hours[hour] = {
      L: r4(st.terms.L), V: r4(st.V),
      lights: st.lights ? { world_sources: st.lights.world_sources, ambient_L: r4(st.lights.ambient_L),
        synthesized: st.lights.synthesized_lamps, interior_ambient: st.lights.interior_ambient } : null,
    };
  }
  // A windowless room must NOT move with the clock — the `unlit` row's honest use.
  // NOTE: `enterInterior` from INSIDE another interior does not switch cells — the first run of
  // this tool reported stormhold-gaol's ambient as helstrom-apothecary's, which is a probe
  // measuring the probe. Every room change here goes out through the door first.
  try { H.exitInterior(); } catch { /* already outside */ }
  H.setTimeOfDay(12);              // a gaol is not open at 21:00, and `useDoor` says so
  H.stepFrames(2);
  const gaolEnter = H.enterInterior('stormhold-gaol');
  H.stepFrames(3);
  O.windowless = { id: 'stormhold-gaol', entered: gaolEnter, hours: {} };
  for (const hour of [3, 12]) { H.setTimeOfDay(hour); H.stepFrames(3); const st = H.getStealthState(); O.windowless.hours[hour] = { ambient_L: r4(st.lights.ambient_L), windowless: st.lights.interior_ambient && st.lights.interior_ambient.windowless }; }

  // A LAMP-LIT room must still DISCRIMINATE — the round-3 critic's 2x2 arm 01 read a flat 1.0000
  // with the lamps kept and the old ambient restored, and that must not come back.
  // `thorn-inn` rather than `archon-apothecary`, and the reason is a measurement rather than a
  // preference: after `render/exterior.js` fits each room to its building, archon-apothecary is a
  // 9.83 x 4.98 m room holding EIGHT lamps and every cell in it saturates at L 1.0000 — under the
  // round-3 flat 0.04 constant as well as under this round's derived ambient, so it is not a room
  // in which any light model can be shown to discriminate. thorn-inn is a 10-lamp tavern that does.
  const LIT_ROOM = 'thorn-inn';
  H.setTimeOfDay(12);
  try { H.exitInterior(); } catch { /* already outside */ }
  H.stepFrames(2);
  H.enterInterior(LIT_ROOM);
  H.stepFrames(3);
  {
    const rec = E.sim.settlements.interior(LIT_ROOM);
    const b = rec.bounds_m;
    let min = Infinity, max = -Infinity, minAt = null, maxAt = null;
    for (let x = b.x[0] + 0.2; x <= b.x[1] - 0.2; x += 0.4) {
      for (let z = b.z[0] + 0.2; z <= b.z[1] - 0.2; z += 0.4) {
        const L = H.getLightAt(x, b.y[0] + 1.35, z);
        if (L < min) { min = L; minAt = [x, z]; }
        if (L > max) { max = L; maxAt = [x, z]; }
      }
    }
    const st = H.getStealthState();
    O.lit_room = { id: LIT_ROOM, world_sources: st.lights.world_sources, ambient_L: r4(st.lights.ambient_L),
      L_min: r4(min), L_max: r4(max), spread: r4(max - min), dark_at: minAt, bright_at: maxAt,
      interior_ambient: st.lights.interior_ambient };
    // And at 03:00 the same room must be darker, which round 3's flat constant could not say.
    H.setTimeOfDay(3); H.stepFrames(3);
    let min3 = Infinity;
    for (let x = b.x[0] + 0.2; x <= b.x[1] - 0.2; x += 0.4) for (let z = b.z[0] + 0.2; z <= b.z[1] - 0.2; z += 0.4) min3 = Math.min(min3, H.getLightAt(x, b.y[0] + 1.35, z));
    O.lit_room.L_min_at_0300 = r4(min3);
    O.lit_room.ambient_at_0300 = r4(H.getStealthState().lights.ambient_L);
    H.setTimeOfDay(12); H.stepFrames(3);
  }

  // ---- B. THE FENCE -------------------------------------------------------------------------
  // Every property object in the tree against every fence. This is the round-3 critic's own
  // acceptance number: "Reachable today: 0 of 1,950. Required: >= 1,787 (91.6%)."
  const fences = E.data.crime.fences.fences.map((f) => f.id);
  const objects = [];
  for (const k of Object.keys(E.data.property || {})) {
    for (const z of E.data.property[k].zones || []) {
      for (const c of z.contents || []) objects.push({ instance: c.instance, owner: c.owner, value_g: c.value_g, unique: c.unique, settlement: z.settlement });
    }
  }
  const byKind = { npc: 0, faction: 0, settlement: 0, other: 0 };
  let refusable = 0, refusableNpc = 0, unresolved = 0;
  const reasons = {};
  const noFence = {};
  for (const o of objects) {
    const kind = /^npc:/.test(o.owner) ? 'npc' : /^faction:/.test(o.owner) ? 'faction' : /^settlement:/.test(o.owner) ? 'settlement' : 'other';
    byKind[kind]++;
    if (kind === 'npc' && !E.npcById(o.owner)) unresolved++;
    let refused = null;
    for (const fid of fences) {
      const q = E.fenceQuote(fid, { stolen_from: o.owner, value_g: o.value_g, unique: o.unique, stolen_settlement: o.settlement });
      if (!q.buys) { refused = q.reason; break; }
    }
    if (refused) { refusable++; if (kind === 'npc') refusableNpc++; reasons[refused] = (reasons[refused] || 0) + 1; }
    else if (kind === 'npc') { const s = (E.npcById(o.owner) || {}).settlement || 'unknown'; noFence[s] = (noFence[s] || 0) + 1; }
  }
  O.fence = { objects: objects.length, by_owner_kind: byKind, refusable, refusable_npc_owned: refusableNpc,
    unresolved_npc_owners: unresolved, reasons, npc_owned_not_refusable_by_settlement: noFence, fences: fences.length };

  // THE NAMED CASE FROM THE VERDICT, reproduced exactly, plus its clean-item control.
  const VICTIM = 'npc:archon-legionary-13';
  const item = { stolen_from: VICTIM, value_g: 70, unique: false, stolen_settlement: 'archon' };
  O.fence.worked = { owner: VICTIM, owner_record: E.npcById(VICTIM), quotes: {} };
  for (const fid of fences) {
    const q = E.fenceQuote(fid, item);
    O.fence.worked.quotes[fid] = q.buys ? { buys: true, price_g: q.price_g } : { buys: false, reason: q.reason, line: q.line };
  }
  O.fence.worked.clean_control = E.fenceQuote('fence.archon.salvage', { stolen_from: null, value_g: 70, unique: false });
  // The itinerant route case — the only relation in this corpus that crosses a town boundary, and
  // the first time `friend_of_the_owner` has been reachable at all.
  O.fence.route_case = {
    disposition: E.dispositionBetween(VICTIM, 'npc:hard-bargain-jeel', E.data.crime.fences.fences.find((f) => f.id === 'fence.itinerant.sapcutter')),
    quote: E.fenceQuote('fence.itinerant.sapcutter', item),
  };

  // ---- C. THE ZONE, WALKED ------------------------------------------------------------------
  // Not a fixed instant (RULES.md 8): the body is moved across the room and the zone the world
  // reports is read at every step, then the body is taken outside and the zone must go null.
  try { H.exitInterior(); } catch { /* already outside */ }
  H.stepFrames(2);
  H.enterInterior(LIT_ROOM);
  H.stepFrames(3);
  {
    const rec = E.sim.settlements.interior(LIT_ROOM);
    const b = rec.bounds_m;
    const walk = [];
    for (let z = b.z[0] + 0.4; z <= b.z[1] - 0.4; z += 0.8) {
      E.sim.player.pos[0] = 0; E.sim.player.pos[2] = z;
      H.stepFrames(1);
      const st = H.getStealthState();
      walk.push({ z: r4(z), zone: st.zone, ctx: r4(st.context_weight === undefined ? -1 : st.context_weight) });
    }
    O.zone = { interior: LIT_ROOM, declared: rec.property_zones, walk,
      candidates: H.getStealthState().lights.zone_candidates,
      distinct: [...new Set(walk.map((w) => w.zone))] };
    // The trespass ladder in front of the producer: the same zone, asked at two hours.
    const zid = walk.find((w) => w.zone) ? walk.find((w) => w.zone).zone : null;
    if (zid) {
      H.setTimeOfDay(12); H.stepFrames(1); O.zone.trespass_noon = H.trespassCheck(zid, {});
      H.setTimeOfDay(3); H.stepFrames(1); O.zone.trespass_0300 = H.trespassCheck(zid, {});
      H.setTimeOfDay(12); H.stepFrames(1);
    }
    // Outside: no zone.
    try { H.exitInterior(); } catch { /* ignore */ }
    H.stepFrames(3);
    O.zone.outside = H.getStealthState().zone;
  }

  // ---- D. THE COVER VOLUMES -----------------------------------------------------------------
  try { H.exitInterior(); } catch { /* already outside */ }
  H.stepFrames(2);
  H.enterInterior(LIT_ROOM);
  H.stepFrames(3);
  {
    const st = H.getStealthState();
    O.cover = { interior: LIT_ROOM, world: st.lights.cover_volumes_world, total: st.lights.cover_volumes_total,
      volumes: E.sim.stealth.coverVolumes.slice(0, 6).map((v) => ({ id: v.id, pos: v.pos.map(r4), from: v.from })) };
    // AND THE THING THAT READS THEM. A searcher's plan, built by the world rather than by a probe.
    const eid = 'cover-probe';
    const rec = E.sim.settlements.interior(LIT_ROOM);
    const b = rec.bounds_m;
    E.sim.player.pos[0] = 0; E.sim.player.pos[1] = b.y[0]; E.sim.player.pos[2] = 0;
    H.stepFrames(1);
    let plan = null;
    try {
      H.spawn('inf_trash', 2.0, 2.0, { as: eid, yaw: 180 });
      H.stepFrames(1);
      const ent = E.sim.entities.find((x) => x.eid === eid);
      ent.alert = 80; ent.alertState = 'SEARCH';
      ent.lkp = [E.sim.player.pos[0], E.sim.player.pos[1], E.sim.player.pos[2]];
      E.sim.stealth.beginSearch(E.sim, ent, E.sim.frame, null);
      const s = E.sim.stealth.searches.find((x) => x.eid === eid);
      plan = s ? { legs: s.plan.length, ids: s.plan.map((p) => p.id), end_f: s.endFrame - s.startFrame,
        dwell_only_f: Math.round((E.sim.stealth.d.search.s1.lkp_dwell_s + 0 * E.sim.stealth.d.search.s1.per_volume_s) * 60),
        with_plan_f: Math.round((E.sim.stealth.d.search.s1.lkp_dwell_s + s.plan.length * E.sim.stealth.d.search.s1.per_volume_s) * 60) } : null;
    } catch (e) { plan = { error: String(e && e.message || e) }; }
    O.cover.search_plan = plan;
    // THE PERTURBATION (RI-MTH07): take the world's cover volumes away and rebuild the same plan.
    try {
      const keep = E.sim.stealth.coverVolumes.slice();
      E.sim.stealth.coverVolumes.length = 0;
      E.sim.stealth.searches.length = 0;
      const ent = E.sim.entities.find((x) => x.eid === eid);
      if (ent) {
        ent.alert = 80; ent.alertState = 'SEARCH';
        E.sim.stealth.beginSearch(E.sim, ent, E.sim.frame, null);
        const s2 = E.sim.stealth.searches.find((x) => x.eid === eid);
        O.cover.search_plan_without_volumes = s2 ? { legs: s2.plan.length } : null;
      }
      E.sim.stealth.coverVolumes.push(...keep);
      E.sim.stealth.searches.length = 0;
    } catch (e) { O.cover.search_plan_without_volumes = { error: String(e && e.message || e) }; }
  }

  // ---- E. UNIDENTIFIED IS A KIND ------------------------------------------------------------
  H.loadState('default');
  H.setSeed(1337);
  H.setRenderRate(0);
  try { H.exitInterior(); } catch { /* already outside */ }
  H.stepFrames(2);
  H.enterInterior(LIT_ROOM);
  H.stepFrames(3);
  {
    const before = H.getGuardBand({});
    const rows = [];
    // Four UNIDENTIFIED reports. Each lands 0.4x, and none of them may move the band.
    for (let i = 0; i < 4; i++) {
      const c = H.commitCrime('theft', { value_g: 400, jurisdiction: 'imperial', settlement: 'archon' });
      const w = H.addWitness(c.id, { eid: `w${i}`, identified: false, kind: 'sight' });
      const idx = E.sim.stealth.crime.witnesses.indexOf(w);
      const res = H.landReport(idx, 'unlawful');
      const cs = H.getCrimeState();
      const gb = H.getGuardBand({});
      rows.push({ n: i + 1, delta: res.delta, attributed: res.attributed,
        bounty_total: cs.bounty.imperial, unattributed: E.sim.stealth.crime.unattributedIn('imperial'),
        attributed_bounty: E.sim.stealth.crime.attributedIn('imperial'),
        band: gb.band, behaviour: gb.behaviour,
        settlement_alarm: E.sim.stealth.crime.alarmIn('archon', E.sim.frame) });
    }
    // Then ONE identified report of the same size, which must move it.
    const c = H.commitCrime('theft', { value_g: 400, jurisdiction: 'imperial', settlement: 'archon' });
    const w = H.addWitness(c.id, { eid: 'wid', identified: true, kind: 'sight' });
    const res = H.landReport(E.sim.stealth.crime.witnesses.indexOf(w), 'unlawful');
    const after = H.getGuardBand({});
    const cs = H.getCrimeState();
    O.unidentified = {
      band_before: before.band, thresholds: before.thresholds, unidentified_rows: rows,
      identified: { delta: res.delta, attributed: res.attributed, band: after.band, behaviour: after.behaviour,
        bounty_total: cs.bounty.imperial, attributed_bounty: E.sim.stealth.crime.attributedIn('imperial') },
      zone_memory: E.sim.stealth.zones.toJSON(),
      alarm: JSON.parse(JSON.stringify(E.sim.stealth.crime.alarm)),
      alarm_context_multiplier: E.sim.stealth._alarmCtx,
    };
    // SAVE ROUND TRIP (RULES.md 7): the split must survive, or every unidentified crime launders
    // itself on load.
    const blob = H.saveState();
    H.loadState('default');
    const cleared = E.sim.stealth.crime.unattributedIn('imperial');
    H.applySave ? H.applySave(blob) : H.loadState(blob);
    O.unidentified.save_round_trip = {
      cleared_between: cleared,
      after_load_total: E.sim.stealth.crime.bounty.imperial,
      after_load_unattributed: E.sim.stealth.crime.unattributedIn('imperial'),
      after_load_attributed: E.sim.stealth.crime.attributedIn('imperial'),
      after_load_band: H.getGuardBand({}).band,
    };
  }
  return O;
}).catch((e) => ({ fatal: String(e && e.message || e) }));

if (OUT.fatal) { say(`FATAL: ${OUT.fatal}`); await h.close(); process.exit(2); }

// ---- the assertions ---------------------------------------------------------------------------
say('\nW1-15 r4 — THE RUNNING GAME\n' + '='.repeat(86) + '\n');

const dr = OUT.dark_room;
const drMin = Math.min(...[3, 9, 12, 21].map((x) => dr.hours[x].L));
A('R4-A1', 'the eleven regressed rooms are no longer at the `unlit` row',
  `${dr.id}: L ${[3, 9, 12, 21].map((x) => dr.hours[x].L.toFixed(4)).join(' / ')} at 03/09/12/21, sources ${dr.hours[12].lights.world_sources} (${dr.hours[12].lights.synthesized} synthesized)`,
  drMin > 0.04 && dr.hours[12].lights.world_sources > 0, 'every hour > 0.0400 and at least one source (round 3: 0 sources, flat 0.0400)');
A('R4-A2', 'a windowed interior is brighter at noon than at 03:00',
  `${dr.id} ambient ${dr.hours[3].lights.ambient_L} at 03:00 -> ${dr.hours[12].lights.ambient_L} at noon`,
  dr.hours[12].lights.ambient_L > dr.hours[3].lights.ambient_L, 'noon strictly brighter; round 3 was flat 0.0400 at every hour');
A('R4-A3', 'a WINDOWLESS interior does not move with the clock',
  `${OUT.windowless.id} (entered=${JSON.stringify(OUT.windowless.entered && OUT.windowless.entered.entered)}): ${OUT.windowless.hours[3].ambient_L} at 03:00, ${OUT.windowless.hours[12].ambient_L} at noon, windowless=${OUT.windowless.hours[3].windowless}`,
  OUT.windowless.hours[3].ambient_L === OUT.windowless.hours[12].ambient_L && OUT.windowless.hours[12].ambient_L === 0.04,
  'flat 0.0400 — the `unlit interior / xanmeer depth` row, used on the 3 rooms it describes');
A('R4-A4', 'a lamp-lit room still DISCRIMINATES (the r3 critic 2x2 arm-01 trap)',
  `${OUT.lit_room.id}: ${OUT.lit_room.world_sources} lamps, ambient ${OUT.lit_room.ambient_L} at noon / ${OUT.lit_room.ambient_at_0300} at 03:00; L ${OUT.lit_room.L_min}..${OUT.lit_room.L_max}, spread ${OUT.lit_room.spread}; darkest spot ${OUT.lit_room.L_min_at_0300} at 03:00`,
  OUT.lit_room.spread > 0.3 && OUT.lit_room.L_min_at_0300 < OUT.lit_room.L_min,
  'spread > 0.30 and the dark corner is darker at night — arm 01 read a flat 1.0000, spread 0');

const f = OUT.fence;
A('R4-B1', 'a stolen object can be REFUSED by a fence',
  `${f.refusable} of ${f.objects} objects refusable (${f.refusable_npc_owned} of ${f.by_owner_kind.npc} npc-owned); reasons ${JSON.stringify(f.reasons)}`,
  f.refusable_npc_owned >= 1787, 'round 3: 0 of 1,950. Target >= 1,787 npc-owned');
A('R4-B2', 'the victim\'s own local fence refuses, and the control still buys',
  `fence.archon.salvage -> ${JSON.stringify(f.worked.quotes['fence.archon.salvage'])}; clean control -> ${f.worked.clean_control.buys ? `buys ${f.worked.clean_control.price_g} g` : 'refuses'}`,
  f.worked.quotes['fence.archon.salvage'].buys === false && f.worked.clean_control.buys === true,
  'refuses the stolen item by name AND buys the identical clean one — round 3 paid 15 g for both');
A('R4-B3', '`friend_of_the_owner` is reachable at all, for the first time',
  `disposition(${f.worked.owner}, the Sap-Cutter on the Archon route) = ${f.route_case.disposition}; quote -> ${f.route_case.quote.buys ? `buys ${f.route_case.quote.price_g} g` : f.route_case.quote.reason}`,
  f.route_case.disposition >= 60, 'a fence whose own route calls at the owner\'s town knows the owner');
A('R4-B4', 'every npc-owned object resolves to a person',
  `${f.unresolved_npc_owners} unresolvable of ${f.by_owner_kind.npc}`,
  f.unresolved_npc_owners === 0, '0 — the index reads game/data/npcs/ AND the property tree\'s own residents[]');

const z = OUT.zone;
A('R4-C1', '`p.zone` is produced by the world, and it changes as the body moves',
  `${z.interior}: ${z.walk.length} steps, zones seen ${JSON.stringify(z.distinct)}; outside -> ${JSON.stringify(z.outside)}`,
  z.distinct.some((x) => x) && z.outside === null,
  'a real zone id indoors and null outdoors — round 3: zero assignments to p.zone anywhere in game/src');
A('R4-C2', 'the trespass ladder in front of it answers the clock',
  z.trespass_noon ? `${z.trespass_noon.zone}: noon shop_open=${z.trespass_noon.derived_shop_open} trespassing=${z.trespass_noon.trespassing} w=${z.trespass_noon.context_weight}; 03:00 shop_open=${z.trespass_0300.derived_shop_open} trespassing=${z.trespass_0300.trespassing} w=${z.trespass_0300.context_weight}` : 'no zone resolved',
  !!z.trespass_noon, 'the ladder is reachable from a zone the world produced, not one a probe named');

const c = OUT.cover;
A('R4-D1', '`coverVolumes` has a world-side producer',
  `${c.interior}: ${c.world} world volumes, ${c.total} total; e.g. ${c.volumes.slice(0, 2).map((v) => v.id).join(', ')}`,
  c.world > 0, '> 0 — round 3 measured 0 in the world, the only producer being the harness verb');
A('R4-D2', 'and the searcher that reads them plans more than a two-second stare',
  c.search_plan && !c.search_plan.error
    ? `plan ${c.search_plan.legs} leg(s) -> ${c.search_plan.with_plan_f} f; with the volumes removed ${c.search_plan_without_volumes ? c.search_plan_without_volumes.legs : '?'} leg(s) -> ${c.search_plan.dwell_only_f} f`
    : JSON.stringify(c.search_plan),
  !!(c.search_plan && c.search_plan.legs > 0 && c.search_plan_without_volumes && c.search_plan_without_volumes.legs === 0),
  'legs > 0 with the world\'s volumes and 0 without them — the perturbation is the demonstration');

const u = OUT.unidentified;
const lastU = u.unidentified_rows[u.unidentified_rows.length - 1];
A('R4-E1', 'guards do not approach you for a bounty nobody could pin on you',
  `${u.unidentified_rows.length} unidentified reports -> total ${lastU.bounty_total} g, unattributed ${lastU.unattributed} g, attributed ${lastU.attributed_bounty} g, band ${lastU.band} (${lastU.behaviour}); arrest threshold ${u.thresholds.arrest_at}`,
  lastU.bounty_total > u.thresholds.arrest_at && lastU.band === u.band_before,
  'the ledger crosses the arrest threshold and the band does not move — round 3: magnitude only');
A('R4-E2', 'one IDENTIFIED report of the same size does move it',
  `+${u.identified.delta} g identified -> total ${u.identified.bounty_total} g, attributed ${u.identified.attributed_bounty} g, band ${u.identified.band} (${u.identified.behaviour})`,
  u.identified.band > lastU.band, 'the band rises — otherwise the split is inert, not a mechanic');
A('R4-E3', 'the settlement is on alarm and the zone remembers',
  `alarm ${JSON.stringify(u.alarm)}, civilian contextWeight x${u.alarm_context_multiplier}; zone memory ${JSON.stringify(u.zone_memory)}`,
  lastU.settlement_alarm > 0 && Object.keys(u.zone_memory || {}).length > 0,
  'both of `unidentified_effect`\'s other two promises, with a consumer');
A('R4-E4', 'and the split survives a save round trip',
  `cleared to ${u.save_round_trip.cleared_between} between; after load total ${u.save_round_trip.after_load_total} g, unattributed ${u.save_round_trip.after_load_unattributed} g, attributed ${u.save_round_trip.after_load_attributed} g, band ${u.save_round_trip.after_load_band}`,
  u.save_round_trip.cleared_between === 0 && u.save_round_trip.after_load_unattributed === lastU.unattributed + 0,
  'the load actually cleared it first, and the blob put it back — otherwise a save launders every unidentified crime');

// ---- F. THE PICTURE ---------------------------------------------------------------------------
const shotPath = args.shot || 'docs/shots/2026-08-08-w1-15-r4-the-room-that-is-lit-in-both-halves-of-the-build.png';
try {
  await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    H.setRenderRate(1);
    H.setTimeOfDay(3);
    H.setWeather && H.setWeather('clear');
    try { H.exitInterior(); } catch { /* already outside */ }
    H.stepFrames(2);
    H.enterInterior('helstrom-apothecary');
    H.stepFrames(6);
  });
  const dataUrl = await h.page.evaluate(async () => window.__HARNESS.screenshot());
  const buf = Buffer.from(String(dataUrl).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.mkdirSync(path.dirname(shotPath), { recursive: true });
  fs.writeFileSync(shotPath, buf);
  const shotState = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const st = H.getStealthState();
    return { L: Math.round(st.terms.L * 1e4) / 1e4, V: Math.round(st.V * 1e4) / 1e4, ambient: Math.round(st.lights.ambient_L * 1e4) / 1e4,
      sources: st.lights.world_sources, hour: 3, interior: st.lights.interior, ia: st.lights.interior_ambient };
  });
  OUT.shot = { path: shotPath, bytes: buf.length, state: shotState };
  say(`\n  shot: ${shotPath} (${buf.length} B) — ${shotState.interior} at 03:00, L ${shotState.L}, ambient ${shotState.ambient}, ${shotState.sources} source(s)`);
  say('        the round-3 critic\'s room, at the round-3 critic\'s hour. It read L 0.0400 then.');
} catch (e) { say(`\n  shot FAILED: ${String(e && e.message || e)}`); }

const pass = R.filter((x) => x.pass).length;
say(`\n${pass}/${R.length} assertions pass\n`);
if (args.json) writeJson(args.json, { assertions: R, data: OUT });
await h.close();
process.exit(pass === R.length ? 0 : 1);
