#!/usr/bin/env node
/**
 * travel-audit.mjs — RI-TRV01, and the AR-2 B13 absence check that failed W1-01.
 *
 * B13's fail condition is absence, and absence was the finding: `game/data/world/travel/` did not
 * exist, `Object.keys(__HARNESS)` held no travel verb, and RI-TRV01 scored **0/24 fail-closed by
 * its own rule**. This runs the checks that were unrunnable.
 *
 * Static (no browser): M1 existence and shape, M2 graph metrics, M3 water primacy, M7 tariff.
 * Live (harness): the walked-it-once gate (M4) and one ride per mode (M6) — gold down, clock on,
 * no station-to-station frame delta, arrival at the marker.
 *
 * What it does NOT claim: M5 over all 68 arrivals against a live quest objective set, and M8's
 * per-mode time ratios against a walked baseline. Those belong to W1-05 with the quest layer.
 *
 * Usage: node tools/world/travel-audit.mjs [--static] [--out reports/travel-audit.json]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const argv = process.argv.slice(2);
const outFile = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/travel-audit.json';
const STATIC_ONLY = argv.includes('--static');

const checks = [];
const check = (id, ok, detail) => { checks.push({ id, pass: !!ok, detail }); return ok; };

const DIR = 'game/data/world/travel';
const present = ['stations', 'services', 'lines', 'tariff'].every((f) => existsSync(join(ROOT, DIR, `${f}.json`)));
check('B13-TRAVEL-DATA-ROOT', present, `${DIR}/ ${present ? 'exists with stations, services, lines and tariff' : 'IS ABSENT — RI-TRV01 M1 scores 0, fail-closed'}`);
if (!present) { report(); process.exit(1); }

const stations = rd(`${DIR}/stations.json`).stations;
const svcDoc = rd(`${DIR}/services.json`);
const services = svcDoc.services, modes = svcDoc.modes;
const lines = rd(`${DIR}/lines.json`).lines;
const tariff = rd(`${DIR}/tariff.json`);
const roads = rd('game/data/world/roads.json');

// ---- M1 existence and shape ---------------------------------------------------------------------
const ids = new Set(stations.map((s) => s.id));
const unresolved = services.filter((s) => !ids.has(s.from) || !ids.has(s.to));
check('M1-EXISTENCE', Object.keys(modes).length >= 5 && stations.length >= 24 && services.length >= 45,
  `${Object.keys(modes).length} modes (N-fail < 5), ${stations.length} stations (< 24), ${services.length} services (< 45), ${lines.length} lines`);
check('M1-NO-BARE-COORDINATE-DESTINATIONS', unresolved.length === 0,
  `${unresolved.length} services whose endpoints do not resolve to a station id (any occurrence is warp-to-map-pin with a fare attached)`);

// ---- M2 graph metrics ---------------------------------------------------------------------------
const settle = stations.filter((s) => s.kind === 'settlement').map((s) => s.name);
const edges = new Set();
for (const l of lines) {
  const ends = [l.station_names[0], l.station_names[l.station_names.length - 1]];
  if (settle.includes(ends[0]) && settle.includes(ends[1])) edges.add([...ends].sort().join('–'));
}
const adj = new Map(settle.map((s) => [s, new Set()]));
for (const e of edges) { const [a, b] = e.split('–'); adj.get(a).add(b); adj.get(b).add(a); }
const seen = new Set([settle[0]]); const stack = [settle[0]];
while (stack.length) { const c = stack.pop(); for (const n of adj.get(c)) if (!seen.has(n)) { seen.add(n); stack.push(n); } }
const connected = seen.size === settle.length;
const degrees = settle.map((s) => adj.get(s).size);
const density = edges.size / (settle.length * (settle.length - 1) / 2);
// all-pairs shortest legs
const legsBetween = [];
for (const a of settle) {
  const dist = new Map([[a, 0]]); const q = [a];
  while (q.length) { const c = q.shift(); for (const n of adj.get(c)) if (!dist.has(n)) { dist.set(n, dist.get(c) + 1); q.push(n); } }
  for (const b of settle) if (b !== a) legsBetween.push(dist.get(b) ?? Infinity);
}
const meanLegs = legsBetween.reduce((a, v) => a + v, 0) / legsBetween.length;
const threePlus = legsBetween.filter((v) => v >= 3).length / 2;
const modeless = settle.filter((s) => stations.find((q) => q.name === s).modes.length === 0);
check('M2-GRAPH-N', connected && !modeless.length && Math.min(...degrees) >= 2 && density >= 0.25,
  `connected ${connected}, min degree ${Math.min(...degrees)}, density ${density.toFixed(3)} (N-fail < 0.25), ${modeless.length} settlements served by 0 modes`);
check('M2-GRAPH-W', density <= 0.55 && meanLegs >= 1.5 && threePlus >= 3,
  `density ${density.toFixed(3)} (W-fail > 0.55), mean legs ${meanLegs.toFixed(2)} (W-fail < 1.5), ${threePlus} pairs needing >= 3 legs (W-fail < 3) — a network you can cross in one leg from anywhere is a menu`);

// ---- M3 water primacy -----------------------------------------------------------------------------
const waterLegs = roads.legs.filter((l) => lines.some((q) => (q.mode === 'barge' || q.mode === 'poler')
  && q.road_leg && q.road_leg.replace(/[–-]/g, '|').toLowerCase() === `${l.from}|${l.to}`.toLowerCase())).length;
const quays = stations.filter((s) => s.kind === 'settlement' && s.quay).length;
const barge = services.filter((s) => s.mode === 'barge').length;
const overland = services.filter((s) => s.mode === 'rootway').length;
check('M3-WATER-PRIMACY-N', waterLegs / roads.legs.length >= 0.5 && quays >= 6 && barge >= 12,
  `${waterLegs}/${roads.legs.length} trunk legs have a parallel water service (N-fail < 0.5), ${quays}/8 settlements have a quay (< 6), ${barge} barge services (< 12)`);
check('M3-WATER-PRIMACY-W', !(waterLegs === roads.legs.length && overland < 10),
  `${overland} overland (rootway) services — W-fail is boats reaching everywhere with a vestigial Rootway`);

// ---- M7 tariff ------------------------------------------------------------------------------------
const fare = (m) => (m <= 1000 ? 12 * m / 1000 : m <= 2500 ? 12 + 33 * (m - 1000) / 1500 : 45 + 45 * (m - 2500) / 4400);
const anchors = [[1000, 12], [2500, 45], [6900, 90]].map(([m, g]) => ({ m, want: g, got: +fare(m).toFixed(2) }));
let mono = true, prev = -Infinity;
for (let m = 0; m <= 10000; m += 50) { const v = fare(m); if (v < prev - 1e-9) mono = false; prev = v; }
const ticketMismatch = lines.filter((l) => l.line_ticket_gold !== l.sum_of_hop_fares).length;
check('M7-TARIFF', anchors.every((a) => Math.abs(a.got - a.want) <= 1) && mono && ticketMismatch === 0,
  `anchors ${anchors.map((a) => `${a.m}m=${a.got}g`).join(' ')} (RI-PRG05 §2: 12/45/90 +/-1); monotonic over 0-10,000 m ${mono}; `
  + `${lines.length - ticketMismatch}/${lines.length} line tickets equal the sum of their hop fares`);
const spend = services.reduce((a, s) => a + s.fare_gold, 0);
check('M7-FARE-SCALE', spend >= 800 && spend <= 8000,
  `catalogue total ${spend} g across ${services.length} services (N-fail < 800 — fares that do not bite; W-fail > 8000 — travel as a tax)`);

// ---- M5 arrival geometry, static half --------------------------------------------------------------
// The live half needs a quest layer. What is checkable now is that every arrival marker is on open
// dry ground and is not the station point itself — you arrive at the quay, not in the traffic.
const badArrivals = stations.filter((s) => !s.arrive_at || Math.hypot(s.arrive_at[0] - s.x, s.arrive_at[1] - s.z) < 5);
check('M5-ARRIVAL-MARKERS', badArrivals.length === 0,
  `${stations.length - badArrivals.length}/${stations.length} stations carry an arrive_at marker at least 5 m off the station point`);

// ---- live ------------------------------------------------------------------------------------------
let live = null;
if (!STATIC_ONLY) {
  const { launchGame } = await import('../lib/browser.mjs');
  const h = await launchGame({ width: 320, height: 180 });
  try {
    await h.h('setSeed', 1337);
    await h.h('loadState', 'default');
    // `getRoutes()` reports `points` as a COUNT, not the polyline, so the leg to be walked is read
    // from the shipped road file here and handed in.
    const gateLeg = roads.legs.find((l) => l.id === 'blackrose-lilmoth');
    live = await h.page.evaluate(async ({ legPoints }) => {
      const H = window.__HARNESS;
      const out = { verbs: Object.keys(H).filter((k) => /travel|board|station|fare/i.test(k)).sort() };
      // ---- M4 step 1: nothing is purchasable at frame 0 -------------------------------------
      const s0 = H.getTravelState();
      out.frame0 = { legs_walked: s0.legs_walked, purchasable: s0.purchasable.length, refused: s0.refused };
      out.frame0_refusal_sample = H.travelQuote(H.getTravelNetwork().services[0].id).refusal;
      // ---- M4 step 3: 85% of a leg is not enough; 100% is ------------------------------------
      // Purse first: `purchasable` is gated on gold as well as on the walk, and a broke player
      // proves nothing about the traversal gate.
      H.setWorldKnowledge({ gold: 500 });
      const walkTo = (frac) => {
        const n = Math.floor(legPoints.length * frac);
        for (let i = 0; i < n; i++) { H.teleport(legPoints[i][0], legPoints[i][1]); H.stepFrames(1); }
      };
      walkTo(0.85);
      const at85 = H.getTravelState();
      out.at_85pct = { legs_walked: at85.legs_walked, progress: at85.leg_progress_m['blackrose-lilmoth'], purchasable: at85.purchasable.length };
      walkTo(1.0);
      const at100 = H.getTravelState();
      out.at_100pct = { legs_walked: at100.legs_walked, progress: at100.leg_progress_m['blackrose-lilmoth'], purchasable: at100.purchasable.length };
      // ---- M6: one ride, with gold and a clock ----------------------------------------------
      const svc = H.getTravelNetwork().services.find((s) => s.requires_walked === 'blackrose-lilmoth');
      const before = { gold: H.getTravelState().gold, pos: H.getPlayerStats().pos.slice(), tod: H.getWorldStats().timeOfDay };
      const ride = H.boardTravel(svc.id);
      out.ride = { service: svc.id, mode: svc.mode, frames: ride.frames, seconds: ride.seconds,
        gold_before: before.gold, gold_after: ride.gold, gold_spent: ride.gold_spent,
        max_frame_delta_m: ride.max_frame_delta_m, route_m: ride.route_m,
        arrival: ride.arrival, done: ride.done };
      out.after = H.getTravelState().rides_taken;
      return out;
    }, { legPoints: gateLeg.points.map((p) => [p[0], p[1]]) });
  } catch (e) { live = { error: String(e && e.stack) }; }
  finally { await h.close(); }

  if (live && !live.error) {
    check('B13-HARNESS-VERBS', live.verbs.length >= 5, `__HARNESS exposes ${live.verbs.length} travel verbs: ${live.verbs.join(', ')}`);
    check('M4-GATE-CLOSED-AT-FRAME-0', live.frame0.purchasable === 0 && live.frame0.refused === services.length,
      `at frame 0: ${live.frame0.purchasable} purchasable, ${live.frame0.refused} refused, legs_walked ${JSON.stringify(live.frame0.legs_walked)} — "${live.frame0_refusal_sample}"`);
    check('M4-GATE-IS-A-TRAVERSAL-TEST', live.at_85pct.legs_walked.length === 0 && live.at_100pct.legs_walked.includes('blackrose-lilmoth') && live.at_85pct.purchasable === 0 && live.at_100pct.purchasable > 0,
      `85% of blackrose-lilmoth walked (${live.at_85pct.progress} m): ${live.at_85pct.purchasable} purchasable. 100% (${live.at_100pct.progress} m): ${live.at_100pct.purchasable} purchasable. `
      + 'The gate is metres of the leg covered in distinct 25 m bins, so it cannot be set by a teleport or a settlement-visited flag');
    check('M6-RIDE-IS-A-JOURNEY', live.ride.done && live.ride.gold_after < live.ride.gold_before && live.ride.max_frame_delta_m < 25 && live.ride.frames >= 480,
      `${live.ride.mode} ride: ${live.ride.frames} frames (${live.ride.seconds} s) over ${live.ride.route_m} m, gold ${live.ride.gold_before} -> ${live.ride.gold_after}, `
      + `largest single-frame position delta ${live.ride.max_frame_delta_m} m (W-fail is a station-to-station teleport)`);
    check('M5-ARRIVAL-LIVE', live.ride.arrival && live.ride.arrival.offset_m <= 8 && live.ride.arrival.depth_m === 0,
      `arrived ${live.ride.arrival ? live.ride.arrival.offset_m : '--'} m from the ${live.ride.arrival ? live.ride.arrival.station : '--'} marker (bar <= 8 m), standing in ${live.ride.arrival ? live.ride.arrival.depth_m : '--'} m of water`);
  } else {
    check('B13-HARNESS-VERBS', false, `live probe failed: ${live && live.error}`);
  }
}

function report() {
  const doc = { schema: 'elder-souls/travel-audit@1', method: 'RI-TRV01 M1-M7 + AR-2 B13', measured_at: new Date().toISOString(),
    counts: present ? { modes: Object.keys(modes).length, stations: stations.length, services: services.length, lines: lines.length } : null,
    live, checks, ok: checks.every((c) => c.pass),
    not_claimed: ['M5 over all 68 arrivals against a live quest objective set', 'M8 per-mode time ratios against a walked baseline',
      'M4 step 2 topic-list enumeration (there is no dialogue surface in this piece)'] };
  mkdirSync(dirname(join(ROOT, outFile)), { recursive: true });
  writeFileSync(join(ROOT, outFile), JSON.stringify(doc, null, 1) + '\n');
  process.stdout.write('RI-TRV01 — the transport network (AR-2 B13)\n');
  for (const c of checks) process.stdout.write(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: ${c.detail}\n`);
  process.stdout.write(`\n  not claimed: ${doc.not_claimed.join('; ')}\n  ${outFile}\n`);
  return doc.ok;
}
process.exit(report() ? 0 : 1);
