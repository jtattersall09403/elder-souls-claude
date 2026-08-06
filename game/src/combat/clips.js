// Animation clips: normalised phase curves, instantiated at each move's declared frame counts.
//
// Two properties this file exists to guarantee, both of them things RI-CMB01 M3 and
// RI-CMB02 M3 test for directly:
//
//  1. **Root motion is authoritative.** The controller consumes the clip's root delta for
//     the frame. It never adds `velocity * dt` of its own. The 5.20 m of a LIGHT roll and the
//     1.90 m of an ultra greatsword R2 are properties of the CURVE, and nothing else moves the
//     character during those animations.
//  2. **The speed curve is not constant.** `smoothstep` between keys makes the per-frame delta
//     a curve rather than a ramp, so a roll LUNGES rather than sliding. RI-CMB01 M3 fails a
//     constant per-frame delta explicitly, because "a constant per-frame delta is a translate,
//     not root motion".
//
// Phase: 0 = frame 1, 1 = last startup frame, 2 = last active frame (or last i-frame for a
// roll), 3 = last frame. See clips.json §phase_parameterisation.
'use strict';

function smoothstep(t) { return t * t * (3 - 2 * t); }

/** Sample a key list [[phase, value], ...] at `p`, smoothstep between keys, clamped outside. */
export function sampleCurve(keys, p) {
  const n = keys.length;
  if (n === 0) return 0;
  if (p <= keys[0][0]) return keys[0][1];
  if (p >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (i < n - 2 && keys[i + 1][0] < p) i++;
  const a = keys[i], b = keys[i + 1];
  const span = b[0] - a[0];
  if (span <= 0) return b[1];
  return a[1] + (b[1] - a[1]) * smoothstep((p - a[0]) / span);
}

/**
 * An instantiated clip: an archetype bound to one move's frame counts.
 *
 * `phaseAt(animFrame)` is the whole binding. For an attack of startup S, active A and total T,
 * frame f maps to phase:
 *     f <= S            -> (f-1)/S
 *     S < f <= S+A      -> 1 + (f-S-1)/A
 *     otherwise         -> 2 + (f-S-A-1)/(T-S-A)
 */
export class Clip {
  /**
   * @param {string} id
   * @param {object} archetype an entry from clips.json §archetypes
   * @param {object} timing {startup, active, total} in f@60 — active is the ACTIVE window for
   *   an attack and the I-FRAME window for a roll (clips.json anchors_roll)
   * @param {number} amplitude scalar on every rotation track
   * @param {number} rootForwardM total forward displacement, metres (may be negative: backstep)
   */
  constructor(id, archetype, timing, amplitude, rootForwardM) {
    this.id = id;
    this.arch = archetype;
    this.startup = timing.startup | 0;
    this.active = timing.active | 0;
    this.total = timing.total | 0;
    this.tail = Math.max(1, this.total - this.startup - this.active);
    this.amplitude = amplitude === undefined ? 1 : amplitude;
    this.rootForwardM = rootForwardM || 0;
    this.tracks = archetype.tracks || {};
    this.rootCurve = archetype.root_forward || [[0, 0], [3, 0]];
    this.rootOffsetY = (archetype.root_offset && archetype.root_offset.y) || [[0, 0], [3, 0]];
  }

  phaseAt(f) {
    if (this.startup > 0 && f <= this.startup) return (f - 1) / this.startup;
    if (this.active > 0 && f <= this.startup + this.active) {
      return 1 + (f - this.startup - 1) / this.active;
    }
    const k = f - this.startup - this.active - 1;
    return 2 + Math.min(1, Math.max(0, k / this.tail));
  }

  /** Cumulative forward displacement, in metres, at the END of animation frame `f`. */
  rootForwardAt(f) {
    if (f <= 0) return 0;
    return this.rootForwardM * sampleCurve(this.rootCurve, this.phaseAt(f));
  }

  /** The per-frame root delta the controller consumes. RI-CMB01 §C.5 / RI-CMB02 §D.3. */
  rootDeltaAt(f) { return this.rootForwardAt(f) - this.rootForwardAt(f - 1); }

  rootOffsetYAt(f) { return sampleCurve(this.rootOffsetY, this.phaseAt(f)); }

  /** Write this frame's pose into a Rig's Euler arrays. Allocation-free. */
  applyPose(rig, f) {
    rig.clearPose();
    const p = this.phaseAt(f);
    const A = this.amplitude;
    for (const boneId in this.tracks) {
      const idx = rig.index.get(boneId);
      if (idx === undefined) continue;
      const t = this.tracks[boneId];
      if (t.rx) rig.rx[idx] = sampleCurve(t.rx, p) * A;
      if (t.ry) rig.ry[idx] = sampleCurve(t.ry, p) * A;
      if (t.rz) rig.rz[idx] = sampleCurve(t.rz, p) * A;
    }
  }
}

/**
 * A looping clip (idle, walk, run, block hold). Phase runs 0..3 over `period` frames and
 * wraps, so hurtboxes keep moving while the character stands, walks and guards — the case
 * RI-CMB04 M1 fails a build for ("FAIL if the set of hurtbox transforms is identical across
 * two visually different poses").
 */
export class LoopClip {
  constructor(id, archetype, period) {
    this.id = id;
    this.arch = archetype;
    this.period = Math.max(1, period | 0);
    this.tracks = archetype.tracks || {};
    this.rootOffsetY = (archetype.root_offset && archetype.root_offset.y) || [[0, 0], [3, 0]];
  }
  phaseAt(f) { return 3 * ((f % this.period) / this.period); }
  rootOffsetYAt(f) { return sampleCurve(this.rootOffsetY, this.phaseAt(f)); }
  rootDeltaAt() { return 0; }
  applyPose(rig, f) {
    rig.clearPose();
    const p = this.phaseAt(f);
    for (const boneId in this.tracks) {
      const idx = rig.index.get(boneId);
      if (idx === undefined) continue;
      const t = this.tracks[boneId];
      if (t.rx) rig.rx[idx] = sampleCurve(t.rx, p);
      if (t.ry) rig.ry[idx] = sampleCurve(t.ry, p);
      if (t.rz) rig.rz[idx] = sampleCurve(t.rz, p);
    }
  }
}

/**
 * Additive stance layer: applied ON TOP of a locomotion loop so a walking character still
 * holds its weapon, and a blocking character still shifts its weight. Purely a pose blend —
 * it never touches timing, displacement or a hitbox.
 */
export function addPose(rig, archetype, phase, weight) {
  const tracks = archetype.tracks || {};
  for (const boneId in tracks) {
    const idx = rig.index.get(boneId);
    if (idx === undefined) continue;
    const t = tracks[boneId];
    if (t.rx) rig.rx[idx] += sampleCurve(t.rx, phase) * weight;
    if (t.ry) rig.ry[idx] += sampleCurve(t.ry, phase) * weight;
    if (t.rz) rig.rz[idx] += sampleCurve(t.rz, phase) * weight;
  }
}
