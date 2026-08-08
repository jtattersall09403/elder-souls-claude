// Light — RI-STL01 §3, and the failure mode the item calls "overwhelmingly the likeliest".
//
//   "Light is never implemented ... because L requires sampling the lighting solution at a
//    world point every frame and Three.js gives you nothing for free here — there is no
//    built-in 'how lit is this point'. A builder will discover this, estimate the cost, and
//    ship sound-and-cone stealth 'for now'."
//
// So the lighting solution is not Three.js's. It is a small analytic field owned by the
// simulation: a per-zone ambient plus an inverse-square sum over placed sources, evaluated in
// the fixed step. The renderer is told to match it; the sim never asks the renderer anything.
// getLightAt(x,y,z) is the harness instrument that makes DARK-COVERAGE measurable without a
// screenshot, and it reads THIS function.
'use strict';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const CORE_M2 = 0.35;      // the inverse-square core, so a source is never singular

export class LightField {
  constructor(data) {
    this.data = data;
    this.sources = [];            // {id, x, y, z, intensity, snuffable, lit, relight_at_f, zone}
    this.ambientByZone = new Map();
    this.defaultAmbient = 0.04;   // unlit interior / xanmeer depth
    this._byKey = new Map();
    for (const row of data.light_table_L) this._byKey.set(row.key, row.L);
  }

  /** The named conditions of RI-STL01 §3's table, for scenarios that want one by name. */
  ambientFor(key) {
    const v = this._byKey.get(key);
    if (v === undefined) throw new Error(`ambientFor: unknown light condition ${JSON.stringify(key)}; expected ${[...this._byKey.keys()].join('|')}`);
    return v;
  }

  setZoneAmbient(zone, keyOrValue) {
    this.ambientByZone.set(zone, typeof keyOrValue === 'number' ? keyOrValue : this.ambientFor(keyOrValue));
  }

  addSource(src) {
    if (this.sources.some((s) => s.id === src.id)) throw new Error(`addSource: duplicate light id ${JSON.stringify(src.id)}`);
    const s = {
      id: src.id, x: src.pos[0], y: src.pos[1], z: src.pos[2],
      intensity: src.intensity, snuffable: !!src.snuffable, lit: src.lit !== false,
      relightAtF: -1, zone: src.zone || null,
      // W1-15 r3. A source the WORLD put here (an authored interior lamp, mirrored from the
      // same `interiors/*.json` record `render/interior.js` draws) rather than one a scenario
      // hand-placed through `addLightSource()`. The distinction exists so the cell switch can
      // take the last room's lamps away without touching a probe's fixture, and so a critic
      // reading `getStealthState().lights` can tell the world's answer from a hand-fed one —
      // RI-MTH07 §C3's hand-feed audit, applied to light.
      world: !!src.world,
      kind: src.kind || null,
      authoredIntensity: src.authored_intensity === undefined ? null : src.authored_intensity,
      // How far this flame's influence extends, squared. RI-STL01 §3's table has three interior
      // rows and its last one is "4-9 m from a flame"; past 9 m the item's own answer is the
      // `unlit` row, so 9 m is where a flame stops counting and it is the ITEM's number, not a
      // fitted one. Unbounded by default, so every source a scenario placed before this existed
      // behaves exactly as it did.
      reach2: src.reach_m === undefined || src.reach_m === null ? Infinity : src.reach_m * src.reach_m,
    };
    this.sources.push(s);
    return s;
  }

  /** Drop every source the world put here, leaving scenario-placed sources alone. */
  clearWorld() {
    let n = 0;
    for (let i = this.sources.length - 1; i >= 0; i--) if (this.sources[i].world) { this.sources.splice(i, 1); n++; }
    return n;
  }

  clear() { this.sources.length = 0; this.ambientByZone.clear(); }

  /** RI-STL01 §3's L at a world point. Deterministic, no clock, no RNG, no renderer. */
  sample(x, y, z, zone) {
    let L = zone !== undefined && this.ambientByZone.has(zone) ? this.ambientByZone.get(zone) : this.defaultAmbient;
    for (let i = 0; i < this.sources.length; i++) {
      const s = this.sources[i];
      if (!s.lit) continue;
      if (zone !== undefined && s.zone !== null && s.zone !== zone) continue;
      const dx = x - s.x, dy = y - s.y, dz = z - s.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > s.reach2) continue;
      L += s.intensity / (CORE_M2 + d2);
    }
    return clamp01(L);
  }

  /** RI-STL01 §3: a carried torch floors L at 0.80 and is an 18 m alert source in its own right. */
  withTorch(L, carryingTorch) {
    return carryingTorch ? Math.max(L, this.data.torch.carried_torch_floor_L) : L;
  }

  /**
   * §3 requirement 2. "Stealth in which you can only use the dark you were given is a much
   * smaller game than stealth in which you can make it."
   */
  snuff(id, frame, durationFrames) {
    const s = this.sources.find((x) => x.id === id);
    if (!s) throw new Error(`snuff: no light source ${JSON.stringify(id)}`);
    if (!s.snuffable) return { ok: false, reason: 'not snuffable' };
    s.lit = false;
    s.relightAtF = frame + durationFrames;
    return { ok: true, id, relight_at_f: s.relightAtF };
  }

  /** Relight anything whose timer has expired. Called once per fixed step. */
  step(frame) {
    let relit = 0;
    for (let i = 0; i < this.sources.length; i++) {
      const s = this.sources[i];
      if (!s.lit && s.relightAtF >= 0 && frame >= s.relightAtF) { s.lit = true; s.relightAtF = -1; relit++; }
    }
    return relit;
  }

  /** Forced relight — what an NPC does on finding a snuffed lamp (RI-STL01 S-4). */
  relightAll(zone) {
    let n = 0;
    for (const s of this.sources) {
      if (zone !== undefined && s.zone !== zone) continue;
      if (!s.lit) { s.lit = true; s.relightAtF = -1; n++; }
    }
    return n;
  }

  /** DARK-COVERAGE: the share of a sampled walkable rectangle at or below `threshold`. */
  darkCoverage(bounds, zone, threshold = 0.10, step = 1.0) {
    let dark = 0, total = 0;
    for (let x = bounds.x[0]; x <= bounds.x[1]; x += step) {
      for (let z = bounds.z[0]; z <= bounds.z[1]; z += step) {
        total++;
        if (this.sample(x, 1.2, z, zone) <= threshold) dark++;
      }
    }
    return { dark, total, share: total ? dark / total : 0, threshold };
  }

  snuffableShare() {
    if (!this.sources.length) return { snuffable: 0, total: 0, share: 0 };
    const n = this.sources.filter((s) => s.snuffable).length;
    return { snuffable: n, total: this.sources.length, share: n / this.sources.length };
  }
}
