// What the player has seen of the province, and where the player has stood.
//
// Owner: W1-MAP. Binding: `ARBITRATION.md` seam S35, and
// `corpus/00-doctrine/AMENDMENT-W1-MAP-01.md` which S35 required be filed before this existed.
//
// ---------------------------------------------------------------------------------------------
// THE ONE PROPERTY THIS FILE EXISTS TO HOLD, AND IT IS A PROPERTY OF THE SIGNATURES.
//
// S35 permits a map and forbids, as a hard fail, "any icon a quest can place, request or
// highlight". The amendment turns that into a check with teeth: **there is no parameter in which
// a caller could name a place.**
//
//   observe()            length 0   the only play-time mutator. Reads the body off the captured SIM.
//   suspend() / resume() length 0   the interior gate; they take no place either.
//   restore(blob)        length 1   THE SAVE PATH. See "THE SAVE CARRIES A FOOTPRINT" below.
//
// ---------------------------------------------------------------------------------------------
// THE SAVE CARRIES A FOOTPRINT AND NOTHING ELSE — W1-21 round 2, and it is the AR-2 fix.
//
// The W1-21 round-1 verdict got a marker onto this map. Not through a quest hook and not through
// any of the routes `tryPlaceMapMarker` tries — all of those are genuinely closed — but through
// the save file, because `restore()` used to take the place list from the blob and corroborate it
// against **the raster in the same blob**. Forge one field and the check works; forge both and
// the corroboration is a fixed-point test on its own input. The critic forged both, and the map
// drew 42 squares, 35 of them for places the body had never stood in, over a fully rendered
// province, while the screen's own compliance report read `places_drawn == places_discovered`
// and went green — because both of those numbers came from the same forged model.
//
// The fix is not a better check. It is the removal of the field:
//
//   * The save carries **`stood`** — a bitset of the terrain cells the body actually occupied.
//     Nothing else in the blob is read. `Discovery.RESTORE_READS` is the list, `restore()` copies
//     the blob through it and touches the original object nowhere else, and the list is published
//     on the running instance (`restoreReads`) so a critic reads it off the object rather than
//     off this comment.
//   * The sightline raster and the discovered-place list are **re-derived** from that footprint
//     on load, by the same two private methods `observe()` uses during play. They are therefore
//     not fields that can disagree with each other: there is only one field.
//   * `cells`, `places` and `revealed` are still WRITTEN, and they are still READ — but they are
//     read as a CLAIM TO BE CHECKED, never as state to be trusted. `restore()` derives the truth
//     from `stood`, then reports every place the blob named that the footprint does not support
//     as `dropped`, and every raster cell the blob claimed that the footprint does not paint as
//     `phantom_cells`. A forged save is therefore not merely refused, it is itemised.
//
// What this closes, in the amendment's own words (§3a): "a square for a place the player has not
// stood in" — the place list is derived from the footprint, so a forged `places` array changes
// nothing; and "terrain rendered where the player has not been" — the raster is derived from the
// footprint too, so a forged all-ones `cells` renders nothing extra either. Both hard fails now
// fail closed against a blob whose every field is under the attacker's control, because the map
// is a pure function of ONE field and that field is the body's own history.
//
// The cost, paid deliberately and recorded rather than hidden: `observe()` now paints from the
// CENTRE of the cell the body occupies rather than from the body's exact position. That is what
// makes live play and load bit-identical — the raster is a pure function of the set of occupied
// cells, so replaying the footprint reproduces the raster exactly and a round trip is stable.
// The cell is 25 m and the smallest built pad is 26 m (terrain.json `sites[].r_flat`), so every
// place remains discoverable: the furthest any point can be from a cell centre is 17.7 m.
//
// `observe()` reads `sim.player`'s position and `sim.env.interior` and nothing else. A quest
// holding `this.sim` can reach `sim.discovery` and call `observe()`; the effect is to reveal the
// ground the player is already standing on, which is already revealed. That is the whole attack
// surface and it is inert.
//
// IT CAPTURES THE SIM, NOT THE PLAYER, AND THAT DISTINCTION WAS A SHIPPED BUG.
// The first version captured `sim.player` and `sim.env` directly, which reads as the tighter
// choice and is in fact the broken one: `SimState.reset()` does `this.player = makePlayer()` and
// `this.env = makeEnvironment()`, so EVERY state load and every save load replaces both objects.
// A model holding the old ones observes a body that can never move again. Measured on the
// shipped build: after the first load the map froze at 255 revealed cells and ZERO discovered
// places for the rest of the run, no matter how far the player walked — the map recorded nothing
// and could not name a single place. `sim` itself is constructed once (`engine.js`) and only
// ever mutated by `reset()`, so capturing it is what survives. This is the same hazard
// `Engine._rebindQuestRuntime()` exists for; see the comment at its call site.
//
// None of this weakens the guarantee the amendment is about: `observe()` still takes ZERO
// arguments and there is still no parameter anywhere in which a caller could name a place.
//
// Everything else is a reader, and every reader returns a COPY:
//   seenCell / seenAt / hasPlace   booleans
//   places()                       a frozen array of ids, rebuilt per call
//   raster()                       a copy of the bitset
//
// There is no `discover(id)`, no `reveal(x, z)`, no `mark(...)`, no `setPlace(...)`. The state
// lives in `#private` class fields, so `sim.discovery.places.add('stormhold')` reads `undefined`
// and throws rather than working. The instance is frozen, so a caller cannot bolt a mutator on
// at runtime either. `tools/harness/map-probe.mjs` tries all of it and records each failure.
//
// The reason it is built this way rather than by convention is in the amendment's §3c: a map
// with a `revealLocation(id)` that nothing calls is not compliant, because the next quest author
// will find it, and the thing that catches them will be a code review rather than a number.
// ---------------------------------------------------------------------------------------------
//
// The numbers are all in `game/data/ui/map.json` and none of them was invented here: the reveal
// radius is the REGION'S OWN declared `sightline_m` (regions.json), clamped, and a place's
// "stood in" radius is that site's own built pad (`terrain.json sites[].r_flat`). Perturb either
// data file and the map changes — which is the CONSUMPTION evidence RI-MTH07 requires, and it is
// the same evidence as "the map is drawn from the province and cannot drift from it".
'use strict';

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export class Discovery {
  /**
   * The ONLY keys `restore()` reads out of a save blob. Published on the instance as
   * `restoreReads` so `getUIState()` and any critic can read it off the running object instead of
   * off a comment. `places` is deliberately not here: a place cannot be named into this model.
   */
  static RESTORE_READS = Object.freeze(['stood']);

  #cols; #rows; #cell;
  #bits;                 // Uint8Array bitset, one bit per terrain cell — DERIVED from #trail
  #stood;                // Uint8Array bitset — "have I already been here?", for O(1) de-dup
  #trail;                // cell indices, FIRST-VISIT ORDER. The footprint, and the whole save.
  #revealed = 0;         // popcount, maintained incrementally
  #placeSet;             // Set<string> of place ids the body has stood in
  #placeOrder;           // ids in discovery order — the map draws them in the order you found them
  #sim; #field;
  #sites;                // [{id, x, z, r2}] — the standing test, from world data
  #minR; #maxR;
  #lastCol = -1; #lastRow = -1;   // only re-paint when the body changes cell
  #suspended = false;
  #observations = 0;     // how many times the raster was actually re-painted
  #lastRestore = null;   // the last load's audit, kept on the object so no probe has to be told

  /**
   * @param {object} o
   * @param {import('../world/field.js').WorldField} o.field   the built province
   * @param {object} o.sim     the SimState. CAPTURED, not passed per call — see the header. It
   *   must be the sim itself and not `sim.player`/`sim.env`, because `reset()` replaces those
   *   two objects on every load and a captured copy of them goes dead.
   * @param {object} o.doc     game/data/ui/map.json
   * @param {object} o.pois    game/data/world/pois.json
   */
  constructor(o) {
    const f = o.field;
    this.#field = f;
    if (!o.sim || !('player' in o.sim)) {
      // Fail loudly at construction rather than quietly recording nothing for a whole run. The
      // bug this replaces was invisible precisely because the model went on answering.
      throw new Error('Discovery: `sim` is required (capture the SimState, not sim.player — ' +
        'SimState.reset() replaces player and env on every load)');
    }
    this.#sim = o.sim;
    this.#cols = f.cols; this.#rows = f.rows; this.#cell = f.cell;
    this.#bits = new Uint8Array(((this.#cols * this.#rows) + 7) >> 3);
    this.#stood = new Uint8Array(this.#bits.length);
    this.#trail = [];
    this.#placeSet = new Set();
    this.#placeOrder = [];

    const doc = o.doc || {};
    const rev = doc.reveal || {};
    this.#minR = Number(rev.min_m) || 0;
    this.#maxR = Number(rev.max_m) || 0;

    // The standing test, built from the world rather than authored here. `terrain.json sites`
    // carries each place's own flat pad; `pois.json` carries the eight waystations, which are
    // not pads and fall back to one terrain cell.
    const fallback = Number((doc.places || {}).fallback_radius_m) || 25;
    const byId = new Map();
    for (const s of f.sites || []) byId.set(s.id, s);
    this.#sites = [];
    for (const p of (o.pois && o.pois.pois) || []) {
      const s = byId.get(p.id);
      const r = s && s.r_flat ? s.r_flat : fallback;
      this.#sites.push({ id: p.id, x: s ? s.x : p.pos[0], z: s ? s.z : p.pos[2], r2: r * r });
    }

    // No mutator may be added after construction. This is the last line of the structural
    // argument: `sim.discovery.reveal = fn` throws in strict mode rather than installing one.
    Object.freeze(this);
  }

  // ---- the only mutator, and it has no parameters ------------------------------------------

  /**
   * Record where the body is. Called once per fixed step from `sim/step.js`.
   *
   * **Arity 0 by construction.** There is no coordinate form and no place-id form of this
   * method, which is what makes "a quest cannot place a marker" a fact about the code rather
   * than a promise about the authors.
   */
  observe() {
    // Read through the sim every time. `sim.player` and `sim.env` are REPLACED by
    // `SimState.reset()`, so these two lookups are the difference between a map that records
    // where you went and one that freezes on the frame the last save was loaded.
    const env = this.#sim.env;
    if (this.#suspended || (env && env.interior)) return;
    const p = this.#sim.player;
    if (!p || !p.pos) return;
    const x = p.pos[0], z = p.pos[2];
    // A non-finite position is not a place. Without this line `clamp(NaN, …)` returns NaN,
    // `NaN >> 3` is 0 and `1 << (NaN & 7)` is 1, so a body whose position has gone NaN silently
    // marks CELL ZERO as stood in — and because the footprint is now the save, that one corrupt
    // bit replays into a whole revealed disc in the top corner of the province on every load
    // thereafter. Found by this file's own round-trip check (`w1-21-r2-forge.mjs` R7) going red
    // on a fixture that divided by zero, which is the only reason it is here rather than in a
    // verdict later.
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;

    // Only when the body has crossed into a new cell. A player standing still repaints nothing,
    // so the cost of this method at 60 Hz is two divisions and a compare.
    const col = clamp(Math.floor(x / this.#cell), 0, this.#cols - 1);
    const row = clamp(Math.floor(z / this.#cell), 0, this.#rows - 1);
    if (col === this.#lastCol && row === this.#lastRow) return;
    this.#lastCol = col; this.#lastRow = row;
    this.#observations++;

    // W1-21 round 2. EVERYTHING BELOW THIS LINE IS A PURE FUNCTION OF (col, row), and that is
    // the whole AR-2 fix rather than an implementation detail: it is what lets the save carry the
    // footprint alone and lets `restore()` re-derive the raster and the place list by replaying
    // the same two methods. If either derivation ever starts reading the body's exact position
    // again, a save round trip stops being bit-stable and `w1-21-r2-forge.mjs` R4 goes red.
    if (!this.#occupy(col, row)) return;     // already been here; both derivations are idempotent
    this.#derivePlaces(col, row);
    this.#deriveReveal(col, row);
  }

  /**
   * Record that the body stood in this cell, ONCE. The one piece of state the save carries.
   *
   * First-visit order is kept because the map draws places "in the order you found them", and a
   * set cannot carry an order — a bitset footprint round-tripped a save into a map whose places
   * were listed in cell-index order instead of walk order, which `w1-21-r2-forge.mjs` R7 caught.
   * Recording only first visits is what bounds the trail at one entry per terrain cell however
   * long the session runs, and it is sound precisely because both derivations depend on nothing
   * but `(col, row)`.
   *
   * @returns {boolean} true if this is new ground
   */
  #occupy(col, row) {
    const i = row * this.#cols + col;
    const b = i >> 3, m = 1 << (i & 7);
    if (this.#stood[b] & m) return false;
    this.#stood[b] |= m;
    this.#trail.push(i);
    return true;
  }

  /**
   * Which places this cell stands in. The test is the site's OWN built pad (`r_flat`), measured
   * from the cell's centre — see the header for why the centre and not the body.
   */
  #derivePlaces(col, row) {
    const x = (col + 0.5) * this.#cell, z = (row + 0.5) * this.#cell;
    for (let i = 0; i < this.#sites.length; i++) {
      const s = this.#sites[i];
      if (this.#placeSet.has(s.id)) continue;
      const dx = x - s.x, dz = z - s.z;
      if (dx * dx + dz * dz <= s.r2) { this.#placeSet.add(s.id); this.#placeOrder.push(s.id); }
    }
  }

  /** The region's own sightline, clamped. `regions.json` decides how much of itself it shows. */
  #deriveReveal(col, row) {
    const x = (col + 0.5) * this.#cell, z = (row + 0.5) * this.#cell;
    const reg = this.#field.regionAt(x, z);
    const r = clamp(Number(reg && reg.sightline_m) || this.#minR, this.#minR, this.#maxR);
    const cr = Math.max(0, Math.floor(r / this.#cell));
    const r2 = r * r;
    const c0 = Math.max(0, col - cr), c1 = Math.min(this.#cols - 1, col + cr);
    const r0 = Math.max(0, row - cr), r1 = Math.min(this.#rows - 1, row + cr);
    for (let rz = r0; rz <= r1; rz++) {
      const dz = (rz + 0.5) * this.#cell - z;
      for (let cx = c0; cx <= c1; cx++) {
        const dx = (cx + 0.5) * this.#cell - x;
        if (dx * dx + dz * dz > r2) continue;
        this.#set(rz * this.#cols + cx);
      }
    }
    this.#set(row * this.#cols + col);      // the ground under your feet, whatever the radius
  }

  #set(i) {
    const b = i >> 3, m = 1 << (i & 7);
    if (this.#bits[b] & m) return;
    this.#bits[b] |= m;
    this.#revealed++;
  }

  /**
   * Stop and start recording. Also arity 0, for the same reason `observe()` is. Used by the
   * harness's ablation control and by nothing in the game — the interior gate is inside
   * `observe()` so that it cannot be left off by a caller that forgot to resume.
   */
  suspend() { this.#suspended = true; }
  resume() { this.#suspended = false; }
  get suspended() { return this.#suspended; }

  // ---- readers. Every one of them returns a copy or a primitive. ---------------------------

  get cols() { return this.#cols; }
  get rows() { return this.#rows; }
  get cell() { return this.#cell; }
  get revealedCells() { return this.#revealed; }
  get revealedFrac() { return this.#revealed / (this.#cols * this.#rows); }
  get observations() { return this.#observations; }

  seenCell(col, row) {
    if (col < 0 || row < 0 || col >= this.#cols || row >= this.#rows) return false;
    const i = row * this.#cols + col;
    return ((this.#bits[i >> 3] >> (i & 7)) & 1) === 1;
  }

  seenAt(x, z) {
    return this.seenCell(Math.floor(x / this.#cell), Math.floor(z / this.#cell));
  }

  /** Ids in the order they were discovered. A copy: the caller cannot push onto it. */
  places() { return Object.freeze(this.#placeOrder.slice()); }
  hasPlace(id) { return this.#placeSet.has(String(id)); }
  get placeCount() { return this.#placeSet.size; }

  /** A copy of the raster, for the screen. Derived; the save no longer trusts it. */
  raster() { return this.#bits.slice(); }

  /** A copy of the footprint — the cells the body occupied, in order. This is what the save is. */
  footprint() { return this.#trail.slice(); }

  /** How many cells the body has stood in. The denominator every other number here derives from. */
  get stoodCells() { return this.#trail.length; }

  /** Where a place sits, for the screen. Refuses to answer for a place you have not stood in. */
  placePos(id) {
    if (!this.#placeSet.has(String(id))) return null;
    const s = this.#sites.find((q) => q.id === id);
    return s ? [s.x, s.z] : null;
  }

  // ---- the save ----------------------------------------------------------------------------

  /**
   * `stood` is the state. `cells`, `places` and `revealed` are the model's own CLAIM about what
   * that footprint implies — written so a save is legible and so `restore()` has something to
   * check the footprint against, and read back on load as a claim rather than as state. See
   * `Discovery.RESTORE_READS`, which is the whole of what a blob can put into this object.
   */
  serialise() {
    return {
      stood: b64(zigzag(this.#trail)),
      cells: b64(this.#bits),
      places: this.#placeOrder.slice(),
      revealed: this.#revealed,
      derived_from: 'stood',
    };
  }

  /** The blob keys `restore()` reads, off the running object. Never a place list. */
  get restoreReads() { return Discovery.RESTORE_READS; }

  /**
   * Every state-writing method on this object, enumerated from the prototype rather than listed.
   *
   * The W1-21 round-1 verdict caught `getUIState().map.mutator_arities` reporting a hand-typed
   * literal of three names on an object that has four mutators, missing precisely the one that
   * broke the claim. A list can only report what whoever wrote it already thought of, so this
   * enumerates and classifies **fail-closed**: a member is a reader only if it is an accessor or
   * is on `READERS` below, and anything else — including a method added tomorrow by somebody who
   * never read this file — is reported as a state writer.
   */
  mutatorReport() {
    const READERS = new Set(['constructor', 'seenCell', 'seenAt', 'places', 'hasPlace', 'raster',
      'footprint', 'placePos', 'serialise', 'mutatorReport']);
    const proto = Object.getPrototypeOf(this);
    const out = [];
    let examined = 0;
    for (const name of Object.getOwnPropertyNames(proto)) {
      const d = Object.getOwnPropertyDescriptor(proto, name);
      if (!d) continue;
      examined++;
      if (typeof d.value === 'function') {
        if (READERS.has(name)) continue;
        out.push({ name, arity: d.value.length, member: 'method' });
        continue;
      }
      // ACCESSORS, classified by the same fail-closed rule as methods — W1-21 round 3.
      //
      // The line that used to sit here was `if (!d || typeof d.value !== 'function') continue;`
      // with the comment "getters are readers by construction". That is not true of JavaScript,
      // and the W1-21 round-2 critic broke it on purpose and wrote down exactly how:
      //
      //     Object.defineProperty(proto, '__criticGetter',
      //       { get() { this.restore({ stood: '' }); return 1; } });
      //
      // A plain PROPERTY READ — `d.__criticGetter`, which no reviewer would look at twice — wiped
      // the map from 2,446 revealed cells to 0, and `mutatorReport()` listed nothing at all.
      // Eleven of this object's twenty-five prototype members are accessors, so the sentence
      // AMENDMENT-W1-MAP-01 §3b asks a critic to verify — "enumerate the discovery model's own
      // mutating methods" — was being verified over 14 of 25 members, with the other 11 skipped
      // SILENTLY. That is round 1's finding one level down: not a list that forgot a member, but
      // a rule that excluded a category.
      //
      // The replacement rule, and it errs toward reporting a writer in every ambiguous case:
      //
      //   * a SETTER is always a state writer. There is no such thing as a read-only setter.
      //   * a GETTER is a reader only if its SOURCE is a single `return <expression>;` containing
      //     no assignment, no `++`/`--`, no `delete`, and no CALL of any kind. A getter that calls
      //     something can do whatever that something does, and this class cannot know what that
      //     is, so it is reported.
      //
      // Note what the getter rule does NOT consult: the `READERS` name list. A getter is judged on
      // what it is written to do, not on whether somebody remembered to name it — a second list
      // would be the same defect this method exists to remove, one type of member along. The
      // critic's `__criticGetter` is caught because it calls `restore()`, and it would still be
      // caught if it were called `cols`.
      //
      // The cost of the strict reading is that a future legitimate getter which delegates to a
      // helper will be reported as a writer until somebody looks at it. That is the direction a
      // fail-closed classifier is supposed to be wrong in.
      if (typeof d.set === 'function') {
        out.push({ name, arity: d.set.length, member: 'setter', why: 'a setter writes state by definition' });
        continue;
      }
      if (typeof d.get === 'function') {
        const verdict = Discovery.classifyGetter(d.get);
        if (verdict.reader) continue;
        out.push({ name, arity: 0, member: 'getter', why: verdict.why });
      }
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    // The sample count for the check this report exists to feed: how many prototype members were
    // looked at, and how many of each kind. `mutators: []` over 25 examined members and
    // `mutators: []` over 0 are different claims and used to print the same.
    Object.defineProperty(out, 'membersExamined', { value: examined, enumerable: false });
    return out;
  }

  /**
   * Is this getter a pure read? Public and static so a probe can exercise the RULE directly,
   * without having to install a getter on the live prototype first.
   */
  static classifyGetter(fn) {
    const src = String(fn);
    const body = /^\s*(?:get\s+)?[\w$]*\s*\(\s*\)\s*\{([\s\S]*)\}\s*$/.exec(src);
    if (!body) return { reader: false, why: 'source does not parse as a zero-argument accessor' };
    const inner = body[1].trim();
    const m = /^return\s+([\s\S]*?);?$/.exec(inner);
    if (!m) return { reader: false, why: 'body is not a single `return <expression>;`' };
    const expr = m[1];
    // A CALL, not a grouping paren: `(a * b)` is arithmetic, `f(x)` is a call. The difference is
    // what precedes the bracket. `get revealedFrac() { return this.#revealed / (this.#cols *
    // this.#rows); }` is a real reader and must not be reported as a writer.
    if (/[\w$\].]\s*\(/.test(expr)) return { reader: false, why: 'the returned expression calls something' };
    if (/;/.test(expr)) return { reader: false, why: 'body is not a single statement' };
    if (/\+\+|--|\bdelete\b|\bawait\b|\byield\b/.test(expr)) return { reader: false, why: 'the returned expression mutates' };
    // an assignment, but not ==, ===, !=, !==, <=, >=, =>
    if (/(^|[^=!<>+\-*/%&|^])=(?![=>])/.test(expr)) return { reader: false, why: 'the returned expression assigns' };
    return { reader: true, why: 'single return of a non-calling, non-assigning expression' };
  }

  /**
   * Read a save back INTO THE LIVE OBJECT.
   *
   * Two things about this method, both of which exist because of the protocol's own warning that
   * a field written and never read back re-serialises to exactly what was saved and passes
   * forever:
   *
   * 1. It is the reason `map-probe.mjs` audits `Engine.mapState()` after the load rather than
   *    diffing the blob. The blob test is a fixed-point test on the serialiser.
   *
   * 2. **It derives; it does not accept.** It used to accept a place if the raster in the SAME
   *    BLOB showed that place's cell revealed. That reads like corroboration and is not: an
   *    attacker who can write one field of the blob can write the other, and the W1-21 round-1
   *    critic forged both and put 35 phantom squares on the map. Nothing in a blob can corroborate
   *    anything else in the same blob.
   *
   *    So the place list and the sightline raster are no longer loaded at all. They are RECOMPUTED
   *    from the footprint by `#derivePlaces` / `#deriveReveal` — the same two methods `observe()`
   *    calls during play — and the blob's own `places` and `cells` are then compared against the
   *    result and reported. `dropped` is every place the save named that the body's footprint does
   *    not put it in; `phantom_cells` is every raster cell the save claimed that the footprint does
   *    not paint. A forged save is itemised rather than merely refused.
   *
   * 3. **It cannot name a place.** `Discovery.RESTORE_READS` is `['stood']`. The blob is copied
   *    through that list on the first line and the original object is never read again, so the
   *    parameter carries no channel by which a caller could put a named place on this map. That is
   *    AMENDMENT-W1-MAP-01 §3a's third hard fail ("any API by which a quest can place, request,
   *    highlight or name a position on the map") held structurally rather than by review.
   *
   * @returns {{dropped: string[], phantom_cells: number, missing_cells: number,
   *            claimed_places: number, derived_places: number, legacy: boolean}}
   */
  restore(blob) {
    this.#bits.fill(0);
    this.#stood.fill(0);
    this.#trail.length = 0;
    this.#revealed = 0;
    this.#placeSet.clear();
    this.#placeOrder.length = 0;
    this.#lastCol = -1; this.#lastRow = -1;
    const empty = {
      dropped: [], phantom_cells: 0, missing_cells: 0,
      claimed_places: 0, derived_places: 0, legacy: false,
    };
    if (!blob) { this.#lastRestore = empty; return empty; }

    // THE ONLY PATH FROM THE BLOB INTO THIS OBJECT. Everything below reads `read`, never `blob`.
    const read = {};
    for (const k of Discovery.RESTORE_READS) read[k] = blob[k];

    // REPLAY, in the order the body walked it, through the same two methods `observe()` calls.
    // `#occupy` de-dups and bounds-checks, so a trail carrying a repeat or a garbage index costs
    // nothing and reveals nothing.
    const total = this.#cols * this.#rows;
    for (const i of unzigzag(unb64(read.stood || ''))) {
      if (!(i >= 0 && i < total)) continue;
      const row = (i / this.#cols) | 0, col = i - row * this.#cols;
      if (!this.#occupy(col, row)) continue;
      this.#derivePlaces(col, row);
      this.#deriveReveal(col, row);
    }
    const occupied = this.#trail.length;

    // Now check the blob's CLAIMS against what its footprint actually implies. Nothing here
    // writes state; it exists so that a forged save is visible to the audit rather than silent.
    const dropped = [];
    for (const id of (blob && blob.places) || []) {
      if (!this.#placeSet.has(String(id))) dropped.push(String(id));
    }
    const claimed = unb64((blob && blob.cells) || '');
    let phantom = 0, missing = 0;
    for (let i = 0; i < total; i++) {
      const b = i >> 3, m = 1 << (i & 7);
      const c = b < claimed.length ? (claimed[b] & m) !== 0 : false;
      const d = (this.#bits[b] & m) !== 0;
      if (c && !d) phantom++;
      else if (d && !c) missing++;
    }
    return (this.#lastRestore = {
      dropped,
      phantom_cells: phantom,
      missing_cells: missing,
      claimed_places: (((blob && blob.places) || []).length),
      derived_places: this.#placeOrder.length,
      stood_cells: occupied,
      // A save written before W1-21 round 2 has no footprint. Its map comes back EMPTY rather
      // than trusted, and it says so: a legacy raster is exactly the field this fix stopped
      // believing, and quietly believing it for old saves would leave the hole open.
      legacy: occupied === 0 && !!((blob && blob.cells)),
    });
  }

  /** The last load's audit. Read off the object, so no probe has to be handed it. */
  get lastRestore() { return this.#lastRestore; }
}

/**
 * The step hook. A free function rather than a method so that `sim/step.js` reads the same as
 * every other line in it, and so that the thing installed on the sim is `discovery`, whose whole
 * public surface is described in this file's header.
 */
export function stepDiscovery(sim) {
  if (sim.discovery) sim.discovery.observe();
}

// ---- the footprint on the wire: zigzag varint deltas -----------------------------------------
//
// The trail is cell indices in walk order, and consecutive entries are almost always adjacent
// cells, so the deltas are tiny and usually signed (a walk that doubles back steps the index
// down). Zigzag folds the sign into the low bit and the varint then costs one byte for anything
// within ±63 — which is every ordinary step, and a step of one row is ±193. A 557-cell trail
// costs about 700 bytes against the 5,356-byte raster it replaces; the pathological case, a body
// that has stood in all 42,846 cells, costs about 60 KB, and that is a body that has walked the
// entire province. Bounded either way, because `#occupy` records first visits only.

function zigzag(indices) {
  const out = [];
  let prev = 0;
  for (const i of indices) {
    let v = i - prev; prev = i;
    v = v < 0 ? (-v * 2 - 1) : v * 2;              // zigzag
    while (v >= 0x80) { out.push((v & 0x7F) | 0x80); v = Math.floor(v / 128); }
    out.push(v);
  }
  return Uint8Array.from(out);
}

function unzigzag(bytes) {
  const out = [];
  let prev = 0, v = 0, shift = 1;
  for (let k = 0; k < bytes.length; k++) {
    const b = bytes[k];
    v += (b & 0x7F) * shift; shift *= 128;
    if (b & 0x80) continue;                        // a truncated final varint is simply dropped
    prev += (v & 1) ? -((v + 1) / 2) : v / 2;
    out.push(prev);
    v = 0; shift = 1;
  }
  return out;
}

// ---- base64 for a byte array, with no Node/browser split ------------------------------------

function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(bytes).toString('base64');
}

function unb64(str) {
  if (!str) return new Uint8Array(0);
  if (typeof atob === 'function') {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(str, 'base64'));
}
