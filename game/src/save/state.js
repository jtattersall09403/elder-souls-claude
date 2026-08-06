// The save blob: a projection of SimState, and the thing RI-JRN05 diffs.
//
// Design decisions that the item forces, each recorded so they are not re-litigated:
//
//  * **Frame-relative timers.** `regenBlockUntil`, `actionableAt`, `staggerUntil` and
//    friends are absolute frame indices in the running sim. The current frame index is a
//    DECLARED VOLATILE field (RI-JRN05 §B), so storing absolute indices would make the
//    round-trip hash depend on when you saved. They are therefore serialised as *offsets*
//    (`..._in_frames`) and rebuilt against the loaded frame. This is why `loadState()` can
//    reset the frame to 0 (RI-MTH01 A07) and still round-trip to an identical hash.
//
//  * **Incidental arrays are sorted by stable id before serialisation** (§C rule 2);
//    semantic arrays — the journal, souls-spent history — keep their order and say so in
//    `game/data/save-manifest.json`.
//
//  * **The RNG's draw counter is in the blob** (§B "RNG"). A load that restarts the PRNG
//    passes every field check and then diverges 600 frames later — RI-JRN05 M5 and
//    "How we lose" #5.
//
//  * Nothing here is `undefined`, `NaN` or a class instance: `canonicalise()` throws on
//    those rather than letting state hide in a closure (§C rule 4).
'use strict';

import { rng } from '../core/rng.js';
import { canonicalise } from '../core/canonical.js';
import { sha256 } from '../core/sha256.js';

export const SAVE_SCHEMA_VERSION = 1;

/** Paths excluded from the round-trip diff. CLOSED — RI-JRN05 rule V1. */
export const VOLATILE_PATHS = [
  'volatile.written_at',
  'volatile.playtime_seconds',
  'volatile.frame',
  'volatile.thumbnail',
  'volatile.ui_focus',
  'volatile.audio_bus',
];

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const vec = (v) => [r6(v[0]), r6(v[1]), r6(v[2])];
const rel = (absFrame, now) => Math.max(0, absFrame - now);

/**
 * @param {SimState} sim
 * @param {object} build build info, stamped into meta
 */
export function buildSave(sim, build) {
  const p = sim.player;
  const c = sim.camera;
  const f = sim.frame;
  return {
    meta: {
      schema: 'elder-souls/save@1',
      schema_version: SAVE_SCHEMA_VERSION,
      build_commit: build.commit || null,
      build_version: build.version || null,
      harness_version: build.harnessVersion || 1,
      state_name: sim.stateName,
    },
    identity: {
      name: sim.identity.name,
      race: sim.identity.race,
      sign: sim.identity.sign,
      profession: sim.identity.profession,
      document: sim.identity.document || '',
    },
    character: {
      level: sim.progression.level,
      souls_held: sim.progression.soulsHeld,
      attributes: { ...sim.progression.attributes },
      skills: sortedSkillMap(sim.progression.skills),
      hp: r6(p.hp), hp_max: p.hpMax,
      stamina: r6(p.stamina), stamina_max: p.staminaMax,
      poise: r6(p.poise), poise_max: p.poiseMax,
      estus: p.estus,
      equip_load_pct: r6(p.equipLoadPct),
      roll_class: p.rollClass,
    },
    inventory: sim.inventory.map((i) => ({
      id: i.id, count: i.count, condition: r6(i.condition), charge: r6(i.charge),
      stolen: !!i.stolen, owner_of_record: i.owner || null,
      equipped_slot: i.slot || null, quick_slot: i.quickSlot === undefined ? null : i.quickSlot,
    })).sort(byId),
    progression: {
      souls_spent: sim.progression.soulsSpent,
      hearths_discovered: [...sim.progression.hearthsDiscovered].sort(),
      hearth_last_rested: sim.progression.hearthLastRested,
      upgrades: sortedMap(sim.progression.upgrades),
    },
    quests: sortedQuestMap(sim.quest.quests),
    quests_completed: [...sim.quest.completed].sort(),
    journal: sim.quest.journal.map((e) => ({ n: e.n, date: e.date, quest: e.quest, text: e.text })), // ORDER IS SEMANTIC
    dialogue: {
      topics_known: [...sim.quest.topicsKnown].sort(),
      dispositions: sortedMap(sim.quest.dispositions),
    },
    factions: sortedMap(sim.quest.factions),
    crime: {
      bounty: sortedMap(sim.quest.crime.bounty),
      witnesses: [...sim.quest.crime.witnesses].sort(),
      stolen_registry: [...sim.quest.crime.stolen].sort(),
      hunting: [...sim.quest.crime.hunting].sort(),
    },
    world: {
      // The seed the procedural world was generated from. Durable because the world IS the
      // save: reloading into a differently generated fen would move the ground under the
      // player's saved position. `null` for an authored cell, which generates nothing.
      gen_seed: sim.worldSeed === undefined ? null : sim.worldSeed,
      containers_emptied: [...sim.world.containersEmptied].sort(),
      doors_unlocked: [...sim.world.doorsUnlocked].sort(),
      shortcuts_opened: [...sim.world.shortcutsOpened].sort(),
      items_taken: [...sim.world.itemsTaken].sort(),
      dropped_items: sim.world.droppedItems.map((d) => ({ id: d.id, pos: vec(d.pos) })).sort(byId),
      npcs_dead: [...sim.world.npcsDead].sort(),
      enemies_dead_until_rest: [...sim.world.enemiesDeadUntilRest].sort(),
      fog_gates_passed: [...sim.world.fogGatesPassed].sort(),
      // ENTITY RECORD — the field set is enumerated in game/data/save-manifest.json under the
      // World group (`entity_record_fields`), and `getDurableFieldCensus()` checks the LIVE
      // entity object's own key set against it on every audit run. That census exists because
      // of GAP-W1-platform-save-drops-entity-prev-state: `prev_state` was missing here, the
      // round trip restored it as `null`, and RI-JRN05 M5's control and loaded traces differed
      // on 219 of 600 frames — a defect that survived a whole verdict because nothing compared
      // the two field sets. A missing field is now a loud audit failure, not a silent one.
      entities: sim.entities.map((e) => ({
        id: e.id, eid: e.eid, pos: vec(e.pos), yaw_deg: r6(e.yaw),
        yaw_rate_dps: r6(e.yawRate), speed_mps: r6(e.speed),
        hp: e.hp, poise: e.poise, alert: e.alert, alert_state: e.alertState,
        state: e.state,
        // The state the entity was in BEFORE the current one. Durable: the first transition
        // after a reload is taken from a predecessor, and a session that has forgotten its
        // predecessor takes a different one — RI-JRN05 "how we lose" #5, measured.
        prev_state: e.prevState,
        anim: e.anim, anim_frame: e.animFrame,
        // The entity's SEEDED idle-loop phase offset (sim/entities.js). Durable, because a
        // load that redrew it would put the loop somewhere else and the post-load tail would
        // diverge from the control 48 frames later — RI-JRN05 M5's whole subject.
        anim_phase0: e.animPhase0,
        // `phase` and `yaw_rate_dps` above survive stepEntities' two `continue` paths
        // (hitstop and death), so a save taken during hitstop restores a stale-free value
        // only if it is carried. `hit_by_id` is the per-swing hit-dedupe key: without it a
        // save/load in the middle of an active hitbox lets the SAME swing hit the same
        // entity a second time. `attack_token` and `hit_active` are wave-1-constant but are
        // real mutable entity state and are carried rather than assumed.
        phase: e.phase, hit_active: e.hitActive, attack_token: e.attackToken,
        hit_by_id: e.hitById,
        anchor: vec(e.anchor),
        stagger: e.stagger, stagger_in_frames: rel(e.staggerUntil, f),
        state_entered_ago_frames: Math.max(0, f - e.stateEnteredF),
      })).sort((a, b) => (a.eid < b.eid ? -1 : a.eid > b.eid ? 1 : 0)),
    },
    death: { bloodstain: sim.quest.death.bloodstain ? {
      pos: vec(sim.quest.death.bloodstain.pos),
      souls: sim.quest.death.bloodstain.souls,
      death_index: sim.quest.death.bloodstain.death_index,
    } : null },
    afflictions: sim.quest.afflictions.map((a) => ({
      id: a.id, kind: a.kind, incubation_in_frames: a.incubation_in_frames, duration_in_frames: a.duration_in_frames,
    })).sort(byId),
    travel: {
      nodes_visited: [...sim.quest.travel.nodesVisited].sort(),
      mark: sim.quest.travel.mark ? vec(sim.quest.travel.mark) : null,
    },
    clock: {
      time_of_day: r6(sim.env.timeOfDay),
      day_count: sim.env.dayCount,
      weather: sim.env.weather,
    },
    pose: {
      pos: vec(p.pos),
      yaw_deg: r6(p.yaw),
      region: sim.env.region,
      interior: sim.env.interior,
      camera_yaw_deg: r6(c.yaw),
      camera_pitch_deg: r6(c.pitch),
      camera_dist_m: r6(c.dist),
      camera_mode: c.mode,
      // Camera shake is rotational, seeded and decaying (sim/camera.js). `shakeYaw` and
      // `shakePitch` are RE-DERIVED every step from these two plus the frame and the PRNG,
      // so carrying the amplitude and the remaining frames restores the whole shake exactly.
      // Nothing in wave 1 calls triggerShake(), so both are 0 on every save this build can
      // write; they are carried anyway because the moment RI-CAM06's impact shake is wired
      // up, a save during a shake would otherwise reload into a still camera.
      camera_shake_amp_deg: r6(c.shakeAmp),
      camera_shake_in_frames: rel(c.shakeUntil, f),
      locked_on: p.lockOn,
      // frame-relative, so the hash does not depend on when you saved
      state: p.state, anim: p.anim, anim_frame: p.animFrame, anim_len: p.animLen,
      move: p.move, phase: p.phase,
      // Both persist ACROSS frames rather than being recomputed on every one: `move_dir_deg`
      // is assigned only while the player is moving and keeps its last value while standing
      // still, and `speed_mps` is not touched by the hitstop early-return. Both are in the
      // frame record (player.move_dir_deg, player.speed_mps), so dropping them diverged the
      // post-load trace in exactly the way `prev_state` did.
      move_dir_deg: r6(p.moveDirDeg),
      speed_mps: r6(p.speedMps),
      regen_block_in_frames: rel(p.regenBlockUntil, f),
      actionable_in_frames: rel(p.actionableAt, f),
      hitstop_in_frames: rel(sim.hitstopUntil, f),
      // Not an absolute frame index and therefore not re-based: the swing counter is
      // durable as it stands, and `enemies[].hit_by_id` refers to it, so both sides of the
      // hit-dedupe key survive a load together. See sim/state.js for what this replaced.
      swing_seq: p.swingSeq,
    },
    rng: rng.saveRngState(),
    flags: sortedMap(sim.quest.flags),
    volatile: {
      written_at: '',            // filled by the store at write time
      playtime_seconds: 0,
      frame: f,
      thumbnail: '',
      ui_focus: '',
      audio_bus: '',
    },
  };
}

/**
 * Restore. `frame` is reset to 0 (RI-MTH01 A07: "world present, frame reset"), and every
 * frame-relative offset is rebased against it.
 */
export function applySave(sim, blob, moves, statFor) {
  if (!blob || typeof blob !== 'object') throw new Error('loadState: save blob must be an object');
  if (!blob.meta || blob.meta.schema !== 'elder-souls/save@1') {
    throw new Error(`loadState: not an elder-souls/save@1 blob (got ${blob.meta && blob.meta.schema})`);
  }
  if (blob.meta.schema_version > SAVE_SCHEMA_VERSION) {
    // CR4: a save from the future is REFUSED. No partial load, ever.
    const e = new Error(
      `This ledger was written in a hand later than ours (schema ${blob.meta.schema_version}; ` +
      `this build reads ${SAVE_SCHEMA_VERSION}). It will not be opened, and it has not been changed.`);
    e.code = 'SCHEMA_FROM_FUTURE';
    throw e;
  }
  if (blob.meta.schema_version < SAVE_SCHEMA_VERSION) {
    // CR5: a declared migration runs, or the save is refused. There is no silent partial load.
    const e = new Error(
      `This ledger was written in an older hand (schema ${blob.meta.schema_version}) and no ` +
      'migration to the present one has been written. It will not be opened, and it has not been changed.');
    e.code = 'SCHEMA_NO_MIGRATION';
    throw e;
  }

  sim.reset(blob.rng.seed, blob.meta.state_name || 'loaded');
  const f = 0;
  const p = sim.player, c = sim.camera;

  sim.identity.name = blob.identity.name;
  sim.identity.race = blob.identity.race;
  sim.identity.sign = blob.identity.sign;
  sim.identity.profession = blob.identity.profession;
  sim.identity.document = blob.identity.document;

  sim.progression.level = blob.character.level;
  sim.progression.soulsHeld = blob.character.souls_held;
  sim.progression.attributes = { ...blob.character.attributes };
  sim.progression.skills = {};
  for (const k of Object.keys(blob.character.skills)) {
    sim.progression.skills[k] = { value: blob.character.skills[k].value, useProgress: blob.character.skills[k].use_progress };
  }
  sim.progression.soulsSpent = blob.progression.souls_spent;
  sim.progression.hearthsDiscovered = [...blob.progression.hearths_discovered];
  sim.progression.hearthLastRested = blob.progression.hearth_last_rested;
  sim.progression.upgrades = { ...blob.progression.upgrades };

  p.hp = blob.character.hp; p.hpMax = blob.character.hp_max;
  p.stamina = blob.character.stamina; p.staminaMax = blob.character.stamina_max;
  p.poise = blob.character.poise; p.poiseMax = blob.character.poise_max;
  p.estus = blob.character.estus;
  p.equipLoadPct = blob.character.equip_load_pct;
  p.rollClass = blob.character.roll_class;

  sim.inventory = blob.inventory.map((i) => ({
    id: i.id, count: i.count, condition: i.condition, charge: i.charge,
    stolen: i.stolen, owner: i.owner_of_record, slot: i.equipped_slot, quickSlot: i.quick_slot,
  }));

  // The save uses snake_case; the sim uses camelCase. Restoring the RAW save record here
  // is the bug this project is most likely to ship: everything loads, everything looks
  // right, and the next saveState() reads `giverDispositionDelta` off a record that only
  // has `giver_disposition_delta`, so the field silently becomes 0. RI-JRN05 M1 caught
  // exactly this. The mapping is therefore explicit in BOTH directions.
  sim.quest.quests = {};
  for (const id of Object.keys(blob.quests)) {
    const q = blob.quests[id];
    sim.quest.quests[id] = {
      stage: q.stage,
      branch: q.branch,
      failed: !!q.failed,
      giverDispositionDelta: q.giver_disposition_delta,
      timeLimitInFrames: q.time_limit_in_frames,
      flags: { ...q.flags },
    };
  }
  sim.quest.completed = [...blob.quests_completed];
  sim.quest.journal = blob.journal.map((e) => ({ n: e.n, date: e.date, quest: e.quest, text: e.text }));
  sim.quest.topicsKnown = [...blob.dialogue.topics_known];
  sim.quest.dispositions = { ...blob.dialogue.dispositions };
  sim.quest.factions = deepCopy(blob.factions);
  sim.quest.crime.bounty = { ...blob.crime.bounty };
  sim.quest.crime.witnesses = [...blob.crime.witnesses];
  sim.quest.crime.stolen = [...blob.crime.stolen_registry];
  sim.quest.crime.hunting = [...blob.crime.hunting];
  sim.quest.flags = { ...blob.flags };
  sim.quest.afflictions = blob.afflictions.map((a) => ({ ...a }));
  sim.quest.travel.nodesVisited = [...blob.travel.nodes_visited];
  sim.quest.travel.mark = blob.travel.mark ? [...blob.travel.mark] : null;
  sim.quest.death.bloodstain = blob.death.bloodstain ? { ...blob.death.bloodstain, pos: [...blob.death.bloodstain.pos] } : null;

  sim.worldSeed = blob.world.gen_seed === undefined ? null : blob.world.gen_seed;
  sim.world.containersEmptied = [...blob.world.containers_emptied];
  sim.world.doorsUnlocked = [...blob.world.doors_unlocked];
  sim.world.shortcutsOpened = [...blob.world.shortcuts_opened];
  sim.world.itemsTaken = [...blob.world.items_taken];
  sim.world.droppedItems = blob.world.dropped_items.map((d) => ({ id: d.id, pos: [...d.pos] }));
  sim.world.npcsDead = [...blob.world.npcs_dead];
  sim.world.enemiesDeadUntilRest = [...blob.world.enemies_dead_until_rest];
  sim.world.fogGatesPassed = [...blob.world.fog_gates_passed];

  sim.entities.length = 0;
  sim.nextEid = 0;
  for (const es of blob.world.entities) {
    const e = statFor(es.id, es.eid, es.pos[0], es.pos[2], f);
    e.pos[1] = es.pos[1];
    e.yaw = es.yaw_deg; e.hp = es.hp; e.poise = es.poise;
    e.alert = es.alert; e.alertState = es.alert_state; e.state = es.state;
    e.prevState = es.prev_state === undefined ? null : es.prev_state;
    e.anim = es.anim; e.phase = es.phase;
    e.yawRate = es.yaw_rate_dps; e.speed = es.speed_mps;
    e.hitActive = es.hit_active; e.attackToken = es.attack_token; e.hitById = es.hit_by_id;
    e.animFrame = es.anim_frame; e.anchor[0] = es.anchor[0]; e.anchor[1] = es.anchor[1]; e.anchor[2] = es.anchor[2];
    e.animPhase0 = es.anim_phase0 === undefined ? -1 : es.anim_phase0;
    e.stagger = es.stagger; e.staggerUntil = f + es.stagger_in_frames;
    e.stateEnteredF = f - es.state_entered_ago_frames;
    sim.addEntity(e);
    const n = parseInt(String(es.eid).replace(/\D+/g, ''), 10);
    if (Number.isFinite(n) && n >= sim.nextEid) sim.nextEid = n + 1;
  }

  sim.env.timeOfDay = blob.clock.time_of_day;
  sim.env.dayCount = blob.clock.day_count;
  sim.env.weather = blob.clock.weather;
  sim.env.region = blob.pose.region;
  sim.env.interior = blob.pose.interior;

  p.pos[0] = blob.pose.pos[0]; p.pos[1] = blob.pose.pos[1]; p.pos[2] = blob.pose.pos[2];
  p.yaw = blob.pose.yaw_deg;
  p.state = blob.pose.state; p.anim = blob.pose.anim;
  p.animFrame = blob.pose.anim_frame; p.animLen = blob.pose.anim_len;
  p.phase = blob.pose.phase;
  p.move = blob.pose.move;
  p.moveData = blob.pose.move ? moves[blob.pose.move] || null : null;
  p.regenBlockUntil = f + blob.pose.regen_block_in_frames;
  p.actionableAt = f + blob.pose.actionable_in_frames;
  p.swingSeq = blob.pose.swing_seq;
  p.lockOn = blob.pose.locked_on;
  p.moveDirDeg = blob.pose.move_dir_deg;
  p.speedMps = blob.pose.speed_mps;
  sim.hitstopUntil = f + blob.pose.hitstop_in_frames;

  c.yaw = blob.pose.camera_yaw_deg;
  c.pitch = blob.pose.camera_pitch_deg;
  c.dist = blob.pose.camera_dist_m;
  c.mode = blob.pose.camera_mode;
  c.shakeAmp = blob.pose.camera_shake_amp_deg;
  c.shakeUntil = f + blob.pose.camera_shake_in_frames;

  rng.loadRngState(blob.rng);
  return { ok: true, frame: sim.frame, seed: rng.seed };
}

/** The hash input: the save with every declared-volatile path removed. */
export function hashSource(blob) {
  const copy = deepCopy(blob);
  for (const path of VOLATILE_PATHS) {
    const parts = path.split('.');
    let o = copy;
    for (let i = 0; i < parts.length - 1 && o; i++) o = o[parts[i]];
    if (o) delete o[parts[parts.length - 1]];
  }
  if (copy.volatile && Object.keys(copy.volatile).length === 0) delete copy.volatile;
  return copy;
}

export function stateHash(blob) { return sha256(canonicalise(hashSource(blob))); }

function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
function sortedMap(m) {
  const out = {};
  for (const k of Object.keys(m).sort()) out[k] = typeof m[k] === 'object' && m[k] !== null ? deepCopy(m[k]) : m[k];
  return out;
}
function sortedSkillMap(m) {
  const out = {};
  for (const k of Object.keys(m).sort()) out[k] = { value: m[k].value, use_progress: r6(m[k].useProgress) };
  return out;
}
function sortedQuestMap(m) {
  const out = {};
  for (const k of Object.keys(m).sort()) {
    const q = m[k];
    out[k] = {
      stage: q.stage, branch: q.branch === undefined ? null : q.branch,
      failed: !!q.failed, giver_disposition_delta: q.giverDispositionDelta || 0,
      time_limit_in_frames: q.timeLimitInFrames === undefined ? null : q.timeLimitInFrames,
      flags: sortedMap(q.flags || {}),
    };
  }
  return out;
}
