// Runtime determinism guards — HARNESS.md §8 D1/D2/D3, RI-MTH02 §C.
//
// A convention ("don't call Math.random in the sim") is not enforceable and this project
// cannot afford one that is not. So the ban is a *runtime trap*, armed for exactly the
// duration of one fixed simulation step:
//
//   armSim() ── stepOnce() ── disarmSim()
//                  ▲
//                  └── Math.random(), Date.now(), performance.now(), new Date()
//                      all THROW here, and the throw propagates out of stepFrames(),
//                      out of the harness call, and out of the tool as exit 12.
//
// Outside the armed window these are legal: the render path, the save path, perf
// instrumentation and Three.js's own UUID generation all need them, and none of them can
// reach a traced value.
//
// Three.js calls Math.random() when it mints object UUIDs. Banning it globally would make
// the renderer throw on construction, so instead, in harness mode, Math.random is replaced
// by a *separate seeded stream*: cosmetic randomness becomes deterministic too (which makes
// UUID-ordered iteration reproducible) without hiding a simulation violation.
//
// A static counterpart lives in tools/harness/lint-determinism.mjs, which greps the shipped
// sources. Per RI-MTH02 M8 the static pass is advisory; this file is the one that bites.
'use strict';

let armed = false;
let installed = false;
export const violations = [];

function violate(what) {
  const msg =
    `DETERMINISM VIOLATION: ${what} was called inside a fixed simulation step. ` +
    'HARNESS.md §8 D1–D3 forbid unseeded randomness and wall-clock reads in the sim path; ' +
    'use rng.next() and frame/60 instead.';
  violations.push({ what, stack: new Error(msg).stack });
  throw new Error(msg);
}

export function armSim() { armed = true; }
export function disarmSim() { armed = false; }
export function isArmed() { return armed; }

/**
 * @param {object} opts
 * @param {boolean} opts.replaceMathRandom  true in harness mode: cosmetic randomness
 *        becomes a seeded stream so the *whole page* is reproducible, not just the sim.
 * @param {number} opts.cosmeticSeed
 */
export function installGuards(opts = {}) {
  if (installed) return;
  installed = true;

  const realRandom = Math.random;
  if (opts.replaceMathRandom) {
    // A dedicated stream. Never used by the simulation — the sim uses core/rng.js.
    let a = (opts.cosmeticSeed >>> 0) || 0x9e3779b9;
    Math.random = function random() {
      if (armed) violate('Math.random()');
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  } else {
    Math.random = function random() { if (armed) violate('Math.random()'); return realRandom(); };
  }

  const realDateNow = Date.now.bind(Date);
  Date.now = function now() { if (armed) violate('Date.now()'); return realDateNow(); };

  if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
    const realPerfNow = performance.now.bind(performance);
    // performance.now is non-writable on some engines; define it instead of assigning.
    try {
      Object.defineProperty(performance, 'now', {
        configurable: true,
        writable: true,
        value: function now() { if (armed) violate('performance.now()'); return realPerfNow(); },
      });
    } catch { /* read-only: the static lint still covers it */ }
    installGuards._realPerfNow = realPerfNow;
  }

  const RealDate = Date;
  try {
    globalThis.Date = new Proxy(RealDate, {
      construct(target, args, newTarget) {
        if (armed && args.length === 0) violate('new Date()');
        return Reflect.construct(target, args, newTarget);
      },
    });
  } catch { /* proxying Date failed: the static lint still covers it */ }
}

/** Unguarded wall clock for the *non-sim* paths that legitimately need one. */
export const wallNow = () =>
  (installGuards._realPerfNow ? installGuards._realPerfNow() : 0);
