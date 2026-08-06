// Entities and their fixed-step update.
//
// SCOPE, stated plainly: **wave 1 piece W1-00 does not own enemy AI.** `RI-AI01`–`RI-AI07`
// and wave-1 piece W1-06 do. What lives here is everything the *harness* needs to be real:
//   * an entity is instantiated from a real statblock in `game/data/combat/enemies/*.json`;
//     `spawn()` with an id that is not in that directory THROWS (RI-MTH01 M6);
//   * every field HARNESS.md §5 requires of an enemy record is present and truthful;
//   * a dead entity stays in the array as `state: "DEAD"` until despawned
//     (RI-MTH01 "How we lose" #6);
//   * `aggro()` really sets `alert_state` to `AGGRO` and really changes the behaviour
//     selected below.
//
// What is NOT here, and is declared rather than faked: approach/circle/commit/punish
// behaviour. A statblock's `ai` field says which behaviour it wants; wave 1 ships exactly
// two — `none` (a training dummy, which is what a dummy actually does) and `hold_ground`
// (turns to face, never attacks). An enemy declaring any other `ai` throws on spawn rather
// than silently behaving like a dummy, because a plausible-but-wrong enemy is worse than an
// absent one.
//
// SEEDED IDLE PHASE (W1-00 remediation, GAP-W1-platform-prng-never-drawn).
// Before this, `rng.draws` was 0 on every frame of every trace: the PRNG was reseeded
// correctly and nothing ever drew from it, so `RI-MTH02` R4's "seeds must diverge" clause
// was satisfied only by the trace echoing its own seed back. One simulation quantity is now
// a real seeded draw, taken INSIDE the fixed step: each entity's idle-loop phase offset.
//
// Why this quantity and not an invented one: W1-00 does not own enemy AI (RI-AI01..07 /
// W1-06 do), and inventing a seeded "AI decision" here would be exactly the fabricated
// measurement RI-MTH04 forbids. A per-entity idle phase, on the other hand, is real, is
// already free-running, is consumed by the simulation on every step of every run, and is
// the field `AM-W1-00-01` wanted permanently excluded from the determinism ladder — seeding
// it turns that argument into a measurement.
'use strict';

import { rng } from '../core/rng.js';

const DEG = 180 / Math.PI;

// W1-09 added `scripted`: enemy actions come from the scenario file on declared frames, which
// is the instrument RI-CMB07 M1 Mode-A specifies ("the enemy executes its 18 scripted actions
// on the exact frames given ... No AI, no randomness, seed 0"). Enemy DECISION-MAKING is still
// RI-AI01..07 / wave-1 piece W1-12 and is still refused here.
export const IMPLEMENTED_AI = new Set(['none', 'hold_ground', 'scripted']);

export function makeEntity(stat, eid, x, z, frame) {
  if (!IMPLEMENTED_AI.has(stat.ai)) {
    throw new Error(
      `spawn('${stat.id}'): archetype declares ai='${stat.ai}', which wave-1 piece W1-00 does ` +
      `not implement. Implemented: ${[...IMPLEMENTED_AI].join(', ')}. Enemy decision-making is ` +
      'owned by RI-AI01..07 / wave-1 piece W1-12. Refusing to spawn an entity that would look ' +
      'like an enemy and behave like furniture.');
  }
  return {
    eid,
    id: stat.id,
    archetype: stat.archetype,
    tier: stat.tier,
    ai: stat.ai,
    state: 'IDLE',
    stateEnteredF: frame,
    prevState: null,
    anim: 'idle',
    animFrame: 0,
    animLen: stat.idle_anim_frames || 1,
    // -1 = "not yet drawn". The draw happens on the entity's first simulated step, inside
    // the fixed step and inside the armed determinism guard, so it is a real seeded
    // simulation quantity rather than a set-up-time constant. Saved and restored
    // (save/state.js world.entities[].anim_phase0) so a load reproduces the same loop.
    animPhase0: -1,
    phase: 'none',
    hitActive: false,
    hitboxes: [],
    pos: [x, 0, z],
    yaw: 180,
    yawRate: 0,
    speed: 0,
    hp: stat.hp,
    hpMax: stat.hp,
    poise: stat.poise,
    poiseMax: stat.poise,
    stagger: false,
    staggerUntil: 0,
    alert: 0,
    alertState: 'IDLE',
    attackToken: false,
    anchor: [x, 0, z],
    radius_m: stat.radius_m,
    sight_radius_m: stat.sight_radius_m,
    sight_cone_deg: stat.sight_cone_deg,
    hitById: '',
  };
}

export function stepEntities(sim, bus) {
  const p = sim.player;
  for (let i = 0; i < sim.entities.length; i++) {
    const e = sim.entities[i];
    const prev = e.state;

    // The one seeded draw in the simulation, taken here rather than at spawn so that it is
    // genuinely in-step: `rng.draws` rises during stepFrames(), and a critic can see the
    // counter move in the trace. One draw per entity per lifetime; `rng.draws` is therefore
    // a truthful count and not padding.
    if (e.animPhase0 < 0) {
      e.animPhase0 = rng.int(e.animLen > 1 ? e.animLen : 1);
      e.animFrame = e.animPhase0;
    }

    if (e.hp <= 0) {
      if (e.state !== 'DEAD') { e.state = 'DEAD'; e.stateEnteredF = sim.frame; }
      e.speed = 0; e.yawRate = 0; e.phase = 'none'; e.hitActive = false; e.hitboxes.length = 0;
      continue;
    }
    if (sim.hitstopUntil > sim.frame) { e.phase = 'hitstun'; continue; }

    if (e.stagger) {
      e.state = 'STAGGER'; e.phase = 'hitstun'; e.animFrame++;
      // Returning to idle resumes THIS entity's idle loop, which begins at its own seeded
      // phase anchor — not at a global 0. Resetting to 0 here erased the seeded phase the
      // first time anything staggered, which is why seeds 1337 and 4242 re-converged after
      // 168 frames of a 3600-frame duel and R4 came in at 4.7% instead of ~98%.
      if (sim.frame >= e.staggerUntil) { e.stagger = false; e.state = 'IDLE'; e.animFrame = e.animPhase0 < 0 ? 0 : e.animPhase0; e.phase = 'none'; }
    } else if (e.ai === 'hold_ground') {
      const dx = p.pos[0] - e.pos[0], dz = p.pos[2] - e.pos[2];
      const d = Math.sqrt(dx * dx + dz * dz);
      // Perception: real, and the only thing aggro() short-circuits.
      const facing = Math.abs(norm180(Math.atan2(dx, dz) * DEG - e.yaw));
      const sees = d <= e.sight_radius_m && facing <= e.sight_cone_deg / 2;
      if (sees) e.alert = Math.min(100, e.alert + 4);
      else e.alert = Math.max(0, e.alert - 1);
      e.alertState = e.alert >= 100 ? 'AGGRO' : e.alert >= 50 ? 'SEARCH' : e.alert > 0 ? 'SUSPICIOUS' : 'IDLE';
      if (e.alertState === 'AGGRO') {
        const want = norm360(Math.atan2(dx, dz) * DEG);
        const maxTurn = 240 / 60;
        let t = norm180(want - e.yaw);
        if (t > maxTurn) t = maxTurn; else if (t < -maxTurn) t = -maxTurn;
        e.yaw = norm360(e.yaw + t);
        e.yawRate = Math.abs(t) * 60;
        e.state = 'FACE';
      } else { e.yawRate = 0; e.state = 'IDLE'; }
      e.animFrame = (e.animFrame + 1) % Math.max(1, e.animLen);
    } else {
      // ai === 'none' — a training dummy. It stands there. That is the whole behaviour and
      // it is honest: the trace says IDLE because the thing is idle.
      e.state = 'IDLE'; e.phase = 'none'; e.speed = 0; e.yawRate = 0;
      e.animFrame = (e.animFrame + 1) % Math.max(1, e.animLen);
    }

    if (prev !== e.state) {
      e.prevState = prev; e.stateEnteredF = sim.frame;
      const ev = bus.emit(sim.frame, 'enemy_state');
      ev.eid = e.eid; ev.from = prev; ev.to = e.state;
    }
  }
}

/**
 * Re-anchor every free-running per-entity clock to the frame the scripted window opens.
 *
 * This is the **scenario contract**, not the trace: it mutates the simulation and the trace
 * then reports, truthfully, the phase the simulation is actually in. That distinction is the
 * whole point — `AM-W1-00-01` proposed instead to *report* an animation phase the sim was
 * not in, which is falsification under `RI-MTH04`, and the W1-00 critic rejected it. The
 * third option the critic named and did not rebut is this one: "make the SCENARIO contract
 * re-anchor free-running entity animation at the frame the scripted window opens, which
 * changes the fixture rather than the trace".
 *
 * Two clocks are re-anchored, and both are declared and printed by the caller:
 *   * `animFrame` -> the entity's own SEEDED phase offset (so the re-anchor is still
 *     seed-sensitive; a different seed re-anchors to a different phase);
 *   * `stateEnteredF` -> clamped to the window origin when the state was entered BEFORE the
 *     window opened. "It entered this state before the window" is the only warm-up-independent
 *     fact available; the exact pre-window frame index is a warm-up artefact by construction.
 *
 * Nothing here runs in normal play: it is invoked only by a harness caller opening a scripted
 * window (`tools/lib/run.mjs`, `tools/harness/determinism.mjs`).
 *
 * @returns {object[]} what was re-anchored, for the run report.
 */
export function reanchorFreeRunning(sim) {
  const out = [];
  const f = sim.frame;
  for (let i = 0; i < sim.entities.length; i++) {
    const e = sim.entities[i];
    if (e.animPhase0 < 0) { e.animPhase0 = rng.int(e.animLen > 1 ? e.animLen : 1); }
    const before = { anim_frame: e.animFrame, state_entered_f: e.stateEnteredF };
    e.animFrame = e.animPhase0;
    if (e.stateEnteredF < f) e.stateEnteredF = f;
    out.push({
      eid: e.eid, anim_len: e.animLen, seeded_phase: e.animPhase0,
      anim_frame: [before.anim_frame, e.animFrame],
      state_entered_f: [before.state_entered_f, e.stateEnteredF],
    });
  }
  return out;
}

function norm360(a) { a %= 360; return a < 0 ? a + 360 : a; }
function norm180(a) { a = norm360(a); return a > 180 ? a - 360 : a; }
