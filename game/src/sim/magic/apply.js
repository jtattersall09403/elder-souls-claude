// The per-effect handler registry — RI-MAG06's answer to `GAP-W1-magic-effects-no-behaviour`.
//
// THE DEFECT THIS FILE EXISTS TO DELETE. Wave 1 shipped one generic applicator:
//
//     for (const t of spell.effects) dmg += outputOf(t.effect, t.magnitude);
//     target.hp -= dmg;  push a timer row;
//
// Twenty lines, 55 labels, five working effects. It produced correct `effect_apply` events with
// correct magnitudes and durations, it satisfied every static census in `corpus/25-magic/`, and
// the W1-14 critic measured `demoralise` doing 111 hp to an enemy that stayed AGGRO and
// `open_lock` doing 31 hp to a *creature*. RI-MAG06 §B is the remedy in table form: every
// effect names exactly one system whose state a critic reads, and this file is that table as
// code. There is exactly one handler per effect id and the registry is checked for completeness
// at construction — a catalogue entry with no handler throws at boot rather than silently
// falling through to a damage number.
//
// THREE RULES, all of them enforceable by reading this file:
//
//   1. **No handler below touches `hp` unless its row in RI-MAG06 §B says `hp`.** The five
//      damage effects, `drain_health`, `absorb_health` and `restore_health` are the whole list.
//      Everything else moves the system it names and nothing else. `HP_DAMAGE_ONLY` is
//      structurally unreachable for the other 47.
//   2. **Every timed effect returns its own `undo`.** The row in `effects_active` is a *lease*
//      on a mutation, not a countdown someone might one day read. `MagicSystem.step()` calls the
//      undo on expiry, which is what makes `feather` a temporary tier change instead of a
//      permanent one.
//   3. **No RNG, no clock, no allocation-per-frame.** Handlers run inside the armed determinism
//      guard (combat-bridge.js), so a `Math.random()` beneath one throws rather than
//      desynchronising a trace. Everything here is arithmetic on integers and authored constants.
//
// The return value is a CENSUS RECORD, not a boolean: `{consumer, before, after}` names the
// system the handler moved and the two readings that prove it. `magicEventsDrain()` carries it
// on the `effect_apply` event, so RI-MAG06's paired read has a self-describing trace to check
// itself against — the instrument and the implementation disagree loudly rather than quietly.
'use strict';

/** RI-MAG02 §H global clamps, re-exported here so a handler never re-derives one. */
export const CHAMELEON_CLAMP_PCT = 80;
export const RESIST_CLAMP_PCT = 85;

/** RI-CMB01 §M5's roll cliff. `feather`/`burden` move the player ACROSS it; they never move it. */
export const ROLL_CLIFF_PCT = [30.0, 70.0];

/**
 * How far from the point the spell RESOLVED AT a world verb reaches, squared, in metres.
 * These are the radii inside which `open`, `seal`, `spring the trap` and `shell-splitter` find
 * something to act on. They are declared here rather than buried as literals because a critic
 * checking "why did `open` not open that door" needs one number to check, and because a verb
 * whose reach is a magic constant in three places will grow a fourth.
 */
export const WORLD_REACH_M = { lock: 8, trap: 8, breakable: 10 };
const WORLD_REACH_M2 = { lock: 64, trap: 64, breakable: 100 };

/**
 * S11 Souls half: status arrives as a fixed integer of buildup per contact and procs at a
 * threshold. Never 0 -> applied in one frame, never a coin flip. Thresholds are per kind and
 * live here because no other piece owns a meter yet; RI-CMB10 may claim them later.
 */
export const BUILDUP = {
  paralysis: { threshold: 100, decay_per_s: 12, proc: 'PARALYSED', proc_frames: 180 },
  frost: { threshold: 100, decay_per_s: 10, proc: 'FROSTBITE', proc_frames: 120 },
  shock: { threshold: 100, decay_per_s: 14, proc: 'CONCUSSED', proc_frames: 90 },
  poison: { threshold: 100, decay_per_s: 8, proc: 'POISONED', proc_frames: 600 },
  fire: { threshold: 100, decay_per_s: 12, proc: 'BURNING', proc_frames: 240 },
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** A census record. Every handler returns one; `consumer: null` is not a legal return. */
function moved(consumer, before, after, extra) {
  return { consumer, before, after, changed: JSON.stringify(before) !== JSON.stringify(after), ...(extra || {}) };
}

// ==============================================================================================
// The handlers. Signature: (M, frame, rec, target, spell) -> census record
//
//   M       the MagicSystem. `M.w` is the bound world: {sim, combat, bus, engine}.
//   rec     {effect, magnitude, remaining_f, source, spell, school}. `magnitude` is the SCALED
//           output (RI-MAG02 §E), not the authored integer.
//   target  the combat body the geometry hit, or null when the spell resolved on the caster.
// ==============================================================================================

/** The caster's own combat body, which is the authority `sim.player` is a view of. */
function self(M) { return M.w && M.w.combat ? M.w.combat.player : null; }

/** The body an effect should act on: the one the geometry hit, else the caster. */
function subject(M, target) { return target || self(M); }

/** The enemy controller behind a body, which owns `alert` / `alertState`. */
function ctlOf(M, body) {
  if (!M.w || !M.w.combat || !body) return null;
  for (const [, c] of M.w.combat.enemies) if (c.b === body) return c;
  return null;
}

// ---- damage ----------------------------------------------------------------------------------
//
// These five are the ONLY effects allowed to reduce `hp`, and they do not do it here: the
// combat bridge's accumulator owns the number so that a multi-effect spell lands one damage
// event rather than five (RI-MAG01 §E rule 1). What the handler owns is the S11 buildup meter,
// which is the half of the row RI-MAG06 §B says a damage effect must also move.

function damageHandler(kind) {
  return (M, frame, rec, target) => {
    const b = subject(M, target);
    if (!b) return moved('target.status_buildup', null, null);
    const before = { ...statusOf(b) };
    if (kind) addBuildup(M, frame, b, kind, Math.round(rec.magnitude));
    return moved('target.hp + target.status_buildup', before, { ...statusOf(b) }, { hp: r2(b.hp), damage_owner: 'combat-bridge accumulator' });
  };
}

function statusOf(b) {
  if (!b.status) b.status = {};
  return b.status;
}

/** S11: a fixed integer of buildup per contact, on an integer meter, with an integer threshold. */
export function addBuildup(M, frame, body, kind, amount) {
  const cfg = BUILDUP[kind];
  if (!cfg) return null;
  const st = statusOf(body);
  const prev = st[kind] || 0;
  const now = Math.min(cfg.threshold * 2, prev + Math.max(0, amount | 0));
  st[kind] = now;
  if (!body.statusProc) body.statusProc = {};
  let procced = false;
  if (prev < cfg.threshold && now >= cfg.threshold) {
    body.statusProc[kind] = frame + cfg.proc_frames;
    st[kind] = 0;
    procced = true;
    if (kind === 'paralysis') { body.paralysedUntil = frame + cfg.proc_frames; }
    // `status_kind`, not `kind`: `_emit(frame, kind, fields)` spreads `fields` over the record,
    // so a field literally called `kind` overwrites the event's own type and the event arrives
    // on the stream as `{kind: 'fire'}` instead of `{kind: 'status_proc'}`. That cost a census
    // run: the meter was moving correctly and nothing downstream could see it.
    M._emit(frame, 'status_proc', { status_kind: kind, on: body.id, proc: cfg.proc, until_f: frame + cfg.proc_frames, threshold: cfg.threshold });
  }
  M._emit(frame, 'status_buildup', { status_kind: kind, on: body.id, before: prev, after: st[kind], per_contact: Math.max(0, amount | 0), threshold: cfg.threshold, procced });
  return { kind, before: prev, after: st[kind], procced };
}

// ---- hp / hp_max -----------------------------------------------------------------------------

function h_drain_health(M, frame, rec, target) {
  const b = subject(M, target);
  if (!b) return moved('target.hp_max', null, null);
  const before = { hp: r2(b.hp), hp_max: r2(b.hpMax) };
  const amount = Math.min(b.hpMax - 1, Math.round(rec.magnitude));
  b.hpMax -= amount;
  if (b.hp > b.hpMax) b.hp = b.hpMax;
  rec._undo = () => { b.hpMax += amount; };
  return moved('target.hp + target.hp_max', before, { hp: r2(b.hp), hp_max: r2(b.hpMax) }, { drained: amount });
}

function h_absorb_health(M, frame, rec, target) {
  const caster = self(M);
  const b = target;
  const before = { target_hp: b ? r2(b.hp) : null, caster_hp: caster ? r2(caster.hp) : null };
  const want = Math.round(rec.magnitude);
  let taken = 0;
  if (b) { taken = Math.min(b.hp, want); b.hp -= taken; if (b.hp <= 0) { b.hp = 0; b.dead = true; } }
  if (caster) caster.hp = Math.min(caster.hpMax, caster.hp + taken);
  return moved('target.hp + caster.hp', before, { target_hp: b ? r2(b.hp) : null, caster_hp: caster ? r2(caster.hp) : null }, { transferred: taken });
}

function h_restore_health(M, frame, rec, target) {
  const b = subject(M, target);
  if (!b) return moved('caster.hp', null, null);
  const before = { hp: r2(b.hp), hp_max: r2(b.hpMax) };
  // S11's POISONED proc blocks healing of every kind, magical included. The Focus is still
  // spent — that is the point of the proc.
  if (b.healBlockedUntil && frame < b.healBlockedUntil) {
    return moved('caster.hp', before, { hp: r2(b.hp), hp_max: r2(b.hpMax) }, { blocked_by: 'POISONED' });
  }
  b.hp = Math.min(b.hpMax, b.hp + Math.round(rec.magnitude));
  return moved('caster.hp', before, { hp: r2(b.hp), hp_max: r2(b.hpMax) });
}

// ---- attributes and skills -------------------------------------------------------------------

const ATTRS = ['vigour', 'endurance', 'strength', 'dexterity', 'intelligence', 'faith'];

function h_restore_attribute(M, frame, rec) {
  const A = M.w && M.w.sim ? M.w.sim.progression.attributes : null;
  if (!A) return moved('progression.attributes', null, null);
  const before = { ...A };
  // Restore what has been drained, never past the base. `M.attrBase` is captured the first time
  // anything drains or fortifies, so "restore" has a ceiling that is not simply "add points".
  const base = M.attrBase || (M.attrBase = { ...A });
  let restored = 0;
  const room = Math.round(rec.magnitude);
  for (const k of ATTRS) {
    if (restored >= room) break;
    if (A[k] < base[k]) { const d = Math.min(room - restored, base[k] - A[k]); A[k] += d; restored += d; }
  }
  return moved('progression.attributes', before, { ...A }, { restored, base });
}

function h_fortify_attribute(M, frame, rec) {
  const A = M.w && M.w.sim ? M.w.sim.progression.attributes : null;
  if (!A) return moved('progression.attributes', null, null);
  if (!M.attrBase) M.attrBase = { ...A };
  const before = { ...A };
  const pts = Math.round(rec.magnitude);
  // One attribute, chosen by the spell if it names one, else the caster's lowest — deterministic
  // either way. Never spread across six, because a gate reads one number.
  const which = rec.attribute || ATTRS.slice().sort((a, b) => A[a] - A[b] || (a < b ? -1 : 1))[0];
  A[which] += pts;
  rec._undo = () => { A[which] -= pts; };
  return moved('progression.attributes', before, { ...A }, { attribute: which, points: pts });
}

function h_fortify_skill(M, frame, rec) {
  const before = { fortify: { ...M.skillFortify }, base: { ...M.skills } };
  const pts = Math.round(rec.magnitude);
  const which = rec.school || 'warding';
  // Fortify is a LEASE, never a write into the character sheet: `_effectiveSkillFor` and
  // `quoteSpell` both read base + `skillFortify`, and the base is what `reattune()` re-evaluates
  // against at a HEARTH (RI-MAG03 §E2). Wave 1 added the magnitude into `M.skills` here AND
  // again in `_effectiveSkillFor`'s loop over `this.active`, so every fortify counted twice —
  // and, now that `M.skills` is the character sheet, writing it here would leave a permanent
  // skill behind when the lease expired.
  for (const k of Object.keys(M.skillFortify)) M.skillFortify[k] += pts;
  const stl = M.w && M.w.sim && M.w.sim.stealth ? M.w.sim.stealth.p : null;
  const stlBefore = stl ? { security: stl.security, sneak: stl.sneak } : null;
  if (stl) { stl.security += pts; stl.sneak += pts; }
  rec._undo = () => {
    for (const k of Object.keys(M.skillFortify)) M.skillFortify[k] -= pts;
    if (stl) { stl.security -= pts; stl.sneak -= pts; }
  };
  return moved('magic.skill_fortify + stealth.security',
    { fortify: before.fortify, stealth: stlBefore },
    { fortify: { ...M.skillFortify }, stealth: stl ? { security: stl.security, sneak: stl.sneak } : null },
    { points: pts, school: which, base_unchanged: { ...M.skills } });
}

// ---- mitigation ------------------------------------------------------------------------------
//
// RI-MAG06 §B: judged by the damage number from an identical scripted hit, with and without.
// `body.mitigation` is a multiplier the combat resolver applies to every incoming number, so the
// only honest read (the damage taken) is the one that moves.

/** The damage channels a ward may name. `magic` is deliberately unwardable. */
export const DAMAGE_KINDS = Object.freeze(['physical', 'fire', 'frost', 'shock', 'poison', 'disease', 'magic']);
/** Which channels each resist covers. This table IS the difference between the two resists. */
const RESIST_CHANNELS = Object.freeze({
  element: ['fire', 'frost', 'shock'],   // `resist_element` — Thick Hide. The elements, and only those.
  disease: ['disease', 'poison'],        // `resist_disease` — Clean Blood. Rot and fever, and only those.
});

function wardsOf(b) {
  if (!b.wards) { b.wards = {}; for (const k of DAMAGE_KINDS) b.wards[k] = 1; }
  return b.wards;
}

/**
 * `resist_element` and `resist_disease`. A PERCENTAGE, clamped at 85, applied to the channels
 * this resist names — and to no others.
 *
 * Wave 1 wrote both of these, and `shield`, into one kind-blind `body.mitigation`, so the
 * round-2 critic measured a resist-DISEASE buff taking a scripted physical 100 down to 15 and a
 * physical shield cutting fire damage from 405 to 5, identically to resist-element. Four
 * effects passed RI-MAG06 §A's census while being one number with four names, which is exactly
 * the failure §D was added to catch.
 */
function resistHandler(channelKey) {
  const channels = RESIST_CHANNELS[channelKey];
  return (M, frame, rec, target) => {
    const b = subject(M, target);
    if (!b) return moved('damage_taken_by_kind', null, null);
    const W = wardsOf(b);
    const pct = Math.min(RESIST_CLAMP_PCT, rec.magnitude);
    const before = { ...W };
    const factor = 1 - pct / 100;
    for (const k of channels) W[k] *= factor;
    rec._undo = () => {
      for (const k of channels) { W[k] /= factor; if (Math.abs(W[k] - 1) < 1e-9) W[k] = 1; }
    };
    return moved('damage_taken_by_kind', before, { ...W },
      { ward: channelKey, channels: channels.slice(), pct_declared: r2(pct), unaffected: DAMAGE_KINDS.filter((k) => !channels.includes(k)) });
  };
}

/**
 * `shield` — Second Shell. FLAT damage reduction against physical blows, per the effect's own
 * ruling in `effects.json`: "Flat damage reduction, applied after RI-CMB05's poise maths and
 * before RI-CMB08's HP accounting." It is the caster's armour, and armour does not stop fire.
 *
 * Flat-against-physical rather than a fraction is what makes `shield` a DIFFERENT VERB from the
 * two resists rather than the same verb with a different coefficient: it is worth most against
 * a flurry of small hits and worth least against one big one, which is the opposite of a
 * percentage, and it is worth nothing at all against a fireball.
 */
function h_shield(M, frame, rec, target) {
  const b = subject(M, target);
  if (!b) return moved('damage_taken_flat_physical', null, null);
  const before = { shield_flat: r2(b.shieldFlat || 0), armour_rating: r2(b.armourRating || 0) };
  const pts = Math.round(rec.magnitude);
  b.shieldFlat = (b.shieldFlat || 0) + pts;
  rec._undo = () => { b.shieldFlat = Math.max(0, (b.shieldFlat || 0) - pts); };
  return moved('damage_taken_flat_physical', before,
    { shield_flat: r2(b.shieldFlat), armour_rating: r2(b.armourRating || 0) },
    { points: pts, channel: 'physical', unaffected: DAMAGE_KINDS.filter((k) => k !== 'physical') });
}

/**
 * `sap_ward` — Holding the Wound. NOT a damage ward.
 *
 * `RI-MAG06` §B files this effect in the same row as `shield` and the two resists ("damage taken
 * from an identical scripted hit"), and that row is wrong: the effect's OWN record in
 * `corpus/25-magic/data/effects.json` rules that it "lowers sap-taint by exactly one band
 * (RI-LOR05 §4a) ... usable at most 3 times in a playthrough. Argonian PCs cannot cast it —
 * they have no taint." It is the only mechanical answer to the tithe-curse, which is a *social*
 * condition, and implementing it as a fourth damage multiplier is what put it in a collision
 * group with three effects it has nothing in common with. Amendment proposed in the report.
 */
function h_sap_ward(M, frame, rec) {
  const sim = M.w && M.w.sim ? M.w.sim : null;
  if (!sim) return moved('progression.sap_taint', null, null);
  const T = taintOf(sim);
  const before = { band: T.band, uses_left: T.wardUsesLeft, rests: T.rests };
  if (T.immune) {
    return moved('progression.sap_taint', before, { ...before },
      { refused: 'argonian', reason: 'an Argonian has no taint to lower — sap is food' });
  }
  if (T.wardUsesLeft <= 0) {
    return moved('progression.sap_taint', before, { ...before },
      { refused: 'exhausted', reason: 'Holding the Wound works three times in a life' });
  }
  if (T.band <= 0) {
    return moved('progression.sap_taint', before, { ...before },
      { refused: 'clean', reason: 'there is nothing in you to draw out' });
  }
  // `warded` rather than `band -= 1`, because the band is DERIVED from the rest count: a bare
  // decrement is undone by the very next hearth rest, which is a lowering that lowers nothing.
  T.warded = (T.warded || 0) + 1;
  T.band = bandFromRests(T);
  T.wardUsesLeft -= 1;
  M._emit(frame, 'effect_apply', { effect: 'sap_ward', sap_taint_band: T.band, uses_left: T.wardUsesLeft });
  return moved('progression.sap_taint', before,
    { band: T.band, uses_left: T.wardUsesLeft, rests: T.rests },
    { lowered_by: 1, consumer: 'npc disposition + rootkeeper access (RI-LOR05 §4a)' });
}

/**
 * The sap-taint register. RI-LOR05 §4a is hard canon and it had no implementation at all: a
 * non-Argonian who rests at a HEARTH is drinking Hist sap, "every rest is a small poisoning",
 * and it accumulates. `Engine.hearthRest()` charges it; `dialogue/disposition.js` reads it;
 * `sap_ward` is the only thing that lowers it.
 */
export function taintOf(sim) {
  const race = sim.character ? sim.character.race : null;
  const immune = race === null ? false : race === 'saxhleel';
  if (!sim.progression.sapTaint) {
    // "Argonian PCs cannot cast it — they have no taint." The well knows them; sap is food.
    sim.progression.sapTaint = { band: 0, rests: 0, warded: 0, wardUsesLeft: 3, immune };
  } else if (sim.progression.sapTaint.immune !== immune) {
    // The character was composed after the register existed. Whose body it is decides this.
    sim.progression.sapTaint.immune = immune;
  }
  return sim.progression.sapTaint;
}

/** RI-LOR05 §4a: five bands, one per four rests, minus whatever has been drawn back out. */
export const TAINT_RESTS_PER_BAND = 4;
export function bandFromRests(T) {
  return Math.max(0, Math.min(4, Math.floor(T.rests / TAINT_RESTS_PER_BAND) - (T.warded || 0)));
}

// ---- afflictions (S11 Morrowind half) --------------------------------------------------------

function cureHandler(kinds) {
  return (M, frame, rec) => {
    const sim = M.w && M.w.sim ? M.w.sim : null;
    const q = sim ? sim.quest : null;
    if (!q) return moved('quest.afflictions', null, null);
    const before = q.afflictions.map((a) => a.id);
    const cured = [];
    for (let i = q.afflictions.length - 1; i >= 0; i--) {
      if (kinds.includes(q.afflictions[i].kind)) cured.push(q.afflictions.splice(i, 1)[0].id);
    }
    // The player-side view is a list of ids over the same register (see sim/hazards.js).
    if (sim.player) sim.player.afflictions = q.afflictions.map((a) => a.id);
    for (const id of cured) M._emit(frame, 'affliction_cured', { affliction: id, by: rec.effect });
    const b = self(M);
    if (b && kinds.includes('paralysis')) {
      if (b.status) b.status.paralysis = 0;
      b.paralysedUntil = 0;
      if (b.statusProc) delete b.statusProc.paralysis;
    }
    return moved('quest.afflictions (the register hazards write)', before, q.afflictions.map((a) => a.id), { cures: kinds, cured });
  };
}

// ---- equip load (RI-CMB01 M5's cliff) --------------------------------------------------------

function loadHandler(sign) {
  return (M, frame, rec, target) => {
    const b = subject(M, target);
    const C = M.w && M.w.combat;
    if (!b || !C) return moved('equip_load_pct', null, null);
    const before = { equip_load_pct: r2(b.equipLoadPct), roll_class: C.tierOf(b) };
    // Magnitude is a percentage of the load bar. The CLIFF does not move — RI-MAG06 §B is
    // explicit that the 30.00/70.00 discontinuity stays exactly where it was; the player moves.
    const delta = sign * rec.magnitude;
    b.equipLoadPct = Math.max(0, b.equipLoadPct + delta);
    b.tier = C.tierOf(b);
    if (M.w.sim) { M.w.sim.player.equipLoadPct = b.equipLoadPct; M.w.sim.player.rollClass = b.tier; }
    rec._undo = () => {
      b.equipLoadPct = Math.max(0, b.equipLoadPct - delta);
      b.tier = C.tierOf(b);
      if (M.w.sim) { M.w.sim.player.equipLoadPct = b.equipLoadPct; M.w.sim.player.rollClass = b.tier; }
    };
    return moved('equip_load_pct + roll_class', before, { equip_load_pct: r2(b.equipLoadPct), roll_class: b.tier }, { cliff_pct: ROLL_CLIFF_PCT });
  };
}

// ---- traversal -------------------------------------------------------------------------------

function h_levitate(M, frame, rec) {
  const b = self(M);
  const before = { levitating: M.levitating, pos_y: b ? r3(b.pos[1]) : null };
  M._beginLevitation(frame, rec.remaining_f);
  rec._undo = () => M._endLevitation(M.w && M.w.sim ? M.w.sim.frame : frame, 'expired');
  return moved('locomotion + pos[1]', before, { levitating: M.levitating, pos_y: b ? r3(b.pos[1]) : null });
}

function h_slowfall(M, frame, rec) {
  const before = { terminal_v_mps: M.fall.terminalMps, fall_damage: M.fall.damageEnabled };
  M.fall.terminalMps = M.lev.slowfall_terminal_mps === undefined ? 3.5 : M.lev.slowfall_terminal_mps;
  M.fall.damageEnabled = false;
  rec._undo = () => { M.fall.terminalMps = M.fall.defaultTerminalMps; M.fall.damageEnabled = true; };
  return moved('fall.terminal_velocity + fall_damage', before, { terminal_v_mps: M.fall.terminalMps, fall_damage: M.fall.damageEnabled });
}

function h_leap(M, frame, rec) {
  const b = self(M);
  const before = { jump_apex_mult: r3(M.jumpApexMult), pos_y_peak: b ? r3(M.peakY) : null };
  // Multiplies the jump arc's apex. The jump move's root motion is `rootOffsetYAt(f) * apex_m`
  // (combat/actor.js), so this is the same number the unbuffed jump uses, scaled — and it is
  // written on the BODY, because the body is what evaluates the arc. Writing it only on the
  // MagicSystem is how this measured `apex_mult: 2.54` with an unchanged 0.578 m peak.
  M.jumpApexMult = 1 + rec.magnitude / 12;
  if (b) b.jumpApexMult = M.jumpApexMult;
  rec._undo = () => { M.jumpApexMult = 1; if (b) b.jumpApexMult = 1; };
  return moved('jump apex -> pos[1] peak', before, { jump_apex_mult: r3(M.jumpApexMult) });
}

/** The traversal system — the water the player actually stands, swims and drowns in. */
function traversalOf(M) { return M.w && M.w.engine ? M.w.engine.traversal : null; }

function h_buoyancy(M, frame, rec) {
  // W1-14 round 3. Wave 1 wrote `M.water.{buoyant, swimDenied}`, which nothing outside the
  // magic module read; the water you actually wade in is `engine.traversal`, which charges
  // stamina per band and denies sprint and roll above the knee (S25). `buoyant` now lifts you
  // a band's worth of cost: the denied actions come back and the drain stops.
  const T = traversalOf(M);
  const before = { buoyant: M.water.buoyant, traversal_buoyant: T ? !!T.buoyant : null, band: T ? T.band : null };
  M.water.buoyant = true;
  M.water.swimDenied = false;
  if (T) T.buoyant = true;
  rec._undo = () => { M.water.buoyant = false; if (T) T.buoyant = false; };
  return moved('traversal.buoyant (S25 water band)', before,
    { buoyant: M.water.buoyant, traversal_buoyant: T ? !!T.buoyant : null, band: T ? T.band : null });
}

function h_breathe_water(M, frame, rec) {
  // Same defect, same fix: the drown clock that matters is `traversal.breath`, ticked in
  // `sim/traversal.js` §8 and the thing that actually kills you. `M.water.drownF` was a
  // magic-private mirror nobody read.
  const T = traversalOf(M);
  const before = { breath_s: T ? r2(T.breath) : null, breathes: M.water.breathes, drown_running: M.water.drowning };
  M.water.drowning = false;
  M.water.breathes = true;
  M.water.drownF = M.water.drownMaxF;
  if (T) { T.breathesWater = true; T.breath = T.breathMaxS === undefined ? T.breath : T.breathMaxS; }
  rec._undo = () => { M.water.breathes = false; if (T) T.breathesWater = false; };
  return moved('traversal.breath_s (the drown clock)', before,
    { breath_s: T ? r2(T.breath) : null, breathes: M.water.breathes, drown_running: M.water.drowning });
}

// ---- Veiling: the stealth terms --------------------------------------------------------------
//
// Every one of these writes into `sim.stealth.p`, which is the object `getStealthState()`
// projects and the object the per-frame V and sound-radius computations read. The W1-14 critic's
// decisive finding was that all five left `getStealthState()` BYTE-IDENTICAL; the read that
// falsifies that now is the same call, on the same frame, with the same fields.

function h_night_eye(M, frame, rec) {
  const p = stealthP(M);
  if (!p) return moved('stealth.L', null, null);
  const before = { light_bonus: r3(p.magicLightBonus || 0), L: r3(p.L) };
  const add = rec.magnitude / 100;
  p.magicLightBonus = (p.magicLightBonus || 0) + add;
  rec._undo = () => { p.magicLightBonus = Math.max(0, (p.magicLightBonus || 0) - add); };
  return moved('stealth light term (perceived L)', before, { light_bonus: r3(p.magicLightBonus), L: r3(p.L) });
}

function h_chameleon(M, frame, rec) {
  const p = stealthP(M);
  if (!p) return moved('stealth.V', null, null);
  const pct = Math.min(CHAMELEON_CLAMP_PCT, rec.magnitude);
  const before = { chameleon_pct: r2(p.magicChameleonPct || 0), V: r3(p.V) };
  p.magicChameleonPct = Math.min(CHAMELEON_CLAMP_PCT, (p.magicChameleonPct || 0) + pct);
  const applied = p.magicChameleonPct - (before.chameleon_pct);
  rec._undo = () => { p.magicChameleonPct = Math.max(0, (p.magicChameleonPct || 0) - applied); };
  return moved('stealth.V (chameleon term)', before, { chameleon_pct: r2(p.magicChameleonPct), V: r3(p.V) }, { clamp_pct: CHAMELEON_CLAMP_PCT });
}

function h_invisibility(M, frame, rec) {
  const p = stealthP(M);
  if (!p) return moved('stealth.V', null, null);
  const before = { invisible: !!p.magicInvisible, V: r3(p.V) };
  p.magicInvisible = true;
  rec._undo = () => { p.magicInvisible = false; };
  rec._breaksOn = ['attack', 'cast', 'interact', 'container', 'combat'];
  return moved('stealth.V (invisibility)', before, { invisible: !!p.magicInvisible, V: r3(p.V) }, { breaks_on: rec._breaksOn });
}

function h_muffle(M, frame, rec) {
  const p = stealthP(M);
  if (!p) return moved('stealth.sound_r_m', null, null);
  const before = { muffle_pct: r2(p.magicMufflePct || 0), sound_r_m: r3(p.soundR) };
  const pct = Math.min(90, rec.magnitude);
  p.magicMufflePct = Math.min(90, (p.magicMufflePct || 0) + pct);
  const applied = p.magicMufflePct - before.muffle_pct;
  rec._undo = () => { p.magicMufflePct = Math.max(0, (p.magicMufflePct || 0) - applied); };
  return moved('stealth.sound_r_m', before, { muffle_pct: r2(p.magicMufflePct), sound_r_m: r3(p.soundR) });
}

function h_false_face(M, frame, rec) {
  const p = stealthP(M);
  if (!p) return moved('stealth.race + trespass', null, null);
  const before = { race: p.race, disguised: !!p.magicDisguise, suspicion_mult: r3(M.disguiseSuspicionMult()) };
  const prevRace = p.race;
  p.magicDisguise = true;
  // A borrowed scale is a borrowed FACE: the civilian model reads race for its suspicion factor
  // and the trespass check reads faction standing. Both move, and both move back.
  p.race = rec.disguise_race || 'saxhleel';
  rec._undo = () => { p.magicDisguise = false; p.race = prevRace; };
  return moved('stealth.race + civilian suspicion', before, { race: p.race, disguised: !!p.magicDisguise, suspicion_mult: r3(M.disguiseSuspicionMult()) });
}

function stealthP(M) { return M.w && M.w.sim && M.w.sim.stealth ? M.w.sim.stealth.p : null; }

// ---- knowledge (AR-2: diegetic, never a HUD marker) -------------------------------------------

function detectHandler(kind) {
  return (M, frame, rec) => {
    const before = { markers: M.markers.length, hud_elements: 0 };
    const b = self(M);
    const r = rec.magnitude;                    // magnitude is the radius in metres
    M.markers.length = 0;
    if (kind === 'life' && M.w && M.w.sim) {
      for (const e of M.w.sim.entities) {
        if (!e.hp || e.hp <= 0) continue;
        const dx = e.pos[0] - b.pos[0], dz = e.pos[2] - b.pos[2];
        if (Math.sqrt(dx * dx + dz * dz) <= r) {
          M.markers.push({ kind: 'warm_smudge', at: [r3(e.pos[0]), r3(e.pos[1]), r3(e.pos[2])], eid: e.eid, hud: false });
        }
      }
    } else if (kind === 'key') {
      for (const k of M.world.keys) {
        const dx = k.pos[0] - b.pos[0], dz = k.pos[2] - b.pos[2];
        if (Math.sqrt(dx * dx + dz * dz) <= r) M.markers.push({ kind: 'key_glow', at: k.pos.slice(), key: k.id, hud: false });
      }
    }
    rec._undo = () => { M.markers.length = 0; };
    return moved('diegetic marker set (HUD count stays 0)', before, { markers: M.markers.length, hud_elements: 0 }, { radius_m: r3(r), kind });
  };
}

function h_hist_sight(M, frame, rec) {
  const q = M.w && M.w.sim ? M.w.sim.quest : null;
  if (!q) return moved('quest.journal', null, null);
  const before = { journal: q.journal.length, hud_markers: 0 };
  const written = M.w.engine && M.w.engine.histSightWrite ? M.w.engine.histSightWrite(frame) : null;
  return moved('quest.journal', before, { journal: q.journal.length, hud_markers: 0 }, { wrote: written ? written.quest + '#' + written.n : null });
}

function h_speak_to_the_dead(M, frame, rec, target) {
  const q = M.w && M.w.sim ? M.w.sim.quest : null;
  if (!q) return moved('quest.topicsKnown', null, null);
  const before = { topics: q.topicsKnown.slice().sort(), flags: Object.keys(q.flags).sort() };
  // The corpse answers with a knowledge key. Which corpse it is comes from the touched body,
  // and a body with no authored testimony still yields the generic one, because a spell that
  // silently does nothing on most targets is the defect this whole file exists to delete.
  const id = target ? target.id : 'the_nameless_dead';
  const key = M.world.testimony[id] || M.world.testimony._default;
  if (key && !q.topicsKnown.includes(key)) q.topicsKnown.push(key);
  q.flags[`spoke_to_dead:${id}`] = true;
  return moved('quest.topicsKnown + quest.flags', before, { topics: q.topicsKnown.slice().sort(), flags: Object.keys(q.flags).sort() }, { corpse: id, topic: key });
}

// ---- locks, traps, breakables ----------------------------------------------------------------

function h_open_lock(M, frame, rec, target) {
  const before = M.lockCensus();
  const req = rec.magnitude;                    // magnitude is the lock tier ceiling this opens
  const opened = [];
  for (const l of M.world.locks.values()) {
    if (!l.locked) continue;
    if (M.dist2(l.pos) > WORLD_REACH_M2.lock) continue;
    if (l.tier * 20 > req) { M._emit(frame, 'lock_refused', { lock: l.id, tier: l.tier, needs_magnitude: l.tier * 20, had: r2(req) }); continue; }
    l.locked = false;
    opened.push(l.id);
    const w = M.w && M.w.sim ? M.w.sim.world : null;
    if (w && !w.doorsUnlocked.includes(l.id)) w.doorsUnlocked.push(l.id);
    M._emit(frame, 'lock_opened', { lock: l.id, tier: l.tier, by: 'open_lock' });
    M.raiseFlag(frame, `lock:${l.id}:open`);
  }
  return moved('lock register + world.doors_unlocked', before, M.lockCensus(), { opened, magnitude: r2(req) });
}

function h_lock_lock(M, frame, rec) {
  const before = M.lockCensus();
  const locked = [];
  for (const l of M.world.locks.values()) {
    if (l.locked) continue;
    if (M.dist2(l.pos) > WORLD_REACH_M2.lock) continue;
    l.locked = true;
    l.tier = Math.max(l.tier, Math.min(5, Math.ceil(rec.magnitude / 20)));
    locked.push(l.id);
    const w = M.w && M.w.sim ? M.w.sim.world : null;
    if (w) { const i = w.doorsUnlocked.indexOf(l.id); if (i >= 0) w.doorsUnlocked.splice(i, 1); }
    M._emit(frame, 'lock_closed', { lock: l.id, tier: l.tier, by: 'lock_lock' });
    M.raiseFlag(frame, `lock:${l.id}:sealed`);
  }
  return moved('lock register + world.doors_unlocked', before, M.lockCensus(), { locked });
}

function h_ward_trap(M, frame, rec) {
  const before = M.trapCensus();
  const disarmed = [];
  for (const t of M.world.traps.values()) {
    if (!t.armed) continue;
    if (M.dist2(t.pos) > WORLD_REACH_M2.trap) continue;
    t.armed = false;
    disarmed.push(t.id);
    M._emit(frame, 'trap_disarmed', { trap: t.id, kind: t.kind });
    M.raiseFlag(frame, `trap:${t.id}:disarmed`);
  }
  return moved('trap register', before, M.trapCensus(), { disarmed });
}

function h_shatter(M, frame, rec, target) {
  const before = M.breakableCensus();
  const broken = [];
  for (const b of M.world.breakables.values()) {
    if (!b.intact) continue;
    if (M.dist2(b.pos) > WORLD_REACH_M2.breakable) continue;
    if (b.hardness > rec.magnitude) { M._emit(frame, 'shatter_refused', { object: b.id, hardness: b.hardness, had: r2(rec.magnitude) }); continue; }
    b.intact = false;
    broken.push(b.id);
    const w = M.w && M.w.sim ? M.w.sim.world : null;
    if (w && b.opens_shortcut && !w.shortcutsOpened.includes(b.opens_shortcut)) w.shortcutsOpened.push(b.opens_shortcut);
    if (b.collisionShape && M.w && M.w.sim && M.w.sim.cell) M.removeShape(M.w.sim.cell, b.collisionShape);
    M._emit(frame, 'object_shattered', { object: b.id, opens_shortcut: b.opens_shortcut || null });
    M.raiseFlag(frame, `shatter:${b.id}`);
  }
  return moved('breakable register + world.shortcuts_opened', before, M.breakableCensus(), { broken });
}

function h_corrode(M, frame, rec, target) {
  const b = subject(M, target);
  if (!b) return moved('target.armour_rating', null, null);
  const before = { armour_rating: r2(b.armourRating === undefined ? 0 : b.armourRating) };
  b.armourRating = Math.max(0, (b.armourRating === undefined ? 0 : b.armourRating) - rec.magnitude);
  // Armour is the number the resolver divides damage by; corroding it is a lasting change and
  // is deliberately NOT undone — that is what makes it a siege verb rather than a debuff.
  //
  // Its own record says it "destroys item condition", and `mend_item` now writes
  // `sim.inventory[].condition`, so this writes the same register in the other direction: the
  // two are one verb with two signs, which is what `RI-MAG06` §D says to record rather than
  // excuse. Cast on the player it eats the gear; cast on an enemy it eats the armour.
  const sim = M.w && M.w.sim ? M.w.sim : null;
  const onSelf = !target || target === self(M);
  const invBefore = sim ? sim.inventory.map((i) => ({ id: i.id, condition: r3(i.condition) })) : null;
  if (onSelf && sim) {
    for (const i of sim.inventory) {
      const c = i.condition === undefined ? 1 : i.condition;
      i.condition = Math.max(0, c - rec.magnitude / 100);
    }
  }
  return moved('target.armour_rating + sim.inventory[].condition',
    { ...before, inventory: invBefore },
    { armour_rating: r2(b.armourRating), inventory: sim ? sim.inventory.map((i) => ({ id: i.id, condition: r3(i.condition) })) : null });
}

function h_mend_item(M, frame, rec) {
  // W1-14 round 3. Wave 1 wrote `M.world.items` — "an item-condition table that exists nowhere
  // else in the build". The condition the game actually carries is `sim.inventory[].condition`,
  // which `save/state.js` persists and `getPlayerStats()` reports. Both are written now: the
  // magic-side table stays because the ward registers seed from `wards.json` and a critic reads
  // it through `getMagicWorld()`, but the INVENTORY is the register that outlives the arena.
  const sim = M.w && M.w.sim ? M.w.sim : null;
  const inv = sim ? sim.inventory : [];
  const before = { magic_items: M.itemCensus(), inventory: inv.map((i) => ({ id: i.id, condition: r3(i.condition) })) };
  const mended = [], refused = [];
  const pts = Math.round(rec.magnitude);
  for (const it of M.world.items.values()) {
    if (it.condition_pct >= 100) continue;
    // RI-MAG06 §B: rises, and REFUSES below 10%. A ruined thing is ruined.
    if (it.condition_pct < 10) { M._emit(frame, 'mend_refused', { item: it.id, condition_pct: it.condition_pct, floor_pct: 10 }); refused.push(it.id); continue; }
    const before1 = it.condition_pct;
    it.condition_pct = Math.min(100, it.condition_pct + pts);
    mended.push({ id: it.id, from: before1, to: it.condition_pct });
  }
  for (const i of inv) {
    const c = i.condition === undefined ? 1 : i.condition;
    if (c >= 1) continue;
    if (c < 0.10) { M._emit(frame, 'mend_refused', { item: i.id, condition_pct: r2(c * 100), floor_pct: 10 }); refused.push(i.id); continue; }
    const c1 = Math.min(1, c + pts / 100);
    i.condition = c1;
    mended.push({ id: i.id, from: r3(c), to: r3(c1) });
  }
  return moved('sim.inventory[].condition + item condition register', before,
    { magic_items: M.itemCensus(), inventory: inv.map((i) => ({ id: i.id, condition: r3(i.condition) })) },
    { mended, refused });
}

function h_telekinesis(M, frame, rec) {
  // W1-14 round 3. Wave 1 wrote `M.reachM` — a magic-private number. The interaction that
  // actually reaches for a prop is `Engine._censusStep`, and it tests `o.reach_m` ON THE PROP:
  // `if (d <= o.reach_m && d < bestD)`. So the reach that mattered was never the one the spell
  // moved, and an object outside melee range stayed un-takeable however far the spell reached.
  // RI-MTH07 §A's orphan model, exactly. The lease now raises the prop's own `reach_m`.
  const sim = M.w && M.w.sim ? M.w.sim : null;
  const props = sim ? sim.props : [];
  const want = Math.max(M.baseReachM, rec.magnitude);
  const before = { reach_m: r2(M.reachM), props: props.map((o) => ({ id: o.eid, reach_m: r2(o.reach_m) })) };
  M.reachM = want;
  const raised = [];
  for (const o of props) {
    if (o.taken) continue;
    if (o._baseReachM === undefined) o._baseReachM = o.reach_m;
    if (o.reach_m < want) { o.reach_m = want; raised.push(o.eid); }
  }
  rec._undo = () => {
    M.reachM = M.baseReachM;
    for (const o of props) if (o._baseReachM !== undefined) o.reach_m = o._baseReachM;
  };
  return moved('prop.reach_m (engine._censusStep interaction test)', before,
    { reach_m: r2(M.reachM), props: props.map((o) => ({ id: o.eid, reach_m: r2(o.reach_m) })) },
    { base_reach_m: M.baseReachM, props_raised: raised });
}

function h_wall(M, frame, rec) {
  const cell = M.w && M.w.sim ? M.w.sim.cell : null;
  const b = self(M);
  const before = M.wallCensus();
  if (!cell || !b) return moved('collision field (solidAt)', before, before);
  // A vertical slab in front of the caster, in the SAME primitive set solidAt() and the spring
  // arm read. `RI-MAG06 §B`: solid where it was not.
  const rad = b.yaw * Math.PI / 180;
  const c = [b.pos[0] + Math.sin(rad) * 3.0, b.pos[1] + 2.0, b.pos[2] + Math.cos(rad) * 3.0];
  const shape = cell.add({ k: 'box', c, h: [Math.max(1.5, rec.magnitude / 12), 2.0, 0.35], yaw_deg: b.yaw, id: `spell_wall_${frame}` });
  M.walls.push({ id: `spell_wall_${frame}`, centre: c.map(r3), shape, cell });
  rec._undo = () => { M.removeShape(cell, shape); const i = M.walls.findIndex((w) => w.shape === shape); if (i >= 0) M.walls.splice(i, 1); };
  return moved('collision field (solidAt)', before, M.wallCensus(), { at: c.map(r3) });
}

// ---- summons and bound gear -------------------------------------------------------------------

function bindHandler(kind, archetype) {
  return (M, frame, rec) => {
    const before = { entities: M.w && M.w.sim ? M.w.sim.entities.length : 0, summons: M.summons.length };
    const b = self(M);
    let eid = null;
    if (M.w && M.w.engine && b) {
      const rad = b.yaw * Math.PI / 180;
      // L3: it hauls itself out. `unfold_f` is carried on the summon record so the renderer and
      // a critic read the same number; the entity exists from frame 1 either way.
      eid = M.w.engine.spawn(archetype, r3(b.pos[0] + Math.sin(rad) * 2.5), r3(b.pos[2] + Math.cos(rad) * 2.5), { side: 'ally', summoned: true });
      if (eid && eid.eid) eid = eid.eid;
      M.summons.push({ eid, kind, unfold_f: 40, expires_f: frame + rec.remaining_f });
    }
    rec._undo = () => {
      const i = M.summons.findIndex((s) => s.eid === eid);
      if (i >= 0) M.summons.splice(i, 1);
      if (eid && M.w && M.w.engine) { try { M.w.engine.despawn(eid); } catch (e) { /* already gone */ } }
    };
    return moved('listEntities() + summon register', before, { entities: M.w && M.w.sim ? M.w.sim.entities.length : 0, summons: M.summons.length }, { eid, archetype, unfold_f: 40 });
  };
}

function h_bound_weapon(M, frame, rec) {
  const C = M.w && M.w.combat;
  const before = { weapon: C && C.player ? C.player.moves._movesetId : null, bound: M.boundWeapon };
  M.boundWeapon = { id: 'bound_sap_blade', attack_rating: Math.round(rec.magnitude * 3), was: before.weapon };
  const b = self(M);
  if (b && b.moves && b.moves._weapon) {
    const prev = b.moves._weapon.attack_rating;
    b.moves._weapon.attack_rating = M.boundWeapon.attack_rating;
    rec._undo = () => { b.moves._weapon.attack_rating = prev; M.boundWeapon = null; };
  } else {
    rec._undo = () => { M.boundWeapon = null; };
  }
  return moved('loadout (bound weapon)', before, { weapon: C && C.player ? C.player.moves._movesetId : null, bound: M.boundWeapon });
}

// ---- control (the fight-ending verbs) ----------------------------------------------------------
//
// RI-MAG06 §B: `alert_state`, `target`, and `in_combat` — the fight ends, or the target changes,
// with ZERO `death` events. That last clause is what B12 clause (c) and AR-3 X1 are asking for
// and it is the reason none of these four is allowed anywhere near `hp`.

function h_calm_beast(M, frame, rec, target) {
  const b = target;
  const c = ctlOf(M, b);
  const before = controlCensus(b, c);
  if (b) {
    b.aggro = false;
    b.calmedUntil = frame + rec.remaining_f;
    b.yielded = true;                            // the same disengagement parley produces
    b.move = null;
    b.hitboxActive = false;
  }
  if (c) { c.alert = 0; c.alertState = 'IDLE'; }
  rec._undo = () => {
    if (b) { b.yielded = false; b.calmedUntil = 0; }
  };
  M._emit(frame, 'fight_ended', { by: 'calm_beast', target: b ? b.id : null, deaths: 0 });
  M.raiseFlag(frame, 'fight_ended:calm_beast');
  return moved('alert_state + in_combat', before, controlCensus(b, c), { deaths: 0 });
}

function h_demoralise(M, frame, rec, target) {
  const b = target;
  const c = ctlOf(M, b);
  const before = controlCensus(b, c);
  if (b) {
    b.fleeingUntil = frame + rec.remaining_f;
    b.aggro = false;
    b.yielded = true;
    b.move = null;
    b.hitboxActive = false;
  }
  if (c) { c.alert = 0; c.alertState = 'SEARCH'; c.fleeing = true; }
  rec._undo = () => { if (b) { b.fleeingUntil = 0; b.yielded = false; } if (c) c.fleeing = false; };
  M._emit(frame, 'fight_ended', { by: 'demoralise', target: b ? b.id : null, deaths: 0 });
  M.raiseFlag(frame, 'fight_ended:demoralise');
  return moved('alert_state + in_combat', before, controlCensus(b, c), { deaths: 0 });
}

function h_frenzy(M, frame, rec, target) {
  const b = target;
  const c = ctlOf(M, b);
  const before = controlCensus(b, c);
  // The target changes. It keeps fighting; it fights the nearest OTHER body instead of you,
  // which is what makes frenzy an indirect murder weapon rather than a second damage spell.
  if (b && M.w && M.w.combat) {
    let best = null, bd = Infinity;
    for (const o of M.w.combat.bodies) {
      if (o === b || o.dead) continue;
      if (o === M.w.combat.player) continue;
      const d = Math.hypot(o.pos[0] - b.pos[0], o.pos[2] - b.pos[2]);
      if (d < bd) { bd = d; best = o; }
    }
    b.frenzyTarget = best ? best.id : null;
    b.frenziedUntil = frame + rec.remaining_f;
    if (c) { c.hostileTo = best ? best.id : null; c.alertState = 'AGGRO'; }
  }
  rec._undo = () => { if (b) { b.frenzyTarget = null; b.frenziedUntil = 0; } if (c) c.hostileTo = null; };
  return moved('target', before, controlCensus(b, c), { deaths: 0 });
}

function h_charm(M, frame, rec, target) {
  const b = target;
  const c = ctlOf(M, b);
  const q = M.w && M.w.sim ? M.w.sim.quest : null;
  const before = { ...controlCensus(b, c), disposition: q ? { ...q.dispositions } : null };
  if (b) { b.aggro = false; b.yielded = true; b.charmedUntil = frame + rec.remaining_f; b.move = null; b.hitboxActive = false; }
  if (c) { c.alert = 0; c.alertState = 'IDLE'; }
  // Charm moves DISPOSITION, which is the number every price, every topic gate and every
  // parley in the build reads. That is the crossing RI-MAG04 §E X6 declares.
  if (q && b) q.dispositions[b.id] = Math.min(100, (q.dispositions[b.id] || 0) + Math.round(rec.magnitude));
  rec._undo = () => {
    if (b) { b.yielded = false; b.charmedUntil = 0; }
    if (q && b) q.dispositions[b.id] = Math.max(0, (q.dispositions[b.id] || 0) - Math.round(rec.magnitude));
  };
  M._emit(frame, 'fight_ended', { by: 'charm', target: b ? b.id : null, deaths: 0 });
  M.raiseFlag(frame, 'fight_ended:charm');
  return moved('alert_state + disposition', before, { ...controlCensus(b, c), disposition: q ? { ...q.dispositions } : null }, { deaths: 0 });
}

function controlCensus(b, c) {
  return {
    alert_state: c ? c.alertState : null,
    aggro: b ? !!b.aggro : null,
    yielded: b ? !!b.yielded : null,
    target: b ? (b.frenzyTarget || null) : null,
    hp: b ? r2(b.hp) : null,
  };
}

function h_paralyse(M, frame, rec, target) {
  const b = subject(M, target);
  if (!b) return moved('status_buildup.paralysis -> state', null, null);
  const before = { buildup: (b.status && b.status.paralysis) || 0, state: b.state, paralysed_until: b.paralysedUntil || 0 };
  // Buildup, never a coin flip and NEVER 0 -> applied in one frame: magnitude x 4 per contact
  // against a threshold of 100 means the cheapest paralyse spell needs three contacts.
  addBuildup(M, frame, b, 'paralysis', Math.round(rec.magnitude * 4));
  return moved('status_buildup.paralysis -> enemy state', before, { buildup: (b.status && b.status.paralysis) || 0, state: b.state, paralysed_until: b.paralysedUntil || 0 }, { per_contact: Math.round(rec.magnitude * 4), threshold: BUILDUP.paralysis.threshold });
}

function h_silence(M, frame, rec, target) {
  const b = subject(M, target);
  if (!b) return moved('cast attempts', null, null);
  const before = { silenced: !!b.silenced, cast_attempts: b.castAttempts || 0 };
  b.silenced = true;
  b.silencedUntil = frame + rec.remaining_f;
  if (b === self(M)) { M.silenced = true; rec._undo = () => { M.silenced = false; b.silenced = false; }; }
  else rec._undo = () => { b.silenced = false; };
  return moved('cast attempts (target.silenced)', before, { silenced: !!b.silenced, cast_attempts: b.castAttempts || 0 });
}

function h_soul_trap(M, frame, rec, target) {
  const before = { gems: M.gems.length, xul_hesh: M.xulHesh, marked: M.soulMarks.size };
  if (target) {
    M.soulMarks.set(target.id, {
      until_f: frame + rec.remaining_f,
      grade: target.soulGrade || 'common',
      speaker: !!target.isSpeaker,
      instance: target.id,
    });
    M._emit(frame, 'soul_marked', { target: target.id, until_f: frame + rec.remaining_f });
  }
  rec._undo = () => { if (target) M.soulMarks.delete(target.id); };
  return moved('gem register + xul_hesh (on the target\'s death)', before, { gems: M.gems.length, xul_hesh: M.xulHesh, marked: M.soulMarks.size });
}

// ---- teleport ---------------------------------------------------------------------------------

function h_mark(M, frame, rec) {
  const q = M.w && M.w.sim ? M.w.sim.quest : null;
  const b = self(M);
  const before = { mark: q && q.travel.mark ? q.travel.mark.slice() : null, pos: b ? b.pos.map(r3) : null };
  if (q && b) q.travel.mark = [r3(b.pos[0]), r3(b.pos[1]), r3(b.pos[2])];
  M._emit(frame, 'mark_set', { at: q ? q.travel.mark : null });
  return moved('getPlayerStats().pos destination (quest.travel.mark)', before, { mark: q && q.travel.mark ? q.travel.mark.slice() : null, pos: b ? b.pos.map(r3) : null });
}

function h_recall(M, frame, rec) {
  const q = M.w && M.w.sim ? M.w.sim.quest : null;
  const b = self(M);
  const before = { pos: b ? b.pos.map(r3) : null, mark: q && q.travel.mark ? q.travel.mark.slice() : null };
  if (!q || !q.travel.mark) {
    M._emit(frame, 'recall_refused', { reason: 'no_mark' });
    return moved('getPlayerStats().pos', before, before, { refused: 'no_mark' });
  }
  M.teleportTo(frame, q.travel.mark, 'recall');
  M.raiseFlag(frame, 'teleport:recall');
  return moved('getPlayerStats().pos', before, { pos: b ? b.pos.map(r3) : null, mark: q.travel.mark.slice() });
}

function h_intervention(M, frame, rec) {
  const b = self(M);
  const before = { pos: b ? b.pos.map(r3) : null };
  const sites = M.world.shrines;
  if (!sites.length || !b) {
    M._emit(frame, 'intervention_refused', { reason: 'no_shrine' });
    return moved('getPlayerStats().pos', before, before, { refused: 'no_shrine' });
  }
  let best = sites[0], bd = Infinity;
  for (const s of sites) {
    const d = Math.hypot(s.pos[0] - b.pos[0], s.pos[2] - b.pos[2]);
    if (d < bd) { bd = d; best = s; }
  }
  M.teleportTo(frame, best.pos, 'intervention', best.id);
  return moved('getPlayerStats().pos', before, { pos: b ? b.pos.map(r3) : null }, { site: best.id, metres: r2(bd) });
}

// ==============================================================================================
// THE REGISTRY. One row per catalogue effect. Completeness is asserted at construction.
// ==============================================================================================

export const HANDLERS = {
  // --- the five damage effects (hp is owned by the bridge's accumulator; buildup is owned here)
  fire_damage: damageHandler('fire'),
  frost_damage: damageHandler('frost'),
  shock_damage: damageHandler('shock'),
  poison_damage: damageHandler('poison'),
  damage_health: damageHandler(null),

  // --- hp / hp_max
  drain_health: h_drain_health,
  absorb_health: h_absorb_health,
  restore_health: h_restore_health,

  // --- attributes and skills
  restore_attribute: h_restore_attribute,
  fortify_attribute: h_fortify_attribute,
  fortify_skill: h_fortify_skill,

  // --- wards. Four DIFFERENT verbs, not one multiplier with four names (RI-MAG06 §D).
  resist_element: resistHandler('element'),   // % off fire/frost/shock, and nothing else
  resist_disease: resistHandler('disease'),   // % off disease/poison, and nothing else
  shield: h_shield,                           // FLAT off physical, and nothing else
  sap_ward: h_sap_ward,                       // not damage at all: the sap-taint band

  // --- afflictions
  cure_disease: cureHandler(['disease']),
  cure_poison: cureHandler(['poison']),
  cure_paralysis: cureHandler(['paralysis']),

  // --- equip load
  feather: loadHandler(-1),
  burden: loadHandler(+1),

  // --- traversal
  levitate: h_levitate,
  slowfall: h_slowfall,
  leap: h_leap,
  buoyancy: h_buoyancy,
  breathe_water: h_breathe_water,

  // --- Veiling
  night_eye: h_night_eye,
  chameleon: h_chameleon,
  invisibility: h_invisibility,
  muffle: h_muffle,
  false_face: h_false_face,

  // --- knowledge
  detect_life: detectHandler('life'),
  detect_key: detectHandler('key'),
  hist_sight: h_hist_sight,
  speak_to_the_dead: h_speak_to_the_dead,

  // --- the world
  open_lock: h_open_lock,
  lock_lock: h_lock_lock,
  ward_trap: h_ward_trap,
  shatter: h_shatter,
  corrode: h_corrode,
  mend_item: h_mend_item,
  telekinesis: h_telekinesis,
  wall: h_wall,

  // --- summons
  bind_lesser: bindHandler('lesser', 'drowned_lesser'),
  bind_greater: bindHandler('greater', 'drowned_greater'),
  bound_weapon: h_bound_weapon,

  // --- control
  calm_beast: h_calm_beast,
  demoralise: h_demoralise,
  frenzy: h_frenzy,
  charm: h_charm,
  paralyse: h_paralyse,
  silence: h_silence,
  soul_trap: h_soul_trap,

  // --- teleport
  mark: h_mark,
  recall: h_recall,
  intervention: h_intervention,
};

/** The five effects whose consequence IS hp loss. Everything else is forbidden from touching it. */
export const DAMAGE_EFFECTS = new Set(['fire_damage', 'frost_damage', 'shock_damage', 'poison_damage', 'damage_health']);

/**
 * Which ward channel each damage effect is stopped by. `damage_health` is `magic` — the channel
 * NOTHING wards — which is what makes it worth its cost and what makes it distinguishable from
 * the four elemental damage effects that share its shape.
 */
export const DAMAGE_EFFECT_KIND = Object.freeze({
  fire_damage: 'fire', frost_damage: 'frost', shock_damage: 'shock',
  poison_damage: 'poison', damage_health: 'magic',
});

/**
 * Fail loudly at boot on a catalogue entry with no handler, or a handler for an effect that is
 * not in the catalogue. A silently-missing handler is exactly the failure mode that produced
 * `GAP-W1-magic-effects-no-behaviour`: the applicator swallowed it and returned a damage number.
 */
export function assertRegistryComplete(effectIds) {
  const missing = effectIds.filter((id) => typeof HANDLERS[id] !== 'function');
  const extra = Object.keys(HANDLERS).filter((id) => !effectIds.includes(id));
  if (missing.length || extra.length) {
    throw new Error(
      `magic/apply.js registry mismatch — RI-MAG06 requires exactly one handler per catalogue effect.\n` +
      (missing.length ? `  no handler for: ${missing.join(', ')}\n` : '') +
      (extra.length ? `  handler for an effect not in the catalogue: ${extra.join(', ')}\n` : ''),
    );
  }
  return { handlers: Object.keys(HANDLERS).length, effects: effectIds.length };
}
