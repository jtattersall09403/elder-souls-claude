// Pooled simulation events — HARNESS.md §5 `events[]`, extended by A-JRN7.
//
// Events are the one part of the frame record built inside the step, so they are pooled:
// emitting during steady-state traversal (where there are none) allocates nothing, and a
// busy combat frame reuses slots rather than minting objects (RI-PLT01 P4).
'use strict';

/** HARNESS.md §5 closed vocabulary, plus the A-JRN7 additions and RI-CMB11's input events. */
export const EVENT_TYPES = new Set([
  // HARNESS.md §5
  'attack_start', 'hit', 'block', 'parry', 'riposte', 'backstab', 'stagger', 'death',
  // W1-10, by the same amendment clause §5 grants. RI-WPN04 §B harness request 4 and RI-WPN06
  // §E both ask for it by name: a block that KEPT the guard up, distinct from `block`, carrying
  // the blocked attack's slot id. `guard.counter` is unmeasurable without it, and the whole
  // BLOCK row of the Wgrid is unmeasurable with it absent. `charge_release` is RI-WPN01 §C's
  // "released, not cancelled" — the frame the hold ended and what the ramp paid.
  'block_success', 'charge_release',
  'roll_start', 'iframe_dodge', 'stamina_spend', 'heal', 'bonfire_rest', 'level_up',
  'spawn', 'despawn', 'enemy_state', 'quest_stage', 'journal', 'topic', 'item', 'load',
  // A-JRN7
  'first_input', 'first_control', 'input_action', 'surface_enter', 'surface_exit',
  'dialogue_open', 'dialogue_close', 'topic_select', 'journal_write', 'save_write',
  'save_read', 'region_stream_in', 'region_stream_out', 'load_boundary_begin',
  'load_boundary_end', 'hitch', 'input_device_change', 'bloodstain_create',
  'bloodstain_recover',
  // RI-CMB11 §5
  'input_dropped', 'input_dropped_no_stamina', 'input_dropped_not_actionable',
  'input_buffered', 'input_overflow',
  // W1-09 additions to the §5 vocabulary, lower-case like the rest of it
  'guard_break', 'guard_up', 'whiff', 'exhausted_enter', 'exhausted_exit', 'winded',
  'parley_accept', 'parley_refuse', 'parley_exempt', 'lock_on', 'lock_break', 'lock_switch',
  // W1-07 addition, by the amendment clause HARNESS.md §5 grants ("a closed vocabulary,
  // extensible by amendment"). RI-CHR02 method 8 asserts, verbatim: "assert the Dunmer run
  // contains zero AGGRO transitions in 1,800 frames and >= 1 `parley_offer` event". There was
  // no event in the vocabulary that could carry it. `parley_offer` is the encounter OFFERING
  // a non-lethal opening; `parley_accept`/`parley_refuse` remain W1-09's in-fight resolution.
  'parley_offer',
  // W1-07: the census is a dialogue scene, so its nodes are dialogue events. `dialogue_open`
  // and `dialogue_close` already exist (A-JRN7); this is the per-field record RI-CHR01
  // method 1 needs to prove that every character field was set by answering a named person.
  'creation_field',
  // W1-07: one progress grant, with what it consumed on it. RI-PRG03 §3 prices a connecting
  // hit at 1 point and §4 refuses a use that consumed nothing; both halves are on the event,
  // so a critic can recompute the Cost Gate from trace.jsonl without re-probing.
  'skill_use',
  // W1-07: the sheet's derived pools changed (creation, an earned attribute point, a rest).
  'pools_derived',
  // W1-07 AR-3: the net is a mechanism, not a word in a trace field. `net_throw` is the
  // throw, `restrain_begin`/`restrain_end` are what it does to you, and `capture` is the
  // outcome that is NOT a death.
  'net_throw', 'restrain_begin', 'restrain_end', 'capture',
  // ---------------------------------------------------------------------------------------
  // RI-CMB07 §A's CLOSED event-kind set, for the SECOND stream (`es-combat-trace/1`).
  //
  // Two vocabularies now share one bus, and that is deliberate rather than sloppy: RI-CMB07
  // §A specifies es-combat-trace/1 as "a second stream from the same run, not a competing
  // format", and the two streams are joined on the frame index. They are DISJOINT BY CASE —
  // HARNESS.md §5 is lower_snake, RI-CMB07 §A is UPPER_SNAKE — so no name is ambiguous and
  // both sets stay closed and fail-closed. Every W1-09 event is emitted in BOTH forms where
  // §5 has an equivalent (see game/src/combat/system.js), so nothing that read the W1-00
  // vocabulary stops working.
  'LOCK_ON', 'LOCK_BREAK', 'LOCK_SWITCH', 'ACTION_START', 'GUARD_UP', 'HIT', 'CRIT_HIT',
  'CRIT_RELEASE', 'WHIFF', 'IFRAME_NEGATE', 'AVOID', 'BLOCK', 'GUARD_BREAK', 'STAGGER',
  'PARRY', 'RIPOSTE', 'ESTUS_START', 'ESTUS_DONE', 'DEATH',
  'INPUT_DROPPED', 'INPUT_BUFFERED', 'EXHAUSTED_ENTER', 'EXHAUSTED_EXIT', 'WINDED',
  'PARLEY_ACCEPT', 'PARLEY_REFUSE', 'PARLEY_EXEMPT',
  'SPELL_CYCLE',
  // W1-10, RI-CMB07 §A's UPPER_SNAKE stream. `BLOCK_SUCCESS` is RI-WPN04 §B harness request 4
  // and RI-WPN06 §E's shared request — a block that KEPT the guard up, without which
  // `guard.counter` cannot be measured at all. `CHARGE_RELEASE` is RI-WPN01 §C's "released,
  // not cancelled": the frame the hold ended, the frames held, and the ramped motion value.
  'BLOCK_SUCCESS', 'CHARGE_RELEASE',
  // ---------------------------------------------------------------------------------------
  // W1-14 / seam S19. RI-MAG01's harness amendment 4 asks for exactly these six lower_snake
  // kinds, and they are ADDITIONS: `elder-souls/trace@1` -> `@2`, nothing removed. They stay
  // in the §5 vocabulary rather than the RI-CMB07 one because a cast is observable outside a
  // fight too (a RITUAL is, by construction, only ever cast outside one).
  'cast_start', 'cast_release', 'cast_interrupt', 'focus_spend', 'effect_apply', 'effect_expire',
  // and the world-facing consequences the Morrowind half needs
  'spell_hit', 'levitate_begin', 'levitate_end', 'soul_trapped', 'soul_trap_refused',
  // ---- W1-15 / AMENDMENT AM-W1-15-02 — stealth, theft, crime and justice ------------------
  // HARNESS.md §5 declares the vocabulary "a closed vocabulary, EXTENSIBLE BY AMENDMENT", and
  // four reference items name these events by string in their Comparison methods:
  //   RI-STL01: detect, challenge, search_start, search_end, zone_alert, light_snuffed, distraction
  //   RI-STL02: theft, pickpocket, lock_attempt, lock_open, pick_break, trespass_enter, fence_sale
  //   RI-CRM01: crime, witness, report, bounty_change, arrest, jail_serve, corpse_found, bloodprice
  //   RI-CRM02: writ
  // Without them the events are unemittable and every one of those methods is unmeasurable.
  // `crouch`, `crouch_refused`, `civ_state` and `death_flag` are this piece's own additions and
  // are named here rather than folded into a neighbour's meaning.
  'detect', 'challenge', 'search_start', 'search_end', 'zone_alert', 'light_snuffed', 'distraction',
  'crouch', 'crouch_refused', 'civ_state',
  'theft', 'pickpocket', 'lock_attempt', 'lock_ward_set', 'lock_open', 'pick_break', 'trespass_enter', 'fence_sale',
  'crime', 'witness', 'report', 'bounty_change', 'arrest', 'jail_serve', 'corpse_found', 'bloodprice', 'death_flag',
  'writ',
]);

const POOL_SIZE = 128;

export class EventBus {
  constructor() {
    this.pool = new Array(POOL_SIZE);
    for (let i = 0; i < POOL_SIZE; i++) this.pool[i] = { f: 0, type: '' };
    this.count = 0;
    this.overflow = 0;
  }

  clear() { this.count = 0; }

  /**
   * @param {number} frame
   * @param {string} type must be in the closed vocabulary; an unknown type throws so a
   *        typo becomes a loud failure rather than an event a critic never finds.
   * @returns {object} the pooled record — set payload fields on it directly.
   */
  emit(frame, type) {
    if (!EVENT_TYPES.has(type)) {
      throw new Error(`event type '${type}' is not in the closed vocabulary (HARNESS.md §5, A-JRN7)`);
    }
    if (this.count >= POOL_SIZE) { this.overflow++; return this.pool[POOL_SIZE - 1]; }
    const e = this.pool[this.count++];
    for (const k in e) if (k !== 'f' && k !== 'type') delete e[k];
    e.f = frame; e.type = type;
    return e;
  }

  /** Copy into a fresh array for the trace record. Called OUTSIDE the sim step. */
  snapshotInto(out) {
    out.length = 0;
    for (let i = 0; i < this.count; i++) {
      const e = this.pool[i];
      const c = {};
      for (const k in e) c[k] = e[k];
      out.push(c);
    }
    return out;
  }
}
