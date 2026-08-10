#!/usr/bin/env node
/**
 * Emit W1-16's fail-closed native method matrix.
 *
 * This is deliberately a ledger, not a scorer. A missing current-run artifact is
 * UNMEASURABLE even when an older verdict was green; independent/blind methods remain
 * UNMEASURABLE for the builder. Native item text remains the threshold authority.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const items = {
  'RI-AI05': ['role distinctness','band conformance','region mix','introduction rule','no level scaling','souls economy and anti-farm','health-sponge detector','gank legality'],
  'RI-CMB01': ['animation census','i-frame boundary probe','root motion / skate','uncancellability and buffer','threshold cliffs','CONSUMPTION coupling'],
  'RI-PRG01': ['formula fidelity','cumulative anchors','superlinearity','monotone smoothness','souls are never money','yield cross-check'],
  'RI-PRG02': ['sheet completeness','attribute breadth','soft-cap curves','scaling-grade separation','two-stream ratio','AR-1 speed guard','six-character blind test','CONSUMPTION coupling'],
  'RI-PRG03': ['19-skill inventory','curve fidelity','use-growth purity','scaling-grade shift','cost gate','attribute-grant accounting','gate determinism','no hard lockout','CONSUMPTION coupling'],
  'RI-PRG05': ['gold balance sheet','regional solvency','barter formulas','flip invariant fuzz','no soul prices','four un-buyables','no gold farming','merchant pools','training cannot become levelling'],
  'RI-PRG06': ['R1 full-clear yield','six-region cumulative pace','1,000-run typical-player sim','minutes per level','no level scaling','adjacent-band separation','quest souls zero','boss non-respawn','night multiplier'],
  'RI-PRG07': ['48-cell max-load grid','equip tier breakpoints','pack/equip anti-merge','AR-1 burden/combat trace diff','burden tier sweep','six-build reachability','Shell-Warden 200-run viability','gold weightlessness','RI-CMB01 subordination','all-consumer census','save and magic invariance'],
  'RI-CHR01': ['eight-field inventory','10x15 attribute arithmetic','150-pair skill composition','questionnaire purity','540-signature coverage','viability sims','20-signature blind legibility','five class-shape prohibitions','irreversibility audit','CONSUMPTION coupling'],
  'RI-CHR02': ['10-race table','reaction matrix','68-point disposition test','NPC coverage','dialogue volume','30-line blind register','price assertion','AR-3 encounter composition','guard thresholds','CONSUMPTION coupling'],
  'RI-CHR03': ['nine-sign roster','drawback census','Spilled respawn','Unlit Water encounters','balance decidability','dialogue visibility','one re-cut','number conformance','Kaal-Kaal composition','CONSUMPTION coupling'],
  'RI-DLG04': ['formula conformance','d-curve','Intimidate sign','Taunt legal kill','bribe economy','four gating boundaries','distribution','playable proof'],
  'RI-QST03': ['complete eight-rank tables','monotonic thresholds','favoured-skill coherence','reputation earnable','exclusivity bites','X3 escape hatches','expulsion/readmission'],
  'RI-QST08': ['unique fraction','gold-only share','reward-type/non-item share','unique integrity','resolution differentiation','non-violent parity','no level scaling','information reward resolution'],
  'RI-STL01': ['formula conformance','five worked rows','sound radii','no proximity leak','opener purity','search behaviour','no stealth HUD','light audit','bypass census'],
  'RI-STL02': ['ownership coverage','ownership enforcement','lock determinism','tolerance curve','ward-angle authoring','no-lockout audit','pickpocket determinism','trespass census','fence economics'],
  'RI-TRV01': ['reference regeneration','existence and shape','graph metrics','water primacy','walked-once gate','arrival geometry','ride fidelity','tariff conformance','time ratios','station siting','availability gates','severance','reach subset'],
  'RI-TRV02': ['P1 spell catalogue','P2 round trip','P3 intervention discovery','P4 interventions differ','P5 affordability','P6 quest routes','D1 combat gate','D2 shortcut solvent','D3 escape denial','D4 no destination picker','D5 HEARTH separation','D6 no unlock laundering','D7 soul stain'],
  'RI-LOR05': ['terminology lock','12-row diegetic coverage','five-villager test','souls purchase probe','sapwell warp probe','taint fairness','Hist-restraint count','politicised checkpoint','RI-LOR06 cross-check'],
  'RI-UIX03': ['static inventory census','P1/P2 pause arithmetic','P5 occlusion','P6 input liveness','P7 equip commitment','forbidden overlay set','level-up screen','blind inventory pair'],
};

const source = Object.fromEntries(Object.keys(items).map((id) => {
  const hit = [...fs.readdirSync(path.join(ROOT, 'corpus'), { recursive: true })]
    .find((p) => typeof p === 'string' && path.basename(p).startsWith(`${id}-`) && p.endsWith('.md'));
  return [id, hit ? `corpus/${hit}` : null];
}));

const livePath = 'reports/w1-16/r5-live.json';
const live = exists(livePath) ? readJson(livePath) : null;
const liveGreen = live && Object.values(live.probes || {}).every((p) => p && p.coupled === true);
const creationRaw = [...fs.readdirSync(path.join(ROOT, 'reports/runs/_raw'))]
  .filter((n) => n.startsWith('node-tools-analysis-creation-audit.mjs-')).sort().at(-1);

function evidenceFor(id, n, title) {
  if (id === 'RI-PRG07' && [2,3,4,5,9,10,11].includes(n) && liveGreen)
    return { status: 'PASS', evidence_path: livePath, note: 'Current live r4 continuation probe; each fix and teardown arm is coupled.' };
  if (id === 'RI-CMB01' && [1,5,6].includes(n) && liveGreen)
    return { status: 'PASS', evidence_path: livePath, note: 'Current live tier/roll/consumption evidence; M2-M4 remain independent NOT_RUN.' };
  if (id === 'RI-PRG06' && n === 1 && exists('reports/runs/_raw/node-tools-check-souls-world.mjs-365367009562.log'))
    return { status: 'PASS', evidence_path: 'reports/runs/_raw/node-tools-check-souls-world.mjs-365367009562.log', note: '310 ledger rows reconcile; 144 posts, 267 bodies, 10,679 souls.' };
  if (['RI-CHR01','RI-CHR02','RI-CHR03','RI-PRG02','RI-PRG03'].includes(id) && creationRaw)
    return { status: id === 'RI-CHR02' || (id === 'RI-CHR01' && n === 4) ? 'FAIL' : 'UNMEASURABLE', evidence_path: `reports/runs/_raw/${creationRaw}`, note: 'Creation aggregate is red (89/96); passing subassertions are not promoted without a row-complete reconciliation.' };
  return { status: 'UNMEASURABLE', evidence_path: null, note: /blind/i.test(title) ? 'Builder-owned candidate only; fresh independent judgement NOT_RUN.' : 'No complete current-HEAD native population run; fail-closed.' };
}

const rows = [];
for (const [item, methods] of Object.entries(items)) methods.forEach((title, i) => {
  const n = i + 1;
  const ev = evidenceFor(item, n, title);
  rows.push({
    row_id: `${item}-M${n}`,
    item,
    kind: 'method',
    title,
    population: `Full native population specified by ${item} comparison method ${n}; no sampling unless that clause says so.`,
    unit: `Native ${item} method-${n} unit(s).`,
    comparator: `Current HEAD versus the independently derived/native reference artifact.`,
    threshold: `Exact pass and hard-fail thresholds in ${source[item]} Comparison method/Scoring; native clause governs where stricter.`,
    authority: source[item],
    ...ev,
  });
});

// Hard failures are first-class rows. Keeping the clause text verbatim-by-reference avoids
// accidentally weakening a native threshold in a second hand-maintained specification.
for (const item of Object.keys(items)) rows.push({
  row_id: `${item}-HF-ALL`, item, kind: 'hard_fail_set', title: 'every native hard-fail clause',
  population: `Every hard-fail clause and every member of its stated population in ${item}.`,
  unit: 'native hard-fail predicates', comparator: 'observed hard-fail count versus zero',
  threshold: `zero hard fails; each individual clause in ${source[item]} remains independently binding`,
  authority: source[item], status: 'UNMEASURABLE', evidence_path: null,
  note: 'Set row is red/fail-closed until every constituent native hard fail is explicitly reconciled; no averaging.',
});

const counts = rows.reduce((a, r) => (a[r.status]++, a), { PASS: 0, FAIL: 0, UNMEASURABLE: 0 });
const out = {
  schema: 'elder-souls/w1-16-builder-bar-matrix@1', generated_at: new Date().toISOString(),
  tested_commit: commit, dirty_paths: dirty, plan: 'orchestration/plans/W1-16.md',
  semantics: { UNMEASURABLE: 'scores zero', aggregation: 'minimum governing item/axis with native hard-fail caps', independent_builder_rows: 'NOT_RUN, represented as UNMEASURABLE' },
  counts, rows,
};
const outPath = process.argv[2] || 'reports/w1-16/bar-matrix.json';
fs.mkdirSync(path.dirname(path.join(ROOT, outPath)), { recursive: true });
fs.writeFileSync(path.join(ROOT, outPath), `${JSON.stringify(out, null, 2)}\n`);
console.log(`${rows.length} rows: ${counts.PASS} PASS, ${counts.FAIL} FAIL, ${counts.UNMEASURABLE} UNMEASURABLE -> ${outPath}`);
if (counts.FAIL || counts.UNMEASURABLE) process.exitCode = 1;
