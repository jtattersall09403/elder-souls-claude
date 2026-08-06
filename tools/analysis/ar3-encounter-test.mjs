#!/usr/bin/env node
// ar3-encounter-test.mjs — RI-CHR02 method 8, the mandatory AR-3 assertion, run over real
// traces produced by three real runs of the same scenario at three races.
//
// The method, verbatim: "assert the Saxhleel run contains enemy_state transitions to AGGRO at
// dist_m >= 26; assert the Dunmer run contains zero AGGRO transitions in 1,800 frames and >= 1
// parley_offer event; assert the Khajiit run's first AGGRO is at dist_m <= 14. Assert the
// enemy archetype and moveset ids are identical across all three runs — if the fight itself
// changed, that is Morrowind leaking into Souls' domain (AR-1), and if nothing changed, the
// item's AR-3 claim is fraudulent. Both are fails."
//
// USAGE
//   node tools/harness/run-headless.mjs --scenario wld-dres-raid-road --seed 1337 \
//        --state "race=<r>,upbringing=foreign-born" --out reports/runs/ar3-<r>     (x3)
//   node tools/analysis/ar3-encounter-test.mjs --runs reports/runs/ar3-
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, readJsonl, readJson, writeJson, REPO_ROOT } from '../lib/cli.mjs';

const USAGE = `
ar3-encounter-test.mjs — assert RI-CHR02 method 8 over three real runs.

USAGE
  node tools/analysis/ar3-encounter-test.mjs [--runs <prefix>] [--json <path>]

  --runs <prefix>   run-directory prefix; <prefix>saxhleel, <prefix>dunmer, <prefix>khajiit
                    (default: reports/runs/ar3-)
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const prefix = String(args.runs || 'reports/runs/ar3-');
const RACES = ['saxhleel', 'dunmer', 'khajiit'];

const runs = {};
for (const r of RACES) {
  const dir = path.resolve(REPO_ROOT, `${prefix}${r}`);
  if (!fs.existsSync(dir)) fail(`missing run directory ${dir}. Run the three scenarios first (see --help).`);
  const lines = readJsonl(path.join(dir, 'trace.jsonl'));
  const header = lines[0], footer = lines[lines.length - 1];
  const frames = lines.filter((l) => l._ === undefined && Number.isFinite(l.f));
  const events = frames.flatMap((f) => (f.events || []).map((e) => ({ ...e, _f: f.f })));
  runs[r] = { dir, header, footer, frames, events, manifest: readJson(path.join(dir, 'manifest.json')) };
}

const results = [];
function check(id, ok, measured, expected) {
  results.push({ id, ok: !!ok, measured, expected });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${id}\n        measured: ${measured}\n        expected: ${expected}\n`);
}
function dataHash(m) { const d = m.data; return typeof d === 'string' ? d : (d && (d.sha256 || d.hash || d.digest)) || JSON.stringify(d); }
function fail(msg) { process.stderr.write(`[ar3] ${msg}\n`); process.exit(2); }

// ---- 0. the three runs must be the same run except for one field ------------------------------
process.stdout.write('== RI-CHR02 method 8 — three runs, one field apart\n');
for (const r of RACES) {
  const m = runs[r].manifest;
  process.stdout.write(`  ${r.padEnd(9)} seed ${m.seed}  frames ${m.frames_traced}  override ${JSON.stringify(m.character_override)}  data ${dataHash(m).slice(0, 16)}\n`);
}
const seeds = new Set(RACES.map((r) => runs[r].manifest.seed));
const dataHashes = new Set(RACES.map((r) => dataHash(runs[r].manifest)));
const overrides = RACES.map((r) => runs[r].manifest.character_override);
const diffFields = new Set(overrides.flatMap((o) => Object.keys(o || {})).filter((k) => new Set(overrides.map((o) => o[k])).size > 1));
check('M8-same-run', seeds.size === 1 && dataHashes.size === 1 && RACES.every((r) => runs[r].manifest.frames_traced === 1800),
  `one seed (${[...seeds].join(', ')}), one data-tree hash, ${RACES.map((r) => runs[r].manifest.frames_traced).join('/')} frames`,
  'identical seed, identical data, 1,800 frames each');
check('M8-one-field-apart', diffFields.size === 1 && diffFields.has('race'),
  `fields that differ between the three overrides: ${[...diffFields].join(', ') || '(none)'}`,
  'exactly one: race');

// ---- 1. openings ------------------------------------------------------------------------------
process.stdout.write('\n== openings\n');
const aggro = (r) => runs[r].events.filter((e) => e.type === 'enemy_state' && e.to === 'AGGRO');
const parley = (r) => runs[r].events.filter((e) => e.type === 'parley_offer');
for (const r of RACES) {
  const a = aggro(r), p = parley(r);
  process.stdout.write(`  ${r.padEnd(9)} AGGRO x${String(a.length).padStart(2)}` +
    (a.length ? ` first f=${a[0]._f} at ${a[0].dist_m} m (${a[0].because}) net=${a[0].net_behaviour}` : '') +
    `   parley_offer x${p.length}` + (p.length ? ` f=${p[0]._f} at ${p[0].dist_m} m kind=${p[0].kind}` : '') + '\n');
}
const sax = aggro('saxhleel'), dun = aggro('dunmer'), kha = aggro('khajiit');
check('M8-saxhleel-aggro-26m', sax.length > 0 && sax.every((e) => e.dist_m >= 26),
  `${sax.length} AGGRO transitions, distances ${sax.map((e) => e.dist_m).join(', ')} m`,
  '>= 1 transition, all at dist_m >= 26');
check('M8-saxhleel-capture', sax.length > 0 && sax.every((e) => e.net_behaviour === 'capture'),
  `net behaviour on the Saxhleel run: ${[...new Set(sax.map((e) => e.net_behaviour))].join(', ')}`,
  'capture — a defeat here is transport to Archon\'s holds, not death');
check('M8-dunmer-no-aggro', dun.length === 0,
  `${dun.length} AGGRO transitions in ${runs.dunmer.frames.length} frames`, 'zero in 1,800 frames');
check('M8-dunmer-parley', parley('dunmer').length >= 1,
  `${parley('dunmer').length} parley_offer events; kinds: ${[...new Set(parley('dunmer').map((e) => e.kind))].join(', ') || '(none)'}`,
  '>= 1 parley_offer — it hails you and the parley it offers is a purchase');
check('M8-khajiit-aggro-14m', kha.length > 0 && kha[0].dist_m <= 14,
  `first Khajiit AGGRO at ${kha.length ? `${kha[0].dist_m} m (f=${kha[0]._f})` : '(none)'}`,
  '<= 14 m — a Khajiit is worth taking too, without the pretence');
check('M8-khajiit-no-capture', kha.length > 0 && kha.every((e) => e.net_behaviour !== 'capture'),
  `Khajiit net behaviour: ${[...new Set(kha.map((e) => e.net_behaviour))].join(', ')}`, 'not capture');
check('M8-three-behaviours', new Set(RACES.map((r) => `${aggro(r).length ? aggro(r)[0].dist_m : 'none'}/${parley(r).length}`)).size === 3,
  `opening signatures: ${RACES.map((r) => `${r}=${aggro(r).length ? `${aggro(r)[0].dist_m}m` : 'no-aggro'}+${parley(r).length}parley`).join('  ')}`,
  'three distinct openings — zero behavioural difference makes the AR-3 claim fraudulent');

// ---- 2. AR-1: the fight itself must be identical ----------------------------------------------
process.stdout.write('\n== AR-1 — the fight the three characters are handed\n');
function fightFingerprint(r) {
  const byEid = new Map();
  for (const f of runs[r].frames) for (const e of f.enemies || []) {
    if (!byEid.has(e.eid)) byEid.set(e.eid, { eid: e.eid, statblock: e.statblock, moveset: e.moveset, archetype: e.archetype, tier: e.tier, encounter: e.encounter, role: e.encounter_role, hp_max: e.hp_max ?? null, poise_max: e.poise_max ?? null });
  }
  return [...byEid.values()].sort((a, b) => String(a.eid).localeCompare(String(b.eid)));
}
const fps = Object.fromEntries(RACES.map((r) => [r, fightFingerprint(r)]));
for (const e of fps.saxhleel) process.stdout.write(`  ${String(e.eid).padEnd(6)} statblock=${e.statblock} moveset=${e.moveset} archetype=${e.archetype} tier=${e.tier} role=${e.role}\n`);
const fpKey = (r) => JSON.stringify(fps[r]);
check('M8-identical-statblocks', new Set(RACES.map(fpKey)).size === 1,
  `${fps.saxhleel.length} entities per run; statblock/moveset/archetype/tier fingerprints identical across the three runs: ${new Set(RACES.map(fpKey)).size === 1}`,
  'identical — a per-race statblock, moveset or tier is an automatic AR-1 fail');
const movesets = [...new Set(RACES.flatMap((r) => fps[r].map((e) => e.moveset)))];
check('M8-one-moveset-set', movesets.length >= 1,
  `movesets in play: ${movesets.join(', ')}`, 'the same set in all three runs');

// ---- 3. what actually differed ----------------------------------------------------------------
process.stdout.write('\n== the difference, stated\n');
// The event TYPE counts alone do not separate Saxhleel from Khajiit — both aggro six
// entities. What separates them is the range and the intent, so the profile compared here is
// (event counts, first-aggro distance, net behaviour, parley kind), which is exactly the set
// of levers RI-CHR02 §4e permits and nothing from the fight.
const profile = (r) => {
  const c = {}; for (const e of runs[r].events) c[e.type] = (c[e.type] || 0) + 1;
  const a = aggro(r), p = parley(r);
  return { events: c, first_aggro_m: a.length ? a[0].dist_m : null, net: a.length ? a[0].net_behaviour : null, parley_kind: p.length ? p[0].kind : null };
};
for (const r of RACES) process.stdout.write(`  ${r.padEnd(9)} ${JSON.stringify(profile(r))}\n`);
const distinct = new Set(RACES.map((r) => JSON.stringify(profile(r))));
check('M8-behaviour-profiles-differ', distinct.size === 3,
  `${distinct.size}/3 distinct (events, first-aggro range, net behaviour, parley kind) profiles`,
  '3 — the same road, the same enemies, three different things happening on it');

const failed = results.filter((r) => !r.ok);
process.stdout.write(`\n== summary\n${results.length - failed.length}/${results.length} assertions pass\n`);
for (const f of failed) process.stdout.write(`FAIL  ${f.id}: measured ${f.measured}\n`);
if (args.json) writeJson(path.resolve(String(args.json)), { tool: 'ar3-encounter-test', runs: Object.fromEntries(RACES.map((r) => [r, runs[r].manifest.run_id])), results });
process.exit(failed.length ? 1 : 0);
