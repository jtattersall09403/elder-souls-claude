// CombatSystem — the one object the simulation step talks to.
//
// It owns the bodies, the lock, the resolver and the per-frame order of operations, and it is
// the only place RI-CMB04 §A's ten steps appear as ten lines. Anything that reorders them
// reorders them here, visibly, in one function, which is the point.
'use strict';

import { CombatBody } from './actor.js';
import { PlayerController } from './player.js';
import { EnemyController, buildEnemyMoves, IMPLEMENTED_AI } from './enemy.js';
import { buildMoveTable, equipTier, PLAYER_STATE_ENUM, ENEMY_STATE_ENUM, STATE_ENUM_EXTENSIONS } from './moves.js';
import { LockOn } from './lockon.js';
import { MovesetLibrary, SPINE_ALIASES } from './moveset.js';
import { sweepAndResolve } from './resolve.js';
import { staminaMaxFor } from './rules.js';
import { bearingDeg, angleDelta, norm360 } from './geometry.js';

/**
 * `hitgeometry.json` §bodies.separation.driver_carry, the missing half of the formula it
 * publishes: `push = min(overlap, max_speed/60 + max(0, driver_root_delta · contact_normal))`.
 *
 * How much of a DRIVING body's own root translation this frame is aimed along the contact
 * normal — i.e. how far it is walking INTO the body it overlaps. Only the inward component
 * counts; a driver moving away is already relieving the overlap and the cap handles that.
 *
 * The bearing must match `CombatBody.advance()` exactly or the carry is measured off the wrong
 * axis: root motion travels along `rollDirDeg` for a roll, a backstep and a cast (all three
 * latch their direction at frame 1) and along the actor's facing for everything else.
 *
 * NOTE: this function was referenced from three call sites and never defined — an unfinished
 * edit banked at `6e359ab` after a container restart. Every fight in which one body drove its
 * root into another threw `ReferenceError: advanceAlong is not defined` out of
 * `CombatSystem.step`, which in the browser kills the frame loop. Found by
 * `tools/harness/wpn-impact-live.mjs`, which cannot spawn a target at 1.2 m without it firing.
 */
function advanceAlong(body, nx, nz) {
  const d = body.lastRootDelta || 0;
  if (d === 0) return 0;
  const m = body.move;
  const kind = m && m.kind;
  const bearing = (kind === 'roll' || kind === 'backstep' || kind === 'cast') ? body.rollDirDeg : body.yaw;
  const rad = bearing * Math.PI / 180;
  return Math.max(0, d * (Math.sin(rad) * nx + Math.cos(rad) * nz));
}

export class CombatSystem {
  /** @param {object} data all of game/data/combat/*.json keyed by basename, plus locomotion */
  constructor(data) {
    this.d = data;
    // W1-10. THE move source for every weapon in the game. `data.weaponMovesets` is the 87-weapon
    // roster; `data.movesets` (the seven W1-09 class spine files) is no longer read by the fight
    // at all — its ids survive as aliases onto the roster baselines so every scenario file and
    // every W1-09 probe keeps working. One library, one slot resolver, one clip source: the
    // "declared here, hard-coded there" split that made 87 movesets unreachable cannot recur.
    this.lib = (data.weaponClasses && data.clipRegistry && data.weaponMovesets)
      ? new MovesetLibrary(data.clipRegistry, data.weaponClasses, data.weaponMovesets, data.skeleton, data.hitgeometry)
      : null;
    this.bodies = [];
    this.player = null;
    this.playerCtl = null;
    this.enemies = new Map();          // id -> EnemyController
    this.lock = new LockOn(data.lockon);
    this.eventLog = [];
    this.frame = 0;
    /** W1-11 — `audio.combat.impact`. Set by `Engine` (or a probe) via `setAudio()`. */
    this.audio = null;
    /** CAM06-authorised world consumer. Engine supplies this; probes may disconnect it. */
    this.playerDamageFeedback = null;
    /** [frame, kind, event] triples emitted this step, drained by `_flushAudio()`. */
    this._audioPending = [];
    this.world = { gold: 0, dispositions: {}, factions: {}, topicsKnown: [] };
    this.stats = { hitsLanded: 0, iframeNegates: 0, blocks: 0, guardBreaks: 0, parries: 0, whiffs: 0, staminaDrops: 0 };
  }

  static stateEnums() {
    return { player: PLAYER_STATE_ENUM, enemy: ENEMY_STATE_ENUM, extensions: STATE_ENUM_EXTENSIONS };
  }

  /**
   * W1-11. Attach the impact-audio driver. Null is a legal state and means the build is silent;
   * `getAudioState().available` reports it so a silent build cannot be mistaken for a passing
   * one (RI-AUD01: "Unimplemented audio scores 0, not 'not assessed'").
   */
  setAudio(driver) { this.audio = driver || null; return this; }

  setPlayerDamageFeedback(consumer) {
    this.playerDamageFeedback = typeof consumer === 'function' ? consumer : null;
    return this;
  }

  /**
   * The listener frame handed to the audio driver, RI-AUD02 §E S6.
   *
   * The listener is at the CHARACTER, not at the orbit camera, and the bearing every pan is
   * derived from is taken against the PLAYER's yaw. S6's symptom when this is wrong is
   * unmistakable once named and invisible until then: every sound in the world pans back and
   * forth as the player orbits a stationary enemy, and it feels like 3D audio working. The
   * camera pose is deliberately not reachable from here.
   */
  _audioWorld() {
    const p = this.player;
    if (!this._audioWorldObj) {
      this._audioWorldObj = {
        playerPos: [0, 0, 0], playerYawDeg: 0,
        posOf: (id) => { const b = this.bodyOf(id); return b ? b.pos : null; },
      };
    }
    const w = this._audioWorldObj;
    if (p) { w.playerPos = p.pos; w.playerYawDeg = p.yaw; }
    return w;
  }

  /**
   * Resolve any weapon id the harness, a scenario file or a save may name to a roster moveset.
   * The seven spine ids are aliases (moveset.js §SPINE_ALIASES); everything else is a roster id.
   */
  movesetFor(id) {
    const d = this.d;
    const want = id || 'straight-sword';
    if (this.lib) {
      const rid = SPINE_ALIASES[want] || want;
      if (d.weaponMovesets[rid]) return d.weaponMovesets[rid];
      const known = Object.keys(d.weaponMovesets).sort();
      throw new Error(`createPlayer: no moveset '${want}'. Known: ${known.length} roster weapons ` +
        `(${known.slice(0, 6).join(', ')}, ...) plus the aliases ${Object.keys(SPINE_ALIASES).join(', ')}.`);
    }
    const ms = d.movesets[want];
    if (!ms) throw new Error(`createPlayer: no moveset '${want}'. Known: ${Object.keys(d.movesets).join(', ')}`);
    return ms;
  }

  /**
   * Resolve a shield id against BOTH registries and merge them.
   *
   * RI-CMB03 §C owns stability / absorption / block stamina cost and publishes three shields in
   * `game/data/combat/stamina.json`. RI-WPN06 §D owns the guard angle, the parry window and the
   * shield's own slots and publishes five in `game/data/weapons/offhand.json`. The round-1 build
   * read only the first, so `setLoadout({shield: 'greatshield'})` threw and greatshield
   * parry-ineligibility and the guard angle were unmeasurable. A shield may now be named by
   * either registry's id or by its RI-WPN06 CLASS, and the merged row carries both halves.
   */
  shieldFor(id) {
    const d = this.d;
    const byId = d.stamina.block.shields;
    const off = (d.offhand && d.offhand.shields) || {};
    const CLASS_TO_ID = {
      buckler: 'buckler_shell', small: 'small_reed', medium: 'kite_garrison',
      greatshield: 'greatshield_xanmeer', great: 'greatshield_xanmeer', parry_tool: 'parry_dagger',
    };
    const key = off[id] ? id : (CLASS_TO_ID[id] || id);
    const o = off[key] || null;
    // Stability/absorption come from the RI-CMB03 row of the nearest class; the taxonomy row
    // comes from RI-WPN06. Neither number is invented here.
    const NEAREST = { buckler: 'chitin_buckler', small: 'chitin_buckler', medium: 'marsh_oak_medium', greatshield: 'naga_tower', parry_tool: 'chitin_buckler' };
    const baseId = byId[key] ? key : (o ? NEAREST[o.class] : null);
    if (!baseId || !byId[baseId]) {
      throw new Error(`setLoadout: unknown shield '${id}'. Known ids: ` +
        `${Object.keys(byId).concat(Object.keys(off)).join(', ')}; known classes: ${Object.keys(CLASS_TO_ID).join(', ')}.`);
    }
    const base = byId[baseId];
    if (!o) {
      // A shield named only by the RI-CMB03 registry still gets RI-WPN06 §D's taxonomy row, so
      // `block_angle_deg` and parry eligibility are never null just because of which id was used.
      const BY_CLASS = { small: 'small_reed', medium: 'kite_garrison', great: 'greatshield_xanmeer' };
      const t = off[BY_CLASS[base.class]] || null;
      if (!t) return { id: baseId, row: base };
      return {
        id: baseId,
        row: {
          ...base,
          taxonomy_class: t.class,
          guard_angle_deg: t.guard_angle_deg,
          can_parry: base.can_parry !== undefined ? (base.can_parry && !!t.parry_capable) : !!t.parry_capable,
          parry_anim_f: t.parry_anim_f,
          parry_active_f: t.parry_active_f,
          slots: t.slots || [],
          source: 'RI-CMB03 §C (stability/absorption) + RI-WPN06 §D (angle, parry, slots), joined on shield class',
        },
      };
    }
    return {
      id: key,
      row: {
        ...base,
        name: o.name,
        class: o.class === 'greatshield' ? 'great' : o.class === 'buckler' ? 'small' : o.class,
        taxonomy_class: o.class,
        guard_angle_deg: o.guard_angle_deg,
        can_parry: !!o.parry_capable,
        parry_anim_f: o.parry_anim_f,
        parry_active_f: o.parry_active_f,
        weight: o.weight,
        slots: o.slots || [],
        source: 'RI-CMB03 §C (stability/absorption) + RI-WPN06 §D (angle, parry, slots)',
      },
    };
  }

  createPlayer(loadout) {
    const d = this.d;
    const moveset = this.movesetFor(loadout.weapon);
    // RI-WPN06 §C: O2 (dual wield) and O3 (two-hand) have NO shield, and losing block is not
    // negotiable. `offhand` is the declared configuration; `shield: null` still works.
    const cfg = loadout.offhand || (loadout.twoHanded ? 'o3_twohand' : (loadout.left ? 'o2_dual' : 'o1_sword_shield'));
    const noShield = cfg === 'o2_dual' || cfg === 'o3_twohand' || cfg === 'o4_catalyst';
    const sh = (loadout.shield === null || noShield) ? null : this.shieldFor(loadout.shield || d.stamina.block.exemplar_shield);
    const shieldId = sh ? sh.id : null;
    const shield = sh ? sh.row : null;
    const moves = buildMoveTable(d, moveset, shieldId, {
      twoHanded: !!loadout.twoHanded || cfg === 'o3_twohand', lib: this.lib, shieldRow: shield,
    });
    const endurance = loadout.endurance !== undefined ? loadout.endurance : 20;
    const body = new CombatBody('P', 'P', d.skeleton, d.hitgeometry, moves, {
      hpMax: loadout.hpMax !== undefined ? loadout.hpMax : 620,
      staminaMax: staminaMaxFor(endurance, d.stamina),
      armourPoise: loadout.armourPoise !== undefined ? loadout.armourPoise : 28,
      equipLoadPct: loadout.equipLoadPct !== undefined ? loadout.equipLoadPct : 24.0,
      poise: d.poise,
      clips: d.clips,
      shield,
      haPool: (d.poise.hyperarmour.pools[moves._classKey] || {}).one_handed || 0,
    });
    body.shieldId = shieldId;
    // RI-CMB04 §A step 5 / RI-AI01 minimum standoff. Declared in hitgeometry.json rather than
    // baked here so a critic can read the number without reading the source.
    body.bodyRadius = (d.hitgeometry.bodies && d.hitgeometry.bodies.player_radius_m) || 0.30;
    body.twoHanded = !!moves._twoHanded;
    body.lockable = false;
    // W1-10. The body carries the ROSTER weapon id, not the alias it was asked for: `anim_slot`
    // resolution, the trace's `weapon_id` and the offhand configuration all read it.
    body.weaponId = moveset.weapon_id || moveset.id;
    body.weaponClass = moveset.class || null;
    body.offhandConfig = cfg;
    body.offhandKind = noShield ? (cfg === 'o2_dual' ? 'weapon' : cfg === 'o3_twohand' ? 'stowed' : 'catalyst') : 'shield';
    body.blockSuccessFrame = -9999;
    body.blockSuccessShield = null;
    this._playerLoadout = Object.assign({}, loadout, { weapon: loadout.weapon || 'straight-sword', shield: shieldId, offhand: cfg });
    this.player = body;
    this.playerCtl = new PlayerController(body, d, this.lock);
    this.playerCtl.lib = this.lib;
    this.playerCtl.magic = this.magic || null;   // seam S19: set by the engine at boot
    this.playerCtl.flaskLevel = loadout.flaskLevel || 0;
    this.playerCtl.estus = loadout.estus !== undefined ? loadout.estus : d.flask.charges.at_game_start;
    // Keep the durable controller shape canonical before the first pool-derivation pass.
    // Otherwise a save omits `estusMax`, while loading that save rebuilds it as five.
    this.playerCtl.estusMax = this.playerCtl.estus;
    this.bodies = [body];
    body.evaluateRig(0);
    return body;
  }

  spawnEnemy(id, stat, x, z, yaw) {
    if (!IMPLEMENTED_AI.has(stat.ai)) {
      throw new Error(`spawn('${stat.id}'): archetype declares ai='${stat.ai}', which this build does not implement. ` +
        `Implemented: ${[...IMPLEMENTED_AI].join(', ')}. Enemy DECISION-MAKING is RI-AI01..07 / wave-1 piece W1-12; ` +
        'W1-09 ships a SCRIPTED attack machine because that is the instrument RI-CMB07 M1 Mode-A specifies. ' +
        'Refusing to spawn something that would look like an enemy and behave like furniture.');
    }
    const weapon = stat.weapon || { radius_m: 0.09, socket_a_dist_m: 0.6, socket_b_dist_m: 1.5, attack_rating: 120 };
    const moves = buildEnemyMoves(stat, this.d, weapon);
    const body = new CombatBody(id, 'E', this.d.skeleton, this.d.hitgeometry, moves, {
      hpMax: stat.hp,
      staminaMax: stat.stamina_max || 100,
      armourPoise: Math.max(0, (stat.poise || 20) - 20),
      armourRating: stat.armour_rating || 0,
      equipLoadPct: 50,
      poise: this.d.poise,
      clips: this.d.clips,
      shield: stat.shield ? this.d.stamina.block.shields[stat.shield] : null,
      haPool: stat.hyperarmour_pool || 0,
    });
    body.pos[0] = x; body.pos[2] = z;
    body.yaw = yaw === undefined ? 180 : yaw;
    const bcfg = this.d.hitgeometry.bodies || {};
    body.bodyRadius = stat.body_radius_m !== undefined ? stat.body_radius_m : (bcfg.default_enemy_radius_m || 0.30);
    body.archetype = stat.archetype;
    body.tier = stat.tier;
    body.statId = stat.id;
    body.parley = stat.parley || null;
    body.parleyRefusedUntil = 0;
    body.readsExhaustion = !!stat.reads_exhaustion;
    body.lockable = stat.lockable !== false;
    body.shieldId = stat.shield || null;
    // RI-WPN05 §B: "Every enemy statblock MUST declare a `material` per hurtbox region."
    // The body-level `material` is the default and `material_by_region` overrides it, so a
    // Hist-Marked champion can be plant at the trunk and metal where it wears a cuirass and a
    // player can learn to aim. A statblock declaring neither is recorded as UNDECLARED rather
    // than silently defaulting — `material_declared` is what a census counts (CRITIC-DOCTRINE
    // §7.3: a statblock with no material is unmeasurable, not "flesh").
    body.material = stat.material || 'flesh';
    body.materialByRegion = stat.material_by_region || null;
    body.materialDeclared = !!stat.material;
    body.knockbackImmune = !!stat.knockback_immune;
    body.evaluateRig(0);
    this.bodies.push(body);
    this.bodies.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    this.enemies.set(id, new EnemyController(body, stat, this.d));
    return body;
  }

  despawn(id) {
    const i = this.bodies.findIndex((b) => b.id === id);
    if (i >= 0) this.bodies.splice(i, 1);
    this.enemies.delete(id);
    if (this.lock.target === id) this.lock.release();
  }

  bodyOf(id) { return this.bodies.find((b) => b.id === id) || null; }

  /**
   * RI-CMB04 §A, all ten steps, in order, once per fixed 60 Hz step.
   * Steps 1–2 are the controllers' input resolution; 3–7 are inside them; 8–9 are the
   * resolver; 10 is the caller's trace record.
   */
  step(frame, input, camera, bus, sim) {
    this.frame = frame;
    const playerHpBefore = this.player ? this.player.hp : null;
    // Every combat event is emitted in RI-CMB07 §A's UPPER_SNAKE vocabulary (the
    // es-combat-trace/1 stream) and, where HARNESS.md §5 has an equivalent, in §5's
    // lower_snake vocabulary too (the elder-souls/trace@1 stream). Two streams, one run,
    // joined on the frame index — the arrangement RI-CMB07 §A already specifies.
    const emit = (f, kind) => {
      const e = bus.emit(f, kind);
      const alias = LEGACY_ALIAS[kind];
      if (alias) {
        const a = bus.emit(f, typeof alias === 'function' ? alias(e) : alias);
        a.mirrors = kind;
      }
      // W1-11 — `audio.combat.impact`. THE WORLD-SIDE CONSUMER OF THE IMPACT AUDIO MODEL.
      //
      // RI-AUD01 §B: "`audio.frame` for an impact event MUST equal the `f` of the trace event
      // that caused it. Not the animation-start frame. Not the next frame. Not 'whenever the
      // rAF callback got round to it'."
      //
      // The event is REFERENCED here and READ at the end of this same `step(frame)` call, and
      // the reason is a defect this hook shipped with for one probe run and is worth recording
      // rather than quietly fixing: every call site in `resolve.js` has the shape
      //
      //     const e = emit(frame, 'IMPACT');  e.material = ...;  e.tier = ...;
      //
      // so at the instant `emit` returns, the event carries `{f, kind}` and NOTHING ELSE. A
      // classifier reading it there sees no material and no tier, and cheerfully voices every
      // impact in the game as C01 `hit_flesh_light` — which is RI-AUD01's "one sword.wav"
      // failure arriving through the one door that looked safest. The first probe run said
      // `{"hit_flesh_light":50,"whiff":5}` across seven materials and four weight tiers, and
      // that number is the only reason it was caught.
      //
      // Draining at the END of the step keeps the decision on frame `f` — the frame the
      // geometry decided — while reading events that are actually filled in. It is still not
      // the animation track, still not the next frame, and still not rAF.
      if (this.audio) this._audioPending.push([f, kind, e]);
      return e;
    };
    const lockedBody = this.lock.target ? this.bodyOf(this.lock.target) : null;

    // ---- hitstop: the world HOLDS, and RI-WPN05 §A says the two participants hold on DIFFERENT
    // clocks --------------------------------------------------------------------------------
    //
    // Wave 1 froze every body for `sim.hitstopUntil` and returned. That is the right shape for
    // a symmetric impact and it makes §A's asymmetry table unobservable: a stone golem's victim
    // hitstop is **0** — "the target does not move. You do." — and under a global freeze it
    // moved exactly as little as a sack of flesh did. The bounce IS the asymmetry, so the
    // asymmetry has to be in the step.
    //
    // Each body now holds on `b.hitstopUntil`, which `resolve.js:applyHitstop` sets from the
    // material. When every body is held — the common case, and the whole of the hold for a
    // flesh hit — this takes the identical early return wave 1 took, so nothing that was
    // frame-exact before is frame-exact by luck now.
    let heldCount = 0;
    for (const b of this.bodies) {
      b.hitstop = (b.hitstopUntil || 0) > frame;
      if (b.hitstop) heldCount++;
    }
    if (heldCount === this.bodies.length && sim.hitstopUntil > frame) { this._flushAudio(); return; }
    for (const b of this.bodies) b._yawIn = b.yaw;

    // A hitstun state begins when the hold releases, never inside it — CombatBody.queueReaction.
    // This runs BEFORE the controllers so the controller's advance() takes the reaction to
    // anim_frame 1 in this same step, which is what makes the state exactly `total` frames
    // long (RI-CMB05 §B, RI-CMB03 §D) at every hitstop value including zero.
    for (const b of this.bodies) if (b.pendingReaction && !b.hitstop) b.flushReaction(frame);

    // Body separation — RI-AI01's minimum standoff. It relieves the overlap that LAST frame's
    // root motion produced, BEFORE this frame's root motion runs, and it moves `pos` only:
    // the rigs are re-evaluated from `pos` by the controllers a few lines below, so this
    // frame's swept hull spans the push honestly and `prev` still holds the pose the actor
    // really occupied last frame.
    //
    // WHY NOT AFTER THE CONTROLLERS. It was there first, and it broke S26. Separation applied
    // between root motion and the sweep deletes exactly the overlap the body hazard exists to
    // detect: the attacker lunges into the target, the push moves the target back out, and
    // the sweep sees two bodies that never touched. Measured on that arrangement, the player
    // spear's minimum reach went from 0.00 m to 1.30 m and the halberd's to 1.40 m — S26's
    // defect re-created on the player's side by the fix for the enemy's. Relieving the
    // previous frame's overlap instead means a collision is always resolved as a HIT first
    // (step 9, this frame) and as a PUSH second (step 5, next frame), which is the order the
    // two rules have to be in for both of them to be true.
    this.resolveBodyCollision();

    const ctx = {
      emit,
      bodies: this.bodies,
      enemies: this.enemies,   // seam S19: a RITUAL aborts the moment anything is AGGRO
      lockedBody,
      cameraYawDeg: camera ? camera.yaw : 0,
      player: this.player,
      world: this.world,
      rebuildLoadout: (p) => this.rebuildPlayerLoadout(p),
      // ---- W1-12. What the enemy AI needs and may not go and get for itself ---------------
      //
      // `combat/ai.js` is a decision module, so everything it reads about the wider world
      // arrives through this object. It is deliberately narrow: the AI can ask what the player
      // is doing, who its token peers are, and for a counted PRNG draw. It cannot reach the hit
      // test (seam S1), cannot see the encounter data, and cannot write anything but its own
      // body's pos/yaw/state.
      d: this.d,
      rng: this.rng || null,
      entityOf: this.entityOf || null,
      playerState: () => {
        const b = this.player;
        if (!b || !b.move) return null;
        // `heal` is the kind `moves.js` actually builds for RI-CMB08 §C's flask. The first
        // draft of this read `'flask'`, which is the name of the DATA file and not of the move,
        // so T22 — the anti-chug contract, the whole reason PUNISH_READ exists — was wired to a
        // string nothing ever sets. It cost one probe run to find and it would have cost a
        // verdict: an enemy that ignores a heal is the single most exploitable thing a
        // Souls-like can ship.
        if (b.move.kind === 'heal' || b.move.kind === 'item') return 'HEAL';
        // RI-AI01 T18's trigger, added in W1-12 round 2. A shield-bearing archetype raises its
        // guard when it sees the player WIND UP, and nothing in the build reported that phase.
        // Additive on purpose: `punish_read.trigger_player_states` is ["HEAL","ITEM",
        // "LONG_RECOVERY"], so this string cannot reach PUNISH_READ and T22 is unchanged.
        if (b.move.kind === 'attack' && b.animFrame <= b.move.startup) return 'ATTACK_WINDUP';
        // RI-AI01 T22's third trigger. A "long recovery" is one the player cannot cancel and
        // that lasts longer than the enemy needs to cross the PUNISH_READ band — anything with
        // a recovery of half a second or more qualifies, which is every heavy and every
        // greatweapon swing.
        if (b.move.kind === 'attack' && b.move.recovery >= 30
            && b.animFrame > b.move.startup + b.move.active) return 'LONG_RECOVERY';
        return null;
      },
      aiPeers: (key) => {
        const out = [];
        for (const b2 of this.bodies) {
          if (b2 === this.player || b2.dead) continue;
          const c2 = this.enemies.get(b2.id);
          if (!c2 || !c2.ai) continue;
          const k2 = (this.entityOf && this.entityOf(b2.id) && this.entityOf(b2.id).encounterId) || `solo:${b2.id}`;
          if (k2 === key) out.push(c2.ai);
        }
        return out.length ? out : [];
      },
    };

    // steps 1–7, player then enemies in stable id order (HARNESS.md D7).
    // A body inside its own hitstop hold does not step: its animation clock is frozen, which is
    // what hitstop IS. A body whose hold has expired steps even while its opponent is still
    // frozen — that is the stone bounce, seen from the golem's side.
    if (!this.player.hitstop) this.playerCtl.step(frame, input, ctx);
    for (const b of this.bodies) {
      if (b === this.player || b.hitstop) continue;
      const ec = this.enemies.get(b.id);
      if (ec) ec.step(frame, ctx);
    }

    // THE BOUNDED-TURN LAW, enforced once for every actor rather than at each of the eleven
    // sites that assign `yaw`.
    //
    // RI-CAM02 §C gives the ceiling — 720 °/s moving, 480 °/s stationary — and player.js
    // already cites it ("a levitating character still cannot snap its facing"). Eleven call
    // sites obeyed it and two did not, and the two that did not were the largest single-frame
    // pose discontinuities in the build: the champion snapping to the player's bearing on the
    // frame an attack began (3.390 m of weapon socket, 203 m/s) and the player's facing
    // reversing across a roll-into-attack (2.493 m, 150 m/s). Both are invisible in a still
    // and both are a teleport in motion. A ceiling that is enforced in one place cannot be
    // forgotten by the twelfth site.
    //
    // A yaw snap is not a pose problem and the pose cross-fade cannot fix it: the cross-fade
    // blends bone Eulers in the actor's own frame, and the actor's frame is exactly what a
    // yaw snap moves. They are two different discontinuities and they need two different fixes.
    const maxYawStep = (this.d.locomotion.turn_rate_moving_dps || 720) / 60;
    for (const b of this.bodies) {
      if (b.dead || b.yawExempt) { b.yawExempt = false; continue; }
      const dd = angleDelta(b._yawIn, b.yaw);
      if (dd > maxYawStep) b.yaw = norm360(b._yawIn + maxYawStep);
      else if (dd < -maxYawStep) b.yaw = norm360(b._yawIn - maxYawStep);
      else continue;
      // The pose was evaluated at the un-clamped facing, so re-evaluate at the clamped one.
      // `prev` is untouched: the previous frame really did happen where it happened.
      b.rig.evaluate(b.pos, b.yaw, b._lastRootDy || 0, b.moves._weapon.socket_a_dist_m, b.moves._weapon.socket_b_dist_m);
      b.socketA[0] = b.rig.socketA[0]; b.socketA[1] = b.rig.socketA[1]; b.socketA[2] = b.rig.socketA[2];
      b.socketB[0] = b.rig.socketB[0]; b.socketB[1] = b.rig.socketB[1]; b.socketB[2] = b.rig.socketB[2];
    }

    // steps 8–9
    sweepAndResolve(this.bodies, this.d, frame, emit, sim);

    // S44 AQ-02: camera feedback belongs to CAM06, not to an attack's impact request. The
    // observable trigger is strictly a loss of PLAYER HP. Blocks/parries and player-dealt
    // hits therefore cannot call the consumer, while enemy damage does so once on resolution.
    if (this.playerDamageFeedback && this.player && this.player.hp < playerHpBefore) {
      this.playerDamageFeedback({
        frame,
        damage: playerHpBefore - this.player.hp,
        hp_before: playerHpBefore,
        hp_after: this.player.hp,
        hp_max: this.player.hpMax,
        hp_fraction: (playerHpBefore - this.player.hp) / Math.max(1, this.player.hpMax),
      });
    }

    // lock retention, after positions have moved
    const brk = this.lock.update(this.player, this.bodies, frame, true);
    if (brk) { const e = emit(frame, 'LOCK_BREAK'); e.reason = brk; }
    if (camera) this.lock.measureFraming(camera, this.player, this.lock.target ? this.bodyOf(this.lock.target) : null, camera.fov, 16 / 9);

    // W1-11. Every event this frame emitted, now fully filled, in emission order, on frame
    // `frame`. See the note in the `emit` closure above for why this is here and not there.
    this._flushAudio();
  }

  /**
   * Hand this frame's events to the impact-audio driver, in emission order.
   *
   * Order matters and is not incidental: RI-AUD02 V9's same-frame same-class collapse and the
   * V7 steal policy both depend on which of two simultaneous events arrived first, and the
   * emission order is the resolver's iteration order, which is itself a function of state alone
   * (resolve.js's header: "even the ORDER of the emitted tuples is a function of the state").
   * So the audio decisions are as deterministic as the fight is.
   */
  _flushAudio() {
    const q = this._audioPending;
    if (!q.length) return;
    if (this.audio) {
      const world = this._audioWorld();
      for (let i = 0; i < q.length; i++) this.audio.onEvent(q[i][0], q[i][1], q[i][2], world);
    }
    q.length = 0;
  }

  /**
   * RI-CMB04 §A step 5's "resolve collision", and RI-AI01 §spacing's minimum standoff.
   *
   * Before this existed the step-order comment said `resolve collision` and nothing did, so
   * two characters could stand at the same point. That is not a cosmetic omission: the W1-09
   * round-2 verdict's single biggest consequence was "the correct way to fight this game's
   * boss is to walk inside it and stand still", and half of why that worked is that walking
   * inside it was possible at all. RI-AI01's own check fails a build whose enemy spends more
   * than 0.35 of its AGGRO time inside the player.
   *
   * Deterministic by construction: one pass, bodies in stable id order, pure float arithmetic,
   * no RNG, no iteration-count dependence. Two bodies at exactly the same point separate along
   * the lower-id body's facing, which is a function of the state alone.
   */
  resolveBodyCollision() {
    const cfg = this.d.hitgeometry.bodies;
    if (!cfg) return;
    const n = this.bodies.length;
    for (let i = 0; i < n; i++) {
      const A = this.bodies[i];
      if (A.dead) continue;
      for (let j = i + 1; j < n; j++) {
        const B = this.bodies[j];
        if (B.dead) continue;
        const rA = A.bodyRadius, rB = B.bodyRadius;
        const want = rA + rB;
        let dx = B.pos[0] - A.pos[0], dz = B.pos[2] - A.pos[2];
        let d = Math.hypot(dx, dz);
        if (d >= want) continue;
        if (d < 1e-6) {
          const rad = A.yaw * Math.PI / 180;
          dx = Math.sin(rad); dz = Math.cos(rad); d = 1;
        }
        const nx = dx / d, nz = dz / d;
        // A FORCE, not a constraint — see hitgeometry.json §bodies.separation. An uncapped
        // push outruns the swing that caused the overlap.
        // Who yields. A body consuming root motion from a committed move this frame is
        // DRIVING and does not give ground; the other takes the whole displacement.
        const drivingA = !!(A.move && A.lastRootDelta !== 0);
        const drivingB = !!(B.move && B.lastRootDelta !== 0);
        // A FORCE, not a constraint — see hitgeometry.json §bodies.separation. An uncapped
        // push outruns the swing that caused the overlap.
        //
        // But a cap ALONE is a hole rather than a smoothing, and that is what wave 1 shipped.
        // A champion's chop carries its root 0.80 m across 10 active frames — 0.080 m/frame —
        // against a 0.050 m/frame cap, so the lunge outran its own separation and buried the
        // target a third of a metre INSIDE the attacker, which is precisely where the round-2
        // dead ring lives and precisely why the model measured as consuming nothing (round-3
        // verdict §5: both radii zeroed, 585/2617 interpenetrating frames and 0.015 m minimum
        // centre distance, byte-identical). §bodies.separation.driver_carry: the driver's own
        // root translation along the contact normal is carried in FULL on top of the capped
        // restorative term. You cannot walk THROUGH a body; you can only fail to be teleported
        // off one. Overlap can no longer deepen frame-on-frame, and pre-existing overlap still
        // relieves gradually, so the hit still resolves before the push does.
        const cap = (cfg.separation.max_speed_mps || 3.0) / 60;
        let carry = 0;
        if (cfg.separation.driver_carry) {
          if (drivingA && !drivingB) carry = advanceAlong(A, nx, nz);
          else if (drivingB && !drivingA) carry = advanceAlong(B, -nx, -nz);
          else if (drivingA && drivingB) carry = Math.max(advanceAlong(A, nx, nz), advanceAlong(B, -nx, -nz));
        }
        const push = Math.min(want - d, cap + carry);
        let shareA;
        if (drivingA && !drivingB) shareA = 0;
        else if (drivingB && !drivingA) shareA = 1;
        else shareA = rB / (rA + rB);          // the smaller body moves further
        A.displace(-nx * push * shareA, -nz * push * shareA);
        B.displace(nx * push * (1 - shareA), nz * push * (1 - shareA));
      }
    }
  }

  /**
   * The stance switch (RI-WPN06 §A) and the quick swap, applied when their committed animation
   * ENDS. Rebuilds the player's MOVE TABLE only — the body, and therefore hp, stamina, poise,
   * position, facing and the swing counter, is untouched. Rebuilding the body here would make
   * a mid-fight swap a free full heal.
   */
  rebuildPlayerLoadout(patch) {
    const d = this.d;
    const L = this._playerLoadout || {};
    if (patch.twoHanded !== undefined) L.twoHanded = patch.twoHanded;
    if (patch.cycle) {
      if (patch.cycle === 'right') {
        const ids = (this.lib ? Object.keys(d.weaponMovesets) : Object.keys(d.movesets)).sort();
        const cur = this.lib ? (this.movesetFor(L.weapon).weapon_id) : L.weapon;
        const i = ids.indexOf(cur);
        L.weapon = ids[(i + 1) % ids.length];
      } else {
        const ids = Object.keys(d.stamina.block.shields).sort().concat([null]);
        const i = ids.indexOf(L.shield === undefined ? null : L.shield);
        L.shield = ids[(i + 1) % ids.length];
      }
    }
    const moveset = this.movesetFor(L.weapon);
    // RI-WPN06 §A: two-handed, the offhand item is STOWED for the whole duration — `block`,
    // `parry` and `off.*` are unavailable and there is no shield to bash with.
    const sh = L.twoHanded || !L.shield ? null : this.shieldFor(L.shield);
    const shieldId = sh ? sh.id : null;
    const shield = sh ? sh.row : null;
    const moves = buildMoveTable(d, moveset, shieldId, { twoHanded: !!L.twoHanded, lib: this.lib, shieldRow: shield });
    this.player.setMoves(moves);
    this.player.shield = shield;
    this.player.shieldId = shieldId;
    this.player.weaponId = moveset.weapon_id || moveset.id;
    this.player.weaponClass = moveset.class || null;
    this.player.offhandConfig = L.twoHanded ? 'o3_twohand' : (L.offhand === 'o2_dual' ? 'o2_dual' : 'o1_sword_shield');
    this.player.offhandKind = L.twoHanded ? 'stowed' : (L.offhand === 'o2_dual' ? 'weapon' : 'shield');
    if (L.twoHanded) this.player.guardRaised = false;
    this._playerLoadout = L;
    return { weapon: moves._movesetId, shield: this.player.shieldId, two_handed: this.player.twoHanded };
  }

  toggleLock(frame, cameraYawDeg, bus) {
    if (this.lock.target) {
      const t = this.lock.release();
      const e = bus.emit(frame, 'LOCK_BREAK'); e.reason = 'manual'; e.was = t;
      return null;
    }
    const r = this.lock.acquire(this.player, this.bodies, cameraYawDeg, frame);
    if (r) { const e = bus.emit(frame, 'LOCK_ON'); e.tgt = r.target; e.range_m = r.range_m; e.score = r.score; }
    return r;
  }

  setLock(id) {
    if (id === null) { this.lock.release(); return null; }
    if (!this.bodyOf(id)) throw new Error(`lockOn('${id}'): no such body`);
    this.lock.target = id;
    return id;
  }

  tierOf(body) { return equipTier(body.equipLoadPct, this.d.roll.tier_boundaries_pct); }

  /** Distance from the player to a body, for the trace's e[].dist_m. */
  distTo(body) {
    return Math.hypot(body.pos[0] - this.player.pos[0], body.pos[2] - this.player.pos[2]);
  }

  bearingFromPlayer(body) {
    return bearingDeg(body.pos[0] - this.player.pos[0], body.pos[2] - this.player.pos[2]);
  }
}

/** RI-CMB07 §A kind -> HARNESS.md §5 kind, so the W1-00 stream keeps its vocabulary. */
const LEGACY_ALIAS = {
  HIT: 'hit',
  CRIT_HIT: (e) => (e.kind === 'riposte' ? 'riposte' : 'backstab'),
  BLOCK: 'block',
  // RI-WPN04 §B harness request 4 / RI-WPN06 §E: a block that KEPT the guard up, distinct from
  // `block`. `guard.counter` is unmeasurable without it.
  BLOCK_SUCCESS: 'block_success',
  CHARGE_RELEASE: 'charge_release',
  PARRY: 'parry',
  STAGGER: 'stagger',
  DEATH: 'death',
  GUARD_BREAK: 'guard_break',
  GUARD_UP: 'guard_up',
  WHIFF: 'whiff',
  IFRAME_NEGATE: 'iframe_dodge',
  ESTUS_START: 'heal',
  ACTION_START: (e) => (e.tag === 'dodge' ? 'roll_start' : 'attack_start'),
  INPUT_DROPPED: (e) => (e.reason === 'no_stamina' ? 'input_dropped_no_stamina'
    : e.reason === 'not_actionable' ? 'input_dropped_not_actionable' : 'input_dropped'),
  INPUT_BUFFERED: 'input_buffered',
  EXHAUSTED_ENTER: 'exhausted_enter',
  EXHAUSTED_EXIT: 'exhausted_exit',
  WINDED: 'winded',
  PARLEY_ACCEPT: 'parley_accept',
  PARLEY_REFUSE: 'parley_refuse',
  PARLEY_EXEMPT: 'parley_exempt',
  LOCK_ON: 'lock_on',
  LOCK_BREAK: 'lock_break',
  LOCK_SWITCH: 'lock_switch',
};
