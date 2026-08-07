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
import { saveFight } from './fight.js';

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
      // W1-07 — every field the Warden-Scribe wrote down. RI-CHR01 §7: none of these is
      // reversible except `given_name` (once, 250 g) and `birthsign` (once, at Helstrom), so
      // they are durable by definition and the save is where that is enforced.
      creation: saveCreation(sim.character),
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
      // RI-PRG07 §3. Both were live fields with no save field at all: a character carrying
      // forty-four objects reloaded unburdened.
      carried_weight: r6(p.carriedWeight || 0),
      burden_ratio: r6(p.burdenRatio || 0),
    },
    inventory: sim.inventory.map((i) => ({
      id: i.id, count: i.count, condition: r6(i.condition), charge: r6(i.charge),
      stolen: !!i.stolen, owner_of_record: i.owner || null,
      equipped_slot: i.slot || null, quick_slot: i.quickSlot === undefined ? null : i.quickSlot,
    })).sort(byId),
    progression: {
      souls_spent: sim.progression.soulsSpent,
      // Money. Read by the parley's price gate and by the spell merchant, written by every
      // sale, and on no manifest and in no save until this repair.
      gold: sim.progression.gold || 0,
      hearths_discovered: [...sim.progression.hearthsDiscovered].sort(),
      hearth_last_rested: sim.progression.hearthLastRested,
      upgrades: sortedMap(sim.progression.upgrades),
      // RI-LOR05 §4a. A permanent, accumulating, irreversible-except-by-one-spell condition is
      // exactly the kind of thing a save must carry, and `sap_ward` is only meaningful if the
      // band it lowered stays lowered.
      sap_taint: sim.progression.sapTaint
        ? { band: sim.progression.sapTaint.band, rests: sim.progression.sapTaint.rests,
            warded: sim.progression.sapTaint.warded || 0,
            ward_uses_left: sim.progression.sapTaint.wardUsesLeft, immune: !!sim.progression.sapTaint.immune }
        : null,
    },
    // Seam S19. The commissioned spells are the load-bearing entry: RI-MAG03 M1 requires a
    // spell the player made to appear in saveState(), because a maker's system whose output
    // does not survive a save is a preview of a maker's system. `focus` is durable and is NOT
    // topped up on load — RI-MAG01 §A permits exactly two things to raise it and neither is a
    // file read.
    magic: sim.magic ? {
      focus: r6(sim.magic.focus),
      attuned: sim.magic.attuned.slice(),
      catalyst: sim.magic.hasCatalyst ? sim.magic.catalyst : null,
      known_effects: [...sim.magic.knownEffects].sort(),
      custom_spells: sim.magic.custom.map((c) => ({
        id: c.id, name: c.name, class: c.class, range: c.range,
        effects: c.effects.map((e) => ({ effect: e.effect, magnitude: e.magnitude, duration_s: e.duration_s, area_r_m: e.area_r_m })),
        focus_base: c.focus_base, tier: c.tier, skill_req: c.skill_req, gold_price: c.gold_price,
      })),
      gems: sim.magic.gems.map((g) => ({ grade: g.grade, filled: !!g.filled, charge: g.charge })),
      xul_hesh: sim.magic.xulHesh,
      soul_history: [...sim.magic.soulHistory.entries()].sort().map(([k, v]) => ({ instance: k, traps: v })),
    } : { focus: 0, attuned: [], catalyst: null, known_effects: [], custom_spells: [], gems: [], xul_hesh: 0, soul_history: [] },
    quests: sortedQuestMap(sim.quest.quests),
    quests_completed: [...sim.quest.completed].sort(),
    journal: sim.quest.journal.map((e) => ({ n: e.n, date: e.date, quest: e.quest, text: e.text })), // ORDER IS SEMANTIC
    dialogue: {
      topics_known: [...sim.quest.topicsKnown].sort(),
      dispositions: sortedMap(sim.quest.dispositions),
    },
    factions: sortedMap(sim.quest.factions),
    // W1-15 round 2. These four fields were always in the schema and were always empty: the
    // stealth subsystem kept its own `CrimeWorld` and nothing ever copied it here, so
    // `saveState().crime.stolen_registry` read `[]` after three thefts and `crime.bounty` read
    // `{}` after a 1,450 g murder. `sim.stealth.mirrorToSave()` now writes `sim.quest.crime`
    // from the live ledger every step and on every mutation, so this block is the ledger.
    crime: {
      bounty: sortedMap(sim.quest.crime.bounty),
      witnesses: [...sim.quest.crime.witnesses].sort(),
      stolen_registry: [...sim.quest.crime.stolen].sort(),
      hunting: [...sim.quest.crime.hunting].sort(),
      // The rich ledger behind the four id lists above: the crime records, the zone memory that
      // seam S-4 needs to survive a save, and the stolen rows with their owners and values.
      // Declared in game/data/save-manifest.json under the Crime group.
      ledger: sim.stealth ? sim.stealth.crime.toJSON() : null,
      zones: sim.stealth ? sim.stealth.zones.toJSON() : {},
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
      // W1-07: the people and the things in the room. Durable because a person's facing and a
      // loiter clock are simulation state a reload must not forget, and because a world object
      // you already picked up must stay picked up. Sorted by eid, like every incidental array.
      npcs: sim.npcs.map((n) => ({
        eid: n.eid, name: n.name, title: n.title || null, race: n.race,
        faction: n.faction || null, reaction_group: n.reaction_group || null,
        settlement: n.settlement || null, interior: n.interior || null,
        behaviour: n.behaviour, base_disposition: n.base_disposition,
        topics: n.topics.slice().sort(), services: n.services.slice().sort(),
        pos: vec(n.pos), yaw_deg: r6(n.yaw), home_yaw_deg: r6(n.homeYaw),
        height_scale: r6(n.height_scale), notice_radius_m: r6(n.notice_radius_m),
        visible: !!n.visible, loiter_frames: n.loiter_frames, noticing: !!n.noticing,
      })).sort((a, b) => (a.eid < b.eid ? -1 : a.eid > b.eid ? 1 : 0)),
      props: sim.props.map((o) => ({
        eid: o.eid, name: o.name, item: o.item, pos: vec(o.pos), yaw_deg: r6(o.yaw),
        shape: o.shape, material: o.material, takeable: !!o.takeable, taken: !!o.taken,
        reach_m: r6(o.reach_m),
      })).sort((a, b) => (a.eid < b.eid ? -1 : a.eid > b.eid ? 1 : 0)),
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
        // W1-15's perception outputs. `lkp` is the last known position the whole search
        // behaviour is driven from (sim/stealth/system.js searchStart), `last_seen_ago_frames`
        // is what "lost him" is measured against, and both were written every frame by the
        // stealth system and carried by nothing. A guard that saw you, then a reload, and the
        // guard has never seen anyone.
        alert_channel: e.alertChannel === undefined ? null : e.alertChannel,
        percept_dist_m: e.percept_dist === undefined || e.percept_dist === null ? null : r6(e.percept_dist),
        percept_los: !!e.percept_los,
        // A PLAIN difference with no sentinel. -1 was tried and collided with itself: a save
        // taken one frame after the guard last saw you gives ago = 1, and rebasing that
        // against the frame `loadState()` resets to 0 gives lastSeenF = -1, which is exactly
        // makeEntity()'s "never seen" value. The re-save then wrote -1 and RI-JRN05 M2's diff
        // was that one field. `lost = frame - lastSeenF` is the only reader and it is a plain
        // subtraction, so "never" is just a very long time ago and needs no sentinel at all.
        last_seen_ago_frames: f - (e.lastSeenF === undefined ? -1 : e.lastSeenF),
        lkp: e.lkp ? vec(e.lkp) : null,
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
      // ---- THE SPRING ARM AND THE REST OF THE RIG -------------------------------------
      // W1-repair. `camera_dist_m` above was the ONLY rig field the save carried, and
      // `c.dist` is not rig state at all — sim/camera.js line 625 writes `c.dist = c.armLen`
      // at the bottom of every solve. So the save recorded an OUTPUT and restored it into a
      // rig whose input (`armLen`) was still whatever `makeCamera()` left, and then
      // `Engine.loadState()` called `_settleCamera()`, which overwrote `armLen`/`armEased`/
      // `armDesired`/`armCast`/`dist`/`distTarget` with a freshly computed default. Measured:
      // `pose.camera_dist_m` 3.546945 -> 3.265980 across a BARE round trip on `arena_flat`,
      // the single field in RI-JRN05 M2's diff, and 0/N on M1.
      //
      // Every field below is READ BEFORE IT IS WRITTEN somewhere in sim/camera.js's step and
      // is therefore durable by RI-JRN05 §B's own definition, not by taste:
      //   armLen        rate-limited against itself (pull-in 40 m/s, push-out 3 m/s)
      //   armEased      first-order ease against itself under lock/rest/death/fog
      //   clearFrames   the 6-frame push-out dwell counter
      //   pivot         critically damped in Y against its own previous value
      //   containArm/Pitch  §C's containment integrators, grabbed and released per frame
      //   lockDist/Height   read by solveArm() and containment() before lockOrientation()
      //   lookBufX/Y    RI-CAM06 §F — "buffered, never dropped" across hitstop
      //   recentreFrames/Active  the 20-frame sprint gate
      //   pos + onscreen.*  lockOrientation() projects LAST frame's pose to decide this one
      // The rest (`dist`, `distTarget`, `armCast`, `armHit`, `armGuard`, `shoulder*`,
      // `charOpacity`, `clipThrough`, `fov`) are pure per-frame outputs and are carried so
      // that a save/load pair is identical at frame 0 as well as at frame 1 — a snapshot()
      // or a screenshot taken straight after a load is a thing a player sees.
      camera_pos: vec(c.pos),
      camera_pivot: vec(c.pivot),
      camera_pivot_snap: !!c.pivotSnap,
      camera_arm_len_m: r6(c.armLen),
      camera_arm_desired_m: r6(c.armDesired),
      camera_arm_eased_m: r6(c.armEased),
      camera_arm_cast_m: r6(c.armCast),
      camera_arm_hit: !!c.armHit,
      camera_arm_guard: !!c.armGuard,
      camera_clear_frames: c.clearFrames,
      camera_dist_target_m: r6(c.distTarget),
      camera_contain_arm_m: r6(c.containArm),
      camera_contain_pitch_deg: r6(c.containPitch),
      camera_lock_dist_m: r6(c.lockDist),
      camera_lock_height_m: r6(c.lockHeight),
      camera_yaw_rate_dps: r6(c.yawRate),
      camera_look_buf: [r6(c.lookBufX), r6(c.lookBufY)],
      camera_look_active: !!c.lookActive,
      camera_recentre_frames: c.recentreFrames,
      camera_recentre_active: !!c.recentreActive,
      camera_shoulder_r_m: r6(c.shoulderR),
      camera_shoulder_u_m: r6(c.shoulderU),
      camera_char_opacity: r6(c.charOpacity),
      camera_clip_through: !!c.clipThrough,
      camera_fov_deg: r6(c.fov),
      camera_hitstop: !!c.hitstop,
      camera_ui_mode: c.uiMode,
      // RI-CAM05 §D's dialogue accommodation walks the camera round the pair over many
      // frames and accumulates its own total; all five persist across frames.
      camera_dialogue_frames: c.dialogueFrames,
      camera_dialogue_yaw_step: r6(c.dialogueYawStep),
      camera_dialogue_arm_step: r6(c.dialogueArmStep),
      camera_dialogue_arm_m: r6(c.dialogueArm),
      camera_dialogue_yaw_total: r6(c.dialogueYawTotal),
      // `deathFrame` is an absolute index with -1 as its "inactive" sentinel, so it is
      // carried as a PLAIN difference (like `entities[].state_entered_ago_frames`) and -1
      // is carried through as -1. resolveMode() tests `!== -1` rather than `>= 0` precisely
      // so that a death that began before the load — and therefore rebases to a negative
      // index against the reset frame — is still a death.
      camera_death_frames_ago: c.deathFrame < 0 ? -1 : Math.max(0, f - c.deathFrame),
      camera_fog_in_frames: rel(c.fogUntil, f),
      camera_fog_target: c.fogTarget === undefined ? null : c.fogTarget,
      camera_shake_age: c.shakeAge,
      camera_onscreen: {
        p: !!c.onscreen.p, t: !!c.onscreen.t, th: !!c.onscreen.th,
        p_safe: !!c.onscreen.pSafe, t_safe: !!c.onscreen.tSafe, both: !!c.onscreen.both,
        t_band: !!c.onscreen.tBand, t_band_y: r6(c.onscreen.tBandY),
        p_ndc: [r6(c.onscreen.pNdc[0]), r6(c.onscreen.pNdc[1])],
        t_ndc: [r6(c.onscreen.tNdc[0]), r6(c.onscreen.tNdc[1])],
        th_ndc: [r6(c.onscreen.thNdc[0]), r6(c.onscreen.thNdc[1])],
      },
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
    // THE FIGHT. See save/fight.js for why it is here and what it retires. Without it the
    // save had no writer at all for the equipped weapon, the shield, the offhand
    // configuration, the flask, or any combat body — and `mirror()` overwrote six `pose.*`
    // fields the save had just restored on the first step after every load.
    fight: saveFight(sim, sim._combat, sim.magic, f),
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
 * The magic half of a restore, split out because it has to run TWICE on the engine's load
 * path: once inside `applySave` (so `applySave` alone is still a complete restore for any
 * caller), and once again after `Engine._restoreFightFromSave()` rebuilds the fight — which
 * constructs a fresh `MagicSystem`, because the MagicSystem is built with and handed to the
 * fight (seam S19, `Engine._buildCombat`). Restoring the spells onto a MagicSystem that is
 * about to be thrown away is how a commissioned spell survives a save and not a load. It is
 * idempotent: every line is an assignment or a setter over the whole value.
 */
export function applySaveMagic(sim, blob) {
  if (!sim.magic || !blob.magic) return null;
  const M = sim.magic;
  M.custom = blob.magic.custom_spells.map((c) => ({
    ...c, custom: true,
    schools: [...new Set(c.effects.map((e) => M.effects[e.effect].school))].sort(),
    school: M.effects[c.effects[0].effect].school,
    band_tier: c.tier, stamina: M.classes[c.class].stamina,
    geometry: M._geometryFor({ range: c.range, class: c.class }, { effects: c.effects }),
    frames: { ...M.classes[c.class], unit: 'f@60' },
  }));
  M.knownEffects = new Set(blob.magic.known_effects);
  M.gems = blob.magic.gems.map((g) => ({ ...g }));
  M.xulHesh = blob.magic.xul_hesh;
  M.soulHistory = new Map(blob.magic.soul_history.map((r) => [r.instance, r.traps]));
  if (blob.magic.catalyst) M.setCatalyst(blob.magic.catalyst); else { M.catalyst = 'none'; M.hasCatalyst = false; }
  M.setAttuned(blob.magic.attuned);
  M.focus = blob.magic.focus;
  return M;
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
  sim.character = loadCreation(blob.identity.creation);

  sim.progression.level = blob.character.level;
  sim.progression.soulsHeld = blob.character.souls_held;
  sim.progression.attributes = { ...blob.character.attributes };
  sim.progression.skills = {};
  for (const k of Object.keys(blob.character.skills)) {
    sim.progression.skills[k] = { value: blob.character.skills[k].value, useProgress: blob.character.skills[k].use_progress };
  }
  sim.progression.soulsSpent = blob.progression.souls_spent;
  sim.progression.gold = blob.progression.gold;
  sim.progression.hearthsDiscovered = [...blob.progression.hearths_discovered];
  sim.progression.hearthLastRested = blob.progression.hearth_last_rested;
  sim.progression.upgrades = { ...blob.progression.upgrades };
  if (blob.progression.sap_taint) {
    const t = blob.progression.sap_taint;
    sim.progression.sapTaint = { band: t.band, rests: t.rests, warded: t.warded || 0, wardUsesLeft: t.ward_uses_left, immune: !!t.immune };
  } else sim.progression.sapTaint = null;
  applySaveMagic(sim, blob);

  p.hp = blob.character.hp; p.hpMax = blob.character.hp_max;
  p.stamina = blob.character.stamina; p.staminaMax = blob.character.stamina_max;
  p.poise = blob.character.poise; p.poiseMax = blob.character.poise_max;
  p.estus = blob.character.estus;
  p.equipLoadPct = blob.character.equip_load_pct;
  p.rollClass = blob.character.roll_class;
  p.carriedWeight = blob.character.carried_weight;
  p.burdenRatio = blob.character.burden_ratio;

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
  // W1-15 round 2: restore the ledger the four lists above are a projection of. Order matters —
  // `fromJSON` replaces the CrimeWorld's arrays wholesale, so anything that reads them (the
  // guard band, the pending reports) must run after this, and everything does: they run in the
  // fixed step and this is load time.
  if (sim.stealth && blob.crime.ledger) sim.stealth.crime.fromJSON(blob.crime.ledger);
  if (sim.stealth && blob.crime.zones) sim.stealth.zones.fromJSON(blob.crime.zones);
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

  sim.npcs.length = 0;
  for (const n of blob.world.npcs || []) {
    sim.npcs.push({
      eid: n.eid, kind: 'npc', name: n.name, title: n.title, race: n.race,
      faction: n.faction, reaction_group: n.reaction_group, settlement: n.settlement,
      interior: n.interior, behaviour: n.behaviour, base_disposition: n.base_disposition,
      topics: [...n.topics], services: [...n.services],
      pos: [...n.pos], homePos: [...n.pos], yaw: n.yaw_deg, homeYaw: n.home_yaw_deg,
      height_scale: n.height_scale, notice_radius_m: n.notice_radius_m,
      visible: n.visible, loiter_frames: n.loiter_frames, noticing: n.noticing, speaking: false,
    });
  }
  sim.props.length = 0;
  for (const o of blob.world.props || []) {
    sim.props.push({
      eid: o.eid, name: o.name, item: o.item, pos: [...o.pos], yaw: o.yaw_deg,
      shape: o.shape, material: o.material, takeable: o.takeable, taken: o.taken,
      reach_m: o.reach_m, readable: null,
    });
  }

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
    e.alertChannel = es.alert_channel;
    e.percept_dist = es.percept_dist_m;
    e.percept_los = es.percept_los;
    e.lastSeenF = f - es.last_seen_ago_frames;
    e.lkp = es.lkp ? [...es.lkp] : null;
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
  restoreCameraRig(c, blob.pose, f);

  rng.loadRngState(blob.rng);
  return { ok: true, frame: sim.frame, seed: rng.seed };
}

/**
 * Put the spring arm and the rest of the rig back.
 *
 * Kept as a named export rather than inlined because `Engine.loadState()` has to be able to
 * run it AFTER `_settleCamera()`: the settle exists to give the rig a clean base (it clears
 * the dialogue walk, the containment integrators and the recentre gate that a fresh session
 * would not have), and this puts the saved rig on top of that base. Doing it in the other
 * order is the defect this repair fixes.
 */
export function restoreCameraRig(c, pose, f) {
  c.pos[0] = pose.camera_pos[0]; c.pos[1] = pose.camera_pos[1]; c.pos[2] = pose.camera_pos[2];
  c.pivot[0] = pose.camera_pivot[0]; c.pivot[1] = pose.camera_pivot[1]; c.pivot[2] = pose.camera_pivot[2];
  c.pivotSnap = pose.camera_pivot_snap;
  c.armLen = pose.camera_arm_len_m;
  c.armDesired = pose.camera_arm_desired_m;
  c.armEased = pose.camera_arm_eased_m;
  c.armCast = pose.camera_arm_cast_m;
  c.armHit = pose.camera_arm_hit;
  c.armGuard = pose.camera_arm_guard;
  c.clearFrames = pose.camera_clear_frames;
  c.dist = pose.camera_dist_m;
  c.distTarget = pose.camera_dist_target_m;
  c.containArm = pose.camera_contain_arm_m;
  c.containPitch = pose.camera_contain_pitch_deg;
  c.lockDist = pose.camera_lock_dist_m;
  c.lockHeight = pose.camera_lock_height_m;
  c.yawRate = pose.camera_yaw_rate_dps;
  c.lookBufX = pose.camera_look_buf[0]; c.lookBufY = pose.camera_look_buf[1];
  c.lookActive = pose.camera_look_active;
  c.recentreFrames = pose.camera_recentre_frames;
  c.recentreActive = pose.camera_recentre_active;
  c.shoulderR = pose.camera_shoulder_r_m;
  c.shoulderU = pose.camera_shoulder_u_m;
  c.charOpacity = pose.camera_char_opacity;
  c.clipThrough = pose.camera_clip_through;
  c.fov = pose.camera_fov_deg;
  c.hitstop = pose.camera_hitstop;
  c.uiMode = pose.camera_ui_mode;
  c.mode = pose.camera_mode;
  c.dialogueFrames = pose.camera_dialogue_frames;
  c.dialogueYawStep = pose.camera_dialogue_yaw_step;
  c.dialogueArmStep = pose.camera_dialogue_arm_step;
  c.dialogueArm = pose.camera_dialogue_arm_m;
  c.dialogueYawTotal = pose.camera_dialogue_yaw_total;
  c.deathFrame = pose.camera_death_frames_ago < 0 ? -1 : f - pose.camera_death_frames_ago;
  c.fogUntil = f + pose.camera_fog_in_frames;
  c.fogTarget = pose.camera_fog_target;
  c.shakeAge = pose.camera_shake_age;
  c.shakeAmp = pose.camera_shake_amp_deg;
  c.shakeUntil = f + pose.camera_shake_in_frames;
  const o = pose.camera_onscreen;
  c.onscreen.p = o.p; c.onscreen.t = o.t; c.onscreen.th = o.th;
  c.onscreen.pSafe = o.p_safe; c.onscreen.tSafe = o.t_safe; c.onscreen.both = o.both;
  c.onscreen.tBand = o.t_band; c.onscreen.tBandY = o.t_band_y;
  c.onscreen.pNdc[0] = o.p_ndc[0]; c.onscreen.pNdc[1] = o.p_ndc[1];
  c.onscreen.tNdc[0] = o.t_ndc[0]; c.onscreen.tNdc[1] = o.t_ndc[1];
  c.onscreen.thNdc[0] = o.th_ndc[0]; c.onscreen.thNdc[1] = o.th_ndc[1];
  return c;
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


// ---- W1-07: the creation record ------------------------------------------------------------
// `created:false` is a real state — the player is in the barge hold and nobody has written
// anything down yet — so the block is always present and always the same shape. A save whose
// key set changes with a game state is a save whose manifest cannot be a set difference.

// W1-repair. `powers` and `drawbacks` are the two arrays EVERY birthsign term is read out of
// (`character/derive.js` iterates both; `sheet.js focusRegenAllowed()` is a scan of the second).
// They were composed by `composeCharacter()`, never written here, and never rebuilt by
// `loadCreation()` — so after any load `applyBirthsignToPools()` iterated two `undefined` lists
// and silently returned the base pools: the Warrior's x1.60 Focus reservoir, the 55% spell
// absorption, and the whole of the DRY WELL DRAWBACK (seam S27 — its bearer's hearth rest does
// not return Focus) were gone, and a `nu-ixtu` character measured `focus_restores_at_hearth ==
// true` after a round trip. W1-13 patched it at the seam, in `Engine.loadState()`, by
// recomposing the terms from the sign ids; the defect was here, and so is the fix.
//
// `upbringing_given_as`, `class_family_fit` and `invariants` were dropped by the same omission.
// They are derived, but a save that drops a derived field is a save whose load is not the
// inverse of its write, and the durable-field census now walks `sim.character` and says so.
//
// The key set is IDENTICAL in both branches — including `invariants`, whose keys are listed
// rather than left to an empty object. A save whose key set changes with a game state is a
// save whose manifest cannot be a set difference (RI-JRN05 M4).
const INVARIANT_KEYS = [
  'attribute_total', 'attribute_total_ok', 'race_delta_sum', 'class_delta_sum',
  'skills_above_baseline', 'skills_above_baseline_ok', 'max_skill', 'max_skill_ok',
];
function saveInvariants(inv) {
  const out = {};
  for (const k of INVARIANT_KEYS) out[k] = inv && inv[k] !== undefined ? inv[k] : null;
  return out;
}

export function saveCreation(ch) {
  if (!ch) {
    return {
      created: false, given_name: '', hatch_name: '', hatch_name_refused: false, sex: '',
      race: '', upbringing: '', upbringing_given_as: '', class_id: '', class_name: '',
      class_family: '', class_family_fit: null, class_route: '',
      birthsign: '', birthsign_second: '', signature_key: '', writ_text: '',
      attributes: {}, skills: {}, flags: [],
      powers: [], drawbacks: [], invariants: saveInvariants(null),
    };
  }
  return {
    created: true,
    upbringing_given_as: ch.upbringing_given_as || '',
    class_family_fit: ch.class_family_fit === undefined ? null : ch.class_family_fit,
    powers: deepCopy(ch.powers || []),
    drawbacks: deepCopy(ch.drawbacks || []),
    invariants: saveInvariants(ch.invariants),
    given_name: ch.given_name || '',
    hatch_name: ch.hatch_name || '',
    hatch_name_refused: !!ch.hatch_name_refused,
    sex: ch.sex || '',
    race: ch.race || '',
    upbringing: ch.upbringing || '',
    class_id: ch.class_id || '',
    class_name: ch.class_name || '',
    class_family: ch.class_family || '',
    class_route: ch.class_route || '',
    birthsign: ch.birthsign || '',
    birthsign_second: ch.birthsign_second || '',
    signature_key: ch.signature ? ch.signature.key : '',
    writ_text: ch.writ_text || '',
    attributes: sortedMap(ch.attributes || {}),
    skills: sortedMap(ch.skills || {}),
    flags: [...(ch.flags || [])].sort(),
  };
}

export function loadCreation(blob) {
  if (!blob || !blob.created) return null;
  const [race, class_family, birthsign_family, upbringing_class] = String(blob.signature_key).split('|');
  return {
    given_name: blob.given_name,
    hatch_name: blob.hatch_name,
    hatch_name_refused: blob.hatch_name_refused,
    sex: blob.sex,
    race: blob.race,
    upbringing: blob.upbringing,
    upbringing_given_as: blob.upbringing_given_as,
    // The two arrays every birthsign term is read out of. See saveCreation() above.
    powers: deepCopy(blob.powers || []),
    drawbacks: deepCopy(blob.drawbacks || []),
    class_family_fit: blob.class_family_fit,
    invariants: deepCopy(blob.invariants || {}),
    class_id: blob.class_id,
    class_name: blob.class_name,
    class_family: blob.class_family,
    class_route: blob.class_route,
    birthsign: blob.birthsign,
    birthsign_second: blob.birthsign_second || null,
    signature: { race, class_family, birthsign_family, upbringing_class, key: blob.signature_key },
    attributes: { ...blob.attributes },
    skills: { ...blob.skills },
    flags: [...blob.flags],
    writ_text: blob.writ_text,
  };
}
