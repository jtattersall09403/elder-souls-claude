// The crime world state — RI-CRM01 §1 §2 §3 §8 §9.
//
// THE STRUCTURAL DECISION THIS FILE ENFORCES: *"A crime does not create a bounty. A REPORT
// does."* RI-CRM01's own How-we-lose names the alternative and predicts it will ship:
// *"`bounty += 25` inside the take-verb is four characters of work and it deletes the report
// chain, the fleeing witness, the bribe, the talk-down, the S10 decision, the partial report and
// the identification split."* There is therefore no method on this object that adds bounty
// directly from a crime. `commit()` creates a CRIME and its WITNESSES; only `land()` — called
// when a report arrives — moves gold.
//
// And bounty is WORLD state (seam S6). It survives death, it survives the corpse run, it
// survives the save. `toJSON()`/`fromJSON()` are the whole contract and the piece's persistence
// assertion is a round trip through them.
'use strict';

export class CrimeWorld {
  constructor(bountyData, justiceData) {
    this.bd = bountyData;
    this.jd = justiceData;
    this.bounty = { imperial: 0, settlement: {}, interior: 0 };
    /**
     * W1-15 ROUND 4 — 'PERSON OR PERSONS UNKNOWN', AS A LEDGER AND NOT AS A PROSE STRING.
     *
     * `justice.json`'s own `unidentified_effect` promised three things and implemented none:
     *
     * > *"bounty lands as 'person or persons unknown'; **guards do not approach you for it**, but
     * > it counts toward the settlement's alarm state and toward RI-STL01 §7's S-4 zone memory."*
     *
     * The round-3 critic classified all 16 occurrences of `identified` in `game/src` and found
     * **exactly one that changes a decision** — the 0.4x `partial_report.multiplier` on the line
     * below — and put it plainly: *"Being **suspected** and being **wanted** are the same state,
     * held at different magnitudes. ... the file promises kind."*
     *
     * These two registers are the kind. `unattributed` is the part of the ledger nobody can pin on
     * you; `attributedIn()` is total minus that, and it is what `guardBandNow()` now reads, so a
     * guard genuinely cannot approach you for a crime nobody could name you for. `alarm` is the
     * settlement's own memory of unattributed crime — the second promise — and the third
     * (`ZoneMemory`) is raised from `StealthCrime.stepReports()`, which is the only place that
     * knows which zone the report happened in.
     *
     * The TOTAL is deliberately unchanged: paying a bounty, a writ, a jail sentence and every
     * existing assertion about `bounty.imperial` all still see the same number they saw before.
     * What moved is who the world thinks did it.
     */
    this.unattributed = { imperial: 0, settlement: {} };
    /** settlement -> {level, until_f, reports}. Raised by unattributed reports, decays on a clock. */
    this.alarm = {};
    this.bloodprice = {};                 // family -> gold
    this.crimes = [];                     // {crime_id, id, frame, jurisdiction, value_g, victim, lawful}
    this.witnesses = [];                  // {eid, crime_id, frame_seen, identified, reported, kind}
    this.deathFlags = {};                 // settlement -> count
    this.deaths = [];                     // {eid, named, settlement, frame, discovered}
    this.favoursOwed = [];
    this.writs = [];
    this.hunters = [];
    this.jail = null;
    this.nextCrimeId = 1;
    this.log = [];                        // trace events, drained each frame
    /**
     * THE STOLEN REGISTRY — RI-STL02 §2 and its method 2.
     *
     * Round 1 set `stolen_from` on the world's own object record and nowhere else:
     * `saveState().crime.stolen_registry` read `[]` after three thefts, the objects never
     * entered the inventory, and fencing — the only thing in the design that CLEARS
     * `stolen_from` — was reachable only by handing `fenceQuote()` an item a critic had built.
     * Ownership was declared on 1,878 objects and enforced on none of them.
     *
     * Rows: {instance, item_id, name, owner, owner_scope, value_g, unique, settlement, frame,
     *        laundered_by}. `laundered_by` is set by the fence and is what makes a laundered
     *        item sellable to an honest merchant afterwards.
     */
    this.stolenRegistry = [];
  }

  /** Take an owned thing into the world's memory. Idempotent per instance. */
  registerStolen(row) {
    if (this.stolenRegistry.some((s) => s.instance === row.instance)) return null;
    const r = { laundered_by: null, ...row };
    this.stolenRegistry.push(r);
    this.log.push({ type: 'stolen_registered', instance: r.instance, owner: r.owner, value_g: r.value_g, frame: r.frame });
    return r;
  }

  /** The fence clears `stolen_from`. RI-STL02 §6: this is the only path that does. */
  launder(instance, by, frame) {
    const r = this.stolenRegistry.find((s) => s.instance === instance);
    if (!r) return null;
    r.laundered_by = by;
    r.laundered_at_f = frame;
    this.log.push({ type: 'laundered', instance, by, frame });
    return r;
  }

  /** Confiscation — the jail ledger's "stolen goods gone" clause (RI-CRM01 §6). */
  confiscateStolen(frame) {
    const n = this.stolenRegistry.length;
    const taken = this.stolenRegistry.map((s) => s.instance);
    this.stolenRegistry.length = 0;
    if (n) this.log.push({ type: 'confiscated', instances: taken, frame });
    return taken;
  }

  // ---- crimes and witnesses ----------------------------------------------------------------

  schedule(crimeKey) {
    const c = this.bd.crimes.find((x) => x.id === crimeKey);
    if (!c) throw new Error(`unknown crime ${JSON.stringify(crimeKey)}; the schedule has ${this.bd.crimes.length} entries`);
    return c;
  }

  /** The gold a crime WOULD produce if reported in full. Never applied here. */
  quote(crimeKey, { value_g = 0, cargo_g = 0, jurisdiction = 'imperial' } = {}) {
    const c = this.schedule(crimeKey);
    let g = c.bounty;
    if (c.value_term) g += c.value_term * value_g;
    if (c.cargo_term) g += c.cargo_term * cargo_g;
    const j = this.bd.jurisdictions.find((x) => x.id === jurisdiction);
    if (!j) throw new Error(`unknown jurisdiction ${JSON.stringify(jurisdiction)}`);
    return Math.round(g * j.multiplier);
  }

  /**
   * Register a crime. Creates the record and returns it. NO GOLD MOVES HERE — that is the
   * whole point of the module.
   */
  commit(crimeKey, opts = {}) {
    const c = this.schedule(crimeKey);
    const rec = {
      id: this.nextCrimeId++,
      crime_id: crimeKey,
      n: c.n,
      frame: opts.frame ?? 0,
      jurisdiction: opts.jurisdiction || 'imperial',
      settlement: opts.settlement || null,
      value_g: opts.value_g || 0,
      cargo_g: opts.cargo_g || 0,
      victim: opts.victim || null,
      family: opts.family || null,
      lawful: !!opts.lawful,
      lawful_by: opts.lawful_by || null,
      quote: 0,
      landed: false,
      suppressed: false,
    };
    rec.quote = this.quote(crimeKey, rec);
    this.crimes.push(rec);
    this.log.push({ type: 'crime', crime: crimeKey, crime_ref: rec.id, frame: rec.frame, jurisdiction: rec.jurisdiction, quote_g: rec.quote, lawful: rec.lawful });
    // The interior has no bounty at all — it has blood-price (RI-CRM01 §8).
    if (rec.jurisdiction === 'interior' && opts.bloodprice !== false) this.accrueBloodprice(rec, opts);
    return rec;
  }

  /** A witness record. `identified` is V >= 0.30 at the crime frame. */
  witness(crimeRef, { eid, frame, identified, kind = 'sight' }) {
    const w = { eid, crime_id: crimeRef, frame_seen: frame, identified: !!identified, reported: false, kind, fled_at: null };
    this.witnesses.push(w);
    this.log.push({ type: 'witness', eid, crime_ref: crimeRef, frame, identified: w.identified, kind });
    return w;
  }

  witnessesFor(crimeRef) { return this.witnesses.filter((w) => w.crime_id === crimeRef); }
  crimeById(ref) { return this.crimes.find((c) => c.id === ref); }

  /**
   * A report LANDS. This is the only path by which bounty exists.
   * `kind ∈ unlawful | lawful | intercepted | partial`.
   */
  land(witnessRec, frame, kind = 'unlawful') {
    if (witnessRec.reported) return null;
    const crime = this.crimeById(witnessRec.crime_id);
    if (!crime) throw new Error(`report for crime ${witnessRec.crime_id}, which does not exist`);
    witnessRec.reported = true;

    if (kind === 'lawful' || kind === 'intercepted') {
      crime.landed = true;
      this.log.push({ type: 'report', kind, crime_ref: crime.id, eid: witnessRec.eid, frame, bounty_delta: 0 });
      if (kind === 'intercepted') this.favoursOwed.push({ crime_ref: crime.id, frame, faction: 'wet-ledger', called_in: false });
      return { kind, delta: 0 };
    }

    const partial = !witnessRec.identified || witnessRec.kind === 'hearing';
    const mult = partial ? this.bd.partial_report.multiplier : 1.0;
    const delta = Math.round(crime.quote * mult);
    // W1-15 r4. The `attributed: null` this log line has always written is now a fact about the
    // ledger and not a decoration: an unattributed report's gold goes into `unattributed` as well
    // as into the total, and `guardBandNow()` subtracts it. Before this, the log said "person or
    // persons unknown" and the guard band could not tell.
    this.addBounty(crime.jurisdiction, delta, crime.settlement, { attributed: !partial });
    crime.landed = true;
    const k = partial ? 'partial' : 'unlawful';
    this.log.push({ type: 'report', kind: k, crime_ref: crime.id, eid: witnessRec.eid, frame, bounty_delta: delta, attributed: partial ? null : 'player' });
    this.log.push({ type: 'bounty_change', jurisdiction: crime.jurisdiction, delta, total: this.bountyIn(crime.jurisdiction, crime.settlement), frame, attributed: !partial });
    return { kind: k, delta, attributed: !partial, settlement: crime.settlement, jurisdiction: crime.jurisdiction, crime_ref: crime.id };
  }

  /**
   * S10. Killing a witness before their report lands SUPPRESSES the crime they carried.
   * RI-CRM01 §3c is explicit that this works, completely, with zero bounty when unobserved,
   * and that the cost is a person the world cannot replace.
   */
  killWitness(witnessRec, frame, { observed, victimNamed, victimIsOfficial, settlement }) {
    if (witnessRec.reported) return { suppressed: false, reason: 'the report had already landed' };
    const crime = this.crimeById(witnessRec.crime_id);
    witnessRec.reported = true;
    witnessRec.killed = true;
    crime.suppressed = true;

    const out = { suppressed: true, suppressed_g: crime.quote, murder_bounty: 0, doubled_g: 0 };
    const murderKey = victimIsOfficial ? 'murder_official' : victimNamed ? 'murder_named' : 'murder_unnamed';

    if (observed) {
      // Crime #12: the murder itself, PLUS the suppressed bounty at x2.
      const m = this.commit('murder_witness', { frame, jurisdiction: crime.jurisdiction, settlement, victim: witnessRec.eid });
      const doubled = crime.quote * this.schedule('murder_witness').suppressed_multiplier;
      this.addBounty(crime.jurisdiction, m.quote + doubled, settlement);
      m.landed = true;
      out.murder_bounty = m.quote;
      out.doubled_g = doubled;
      this.log.push({ type: 'bounty_change', jurisdiction: crime.jurisdiction, delta: m.quote + doubled, total: this.bountyIn(crime.jurisdiction, settlement), frame, reason: 's10_witnessed_witness_murder' });
    } else {
      // Unobserved: nothing. The corpse is still evidence and the death flag is still permanent.
      this.log.push({ type: 'crime', crime: murderKey, frame, jurisdiction: crime.jurisdiction, quote_g: 0, note: 's10: unobserved witness-murder suppresses the original crime and generates no bounty' });
    }
    this.recordDeath({ eid: witnessRec.eid, named: victimNamed, settlement, frame });
    return out;
  }

  // ---- bounty ---------------------------------------------------------------------------------

  addBounty(jurisdiction, delta, settlement, opts) {
    if (jurisdiction === 'interior') return 0;      // the interior has no bounty, by ruling
    // W1-15 r4. `attributed !== false` keeps every existing caller exactly as it was: a bounty
    // added without saying otherwise is a bounty with your name on it.
    const unattributed = opts && opts.attributed === false;
    if (jurisdiction === 'settlement') {
      const key = settlement || 'unknown';
      this.bounty.settlement[key] = (this.bounty.settlement[key] || 0) + delta;
      if (unattributed) this.unattributed.settlement[key] = (this.unattributed.settlement[key] || 0) + delta;
      return this.bounty.settlement[key];
    }
    this.bounty.imperial += delta;
    if (unattributed) this.unattributed.imperial += delta;
    return this.bounty.imperial;
  }

  /** The part of the ledger a guard can act on: total, less what nobody could name you for. */
  attributedIn(jurisdiction, settlement) {
    if (jurisdiction === 'settlement') {
      const key = settlement || 'unknown';
      return Math.max(0, (this.bounty.settlement[key] || 0) - (this.unattributed.settlement[key] || 0));
    }
    if (jurisdiction === 'interior') return 0;
    return Math.max(0, this.bounty.imperial - this.unattributed.imperial);
  }

  unattributedIn(jurisdiction, settlement) {
    if (jurisdiction === 'settlement') return this.unattributed.settlement[settlement || 'unknown'] || 0;
    if (jurisdiction === 'interior') return 0;
    return this.unattributed.imperial;
  }

  /**
   * The settlement's alarm state — the second of `unidentified_effect`'s three promises.
   *
   * A town that keeps losing things to a thief nobody can describe gets JUMPY, and that is the
   * consequence of an unattributed report that is not a smaller number on your head. It is read by
   * `StealthCrime.stepCivilians()` as a multiplier on every civilian's contextWeight in that
   * settlement, so the town watches you harder without being able to arrest you.
   */
  raiseAlarm(settlement, frame, delta, holdFrames) {
    const key = settlement || 'unknown';
    const a = this.alarm[key] || (this.alarm[key] = { level: 0, until_f: -1, reports: 0 });
    if (frame >= a.until_f) a.level = 0;             // it had decayed; start again
    a.level = Math.min(100, a.level + delta);
    a.until_f = frame + holdFrames;
    a.reports++;
    this.log.push({ type: 'settlement_alarm', settlement: key, level: a.level, until_f: a.until_f, frame });
    return a;
  }

  alarmIn(settlement, frame) {
    const a = this.alarm[settlement || 'unknown'];
    if (!a || frame >= a.until_f) return 0;
    return a.level;
  }

  bountyIn(jurisdiction, settlement) {
    if (jurisdiction === 'settlement') return this.bounty.settlement[settlement || 'unknown'] || 0;
    if (jurisdiction === 'interior') return 0;
    return this.bounty.imperial;
  }

  setBounty(jurisdiction, n, settlement) {
    if (jurisdiction === 'settlement') this.bounty.settlement[settlement || 'unknown'] = n;
    else if (jurisdiction === 'imperial') this.bounty.imperial = n;
    else throw new Error('setBounty: the interior jurisdiction has no bounty (RI-CRM01 §1) — it has blood-price');
    return n;
  }

  // ---- blood-price ------------------------------------------------------------------------------

  accrueBloodprice(crimeRec, opts) {
    const bp = this.bd.blood_price;
    const family = opts.family || crimeRec.family;
    if (!family) return 0;
    // The Imperial schedule x1.4, computed from the UNMULTIPLIED schedule value, because the
    // interior jurisdiction multiplier is 0 and would zero it.
    const c = this.schedule(crimeRec.crime_id);
    let g = c.bounty + (c.value_term ? c.value_term * crimeRec.value_g : 0);
    g = Math.round(g * bp.multiplier_on_imperial_schedule);
    this.bloodprice[family] = (this.bloodprice[family] || 0) + g;
    this.log.push({ type: 'bloodprice', family, delta: g, total: this.bloodprice[family], frame: crimeRec.frame });
    return g;
  }

  clearBloodprice(family, by) {
    const had = this.bloodprice[family] || 0;
    delete this.bloodprice[family];
    this.log.push({ type: 'bloodprice', family, delta: -had, total: 0, cleared_by: by });
    return had;
  }

  // ---- corpses ----------------------------------------------------------------------------------

  recordDeath({ eid, named, settlement, frame }) {
    this.deaths.push({ eid, named: !!named, settlement: settlement || null, frame, discovered: false, dragged_to: null });
    if (settlement) this.deathFlags[settlement] = (this.deathFlags[settlement] || 0) + 1;
    this.log.push({ type: 'death_flag', eid, settlement: settlement || null, named: !!named, count: settlement ? this.deathFlags[settlement] : null, frame });
    return this.deaths[this.deaths.length - 1];
  }

  discoverCorpse(eid, frame, { finderSawYou = false } = {}) {
    const d = this.deaths.find((x) => x.eid === eid);
    if (!d || d.discovered) return null;
    d.discovered = true;
    this.log.push({ type: 'corpse_found', eid, settlement: d.settlement, frame });
    if (d.named) {
      const g = this.jd.corpse_evidence.unknown_bounty_named_victim;
      this.addBounty('imperial', g, d.settlement);
      this.log.push({ type: 'bounty_change', jurisdiction: 'imperial', delta: g, total: this.bounty.imperial, frame, attributed: null, reason: 'corpse_found' });
      return { bounty: g, attributed: null, finder_saw_you: finderSawYou };
    }
    return { bounty: 0, attributed: null };
  }

  deathCount(settlement) { return this.deathFlags[settlement] || 0; }

  // ---- persistence (seam S6) ------------------------------------------------------------------

  toJSON() {
    return {
      bounty: { imperial: this.bounty.imperial, settlement: { ...this.bounty.settlement }, interior: 0 },
      // W1-15 r4. Seam S6: attribution is world state. A save that carried the total but not the
      // split would launder every unidentified crime on load, which is exactly the shape of defect
      // RULES.md 7 exists for — so it goes through the round trip with everything else.
      unattributed: { imperial: this.unattributed.imperial, settlement: { ...this.unattributed.settlement } },
      alarm: JSON.parse(JSON.stringify(this.alarm)),
      bloodprice: { ...this.bloodprice },
      crimes: this.crimes.map((c) => ({ ...c })),
      witnesses: this.witnesses.map((w) => ({ ...w })),
      death_flags: { ...this.deathFlags },
      deaths: this.deaths.map((d) => ({ ...d })),
      favours_owed: this.favoursOwed.map((f) => ({ ...f })),
      writs: this.writs.map((w) => ({ ...w })),
      hunters: this.hunters.map((h) => ({ ...h })),
      jail: this.jail ? { ...this.jail } : null,
      next_crime_id: this.nextCrimeId,
      stolen_registry: this.stolenRegistry.map((s) => ({ ...s })),
    };
  }

  fromJSON(o) {
    if (!o) return this;
    this.bounty.imperial = o.bounty.imperial;
    this.bounty.settlement = { ...o.bounty.settlement };
    this.unattributed.imperial = (o.unattributed && o.unattributed.imperial) || 0;
    this.unattributed.settlement = { ...((o.unattributed && o.unattributed.settlement) || {}) };
    this.alarm = JSON.parse(JSON.stringify(o.alarm || {}));
    this.bloodprice = { ...o.bloodprice };
    this.crimes = (o.crimes || []).map((c) => ({ ...c }));
    this.witnesses = (o.witnesses || []).map((w) => ({ ...w }));
    this.deathFlags = { ...(o.death_flags || {}) };
    this.deaths = (o.deaths || []).map((d) => ({ ...d }));
    this.favoursOwed = (o.favours_owed || []).map((f) => ({ ...f }));
    this.writs = (o.writs || []).map((w) => ({ ...w }));
    this.hunters = (o.hunters || []).map((h) => ({ ...h }));
    this.jail = o.jail ? { ...o.jail } : null;
    this.nextCrimeId = o.next_crime_id;
    this.stolenRegistry = (o.stolen_registry || []).map((s) => ({ ...s }));
    return this;
  }

  /**
   * Seam S6, RI-CRM01 §9. Death touches almost nothing here, and that is the point:
   * *"A game in which dying launders your crimes is a game in which nothing you do in a town
   * is real."* The one thing it clears is guard AGGRO, which is not stored here.
   */
  onPlayerDeath(frame, { killedByGuardDuringArrest }) {
    this.log.push({ type: 'death', frame, bounty_cleared: false, bloodprice_cleared: false });
    if (killedByGuardDuringArrest) return { wake: 'jail', sentence_begins: true };
    return { wake: 'hearth', sentence_begins: false };
  }

  drain() { const l = this.log; this.log = []; return l; }
}
