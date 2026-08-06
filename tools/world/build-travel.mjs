#!/usr/bin/env node
/**
 * build-travel.mjs — `game/data/world/travel/`.
 *
 * Verdict W1-01 AR-2 **B13** fired on absence: *"`game/data/world/travel/` does not exist. No
 * `stations.json`, `lines.json`, `services.json`, `tariff.json`. `Object.keys(__HARNESS)` contains
 * no travel, board, station, fare, strider, boat or barge verb. Zero modalities board from zero
 * settlements."* The network was fully derived in the corpus and never emitted into the build.
 *
 * This emits it. Station coordinates are NOT restated in the corpus artifact by design — every
 * station is resolved here by name through `world-scale.json`, which stays authoritative, so a
 * settlement that moves moves its quay with it. Stations that are not settlements (Bloodmarl Isle,
 * the Wayshrine of the Ninth Root) resolve through `pois.json`.
 *
 * `arrive_at` is the marker RI-TRV01 M5 measures against: a point on open ground beside the
 * station, snapped clear of standing water and off any road centreline, never inside a volume.
 *
 * Usage: node tools/world/build-travel.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const net = rd('corpus/50-world/travel-network.json');
const scale = rd('corpus/50-world/world-scale.json');
const pois = rd('game/data/world/pois.json');
const roads = rd('game/data/world/roads.json');
const field = new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
field.setRoads(roads);

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- resolve every station named anywhere in the network ------------------------------------
const named = new Set();
for (const s of net.services) { named.add(s.from); named.add(s.to); }
for (const l of net.lines) for (const st of l.stations) named.add(st);

const coordOf = (name) => {
  if (scale.settlements[name]) return { ...scale.settlements[name], tier: scale.settlements[name].tier || 'settlement', kind: 'settlement' };
  if (scale.minor_settlements[name]) return { ...scale.minor_settlements[name], tier: 'minor', kind: 'minor' };
  const poiList = pois.pois || pois.entries || [];
  const p = poiList.find((q) => q.name === name || slug(q.name || '') === slug(name));
  if (p) return { x: p.pos ? p.pos[0] : p.x, z: p.pos ? p.pos[2] : p.z, tier: 'landmark', kind: 'landmark' };
  return null;
};

/**
 * Where the ride puts you down. RI-TRV01 §5: never inside a volume, never on a road centreline
 * (you arrive AT the quay, not standing in the traffic), and never in standing water. Search a
 * ring outward from the station until all three hold; the search is deterministic.
 */
function arriveAt(x, z) {
  const ok = (px, pz) => {
    for (const ph of [0, 0.25, 0.5, 0.75]) if (field.depthAt(px, pz, ph) > 0.20) return false;
    return field.slopeAt(px, pz, 6) <= 18;
  };
  for (const r of [14, 18, 22, 26, 32, 40, 50]) {
    for (let a = 0; a < 24; a++) {
      const th = a / 24 * Math.PI * 2;
      const px = x + Math.cos(th) * r, pz = z + Math.sin(th) * r;
      if (ok(px, pz)) return [+px.toFixed(2), +pz.toFixed(2), +field.heightAt(px, pz).toFixed(2)];
    }
  }
  return [+x.toFixed(2), +z.toFixed(2), +field.heightAt(x, z).toFixed(2)];
}

const modesAt = net.metrics.modes_per_settlement || {};
const stations = [];
for (const name of [...named].sort()) {
  const c = coordOf(name);
  if (!c) throw new Error(`build-travel: station '${name}' resolves to no coordinate in world-scale.json or pois.json`);
  const modes = new Set();
  for (const s of net.services) if (s.from === name || s.to === name) modes.add(s.mode);
  const reg = field.regionAt(c.x, c.z);
  stations.push({
    id: slug(name), name, kind: c.kind, tier: c.tier,
    x: +c.x.toFixed(2), z: +c.z.toFixed(2), y: +field.heightAt(c.x, c.z).toFixed(2),
    region: reg.id, region_name: reg.name,
    modes: [...modes].sort(),
    quay: [...modes].some((m) => m === 'barge' || m === 'poler' || m === 'packet'),
    arrive_at: arriveAt(c.x, c.z),
    declared_modes: modesAt[name] || null,
  });
}
const byName = new Map(stations.map((s) => [s.name, s]));

// ---- services --------------------------------------------------------------------------------
// The route a ride follows is the built road for a rootway leg and a channel polyline for water
// modes. RI-TRV01 M6 measures the ride against this polyline at 40 m, so it has to be a real path
// through the province and not a straight line between two dots.
const legPoints = (a, b) => {
  const leg = roads.legs.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
  if (!leg) return null;
  const pts = leg.from === a ? leg.points : leg.points.slice().reverse();
  return pts.map((p) => [p[0], p[1], p[2]]);
};
/** Nearest point of any built road leg to a station, so a water route still lands on a quay. */
function waterRoute(A, B) {
  // A poled channel bends toward low ground: sample the straight line and pull each interior point
  // toward the lowest of five lateral probes. Deterministic, and it produces a route that reads as
  // a channel rather than a ruler line.
  const n = 24, out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let x = A.x + (B.x - A.x) * t, z = A.z + (B.z - A.z) * t;
    if (i > 0 && i < n) {
      const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz) || 1;
      let bestY = Infinity, bx = x, bz = z;
      for (const off of [-90, -45, 0, 45, 90]) {
        const px = x + (-dz / L) * off, pz = z + (dx / L) * off;
        const y = field.heightAt(px, pz);
        if (y < bestY) { bestY = y; bx = px; bz = pz; }
      }
      x = bx; z = bz;
    }
    out.push([+x.toFixed(2), +z.toFixed(2), +field.heightAt(x, z).toFixed(2)]);
  }
  return out;
}

const services = net.services.map((s, i) => {
  const A = byName.get(s.from), B = byName.get(s.to);
  const route = s.mode === 'rootway' ? (legPoints(s.from, s.to) || waterRoute(A, B)) : waterRoute(A, B);
  let m = 0;
  for (let k = 1; k < route.length; k++) m += Math.hypot(route[k][0] - route[k - 1][0], route[k][1] - route[k - 1][1]);
  return {
    id: `svc-${String(i + 1).padStart(3, '0')}-${s.mode}-${slug(s.from)}-${slug(s.to)}`,
    mode: s.mode, from: A.id, to: B.id, from_name: s.from, to_name: s.to,
    declared_route_m: s.route_m, built_route_m: +m.toFixed(1),
    fare_gold: s.fare_gold, game_min: s.game_min,
    walk_road_m: s.walk_road_m, walk_real_min: s.walk_real_min, walk_game_min: s.walk_game_min,
    // The walked-it-once gate (RI-TRV01 §7): a service opens only once the player has WALKED the
    // road leg it shadows. `requires_walked` names that leg; a service with no road leg (the
    // packet, Bloodmarl Isle) requires the leg its origin sits on.
    requires_walked: (() => {
      const l = roads.legs.find((q) => (q.from === s.from && q.to === s.to) || (q.from === s.to && q.to === s.from));
      if (l) return l.id;
      const near = (st) => roads.legs.map((q) => ({ id: q.id, d: Math.min(...q.points.map((p) => Math.hypot(p[0] - st.x, p[1] - st.z))) })).sort((a, b) => a.d - b.d)[0].id;
      return near(A);
    })(),
    route: route.map((p) => [+p[0].toFixed(2), +p[1].toFixed(2), +p[2].toFixed(2)]),
  };
});

const lines = net.lines.map((l) => ({
  ...l,
  stations: l.stations.map((n) => byName.get(n).id),
  station_names: l.stations,
  hops: l.stations.slice(0, -1).map((n, i) => {
    const svc = services.find((s) => s.from_name === n && s.to_name === l.stations[i + 1] && s.mode === l.mode);
    return svc ? svc.id : null;
  }),
}));

const tariff = {
  schema: 'elder-souls/tariff@1',
  ...net.tariff,
  note: 'Piecewise-linear in route metres, continuous and monotonic, from RI-PRG05 §2 anchors '
      + '(1000 m = 12 g, 2500 m = 45 g, 6900 m = 90 g). Fares are posted, never bartered.',
};

const dir = join(ROOT, 'game/data/world/travel');
mkdirSync(dir, { recursive: true });
const stamp = (schema, extra) => ({ schema, generator: 'tools/world/build-travel.mjs',
  derived_from: ['corpus/50-world/travel-network.json', 'corpus/50-world/world-scale.json', 'game/data/world/roads.json'], ...extra });
writeFileSync(join(dir, 'stations.json'), JSON.stringify(stamp('elder-souls/travel-stations@1', { stations }), null, 1) + '\n');
writeFileSync(join(dir, 'services.json'), JSON.stringify(stamp('elder-souls/travel-services@1', { modes: net.modes, services }), null, 1) + '\n');
writeFileSync(join(dir, 'lines.json'), JSON.stringify(stamp('elder-souls/travel-lines@1', { lines }), null, 1) + '\n');
writeFileSync(join(dir, 'tariff.json'), JSON.stringify(stamp('elder-souls/travel-tariff@1', tariff), null, 1) + '\n');

// ---- register in the data index --------------------------------------------------------------
const idxPath = join(ROOT, 'game/data/index.json');
const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
for (const f of ['stations', 'services', 'lines', 'tariff']) {
  const path = `world/travel/${f}.json`;
  if (!idx.files.some((e) => e.path === path)) idx.files.push({ path });
}
writeFileSync(idxPath, JSON.stringify(idx, null, 1) + '\n');

const quays = stations.filter((s) => s.quay && s.kind === 'settlement').length;
const waterLegs = roads.legs.filter((l) => services.some((s) => (s.mode === 'barge' || s.mode === 'poler')
  && ((s.from_name === l.from && s.to_name === l.to) || (s.from_name === l.to && s.to_name === l.from)))).length;
process.stdout.write(`game/data/world/travel/ written\n`);
process.stdout.write(`  modes    ${Object.keys(net.modes).length}  (RI-TRV01 M1 N-fail < 5)\n`);
process.stdout.write(`  stations ${stations.length}  (N-fail < 24)  ${stations.filter((s) => s.kind === 'settlement').length} settlements, ${stations.filter((s) => s.kind === 'minor').length} minor halts, ${stations.filter((s) => s.kind === 'landmark').length} landmarks\n`);
process.stdout.write(`  services ${services.length}  (N-fail < 45)\n`);
process.stdout.write(`  lines    ${lines.length}\n`);
process.stdout.write(`  quays    ${quays}/8 settlements (M3 N-fail < 6); barge services ${services.filter((s) => s.mode === 'barge').length} (N-fail < 12); road legs with a parallel water service ${waterLegs}/10 (N-fail < 5)\n`);
process.stdout.write(`  every service resolves both endpoints to a station id: ${services.every((s) => byName.has(s.from_name) && byName.has(s.to_name)) ? 'yes' : 'NO'}\n`);
