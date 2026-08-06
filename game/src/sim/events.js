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
]);

const POOL_SIZE = 64;

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
