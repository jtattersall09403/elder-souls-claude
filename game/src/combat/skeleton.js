// The animated skeleton, and the hurtboxes and weapon sockets derived from it.
//
// This is RI-CMB04 §A steps 4 and 6, and they are in that order for a reason the item states
// plainly: **hurtboxes are derived from the animated pose, every frame, AFTER the animation
// has been evaluated. A hurtbox that is a static capsule at the character's root is not a
// hurtbox.** Reusing the movement controller's capsule instead is RI-CMB04 "How we lose" #5,
// and rebuilding hurtboxes BEFORE evaluating the skeleton is #6 — a one-frame lag, which is
// invisible in a still and is 0.43 m of sword at 26 m/s.
//
// The pose comes from clips.js; nothing here knows what a move is.
//
// ALLOCATION: a Rig is built once per actor and mutated in place. `evaluate()` allocates
// nothing.
'use strict';

const DEG = Math.PI / 180;

/**
 * A 3x4 transform stored as [m00..m22, tx,ty,tz] — rotation in row-major 3x3 followed by
 * translation. Quaternions would be nicer for slerp; the sweep slerps SOCKET POSITIONS, not
 * bone rotations, so the matrix form is sufficient and is cheaper per frame.
 */
function makeXform() { return new Float64Array(12); }

function xformIdentity(m) {
  m[0] = 1; m[1] = 0; m[2] = 0;
  m[3] = 0; m[4] = 1; m[5] = 0;
  m[6] = 0; m[7] = 0; m[8] = 1;
  m[9] = 0; m[10] = 0; m[11] = 0;
  return m;
}

/** out = parent * (translate(offset) * rotateXYZ(rx,ry,rz)). Euler order X then Y then Z. */
function xformCompose(out, parent, offset, rx, ry, rz) {
  const cx = Math.cos(rx * DEG), sx = Math.sin(rx * DEG);
  const cy = Math.cos(ry * DEG), sy = Math.sin(ry * DEG);
  const cz = Math.cos(rz * DEG), sz = Math.sin(rz * DEG);
  // R = Rx * Ry * Rz
  const r00 = cy * cz;
  const r01 = -cy * sz;
  const r02 = sy;
  const r10 = sx * sy * cz + cx * sz;
  const r11 = -sx * sy * sz + cx * cz;
  const r12 = -sx * cy;
  const r20 = -cx * sy * cz + sx * sz;
  const r21 = cx * sy * sz + sx * cz;
  const r22 = cx * cy;
  // local translation is the rest offset, applied in the PARENT's frame
  const lx = offset[0], ly = offset[1], lz = offset[2];
  const p00 = parent[0], p01 = parent[1], p02 = parent[2];
  const p10 = parent[3], p11 = parent[4], p12 = parent[5];
  const p20 = parent[6], p21 = parent[7], p22 = parent[8];
  out[0] = p00 * r00 + p01 * r10 + p02 * r20;
  out[1] = p00 * r01 + p01 * r11 + p02 * r21;
  out[2] = p00 * r02 + p01 * r12 + p02 * r22;
  out[3] = p10 * r00 + p11 * r10 + p12 * r20;
  out[4] = p10 * r01 + p11 * r11 + p12 * r21;
  out[5] = p10 * r02 + p11 * r12 + p12 * r22;
  out[6] = p20 * r00 + p21 * r10 + p22 * r20;
  out[7] = p20 * r01 + p21 * r11 + p22 * r21;
  out[8] = p20 * r02 + p21 * r12 + p22 * r22;
  out[9] = parent[9] + p00 * lx + p01 * ly + p02 * lz;
  out[10] = parent[10] + p10 * lx + p11 * ly + p12 * lz;
  out[11] = parent[11] + p20 * lx + p21 * ly + p22 * lz;
}

/** out = m * v (direction only, no translation). */
function xformDir(out, m, v) {
  const x = v[0], y = v[1], z = v[2];
  out[0] = m[0] * x + m[1] * y + m[2] * z;
  out[1] = m[3] * x + m[4] * y + m[5] * z;
  out[2] = m[6] * x + m[7] * y + m[8] * z;
  return out;
}

export class Rig {
  /**
   * @param {object} skeletonData game/data/combat/skeleton.json
   * @param {object} hitGeometry  game/data/combat/hitgeometry.json
   */
  constructor(skeletonData, hitGeometry) {
    this.def = skeletonData;
    this.bones = skeletonData.bones;
    this.index = new Map();
    this.parentIdx = new Int32Array(this.bones.length);
    this.offsets = [];
    this.world = [];
    for (let i = 0; i < this.bones.length; i++) {
      const b = this.bones[i];
      this.index.set(b.id, i);
      this.offsets.push(b.offset);
      this.world.push(makeXform());
    }
    for (let i = 0; i < this.bones.length; i++) {
      const p = this.bones[i].parent;
      this.parentIdx[i] = p === null ? -1 : this.index.get(p);
      if (this.parentIdx[i] >= i && p !== null) {
        throw new Error(`skeleton.json: bone '${this.bones[i].id}' is declared before its parent '${p}'. ` +
          'Bones must be in topological order so evaluate() is a single forward pass.');
      }
    }
    // Per-bone Euler, written by the clip sampler each frame.
    this.rx = new Float64Array(this.bones.length);
    this.ry = new Float64Array(this.bones.length);
    this.rz = new Float64Array(this.bones.length);

    // clips.json §cross_fade. `fromR*` is the pose the actor was ACTUALLY in when the
    // transition happened; `lastR*` is last frame's final (post-blend) pose, which is what
    // `fromR*` is captured from. Both are allocated once — the fixed step allocates nothing.
    this.fromRx = new Float64Array(this.bones.length);
    this.fromRy = new Float64Array(this.bones.length);
    this.fromRz = new Float64Array(this.bones.length);
    this.lastRx = new Float64Array(this.bones.length);
    this.lastRy = new Float64Array(this.bones.length);
    this.lastRz = new Float64Array(this.bones.length);
    this.blendLeft = 0;
    this.blendLen = 0;
    this._hasLastPose = false;

    // Hurtboxes, built once, positions rewritten each frame (RI-CMB04 §D).
    this.hurtboxes = hitGeometry.hurtboxes.parts.map((part) => ({
      id: part.id,
      parent_bone: part.parent_bone,
      boneIdx: this.index.get(part.parent_bone),
      r: part.radius_m,
      length: part.length_m,
      axis: skeletonData.hurtbox_axes[part.id],
      damage_mult: part.damage_mult,
      a: [0, 0, 0],
      b: [0, 0, 0],
      // Previous frame's world pose of the same capsule. The weapon sockets have been
      // double-buffered since W1-09 shipped because the weapon sweeps; seam ruling S26 makes
      // the BODY sweep too, so the body needs the same two poses for the same reason.
      pa: [0, 0, 0],
      pb: [0, 0, 0],
    }));
    this._hasPrevHurt = false;
    for (const h of this.hurtboxes) {
      if (h.boneIdx === undefined) {
        throw new Error(`hitgeometry.json hurtbox '${h.id}' names parent bone '${h.parent_bone}', which skeleton.json does not declare.`);
      }
      if (!h.axis) throw new Error(`skeleton.json hurtbox_axes is missing '${h.id}'.`);
    }

    // S26's body hazard capsule: the actor's COLLISION capsule, positioned on the animated
    // trunk. Same volume as §bodies uses to push, so a push can never happen without the hit
    // that caused it (hitgeometry.json §body_hazard._why_that_capsule_and_that_radius).
    const bh = hitGeometry.body_hazard;
    if (bh && bh.capsule) {
      const fi = this.index.get(bh.capsule.from_bone);
      const ti = this.index.get(bh.capsule.to_bone);
      if (fi === undefined || ti === undefined) {
        throw new Error(`hitgeometry.json body_hazard.capsule names bones '${bh.capsule.from_bone}'/'${bh.capsule.to_bone}', ` +
          'which skeleton.json does not both declare. S26 requires the root translation to be covered; ' +
          'a capsule between bones that do not exist covers nothing.');
      }
      this.bodyCap = { fromIdx: fi, toIdx: ti, a: [0, 0, 0], b: [0, 0, 0], pa: [0, 0, 0], pb: [0, 0, 0] };
      this.bodyHazardPart = bh.struck_part || 'torso_upper';
    } else {
      this.bodyCap = null;
      this.bodyHazardPart = null;
    }

    this.gripIdx = this.index.get(skeletonData.weapon.grip_bone);
    this.chestIdx = this.index.get(skeletonData.chest_node);
    this.bladeAxis = skeletonData.weapon.blade_axis_local;

    // Weapon socket world positions, rewritten each frame.
    this.socketA = [0, 0, 0];
    this.socketB = [0, 0, 0];
    this._dir = [0, 0, 0];
    this._root = makeXform();
  }

  boneWorld(id) { return this.world[this.index.get(id)]; }

  bonePos(id, out) {
    const m = this.world[this.index.get(id)];
    out[0] = m[9]; out[1] = m[10]; out[2] = m[11];
    return out;
  }

  /** Chest node world position — RI-CMB06's LOS ray, aim point and framing target. */
  chestPos(out) {
    const m = this.world[this.chestIdx];
    out[0] = m[9]; out[1] = m[10]; out[2] = m[11];
    return out;
  }

  /**
   * RI-CMB04 §A step 4, then step 6.
   *
   * @param {number[]} pos    actor world position (feet)
   * @param {number} yawDeg   actor world yaw
   * @param {number} rootDy   the clip's vertical root offset for this frame, metres
   * @param {number} socketADist distance from the grip hand to socket A, along the blade axis
   * @param {number} socketBDist distance from the grip hand to socket B
   */
  evaluate(pos, yawDeg, rootDy, socketADist, socketBDist) {
    // Actor transform: yaw about +Y, so local +Z is the facing direction.
    const c = Math.cos(yawDeg * DEG), s = Math.sin(yawDeg * DEG);
    const m = this._root;
    m[0] = c; m[1] = 0; m[2] = s;
    m[3] = 0; m[4] = 1; m[5] = 0;
    m[6] = -s; m[7] = 0; m[8] = c;
    m[9] = pos[0]; m[10] = pos[1] + rootDy; m[11] = pos[2];

    // Step 4 — one forward pass, parents before children.
    for (let i = 0; i < this.world.length; i++) {
      const p = this.parentIdx[i];
      xformCompose(this.world[i], p < 0 ? m : this.world[p], this.offsets[i], this.rx[i], this.ry[i], this.rz[i]);
    }

    // Step 6 — every hurtbox capsule transformed from its parent bone. The capsule runs from
    // the bone ORIGIN along the declared local axis, so the capsule's segment IS a segment of
    // the bone and RI-CMB04 M1's "capsule midpoint to parent bone origin" is invariantly
    // length/2 in every pose. It cannot drift, because there is nothing for it to drift from.
    for (let k = 0; k < this.hurtboxes.length; k++) {
      const h = this.hurtboxes[k];
      const bm = this.world[h.boneIdx];
      // Roll this capsule's world pose into `pa`/`pb` BEFORE overwriting it — the same
      // discipline CombatBody.evaluateRig() applies to the weapon sockets, and for the same
      // reason: S26's body hazard is a sweep between two poses, not a test at one.
      h.pa[0] = h.a[0]; h.pa[1] = h.a[1]; h.pa[2] = h.a[2];
      h.pb[0] = h.b[0]; h.pb[1] = h.b[1]; h.pb[2] = h.b[2];
      h.a[0] = bm[9]; h.a[1] = bm[10]; h.a[2] = bm[11];
      xformDir(this._dir, bm, h.axis);
      h.b[0] = h.a[0] + this._dir[0] * h.length;
      h.b[1] = h.a[1] + this._dir[1] * h.length;
      h.b[2] = h.a[2] + this._dir[2] * h.length;
    }

    // Weapon sockets — RI-CMB04 §B. The capsule is between two sockets on the weapon mesh,
    // and the weapon is rigidly parented to the grip hand, so the sockets are a rigid offset
    // in the hand's world frame. A weapon whose hitbox does not move when the hand moves is
    // not a weapon.
    if (this.bodyCap) {
      const c = this.bodyCap;
      c.pa[0] = c.a[0]; c.pa[1] = c.a[1]; c.pa[2] = c.a[2];
      c.pb[0] = c.b[0]; c.pb[1] = c.b[1]; c.pb[2] = c.b[2];
      const fm = this.world[c.fromIdx], tm = this.world[c.toIdx];
      c.a[0] = fm[9]; c.a[1] = fm[10]; c.a[2] = fm[11];
      c.b[0] = tm[9]; c.b[1] = tm[10]; c.b[2] = tm[11];
    }

    // First evaluation of this rig: there is no previous pose, so `prev` IS `now`. A zero-length
    // sweep is exactly right — the actor has not moved yet.
    if (!this._hasPrevHurt) {
      for (let k = 0; k < this.hurtboxes.length; k++) {
        const h = this.hurtboxes[k];
        h.pa[0] = h.a[0]; h.pa[1] = h.a[1]; h.pa[2] = h.a[2];
        h.pb[0] = h.b[0]; h.pb[1] = h.b[1]; h.pb[2] = h.b[2];
      }
      if (this.bodyCap) {
        const c = this.bodyCap;
        c.pa[0] = c.a[0]; c.pa[1] = c.a[1]; c.pa[2] = c.a[2];
        c.pb[0] = c.b[0]; c.pb[1] = c.b[1]; c.pb[2] = c.b[2];
      }
      this._hasPrevHurt = true;
    }

    const hm = this.world[this.gripIdx];
    xformDir(this._dir, hm, this.bladeAxis);
    this.socketA[0] = hm[9] + this._dir[0] * socketADist;
    this.socketA[1] = hm[10] + this._dir[1] * socketADist;
    this.socketA[2] = hm[11] + this._dir[2] * socketADist;
    this.socketB[0] = hm[9] + this._dir[0] * socketBDist;
    this.socketB[1] = hm[10] + this._dir[1] * socketBDist;
    this.socketB[2] = hm[11] + this._dir[2] * socketBDist;
  }

  /**
   * clips.json §cross_fade. Start blending FROM the pose the actor is currently holding —
   * captured before this frame's clip overwrote it — over `frames` frames.
   */
  beginCrossFade(frames) {
    if (!this._hasLastPose || frames <= 0) return;
    this.fromRx.set(this.lastRx);
    this.fromRy.set(this.lastRy);
    this.fromRz.set(this.lastRz);
    this.blendLen = frames;
    this.blendLeft = frames;
  }

  /**
   * Mix this frame's freshly-sampled pose with the outgoing one and record the result as the
   * pose the actor is now holding. Called once per frame, after the clip has been applied and
   * BEFORE `evaluate()`, so every downstream consumer — bones, hurtboxes, weapon sockets, the
   * sweep — sees the same single blended pose.
   */
  applyCrossFade() {
    if (this.blendLeft > 0) {
      // weight on the OUTGOING pose: 1 on the frame before the transition, 0 when the blend ends
      const u = this.blendLeft / (this.blendLen + 1);
      const w = u * u * (3 - 2 * u);
      for (let i = 0; i < this.rx.length; i++) {
        this.rx[i] += (this.fromRx[i] - this.rx[i]) * w;
        this.ry[i] += (this.fromRy[i] - this.ry[i]) * w;
        this.rz[i] += (this.fromRz[i] - this.rz[i]) * w;
      }
      this.blendLeft--;
    }
    this.lastRx.set(this.rx);
    this.lastRy.set(this.ry);
    this.lastRz.set(this.rz);
    this._hasLastPose = true;
  }

  /** Zero every joint — the rest pose. */
  clearPose() {
    this.rx.fill(0); this.ry.fill(0); this.rz.fill(0);
  }

  /**
   * The debug channel RI-CMB04's comparison method requires: "a debug channel that dumps, per
   * frame, every hitbox and hurtbox as {id, parent_bone, a[3], b[3], r} in world space. If
   * that channel does not exist, this item scores 0 — the geometry is unauditable and
   * therefore not a bar." It is a deliverable, not a nicety (How we lose #11).
   */
  dumpHurtboxes(out) {
    out.length = 0;
    for (let k = 0; k < this.hurtboxes.length; k++) {
      const h = this.hurtboxes[k];
      out.push({
        id: h.id, parent_bone: h.parent_bone,
        a: [r4(h.a[0]), r4(h.a[1]), r4(h.a[2])],
        b: [r4(h.b[0]), r4(h.b[1]), r4(h.b[2])],
        r: h.r, damage_mult: h.damage_mult,
      });
    }
    return out;
  }

  dumpBones(out) {
    out.length = 0;
    for (let i = 0; i < this.world.length; i++) {
      const m = this.world[i];
      out.push({ id: this.bones[i].id, o: [r4(m[9]), r4(m[10]), r4(m[11])] });
    }
    return out;
  }
}

function r4(v) { return Math.round(v * 1e4) / 1e4; }
