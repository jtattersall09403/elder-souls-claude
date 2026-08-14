#!/usr/bin/env node
// touch-route.mjs — HOW MANY TAPS DOES A PHONE PAY FOR A PAGE TURN, AND CAN IT FIND THE MAP?
//
// Owner: W1-MAP-DEFECTS r1 remediation, defect 5. Binding: `RI-JRN04` §G T1/M-P21
// (`input.modality.parity`, `input.touch.fallback`), `ARBITRATION` S35, `RI-JRN03` DS1/DS5.
//
// WHAT IT MEASURES, AND WHY IT IS NOT A SOURCE READ.
// It constructs the SHIPPED `TouchInput` from the SHIPPED `game/data/input/profiles.json`, on a
// real phone viewport, and drives real `down()`/`up()` pairs at the hit centres the shipped
// `layout()` reports. The drawer's open/closed state, the petal geometry and the auto-close rule
// are the build's own; nothing here paraphrases them. The ring the page turns walk is
// re-executed from the shipped `UISystem.WALK_ORDER` and `NEVER_ADJACENT` exactly as
// `corpus/90-verdicts/wave1/artifacts/w1-map-defects/walk-reachability.mjs` does, and for the
// same reason — change the shipped constant and this output changes.
//
// NO BROWSER. The r1 critic's live phone leg reached boot after ~40 minutes on a box at load 26
// over 4 cores and never finished, and the r1 builder's did the same before it. Every failing
// measurement in that verdict came from enumerating the shipped module in bare Node instead, and
// this tool is that method applied to the one question the composition argument left open: not
// "what is the route" but "how long is it, and does tapping forward reach everything".
// What it still does NOT prove is that the taps LAND on a real phone. That needs a photograph
// and it is not claimed here.
//
// THE DEFECT IT WAS WRITTEN FOR. `game/src/input/touch.js` shut the drawer after EVERY petal tap,
// so a phone paid TWO taps for each page turn: map 4 taps and journal 8, on top of a WALK_ORDER
// that had the journal off the forward walk entirely (fixed separately, in `ui/system.js`). The
// r1 critic ruled four unlabelled taps unacceptable as the only route. Labelling the
// petals is not available — `ui/touch-overlay.js` carries the standing ruling that a touch button
// with a word on it is `RI-JRN03` DS1's instruction budget blown and `M-K20`/`M-P24`'s hard fail
// — so the route had to get shorter.
//
// THE CONTROLS, AND THERE ARE TWO, BECAUSE ONE-SIDED GUARDS ARE HAZARDS §0b.
// The trivial control ("no drawer at all") is not run: it fails everything and would satisfy a
// guard that only knows how to notice zero. The two that discriminate:
//
//   NULL CONTROL — A DRAWER THAT NEVER CLOSES.   The plausible wrong answer: the version an
//     author in a hurry writes when told "the drawer shuts too eagerly". Measured, it ties the
//     shipped rule on EVERY route — map 3, journal 5 — so a guard that only asked "are the taps
//     few enough?" cannot tell the two apart at all and waves it straight through. What it does
//     instead is leave five petals standing over the WORLD after a fight verb, which is a
//     Souls-side defect traded for a menu-side convenience that was already paid for.
//   CONTROL — r1's ALWAYS-CLOSE.   What shipped and failed. Drawer hygiene perfect; the route
//     twice as long — map 4, journal 8 — because every page turn buys the drawer again.
//
// Each control must go red for its OWN reason and green on the other's. If either passes both,
// this tool exits 2: a control that cannot exhibit the failure is not a control.
//
// USAGE
//   node tools/map/touch-route.mjs [--json <path>]
// Exit 0 pass, 1 the shipped rule fails a check, 2 the controls are vacuous.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TouchInput } from '../../game/src/input/touch.js';
import { UISystem, NEVER_ADJACENT } from '../../game/src/ui/system.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const profiles = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/input/profiles.json'), 'utf8'));

// An 844x390 landscape phone with RI-JRN04 M-P17's real cutout, which is what the r1 critic's
// live leg booted into before it stalled.
const VIEWPORT = { w: 844, h: 390 };
const INSETS = { top: 0, right: 44, bottom: 21, left: 44 };

const PEERS = ['inventory', 'journal', 'sheet', 'spells', 'map', 'wait'];
const SCREENS = PEERS.filter((m) => m !== 'inventory');

// ---- the UI side, re-executed from the shipped constants (see walk-reachability.mjs) ----------
function navigable(mode) {
  const out = ['world'];
  for (const m of PEERS) {
    if (m === mode) continue;
    if (NEVER_ADJACENT.some((p) => p.includes(m) && p.includes(mode))) continue;
    out.push(m);
  }
  return out;
}
const ring = (mode) => UISystem.WALK_ORDER.filter((m) => m === mode || navigable(mode).includes(m));

/** `UISystem._walkPeer(dir)`: step along the ring; landing on `world` CLOSES the menu. */
function walkPeer(mode, dir) {
  const r = ring(mode);
  const at = r.indexOf(mode);
  if (at < 0 || r.length < 2) return mode;
  return r[((at + dir) % r.length + r.length) % r.length];
}

/** What the shipped `menu`/`swap_*` verbs do to `UISystem.mode`. */
function applyVerb(mode, action) {
  if (action === 'menu') return mode === 'world' ? 'inventory' : 'world';
  if (mode === 'world') return mode;                       // swaps are weapon verbs on the world
  if (action === 'swap_right') return walkPeer(mode, 1);
  if (action === 'swap_left') return walkPeer(mode, -1);
  return mode;
}

// ---- the touch side, driven through the SHIPPED class -----------------------------------------
const NOOP_PIPE = { edgeDown() {}, edgeUp() {}, setMove() {}, setLook() {} };

function makeTouch(arm) {
  const t = new TouchInput(NOOP_PIPE, null, profiles);
  t.setViewport(VIEWPORT.w, VIEWPORT.h, 1, INSETS);
  t.enabled = true;
  t.visible = true;
  // The two arms that are not HEAD replace exactly ONE method — the auto-close rule — and touch
  // nothing else, so any difference in the numbers below is that rule and cannot be anything else.
  if (arm === 'never-close') t._keepDrawerOpenAfter = () => true;
  if (arm === 'always-close') t._keepDrawerOpenAfter = () => false;
  return t;
}

/** The world/menu surface the arc is reduced to, mirroring `Engine._touchScreenSuppression()`. */
const READING = ['map', 'journal', 'book'];

/**
 * Take one tap. Returns the new {mode, drawerOpen} or null if that control is not on the glass.
 * `menuOpen` and `suppressToDrawer` are set from the mode BEFORE the tap, which is what
 * `Engine._touchOverlayModel()` does — it runs once per built frame, and the thumb lands after it.
 */
function tap(t, mode, action) {
  t.menuOpen = mode !== 'world';
  t.suppressToDrawer = READING.indexOf(mode) >= 0 ? mode : null;
  const ctl = t.layout().find((c) => c.action === action);
  if (!ctl) return null;
  t.down(1, ctl.x, ctl.y, null);
  t.up(1, null);
  return { mode: ctl.drawer ? mode : applyVerb(mode, action), drawerOpen: t.drawerOpen };
}

/** Every control on the glass in a given (mode, drawerOpen) — the taps actually available. */
function available(t, mode, drawerOpen) {
  t.menuOpen = mode !== 'world';
  t.suppressToDrawer = READING.indexOf(mode) >= 0 ? mode : null;
  t.drawerOpen = drawerOpen;
  return t.layout().map((c) => c.action);
}

/**
 * Fewest taps from a cold start (world, drawer shut) to every screen, over the REAL state machine:
 * every edge is a `down()`/`up()` pair through the shipped class, on a control the shipped
 * `layout()` says is on the glass.
 */
function fewestTaps(arm) {
  const t = makeTouch(arm);
  const start = 'world|closed';
  const dist = { [start]: 0 };
  const q = [start];
  const best = {};
  while (q.length) {
    const key = q.shift();
    const [mode, dr] = key.split('|');
    for (const action of available(t, mode, dr === 'open')) {
      const t2 = makeTouch(arm);
      t2.drawerOpen = dr === 'open';
      const r = tap(t2, mode, action);
      if (!r) continue;
      const k2 = `${r.mode}|${r.drawerOpen ? 'open' : 'closed'}`;
      if (dist[k2] !== undefined) continue;
      dist[k2] = dist[key] + 1;
      if (best[r.mode] === undefined) best[r.mode] = dist[k2];
      q.push(k2);
    }
  }
  return best;
}

/**
 * THE WALK A PLAYER FINDS BY ACCIDENT. Open the drawer, tap `menu`, then keep tapping the
 * right-hand swap — reopening the drawer whenever it has shut, because that is the only thing to
 * do next. Nothing here reverses direction: a reversal on an unlabelled pictogram is not
 * discoverable, which is the r1 critic's own finding and the reason this is reported separately
 * from the shortest path.
 */
function forwardTapWalk(arm, maxTaps = 40) {
  const t = makeTouch(arm);
  let mode = 'world', taps = 0;
  const seen = [];
  const cost = {};
  while (taps < maxTaps) {
    const want = mode === 'world' && !seen.length ? 'menu' : 'swap_right';
    if (!t.drawerOpen) { tap(t, mode, '__drawer'); taps++; }
    const r = tap(t, mode, want);
    if (!r) break;
    taps++;
    if (r.mode === 'world') break;                 // the walk closed the menu; forward is done
    mode = r.mode;
    if (!seen.includes(mode)) { seen.push(mode); cost[mode] = taps; }
    else break;                                     // it has come back round
  }
  return { visited: seen, cost, taps };
}

/**
 * DRAWER HYGIENE — the half the null control fails, and the half a tap-count guard cannot see.
 *
 * A petal used on the WORLD — `two_hand`, `spell_cycle`, a weapon swap — and the `menu` petal
 * used to LEAVE a menu must all shut the drawer behind them, exactly as r1 did. That is the
 * Souls side of the seam and it is not negotiable for a menu convenience: five extra controls
 * standing over the fight are five extra things between a thumb and `block`.
 *
 * THE COST IS COUNTED RATHER THAN ASSERTED, AND THE HONEST NUMBER IS REPORTED EVEN THOUGH IT IS
 * SMALLER THAN THE ARGUMENT WANTS. `_hitButton` walks the layout in reverse "so a drawer petal
 * drawn over the arc wins the hit", so the obvious cost would be arc controls whose centres a
 * petal steals — and measured on the shipped geometry that number is ZERO: the petals sit at
 * radius 92 from the drawer pivot and the arc's three rings are at 132/196/260, so nothing
 * overlaps at the centres. The real cost is what the extra controls do to the frame, not to the
 * hit test, so that is what is counted: controls drawn over the world by a stranded drawer.
 */
function drawerHygiene(arm) {
  const t = makeTouch(arm);
  const bad = [];
  for (const [mode, action] of [['world', 'two_hand'], ['world', 'spell_cycle'],
    ['world', 'swap_right'], ['inventory', 'menu']]) {
    t.drawerOpen = false;
    tap(t, mode, '__drawer');
    const r = tap(t, mode, action);
    if (!r) continue;
    if (r.mode === 'world' && r.drawerOpen) bad.push(`${action} from ${mode}`);
  }
  t.menuOpen = false; t.suppressToDrawer = null;
  t.drawerOpen = false; const shut = t.layout().length;
  t.drawerOpen = true; const open = t.layout();
  let stolen = 0;
  for (const c of open) {
    if (c.fromDrawer || c.drawer) continue;
    const hit = t._hitButton(c.x, c.y);
    if (hit && hit.action !== c.action) stolen++;
  }
  return {
    leaves_drawer_over_the_world: bad,
    extra_controls_over_the_world: open.length - shut,
    arc_centres_stolen_by_a_petal: stolen,
  };
}

// ---- run the three arms -----------------------------------------------------------------------
const ARMS = {
  'SHIPPED at HEAD': 'head',
  'NULL CONTROL — a drawer that NEVER closes': 'never-close',
  'CONTROL — r1: the drawer ALWAYS closes': 'always-close',
};

const out = { probe: 'touch-route', at: new Date().toISOString(), viewport: VIEWPORT, insets: INSETS, arms: {} };
try { out.commit = (await import('node:child_process')).execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* */ }

for (const [label, arm] of Object.entries(ARMS)) {
  const best = fewestTaps(arm);
  const fwd = forwardTapWalk(arm);
  const hy = drawerHygiene(arm);
  const missed = SCREENS.filter((m) => !fwd.visited.includes(m));
  out.arms[arm] = { label, fewest_taps: best, forward_tap_walk: fwd, hygiene: hy, missed_by_forward_tapping: missed };
  console.log(`\n== ${label}`);
  console.log(`   fewest taps        ${SCREENS.map((m) => `${m}=${best[m] === undefined ? 'UNREACHABLE' : best[m]}`).join('  ')}`);
  console.log(`   forward tap-walk   world -> ${fwd.visited.join(' -> ') || '(nothing)'}`);
  console.log(`   ...at tap          ${SCREENS.map((m) => `${m}=${fwd.cost[m] === undefined ? '-' : fwd.cost[m]}`).join('  ')}`);
  console.log(`   MISSED by tapping forward only: ${missed.length ? missed.join(', ') : 'nothing'}`);
  console.log(`   drawer left over the world by: ${hy.leaves_drawer_over_the_world.length ? hy.leaves_drawer_over_the_world.join(', ') : 'nothing'}`);
  console.log(`   a stranded drawer puts ${hy.extra_controls_over_the_world} extra controls over the world (${hy.arc_centres_stolen_by_a_petal} arc centres stolen)`);
}

const H = out.arms['head'], N = out.arms['never-close'], R = out.arms['always-close'];
const MAP_CEILING = 3;

// ---- vacuity: both controls must go red, and for DIFFERENT reasons ----------------------------
const vacuous = [];
if (!(N.fewest_taps.map <= MAP_CEILING && N.missed_by_forward_tapping.length === 0)) {
  vacuous.push('the never-close control was supposed to WIN on route length and does not');
}
if (N.hygiene.leaves_drawer_over_the_world.length === 0) {
  vacuous.push('the never-close control was supposed to strand the drawer over the world and does not');
}
if (R.hygiene.leaves_drawer_over_the_world.length !== 0) {
  vacuous.push('the always-close control was supposed to have perfect drawer hygiene and does not');
}
if (R.fewest_taps.map <= MAP_CEILING && R.missed_by_forward_tapping.length === 0) {
  vacuous.push('the always-close control was supposed to be the LONG route and is not');
}
console.log('');
if (vacuous.length) {
  console.log('VACUOUS  this tool cannot show the failure it claims to guard against:');
  for (const v of vacuous) console.log(`         - ${v}`);
  out.pass = false; out.vacuous = vacuous;
  writeOut();
  process.exit(2);
}
console.log('ok   both controls go red, and for DIFFERENT reasons:');
console.log(`     never-close   route ${N.fewest_taps.map} taps to the map — the SAME as HEAD, so a tap-count guard waves it through — and strands the drawer over the world after ${N.hygiene.leaves_drawer_over_the_world.length} of 4 world-side petals, putting ${N.hygiene.extra_controls_over_the_world} extra controls over the fight`);
console.log(`     always-close  drawer hygiene clean, and the map is ${R.fewest_taps.map} taps with the journal ${R.missed_by_forward_tapping.includes('journal') ? 'off the forward tap-walk' : `at ${R.fewest_taps.journal}`}`);

const checks = [
  [`the map is at most ${MAP_CEILING} taps from a cold start (r1: ${R.fewest_taps.map})`, H.fewest_taps.map <= MAP_CEILING],
  ['every screen is reachable by tapping FORWARD only — no reversal on an unlabelled pictogram',
    H.missed_by_forward_tapping.length === 0],
  [`the journal is reachable, and cheaper than r1's ${R.fewest_taps.journal}`,
    H.fewest_taps.journal !== undefined && H.fewest_taps.journal < R.fewest_taps.journal],
  ['no petal leaves the drawer standing over the world', H.hygiene.leaves_drawer_over_the_world.length === 0],
  ['…and the fight-side petals behave exactly as r1 did', H.hygiene.leaves_drawer_over_the_world.length === R.hygiene.leaves_drawer_over_the_world.length],
];
let pass = true;
console.log('');
for (const [what, ok] of checks) { if (!ok) pass = false; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); }
out.checks = checks.map(([what, ok]) => ({ what, ok }));
out.pass = pass;
writeOut();
process.exit(pass ? 0 : 1);

function writeOut() {
  const dest = path.resolve(String(process.argv.includes('--json')
    ? process.argv[process.argv.indexOf('--json') + 1]
    : path.join(ROOT, 'reports/w1-map-defects/touch-route.json')));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out, null, 1));
  console.log(`\nwrote ${path.relative(ROOT, dest)}`);
}
