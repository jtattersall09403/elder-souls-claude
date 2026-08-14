#!/usr/bin/env node
// walk-reachability.mjs — WHICH SCREENS CAN A PLAYER ACTUALLY PAGE TO?
//
// Written by the fresh critic of W1-MAP-DEFECTS. It answers the zero-sum question the dispatch
// asked and the builder did not: reordering a walk moves every screen, so what did moving `map`
// to second push out of reach?
//
// WHY THIS IS NOT A SOURCE READ. It imports `NEVER_ADJACENT` and `UISystem.WALK_ORDER` from the
// SHIPPED module (`game/src/ui/system.js`) and re-executes the two functions the fixed step runs
// — `navigable()` and `_walkPeer()` — over that data. Change the shipped constant and this
// output changes. It is an enumeration of the real page order, not a paraphrase of it, and it
// needs no browser, which is why it survives a box at load 26 over 4 cores.
//
// THE FINDING. `_walkRing()` is not a symmetric ring. `navigable()` drops the NEVER_ADJACENT
// partner OF THE MODE YOU ARE STANDING ON, so `map`'s ring has no `journal` in it. Put `map`
// immediately before `journal` in WALK_ORDER and the forward walk lands on `map`, and from
// `map` the next screen is whatever follows `journal` — the journal is stepped straight over
// and can never be reached by pressing the page-turn key in one direction.
//
// `world` sits at index 0 of every menu ring and `_walkPeer` CLOSES the UI on it, so the ring
// is really a line with a trapdoor at the left end: from `inventory`, swap_left closes. Forward
// is therefore the only direction a player discovers by accident, and this tool reports the
// forward walk first for that reason.
//
// USAGE
//   node corpus/90-verdicts/wave1/artifacts/w1-map-defects/walk-reachability.mjs
// Exit 1 if any menu screen is missing from the forward walk from `inventory`.
import { UISystem, NEVER_ADJACENT } from '../../../../../game/src/ui/system.js';

const PEERS = ['inventory', 'journal', 'sheet', 'spells', 'map', 'wait'];

/** `UISystem.navigable(ctx)`, re-executed here. Out of combat; `book` needs a selected item. */
function navigable(mode, { hearth = false } = {}) {
  const out = ['world'];
  for (const m of PEERS) {
    if (m === mode) continue;
    if (NEVER_ADJACENT.some((p) => p.includes(m) && p.includes(mode))) continue;
    out.push(m);
  }
  if (hearth && mode !== 'levelup') out.push('levelup');
  return out;
}

/** `UISystem._walkRing(ctx)`, re-executed here. */
const ring = (order, mode, opt) =>
  order.filter((m) => m === mode || navigable(mode, opt).includes(m));

/** Follow ONE direction from `inventory` until the walk closes the UI or repeats. */
function walk(order, dir, opt) {
  const visited = [];
  const seen = new Set(['inventory']);
  let cur = 'inventory';
  for (let n = 0; n < 16; n++) {
    const r = ring(order, cur, opt);
    const i = r.indexOf(cur);
    const to = r[((i + dir) % r.length + r.length) % r.length];
    if (to === 'world') { visited.push('(closes)'); break; }
    if (seen.has(to)) { visited.push(`(back to ${to})`); break; }
    seen.add(to); visited.push(to); cur = to;
  }
  return visited;
}

/** Fewest page-turns from `inventory` to each screen when reversals ARE allowed. */
function fewest(order, opt) {
  const dist = { inventory: 0 };
  const q = ['inventory'];
  while (q.length) {
    const c = q.shift();
    const r = ring(order, c, opt);
    const i = r.indexOf(c);
    for (const d of [1, -1]) {
      const to = r[((i + d) % r.length + r.length) % r.length];
      if (to === 'world') continue;              // walking onto `world` closes the UI
      if (dist[to] === undefined) { dist[to] = dist[c] + 1; q.push(to); }
    }
  }
  return dist;
}

// The touch route multiplies every page-turn. `game/data/input/profiles.json` puts `menu`,
// `swap_left` and `swap_right` behind ONE drawer control, and `game/src/input/touch.js:255`
// (`if (hit.fromDrawer) this.drawerOpen = false;`) shuts the drawer after EVERY petal tap. So a
// phone pays two taps per page-turn, plus two to open the inventory in the first place.
const taps = (presses) => 2 + presses * 2;

/** Are any two NEVER_ADJACENT partners actually NEIGHBOURS in this order? That is the mechanism. */
function adjacentPairs(order) {
  const bad = [];
  for (const pair of NEVER_ADJACENT) {
    const i = order.indexOf(pair[0]), j = order.indexOf(pair[1]);
    if (i >= 0 && j >= 0 && Math.abs(i - j) === 1) bad.push(pair.join(' next to '));
  }
  return bad;
}

// ---- THE TWO CONTROLS, AND WHY THERE ARE TWO --------------------------------------------------
//
// HAZARDS §0b: "a guard that only sees deviation in the direction you expected is the same failure
// as a control that cannot fail". The r1 version of this file had one eye. It asked only "is any
// screen missing from the forward walk?", so it would have printed `ok` for the order the fix
// REPLACED — the one where every screen is reachable and the map is four presses away, which is
// the owner's original defect and the whole reason anything was edited. Both directions are now
// checked and each has its own control, and each control must go red for its OWN reason:
//
//   NULL CONTROL (the plausible wrong answer)  the pre-fix order. Reaches EVERY screen, and puts
//                                              the map back out of reach. Completeness green,
//                                              map-at-one-press RED.
//   THE BROKEN FIX (what r1 shipped)           map second and immediately before the journal.
//                                              Map-at-one-press green, completeness RED.
//
// The trivial control — "no walk at all" — is not run: it fails everything and would pass a guard
// that only knows how to notice zero. If EITHER control comes back green on both halves this tool
// exits 2 rather than 1, because a control that cannot exhibit the failure is not a control.
const ORDERS = {
  'NULL CONTROL — BEFORE the fix (map sixth)': ['world', 'inventory', 'journal', 'sheet', 'spells', 'map', 'wait', 'levelup'],
  'CONTROL — THE BROKEN FIX (r1: map next to journal)': ['world', 'inventory', 'map', 'journal', 'sheet', 'spells', 'wait', 'levelup'],
  'SHIPPED at HEAD': UISystem.WALK_ORDER,
};

const results = {};
for (const [label, order] of Object.entries(ORDERS)) {
  const fwd = walk(order, 1);
  const back = walk(order, -1);
  const d = fewest(order);
  const missing = PEERS.filter((m) => m !== 'inventory' && !fwd.includes(m));
  const bad = adjacentPairs(order);
  results[label] = { complete: missing.length === 0, mapAtOne: d.map === 1, neighbours: bad.length === 0 };
  console.log(`\n== ${label}`);
  console.log(`   WALK_ORDER      ${order.join(', ')}`);
  console.log(`   forward walk    inventory -> ${fwd.join(' -> ')}`);
  console.log(`   backward walk   inventory -> ${back.join(' -> ')}`);
  console.log(`   fewest turns    ${PEERS.map((m) => `${m}=${d[m] === undefined ? 'UNREACHABLE' : d[m]}`).join('  ')}`);
  console.log(`   phone taps      ${PEERS.filter((m) => m !== 'inventory').map((m) => `${m}=${d[m] === undefined ? 'n/a' : taps(d[m])}`).join('  ')}`);
  console.log(`   SKIPPED by the forward walk: ${missing.length ? missing.join(', ') : 'nothing'}`);
  console.log(`   NEVER_ADJACENT pair sitting side by side: ${bad.length ? bad.join('; ') : 'none'}`);
}

const HEAD = results['SHIPPED at HEAD'];
const NULLC = results['NULL CONTROL — BEFORE the fix (map sixth)'];
const BROKEN = results['CONTROL — THE BROKEN FIX (r1: map next to journal)'];

console.log('');
// Vacuity first. A guard is worth nothing until both of its eyes have been watched blinking.
const vacuous = [];
if (NULLC.complete !== true) vacuous.push('the null control was supposed to reach every screen and does not');
if (NULLC.mapAtOne !== false) vacuous.push('the null control was supposed to put the map out of reach and does not');
if (BROKEN.mapAtOne !== true) vacuous.push('the broken-fix control was supposed to keep the map at one press and does not');
if (BROKEN.complete !== false) vacuous.push('the broken-fix control was supposed to drop a screen and does not');
if (vacuous.length) {
  console.log('VACUOUS  this tool cannot show the failure it claims to guard against:');
  for (const v of vacuous) console.log(`         - ${v}`);
  process.exit(2);
}
console.log('ok   both controls go red, and for DIFFERENT reasons:');
console.log('     null control  complete=yes  map-at-one-press=NO   <- the owner\'s original defect');
console.log('     broken fix    complete=NO   map-at-one-press=yes  <- what r1 shipped');

const fails = [];
if (!HEAD.complete) fails.push('the shipped WALK_ORDER drops a screen from the forward page-walk entirely');
if (!HEAD.mapAtOne) fails.push('the shipped WALK_ORDER does not keep the map one page-turn from the inventory');
if (!HEAD.neighbours) fails.push('the shipped WALK_ORDER puts a NEVER_ADJACENT pair side by side — the second is stepped over');

if (!fails.length) {
  console.log('ok   SHIPPED: every menu screen is on the forward page-walk, the map is one turn away,');
  console.log('     and no NEVER_ADJACENT pair are neighbours.');
  process.exit(0);
}
for (const f of fails) console.log(`FAIL ${f}`);
console.log('     `navigable()` drops the NEVER_ADJACENT partner OF THE MODE YOU STAND ON, so an');
console.log('     excluded neighbour is STEPPED OVER rather than stopped at. Separate the pair by');
console.log('     one screen: it restores the walk and keeps the map one turn away.');
process.exit(1);
