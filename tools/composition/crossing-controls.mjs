#!/usr/bin/env node
/**
 * Fail-closed W1-25 crossing-control gate.
 *
 * A source A/B is not enough to qualify a seam.  Each claimed cell must also prove that the
 * production consumer executed, that disconnecting it removes the effect, that an unrelated
 * source does not move the observable, and that restoring the consumer recovers the effect.
 * This gate deliberately validates evidence written by the live runner; it never manufactures
 * target state and cannot act as a production consumer.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? null : args[i + 1];
};
const hash = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const same = (a, b) => hash(a) === hash(b);

export function validateCell(row) {
  const arms = row?.arms || {};
  const names = ['positive', 'null', 'consumer_delete', 'source_remove', 'irrelevant_source', 'restore'];
  const missing_arms = names.filter((name) => !arms[name]);
  const allObserved = !missing_arms.length && names.every((name) => arms[name].observed === true);
  const positive = arms.positive;
  const checks = {
    declared_crossing: row?.declared_crossing === true,
    real_consumer_named: typeof row?.consumer?.symbol === 'string' && row.consumer.symbol.length > 0,
    player_observable_named: typeof row?.observable === 'string' && row.observable.length > 0,
    support_nonzero: Number(positive?.support) > 0 && names.every((name) => Number(arms[name]?.support) > 0),
    separated_source_values: Array.isArray(row?.source_values) && row.source_values.length >= 2 &&
      !same(row.source_values[0], row.source_values[1]),
    predicted_effect_recorded: typeof row?.prediction === 'string' && row.prediction.length > 0,
    all_arms_observed: allObserved,
    positive_differs_from_null: allObserved && !same(positive.target, arms.null.target),
    source_removal_returns_null: allObserved && same(arms.source_remove.target, arms.null.target),
    consumer_delete_returns_null: allObserved && same(arms.consumer_delete.target, arms.null.target),
    irrelevant_source_preserves_positive: allObserved && same(arms.irrelevant_source.target, positive.target),
    restore_recovers_positive: allObserved && same(arms.restore.target, positive.target),
    consumer_executed: Number(positive?.consumer_calls) > 0 && Number(arms.restore?.consumer_calls) > 0,
    deleted_consumer_not_executed: allObserved && Number(arms.consumer_delete.consumer_calls) === 0,
    changed_hashes_recorded: allObserved && names.every((name) =>
      typeof arms[name].source_hash === 'string' && typeof arms[name].consumer_hash === 'string'),
    no_direct_target_mutation: row?.direct_target_mutation !== true,
    no_harness_consumer: row?.consumer?.kind === 'production',
  };
  return {
    cell: row?.cell || null,
    missing_arms,
    checks,
    pass: missing_arms.length === 0 && Object.values(checks).every(Boolean),
  };
}

export function validateManifest(input) {
  const rows = Array.isArray(input) ? input : input?.cells || input?.crossings || [];
  const results = rows.map(validateCell);
  const passing = results.filter((row) => row.pass);
  const structural = passing.filter((result) => {
    const source = rows.find((row) => row.cell === result.cell);
    return source?.tier === 'structural' && source?.durability?.reload_observed === true;
  });
  const score = passing.reduce((sum, result) => {
    const source = rows.find((row) => row.cell === result.cell);
    return sum + (source?.tier === 'structural' ? 6 : 2);
  }, 0);
  return {
    schema: 'elder-souls/w1-25-crossing-controls@1',
    results,
    roll_up: {
      claimed: rows.length,
      qualifying: passing.length,
      structural: structural.length,
      matrix_score: score,
      pass: passing.length >= 10 && structural.length >= 1 && score >= 20,
    },
  };
}

function fixture() {
  const arm = (target, calls) => ({ observed: true, target, support: 2, consumer_calls: calls,
    source_hash: 'a'.repeat(64), consumer_hash: 'b'.repeat(64) });
  return { cell: 'A->B', declared_crossing: true, tier: 'mechanical', source_values: [0, 1],
    prediction: 'B changes', observable: 'visible B', consumer: { symbol: 'consumeA', kind: 'production' },
    arms: { positive: arm('changed', 1), null: arm('base', 1), consumer_delete: arm('base', 0),
      source_remove: arm('base', 1), irrelevant_source: arm('changed', 1), restore: arm('changed', 1) } };
}

if (args.includes('--self-test')) {
  const good = fixture();
  const mutations = [
    (x) => { delete x.arms.consumer_delete; },
    (x) => { x.arms.consumer_delete.target = 'changed'; },
    (x) => { x.arms.irrelevant_source.target = 'noise'; },
    (x) => { x.arms.restore.target = 'base'; },
    (x) => { x.arms.positive.consumer_calls = 0; },
    (x) => { x.direct_target_mutation = true; },
  ];
  if (!validateCell(good).pass) process.exit(1);
  for (const mutate of mutations) {
    const broken = structuredClone(good); mutate(broken);
    if (validateCell(broken).pass) process.exit(1);
  }
  console.log(`PASS crossing-controls self-test: positive green; ${mutations.length} injected defects red`);
  process.exit(0);
}

const input = value('in');
const output = value('out');
if (!input) {
  console.error('usage: crossing-controls.mjs --in manifest.json [--out report.json] | --self-test');
  process.exit(2);
}
const report = validateManifest(JSON.parse(fs.readFileSync(input, 'utf8')));
if (output) fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(report.roll_up.pass ? 'PASS' : `RED ${report.roll_up.qualifying}/10 qualifying, ` +
  `${report.roll_up.structural}/1 structural, score ${report.roll_up.matrix_score}/20`);
process.exit(report.roll_up.pass ? 0 : 1);
