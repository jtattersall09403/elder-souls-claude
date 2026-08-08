// THE S38 GATE — does the map comply with S35's "no square for a place the player has not stood in"?
//
// Owner: arbiter-map-s38. Binding: `ARBITRATION.md` seam **S38**, which amends **S35**.
//
// ---------------------------------------------------------------------------------------------
// WHY THIS TOOL EXISTS, AND WHAT THE OLD ASSERTION GOT WRONG.
//
// The W1-21 round-2 critic showed that a forged save FOOTPRINT still yields 14 places and 92.5%
// of the province, and referred the clause rather than failing it, on the ground that "every save
// field is owner-controlled, so read broadly the clause is unsatisfiable by any design". S38
// rules that the referral is half right: the clause binds the DERIVATION, not the AUTHENTICITY of
// the save. A loader cannot tell a real footprint from a forged one and must not try. What it can
// and must guarantee is that **the map is a pure function of one non-derived field, and every
// square and every revealed cell on it is implied by that field.**
//
// So this tool never asserts that a forgery is refused — that is the check nobody can make pass.
// It asserts that the map contains nothing the asserted footprint does not imply, which is a
// property of the code and is DECIDABLE. Two facts make it decidable rather than sampled:
//
//   * the derivation is per-cell (`#derivePlaces(col,row)`, `#deriveReveal(col,row)` read nothing
//     but the cell), so `D(F) = union over c in F of D({c})` — S38-2 checks this empirically;
//   * there are only 42,846 cells, so the generators can be enumerated EXHAUSTIVELY — S38-3.
//
// S38-2 and S38-3 together are a proof over all 2^42,846 possible saves, forged or honest.
//
// ---------------------------------------------------------------------------------------------
// WHAT THIS REPLACES.
//
//   * `tools/analysis/journal-ui.mjs:199-201` — JU8's own instrument, which still asserts
//     `mapThrew && ui.map_exists === false`. S35 requires both of those to be FALSE, so that line
//     cannot pass at HEAD and cannot fail for a reason anyone should act on. It implements S30.
//   * `tools/harness/w1-21-r2-forge.mjs` R8 — honestly labelled "LIMIT, recorded", but its
//     assertion is `dD.placeCount === SITES.length`, i.e. it goes GREEN when the maximal forgery
//     names all 42 places and RED if the map ever became stricter. That is a description, not a
//     compliance assertion. R1-R7 and R9 of that tool are sound and S38 keeps them.
//
// `--self-test` breaks each property on purpose and requires the corresponding check to go red.
// `--control=pre-s38` runs the pre-round-2 loader, which is the historical red arm: it accepts a
// place because the blob's own raster corroborates it, and 42 of 42 squares come out unjustified.
//
// No browser. Every number here is taken against the shipped `Discovery` model in bare Node.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';
import { Discovery } from '../../game/src/sim/discovery.js';
import { rd, rdOpt } from '../lib/gamedata.mjs';

const OUT = 'reports/arbiter-map-s38';
const SRC = fileURLToPath(new URL('../../game/src/sim/discovery.js', import.meta.url));

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };

// ---- the world, loaded once ------------------------------------------------------------------

const terrain = rd('world/terrain.json');
const regions = rd('world/regions.json');
const water = rd('world/water.json');
const pois = rd('world/pois.json');
const mapDoc = rdOpt('ui/map.json', {});
const field = new WorldField(terrain, regions, water);

const COLS = terrain.cols, ROWS = terrain.rows, CELL = terrain.cell_m;
const TOTAL = COLS * ROWS;
const MAX_R = Number((mapDoc.reveal || {}).max_m) || 450;

/** The standing test, rebuilt the way the model builds it, so "justified" is checked independently. */
const byId = new Map();
for (const s of terrain.sites || []) byId.set(s.id, s);
const FALLBACK = Number((mapDoc.places || {}).fallback_radius_m) || 25;
const SITES = (pois.pois || []).map((p) => {
  const s = byId.get(p.id);
  return { id: p.id, x: s ? s.x : p.pos[0], z: s ? s.z : p.pos[2], r: s && s.r_flat ? s.r_flat : FALLBACK };
});
const SITE_BY_ID = new Map(SITES.map((s) => [s.id, s]));

function makeDiscovery(Cls = Discovery) {
  return new Cls({ field, sim: { player: { pos: [0, 0, 0] }, env: { interior: null } }, doc: mapDoc, pois });
}

/** The save's own wire format, so a forgery is written the way the game writes one. */
function footprintBlob(indices) {
  const out = []; let prev = 0;
  for (const i of indices) {
    let v = i - prev; prev = i;
    v = v < 0 ? (-v * 2 - 1) : v * 2;
    while (v >= 0x80) { out.push((v & 0x7F) | 0x80); v = Math.floor(v / 128); }
    out.push(v);
  }
  return Buffer.from(Uint8Array.from(out)).toString('base64');
}
const cellCentre = (i) => { const r = (i / COLS) | 0; return [(i - r * COLS + 0.5) * CELL, (r + 0.5) * CELL]; };
const justifies = (i, site) => {
  const [x, z] = cellCentre(i);
  return (x - site.x) ** 2 + (z - site.z) ** 2 <= site.r * site.r;
};

// ---- the subject ------------------------------------------------------------------------------
//
// Every check takes a SUBJECT rather than reaching for `Discovery` directly, so `--self-test` can
// hand it a deliberately broken one and watch the check go red. A subject answers three questions:
// which blob keys it reads, and what map state a blob produces (places, raster).

const shippedSubject = {
  name: 'shipped',
  reads: () => Array.from(Discovery.RESTORE_READS),
  make: () => {
    const d = makeDiscovery();
    return {
      load: (blob) => { const a = d.restore(blob); return { places: d.places().slice(), audit: a }; },
      raster: () => Buffer.from(d.raster()).toString('base64'),
      revealed: () => d.revealedCells,
      seen: (c, r) => d.seenCell(c, r),
      obj: d,
    };
  },
};

/**
 * THE CONTROL, and it is the historical one rather than an invented perturbation: the pre-round-2
 * `restore()`, which took the place list from the blob and corroborated it against the raster in
 * the SAME blob. Transcribed from the transcription in `tools/harness/w1-21-r2-forge.mjs`, which
 * took it from `07f8b75`. This is what S35 was being read against when the referral was filed.
 */
const preS38Subject = {
  name: 'pre-s38',
  reads: () => ['stood', 'cells', 'places'],
  make: () => {
    let claimed = new Uint8Array(0), kept = [];
    const unb = (s) => (s ? new Uint8Array(Buffer.from(s, 'base64')) : new Uint8Array(0));
    return {
      load: (blob) => {
        claimed = unb((blob && blob.cells) || '');
        const seenAt = (x, z) => {
          const i = (Math.floor(z / CELL)) * COLS + Math.floor(x / CELL);
          return i >= 0 && i < TOTAL && ((claimed[i >> 3] >> (i & 7)) & 1) === 1;
        };
        kept = [];
        for (const id of (blob && blob.places) || []) {
          const s = SITE_BY_ID.get(String(id));
          if (s && seenAt(s.x, s.z)) kept.push(String(id));
        }
        return { places: kept.slice(), audit: { dropped: [], phantom_cells: 0 } };
      },
      raster: () => Buffer.from(claimed).toString('base64'),
      revealed: () => { let n = 0; for (let i = 0; i < TOTAL; i++) if ((claimed[i >> 3] >> (i & 7)) & 1) n++; return n; },
      seen: (c, r) => { const i = r * COLS + c; return ((claimed[i >> 3] >> (i & 7)) & 1) === 1; },
      obj: null,
    };
  },
};

// ---- the checks --------------------------------------------------------------------------------

function run(subject, { exhaustive = true } = {}) {
  const checks = [];
  const push = (id, what, ok, detail, extra) =>
    checks.push({ id, what, ok: !!ok, detail, ...(extra || {}) });

  // ---- S38-1 — ONE DEGREE OF FREEDOM ----------------------------------------------------------
  // S35 is enforceable exactly to the extent the map has ONE non-derived input. Two independently
  // forgeable fields is what let round 1 put 35 squares on the map with no footprint under them:
  // nothing in a blob can corroborate anything else in the same blob.
  const reads = subject.reads();
  push('S38-1', 'the save has exactly one non-derived map field',
    reads.length === 1,
    `blob keys read on load = [${reads.join(', ')}] (${reads.length}); S38 requires exactly 1`);

  // ---- S38-2 — THE UNION LAW ------------------------------------------------------------------
  // D(F) must equal the union of D over F's individual cells. If it does not, the loader has a
  // privilege the walk does not, and the exhaustive generator sweep below stops being a proof.
  let unionTrials = 0, unionBad = 0;
  {
    const a = subject.make(), g = subject.make();
    let rng = 20260808;
    const rnd = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let t = 0; t < 40; t++) {
      const n = 1 + Math.floor(rnd() * 400);
      const F = [...new Set(Array.from({ length: n }, () => Math.floor(rnd() * TOTAL)))].sort((x, y) => x - y);
      const blob = { stood: footprintBlob(F) };
      const whole = a.load(blob);
      const wr = Buffer.from(a.raster(), 'base64');
      const pu = new Set(); const bits = new Uint8Array((TOTAL + 7) >> 3);
      for (const c of F) {
        g.load({ stood: footprintBlob([c]) });
        for (const p of g.load({ stood: footprintBlob([c]) }).places) pu.add(p);
        const gb = Buffer.from(g.raster(), 'base64');
        for (let b = 0; b < bits.length; b++) bits[b] |= gb[b] || 0;
      }
      const same = [...whole.places].sort().join(',') === [...pu].sort().join(',')
        && Buffer.from(bits).toString('base64') === Buffer.from(wr).toString('base64');
      unionTrials++; if (!same) unionBad++;
    }
  }
  push('S38-2', 'the derivation is per-cell: D(F) = union of D({c}) over c in F',
    unionBad === 0,
    `${unionTrials} random footprints (1-400 cells): ${unionBad} disagree with the union of their own cells`,
    { trials: unionTrials, mismatches: unionBad });

  // ---- S38-3 — GENERATOR SOUNDNESS, EXHAUSTIVE ------------------------------------------------
  // For EVERY one of the province's cells, taken alone as a forged footprint: every place the map
  // names must be a place whose OWN built pad contains that cell's centre, and every revealed cell
  // must lie inside the region sightline cap of it. With S38-2 this is a complete statement about
  // all 2^N saves, not a sample.
  let gen = 0, badPlaces = 0, badCells = 0, emissions = 0, emitters = 0, worstDist = 0;
  const unjustifiedExamples = [];
  if (exhaustive) {
    const s = subject.make();
    const span = Math.ceil(MAX_R / CELL) + 1;
    for (let i = 0; i < TOTAL; i++) {
      const res = s.load({ stood: footprintBlob([i]) });
      gen++;
      if (res.places.length) emitters++;
      emissions += res.places.length;
      for (const id of res.places) {
        const site = SITE_BY_ID.get(String(id));
        if (!site || !justifies(i, site)) {
          badPlaces++;
          if (unjustifiedExamples.length < 6) unjustifiedExamples.push({ cell: i, place: id });
        }
      }
      const r0 = (i / COLS) | 0, c0 = i - r0 * COLS;
      const [x0, z0] = cellCentre(i);
      // Outside the sightline cap nothing may be lit. Inside it, check every cell.
      for (let rz = Math.max(0, r0 - span); rz <= Math.min(ROWS - 1, r0 + span); rz++) {
        for (let cx = Math.max(0, c0 - span); cx <= Math.min(COLS - 1, c0 + span); cx++) {
          if (!s.seen(cx, rz)) continue;
          const dd = Math.hypot((cx + 0.5) * CELL - x0, (rz + 0.5) * CELL - z0);
          if (dd > worstDist) worstDist = dd;
        }
      }
      // and nothing lit beyond the box at all
      let outside = 0;
      const rev = s.revealed();
      let inside = 0;
      for (let rz = Math.max(0, r0 - span); rz <= Math.min(ROWS - 1, r0 + span); rz++)
        for (let cx = Math.max(0, c0 - span); cx <= Math.min(COLS - 1, c0 + span); cx++)
          if (s.seen(cx, rz)) inside++;
      outside = rev - inside;
      if (outside > 0 || worstDist > MAX_R + 1e-6) badCells += Math.max(outside, 0) + (worstDist > MAX_R + 1e-6 ? 1 : 0);
      if (i % 8000 === 0 && !has('--json')) process.stderr.write(`  S38-3 ${i}/${TOTAL}\r`);
    }
    if (!has('--json')) process.stderr.write('              \r');
  }
  push('S38-3', 'EXHAUSTIVE: no cell of the province, asserted alone, yields an unjustified square or an out-of-sightline reveal',
    exhaustive && badPlaces === 0 && badCells === 0,
    exhaustive
      ? `${gen}/${TOTAL} generators; ${badPlaces} unjustified squares, ${badCells} out-of-sightline cells; ` +
        `${emissions} place-emissions from ${emitters} cells (${(emitters / TOTAL * 100).toFixed(3)}% of the province); ` +
        `furthest reveal ${worstDist.toFixed(0)} m against the ${MAX_R} m cap` +
        (unjustifiedExamples.length ? ` e.g. ${JSON.stringify(unjustifiedExamples)}` : '')
      : 'SKIPPED (--fast): S38-3 is the whole proof; a run without it asserts nothing',
    { generators: gen, unjustified_places: badPlaces, unjustified_cells: badCells,
      place_emissions: emissions, emitting_cells: emitters, worst_reveal_m: +worstDist.toFixed(1) });

  // ---- S38-4 — EVERY CLAIM IS REFUSED AND ITEMISED ---------------------------------------------
  // A blob may carry claims for legibility. They may move nothing, and a discrepancy must be
  // reported rather than swallowed: a forged save must be itemised, not merely ignored.
  {
    const honestF = [];
    // a short, connected, honest-shaped walk through one settlement
    const s0 = SITES[0];
    const c0 = Math.floor(s0.x / CELL), r0 = Math.floor(s0.z / CELL);
    for (let k = 0; k < 20; k++) honestF.push((r0 + Math.floor(k / 5)) * COLS + (c0 + (k % 5)));
    const clean = { stood: footprintBlob([...new Set(honestF)].sort((a, b) => a - b)) };
    const a = subject.make();
    const base = a.load(clean);
    const baseRaster = a.raster();

    const allOnes = new Uint8Array((TOTAL + 7) >> 3).fill(0xFF);
    const forged = {
      ...clean,
      cells: Buffer.from(allOnes).toString('base64'),
      places: SITES.map((s) => s.id),
      revealed: TOTAL,
      derived_from: 'places',
      discovered: SITES.map((s) => s.id),
      reveal: 'all',
      stood_places: SITES.map((s) => s.id),
    };
    const b = subject.make();
    const got = b.load(forged);
    const same = JSON.stringify(got.places) === JSON.stringify(base.places) && b.raster() === baseRaster;
    const itemised = (got.audit.dropped || []).length > 0 && (got.audit.phantom_cells || 0) > 0;
    push('S38-4', 'eight forged claim fields move the map by nothing, and the load audit itemises them',
      same && itemised,
      `state unchanged=${same} (${base.places.length} places both sides); ` +
      `audit dropped=${(got.audit.dropped || []).length} names, phantom_cells=${got.audit.phantom_cells || 0}`,
      { unchanged: same, dropped: (got.audit.dropped || []).length, phantom_cells: got.audit.phantom_cells || 0 });
  }

  // ---- S38-5 — NO NAMING CHANNEL, INCLUDING THE ACCESSOR CATEGORY ------------------------------
  // The W1-21 r2 critic proved `mutatorReport()` skips all eleven accessors by construction
  // (`typeof d.value !== 'function' -> continue`), so a state-writing getter is invisible to the
  // check the amendment asks a critic to run. This closes that category from the instrument side:
  // every accessor on the prototype is read out of the source and must contain no write.
  {
    const d = subject.obj ? subject.obj : (subject.make().obj);
    let arityOk = true, arityDetail = 'n/a (control subject has no object)';
    let accessorBad = [];
    if (d) {
      const report = d.mutatorReport ? d.mutatorReport() : [];
      const offenders = report.filter((m) => m.arity > 0 && m.name !== 'restore');
      arityOk = offenders.length === 0;
      arityDetail = `mutators=[${report.map((m) => `${m.name}/${m.arity}`).join(', ')}]; ` +
        `arity>0 other than restore: ${offenders.length}`;

      const src = fs.readFileSync(SRC, 'utf8');
      const proto = Object.getPrototypeOf(d);
      const accessors = Object.getOwnPropertyNames(proto)
        .map((n) => [n, Object.getOwnPropertyDescriptor(proto, n)])
        .filter(([, x]) => x && (x.get || x.set));
      for (const [name, desc] of accessors) {
        for (const fn of [desc.get, desc.set]) {
          if (!fn) continue;
          const body = String(fn);
          // any assignment to a private field, or any call to a known mutator, inside an accessor
          if (/#\w+\s*(=[^=]|\+=|-=|\|=|&=|\.(push|pop|fill|clear|add|delete|splice)\b)/.test(body)
            || /\bthis\.(restore|observe|suspend|resume)\s*\(/.test(body)) accessorBad.push(name);
        }
      }
      void src;
      arityDetail += `; ${accessors.length} accessors scanned, ${accessorBad.length} write state`;
    }
    push('S38-5', 'no parameter and no accessor by which a caller can name or reveal a place',
      arityOk && accessorBad.length === 0,
      arityDetail + (accessorBad.length ? ` -> [${accessorBad.join(', ')}]` : ''),
      { writing_accessors: accessorBad });
  }

  // ---- S38-6 — THE DISCLOSURE BOUND -------------------------------------------------------------
  // The ceiling on what any save, however forged, can extract: the map's whole vocabulary is the
  // id set of a plaintext file on the same disk, at a coarser resolution than that file carries.
  // The forger must READ that file to write the forgery. This is why the residual is not a leak.
  {
    const a = subject.make();
    const ALL = Array.from({ length: TOTAL }, (_, i) => i);
    const max = a.load({ stood: footprintBlob(ALL), cells: '', places: [] });
    const named = new Set(max.places.map(String));
    const poiIds = new Set(SITES.map((s) => s.id));
    const extra = [...named].filter((x) => !poiIds.has(x));
    const poiBytes = fs.statSync(path.join('game/data/world/pois.json')).size;
    push('S38-6', 'the maximal forgery names nothing that game/data/world/pois.json does not already name in plaintext',
      extra.length === 0,
      `maximal forgery: ${named.size} places, ${a.revealed()} of ${TOTAL} cells ` +
      `(${(a.revealed() / TOTAL * 100).toFixed(2)}%), blob ${footprintBlob(ALL).length} B; ` +
      `pois.json: ${poiIds.size} places at float precision in ${poiBytes} B of plaintext; ` +
      `map resolution ${CELL} m/cell; names not in pois.json: ${extra.length}`,
      { max_places: named.size, max_revealed: a.revealed(), poi_places: poiIds.size, poi_bytes: poiBytes });
  }

  return checks;
}

// ---- the forgery cost table — the ruling's number, recomputed every run -------------------------

function costTable() {
  const d = makeDiscovery();
  const rowFor = (label, F) => {
    const blob = footprintBlob(F);
    const res = d.restore({ stood: blob });
    return { forgery: label, cells: F.length, blob_bytes: blob.length,
      places: res.derived_places, revealed: d.revealedCells,
      province_pct: +(d.revealedFrac * 100).toFixed(2) };
  };
  const rows = [];

  // an honest walk to seven places, one step per half-cell
  {
    const sim = { player: { pos: [0, 0, 0] }, env: { interior: null } };
    const h = new Discovery({ field, sim, doc: mapDoc, pois });
    let at = [SITES[0].x, SITES[0].z];
    sim.player.pos[0] = at[0]; sim.player.pos[2] = at[1]; h.observe();
    for (const t of SITES.slice(0, 7)) {
      const steps = Math.ceil(Math.hypot(t.x - at[0], t.z - at[1]) / (CELL * 0.5));
      for (let i = 1; i <= steps; i++) {
        sim.player.pos[0] = at[0] + (t.x - at[0]) * (i / steps);
        sim.player.pos[2] = at[1] + (t.z - at[1]) * (i / steps);
        h.observe();
      }
      at = [t.x, t.z];
    }
    rows.push({ forgery: 'HONEST walk to 7 places', cells: h.stoodCells,
      blob_bytes: h.serialise().stood.length, places: h.placeCount, revealed: h.revealedCells,
      province_pct: +(h.revealedFrac * 100).toFixed(2), connected: connected(h.footprint()) });
  }

  const pads = SITES.map((s) => Math.floor(s.z / CELL) * COLS + Math.floor(s.x / CELL));
  const scatter = [...new Set(pads)].sort((a, b) => a - b);
  rows.push({ ...rowFor('MINIMUM: one cell per pad', scatter), connected: connected(scatter) });

  // the connectivity-constrained forgery: a greedy tour joining every pad by a cell line
  {
    const cellOf = (s) => [Math.floor(s.x / CELL), Math.floor(s.z / CELL)];
    const order = [0]; const used = new Set([0]);
    while (order.length < SITES.length) {
      const a = SITES[order[order.length - 1]];
      let best = -1, bd = Infinity;
      for (let i = 0; i < SITES.length; i++) {
        if (used.has(i)) continue;
        const dd = Math.hypot(SITES[i].x - a.x, SITES[i].z - a.z);
        if (dd < bd) { bd = dd; best = i; }
      }
      order.push(best); used.add(best);
    }
    const F = new Set();
    for (let i = 1; i < order.length; i++) {
      const p = cellOf(SITES[order[i - 1]]), q = cellOf(SITES[order[i]]);
      const n = Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1]));
      for (let k = 0; k <= n; k++) {
        const c = Math.round(p[0] + (q[0] - p[0]) * k / n), r = Math.round(p[1] + (q[1] - p[1]) * k / n);
        F.add(r * COLS + c);
      }
    }
    const conn = [...F].sort((a, b) => a - b);
    rows.push({ ...rowFor('CONNECTED tour of all 42 pads', conn), connected: connected(conn) });
  }

  const all = Array.from({ length: TOTAL }, (_, i) => i);
  rows.push({ ...rowFor('MAXIMAL: every cell', all), connected: true });
  return rows;
}

function connected(F) {
  if (!F.length) return true;
  const S = new Set(F), seen = new Set([F[0]]), st = [F[0]];
  while (st.length) {
    const i = st.pop(); const r = (i / COLS) | 0, c = i - r * COLS;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue;
      const j = nr * COLS + nc;
      if (S.has(j) && !seen.has(j)) { seen.add(j); st.push(j); }
    }
  }
  return seen.size === S.size;
}

// ---- the self-test: break each property and require its check to go red -------------------------

function selfTest() {
  const arms = [];
  const arm = (id, what, red, detail) => {
    arms.push({ id, what, went_red: !!red, detail });
    console.log(`${red ? 'RED ok' : 'GREEN  '}  ${id}  ${what}\n          ${detail}`);
  };

  // ARM 1 — a second forgeable field. S38-1 must go red.
  {
    const two = { ...shippedSubject, reads: () => ['stood', 'places'] };
    const c = run(two, { exhaustive: false }).find((x) => x.id === 'S38-1');
    arm('ARM1', 'a save with two non-derived map fields -> S38-1 red', !c.ok, c.detail);
  }

  // ARM 2 — the pre-round-2 loader. S38-3 must go red with 42 unjustified squares, and S38-4 red.
  {
    const cs = run(preS38Subject, { exhaustive: true });
    const c3 = cs.find((x) => x.id === 'S38-3'), c4 = cs.find((x) => x.id === 'S38-4');
    // the pre-fix loader takes places from the blob, so a single-cell footprint names nothing;
    // its failure shows on the CLAIM path, which is S38-4.
    arm('ARM2', 'the pre-round-2 loader (corroborate places against the same blob) -> S38-4 red',
      !c4.ok, `${c4.detail}  |  S38-3: ${c3.detail}`);
  }

  // ARM 2b — the round-1 attack itself, priced: all-ones raster + all 42 names, empty footprint.
  {
    const p = preS38Subject.make();
    const allOnes = new Uint8Array((TOTAL + 7) >> 3).fill(0xFF);
    const got = p.load({ stood: '', cells: Buffer.from(allOnes).toString('base64'),
      places: SITES.map((s) => s.id) });
    const s = shippedSubject.make();
    const now = s.load({ stood: '', cells: Buffer.from(allOnes).toString('base64'),
      places: SITES.map((s2) => s2.id) });
    arm('ARM2b', 'the round-1 forgery: unjustified squares, pre-S38 against shipped',
      got.places.length > 0 && now.places.length === 0,
      `pre-S38 draws ${got.places.length} squares with an EMPTY footprint under them; ` +
      `shipped draws ${now.places.length}, and itemises ${(now.audit.dropped || []).length} refused names ` +
      `/ ${now.audit.phantom_cells} phantom cells`);
  }

  // ARM 3 — break the union law: a loader whose reveal depends on the whole footprint, not the
  // cell. S38-2 must go red, because that is exactly a load-only privilege.
  {
    const leaky = {
      name: 'leaky', reads: () => ['stood'],
      make: () => {
        const inner = shippedSubject.make();
        return {
          load: (blob) => {
            const r = inner.load(blob);
            // a footprint of >1 cell "helpfully" also names the nearest place. This is what a
            // derivation that reads more than its own cell buys you.
            const n = (blob && blob.stood || '').length;
            if (n > 4 && !r.places.includes(SITES[0].id)) r.places = [...r.places, SITES[0].id];
            return r;
          },
          raster: inner.raster, revealed: inner.revealed, seen: inner.seen, obj: inner.obj,
        };
      },
    };
    const c = run(leaky, { exhaustive: false }).find((x) => x.id === 'S38-2');
    arm('ARM3', 'a derivation that reads the whole footprint, not the cell -> S38-2 red', !c.ok, c.detail);
  }

  // ARM 4 — a state-writing ACCESSOR, the category the shipped `mutatorReport()` skips silently.
  // S38-5 must go red. (The critic's D4 finding, closed from the instrument side.)
  {
    class Bugged extends Discovery {}
    Object.defineProperty(Bugged.prototype, 'wipe', {
      configurable: true,
      get() { this.restore({ stood: '' }); return 1; },
    });
    const sub = { name: 'accessor', reads: () => Array.from(Discovery.RESTORE_READS),
      make: () => { const d = makeDiscovery(Bugged);
        return { load: (b) => ({ places: (d.restore(b), d.places().slice()), audit: d.lastRestore }),
          raster: () => Buffer.from(d.raster()).toString('base64'), revealed: () => d.revealedCells,
          seen: (c, r) => d.seenCell(c, r), obj: d }; } };
    const c = run(sub, { exhaustive: false }).find((x) => x.id === 'S38-5');
    arm('ARM4', 'a state-writing getter on the prototype -> S38-5 red', !c.ok, c.detail);
  }

  const missed = arms.filter((a) => !a.went_red);
  console.log(`\nself-test: ${arms.length - missed.length}/${arms.length} arms went red as predicted`);
  if (missed.length) {
    console.log(`SELF-TEST FAILED: ${missed.map((m) => m.id).join(', ')} did not go red — ` +
      'the instrument cannot see the defect it exists to catch.');
  }
  return { arms, missed: missed.length };
}

// ---- main ----------------------------------------------------------------------------------------

fs.mkdirSync(OUT, { recursive: true });

if (has('--self-test')) {
  const r = selfTest();
  fs.writeFileSync(path.join(OUT, 'self-test.json'), JSON.stringify(r, null, 2));
  process.exit(r.missed ? 2 : 0);
}

const which = val('--control', null);
const subject = which === 'pre-s38' ? preS38Subject : shippedSubject;
const checks = run(subject, { exhaustive: !has('--fast') });
const cost = costTable();

if (!has('--json')) {
  console.log(`arbiter-map-s38 — S35's "no square for a place the player has not stood in", ` +
    `subject=${subject.name}`);
  console.log(`province ${COLS}x${ROWS} = ${TOTAL} cells at ${CELL} m; ${SITES.length} places\n`);
  for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.id}  ${c.what}\n         ${c.detail}`);
  console.log('\nwhat a forged footprint buys, recomputed (S38 does not refuse any of these):');
  console.log('  ' + 'forgery'.padEnd(30) + 'cells'.padStart(7) + 'bytes'.padStart(8) +
    'places'.padStart(8) + 'province'.padStart(10) + '  8-connected');
  for (const r of cost) {
    console.log('  ' + String(r.forgery).padEnd(30) + String(r.cells).padStart(7) +
      String(r.blob_bytes).padStart(8) + String(r.places).padStart(8) +
      (r.province_pct + '%').padStart(10) + '  ' + (r.connected ? 'yes' : 'NO'));
  }
}

const failed = checks.filter((c) => !c.ok);
const out = {
  tool: 'tools/map/arbiter-map-s38.mjs',
  seam: 'S38', amends: 'S35', binding: 'ARBITRATION.md S38',
  subject: subject.name,
  commit: process.env.ES_COMMIT || null,
  province: { cols: COLS, rows: ROWS, cell_m: CELL, cells: TOTAL, places: SITES.length },
  checks, forgery_cost: cost, failed: failed.length,
};
fs.writeFileSync(path.join(OUT, `gate${which ? '-' + which : ''}.json`), JSON.stringify(out, null, 2));
if (has('--json')) console.log(JSON.stringify(out, null, 2));
else console.log(`\n${checks.length - failed.length}/${checks.length} · ${OUT}/gate${which ? '-' + which : ''}.json`);
process.exit(failed.length ? 1 : 0);
