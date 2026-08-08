// The enemy's decision-making. W1-12, RI-AI01 §C/§D/§E/§F.
//
// WHAT WAS HERE BEFORE: nothing. `combat/enemy.js`'s own header declared the scope honestly —
// two behaviours ship, `scripted` and `hold_ground`, and "an archetype declaring anything else
// THROWS on spawn". Its AGGRO branch reads, in full:
//
//     if (this.alertState === 'AGGRO') { this._steer(p, 240); b.state = 'REPOSITION'; }
//
// — a state literally named REPOSITION that turns the yaw and never writes `pos`. The one
// pursuit locomotion in the build was `character/encounter.js::engageMember`, written by W1-07
// so that its AR-3 capture branch could be reached at all, and it is a straight-line beeline to
// 2.30 m followed by a swing every 78 frames forever. Because every wilderness body in the
// world is spawned through `spawnEncounter`, that beeline was, in practice, this game's enemy
// AI. Measured against RI-AI01's own Comparison method it trips three of the five named hard
// fails by construction: M4's inter-COMMIT coefficient of variation is exactly 0 against a
// floor of 0.12 (a constant cadence is an attack timer, not a decision), M3 reads as a STATUE
// once it arrives, and M1/M2's aggro is a bare proximity circle that never passes through
// SUSPICIOUS.
//
// WHAT THIS IS. RI-AI01 §D's transition table, implemented against the bands in §C, the yaw and
// ramp legality in §F and the attack-token arbitration in §E. The parameters are all in
// `game/data/combat/ai.json` — nothing below is a magic number, and perturbing that file is the
// RI-MTH07 consumption demonstration.
//
// WHAT IT IS NOT, said here rather than discovered by a critic: PATROL is not implemented (no
// route data exists to walk), attack STRINGS are not selected (T17 — no string declarations in
// the moveset data), and BLOCK_HOLD is implemented but unreachable because no shipped statblock
// declares archetype TURTLE. See `declared_incomplete` in ai.json.
'use strict';

import { bearingDeg, angleDelta, norm360 } from './geometry.js';
// The save's own vocabulary, imported rather than restated. `relStamp`/`absStamp` carry the
// sentinel rule (a value <= 0 is "never" and passes through unrebased) that `save/fight.js`
// found the hard way; a second copy of that rule here would be a second thing to get wrong.
import { r6, relStamp, absStamp } from '../save/fight.js';

/** RI-AI01 §D. The behaviour-tree leaves this module can be in. */
export const AI_STATES = new Set([
  'IDLE', 'PATROL', 'SUSPICIOUS', 'SEARCH', 'RUSH', 'APPROACH', 'CIRCLE', 'FEINT_STEP',
  'COMMIT', 'RECOVER', 'REPOSITION', 'PUNISH_READ', 'BLOCK_HOLD', 'STAGGER', 'DISENGAGE',
  'LEASH_RETURN', 'DEAD',
]);

/**
 * Which behaviour an enemy actually runs.
 *
 * `ai.json`'s override table is consulted FIRST, so this piece needs no write into
 * `game/data/combat/enemies/` (claimed by W1-03). The one thing it may never do is take a
 * scripted body away from its script: `RI-CMB07` M1's Mode-A conformance instrument is
 * "the enemy executes its 18 scripted actions on the exact frames given", and an AI that
 * quietly replaced that would invalidate every frame-exact measurement in the project. A body
 * that HAS been given a script keeps `scripted` whatever the table says.
 */
export function resolveBehaviour(stat, aiData, hasScript) {
  if (hasScript) return 'scripted';
  if (aiData && aiData.enabled !== false && aiData.override && aiData.override[stat.id]) {
    return aiData.override[stat.id];
  }
  return stat.ai;
}

/**
 * The group an enemy shares an attack token with (RI-AI01 §E). Encounter membership when there
 * is one — that is what "same encounter volume" means for a wilderness post — and otherwise a
 * single-member group, which yields one token, which is the correct answer for a lone enemy.
 */
function groupKeyOf(b, ctx) {
  const ent = ctx.entityOf ? ctx.entityOf(b.id) : null;
  return (ent && ent.encounterId) || `solo:${b.id}`;
}

/**
 * WHAT IS MACHINERY AND WHAT IS STATE — the split a save has to make, declared beside the
 * constructor that creates both rather than in the save, so that a field added below is
 * carried by default and only an explicit line here takes it out again.
 *
 * MACHINERY: handles to objects the constructor is given (`b`, `stat`, `cfg`), and the row
 * and the five numbers it derives from them (`A`, `omega`, `sightR`, `walk`, `sprint`,
 * `leashHard`). Every one is a pure function of (statblock, ai.json) and every one is rebuilt
 * on construction. Serialising them was 81,892 bytes of a 194,161-byte save — `ai.b` alone
 * dragged the whole `CombatBody` in behind it — and restoring them would pin a live enemy to
 * a *copy* of the data tables the rest of the fight is still reading from.
 *
 * Everything else is behavioural state and is carried: what the enemy is doing and for how
 * long (`state`, `prevState`, `stateF`, `stateEnteredF`), how fast it is actually moving
 * (`speed`, `yawRate`), which way it has chosen to go round you (`strafeDir`, `strafeUntil`,
 * `radialSign`), whether it is holding the group's attack token (`token`, `tokenSinceF`), its
 * four clocks (`cooldownUntil`, `feintUntil`, `roarUntil`, `healUntil`), how long it has had
 * no line of sight (`noLosSinceF`), the frame it last committed on and the interval history
 * RI-AI01 M4's cadence coefficient is computed from (`lastCommitF`, `commitIntervals`), and —
 * the one a player would notice first — `anchor`, the leash origin. `anchor` is assigned by
 * `EnemyController._resolveAI()` from the body's position at the moment the AI is built, so a
 * load that did not carry it would re-anchor every enemy in the province to wherever it
 * happened to be standing, and T25's leash would let it walk `L_hard` further than it should.
 */
const MACHINERY = new Set([
  'b', 'stat', 'cfg', 'A', 'archetypeName', 'omega', 'sightR', 'walk', 'sprint',
  'leashTier', 'leashHard',
]);

/**
 * Frame STAMPS on the AI, stored as differences against the save frame because `loadState()`
 * resets the frame to 0 (`RI-MTH01` A07). Same rule and same helpers as
 * `save/fight.js FRAME_STAMP_FIELDS`; declared rather than pattern-matched for the same reason
 * that file gives — `stateF` ends in F and is a COUNTER, not a stamp, and rebasing it would
 * turn "eleven frames in this state" into a date.
 */
const AI_FRAME_STAMPS = new Set([
  'stateEnteredF', 'strafeUntil', 'tokenSinceF', 'cooldownUntil',
  'feintUntil', 'roarUntil', 'healUntil', 'noLosSinceF', 'lastCommitF',
]);

export class SoulsAI {
  /**
   * @param {object} b    the CombatBody
   * @param {object} stat the statblock
   * @param {object} d    all of game/data/combat/*.json
   */
  constructor(b, stat, d) {
    this.b = b;
    this.stat = stat;
    this.cfg = d.ai;
    if (!this.cfg) {
      throw new Error(
        'SoulsAI: game/data/combat/ai.json is not loaded. It is the parameter set for every '
        + 'number this state machine uses; running without it would mean inventing them in code, '
        + 'which is the thing RI-MTH07 exists to catch. Add it to the combat data bundle.');
    }
    // ---- W1-12 round 2: which archetype row this body's BEHAVIOUR reads --------------------
    //
    // Round 1 read `stat.archetype` and nothing else. inf_trash, guard_legion, drowned_lesser
    // and drowned_greater are all INFANTRY with byte-identical attack tables, so all four ran a
    // BIT-IDENTICAL 1,800-frame fight — sha1 1edb362ea24dde99 — at 412, 520, 260 and 640 hp.
    // A state machine does not read hp and should not; what tells a legionary from a drowned
    // thing is gait, leash and what it does when you crowd it. `behaviour_archetype` in ai.json
    // is that mapping and it is an ORDER, not a duplicate (rule 10): the statblock's own
    // `archetype` is the default and the table overrides it FOR BEHAVIOUR ONLY. No stat moves.
    const archName = (this.cfg.behaviour_archetype && this.cfg.behaviour_archetype[stat.id])
      || stat.archetype;
    const A = this.cfg.archetype[archName];
    if (!A) {
      throw new Error(
        `SoulsAI: archetype '${archName}' (statblock '${stat.id}') has no row in `
        + 'game/data/combat/ai.json §archetype. RI-AI01 §C is a per-archetype table and a '
        + 'missing row is a missing bar, not a default. Add the row or declare the archetype '
        + 'unrealised.');
    }
    this.A = A;
    this.archetypeName = archName;
    // The STATBLOCK wins wherever it declares the number. ai.json is the archetype default.
    this.omega = stat.reach_m || A.omega_m;
    this.sightR = stat.sight_radius_m || A.sight_r_m;
    this.walk = A.walk_mps;
    this.sprint = A.sprint_mps;
    // ---- T25's L_hard. Round 1 took the tier from the ARCHETYPE row alone, and every shipped
    // statblock resolved to INFANTRY/BEAST/CASTER — all three of which declare `trash` — so
    // `elite` (45 m), `ambusher` (20 m) and `boss` were unreachable and a statblock flagged
    // `boss: true` leashed at 32 m like a levy. The order below is the fix, and it is stated in
    // ai.json §leash._tier_resolution as well as here because a resolution order that lives
    // only in code is a resolution order nobody can audit.
    this.leashTier = stat.boss ? 'boss'
      : (stat.tier && this.cfg.leash.hard_m[stat.tier] !== undefined ? stat.tier : A.leash_tier);
    this.leashHard = this.cfg.leash.hard_m[this.leashTier] ?? this.cfg.leash.hard_m.trash;

    this.state = 'IDLE';
    this.stateF = 0;              // frames in the current state
    this.speed = 0;               // current gait speed, ramped (§F)
    this.strafeDir = 1;
    this.strafeUntil = 0;
    this.radialSign = 1;
    this.token = false;
    this.tokenSinceF = 0;
    this.cooldownUntil = 0;
    this.feintUntil = 0;
    this.roarUntil = 0;
    this.noLosSinceF = -1;
    this.healUntil = 0;
    this.lastCommitF = -1;
    this.commitIntervals = [];
    // ---- W1-12 round 2. The closure window: the last N frames of centre-to-centre distance,
    // oldest first. This is the whole memory the closure rule needs and it is behavioural state,
    // so `saveState()` carries it (arrays are carried by default; see the MACHINERY note).
    this.distWindow = [];
    this.blockUntil = 0;
    this.disengageUntil = 0;
  }

  /**
   * THE AI'S DURABLE STATE — the same `saveState()`/`loadState()` contract `Rig` already has
   * in `combat/skeleton.js`, and `save/fight.js` reaches both the same way rather than knowing
   * anything about either class.
   *
   * The field set is ENUMERATED FROM THE LIVE OBJECT minus `MACHINERY`, which is the
   * discipline `save/fight.js` opens with: a field a future round adds to this state machine
   * appears in the save without anybody remembering to declare it, and the things deliberately
   * not carried are named above with their reasons rather than being absent.
   *
   * @param {number} now the frame the save is being taken on; stamps are stored relative to it.
   */
  saveState(now = 0) {
    const out = {};
    for (const k of Object.keys(this).sort()) {
      if (MACHINERY.has(k)) continue;
      const v = this[k];
      if (typeof v === 'function') continue;
      if (Array.isArray(v)) { out[k] = v.map(r6); continue; }
      if (typeof v === 'number') { out[k] = AI_FRAME_STAMPS.has(k) ? relStamp(v, now) : r6(v); continue; }
      out[k] = v === undefined ? null : v;
    }
    return out;
  }

  /**
   * Put the behaviour back onto a FRESHLY CONSTRUCTED instance — never onto the record. The
   * constructor has already rebuilt the machinery from the statblock and `ai.json`, and
   * `MACHINERY` is refused here as well as in `saveState()` so that an old or a hand-edited
   * save cannot hand this object a stale copy of the data tables the rest of the fight reads.
   *
   * @param {number} now the frame the load reset to; stamps are rebased against it.
   */
  loadState(rec, now = 0) {
    if (!rec) return this;
    for (const k of Object.keys(rec)) {
      if (MACHINERY.has(k)) continue;
      const v = rec[k];
      if (Array.isArray(v)) { this[k] = v.slice(); continue; }
      this[k] = (typeof v === 'number' && AI_FRAME_STAMPS.has(k)) ? absStamp(v, now) : v;
    }
    return this;
  }

  /**
   * CLOSURE, in m/s: how fast the gap has been shrinking over the last
   * `movement.rush_closure_window_f` frames. Positive means gaining.
   *
   * Returns `null` until the window is full, and a null closure triggers nothing — an enemy does
   * not get to conclude it is losing a foot race from three frames of data, and the acceleration
   * ramp (§F, 14 f to sprint) means the first few frames of any approach look like a stall.
   */
  _closureMps() {
    const w = this.distWindow;
    const W = this.cfg.movement.rush_closure_window_f;
    if (w.length < W || W <= 0) return null;
    return (w[0] - w[w.length - 1]) / (W / 60);
  }

  /**
   * THE CLOSURE RULE — the whole of round 2's headline, in five lines.
   *
   * RI-AI01 T07/T09 gate the sprint on a distance band and round 1 implemented exactly that, so
   * an enemy 10 m from a player WALKING away closed at 0.20 m/s (its approach walk of 2.20
   * against the player's 2.00), never entered RUSH in 1,800 frames, never got nearer than
   * 8.14 m, hit its leash and went home. It did WORSE against a walk than against a jog, because
   * walking held the gap just inside the band boundary that would have triggered the sprint.
   *
   * So: distance decides where the enemy wants to be; closure decides how fast it has to move to
   * get there. Outside the DANCE band, an enemy that is not gaining at least
   * `rush_when_closure_below_mps` sprints, whatever band it is in. Inside DANCE it never does —
   * a shove is not a chase, and an enemy that sprints at a player it is already standing next to
   * is the chase-bot RI-AI01 M3 exists to fail.
   */
  _losingGround(dist) {
    if (dist <= this.cfg.bands.dance * this.omega) return false;
    const c = this._closureMps();
    return c !== null && c < this.cfg.movement.rush_when_closure_below_mps;
  }

  /** The near edge of a named band, in metres — where T24 re-spaces to. */
  _bandFloor(name) {
    const B = this.cfg.bands;
    const floor = { strike: 0, poke: B.strike, dance: B.poke, close: B.dance, rush: B.close }[name];
    return (floor === undefined ? B.dance : floor) * this.omega;
  }

  band(dist) {
    const B = this.cfg.bands;
    if (dist <= B.strike * this.omega) return 'STRIKE';
    if (dist <= B.poke * this.omega) return 'POKE';
    if (dist <= B.dance * this.omega) return 'DANCE';
    if (dist <= B.close * this.omega) return 'CLOSE';
    return 'RUSH';
  }

  _enter(state, frame) {
    if (state === this.state) return;
    // A guard raised by BLOCK_HOLD (T18) comes down on EVERY exit from it, in one place, so that
    // no future branch out of the state can leave an enemy holding a shield forever. That would
    // not throw and would not look wrong in a trace — it would just quietly make one enemy
    // unhittable from the front, which is the shape of defect this project keeps finding late.
    if (this.state === 'BLOCK_HOLD') this.b.guardRaised = false;
    this.prevState = this.state;
    this.state = state;
    this.stateF = 0;
    this.stateEnteredF = frame;
  }

  /**
   * The gait ramp, RI-AI01 §F: ">= 8 f from 0 to walk, >= 14 f from 0 to sprint, >= 10 f to
   * stop". Implemented as an acceleration limit rather than as a lerp so that a decision to
   * stop takes ten frames from whatever speed the enemy was actually at, which is what makes
   * an approach visibly decelerate into a circle (T09's "must decelerate over >= 10 f, no
   * instant stop") instead of snapping.
   */
  _ramp(target) {
    const M = this.cfg.movement;
    const up = target > this.speed;
    const rate = up
      ? (target > this.walk ? this.sprint / M.accel_frames_to_sprint : this.walk / M.accel_frames_to_walk)
      : (this.speed / M.decel_frames_to_stop || this.walk / M.decel_frames_to_stop);
    if (up) this.speed = Math.min(target, this.speed + rate);
    else this.speed = Math.max(target, this.speed - Math.max(rate, this.walk / M.decel_frames_to_stop));
    return this.speed;
  }

  /** §F: 300 °/s free. Returns the yaw rate actually applied, in °/s, for the trace. */
  _face(tx, tz, dps) {
    const b = this.b;
    const want = bearingDeg(tx - b.pos[0], tz - b.pos[2]);
    const maxStep = dps / 60;
    let d = angleDelta(b.yaw, want);
    if (d > maxStep) d = maxStep; else if (d < -maxStep) d = -maxStep;
    b.yaw = norm360(b.yaw + d);
    return Math.abs(d) * 60;
  }

  _move(dx, dz) {
    const b = this.b;
    const m = Math.hypot(dx, dz);
    if (m < 1e-9) { b.speedMps = 0; return; }
    b.pos[0] += dx; b.pos[2] += dz;
    b.speedMps = m * 60;
  }

  /**
   * One fixed frame of decision-making. Called from EnemyController.step() only on frames where
   * the body is NOT committed to a move — commitment is seam S1 and this module never cancels
   * an animation, which is the whole reason RI-AI03's punish window exists.
   */
  step(frame, ctx, ctl) {
    const b = this.b;
    const p = ctx.player;
    this.stateF++;
    this.yawRate = 0;
    if (!p) { this._enter('IDLE', frame); b.state = 'IDLE'; b.speedMps = 0; return; }

    const dx = p.pos[0] - b.pos[0], dz = p.pos[2] - b.pos[2];
    const dist = Math.hypot(dx, dz);
    const anchorD = Math.hypot(b.pos[0] - this.anchor[0], b.pos[2] - this.anchor[2]);
    const alert = ctl.alertState;

    // ---- the closure window (round 2). Pushed every decision frame, oldest first, capped at
    // `rush_closure_window_f`. `_closureMps()` reads it. It is deliberately fed on EVERY frame
    // the AI decides on rather than only in APPROACH, so that a state change does not reset the
    // enemy's memory of whether it is gaining — resetting it was the first draft's bug and it
    // made the enemy re-earn the sprint after every strafe reseed.
    const W = this.cfg.movement.rush_closure_window_f;
    this.distWindow.push(dist);
    while (this.distWindow.length > W) this.distWindow.shift();

    // ---- T25's second de-aggro clause needs to know whether this enemy can SEE the player, and
    // round 1 never assigned `noLosSinceF`, so the clause and both `leash` leaves behind it were
    // dead code. There is exactly ONE line-of-sight model in this build and it is not this one:
    // `sim/stealth/system.js:403` writes `percept_los` onto the sim entity every frame. The AI
    // READS it across the seam it already has (`ctx.entityOf`, the same handle the token
    // arbitrator uses) rather than computing a second one — rule 10, which is how this build
    // once came to have a good perception model and a broken one at the same time. A context
    // with no entities (a bare arena) yields `null`, which leaves the stamp alone and the clause
    // silent, which is honest: no LOS model, no LOS de-aggro.
    const ent = ctx.entityOf ? ctx.entityOf(b.id) : null;
    const los = ent && ent.percept_los !== undefined && ent.percept_los !== null
      ? !!ent.percept_los : null;
    if (los === true) this.noLosSinceF = -1;
    else if (los === false && this.noLosSinceF < 0) this.noLosSinceF = frame;

    // ---- T25: leash, checked before anything else, because a leashed enemy has no other
    // decision to take. RI-AI01's own M6 fails a build "if the enemy tracks the player past
    // L_hard", so this is the transition that has to win.
    if (this.state !== 'LEASH_RETURN'
        && (anchorD > this.leashHard
            || (this.noLosSinceF >= 0 && frame - this.noLosSinceF > this.cfg.leash.no_los_seconds * 60
                && dist > this.cfg.leash.dist_multiple_of_sight * this.sightR))) {
      this._releaseToken(ctx);
      this._enter('LEASH_RETURN', frame);
    }

    if (this.state === 'LEASH_RETURN') return this._leashReturn(frame, ctx, ctl, dist);

    // ---- the alert ladder. The METER is not ours — `sim/stealth/system.js` owns it and writes
    // through to ctl.alert / ctl.alertState. What is ours is the ladder's consequence.
    if (alert !== 'AGGRO') {
      this.roarUntil = 0;
      this._releaseToken(ctx);
      // T25/T26. An enemy that loses the player does not simply stop where it happens to be
      // standing — it goes home. The first draft dropped straight to IDLE here, so an enemy
      // that had chased thirty metres down the road stood in the road forever and M6 scored 0
      // with the note "LEASH_RETURN entered at frame -1": the leash was unreachable because
      // nothing ever routed into it. Souls' de-aggro is a walk back, and the walk back is the
      // player's reward for disengaging — which ARBITRATION §1 protects explicitly ("Fleeing is
      // a legitimate, supported resolution ... escape is not a failure state").
      if (Math.hypot(b.pos[0] - this.anchor[0], b.pos[2] - this.anchor[2]) > 1.5) {
        this._enter('LEASH_RETURN', frame);
        return this._leashReturn(frame, ctx, ctl, dist);
      }
      this._ramp(0);
      b.speedMps = 0;
      let want = alert === 'SEARCH' ? 'SEARCH' : alert === 'SUSPICIOUS' ? 'SUSPICIOUS' : 'IDLE';
      // T03/T04's minimum dwell. `perception.suspicious_min_dwell_f` was declared in round 1 and
      // read by nothing. Without it a meter that flickers across 50 produces a one-frame head
      // turn, which is a tell the player cannot see and an alert ladder M2 cannot measure.
      if (want === 'IDLE' && this.state === 'SUSPICIOUS'
          && this.stateF < this.cfg.perception.suspicious_min_dwell_f) want = 'SUSPICIOUS';
      this._enter(want, frame);
      // T06: 12.0 s in SEARCH with no re-acquire and the enemy goes home.
      // `perception.search_to_leash_frames` was likewise declared and unread; this is its reader.
      if (this.state === 'SEARCH' && this.stateF >= this.cfg.perception.search_to_leash_frames) {
        this._enter('LEASH_RETURN', frame);
        return this._leashReturn(frame, ctx, ctl, dist);
      }
      if (this.state === 'SUSPICIOUS' || this.state === 'SEARCH') {
        // Look towards the last known position, not at the player. T04 is explicit about it:
        // "walks last-known-position, not player position". This build has no search
        // locomotion of its own (W1-15 owns sim/stealth/search.js), so the head turn is all
        // this state does and that is said plainly rather than dressed up.
        const lkp = ctl.lkp || [p.pos[0], 0, p.pos[2]];
        this.yawRate = this._face(lkp[0], lkp[2], this.cfg.movement.max_yaw_rate_free_dps);
      }
      b.state = this.state;
      return;
    }

    // ---- T05: AGGRO entry costs 20-30 frames in which the enemy may NOT attack.
    if (!this.roarUntil) {
      const [lo, hi] = this.cfg.perception.aggro_entry_frames;
      this.roarUntil = frame + lo + this._draw(ctx, hi - lo);
      this._enter('REPOSITION', frame);
    }

    this.yawRate = this._face(p.pos[0], p.pos[2], this.cfg.movement.max_yaw_rate_free_dps);
    const band = this.band(dist);

    if (frame < this.roarUntil) { this._ramp(0); b.speedMps = 0; b.state = 'REPOSITION'; return; }

    // ---- T22: the anti-chug read. A player who drinks at range is punished for it.
    const ps = ctx.playerState && ctx.playerState();
    if (ps && this.cfg.punish_read.trigger_player_states.includes(ps)
        && dist <= this.cfg.punish_read.band_multiple * this.omega) {
      this._enter('PUNISH_READ', frame);
      this._advance(dx, dz, dist, this.sprint);
      b.state = 'PUNISH_READ';
      if (band === 'STRIKE' || band === 'POKE') this._tryCommit(frame, ctx, ctl, dist);
      return;
    }

    // ---- T18: BLOCK_HOLD. TURTLE only, and `archetype.TURTLE.blocks` is what selects it —
    // round 1 declared that flag and nothing read it, and its `declared_incomplete` claimed the
    // code path existed when the only occurrence of the string was inside the AI_STATES set.
    // This is the path. `guard_legion` is TURTLE (ai.json §behaviour_archetype) and carries a
    // `chitin_buckler`, and combat/resolve.js:192 tests `guardRaised && shield`, so the raised
    // guard really blocks rather than merely posing.
    if (this.A.blocks && ps === 'ATTACK_WINDUP' && !b.move
        && dist <= this.cfg.block.enter_band_multiple * this.omega
        && this.state !== 'BLOCK_HOLD') {
      this._enter('BLOCK_HOLD', frame);
      this.blockUntil = frame + this.cfg.block.max_hold_f;
    }

    // ---- T24: DISENGAGE. Selected by the archetype row's `prefers_band`, which round 1 also
    // declared and never read. Bounded on purpose — see ai.json §disengage._termination_note.
    if (this.A.prefers_band && this.state !== 'DISENGAGE' && !b.move
        && frame >= this.disengageUntil
        && dist < this.cfg.disengage.enter_below_multiple_of_player_reach * this.cfg.disengage.player_reach_m) {
      this._releaseToken(ctx);
      this._enter('DISENGAGE', frame);
    }

    switch (this.state) {
      case 'BLOCK_HOLD': {                                // T18
        b.guardRaised = true;
        this._ramp(0);
        b.speedMps = 0;
        const stillThreatened = ps === 'ATTACK_WINDUP'
          && dist <= this.cfg.block.enter_band_multiple * this.omega;
        if (frame >= this.blockUntil
            || (this.stateF >= this.cfg.block.min_dwell_f && !stillThreatened)) {
          this._enter('CIRCLE', frame);          // _enter lowers the guard
        }
        break;
      }

      case 'DISENGAGE': {                                 // T24
        const floor = this._bandFloor(this.A.prefers_band);
        const v = this._ramp(this.sprint);
        this._move(-(dx / (dist || 1)) * (v / 60), -(dz / (dist || 1)) * (v / 60));
        if (this.stateF >= this.cfg.disengage.min_dwell_f
            && (dist >= floor || this.stateF >= this.cfg.disengage.max_frames)) {
          this.disengageUntil = frame + this.cfg.disengage.max_frames;
          this._enter('CIRCLE', frame);
          this._reseedStrafe(frame, ctx);
        }
        break;
      }

      case 'REPOSITION':
        // T16's other half, and the state the pre-W1-12 code named without implementing. A
        // swing ends with the enemy standing at about a metre — well inside its own STRIKE
        // band — and the first thing a Souls enemy does after a whiffed or landed attack is
        // get its spacing back. Leaving that to the strafe's radial correction meant roughly
        // half a second inside 0.85·Ω after every attack, and RI-AI01 M3 measures precisely
        // that fraction: `min_dist_dwell` was 0.307 against a PASS of 0.10.
        if (dist < this.cfg.circle.preferred_band_multiple * this.omega * 0.9) {
          // At SPRINT, not walk, and this is T24's "backstep/hop away, then re-space to
          // preferred band" rather than a number chosen to move a metric. Every one of this
          // roster's attacks carries 0.6-1.2 m of forward root motion, so a swing ENDS about a
          // metre from the player whatever distance it started at; a back-off at walking pace
          // spends half a second of every attack cycle inside 0.85·Ω and the fight reads as a
          // shove rather than an exchange.
          //
          // Measured, one enemy, 3,600 frames, bare Node, commit 107c1b3+W1-12:
          // no back-off state at all (radial correction inside CIRCLE only) 0.307; back off at
          // walk 0.420; back off at sprint 0.228. RI-AI01 M3's hard fail is > 0.35 and its
          // PASS is <= 0.10, so this is CLEAR OF THE HARD FAIL AND SHORT OF THE PASS, and it
          // is reported that way rather than tuned until the number is pretty. The residue is
          // FEINT_STEP, which is 448 of the 1,806 non-COMMIT frames and which T13 *defines* as
          // ending inside 0.85·Ω — a correct step-in scores against this metric by
          // construction. See reports/w1-12/survey.md §M3.
          const v = this._ramp(this.sprint);
          this._move(-(dx / (dist || 1)) * (v / 60), -(dz / (dist || 1)) * (v / 60));
          break;
        }
        this._enter(band === 'RUSH' ? 'RUSH' : band === 'CLOSE' ? 'APPROACH' : 'CIRCLE', frame);
        break;

      case 'PUNISH_READ':
        this._enter(band === 'RUSH' ? 'RUSH' : band === 'CLOSE' ? 'APPROACH' : 'CIRCLE', frame);
        break;

      case 'RUSH':                                        // T07 / T09, amended by the closure rule
        this._advance(dx, dz, dist, this.sprint);
        // Round 1 left RUSH the moment the band said CLOSE, and that produced a standoff you
        // could watch: the enemy sprinted until 12.0 m, walked at 2.20 until the player's 3.20
        // jog pushed the gap back over the boundary, and sprinted again — min gap 11.63 m over
        // 1,800 frames, oscillating on the band edge. It now gives up the sprint only when it
        // has ARRIVED (the DANCE band) or when it is genuinely gaining ground.
        if (this.stateF >= 12
            && (dist <= this.cfg.bands.dance * this.omega
                || (band !== 'RUSH' && !this._losingGround(dist)))) this._enter('APPROACH', frame);
        break;

      case 'APPROACH':                                    // T08 / T10, amended by the closure rule
        this._advance(dx, dz, dist, this.walk);
        if (band === 'RUSH' || this._losingGround(dist)) this._enter('RUSH', frame);
        else if (dist <= this.cfg.bands.dance * this.omega && this.stateF >= 15) this._enter('CIRCLE', frame);
        break;

      case 'CIRCLE':                                      // T11 / T12
        this._circle(frame, ctx, dx, dz, dist);
        if (band === 'RUSH' || band === 'CLOSE') { this._enter('APPROACH', frame); break; }
        if (this.stateF >= this.cfg.commit.feint_min_circle_dwell_f
            && frame >= this.cooldownUntil
            && dist <= this.cfg.bands.dance * this.omega
            && this._takeToken(frame, ctx)) {
          this._enter('FEINT_STEP', frame);
          this.feintUntil = frame + this.cfg.commit.feint_step_max_frames;
        }
        break;

      case 'FEINT_STEP':                                  // T13 / T14 — the fake-out
        // The step-in is a GAP-CLOSER, not a walk. T13 gives it 36 frames to cross from the
        // circling radius into STRIKE, and at a walk that is arithmetically impossible from
        // anywhere inside the DANCE band — the first run of this AI circled honestly, feinted
        // honestly, and committed exactly zero times in 400 frames because 36 f at 2.2 m/s is
        // 1.32 m and it needed 2.26 m. A feint the enemy cannot finish is a standoff.
        this._advance(dx, dz, dist, this.sprint);
        if (dist <= this.cfg.bands.strike * this.omega) {
          if (this._tryCommit(frame, ctx, ctl, dist)) break;
        }
        if (frame >= this.feintUntil) {
          // T14: 36 f elapsed without reaching STRIKE. The token goes back and a cooldown
          // starts. THIS is the transition that makes the inter-COMMIT interval vary, and
          // RI-AI01 M4's hard fail (coefficient of variation < 0.12) is a test for its absence.
          this._releaseToken(ctx);
          this.cooldownUntil = frame + this.cfg.commit.feint_release_cooldown_f;
          this._enter('CIRCLE', frame);
          this._reseedStrafe(frame, ctx);
        }
        break;

      default:
        this._enter('CIRCLE', frame);
    }

    // Token hold cap (§E): a held token that never becomes a swing starves the group.
    if (this.token && frame - this.tokenSinceF > this.cfg.commit.token_hold_cap_f) {
      this._releaseToken(ctx);
      const [lo, hi] = this.cfg.commit.token_cooldown_f;
      this.cooldownUntil = frame + lo + this._draw(ctx, hi - lo);
    }
    // A commit that began this frame has already had `b.state` set to the move's own startup
    // state by `begin()`. Overwriting it with the AI leaf here would report ATK_WINDUP frames
    // as COMMIT and hide the phase the whole telegraph item is measured on.
    if (!b.move) b.state = this.state;
  }

  /** Walk/sprint straight at the target, but never inside the standoff (§F). */
  _advance(dx, dz, dist, target) {
    const stand = this.cfg.movement.min_standoff_m;
    const v = this._ramp(target);
    if (dist <= stand) { this._move(0, 0); return; }
    const step = Math.min(v / 60, dist - stand);
    this._move((dx / dist) * step, (dz / dist) * step);
  }

  /**
   * T11. Strafe around the player at the DANCE band with a small radial drift, reseeding
   * direction on a 48-96 f seeded timer.
   *
   * The radial drift is not decoration. RI-AI01 M3's PASS needs `spacing_variance >= 0.8 m`
   * over a 60 s window, and an enemy that orbits at a fixed radius has a spacing variance of
   * zero — which is the "statue" fail with extra steps.
   */
  _circle(frame, ctx, dx, dz, dist) {
    if (frame >= this.strafeUntil) this._reseedStrafe(frame, ctx);
    const v = this._ramp(this.walk * this.cfg.circle.strafe_speed_fraction);
    const ux = dx / (dist || 1), uz = dz / (dist || 1);        // unit vector TOWARDS the player
    const tx = -uz * this.strafeDir, tz = ux * this.strafeDir; // tangent
    const want = this.cfg.circle.preferred_band_multiple * this.omega;

    // Re-spacing. This is a CORRECTION, not a drift: an enemy that has just finished a swing is
    // standing at about one metre and has to get back out to its own preferred band before it
    // can circle at all. A fixed 0.35 m/s drift took eight seconds to do it, and for those
    // eight seconds the enemy was inside 0.85·Ω — which is RI-AI01 M3's chase-bot hard fail
    // arriving through the back door, from an AI that believed it was strafing.
    const err = want - dist;
    const outward = Math.max(-this.walk * 0.6, Math.min(this.walk * 0.9, err * 1.5))
      + this.radialSign * this.cfg.circle.radial_drift_mps;   // + the seeded in/out wobble
    let mx = tx * v - ux * outward, mz = tz * v - uz * outward;
    // Never steer inside the standoff; the separation force is not there to undo a decision.
    if (dist - (ux * mx + uz * mz) / 60 < this.cfg.movement.min_standoff_m) { mx = tx * v; mz = tz * v; }
    this._move(mx / 60, mz / 60);
  }

  _reseedStrafe(frame, ctx) {
    const [lo, hi] = this.cfg.circle.reseed_frames;
    this.strafeUntil = frame + lo + this._draw(ctx, hi - lo);
    this.strafeDir = this._draw(ctx, 2) ? 1 : -1;
    this.radialSign = this._draw(ctx, 2) ? 1 : -1;
  }

  /** T13/T15. Start a real attack. Returns true if one began. */
  _tryCommit(frame, ctx, ctl, dist) {
    const b = this.b;
    if (!this.token) return false;
    const ids = Object.keys(b.moves).filter((k) => !k.startsWith('_') && b.moves[k].kind === 'attack');
    if (!ids.length) return false;
    // Pick by band rather than by rotation index: the whole point of RI-AI01 M4 is that the
    // choice is range-gated. A move whose reach cannot cover the current distance is not
    // eligible, so the enemy stops whiffing into empty air on a metronome.
    const eligible = ids.filter((k) => {
      const m = b.moves[k];
      const reach = this.omega + (m.root_dz_m || 0);
      return dist <= reach && (!m.stamina || b.stamina >= m.stamina);
    });
    const pool = eligible.length ? eligible : [];
    if (!pool.length) return false;
    const mv = b.moves[pool[this._draw(ctx, pool.length)]];
    b.begin(mv, frame, {});
    if (mv.stamina) b.spend(mv.stamina, frame, ctx.d);
    if (ctl && ctl._noteAttack) ctl._noteAttack(frame);
    if (this.lastCommitF >= 0) this.commitIntervals.push(frame - this.lastCommitF);
    this.lastCommitF = frame;
    this._enter('COMMIT', frame);
    b.state = mv.states.startup;
    if (ctx.emit) {
      const e = ctx.emit(frame, 'ACTION_START');
      e.who = b.id; e.mv = mv.id; e.tag = 'enemy_attack';
      e.startup = mv.startup; e.active = mv.active; e.recovery = mv.recovery; e.total = mv.total;
      e.punish_window = mv.punish_window;
      e.dist_m = Math.round(dist * 1000) / 1000;
      e.ai_state = 'COMMIT';
    }
    return true;
  }

  /**
   * T15. THE STATE ROUND 1 DID NOT HAVE, and the reason its M3 passed.
   *
   * RI-AI01 §D T15 says an attack whose phase leaves `active` transitions COMMIT → RECOVER, and
   * M3 computes `min_dist_dwell` over frames "while `state != COMMIT`". Round 1 labelled the
   * WHOLE swing COMMIT — startup, active and recovery — so every recovery frame dropped out of
   * M3's denominator. On the round-1 fixture and seed that is 623 of 736 recovery frames spent
   * inside the enemy's own 0.85·Ω strike band, invisible to the metric written to detect exactly
   * that: dwell reads 0.0414 as round 1 scored it and 0.2521 with the state the item requires.
   *
   * THIS CHANGES NO BEHAVIOUR AND MUST NOT. It is called from `EnemyController.step()` on frames
   * the body is mid-attack — frames on which `SoulsAI.step()` is deliberately never called — and
   * it does exactly one thing: rename the leaf. No movement, no yaw, no decision, no early
   * retire. The commitment property the round-1 critic measured (47 of 47 swings ran to their
   * full declared clip with 0.00 °/s of yaw after startup, zero frames in which the enemy could
   * change its mind) is a property of `if (b.move)` in the controller and is untouched by this.
   *
   * @param {object} b the body, already advanced for this frame.
   */
  noteAttackPhase(frame, b) {
    if (!b.move || b.move.kind !== 'attack') return;
    if (this.state !== 'COMMIT') return;
    if (b.animFrame > b.move.startup + b.move.active) this._enter('RECOVER', frame);
  }

  /** T15/T16: the attack has ended. Token goes back, cooldown starts, back to CIRCLE. */
  onMoveEnded(frame, ctx) {
    // RECOVER is accepted here as well as COMMIT: as of round 2 a swing that reaches its
    // recovery frames is labelled RECOVER (T15), and the retire arrives while it is. Reading
    // only COMMIT here would have left the token held forever and starved the whole group —
    // the most expensive way this change could have gone wrong, and the reason it is stated.
    if (this.state !== 'COMMIT' && this.state !== 'RECOVER') return;
    this._releaseToken(ctx);
    const [lo, hi] = this.cfg.commit.token_cooldown_f;
    this.cooldownUntil = frame + lo + this._draw(ctx, hi - lo);
    this._enter('REPOSITION', frame);
    this._reseedStrafe(frame, ctx);
  }

  /** T26. Walk home; heal only after arrival, and never become invulnerable. */
  _leashReturn(frame, ctx, ctl, dist) {
    const b = this.b;
    const dx = this.anchor[0] - b.pos[0], dz = this.anchor[2] - b.pos[2];
    const home = Math.hypot(dx, dz);
    b.state = 'LEASH_RETURN';
    // T27: re-perceiving the player before arrival re-aggros, free.
    if (ctl.alertState === 'AGGRO' && dist <= this.sightR) {
      this.roarUntil = 0; this.healUntil = 0;
      this._enter('REPOSITION', frame);
      return;
    }
    if (home > 1.5) {
      this.yawRate = this._face(this.anchor[0], this.anchor[2], this.cfg.movement.max_yaw_rate_free_dps);
      const v = this._ramp(this.walk);
      const step = Math.min(v / 60, home);
      this._move((dx / home) * step, (dz / home) * step);
      this.healUntil = 0;
      return;
    }
    this._ramp(0); b.speedMps = 0;
    if (!this.healUntil) this.healUntil = frame + this.cfg.leash.return_heal_seconds * 60;
    // Heal linearly over 4 s AFTER arrival. Never a snap, and hp is never clamped upward
    // during the walk home — M6 checks the hp series for exactly that.
    if (b.hp < b.hpMax) b.hp = Math.min(b.hpMax, b.hp + b.hpMax / (this.cfg.leash.return_heal_seconds * 60));
    if (frame >= this.healUntil && b.hp >= b.hpMax) this._enter('IDLE', frame);
  }

  // ---- attack-token arbitration, RI-AI01 §E ---------------------------------------------
  _tokensFor(ctx, key) {
    const peers = ctx.aiPeers ? ctx.aiPeers(key) : [this];
    const n = peers.length;
    if (peers.some((a) => a.stat.tier === 'elite') && n > 1) return this.cfg.commit.tokens_when_elite_present;
    // §E's 5+ SWARM row. The bound used to be a literal `a.omega <= 1.8` here while the roster's
    // smallest reach is 2.0, so no group of shipped enemies could ever satisfy it and
    // `swarm_tokens_at_5_plus` was unreachable by construction — a parameter guarded by a number
    // that contradicted it. The bound is now the declared leaf.
    if (n >= 5 && peers.every((a) => a.A.leash_tier === 'trash'
        && a.omega <= this.cfg.commit.swarm_max_omega_m)) {
      return this.cfg.commit.swarm_tokens_at_5_plus;
    }
    for (const row of this.cfg.commit.tokens_by_group) if (n <= row.max_size) return row.tokens;
    return 1;
  }

  _takeToken(frame, ctx) {
    if (this.token) return true;
    const key = groupKeyOf(this.b, ctx);
    const peers = ctx.aiPeers ? ctx.aiPeers(key) : [this];
    const held = peers.filter((a) => a.token).length;
    if (held >= this._tokensFor(ctx, key)) return false;
    this.token = true; this.tokenSinceF = frame;
    return true;
  }

  _releaseToken() { this.token = false; }

  /**
   * The one source of randomness. Draws from the simulation's single global PRNG through the
   * context, so the draw is counted, saved and restored with everything else — `core/rng.js`
   * says "nothing in sim/ may construct its own" and a private stream here would be the same
   * defect wearing a different jacket. If a probe supplies no rng the AI is fully
   * deterministic on the midpoint, which is honest rather than secretly random.
   */
  _draw(ctx, n) {
    if (!ctx || !ctx.rng) return n >> 1;
    return ctx.rng.int(n);
  }
}
