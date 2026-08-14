#!/usr/bin/env node
// critic-w1-20-r2-census.mjs — the round-2 critic's STATIC arm.
//
// It exists because the round-1 verdict was written on 2026-08-08 against a tree that no longer
// exists: the W1-20 CONTINUATION landed on 08-10 (9ed28905) and 16 minutes later a merge
// (091a6cec, "Integrate W1-20 faction builder delivery") deleted three of its files. Three came
// back on 08-14; the ENGINE half did not, because the recovery worked file-by-file and
// `game/src/engine.js` is a file that still exists.
//
// This tool measures the faction MODEL at HEAD against RI-QST01 and RI-QST03 exactly as those
// items' own comparison methods specify. It is deliberately statistics-only, and per RULES it
// can therefore FAIL the build and can never PASS it — the live arm
// (`critic-w1-20-r2-live.mjs`) is what may pass it.
//
// THE NULL CONTROL THIS TOOL IS BUILT TO LOSE TO, stated up front so nobody mistakes a green
// census for a working faction system: a build where EVERY FACTION ACCEPTS EVERYONE AND REFUSES
// NOBODY, with all eight ladders, all rank names, all favoured skills and every line of refusal
// prose intact, passes every check in this file. That build is produced by
// `--null-control-preview`, which prints the edit; the live arm runs it for real.
//
// RUN: node tools/quests/critic-w1-20-r2-census.mjs [--out <file>] [--null-control-preview]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const argv = process.argv.slice(2);
const OUT = (() => { const i = argv.indexOf('--out'); return i >= 0 ? argv[i + 1] : path.join(ROOT, 'reports/w1-20/r2-census.json'); })();

const gates = read('game/data/quests/faction-gates.json');
const discipline = read('game/data/progression/faction-discipline.json');
const registry = (() => { try { return read('game/data/factions/registry.json'); } catch { return null; } })();
const index = read('game/data/index.json');

const qDir = path.join(ROOT, 'game/data/quests');
const quests = fs.readdirSync(qDir).filter((f) => f.endsWith('.json')).flatMap((f) => {
  try { return (JSON.parse(fs.readFileSync(path.join(qDir, f), 'utf8')).quests || []).map((q) => ({ ...q, _file: f })); }
  catch { return []; }
});
const faction = quests.filter((q) => q.category === 'faction');

const findings = [];
const rows = [];
const add = (id, item, status, detail) => { rows.push({ id, item, status, detail }); if (status === 'HARD_FAIL' || status === 'FAIL') findings.push(id); };

// ---------------------------------------------------------------- RI-QST01
const lines = {};
for (const q of faction) (lines[q.faction] = lines[q.faction] || []).push(q);
const lineIds = Object.keys(lines).sort();

const rankOf = (q) => Number(q.rank_gate?.min_rank ?? 0);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

for (const id of lineIds) {
  const qs = lines[id];
  const perRank = {}; for (const q of qs) (perRank[rankOf(q)] = perRank[rankOf(q)] || []).push(q);
  const empty = [0, 1, 2, 3, 4, 5, 6, 7].filter((r) => !(perRank[r] || []).length);
  const meanPerRank = qs.length / 8;
  add(`QST01.volume.${id}`, 'RI-QST01', qs.length >= 18 ? (qs.length >= 24 ? 'PASS' : 'PASS_AT_FLOOR') : 'HARD_FAIL',
    { total: qs.length, target: '24-28', hard_fail_below: 18, sub_score_band: qs.length >= 24 ? 10 : (qs.length >= 18 ? 5 : 0) });
  add(`QST01.bands.${id}`, 'RI-QST01', empty.length === 0 ? 'PASS' : 'HARD_FAIL', { empty_rank_bands: empty });
  add(`QST01.meanPerRank.${id}`, 'RI-QST01', meanPerRank >= 2.0 ? 'PASS' : 'HARD_FAIL', { mean: meanPerRank, target: 3.0, hard_fail_below: 2.0 });

  // "Uniform quests-per-rank ... the signature of a spreadsheet rather than a story" (How we lose)
  const counts = [0, 1, 2, 3, 4, 5, 6, 7].map((r) => (perRank[r] || []).length);
  const lumpy = new Set(counts).size > 1;
  add(`QST01.lumpiness.${id}`, 'RI-QST01', lumpy ? 'PASS' : 'FLAT', { per_rank_counts: counts });

  // deceit
  const dec = qs.filter((q) => q.deceit != null);
  const firstDeceit = dec.length ? Math.min(...dec.map(rankOf)) : null;
  add(`QST01.deceit.${id}`, 'RI-QST01',
    dec.length === 0 ? 'HARD_FAIL' : (firstDeceit <= 3 ? 'PASS' : (firstDeceit <= 4 ? 'WARN' : 'HARD_FAIL')),
    { deceitful_quests: dec.length, first_deceit_rank: firstDeceit, target: '<=3', hard_fail_above: 4 });

  // task kinds
  const firstOf = (k) => { const m = qs.filter((q) => q.task_kind === k); return m.length ? Math.min(...m.map(rankOf)) : null; };
  const dw = firstOf('dirty_work'), po = firstOf('politics'), su = firstOf('succession');
  add(`QST01.taskkind.${id}`, 'RI-QST01',
    (dw != null && dw <= 6 && po != null && su != null) ? 'PASS' : 'HARD_FAIL',
    { first_dirty_work: dw, first_politics: po, first_succession: su, targets: { dirty_work: '4+-1', politics: '5-6', succession: 7 },
      kinds_present: [...new Set(qs.map((q) => q.task_kind))].sort() });
  if (su == null) add(`QST01.succession_cap.${id}`, 'RI-QST01', 'CAP_4', { note: 'a line with no succession quest is capped at 4/10' });

  // stakes curve: monotonic, no band mean dropping >= 2.0 vs the band below
  const stakesByRank = [0, 1, 2, 3, 4, 5, 6, 7].map((r) => mean((perRank[r] || []).map((q) => Number(q.stakes) || 0)));
  const drops = [];
  for (let r = 1; r < 8; r++) if (stakesByRank[r] < stakesByRank[r - 1] - 2.0) drops.push({ rank: r, from: stakesByRank[r - 1], to: stakesByRank[r] });
  const firstStakes5 = stakesByRank.findIndex((s) => s >= 5);
  add(`QST01.stakes.${id}`, 'RI-QST01', drops.length === 0 ? 'PASS' : 'FAIL',
    { mean_stakes_by_rank: stakesByRank.map((s) => Math.round(s * 100) / 100), drops, span: [Math.min(...stakesByRank), Math.max(...stakesByRank)],
      first_rank_stakes_ge_5: firstStakes5, target_first_rank_stakes_ge_5: 4, hard_fail_if: '>5 or <2' });

  // Rival contradiction — the item's §6. Quests whose faction_reputation touches a faction other
  // than their own. Target >= 6 per line, hard fail < 3.
  const rivalTouch = qs.filter((q) => {
    const fr = (q.consequences && q.consequences.faction_reputation) || {};
    const res = (q.resolutions || []).flatMap((r) => Object.keys((r.consequences && r.consequences.faction_reputation) || {}));
    return [...Object.keys(fr), ...res].some((k) => k !== id);
  });
  add(`QST01.rival.${id}`, 'RI-QST01', rivalTouch.length >= 6 ? 'PASS' : (rivalTouch.length >= 3 ? 'WARN' : 'HARD_FAIL'),
    { rival_touching: rivalTouch.length, target: '>=6', hard_fail_below: 3 });
}

// ---------------------------------------------------------------- RI-QST03
const gs = gates.factions || [];
add('QST03.ladders', 'RI-QST03', gs.length >= 3 && gs.every((f) => (f.ranks || []).length === 8) ? 'PASS' : 'HARD_FAIL',
  { factions: gs.length, ranks: gs.map((f) => (f.ranks || []).length) });

for (const f of gs) {
  const bad = (f.ranks || []).filter((r) => r.rank >= 1 && (r.reputation == null || r.attribute == null || r.skill_1 == null));
  const forbidden = (f.ranks || []).filter((r) => 'level' in r || 'souls' in r || 'quest_count' in r);
  add(`QST03.rows.${f.id}`, 'RI-QST03', forbidden.length === 0 && bad.length === 0 ? 'PASS' : 'HARD_FAIL',
    { bad_rows: bad.map((r) => r.rank), forbidden_keys: forbidden.length });
  // monotonic, with the rank-6 councilman exception
  const mono = [];
  for (let r = 2; r < 8; r++) {
    const a = f.ranks[r - 1], b = f.ranks[r];
    for (const k of ['reputation', 'attribute', 'skill_1', 'skill_2']) {
      const av = Number(a[k] ?? 0), bv = Number(b[k] ?? 0);
      if (bv < av) {
        const exempt = (r === 6 && k === 'skill_1' && (av - bv) <= 15 && b.world_state);
        if (!exempt) mono.push({ rank: r, column: k, from: av, to: bv });
      }
    }
  }
  add(`QST03.monotonic.${f.id}`, 'RI-QST03', mono.length === 0 ? 'PASS' : 'FAIL', { violations: mono });
  const skills = f.favoured_skills || [], attrs = f.favoured_attributes || [];
  const named = new Set((f.ranks || []).flatMap((r) => [r.skill_1_name, r.skill_2_name].filter(Boolean)));
  add(`QST03.favoured.${f.id}`, 'RI-QST03', skills.length === 6 && attrs.length === 2 ? 'PASS' : 'FAIL',
    { favoured_skills: skills.length, favoured_attributes: attrs.length, skills_named_in_rows: [...named] });
  // world_state requirement at rank 5+
  const ws = (f.ranks || []).filter((r) => r.rank >= 5 && r.world_state).length;
  add(`QST03.worldstate.${f.id}`, 'RI-QST03', ws >= 1 ? 'PASS' : 'FAIL', { ranks_5_plus_with_world_state: ws });
}

// THE CEILING CHECK. RI-QST03 §B puts a world-state requirement on ranks 5-7. A world state that
// no quest in the book ever raises is a ladder whose top three rungs cannot be climbed in any
// save — which the live arm sees only as "a qualified character stops at rank 4".
{
  const raised = new Set();
  const collect = (c) => {
    if (!c) return;
    const wf = c.world_flags;
    if (Array.isArray(wf)) for (const k of wf) raised.add(typeof k === 'string' ? k : (k && k.flag));
    else if (wf && typeof wf === 'object') for (const k of Object.keys(wf)) raised.add(k);
  };
  for (const q of quests) { collect(q.consequences); for (const r of q.resolutions || []) collect(r.consequences); }
  for (const f of gs) {
    const dead = [];
    for (const r of f.ranks || []) {
      if (!r.world_state) continue;
      const ws = typeof r.world_state === 'string' ? r.world_state : (r.world_state.flag || null);
      if (ws && !raised.has(ws)) dead.push({ rank: r.rank, world_state: ws });
    }
    add(`QST03.ceiling.${f.id}`, 'RI-QST03', dead.length === 0 ? 'PASS' : 'HARD_FAIL',
      { unreachable_ranks: dead.map((d) => d.rank), world_states_no_quest_raises: dead.map((d) => d.world_state),
        highest_reachable_rank: dead.length ? Math.min(...dead.map((d) => d.rank)) - 1 : 7,
        quests_stranded_above_the_ceiling: dead.length
          ? (lines[f.id] || []).filter((q) => rankOf(q) >= Math.min(...dead.map((d) => d.rank))).length : 0 });
  }
}

// favoured-skill overlap <= 3 between any two lines
const overlaps = [];
for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) {
  const a = new Set(gs[i].favoured_skills || []), b = gs[j].favoured_skills || [];
  const shared = b.filter((s) => a.has(s));
  if (shared.length > 3) overlaps.push({ a: gs[i].id, b: gs[j].id, shared });
}
add('QST03.skill_overlap', 'RI-QST03', overlaps.length === 0 ? 'PASS' : 'FAIL', { pairs_over_3: overlaps });

// earnable reputation vs rank-7 requirement
for (const f of gs) {
  const need = Number(f.ranks[7]?.reputation ?? 112);
  let earnable = 0;
  for (const q of quests) {
    const qf = (q.consequences && q.consequences.faction_reputation) || {};
    const v = Number(qf[f.id] || 0); if (v > 0) earnable += v;
    for (const r of q.resolutions || []) {
      const rf = (r.consequences && r.consequences.faction_reputation) || {};
      const rv = Number(rf[f.id] || 0); if (rv > 0) earnable += rv;
    }
  }
  const slack = need ? earnable / need : 0;
  add(`QST03.earnable.${f.id}`, 'RI-QST03',
    earnable === 0 ? 'HARD_FAIL' : (earnable < need ? 'HARD_FAIL' : (slack > 1.6 ? 'WARN_SLACK' : 'PASS')),
    { earnable, rank7_requirement: need, slack: Math.round(slack * 100) / 100, warn_above: 1.6 });
}

// exclusivity — does joining one line close another?
const exc = gates.exclusivity || {};
add('QST03.exclusivity.declared', 'RI-QST03',
  ((exc.hard_groups || []).length || (exc.enemy_pairs || []).length || (exc.earned || []).length) ? 'PASS' : 'HARD_FAIL',
  { hard_groups: exc.hard_groups || [], enemy_pairs: exc.enemy_pairs || [], earned: (exc.earned || []).map((e) => e.id || e.quest || e) });

// greedy single-save reachability: what fraction of faction quests can one save reach?
// Hard groups: pick the branch with the most quests. Enemy pairs: same. Earned locks are
// resolvable via an escape hatch and so do not reduce the greedy maximum.
{
  const total = faction.length;
  const closed = new Set();
  for (const grp of exc.hard_groups || []) {
    const g = Array.isArray(grp) ? grp : (grp.factions || []);
    const sorted = [...g].sort((a, b) => (lines[b] || []).length - (lines[a] || []).length);
    for (const f of sorted.slice(1)) closed.add(f);
  }
  for (const pr of exc.enemy_pairs || []) {
    const p = Array.isArray(pr) ? pr : [pr.a, pr.b].filter(Boolean);
    if (p.length === 2 && !closed.has(p[0]) && !closed.has(p[1])) {
      const keep = (lines[p[0]] || []).length >= (lines[p[1]] || []).length ? p[0] : p[1];
      closed.add(p.find((x) => x !== keep));
    }
  }
  const reachable = faction.filter((q) => !closed.has(q.faction)).length;
  const frac = total ? reachable / total : 1;
  add('QST03.reachability', 'RI-QST03', frac <= 0.75 ? 'PASS' : 'FAIL',
    { total_faction_quests: total, greedy_reachable: reachable, fraction: Math.round(frac * 1000) / 1000,
      target: '<=0.60', fail_above: 0.75, closed_by_exclusivity: [...closed] });
}

// X3 escape hatches: any quest that populates consequences.locks needs >= 2 resolutions
{
  const locking = quests.filter((q) => ((q.consequences && q.consequences.locks) || []).length > 0
    || (q.resolutions || []).some((r) => ((r.consequences && r.consequences.locks) || []).length > 0));
  const thin = locking.filter((q) => (q.resolutions || []).length < 2);
  add('QST03.escape_hatches', 'RI-QST03', thin.length === 0 ? 'PASS' : 'FAIL',
    { quests_that_lock: locking.length, without_two_resolutions: thin.map((q) => q.id) });
}

// expulsion + readmission, per faction, and whether readmission is CHARACTERISED or uniform
{
  const drows = discipline.factions || [];
  const missing = gs.map((f) => f.id).filter((id) => !drows.some((d) => d.faction === id));
  add('QST03.expulsion.coverage', 'RI-QST03', missing.length === 0 ? 'PASS' : 'HARD_FAIL',
    { lines_without_a_discipline_row: missing, rows: drows.length });
  const shapes = drows.map((d) => ({
    faction: d.faction,
    triggers: (d.expelled_by || []).length,
    price: d.readmission?.price_gold ?? null,
    rep_floor: d.readmission?.reputation_floor ?? null,
    rep_cost: d.readmission?.costs_reputation ?? null,
    offered_by: d.readmission?.offered_by || null,
    has_shortfall_line: !!d.readmission?.refusal_line_no_gold,
    on_permanent: d.on_permanent || d.readmission?.on_permanent || null,
  }));
  const distinctPrices = new Set(shapes.map((s) => s.price)).size;
  add('QST03.readmission.variety', 'RI-QST03', distinctPrices >= 3 ? 'PASS' : 'FAIL',
    { distinct_prices: distinctPrices, shapes });
  const noPermanent = shapes.filter((s) => !s.on_permanent).map((s) => s.faction);
  add('QST03.on_permanent', 'RI-QST03', noPermanent.length === 0 ? 'PASS' : 'FAIL',
    { lines_with_no_permanent_expulsion_consequence: noPermanent,
      note: 'RI-QST03 §7 asks for offences_tolerated + readmission + on_permanent per faction' });
  const noTolerated = drows.filter((d) => d.offences_tolerated == null).map((d) => d.faction);
  add('QST03.offences_tolerated', 'RI-QST03', noTolerated.length === 0 ? 'PASS' : 'FAIL', { missing: noTolerated });
}

// ---------------------------------------------------------------- RI-MTH07, static half
// The consumer question, answered by grep rather than by assertion.
{
  const src = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) src.push(p); } };
  walk(path.join(ROOT, 'game/src'));
  const hay = src.map((p) => ({ p: path.relative(ROOT, p), t: fs.readFileSync(p, 'utf8') }));
  const hits = (needle) => hay.filter((h) => h.t.includes(needle)).map((h) => h.p);
  const worldSide = (paths) => paths.filter((p) => !p.startsWith('game/src/harness/'));

  const access = hits('factionAccess');
  add('MTH07.factionAccess', 'RI-MTH07', worldSide(access).length ? 'PASS' : 'HARD_FAIL',
    { all_readers: access, world_side_readers: worldSide(access),
      note: 'Engine.factionAccess() is the consumer the W1-20 delivery report names for its RI-MTH07 row.' });

  const reg = hits('factionRegistry');
  const loaded = JSON.stringify(index).includes('factions/registry.json');
  add('MTH07.registry', 'RI-MTH07', worldSide(reg).length ? 'PASS' : 'HARD_FAIL',
    { in_data_index: loaded, all_readers: reg, world_side_readers: worldSide(reg),
      registry_factions: registry ? (registry.factions || []).length : null,
      note: 'game/data/factions/registry.json is fetched at boot; does anything install or read it?' });

  const refusal = hits('factionRefusals');
  add('MTH07.refusals', 'RI-MTH07', worldSide(refusal).length ? 'PASS' : 'HARD_FAIL', { world_side_readers: worldSide(refusal) });

  const disc = hits('discipline');
  add('MTH07.discipline', 'RI-MTH07', worldSide(disc).length ? 'PASS' : 'HARD_FAIL', { world_side_readers: worldSide(disc) });

  // quest-witnesses.json — recovered but absent from the data index
  const witnessesOnDisk = fs.existsSync(path.join(ROOT, 'game/data/npcs/quest-witnesses.json'));
  const witnessesIndexed = JSON.stringify(index).includes('npcs/quest-witnesses.json');
  const deceitRevealers = new Set(faction.flatMap((q) => {
    const d = q.deceit || {}; const rb = d.revealed_by;
    return Array.isArray(rb) ? rb : (rb ? [rb] : []);
  }));
  add('MTH07.quest_witnesses', 'RI-MTH07', (!witnessesOnDisk || witnessesIndexed) ? 'PASS' : 'FAIL',
    { on_disk: witnessesOnDisk, in_data_index: witnessesIndexed,
      faction_quests_naming_a_revealer: deceitRevealers.size,
      note: 'RI-QST01 requires an in-faction dissenter who NAMES the rot. If the revealer records are not loaded, the dissenter is not in the world.' });
}

const summary = {
  schema: 'elder-souls/critic-w1-20-r2-census@1',
  commit: process.env.GIT_COMMIT || null,
  generated_at: new Date().toISOString(),
  lines: lineIds,
  totals: { faction_quests: faction.length, lines: lineIds.length, ladders: gs.length },
  hard_fails: rows.filter((r) => r.status === 'HARD_FAIL').map((r) => r.id),
  fails: rows.filter((r) => r.status === 'FAIL').map((r) => r.id),
  warnings: rows.filter((r) => r.status.startsWith('WARN') || r.status === 'CAP_4' || r.status === 'FLAT' || r.status === 'PASS_AT_FLOOR').map((r) => r.id),
  rows,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(summary, null, 2) + '\n');

console.log(`critic-w1-20-r2-census: ${rows.length} rows, ${summary.hard_fails.length} hard fail, ${summary.fails.length} fail, ${summary.warnings.length} warn`);
for (const r of rows) if (r.status !== 'PASS') console.log(`  ${r.status.padEnd(14)} ${r.id}  ${JSON.stringify(r.detail).slice(0, 220)}`);
console.log(`wrote ${path.relative(ROOT, OUT)}`);
process.exit(summary.hard_fails.length || summary.fails.length ? 1 : 0);
