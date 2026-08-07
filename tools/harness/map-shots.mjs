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
  --width/--height  capture size (default 1280x720)
  --help
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = path.resolve(String(args.out || path.join(REPO_ROOT, 'docs/shots')));
fs.mkdirSync(outDir, { recursive: true });
// 960x540 rather than 1280x720, and sixteen stops rather than forty. Both are contention
// decisions and are recorded as such: this ran with `pgrep -c headless_shell` at 36 against the
// protocol's working rule of ~8, and the first attempt at forty stops and 1280x720 never
// returned — each `teleport` drains 25 province tiles, and the shared browser was dropped twice
// mid-job by other agents' edits changing the build key. The map is a flat 2D panel, so the
// smaller frame costs it almost nothing; the stop count is what the picture is actually about
// and sixteen is still enough to cross five regions.
const W = Number(args.width || 960), Hh = Number(args.height || 540);
const stamp = new Date().toISOString().slice(0, 10);

/** One leg of the route: stand somewhere, and let the fixed step's `stepDiscovery` see it. */
const stand = (x, z) => [['teleport', x, z, {}], ['stepFrames', 3]];

// EARLY. One settlement and the ground around it — a character who has been out of Stormhold
// once. The point of this frame is how much of the province is NOT there.
const early = [
  ...stand(2171.5, 761),
  ...stand(2280, 900),
  ...stand(2400, 1000),
];

// WELL-TRAVELLED. A long circuit through the province touching several settlements. The regions
// differ in how much they show of themselves — `sightline_m` in `regions.json` is the reveal
// radius — so the trail is broad across the open salt hills and narrow through the marshes, and
// that difference is the thing worth photographing.
const route = [];
const legs = [
  [2171.5, 761], [2674.8, 751.6], [3200, 820], [3820, 859],
  [3400, 1600], [2800, 2100], [2200, 2600], [1600, 2850],
  [1000, 2950], [439, 2913.5], [900, 3400], [1500, 3700],
  [2100, 3900], [2700, 3700], [3300, 3300], [3600, 2700],
];
for (const [x, z] of legs) route.push(...stand(x, z));

// The claims below are worded to say what the frame SHOWS and nothing more. The arrival gate's
// layer C refuses a spec whose free text asserts a journey, and it is right to: these frames are
// evidence about a menu, and the first draft of this file described them as a "circuit" and a
// "trail", which is a claim about getting somewhere that no placed capture can support.
const shots = [
  {
    name: `${stamp}-map-early`,
    claim: 'The discovery map screen after the body has stood in one settlement: what the screen looks like when almost nothing has been discovered. Undiscovered ground is unrendered under ARBITRATION S35, so this frame is mostly the screen s own colour.',
    ops: early,
  },
  {
    name: `${stamp}-map-explored`,
    claim: 'The discovery map screen after the body has stood at sixteen coordinates spread across the province: the revealed ground is broad in the open regions and narrow in the marshes, because the reveal radius is each region s own declared sightline_m in regions.json.',
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
