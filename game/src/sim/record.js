// The FrameRecord — `elder-souls/trace@1`, HARNESS.md §5.
//
// ONE function builds both `snapshot()` and every trace line. RI-MTH01 "How we lose" #5 is
// the reason: two subtly different shapes appear the moment there are two builders, and
// trace-stats.mjs then silently reads `undefined`.
//
// This runs OUTSIDE the fixed step, which is what lets the step itself be allocation-free —
// RI-PLT01 P4 excludes the trace record by name, and §C.3 additionally requires it to be
// built outside the step. It is called from `Engine._afterStep()`, which the two things that
// advance the simulation (`stepFrames` and the rAF accumulator) call AFTER
// `FixedLoop.stepOnce()` has returned.
//
// The previous build's comment said the same thing and was wrong: the record was built in
// `Engine._step()`, which IS the `stepOnce()` callback, so a CDP sampling profile showed
// `makeRecord <- _step <- stepOnce <- stepFrames` and 2,220 B/step inside the step. A comment
// cannot hold that line, so the first statement of makeRecord() now enforces it.
//
// Field contract, verbatim from §5: phase ∈ none|windup|active|recovery|turn|hitstun;
// alert_state ∈ IDLE|SUSPICIOUS|SEARCH|AGGRO; positions [x,y,z] metres; angles degrees;
// times milliseconds; stamina and hp absolute with `_max` alongside.
'use strict';

import { STEP_MS, inFixedStep } from '../core/loop.js';
import { rng } from '../core/rng.js';
import { ACTIONS, BIT } from '../input/actions.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const r2 = (v) => Math.round(v * 1e2) / 1e2;
const r3 = (v) => Math.round(v * 1e3) / 1e3;

const evBuf = [];

/**
 * @param {SimState} sim
 * @param {InputPipeline} input
 * @param {EventBus} bus
 * @param {object} opts {enemies, hitboxes, events, camera, perf}
 * @param {object|null} perf A-JRN5 per-frame perf block, or null
 */
export function makeRecord(sim, input, bus, opts, perf) {
  if (inFixedStep()) {
    throw new Error(
      'TRACE RECORD BUILT INSIDE THE FIXED STEP. RI-PLT01 §C.3 requires the frame record to ' +
      'be built outside the simulation step: it allocates ~2 KB, and a step that allocates is ' +
      'a GC pause during a boss windup. Build it from Engine._afterStep(), not from the ' +
      'FixedLoop.stepOnce() callback.');
  }
  const p = sim.player;
  const c = sim.camera;
  const rec = {
    f: sim.frame,
    t_ms: +(sim.frame * STEP_MS).toFixed(3),
    input: {
      move: [r4(input.moveX), r4(input.moveY)],
      look: [r4(input.lookXConsumed || 0), r4(input.lookYConsumed || 0)],
      held: input.heldNames().slice(),
      pressed: input.pressedNames().slice(),
      // RI-CMB11 §5 additions
      dispatch_lag: input.dispatchLag,
      buffered: input.bufferedAction ? bitName(input.bufferedAction) : null,
      catchup_steps: input.catchupSteps,
    },
    player: {
      pos: [r4(p.pos[0]), r4(p.pos[1]), r4(p.pos[2])],
      yaw_deg: r2(p.yaw),
      move_dir_deg: r2(p.moveDirDeg),        // RI-CAM02's requested field
      state: p.state,
      anim: p.anim,
      anim_frame: p.animFrame,
      anim_len: p.animLen,
      phase: p.phase,
      speed_mps: r3(p.speedMps),
      stamina: r3(p.stamina),
      stamina_max: p.staminaMax,
      stamina_regen_blocked: sim.frame < p.regenBlockUntil,
      hp: p.hp,
      hp_max: p.hpMax,
      poise_cur: p.poise,
      poise_max: p.poiseMax,
      iframe: p.iframe,
      iframe_kind: p.iframeKind,
      grounded: p.grounded,
      estus: p.estus,
      locked_on: p.lockOn,
      equip_load_pct: r2(p.equipLoadPct),
      roll_class: p.rollClass,
      hitboxes: opts.hitboxes === false ? [] : p.hitboxes.map(cloneHitbox),
      // ---- seam S19, RI-MAG01's harness amendment 2 -------------------------------------
      // `focus_locked` is true everywhere but a HEARTH: RI-MAG01 §A rules that Focus is
      // refilled ONLY by a rest and a respawn, and M3 asserts monotonic non-increase across a
      // 20-minute trace. Emitting the flag every frame is what makes that assertion cheap.
      focus: p.focus === undefined ? null : r4(p.focus),
      focus_max: p.focusMax === undefined ? null : p.focusMax,
      focus_locked: p.focusLocked === undefined ? null : p.focusLocked,
      attuned: p.attuned ? p.attuned.slice() : [],
      cast: p.cast || null,
      effects_active: p.effectsActive ? p.effectsActive.map((a) => ({ effect: a.effect, magnitude: r2(a.magnitude), remaining_f: a.remaining_f, source: a.source })) : [],
      levitating: !!p.levitating,
      airborne: !!p.airborne,
      altitude_m: p.altitudeM === undefined ? 0 : r3(p.altitudeM),
    },
    // The `camera` channel. Every field below is named by a method in RI-CAM01..07; the
    // items say in as many words that without it "every check scores 0, fail-closed".
    camera: {
      pos: [r4(c.pos[0]), r4(c.pos[1]), r4(c.pos[2])],
      pivot: [r4(c.pivot[0]), r4(c.pivot[1]), r4(c.pivot[2])],
      yaw_deg: r4(c.yaw),
      pitch_deg: r4(c.pitch),
      roll_deg: 0,                                  // RI-CAM06 §E: exactly 0, everywhere
      fov_deg: r4(c.fov),
      near_m: 0.10,
      far_m: 1200,
      dist_m: r4(c.dist),
      mode: c.mode,
      // RI-CAM01 §C — the spring arm, in the terms M2 and M4 measure it in.
      arm_len_m: r4(c.armLen),
      arm_desired_m: r4(c.armDesired),
      arm_cast_m: r4(c.armCast),
      arm_hit: c.armHit,
      arm_penetration_guard: c.armGuard,
      arm_clear_frames: c.clearFrames,
      shoulder: [r4(c.shoulderR), r4(c.shoulderU)],
      char_opacity: r4(c.charOpacity),
      shake: [r4(c.shakeYaw), r4(c.shakePitch)],    // rotational only, never positional
      hitstop: c.hitstop,
      clip_through: c.clipThrough,
      lock_on: p.lockOn,
      lock_target: p.lockOn,
      // RI-CAM03 §B/§E — the containment law, as per-frame anchors rather than a claim.
      onscreen: {
        player: c.onscreen.p,
        target: c.onscreen.t,
        target_head: c.onscreen.th,
        player_safe: c.onscreen.pSafe,
        target_safe: c.onscreen.tSafe,
        both: c.onscreen.both,
        target_band: c.onscreen.tBand,
        target_band_y: r4(c.onscreen.tBandY),
        player_ndc: [r4(c.onscreen.pNdc[0]), r4(c.onscreen.pNdc[1])],
        target_ndc: [r4(c.onscreen.tNdc[0]), r4(c.onscreen.tNdc[1])],
        target_head_ndc: [r4(c.onscreen.thNdc[0]), r4(c.onscreen.thNdc[1])],
      },
      contain_arm_m: r4(c.containArm),
      contain_pitch_deg: r4(c.containPitch),
      lock_dist_m: r4(c.lockDist),
      lock_height_m: r4(c.lockHeight),
      // RI-CAM02 §E — the auto-recentre gate, so "it only fires on a committed sprint" is
      // a boolean a critic reads rather than a sentence a builder writes.
      recentre_frames: c.recentreFrames,
      recentre_active: c.recentreActive,
      cell: sim.cellId || null,
    },
    enemies: opts.enemies === false ? [] : sim.entities.map((e) => enemyRecord(e, sim, opts)),
    events: opts.events === false ? [] : bus.snapshotInto(evBuf).slice(),
    rng: { draws: rng.draws, seed: rng.seed },
    env: {
      time_of_day: r3(sim.env.timeOfDay),
      weather: sim.env.weather,
      region: sim.env.region,
      interior: sim.env.interior,
    },
  };
  if (perf) rec.perf = perf;
  // W1-07: the composed sheet rides on the SNAPSHOT, not on every frame record. Two reasons,
  // both from the corpus: RI-CHR01 method 7 blinds a trace by stripping creation metadata,
  // which is easier when the frames never carried it; and RI-CHR02 method 8 needs the run to
  // be self-identifying, which snapshot.json + manifest.json already deliver.
  if (opts.character && sim.character) {
    const c = sim.character;
    rec.character = {
      given_name: c.given_name, hatch_name: c.hatch_name, sex: c.sex,
      race: c.race, upbringing: c.upbringing,
      class_id: c.class_id, class_name: c.class_name, class_family: c.class_family, class_route: c.class_route,
      birthsign: c.birthsign, birthsign_second: c.birthsign_second,
      signature: c.signature.key,
      attributes: c.attributes, skills: c.skills,
      powers: c.powers, drawbacks: c.drawbacks,
      invariants: c.invariants,
      writ_text: c.writ_text || null,
    };
  }
  return rec;
}

function enemyRecord(e, sim, opts) {
  const p = sim.player;
  const dx = e.pos[0] - p.pos[0], dz = e.pos[2] - p.pos[2];
  return {
    eid: e.eid,
    // W1-07 / RI-CHR02 method 8: "assert the enemy archetype and moveset ids are identical
    // across all three runs". Both are in every frame record so that assertion is a diff of
    // two trace files rather than a promise in a verdict.
    statblock: e.id,
    moveset: `enemy:${e.id}`,
    encounter: e.encounterId || null,
    encounter_role: e.encounterRole || null,
    archetype: e.archetype,
    tier: e.tier,
    state: e.state,
    state_entered_f: e.stateEnteredF,
    prev_state: e.prevState,
    anim: e.anim,
    anim_frame: e.animFrame,
    anim_len: e.animLen,
    phase: e.phase,
    hit_active: e.hitActive,
    hitboxes: opts.hitboxes === false ? [] : e.hitboxes.map(cloneHitbox),
    pos: [r4(e.pos[0]), r4(e.pos[1]), r4(e.pos[2])],
    yaw_deg: r2(e.yaw),
    yaw_rate_dps: r2(e.yawRate),
    speed_mps: r3(e.speed),
    target: e.alertState === 'AGGRO' ? 'player' : null,
    dist_m: r4(Math.sqrt(dx * dx + dz * dz)),
    los: true,
    in_sight_cone: inCone(e, -dx, -dz),   // bearing FROM the enemy TO the player
    alert: Math.round(e.alert),
    alert_state: e.alertState,
    attack_token: e.attackToken,
    hp: e.hp,
    hp_max: e.hpMax,
    poise_cur: e.poise,
    poise_max: e.poiseMax,
    stagger: e.stagger,
    spawn_anchor: [r4(e.anchor[0]), r4(e.anchor[1]), r4(e.anchor[2])],
    leash_dist_m: r3(Math.sqrt((e.pos[0] - e.anchor[0]) * (e.pos[0] - e.anchor[0]) + (e.pos[2] - e.anchor[2]) * (e.pos[2] - e.anchor[2]))),
    ai: e.ai,
  };
}

/** @param dx,dz the vector from the enemy to the player */
function inCone(e, dx, dz) {
  if (!e.sight_cone_deg) return false;
  const bearing = Math.atan2(dx, dz) * 180 / Math.PI;
  let d = (bearing - e.yaw) % 360; if (d > 180) d -= 360; if (d < -180) d += 360;
  return Math.abs(d) <= e.sight_cone_deg / 2;
}

function cloneHitbox(h) {
  return {
    id: h.id, owner: h.owner, kind: h.kind,
    a: [r4(h.a[0]), r4(h.a[1]), r4(h.a[2])],
    b: [r4(h.b[0]), r4(h.b[1]), r4(h.b[2])],
    r: h.r, active_f: h.active_f, dmg: h.dmg, poise_dmg: h.poise_dmg, hits: h.hits.slice(),
    // RI-MAG01 harness amendment 3: `kind` gains "projectile" and "volume", and the optional
    // fields a critic needs to recompute a sweep or check AP-M2/AP-M3 offline. They are
    // present only on spell geometry, so a weapon record is byte-identical to what W1-09 emits.
    ...(h.spell === undefined ? {} : {
      spell: h.spell, speed_mps: h.speed_mps, turn_rate_dps: h.turn_rate_dps,
      travel_f: h.travel_f, ticks_every_f: h.ticks_every_f,
      decal_spawn_f: h.decal_spawn_f, decal_r: h.decal_r,
      prev_a: h.prev_a ? [r4(h.prev_a[0]), r4(h.prev_a[1]), r4(h.prev_a[2])] : undefined,
      prev_b: h.prev_b ? [r4(h.prev_b[0]), r4(h.prev_b[1]), r4(h.prev_b[2])] : undefined,
    }),
  };
}

function bitName(bit) {
  for (let i = 0; i < ACTIONS.length; i++) if (BIT[ACTIONS[i]] === bit) return ACTIONS[i];
  return null;
}
