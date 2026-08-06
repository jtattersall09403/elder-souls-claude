// The search — RI-STL01 §7, behaviours S-1 through S-4.
//
// S-4 is the reason this file exists as more than a timer. The item says so itself:
// *"S-4 is the item's most important addition and the most likely to be cut, because it
// requires per-zone persistent state that nothing else in the game needs. Without it, a failed
// stealth attempt has no consequence beyond a reload, and stealth becomes save-scumming with
// extra steps."* So the zone memory is built first here, saved, and restored, and the search
// walk hangs off it rather than the other way round.
'use strict';

export const HZ = 60;

/** The whole per-zone memory. Serialised into the save under `crime.zones` (S6). */
export class ZoneMemory {
  constructor(data) {
    this.data = data;
    this.zones = new Map();       // zone -> {baseline, baselineUntilF, ctxUntilF, ctxMult, snuffed:[]}
  }

  get(zone) {
    let z = this.zones.get(zone);
    if (!z) { z = { baseline: 0, baselineUntilF: -1, ctxMult: 1.0, ctxUntilF: -1, searches: 0 }; this.zones.set(zone, z); }
    return z;
  }

  /**
   * S-4. A SEARCH that ended without acquisition raises the zone's baseline alert to 25 for
   * 180 s and multiplies civilian contextWeight by 1.4 for 20 in-game minutes. Both survive
   * leaving and re-entering the zone, and both survive death and save.
   */
  onSearchEnded(zone, frame, acquired) {
    const z = this.get(zone);
    z.searches++;
    if (acquired) return z;
    const s = this.data.search.s4;
    z.baseline = s.baseline_alert;
    z.baselineUntilF = frame + s.baseline_hold_s * HZ;
    z.ctxMult = s.context_multiplier;
    z.ctxUntilF = frame + Math.round(s.context_hold_ingame_min * s.ingame_minute_real_s * HZ);
    return z;
  }

  baselineAlert(zone, frame) {
    const z = this.get(zone);
    return frame < z.baselineUntilF ? z.baseline : 0;
  }

  contextMultiplier(zone, frame) {
    const z = this.get(zone);
    return frame < z.ctxUntilF ? z.ctxMult : 1.0;
  }

  toJSON() {
    const out = {};
    for (const [k, v] of this.zones) out[k] = { baseline: v.baseline, baseline_until_f: v.baselineUntilF, ctx_mult: v.ctxMult, ctx_until_f: v.ctxUntilF, searches: v.searches };
    return out;
  }

  fromJSON(obj) {
    this.zones.clear();
    for (const k of Object.keys(obj || {})) {
      const v = obj[k];
      this.zones.set(k, { baseline: v.baseline, baselineUntilF: v.baseline_until_f, ctxMult: v.ctx_mult, ctxUntilF: v.ctx_until_f, searches: v.searches || 0 });
    }
    return this;
  }
}

/**
 * One searcher. S-1 (LKP then the PLAUSIBLE set), S-2 (escalating radius), S-3 (one-hop
 * propagation), S-4 handled by ZoneMemory above.
 */
export class Search {
  constructor(data, { eid, lkp, startFrame, zone, coverVolumes, ownCone }) {
    const s = data.search;
    this.data = data;
    this.eid = eid;
    this.lkp = lkp;
    this.zone = zone;
    this.startFrame = startFrame;
    this.endFrame = startFrame + s.duration_s * HZ;
    this.acquired = false;
    // S-1: not random points — the volumes you could actually have REACHED from the LKP
    // without crossing the searcher's own cone, nearest first, capped at 3.
    this.plan = plausibleSet(data, lkp, coverVolumes, ownCone).slice(0, s.s1.max_cover_volumes);
    this.visited = [];
    this.legIndex = -1;                  // -1 = still walking to the LKP itself
    this.pos = null;
  }

  /** S-2: the search radius grows across the window, then leashes. */
  radiusAt(frame) {
    const s = this.data.search.s2;
    const t = (frame - this.startFrame) / (this.endFrame - this.startFrame);
    for (let i = s.bands.length - 1; i >= 0; i--) if (t >= s.bands[i].from) return s.bands[i].radius_m;
    return s.bands[0].radius_m;
  }

  /** The point the searcher is walking toward on this frame. */
  targetAt(frame) {
    if (frame < this.startFrame + this.data.search.s1.lkp_dwell_s * HZ) return this.lkp;
    const i = Math.min(this.plan.length - 1, Math.floor((frame - this.startFrame - this.data.search.s1.lkp_dwell_s * HZ) / (this.data.search.s1.per_volume_s * HZ)));
    if (i < 0 || !this.plan.length) return this.lkp;
    if (this.legIndex !== i) { this.legIndex = i; this.visited.push(this.plan[i].id); }
    return this.plan[i].pos;
  }

  get over() { return this.acquired || this._ended; }
  end(frame) { this._ended = true; this.endedAt = frame; return { acquired: this.acquired, visited: this.visited.slice() }; }
}

/**
 * S-1's "plausible set": cover volumes within `radius` of the LKP that are reachable from the
 * LKP WITHOUT crossing the searcher's own sight cone. Deterministic and independently
 * recomputable, which is what RI-STL01 method 6 asks a critic to do from the nav mesh.
 */
export function plausibleSet(data, lkp, coverVolumes, ownCone) {
  const s = data.search.s1;
  const out = [];
  for (const v of coverVolumes) {
    const d = dist2(lkp, v.pos);
    if (d > s.radius_m) continue;
    if (ownCone && crossesCone(lkp, v.pos, ownCone)) continue;
    out.push({ id: v.id, pos: v.pos, dist: d });
  }
  out.sort((a, b) => (a.dist - b.dist) || (a.id < b.id ? -1 : 1));
  return out;
}

/** S-3: one hop, bounded, never chains. */
export function propagate(data, searcherPos, allies) {
  const s = data.search.s3;
  const raised = [];
  for (const a of allies) {
    if (dist2(searcherPos, a.pos) > s.radius_m) continue;
    if (a.alert >= s.raise_to) continue;
    a.alert = s.raise_to;
    a.alertHop = 1;                    // marks the hop; a second hop is refused below
    raised.push(a.eid);
  }
  return raised;
}

export function mayPropagate(entity) { return !entity.alertHop; }

function dist2(a, b) { const dx = a[0] - b[0], dz = a[2] - b[2]; return Math.sqrt(dx * dx + dz * dz); }

/** Does the straight line a->b pass through the searcher's cone wedge? */
function crossesCone(a, b, cone) {
  const steps = 8;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const p = [a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t];
    const dx = p[0] - cone.pos[0], dz = p[2] - cone.pos[2];
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > cone.radius_m) continue;
    let ang = Math.atan2(dx, dz) * 180 / Math.PI - cone.yaw;
    ang = ((ang % 360) + 540) % 360 - 180;
    if (Math.abs(ang) <= cone.half_deg) return true;
  }
  return false;
}
