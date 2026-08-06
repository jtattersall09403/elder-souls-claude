// The ONLY source of randomness in the simulation.
// Spec: corpus/80-methods/HARNESS.md §8 D1/D2, RI-MTH02 §C.
//
// One PRNG instance, reseeded by __HARNESS.setSeed(). Its full state (4×uint32 + a draw
// counter) is part of the save blob (RI-JRN05 §B "RNG"), because a load that resets the
// draw counter is a determinism break that only shows up 600 frames later.
'use strict';

/** splitmix32 — used only to expand a single seed integer into 128 bits of state. */
function splitmix32(a) {
  return function () {
    a |= 0; a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return ((t = t ^ (t >>> 15)) >>> 0);
  };
}

/**
 * sfc32 — small, fast, 128-bit state, no floating point in the state, restores exactly.
 * Chosen over mulberry32 because a 32-bit state makes "different seed, same stream after
 * a few draws" possible; RI-MTH02 R4 needs seeds to diverge and stay diverged.
 */
export class Rng {
  constructor(seed = 1337) { this.reseed(seed); }

  reseed(seed) {
    this.seed = seed >>> 0;
    const sm = splitmix32(this.seed);
    this.a = sm(); this.b = sm(); this.c = sm(); this.d = sm();
    this.draws = 0;
    // Discard a short warm-up so low seeds do not start correlated.
    for (let i = 0; i < 12; i++) this._raw();
    this.draws = 0;
    return this.seed;
  }

  _raw() {
    let a = this.a, b = this.b, c = this.c, d = this.d;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ (b >>> 9);
    b = c + (c << 3) | 0;
    c = (c << 21) | (c >>> 11);
    c = c + t | 0;
    this.a = a; this.b = b; this.c = c; this.d = d;
    return t >>> 0;
  }

  /** Uniform float in [0,1). Counted. */
  next() { this.draws++; return this._raw() / 4294967296; }

  /** Integer in [0,n). Counted (one draw). */
  int(n) { return (this.next() * n) | 0; }

  /** Float in [lo,hi). Counted. */
  range(lo, hi) { return lo + this.next() * (hi - lo); }

  /** Serialise the whole stream position. Restores byte-exactly. */
  saveRngState() { return { seed: this.seed, a: this.a, b: this.b, c: this.c, d: this.d, draws: this.draws }; }

  loadRngState(s) {
    this.seed = s.seed >>> 0;
    this.a = s.a >>> 0; this.b = s.b >>> 0; this.c = s.c >>> 0; this.d = s.d >>> 0;
    this.draws = s.draws | 0;
    return this;
  }
}

/** The single global instance. Nothing in `sim/` may construct its own. */
export const rng = new Rng(1337);
