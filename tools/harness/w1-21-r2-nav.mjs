// W1-21 round 2, in the shipping browser build: THE DOOR BETWEEN SCREENS, and the three other
// things the round-1 verdict said no instrument in this piece looks at.
//
// Binding: `NEXT-DISPATCH.md` §P.6; `RI-JRN03` §A (the closed action set); `RI-UIX03` P6 / L1;
// `RI-UIX04` Q7 and `AMENDMENT-W1-MAP-01` §3a/§3b; the W1-21 round-1 verdict §3, §4 and §6.
//
// I STEP THE SIMULATION, so this launches its own browser rather than going through
// `tools/capture/` (RULES 20), and it launches ONE and keeps it (RULES 21).
//
// The five things measured here, and why each is measured rather than read:
//
//   N1  Every destination `navigable(ctx)` advertises is reachable BY INPUT ALONE. W1-13 round 4
//       measured the old answer — all sixteen actions one at a time from the world and from every
//       screen they open, plus four axes, and input reached exactly two modes out of six
//       advertised. This walks the ring with the two actions the fix binds and records which
//       modes it lands in. `openMenu` is never called on this path.
//   N2  …and the ring still refuses the one pair it must (Q7): journal cannot step to map and map
//       cannot step to journal, in either direction, however many times you press.
//   N3  IN COMBAT the two actions are untouched, because `swap_left` is half of the offhand chord
//       and RI-UIX03 P6 requires the fight to stay playable with the screen up.
//   N4  A model change on a PAUSED screen repaints (verdict §4). Measured in pixels through the
//       real input pipeline, with the control run first, because the round-1 fix covered focus
//       moves and not model changes and the player saw `×3` on a potion they had just drunk.
//   N5  The AR-2 pair, on the live world: `getUIState().map.mutator_arities` is enumerated rather
//       than typed, and a save forged in BOTH discovery fields draws no square for a place the
//       body has not stood in — which is the round-1 headline, on the drawn screen.
//
// EVERY ONE OF THESE HAS A CONTROL, and the run refuses to conclude anything from a press it
// cannot show landed. That is not ceremony: the last probe to ask this question produced two
// confidently wrong answers before its guards caught it.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, RUNS_DIR, ensureDir, writeJson, gitInfo } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('w1-21-r2-nav.mjs [--out <dir>]'); process.exit(0); }

const RUN = path.join(RUNS_DIR, String(args.out || 'W1-21-R2'));
ensureDir(RUN);

const out = {
  schema: 'w1-21/r2-nav@1',
  git: gitInfo(),
  taken_at: new Date().toISOString(),
  load_declaration: null,          // filled below — RULES 26
  checks: [],
};
const push = (id, what, ok, detail) => {
  out.checks.push({ id, what, ok: !!ok, detail });
  log(`${ok ? 'ok  ' : 'FAIL'} ${id}  ${what}\n         ${detail}`);
};

function decode(u) { return PNG.sync.read(Buffer.from(String(u).split(',')[1], 'base64')); }
function differing(a, b) {
  if (a.width !== b.width || a.height !== b.height) return -1;
  let n = 0;
  for (let i = 0; i < a.width * a.height; i++) {
    const o = i * 4;
    if (Math.abs(a.data[o] - b.data[o]) + Math.abs(a.data[o + 1] - b.data[o + 1])
      + Math.abs(a.data[o + 2] - b.data[o + 2]) > 6) n++;
  }
  return n;
}

// ---- the in-page arm --------------------------------------------------------------------------
//
// One `evaluate` per section rather than one for everything, so a throw in one section does not
// take the other four with it and so the screenshots can be pulled out between them.

const SETUP = () => {
  const H = window.__HARNESS;
  H.loadState('default'); H.setRenderRate(0); H.stepFrames(2);
  const wells = (H.listHearths().hearths || []);
  const well = wells.find((x) => x.kind === 'settlement') || wells[0];
  H.teleport(well.pos[0], well.pos[2]);
  H.stepFrames(30);
  return { hearth: well && well.id, at_hearth: !!(H.getUIState() || {}).at_hearth };
};

/**
 * The walk. Press `menu` to open the one screen the world gives you, then press `swap_right`
 * repeatedly and record where you land. Nothing here calls `openMenu`.
 *
 * `press()` is round 3's recipe — `{f: 0}` and ONE frame per edge — because the paused branch of
 * `engine._step()` does not advance `sim.frame`, so an event scheduled at `f >= 1` inside a menu
 * never arrives. Two verdicts have already been voided by getting this wrong.
 */
const WALK = ({ dir, steps }) => {
  const H = window.__HARNESS;
  const ui = () => { const s = H.getUIState(); return s ? s.mode : null; };
  const fp = () => { try { return JSON.stringify(H.getUIState()); } catch (e) { return ''; } };
  const press = (a) => {
    H.queueInputs([{ f: 0, press: [a] }]); H.stepFrames(1);
    H.queueInputs([{ f: 0, release: [a] }]); H.stepFrames(1);
    H.stepFrames(4);
  };
  H.clearInputs();
  if (ui() !== 'world') H.closeMenu();
  H.stepFrames(4);

  const r = { path: [], moved: [], advertised: null, walkable: null, actions: null };
  press('menu');                                    // the one door the world has
  r.opened_by_menu = ui();
  const s0 = H.getUIState();
  r.advertised = s0.navigable || null;
  r.walkable = s0.nav ? s0.nav.walkable : null;
  r.actions = s0.nav ? s0.nav.walk_actions : null;
  r.walk_live = s0.nav ? s0.nav.walk_live : null;
  r.path.push(ui());
  for (let i = 0; i < steps; i++) {
    const before = fp();
    press(dir);
    r.moved.push(fp() !== before);
    r.path.push(ui());
    if (ui() === 'world') { press('menu'); r.path.push(ui()); }   // step back in and keep walking
  }
  r.modes = [...new Set(r.path.filter(Boolean))].sort();
  return r;
};

/**
 * W1-13 round 4's OWN METHOD, generalised in the one dimension that decides the answer.
 *
 * `tools/harness/w1-13-r4-input-only.mjs` presses all sixteen actions of RI-JRN03 §A one at a
 * time, plus all four axes, from the world and from every screen a press from the world opens.
 * That is where "input reaches exactly two modes" came from. Re-run against this fix it now says
 * `["inventory","journal","world"]` and `levelup by input = false` — and that is a true report of
 * what it measures, because its pass 2 only visits screens ONE press from the world and never
 * recurses. The ring is seven screens long; `levelup` is five steps from the inventory.
 *
 * So this is the same recipe taken to a FIXED POINT: press all sixteen and all four axes from
 * every screen discovered so far, add whatever they open, and repeat until nothing new appears.
 * `openMenu` is never called. Reported beside the other probe's number rather than instead of it,
 * because the difference between the two IS the finding.
 */
const CLOSURE = () => {
  const H = window.__HARNESS;
  const ui = () => { const s = H.getUIState(); return s ? s.mode : null; };
  const press = (a) => {
    H.queueInputs([{ f: 0, press: [a] }]); H.stepFrames(1);
    H.queueInputs([{ f: 0, release: [a] }]); H.stepFrames(1);
    H.stepFrames(4);
  };
  const axis = (mv) => {
    H.queueInputs([{ f: 0, move: mv }]); H.stepFrames(1);
    H.queueInputs([{ f: 0, move: [0, 0] }]); H.stepFrames(1);
    H.stepFrames(4);
  };
  const actions = (H.getActionSet().actions || []).slice();
  const AXES = [['left', [-1, 0]], ['right', [1, 0]], ['up', [0, 1]], ['down', [0, -1]]];
  // A route to each known screen, as a list of presses from the world. `world` costs nothing.
  const routes = new Map([['world', []]]);
  const edges = [];
  const goto = (mode) => {
    H.clearInputs(); H.closeMenu(); H.stepFrames(4);
    for (const a of routes.get(mode) || []) press(a);
    return ui() === mode;
  };
  let changed = true, rounds = 0;
  while (changed && rounds++ < 8) {
    changed = false;
    for (const from of [...routes.keys()]) {
      for (const a of actions) {
        if (!goto(from)) continue;
        press(a);
        const to = ui();
        if (to && to !== from) edges.push({ from, via: a, to });
        if (to && !routes.has(to)) { routes.set(to, [...(routes.get(from) || []), a]); changed = true; }
      }
      for (const [name, mv] of AXES) {
        if (!goto(from)) continue;
        axis(mv);
        const to = ui();
        if (to && to !== from) edges.push({ from, via: `axis_${name}`, to });
        if (to && !routes.has(to)) { routes.set(to, [...(routes.get(from) || []), `axis:${name}`]); changed = true; }
      }
    }
  }
  H.clearInputs(); H.closeMenu(); H.stepFrames(2);
  return {
    actions_pressed: actions,
    axes_pressed: AXES.map((x) => x[0]),
    rounds,
    modes: [...routes.keys()].sort(),
    routes: Object.fromEntries([...routes.entries()].map(([k, v]) => [k, v.join(' -> ') || '(the world)'])),
    edges,
  };
};

/** Q7: from the journal, no number of steps in either direction may land on the map. */
const Q7 = () => {
  const H = window.__HARNESS;
  const ui = () => { const s = H.getUIState(); return s ? s.mode : null; };
  const press = (a) => {
    H.queueInputs([{ f: 0, press: [a] }]); H.stepFrames(1);
    H.queueInputs([{ f: 0, release: [a] }]); H.stepFrames(1);
    H.stepFrames(4);
  };
  const from = (start) => {
    const seen = [];
    for (const d of ['swap_right', 'swap_left']) {
      H.clearInputs(); H.closeMenu(); H.stepFrames(2);
      H.openMenu(start); H.stepFrames(2);          // the START is set by verb; the STEP is input
      const first = press(d) || ui();
      seen.push({ dir: d, landed: ui() });
      void first;
    }
    return seen;
  };
  const r = { from_journal: from('journal'), from_map: from('map') };
  // …and the model's own answer, which is what `navigable()` publishes.
  H.closeMenu(); H.openMenu('journal'); H.stepFrames(2);
  r.journal_ring = (H.getUIState().nav || {}).walkable;
  H.closeMenu(); H.openMenu('map'); H.stepFrames(2);
  r.map_ring = (H.getUIState().nav || {}).walkable;
  H.closeMenu(); H.stepFrames(2);
  return r;
};

/** RI-UIX03 P6: in a fight, the two actions must NOT navigate. */
const INCOMBAT = () => {
  const H = window.__HARNESS;
  const ui = () => { const s = H.getUIState(); return s ? s.mode : null; };
  const press = (a) => {
    H.queueInputs([{ f: 0, press: [a] }]); H.stepFrames(1);
    H.queueInputs([{ f: 0, release: [a] }]); H.stepFrames(1);
    H.stepFrames(4);
  };
  const r = {};
  H.clearInputs(); H.closeMenu(); H.stepFrames(2);
  let target = null;
  // `arena_duel` is the shipped fixture that spawns `inf_trash` at 4.2 m — a real enemy, in the
  // real combat system, rather than a flag set by a harness verb.
  try { H.loadState('arena_duel'); H.stepFrames(6); }
  catch (err) { r.state_error = String(err && err.message || err); }
  try {
    const ents = H.listEntities() || [];
    const t = ents.find((x) => x.eid !== undefined && x.archetype !== 'player' && !x.isPlayer);
    if (t) { H.aggro(t.eid); H.lockOn(t.eid); target = t.eid; }
    r.entities = (ents || []).map((x) => x.archetype || x.id || x.eid);
  } catch (err) { r.aggro_error = String(err && err.message || err); }
  H.stepFrames(10);
  r.target = target;
  const cs = H.getCombatState() || {};
  r.combat_keys = Object.keys(cs);
  r.in_combat_field = cs.inCombat !== undefined ? cs.inCombat
    : (cs.in_combat !== undefined ? cs.in_combat : null);
  H.openMenu('inventory'); H.stepFrames(2);
  r.mode_before = ui();
  r.walk_live = (H.getUIState().nav || {}).walk_live;
  press('swap_right');
  r.mode_after = ui();
  r.navigated = r.mode_before !== r.mode_after;
  // THE ENGINE'S OWN ANSWER TO "IS A FIGHT LIVE", read off the screen rather than off a field
  // name I had to guess. `UISystem.pausesSimulation(inCombat)` is `mode !== world && !inCombat`,
  // so with a menu open `menu.paused === false` can ONLY mean the engine thinks a fight is live.
  // The first run of this probe read `getCombatState().inCombat`, got `undefined`, and reported
  // "could not get into a fight" while `menu.paused` was already saying otherwise.
  r.menu_paused = (H.getUIState().menu || {}).paused;
  r.in_combat = r.in_combat_field === true || r.menu_paused === false;
  H.closeMenu(); H.stepFrames(2);
  return r;
};

/** Verdict §4: does a model change on a PAUSED screen reach the screen? */
const PAUSED_SETUP = () => {
  const H = window.__HARNESS;
  H.clearInputs(); H.closeMenu(); H.stepFrames(4);
  // `ui-journal` is the fixture the round-1 verdict's §4 measurement used: it carries
  // black-water-draught ×3, which is the exact row that said `×3` after the player drank it.
  // `default` carries one knife and nothing consumable, so a probe run against `default` moves no
  // pixels for a reason that has nothing to do with the defect.
  H.loadState('ui-journal'); H.stepFrames(4);
  H.openMenu('inventory'); H.stepFrames(2);
  const s = H.getUIState();
  const inv = H.getInventory() || [];
  const potion = inv.filter ? inv.filter((i) => (i.count || 0) > 1)[0] : null;
  return {
    mode: s.mode, paused: (s.menu || {}).paused, potion: potion || null,
    inventory: inv.map((i) => `${i.id}x${i.count}`),
    rows: (s.elements || []).filter((e) => String(e.kind).includes('row')).length,
    row_kinds: [...new Set((s.elements || []).map((e) => e.kind))],
  };
};

// ---- run --------------------------------------------------------------------------------------
let h;
const load = () => {
  try { return fs.readFileSync('/proc/loadavg', 'utf8').trim().split(' ').slice(0, 3).join(' '); }
  catch { return 'unknown'; }
};
out.load_declaration = { loadavg_at_start: load(), browsers: 'one, kept for the whole run' };

try {
  h = await launchGame({ width: 960, height: 540, timeout: 240000 });
  out.setup = await h.page.evaluate(SETUP);

  // ---- N1: the walk ---------------------------------------------------------------------------
  const right = await h.page.evaluate(WALK, { dir: 'swap_right', steps: 8 });
  const left = await h.page.evaluate(WALK, { dir: 'swap_left', steps: 8 });
  out.walk = { right, left };
  const reached = [...new Set([...right.modes, ...left.modes])].sort();
  const SIX = ['inventory', 'journal', 'sheet', 'spells', 'map', 'levelup'];
  const missing = SIX.filter((m) => !reached.includes(m));

  // THE INERTNESS GUARD, first, because every number below it is void without it. `mode` cannot
  // tell a swallowed press from a no-op, so the whole `getUIState()` is fingerprinted either side.
  const anyMoved = right.moved.some(Boolean) || left.moved.some(Boolean);
  push('N0', 'CONTROL: the presses this probe makes inside an open screen actually land',
    anyMoved && right.opened_by_menu === 'inventory',
    `menu opened '${right.opened_by_menu}'; ${right.moved.filter(Boolean).length}/${right.moved.length} right-steps and `
    + `${left.moved.filter(Boolean).length}/${left.moved.length} left-steps moved getUIState()`);

  push('N1', 'every destination navigable(ctx) advertises is reachable BY INPUT ALONE',
    anyMoved && missing.length === 0,
    `advertised ${JSON.stringify(right.advertised)}; walkable ${JSON.stringify(right.walkable)}; `
    + `input reached [${reached.join(',')}]; missing [${missing.join(',') || '-'}]. `
    + `Walk actions ${JSON.stringify(right.actions)}. Path right: ${right.path.join(' -> ')}`);

  // ---- N1b: the same measurement that found the defect, taken to a fixed point -----------------
  const closure = await h.page.evaluate(CLOSURE);
  out.closure = closure;
  const cMissing = SIX.filter((m) => !closure.modes.includes(m));
  push('N1b', 'W1-13 r4\'s own recipe (16 actions + 4 axes, one at a time) taken to a FIXED POINT',
    closure.actions_pressed.length >= 14 && cMissing.length === 0,
    `${closure.actions_pressed.length} actions and ${closure.axes_pressed.length} axes from every screen `
    + `discovered, ${closure.rounds} rounds: input reaches [${closure.modes.join(',')}]; missing [${cMissing.join(',') || '-'}]. `
    + `Route to levelup: ${closure.routes.levelup || '(none)'}. `
    + `W1-13 r4's own probe still reports ["inventory","journal","world"] because its pass 2 visits only `
    + `screens ONE press from the world and does not recurse — the ring is seven long.`);

  // ---- N2: Q7 ----------------------------------------------------------------------------------
  const q7 = await h.page.evaluate(Q7);
  out.q7 = q7;
  const jToMap = q7.from_journal.some((x) => x.landed === 'map');
  const mToJ = q7.from_map.some((x) => x.landed === 'journal');
  push('N2', 'RI-UIX04 Q7 survives the new door: journal and map are not adjacent in either direction',
    !jToMap && !mToJ
      && Array.isArray(q7.journal_ring) && !q7.journal_ring.includes('map')
      && Array.isArray(q7.map_ring) && !q7.map_ring.includes('journal'),
    `from journal ${JSON.stringify(q7.from_journal)}; from map ${JSON.stringify(q7.from_map)}; `
    + `journal ring ${JSON.stringify(q7.journal_ring)}; map ring ${JSON.stringify(q7.map_ring)}`);

  // ---- N4: the paused screen repaints on a model change -----------------------------------------
  const ps = await h.page.evaluate(PAUSED_SETUP);
  out.paused = ps;
  const shotA = decode(await h.h('screenshot'));
  // CONTROL FIRST: a focus move on the paused screen must move pixels, or the pixel instrument
  // itself is dead and the interesting measurement below means nothing.
  await h.page.evaluate(() => {
    const H = window.__HARNESS;
    H.queueInputs([{ f: 0, move: [0, -1] }]); H.stepFrames(1);
    H.queueInputs([{ f: 0, move: [0, 0] }]); H.stepFrames(1); H.stepFrames(4);
  });
  const shotB = decode(await h.h('screenshot'));
  const controlPx = differing(shotA, shotB);
  push('N4a', 'CONTROL: a focus move on the paused screen moves pixels', controlPx > 0,
    `${controlPx} pixels changed`);

  const before = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const inv = H.getInventory() || [];
    const p = inv.find((i) => (i.count || 0) > 1);
    return { potion: p ? p.id : null, count: p ? p.count : null, mode: H.getUIState().mode };
  });
  // PHASE A — find the row whose confirm changes the model, by pressing until it does. This
  // SPENDS one of the three draughts and leaves the focus on that row. Nothing is measured here;
  // it exists so that phase B is a single press with a screenshot on either side of it.
  const found = await h.page.evaluate(({ id }) => {
    const H = window.__HARNESS;
    const n = () => ((H.getInventory() || []).find((i) => i.id === id) || {}).count;
    const start = n();
    let guard = 0;
    while (guard++ < 40 && n() === start) {
      H.queueInputs([{ f: 0, press: ['interact'] }]); H.stepFrames(1);
      H.queueInputs([{ f: 0, release: ['interact'] }]); H.stepFrames(1);
      H.stepFrames(4);
      if (n() !== start) break;
      H.queueInputs([{ f: 0, move: [0, -1] }]); H.stepFrames(1);
      H.queueInputs([{ f: 0, move: [0, 0] }]); H.stepFrames(1);
      H.stepFrames(2);
    }
    return { id, start, now: n(), presses: guard, focus: H.getUIState().focus };
  }, { id: before.potion });
  out.phase_a = found;

  // PHASE B — ONE press, with the frame captured on either side of it, and the world stopped
  // throughout. This is the measurement the round-1 verdict took and got 0 px for.
  const shotC = decode(await h.h('screenshot'));
  const used = await h.page.evaluate(({ id }) => {
    const H = window.__HARNESS;
    // THROUGH THE PIPELINE. `uiFocus()` would force a rebuild and could not see this defect,
    // which is exactly why it survived a round.
    const invBefore = (H.getInventory() || []).find((i) => i.id === id);
    const paused = (H.getUIState().menu || {}).paused;
    const frameBefore = H.getFrame();
    H.queueInputs([{ f: 0, press: ['interact'] }]); H.stepFrames(1);
    H.queueInputs([{ f: 0, release: ['interact'] }]); H.stepFrames(1);
    H.stepFrames(6);
    const invAfter = (H.getInventory() || []).find((i) => i.id === id);
    return {
      id,
      before: invBefore ? invBefore.count : null,
      after: invAfter ? invAfter.count : null,
      mode: H.getUIState().mode,
      paused,
      // The world really was stopped across the press, or this is not the §4 measurement at all.
      frames_advanced: H.getFrame() - frameBefore,
      act_epoch: (window.__ENGINE && window.__ENGINE.ui && window.__ENGINE.ui.actEpoch) || null,
    };
  }, { id: before.potion });
  const shotD = decode(await h.h('screenshot'));
  const usePx = differing(shotC, shotD);
  out.use = { ...used, pixels_changed: usePx };
  push('N4b', 'a model change on a paused screen reaches the screen (verdict §4)',
    used.before !== null && used.after !== null && used.after < used.before && usePx > 0,
    `${used.id} ${used.before} -> ${used.after} in the simulation, and ${usePx} pixels changed on screen `
    + `(round 1 measured 0 px for exactly this). Menu paused=${used.paused}, world advanced `
    + `${used.frames_advanced} frames across the press, actEpoch=${used.act_epoch}`);
  fs.writeFileSync(path.join(RUN, 'paused-before-use.png'), PNG.sync.write(shotC));
  fs.writeFileSync(path.join(RUN, 'paused-after-use.png'), PNG.sync.write(shotD));

  // ---- N5: the AR-2 pair, on the live world ------------------------------------------------------
  const mapState = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    H.clearInputs(); H.closeMenu(); H.stepFrames(2);
    H.openMenu('map'); H.stepFrames(2);
    const s = H.getUIState();
    return { map: s.map, mode: s.mode };
  });
  out.map_state = mapState;
  const m = mapState.map || {};
  push('N5a', 'getUIState().map.mutator_arities is ENUMERATED from the prototype, not a literal',
    m.mutators_enumerated === true && !!m.mutator_arities && 'restore' in m.mutator_arities,
    `mutator_arities=${JSON.stringify(m.mutator_arities)} enumerated=${m.mutators_enumerated}`);
  push('N5b', 'and no mutator has a parameter in which a place can be named',
    Array.isArray(m.place_naming_parameters) && m.place_naming_parameters.length === 0
      && Array.isArray(m.restore_reads) && m.restore_reads.length > 0,
    `restore_reads=${JSON.stringify(m.restore_reads)} place_naming_parameters=${JSON.stringify(m.place_naming_parameters)}`);

  // The forgery, on the LIVE world and on the DRAWN screen — the round-1 headline.
  const walkOut = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const eng = window.__ENGINE;
    H.closeMenu(); H.stepFrames(2);
    // OUT OF DOORS, and this is not housekeeping. `ui-journal` — the fixture the §4 measurement
    // above needs, because it is the one carrying the draughts — sets `env.interior:
    // 'thorn-hall'`, and `Discovery.observe()` suspends indoors by design ("an interior is a
    // separate space whose exterior coordinates are meaningless"). Running the forgery from there
    // gives a body that has stood nowhere, and a forgery refused against a baseline of zero is a
    // vacuous pass — the exact shape RULES 4 exists for. The first run of this probe produced
    // one and it is recorded rather than deleted.
    H.loadState('default'); H.stepFrames(4);
    try { H.exitInterior(); } catch (e) { /* already outside */ }
    H.stepFrames(4);
    // Walk somewhere real first, so "stood in" is a number and not zero.
    //
    // EACH MOVE IS GUARDED, and the reason is recorded rather than swallowed: at the time this was
    // written `game/src/render/interior.js`'s `bla_prison_block` kit throws
    // `Cannot assign to read only property 'position'` out of `Province._buildTile`, so a
    // `teleport` whose build ring reaches Blackrose takes the whole run with it. That is a live
    // defect in another piece's working tree, not this one's, and this probe's job is to report
    // what it could not reach rather than to die of it.
    // THE BODY STANDS IN REAL PLACES, and this matters more than it looks. The first version of
    // this walked to hearths, which are wells and not built pads, and discovered ZERO places — so
    // "the forgery drew no phantom square" was true against a baseline of nothing, which is a
    // vacuous pass and is the exact shape RULES 4 exists for. It is recorded rather than deleted.
    // `field.sites` carries each place's own centre, which is the middle of the pad `r_flat`
    // measures, so standing there is standing in it.
    const wells = (eng.field.sites || []).slice(0, 7)
      .map((st) => ({ id: st.id, pos: [st.x, 0, st.z] }));
    const reached = [], refused = [], neighbourThrows = [];
    // `game/src/combat/enemy.js` throws `this.ai.step is not a function` out of
    // `EnemyController._idleBehaviour` on any fixed step with a streamed enemy alive — the
    // enemy-AI rebuild is mid-flight in this working tree. So the province is stepped ONE FRAME
    // AT A TIME, and a frame that throws is recorded and the hostiles cleared rather than the run
    // ending. What this probe measures — where a body has stood — does not depend on the enemies
    // being there, and it should not depend on their AI compiling either.
    const clearHostiles = () => {
      try {
        for (const e of (H.listEntities() || [])) {
          if (e && e.eid !== undefined && e.archetype !== 'player' && !e.isPlayer) {
            try { H.despawn(e.eid); } catch (x) { /* gone already */ }
          }
        }
      } catch (x) { /* no entity list */ }
    };
    const stepSafe = (n) => {
      for (let i = 0; i < n; i++) {
        try { H.stepFrames(1); } catch (e) {
          const msg = String(e && e.message || e).slice(0, 90);
          if (neighbourThrows.indexOf(msg) < 0) neighbourThrows.push(msg);
          clearHostiles();
        }
      }
    };
    for (const w of wells.slice(0, 8)) {
      try { H.teleport(w.pos[0], w.pos[2]); clearHostiles(); stepSafe(20); reached.push(w.id); }
      catch (e) { refused.push({ id: w.id, error: String(e && e.message || e).slice(0, 120) }); }
    }
    clearHostiles();
    stepSafe(20);
    const honest = {
      places: H.mapState().places.slice(),
      revealed: H.mapState().revealed_cells,
      interior: (eng.sim.env || {}).interior || null,
      suspended: H.mapState().suspended,
    };
    window.__W1_21_HONEST = honest;
    window.__W1_21_BLOB = H.saveState();
    H.openMenu('map'); stepSafe(2);
    return { honest, reached, refused, neighbour_throws: neighbourThrows, phase: 'honest' };
  });
  out.honest_walk = walkOut;
  const shotHonest = decode(await h.h('screenshot'));
  fs.writeFileSync(path.join(RUN, 'map-honest.png'), PNG.sync.write(shotHonest));

  const forge = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const eng = window.__ENGINE;
    const honest = window.__W1_21_HONEST;
    const blob = window.__W1_21_BLOB;
    const stepSafe = (n) => { for (let i = 0; i < n; i++) { try { H.stepFrames(1); } catch (e) { /* neighbour */ } } };
    H.closeMenu(); stepSafe(2);
    const d = eng.sim.discovery;
    const total = d.cols * d.rows;
    const bytes = new Uint8Array((total + 7) >> 3); bytes.fill(0xFF);
    let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    const forged = JSON.parse(JSON.stringify(blob));
    forged.world.discovery.cells = btoa(s);
    forged.world.discovery.places = (eng.data.pois.pois || []).map((p) => p.id);
    forged.world.discovery.revealed = total;
    H.loadState(forged);
    stepSafe(2);
    H.openMenu('map'); stepSafe(2);
    const after = H.mapState();
    const ui = H.getUIState();
    return {
      honest,
      after: { places: after.places.slice(), revealed: after.revealed_cells },
      audit: eng.sim.discovery.lastRestore,
      dropped_on_load: after.dropped_on_load,
      map: ui.map,
    };
  });
  out.forge = forge;
  const shotForged = decode(await h.h('screenshot'));
  fs.writeFileSync(path.join(RUN, 'map-forged-save.png'), PNG.sync.write(shotForged));
  const phantom = forge.after.places.filter((p) => !forge.honest.places.includes(p));
  push('N5c', 'F1: a save forged in BOTH discovery fields is refused by the LIVE-WORLD load audit',
    (forge.dropped_on_load || []).length > 0 && forge.after.places.length <= forge.honest.places.length,
    `dropped=${(forge.dropped_on_load || []).length} names; places ${forge.honest.places.length} -> ${forge.after.places.length}; `
    + `revealed ${forge.honest.revealed} -> ${forge.after.revealed}; audit ${JSON.stringify(forge.audit)}`);
  push('N5d', 'F2: and no square for an unvisited place reaches the DRAWN map after that load',
    phantom.length === 0 && (forge.map || {}).places_drawn <= forge.honest.places.length,
    `${(forge.map || {}).places_drawn} squares drawn, ${phantom.length} phantom [${phantom.slice(0, 8).join(',')}]`);
  push('N5e', "F3: and the screen's own report says so, against a number the model did not supply",
    (forge.map || {}).places_drawn === forge.after.places.length
      && (forge.map || {}).places_drawn <= forge.honest.places.length,
    `places_drawn=${(forge.map || {}).places_drawn} places_discovered=${(forge.map || {}).places_discovered} `
    + `stood_in=${forge.honest.places.length}`);

  // ---- N3: in combat — RUN LAST, ON PURPOSE ---------------------------------------------
  //
  // This section spawns a real enemy, and at the time of writing `game/src/combat/enemy.js`
  // throws `this.ai.step is not a function` out of `EnemyController._idleBehaviour` on the next
  // fixed step — a live defect in another piece's working tree, in the middle of the enemy-AI
  // rebuild. Running this arm first therefore took the map measurements down with it. It is
  // last so that a neighbour's in-flight file can cost this run one check instead of five, and
  // the ordering is recorded rather than tidied away.
  // ---- N3: in combat ---------------------------------------------------------------------------
  const ic = await h.page.evaluate(INCOMBAT);
  out.in_combat = ic;
  push('N3', 'RI-UIX03 P6: in a fight the two actions do NOT navigate — the offhand chord is intact',
    ic.in_combat ? (!ic.navigated && ic.walk_live === false && ic.menu_paused === false)
      : false,
    ic.in_combat
      ? `in_combat=${ic.in_combat} mode ${ic.mode_before} -> ${ic.mode_after}, walk_live=${ic.walk_live}, menu paused=${ic.menu_paused}`
      : `COULD NOT GET INTO A FIGHT (in_combat=${ic.in_combat}) — reported as unmeasured rather than passed. ${JSON.stringify(ic)}`);

} catch (e) {
  out.fatal = String((e && e.stack) || e);
  push('XX', 'the run completed', false, out.fatal);
} finally {
  if (h) await h.close();
}

out.load_declaration.loadavg_at_end = load();
const failed = out.checks.filter((c) => !c.ok);
out.ok = failed.length === 0;
out.native = `${out.checks.length - failed.length}/${out.checks.length}`;
writeJson(path.join(RUN, 'nav.json'), out);
log(`\n${out.native} · ${path.join(RUN, 'nav.json')}`);
log(`load: ${out.load_declaration.loadavg_at_start} -> ${out.load_declaration.loadavg_at_end}`);
process.exit(out.ok ? 0 : 1);
