// THE FIGHT, MADE DURABLE.
//
// `sim/combat-bridge.js` opens with a declaration: "the combat bodies are the AUTHORITY and
// `sim.player` / `sim.entities` are a VIEW", followed by "DECLARED CONSEQUENCE: mid-animation
// combat state is NOT durable." That declaration is retired by this file, and the reason is
// that the save did not honour it either — it recorded `pose.state`, `pose.anim`,
// `pose.anim_frame`, `pose.anim_len`, `pose.phase` and `pose.move` off the VIEW, restored them
// into the view, hashed them, and then let the first `mirror()` after the load overwrite all
// six from a body that had never been restored. A save that records a field it cannot put back
// is worse than one that admits it does not carry it: it passes its own round trip at frame 0
// and is a different world at frame 1.
//
// So the fight is carried. Three records, and the discipline is the one `RI-JRN05` §B already
// forces on the entity record: the field set is ENUMERATED FROM THE LIVE OBJECT rather than
// hand-listed, so a field W1-09 adds next week appears in the save and in the census without
// anybody remembering to declare it, and the things that are deliberately NOT carried are
// named here with their reasons rather than being absent.
//
//   * the LOADOUT — which weapon, which shield, which offhand configuration, endurance,
//     armour poise, equip load, HP ceiling, flask. Without it a cold load (`RI-JRN05` M3) or
//     a `readSave()` into a session holding a different weapon rebuilds the wrong fight, and
//     `inventory[].equipped_slot` — a manifest field since wave 1 — has no consumer at all.
//   * the PLAYER BODY and its controller.
//   * every ENEMY BODY and its controller, keyed by eid against `world.entities`.
//
// ABSOLUTE FRAME INDICES. `loadState()` resets the frame to 0 (`RI-MTH01` A07), so every field
// holding a frame stamp is stored as a difference and rebuilt against the loaded frame, exactly
// as `pose.*_in_frames` and `entities[].state_entered_ago_frames` already are. The set is
// DECLARED below rather than pattern-matched, because the obvious pattern (a name ending in
// `Frame`) is wrong twice over: `animFrame` and `_loopFrame` are phase counters, not stamps.
// A value at or below zero is a sentinel (`blockSuccessFrame` is -9999, `twoHandPressedAt` is
// -1, an unset timer is 0) and passes through unchanged — differencing a sentinel would turn
// "never" into a date.
'use strict';

export const r6 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : v);

/** Not state: handles to shared data tables, to other objects, or to the rig that is rebuilt. */
const SKIP = new Set([
  'rig',        // rebuilt by evaluateRig() from pos/yaw/move/animFrame every frame
  'moves',      // the move TABLE, shared per (weapon, slot) and rebuilt from the loadout
  'cfg',        // the construction config, rebuilt from the loadout
  'shield',     // a data row from offhand.json / stamina.json, rebuilt from `shieldId`
  'd',          // the data bundle
  'b',          // controller -> body backreference
  'lock',       // the shared LockOn, restored from pose.locked_on
  'lib',        // MovesetLibrary
  'magic',      // the MagicSystem, restored by save/state.js's magic block
  'stat',       // the archetype row, rebuilt from `world.entities[].id`
  '_derived',   // a Map memo of pure functions of the body
  'id', 'side', // identity, supplied when the body is created
]);

/** Frame STAMPS. Stored as differences against the save frame; sentinels (<= 0) pass through. */
export const FRAME_STAMP_FIELDS = [
  // CombatBody
  'regenBlockUntil', 'poiseRegenBlockUntil', 'actionableAt', 'hitstopUntil',
  'staggerUntil', 'guardBreakUntil', 'parriedUntil', 'paralysedUntil', 'silencedUntil',
  'calmedUntil', 'fleeingUntil', 'charmedUntil', 'frenziedUntil', 'parleyRefusedUntil',
  'moveStartFrame', 'blockSuccessFrame', 'staggerStart', 'guardBreakStart', 'parriedStart',
  'losLostAt',
  // PlayerController / EnemyController
  'chainUntil', 'lastBlockFrame', 'sprintReleasedAt', 'lastLightPress',
  'twoHandPressedAt', 'swapLeftPressedAt', 'windedUntil',
];
const STAMP = new Set(FRAME_STAMP_FIELDS);

export const relStamp = (v, now) => (typeof v !== 'number' ? v : (v <= 0 ? v : v - now));
export const absStamp = (v, now) => (typeof v !== 'number' ? v : (v <= 0 ? v : v + now));

/**
 * A LIVE OBJECT — an instance of a class, not a plain record — and the reason this function
 * exists rather than one more name in `SKIP`.
 *
 * THE DEFECT IT ABOLISHES. `SKIP` did not list `ai`, so `saveActor(ctl)` walked the live
 * `SoulsAI` with `encode()`, which does not care what an object's prototype is: it emitted the
 * state machine's fields, and behind `ai.b` the whole `CombatBody`, behind `ai.stat` the
 * statblock and behind `ai.cfg` the entirety of `ai.json` — 81,892 bytes of a 194,161-byte
 * save, 42% of the file. `loadActor` then assigned that plain object back over the instance,
 * and the next fixed step threw `this.ai.step is not a function`, killing every stepping probe
 * in the project — **while `boot-check` stayed green, because boot does not step.** That is
 * rule 15's failure mode wearing different clothes, and rule 13's: not one agent's problem.
 *
 * WHY NOT JUST `SKIP` IT. Because a `SoulsAI` is not a handle. It holds behavioural state a
 * player would expect to persist — what it is doing, who has the attack token, where its leash
 * is anchored, when it last committed — and `EnemyController.step()` guards its AI call with
 * `if (this.ai)`, so a skipped `ai` restores as `null` and the enemy simply stands there
 * forever. That is the SAME class of defect as `post` in `save/state.js` (a field the writer
 * dropped, restoring quest-givers invisibly inside locked cellars), only quieter: no throw, no
 * diff, an enemy that has stopped thinking. So the split is made explicitly, by the class that
 * knows it: `SoulsAI.saveState()` carries the state, and the constructor rebuilds the
 * machinery.
 *
 * AND WHY IT IS A RULE RATHER THAN A CASE. "A live object serialised as a plain object, then
 * called" is a shape, not a one-off. Every actor field is now classified: a class instance is
 * carried through its own `saveState`/`loadState` or it is NOT CARRIED AT ALL and says so in
 * `__unsaved`. `loadActor` never assigns a plain object over a live one again. Losing state
 * loudly is recoverable; handing back an object with the right fields and no methods is not.
 * `tools/check-save-shape.mjs` (pre-commit, no browser) fails closed on the `__unsaved` list
 * and on any restored object that lost a method.
 *
 * Typed arrays are DATA, not machinery — `encode()` has always walked them and they have no
 * behaviour to lose — so they are deliberately not live objects here.
 *
 * @returns {string|null} the constructor name, or null if `v` is not a live object.
 */
export function liveObjectName(v) {
  if (v === null || typeof v !== 'object') return null;
  if (Array.isArray(v) || v instanceof Set || v instanceof Map || ArrayBuffer.isView(v)) return null;
  const p = Object.getPrototypeOf(v);
  if (p === Object.prototype || p === null) return null;
  return (p.constructor && p.constructor.name) || 'anonymous';
}

/**
 * A move reference becomes its TABLE KEY, and that distinction is a defect this repair had to
 * find twice. `move.id` is the move's NAME (`roll`); the key it lives under in the body's move
 * table is `roll_LIGHT`, because RI-CMB09 §2 gives every equip tier its own roll. Serialising
 * `move.id` therefore round-tripped every attack (whose slot id and `id` agree) and silently
 * dropped every roll and backstep: measured on `barge-hold`, where the pre-roll ends mid-roll,
 * `player.move` came back null, `player.phase` 'active' -> 'none', and RI-JRN05 M5 diverged on
 * 45 fields for 500+ of 600 frames.
 *
 * The alias rows (`out.light === out['r1.1']`) are the same OBJECT, so any key that resolves to
 * it restores the identical move; the scan is over sorted keys so the choice is canonical.
 */
function moveKeyOf(m, table) {
  if (!m) return null;
  if (table) for (const k of Object.keys(table).sort()) if (table[k] === m) return k;
  return m.id !== undefined ? m.id : null;
}

function encode(v, key, now, table) {
  if (v === undefined) return null;
  if (v === null) return null;
  if (v instanceof Set) return [...v].map(String).sort();
  if (v instanceof Map) return [...v.entries()].map(([k, x]) => [String(k), encode(x, '', now, table)]).sort();
  if (Array.isArray(v)) return v.map((x) => encode(x, key, now, table));
  if (typeof v === 'number') return STAMP.has(key) ? relStamp(v, now) : r6(v);
  if (typeof v === 'function') return null;
  if (typeof v === 'object') {
    // A move object anywhere in the graph is carried as its table key — the table it lives in
    // is shared between every actor holding that weapon and is rebuilt from the loadout.
    if (v.total !== undefined && v.startup !== undefined && v.id !== undefined) return { __move: moveKeyOf(v, table) };
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = encode(v[k], k, now, table);
    return out;
  }
  return v;
}

function decode(v, key, now, table) {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map((x) => decode(x, key, now, table));
  if (typeof v === 'number') return STAMP.has(key) ? absStamp(v, now) : v;
  if (typeof v === 'object') {
    if (v.__move !== undefined) return (table && table[v.__move]) || null;
    const out = {};
    for (const k of Object.keys(v)) out[k] = decode(v[k], k, now, table);
    return out;
  }
  return v;
}

/** Which own keys of an actor object are carried. Sorted, so the record is canonical. */
export function actorFields(o) {
  return Object.keys(o).filter((k) => !SKIP.has(k)).sort();
}

export function saveActor(o, now, table) {
  const t = table || o.moves || (o.b && o.b.moves) || null;
  const out = {};
  // The rig is skipped as an OBJECT (it is rebuilt from skeleton.json) but it carries real
  // animation state: the pose the actor is holding, a cross-fade in progress, and last
  // frame's hurtbox capsules. See Rig.saveState() for the measurement that put it here.
  if (o.rig && typeof o.rig.saveState === 'function') out.rig = o.rig.saveState();
  for (const k of actorFields(o)) {
    const v = o[k];
    if (k === 'move' || k === 'pendingMove') { out[k] = moveKeyOf(v, t); continue; }
    if (k === 'hitThisSwing') { out[k] = [...v].map(String).sort(); continue; }
    if (typeof v === 'function') continue;
    // A LIVE OBJECT is never walked by `encode()`. See `liveObjectName()` for what that cost.
    const live = liveObjectName(v);
    if (live) {
      if (typeof v.saveState === 'function') { out[k] = { __live: live, s: v.saveState(now) }; continue; }
      // Not carried, and LOUD about it rather than serialised into a corpse. `__unsaved` is
      // absent on a sound tree, so it costs nothing until something is wrong — and when it is
      // present, `check-save-shape.mjs` and `getSaveManifest()` both see it.
      (out.__unsaved || (out.__unsaved = [])).push(`${k}:${live}`);
      continue;
    }
    out[k] = encode(v, k, now, t);
  }
  return out;
}

/** Is this record the `{__live, s}` envelope `saveActor` writes for a class instance? */
const isLiveRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && v.__live !== undefined;

export function loadActor(o, rec, now, table) {
  if (rec.rig && o.rig && typeof o.rig.loadState === 'function') o.rig.loadState(rec.rig);
  const live = [];
  for (const k of Object.keys(rec)) {
    if (k === 'rig' || k === '__unsaved') continue;
    if (SKIP.has(k)) continue;
    const v = rec[k];
    // A LIVE OBJECT goes back through its own loader or it does not go back at all, and it
    // goes back in a SECOND PASS. The one thing that may never happen again is the assignment
    // on the last line of this loop running against a class instance: that is what turned a
    // `SoulsAI` into a record with the right fields and no `step`, and it failed on the frame
    // AFTER the load, where no gate in this project was looking.
    if (isLiveRecord(v)) { live.push([k, v]); continue; }
    if (k === 'move' || k === 'pendingMove') { o[k] = v === null ? null : (table[v] || null); continue; }
    if (k === 'hitThisSwing') { o[k] = new Set(v); continue; }
    if (k === 'pos' || k === 'socketA' || k === 'socketB' || k === 'prevA' || k === 'prevB') {
      o[k][0] = v[0]; o[k][1] = v[1]; o[k][2] = v[2];
      continue;
    }
    o[k] = decode(v, k, now, table);
  }
  // ---- second pass: the live objects ------------------------------------------------------
  // AFTER the plain fields, and that ordering is the whole reason it is a second pass.
  // `EnemyController.ai` is built lazily on the controller's first step ("the behaviour is
  // resolved lazily, on the first step, and not here: `loadScript()` is called AFTER the
  // controller is constructed"), so at load time `o.ai` is still `null` and there is nothing
  // to load into. `_resolveAI()` is what builds it, and it decides `scripted` vs `souls` from
  // `this.script.length` — so it may only be called once `script` and `behaviour` have been
  // restored, which is here and is not inside the loop above.
  for (const [k, v] of live) {
    if (o[k] === null || o[k] === undefined) {
      if (k === 'ai' && typeof o._resolveAI === 'function') o._resolveAI();
    }
    const target = o[k];
    if (target && typeof target.loadState === 'function') target.loadState(v.s, now);
  }
  return o;
}

/**
 * The loadout, as the fight itself reports it. Read from `CombatSystem._playerLoadout`, which
 * `createPlayer()` writes from the resolved weapon/shield/offhand rather than from what it was
 * asked for — so a save records what the player is actually holding, not what a state file
 * once named.
 */
export function saveLoadout(combat, magic, sim) {
  const l = (combat && combat._playerLoadout) || {};
  const b = combat && combat.player;
  const ctl = combat && combat.playerCtl;
  return {
    weapon: (b && b.weaponId) || l.weapon || null,
    weapon_class: (b && b.weaponClass) || null,
    shield: l.shield === undefined ? null : l.shield,
    offhand: l.offhand === undefined ? null : l.offhand,
    left: l.left === undefined ? null : l.left,
    two_handed: !!(b && b.twoHanded),
    endurance: l.endurance === undefined ? null : l.endurance,
    armour_poise: b ? b.armourPoise : (l.armourPoise === undefined ? null : l.armourPoise),
    equip_load_pct: b ? r6(b.equipLoadPct) : null,
    hp_max: b ? b.hpMax : null,
    stamina_max: b ? b.staminaMax : null,
    flask_level: ctl ? ctl.flaskLevel : 0,
    gold: sim && sim.progression ? (sim.progression.gold || 0) : 0,
    willpower: magic && magic.wil !== undefined ? magic.wil : null,
  };
}

/** The whole fight: loadout, player body + controller, and every enemy body + controller. */
export function saveFight(sim, combat, magic, now) {
  if (!combat || !combat.player) {
    return { loadout: saveLoadout(combat, magic, sim), player: null, player_ctl: null, enemies: [] };
  }
  const enemies = [];
  for (const b of combat.bodies) {
    if (b === combat.player) continue;
    const ctl = combat.enemies.get(b.id);
    enemies.push({ eid: b.id, stat_id: b.statId || null, body: saveActor(b, now, b.moves), ctl: ctl ? saveActor(ctl, now, b.moves) : null });
  }
  enemies.sort((a, b) => (a.eid < b.eid ? -1 : a.eid > b.eid ? 1 : 0));
  return {
    loadout: saveLoadout(combat, magic, sim),
    player: saveActor(combat.player, now, combat.player.moves),
    player_ctl: combat.playerCtl ? saveActor(combat.playerCtl, now, combat.player.moves) : null,
    enemies,
  };
}
