// Cast moves — a spell expressed in the SAME move object a sword swing uses.
//
// This is the load-bearing architectural decision of the piece and it is worth stating plainly.
// RI-MAG01 "How we lose" #10 predicts that "spell frame data lives in JavaScript": the weapons
// end up in `combat/movesets/*.json` and the spells end up as a `switch` in `magic.js`, so
// HARNESS §7 rule 4's declared-vs-observed diff has nothing to diff and half of ES-CAST/1 is
// decorative. Building a cast as a `Move` closes that by construction — the commitment window,
// the retire-at-the-top-of-the-step rule, the hyperarmour pool and the root-motion authority
// are all the ones RI-CMB02 already enforces for a swing, because they are literally the same
// code path. A cast cannot be cancelled by an animation cross-fade here, because there is no
// animation mixer: there is a state machine reading a frame index.
//
// Two fields are deliberately absent from every move this file builds:
//   `hitbox: false`  — a cast never creates a WEAPON hitbox. Spell geometry lives in
//                      MagicSystem and is a projectile/volume/contact record, not a swept
//                      weapon capsule.
//   `iframes: null`  — CombatBody.advance() reads `m.iframes` and sets `iframe` from it. A
//                      null here is what makes "casting grants no i-frames, ever" true in the
//                      only place it can be measured.
'use strict';

import { Clip } from '../../combat/clips.js';

/** Compose a class archetype with a school override into one distinct silhouette. */
function composeArchetype(clipData, classClip, school) {
  const base = clipData.class_archetypes[classClip];
  if (!base) throw new Error(`buildCastMove: no cast clip archetype '${classClip}'`);
  const over = clipData.school_overrides[school];
  const tracks = {};
  for (const b in base.tracks) tracks[b] = { ...base.tracks[b] };
  if (over) for (const b in over.tracks) tracks[b] = { ...(tracks[b] || {}), ...over.tracks[b] };
  return { tracks, root_forward: base.root_forward, root_offset: base.root_offset, silhouette: base.silhouette };
}

/**
 * @param {object} spell a record from game/data/magic/spells.json (or a commissioned one)
 * @param {object} cls   the ES-CAST/1 row for the spell's weight class
 * @param {object} clipData game/data/magic/cast-clips.json
 * @param {boolean} twoHandedCatalyst hyperarmour applies ONLY when two-handing a catalyst
 */
export function buildCastMove(spell, cls, clipData, twoHandedCatalyst) {
  const arch = composeArchetype(clipData, cls.clip, spell.school);
  // The cast-walk speed comes from the clip's root track (RI-CMB01 §C rule 5), never from
  // `velocity × dt`. HEAVY and GREAT plant the feet, so their root displacement is what the
  // archetype says and nothing adds to it.
  const walk = cls.move_speed_startup_mps;
  const rootForward = walk > 0 ? walk * (cls.total / 60) : (arch.root_forward.length ? undefined : 0);
  const clip = new Clip(
    `cast_${spell.id}`, arch,
    { startup: cls.startup, active: cls.active, total: cls.total },
    1.0,
    rootForward === undefined ? 0.30 : rootForward,
  );
  const m = {
    id: `cast_${spell.id}`,
    kind: 'cast',
    anim: `cast_${cls.clip}_${spell.school}`,
    spell: spell.id,
    cast_class: spell.class,
    startup: cls.startup,
    active: cls.active,
    recovery: cls.recovery,
    total: cls.total,
    hard_until: cls.hard_until,          // dodge-cancellable strictly after this frame
    tc_frame: cls.Tc,
    stamina: cls.stamina,
    hitbox: false,                       // never a weapon hitbox
    iframes: null,                       // never an i-frame, at any class, under any catalyst
    poise_damage: 0,
    turn_rate_dps: 0,
    clip,
    silhouette: arch.silhouette,
    states: { startup: 'CAST_WINDUP', active: 'CAST_RELEASE', recovery: 'CAST_RECOVER' },
    move_speed_startup_mps: cls.move_speed_startup_mps,
    move_speed_after_mps: cls.move_speed_after_mps,
  };
  if (cls.hyperarmour_window && twoHandedCatalyst) m.hyperarmour_window = cls.hyperarmour_window;
  return m;
}

/** The state names a cast introduces, declared so HARNESS §5's enum stays closed. */
export const CAST_STATE_ENUM = ['CAST_WINDUP', 'CAST_RELEASE', 'CAST_RECOVER'];
