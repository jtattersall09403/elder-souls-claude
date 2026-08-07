#!/usr/bin/env node
// map-shots.mjs — photograph the discovery map, early and well-travelled.
//
// Owner: W1-MAP. There is one reason this exists rather than a `--menu` flag on `shot.mjs`: the
// map's whole subject is ACCUMULATED STATE. A picture of it is only worth taking after the body
// has been somewhere, so the spec has to carry a route as well as a place, and `shot.mjs`'s CLI
// has no way to express one.
//
// S34 DECLARATION, and it is the honest one rather than the flattering one. These frames are
// `evidence_of: 'menu'` — what the map screen LOOKS LIKE at two states of discovery.
// **They are not evidence of arrival.** The route below is a sequence of `teleport` calls, and
// the capture daemon has no walking mode; a body placed at a coordinate has been at that
// coordinate, which is all the discovery model claims and all these pictures show. Anyone citing
// one of these for "the player can get from A to B" is citing it for something it does not say.
//
//   node tools/harness/map-shots.mjs
//   node tools/harness/map-shots.mjs --out docs/shots
import fs from 'node:fs';
import path from 'node:path';
import { capture } from '../capture/client.mjs';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT } from '../lib/cli.mjs';

const USAGE = `
map-shots.mjs — the discovery map, early and well-travelled.

USAGE
  node tools/harness/map-shots.mjs [--out <dir>] [--width N] [--height N]

OPTIONS
  --out <dir>   where to copy the PNGs (default docs/shots)
  --direct      drive one browser here instead of the pooled capture service, and REFUSE to
                write a frame whose map is empty when the claim says it is not
  --width/--height  capture size (default 1280x720)
  --help
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = path.resolve(String(args.out || path.join(REPO_ROOT, 'docs/shots')));
fs.mkdirSync(outDir, { recursive: true });
// 960x540 rather than 1280x720, and fourteen stops rather than forty. Both were contention
// decisions and are recorded as such: an earlier run of this file went out with
// `pgrep -c headless_shell` at 36 against the protocol's working rule of ~8, and its first
// attempt at forty stops and 1280x720 never returned — each `teleport` drains 25 province tiles,
// and the shared browser was dropped twice mid-job by other agents' edits changing the build
// key. The map is a flat 2D panel, so the smaller frame costs it almost nothing; the stop count
// is what the picture is actually about and fourteen still crosses the province.
const W = Number(args.width || 960), Hh = Number(args.height || 540);
const stamp = new Date().toISOString().slice(0, 10);

/** One leg of the route: stand somewhere, and let the fixed step's `stepDiscovery` see it. */
const stand = (x, z) => [['teleport', x, z, {}], ['stepFrames', 3]];

// THE ROUTE IS READ OFF THE PROVINCE, NOT TYPED HERE — and that is a correctness matter, not
// tidiness. A place is discovered by standing inside its own built pad (`terrain.json sites[]`
// `r_flat`), so hand-typed coordinates that merely look like settlements discover NOTHING: the
// first version of this file used sixteen such coordinates and every frame it produced showed an
// empty map and the line "I have not written anything down yet". Standing on the world's own
// site centres is the only way the squares appear, and it cannot drift from the province.
const terrain = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'game/data/world/terrain.json'), 'utf8'));
const poiIds = new Set(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'game/data/world/pois.json'), 'utf8'))
  .pois.map((p) => p.id));
// Only sites that are also POIs can name themselves on the map, so only those are worth walking
// to for a picture of named places.
const named = terrain.sites.filter((s) => poiIds.has(s.id));

// Spread the stops across the province by farthest-point selection rather than by picking the
// first N, which would cluster wherever the file happens to be ordered. Deterministic: it starts
// from the first site in file order and never uses a random number.
function spread(list, n) {
  const out = [list[0]];
  while (out.length < n && out.length < list.length) {
    let best = null, bestD = -1;
    for (const c of list) {
      if (out.includes(c)) continue;
      let d = Infinity;
      for (const o of out) d = Math.min(d, (c.x - o.x) ** 2 + (c.z - o.z) ** 2);
      if (d > bestD) { bestD = d; best = c; }
    }
    out.push(best);
  }
  return out;
}

// EARLY. One settlement and the ground around it — a character who has been out of Stormhold
// once. The point of this frame is how much of the province is NOT there.
const home = named.find((s) => s.id === 'stormhold') || named[0];
const early = [...stand(home.x, home.z)];

// WELL-TRAVELLED. Fourteen of the province's own places, spread across it. The regions differ in
// how much they show of themselves — `sightline_m` in `regions.json` is the reveal radius — so
// the revealed ground is broad across the open salt hills and narrow through the marshes, and
// that difference is the thing worth photographing.
const legs = spread(named, 14);
const route = [];
for (const s of legs) route.push(...stand(s.x, s.z));

// The claims below are worded to say what the frame SHOWS and nothing more. The arrival gate's
// layer C refuses a spec whose free text asserts a journey, and it is right to: these frames are
// evidence about a menu, and the first draft of this file described them as a "circuit" and a
// "trail", which is a claim about getting somewhere that no placed capture can support.
const shots = [
  {
    name: `${stamp}-map-early`,
    wantPlaces: true,
    claim: 'The discovery map screen after the body has stood in one settlement: what the screen looks like when almost nothing has been discovered. Undiscovered ground is unrendered under ARBITRATION S35, so this frame is mostly the screen s own colour.',
    ops: early,
  },
  {
    name: `${stamp}-map-explored`,
    wantPlaces: true,
    claim: 'The discovery map screen after the body has stood in fourteen of the province s own places, spread across it: the revealed ground is broad in the open regions and narrow in the marshes, because the reveal radius is each region s own declared sightline_m in regions.json.',
    ops: route,
  },
  {
    name: `${stamp}-map-local`,
    claim: 'The discovery map screen s local view of the cell the body is standing in, at 500 m across.',
    // The map is opened inside `ops` rather than by the spec's `menu` key, because the local
    // view is reached by a CONFIRM press and the press has to land after the screen is up. The
    // press goes through `queueInputs` — the real input path, latched inside the fixed step —
    // so this frame photographs a view a player can actually get to.
    //
    // `f: 0`, and the whole shot depends on it. The map pauses the world, and a paused frame
    // latches input without advancing `sim.frame`, so a scripted press at `f >= 1` never fires
    // and is never reported lost either (see the long note in map-probe.mjs S11). The first
    // version of this file used `f: 1`/`f: 3` and would therefore have produced a picture of
    // the WORLD view filed under a local-view caption — a quietly wrong artifact, which is
    // worse than a missing one. Press and release in the same latch is a clean tap.
    ops: [
      ...early,
      ['openMenu', 'map', {}],
      ['queueInputs', [{ f: 0, press: ['interact'] }, { f: 0, release: ['interact'] }]],
      ['stepFrames', 2],
    ],
    noMenu: true,
  },
];

// ---- --direct: one browser, and the frame is CHECKED before it is kept -----------------------
//
// This mode exists because the pooled service produced three frames of an EMPTY map — black
// panel, "I have not written anything down yet." — from a route that this same build discovers
// fourteen places on when the identical `loadState -> teleport/stepFrames -> openMenu` sequence
// is run in a browser here. Ops are executed by the daemon (a spec naming a method that cannot
// exist is correctly refused), the daemon had already dropped and rebooted its browser on the
// build change that carried the fix, and the discrepancy is NOT yet explained. It is recorded in
// orchestration/status/W1-MAP.json rather than papered over.
//
// The lesson that outlives the discrepancy is the assertion below. The earlier empty frames were
// shipped and filed as evidence because NOTHING CHECKED THAT THE PICTURE CONTAINED ITS SUBJECT —
// a photograph of a blank map and a photograph of a working map are both "a PNG arrived". So
// this mode reads `getUIState().map` on the very page it photographs and refuses to write a
// frame whose map is empty when the claim says it is full. A shot tool that cannot fail is worth
// as little as a probe that cannot.
if (args.direct) {
  const { launchGame } = await import('../lib/browser.mjs');
  const h = await launchGame({ width: W, height: Hh });
  let bad = 0;
  try {
    for (const s of shots) {
      const r = await h.page.evaluate(async ({ ops, wantPlaces }) => {
        const H = window.__HARNESS;
        await H.ready();
        await H.loadState('default');
        // CLOSE ANY MENU THE PREVIOUS SHOT LEFT OPEN, BEFORE STEPPING ANYTHING. A menu pauses
        // the world, and the paused branch of `engine._step()` never calls `stepOnce()` — so
        // `stepFrames` below would move the body by teleport and simulate NOTHING, and the map
        // would record nothing at all. `loadState` does not close the menu. This is exactly how
        // shots 2 and 3 of this file came back with `revealed=0` while shot 1, running on a
        // freshly booted page with no menu open, came back with 1015 cells.
        await H.closeMenu();
        if (H.setUIVisible) await H.setUIVisible(true);
        for (const op of ops) await H[op[0]](...op.slice(1));
        if (!ops.some((o) => o[0] === 'openMenu')) await H.openMenu('map', {});
        const st = H.getUIState();
        const m = st.map;
        const png = await H.screenshot();
        return { png, view: m.view, drawn_cells: m.drawn_cells, places_drawn: m.places_drawn,
          revealed_cells: m.revealed_cells, places_discovered: m.places_discovered, wantPlaces };
      }, { ops: s.ops, wantPlaces: !!s.wantPlaces });
      // The gate. A frame claiming discovered ground must contain some.
      if (r.drawn_cells === 0 || (r.wantPlaces && r.places_drawn === 0)) {
        log(`REFUSED ${s.name}: the map is empty (drawn_cells=${r.drawn_cells}, ` +
          `places_drawn=${r.places_drawn}, model revealed=${r.revealed_cells}, ` +
          `model places=${r.places_discovered}, view=${r.view}) but the claim says it is ` +
          'not. Frame not written.');
        bad++;
        continue;
      }
      const dest = path.join(outDir, `${s.name}.png`);
      fs.writeFileSync(dest, Buffer.from(String(r.png).split(',')[1], 'base64'));
      log(`${dest}  (direct; view=${r.view} cells=${r.drawn_cells} places=${r.places_drawn})`);
    }
  } finally { await h.close(); }
  process.exit(bad ? EXIT.FAIL : EXIT.OK);
}

// Retried, because on a box this busy the two ways a request dies are both transient: the daemon
// drops its browser whenever another agent's edit changes the build key, and a frame can come
// back UNSETTLED when the province streamer is still arriving behind the panel. Neither is a
// reason to give up, and neither is a reason to lower the settle threshold — S34 is explicit
// that an unsettled frame is an error and never a quiet pass, so the answer is to ask again.
let bad = 0;
for (const s of shots) {
  let done = false;
  for (let attempt = 1; attempt <= 3 && !done; attempt++) {
    try {
      const shot = await capture({
        evidence_of: 'menu',
        claim: s.claim,
        state: 'default',
        ui: true,
        ops: s.ops,
        ...(s.noMenu ? {} : { menu: { name: 'map', opts: {} } }),
        width: W, height: Hh,
      });
      const dest = path.join(outDir, `${s.name}.png`);
      fs.copyFileSync(shot.path, dest);
      log(`${dest}  (cached=${shot.cached}, attempt ${attempt})`);
      done = true;
    } catch (e) {
      log(`attempt ${attempt} for ${s.name}: ${e.message.split('\n')[0]}`);
    }
  }
  if (!done) { log(`FAILED ${s.name} after 3 attempts`); bad++; }
}
process.exit(bad ? EXIT.FAIL : EXIT.OK);
