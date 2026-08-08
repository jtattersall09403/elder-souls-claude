#!/usr/bin/env node
// build-unique-property.mjs — put the 83 interior unique items into the ownership system.
//
// THE DEFECT THIS CLOSES. `game/data/world/interiors/*.json` declares one `unique_item` per room
// — 83 of them, 72 carrying an `owner` — and W1-04 gave every one of them a body you can walk up
// to and press `interact` on. But `Engine.takeProp()` pushes the thing straight into the
// inventory with `stolen: false, owner: null`, because the only take-verb that consults ownership
// is `Engine.takeObject()`, and `takeObject()` looks its object up in
// `game/data/world/property/*.json` — where none of the 83 appears. So `unique_item.owner` was
// carried through `render/interior.js` into `placements.unique.owner` and read by nothing, and
// the single most stealable object in every room in the province could be pocketed in front of
// its owner for no bounty, no witness, no `stolen_from` and no fence refusal.
//
// This tool is the wiring. It writes ONE content row per interior unique item into the property
// zone that room belongs to, so the existing theft chain — `isTheft` -> `registerStolen` ->
// `commitCrime` -> witnesses -> report -> bounty -> `willBuy` -> `fencePrice` — runs on it
// unchanged. No new take-verb, no second ownership model.
//
// IDEMPOTENT: re-running replaces the rows it wrote (tagged `from_interior`) and touches nothing
// else, so it is safe to run over a property tree three other builders are editing.
//
// The 11 interiors that get nothing are the ones with NO property zone AND no declared owner:
// the ten hand-authored Helstrom cells and `barge-hold`, the opening. They are reported, not
// invented — an owner this tool made up would be exactly the "declared and never read" field
// RI-STL02 §1 is written against, one layer on.
//
// USAGE
//   node tools/world/build-unique-property.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const DRY = process.argv.includes('--dry');

/** FNV-1a, the same hash sim/npc.js, render/interior.js and the Engine use. */
function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

// What the room's one notable object is worth. The authored property tree runs 2 g (a reed mat)
// to 41 g at the 90th percentile, with the eleven `sealed.*` quest items at 900-3400 g. A unique
// item is the thing in the room worth taking and has to sit clearly above the furniture and
// clearly below a quest relic, or the fence economy (RI-STL02 §6: 0.20x for a unique, plus a
// delayed bounty three days later) has nothing to price. Deterministic, from the item's own id.
const VALUE_BAND = {
  temple: [180, 240], shrine: [180, 240],
  guild: [150, 200], hall: [150, 200], archive: [150, 200],
  shop: [90, 170],
  prison: [80, 120], gate: [80, 120], hold: [80, 120],
  tavern: [60, 120], travel: [60, 120],
};
const DEFAULT_BAND = [90, 170];

const interiorsDir = path.join(ROOT, 'game/data/world/interiors');
const propertyDir = path.join(ROOT, 'game/data/world/property');

const interiors = fs.readdirSync(interiorsDir).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(interiorsDir, f), 'utf8')));

const property = {};
for (const f of fs.readdirSync(propertyDir).filter((x) => x.endsWith('.json'))) {
  property[f] = JSON.parse(fs.readFileSync(path.join(propertyDir, f), 'utf8'));
}
const zoneIndex = new Map();
for (const [f, doc] of Object.entries(property)) for (const z of doc.zones) zoneIndex.set(z.id, { file: f, zone: z });

// Strip anything a previous run wrote, so this is a rebuild rather than an append.
let removed = 0;
for (const doc of Object.values(property)) {
  for (const z of doc.zones) {
    const before = z.contents.length;
    z.contents = z.contents.filter((c) => !c.from_interior);
    removed += before - z.contents.length;
  }
}

const wired = [];
const skipped = [];
for (const rec of interiors) {
  const u = rec.unique_item;
  if (!u) continue;
  const zones = (rec.property_zones || []).map((id) => zoneIndex.get(id)).filter(Boolean);
  if (!zones.length) { skipped.push({ interior: rec.id, why: 'no property zone', owner: u.owner || null }); continue; }
  if (!u.owner) { skipped.push({ interior: rec.id, why: 'no declared owner', owner: null }); continue; }
  // The room the owner actually keeps, if one of the zones is theirs; otherwise the first.
  const target = zones.find((z) => z.zone.owner === u.owner) || zones[0];
  const band = VALUE_BAND[rec.interior_kind] || DEFAULT_BAND;
  const value = band[0] + (hashStr(u.id) % (band[1] - band[0] + 1));
  const row = {
    instance: u.id,
    id: String(u.id).replace(/[.-]/g, '_'),
    name: u.name,
    owner: u.owner,
    // A room's one named possession is that person's, not the household's stock: RI-STL02 §1's
    // `personal` scope, which is theft whether or not anybody saw it happen.
    owner_scope: 'personal',
    value_g: value,
    weight_kg: 1.5,
    unique: true,
    stolen_from: null,
    takeable: true,
    // Provenance, and the hook the drift check reads. This row and the interior record's
    // `unique_item` are ONE object seen from two sides; `tools/analysis/crime-audit.mjs` fails
    // if they ever stop agreeing, so a regeneration of either file cannot silently unwire it.
    from_interior: rec.id,
  };
  target.zone.contents.push(row);
  wired.push({ interior: rec.id, zone: target.zone.id, instance: u.id, owner: u.owner, value_g: value });
}

if (!DRY) {
  for (const [f, doc] of Object.entries(property)) {
    // Indent 1, matching `tools/world/build-property.mjs`'s own writer, so re-running the
    // generator over this tree produces a diff of content and not of whitespace.
    fs.writeFileSync(path.join(propertyDir, f), JSON.stringify(doc, null, 1) + '\n');
  }
}

const byBand = {};
for (const w of wired) byBand[w.value_g] = (byBand[w.value_g] || 0) + 1;
process.stdout.write(
  `build-unique-property: ${wired.length} interior unique item(s) wired into property zone contents ` +
  `(${removed} previous row(s) replaced)${DRY ? ' [DRY RUN, nothing written]' : ''}\n` +
  `  value_g range: ${Math.min(...wired.map((w) => w.value_g))}-${Math.max(...wired.map((w) => w.value_g))}, ${Object.keys(byBand).length} distinct\n` +
  `  NOT wired: ${skipped.length}\n` +
  skipped.map((s) => `    ${s.interior.padEnd(28)} ${s.why}\n`).join('')
);
if (!wired.length) { process.stderr.write('build-unique-property: wired nothing — that is a failure, not a clean run.\n'); process.exit(1); }
