// What the player has seen of the province, and where the player has stood.
//
// Owner: W1-MAP. Binding: `ARBITRATION.md` seam S35, and
// `corpus/00-doctrine/AMENDMENT-W1-MAP-01.md` which S35 required be filed before this existed.
//
// ---------------------------------------------------------------------------------------------
// THE ONE PROPERTY THIS FILE EXISTS TO HOLD, AND IT IS A PROPERTY OF THE SIGNATURES.
//
// S35 permits a map and forbids, as a hard fail, "any icon a quest can place, request or
// highlight". The amendment turns that into a check with teeth: **every mutating method on this
// object has arity 0.** Not "no quest currently calls one" — there is no parameter in which a
// caller could name a place.
//
//   observe()            length 0   the only mutator. Reads the body off the captured SIM.
//   suspend() / resume() length 0   the interior gate; they take no place either.
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
  #cols; #rows; #cell;
  #bits;                 // Uint8Array bitset, one bit per terrain cell
  #revealed = 0;         // popcount, maintained incrementally
  #placeSet;             // Set<string> of place ids the body has stood in
  #placeOrder;           // ids in discovery order — the map draws them in the order you found them
  #sim; #field;
  #sites;                // [{id, x, z, r2}] — the standing test, from world data
  #minR; #maxR;
  #lastCol = -1; #lastRow = -1;   // only re-paint when the body changes cell
  #suspended = false;
  #observations = 0;     // how many times the raster was actually re-painted

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
    if (this.#suspended || this.#env.interior) return;
    const p = this.#player;
    if (!p || !p.pos) return;
    const x = p.pos[0], z = p.pos[2];

    // Places first: standing inside a site's own pad is what discovers it. Cheap — 42 squared
    // distances, no allocation, no sqrt.
    for (let i = 0; i < this.#sites.length; i++) {
      const s = this.#sites[i];
      if (this.#placeSet.has(s.id)) continue;
      const dx = x - s.x, dz = z - s.z;
      if (dx * dx + dz * dz <= s.r2) { this.#placeSet.add(s.id); this.#placeOrder.push(s.id); }
    }

    // Terrain: only when the body has crossed into a new cell. A player standing still repaints
    // nothing, so the cost of this method at 60 Hz is the 42 distances above.
    const col = clamp(Math.floor(x / this.#cell), 0, this.#cols - 1);
    const row = clamp(Math.floor(z / this.#cell), 0, this.#rows - 1);
    if (col === this.#lastCol && row === this.#lastRow) return;
    this.#lastCol = col; this.#lastRow = row;
    this.#observations++;

    // The region's own sightline, clamped. `regions.json` decides how much of itself it shows.
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

  /** A copy of the raster, for the screen and for the save. */
  raster() { return this.#bits.slice(); }

  /** Where a place sits, for the screen. Refuses to answer for a place you have not stood in. */
  placePos(id) {
    if (!this.#placeSet.has(String(id))) return null;
    const s = this.#sites.find((q) => q.id === id);
    return s ? [s.x, s.z] : null;
  }

  // ---- the save ----------------------------------------------------------------------------

  serialise() {
    return { cells: b64(this.#bits), places: this.#placeOrder.slice(), revealed: this.#revealed };
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
   * 2. **It validates.** A place is accepted only if the raster in the same blob shows its own
   *    cell revealed — which is an invariant `observe()` cannot break, because standing in a
   *    place necessarily reveals the cell you are standing in. So a save that names a place the
   *    raster does not corroborate is a forged save, and the forged half is dropped rather than
   *    loaded. It returns what it dropped, so the audit can see it happen instead of being told.
   *
   * @returns {{dropped: string[]}}
   */
  restore(blob) {
    this.#bits.fill(0);
    this.#revealed = 0;
    this.#placeSet.clear();
    this.#placeOrder.length = 0;
    this.#lastCol = -1; this.#lastRow = -1;
    if (!blob) return { dropped: [] };
    const raw = unb64(blob.cells || '');
    const n = Math.min(raw.length, this.#bits.length);
    for (let i = 0; i < n; i++) this.#bits[i] = raw[i];
    for (let i = 0; i < this.#cols * this.#rows; i++) {
      if ((this.#bits[i >> 3] >> (i & 7)) & 1) this.#revealed++;
    }
    const dropped = [];
    for (const id of blob.places || []) {
      const s = this.#sites.find((q) => q.id === id);
      if (!s || !this.seenAt(s.x, s.z)) { dropped.push(String(id)); continue; }
      if (this.#placeSet.has(id)) continue;
      this.#placeSet.add(id); this.#placeOrder.push(id);
    }
    return { dropped };
  }
}

/**
 * The step hook. A free function rather than a method so that `sim/step.js` reads the same as
 * every other line in it, and so that the thing installed on the sim is `discovery`, whose whole
 * public surface is described in this file's header.
 */
export function stepDiscovery(sim) {
  if (sim.discovery) sim.discovery.observe();
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
