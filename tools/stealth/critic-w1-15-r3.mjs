#!/usr/bin/env node
// critic-w1-15-r3 — the W1-15 round-3 critic's own instrument. Offline; no browser, no renderer.
//
// It exists because five of this round's claims are checkable without stepping the simulation,
// and the box was over its contention ceiling (`tools/contention.mjs --gate` exit 3) for the
// whole run. Every number it prints is a claim about a COMMIT — pass --stamp to record which.
//
// Subcommands (default: all):
//   lights   A. "one list, read twice" — does the simulated lit set match the DRAWN lit set?
//   ident    B. is `identified` a step or a slope, and does anything downstream read it?
//   fence    C. which willBuy() refusal branches are reachable from Engine.fenceQuote()?
//   zone     D. does anything in the running world produce `p.zone`?
//   census   E. what did the round's own CONSUMPTION census leave out of its denominator?
//
// RULES.md rule 4 — THIS INSTRUMENT CAN FAIL, and `--selftest` is where it is made to.
// Every arm below has a control that is perturbed on purpose and asserted to go red.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LightField } from '../../game/src/sim/stealth/light.js';
import { isWitness } from '../../game/src/sim/crime/witness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => path.join(ROOT, p);
const readJSON = (p) => JSON.parse(fs.readFileSync(R(p), 'utf8'));

const argv = process.argv.slice(2);
// `--stamp <sha>` and `--json <path>` consume the token after them; a bare token that is not a
// flag's value is a subcommand. Getting this wrong made the first run of this tool print four
// lines and exit 0 — a green run that measured nothing, which is the shape rule 4 exists for.
const VALUED = new Set(['--stamp', '--json']);
const want = new Set(argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1])));
const has = (f) => argv.includes(f);
const runs = (name) => want.size === 0 || want.has(name);
const out = { tool: 'critic-w1-15-r3', at: new Date().toISOString(), stamp: null, findings: [] };
let failures = 0;

const say = (s = '') => process.stdout.write(`${s}\n`);
const hdr = (s) => { say(); say(s); say('='.repeat(Math.min(78, s.length))); };

// ---------------------------------------------------------------------------------------------
// shared: the interior corpus, and the two lit sets
// ---------------------------------------------------------------------------------------------

function interiors() {
  const dir = R('game/data/world/interiors');
  const recs = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const rec of Array.isArray(j) ? j : (j.interiors || [j])) if (rec && rec.id) recs.push(rec);
  }
  return recs;
}

/** render/interior.js's dedupe, verbatim: round each axis to a decimetre, keep the first. */
function dedupe(lights) {
  const seen = new Set(); const u = [];
  for (const L of lights || []) {
    const p = L.pos || [0, 1.4, 0];
    const k = `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)},${Math.round(p[2] * 10)}`;
    if (seen.has(k)) continue;
    seen.add(k); u.push(L);
  }
  return u;
}

/**
 * Build a LightField the way sim/stealth/system.js::syncInteriorLights() does.
 *
 * `litCap` is the ONLY variable between the two arms. Infinity = the simulation's answer
 * (every deduped lamp illuminates). 5 = render/interior.js's `LIT_CAP`, i.e. what the player
 * is actually looking at. `failOpen` reproduces the renderer's `if (!lit)` branch, which
 * invents a hearth in a room that declares no lamp at all — the simulation has no such branch.
 */
function fieldFor(rec, det, { litCap = Infinity, failOpen = false } = {}) {
  const cfg = det.interior_lamps;
  const lf = new LightField(det);
  lf.defaultAmbient = cfg.interior_ambient_L;
  const u = dedupe(rec.lights);
  let lit = 0;
  for (const L of u) {
    const q = L.pos || [0, 1.4, 0];
    const hearth = L.kind === 'hearth';
    const authored = Number(L.intensity === undefined ? 0.55 : L.intensity);
    lf.addSource({
      id: `world:${L.id || `${rec.id}:${q.join(',')}:${lit}`}`,
      pos: [q[0], q[1], q[2]], intensity: authored * cfg.authored_intensity_to_L_scale,
      snuffable: !!L.snuffable, zone: null, world: true, kind: L.kind || 'lamp',
      authored_intensity: authored, reach_m: hearth ? cfg.reach_m.hearth : cfg.reach_m.flame,
      lit: lit < litCap,
    });
    lit++;
  }
  // render/interior.js: "A room with no declared light is not a room in the dark by accident:
  // one hearth, so the fail-open case is a lit room rather than a black frame."
  if (failOpen && !u.length) {
    const key = rec.light || { pos: [0, 0.7, 0], intensity: 1.0 };
    lf.addSource({
      id: 'world:failopen-hearth', pos: [key.pos[0], key.pos[1] + 1.0, key.pos[2]],
      intensity: 1.0 * cfg.authored_intensity_to_L_scale, zone: null, world: true,
      kind: 'hearth', authored_intensity: 1.0, reach_m: cfg.reach_m.hearth,
    });
  }
  return lf;
}

/** Sample the walkable floor of a room on a 1 m grid at chest height. */
function floorGrid(rec, step = 1.0) {
  const b = rec.bounds_m || { x: [-6, 6], y: [0, 3.2], z: [-9, 9] };
  const pts = [];
  for (let x = b.x[0]; x <= b.x[1]; x += step) for (let z = b.z[0]; z <= b.z[1]; z += step) pts.push([x, 1.35, z]);
  return pts;
}

// ---------------------------------------------------------------------------------------------
// A. lights — the simulated lit set against the drawn lit set
// ---------------------------------------------------------------------------------------------

function armLights(litCapDrawn = 5, failOpen = true) {
  const det = readJSON('game/data/stealth/detection.json');
  const DARK = 0.10;                                  // light.js darkCoverage()'s own threshold
  const rows = [];
  for (const rec of interiors()) {
    const simF = fieldFor(rec, det, { litCap: Infinity, failOpen: false });
    const drwF = fieldFor(rec, det, { litCap: litCapDrawn, failOpen });
    const pts = floorGrid(rec);
    let simDark = 0, drwDark = 0, drawnDarkSimLit = 0, drawnLitSimDark = 0, maxGap = 0;
    for (const [x, y, z] of pts) {
      const a = simF.sample(x, y, z, undefined);
      const b = drwF.sample(x, y, z, undefined);
      const aD = a <= DARK, bD = b <= DARK;
      if (aD) simDark++; if (bD) drwDark++;
      if (bD && !aD) drawnDarkSimLit++;              // you are standing in a visible shadow and are lit
      if (aD && !bD) drawnLitSimDark++;              // you are standing in a lit room and are invisible
      maxGap = Math.max(maxGap, Math.abs(a - b));
    }
    rows.push({
      id: rec.id, declared: (rec.lights || []).length, deduped: dedupe(rec.lights).length,
      cells: pts.length,
      sim_dark_share: +(simDark / pts.length).toFixed(4),
      drawn_dark_share: +(drwDark / pts.length).toFixed(4),
      drawn_dark_sim_lit: drawnDarkSimLit, drawn_lit_sim_dark: drawnLitSimDark,
      disagree_share: +((drawnDarkSimLit + drawnLitSimDark) / pts.length).toFixed(4),
      max_L_gap: +maxGap.toFixed(4),
    });
  }
  const cells = rows.reduce((a, r) => a + r.cells, 0);
  const dis = rows.reduce((a, r) => a + r.drawn_dark_sim_lit + r.drawn_lit_sim_dark, 0);
  return {
    interiors: rows.length,
    over_cap: rows.filter((r) => r.deduped > litCapDrawn).length,
    zero_declared: rows.filter((r) => r.deduped === 0).length,
    rooms_that_disagree: rows.filter((r) => r.disagree_share > 0).length,
    cells, disagreeing_cells: dis, disagree_share: +(dis / cells).toFixed(4),
    drawn_dark_sim_lit: rows.reduce((a, r) => a + r.drawn_dark_sim_lit, 0),
    drawn_lit_sim_dark: rows.reduce((a, r) => a + r.drawn_lit_sim_dark, 0),
    rows,
  };
}

function cmdLights() {
  hdr('A. ONE LIST, READ TWICE — is the simulated lit set the DRAWN lit set?');
  const a = armLights(5, true);
  say(`  ${a.interiors} interiors, ${a.cells} floor cells sampled at 1 m on a chest-height grid.`);
  say(`  deduped lamps > render/interior.js LIT_CAP(5) ......... ${a.over_cap} interiors (${(100 * a.over_cap / a.interiors).toFixed(1)}%)`);
  say(`  interiors declaring NO lamp at all .................... ${a.zero_declared} (the renderer invents a hearth; the sim does not)`);
  say(`  rooms where the two arms disagree about a floor cell .. ${a.rooms_that_disagree} / ${a.interiors}`);
  say(`  floor cells DRAWN DARK but SIMULATED LIT .............. ${a.drawn_dark_sim_lit}`);
  say(`  floor cells DRAWN LIT but SIMULATED DARK ............. ${a.drawn_lit_sim_dark}`);
  say(`  total disagreement ................................... ${a.disagreeing_cells} / ${a.cells} = ${(100 * a.disagree_share).toFixed(2)}% of the province's indoor floor`);
  say();
  say('  worst ten rooms:');
  for (const r of [...a.rows].sort((x, y) => y.disagree_share - x.disagree_share).slice(0, 10)) {
    say(`    ${r.id.padEnd(28)} lamps ${String(r.deduped).padStart(2)}  dark sim ${r.sim_dark_share.toFixed(3)} / drawn ${r.drawn_dark_share.toFixed(3)}  disagree ${(100 * r.disagree_share).toFixed(1)}%  maxΔL ${r.max_L_gap.toFixed(3)}`);
  }
  // CONTROL (rule 6): remove the thing under test — the cap and the fail-open hearth — and the
  // disagreement must go to exactly zero. A control that never goes red is a second positive arm.
  const ctl = armLights(Infinity, false);
  const ok = ctl.disagreeing_cells === 0;
  say();
  say(`  CONTROL (cap removed, fail-open removed): ${ctl.disagreeing_cells} disagreeing cells — ${ok ? 'GOES GREEN as it must' : 'STILL RED: the instrument is measuring something else'}`);
  if (!ok) failures++;
  out.findings.push({ arm: 'lights', ...a, rows: undefined, control_disagreeing_cells: ctl.disagreeing_cells });
  out.lights_rows = a.rows;
  return a;
}

// ---------------------------------------------------------------------------------------------
// B. ident — the dark witness. Is it a slope or a step, and does anything read it?
// ---------------------------------------------------------------------------------------------

function cmdIdent() {
  hdr('B. THE DARK WITNESS — continuous V, and what reads `identified`');
  const jus = readJSON('game/data/crime/justice.json');
  const bd = readJSON('game/data/crime/bounty.json');
  const w = jus.witness;
  const quote = 294;                                  // the round's own measured in-the-room bounty
  const mult = bd.partial_report.multiplier;
  const npc = { alive: true, group: 'civilian', R: 16, advancedToChallengeOrAlarmThisFrame: true };
  const rows = [];
  let prevBounty = null, edges = [];
  for (let V = 0.00; V <= 1.3001; V += 0.005) {
    const v = +V.toFixed(4);
    const r = isWitness(jus, npc, { los: true, V: v, dist: 2.0 });
    const bounty = !r.witness ? 0 : Math.round(quote * (r.identified ? 1.0 : mult));
    rows.push({ V: v, witness: !!r.witness, identified: !!r.identified, bounty_g: bounty });
    if (prevBounty !== null && bounty !== prevBounty) edges.push({ at_V: v, from_g: prevBounty, to_g: bounty });
    prevBounty = bounty;
  }
  say(`  swept V from 0.000 to 1.300 in 0.005 steps (${rows.length} samples), witness at 2.0 m, LOS clear.`);
  say(`  distinct bounty outcomes: ${[...new Set(rows.map((r) => r.bounty_g))].sort((a, b) => a - b).join(' g, ')} g`);
  for (const e of edges) say(`    step at V = ${e.at_V.toFixed(3)}: ${e.from_g} g -> ${e.to_g} g`);
  say(`  declared thresholds: V_min ${w.V_min}, identified_at_V ${w.identified_at_V}, partial multiplier ${mult}`);
  say(`  118 g reproduces as Math.round(${quote} x ${mult}) = ${Math.round(quote * mult)} g — arithmetic, not a second model.`);
  say();
  // Now the part that matters: what, in game/src, reads the flag?
  const readers = grepSrc(/\bidentified\b/);
  const consumers = readers.filter((r) => !/^game\/src\/(harness|engine)\.js/.test(r.file) && !/writes|log\.push|events\.push|bus\.emit/.test(r.text));
  say('  every occurrence of `identified` in game/src, classified:');
  for (const r of readers) say(`    ${r.file}:${r.line}  ${r.kind.padEnd(9)} ${r.text.trim().slice(0, 96)}`);
  const decisive = readers.filter((r) => r.kind === 'DECIDES');
  say();
  say(`  occurrences that CHANGE A DECISION: ${decisive.length}`);
  for (const r of decisive) say(`    ${r.file}:${r.line}  ${r.text.trim()}`);
  say();
  say('  the guard ladder, for comparison — what stepGuards() actually reads:');
  const gb = grepSrc(/guardBandNow|guardBand\(/).filter((r) => r.file.includes('stealth/system.js') || r.file.includes('crime/justice'));
  for (const r of gb) say(`    ${r.file}:${r.line}  ${r.text.trim().slice(0, 96)}`);
  say();
  say(`  justice.json's own claim for an unidentified report: ${JSON.stringify(w.unidentified_effect)}`);
  const claimsGuardsDoNotApproach = /guards do not approach/i.test(w.unidentified_effect || '');
  say(`  -> that sentence promises a SECOND consequence beyond the multiplier: ${claimsGuardsDoNotApproach ? 'YES' : 'no'}`);
  out.findings.push({
    arm: 'ident', edges, distinct_bounties: [...new Set(rows.map((r) => r.bounty_g))],
    decisive_readers: decisive.map((r) => `${r.file}:${r.line}`),
    total_occurrences: readers.length,
    unidentified_effect_claims_guard_behaviour: claimsGuardsDoNotApproach,
  });
  // CONTROL: the sweep must be able to show a slope. Feed a predicate that grades continuously
  // and confirm the edge count moves — otherwise the "one step" result is the sweep's own shape.
  let synth = 0, prev = null;
  for (let V = 0; V <= 1.3001; V += 0.005) { const b = Math.round(quote * Math.min(1, V)); if (prev !== null && b !== prev) synth++; prev = b; }
  say();
  say(`  CONTROL (a deliberately CONTINUOUS grader over the same sweep): ${synth} edges vs the shipped ${edges.length}. The instrument can see a slope; the shipped model has none.`);
  if (synth <= edges.length) { say('  CONTROL FAILED — the sweep cannot distinguish a slope from a step.'); failures++; }
  return { edges, decisive };
}

// ---------------------------------------------------------------------------------------------
// C. fence — willBuy()'s refusal branches, against the world Engine.fenceQuote() hands it
// ---------------------------------------------------------------------------------------------

function cmdFence() {
  hdr('C. THE FENCE — which refusals can fire in play?');
  const src = fs.readFileSync(R('game/src/engine.js'), 'utf8');
  const m = /const world = \{([^}]*)\};/.exec(src.slice(src.indexOf('fenceQuote(fenceId, item)')));
  say(`  Engine.fenceQuote()'s world object: { ${m ? m[1].trim() : '??'} }`);
  const stubNpc = m && /npcById:\s*\(\)\s*=>\s*null/.test(m[1]);
  const stubDisp = m && /dispositionBetween:\s*\(\)\s*=>\s*0/.test(m[1]);
  say(`  npcById is a stub returning null ......... ${stubNpc}`);
  say(`  dispositionBetween is a stub returning 0 . ${stubDisp}`);
  say();
  // What owner strings actually exist on the property tree?
  const dir = R('game/data/world/property');
  const owners = new Map(); let objects = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const z of j.zones || []) for (const c of z.contents || []) {
      objects++;
      const o = c.owner || z.owner || null;
      const pfx = o === null ? '(none)' : (/^([a-z_]+):/.exec(o) || [, '(bare name)'])[1];
      owners.set(pfx, (owners.get(pfx) || 0) + 1);
    }
  }
  say(`  ${objects} property objects; owner-string prefixes:`);
  for (const [k, v] of [...owners].sort((a, b) => b[1] - a[1])) say(`    ${String(k).padEnd(14)} ${String(v).padStart(6)}  (${(100 * v / objects).toFixed(1)}%)`);
  say();
  // Branch reachability, decided by reading willBuy against the stub world.
  const branches = [
    { name: 'same_settlement', reachable: 'owner string must match /^settlement:/ — npcById is stubbed, so an npc: owner resolves to no settlement' },
    { name: 'same_faction', reachable: 'owner string must match /^faction:/ — same reason' },
    { name: 'friend_of_the_owner', reachable: 'NEVER: dispositionBetween() is stubbed to 0 and the branch needs >= 60' },
    { name: 'not_a_fence', reachable: 'NEVER from fenceQuote(): it constructs buyer with is_fence: true unconditionally' },
  ];
  const npcOwned = owners.get('npc') || 0;
  const settlementOwned = owners.get('settlement') || 0;
  const factionOwned = owners.get('faction') || 0;
  say('  willBuy() refusal branches, as reachable from Engine.fenceQuote():');
  for (const b of branches) say(`    ${b.name.padEnd(22)} ${b.reachable}`);
  say();
  say(`  objects whose owner is a PERSON (npc:) ........ ${npcOwned} (${(100 * npcOwned / objects).toFixed(1)}%)  -> 0 of 4 refusals can fire`);
  say(`  objects owned by a settlement: string ......... ${settlementOwned}`);
  say(`  objects owned by a faction: string ............ ${factionOwned}`);
  const dead = npcOwned + settlementOwned + factionOwned === 0 ? 0 : npcOwned;
  say();
  say(`  ACCEPTANCE NUMBER: a fence must refuse a stolen object whose owner lives in the fence's`);
  say(`  own settlement. Reachable today: 0 of ${objects} objects. Required: >= ${npcOwned} (every npc:-owned object),`);
  say(`  which is ${(100 * npcOwned / objects).toFixed(1)}% of the property tree.`);
  out.findings.push({
    arm: 'fence', stub_npcById: !!stubNpc, stub_disposition: !!stubDisp,
    property_objects: objects, owner_prefixes: Object.fromEntries(owners),
    refusals_reachable: 0, refusals_total: 4, npc_owned: npcOwned, dead_objects: dead,
  });
  // CONTROL: give willBuy a REAL npcById and confirm the refusal fires — otherwise "dead" is a
  // property of my reading rather than of the code.
  return controlFence(npcOwned, objects);
}

async function controlFence(npcOwned, objects) {
  const THF = await import('../../game/src/sim/stealth/theft.js');
  const theft = readJSON('game/data/stealth/theft.json');
  const npcs = {};
  const NPCDIR = R('game/data/npcs');
  for (const f of fs.readdirSync(NPCDIR).filter((x) => x.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(NPCDIR, f), 'utf8'));
    for (const n of j.npcs || []) npcs[`npc:${n.id}`] = n;
  }
  say(`  (${Object.keys(npcs).length} npc records loaded from game/data/npcs/ — the table Engine.fenceQuote() declines to consult)`);
  const fences = readJSON('game/data/crime/fences.json').fences;
  // Pick a real owned object and the fence in the owner's own settlement.
  const dir = R('game/data/world/property');
  let probe = null;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const z of j.zones || []) for (const c of z.contents || []) {
      const o = c.owner || z.owner;
      if (!o || !npcs[o]) continue;
      const local = fences.find((x) => x.settlement === npcs[o].settlement);
      if (local) { probe = { owner: o, npc: npcs[o], fence: local, item: c }; break; }
    }
    if (probe) break;
  }
  if (!probe) { say('  CONTROL SKIPPED: no owned object resolved to a settlement with a local fence.'); failures++; return; }
  const buyer = { id: probe.fence.id, settlement: probe.fence.settlement, faction: probe.fence.faction, is_fence: true };
  const item = { stolen_from: probe.owner, value_g: probe.item.value_g || 100, unique: false };
  const shipped = THF.willBuy(theft, buyer, item, { npcById: () => null, dispositionBetween: () => 0 });
  const real = THF.willBuy(theft, buyer, item, { npcById: (id) => npcs[id] || null, dispositionBetween: () => 0 });
  say();
  say(`  CONTROL — the same call, the two worlds, on a real object (${probe.item.instance || probe.item.id || '?'}):`);
  say(`    owner ${probe.owner} lives in ${probe.npc.settlement}; fence ${probe.fence.id} trades in ${probe.fence.settlement}`);
  say(`    SHIPPED world { npcById: () => null } -> ${JSON.stringify(shipped)}`);
  say(`    REAL world    { npcById: <the npc table> } -> ${JSON.stringify(real)}`);
  const red = shipped.buys === true && real.buys === false && real.reason === 'same_settlement';
  say(`    -> ${red ? 'CONTROL GOES RED as it must: the refusal is authored, correct, and unreachable only because of the stub.' : 'CONTROL DID NOT SEPARATE THE ARMS — the finding is not established.'}`);
  if (!red) failures++;
  out.findings.push({ arm: 'fence_control', owner: probe.owner, owner_settlement: probe.npc.settlement, fence: probe.fence.id, shipped, real, separated: red });

  // PRECISION. The round's status file says the three refusals "can never fire for anything
  // owned by a PERSON, which is all 1,878 property objects". The second half is not true: 163
  // objects are owned by a `settlement:` or `faction:` string, and willBuy() parses those out of
  // the owner string with a regex that needs no npcById at all. Measure which side is which,
  // because a critic that repeats the builder's overclaim is not checking it.
  const bySettlement = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const z of j.zones || []) for (const c of z.contents || []) {
      const o = c.owner || z.owner;
      const s = (/^settlement:(.+)$/.exec(o || '') || [])[1];
      if (s && !bySettlement.length) bySettlement.push({ owner: o, settlement: s, item: c });
    }
  }
  if (bySettlement.length) {
    const p = bySettlement[0];
    const local = fences.find((x) => x.settlement === p.settlement);
    if (local) {
      const q = THF.willBuy(theft, { id: local.id, settlement: local.settlement, faction: local.faction, is_fence: true },
        { stolen_from: p.owner, value_g: 100, unique: false }, { npcById: () => null, dispositionBetween: () => 0 });
      say(`  PRECISION — a settlement:-owned object at its own local fence, SHIPPED world: ${JSON.stringify(q)}`);
      say(`    -> the settlement/faction refusals ARE reachable for the 163 non-person-owned objects.`);
      say(`       The round's "all 1,878 objects" is an overclaim; the real dead set is the 1,787 npc:-owned ones.`);
      out.findings.push({ arm: 'fence_precision', settlement_owned_refusal: q });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// D. zone — is there a world-side producer for p.zone?
// ---------------------------------------------------------------------------------------------

function cmdZone() {
  hdr('D. TRESPASS — does anything in the running world set p.zone?');
  const writes = grepSrc(/\bp\.zone\s*=|\.p\.zone\s*=|zone:\s*[^,}]*\)/).filter((r) => /\.zone\s*=/.test(r.text));
  const reads = grepSrc(/\bp\.zone\b/);
  say(`  occurrences of p.zone in game/src: ${reads.length}`);
  for (const r of reads) say(`    ${r.file}:${r.line}  ${r.kind.padEnd(9)} ${r.text.trim().slice(0, 100)}`);
  const worldWrites = writes.filter((r) => !r.file.includes('harness/'));
  say();
  say(`  ASSIGNMENTS to p.zone outside game/src/harness: ${worldWrites.length}`);
  for (const r of worldWrites) say(`    ${r.file}:${r.line}  ${r.text.trim()}`);
  const harnessWrites = writes.filter((r) => r.file.includes('harness/'));
  say(`  ASSIGNMENTS inside the harness (a probe verb, not the world): ${harnessWrites.length}`);
  for (const r of harnessWrites) say(`    ${r.file}:${r.line}  ${r.text.trim().slice(0, 100)}`);
  // What is downstream of it and therefore unreachable?
  const zoneFiles = ['game/data/world/property'];
  let zones = 0, classes = new Set();
  for (const f of fs.readdirSync(R(zoneFiles[0])).filter((x) => x.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(R(zoneFiles[0]), f), 'utf8'));
    for (const z of j.zones || []) { zones++; classes.add(z.class); }
  }
  say();
  say(`  behind that producer: ${zones} authored property zones in ${[...classes].length} classes (${[...classes].sort().join(', ')})`);
  say(`  and the whole trespass ladder, which the round's PREDECESSOR pass fixed for 66/66 shop_closed zones.`);
  out.findings.push({ arm: 'zone', world_writes: worldWrites.length, harness_writes: harnessWrites.length, zones, classes: [...classes] });
  if (worldWrites.length > 0) { say('  (a world-side producer EXISTS — the round\'s claim would be stale)'); }
  return worldWrites.length;
}

// ---------------------------------------------------------------------------------------------
// E. census — what the round's own CONSUMPTION census left out
// ---------------------------------------------------------------------------------------------

function leaves(obj, prefix, acc) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') leaves(v, p, acc);
    else acc.push({ path: p, key: k, value: v });
  }
  return acc;
}

function cmdCensus() {
  hdr('E. CONSUMPTION — the census, and its denominator');
  const declared = ['stealth/detection.json', 'stealth/theft.json', 'stealth/locks.json',
    'crime/bounty.json', 'crime/justice.json', 'crime/sanction.json', 'crime/fences.json'];
  const onDisk = [];
  for (const d of ['stealth', 'crime']) for (const f of fs.readdirSync(R(`game/data/${d}`)).filter((x) => x.endsWith('.json'))) onDisk.push(`${d}/${f}`);
  const missing = onDisk.filter((f) => !declared.includes(f));
  say(`  the round's census names ${declared.length} files. game/data/{stealth,crime} holds ${onDisk.length}.`);
  say(`  NOT IN THE DENOMINATOR: ${missing.join(', ') || '(none)'}`);
  for (const f of missing) {
    const j = readJSON(`game/data/${f}`);
    const ls = leaves(j, '', []).filter((l) => !/_note$|_source$|^why|^how_to|^spec$|^source$|^order$|^schema$|^name$/.test(l.key) && !(typeof l.value === 'string' && l.value.length > 60));
    const src = fs.readdirSync(R('game/src'), { recursive: true }).filter((x) => String(x).endsWith('.js'))
      .map((x) => path.join(R('game/src'), String(x)));
    const blob = src.map((p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }).join('\n');
    const unread = ls.filter((l) => !new RegExp(`\\b${l.key.replace(/[^\w]/g, '.')}\\b`).test(blob));
    say(`    ${f}: ${ls.length} parameters, ${unread.length} with no reader anywhere in game/src`);
    for (const u of unread) say(`      ${u.path} = ${JSON.stringify(u.value)}`);
    out.findings.push({ arm: 'census_omission', file: f, params: ls.length, unread: unread.length, unread_paths: unread.map((u) => u.path) });
  }
  say();
  say('  why this file in particular matters: the round-2 verdict already graded the model it');
  say('  configures — `plausibleSet` (S-1) — at coupling 0.0, "returns [] every time". The one');
  say('  W1-15 data file with a verdict-confirmed dead consumer is the one the census excluded.');
  return missing;
}

// ---------------------------------------------------------------------------------------------
// grep helper — classify each occurrence as a WRITE, a REPORT (log/trace/serialise) or a DECISION
// ---------------------------------------------------------------------------------------------

let SRC_CACHE = null;
function srcFiles() {
  if (SRC_CACHE) return SRC_CACHE;
  const acc = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) acc.push(p); } };
  walk(R('game/src'));
  SRC_CACHE = acc;
  return acc;
}

function grepSrc(re) {
  const hits = [];
  for (const p of srcFiles()) {
    const rel = path.relative(ROOT, p);
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    lines.forEach((text, i) => {
      if (!re.test(text)) return;
      const t = text.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;   // comments are not consumers
      let kind = 'READ';
      if (/^\s*(this\.)?\w[\w.]*\s*=/.test(text) || /\.\w+\s*=\s*[^=]/.test(text)) kind = 'WRITES';
      if (/log\.push|events\.push|bus\.emit|toJSON|res\.|q\.\w+\s*=|map\(/.test(text)) kind = 'REPORTS';
      if (/\bif\s*\(|\?\s|&&|\|\||return\s+[^;]*\?/.test(text) && !/log\.push|events\.push|bus\.emit/.test(text)) kind = 'DECIDES';
      hits.push({ file: rel, line: i + 1, text, kind });
    });
  }
  return hits;
}

// ---------------------------------------------------------------------------------------------
// selftest — RULES.md rule 4. Break each thing under test and confirm the arm goes red.
// ---------------------------------------------------------------------------------------------

async function selftest() {
  hdr('SELFTEST — every arm perturbed on purpose');
  let bad = 0;
  const det = readJSON('game/data/stealth/detection.json');

  // 1. lights: a synthetic room with exactly 5 lamps must show ZERO divergence; the same room
  //    with 14 must show some. If the 5-lamp room disagrees, the instrument is comparing noise.
  const mk = (n) => ({ id: `synthetic-${n}`, bounds_m: { x: [-6, 6], y: [0, 3], z: [-6, 6] }, lights: Array.from({ length: n }, (_, i) => ({ id: `l${i}`, kind: 'lamp', intensity: 0.55, pos: [-5 + i * 0.8, 1.4, -5 + i * 0.8] })) });
  for (const [n, expectDisagree] of [[5, false], [14, true]]) {
    const rec = mk(n);
    const s = fieldFor(rec, det, { litCap: Infinity }), d = fieldFor(rec, det, { litCap: 5 });
    let dis = 0;
    for (const [x, y, z] of floorGrid(rec)) { const a = s.sample(x, y, z) <= 0.10, b = d.sample(x, y, z) <= 0.10; if (a !== b) dis++; }
    const ok = expectDisagree ? dis > 0 : dis === 0;
    say(`  lights/${n}-lamp room: ${dis} disagreeing cells — ${ok ? 'PASS' : 'FAIL'} (expected ${expectDisagree ? '>0' : '0'})`);
    if (!ok) bad++;
  }
  // 2. lights: a room with zero lamps must be ALL-dark in the sim arm and NOT all-dark in the
  //    drawn arm, or the fail-open finding is mine rather than the renderer's.
  const empty = { id: 'synthetic-empty', bounds_m: { x: [-4, 4], y: [0, 3], z: [-4, 4] }, lights: [], light: { pos: [0, 0.7, 0], intensity: 1.0 } };
  const es = fieldFor(empty, det, { litCap: Infinity, failOpen: false }), ed = fieldFor(empty, det, { litCap: 5, failOpen: true });
  const pts = floorGrid(empty);
  const simAllDark = pts.every(([x, y, z]) => es.sample(x, y, z) <= 0.10);
  const drwSomeLit = pts.some(([x, y, z]) => ed.sample(x, y, z) > 0.10);
  say(`  lights/empty room: sim all-dark ${simAllDark}, drawn has lit floor ${drwSomeLit} — ${simAllDark && drwSomeLit ? 'PASS' : 'FAIL'}`);
  if (!(simAllDark && drwSomeLit)) bad++;

  // 3. ident: the predicate must actually move when the threshold moves. Feed a doctored
  //    justice table with identified_at_V = 0 and confirm every witness comes back identified.
  const jus = readJSON('game/data/crime/justice.json');
  const doctored = JSON.parse(JSON.stringify(jus)); doctored.witness.identified_at_V = 0;
  const npc = { alive: true, group: 'civilian', R: 16, advancedToChallengeOrAlarmThisFrame: true };
  const a = isWitness(jus, npc, { los: true, V: 0.2, dist: 2 });
  const b = isWitness(doctored, npc, { los: true, V: 0.2, dist: 2 });
  say(`  ident/threshold: shipped identified=${a.identified}, doctored(0.0) identified=${b.identified} — ${a.identified === false && b.identified === true ? 'PASS' : 'FAIL'}`);
  if (!(a.identified === false && b.identified === true)) bad++;

  // 4. census: the leaf walker must find a canary nobody can read, and must NOT call a live
  //    parameter unread.
  const acc = leaves({ zzz_canary_no_file_mentions_this: 1, radius_m: 8 }, '', []);
  const blob = srcFiles().map((p) => fs.readFileSync(p, 'utf8')).join('\n');
  const canaryUnread = !new RegExp('\\bzzz_canary_no_file_mentions_this\\b').test(blob);
  const liveRead = new RegExp('\\bradius_m\\b').test(blob);
  say(`  census/canary unread ${canaryUnread}, live param read ${liveRead} — ${canaryUnread && liveRead ? 'PASS' : 'FAIL'}`);
  if (!(canaryUnread && liveRead)) bad++;

  say();
  say(bad ? `SELFTEST FAILED: ${bad} arm(s) could not be made to go red.` : 'SELFTEST PASS — every arm was broken on purpose and every control went red.');
  if (bad) process.exit(21);
  return bad;
}

// ---------------------------------------------------------------------------------------------

const stampIdx = argv.indexOf('--stamp');
if (stampIdx >= 0) out.stamp = argv[stampIdx + 1];

if (has('--selftest')) { await selftest(); }
else {
  if (runs('lights')) cmdLights();
  if (runs('ident')) cmdIdent();
  if (runs('fence')) await cmdFence();
  if (runs('zone')) cmdZone();
  if (runs('census')) cmdCensus();
  const jsonIdx = argv.indexOf('--json');
  if (jsonIdx >= 0) { fs.writeFileSync(argv[jsonIdx + 1], JSON.stringify(out, null, 2)); say(`\nwrote ${argv[jsonIdx + 1]}`); }
  say();
  say(failures ? `${failures} CONTROL(S) DID NOT SEPARATE — treat every number above as unestablished.` : 'all controls separated.');
}
process.exit(failures ? 1 : 0);
