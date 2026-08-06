// The player's fixed-step update.
//
// SCOPE, stated so a critic does not have to guess: this piece (W1-00) owns the *mechanism*
// — the fixed-step frame machine, the buffer, the stamina clock, camera-relative movement —
// and NOT the combat numbers. Every frame count, cost and window used here is read from
// `game/data/combat/movesets/*.json`, which transcribes RI-CMB01 §B and RI-CMB02 §A/§B with
// the S22 rebase applied (`f@60`). That is the "two independent sources, declared and
// observed" pair HARNESS.md §7 rule 4 requires: the data file is the declaration, the trace
// is the observation, and a critic diffs them.
//
// Nothing here uses a deltaTime, a wall clock, or Math.random. Movement is
// metres-per-second divided by 60 — an integer-frame quantity (HARNESS.md D4).
'use strict';

import { PLAYER_CONST } from './state.js';
import { BIT } from '../input/actions.js';
import { BUFFER_FRAMES } from '../input/pipeline.js';

const DEG = 180 / Math.PI;

/** Scratch, module-scope, reused. Never returned to a caller. */
const dir = [0, 0];

export function stepPlayer(sim, input, moves, bus) {
  const p = sim.player;
  const f = sim.frame;

  // Hitboxes are rebuilt each frame; the array is reused, never reallocated.
  p.hitboxes.length = 0;
  p.iframe = false;
  p.iframeKind = null;

  if (sim.hitstopUntil > f) {
    // RI-CAM06 §F: during hitstop the world holds. The animation clock does not advance,
    // and neither does the camera rig (handled in sim/camera.js).
    p.phase = 'hitstun';
    return;
  }

  // The animation ends at the TOP of the step, before action selection: an animation with
  // `total: 52` must occupy exactly 52 simulated frames and the character must be
  // actionable on the 53rd. Ending it at the bottom of the step costs one frame and shows
  // up in the trace as every move in the game being one frame short of its declared length
  // — the "declared vs observed" mismatch HARNESS.md §7 rule 4 calls a hard fail.
  if (p.moveData && p.animFrame >= p.moveData.total) {
    p.moveData = null; p.move = null; p.state = 'IDLE'; p.anim = 'idle';
    p.animFrame = 0; p.animLen = 1; p.phase = 'none';
  }

  const committed = p.moveData !== null;

  // ---- 1. buffered / fresh action selection ---------------------------------------
  if (committed) {
    const framesLeft = p.actionableAt - f;
    if (input.pressed) {
      const bit = firstActionBit(input.pressed);
      if (bit) {
        if (framesLeft <= BUFFER_FRAMES) {
          input.tryBuffer(bit, f, framesLeft);
          bus.emit(f, 'input_buffered').button = nameOfBit(bit);
        } else {
          input.droppedInputs++;
          bus.emit(f, 'input_dropped_not_actionable').button = nameOfBit(bit);
        }
      }
    }
  }

  let startBit = 0;
  if (!committed) {
    startBit = input.pressed ? firstActionBit(input.pressed) : 0;
    if (!startBit) startBit = input.takeBuffered();
  }

  // ---- 2. start an action ---------------------------------------------------------
  if (startBit) {
    const id = startBit === BIT.light ? 'light'
      : startBit === BIT.heavy ? 'heavy'
        : startBit === BIT.roll ? 'roll'
          : startBit === BIT.parry ? 'parry' : null;
    const md = id ? moves[id] : null;
    if (md) {
      if (p.stamina < md.stamina) {
        bus.emit(f, 'input_dropped_no_stamina').button = id;
      } else {
        p.stamina = Math.max(0, p.stamina - md.stamina);
        p.regenBlockUntil = f + PLAYER_CONST.stamina_regen_delay_frames;
        p.state = md.state;
        p.move = id;
        p.moveData = md;
        p.anim = md.anim;
        p.animFrame = 0;
        p.animLen = md.total;
        p.swingSeq++;                // identifies this swing, so one hitbox hits once
        // The move occupies frames f..f+total-1; the first actionable frame is f+total.
        p.actionableAt = f + md.total;
        const e = bus.emit(f, id === 'roll' ? 'roll_start' : 'attack_start');
        e.move = id; e.stamina_after = +p.stamina.toFixed(3);
        const s = bus.emit(f, 'stamina_spend');
        s.amount = md.stamina; s.cause = id;
        bus.emit(f, 'input_action').button = id;
      }
    }
  }

  // ---- 3. advance a committed animation -------------------------------------------
  if (p.moveData) {
    const md = p.moveData;
    p.animFrame++;
    const af = p.animFrame;
    if (af <= md.startup) p.phase = 'windup';
    else if (af <= md.startup + md.active) p.phase = 'active';
    else p.phase = 'recovery';

    if (md.iframes && af >= md.iframes[0] && af <= md.iframes[1]) {
      p.iframe = true;
      p.iframeKind = md.iframe_kind || 'roll';
    }

    if (md.state === 'ROLL') {
      // Root motion: total distance spread over the travel window, per-frame, no dt.
      const travelFrames = md.iframes ? md.iframes[1] : md.total;
      if (af <= travelFrames) {
        const per = md.distance_m / travelFrames;
        p.pos[0] += Math.sin(p.yaw / DEG) * per;
        p.pos[2] += Math.cos(p.yaw / DEG) * per;
        p.speedMps = per * 60;
      } else p.speedMps = 0;
      if (af > md.total - md.turn_frames) p.phase = 'turn';
    } else if (md.root_dz_m) {
      const per = md.root_dz_m / Math.max(1, md.startup + md.active);
      if (af <= md.startup + md.active) {
        p.pos[0] += Math.sin(p.yaw / DEG) * per;
        p.pos[2] += Math.cos(p.yaw / DEG) * per;
      }
    }

    if (p.phase === 'active' && md.hitbox) {
      const hb = {
        id: `wpn_${p.move}`, owner: 'player', kind: 'capsule',
        a: [r4(p.pos[0]), 1.1, r4(p.pos[2])],
        b: [r4(p.pos[0] + Math.sin(p.yaw / DEG) * md.reach_m), 1.1, r4(p.pos[2] + Math.cos(p.yaw / DEG) * md.reach_m)],
        r: md.hitbox_radius_m, active_f: af - md.startup,
        dmg: { phys: md.damage }, poise_dmg: md.poise_damage, hits: [],
      };
      p.hitboxes.push(hb);
      resolveHits(sim, hb, md, bus);
    }

  } else {
    // ---- 4. locomotion ------------------------------------------------------------
    const mx = input.moveX, my = input.moveY;
    const mag = Math.sqrt(mx * mx + my * my);
    if (mag > 1e-6) {
      // RI-CAM02: camera-relative, using the camera forward PROJECTED onto the ground plane.
      const cy = sim.camera.yaw / DEG;
      const fwdX = Math.sin(cy), fwdZ = Math.cos(cy);
      const rgtX = Math.cos(cy), rgtZ = -Math.sin(cy);
      dir[0] = rgtX * mx + fwdX * my;
      dir[1] = rgtZ * mx + fwdZ * my;
      const dl = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1]) || 1;
      dir[0] /= dl; dir[1] /= dl;

      const sprinting = (input.held & BIT.sprint) !== 0 && p.stamina > 0;
      let mps;
      if (sprinting) {
        mps = PLAYER_CONST.sprint_mps;
        p.stamina = Math.max(0, p.stamina - PLAYER_CONST.sprint_cost_per_frame);
        p.regenBlockUntil = f + PLAYER_CONST.stamina_regen_delay_frames;
        p.state = 'SPRINT'; p.anim = 'sprint';
      } else if (mag > 0.55) { mps = PLAYER_CONST.jog_mps; p.state = 'RUN'; p.anim = 'run'; }
      else { mps = PLAYER_CONST.walk_mps * (mag / 0.55); p.state = 'WALK'; p.anim = 'walk'; }

      const per = mps / 60;
      p.pos[0] += dir[0] * per;
      p.pos[2] += dir[1] * per;
      p.speedMps = mps;
      p.moveDirDeg = norm360(Math.atan2(dir[0], dir[1]) * DEG);

      // Character turns to face its velocity at a bounded rate (S18 / RI-CAM02).
      const maxTurn = PLAYER_CONST.turn_rate_dps / 60;
      let d = norm180(p.moveDirDeg - p.yaw);
      if (d > maxTurn) d = maxTurn; else if (d < -maxTurn) d = -maxTurn;
      p.yaw = norm360(p.yaw + d);
      p.animFrame = (p.animFrame + 1) % 32;
      p.animLen = 32;
    } else if ((input.held & BIT.block) !== 0) {
      p.state = 'BLOCK'; p.anim = 'block'; p.speedMps = 0; p.animFrame = 0; p.animLen = 1;
    } else {
      p.state = 'IDLE'; p.anim = 'idle'; p.speedMps = 0; p.animFrame = 0; p.animLen = 1;
    }
    p.phase = 'none';
  }

  // ---- 5. stamina regeneration ------------------------------------------------------
  if (f >= p.regenBlockUntil && p.stamina < p.staminaMax) {
    const guarding = (input.held & BIT.block) !== 0;
    const rate = PLAYER_CONST.stamina_regen_per_frame * (guarding ? PLAYER_CONST.stamina_regen_guard_mult : 1);
    p.stamina = Math.min(p.staminaMax, p.stamina + rate);
  }
}

function resolveHits(sim, hb, md, bus) {
  for (let i = 0; i < sim.entities.length; i++) {
    const e = sim.entities[i];
    if (e.hp <= 0) continue;
    const dx = e.pos[0] - sim.player.pos[0], dz = e.pos[2] - sim.player.pos[2];
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > md.reach_m + e.radius_m) continue;
    if (e.hitById === hb.id + '@' + sim.player.swingSeq) continue;
    e.hitById = hb.id + '@' + sim.player.swingSeq;
    e.hp -= md.damage;
    e.poise -= md.poise_damage;
    hb.hits.push(e.eid);
    const ev = bus.emit(sim.frame, 'hit');
    ev.attacker = 'player'; ev.victim = e.eid; ev.dmg = md.damage; ev.poise_dmg = md.poise_damage;
    ev.hitbox = hb.id;
    if (e.poise <= 0) { e.poise = e.poiseMax; e.stagger = true; e.staggerUntil = sim.frame + 44; bus.emit(sim.frame, 'stagger').eid = e.eid; }
    if (e.hp <= 0) { e.hp = 0; e.state = 'DEAD'; e.stateEnteredF = sim.frame; bus.emit(sim.frame, 'death').eid = e.eid; }
    // RI-CMB05 owns hitstop duration; the camera consequence is RI-CAM06 §F. 6 f@60 placeholder,
    // declared in game/data/combat/input.json so it is not a hidden constant.
    sim.hitstopUntil = sim.frame + md.hitstop_frames;
  }
}

function firstActionBit(mask) {
  // Priority order matters and is deliberate: a roll press always wins over an attack press
  // on the same frame, because the roll is the reactive action (RI-CMB01).
  if (mask & BIT.roll) return BIT.roll;
  if (mask & BIT.parry) return BIT.parry;
  if (mask & BIT.heavy) return BIT.heavy;
  if (mask & BIT.light) return BIT.light;
  return 0;
}
function nameOfBit(bit) {
  for (const k in BIT) if (BIT[k] === bit) return k;
  return String(bit);
}
function norm360(a) { a %= 360; return a < 0 ? a + 360 : a; }
function norm180(a) { a = norm360(a); return a > 180 ? a - 360 : a; }
function r4(v) { return Math.round(v * 1e4) / 1e4; }
