#!/usr/bin/env node
/**
 * hazard-fire.mjs — RI-WLD11 M58/M59, measured on the running world.
 *
 * The round-2 critic's instrument stood at each region centroid for 60 s and reported
 * `hp 620 -> 620` thirteen times. Two things were wrong with the world and one with the
 * instrument, and all three matter:
 *
 *   * the world: `hazards.json` was loaded and read by nothing. Fixed — `game/src/sim/hazards.js`.
 *   * the world: a hazard is a VOLUME, and a region centroid is not guaranteed to be inside one.
 *     Standing at the centre of Blackwood and concluding that Blackwood has no hazard is the same
 *     error as standing in a field and concluding that the sea does not exist.
 *   * the instrument: **six of the nineteen hazards do no HP damage by design.** RI-WLD11 M57
 *     requires at least six with `damage.kind: "none"` — a VECTOR gives you a disease, a GATE
 *     closes a route, a STRANDING leaves you on the wrong side of the water. A health bar cannot
 *     measure any of them.
 *
 * So this walks to each hazard rather than standing at a centroid, restores full HP between
 * hazards so one death does not zero every subsequent reading, and reports what FIRED — the
 * `hazard_tell` frame, the first damage frame, the telegraph gap in seconds, and the outcome —
 * alongside the HP where HP is the consequence.
 *
 * Usage: node tools/world/hazard-fire.mjs [--out reports/hazard-fire.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { launchGame } from '../lib/browser.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const outFile = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/hazard-fire.json';
const SCORE_BY_TABLE = argv.includes('--score-by-table');   // the delete-the-fix arm
const GIT = (() => {
  try {
    const q = (c) => execSync(c, { cwd: ROOT }).toString().trim();
    return { commit: q('git rev-parse HEAD'), branch: q('git rev-parse --abbrev-ref HEAD'), dirty: q('git status --porcelain').length > 0 };
  } catch { return null; }
})();
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const hazards = rd('game/data/world/hazards.json').hazards;
const regions = rd('game/data/world/regions.json').regions;
const sigs = rd('game/data/world/signatures.json').instances;

// Where to stand for each hazard. Anchored hazards get the position of a placed instance of the
// element they hang off; condition hazards get a sampled point in their region that satisfies them.
const ANCHOR_KIND = {
  'kiln-ground': 'naga_kiln_dome', 'comb-collapse': 'comb_cliff', voriplasm: 'voriplasm',
  'dye-fume': 'open_dye_vat', 'hist-sap-fume': 'petrified_bole', 'spore-bloom': 'welkynd_pillar',
  'strangler-snare': 'welkynd_pillar', 'press-gang-water': 'root_arch', 'pair-lightning': 'petrified_bole',
};
const WEATHER_FOR = { 'ash-lung': 'ashfall', 'salt-storm': 'salt_storm', 'pair-lightning': 'dry_thunder' };
const TIDE_FOR = { 'high-tide-gate': 'HIGH', 'cut-off-by-the-tide': 'RISING', 'the-flats-flood': 'RISING' };

const handle = await launchGame({ width: 320, height: 180 });
const out = {
  schema: 'w1-01/hazard-fire@2', measured_at: new Date().toISOString(), git: GIT,
  scored_by: SCORE_BY_TABLE ? 'table (getHazardReport().fired) — DELETE-THE-FIX ARM' : 'body (HP lost / affliction caught / route closed / death)',
  hazards: [],
};
try {
  await handle.h('setSeed', 1337);
  await handle.h('loadState', 'default');

  for (const h of hazards) {
    const kind = ANCHOR_KIND[h.id];
    let sites = [];
    if (kind) {
      sites = sigs.filter((s) => s.kind === kind).slice(0, 6).map((s) => [s.x, s.z]);
    } else {
      // Sample the region the hazard's own `regions` array names, and let the world tell us which
      // sample is inside the volume — the predicate is the world's, not this script's.
      for (const rn of h.regions) {
        const r = regions.find((q) => q.name === rn);
        if (!r) continue;
        const bb = r.bounds_m;
        for (let i = 0; i < 90; i++) {
          const t = (i * 2654435761) % 1000 / 1000, u = (i * 40503) % 997 / 997;
          sites.push([bb.x[0] + t * (bb.x[1] - bb.x[0]), bb.z[0] + u * (bb.z[1] - bb.z[0])]);
        }
      }
    }
    const res = await handle.page.evaluate(async ({ hz, hzLead, sites, weather, tide }) => {
      const H = window.__HARNESS;
      H.loadState('default');
      if (weather) H.setWeather(weather);
      if (tide) H.setTide(tide);
      H.setTimeOfDay(12);
      let found = null;
      for (const [x, z] of sites) {
        H.teleport(x, z);
        H.stepFrames(2);
        const rep = H.getHazardReport();
        const row = rep.here.find((q) => q.id === hz);
        if (row && row.inside) { found = { x, z }; break; }
      }
      if (!found) {
        // Report the closest approach we managed, so a miss is a number and not a shrug.
        let best = null;
        for (const [x, z] of sites.slice(0, 30)) {
          H.teleport(x, z); H.stepFrames(2);
          const row = H.getHazardReport().here.find((q) => q.id === hz);
          if (row && (best === null || (row.approach_m ?? 1e9) < best.approach_m)) best = { x, z, approach_m: row.approach_m, sheltered: row.sheltered };
        }
        return { entered: false, closest: best };
      }
      // Approach from 60 m out so the telegraph has somewhere to happen, then stand. The trace
      // starts BEFORE the approach or the `hazard_tell` lands outside the window that records it.
      // The stand is 60 s, or 40 s past the declared tell lead where that lead is longer — a
      // salt-storm declares 40 s of warning and a thirst clock 60 s, and a 60 s probe would record
      // "did not fire" for a hazard that is behaving exactly as its own declaration says.
      H.loadState('default');
      if (weather) H.setWeather(weather);
      if (tide) H.setTide(tide);
      H.setTimeOfDay(12);
      H.traceStart({ events: true });
      H.teleport(found.x + 60, found.z);
      H.stepFrames(4);
      const before = H.getPlayerStats();
      H.teleport(found.x, found.z);
      H.stepFrames(Math.max(3600, Math.round((hzLead + 40) * 60)));
      const after = H.getPlayerStats();
      const rep = H.getHazardReport();
      const row = rep.here.find((q) => q.id === hz) || null;
      const tr = H.traceDrain();
      const evs = (tr.records || tr || []).flatMap((r) => (r.events || []).map((e) => ({ f: r.frame ?? r.f, ...e })))
        .filter((e) => e.hazard === hz);
      H.traceStop();
      // SCORE ON THE BODY. Everything below is read off the player and off the trace of what
      // happened TO the player, and nothing is read off the hazard's arming state. The old
      // scoring took `row.fired` from a report drained AFTER the 60 s stand; a TRAP disarms on
      // the frame it fires, so six hazards that hurt this body read as "did not fire". The three
      // things that count as the hazard reaching the body are: HP came off it, an affliction was
      // caught, or a route was closed under it — those are the three consequences RI-WLD11 M57
      // declares, and `damage.kind: "none"` hazards can only ever show the third.
      const hpLost = +(before.hp - after.hp).toFixed(2);
      const afflBefore = (before.afflictions || []).length;
      const afflAfter = (after.afflictions || []).length;
      const dmgEvents = evs.filter((e) => e.type === 'hazard_damage');
      const firedEvents = evs.filter((e) => e.type === 'hazard_fired');
      const outcomes = [...new Set(firedEvents.map((e) => e.outcome).filter(Boolean))];
      const closed = outcomes.includes('route_closed') || after.stranded_by === hz;
      return {
        entered: true, at: found, row,
        hp: [before.hp, after.hp], stamina: [before.stamina, after.stamina],
        afflictions: after.afflictions || H.getPlayerStats().afflictions || null,
        // The whole trace, not the first eight records: the truncation hid `hazard_damage` behind
        // a run of per-second attrition ticks on exactly the hazards this measurement is about.
        events: evs.map((e) => ({ f: e.f, type: e.type, outcome: e.outcome ?? null, damage: e.damage ?? null })).slice(0, 64),
        tell_frame: (evs.find((e) => e.type === 'hazard_tell') || {}).f ?? null,
        first_damage_frame: row ? row.first_damage_frame : null,
        body: {
          hp_lost: hpLost,
          afflictions_caught: Math.max(0, afflAfter - afflBefore),
          damage_events: dmgEvents.length,
          damage_traced: +dmgEvents.reduce((a, e) => a + (e.damage || 0), 0).toFixed(2),
          fired_events: firedEvents.length,
          outcomes,
          route_closed: !!closed,
          died: after.hp <= 0 || after.state === 'DEATH',
        },
        row_fired: !!(row && row.fired),
      };
    }, { hz: h.id, hzLead: h.tell.lead_s, sites, weather: WEATHER_FOR[h.id] || null, tide: TIDE_FOR[h.id] || null });

    // `--score-by-table` restores the OLD scoring — the delete-the-fix arm, kept in the tool so
    // the comparison is a flag and not a stashed patch.
    const b = res.body || null;
    const fired = SCORE_BY_TABLE
      ? !!(res.entered && res.row && res.row.fired)
      : !!(res.entered && b && (b.hp_lost > 0.5 || b.afflictions_caught > 0 || b.route_closed || b.died));
    out.hazards.push({ id: h.id, class: h.class, damage: h.damage, tell: h.tell, regions: h.regions, fired, ...res });
    const hp = res.entered ? `${res.hp[0].toFixed(0)}->${res.hp[1].toFixed(0)}` : '—';
    const why = b ? [b.hp_lost > 0.5 ? `-${b.hp_lost}hp` : '', b.afflictions_caught ? `+${b.afflictions_caught}affl` : '',
      b.route_closed ? 'route-closed' : '', b.died ? 'DIED' : ''].filter(Boolean).join(' ') : '';
    process.stdout.write(`${h.id.padEnd(22)} ${h.class.padEnd(10)} ${(fired ? 'FIRED' : 'no-fire').padEnd(7)} hp ${hp.padEnd(12)}`
      + ` tell f${res.tell_frame ?? '-'} table=${res.row_fired ? 'Y' : 'n'} body: ${why || '(nothing)'}\n`);
  }
} finally {
  await handle.close();
}
out.fired_count = out.hazards.filter((h) => h.fired).length;
out.table_fired_count = out.hazards.filter((h) => h.row_fired).length;
out.body_disagreements = out.hazards.filter((h) => h.fired !== !!h.row_fired).map((h) => h.id);
out.total = out.hazards.length;
fs.mkdirSync(path.dirname(path.join(ROOT, outFile)), { recursive: true });
fs.writeFileSync(path.join(ROOT, outFile), JSON.stringify(out, null, 1) + '\n');
process.stdout.write(`\n${out.fired_count}/${out.total} hazards fired\n  ${outFile}\n`);
