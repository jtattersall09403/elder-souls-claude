#!/usr/bin/env node
// check-save-shape.mjs — a LIVE OBJECT must not come back from a save as a plain one.
//
// WHY THIS EXISTS, and why it is a class and not a case.
//
// `save/fight.js`'s `SKIP` list omitted `ai`, so `saveActor(ctl)` walked the live `SoulsAI`
// with the generic encoder — which does not care what an object's prototype is — and
// `loadActor` assigned the resulting plain object straight back over the instance. The next
// fixed step threw `this.ai.step is not a function`, which killed every stepping probe in the
// project. It stayed invisible for a wave because **`boot-check` does not step**: the engine
// constructed, the harness answered, a frame came out, and the defect only appeared on the
// frame after a load. Measured on the shipped tree before the repair: `ctl.ai`'s constructor
// went `SoulsAI` -> `Object` across `saveRoundTrip()`, `stepFrames(1)` threw, `hash_equal` was
// false, and the serialised state machine was 81,892 bytes of a 194,161-byte save (42%),
// because behind `ai.b` it had dragged in the whole `CombatBody`.
//
// "A live object serialised as a plain object, then called" is a SHAPE. Adding `ai` to `SKIP`
// would have closed this instance and left the shape open — and would itself have been a
// second, quieter defect, because `EnemyController._idleBehaviour()` guards its whole souls
// branch with `if (this.ai)`: a skipped `ai` restores as `null` and the enemy stops thinking
// without throwing anything at all.
//
// SO THIS CHECKS THE MECHANISM, NOT THE INSTANCE. It runs `saveActor` -> JSON -> `loadActor`
// and asserts that **every restored object which had methods still has them**, by comparing a
// prototype-method census taken before the save with one taken after the load. It also fails
// on `__unsaved`, the list `saveActor` writes when it meets a class instance that has declared
// no `saveState()` — losing state loudly is recoverable, handing back an object with the right
// fields and no methods is not.
//
// NO BROWSER, NO ENGINE, ~100 ms: it imports `game/src/save/fight.js`, `game/src/combat/ai.js`
// and `game/src/combat/enemy.js` directly and drives them against the shipped
// `game/data/combat/ai.json`. That is why it can live in the pre-commit hook, where a broken
// round trip costs the agent who wrote it instead of the thirteen who did not (RULES 13, 14).
//
// Run:  node tools/check-save-shape.mjs [--verbose]
//       node tools/check-save-shape.mjs --self-break   <- prove the check can go red
// Wired into tools/check-data.mjs, which .githooks/pre-commit already runs.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { saveActor, loadActor } from '../game/src/save/fight.js';
import { SoulsAI } from '../game/src/combat/ai.js';
import { EnemyController } from '../game/src/combat/enemy.js';

/**
 * Is `v` an instance of a class rather than a plain record? Deliberately a LOCAL COPY of
 * `save/fight.js liveObjectName()` and not an import of it: an instrument that imports its
 * definition of "broken" from the code under test cannot fail when that code is replaced by
 * an older one. This file must be runnable against any version of the save, including the
 * version that has the defect — that is the whole point of RULES 4, and importing the helper
 * turned the pre-fix run into a SyntaxError instead of a finding. Typed arrays are data.
 */
const liveObjectName = (v) => {
  if (v === null || typeof v !== 'object') return null;
  if (Array.isArray(v) || v instanceof Set || v instanceof Map || ArrayBuffer.isView(v)) return null;
  const p = Object.getPrototypeOf(v);
  if (p === Object.prototype || p === null) return null;
  return (p.constructor && p.constructor.name) || 'anonymous';
};

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const argv = process.argv.slice(2);
const VERBOSE = argv.includes('--verbose');
const SELF_BREAK = argv.includes('--self-break');

const failures = [];
const notes = [];
const fail = (m) => failures.push(m);
const note = (m) => { notes.push(m); if (VERBOSE) console.log(`  ${m}`); };

// ---------------------------------------------------------------------------------------
// THE INSTRUMENT: a census of what an object graph can DO, not of what it holds.
//
// Only live objects are recorded — a plain record has no behaviour to lose. The methods are
// read off the PROTOTYPE CHAIN (down to, and excluding, Object.prototype), because that is
// precisely what a structural clone destroys and what `Object.keys()` cannot see.
// ---------------------------------------------------------------------------------------
export function methodCensus(root, { maxDepth = 6, path = '$' } = {}) {
  const out = new Map();
  const seen = new Set();
  const walk = (v, p, depth) => {
    if (depth > maxDepth || v === null || typeof v !== 'object') return;
    if (seen.has(v)) return;
    seen.add(v);
    const ctor = liveObjectName(v);
    if (ctor) {
      const methods = new Set();
      for (let pr = Object.getPrototypeOf(v); pr && pr !== Object.prototype; pr = Object.getPrototypeOf(pr)) {
        for (const n of Object.getOwnPropertyNames(pr)) {
          if (n === 'constructor') continue;
          const d = Object.getOwnPropertyDescriptor(pr, n);
          if (d && typeof d.value === 'function') methods.add(n);
        }
      }
      out.set(p, { ctor, methods: [...methods].sort() });
    }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${p}[${i}]`, depth + 1)); return; }
    for (const k of Object.keys(v)) walk(v[k], `${p}.${k}`, depth + 1);
  };
  walk(root, path, 0);
  return out;
}

/** Every path that had methods before and does not have the same ones after. @returns string[] */
export function methodsLost(before, after) {
  const lost = [];
  for (const [p, b] of before) {
    const a = after.get(p);
    if (!a) { lost.push(`${p}: was a live ${b.ctor} with ${b.methods.length} method(s), came back a plain object`); continue; }
    if (a.ctor !== b.ctor) { lost.push(`${p}: was a ${b.ctor}, came back a ${a.ctor}`); continue; }
    const gone = b.methods.filter((m) => !a.methods.includes(m));
    if (gone.length) lost.push(`${p}: ${b.ctor} lost method(s) ${gone.join(', ')}`);
  }
  return lost;
}

const roundTrip = (o) => JSON.parse(JSON.stringify(o));

// =======================================================================================
// ARM A — the MECHANISM, on synthetic objects. Nothing here knows what a SoulsAI is.
// =======================================================================================
{
  class Declared {
    constructor() { this.handle = { huge: 'a shared data table nobody should copy' }; this.n = 1; this.clock = 0; }
    saveState(now) { return { n: this.n, clock: this.clock <= 0 ? this.clock : this.clock - now }; }
    loadState(rec, now) { this.n = rec.n; this.clock = rec.clock <= 0 ? rec.clock : rec.clock + now; return this; }
    act() { return 'acted'; }
  }
  class Undeclared {
    constructor() { this.n = 2; }
    act() { return 'also acted'; }
  }

  const mk = () => ({ id: 'A', side: 'enemy', plain: { a: 1, b: [1, 2, 3] }, num: 7, declared: new Declared(), undeclared: new Undeclared() });

  const live = mk();
  live.declared.n = 42; live.declared.clock = 1000;
  const before = methodCensus(live);
  const rec = roundTrip(saveActor(live, 990, null));

  // A1 — the declared instance is carried as an envelope, not walked.
  if (!rec.declared || rec.declared.__live !== 'Declared') fail(`A1: a class instance with saveState() was not carried as a {__live} envelope (got ${JSON.stringify(rec.declared)})`);
  else if (JSON.stringify(rec.declared.s) !== JSON.stringify({ n: 42, clock: 10 })) fail(`A1: the envelope did not carry saveState()'s output (got ${JSON.stringify(rec.declared.s)})`);
  else note('A1 ok — a declared live object is carried through its own saveState(), stamps rebased');

  // A2 — the undeclared instance is NOT serialised, and says so.
  if (rec.undeclared !== undefined) fail(`A2: a class instance with no saveState() was serialised anyway as ${JSON.stringify(rec.undeclared).slice(0, 80)} — that is the defect this file exists for`);
  else if (!Array.isArray(rec.__unsaved) || !rec.__unsaved.includes('undeclared:Undeclared')) fail(`A2: an undeclared live object was dropped SILENTLY — __unsaved is ${JSON.stringify(rec.__unsaved)}`);
  else note('A2 ok — a live object with no saveState() is refused and named in __unsaved');

  // A3 — the load never assigns a plain object over a live one, and plain fields still work.
  const fresh = mk();
  loadActor(fresh, rec, 0, {});
  const after = methodCensus(fresh);
  const lost = methodsLost(before, after);
  if (lost.length) fail(`A3: ${lost.length} live object(s) lost behaviour across the round trip:\n      ${lost.join('\n      ')}`);
  else note('A3 ok — every live object that had methods before the save has them after the load');
  // Saved on frame 990 with the clock at 1000 (10 frames to run), loaded onto frame 0: the
  // honest answer is 10, not 1000. A stamp that came back absolute would be a 1,000-frame
  // cooldown on a load — the same defect the body's FRAME_STAMP_FIELDS exist to prevent.
  if (fresh.declared.n !== 42 || fresh.declared.clock !== 10) fail(`A3: declared state did not come back (n=${fresh.declared.n}, clock=${fresh.declared.clock}, expected 42/10)`);
  if (fresh.num !== 7 || fresh.plain.b[2] !== 3) fail('A3: ordinary fields stopped round-tripping');
  if (typeof fresh.undeclared.act !== 'function') fail('A3: the undeclared live object was overwritten by a plain record on load');
}

// =======================================================================================
// ARM B — the REAL classes, against the shipped data. This is the defect itself.
// =======================================================================================
{
  const aiData = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/ai.json'), 'utf8'));
  const stat = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/enemies/guard_legion.json'), 'utf8'));
  const data = { ai: aiData };
  const body = (id) => ({ id, pos: [10, 0, 20], yaw: 0 });

  const SAVE_F = 4000, LOAD_F = 0;         // loadState() resets the frame to 0 (RI-MTH01 A07)
  const b0 = body('e1');
  const ctl = new EnemyController(b0, stat, data);
  if (ctl._resolveAI() !== 'souls') fail(`B0: guard_legion did not resolve to 'souls' — this arm is measuring nothing (got '${ctl.behaviour}')`);
  if (!(ctl.ai instanceof SoulsAI)) fail('B0: _resolveAI() did not build a SoulsAI — this arm is measuring nothing');

  // Dirty every kind of state, so a field the save drops is visible rather than coincidentally
  // equal to its default (RULES 8: the easiest fixture distinguishes nothing).
  ctl.ai.state = 'CIRCLE'; ctl.ai.prevState = 'APPROACH'; ctl.ai.stateF = 11;
  ctl.ai.stateEnteredF = SAVE_F - 11; ctl.ai.speed = 2.75; ctl.ai.strafeDir = -1;
  ctl.ai.strafeUntil = SAVE_F + 30; ctl.ai.radialSign = -1; ctl.ai.token = true;
  ctl.ai.tokenSinceF = SAVE_F - 40; ctl.ai.cooldownUntil = SAVE_F + 90; ctl.ai.feintUntil = 0;
  ctl.ai.noLosSinceF = -1; ctl.ai.lastCommitF = SAVE_F - 64; ctl.ai.commitIntervals = [70, 64, 81];
  ctl.ai.anchor = [11.5, 2.25, 33.75];
  ctl.alertState = 'AGGRO'; ctl.alert = 88;

  const before = methodCensus(ctl);
  if (!before.has('$.ai')) fail('B0: the census does not see ctl.ai as a live object — the instrument is blind');

  const rec = roundTrip(saveActor(ctl, SAVE_F, null));

  if (rec.__unsaved) fail(`B1: the controller holds live object(s) no save can carry: ${rec.__unsaved.join(', ')}`);
  else note('B1 ok — nothing on a live EnemyController is dropped for want of a saveState()');

  if (!rec.ai || rec.ai.__live !== 'SoulsAI') fail(`B2: ctl.ai was not carried as a live envelope (got ${JSON.stringify(rec.ai).slice(0, 120)})`);
  else {
    const s = rec.ai.s;
    for (const m of ['b', 'stat', 'cfg', 'A', 'omega', 'sightR', 'walk', 'sprint', 'leashHard']) {
      if (s[m] !== undefined) fail(`B2: machinery '${m}' is in the save — the whole data bundle is being copied into every enemy record`);
    }
    const bytes = JSON.stringify(rec.ai).length;
    if (bytes > 2000) fail(`B2: the AI record is ${bytes} bytes; before the repair it was 81,892 because it dragged the CombatBody and ai.json along`);
    else note(`B2 ok — the AI record is ${bytes} bytes and holds no machinery`);
  }

  const b1 = body('e1');
  const fresh = new EnemyController(b1, stat, data);
  loadActor(fresh, rec, LOAD_F, {});
  const after = methodCensus(fresh);

  const lost = methodsLost(before, after);
  if (lost.length) fail(`B3: ${lost.length} live object(s) lost behaviour across the round trip:\n      ${lost.join('\n      ')}`);
  else note('B3 ok — every live object on the restored controller still has its methods');

  if (!(fresh.ai instanceof SoulsAI)) fail(`B3: ctl.ai came back as ${liveObjectName(fresh.ai) || typeof fresh.ai}, not a SoulsAI — the next fixed step throws 'this.ai.step is not a function'`);
  else if (typeof fresh.ai.step !== 'function') fail('B3: the restored AI has no step()');

  if (fresh.ai) {
    const eq = (k, want) => { if (fresh.ai[k] !== want) fail(`B4: ai.${k} came back ${JSON.stringify(fresh.ai[k])}, expected ${JSON.stringify(want)}`); };
    eq('state', 'CIRCLE'); eq('prevState', 'APPROACH'); eq('stateF', 11);
    eq('speed', 2.75); eq('strafeDir', -1); eq('radialSign', -1); eq('token', true);
    // Stamps are rebased against the frame the load reset to, exactly as the body's are.
    eq('strafeUntil', LOAD_F + 30); eq('cooldownUntil', LOAD_F + 90); eq('stateEnteredF', LOAD_F - 11);
    eq('tokenSinceF', LOAD_F - 40); eq('lastCommitF', LOAD_F - 64);
    eq('feintUntil', 0);            // a sentinel <= 0 is "never" and must NOT become a date
    eq('noLosSinceF', -1);
    if (JSON.stringify(fresh.ai.commitIntervals) !== '[70,64,81]') fail(`B4: ai.commitIntervals came back ${JSON.stringify(fresh.ai.commitIntervals)} — RI-AI01 M4's cadence history`);
    if (JSON.stringify(fresh.ai.anchor) !== '[11.5,2.25,33.75]') fail(`B4: ai.anchor came back ${JSON.stringify(fresh.ai.anchor)} — the leash origin, re-anchored to wherever the body happened to be standing`);
    // MACHINERY must be the LIVE tables, by identity, not a restored copy of them.
    if (fresh.ai.cfg !== aiData) fail('B4: ai.cfg is not the live ai.json the rest of the fight reads — a save handed this enemy its own copy');
    if (fresh.ai.b !== b1) fail('B4: ai.b is not the freshly built body — the AI is steering an object nothing else can see');
    if (!failures.length || VERBOSE) note('B4 ok — behaviour, clocks (rebased), cadence history and leash anchor all restored; machinery is the live tables');
  }
  if (fresh.alertState !== 'AGGRO' || fresh.alert !== 88) fail('B5: ordinary controller fields stopped round-tripping');
}

// =======================================================================================
// ARM C — RULES 4 / 13: the check is worthless unless it has been seen to go red. This
// reproduces the PRE-FIX behaviour exactly — serialise the instance with the generic encoder,
// assign the plain object back — and requires the instrument to catch it.
// =======================================================================================
{
  const aiData = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/ai.json'), 'utf8'));
  const stat = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/enemies/guard_legion.json'), 'utf8'));
  const ctl = new EnemyController({ id: 'e1', pos: [0, 0, 0], yaw: 0 }, stat, { ai: aiData });
  ctl._resolveAI();
  const before = methodCensus(ctl);

  // What `saveActor` did before the repair, in one line.
  const asPlain = JSON.parse(JSON.stringify({ ai: ctl.ai }, (k, v) => (typeof v === 'function' ? null : v)));
  const broken = new EnemyController({ id: 'e1', pos: [0, 0, 0], yaw: 0 }, stat, { ai: aiData });
  broken._resolveAI();
  broken.ai = asPlain.ai;                       // <- the assignment loadActor used to make

  const lost = methodsLost(before, methodCensus(broken));
  if (!lost.length) fail('C: THE CHECK IS INERT. The pre-fix behaviour was reproduced and methodsLost() found nothing — every PASS this file has ever printed is worthless.');
  else if (!lost.some((l) => l.includes('$.ai'))) fail(`C: the check fired but not on $.ai: ${lost.join('; ')}`);
  else note(`C ok — reproducing the pre-fix behaviour makes this check red: ${lost[0]}`);
  if (typeof broken.ai.step === 'function') fail('C: the reproduction did not actually break anything — this arm is a second copy of the positive arm (RULES 6, an inert control)');
}

// =======================================================================================
if (SELF_BREAK) {
  // The falsifiability arm as a standalone verb, for anyone who wants to see it rather than
  // take arm C's word for it. Prints the census diff and exits 1 on purpose.
  console.log('check-save-shape --self-break: reproducing the pre-fix behaviour on the real classes.');
  const aiData = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/ai.json'), 'utf8'));
  const stat = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/enemies/guard_legion.json'), 'utf8'));
  const ctl = new EnemyController({ id: 'e1', pos: [0, 0, 0], yaw: 0 }, stat, { ai: aiData });
  ctl._resolveAI();
  const before = methodCensus(ctl);
  const broken = new EnemyController({ id: 'e1', pos: [0, 0, 0], yaw: 0 }, stat, { ai: aiData });
  broken._resolveAI();
  broken.ai = JSON.parse(JSON.stringify({ ai: ctl.ai }, (k, v) => (typeof v === 'function' ? null : v))).ai;
  for (const l of methodsLost(before, methodCensus(broken))) console.log(`  RED: ${l}`);
  console.log(`  and the next fixed step: typeof ctl.ai.step === '${typeof broken.ai.step}'`);
  process.exit(1);
}

if (failures.length) {
  console.error(`check-save-shape: FAIL — ${failures.length} problem(s).`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error('\nA live object that comes back from a save as a plain object does not fail at the load.');
  console.error('It fails on the NEXT FIXED STEP, in whatever probe happens to be running, with a');
  console.error('message about the caller rather than about the save — and boot-check stays green,');
  console.error('because boot does not step. Carry the object through its own saveState()/loadState()');
  console.error('(see SoulsAI and Rig), or do not carry it: never serialise the instance.');
  process.exit(1);
}
console.log(`check-save-shape: ${notes.length} assertion(s) pass — no live object loses its behaviour across a save.`);
