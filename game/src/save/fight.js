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

const r6 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : v);

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

const relStamp = (v, now) => (typeof v !== 'number' ? v : (v <= 0 ? v : v - now));
const absStamp = (v, now) => (typeof v !== 'number' ? v : (v <= 0 ? v : v + now));

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
    out[k] = encode(v, k, now, t);
  }
  return out;
}

export function loadActor(o, rec, now, table) {
  if (rec.rig && o.rig && typeof o.rig.loadState === 'function') o.rig.loadState(rec.rig);
  for (const k of Object.keys(rec)) {
    if (k === 'rig') continue;
    if (SKIP.has(k)) continue;
    const v = rec[k];
    if (k === 'move' || k === 'pendingMove') { o[k] = v === null ? null : (table[v] || null); continue; }
    if (k === 'hitThisSwing') { o[k] = new Set(v); continue; }
    if (k === 'pos' || k === 'socketA' || k === 'socketB' || k === 'prevA' || k === 'prevB') {
      o[k][0] = v[0]; o[k][1] = v[1]; o[k][2] = v[2];
      continue;
    }
    o[k] = decode(v, k, now, table);
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
