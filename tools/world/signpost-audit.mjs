#!/usr/bin/env node
// signpost-audit — does every name in the wayfinding layer point at somewhere that exists?
//
// Owner: W1-05 (roads, signposts and getting there without a marker).
// Binding: RI-WLD06 L2/L3, RI-JRN07 §4, RI-MTH07 / ARBITRATION §3 (CONSUMPTION), seam S35.
//
// WHY THIS TOOL EXISTS, in one sentence: this project has already paid for 74 dialogue gates that
// named nothing, and a signpost arm pointing at a place that does not exist is the same defect
// wearing a wooden hat. It is worse, in fact — a dead gate silently fails to open, while a dead
// signpost sends a player walking for forty minutes.
//
// Seam S35 permits a map and confines it to ground the player has already walked. That makes this
// audit MORE load-bearing rather than less: a map that only records where you have been cannot
// correct a bad direction ahead of you, so nothing downstream catches what this tool misses.
//
// Eight checks. A-G fail the run; H reports a measurement this piece does not own the data for.
// A-F were each verified falsifiable by breaking the thing they measure on purpose (an arm named
// 'Vivec', a bearing turned 180°, a leg 'helstrom-vivec', an invented topic, a tell_id naming
// nothing, an actor 'dwemer-centurion') and confirming the tool went red and exited 1. G was not
// invented in the abstract either: it found two real unresolvable leg ids on THE LONG WAY.
//
//   A. ARM DESTINATIONS      every `arms[].to` on every signpost resolves to a settlement in
//                            game/data/world/settlements/ or a POI in world/pois.json.
//   B. ARM BEARINGS          every arm's compass WORD agrees with its own `bearing_deg` to
//                            within half a compass point, and the bearing agrees with the real
//                            geometry between the post and the place it names. A post that
//                            points north at something south of it is the defect this catches.
//   C. LEGS                  every `at.leg` and every `arms[].via_leg` is a real leg of
//                            world/roads.json, and the post's `at_m` lies on it.
//   D. DIRECTION ROUTES      every route in dialogue/road-directions.json names a real origin
//                            settlement, a real destination, a real leg, and a topic id that
//                            EXISTS in dialogue/topics/ (folded through core/topics.js, so
//                            `the road to Gideon` and `the-road-to-gideon` are one keyword).
//   E. THE TELLS             every id in a wrong answer's `tell_ids` resolves to a real
//                            signpost, waystation, POI, leg or region. THIS IS THE ONE THAT
//                            MATTERS MOST. Four of the forty-six answers are deliberately
//                            false, which is RI-JRN07 U4 and is good; but a lie a player has no
//                            way of catching is not a feature, it is a defect. `tell_ids` is
//                            the promise that the contradiction is really out there in the
//                            world, and this check is what keeps the promise honest.
//   F. SPEAKERS              every answer's `a` archetype is an `actor` some NPC in
//                            game/data/npcs/ actually has, so the located answer can be reached
//                            by talking to somebody rather than only in the file.
//   G. NAMED ROUTES          every leg id in roads.json `named_routes` resolves, every settlement
//                            it names has a record, and the chain has no hole.
//   H. NIGHT LANDMARKS       (reported, never fails) how far a walker on each named route is from
//                            the nearest GLOWING signature, against the 160 m lamp range.
//
// Usage:  node tools/world/signpost-audit.mjs [--json] [--verbose]
// Exits non-zero on any failure. It is not a formality and it must never be made one.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = path.join(ROOT, 'game/data');
const argv = process.argv.slice(2);
const AS_JSON = argv.includes('--json');
const VERBOSE = argv.includes('--verbose');

const read = (p) => JSON.parse(fs.readFileSync(path.join(DATA, p), 'utf8'));
const walk = (dir) => {
  const out = [];
  const abs = path.join(DATA, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name)));
    else if (e.name.endsWith('.json')) out.push(path.join(dir, e.name));
  }
  return out;
};

// The same folding `game/src/core/topics.js` applies at the gate. Duplicated rather than imported
// so this tool runs on the data alone with no engine module graph behind it — a checker that only
// works when the game imports cleanly cannot tell you why the game does not import cleanly.
const topicKey = (id) => String(id == null ? '' : id)
  .toLowerCase().replace(/[‘’'`]/g, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

const COMPASS = {
  north: 0, 'north-east': 45, east: 90, 'south-east': 135,
  south: 180, 'south-west': 225, west: 270, 'north-west': 315,
};
// Smallest angle between two bearings, 0..180. `((a-b) % 360 + 540) % 360 - 180` is the signed
// difference wrapped into [-180, 180]; its magnitude is the distance.
const angDiff = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

const fails = [];
const warns = [];
const fail = (check, msg) => fails.push({ check, msg });
const warn = (check, msg) => warns.push({ check, msg });

// ---------------------------------------------------------------------------- the world's names
const pois = read('world/pois.json').pois || [];
const roads = read('world/roads.json');
const signs = read('world/signposts.json').signposts || [];
const dirs = read('dialogue/road-directions.json');

const settlementFiles = fs.existsSync(path.join(DATA, 'world/settlements'))
  ? fs.readdirSync(path.join(DATA, 'world/settlements')).filter((f) => f.endsWith('.json'))
  : [];
const settlementIds = new Set(settlementFiles.map((f) => f.replace(/\.json$/, '')));

const poiById = new Map(pois.map((p) => [p.id, p]));
const poiByName = new Map();
for (const p of pois) if (p.name) poiByName.set(p.name.toLowerCase(), p);

const legs = roads.legs || roads.roads || [];
const legById = new Map();
for (const l of legs) if (l.id) legById.set(l.id, l);

const waystations = roads.waystations || [];
const waystationIds = new Set(waystations.map((w) => w.id).filter(Boolean));
const regionIds = new Set(((read('world/regions.json').regions) || []).map((r) => r.id).filter(Boolean));
const signIds = new Set(signs.map((s) => s.id));

// every topic id the province actually holds, folded
const topicIds = new Set();
for (const rel of walk('dialogue/topics')) {
  for (const t of (read(rel).topics || [])) if (t && t.id) topicIds.add(topicKey(t.id));
}

// every `actor` archetype somebody in the province really has
const actors = new Set();
for (const rel of walk('npcs')) {
  for (const n of (read(rel).npcs || [])) if (n && n.actor) actors.add(n.actor);
}

/** Resolve a place NAME the way a player would read it off a sign: a settlement, or a POI. */
function resolvePlace(name) {
  if (!name) return null;
  const k = String(name).toLowerCase();
  if (settlementIds.has(k)) return { kind: 'settlement', id: k };
  if (poiById.has(k)) return { kind: poiById.get(k).kind, id: k };
  if (poiByName.has(k)) return { kind: poiByName.get(k).kind, id: poiByName.get(k).id };
  return null;
}

/** The world position of a named place, for the bearing check. */
function posOf(name) {
  const r = resolvePlace(name);
  if (!r) return null;
  const p = poiById.get(r.id) || poiByName.get(String(name).toLowerCase());
  return p && p.pos ? { x: p.pos[0], z: p.pos[2] } : null;
}

// ------------------------------------------------------------------ A/B/C — the posts themselves
let armCount = 0;
for (const s of signs) {
  if (!s.id) { fail('A', 'a signpost has no id'); continue; }

  // C — the leg the post stands on
  if (s.at && s.at.leg) {
    const leg = legById.get(s.at.leg);
    if (!leg) fail('C', `${s.id}: stands on leg '${s.at.leg}', which is not in roads.json`);
    else if (s.at.at_m != null && leg.length_m != null && (s.at.at_m < 0 || s.at.at_m > leg.length_m + 1)) {
      fail('C', `${s.id}: at_m ${s.at.at_m} is off the end of leg '${s.at.leg}' (${leg.length_m} m)`);
    }
  }
  if (s.region && regionIds.size && !regionIds.has(s.region)) {
    warn('C', `${s.id}: region '${s.region}' is not in world/regions.json`);
  }

  for (const a of s.arms || []) {
    armCount++;
    const label = `${s.id}/${a.name || a.to}`;

    // A — the destination is somewhere
    const byId = a.to ? resolvePlace(a.to) : null;
    const byName = a.name ? resolvePlace(a.name) : null;
    if (!byId && !byName) {
      fail('A', `${label}: points at '${a.name || a.to}', which is neither a settlement nor a POI`);
      continue;
    }

    // C — the leg it says it goes by
    if (a.via_leg && !legById.has(a.via_leg)) {
      fail('C', `${label}: via_leg '${a.via_leg}' is not a leg of roads.json`);
    }

    // B — the compass word against the arm's own bearing
    if (a.compass != null) {
      if (!(a.compass in COMPASS)) {
        fail('B', `${label}: compass word '${a.compass}' is not one of the eight points`);
      } else if (a.bearing_deg != null) {
        const skew = angDiff(COMPASS[a.compass], a.bearing_deg);
        if (skew > 22.5) fail('B', `${label}: says ${a.compass} but its own bearing is ${a.bearing_deg}° (${skew.toFixed(1)}° off)`);
      }
    }

    // B — the bearing against the real geometry. This is the check that cannot be satisfied by
    // internally-consistent nonsense: it goes back to the positions in pois.json.
    const dst = posOf(a.to) || posOf(a.name);
    if (dst && s.x != null && s.z != null) {
      // Compass bearing, clockwise from north, in the world's own convention: +z runs SOUTH, so
      // the z term is negated. `tools/world/build-signposts.mjs` line 84 does the same, and
      // getting this wrong flags all 68 arms as pointing backwards while the data is fine —
      // which is what the first draft of this tool did.
      const trueBearing = (Math.atan2(dst.x - s.x, -(dst.z - s.z)) * 180 / Math.PI + 360) % 360;
      if (a.bearing_deg != null) {
        const skew = angDiff(trueBearing, a.bearing_deg);
        // A road is not a straight line, so an arm points along the ROAD rather than at the
        // place; 90° is the generous bound that still catches a sign pointing backwards.
        if (skew > 90) fail('B', `${label}: bearing ${a.bearing_deg}° but the place lies at ${trueBearing.toFixed(1)}° (${skew.toFixed(1)}° off — the post points away from it)`);
        else if (skew > 60 && VERBOSE) warn('B', `${label}: ${skew.toFixed(1)}° between the arm and the straight line (road curvature)`);
      }
    }
  }
}

// ------------------------------------------------------------ D/E/F — the spoken directions
const routes = dirs.routes || [];
let answerCount = 0; const truths = { true: 0, vague: 0, wrong: 0 };
for (const r of routes) {
  const label = r.id || '(unnamed route)';
  if (!settlementIds.has(r.from)) fail('D', `${label}: from '${r.from}' is not a settlement`);
  if (!resolvePlace(r.to)) fail('D', `${label}: to '${r.to}' is neither a settlement nor a POI`);
  if (r.leg && !legById.has(r.leg)) fail('D', `${label}: leg '${r.leg}' is not in roads.json`);
  if (!r.topic) fail('D', `${label}: has no topic id`);
  else if (!topicIds.has(topicKey(r.topic))) {
    fail('D', `${label}: topic '${r.topic}' does not exist in dialogue/topics/ — nobody can be asked it`);
  }

  for (const a of r.answers || []) {
    answerCount++;
    const t = a.truth || 'true';
    if (!(t in truths)) fail('D', `${label}: answer truth '${t}' is not true|vague|wrong`);
    else truths[t]++;

    // F — somebody in the world actually is this
    if (a.a && !actors.has(a.a)) {
      fail('F', `${label}: answer keyed to actor '${a.a}', which no NPC in game/data/npcs/ has`);
    }
    if (!a.x || typeof a.x !== 'string' || a.x.length < 20) {
      fail('D', `${label}: an answer has no words`);
    }

    // E — a lie must be catchable
    if (t === 'wrong') {
      if (!a.tell || !a.tell.trim()) {
        fail('E', `${label}: a WRONG answer with no \`tell\` — a lie nobody can catch is a defect, not a feature`);
      }
      const ids = a.tell_ids || [];
      if (!ids.length) {
        fail('E', `${label}: a WRONG answer with no \`tell_ids\` — nothing in the built world is named as contradicting it`);
      }
      for (const id of ids) {
        const ok = signIds.has(id) || waystationIds.has(id) || poiById.has(id) || legById.has(id) || regionIds.has(id) || settlementIds.has(id);
        if (!ok) fail('E', `${label}: tell_id '${id}' resolves to no signpost, waystation, POI, leg, region or settlement`);
      }
    } else if (a.tell || a.tell_ids) {
      warn('E', `${label}: a ${t} answer carries a tell; tells belong to wrong answers`);
    }
  }
}

// ------------------------------------------------------- G — the named routes resolve to legs
//
// `named_routes` is where RI-WLD01 §5 keeps THE CROSSING and THE LONG WAY. `Engine.walkRoute()`
// resolves a route's legs by SETTLEMENT PAIR and never reads the `legs` array, so a wrong id in
// it breaks nothing at boot and sits there being wrong — which is what had happened: two of THE
// LONG WAY's four legs (`thorn-stormhold`, `blackrose-soulrest`) were composed from the settlement
// order the route walks rather than the order the leg was authored in, and resolved to nothing.
// `tools/world/build-hearths.mjs` DOES walk `named_routes.crossing.legs` by id and only escaped
// because the crossing happens to be authored in its walking direction. A field that is right by
// luck is a trap for whoever reads it next, so it gets a check.
const namedRoutes = roads.named_routes || {};
for (const [name, route] of Object.entries(namedRoutes)) {
  for (const id of route.legs || []) {
    if (!legById.has(id)) fail('G', `named route '${name}': leg '${id}' is not in roads.json — the route cannot be walked by id`);
  }
  for (const s of route.settlements || []) {
    if (!settlementIds.has(String(s).toLowerCase())) fail('G', `named route '${name}': names settlement '${s}', which has no record in world/settlements/`);
  }
  if ((route.legs || []).length !== Math.max(0, (route.settlements || []).length - 1)) {
    fail('G', `named route '${name}': ${route.legs.length} legs for ${route.settlements.length} settlements — the chain has a hole in it`);
  }
}

// ------------------------------------------- H — is there a lit landmark to steer by at night?
//
// REPORTED, NOT ENFORCED, and deliberately so. `game/data/world/signatures.json` is RI-WLD04
// M19's artefact and this piece does not own it; landing a hard failure against 840 instances
// another item generates would be a fail-closed assertion over data that is not mine to move.
// What this piece owes is the MEASUREMENT, because the number is a wayfinding fact and nothing
// else in the tree takes it.
//
// The finding: of the 13 signature kinds, exactly ONE is placed deliberately beside a road —
// `imperial_milestone`, `wants: 'roadside'` in game/src/world/signature.js — and its `glow` is 0.
// Every kind that DOES glow is placed by region fill and then actively pushed off the road by
// build-signatures.mjs's `rdist.d < rdist.seg.hw * 3.4 + reach + 4` rule. The consequence is
// structural rather than unlucky: a walker on THE CROSSING at night passes plenty of landmarks
// and not one of them is lit.
const LAMP_M = 160;   // the range a glowing signature is a landmark at, per the lighting model
const glowKinds = new Set((sig_counts_glow()).map((c) => c.kind));
function sig_counts_glow() {
  const s = read('world/signatures.json');
  return (s.counts || []).filter((c) => c.glow);
}
const sigDoc = read('world/signatures.json');
const lit = { checked: 0, rows: [] };
for (const [name, route] of Object.entries(namedRoutes)) {
  const pts = [];
  for (const id of route.legs || []) {
    const leg = legById.get(id);
    // roads.json points are [x, z, y]; pois.json `pos` is [x, y, z]. They are NOT the same order
    // and mixing them up silently reports every distance as nonsense.
    if (leg) for (const p of leg.points || []) pts.push([p[0], p[1]]);
  }
  if (!pts.length) continue;
  lit.checked++;
  let nearestGlow = Infinity, nearestAny = Infinity, withinGlow = 0, withinAny = 0;
  for (const inst of sigDoc.instances || []) {
    let d = Infinity;
    for (const [x, z] of pts) { const q = Math.hypot(inst.x - x, inst.z - z); if (q < d) d = q; }
    if (d < nearestAny) nearestAny = d;
    if (d <= LAMP_M) withinAny++;
    if (glowKinds.has(inst.kind)) {
      if (d < nearestGlow) nearestGlow = d;
      if (d <= LAMP_M) withinGlow++;
    }
  }
  // The waylamps. W1-05 answers H inside its own furniture rather than by moving RI-WLD04's 840
  // instances: junction and waystation posts carry a lamp coloured by the region they stand in.
  // The number that matters is not "is there a lit thing on this route" — one lamp would satisfy
  // that and tell a walker nothing. It is THE LONGEST STRETCH OF THIS ROUTE WITH NO LIT THING
  // WITHIN LAMP RANGE, which is how far you walk in the dark with nothing to steer at, and it is
  // reported whether it improved or not.
  let cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  const litAt = [];
  for (const s of signs) {
    if (!s.lamp) continue;
    let bd = Infinity, bi = 0;
    for (let i = 0; i < pts.length; i++) {
      const q = Math.hypot(s.x - pts[i][0], s.z - pts[i][1]);
      if (q < bd) { bd = q; bi = i; }
    }
    if (bd <= LAMP_M) litAt.push({ id: s.id, s: cum[bi], off_m: +bd.toFixed(1) });
  }
  litAt.sort((a, b) => a.s - b.s);
  // A walker is lit while within LAMP_M of a lamp, measured ALONG the road, so each lamp covers
  // a window either side of where it stands. The dark stretches are what is left between them.
  let dark = 0, cursor = 0;
  for (const L of litAt) {
    const lo = Math.max(0, L.s - LAMP_M);
    if (lo > cursor) dark = Math.max(dark, lo - cursor);
    cursor = Math.max(cursor, Math.min(total, L.s + LAMP_M));
  }
  dark = Math.max(dark, total - cursor);

  lit.rows.push({
    route: name,
    nearest_glow_m: +nearestGlow.toFixed(1),
    nearest_any_m: +nearestAny.toFixed(1),
    glow_within_lamp: withinGlow,
    any_within_lamp: withinAny,
    waylamps_on_route: litAt.length,
    longest_dark_stretch_m: Math.round(dark),
    lit_fraction: +(1 - dark / total).toFixed(3),
  });
  if (withinGlow === 0 && litAt.length === 0) {
    warn('H', `${name}: NO lit thing of any kind within the ${LAMP_M} m lamp range anywhere along ${(route.metres || 0)} m of road ` +
      `(nearest glowing signature ${nearestGlow.toFixed(0)} m off; ${withinAny} unlit signatures ARE within lamp range, nearest ${nearestAny.toFixed(1)} m). ` +
      'Cause: imperial_milestone is the only roadside signature kind and it does not glow, and no post on this route carries a waylamp.');
  } else if (withinGlow === 0) {
    warn('H', `${name}: no glowing SIGNATURE within ${LAMP_M} m of the road (nearest ${nearestGlow.toFixed(0)} m off) — ` +
      `${litAt.length} waylamp(s) on the route carry the night signal instead, leaving a longest dark stretch of ${Math.round(dark)} m ` +
      `over ${Math.round(total)} m. The signature half is RI-WLD04's: imperial_milestone is its only roadside kind and its glow is 0.`);
  }
}

// ------------------------------------------------------------------------------------ the report
const summary = {
  signposts: signs.length,
  night_landmarks: lit.rows,
  arms: armCount,
  routes: routes.length,
  answers: answerCount,
  truths,
  settlements: settlementIds.size,
  pois: pois.length,
  legs: legById.size,
  topics_checked: routes.length,
  failures: fails.length,
  warnings: warns.length,
};

if (AS_JSON) {
  console.log(JSON.stringify({ summary, failures: fails, warnings: warns }, null, 2));
} else {
  console.log(`signpost-audit: ${summary.signposts} posts / ${summary.arms} arms, ${summary.routes} routes / ${summary.answers} spoken answers ` +
    `(${truths.true} true, ${truths.vague} vague, ${truths.wrong} wrong)`);
  console.log(`  resolved against ${summary.settlements} settlements, ${summary.pois} POIs, ${summary.legs} road legs, ${topicIds.size} topic ids, ${actors.size} actor archetypes`);
  for (const w of warns) console.log(`  warn  [${w.check}] ${w.msg}`);
  for (const f of fails) console.log(`  FAIL  [${f.check}] ${f.msg}`);
  console.log(fails.length
    ? `signpost-audit: ${fails.length} FAILURES — a sign or a sentence names somewhere that is not there.`
    : 'signpost-audit: every name points at somewhere that exists, and every lie is catchable.');
}

process.exit(fails.length ? 1 : 0);
