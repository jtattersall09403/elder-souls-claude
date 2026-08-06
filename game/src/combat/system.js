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
import { sweepAndResolve } from './resolve.js';
import { staminaMaxFor } from './rules.js';
import { bearingDeg } from './geometry.js';

export class CombatSystem {
  /** @param {object} data all of game/data/combat/*.json keyed by basename, plus locomotion */
  constructor(data) {
    this.d = data;
    this.bodies = [];
    this.player = null;
    this.playerCtl = null;
    this.enemies = new Map();          // id -> EnemyController
    this.lock = new LockOn(data.lockon);
    this.eventLog = [];
    this.frame = 0;
    this.world = { gold: 0, dispositions: {}, factions: {}, topicsKnown: [] };
    this.stats = { hitsLanded: 0, iframeNegates: 0, blocks: 0, guardBreaks: 0, parries: 0, whiffs: 0, staminaDrops: 0 };
  }

  static stateEnums() {
    return { player: PLAYER_STATE_ENUM, enemy: ENEMY_STATE_ENUM, extensions: STATE_ENUM_EXTENSIONS };
  }

  createPlayer(loadout) {
    const d = this.d;
    const moveset = d.movesets[loadout.weapon || 'straight-sword'];
    if (!moveset) throw new Error(`createPlayer: no moveset '${loadout.weapon}'. Known: ${Object.keys(d.movesets).join(', ')}`);
    const shieldId = loadout.shield === null ? null : (loadout.shield || d.stamina.block.exemplar_shield);
    const shield = shieldId ? d.stamina.block.shields[shieldId] : null;
    const moves = buildMoveTable(d, moveset, shieldId, { twoHanded: !!loadout.twoHanded });
    const endurance = loadout.endurance !== undefined ? loadout.endurance : 20;
    const body = new CombatBody('P', 'P', d.skeleton, d.hitgeometry, moves, {
      hpMax: loadout.hpMax !== undefined ? loadout.hpMax : 620,
      staminaMax: staminaMaxFor(endurance, d.stamina),
      armourPoise: loadout.armourPoise !== undefined ? loadout.armourPoise : 28,
      equipLoadPct: loadout.equipLoadPct !== undefined ? loadout.equipLoadPct : 24.0,
      poise: d.poise,
      shield,
      haPool: (d.poise.hyperarmour.pools[moveset.class_key] || {}).one_handed || 0,
    });
    body.shieldId = shieldId;
    body.twoHanded = !!moves._twoHanded;
    body.lockable = false;
    this._playerLoadout = Object.assign({}, loadout, { weapon: loadout.weapon || 'straight-sword', shield: shieldId });
    this.player = body;
    this.playerCtl = new PlayerController(body, d, this.lock);
    this.playerCtl.magic = this.magic || null;   // seam S19: set by the engine at boot
    this.playerCtl.flaskLevel = loadout.flaskLevel || 0;
    this.playerCtl.estus = loadout.estus !== undefined ? loadout.estus : d.flask.charges.at_game_start;
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
      equipLoadPct: 50,
      poise: this.d.poise,
      shield: stat.shield ? this.d.stamina.block.shields[stat.shield] : null,
      haPool: stat.hyperarmour_pool || 0,
    });
    body.pos[0] = x; body.pos[2] = z;
    body.yaw = yaw === undefined ? 180 : yaw;
    body.archetype = stat.archetype;
    body.tier = stat.tier;
    body.statId = stat.id;
    body.parley = stat.parley || null;
    body.parleyRefusedUntil = 0;
    body.readsExhaustion = !!stat.reads_exhaustion;
    body.lockable = stat.lockable !== false;
    body.shieldId = stat.shield || null;
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
      return e;
    };
    const lockedBody = this.lock.target ? this.bodyOf(this.lock.target) : null;

    // hitstop: the world HOLDS. Animation clocks do not advance; nothing resolves.
    if (sim.hitstopUntil > frame) {
      for (const b of this.bodies) b.hitstop = true;
      return;
    }
    for (const b of this.bodies) b.hitstop = false;

    // A hitstun state begins when the hold releases, never inside it — CombatBody.queueReaction.
    // This runs BEFORE the controllers so the controller's advance() takes the reaction to
    // anim_frame 1 in this same step, which is what makes the state exactly `total` frames
    // long (RI-CMB05 §B, RI-CMB03 §D) at every hitstop value including zero.
    for (const b of this.bodies) if (b.pendingReaction) b.flushReaction(frame);

    const ctx = {
      emit,
      bodies: this.bodies,
      lockedBody,
      cameraYawDeg: camera ? camera.yaw : 0,
      player: this.player,
      world: this.world,
      rebuildLoadout: (p) => this.rebuildPlayerLoadout(p),
    };

    // steps 1–7, player then enemies in stable id order (HARNESS.md D7)
    this.playerCtl.step(frame, input, ctx);
    for (const b of this.bodies) {
      if (b === this.player) continue;
      const ec = this.enemies.get(b.id);
      if (ec) ec.step(frame, ctx);
    }

    // steps 8–9
    sweepAndResolve(this.bodies, this.d, frame, emit, sim);

    // lock retention, after positions have moved
    const brk = this.lock.update(this.player, this.bodies, frame, true);
    if (brk) { const e = emit(frame, 'LOCK_BREAK'); e.reason = brk; }
    if (camera) this.lock.measureFraming(camera, this.player, this.lock.target ? this.bodyOf(this.lock.target) : null, camera.fov, 16 / 9);

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
        const ids = Object.keys(d.movesets).sort();
        const i = ids.indexOf(L.weapon);
        L.weapon = ids[(i + 1) % ids.length];
      } else {
        const ids = Object.keys(d.stamina.block.shields).sort().concat([null]);
        const i = ids.indexOf(L.shield === undefined ? null : L.shield);
        L.shield = ids[(i + 1) % ids.length];
      }
    }
    const moveset = d.movesets[L.weapon];
    if (!moveset) throw new Error(`rebuildPlayerLoadout: no moveset '${L.weapon}'`);
    const shield = L.shield ? d.stamina.block.shields[L.shield] : null;
    const moves = buildMoveTable(d, moveset, L.shield || null, { twoHanded: !!L.twoHanded });
    this.player.setMoves(moves);
    this.player.shield = shield;
    this.player.shieldId = L.shield || null;
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
