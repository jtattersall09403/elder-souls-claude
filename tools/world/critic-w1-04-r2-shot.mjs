#!/usr/bin/env node
/**
 * critic-w1-04-r2-shot — the picture for the W1-04 round-2 verdict.
 *
 * The round-1 verdict's picture was two buildings four kilometres apart drawing the same
 * 249-triangle hall. That is fixed for most of the population. This is the picture of what is
 * LEFT of it: `helstrom-smithy` and `helstrom-scriptorium` — a forge and a copying-room in the
 * same town — whose records are byte-identical in every field `render/interior.js` reads, so the
 * renderer builds them the same room. Twelve such groups cover 21 of the 115.
 *
 * Taken through `tools/capture/` (RULES.md rule 20): this poses a camera and takes a frame, it
 * does not step the simulation, so it has no business launching a browser of its own.
 */
import { capture } from '../capture/client.mjs';
import { log, writeJson, parseArgs } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
const PAIR = (args.pair ? String(args.pair) : 'helstrom-smithy,helstrom-scriptorium').split(',');
const POSE = { pos: [0, 1.62, -5.2], look: [0, 1.3, 2.0] };

const out = [];
for (const id of PAIR) {
  const shot = await capture({
    ops: [['enterInterior', id]],
    camera: POSE,
    time: 12,
    weather: 'clear',
    width: 720,
    height: 480,
    evidence_of: 'interior',
    claim: `${id}, entered through the door and shot from one fixed pose`,
    note: 'W1-04 round-2 critic: two interiors whose records are identical in every field the room builder reads.',
  });
  log(`${id} -> ${shot.path}${shot.cached ? ' (cached)' : ''}`);
  out.push({ id, path: shot.path, cached: !!shot.cached });
}
writeJson(args.out || 'reports/critic-w1-04-r2-shot.json', { pose: POSE, shots: out });
if (out.length !== PAIR.length) { log('FAIL: not every frame came back'); process.exit(1); }
