#!/usr/bin/env node
// matrix-probe.mjs — RI-CMP01 Comparison method, Stage 2. THE STAGE THAT MATTERS.
//
//   node tools/composition/matrix-probe.mjs --claims reports/composition/w1/claims.json \
//     --cells corpus/95-experience/RI-CMP01.cells.json \
//     --out reports/composition/w1/matrix.json
//
// "Every claimed cell gets a paired A/B harness run, same seed, same scenario, same input
// script, differing ONLY in the source state. ... A cell whose A/B traces are identical is a
// paper cell and scores 0. This is the single rule the whole item turns on: *the probe is a
// difference, and a difference cannot be asserted, only observed.*"
//
// WHICH IS THE SABOTAGE CONTROL, EXACTLY. A matrix cell probe and a delete-the-fix control are
// the same measurement wearing two names: run it with the mechanism, run it without, and fail
// when the arms agree. So this file does not implement that comparison — it calls
// `tools/experience/lib/sabotage.mjs`, and inherits three things it would otherwise have had to
// get right on its own:
//
//   · a cell whose arms agree is INERT, i.e. a paper cell, and scores 0;
//   · a cell whose arms differ but whose OBSERVATION ranged over zero units is VACUOUS, not a
//     demonstration — the arena with no bodies in it, which is how W1-13's clause passed;
//   · a cell that needs two pieces of source state to move at all is MASKED and is reported as
//     such rather than as two separate inert cells.
//
// The third one matters here more than anywhere: RI-CMP01's own How-we-lose says "`ROS` and
// `BOS` columns get filled with aggro tweaks", and an aggro flag with two guards on it is
// precisely the shape a one-factor probe reports as dead.
//
// ONE BROWSER, KEPT (RULES #21). Every cell runs in the same page. `--gate` refuses to launch
// when `tools/contention.mjs` says the box is over its ceiling, and says so rather than queueing.
//
// HONESTY. A cell with no probe implementation is `unprobed` and scores 0 — it is NEVER
// `demonstrated`, and the empty cells are printed by name. RI-CMP01 hard fail 5 is
// `unmeasurable ⇒ 0`, fail-closed, and hard fail 6 says static analysis alone scores zero for
// every cell, so a run of this tool that probes nothing must report exactly that.
//
// SELF-TEST (RULES #4)
//   node tools/composition/matrix-probe.mjs --self-test        (no browser)
// Every probe in the table is run against a FAKE harness in three configurations: one where the
// source state genuinely changes the observable, one where it does not, and one where the
// observation is empty. The probe must report demonstrated / paper / vacuous respectively. A
// probe whose observable is insensitive to its own source state cannot demonstrate anything and
// is caught here before a browser is ever launched.
//
// EXIT: 0 ran · 2 the wave floor was missed · 3 the cells artifact is absent ·
//       4 contention gate refused · 5 self-test failed · 7 the browser could not be driven.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runControl, VERDICT } from '../experience/lib/sabotage.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);
const arg = (k, d) => { const i = argv.findIndex((a) => a === `--${k}` || a.startsWith(`--${k}=`)); if (i < 0) return d; const a = argv[i]; return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1]; };
const say = (s) => process.stdout.write(s + '\n');

// ---------------------------------------------------------------------------------------------
// THE PROBE TABLE.
//
// One entry per cell this build has any chance of demonstrating. Each carries the mechanism and
// the observable RI-CMP01 §D declares for that cell, VERBATIM, so a reader can check that the
// probe asserts the item's observable and not a cheaper one.
//
// `fork` runs inside the page. It receives `{set}` — true on the intact arm (source state SET),
// false on the broken arm (source state UNSET) — and must return `{value, support, detail}`:
//   value    the declared observable
//   support  HOW MANY UNITS THE OBSERVATION RANGED OVER. Enemies in the roster, shops in the
//            town, entities in the arena. Not the value. An arena with no bodies in it makes
//            every alert_state comparison vacuously equal, and that is a VACUOUS verdict here,
//            never a demonstration and never a paper cell.

// ---------------------------------------------------------------------------------------------
// THE ALERT OBSERVABLE, READ FROM THE ACCESSOR THAT ACTUALLY CARRIES IT.
//
// The first live run of this file put six cells at INERT and four at VACUOUS, and it was WRONG
// about how it got there. `listEntities()` returns `{eid, kind, archetype, pos, hp}` and carries
// NO `alert_state` and NO `side` (game/src/engine.js:8764). Every probe reading
// `e.alert_state || e.alert || '?'` was therefore comparing the string `?` against the string
// `?` in both arms — an INERT verdict manufactured by the instrument, not observed in the build.
// That is the exact defect this whole piece exists to catch, and it caught itself.
//
// `alert_state` lives on `getEncounterState(id).members[]` and nowhere else, and it needs a real
// encounter: `spawnEncounter(id, x, z)` from `game/data/world/encounters.json`. So every
// alert-based probe now spawns one, and `support` is the number of MEMBERS the encounter
// actually produced — which is what makes an empty arena VACUOUS rather than a pass.
const ALERT_HELPER = `
  function alertArena(H, encId) {
    var sp = null;
    try { sp = H.spawnEncounter(encId, 12, 0); } catch (e) { return { members: [], error: String(e && e.message || e) }; }
    var st = null;
    try { st = H.getEncounterState(encId); } catch (e) { return { members: [], error: String(e && e.message || e) }; }
    return { members: (st && st.members) || [], spawned: sp && sp.eids ? sp.eids.length : 0 };
  }
  function alertValue(m) {
    return m.map(function (x) { return x.eid + ':' + x.alert_state + ':' + (x.aggroed ? 'A' : '-'); }).sort();
  }
`;

const PROBES = [
  {
    cell: 'TOD->ROS', tier_claimed: 'mechanical',
    mechanism: 'A nocturnal roster: different creatures patrol the same ground at night',
    observable: 'roster ids at hour 3 vs hour 15 on the same route',
    scenario: 'default',
    fork: ({ set }) => {
      const H = window.__HARNESS;
      H.setTimeOfDay(set ? 3 : 15);
      H.stepFrames(120);
      const who = (H.whereIsEveryone ? H.whereIsEveryone() : null) || {};
      const ids = Object.keys(who).sort();
      return { value: ids.map((k) => `${k}@${who[k]}`), support: ids.length, detail: { hour: set ? 3 : 15 } };
    },
  },
  {
    cell: 'SCH->ROS', tier_claimed: 'mechanical',
    mechanism: 'Patrol schedules ARE part of the roster: a road is safe at noon and not at midnight',
    observable: 'roster at the same POI differs by hour',
    scenario: 'default',
    fork: ({ set }) => {
      const H = window.__HARNESS;
      H.setTimeOfDay(set ? 2 : 13);
      H.stepFrames(120);
      const r = H.residentsPresent ? H.residentsPresent() : null;
      const list = Array.isArray(r) ? r : (r && r.present) || [];
      return { value: list.map((x) => (typeof x === 'string' ? x : x.id || x.eid)).sort(), support: list.length };
    },
  },
  {
    cell: 'SPL->ROS', tier_claimed: 'mechanical',
    mechanism: 'Calm / Paralyse / Command remove an enemy from an encounter without killing it',
    observable: 'enemy leaves AGGRO with no death event; or never enters it',
    scenario: 'arena_flat', encounter: 'wl-slitherfang-lone',
    fork: ({ set }) => {
      const H = window.__HARNESS;
      const a = alertArena(H, 'wl-slitherfang-lone');
      for (const m of a.members) { try { H.aggro(m.eid); } catch (e) { /* */ } }
      if (set) { try { H.learnSpell('calm_beast'); } catch (e) { /* */ } try { H.castNow('calm_beast'); } catch (e) { /* */ } }
      H.stepFrames(180);
      const m = alertArena(H, 'wl-slitherfang-lone').members;
      const use = m.length ? m : a.members;
      return { value: alertValue(use), support: use.length, detail: { spawn_error: a.error || null } };
    },
  },
  {
    cell: 'STL->ROS', tier_claimed: 'mechanical',
    mechanism: 'An undetected player faces no encounter; a witnessed crime spawns guards into the roster',
    observable: 'spawn events keyed to crime_witnessed',
    scenario: 'default',
    fork: ({ set }) => {
      const H = window.__HARNESS;
      const n0 = H.listEntities().length;
      if (set) { try { H.addWitness && H.addWitness({}); } catch (e) { /* */ } try { H.commitCrime({ kind: 'assault', witnessed: true }); } catch (e) { /* */ } }
      H.stepFrames(240);
      const ents = H.listEntities();
      const guards = ents.filter((e) => /guard|legion|ordinator/i.test(String(e.archetype || e.eid || '')));
      return { value: { guards: guards.length, total: ents.length }, support: Math.max(n0, ents.length) };
    },
  },
  {
    cell: 'EQP->ROS', tier_claimed: 'mechanical',
    mechanism: 'THE DISGUISE. Wearing a faction’s armour changes patrol aggro — the most legible seam crossing in the game',
    observable: 'alert_state differs by worn item id, same patrol, same seed',
    scenario: 'default',
    encounter: 'wl-legion-picket',
    fork: ({ set }) => {
      const H = window.__HARNESS;
      if (set) { const inv = H.getInventory(); const armour = inv.find((i) => /armour|cuirass|hauberk|uniform|legion/i.test(i.id)); if (armour) { try { H.equipItem(armour.id); } catch (e) { /* */ } } }
      const a = alertArena(H, 'wl-legion-picket');
      H.stepFrames(180);
      const b = alertArena(H, 'wl-legion-picket');
      const m = b.members.length ? b.members : a.members;
      return { value: alertValue(m), support: m.length, detail: { spawn_error: a.error || b.error || null } };
    },
  },
  {
    cell: 'DIS->BOS', tier_claimed: 'mechanical',
    mechanism: 'The S13 parley threshold on a humanoid boss is a disposition gate',
    observable: 'parley event fires only above the threshold',
    scenario: 'arena_flat', encounter: 'wl-legion-picket',
    fork: ({ set }) => {
      const H = window.__HARNESS;
      const a = alertArena(H, 'wl-legion-picket');
      for (const m of a.members) { try { H.setDisposition(m.eid, set ? 95 : 5); } catch (e) { /* */ } }
      H.traceStart && H.traceStart();
      H.stepFrames(180);
      const drained = H.traceDrain ? H.traceDrain() : [];
      const evs = [];
      for (const r of drained || []) for (const e of (r.events || [])) evs.push(e.type);
      const st = alertArena(H, 'wl-legion-picket');
      return {
        value: { parley_accept: evs.filter((t) => t === 'parley_accept').length, parley_refuse: evs.filter((t) => t === 'parley_refuse').length, alert: alertValue(st.members.length ? st.members : a.members) },
        support: (st.members.length ? st.members : a.members).length,
        detail: { spawn_error: a.error || null, event_types: [...new Set(evs)] },
      };
    },
  },
  {
    cell: 'ROS->WLD', tier_claimed: 'mechanical', direction_note: 'F->W — the short side of the matrix',
    mechanism: 'A cleared road changes traversal safety and is recorded as a world flag',
    observable: 'world flag set; TRANSIT hazard rate drops',
    scenario: 'default',
    encounter: 'wl-legion-picket',
    fork: ({ set }) => {
      const H = window.__HARNESS;
      const a = alertArena(H, 'wl-legion-picket');
      if (set) for (const m of a.members) { try { H.killEntity(m.eid); } catch (err) { /* */ } }
      H.stepFrames(180);
      const q = H.getQuestState ? H.getQuestState() : null;
      const flags = (q && q.flags) || {};
      return { value: Object.keys(flags).filter((k) => flags[k]).sort(), support: a.members.length, detail: { spawn_error: a.error || null } };
    },
  },
  {
    cell: 'ROS->DIS', tier_claimed: 'mechanical', direction_note: 'F->W',
    mechanism: 'Killing the thing that was eating the village raises disposition across the settlement',
    observable: 'disposition delta for >= 5 NPCs',
    scenario: 'default',
    encounter: 'wl-legion-picket',
    fork: ({ set }) => {
      const H = window.__HARNESS;
      const a = alertArena(H, 'wl-legion-picket');
      if (set) for (const m of a.members) { try { H.killEntity(m.eid); } catch (err) { /* */ } }
      H.stepFrames(180);
      const d = H.getDispositions ? H.getDispositions() : {};
      const keys = Object.keys(d || {}).sort();
      return { value: keys.map((k) => `${k}:${d[k]}`), support: Math.min(keys.length, a.members.length || 0) || a.members.length, detail: { npcs: keys.length, encounter_members: a.members.length, spawn_error: a.error || null } };
    },
  },
  {
    cell: 'WEA->ROS', tier_claimed: 'mechanical',
    mechanism: 'Salt-storms hide enemies (RI-WLD05 #28): visibility to 15 m, so the roster you can SEE changes',
    observable: 'in_sight_cone / detection distance differs by weather state',
    scenario: 'default',
    encounter: 'wl-fen-sentry',
    fork: ({ set }) => {
      const H = window.__HARNESS;
      try { H.setWeather(set ? 'salt_storm' : 'clear'); } catch (e) { /* */ }
      const a = alertArena(H, 'wl-fen-sentry');
      H.stepFrames(180);
      const m = alertArena(H, 'wl-fen-sentry').members;
      const use = m.length ? m : a.members;
      const seen = use.map((x) => { let l = '?'; try { l = H.losBetween ? String(!!H.losBetween('player', x.eid)) : '?'; } catch (e) { l = 'err'; } return x.eid + ':' + x.alert_state + ':' + x.dist_m + ':' + l; });
      return { value: seen.sort(), support: use.length, detail: { spawn_error: a.error || null } };
    },
  },
  {
    cell: 'FAC->ROS', tier_claimed: 'mechanical',
    mechanism: 'Rank >= 3 in a faction makes its outposts non-hostile; rank >= 2 in its rival makes its patrols hostile on sight',
    observable: 'enemies[].alert_state differs between a rank-0 and rank-3 fork on the same patrol, same seed',
    scenario: 'default',
    encounter: 'wl-legion-picket',
    fork: ({ set }) => {
      const H = window.__HARNESS;
      const st = H.getFactionStanding ? H.getFactionStanding() : {};
      const fid = Object.keys(st || {})[0] || 'the_drowned_court';
      try { H.setFactionStanding(fid, set ? 3 : 0); } catch (e) { /* */ }
      const a = alertArena(H, 'wl-legion-picket');
      H.stepFrames(180);
      const m = alertArena(H, 'wl-legion-picket').members.length ? alertArena(H, 'wl-legion-picket').members : a.members;
      return { value: alertValue(m), support: m.length, detail: { spawn_error: a.error || null } };
    },
  },
];

// ---------------------------------------------------------------------------------------------
// THE FAKE HARNESS. Not a stub that makes probes pass — the opposite: three worlds whose right
// answers are known, so a probe that CANNOT distinguish them is caught with no browser running.

function fakeWorld(mode) {
  // `mode`: 'live' (source state changes the observable), 'paper' (it does not),
  //         'empty' (there is nothing to observe).
  let hour = 12, weather = 'clear', rank = 0, disp = {}, dead = new Set(), worn = null, crime = false;
  const base = mode === 'empty' ? [] : [
    { eid: 'e1', id: 'e1', side: 'E', kind: 'enemy', type: 'guard_legion', alert_state: 'IDLE' },
    { eid: 'e2', id: 'e2', side: 'E', kind: 'enemy', type: 'inf_trash', alert_state: 'IDLE' },
  ];
  const live = mode === 'live';
  const ents = () => base.filter((e) => !dead.has(e.eid)).map((e) => ({
    ...e,
    alert_state: live && (rank >= 3 || worn || weather === 'salt_storm') ? 'CALM' : e.alert_state,
  }));
  return {
    setTimeOfDay(h) { hour = h; },
    setWeather(w) { weather = w; },
    setRenderRate() {}, stepFrames() {}, loadState() {}, setSeed() {},
    listEntities: () => ents(),
    whereIsEveryone: () => (mode === 'empty' ? {} : (live && hour < 6 ? { a: 'inn', b: 'inn' } : { a: 'market', b: 'quay' })),
    residentsPresent: () => (mode === 'empty' ? [] : (live && hour < 6 ? ['a'] : ['a', 'b'])),
    aggro() {}, learnSpell() {}, castNow() { if (live) for (const e of base) e.alert_state = 'CALM'; },
    commitCrime() { crime = true; if (live) base.push({ eid: 'g1', id: 'g1', side: 'E', kind: 'enemy', type: 'guard_legion', alert_state: 'AGGRO' }); },
    addWitness() {},
    getInventory: () => [{ id: 'legion_cuirass' }],
    equipItem(i) { worn = i; },
    setDisposition(id, v) { disp[id] = v; },
    setFactionStanding(f, v) { rank = v; },
    getFactionStanding: () => ({ the_drowned_court: rank }),
    getDispositions: () => (mode === 'empty' ? {} : { n1: live && dead.size ? 60 : 40, n2: 40, n3: 40, n4: 40, n5: 40 }),
    killEntity(id) { dead.add(id); },
    getQuestState: () => ({ flags: mode === 'empty' ? {} : (live && dead.size ? { road_cleared: true } : { seen: true }) }),
    traceStart() {}, traceDrain: () => (mode === 'empty' ? [] : [{ events: (live && Object.values(disp).some((v) => v > 50)) ? [{ type: 'parley_accept' }] : [{ type: 'parley_refuse' }] }]),
    losBetween: (a, b) => !(live && weather === 'salt_storm'),
    getStateHash: () => `${hour}|${weather}|${rank}|${worn}|${crime}|${[...dead].join(',')}`,
  };
}

async function selfTest() {
  say('SELF-TEST — every probe, against three fake worlds whose right answers are known. No browser.');
  const want = { live: VERDICT.OK, paper: VERDICT.INERT, empty: VERDICT.VACUOUS };
  let ok = true;
  for (const p of PROBES) {
    const row = [];
    // The fake world has to expose the same two page-side helpers the live path injects, or the
    // self-test would be exercising a different probe body than the browser runs.
    globalThis.alertArena = (H, id) => { const e = H.listEntities().filter((x) => x.kind === 'enemy'); return { members: e.map((x) => ({ eid: x.eid, alert_state: x.alert_state, aggroed: false, dist_m: 5 })), spawned: e.length }; };
    globalThis.alertValue = (m) => m.map((x) => x.eid + ':' + x.alert_state + ':-').sort();
    for (const mode of ['live', 'paper', 'empty']) {
      const r = await runControl({
        id: `${p.cell}/${mode}`, what: p.mechanism, metric: p.observable,
        // lib/sabotage.mjs requires a caller to say what one unit of `support` is; see its
        // SUPPORT section. Here it is entities the observable was actually read off.
        unit: 'entities in the live world the observable was read from at the fork',
        factors: [{ id: 'source_state', what: `the source state of ${p.cell.split('->')[0]}` }],
        // A FRESH WORLD PER ARM. The first version of this self-test built one fake world and
        // ran both arms against it; the intact arm's kills, equips and casts were still there
        // when the broken arm ran, and five probes reported INERT or VACUOUS for a reason that
        // had nothing to do with the probe. That is the same defect as the W1-04 control — an
        // arm contaminated by its predecessor — and it is why the live path calls
        // `loadState(scenario)` at the top of every arm rather than once per cell.
        measure: async (broken) => {
          globalThis.window = { __HARNESS: fakeWorld(mode) };
          return p.fork({ set: broken.length === 0 });
        },
      });
      row.push({ mode, got: r.verdict, want: want[mode], ok: r.verdict === want[mode] });
    }
    const good = row.every((r) => r.ok);
    if (!good) ok = false;
    say(`  ${good ? 'ok  ' : 'FAIL'}  ${p.cell.padEnd(11)} ` + row.map((r) => `${r.mode}=${r.got}${r.ok ? '' : `(wanted ${r.want})`}`).join('  '));
  }
  delete globalThis.window;
  say(`SELF-TEST ${ok ? 'PASS' : 'FAIL'} — ${PROBES.length} probes x 3 worlds.`);
  return ok;
}

// ---------------------------------------------------------------------------------------------

function contentionGate() {
  try {
    execFileSync('node', [path.join(REPO, 'tools/contention.mjs'), '--gate'], { stdio: 'pipe' });
    return { ok: true };
  } catch (e) {
    return { ok: false, code: e.status, text: String(e.stdout || '') };
  }
}

async function live({ cellsPath, outPath, seed }) {
  const cells = JSON.parse(fs.readFileSync(cellsPath, 'utf8'));
  const byId = new Map(cells.cells.map((c) => [c.id, c]));
  const { launchGame } = await import('../lib/browser.mjs');
  const handle = await launchGame({ width: 320, height: 240 });
  const page = handle.page;
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const results = [];
  try {
    await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 90000 });
    await page.evaluate(() => window.__HARNESS.setRenderRate(0));
    for (const p of PROBES) {
      const declared = byId.get(p.cell);
      const r = await runControl({
        id: p.cell,
        what: p.mechanism,
        metric: p.observable,
        unit: 'entities in the live world the observable was read from at the fork',
        factors: [{ id: 'source_state', what: `${p.cell.split('->')[0]} state set at the fork` }],
        measure: async (broken) => {
          const set = broken.length === 0;
          return page.evaluate(async ({ src, helper, scenario, seed, set }) => {
            const H = window.__HARNESS;
            H.setSeed(seed); H.loadState(scenario); H.setRenderRate(0);
            // eslint-disable-next-line no-new-func
            const fn = new Function(helper + '; return (' + src + ')')();
            try { return fn({ set }); } catch (e) { return { value: { error: String(e && e.message || e) }, support: 0 }; }
          }, { src: p.fork.toString(), helper: ALERT_HELPER, scenario: p.scenario, seed, set });
        },
      });
      r.cell = p.cell;
      r.declared_tier = declared ? declared.tier : null;
      r.declared_crossing = declared ? declared.crossing : false;
      r.declared_direction = declared ? declared.direction : null;
      r.declared_mechanism = declared ? declared.mechanism || null : null;
      results.push(r);
      say(`  ${r.verdict.padEnd(15)} ${p.cell.padEnd(11)} support ${r.intact_support}/${r.arms.map((a) => a.support).join(',')}`);
    }
  } finally { await handle.close(); }
  return { results, pageErrors };
}

function rollUp(results, cells) {
  const demonstrated = results.filter((r) => r.verdict === VERDICT.OK);
  const paper = results.filter((r) => r.verdict === VERDICT.INERT);
  const vacuous = results.filter((r) => r.verdict === VERDICT.VACUOUS);
  const crossings = demonstrated.filter((r) => r.declared_crossing);
  const w2f = crossings.filter((r) => r.declared_direction === 'W2F').length;
  const f2w = crossings.filter((r) => r.declared_direction === 'F2W').length;
  const structural = demonstrated.filter((r) => r.declared_tier === 'structural');
  const score = demonstrated.reduce((s, r) => s + ({ mechanical: 1, structural: 3 }[r.declared_tier] || 0) * (r.declared_crossing ? 2 : 1), 0);
  const claimed = results.length;
  const floor = (cells.floors && cells.floors.W1) || { live: 10, structural: 1, crossings: 4, score: 20 };
  const unprobed = cells.cells.filter((c) => c.crossing && !results.some((r) => r.cell === c.id)).map((c) => c.id);
  return {
    demonstrated_live_cells: demonstrated.length,
    demonstrated_crossings: crossings.length,
    demonstrated_structural: structural.length,
    matrix_score: score,
    crossings_w2f: w2f, crossings_f2w: f2w,
    paper_cells: paper.map((r) => r.cell),
    vacuous_cells: vacuous.map((r) => r.cell),
    paper_fraction: claimed ? Math.round((paper.length / claimed) * 100) / 100 : null,
    unprobed_crossings: unprobed,
    w1_floor: floor,
    floor_met: {
      live: demonstrated.length >= floor.live,
      structural: structural.length >= floor.structural,
      crossings: crossings.length >= floor.crossings,
      score: score >= floor.score,
    },
    hard_fail_1_fewer_than_4_crossings: crossings.length < 4,
    hard_fail_2_zero_f2w: f2w === 0,
  };
}

async function main() {
  if (has('self-test')) process.exit((await selfTest()) ? 0 : 5);
  const cellsPath = path.resolve(REPO, arg('cells', 'corpus/95-experience/RI-CMP01.cells.json'));
  if (!fs.existsSync(cellsPath)) { say(`ABSENT: ${path.relative(REPO, cellsPath)} — run cells-from-md.mjs first.`); process.exit(3); }
  const cells = JSON.parse(fs.readFileSync(cellsPath, 'utf8'));
  const outPath = path.resolve(REPO, arg('out', 'reports/composition/w1/matrix.json'));
  const seed = Number(arg('seed', 1234));

  const gate = contentionGate();
  if (!gate.ok && !has('force')) {
    say(`CONTENTION GATE REFUSED (exit ${gate.code}). No browser launched, so no cell was probed.`);
    say('RI-CMP01 hard fail 5 applies: unmeasurable => 0, fail-closed. Nothing here is demonstrated.');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({
      schema: 'elder-souls/cmp01-matrix@1', at: new Date().toISOString(),
      ran: false, why: 'tools/contention.mjs --gate refused; no browser was launched',
      contention: gate.text, results: [], roll_up: rollUp([], cells),
    }, null, 2) + '\n');
    say(`wrote ${path.relative(REPO, outPath)}`);
    process.exit(4);
  }

  say(`matrix-probe — ${PROBES.length} cells, one browser, seed ${seed}.`);
  let out;
  try { out = await live({ cellsPath, outPath, seed }); }
  catch (e) {
    // A run that could not happen must leave a record saying so, or the next reader finds a
    // stale matrix.json from an earlier run and reads it as this commit's answer (RULES #12).
    const why = String((e && e.message) || e);
    say('matrix-probe: ' + why.split('\n')[0]);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({
      schema: 'elder-souls/cmp01-matrix@1', at: new Date().toISOString(), seed, ran: false,
      why: 'the browser could not be driven', error: why,
      note: 'RI-CMP01 hard fail 5: the probe harness could not run => unmeasurable => 0, fail-closed. ' +
        'Nothing in this file is demonstrated.',
      results: [], roll_up: rollUp([], cells),
    }, null, 2) + '\n');
    say(`wrote ${path.relative(REPO, outPath)} with ran:false`);
    process.exit(7);
  }
  const roll = rollUp(out.results, cells);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({
    schema: 'elder-souls/cmp01-matrix@1', at: new Date().toISOString(), seed, ran: true,
    page_errors: out.pageErrors, results: out.results, roll_up: roll,
  }, null, 2) + '\n');

  say('');
  say(`  demonstrated live cells      ${roll.demonstrated_live_cells}  (W1 floor ${roll.w1_floor.live})`);
  say(`  demonstrated seam crossings  ${roll.demonstrated_crossings}  (W1 floor ${roll.w1_floor.crossings})  ${roll.crossings_w2f} W->F / ${roll.crossings_f2w} F->W`);
  say(`  demonstrated structural      ${roll.demonstrated_structural}  (W1 floor ${roll.w1_floor.structural})`);
  say(`  matrix score                 ${roll.matrix_score}  (W1 floor ${roll.w1_floor.score})`);
  say(`  paper cells                  ${roll.paper_cells.length}: ${roll.paper_cells.join(', ')}`);
  say(`  vacuous cells                ${roll.vacuous_cells.length}: ${roll.vacuous_cells.join(', ')}`);
  say(`  crossings never probed       ${roll.unprobed_crossings.length}: ${roll.unprobed_crossings.join(', ')}`);
  say(`wrote ${path.relative(REPO, outPath)}`);
  const met = Object.values(roll.floor_met).every(Boolean);
  process.exit(met ? 0 : 2);
}

if (process.argv[1] && process.argv[1].endsWith('matrix-probe.mjs')) main();
export { PROBES };
