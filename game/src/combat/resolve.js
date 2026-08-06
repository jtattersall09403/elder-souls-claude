// Steps 8 and 9 of RI-CMB04 §A: sweep + query, then resolve.
//
// The invariant this file is written to satisfy, quoted from RI-CMB04 §E:
//
//   For a fixed input script and a fixed initial state, the set of (frame, attacker, target,
//   hurtbox, damage) tuples produced by a run is BIT-IDENTICAL across every RNG seed and every
//   run. No call to any random source occurs on the hit-resolution path.
//
// There is no `rng` import in this file and there is nothing to import one for. Iteration is
// over arrays in a fixed order (bodies in id order, hurtboxes in declaration order, substeps
// ascending), so even the ORDER of the emitted tuples is a function of the state alone.
'use strict';

import { sweepCapsuleVsCapsule, sweptAABB, aabbVsCapsule, bearingDeg, angleDelta } from './geometry.js';
import { computeDamage, applyPoiseDamage, resolveBlock, inHyperArmour } from './rules.js';

const _min = [0, 0, 0], _max = [0, 0, 0];
const _bmin = [0, 0, 0], _bmax = [0, 0, 0];

/**
 * @param {CombatBody[]} bodies in stable id order
 * @param {object} C  {stamina, poise, hitgeometry}
 * @param {number} frame
 * @param {function} emit (kind) -> event object to fill
 * @param {object} sim for hitstop
 */
export function sweepAndResolve(bodies, C, frame, emit, sim) {
  const SUBSTEPS = C.hitgeometry.sweep.substeps;
  const PAD = 0.05;
  const CONE = C.hitgeometry.resolution_order ? 60 : 60;

  for (let ai = 0; ai < bodies.length; ai++) {
    const A = bodies[ai];
    if (!A.hitboxActive || !A.move) continue;
    const r = A.move.hitbox_radius_m;
    sweptAABB(A.prevA, A.prevB, A.socketA, A.socketB, r, PAD, _min, _max);

    for (let bi = 0; bi < bodies.length; bi++) {
      const B = bodies[bi];
      if (B === A || B.dead || B.yielded) continue;
      if (B.side === A.side) continue;                        // no friendly fire in wave 1
      if (A.hitThisSwing.has(B.id)) continue;                 // §E rule 3, de-dup

      // ---- (0) parry, before the sweep -------------------------------------------------
      // A parry catches the SWING, not the blade: it fires on the attacker's first active
      // frame if the defender's declared parry window is open, the attacker is in front and
      // in range. RI-CMB05 §D. Unparryable attacks are declared per-move in the statblock.
      if (B.move && B.move.kind === 'parry' && !A.move.unparryable) {
        const pf = B.animFrame;
        const w = B.move.parry_window;
        if (pf >= w[0] && pf <= w[1]) {
          const dx = A.pos[0] - B.pos[0], dz = A.pos[2] - B.pos[2];
          const d = Math.hypot(dx, dz);
          const front = Math.abs(angleDelta(B.yaw, bearingDeg(dx, dz)));
          if (d <= (A.move.reach_m_declared || 2.5) + 0.6 && front <= 70) {
            A.hitThisSwing.add(B.id);
            const frames = C.poise.criticals.parry.parried_state.frames;
            // The attack's id is read BEFORE the reaction is queued: queueParried() clears
            // `A.move`, exactly as beginParried() used to, and the emit below used to read
            // `A.move.id` afterwards. It survived until a probe parried something.
            const atkId = A.move.id;
            A.queueParried(frames, frame);
            const e = emit(frame, 'PARRY');
            e.src = B.id; e.who = A.id; e.atk = atkId; e.parry_frame = pf;
            e.window = w; e.frames = frames;
            e.riposte_window = C.poise.criticals.parry.parried_state.riposte_window;
            sim.hitstopUntil = frame + 10;
            continue;
          }
        }
      }

      // ---- step 8: sweep -------------------------------------------------------------
      let bestSub = -1, bestHb = null, bestVia = null;
      for (let hi = 0; hi < B.rig.hurtboxes.length; hi++) {
        const H = B.rig.hurtboxes[hi];
        if (!aabbVsCapsule(_min, _max, H.a, H.b, H.r)) continue;   // broadphase
        const s = sweepCapsuleVsCapsule(A.prevA, A.prevB, A.socketA, A.socketB, r, H.a, H.b, H.r, SUBSTEPS);
        if (s < 0) continue;
        // earliest substep wins; on a tie the higher damage_mult wins (§D.3)
        if (bestSub < 0 || s < bestSub || (s === bestSub && H.damage_mult > bestHb.damage_mult)) {
          bestSub = s; bestHb = H;
        }
      }

      // ---- step 8b: S26's body hazard -------------------------------------------------
      // "An attack's swept volume MUST cover the whole of the attacker's root translation
      // during its active frames." The weapon sweep above covers where the BLADE went. This
      // covers where the ATTACKER went. It exists only on frames where the root actually
      // moved, so an attack with no root motion has no body hazard at all and this can never
      // degenerate into a proximity test (hitgeometry.json §body_hazard.not_a_distance_check).
      if (A.lastRootDelta !== 0 && A.rig.bodyCap && B.rig.bodyCap) {
        const T = A.rig.bodyCap, U = B.rig.bodyCap;
        const tr = A.bodyRadius, ur = B.bodyRadius;
        sweptAABB(T.pa, T.pb, T.a, T.b, tr, PAD, _bmin, _bmax);
        if (aabbVsCapsule(_bmin, _bmax, U.a, U.b, ur)) {
          const s = sweepCapsuleVsCapsule(T.pa, T.pb, T.a, T.b, tr, U.a, U.b, ur, SUBSTEPS);
          // The weapon wins ties: a swing that connects is a swing, not a shoulder-check.
          if (s >= 0 && (bestSub < 0 || s < bestSub)) {
            bestSub = s;
            bestHb = B.rig.hurtboxes.find((h) => h.id === B.rig.bodyHazardPart) || B.rig.hurtboxes[0];
            bestVia = 'body';
          }
        }
      }
      if (bestSub < 0) continue;

      // ---- step 9: resolve, in order, stopping at the first that applies --------------
      A.hitThisSwing.add(B.id);
      const t = (bestSub + 0.5) / SUBSTEPS;

      // (1) i-frames. The overlap WAS detected — the hurtbox still exists and was still swept
      // (RI-CMB01 §C.2) — and that is what lets the trace prove the dodge was TIMED and not
      // SPATIAL. This event firing on the same frame as the attacker's hitbox_active is the
      // single line RI-CMB07 §B says the whole trace format exists to make provable.
      if (B.iframe) {
        const e = emit(frame, 'IFRAME_NEGATE');
        e.src = A.id; e.dst = B.id; e.atk = A.move.id; e.swing = A.swingSeq;
        e.pstate = B.state; e.part = bestHb.id; e.substep = bestSub; e.t = round3(t);
        e.via = bestVia || 'weapon';
        continue;
      }

      // Seam S19's consuming system for `shield`, `resist_element`, `resist_disease`, `sap_ward`
      // and `corrode`. RI-MAG06 §B: a resist is judged by the damage number from an identical
      // scripted hit, with and without — so the mitigation has to be HERE, in the one place a
      // damage number is computed, and not in a field only the buff itself reads. Wave 1 had a
      // row in `effects_active` and a 100-damage hit that stayed 100 either way.
      const dmgBase = mitigate(B, computeDamage(A.move.motion_value || 1, A.moves._weapon.attack_rating, bestHb.damage_mult, 0));

      // (2) block: a 60-degree half-cone from the defender's forward
      const incoming = bearingDeg(A.pos[0] - B.pos[0], A.pos[2] - B.pos[2]);
      if (B.guardRaised && B.shield && Math.abs(angleDelta(B.yaw, incoming)) <= CONE && !A.move.unblockable) {
        const res = resolveBlock(B, dmgBase, B.shield);
        B.stamina = res.stamina_after;
        B.regenBlockUntil = frame + C.stamina.regen.delay_frames_after_any_spend;
        B.hp -= res.chip;
        const e = emit(frame, 'BLOCK');
        e.src = A.id; e.dst = B.id; e.atk = A.move.id;
        e.stam_cost = round1(res.stamina_cost); e.chip = Math.round(res.chip);
        e.stam_left = round1(res.stamina_after); e.guard_break = res.guard_broken; e.via = bestVia || 'weapon';
        if (res.guard_broken) {
          B.guardRaised = false;
          B.stamina = 0;
          const gbm = B.moves._guardBreak;
          B.move = null;
          B.queueReaction(gbm, frame);
          const g = emit(frame, 'GUARD_BREAK');
          g.who = B.id; g.frames = gbm.total; g.cause = 'stamina_exhausted_on_block';
          g.riposte_window = gbm.riposte_window;
        }
        // RI-WPN04 §B and RI-WPN06 §E both ask for a `BLOCK_SUCCESS` event distinct from `BLOCK`,
        // and RI-WPN04's harness request 4 is explicit: "`guard.counter` is unmeasurable without
        // it." A block that BREAKS the guard is not a success — you are open, not ahead — so the
        // event fires only on the branch that kept the shield up. `open_until_f` is the 40 f@60
        // window RI-WPN01 §A slot 16 / RI-WPN04 §B give the guard counter.
        if (!res.guard_broken) {
          B.blockSuccessFrame = frame;
          B.blockSuccessShield = B.shieldId || null;
          const bs = emit(frame, 'BLOCK_SUCCESS');
          bs.src = A.id; bs.dst = B.id; bs.atk = A.move.id;
          bs.blocked_attack = A.move.slot || A.move.id;
          bs.shield = B.shieldId || null; bs.shield_class = B.shield && B.shield.class;
          bs.stam_left = round1(res.stamina_after);
          bs.guard_counter_open_f = 40;
          bs.block_angle_deg = round1(angleDelta(B.yaw, incoming));
        }
        if (B.hp <= 0) killed(B, A, frame, emit);
        sim.hitstopUntil = frame + (A.move.hitstop_frames || 0);
        continue;
      }

      // (4) poise
      const ha = inHyperArmour(B.move, B.animFrame);
      const pr = applyPoiseDamage(B, A.move.poise_damage || 0, C.poise, { frame, hyperArmour: ha, exhausted: B.exhausted });

      // (5) damage
      B.hp -= dmgBase;
      const e = emit(frame, 'HIT');
      e.src = A.id; e.dst = B.id; e.wpn = A.move.id; e.dmg = Math.round(dmgBase);
      e.pd = A.move.poise_damage || 0; e.part = bestHb.id; e.substep = bestSub; e.t = round3(t);
      // S26: `weapon` if the blade connected, otherwise the attacker's own trunk capsule that
      // ran the target down. A critic reading the trace can separate the two without guessing.
      e.via = bestVia || 'weapon';
      e.hp_after = Math.round(Math.max(0, B.hp)); e.hyperarmour = pr.hyperarmour;
      e.poise_after = round1(Math.max(0, B.poiseHealth));

      if (pr.staggered && !B.dead) {
        // RI-CMB05 §B: a target ALREADY staggered takes damage but the timer does NOT restart.
        // This is what prevents infinite stunlock and it is a rule, not an optimisation.
        if (frame >= B.staggerUntil && !B.pendingReaction) {
          const sm = B.moves._stagger[pr.tier];
          B.queueReaction(sm, frame);
          B.poiseHealth = B.poiseHealthMax;   // reset on the frame the stagger ENDS is handled there
          const s = emit(frame, 'STAGGER');
          s.who = B.id; s.frames = sm.total; s.tier = pr.tier; s.cause = 'poise_broken';
          s.knockdown = !!sm.knockdown;
        }
      }
      if (B.hp <= 0) killed(B, A, frame, emit);
      sim.hitstopUntil = frame + (A.move.hitstop_frames || 0);
    }
  }

  // WHIFF: an attack whose active window has just closed with nothing recorded.
  for (let i = 0; i < bodies.length; i++) {
    const A = bodies[i];
    if (!A.move || !A.move.hitbox) continue;
    if (A.animFrame !== A.move.startup + A.move.active) continue;
    if (A.hitThisSwing.size > 0) continue;
    const e = emit(frame, 'WHIFF');
    e.src = A.id; e.wpn = A.move.id; e.reason = 'no_geometric_overlap'; e.swing = A.swingSeq;
  }
}

/**
 * Apply the magic mitigation terms a body is carrying. Exactly one multiplier and one flat
 * armour subtraction, both defaulting to the identity, so a build with no magic in it computes
 * the same number it computed before this function existed.
 *
 * `wardCharges` is `sap_ward`: it eats a whole blow rather than scaling it, and it is spent.
 */
export function mitigate(B, dmg) {
  if (B.wardCharges > 0) { B.wardCharges--; return 0; }
  const m = B.mitigation === undefined ? 1 : B.mitigation;
  const armour = B.armourRating || 0;
  if (m === 1 && armour === 0) return dmg;
  return Math.max(dmg > 0 ? 1 : 0, dmg * m - armour);
}

function killed(B, A, frame, emit) {
  B.hp = 0;
  B.dead = true;
  B.move = null;
  B.state = 'DEAD';
  B.animFrame = 0;
  B.iframe = false;
  B.hitboxActive = false;
  const e = emit(frame, 'DEATH');
  e.who = B.id; e.by = A ? A.id : null;
}

function round1(v) { return Math.round(v * 10) / 10; }
function round3(v) { return Math.round(v * 1000) / 1000; }

/**
 * The positional critical tests — RI-CMB05 §D. Geometry plus state, no chance component.
 * Returns 'backstab' | 'riposte' | null.
 */
export function criticalAvailable(attacker, target, C, frame) {
  const crit = C.poise.criticals;
  // riposte first: a parried or guard-broken target is riposte-able from the front
  if (target.parriedUntil > frame) {
    const k = frame - target.parriedStart + 1;
    const w = crit.parry.parried_state.riposte_window;
    if (k >= w[0] && k <= w[1] && withinReach(attacker, target, crit.backstab.max_distance_m)) return 'riposte';
  }
  if (target.guardBreakUntil > frame) {
    const k = frame - target.guardBreakStart + 1;
    const w = crit.riposte.available_on.GUARD_BREAK;
    if (k >= w[0] && k <= w[1] && withinReach(attacker, target, crit.backstab.max_distance_m)) return 'riposte';
  }
  // backstab: inside the target's rear arc, close enough, and facing it
  const bs = crit.backstab;
  if (target.iframe || target.beingCritted || target.dead) return null;
  if (inHyperArmour(target.move, target.animFrame)) return null;
  if (!withinReach(attacker, target, bs.max_distance_m)) return null;
  const toAttacker = bearingDeg(attacker.pos[0] - target.pos[0], attacker.pos[2] - target.pos[2]);
  const rearAxis = (target.yaw + 180) % 360;
  if (Math.abs(angleDelta(rearAxis, toAttacker)) > bs.rear_arc_deg) return null;
  const toTarget = bearingDeg(target.pos[0] - attacker.pos[0], target.pos[2] - attacker.pos[2]);
  if (Math.abs(angleDelta(attacker.yaw, toTarget)) > bs.attacker_facing_deg) return null;
  return 'backstab';
}

function withinReach(a, b, maxM) {
  const dx = a.pos[0] - b.pos[0], dz = a.pos[2] - b.pos[2];
  return Math.sqrt(dx * dx + dz * dz) <= maxM;
}
