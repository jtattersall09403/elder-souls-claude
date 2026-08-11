#!/usr/bin/env node
/**
 * W1-19 Gate B fixture compiler.
 *
 * This is deliberately a compiler, not a simulator: it discovers every live mainline gate and
 * exclusive resolution sibling from the authoritative quest JSON and emits the fail-closed
 * population which the production conversation runner must play.  No quest API or state mutator
 * appears here.  A later --observations file may contain the runner's player-facing observations;
 * every discovered row then requires a matched red and green arm.
 *
 * node tools/quests/mainline-gate-b-fixtures.mjs [--out DIR] [--observations FILE]
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, ensureDir, RUNS_DIR } from '../lib/cli.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('mainline-gate-b-fixtures.mjs [--out DIR] [--observations FILE]');
const outDir = path.resolve(String(args.out || path.join(RUNS_DIR, 'W1-19-builder-persistent', 'gate-b')));
ensureDir(outDir);
const qdir = path.resolve('game/data/quests');
const quests = [];
for (const file of fs.readdirSync(qdir).sort()) {
  if (!/^mainline.*\.json$/.test(file) || file === 'mainline.json') continue;
  const doc = JSON.parse(fs.readFileSync(path.join(qdir, file), 'utf8'));
  for (const q of doc.quests || []) if (q.category === 'main') quests.push({ ...q, _file: `game/data/quests/${file}` });
}
const fixtures = [];
const add = (q, resolution, kind, demand) => {
  const id = [q.id, resolution?.id || 'offer', kind].join('::');
  fixtures.push({
    id, quest: q.id, resolution: resolution?.id || null, giver: q.giver?.npc_id || null,
    kind, demand, source: q._file,
    matched_fixture: {
      common_checkpoint: `before:${q.id}${resolution ? `:${resolution.id}` : ':offer'}`,
      failing_arm: { expected_choice_visible: false, expected_refusal: true, production_actions_only: true },
      passing_arm: { expected_choice_visible: true, expected_refusal: false, production_actions_only: true },
      forbidden_verbs: ['questOpen', 'questReveal', 'questNote', 'questSetFlag', 'questResolve', 'learnTopic', 'spawnNPC', 'teleport'],
    },
  });
};
for (const q of quests) {
  if (q.giver?.disposition_min != null) add(q, null, 'disposition', { min: q.giver.disposition_min, scope: 'offer' });
  for (const r of q.resolutions || []) {
    const req = r.requirements || r.requires || r;
    if (req.disposition != null) add(q, r, 'disposition', { min: req.disposition, scope: 'resolution' });
    if (req.attributes) for (const [attribute, min] of Object.entries(req.attributes)) add(q, r, 'attribute', { attribute, min });
    const knowing = r.requires_knowing || req.requires_knowing;
    if (knowing) for (const fact of knowing) add(q, r, 'knowledge', { fact });
    if (req.faction_rank) add(q, r, 'faction', req.faction_rank);
  }
}
fixtures.sort((a,b) => a.id.localeCompare(b.id));

const choices = [];
const seen = new Set();
for (const q of quests) for (const r of q.resolutions || []) for (const sibling of r.exclusive_with || []) {
  const pair = [r.id, sibling].sort(); const key = `${q.id}::${pair.join('::')}`;
  if (seen.has(key)) continue; seen.add(key);
  const s = (q.resolutions || []).find(x => x.id === sibling);
  if (!s) throw new Error(`${q.id} ${r.id} names absent exclusive sibling ${sibling}`);
  choices.push({
    id: key, quest: q.id, giver: q.giver?.npc_id || null, source: q._file,
    common_checkpoint: `before-choice:${q.id}:${pair.join('+')}`,
    arms: pair.map(id => ({ resolution: id, action: `conversationSay(quest-resolve:${q.id}:${id})` })),
    required_state_vector: { durable_flags_min: 3, rewards_min: 1, entity_delta_min: 1, route_specific_journal: true },
    production_actions_only: true,
    q_main_23_crossing: q.id === 'Q-MAIN-23' ? {
      clause_resolution: 'res_sign_the_clause', clause_roster: 4, sibling_roster: 6,
      consumer: 'production encounter consequence pipeline',
    } : null,
  });
}
choices.sort((a,b) => a.id.localeCompare(b.id));

let observations = null; let observed = { fixture_rows: 0, choice_rows: 0, failures: [] };
if (args.observations) {
  observations = JSON.parse(fs.readFileSync(path.resolve(String(args.observations)), 'utf8'));
  const byId = new Map((observations.fixtures || []).map(x => [x.id, x]));
  for (const f of fixtures) {
    const o = byId.get(f.id);
    if (!o) { observed.failures.push(`${f.id}: missing observation`); continue; }
    observed.fixture_rows++;
    if (!o.failing || o.failing.choice_visible !== false || o.failing.refused !== true) observed.failures.push(`${f.id}: failing arm did not refuse`);
    if (!o.passing || o.passing.choice_visible !== true || o.passing.refused === true) observed.failures.push(`${f.id}: passing arm did not open`);
    if (o.checkpoint_hash_fail !== o.checkpoint_hash_pass) observed.failures.push(`${f.id}: arms did not share checkpoint`);
    if ((o.forbidden_calls || 0) !== 0) observed.failures.push(`${f.id}: forbidden advancement calls=${o.forbidden_calls}`);
  }
  const byChoice = new Map((observations.exclusive_choices || []).map(x => [x.id, x]));
  for (const c of choices) {
    const o = byChoice.get(c.id);
    if (!o) { observed.failures.push(`${c.id}: missing exclusive-choice observation`); continue; }
    observed.choice_rows++;
    if ((o.arms || []).length !== 2) observed.failures.push(`${c.id}: needs exactly two played arms`);
    for (const arm of o.arms || []) {
      if ((arm.durable_flags_delta || 0) < 3 || (arm.reward_delta || 0) < 1 || (arm.entity_delta || 0) < 1 || !arm.route_specific_journal)
        observed.failures.push(`${c.id}/${arm.resolution}: incomplete state vector`);
    }
    if (c.q_main_23_crossing) {
      const clause = (o.arms || []).find(a => a.resolution === 'res_sign_the_clause');
      const sibling = (o.arms || []).find(a => a.resolution !== 'res_sign_the_clause');
      if (!clause || clause.roster !== 4 || !sibling || sibling.roster !== 6) observed.failures.push(`${c.id}: expected clause 4 / sibling 6 roster crossing`);
    }
  }
}
const counts = Object.fromEntries(['disposition','attribute','knowledge','faction'].map(k => [k, fixtures.filter(x => x.kind === k).length]));
const result = {
  schema: 'elder-souls/w1-19-gate-b-fixtures@1', tool: 'tools/quests/mainline-gate-b-fixtures.mjs',
  quest_population: quests.length, fixture_population: fixtures.length, counts,
  exclusive_choice_population: choices.length, q_main_23_crossing_rows: choices.filter(x => x.q_main_23_crossing).length,
  observations_supplied: !!observations, observed, fixtures, exclusive_choices: choices,
};
writeJson(path.join(outDir, 'fixture-manifest.json'), result);
console.log(`Gate B: ${quests.length} main quests; ${fixtures.length} matched gate fixtures ${JSON.stringify(counts)}; ${choices.length} exclusive sibling pairs`);
console.log(`Q-MAIN-23 crossing rows: ${result.q_main_23_crossing_rows}`);
console.log(observations ? `observed ${observed.fixture_rows}/${fixtures.length} fixtures and ${observed.choice_rows}/${choices.length} choices; failures ${observed.failures.length}` : 'manifest-only run (supply --observations to enforce played population)');
console.log(`wrote ${path.join(outDir, 'fixture-manifest.json')}`);
if (observations && (observed.failures.length || observed.fixture_rows !== fixtures.length || observed.choice_rows !== choices.length)) process.exit(1);
