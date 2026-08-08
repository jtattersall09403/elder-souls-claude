// THE FALSIFIER FOR THE W1-21 AR-2 FIX: can a save still put a square on the map?
//
// W1-21 round 2. The round-1 verdict got a marker onto the discovery map through the save file —
// `world.discovery.cells := all ones`, `world.discovery.places := every id in pois.json` — and
// the live-world load audit dropped nothing, the map drew 42 squares with 35 of them for places
// the body had never stood in, and the screen's own compliance report went green because both of
// its numbers came from the same forged model.
//
// This tool runs the same forgery against the model in bare Node, with no browser, and it runs it
// TWICE: once against the shipped `Discovery` and once against a faithful re-implementation of the
// pre-fix `restore()` (`legacyRestore` below, transcribed from `07f8b75`). RULES 4 and 6 in one
// pass — the second arm is the instrument's own red light, and if the two arms ever agree this
// tool says so and exits non-zero rather than reporting a pass.
//
// It measures the MODEL. The DRAWN SCREEN and `getUIState()` are a browser question and are
// measured by `tools/harness/w1-21-r2-map-shot.mjs`; this one exists so the property can be
// checked at all under contention, and so a regression is caught by a tool that costs no browser.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { WorldField } from '../../game/src/world/field.js';
import { Discovery } from '../../game/src/sim/discovery.js';
import { rd, rdOpt } from '../lib/gamedata.mjs';

const OUT = 'reports/runs/W1-21-R2';
fs.mkdirSync(OUT, { recursive: true });

const terrain = rd('world/terrain.json');
const regions = rd('world/regions.json');
const water = rd('world/water.json');
const pois = rd('world/pois.json');
const mapDoc = rdOpt('ui/map.json', {});
const field = new WorldField(terrain, regions, water);

const results = [];
const push = (id, what, ok, detail) => {
  results.push({ id, what, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${id}  ${what}\n         ${detail}`);
};

/** A minimal sim: the two fields `Discovery` reads through, and it reads them EVERY call. */
function makeSim() {
  return { player: { pos: [0, 0, 0] }, env: { interior: null } };
}
function makeDiscovery(sim) {
  return new Discovery({ field, sim, doc: mapDoc, pois });
}

/**
 * The pre-fix `restore()`, transcribed from `07f8b75` so the two arms differ by the fix and by
 * nothing else. It cannot be called on the shipped object (the state is `#private`), so it is
 * modelled over the same inputs: which of the blob's named places survive the blob's own raster.
 */
function legacyRestore(blob, sites, cols, cell) {
  const bits = unb64(blob.cells || '');
  const seenAt = (x, z) => {
    const c = Math.floor(x / cell), r = Math.floor(z / cell);
    const i = r * cols + c;
    return i >= 0 && (bits[i >> 3] >> (i & 7) & 1) === 1;
  };
  const kept = [], dropped = [];
  for (const id of blob.places || []) {
    const s = sites.find((q) => q.id === id);
    if (!s || !seenAt(s.x, s.z)) { dropped.push(String(id)); continue; }
    kept.push(id);
  }
  return { kept, dropped };
}
function unb64(s) { return s ? new Uint8Array(Buffer.from(s, 'base64')) : new Uint8Array(0); }

// The site table, rebuilt the way the model builds it, for the legacy arm only.
const byId = new Map();
for (const s of terrain.sites || []) byId.set(s.id, s);
const SITES = (pois.pois || []).map((p) => {
  const s = byId.get(p.id);
  return { id: p.id, x: s ? s.x : p.pos[0], z: s ? s.z : p.pos[2] };
});

// ---- 1. an HONEST walk ------------------------------------------------------------------------
//
// Walk the body to seven real places, one step per cell so the footprint is what a walk produces
// and not what a teleport produces. Nothing here calls anything but `observe()`.
const sim = makeSim();
const d = makeDiscovery(sim);
const TARGETS = SITES.slice(0, 7);
let at = [SITES[0].x, SITES[0].z];
sim.player.pos[0] = at[0]; sim.player.pos[2] = at[1]; d.observe();
for (const t of TARGETS) {
  const steps = Math.ceil(Math.hypot(t.x - at[0], t.z - at[1]) / (terrain.cell_m * 0.5));
  for (let i = 1; i <= steps; i++) {
    sim.player.pos[0] = at[0] + (t.x - at[0]) * (i / steps);
    sim.player.pos[2] = at[1] + (t.z - at[1]) * (i / steps);
    d.observe();
  }
  at = [t.x, t.z];
}
const honest = { places: d.places(), revealed: d.revealedCells, stood: d.stoodCells };
push('R1', 'an honest walk discovers places by standing in them',
  honest.places.length >= 5 && honest.revealed > 0 && honest.stood > 0,
  `${honest.places.length} places [${honest.places.slice(0, 4)}…], ${honest.revealed} revealed cells, ${honest.stood} cells stood in`);

const blob = d.serialise();

// ---- 2. THE FORGERY, both fields, exactly as the round-1 critic wrote it -----------------------
const forged = JSON.parse(JSON.stringify(blob));
{
  const bytes = new Uint8Array(unb64(blob.cells).length || ((terrain.cols * terrain.rows + 7) >> 3));
  bytes.fill(0xFF);
  forged.cells = Buffer.from(bytes).toString('base64');
  forged.places = (pois.pois || []).map((p) => p.id);
  forged.revealed = terrain.cols * terrain.rows;
}

// Arm A — the shipped model.
const dA = makeDiscovery(makeSim());
const repA = dA.restore(forged);
const phantomA = dA.places().filter((p) => !honest.places.includes(p));
push('R2', 'a save forged in BOTH fields puts no place on the map that the footprint does not',
  phantomA.length === 0 && dA.placeCount === honest.places.length,
  `derived ${dA.placeCount} places against ${honest.places.length} stood in; phantom=${phantomA.length}; refused=[${repA.dropped.length} names]`);

push('R3', 'and it renders no ground the footprint does not either',
  dA.revealedCells === honest.revealed && repA.phantom_cells > 0,
  `revealed ${dA.revealedCells} against ${honest.revealed} honest; the blob CLAIMED ${repA.phantom_cells} cells the footprint does not paint`);

// Arm B — the pre-fix model. This is the instrument's red light.
const legacy = legacyRestore(forged, SITES, terrain.cols, terrain.cell_m);
push('R4', 'CONTROL: the pre-fix restore() accepts the same forgery (RULES 4/6 — the arms differ)',
  legacy.kept.length > honest.places.length && legacy.dropped.length === 0,
  `pre-fix kept ${legacy.kept.length} of ${forged.places.length} named places and dropped ${legacy.dropped.length}; shipped keeps ${dA.placeCount}`);

// ---- 3. the channel, read off the running object rather than off a comment ----------------------
const reads = Array.from(dA.restoreReads);
const NAMES_A_PLACE = /^(place|places|markers?|pins?|reveal|discovered|locations?)$/i;
push('R5', 'no blob key `restore()` reads can name a place',
  reads.length > 0 && !reads.some((k) => NAMES_A_PLACE.test(k)),
  `Discovery.RESTORE_READS = [${reads}]`);

const mut = dA.mutatorReport();
push('R6', 'the mutator report is ENUMERATED and contains the save path the r1 literal omitted',
  mut.some((m) => m.name === 'restore') && mut.some((m) => m.name === 'observe'),
  `mutators = [${mut.map((m) => `${m.name}/${m.arity}`).join(', ')}]`);

// ---- 4. the replay is bit-exact with live play, or the save is not stable ------------------------
//
// This is what pays for `observe()` painting from the cell centre. If the derivation ever starts
// reading the body's exact position again, live and replay diverge and this goes red — which is
// the same failure as "a save round trip does not return the world it saved".
const dC = makeDiscovery(makeSim());
dC.restore(blob);
const again = dC.serialise();
push('R7', 'save -> load -> save is bit-identical, so replaying the footprint reproduces play',
  again.stood === blob.stood && again.cells === blob.cells
    && JSON.stringify(again.places) === JSON.stringify(blob.places),
  `stood ${again.stood === blob.stood}, cells ${again.cells === blob.cells}, ` +
  `place ORDER ${JSON.stringify(again.places) === JSON.stringify(blob.places)} ` +
  `(${again.places.length}/${blob.places.length}); footprint ${Math.round(blob.stood.length / 1024 * 10) / 10} KB ` +
  `against a ${Math.round(blob.cells.length / 1024 * 10) / 10} KB raster, ${honest.stood} cells stood in`);

// ---- 5. the LIMIT, stated rather than hidden ----------------------------------------------------
//
// Forging the footprint itself is not refused and must not be reported as if it were. It is a
// different claim: not "put a square on a place I have not been", which is what S35 forbids and
// what is now impossible, but "I walked the whole province", whose map is the honest map of that
// walk. There is no field left in which a place can be NAMED, which is the amendment's §3a third
// hard fail; there is no defence against a player claiming to have walked, and never was.
const dD = makeDiscovery(makeSim());
{
  // Every cell in the province, in index order: the strongest claim a footprint can make.
  const total = terrain.cols * terrain.rows;
  const all = new Uint8Array(total);           // delta 1 each => one byte each, zigzagged to 2
  let prev = 0; const bytes = [];
  for (let i = 0; i < total; i++) {
    let v = (i - prev) * 2; prev = i;
    while (v >= 0x80) { bytes.push((v & 0x7F) | 0x80); v = Math.floor(v / 128); }
    bytes.push(v);
  }
  void all;
  dD.restore({ stood: Buffer.from(Uint8Array.from(bytes)).toString('base64') });
}
push('R8', 'LIMIT, recorded: a forged FOOTPRINT still reveals — it is a claim to have walked, not a named marker',
  dD.placeCount === SITES.length,
  `an all-ones footprint derives ${dD.placeCount} places of ${SITES.length}. Not refused, and not claimed to be.`);

// ---- 6. legacy saves come back empty rather than trusted ----------------------------------------
const dE = makeDiscovery(makeSim());
const repE = dE.restore({ cells: forged.cells, places: forged.places, revealed: forged.revealed });
push('R9', 'a pre-round-2 save (raster, no footprint) loads EMPTY and says so',
  dE.placeCount === 0 && dE.revealedCells === 0 && repE.legacy === true,
  `places=${dE.placeCount} revealed=${dE.revealedCells} legacy=${repE.legacy}`);

const fail = results.filter((r) => !r.ok);
const out = {
  tool: 'tools/harness/w1-21-r2-forge.mjs',
  item: 'W1-21', round: 2, seam: 'S35', binding: 'AMENDMENT-W1-MAP-01 §3a',
  commit: process.env.ES_COMMIT || null,
  honest, checks: results, failed: fail.length,
};
fs.writeFileSync(path.join(OUT, 'forge.json'), JSON.stringify(out, null, 2));
console.log(`\n${results.length - fail.length}/${results.length} · reports/runs/W1-21-R2/forge.json`);
process.exit(fail.length ? 1 : 0);
