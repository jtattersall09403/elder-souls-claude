#!/usr/bin/env node
/**
 * rawleg-check — is the phase-B water trap wayfind-journey.mjs found (F29) a bug in ITS
 * navigator/tidyPath, or a defect in the road and the walk step themselves?
 *
 * Owner: W1-05. Written to settle exactly one question, cheaply: walk `__HARNESS.walkPath()`
 * down the RAW, UNTIDIED leg centreline out of `roads.json` — no navigator, no tidyPath, none of
 * `wayfind-journey.mjs`'s own code. If the capsule still leaves the road and drowns, the defect is
 * not this piece's probe.
 *
 * Result (2026-08-07, this run): it does. `walkPath` on the raw `soulrest-blackrose` leg lands at
 * (2195.6, 4994.9), 10.5 m from the tidied two-hop trace's landing point and 0.7 m from its deepest
 * water — three independently-generated paths converging on the same ~30 m of water is the evidence
 * this is a world/engine defect, not a probe artifact. See reports/w1-05-journey.json's
 * CONFIRMED_NOT_A_PROBE_ARTIFACT note for the full comparison. NOT SETTLED: which frame the capsule
 * first leaves the road, and why it never climbs back out, were not isolated this run.
 *
 * Usage: node tools/world/rawleg-check.mjs [--leg <id>] [--out <path>]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const LEG = arg('--leg', 'soulrest-blackrose');
const OUT = arg('--out', 'reports/w1-05-rawleg-check.json');

const roads = rd('game/data/world/roads.json');
const leg = roads.legs.find((l) => l.id === LEG);
if (!leg) throw new Error(`rawleg-check: no leg '${LEG}'. Known: ${roads.legs.map((l) => l.id).join(', ')}`);
// roads.json points are [x, z, y] (checked against F13, not assumed).
const path = leg.points.map((p) => [p[0], p[1]]);
console.log(`rawleg-check: ${leg.id} ${leg.from} -> ${leg.to}, ${path.length} raw points, no tidy, no navigator`);

const { launchGame } = await import(join(ROOT, 'tools/lib/browser.mjs'));
const h = await launchGame({ width: 320, height: 240 });
let walked;
try {
  walked = await h.page.evaluate(({ path }) => {
    const H = window.__HARNESS;
    try { H.signClose(); } catch (e) { /* not open */ }
    try { H.conversationClose(); } catch (e) { /* not open */ }
    try { H.closeMenu(); } catch (e) { /* none open */ }
    H.loadState('default');
    H.setRenderRate(0);
    H.teleport(path[0][0], path[0][1]);
    H.streamAround(path[0][0], path[0][1]);
    return H.walkPath(path, { speed: 'walk', maxFrames: 400000 });
  }, { path });
} finally { await h.close(); }

console.log(walked.arrived ? 'ARRIVED' : `DID NOT ARRIVE — ended ${walked.offset_m} m short, deepest water ${walked.deepest_water_on_the_walk.depth_m} m`);
mkdirSync(join(ROOT, dirname(OUT)), { recursive: true });
writeFileSync(join(ROOT, OUT), JSON.stringify({ tool: 'tools/world/rawleg-check.mjs', owner: 'W1-05', leg: LEG, path_points: path.length, walked }, null, 2) + '\n');
console.log(`wrote ${OUT}`);
