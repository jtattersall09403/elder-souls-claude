// DELETE-THE-FIX for W1-21 round 2's AR-2 change (RULES 6, and RULES 17 for the index check).
//
// RULES 6 asks for the change to be removed ON A COPY and for the old number to come back, and
// then for the two arms to be shown to actually differ — an "inert fix" has passed here twice.
// `w1-21-r2-forge.mjs` R4 already carries a re-implementation of the pre-fix `restore()` as its
// control, but a re-implementation is a claim about what the old code did. This file does not
// re-implement anything: it pulls `game/src/sim/discovery.js` out of git at the named commit,
// writes it to a scratch copy, imports BOTH modules into one process, and runs the identical
// forgery through each.
//
// RULES 17: a delete-the-fix on a shared tree must check the git INDEX, not just the file — a
// neighbour's `git add -A` has staged a temporary deletion before now. The index state of both
// changed files is read and reported below, and the run refuses to draw a conclusion if the
// working tree it is comparing against is not the working tree it thinks it is.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';
import { Discovery as Fixed } from '../../game/src/sim/discovery.js';
import { rd, rdOpt } from '../lib/gamedata.mjs';
import { log, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';

const BASE = process.argv[2] || 'HEAD';
const RUN = path.join(RUNS_DIR, 'W1-21-R2');
ensureDir(RUN);

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();

// ---- RULES 17: what is in the index, before anything is concluded ----------------------------
const FILES = ['game/src/sim/discovery.js', 'game/src/ui/system.js'];
const index = {};
for (const f of FILES) {
  index[f] = {
    staged: git('diff', '--cached', '--name-only', '--', f).length > 0,
    unstaged: git('diff', '--name-only', '--', f).length > 0,
    exists_on_disk: fs.existsSync(path.join(git('rev-parse', '--show-toplevel'), f)),
  };
}
const baseSha = git('rev-parse', '--short', BASE);
log(`base ${BASE} = ${baseSha}`);
for (const f of FILES) log(`  index: ${f} staged=${index[f].staged} unstaged=${index[f].unstaged} on_disk=${index[f].exists_on_disk}`);

// The only state in which this comparison means what it says: my change is in the working tree
// and is NOT in the index, so `git show <base>:file` really is the code before it.
const sane = FILES.every((f) => index[f].exists_on_disk)
  && index['game/src/sim/discovery.js'].unstaged;
if (!sane) {
  log('REFUSING TO CONCLUDE: the working tree is not in the state this comparison assumes. '
    + 'Either the change is not in the working tree, or a neighbour has staged something. '
    + 'See the index lines above.');
  writeJson(path.join(RUN, 'deletefix.json'), { base: baseSha, index, refused: true });
  process.exit(2);
}

// ---- the copy ---------------------------------------------------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'w1-21-dtf-'));
const oldPath = path.join(tmp, 'discovery-base.js');
fs.writeFileSync(oldPath, git('show', `${BASE}:game/src/sim/discovery.js`));
// It imports nothing, so a bare copy in a scratch directory loads.
const { Discovery: Old } = await import(pathToFileURL(oldPath).href);

// ---- one fixture, both arms --------------------------------------------------------------------
const terrain = rd('world/terrain.json');
const pois = rd('world/pois.json');
const field = new WorldField(terrain, rd('world/regions.json'), rd('world/water.json'));
const mapDoc = rdOpt('ui/map.json', {});
const byId = new Map();
for (const s of terrain.sites || []) byId.set(s.id, s);
const SITES = (pois.pois || []).map((p) => {
  const s = byId.get(p.id);
  return { id: p.id, x: s ? s.x : p.pos[0], z: s ? s.z : p.pos[2] };
});

function walk(D) {
  const sim = { player: { pos: [0, 0, 0] }, env: { interior: null } };
  const d = new D({ field, sim, doc: mapDoc, pois });
  let at = [SITES[0].x, SITES[0].z];
  sim.player.pos[0] = at[0]; sim.player.pos[2] = at[1]; d.observe();
  for (const t of SITES.slice(0, 7)) {
    const steps = Math.ceil(Math.hypot(t.x - at[0], t.z - at[1]) / (terrain.cell_m * 0.5));
    for (let i = 1; i <= steps; i++) {
      sim.player.pos[0] = at[0] + (t.x - at[0]) * (i / steps);
      sim.player.pos[2] = at[1] + (t.z - at[1]) * (i / steps);
      d.observe();
    }
    at = [t.x, t.z];
  }
  return d;
}

function arm(D, label) {
  const honest = walk(D);
  const blob = honest.serialise();
  const stood = honest.places().slice();
  // THE SAME FORGERY IN BOTH ARMS: every field the blob carries, set to the strongest claim it
  // can make. Whatever fields the arm's own serialiser produced are overwritten in place, so
  // neither arm gets an easier forgery than the other.
  const forged = JSON.parse(JSON.stringify(blob));
  const bytes = new Uint8Array((terrain.cols * terrain.rows + 7) >> 3); bytes.fill(0xFF);
  if ('cells' in forged) forged.cells = Buffer.from(bytes).toString('base64');
  forged.places = (pois.pois || []).map((p) => p.id);
  forged.revealed = terrain.cols * terrain.rows;

  const sim = { player: { pos: [0, 0, 0] }, env: { interior: null } };
  const loaded = new D({ field, sim, doc: mapDoc, pois });
  const rep = loaded.restore(forged);
  const after = loaded.places().slice();
  return {
    arm: label,
    stood_in: stood.length,
    blob_fields: Object.keys(blob).sort(),
    places_after_forged_load: after.length,
    phantom: after.filter((p) => !stood.includes(p)).length,
    revealed_honest: honest.revealedCells,
    revealed_after: loaded.revealedCells,
    dropped: (rep && rep.dropped ? rep.dropped.length : 0),
  };
}

const A = arm(Fixed, `working tree (the fix)`);
const B = arm(Old, `${baseSha} (the fix deleted)`);
for (const r of [A, B]) {
  log(`  ${r.arm}: stood in ${r.stood_in}; after a forged load ${r.places_after_forged_load} places `
    + `(${r.phantom} phantom), revealed ${r.revealed_honest} -> ${r.revealed_after}, dropped ${r.dropped}`);
}

// The two things RULES 6 asks: the old number comes back, and the arms actually differ.
const oldNumberReturns = B.phantom > 0 && B.places_after_forged_load > B.stood_in;
const armsDiffer = A.phantom !== B.phantom && A.places_after_forged_load !== B.places_after_forged_load;
const fixHolds = A.phantom === 0 && A.places_after_forged_load === A.stood_in;

log(`\nold number returns when the fix is deleted: ${oldNumberReturns} `
  + `(${B.phantom} phantom squares, ${B.places_after_forged_load} places for a body that stood in ${B.stood_in})`);
log(`the two arms differ:                        ${armsDiffer}`);
log(`the fix holds in the working tree:          ${fixHolds}`);

const ok = oldNumberReturns && armsDiffer && fixHolds;
writeJson(path.join(RUN, 'deletefix.json'), {
  tool: 'tools/harness/w1-21-r2-deletefix.mjs',
  base: baseSha, index, arms: [A, B],
  old_number_returns: oldNumberReturns, arms_differ: armsDiffer, fix_holds: fixHolds, ok,
});
fs.rmSync(tmp, { recursive: true, force: true });
log(ok ? 'DELETE-THE-FIX PASSED' : 'DELETE-THE-FIX FAILED');
process.exit(ok ? 0 : 1);
