#!/usr/bin/env node
// w1-21-r3-mutator-test.mjs — THE TEST THAT WOULD HAVE CAUGHT THE `restore()` GETTER.
//
// W1-21 round 3. The round-2 verdict §5 broke `Discovery.mutatorReport()`'s fail-closed claim on
// purpose (RULES 4) and wrote down exactly how:
//
//     D3  ok    add an undeclared METHOD to the prototype -> reported as a writer
//     D4  FAIL  add a state-writing ACCESSOR              -> reported as NOTHING AT ALL
//
//     Object.defineProperty(proto, '__criticGetter',
//       { get() { this.restore({ stood: '' }); return 1; } });
//
//     "a plain property read — `d.__criticGetter`, which no reviewer would look at twice — wiped
//      the map from 2,446 revealed cells to 0. `mutatorReport()` did not list it. Eleven of the
//      object's twenty-five prototype members are accessors and every one of them is exempt from
//      the check by construction."
//
// This file is that test, kept. It runs the critic's own getter, plus five more shapes of writing
// accessor, and it asserts BOTH halves — that the getter really does wipe the map (otherwise the
// test is asserting something harmless) and that `mutatorReport()` names it.
//
// It also runs the DELETE-THE-FIX arm (RULES 6) in the same process: the round-2 classifier is
// transcribed here as `classifyRound2`, applied to the same prototype, and the run refuses to
// conclude unless the old classifier is silent on the same getters the new one catches. A control
// that has never been seen to fail is a second copy of the experiment.
//
// No browser, no engine: the model is `game/src/sim/discovery.js` and it imports clean in node.
import path from 'node:path';
import { Discovery } from '../../game/src/sim/discovery.js';
import { parseArgs, wantsHelp, usage, log, RUNS_DIR, ensureDir, writeJson } from '../lib/cli.mjs';

const USAGE = `
w1-21-r3-mutator-test.mjs — can mutatorReport() see a state-writing ACCESSOR?

USAGE
  node tools/ui/w1-21-r3-mutator-test.mjs [--out <dir>] [--json]

EXIT 0 = every writing accessor is reported and the round-2 control is silent on them
       1 = a writing accessor is invisible, or the control is not a control
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const RUN = path.join(RUNS_DIR, String(args.out || 'W1-21-R3'));

/**
 * THE ROUND-2 CLASSIFIER, transcribed from `game/src/sim/discovery.js` at `37bbb6f`, so the
 * delete-the-fix arm is the real previous behaviour rather than a description of it:
 *
 *     if (!d || typeof d.value !== 'function') continue;   // getters are readers by construction
 */
function reportRound2(obj) {
  const READERS = new Set(['constructor', 'seenCell', 'seenAt', 'places', 'hasPlace', 'raster',
    'footprint', 'placePos', 'serialise', 'mutatorReport']);
  const proto = Object.getPrototypeOf(obj);
  const out = [];
  for (const name of Object.getOwnPropertyNames(proto)) {
    const d = Object.getOwnPropertyDescriptor(proto, name);
    if (!d || typeof d.value !== 'function') continue;
    if (READERS.has(name)) continue;
    out.push({ name, arity: d.value.length });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** A province just big enough to have cells to reveal and a place to stand in. */
function makeModel() {
  const cols = 40, rows = 40, cell = 25;
  const field = {
    cols, rows, cell,
    sites: [{ id: 'lilmoth', x: 200, z: 200, r_flat: 40 }],
    regionAt: () => ({ sightline_m: 120 }),
  };
  // `observe()` reads `sim.player.pos` (a [x, y, z] triple) and `sim.env.interior`.
  const sim = { player: { pos: [200, 0, 200] }, env: { interior: null } };
  const doc = { reveal: { min_m: 50, max_m: 200 }, places: { fallback_radius_m: 25 } };
  const pois = { pois: [{ id: 'lilmoth', pos: [200, 200] }] };
  const model = new Discovery({ field, sim, doc, pois });
  // Walk the body, so the model has something to lose. `observe()` reads the SimState the model
  // captured at construction, which is why the walker moves THAT object rather than passing a
  // position — the model has no parameter in which a place could be named, which is the whole
  // point of it (AMENDMENT-W1-MAP-01 §3b).
  for (const [x, z] of [[200, 200], [260, 230], [330, 280], [420, 340], [520, 420], [610, 500]]) {
    sim.player.pos[0] = x; sim.player.pos[2] = z;
    model.observe();
  }
  return model;
}

const checks = [];
const push = (id, pass, detail) => { checks.push({ id, pass, detail }); log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`); };

// ---- the six writing accessors, and one honest one as the negative control --------------------
//
// Each is installed on the prototype, exercised as a PLAIN PROPERTY READ, and then removed.
const ACCESSORS = [
  ['critic_restore', { get() { this.restore({ stood: '' }); return 1; } },
    'the round-2 critic\'s own getter: calls restore() with an empty footprint'],
  ['calls_suspend', { get() { this.suspend(); return this.suspended; } },
    'a getter that stops the model recording'],
  ['calls_observe', { get() { this.observe(); return 1; } },
    'a getter that advances the model'],
  ['assigns', { get() { return (this.__leak = 1); } },
    'a getter whose returned expression assigns'],
  ['multi_statement', { get() { const n = 1; return n; } },
    'a getter with more than one statement — cheap to hide a write in'],
  ['setter', { set(v) { this.restore({ stood: v }); } },
    'a SETTER, which round 2 also skipped'],
  // the control: a genuine reader, which must NOT be reported, or the classifier reports
  // everything and distinguishes nothing (S26).
  ['honest_reader', { get() { return this.revealedCells; } },
    'CONTROL: a real reader — must NOT be reported'],
];

const proto = Discovery.prototype;
const results = [];
for (const [name, desc, why] of ACCESSORS) {
  const model = makeModel();
  const before = { revealed: model.revealedCells, places: model.places().length };

  Object.defineProperty(proto, name, { ...desc, configurable: true });
  let wrote = false, threw = null;
  try {
    // A PLAIN PROPERTY READ / WRITE. Nothing here looks like calling a mutator.
    if (desc.set) model[name] = '';
    else void model[name];
  } catch (e) { threw = String(e && e.message || e); }
  const after = { revealed: model.revealedCells, places: model.places().length };
  wrote = after.revealed !== before.revealed || after.places !== before.places;

  const nowReported = model.mutatorReport().some((m) => m.name === name);
  const round2Reported = reportRound2(model).some((m) => m.name === name);
  delete proto[name];

  results.push({ name, why, before, after, wrote, threw, reported_now: nowReported, reported_round2: round2Reported });
}

// ---- the assertions ---------------------------------------------------------------------------
const writers = results.filter((r) => r.name !== 'honest_reader');
const control = results.find((r) => r.name === 'honest_reader');

// D4a — the critic's getter really does wipe the map. If it did not, everything below is theatre.
const critic = results.find((r) => r.name === 'critic_restore');
push('D4a', critic.wrote && critic.after.revealed === 0 && critic.before.revealed > 0,
  `the critic's getter, read as a plain property: revealed ${critic.before.revealed} -> ${critic.after.revealed}, places ${critic.before.places} -> ${critic.after.places}`);

// D4b — every writing accessor is now reported.
const missed = writers.filter((r) => !r.reported_now).map((r) => r.name);
push('D4b', missed.length === 0,
  `${writers.length} writing accessors installed, ${writers.filter((r) => r.reported_now).length} reported by mutatorReport(); missed [${missed.join(',') || '-'}]`);

// D4c — THE CONTROL ARM, WATCHED GOING RED (RULES 6). The round-2 classifier must be blind to
// every one of them, or "the fix" was not what changed the answer.
const seenByRound2 = writers.filter((r) => r.reported_round2).map((r) => r.name);
push('D4c', seenByRound2.length === 0 && writers.length > 0,
  `delete-the-fix: the round-2 classifier reports ${seenByRound2.length} of ${writers.length} writing accessors ` +
  `— it is blind to [${writers.map((r) => r.name).join(',')}]. The two arms differ.`);

// D4d — and the classifier is not simply reporting everything.
push('D4d', control && !control.reported_now && !control.wrote,
  `CONTROL: an honest reader (${control.why}) is NOT reported and wrote nothing (revealed ${control.before.revealed} -> ${control.after.revealed})`);

// D4e — the report carries its own sample count: how many prototype members it examined.
const model = makeModel();
const rep = model.mutatorReport();
const members = Object.getOwnPropertyNames(Discovery.prototype).length;
push('D4e', rep.membersExamined === members && members > 0,
  `mutatorReport() examined ${rep.membersExamined} of ${members} prototype members ` +
  `(${rep.length} writers: ${rep.map((m) => `${m.name}/${m.arity}`).join(', ')})`);

// D4f — the shipped tree is clean: no accessor on the real prototype is a writer.
const shippedWriters = rep.filter((m) => m.member !== 'method');
push('D4f', shippedWriters.length === 0,
  `on the SHIPPED prototype, ${shippedWriters.length} accessors classify as writers ${JSON.stringify(shippedWriters)}`);

const out = {
  schema: 'elder-souls/w1-21-r3-mutator@1',
  at: new Date().toISOString(),
  what: 'AMENDMENT-W1-MAP-01 §3b — can mutatorReport() see a state-writing ACCESSOR?',
  prototype_members: members,
  results, checks,
  ok: checks.every((c) => c.pass),
};
ensureDir(RUN);
writeJson(path.join(RUN, 'mutator-test.json'), out);
if (args.json) console.log(JSON.stringify(out, null, 2));
log(`mutator test: ${checks.filter((c) => c.pass).length}/${checks.length} — artifacts ${RUN}`);
process.exit(out.ok ? 0 : 1);
