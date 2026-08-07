#!/usr/bin/env node
// build-giver-posts.mjs — put the quest givers in the world.
//
// GAP-W1-quest-givers-not-in-the-world (corpus/90-verdicts/wave1/W1-19-r2.md §2). The build has
// 336 NPC records and twelve people. Every one of the 39 quest givers HAS a record; not one of
// them had a place to stand, because a record is not a spawn: `Engine.applyNamedState()` spawns
// only the `npcs:` block a state file declares, and W1-04's `Engine.populateSettlement()` — the
// machine that fills a town from its records — is reached only by walking across a settlement
// boundary, which no bootable state ever does.
//
// This writes the missing half of the data: for every quest giver, a POST. A post is
//
//   { settlement, at_building, pos:[x,y,z], yaw, note }
//
// in the settlement's own world coordinates, taken from the door of a real building in that
// town — the building whose service, faction or kind matches what the person is. The fence
// stands at the low market; the harbourmistress at the customs house; the herbwife in the market
// row. Plus a `schedule` so they are somewhere at every hour: at the post through the working
// day, and in the town's hall or tavern in the evening.
//
// Deterministic and idempotent: run it twice and the files do not change. Nothing here draws
// RNG — offsets are a hash of the person's own id, the same convention `populateSettlement`
// uses so that forty people in a capital do not occupy one point.
//
//   node tools/world/build-giver-posts.mjs [--dry] [--report reports/giver-posts.json]

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');
const REPORT = (() => {
  const i = process.argv.indexOf('--report');
  return i > 0 ? process.argv[i + 1] : 'reports/giver-posts.json';
})();

// ---- 1. who the quest givers are --------------------------------------------------------------
const QDIR = path.join(ROOT, 'game/data/quests');
const quests = [];
for (const f of fs.readdirSync(QDIR).sort()) {
  if (!f.endsWith('.json') || f === 'hooks.json') continue;
  for (const q of JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8')).quests || []) {
    quests.push({ id: q.id, category: q.category || null, giver: (q.giver || {}).npc_id || null, where: (q.giver || {}).location || null });
  }
}
const giverIds = [...new Set(quests.filter((q) => q.giver).map((q) => q.giver))].sort();

// ---- 2. the towns ------------------------------------------------------------------------------
const SDIR = path.join(ROOT, 'game/data/world/settlements');
const towns = new Map();
for (const f of fs.readdirSync(SDIR).sort()) {
  if (!f.endsWith('.json')) continue;
  const s = JSON.parse(fs.readFileSync(path.join(SDIR, f), 'utf8'));
  towns.set(s.id, s);
}

// ---- 3. the records ----------------------------------------------------------------------------
const NDIR = path.join(ROOT, 'game/data/npcs');
const files = new Map();          // filename -> parsed doc
const recOf = new Map();          // npc id -> { doc, rec, file }
for (const f of fs.readdirSync(NDIR).sort()) {
  if (!f.endsWith('.json')) continue;
  const doc = JSON.parse(fs.readFileSync(path.join(NDIR, f), 'utf8'));
  files.set(f, doc);
  for (const n of doc.npcs || []) if (!recOf.has(n.id)) recOf.set(n.id, { doc, rec: n, file: f });
}

/** The same string hash the Engine uses, so a post and a derived spawn agree on their arithmetic. */
function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

// A person is placed at the building that matches what they ARE. First match wins; the list is
// ordered from most specific (this person's declared interior) to least (any public building).
const ROLE_HINTS = [
  [/fence|smuggl|thief/i, { service: 'trader', kind: 'shop' }],
  [/harbour|dock|shipwright|pilot/i, { kindWords: /dock|quay|customs|yard|barge/i }],
  [/herbwife|apothec|alchem|cutter|healer|physic/i, { service: 'alchemist' }],
  [/priest|sexton|undertaker|keeper|rootkeep/i, { kind: 'temple', altKind: 'shrine' }],
  [/scribe|notary|clerk|assizer|prefect|magistrat/i, { kind: 'guild' }],
  [/innkeep|tavern/i, { service: 'inn' }],
  [/smith|forge/i, { service: 'smith' }],
  [/factor|ledger|quartermaster|merchant|trader|potter|dyer/i, { service: 'trader' }],
  [/warden|legion|guard/i, { kind: 'gate', altKind: 'hall' }],
];

function pickBuilding(town, rec) {
  const bs = (town.buildings || []).filter((b) => b.kind !== 'structure' && b.building_kind !== 'sealed');
  const byId = (id) => bs.find((b) => b.interior === id || b.id === id);
  // 1. the interior the record already declares — the strongest statement of where this person is.
  if (rec.interior && byId(rec.interior)) return byId(rec.interior);
  const words = `${rec.class || ''} ${rec.actor || ''} ${rec.id}`;
  // 2. their faction's own house.
  if (rec.faction) {
    const fb = bs.find((b) => b.faction && b.faction.replace(/^the-/, '') === String(rec.faction).replace(/^the[-_]/, '').replace(/_/g, '-'));
    if (fb) return fb;
  }
  // 3. what they do.
  for (const [re, want] of ROLE_HINTS) {
    if (!re.test(words)) continue;
    let hit = null;
    if (want.service) hit = bs.find((b) => b.service === want.service);
    if (!hit && want.kind) hit = bs.find((b) => b.building_kind === want.kind);
    if (!hit && want.altKind) hit = bs.find((b) => b.building_kind === want.altKind);
    if (!hit && want.kindWords) hit = bs.find((b) => want.kindWords.test(b.id) || want.kindWords.test(b.name || ''));
    if (hit) return hit;
  }
  // 4. failing all of that, the public heart of the town, deterministically.
  const pub = bs.filter((b) => ['hall', 'tavern', 'shop', 'guild', 'temple', 'shrine'].includes(b.building_kind));
  const pool = pub.length ? pub : bs;
  return pool[hash(rec.id) % pool.length] || null;
}

/** The cell this town gathers in after dark: its hall, else its tavern, else any enterable. */
function eveningCell(town) {
  const bs = (town.buildings || []).filter((b) => b.enterable && b.interior);
  return (bs.find((b) => b.building_kind === 'hall')
    || bs.find((b) => b.building_kind === 'tavern')
    || bs.find((b) => b.service === 'inn')
    || bs[0] || null);
}

// Givers whose quests declare them somewhere that is not a town at all. W1-04's rule holds for
// these — `settlement: null` is the correct representation for somebody who belongs to no
// settlement — so they get a post keyed to a NAMED SITE instead, and a state file stands the
// player there. Reported, never silently swept into a town.
const WILD = {
  'speaker-teel-ashaan': { site: 'rootlands-hollow', pos: [4.2, 0, 1.6], yaw: 200 },
  'xul-aneekh-speaker': { site: 'rootlands-hollow', pos: [-3.4, 0, 3.1], yaw: 150 },
  'ixtu-meer': { site: 'stone-wastes-count', pos: [2.6, 0, 3.4], yaw: 190 },
  'keeper-teeja-lun': { site: 'stone-wastes-count', pos: [-2.9, 0, 1.2], yaw: 120 },
};
// The one null-settlement giver that IS a townsperson: Q-MAG-26 declares potter-mek at
// `gideon-lowmarket`, the same cell fence-ashul already stands in.
const REHOME = { 'potter-mek': { settlement: 'gideon', why: 'Q-MAG-26 declares this person at gideon-lowmarket; the record carried settlement:null, which RumourBook and RoadBook both read as "answers nothing".' } };

const out = { tool: 'tools/world/build-giver-posts.mjs', built_at: new Date().toISOString(), posts: [], wild: [], skipped: [] };
const touched = new Set();

for (const id of giverIds) {
  const hit = recOf.get(id);
  if (!hit) { out.skipped.push({ id, why: 'no NPC record' }); continue; }
  const rec = hit.rec;

  if (REHOME[id] && rec.settlement == null) {
    rec.settlement = REHOME[id].settlement;
    rec.settlement_note = `W1-GIVER-PRESENCE: ${REHOME[id].why}`;
    touched.add(hit.file);
  }

  if (WILD[id]) {
    const w = WILD[id];
    rec.post = { site: w.site, pos: w.pos, yaw: w.yaw, note: 'Not a townsperson. This person is at a named site their own quests declare; see game/data/states/' + w.site + '.json.' };
    delete rec.schedule;             // a hermit keeps no shop hours
    touched.add(hit.file);
    out.wild.push({ id, site: w.site, quests: quests.filter((q) => q.giver === id).map((q) => q.id) });
    continue;
  }

  const town = towns.get(rec.settlement);
  if (!town) { out.skipped.push({ id, settlement: rec.settlement, why: 'no settlement record for this town' }); continue; }
  const b = pickBuilding(town, rec);
  if (!b) { out.skipped.push({ id, settlement: rec.settlement, why: 'town has no placeable building' }); continue; }

  // Stand OUTSIDE the door, on the street side — the vector from the town centre out through the
  // door, normalised, times a short pace. Offset laterally off the id so two people at the same
  // door do not occupy one point.
  const c = town.pos;
  const d = b.door || [c[0], c[1], c[2]];
  let vx = d[0] - c[0], vz = d[2] - c[2];
  const len = Math.hypot(vx, vz) || 1;
  vx /= len; vz /= len;
  const h = hash(id);
  const outStep = 1.6 + ((h % 90) / 100);            // 1.60 .. 2.49 m clear of the doorway
  const lateral = (((h >>> 9) % 300) / 100) - 1.5;   // -1.50 .. +1.49 m along the frontage
  const pos = [
    Math.round((d[0] + vx * outStep - vz * lateral) * 100) / 100,
    Math.round(d[1] * 100) / 100,
    Math.round((d[2] + vz * outStep + vx * lateral) * 100) / 100,
  ];
  // Face back down the street, i.e. away from the wall they have their back to.
  const yaw = Math.round(((Math.atan2(vx, vz) * 180) / Math.PI + 360) % 360);

  const ev = eveningCell(town);
  const home = rec.home_interior || rec.interior || (ev && ev.interior) || null;

  rec.post = {
    settlement: town.id,
    at_building: b.id,
    at_building_name: b.name || b.id,
    pos, yaw,
    note: `W1-GIVER-PRESENCE: a quest giver with no place to stand cannot be found. Post derived from ${b.id}'s door.`,
  };
  // Somewhere at every hour. `at: null` is the street; `Engine.populateSettlement` and
  // `sim/npc.js stepSchedule` read `post` to mean "null here is OUTDOORS", not "everywhere".
  rec.schedule = [
    { from: '00:00', to: '07:00', at: home, activity: 'home' },
    { from: '07:00', to: '19:00', at: null, activity: 'post' },
    { from: '19:00', to: '00:00', at: (ev && ev.interior) || home, activity: 'tavern' },
  ];
  if (!rec.home_interior && home) rec.home_interior = home;
  touched.add(hit.file);
  out.posts.push({ id, settlement: town.id, building: b.id, pos, yaw, quests: quests.filter((q) => q.giver === id).length });
}

// ---- 4. write ----------------------------------------------------------------------------------
if (!DRY) {
  for (const f of touched) {
    const doc = files.get(f);
    doc.giver_posts_note = 'Some records in this file carry a `post` block and a `schedule` written by tools/world/build-giver-posts.mjs. Re-run it after moving a settlement; do not hand-edit `post`.';
    fs.writeFileSync(path.join(NDIR, f), JSON.stringify(doc, null, 2) + '\n');
  }
  fs.mkdirSync(path.dirname(path.join(ROOT, REPORT)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, REPORT), JSON.stringify(out, null, 2) + '\n');
}

console.log(`quest givers            ${giverIds.length}`);
console.log(`posted in a town        ${out.posts.length}`);
console.log(`posted at a named site  ${out.wild.length}   (${out.wild.map((w) => w.site).filter((v, i, a) => a.indexOf(v) === i).join(', ')})`);
console.log(`skipped                 ${out.skipped.length}`);
for (const s of out.skipped) console.log(`   ${s.id}: ${s.why}`);
console.log(`files ${DRY ? 'that WOULD be' : ''} rewritten: ${[...touched].sort().join(', ')}`);
const perTown = {};
for (const p of out.posts) perTown[p.settlement] = (perTown[p.settlement] || 0) + 1;
console.log('per town:', JSON.stringify(perTown));
