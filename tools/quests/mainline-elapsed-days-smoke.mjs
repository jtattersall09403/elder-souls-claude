#!/usr/bin/env node
/**
 * Focused W1-19 smoke for Q-MAIN-20's finding-of-fact clock gate.
 *
 * The cheap arm proves that both the primitive gate and QuestEngine's live day/opened-day
 * context refuse day 10 and open day 11.  When --chain-evidence is supplied, the smoke also
 * checks the production runner's eleven player-facing Wait-menu observations.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { QuestBook } from '../../game/src/sim/quest/defs.js';
import { canResolve } from '../../game/src/sim/quest/gate.js';
import { QuestEngine } from '../../game/src/sim/quest/machine.js';
import { ensureDir, parseArgs, RUNS_DIR, usage, wantsHelp, writeJson } from '../lib/cli.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('mainline-elapsed-days-smoke.mjs [--chain-evidence FILE] [--out DIR]');
const outDir = path.resolve(String(args.out || path.join(RUNS_DIR, 'W1-19-builder-persistent', 'elapsed-days')));
ensureDir(outDir);

const sourceFiles = [
  'game/data/quests/mainline-act4.json',
  'game/src/sim/quest/defs.js',
  'game/src/sim/quest/gate.js',
  'game/src/sim/quest/machine.js',
  'tools/quests/mainline-chain-floor.mjs',
  'tools/quests/mainline-elapsed-days-smoke.mjs',
];
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const act4 = JSON.parse(fs.readFileSync(sourceFiles[0], 'utf8'));
const q20 = (act4.quests || []).find((q) => q.id === 'Q-MAIN-20');
const finding = (q20?.resolutions || []).find((r) => r.id === 'res_finding_of_fact');
const failures = [];
if (!q20 || !finding) failures.push('Q-MAIN-20/res_finding_of_fact is absent');
if (finding?.requires?.elapsed_days_since_open !== 11) failures.push('finding-of-fact does not demand exactly 11 elapsed days');
const findingJournal = (q20?.journal || []).find((entry) => entry.index === finding?.journal_index)?.text || '';
if (!/eleven days and three clerks/i.test(findingJournal) || /six weeks/i.test(findingJournal)) {
  failures.push('finding-of-fact journal does not describe the same eleven-day gate the player crossed');
}

const direct = finding ? {
  day_10: canResolve(finding, { daysSinceQuestOpened: 10, knowledge: new Set(['rev_the_lever']) }),
  day_11: canResolve(finding, { daysSinceQuestOpened: 11, knowledge: new Set(['rev_the_lever']) }),
} : null;
if (direct && (direct.day_10.available || !direct.day_10.why.includes('elapsed days 10/11'))) failures.push('primitive gate did not emit the exact day-10 refusal');
if (direct && !direct.day_11.available) failures.push('primitive gate did not open on day 11');

const invalidAct4 = structuredClone(act4);
const invalidFinding = invalidAct4.quests.find((q) => q.id === 'Q-MAIN-20').resolutions.find((r) => r.id === 'res_finding_of_fact');
invalidFinding.requires.elapsed_days_since_open = 0;
let dataValidation = { invalid_value: 0, rejected: false, expected_row: 'elapsed_days_since_open must be a positive whole simulated-day count', observed: null };
try { new QuestBook({ act4: invalidAct4 }, { strict: true }); } catch (error) {
  dataValidation.observed = String(error?.message || error);
  dataValidation.rejected = dataValidation.observed.includes(dataValidation.expected_row);
}
if (!dataValidation.rejected) failures.push('QuestBook strict mode accepted an invalid elapsed-day gate');

const sim = {
  frame: 0,
  env: { dayCount: 10, region: 'test' },
  world: { npcsDead: [] },
  inventory: [],
  progression: { attributes: {}, skills: {}, gold: 0 },
  magic: null,
  quest: {
    quests: { 'Q-MAIN-20': { stage: 36, opened: true, failed: false, flags: { opened_day: 0, 'know:rev_the_lever': 1 } } },
    flags: {}, journal: [], topicsKnown: [], completed: [], factions: {},
    dispositions: { 'prefect-galvus-arn': 12 }, booksRead: [], afflictions: [],
  },
};
const engine = new QuestEngine(new QuestBook({ act4 }), null, {
  hooks: [],
  entry_topics: act4.quests.map((quest) => ({ quest: quest.id, index: quest.journal[0].index, adds_topics: [] })),
  deadlines: [],
}, sim);
engine.presenceMode = 'off';
const view = () => engine.resolutionsFor('Q-MAIN-20').find((r) => r.id === 'res_finding_of_fact');
const machine = { day_10: view() };
sim.env.dayCount = 11;
machine.day_11 = view();
if (machine.day_10.available || !machine.day_10.why.includes('elapsed days 10/11')) failures.push('QuestEngine did not emit the exact day-10 refusal');
if (!machine.day_11.available) failures.push('QuestEngine did not open the choice on day 11');

let production = null;
if (args['chain-evidence']) {
  const input = path.resolve(String(args['chain-evidence']));
  const doc = JSON.parse(fs.readFileSync(input, 'utf8'));
  const chains = (doc.rows || []).flatMap((r) => Object.values(r.chains || {}));
  const qTrace = chains.flatMap((c) => c.trace || []).find((t) => t.quest === 'Q-MAIN-20');
  const waits = qTrace?.resolution_wait?.waits || [];
  production = {
    input,
    input_sha256: sha256(input),
    resolution: qTrace?.resolution || null,
    required_elapsed_days: qTrace?.resolution_wait?.required_elapsed_days ?? null,
    opened_day: qTrace?.resolution_wait?.opened_day ?? null,
    start_day: qTrace?.resolution_wait?.start_day ?? null,
    end_day: qTrace?.resolution_wait?.end_day ?? null,
    wait_count: waits.length,
    waits_player_facing: waits.filter((w) => w.production_wait === true && w.selected_hours === 24 && (w.menu_modes || []).includes('wait')).length,
    waits_stationary: waits.filter((w) => w.position_delta_m === 0).length,
    waits_no_heal_or_refill: waits.filter((w) => w.hp_before === w.hp_after && w.estus_before === w.estus_after).length,
  };
  if (production.resolution !== 'res_finding_of_fact') failures.push('production chain did not take res_finding_of_fact');
  if (production.required_elapsed_days !== 11 || production.end_day - production.opened_day < 11) failures.push('production chain did not cross the 11-day gate');
  for (const [label, n] of [['player-facing', production.waits_player_facing], ['stationary', production.waits_stationary], ['non-healing', production.waits_no_heal_or_refill]]) {
    if (n !== 11) failures.push(`production chain has ${n}/11 ${label} waits`);
  }
}

const result = {
  schema: 'elder-souls/w1-19-elapsed-days-smoke@1',
  tool: 'tools/quests/mainline-elapsed-days-smoke.mjs',
  ok: failures.length === 0,
  expected_red_row: 'elapsed days 10/11',
  journal_gate_text_matches: failures.every((row) => !row.startsWith('finding-of-fact journal')),
  support: { direct_rows: direct ? 2 : 0, machine_rows: 2, production_wait_rows: production?.wait_count || 0 },
  source_hashes: Object.fromEntries(sourceFiles.map((p) => [p, sha256(p)])),
  direct,
  machine,
  data_validation: dataValidation,
  production,
  failures,
};
writeJson(path.join(outDir, 'elapsed-days-smoke.json'), result);
console.log(`Q20 elapsed-days smoke: ${result.ok ? 'PASS' : 'FAIL'}; primitive 2/2; machine 2/2; production waits ${result.support.production_wait_rows}`);
console.log(`expected red row: ${result.expected_red_row}`);
console.log(`wrote ${path.join(outDir, 'elapsed-days-smoke.json')}`);
if (!result.ok) process.exit(1);
