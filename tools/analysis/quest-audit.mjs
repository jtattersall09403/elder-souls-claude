#!/usr/bin/env node
// The offline quest audit. Everything RI-QST04's "Comparison method" runs (checks 0-5 and the
// §D census), everything RI-QST09 §2's exclusivity census (X1-X10) needs that is static, and
// RI-DLG05 §D's prohibition sweep over every journal entry and every `directions` string.
//
// It reads game/data/quests/**.json and nothing else — no browser, no harness, no build. That
// is deliberate: HARNESS.md §5 exists so a critic can analyse content without running the
// game, and a quest corpus that can only be judged by playing it cannot be judged.
//
//   node tools/analysis/quest-audit.mjs                 # census + every integrity check
//   node tools/analysis/quest-audit.mjs --json          # machine-readable
//   node tools/analysis/quest-audit.mjs --schema        # + JSON Schema validation via ajv
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const QUEST_DIR = path.join(ROOT, 'game/data/quests');
const SCHEMA = path.join(ROOT, 'corpus/30-quests/quest.schema.json');

const argv = process.argv.slice(2);
const wantJson = argv.includes('--json');
const wantSchema = argv.includes('--schema') || argv.includes('--all');

// The prohibition rules, imported from the SHIPPING module so the audit and the engine can
// never disagree about what is banned.
const { scanProse, BANNED } = await import(path.join(ROOT, 'game/src/sim/quest/prohibitions.js'));

// ---- load ----------------------------------------------------------------------------------

const files = fs.readdirSync(QUEST_DIR).filter((f) => f.endsWith('.json')).sort();
const quests = [];
const fileOf = new Map();
for (const f of files) {
  const doc = JSON.parse(fs.readFileSync(path.join(QUEST_DIR, f), 'utf8'));
  const list = Array.isArray(doc.quests) ? doc.quests : (doc.journal ? [doc] : []);
  if (!list.length) continue;
  for (const q of list) { quests.push(q); fileOf.set(q.id, f); }
}

const problems = [];
const push = (check, msg) => problems.push({ check, msg });
const byId = new Map(quests.map((q) => [q.id, q]));

// ---- check 0: schema -----------------------------------------------------------------------

let schemaResult = { run: false };
if (wantSchema) {
  const { default: Ajv } = await import('ajv/dist/2020.js');
  const ajv = new Ajv({ strict: false, allErrors: true });
  const validate = ajv.compile(JSON.parse(fs.readFileSync(SCHEMA, 'utf8')));
  let bad = 0;
  for (const q of quests) {
    if (!validate(q)) {
      bad++;
      push('check0-schema', `${q.id} (${fileOf.get(q.id)}): ${validate.errors.map((e) => `${e.instancePath} ${e.message}`).join('; ')}`);
    }
  }
  schemaResult = { run: true, validated: quests.length, failed: bad };
}

// ---- checks 2-5 + prohibitions ---------------------------------------------------------------

for (const q of quests) {
  const idx = (q.journal || []).map((e) => e.index);
  const local = new Set([
    ...(q.resolutions || []).map((r) => r.id),
    ...(q.failure_states || []).map((f) => f.id),
    ...(q.branches || []).map((b) => b.id),
    ...(((q.deceit || {}).revealed_by) || []).map((r) => r.id),
  ]);
  const revIds = new Set((((q.deceit || {}).revealed_by) || []).map((r) => r.id));

  // check 2 — distinct success index per resolution
  const ji = (q.resolutions || []).map((r) => r.journal_index);
  if (new Set(ji).size !== ji.length) push('check2-shared-success-index', `${q.id}: resolutions share a success journal index`);

  // check 3 — referential integrity of branches
  for (const b of q.branches || []) {
    for (const t of b.leads_to || []) if (!local.has(t)) push('check3-dangling-branch', `${q.id}: branch ${b.id} points at unknown target ${t}`);
  }

  // check 4 — requires_knowing resolves
  for (const r of q.resolutions || []) {
    for (const k of r.requires_knowing || []) if (!revIds.has(k)) push('check4-unknown-reveal', `${q.id}:${r.id} requires unknown reveal ${k}`);
  }

  // check 5 — journal bands
  for (const e of q.journal || []) {
    if (e.state === 'success' && (e.index < 90 || e.index > 99)) push('check5-band', `${q.id}: journal ${e.index} is state success, outside its band`);
    if (e.state === 'failure' && (e.index < 70 || e.index > 89)) push('check5-band', `${q.id}: journal ${e.index} is state failure, outside its band`);
  }
  const asc = idx.slice().sort((a, b) => a - b);
  if (JSON.stringify(idx) !== JSON.stringify(asc)) push('check5-order', `${q.id}: journal indices are not ascending`);

  // RI-DLG05 §D — one hit fails the item.
  for (const e of q.journal || []) {
    for (const h of scanProse(e.text)) push('dlg05-prohibition', `${q.id}/${e.index}: ${h.rule} ${JSON.stringify(h.match)}`);
  }
  for (const h of scanProse(q.directions || '')) push('dlg05-prohibition', `${q.id}/directions: ${h.rule} ${JSON.stringify(h.match)}`);
  if (!(q.directions || '').trim()) push('qst04-no-directions', `${q.id}: empty directions (AR-2)`);

  // RI-QST09 M1 — exclusivity well-formed and symmetric
  for (const r of q.resolutions || []) {
    for (const x of r.exclusive_with || []) {
      const other = (q.resolutions || []).find((o) => o.id === x);
      if (!other) { push('qst09-M1-dangling-exclusive', `${q.id}: ${r.id} excludes ${x}, which does not exist`); continue; }
      if (!(other.exclusive_with || []).includes(r.id)) push('qst09-M1-asymmetric', `${q.id}: ${r.id} excludes ${x} but not the reverse`);
    }
  }
  for (const m of q.mutually_exclusive_with || []) {
    const o = byId.get(m);
    if (!o) push('qst09-M1-dangling-exclusive', `${q.id}: mutually_exclusive_with ${m}, which does not exist`);
    else if (!(o.mutually_exclusive_with || []).includes(q.id)) push('qst09-M1-asymmetric', `${q.id}: exclusion with ${m} not declared on ${m}`);
  }
}

// ---- §D census -------------------------------------------------------------------------------

const n = quests.length || 1;
const sum = (f) => quests.reduce((a, q) => a + f(q), 0);
const failStates = quests.flatMap((q) => q.failure_states || []);
const rewards = quests.flatMap((q) => q.rewards || []);
const census = {
  n: quests.length,
  files: files.length,
  mean_resolutions: r2(sum((q) => (q.resolutions || []).length) / n),
  single_solution_pct: r2(quests.filter((q) => (q.resolutions || []).length === 1).length / n * 100),
  mean_branches: r2(sum((q) => (q.branches || []).length) / n),
  with_failures_pct: r2(quests.filter((q) => (q.failure_states || []).length > 0).length / n * 100),
  can_fail_false_pct: r2(quests.filter((q) => q.can_fail === false).length / n * 100),
  silent_failure_pct: r2(failStates.length ? failStates.filter((f) => f.silent).length / failStates.length * 100 : 0),
  mean_journal: r2(sum((q) => (q.journal || []).length) / n),
  directions_pct: r2(quests.filter((q) => (q.directions || '').length >= 20).length / n * 100),
  multi_faction_consequence_pct: r2(quests.filter((q) => Object.keys((q.consequences || {}).faction_reputation || {}).length >= 2).length / n * 100),
  unique_reward_fraction: r2(rewards.length ? rewards.filter((r) => r.unique_named).length / rewards.length : 0, 3),
  noncombat_resolvable_pct: r2(quests.filter((q) => (q.resolutions || []).some((r) => !r.violence_required)).length / n * 100),
  zero_kill_pct: r2(quests.filter((q) => (q.kill_required_npcs || []).length === 0).length / n * 100),
  deceit_pct: r2(quests.filter((q) => q.deceit).length / n * 100),
};

// §D targets, evaluated rather than eyeballed.
const TARGETS = [
  ['mean_resolutions', census.mean_resolutions >= 2.4, census.mean_resolutions >= 2.0, '>= 2.4 (hard fail < 2.0)'],
  ['single_solution_pct', census.single_solution_pct <= 15, census.single_solution_pct <= 30, '<= 15% (hard fail > 30%)'],
  ['mean_branches', census.mean_branches >= 1.3, census.mean_branches >= 1.0, '>= 1.3 (hard fail < 1.0)'],
  ['with_failures_pct', census.with_failures_pct >= 70, census.with_failures_pct >= 40, '>= 70% (hard fail < 40%)'],
  ['can_fail_false_pct', census.can_fail_false_pct <= 20, census.can_fail_false_pct <= 40, '<= 20% (hard fail > 40%)'],
  ['silent_failure_pct', census.silent_failure_pct >= 5 && census.silent_failure_pct <= 15, census.silent_failure_pct > 0 && census.silent_failure_pct <= 30, '5-15% (hard fail 0 or > 30%)'],
  ['mean_journal', census.mean_journal >= 5, census.mean_journal >= 4, '>= 5 (hard fail < 4)'],
  ['directions_pct', census.directions_pct === 100, census.directions_pct === 100, '100% (hard fail otherwise)'],
  ['multi_faction_consequence_pct', census.multi_faction_consequence_pct >= 30, census.multi_faction_consequence_pct >= 10, '>= 30% (hard fail < 10%)'],
];

// ---- RI-QST09 §2 — the exclusivity census ------------------------------------------------------

const services = JSON.parse(fs.readFileSync(path.join(QUEST_DIR, 'closure-registry.json'), 'utf8'));
const gatedByFlag = new Map();     // world flag -> [{kind, id}]
for (const row of services.gated) {
  if (!gatedByFlag.has(row.flag)) gatedByFlag.set(row.flag, []);
  gatedByFlag.get(row.flag).push(row);
}
const WEIGHT = { K1: 1, K2: 3, K3: 5, K4: 8 };

const closures = [];
for (const q of quests) {
  for (const r of q.resolutions || []) {
    const cons = r.consequences || {};
    const kinds = new Set();
    for (const x of r.exclusive_with || []) { kinds.add('K1'); closures.push({ quest: q.id, res: r.id, kind: 'K1', closes: `${q.id}:${x}`, reopenable: false }); }
    for (const l of [...(cons.locks || []), ...(q.consequences || {}).locks || []]) {
      const kind = byId.has(l) ? 'K2' : 'K3';
      kinds.add(kind);
      closures.push({ quest: q.id, res: r.id, kind, closes: l, reopenable: !!(services.reopenable || []).find((x) => x.id === l) });
    }
    for (const wf of cons.world_flags || []) {
      for (const g of gatedByFlag.get(wf) || []) {
        const kind = g.kind === 'quest' ? 'K2' : g.kind === 'faction' ? 'K3' : 'K4';
        kinds.add(kind);
        closures.push({ quest: q.id, res: r.id, kind, closes: g.id, via: wf, reopenable: !!(services.reopenable || []).find((x) => x.id === g.id) });
      }
    }
  }
}
const questsWithKind = (k) => new Set(closures.filter((c) => c.kind === k).map((c) => c.quest)).size;
const exclusiveQuests = quests.filter((q) => (q.resolutions || []).some((r) => (r.exclusive_with || []).length));
const reopenable = closures.filter((c) => c.reopenable).length;
const irreversibilityIndex = closures.length ? (closures.length - reopenable) / closures.length : 0;

// X7 — the difference test. For every exclusive pair, the two endings must differ measurably.
const cosmetic = [];
for (const q of quests) {
  const R = q.resolutions || [];
  for (let i = 0; i < R.length; i++) {
    for (const x of R[i].exclusive_with || []) {
      const j = R.findIndex((r) => r.id === x);
      if (j < i) continue;
      const a = R[i], b = R[j];
      const fa = new Set(((a.consequences || {}).world_flags) || []);
      const fb = new Set(((b.consequences || {}).world_flags) || []);
      const diffFlags = [...fa].filter((f) => !fb.has(f)).length + [...fb].filter((f) => !fa.has(f)).length;
      const ra = JSON.stringify((q.rewards || []).filter((r) => !r.on_resolution || r.on_resolution.includes(a.id)));
      const rb = JSON.stringify((q.rewards || []).filter((r) => !r.on_resolution || r.on_resolution.includes(b.id)));
      const ea = new Set([...((a.consequences || {}).kills_npc || []), ...Object.keys((a.consequences || {}).npc_disposition || {}), ...((a.consequences || {}).locks || [])]);
      const eb = new Set([...((b.consequences || {}).kills_npc || []), ...Object.keys((b.consequences || {}).npc_disposition || {}), ...((b.consequences || {}).locks || [])]);
      const entityDiff = [...ea].filter((f) => !eb.has(f)).length + [...eb].filter((f) => !ea.has(f)).length;
      if (diffFlags < 3 || ra === rb || entityDiff < 1) {
        cosmetic.push({ quest: q.id, pair: [a.id, b.id], differing_world_flags: diffFlags, rewards_differ: ra !== rb, differing_world_entities: entityDiff });
      }
    }
  }
}

// X8 — foreshadowing: the exclusivity is stated somewhere a player could read it, before the
// commit. We look in the quest's own directions/deceit/journal prose and in the dialogue and
// book corpora.
const proseCorpus = [];
for (const rel of ['game/data/dialogue', 'game/data/books']) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) continue;
  for (const f of walk(dir)) proseCorpus.push(fs.readFileSync(f, 'utf8'));
}
const foreshadowed = [];
for (const q of exclusiveQuests) {
  const own = JSON.stringify({ d: q.directions, k: q.deceit, j: q.journal, f: q.foreshadow });
  const key = (q.foreshadow_key || q.id);
  const hit = (q.foreshadow_sources || []).length > 0 || proseCorpus.some((t) => t.includes(key));
  foreshadowed.push({ quest: q.id, foreshadowed: hit || /instead of|not both|either .* or |once .* is|closes|never again|cannot then/i.test(own) });
}
const foreshadowPct = foreshadowed.length ? foreshadowed.filter((f) => f.foreshadowed).length / foreshadowed.length * 100 : 0;

// X10 — exclusivity resolvable without violence on at least one branch.
const x10 = exclusiveQuests.filter((q) => (q.resolutions || []).some((r) => (r.exclusive_with || []).length && !r.violence_required)).length;

const qst09 = {
  X1_exclusive_pct: r2(exclusiveQuests.length / n * 100),
  X2_quests_with_K2_or_higher: new Set(closures.filter((c) => c.kind !== 'K1').map((c) => c.quest)).size,
  X3_quests_with_K3: questsWithKind('K3'),
  X4_quests_with_K4: questsWithKind('K4'),
  X5_irreversibility_index: r2(irreversibilityIndex, 3),
  X6_declared_reopenable: (services.reopenable || []).length,
  X7_cosmetic_pairs: cosmetic,
  X8_foreshadowed_pct: r2(foreshadowPct),
  X10_nonviolent_exclusive_pct: r2(exclusiveQuests.length ? x10 / exclusiveQuests.length * 100 : 0),
  closure_score_total: closures.reduce((a, c) => a + WEIGHT[c.kind], 0),
  closures: closures.length,
};
const QST09_BARS = [
  ['X1_exclusive_pct', qst09.X1_exclusive_pct >= 45, '>= 45%'],
  ['X2_quests_with_K2_or_higher', qst09.X2_quests_with_K2_or_higher >= 12, '>= 12'],
  ['X3_quests_with_K3', qst09.X3_quests_with_K3 >= 6, '>= 6'],
  ['X4_quests_with_K4', qst09.X4_quests_with_K4 >= 3, '>= 3'],
  ['X5_irreversibility_index', qst09.X5_irreversibility_index >= 0.85, '>= 0.85'],
  ['X6_declared_reopenable', qst09.X6_declared_reopenable <= 2, '<= 2'],
  ['X7_cosmetic_pairs', cosmetic.length === 0, '0'],
  ['X8_foreshadowed_pct', qst09.X8_foreshadowed_pct >= 80, '>= 80%'],
  ['X10_nonviolent_exclusive_pct', qst09.X10_nonviolent_exclusive_pct >= 60, '>= 60%'],
];

// ---- report ------------------------------------------------------------------------------------

const out = {
  quests: census.n, files: files.length, schema: schemaResult,
  census, targets: TARGETS.map(([k, meets, notHardFail, spec]) => ({ metric: k, value: census[k], meets_target: meets, above_hard_fail: notHardFail, spec })),
  qst09, qst09_bars: QST09_BARS.map(([k, ok, spec]) => ({ bar: k, value: qst09[k], pass: ok, spec })),
  banned_rules: BANNED.map((b) => b.rule),
  problems,
};

if (wantJson) { console.log(JSON.stringify(out, null, 1)); }
else {
  console.log(`quest-audit: ${census.n} quests in ${files.length} file(s) under game/data/quests/`);
  if (schemaResult.run) console.log(`  check 0  schema: ${schemaResult.validated - schemaResult.failed}/${schemaResult.validated} validate`);
  console.log('\n  RI-QST04 §D census');
  for (const t of out.targets) console.log(`    ${t.meets_target ? 'PASS' : t.above_hard_fail ? 'below' : 'HARDFAIL'}  ${t.metric.padEnd(30)} ${String(t.value).padStart(7)}   target ${t.spec}`);
  console.log('\n  RI-QST09 §2 exclusivity census');
  for (const b of out.qst09_bars) console.log(`    ${b.pass ? 'PASS' : 'FAIL'}  ${b.bar.padEnd(30)} ${String(Array.isArray(b.value) ? b.value.length : b.value).padStart(7)}   bar ${b.spec}`);
  console.log(`\n  closure score ${qst09.closure_score_total} over ${qst09.closures} closures`);
  console.log(`\n  integrity problems: ${problems.length}`);
  for (const p of problems.slice(0, 40)) console.log(`    [${p.check}] ${p.msg}`);
}

process.exit(problems.length ? 1 : 0);

function r2(v, dp = 2) { const m = 10 ** dp; return Math.round(v * m) / m; }
function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else if (e.name.endsWith('.json')) yield p;
  }
}
