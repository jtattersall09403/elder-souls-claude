// The nineteen environmental hazards, firing.
//
// WHY THIS FILE EXISTS. Verdict W1-01 round 2 §6: "Sixty seconds of standing at each of the
// thirteen region centroids, no input, tide LOW, noon. Thirteen of thirteen: hp 620->620,
// stam 120->120. The census passes; nothing in it is real." `game/data/world/hazards.json` was
// loaded by `engine.js` into `data.hazards` and read by nothing else — the same defect class as
// the deck spans, and exactly what `corpus/00-doctrine/ARBITRATION.md` §3's CONSUMPTION check
// (RI-MTH07) was added to catch.
//
// `hazards.json` is still the only declaration. Every magnitude, every tell lead, every range and
// every class comes off it; nothing here invents a number. Change `value` in that file and the
// damage changes; delete a hazard and it stops firing. That is the consumption demonstration.
//
// THE LAWS IT OBEYS, from RI-WLD11 §3, each named where it is enforced:
//   H1 telegraph  — a `hazard_tell` event `lead_s` before the first damage frame, from `range_m`,
//                   on a channel that is not the damage. `_tell()`.
//   H2 escapable  — the hazard's volume is bounded and leaving it stops it within a frame.
//   H4 clock      — ATTRITION is `pct_max_hp_per_s` off `hazards.json` and nothing else, so
//                   "no ATTRITION hazard may kill a player at full HP in under 80 s" is arithmetic
//                   on the declared value rather than a promise.
//   H6 no scaling — nothing here reads player level. There is no level term in this file.
//   H7 not in the arena — `_suppressed()` refuses to fire inside a camera fixture or a settlement.
//   H8 one KILL   — `voriplasm`, and it is the one signature element that is also an actor.
//   H9 everyone   — `applies_to_npcs` is honoured: entities inside a volume take the same hit.
'use strict';

const BANDS = ['W0', 'W1', 'W2', 'W3', 'W4', 'W5'];

/**
 * Where a hazard is, in the world. A hazard is not "the whole region" — that is a debuff wearing a
 * region's name. Each class gets a volume that a player can be inside or outside of, and the
 * ONLY-HERE element the region already owns is what anchors the ones that have an anchor.
 */
const ANCHOR = {
  // Anchored on a placed signature instance: you are in danger because you are next to the thing
  // that makes the region what it is. Eleven of the nineteen work this way, which is the point —
  // the geometry that makes a region LEGIBLE is the geometry that makes it DANGEROUS.
  'kiln-ground': { kind: 'naga_kiln_dome', r: 30 },
  'comb-collapse': { kind: 'comb_cliff', r: 26 },
  voriplasm: { kind: 'voriplasm', r: 6 },
  'dye-fume': { kind: 'open_dye_vat', r: 26 },
  'hist-sap-fume': { kind: 'petrified_bole', r: 10 },
  'spore-bloom': { kind: 'welkynd_pillar', r: 30 },
  'strangler-snare': { kind: 'welkynd_pillar', r: 12 },
  'press-gang-water': { kind: 'root_arch', r: 22 },
  'pair-lightning': { kind: 'petrified_bole', r: 18 },
};

/** Hazards whose volume is a terrain, water or weather condition rather than a placed object. */
const CONDITION = {
  'ridge-exposure': (c) => c.region === 'salt-hills' && c.y > 150,
  'salt-storm': (c) => c.region === 'stone-wastes',
  rockfall: (c) => (c.region === 'valus-ridge' || c.region === 'salt-hills') && c.slope > 26,
  thirst: (c) => c.region === 'clay-moor',
  'ash-lung': (c) => c.region === 'thornmarsh' && (c.weather === 'ashfall' || c.weather === 'dust_devil'),
  'the-thicket': (c) => c.region === 'thornmarsh',
  'the-fall': (c) => c.region === 'valus-ridge' && c.slope > 30,
  'cut-off-by-the-tide': (c) => c.region === 'eastern-rootlands' && c.depth > 0.05,
  'the-flats-flood': (c) => c.region === 'marauders-coast' && c.depth > 0.05,
  'high-tide-gate': (c) => (c.region === 'marauders-coast' || c.region === 'crimson-coast') && c.tide === 'HIGH' && c.depth > 0.4,
};

/**
 * SHELTER — RI-WLD11 H3, and the reason the region-wide hazards are legal under H2.
 *
 * H2 requires an ATTRITION hazard to be escapable "within 6.0 s", and H3 requires at least one
 * counter that is knowledge or routing rather than an item. A salt-storm that stops at an arbitrary
 * line 19 m away is neither; a salt-storm you get out of by dropping into a crater is both. So the
 * region-wide hazards are escaped by REACHING SOMETHING, and the something is always the region's
 * own ONLY-HERE element:
 *
 *   Stone Wastes  salt-storm      -> drop below the rim of a glassed crater  (counter route:crater-shelter)
 *   Thornmarsh    the-thicket     -> follow the knife-marks cut into the stems (counter knowledge:knife-marks)
 *   The Salt Hills ridge-exposure -> get on the Imperial road, which is what the milestones mark
 *   The Clay Moor thirst          -> a kiln dome is a building, and buildings have water
 *
 * That is the same coupling from the other side: the thing that tells you where you are is the
 * thing that keeps you alive.
 */
const SHELTER = {
  'salt-storm': (c, sig, field) => nearKind(sig, c, 'glassed_crater', 22) && field.heightAt(c.x, c.z) < field.naturalHeightAt(c.x, c.z) + 0.01,
  'the-thicket': (c, sig) => nearKind(sig, c, 'knife_mark_stem', 11),
  'ridge-exposure': (c, sig, field) => field.onRoadAt(c.x, c.z),
  thirst: (c, sig, field) => nearKind(sig, c, 'naga_kiln_dome', 34) || field.onRoadAt(c.x, c.z),
  rockfall: (c, sig, field) => field.onRoadAt(c.x, c.z),
};

function nearKind(sig, c, kind, r) {
  if (!sig) return false;
  return sig.nearestOfKind(kind, c.x, c.z, r) <= r;
}

export class Hazards {
  /**
   * @param {object} doc  game/data/world/hazards.json — the ONLY source of magnitudes
   * @param {import('../world/field.js').WorldField} field
   * @param {import('../world/signature.js').SignatureField} sig
   * @param {object[]} regions
   */
  constructor(doc, field, sig, regions) {
    this.doc = doc;
    this.field = field;
    this.sig = sig;
    this.regionNameToId = new Map(regions.map((r) => [r.name, r.id]));
    this.byId = new Map(doc.hazards.map((h) => [h.id, h]));
    // Which hazards can possibly fire in which region, resolved once off the declaration.
    this.byRegion = new Map();
    for (const h of doc.hazards) {
      for (const rn of h.regions) {
        const id = this.regionNameToId.get(rn);
        if (!id) throw new Error(`hazards.json names region "${rn}", which regions.json does not have`);
        if (!this.byRegion.has(id)) this.byRegion.set(id, []);
        this.byRegion.get(id).push(h);
      }
    }
    this.reset();
  }

  reset() {
    this.active = new Map();          // hazard id -> { since, told, damageFrom }
    this.spent = new Set();           // TRAP/KILL ids that have fired and not yet been left
    this.told = new Map();            // hazard id -> frame the tell fired
    // W1-01 round 4. `row.fired` was read off `this.active.get(id)`, and a TRAP or a KILL is
    // DELETED from `active` on the same frame it fires (see the `spent` line at the end of
    // `_update`). So the report said `fired: false` for every trap in the province from the
    // instant it fired onward — including a comb collapse that had just taken 99.2 HP off the
    // body one frame earlier. Six of the nineteen hazards are TRAP or KILL and the world's own
    // report was structurally incapable of ever saying any of them went off.
    //
    // `history` is the record rather than the arming state: id -> what actually happened to the
    // body. It is what `row.fired` now reads, and it survives the volume disarming.
    this.history = new Map();         // hazard id -> { fired_at, outcome, damage_dealt, fires }
    this.events = [];
    this.lastReport = [];
  }

  /** RI-WLD11 H7: hazards belong to the world, not to an arena or a hearth. */
  _suppressed(sim) {
    if (sim.cellId) return 'camera fixture';
    for (const s of this.field.sites) {
      if (s.kind !== 'settlement') continue;
      if (Math.hypot(sim.player.pos[0] - s.x, sim.player.pos[2] - s.z) < s.r_flat) return `settlement ${s.id}`;
    }
    return null;
  }

  /**
   * The context every predicate reads. ONE object for the lifetime of the session, mutated in
   * place — `RI-PLT01` P4: "every object and array is created once, at reset(), and mutated in
   * place for the rest of the run. The simulation step allocates nothing." This runs 207,000 times
   * during THE CROSSING and returning a fresh literal would have been 207,000 objects.
   */
  _context(sim) {
    const f = this.field;
    const c = this._ctx || (this._ctx = {});
    const x = sim.player.pos[0], z = sim.player.pos[2];
    const r = f.regionAt(x, z);
    const depth = f.depthAt(x, z);
    const slope = f.slopeAt(x, z);
    const tide = f.tideState();
    c.x = x; c.z = z; c.region = r.id; c.y = f.heightAt(x, z); c.slope = slope;
    c.depth = depth;
    c.band = BANDS[[0.0, 0.01, 0.21, 0.51, 0.96, 1.41].filter((v) => depth >= v).length - 1];
    c.weather = sim.env.weather; c.hour = sim.env.timeOfDay; c.tide = tide;
    c.rising = tide === 'RISING'; c.openSky = slope < 20;
    return c;
  }

  /** A report row for hazard `id`, reused across frames. Same P4 discipline. */
  _row(id) {
    this._rows = this._rows || new Map();
    let r = this._rows.get(id);
    if (!r) { r = { id }; this._rows.set(id, r); }
    return r;
  }

  /** The distance to the nearest instance of a hazard's anchor, or null if it has none. */
  _anchorDist(h, ctx) {
    const a = ANCHOR[h.id];
    if (!a || !this.sig) return null;
    return { d: this.sig.nearestOfKind(a.kind, ctx.x, ctx.z, Math.max(a.r, h.tell.range_m)), r: a.r };
  }

  /**
   * Is the player inside this hazard's volume? Anchored hazards ask the placed geometry; condition
   * hazards ask the terrain, the water and the weather. Both are things a player can walk out of,
   * which is RI-WLD11 H2 in structural form.
   */
  _inside(h, ctx) {
    const shelter = SHELTER[h.id];
    if (shelter && shelter(ctx, this.sig, this.field)) return false;
    const an = this._anchorDist(h, ctx);
    if (an) return an.d <= an.r;
    const cond = CONDITION[h.id];
    if (cond) return cond(ctx);
    return false;
  }

  /** How far away the nearest edge of the volume is, for the tell (H1's `range_m`). */
  _approach(h, ctx) {
    const an = this._anchorDist(h, ctx);
    if (an) return an.d - an.r;
    return this._inside(h, ctx) ? 0 : Infinity;
  }

  /**
   * One frame. Runs after physics so it reads the position the trace reports on this frame.
   *
   * `combat` (optional, additive) is the CombatSystem, and H9 needs it. See `_hurtEntity`.
   *
   * @returns the per-hazard state, for `getHazardReport()`.
   */
  step(sim, bus, combatBody, combat) {
    this.events.length = 0;
    const f = sim.frame;
    const suppressed = this._suppressed(sim);
    const ctx = this._context(sim);
    const here = this.byRegion.get(ctx.region) || [];
    const report = this._report || (this._report = []);
    report.length = 0;
    const p = sim.player;

    for (const h of here) {
      const inside = !suppressed && this._inside(h, ctx);
      const approach = this._approach(h, ctx);
      const st = this.active.get(h.id) || null;

      // ---- H1: the telegraph -------------------------------------------------------------
      // The tell fires when the volume comes within `tell.range_m`, on `tell.channels` — which
      // never include the damage. `lead_s` is the declared minimum gap to the first damage frame,
      // and `damageFrom` enforces it: a hazard cannot hurt you before its own tell has had time
      // to be read.
      if (!suppressed && approach <= h.tell.range_m && !this.told.has(h.id)) {
        this.told.set(h.id, f);
        const e = bus.emit(f, 'hazard_tell');
        e.hazard = h.id; e.hazard_class = h.class; e.channels = h.tell.channels.join('+');
        e.lead_s = h.tell.lead_s; e.range_m = +Math.max(0, approach).toFixed(1);
        this.events.push({ kind: 'tell', id: h.id, at: f });
      }
      if (!suppressed && approach > h.tell.range_m * 1.35) this.told.delete(h.id);

      if (!inside) this.spent.delete(h.id);
      if (inside && !st && !this.spent.has(h.id)) {
        const toldAt = this.told.has(h.id) ? this.told.get(h.id) : f;
        const entry = { since: f, damageFrom: toldAt + Math.round(h.tell.lead_s * 60), ticks: 0, dealt: 0 };
        this.active.set(h.id, entry);
        const e = bus.emit(f, 'hazard_enter');
        e.hazard = h.id; e.hazard_class = h.class;
        e.first_damage_frame = entry.damageFrom;
        e.telegraph_frames = entry.damageFrom - toldAt;
        this.events.push({ kind: 'enter', id: h.id, at: f });
      } else if (!inside && st) {
        this.active.delete(h.id);
        const e = bus.emit(f, 'hazard_exit');
        e.hazard = h.id; e.frames_inside = f - st.since; e.damage_taken = +st.dealt.toFixed(2);
        this.events.push({ kind: 'exit', id: h.id, at: f });
      }

      const cur = this.active.get(h.id);
      if (cur && f >= cur.damageFrom) {
        // SIX OF THE NINETEEN DO NO HP DAMAGE BY DESIGN — RI-WLD11 M57 requires at least six with
        // `damage.kind: "none"`, because a VECTOR gives you a disease, a GATE closes a route and a
        // STRANDING leaves you on the wrong side of the water. Measuring those with a health bar
        // measures nothing, which is why round 2's probe read 620->620 and concluded "none fire".
        // They fire here, with a consequence on the player and a `hazard_fired` event carrying it.
        if (!cur.fired) {
          cur.fired = true;
          const e = bus.emit(f, 'hazard_fired');
          e.hazard = h.id; e.hazard_class = h.class;
          e.telegraph_frames = cur.damageFrom - (this.told.get(h.id) ?? cur.since);
          if (h.class === 'VECTOR') {
            // W1-14 round 3: ONE affliction register.
            //
            // Wave 1 had two. The four VECTOR hazards pushed the hazard's own id, as a bare
            // string, onto `sim.player.afflictions`; `cure_disease` spliced `sim.quest.afflictions`,
            // an array of `{id, kind}` records that only the harness's `addAffliction()` ever
            // wrote. So the diseases the game could actually give you were in one array and the
            // spell that cures diseases read the other, and curing a disease you had really
            // caught did nothing at all. The register is `sim.quest.afflictions` — it is on the
            // save manifest, the quest machine reads it, and `getQuestState()` reports it —
            // and `sim.player.afflictions` is kept as a list of ids so nothing that read it breaks.
            const id = h.affliction || h.id;
            const q = sim && sim.quest ? sim.quest : null;
            if (q) {
              if (!q.afflictions.some((a) => a.id === id)) {
                q.afflictions.push({
                  id, kind: h.affliction_kind || 'disease',
                  name: h.affliction_name || id, source: h.id, caught_at_frame: f,
                });
                q.afflictions.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
                // Morrowind's diseases DRAIN. This is also the precondition `restore_attribute`
                // never had: the round-2 critic recorded it as a real field with "no reachable
                // precondition — nothing in the build ever lowers an attribute", so an effect
                // whose whole job is to put one back could not be observed doing it. Catching
                // the droops now costs you 10 AGILITY until it is cured.
                const dr = h.affliction_drains;
                const A = sim.progression && sim.progression.attributes;
                if (dr && A && A[dr.attribute] !== undefined) {
                  const took = Math.min(dr.points, Math.max(0, A[dr.attribute] - 1));
                  A[dr.attribute] -= took;
                  const rec = q.afflictions.find((a) => a.id === id);
                  if (rec) rec.drained = { attribute: dr.attribute, points: took };
                  e.drained_attribute = dr.attribute; e.drained_points = took;
                  sim._poolsDirty = true;
                }
              }
              p.afflictions = q.afflictions.map((a) => a.id);
            } else {
              p.afflictions = p.afflictions || [];
              if (!p.afflictions.includes(id)) p.afflictions.push(id);
            }
            e.outcome = 'affliction'; e.affliction = id; e.affliction_kind = h.affliction_kind || 'disease';
          } else if (h.class === 'GATE' || h.class === 'STRANDING') {
            p.strandedBy = h.id;
            e.outcome = 'route_closed';
          } else {
            e.outcome = h.damage.kind;
          }
          this.events.push({ kind: 'fired', id: h.id, at: f, outcome: e.outcome });
          const hi = this.history.get(h.id) || { fired_at: f, outcome: e.outcome, damage_dealt: 0, fires: 0 };
          hi.fired_at = hi.fires === 0 ? f : hi.fired_at;
          hi.last_fired_at = f; hi.outcome = e.outcome; hi.fires++;
          this.history.set(h.id, hi);
        }
        const dmg = this._damageThisFrame(h, p);
        if (dmg > 0) {
          if (combatBody) { combatBody.hp = Math.max(0, combatBody.hp - dmg); p.hp = combatBody.hp; }
          else p.hp = Math.max(0, p.hp - dmg);
          cur.dealt += dmg; cur.ticks++;
          const hd = this.history.get(h.id);
          if (hd) hd.damage_dealt = +(hd.damage_dealt + dmg).toFixed(3);
          // One event per second of attrition rather than per frame: a trace with 3,600 identical
          // records per minute is not evidence, it is noise.
          if (cur.ticks % 60 === 1 || h.damage.kind !== 'pct_max_hp_per_s') {
            const e = bus.emit(f, 'hazard_damage');
            e.hazard = h.id; e.hazard_class = h.class; e.kind = h.damage.kind;
            e.declared_value = h.damage.value === undefined ? null : h.damage.value;
            e.damage = +dmg.toFixed(3); e.hp_after = +p.hp.toFixed(2);
          }
          if (p.hp <= 0) {
            p.state = 'DEATH';
            if (combatBody) combatBody.state = 'DEATH';
            const e = bus.emit(f, 'hazard_fired');
            e.hazard = h.id; e.outcome = 'death';
          }
        }
        // A TRAP fires ONCE and the volume is then spent until you leave it and come back.
        // Without `spent` the entry re-armed on the next frame while the player was still inside,
        // so a 16%-of-max-HP comb collapse fired sixty times a second and read as a kill volume.
        if (h.class === 'TRAP' || h.class === 'KILL') { this.active.delete(h.id); this.spent.add(h.id); }
      }

      // H9: hazards hurt everyone. The same volume, the same declared magnitude, no player term.
      if (h.applies_to_npcs && cur && f >= cur.damageFrom && sim.entities.length) {
        const an = ANCHOR[h.id];
        for (const ent of sim.entities) {
          if (!ent.hp || ent.hp <= 0 || ent.archetype === 'player') continue;
          let inVol = false;
          if (an && this.sig) {
            for (const it of this.sig.ofKind(an.kind)) {
              if (Math.hypot(it.x - ent.pos[0], it.z - ent.pos[2]) <= an.r) { inVol = true; break; }
            }
          } else inVol = f_regionOf(this.field, ent) === ctx.region;
          if (!inVol) continue;
          const d = this._damageThisFrame(h, { hpMax: ent.hpMax || ent.hp });
          if (d > 0) this._hurtEntity(sim, bus, combat, ent, d, h, f);
        }
      }

      const row = this._row(h.id);
      row.class = h.class; row.region = ctx.region; row.inside = inside;
      row.approach_m = Number.isFinite(approach) ? +approach.toFixed(1) : null;
      row.told_at_frame = this.told.has(h.id) ? this.told.get(h.id) : null;
      const hist = this.history.get(h.id) || null;
      row.first_damage_frame = cur ? cur.damageFrom : (hist ? hist.fired_at : null);
      row.damage_dealt = cur ? +cur.dealt.toFixed(2) : 0;   // this entry, unchanged
      row.damage_total = hist ? hist.damage_dealt : 0;      // every entry, survives disarming
      // Has this hazard ever gone off on this body, not "is its volume armed right now".
      row.fired = !!(hist || (cur && cur.fired));
      row.armed = !!(cur && cur.fired);
      row.spent = this.spent.has(h.id);
      row.fired_at_frame = hist ? hist.fired_at : null;
      row.fires = hist ? hist.fires : 0;
      row.outcome = hist ? hist.outcome : null;
      row.sheltered = !!(SHELTER[h.id] && SHELTER[h.id](ctx, this.sig, this.field));
      row.declared = h.damage;
      row.suppressed_by = suppressed;
      report.push(row);
    }
    this.lastReport = report;
    return report;
  }

  /**
   * H9's write, and it must land on the AUTHORITY, not on the view.
   *
   * ------------------------------------------------------------------------------------------
   * THE BUG THIS EXISTS TO FIX (W1-SOULS round-1 verdict HF-2, measured)
   * ------------------------------------------------------------------------------------------
   *
   * H9 used to do `ent.hp = Math.max(0, ent.hp - d)` on the `sim.entities` record. That record
   * is a MIRROR. `sim/combat-bridge.js mirror()` runs at the end of `stepCombat` and does
   * `e.hp = Math.max(0, eb.hp)` for every entity that has a combat body, so a hazard's write to
   * `ent.hp` is overwritten from the untouched combat body on the very next step. The verdict
   * wrote 412 -> 0 on an entity, stepped 31 frames, and read hp back at **412** with the combat
   * body still at 412 and zero souls awarded: the body never died, the death path never fired,
   * and the corpse "resurrected".
   *
   * It was never confined to souls. Anything downstream of a death — the death loop, respawn,
   * aggro, quest kill counters — reads the authority or reads the mirror the frame after it is
   * refreshed, so an NPC could not be killed by the province at all. All nineteen shipped
   * hazards declare `applies_to_npcs: true` and `voriplasm` is class KILL / `fatal`.
   *
   * The player branch above already got this right (line ~310: it damages `combatBody` and
   * copies down to `p.hp`, and sets `combatBody.state = 'DEATH'`). This is the same rule applied
   * to the other side of H9's "hazards hurt everyone, no player term".
   *
   * Falls back to the entity record when there is no combat body — an entity with no body is
   * not mirrored, so the write survives, and that is the only case where writing the view is
   * writing the authority.
   */
  _hurtEntity(sim, bus, combat, ent, d, h, f) {
    const b = combat && combat.bodyOf ? combat.bodyOf(ent.eid) : null;
    if (!b) { ent.hp = Math.max(0, ent.hp - d); return; }
    if (b.dead || b.hp <= 0) return;
    b.hp = Math.max(0, b.hp - d);
    // Keep the view consistent within this frame too; `mirror()` will re-assert it next step.
    ent.hp = b.hp;
    if (b.hp <= 0) {
      // The same three fields every other death path in the build ends on.
      b.dead = true; b.state = 'DEAD'; b.move = null; b.hitboxActive = false;
      ent.state = 'DEAD';
      if (bus) {
        const e = bus.emit(f, 'hazard_fired');
        e.hazard = h.id; e.outcome = 'death'; e.eid = ent.eid; e.archetype = ent.id;
      }
    }
  }

  /** Every magnitude comes off `hazards.json`. There is no other source and no level term (H6). */
  _damageThisFrame(h, p) {
    const d = h.damage;
    if (!d || d.kind === 'none') return 0;
    if (d.kind === 'fatal') return p.hpMax * 10;
    if (d.kind === 'pct_max_hp') return p.hpMax * (d.value / 100);
    if (d.kind === 'pct_max_hp_per_s') return p.hpMax * (d.value / 100) / 60;
    return 0;
  }

  /**
   * The declared-vs-observed pair for RI-WLD11, and the arithmetic for H4 and H8 so a critic does
   * not have to recompute them: at the declared rate, how long does each ATTRITION hazard take to
   * kill a full-HP player, and is there exactly one KILL?
   */
  report(sim) {
    const kills = this.doc.hazards.filter((h) => h.class === 'KILL');
    return {
      declared_file: 'game/data/world/hazards.json',
      hazards: this.doc.hazards.length,
      one_kill_hazard: kills.length === 1 && kills[0].id === 'voriplasm',
      attrition_time_to_death_s: this.doc.hazards.filter((h) => h.class === 'ATTRITION')
        .map((h) => ({ id: h.id, pct_per_s: h.damage.value, seconds: +(100 / h.damage.value).toFixed(1), h4_pass: 100 / h.damage.value >= 80 })),
      volumes: Object.keys(ANCHOR).length + Object.keys(CONDITION).length,
      anchored_on_signature_geometry: Object.entries(ANCHOR).map(([id, a]) => ({ hazard: id, anchor: a.kind, radius_m: a.r })),
      here: this.lastReport,
      active: [...this.active.keys()],
      region: sim ? this.field.regionAt(sim.player.pos[0], sim.player.pos[2]).id : null,
    };
  }
}

function f_regionOf(field, ent) { return field.regionAt(ent.pos[0], ent.pos[2]).id; }
