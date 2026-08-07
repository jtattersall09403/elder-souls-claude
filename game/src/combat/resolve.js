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

import { sweepCapsuleVsCapsule, sweptAABB, aabbVsCapsule, bearingDeg, angleDelta, segSegParamOnA } from './geometry.js';
import { computeDamage, applyPoiseDamage, resolveBlock, inHyperArmour } from './rules.js';
import { resolveImpact, materialAt } from './impact.js';

const _min = [0, 0, 0], _max = [0, 0, 0];
const _bmin = [0, 0, 0], _bmax = [0, 0, 0];

/**
 * S26's body corridor prices ITSELF — `hitgeometry.json` §body_hazard.damage, verbatim:
 *
 *   "a flat base plus a term in the attacker's own root speed, in hit points, with the weapon
 *    appearing only as a CEILING"  →  min(base_hp + per_mps × speed, max_hp,
 *                                        hard_cap_fraction_of_weapon × weapon_damage)
 *
 * ARBITRATION S26 as AMENDED wave 1 (BAR-CRITIQUE-W1-09-R1 §R6), enforced by RI-CMB04 M8.4: a
 * `via: "body"` hit's damage must be **strictly less** than the same attack's `via: "weapon"`
 * damage. Round 3 shipped the corridor paying the blade's number — 96 damage whether the
 * greatsword cut at 3.65 m or the champion's chest arrived at 0.05 m — and a reach you are paid
 * the same for ignoring is not a reach.
 *
 * A motion value would have multiplied the WEAPON's attack rating, so a champion's shoulder
 * would bruise harder than a caster's because of the sword in its hand; being run over is a
 * property of mass and closing speed, not of cutlery. The final clamp is what makes M8.4's
 * strict inequality a property of this function rather than of the tuning: no future edit to
 * `per_mps` can turn a shove back into a sword.
 *
 * `speedMps` is `|root delta this frame| × 60` (`CombatBody.advance`) — the same scalar
 * §body_hazard.not_a_distance_check gates the corridor's existence on, so a corridor that fires
 * always has a closing speed and an attack that does not translate is never priced at all.
 *
 * NOTE: like `advanceAlong` in `system.js`, this function was referenced and never defined — the
 * other half of the unfinished edit banked at `6e359ab` after a container restart. Any fight in
 * which a lunging attacker's trunk corridor reached a target before its blade did threw
 * `ReferenceError: bodyDamage is not defined` out of `CombatSystem.step`, which in the browser
 * kills the frame loop. Both halves are restored together because either one alone still kills
 * the same fight.
 */
function bodyDamage(A, dmgWeapon, C) {
  const cfg = (C.hitgeometry.body_hazard && C.hitgeometry.body_hazard.damage) || {};
  const base = cfg.base_hp === undefined ? 8 : cfg.base_hp;
  const per = cfg.per_mps === undefined ? 4 : cfg.per_mps;
  const max = cfg.max_hp === undefined ? 40 : cfg.max_hp;
  const frac = cfg.hard_cap_fraction_of_weapon === undefined ? 0.5 : cfg.hard_cap_fraction_of_weapon;
  const speed = Math.abs(A.speedMps || 0);
  return Math.min(base + per * speed, max, frac * dmgWeapon);
}

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
    if (A.hitstop) continue;                  // a frozen blade resolves nothing (RI-WPN05 §A)
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

            // A SUCCESSFUL PARRY RELEASES THE PARRIER. RI-CMB05 M7 is the riposte, and the
            // round-2 verdict measured `riposted: false, damage: 0` in all seven parry cases
            // while the parry itself was frame-perfect. The reason was arithmetic, not input:
            // a medium shield's parry animation is 80 f@60, the PARRIED state is 56 f, and the
            // riposte window inside it is f7-f52. A parrier still committed to its own parry
            // recovery is actionable at parry-frame 80, by which time the window has closed at
            // 52. The payoff was unreachable for every shield class whose animation outlasts
            // the state it creates — which is all of them.
            //
            // So the parry's recovery ends when the parry CONNECTS. That is the Souls
            // behaviour (the deflect snaps into the critical) and it is also the only reading
            // under which §D's window is a window rather than a decoration. A WHIFFED parry
            // still pays its full `whiff_recovery_f`; nothing here shortens that, and the
            // punish for a mistimed parry is untouched.
            B.endMove();
            B.actionableAt = frame;

            const e = emit(frame, 'PARRY');
            e.src = B.id; e.who = A.id; e.atk = atkId; e.parry_frame = pf;
            e.window = w; e.frames = frames;
            e.parrier_released = true;
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

      // ---- (1b) WHAT DID IT HIT — RI-WPN05 §A/§B, resolved here and nowhere else -----------
      // The material is a property of the STRUCK REGION, not of the body: a Hist-Marked champion
      // is plant at the trunk and metal where it wears a cuirass, and a player learns to aim.
      // Everything downstream — the damage multiplier, both hitstop clocks, the knockback sign,
      // the deflect, the decal and the shake — comes out of `impact.js` reading
      // `game/data/weapons/classes.json` on THIS frame. Perturb any cell and this fight changes.
      const incoming = bearingDeg(A.pos[0] - B.pos[0], A.pos[2] - B.pos[2]);
      const blocking = B.guardRaised && B.shield && Math.abs(angleDelta(B.yaw, incoming)) <= CONE && !A.move.unblockable;
      // A raised shield IS a material — it is the `shield` column of §A, and it is the reason
      // that column exists. This is also the join that makes the block branch legible: a mace
      // into a shield and a mace into a face are different feedback, not the same number twice.
      const material = blocking ? 'shield' : materialAt(B, bestHb.id);
      const imp = resolveImpact(C.weaponClasses, A.move, material);

      // ---- (1b2) WHERE ON THE WEAPON — S26's contiguity law, paid for honestly --------------
      // The hit capsule now runs grip-to-tip so the reachable band has no interior hole. The
      // design fact `hitbox_span_m` was written for — an axe is edged only at its head — is
      // kept as a damage taper: a contact inboard of `edge_from_m` is the haft, not the edge,
      // and deals `haft_damage_mult` of the blow. Geometry still decides ENTIRELY whether the
      // hit happened (ARBITRATION S1); this only scales what it was worth.
      let haft = 1;
      if (A.move.edge_from_m !== undefined && A.move.haft_damage_mult !== undefined && !bestVia) {
        const s = segSegParamOnA(A.socketA, A.socketB, bestHb.a, bestHb.b);
        const a0 = A.move.socket_a_dist_m, b0 = A.move.socket_b_dist_m;
        const contact = a0 + s * (b0 - a0);
        if (contact < A.move.edge_from_m) haft = A.move.haft_damage_mult;
      }

      // Seam S19's consuming system for `shield`, `resist_element`, `resist_disease`, `sap_ward`
      // and `corrode`. RI-MAG06 §B: a resist is judged by the damage number from an identical
      // scripted hit, with and without — so the mitigation has to be HERE, in the one place a
      // damage number is computed, and not in a field only the buff itself reads. Wave 1 had a
      // row in `effects_active` and a 100-damage hit that stayed 100 either way.
      //
      // `imp.multiplier` is RI-WPN05 §B's (damage type x material) cell and it lands BEFORE
      // mitigation, because it is a property of the blade meeting the surface and mitigation is
      // a property of the buffs the victim is carrying.
      //
      // S26 AS AMENDED wave 1 (BAR-CRITIQUE-W1-09-R1 §R6, enforced by RI-CMB04 M8.4): **the
      // corridor is a hazard, not a weapon.** Round 3 shipped a body check that paid the blade's
      // number — 96 damage whether the greatsword cut at 3.65 m or the champion's chest arrived
      // at 0.05 m — and that makes reach cosmetic, which is RI-CMB02 "How we lose" #10 arriving
      // through a door nobody was watching. A `via: "body"` hit is priced from the attacker's own
      // closing speed in hit points, never from its attack rating, and is then clamped strictly
      // below what the same attack's blade would have done.
      const dmgWeapon = computeDamage(A.move.motion_value || 1, A.moves._weapon.attack_rating, bestHb.damage_mult, 0) * imp.multiplier * haft;
      const dmgBase = mitigate(B, bestVia === 'body' ? bodyDamage(A, dmgWeapon, C) : dmgWeapon);
      // The corridor's poise damage is its own too, and below every declared attack's, so being
      // shoulder-charged staggers a light build and does not stagger a heavy one.
      const bhz = (C.hitgeometry.body_hazard && C.hitgeometry.body_hazard.damage) || null;
      const poiseDmg = (bestVia === 'body' && bhz) ? (bhz.poise_damage || 0) : (A.move.poise_damage || 0);

      // ---- (1c) deflection — §A. A non-blunt blade on stone under 30 poise damage BOUNCES ----
      // Zero damage, no victim reaction at all, the attacker eats a x1.5 hitstop and +16 f@60 of
      // recovery. Deterministic: shape, poise damage and material, no dice (ARBITRATION S1).
      // This is the mechanical reason MCE and GHM exist, and until now it existed only in a
      // function the harness called.
      if (imp.deflect && !blocking) {
        applyKnockback(A, B, imp.knockback_m);
        A.deflectExtraRecoveryF = (A.deflectExtraRecoveryF || 0) + imp.added_recovery_f;
        if (A.move) A.move_deflect_recovery_f = imp.added_recovery_f;
        A.recoveryExtraF = (A.recoveryExtraF || 0) + imp.added_recovery_f;
        const e = emit(frame, 'DEFLECT');
        e.src = A.id; e.dst = B.id; e.atk = A.move.id; e.part = bestHb.id;
        e.material = material; e.tier = imp.tier; e.shape = A.move.shape || null;
        e.poise_damage = A.move.poise_damage || 0;
        e.hitstop_f = imp.attacker_hitstop_f; e.added_recovery_f = imp.added_recovery_f;
        e.knockback_m = imp.knockback_m; e.decal = imp.decal; e.via = bestVia || 'weapon';
        emitImpact(emit, frame, A, B, imp, bestHb, bestVia, 0);
        applyHitstop(sim, A, B, frame, imp);
        continue;
      }

      // (2) block: a 60-degree half-cone from the defender's forward
      if (blocking) {
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
        // A blocked blow reads off the `shield` column of §A: the biggest attacker hitstop in
        // the grid after stone, and a knockback that pushes the ATTACKER back rather than the
        // shield. That is what makes a turtle feel like a wall instead of like a soft target.
        applyKnockback(A, B, imp.knockback_m);
        emitImpact(emit, frame, A, B, imp, bestHb, bestVia, Math.round(res.chip));
        applyHitstop(sim, A, B, frame, imp);
        continue;
      }

      // (4) poise
      const ha = inHyperArmour(B.move, B.animFrame);
      const pr = applyPoiseDamage(B, poiseDmg, C.poise, { frame, hyperArmour: ha, exhausted: B.exhausted });

      // (5) damage
      B.hp -= dmgBase;
      const e = emit(frame, 'HIT');
      e.src = A.id; e.dst = B.id; e.wpn = A.move.id; e.dmg = Math.round(dmgBase);
      e.pd = poiseDmg; e.part = bestHb.id; e.substep = bestSub; e.t = round3(t);
      // RI-CMB04 M8.4's attribution table is computed from these two side by side: what the
      // corridor charged, and what the blade would have charged for the same attack.
      if (bestVia === 'body') e.dmg_if_weapon = Math.round(dmgWeapon);
      // S26: `weapon` if the blade connected, otherwise the attacker's own trunk capsule that
      // ran the target down. A critic reading the trace can separate the two without guessing.
      e.via = bestVia || 'weapon';
      e.hp_after = Math.round(Math.max(0, B.hp)); e.hyperarmour = pr.hyperarmour;
      e.poise_after = round1(Math.max(0, B.poiseHealth));
      // The HIT event carries the material too, so a reader that only knows the RI-CMB07
      // vocabulary still sees what was struck without having to join two streams.
      e.material = imp.material; e.material_mult = imp.multiplier; e.damage_type = imp.damage_type;
      e.haft_mult = haft;

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
      // Knockback BEFORE hitstop, so the displacement is on the frame of contact and the freeze
      // is what the player watches it in. §A's sign convention: positive pushes the victim along
      // the attack's forward axis; negative pushes the ATTACKER back and leaves the victim where
      // it stood — "the target does not move. You do."
      applyKnockback(A, B, imp.knockback_m);
      emitImpact(emit, frame, A, B, imp, bestHb, bestVia, Math.round(dmgBase));
      applyHitstop(sim, A, B, frame, imp);
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
 * RI-WPN05 §C's `impact` event — the one the item asks for by name and by shape:
 *   {"f":221,"type":"impact","material":"chitin","tier":"heavy","hitstop_f":8,
 *    "knockback_m":0.25,"deflect":false,"decal":"chip"}
 *
 * It exists because "the existing `hit` event carries no material and no feedback data", which
 * made every material check in the item unmeasurable off a trace. Emitted on EVERY resolved
 * contact — hit, block and deflect alike — so the 5x7 grid is recoverable from traces rather
 * than from a function a probe called.
 */
function emitImpact(emit, frame, A, B, imp, hb, via, dmg) {
  const e = emit(frame, 'IMPACT');
  e.src = A.id; e.dst = B.id; e.atk = A.move.id; e.slot = A.move.slot || A.move.id;
  e.material = imp.material; e.impact_row = imp.impact_row; e.tier = imp.tier;
  e.damage_type = imp.damage_type; e.material_mult = imp.multiplier;
  e.hitstop_f = imp.attacker_hitstop_f; e.victim_hitstop_f = imp.victim_hitstop_f;
  e.knockback_m = imp.knockback_m; e.deflect = imp.deflect;
  e.added_recovery_f = imp.added_recovery_f;
  e.decal = imp.decal; e.shake_deg = imp.shake_deg;
  e.part = hb ? hb.id : null; e.via = via || 'weapon'; e.dmg = dmg;
  return e;
}

/**
 * RI-WPN05 §A's TWO clocks.
 *
 * `sim.hitstopUntil` is the WORLD's hold — the camera and the fixed step's other systems — and
 * it takes the longer of the two. Each participant then holds on its OWN clock, and the
 * difference between them is the whole of §A's asymmetry table:
 *
 *   flesh, wood                 victim = attacker + 4   the target flinches harder than you do
 *   chitin                      victim = attacker + 2
 *   stone / metal / shield      victim = 0              "The target does not move. You do."
 *
 * A single global freeze cannot express that, and a single global freeze is exactly why the
 * stone row has been indistinguishable from the flesh row in every trace this piece has
 * produced. The asymmetry IS the bounce.
 */
function applyHitstop(sim, A, B, frame, imp) {
  // `hitstopUntil` is the first frame that RUNS AGAIN, and the `+ 1` is what makes that true.
  // The hit resolves at the END of step F (sweep and resolve are steps 8 and 9), so F itself has
  // already advanced its animation clock; the hold is F+1 … F+N. With `frame + N` the hold ran
  // F+1 … F+N-1 and every impact in the build was ONE FRAME SHORT of its declared hitstop —
  // "hitstop_f 4 held for 3 frames" in the round-2 verdict, which is a defect against
  // RI-WPN05 M1's ±0 f tolerance rather than a reporting artefact. Found by driving the census.
  const a = imp.attacker_hitstop_f ? frame + imp.attacker_hitstop_f + 1 : 0;
  const b = imp.victim_hitstop_f ? frame + imp.victim_hitstop_f + 1 : 0;
  if (a > sim.hitstopUntil) sim.hitstopUntil = a;
  if (b > sim.hitstopUntil) sim.hitstopUntil = b;
  if (a > (A.hitstopUntil || 0)) A.hitstopUntil = a;
  if (b > (B.hitstopUntil || 0)) B.hitstopUntil = b;
  A.lastImpact = imp;
  B.lastImpactTaken = imp;
}

/**
 * RI-WPN05 §A's knockback, along the attack's forward axis.
 *
 * Positive metres move the VICTIM away from the attacker. Negative metres move the ATTACKER
 * back and leave the victim exactly where it stood — the bounce. It moves `pos` only; the rigs
 * are re-evaluated from `pos` on the next step, so nothing here can smear a pose.
 */
function applyKnockback(A, B, m) {
  if (!m) return;
  const dx = B.pos[0] - A.pos[0], dz = B.pos[2] - A.pos[2];
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return;
  const ux = dx / d, uz = dz / d;
  if (m > 0) {
    if (B.dead || B.knockbackImmune) return;
    B.pos[0] += ux * m; B.pos[2] += uz * m;
    B.lastKnockbackM = m;
  } else {
    A.pos[0] += ux * m; A.pos[2] += uz * m;   // m is negative: A moves AWAY from B
    A.lastKnockbackM = m;
  }
}

/**
 * Apply the magic ward terms a body is carrying TO A DAMAGE OF A NAMED KIND.
 *
 * W1-14 round 3. Wave 1's version took `(B, dmg)` and multiplied by a single kind-blind
 * `B.mitigation`, so a resist-disease ward blunted a sword by 85% and a physical shield stopped
 * a fireball as well as a resist-element ward did. `kind` is now a required part of the
 * question: a ward that does not name your damage kind does nothing to it.
 *
 * Kinds: `physical` (every weapon; the default, so an un-migrated caller behaves as before),
 * `fire` / `frost` / `shock` / `poison` (the elements), `disease` (hazard vectors and rot),
 * `magic` (`damage_health` — the unresisted channel, which is what makes it worth its cost).
 *
 * Flat terms — armour, and `shield`'s flat reduction — apply to `physical` only. Every channel
 * defaults to the identity, so a build with no magic in it computes exactly what it did before.
 */
export function mitigate(B, dmg, kind) {
  const k = kind || 'physical';
  if (B.wardCharges > 0) { B.wardCharges--; return 0; }
  const w = B.wards && B.wards[k] !== undefined ? B.wards[k]
    : (B.wards ? 1 : (B.mitigation === undefined ? 1 : B.mitigation));
  const flat = k === 'physical' ? ((B.armourRating || 0) + (B.shieldFlat || 0)) : 0;
  if (w === 1 && flat === 0) return dmg;
  return Math.max(dmg > 0 ? 1 : 0, dmg * w - flat);
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
