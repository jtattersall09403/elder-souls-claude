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

const ORDERS = {
  'BEFORE the fix (map sixth)': ['world', 'inventory', 'journal', 'sheet', 'spells', 'map', 'wait', 'levelup'],
  'SHIPPED at HEAD':            UISystem.WALK_ORDER,
  'PROPOSED remediation':       ['world', 'inventory', 'map', 'sheet', 'journal', 'spells', 'wait', 'levelup'],
};

let shippedComplete = true;
for (const [label, order] of Object.entries(ORDERS)) {
  const fwd = walk(order, 1);
  const back = walk(order, -1);
  const d = fewest(order);
  const missing = PEERS.filter((m) => m !== 'inventory' && !fwd.includes(m));
  console.log(`\n== ${label}`);
  console.log(`   WALK_ORDER      ${order.join(', ')}`);
  console.log(`   forward walk    inventory -> ${fwd.join(' -> ')}`);
  console.log(`   backward walk   inventory -> ${back.join(' -> ')}`);
  console.log(`   fewest turns    ${PEERS.map((m) => `${m}=${d[m] === undefined ? 'UNREACHABLE' : d[m]}`).join('  ')}`);
  console.log(`   phone taps      ${PEERS.filter((m) => m !== 'inventory').map((m) => `${m}=${d[m] === undefined ? 'n/a' : taps(d[m])}`).join('  ')}`);
  console.log(`   SKIPPED by the forward walk: ${missing.length ? missing.join(', ') : 'nothing'}`);
  if (label === 'SHIPPED at HEAD' && missing.length) shippedComplete = false;
}

console.log('');
if (shippedComplete) {
  console.log('ok   every menu screen is on the forward page-walk');
  process.exit(0);
}
console.log('FAIL the shipped WALK_ORDER drops a screen from the forward page-walk entirely.');
console.log('     `map` sits immediately before `journal`, and `map`\'s own ring excludes');
console.log('     `journal` (NEVER_ADJACENT / RI-UIX04 Q7), so the forward walk steps over it.');
console.log('     Separating the pair by one screen restores it and keeps the map one turn away.');
process.exit(1);
