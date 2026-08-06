// The weapons harness surface — window.__HARNESS.weapons.*
//
// W1-10. `corpus/12-weapons/WEAPON-CRITIC.md` §3.1 is explicit: if the harness is missing
// `player.anim_slot`, `player.hitstop_f`, `player.weapon_tip` or the `impact` / `block_success`
// events, the affected checks score **0, fail-closed**, and the critic must NOT substitute source
// reading for the missing instrument. Each of RI-WPN01..06 lists the extensions its method needs.
// This file supplies the ones that are properties of the WEAPON DATA rather than of a running
// fight, so that a critic can compute `CFS`, the `Wgrid`, the clip-integrity matrix, the hitstop
// grid and the mass census without a single frame of gameplay — and then confirm the trace agrees.
//
// Everything here is a pure function of game/data/weapons/** and game/data/combat/skeleton.json.
// No wall clock, no RNG, no simulation state: calling any of it inside a fixed step is safe and
// calling it twice returns the identical object.
'use strict';

import { Rig } from '../combat/skeleton.js';
import { MovesetLibrary } from '../combat/moveset.js';

export function installWeaponsHarness(data) {
  const classes = data.weapons && data.weapons.classes;
  const registry = data.weapons && data.weapons['clip-registry'];
  const movesets = data.weaponMovesets || {};
  if (!classes || !registry) {
    return {
      _declared_incomplete: 'game/data/weapons/{classes,clip-registry}.json did not load; every weapon query below is unavailable and every RI-WPN check that needs it scores 0, fail-closed.',
    };
  }
  const lib = new MovesetLibrary(registry, classes, movesets);
  const rig = new Rig(data.combat.skeleton, data.combat.hitgeometry);
  const ids = Object.keys(movesets).sort();

  const MATERIALS = ['flesh', 'chitin', 'stone', 'metal', 'shield', 'wood', 'water'];

  return {
    /** Every weapon in the roster, with the four fields a sampler needs to stratify. */
    listWeapons() {
      return ids.map((id) => {
        const m = movesets[id];
        return {
          weapon_id: id, name: m.name, class: m.class, weight_tier: m.weight_tier,
          baseline: m.baseline_ref === null, reach_m: m.reach_m,
          slots: Object.keys(m.slots).length,
        };
      });
    },

    /** The declared moveset. RI-WPN01 M6's "declared" source; the trace is the other one. */
    getMoveset(weaponId) {
      const m = movesets[weaponId];
      if (!m) throw new Error(`getMoveset: unknown weapon '${weaponId}'. ${ids.length} known.`);
      return m;
    },

    /**
     * RI-WPN03 M2's requested extension, verbatim: "a `H.getClipTrack(clipId)` query returning the
     * clip's root track and per-frame hitbox capsule poses, so M2 can compare clips without
     * playing all 500+ of them in real time. Without it M2 costs ~40 minutes of harness time per
     * wave and will be skipped, which is worse than not having the check."
     *
     * Returns `{clip, frames, root[], a[], b[]}` — `a`/`b` are the weapon capsule's world
     * endpoints on each animation frame, evaluated on the real rig at the real frame counts.
     */
    getClipTrack(weaponId, slotId) {
      return lib.clipTrack(rig, weaponId, slotId);
    },

    /** Every (weapon, slot) pair that uses a clip id — the census RI-WPN03 M1 builds. */
    findClip(clipId) {
      const out = [];
      for (const id of ids) {
        for (const [sid, s] of Object.entries(movesets[id].slots)) if (s.anim === clipId) out.push({ weapon_id: id, slot: sid });
      }
      return { clip: clipId, registry: registry.clips[clipId] || null, used_by: out };
    },

    /**
     * The slot a button press resolves to, given a player state. This is the `Wgrid` instrument
     * of RI-WPN04 M2 and it is the function the whole area turns on: it returns a SLOT ID or
     * null, and there is no code path anywhere that returns `r1.1` because a window was missed.
     */
    resolveSlot(weaponId, button, ctx) {
      return lib.resolveSlot(weaponId, button, ctx || {});
    },

    /**
     * RI-WPN04 M2's window probe, computed rather than driven: inject `button` at every frame k of
     * the enclosing state and record what fires. Returns `Wgrid[k] in {none, contextual, standard,
     * buffered}` plus the declared window, so an off-by-one is visible at a glance.
     */
    wgrid(weaponId, slotId, opts) {
      const o = opts || {};
      const tier = o.roll_tier || 'LIGHT';
      const state = ({
        'roll.r1': 'ROLL', 'roll.r2': 'ROLL', 'backstep.r1': 'BACKSTEP',
        'run.r1': 'SPRINT', 'run.r2': 'SPRINT', 'jump.r1': 'AIRBORNE', 'jump.r2': 'AIRBORNE',
        'guard.counter': 'BLOCK_SUCCESS',
      })[slotId.replace(/^2h\./, '')];
      if (!state) throw new Error(`wgrid: '${slotId}' is not a contextual slot`);
      const button = /r2$/.test(slotId) ? 'heavy' : 'light';
      const w = classes.contextual_windows;
      const declared = state === 'ROLL' ? w.roll[tier] : state === 'BACKSTEP' ? w.backstep[tier]
        : state === 'BLOCK_SUCCESS' ? [1, w.guard_counter_f] : null;
      const grid = [];
      const maxK = o.frames || 96;
      for (let k = 1; k <= maxK; k++) {
        const r = lib.resolveSlot(weaponId, button, {
          state, state_frame: k, roll_tier: tier,
          stance: slotId.startsWith('2h.') ? 'two_hand' : 'one_hand',
          offhand_shield: true, descending: true, fall_height_m: 0, target_below: false,
          sprint_held_f: state === 'SPRINT' ? 40 : 0, forward_mag: 0,
        });
        grid.push(r.slot === null ? 'none' : (r.slot === 'r1.1' || r.slot === '2h.r1.1') ? 'standard' : 'contextual');
      }
      const first = grid.indexOf('contextual') + 1;
      const last = grid.lastIndexOf('contextual') + 1;
      return {
        weapon_id: weaponId, slot: slotId, state, roll_tier: tier, button,
        declared_window_f: declared, observed_window_f: first ? [first, last] : null,
        grid, buffer_f: w.buffer_f,
      };
    },

    /**
     * The 5x7 hitstop grid of RI-WPN05 §A, plus the material multiplier, the knockback and the
     * deflection verdict — the whole observable triple RI-WPN05 §F's `ILS` classifies.
     */
    impactFor(weaponId, slotId, material) {
      if (!MATERIALS.includes(material)) throw new Error(`impactFor: unknown material '${material}'. Known: ${MATERIALS.join(', ')}`);
      const m = movesets[weaponId];
      const deflect = lib.deflects(weaponId, slotId, material);
      return {
        weapon_id: weaponId, slot: slotId, material, weight_tier: m.weight_tier,
        attacker_hitstop_f: lib.hitstopFor(weaponId, slotId, material),
        victim_hitstop_f: lib.victimHitstopFor(weaponId, slotId, material),
        knockback_m: lib.knockbackFor(weaponId, slotId, material),
        damage_multiplier: lib.materialMultiplier(weaponId, slotId, material),
        deflect,
        added_recovery_f: deflect ? classes.hitstop.deflect.added_recovery_f : 0,
        camera_shake_deg: classes.hitstop.camera_shake_deg_per_tier * (['light', 'medium', 'heavy', 'ultra'].indexOf(m.weight_tier) + 1),
        decal: { flesh: 'blood', chitin: 'chip', stone: 'spark_dust', metal: 'spark_dust', shield: 'spark_dust', wood: 'splinter', water: 'splash' }[material],
      };
    },

    /** RI-WPN05 §E's tip-bone extension: the weapon tip's world position, per animation frame. */
    weaponTipTrack(weaponId, slotId) {
      const t = lib.clipTrack(rig, weaponId, slotId);
      const speeds = [];
      for (let i = 1; i < t.b.length; i++) {
        const d = Math.hypot(t.b[i][0] - t.b[i - 1][0], t.b[i][1] - t.b[i - 1][1], t.b[i][2] - t.b[i - 1][2]);
        speeds.push(Math.round(d * 60 * 1000) / 1000);   // m/s at 60 Hz
      }
      return { clip: t.clip, frames: t.frames, tip: t.b, tip_speed_mps: speeds };
    },

    /** RI-WPN01 §C's charge ramp, evaluated. Monotone lerp, single stamina deduction. */
    chargeState(weaponId, slotId, heldFrames) { return lib.chargeState(weaponId, slotId, heldFrames); },

    /** The offhand / shield taxonomy of RI-WPN06 §C-§E. */
    getOffhandConfig() { return (data.weapons && data.weapons.offhand) || { _declared_incomplete: 'game/data/weapons/offhand.json did not load' }; },

    /** The full input conjunction per slot — what the schema's `trigger` block cannot express. */
    getInputMap() { return (data.weapons && data.weapons['input-map']) || { _declared_incomplete: 'game/data/weapons/input-map.json did not load' }; },

    _declared_incomplete: 'These queries are pure functions of the weapon DATA. They are one half of HARNESS.md §7.4\'s two-source rule; the other half — player.anim_slot, player.hitstop_f and player.weapon_tip inside a live trace, and the impact / block_success event types — belongs to the combat runtime (W1-09) and to W1-11, and RI-WPN01 M2 / M6 and RI-WPN05 M1 are NOT fully measurable until those land. Scoring them 0 fail-closed against this piece is correct.',
  };
}
