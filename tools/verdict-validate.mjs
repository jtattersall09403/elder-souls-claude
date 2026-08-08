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
  // A verdict with no time is a verdict the progress chart cannot place. Three have shipped without
  // one, and the chart drew each at x = 0 — the far left of the whole project timeline — so a
  // verdict filed at 22:10 sat before every measurement its domain had ever taken. That turned a
  // domain reading 5 -> 6 -> 4 into an apparent 2 -> 5 -> 6: the page told the opposite story to
  // the disk, and showed no sign anything was missing. `scores.mjs` now falls back to the file's
  // git-add time, which is close, but close is not the critic's own reading — and the third
  // unstamped verdict landed nine minutes after that fallback was written, which is the proof that
  // a fallback does not stop the thing it compensates for. So require the stamp here, where a
  // verdict becomes real.
  if (v.critic && !v.critic.finished_at && !v.critic.started_at) {
    E('critic.finished_at required (ISO 8601) — a verdict with no time cannot be placed on the trajectory chart, and an unplaced point is drawn at the start of the project rather than left out');
  }
  for (const k of ['started_at', 'finished_at']) {
    const t = v.critic?.[k];
    if (t && Number.isNaN(Date.parse(t))) E(`critic.${k} is not a parseable timestamp: ${JSON.stringify(t)}`);
  }
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
        // `hard_fail: true` MARKS A GATE, IT DOES NOT REPORT ONE AS TRIGGERED.
        //
        // Filed by the W1-08/W1-29 round-1 critic. This line used to read
        //   `(r.checks||[]).some((c) => c && c.hard_fail === true)`
        // and treat any check CARRYING a hard-fail flag as a TRIGGERED hard fail, which is a
        // category error with a real cost. The schema's `hard_fail` says "this check is a hard
        // fail gate"; whether the gate fired is `result`. Under the old reading a critic could
        // not write down the state five of that verdict's gates were actually in — an EXISTING
        // gate with NO INSTRUMENT that could ever fire it — because marking the check at all
        // capped the item at 2 as though the build had failed it, and leaving the flag off
        // erased the gate from the record. The critic had to explain the distinction in prose
        // ("no hard fail is recorded as triggered; five are recorded as ungated") with nothing
        // in the machine-readable file to carry it.
        //
        // A gate is triggered when its check FAILED. A gate whose check is `unmeasurable` is
        // UNGATED: it scores 0 fail-closed through the ordinary `measured`/native-score path,
        // it is surfaced as a warning so it cannot be quietly banked, and it does not fabricate
        // a triggered hard fail the build never actually tripped.
        const gates = (r.checks || []).filter((c) => c && c.hard_fail === true);
        const triggered = gates.filter((c) => c.result === 'fail');
        const ungated = gates.filter((c) => c.result === 'unmeasurable');
        if (ungated.length) {
          W(`reference_items ${tag}: ${ungated.length} hard-fail gate(s) are UNGATED — the check exists and is marked hard_fail but reports 'unmeasurable', so no instrument could fire it: ${ungated.map((c) => c.id).join(', ')}. That is not a pass. SCORING.md: unmeasurable scores 0 fail-closed, and the gate must be named in why_not_ten or biggest_gap rather than banked as clean.`);
          // …and then CHECK that it was named, rather than only asking for it.
          //
          // Added W1-08/W1-29 round 2. The warning above has existed since round 1 and the
          // round-1 verdict it was written for did the right thing voluntarily — it carried
          // `ungated_hard_fail:RI-JRN03/HF3` and four more in `status_reasons`, and explained
          // the distinction in prose. Voluntary is the problem: an ungated gate is *invisible*
          // in the scored arithmetic (it scores 0 through the ordinary unmeasurable path, which
          // looks exactly like a check that ran and found nothing), so the only place a reader
          // can learn that five gates had no instrument is the narrative. A rule that depends
          // on the critic remembering to write it down is not a rule.
          //
          // A `status_reasons` entry is accepted, and so is the gate id appearing anywhere in
          // `why_not_ten` or `biggest_gap` — the requirement is that the state is FINDABLE, not
          // that it is spelled a particular way. Kept a warning rather than an error because
          // this file is shared with every critic in the fleet and an error here would reject
          // otherwise-valid verdicts written before the convention existed.
          const narrative = JSON.stringify([v.status_reasons || [], r.why_not_ten || null, v.biggest_gap || null]);
          const unnamed = ungated.filter((c) => narrative.indexOf(String(c.id)) < 0);
          if (unnamed.length) {
            W(`reference_items ${tag}: ${unnamed.length} UNGATED hard-fail gate(s) appear nowhere in status_reasons, why_not_ten or biggest_gap: ${unnamed.map((c) => c.id).join(', ')}. An ungated gate scores 0 through the same path as a check that ran and found nothing, so if it is not named it cannot be told from a clean result. Add a status_reasons entry — the convention is 'ungated_hard_fail:<item>/<gate>'.`);
          }
        }
        for (const c of gates) {
          if (c.result === 'fail' && !(r.hard_fails || []).includes(c.id)) {
            W(`reference_items ${tag}: check ${c.id} is marked hard_fail and its result is 'fail', but ${c.id} is not listed in hard_fails[]. A triggered gate belongs in both places.`);
          }
        }
        const hf = (r.hard_fails || []).length > 0 || triggered.length > 0;
        if (hf && r.score_0_10 > 2) {
          E(`reference_items ${tag}: a hard fail is recorded and score_0_10 is ${r.score_0_10}. SCORING.md §1.1: "any triggered hard fail caps the whole item at 2, no matter how many other checks passed."`);
        }
        if (typeof r.native_score === 'number' && r.native_score === 0 && r.score_0_10 > 4) {
          E(`reference_items ${tag}: native_score is 0 and score_0_10 is ${r.score_0_10}. SCORING.md §1.2 step 1 makes the item's own band a CEILING — a native 0 is the "loses outright" band, ceiling 4 — and §1.2b requires the item's anchor row to carry a 0 rung so this is read off the item rather than guessed.`);
        }
        // §1.2b, second half: READ the ceiling off the item instead of guessing it. The rule above
        // is a generic backstop at 4; §1.2b's actual instruction is that an item whose aggregation
        // can produce a native 0 must publish a 0 rung, and that the translation is then read from
        // that row. Where the row exists and its first rung is `Ladder 0 / Native 0`, a native 0 is
        // a ladder 0 and there is nothing left to interpret. Applied narrowly — only when
        // native_score is exactly 0 AND the item publishes an explicit 0 rung — so it cannot
        // misfire on an item whose anchor row starts at 4.
        if (typeof r.native_score === 'number' && r.native_score === 0 && r.score_0_10 > 0 && r.path) {
          try {
            const md = readFileSync(join(ROOT, r.path), 'utf8').split('\n');
            for (let i = 0; i < md.length - 1; i++) {
              const head = md[i].trim();
              if (!/^\|\s*Ladder\s*\|/i.test(head)) continue;
              const nat = (md[i + 2] || '').trim();
              if (!/^\|\s*Native\s*\|/i.test(nat)) continue;
              const cells = (s) => s.split('|').slice(1, -1).map((c) => c.trim());
              const L = cells(head).slice(1);
              const N = cells(nat).slice(1);
              if (L[0] !== '0') break;                       // no 0 rung published — backstop only
              const first = parseFloat((N[0] || '').replace(/[^0-9.].*$/, ''));
              if (first !== 0) break;                        // 0 rung is not anchored at native 0
              E(`reference_items ${tag}: native_score is 0 and score_0_10 is ${r.score_0_10}, but ${r.id}'s own anchor row reads \`Ladder 0 = Native ${N[0]}\`. SCORING.md §1.2 step 1: the item's band is a ceiling and the anchor row is where it is read from (§1.2b). A native 0 on an item publishing a 0 rung is a ladder 0.`);
              break;
            }
          } catch { /* unreadable item file is already an error above */ }
        }
      }
      // SCORING.md §1.2c / BAR-CRITIQUE-W1-07-R1 §R5.3 — the aggregation rule has an instrument.
      // Twenty-one items declare `Aggregation … min-over-axes` and describe it as "a property of
      // this item, not of the critic", and nothing has ever checked that the reported native score
      // is in fact the minimum. W1-07 round 2 recorded RI-PRG02 native 6 and RI-PRG03 native 5 while
      // each carried an axis the same verdict marked `unmeasurable` — which SCORING §1.1 fixes at 0,
      // fail-closed — so on a min rule both natives were 0. In the same verdict RI-CHR02 with the
      // same shape was correctly recorded 0. The rule was applied three different ways in one file.
      //
      // WARN, not error, and the reason is honest rather than tactical: `checks[]` are METHODS and
      // the min is taken over the item's Scoring AXES, and the two are not always one-to-one. A
      // critic who has mapped them and can show the min is legitimately above 0 says so in prose.
      // Tightens to `error` at wave 2 once items publish an axis id on each check.
      if (typeof r.native_score === 'number' && r.native_score > 0 && r.path) {
        try {
          const md = readFileSync(join(ROOT, r.path), 'utf8');
          const agg = md.match(/\*\*Aggregation[^*]*\*\*[:\s]*([^\n]*)/);
          if (agg && /min-over-axes/.test(agg[1])) {
            const zeroed = (r.checks || []).filter((c) => {
              const res = String((c && (c.result || c.status)) || '').toLowerCase();
              if (!['fail', 'unmeasurable'].includes(res)) return false;
              return !/corpus_debt/i.test(JSON.stringify(c));      // debt is excluded from the min
            });
            if (zeroed.length) {
              W(`reference_items ${tag}: ${r.id} aggregates min-over-axes and native_score is ${r.native_score}, but ${zeroed.length} check(s) are fail/unmeasurable (${zeroed.map((c) => c.id).join(', ')}). SCORING.md §1.1 fixes an unmeasurable axis at 0 fail-closed, so the min is 0 unless the axis is \`corpus_debt\` (RI-MTH06 §E.2) or the check does not map 1:1 to an axis — in which case say which, in prose.`);
            }
          }
        } catch { /* unreadable item file is already an error above */ }
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
  // `gap_closure` is specified as an array. Two verdicts shipped it as an object keyed by gap id,
  // and iterating an object threw — which took the CORPUS-WIDE `--all` gate down at the 19th of
  // 36 verdicts, so eighteen were never validated at all and nobody knew. A shared gate that dies
  // on one piece's malformed field silently stops checking everybody else's; that is the same
  // failure `tools/check-quests.mjs` exists to prevent, one level up. Accept both shapes, and
  // report the wrong one as an error against the verdict that wrote it rather than as a crash.
  const closureRows = Array.isArray(v.gap_closure)
    ? v.gap_closure
    : (v.gap_closure && typeof v.gap_closure === 'object'
      ? (E('gap_closure must be an array, not an object keyed by gap id (SCORING.md §5)'),
        Object.entries(v.gap_closure).map(([gap_id, c]) => ({ gap_id, ...(c || {}) })))
      : []);
  for (const c of closureRows) {
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
  const name = rel(p);
  // One malformed verdict must not stop the sweep. It did: an unhandled throw on the 19th of 36
  // left eighteen unvalidated and reported nothing, so the corpus-wide gate had been half-running
  // for as long as that field had been wrong. A crash on one file is a finding ABOUT that file.
  let errors, warns;
  try { ({ errors, warns } = validate(p)); }
  catch (e) { errors = [`validator threw on this file — ${e.message}`]; warns = []; }
  if (errors.length === 0) console.log(`OK    ${name}${warns.length ? `  (${warns.length} warning(s))` : ''}`);
  else { failed++; console.log(`FAIL  ${name}  — ${errors.length} error(s)`); }
  for (const e of errors) console.log(`   ERROR  ${e}`);
  for (const w of warns) console.log(`   warn   ${w}`);
}
process.exit(failed ? 1 : 0);
