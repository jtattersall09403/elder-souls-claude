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
const SHA256 = /^[a-f0-9]{64}$/;
const validHash = (v) => typeof v === 'string' && SHA256.test(v);
const tracesConsumer = (arm, symbol) => Array.isArray(arm?.consumer_trace) &&
  arm.consumer_trace.some((event) => event?.symbol === symbol && Number(event?.calls) > 0 &&
    event?.production === true);
const noTargetWrites = (arm) => Array.isArray(arm?.target_writes) && arm.target_writes.length === 0;

export function validateCell(row) {
  const arms = row?.arms || {};
  const names = ['positive', 'null', 'consumer_delete', 'source_remove', 'irrelevant_source', 'restore'];
  const missing_arms = names.filter((name) => !arms[name]);
  const allObserved = !missing_arms.length && names.every((name) => arms[name].observed === true);
  const positive = arms.positive;
  const symbol = row?.consumer?.symbol;
  const hashesValid = allObserved && names.every((name) =>
    validHash(arms[name]?.source_hash) && validHash(arms[name]?.consumer_hash) &&
    validHash(arms[name]?.target_hash) && arms[name].target_hash === hash(arms[name].target));
  const structuralDurability = row?.tier !== 'structural' || (row?.durability?.reload_observed === true &&
    row?.durability?.restart_observed === true && Number(row?.durability?.support) > 0 &&
    same(row.durability.reload_target, positive?.target) &&
    same(row.durability.restart_target, positive?.target) &&
    validHash(row.durability.save_hash) && validHash(row.durability.reload_save_hash) &&
    row.durability.save_hash === row.durability.reload_save_hash);
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
    consumer_executed: allObserved && ['positive', 'null', 'source_remove', 'irrelevant_source', 'restore']
      .every((name) => Number(arms[name]?.consumer_calls) > 0 && tracesConsumer(arms[name], symbol)),
    deleted_consumer_not_executed: allObserved && Number(arms.consumer_delete.consumer_calls) === 0 &&
      !tracesConsumer(arms.consumer_delete, symbol),
    hashes_valid: hashesValid,
    source_hash_relations: hashesValid && positive.source_hash !== arms.null.source_hash &&
      arms.source_remove.source_hash === arms.null.source_hash &&
      arms.irrelevant_source.source_hash === positive.source_hash &&
      arms.restore.source_hash === positive.source_hash,
    irrelevant_hash_changed: hashesValid && validHash(positive.irrelevant_hash) &&
      validHash(arms.irrelevant_source.irrelevant_hash) &&
      positive.irrelevant_hash !== arms.irrelevant_source.irrelevant_hash,
    consumer_hash_relations: hashesValid && arms.consumer_delete.consumer_hash !== positive.consumer_hash &&
      ['null', 'source_remove', 'irrelevant_source', 'restore'].every((name) =>
        arms[name].consumer_hash === positive.consumer_hash),
    no_direct_target_mutation: row?.direct_target_mutation !== true && allObserved &&
      names.every((name) => noTargetWrites(arms[name])),
    no_harness_consumer: row?.consumer?.kind === 'production',
    structural_durability: structuralDurability,
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
  const uniquePassing = [...new Map(passing.map((row) => [row.cell, row])).values()];
  const structural = uniquePassing.filter((result) => {
    const source = rows.find((row) => row.cell === result.cell);
    return source?.tier === 'structural' && source?.durability?.reload_observed === true;
  });
  const score = uniquePassing.reduce((sum, result) => {
    const source = rows.find((row) => row.cell === result.cell);
    return sum + (source?.tier === 'structural' ? 6 : 2);
  }, 0);
  const directions = Object.fromEntries(['W2F', 'F2W'].map((direction) => [direction,
    uniquePassing.filter((result) => rows.find((row) => row.cell === result.cell)?.direction === direction).length]));
  const denominators = {
    submitted_rows: rows.length,
    unique_cells: new Set(rows.map((row) => row.cell)).size,
    fully_observed_rows: results.filter((row) => row.checks.all_arms_observed).length,
  };
  return {
    schema: 'elder-souls/w1-25-crossing-controls@1',
    results,
    roll_up: {
      claimed: rows.length,
      qualifying: uniquePassing.length,
      structural: structural.length,
      matrix_score: score,
      directions,
      denominators,
      pass: uniquePassing.length >= 10 && structural.length >= 1 && score >= 20 &&
        directions.W2F > 0 && directions.F2W > 0 && denominators.unique_cells === denominators.submitted_rows,
    },
  };
}

function fixture() {
  const sourceOn = 'a'.repeat(64), sourceOff = 'c'.repeat(64);
  const consumerOn = 'b'.repeat(64), consumerOff = 'd'.repeat(64);
  const irrelevant0 = 'e'.repeat(64), irrelevant1 = 'f'.repeat(64);
  const arm = (target, calls, source_hash = sourceOn, consumer_hash = consumerOn,
    irrelevant_hash = irrelevant0) => ({ observed: true, target, target_hash: hash(target), support: 2,
    consumer_calls: calls, consumer_trace: calls ? [{ symbol: 'consumeA', calls, production: true }] : [],
    target_writes: [], source_hash, consumer_hash, irrelevant_hash });
  return { cell: 'A->B', direction: 'W2F', declared_crossing: true, tier: 'mechanical', source_values: [0, 1],
    prediction: 'B changes', observable: 'visible B', consumer: { symbol: 'consumeA', kind: 'production' },
    arms: { positive: arm('changed', 1), null: arm('base', 1, sourceOff),
      consumer_delete: arm('base', 0, sourceOn, consumerOff), source_remove: arm('base', 1, sourceOff),
      irrelevant_source: arm('changed', 1, sourceOn, consumerOn, irrelevant1),
      restore: arm('changed', 1) } };
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
    (x) => { x.arms.positive.target_hash = '0'.repeat(64); },
    (x) => { x.arms.consumer_delete.consumer_hash = x.arms.positive.consumer_hash; },
    (x) => { x.arms.irrelevant_source.irrelevant_hash = x.arms.positive.irrelevant_hash; },
    (x) => { x.arms.restore.consumer_trace = []; },
    (x) => { x.arms.null.consumer_trace = []; },
    (x) => { x.arms.null.target_writes.push('target'); },
  ];
  if (!validateCell(good).pass) process.exit(1);
  for (const mutate of mutations) {
    const broken = structuredClone(good); mutate(broken);
    if (validateCell(broken).pass) process.exit(1);
  }
  const structural = structuredClone(good);
  structural.tier = 'structural';
  structural.durability = { reload_observed: true, restart_observed: true, support: 2,
    reload_target: 'changed', restart_target: 'changed', save_hash: '1'.repeat(64),
    reload_save_hash: '1'.repeat(64) };
  if (!validateCell(structural).pass) process.exit(1);
  structural.durability.restart_target = 'base';
  if (validateCell(structural).pass) process.exit(1);
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
  `${report.roll_up.structural}/1 structural, score ${report.roll_up.matrix_score}/20, ` +
  `${report.roll_up.directions.W2F} W2F / ${report.roll_up.directions.F2W} F2W`);
process.exit(report.roll_up.pass ? 0 : 1);
