#!/usr/bin/env node
/**
 * verdict-validate.mjs — validate a critic verdict before it counts.
 *
 * Checks the structure required by corpus/00-doctrine/verdict.schema.json AND the
 * cross-file invariants a schema cannot express: that cited artifacts exist on disk,
 * that subsystem paths are canonical, that the PASS/FAIL/VOID decision procedure in
 * VERDICT-SCHEMA.md §3 was applied honestly.
 *
 * Usage
 *   node tools/verdict-validate.mjs corpus/90-verdicts/w2/combat-dodge-core.json
 *   node tools/verdict-validate.mjs --all        validate every verdict in the corpus
 *
 * Exit 0 = valid. Exit 1 = errors. Warnings never fail the run but are printed.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const rel = (p) => relative(ROOT, p).split(sep).join('/');

const taxonomy = JSON.parse(readFileSync(join(ROOT, 'corpus/00-doctrine/subsystems.json'), 'utf8'));
const canonical = new Set(taxonomy.subsystems.map((s) => s.path));
const aliases = taxonomy.aliases || {};

const ENUM = {
  status: ['PASS', 'FAIL', 'VOID', 'PROVISIONAL', 'RECUSED'],
  side: ['souls', 'morrowind', 'modern-fidelity', 'neutral'],
  kind: ['number', 'structure', 'trace', 'image', 'text', 'graph'],
  measured: ['full', 'partial', 'unmeasurable'],
  axis: ['fidelity', 'art-direction', 'both-separately', 'not-visual'],
  ar: ['pass', 'fail', 'not_applicable'],
  artifactKind: ['screenshot', 'trace', 'report', 'text-excerpt', 'graph', 'video', 'log', 'perf', 'blind-pack', 'negative-evidence'],
  severity: ['blocking', 'major', 'minor'],
  aggregation: ['min', 'mean', 'weighted-mean'],
  closure: ['closed', 'open', 'partially-closed', 'superseded', 'invalid'],
  sourcePurpose: ['locate-harness', 'quote-written-content', 'diagnose-after-demonstrating'],
};

const SELF_AUDIT_KEYS = [
  'judged_output_not_source', 'ran_every_assigned_method', 'blind_done_where_required',
  'named_exactly_one_gap', 'remedy_is_buildable', 'no_banned_reasoning_used',
  'escalation_ladder_used_if_gap_seemed_small',
];

function validate(file) {
  const errors = [];
  const warns = [];
  const E = (m) => errors.push(m);
  const W = (m) => warns.push(m);

  let v;
  try { v = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { return { errors: [`unparseable JSON: ${e.message}`], warns: [] }; }

  // --- identity
  if (v.schema_version !== 1) E('schema_version must be 1');
  for (const k of ['piece_id', 'wave', 'critic', 'bifurcation', 'reference_items', 'artifacts', 'arbitration', 'score', 'status', 'biggest_gap', 'self_audit']) {
    if (v[k] === undefined) E(`missing required field \`${k}\``);
  }
  if (!Array.isArray(v.subsystem_paths) || v.subsystem_paths.length === 0) E('subsystem_paths must be a non-empty array');
  for (const p of v.subsystem_paths || []) {
    if (!canonical.has(p)) {
      if (aliases[p]) W(`subsystem_paths: "${p}" is a legacy alias of "${aliases[p]}" — use the canonical path`);
      else E(`subsystem_paths: "${p}" is not a canonical subsystem path (corpus/00-doctrine/subsystems.json)`);
    }
  }
  if (v.critic && !v.critic.run_id) E('critic.run_id required');
  if (v.critic && typeof v.critic.conflict_of_interest !== 'boolean') E('critic.conflict_of_interest must be boolean');
  if (v.critic && v.critic.conflict_of_interest === true && v.status !== 'RECUSED') {
    E('critic.conflict_of_interest is true so status MUST be RECUSED (CRITIC-DOCTRINE §8)');
  }
  if (!v.build || !v.build.commit_sha) W('build.commit_sha missing — the verdict is not reproducible');

  // --- bifurcation
  if (v.bifurcation) {
    if (!ENUM.axis.includes(v.bifurcation.axis)) E(`bifurcation.axis must be one of ${ENUM.axis.join('|')}`);
    if (v.bifurcation.declared_before_citation !== true) E('bifurcation.declared_before_citation must be true — declare the axis BEFORE citing any visual reference (ARBITRATION §4)');
    if (v.bifurcation.axis === 'fidelity' && (v.bifurcation.art_refs || []).length) E('bifurcation: axis is "fidelity" but art-direction references are cited — VOID (ARBITRATION §4)');
    if (v.bifurcation.axis === 'art-direction' && (v.bifurcation.fidelity_refs || []).length) E('bifurcation: axis is "art-direction" but modern-fidelity references are cited — VOID (ARBITRATION §4)');
    if (v.bifurcation.axis === 'both-separately') {
      const overlap = (v.bifurcation.fidelity_refs || []).filter((r) => (v.bifurcation.art_refs || []).includes(r));
      if (overlap.length) E(`bifurcation: axis "both-separately" requires disjoint reference sets; shared: ${overlap.join(', ')}`);
    }
  }

  // --- artifacts
  const artifactPaths = new Set();
  if (!Array.isArray(v.artifacts) || v.artifacts.length === 0) {
    E('artifacts is empty — a verdict with no artifacts is VOID (CRITIC-DOCTRINE §1.2)');
  } else {
    for (const a of v.artifacts) {
      if (!a.path) { E('artifact missing path'); continue; }
      artifactPaths.add(a.path);
      if (!ENUM.artifactKind.includes(a.kind)) E(`artifact ${a.path}: kind "${a.kind}" invalid`);
      if (!a.produced_by) E(`artifact ${a.path}: produced_by (the exact command) required — an artifact you cannot reproduce is an anecdote`);
      if (!existsSync(join(ROOT, a.path))) E(`artifact ${a.path}: FILE DOES NOT EXIST — verdict is VOID`);
      if (a.kind === 'screenshot' && !a.camera_pose) E(`artifact ${a.path}: screenshots require camera_pose`);
      if (a.kind === 'screenshot' && !a.resolution) E(`artifact ${a.path}: screenshots require resolution`);
    }
  }
  const citedButUndeclared = new Set();
  const checkEvidence = (list, where) => {
    for (const p of list || []) {
      if (!artifactPaths.has(p)) citedButUndeclared.add(`${where} cites "${p}" which is not declared in artifacts[]`);
    }
  };

  // --- reference items
  if (!Array.isArray(v.reference_items) || v.reference_items.length === 0) {
    E('reference_items is empty — a verdict must measure at least one reference item');
  } else {
    for (const r of v.reference_items) {
      const tag = r.id || '(no id)';
      if (!/^RI-[A-Z]+\d+$/.test(r.id || '')) E(`reference_items ${tag}: id must look like RI-CMB03`);
      if (!r.path || !existsSync(join(ROOT, r.path))) E(`reference_items ${tag}: path "${r.path}" does not exist`);
      if (!ENUM.side.includes(r.side)) E(`reference_items ${tag}: side "${r.side}" invalid`);
      if (!ENUM.kind.includes(r.kind)) E(`reference_items ${tag}: kind "${r.kind}" invalid`);
      if (!ENUM.measured.includes(r.measured)) E(`reference_items ${tag}: measured "${r.measured}" invalid`);
      if (!r.native_scale) E(`reference_items ${tag}: native_scale required — record the item's OWN scale, not just the 0-10 translation`);
      if (typeof r.score_0_10 !== 'number' || r.score_0_10 < 0 || r.score_0_10 > 10) E(`reference_items ${tag}: score_0_10 must be 0-10`);
      if (r.measured === 'unmeasurable' && r.score_0_10 !== 0) E(`reference_items ${tag}: measured=unmeasurable requires score_0_10=0 (fail-closed, never "unknown")`);
      if (r.score_0_10 >= 7 && !r.justification) E(`reference_items ${tag}: score ${r.score_0_10} >= 7 requires a justification naming the artifact that proves it (SCORING.md §1.1)`);
      if (r.score_0_10 >= 9) W(`reference_items ${tag}: score ${r.score_0_10} claims we BEAT the reference — expected rare-to-never; artifacts must show the reference losing`);
      // SCORING.md §1.1 / §1.2b — the hard-fail cap and the native-0 ceiling.
      // Added wave 1 by BAR-CRITIQUE-W1-07-R1 §R5. Both rules were binding, both had their data
      // in this file already, and neither was checked: W1-07 round 2 carried two triggered hard
      // fails on RI-CHR01 in hard_fails[] and scored it 4, and recorded native_score 0 on three
      // items and scored all three 4.
      {
        const hf = (r.hard_fails || []).length > 0 || (r.checks || []).some((c) => c && c.hard_fail === true);
        if (hf && r.score_0_10 > 2) {
          E(`reference_items ${tag}: a hard fail is recorded and score_0_10 is ${r.score_0_10}. SCORING.md §1.1: "any triggered hard fail caps the whole item at 2, no matter how many other checks passed."`);
        }
        if (typeof r.native_score === 'number' && r.native_score === 0 && r.score_0_10 > 4) {
          E(`reference_items ${tag}: native_score is 0 and score_0_10 is ${r.score_0_10}. SCORING.md §1.2 step 1 makes the item's own band a CEILING — a native 0 is the "loses outright" band, ceiling 4 — and §1.2b requires the item's anchor row to carry a 0 rung so this is read off the item rather than guessed.`);
        }
      }
      if (!Array.isArray(r.evidence) || r.evidence.length === 0) E(`reference_items ${tag}: evidence[] required`);
      checkEvidence(r.evidence, `reference_items ${tag}`);
      for (const c of r.checks || []) checkEvidence(c.evidence, `reference_items ${tag} check ${c.id}`);
    }
  }

  // --- blind
  for (const b of v.blind_comparisons || []) {
    if (b.status === 'done') {
      if (!b.question) E(`blind ${b.ref_item}: question required, written BEFORE looking`);
      if (!['A', 'B', 'tie', 'none'].includes(b.blind_pick)) E(`blind ${b.ref_item}: blind_pick must be A|B|tie|none`);
      if (!b.blind_rationale) E(`blind ${b.ref_item}: blind_rationale required and must cite observed features`);
      if (!b.reveal) E(`blind ${b.ref_item}: reveal required`);
      if (b.reveal && b.blind_pick && ['A', 'B'].includes(b.blind_pick)) {
        const derived = b.reveal[b.blind_pick];
        if (derived && b.picked && derived !== b.picked) E(`blind ${b.ref_item}: picked="${b.picked}" contradicts reveal (${b.blind_pick} was ${derived})`);
      }
      if (b.picked === 'ours' && b.rerun_triggered !== true) {
        E(`blind ${b.ref_item}: the blind pick landed on OURS and no re-run was triggered. That is a signal to distrust the critic, not a win (CORPUS-CONTRACT §6, CRITIC-DOCTRINE §2.5).`);
      }
      if (b.picked === 'ours' && b.rerun && b.rerun.result === 'ours-still-wins' && !b.rerun.item_capped_at_8) {
        E(`blind ${b.ref_item}: ours still won the harsher pass, so the item must be capped at 8 and a sharper-discriminator extension filed (CRITIC-DOCTRINE §2.5).`);
      }
      checkEvidence(b.pack_artifacts, `blind ${b.ref_item}`);
    } else if (b.status === 'not_possible') {
      if (!b.not_possible_reason) E(`blind ${b.ref_item}: not_possible requires a reason`);
    } else E(`blind ${b.ref_item}: status must be done|not_possible`);
  }

  // --- arbitration
  for (const key of ['ar1', 'ar2']) {
    const a = v.arbitration && v.arbitration[key];
    if (!a) { E(`arbitration.${key} is mandatory on EVERY piece (ARBITRATION §3)`); continue; }
    if (!ENUM.ar.includes(a.status)) E(`arbitration.${key}.status must be pass|fail|not_applicable`);
    if (a.status === 'not_applicable' && !a.not_applicable_reason) E(`arbitration.${key}: not_applicable requires a written reason (it is audited, not a free pass)`);
    if (!Array.isArray(a.checks)) E(`arbitration.${key}.checks must be an array of per-probe results`);
    for (const c of a.checks || []) checkEvidence(c.evidence, `arbitration.${key} ${c.id}`);
    checkEvidence(a.evidence, `arbitration.${key}`);
  }

  // --- score & status
  if (v.score) {
    if (typeof v.score.overall_0_10 !== 'number') E('score.overall_0_10 must be a number');
    if (typeof v.score.pass_threshold !== 'number') E('score.pass_threshold must be a number and must be written down');
    if (!ENUM.aggregation.includes(v.score.aggregation)) E(`score.aggregation must be ${ENUM.aggregation.join('|')}`);
  }
  if (!ENUM.status.includes(v.status)) E(`status must be one of ${ENUM.status.join('|')}`);

  const anyHardFail = (v.reference_items || []).some((r) => (r.hard_fails || []).length > 0);
  const arFail = ['ar1', 'ar2'].some((k) => v.arbitration && v.arbitration[k] && v.arbitration[k].status === 'fail');
  if (v.status === 'PASS') {
    if (arFail) E('status PASS but an arbitration check FAILED — AR-1/AR-2 failure fails the piece regardless of score');
    if (anyHardFail) E('status PASS but a reference item recorded a hard fail — hard fails are never averaged away');
    if (v.score && v.score.overall_0_10 < v.score.pass_threshold) E('status PASS but overall score is below pass_threshold');
  }
  if ((arFail || anyHardFail) && !['FAIL', 'VOID', 'RECUSED'].includes(v.status)) {
    E('an arbitration failure or hard fail is present; status must be FAIL');
  }

  // --- the gap
  const g = v.biggest_gap;
  if (!g) {
    E('biggest_gap missing — "a critic that reports no gap found has failed its own job and its verdict is void" (ARBITRATION §3)');
  } else {
    if (!/^GAP-W\d+-[a-z0-9-]+$/.test(g.gap_id || '')) E(`biggest_gap.gap_id "${g.gap_id}" must match GAP-W<wave>-<slug>`);
    if (g.subsystem_path && !canonical.has(g.subsystem_path) && !aliases[g.subsystem_path]) E(`biggest_gap.subsystem_path "${g.subsystem_path}" is not canonical`);
    for (const k of ['what', 'why_it_matters']) if (!g[k]) E(`biggest_gap.${k} required`);
    if (!Array.isArray(g.evidence) || g.evidence.length === 0) E('biggest_gap.evidence[] required');
    checkEvidence(g.evidence, 'biggest_gap');
    if (g.severity && !ENUM.severity.includes(g.severity)) E(`biggest_gap.severity must be ${ENUM.severity.join('|')}`);
    if (!g.remedy || !g.remedy.action || !g.remedy.acceptance) {
      E('biggest_gap.remedy requires both action and acceptance — a remedy that is not buildable and re-measurable is not a remedy');
    } else {
      if (!/\d|<=|>=|<|>|zero|none|every|all |per /i.test(String(g.remedy.acceptance))) {
        E('biggest_gap.remedy.acceptance contains no number or observable condition — a later critic could not re-measure it');
      }
      if (/^(improve|make it better|polish|enhance|fix)\b/i.test(String(g.remedy.action).trim())) {
        W('biggest_gap.remedy.action opens with a vague verb — check it names what to change, where, and to what value (CRITIC-DOCTRINE §2.2)');
      }
      if (!Array.isArray(g.remedy.targets) || g.remedy.targets.length === 0) W('biggest_gap.remedy.targets[] empty — name the files or subsystems to change');
    }
  }

  // --- source reads
  for (const s of v.source_reads || []) {
    if (!ENUM.sourcePurpose.includes(s.purpose)) E(`source_reads ${s.path}: purpose "${s.purpose}" is not one of the three permitted purposes (CRITIC-DOCTRINE §1.1) — VOID`);
  }

  // --- closure
  for (const c of v.gap_closure || []) {
    if (!ENUM.closure.includes(c.status)) E(`gap_closure ${c.gap_id}: status invalid`);
    if (c.closed_by_builder_of_fix === true) E(`gap_closure ${c.gap_id}: closed_by_builder_of_fix=true — a gap cannot be closed by the agent that built the fix (SCORING.md §5)`);
    if (!Array.isArray(c.evidence) || c.evidence.length === 0) E(`gap_closure ${c.gap_id}: evidence[] required — closure is a re-measurement, not an assertion`);
    checkEvidence(c.evidence, `gap_closure ${c.gap_id}`);
  }

  // --- self audit
  if (v.self_audit) {
    for (const k of SELF_AUDIT_KEYS) if (typeof v.self_audit[k] !== 'boolean') E(`self_audit.${k} must be present and boolean`);
    const anyFalse = SELF_AUDIT_KEYS.some((k) => v.self_audit[k] === false);
    if (anyFalse && !v.self_audit.self_audit_note) E('self_audit has a false entry and no self_audit_note — a note is required and the verdict is provisional');
    if (anyFalse && v.status === 'PASS') W('self_audit has a false entry but status is PASS — the orchestrator should treat this as PROVISIONAL');
  }
  if (v.critic && v.critic.saw_builder_notes_before_blind === true && v.status === 'PASS') {
    W('critic saw builder notes before the blind stage; status should be PROVISIONAL (CRITIC-DOCTRINE §8)');
  }
  if (Array.isArray(v.corpus_extended) && v.corpus_extended.length === 0) {
    W('corpus_extended is empty — legal, but a critic that never hit the edge of the corpus should ask whether it looked hard enough');
  }

  for (const m of citedButUndeclared) E(m);
  return { errors, warns };
}

// ------------------------------------------------------------------ cli
let targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (process.argv.includes('--all')) {
  targets = [];
  const vd = join(ROOT, 'corpus', '90-verdicts');
  if (existsSync(vd)) {
    for (const w of readdirSync(vd)) {
      const wd = join(vd, w);
      if (!statSync(wd).isDirectory()) continue;
      for (const f of readdirSync(wd)) if (f.endsWith('.json') && f !== 'COHERENCE.json') targets.push(join(wd, f));
    }
  }
  if (targets.length === 0) console.log('No verdicts found under corpus/90-verdicts/<wave>/.');
}
if (targets.length === 0 && !process.argv.includes('--all')) {
  console.error('usage: node tools/verdict-validate.mjs <verdict.json> [...]  |  --all');
  process.exit(2);
}

let failed = 0;
for (const t of targets) {
  const p = t.startsWith('/') ? t : join(ROOT, t);
  const { errors, warns } = validate(p);
  const name = rel(p);
  if (errors.length === 0) console.log(`OK    ${name}${warns.length ? `  (${warns.length} warning(s))` : ''}`);
  else { failed++; console.log(`FAIL  ${name}  — ${errors.length} error(s)`); }
  for (const e of errors) console.log(`   ERROR  ${e}`);
  for (const w of warns) console.log(`   warn   ${w}`);
}
process.exit(failed ? 1 : 0);
