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
 *   node tools/verdict-validate.mjs --all        validate every round-current verdict in the corpus
 *   node tools/verdict-validate.mjs --all --all-rounds     …including superseded draft rounds
 *   node tools/verdict-validate.mjs --all --verbose        …print the errors of skipped rounds too
 *   node tools/verdict-validate.mjs --self-test  the gap rule and the round-identity edge cases
 *
 * Exit 0 = valid. Exit 1 = errors. Warnings never fail the run but are printed.
 */

import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative, sep, basename } from 'node:path';
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

// ---------------------------------------------------------------- cited-evidence resolution
//
// A CITATION MUST RESOLVE IN A FRESH CLONE, OR IT IS NOT A CITATION.
//
// For eight days this check was right and unsatisfiable at the same time: it demanded every cited
// path exist, while `reports/.gitignore` deliberately excluded the directory those paths live in.
// 56 of 76 Wave-1 verdicts failed a real fresh checkout and passed on the one machine that had
// made their evidence — precisely the "nothing counts because someone says so" failure the method
// exists to prevent (reports/ci-triage/TRIAGE-20260814.md §2 class A).
//
// The reconciliation is `tools/verdict-evidence.mjs`, and this is its other half. Evidence at or
// under 1 MiB is committed outright. Above that, a PIN is committed in its place —
// `<path>.pin.json`, carrying the decisive numbers, a SHA-256 of the raw bytes and the command
// that regenerates them. So a citation resolves if EITHER the file is there or its pin is.
//
// THIS IS A TIGHTENING, NOT A LOOSENING, and the distinction is the whole point. A committed
// 79 MiB trace can be silently regenerated and nothing notices. A pin cannot: the hash makes
// drift a red `verdict-evidence.mjs --verify`. The pin is also checked here for shape, so a stub
// `{}` next to a missing file buys nothing.
const PIN_SUFFIX = '.pin.json';
const PIN_REQUIRED = ['pin_version', 'path', 'bytes', 'sha256', 'produced_by', 'decisive', 'cited_by'];

export function resolveCitedPath(root, p) {
  if (existsSync(join(root, p))) return { ok: true, via: 'file' };
  // `corpus/00-doctrine/ARBITRATION.md#3` is a citation of §3 OF a tracked file, not a path to a
  // file called "ARBITRATION.md#3". W1-19-r2 wrote one and went red for it. Stripping the anchor
  // in the verdict would have thrown the section pointer away to satisfy the checker; resolving
  // against the base path keeps the pointer and still requires the document to exist.
  if (p.includes('#')) {
    const base = p.replace(/#.*$/, '');
    if (base && existsSync(join(root, base))) return { ok: true, via: 'section-anchor' };
  }
  const pin = join(root, p + PIN_SUFFIX);
  if (!existsSync(pin)) return { ok: false, via: null };
  let o;
  try { o = JSON.parse(readFileSync(pin, 'utf8')); }
  catch (e) { return { ok: false, via: 'pin', why: `its pin ${p}${PIN_SUFFIX} is unparseable (${e.message})` }; }
  const missing = PIN_REQUIRED.filter((k) => o[k] === undefined || o[k] === null || o[k] === '');
  if (missing.length) return { ok: false, via: 'pin', why: `its pin ${p}${PIN_SUFFIX} is missing ${missing.join(', ')} — a pin without the decisive numbers, the hash and the regeneration command is not a citation` };
  if (o.pin_version !== 1) return { ok: false, via: 'pin', why: `its pin ${p}${PIN_SUFFIX} declares pin_version ${o.pin_version}` };
  if (!/^[0-9a-f]{64}$/.test(String(o.sha256))) return { ok: false, via: 'pin', why: `its pin ${p}${PIN_SUFFIX} carries no valid SHA-256` };
  return { ok: true, via: 'pin' };
}

// ---------------------------------------------------------------- round identity
//
// ONLY THE LATEST ROUND OF A PIECE GATES CI. The other rounds are history: ten Wave-1 verdicts are
// obsolete drafts already replaced by a later round for the same piece, and holding CI red for a
// superseded draft trains everyone to ignore red, which is worse than having no gate at all.
//
// The naming is the whole risk, and it is why the triage designed this rule and refused to ship it
// unverified. `W1-01-province-stream-r1` is a DIFFERENT SUB-PIECE of W1-01, not a round of it; a
// prefix match would have silently un-gated it. So identity is "the filename with a trailing
// `-r<N>` removed" — an exact string, never a prefix — and rounds compare numerically so r10 beats
// r9. A verdict with no `-r<N>` suffix is round 1 of its own identity.
//
// Gate-relevance deliberately does NOT depend on whether the later round passes. Making the scope
// of the gate depend on the gate's own output is circular and unstable — fixing round 3 would
// silently un-gate round 2 — so the rule is the simplest deterministic one: highest round wins,
// pass or fail. If the latest round is broken, CI is red for that piece, which is correct.
export function pieceIdentity(file) {
  const name = basename(String(file)).replace(/\.json$/i, '');
  const m = name.match(/^(.*)-r(\d+)$/i);
  if (!m) return { identity: name, round: 1, explicit: false };
  return { identity: m[1], round: Number(m[2]), explicit: true };
}

/** Given a list of verdict paths, return a Map path -> {gates, supersededBy}. */
export function roundRelevance(files) {
  const best = new Map();          // `${dir}\0${identity}` -> {round, file}
  const keyOf = (f) => `${dirname(String(f))}\0${pieceIdentity(f).identity}`;
  for (const f of files) {
    const { round } = pieceIdentity(f);
    const k = keyOf(f);
    const cur = best.get(k);
    // ties (two files claiming the same round of the same identity) are impossible for distinct
    // filenames, but resolve deterministically by name so the outcome never depends on readdir order
    if (!cur || round > cur.round || (round === cur.round && String(f) > String(cur.file))) best.set(k, { round, file: f });
  }
  const out = new Map();
  for (const f of files) {
    const winner = best.get(keyOf(f));
    out.set(f, winner.file === f ? { gates: true, supersededBy: null } : { gates: false, supersededBy: winner.file });
  }
  return out;
}

// ---------------------------------------------------------------- document types
//
// TWO INCOMPATIBLE DOCUMENTS WERE ANSWERING TO ONE SCHEMA NAME, and no amount of backfilling
// fixes that. `corpus/90-verdicts/` holds critic verdicts — a critic measured a built piece
// against reference items — and it also holds BLIND-PACK JUDGEMENTS, where a judge answers a
// masked pack's question without seeing the piece. A judgement structurally CANNOT carry
// `artifacts[]` (its evidence is the pack), `arbitration.ar1/ar2` (there is no build to
// arbitrate) or scored `reference_items[]` (the whole discipline is that it has not read them).
// Three such documents — W1-PROSE-BLIND-r1, W1-PROSE-TICS-r4, W1-22-B2-blind — were held to a
// critic verdict's contract and were red for having done their job correctly. A fourth,
// W1-TOUCH-r1, declares `"schema": "elder-souls/verdict@1"` while using a completely different
// field layout, so the name itself had become ambiguous.
//
// THE SPLIT IS ADDITIVE. A document with no `document_type` and no `judge.` role validates on
// exactly the code path it did before, so the ~90 conformant verdicts are untouched and the
// score series stays comparable (`tools/scores.mjs` reads `score.overall_0_10` and is not
// changed by any of this). The default is the STRICTEST type: an undeclared document is held to
// the critic verdict's contract, so forgetting the field can never buy leniency.
export const DOC_TYPES = {
  'critic-verdict': 'elder-souls/critic-verdict@1',
  'blind-judgement': 'elder-souls/blind-judgement@1',
};
// `elder-souls/verdict@1` is RETIRED, not renamed. Four documents in this corpus declare or
// imply it (W1-TOUCH-r1, W1-MAP-r1, W1-DEPLOY-r1, W1-FACTIONS-r1) and NO TWO OF THEM SHARE A
// FIELD LAYOUT. One name per instance is the absence of a type, not the presence of one, so the
// identifier is refused rather than adopted for either side of the split.
const RETIRED_SCHEMA_IDS = new Set(['elder-souls/verdict@1']);
const SCHEMA_ID_TO_TYPE = new Map(Object.entries(DOC_TYPES).map(([k, id]) => [id, k]));

/**
 * Which contract does this document answer to? Fail-closed: anything undeclared is a critic
 * verdict, which is the stricter of the two.
 */
export function documentType(v) {
  const notes = [];
  if (v && v.document_type !== undefined) {
    if (Object.prototype.hasOwnProperty.call(DOC_TYPES, v.document_type)) return { type: v.document_type, via: 'document_type', notes };
    notes.push({ level: 'error', m: `document_type "${v.document_type}" is not a known document type — one of ${Object.keys(DOC_TYPES).join(', ')} (corpus/00-doctrine/verdict.schema.json, corpus/00-doctrine/blind-judgement.schema.json). Validated as a critic verdict.` });
    return { type: 'critic-verdict', via: 'document_type-unknown', notes };
  }
  if (v && typeof v.schema === 'string') {
    if (SCHEMA_ID_TO_TYPE.has(v.schema)) return { type: SCHEMA_ID_TO_TYPE.get(v.schema), via: 'schema', notes };
    if (RETIRED_SCHEMA_IDS.has(v.schema)) {
      notes.push({ level: 'error', m: `declares \`"schema": "${v.schema}"\` but does not implement it. That identifier is RETIRED: four documents in this corpus claim it and no two share a field layout, so it names no contract. State \`"document_type": "critic-verdict"\` or \`"blind-judgement"\` instead. Validated as a critic verdict.` });
      return { type: 'critic-verdict', via: 'schema-retired', notes };
    }
    notes.push({ level: 'error', m: `declares \`"schema": "${v.schema}"\`, which is not a registered document type. Validated as a critic verdict.` });
    return { type: 'critic-verdict', via: 'schema-unknown', notes };
  }
  // The type was in the file the whole time and nothing read it: a blind judge declares
  // `critic.role: "judge.blind.<domain>"`, a build critic declares `critic.role: "critic.<...>"`.
  if (v && v.critic && typeof v.critic.role === 'string' && /^judge\./.test(v.critic.role)) {
    notes.push({ level: 'warn', m: `inferred document_type "blind-judgement" from critic.role "${v.critic.role}". Declare \`"document_type": "blind-judgement"\` explicitly — inference is a migration aid, not the contract.` });
    return { type: 'blind-judgement', via: 'critic.role', notes };
  }
  return { type: 'critic-verdict', via: 'default', notes };
}

/**
 * A subsystem path is canonical, a registered legacy alias, a strict DESCENDANT of a canonical
 * path, or unknown. The descendant case is new and it is a refinement rather than a coverage
 * claim: `audio.ambience.region.separation` names a facet of the registered
 * `audio.ambience.region` and rolls up to it, so INDEX.md counts the ancestor and the leaf is a
 * warning. A path with NO canonical ancestor is still an error — registering a new subsystem is
 * a taxonomy decision (RI-MTH05 §C: a false mapping is worse than a hole), not a validator's.
 */
export function subsystemPathIssue(p) {
  if (canonical.has(p)) return null;
  if (aliases[p]) return { level: 'warn', m: `"${p}" is a legacy alias of "${aliases[p]}" — use the canonical path` };
  let best = null;
  for (const c of canonical) if (p.startsWith(c + '.') && (!best || c.length > best.length)) best = c;
  if (best) return { level: 'warn', m: `"${p}" is not registered, but it is a strict refinement of the canonical "${best}" and rolls up to it. Either use the ancestor or register the leaf in corpus/00-doctrine/subsystems.json.` };
  return { level: 'error', m: `"${p}" is not a canonical subsystem path and has no canonical ancestor (corpus/00-doctrine/subsystems.json)` };
}

function checkSubsystemPaths(v, E, W) {
  if (!Array.isArray(v.subsystem_paths) || v.subsystem_paths.length === 0) { E('subsystem_paths must be a non-empty array'); return; }
  for (const p of v.subsystem_paths) {
    const issue = subsystemPathIssue(p);
    if (issue) (issue.level === 'error' ? E : W)(`subsystem_paths: ${issue.m}`);
  }
}

// ---------------------------------------------------------------- an honest non-reading
//
// "NOT READ - quarantined" was written into a `path` slot by W1-22-B2-blind's judge, for
// RI-AUD03 — the very item its pack served, deliberately unread, which is the entire point of a
// blind judgement. The schema had no way to say that, so an honest answer came out as a broken
// citation. THE SCHEMA WAS WHAT WAS WRONG. An instrument that cannot represent an honest answer
// will get lied to.
//
// The structured form is `not_read: { reason, why }`. It is permitted ONLY on a blind judgement:
// a critic verdict that did not measure an item already has a way to say so — `measured:
// "unmeasurable"` with `score_0_10: 0`, fail-closed — and letting a critic declare an item
// unread would be a route around scoring it. And a not-read item may carry no score, because you
// cannot score what you did not read.
const NOT_READ_REASONS = ['quarantined', 'sealed', 'unavailable', 'out-of-scope'];
const LEGACY_NOT_READ = /^\s*(NOT[ _-]?READ|UNREAD|NOT[ _-]?OPENED)\b/i;

function requireGapForOutcome(v, g, E) {
  if (!g && v.status !== 'PASS') E('biggest_gap missing — an unsatisfied verdict must name one actionable biggest gap (ARBITRATION §3)');
}

export function validateDocument(v, E, W) {
  const { type, notes } = documentType(v);
  for (const n of notes) (n.level === 'error' ? E : W)(n.m);
  if (type === 'blind-judgement') validateBlindJudgement(v, E, W);
  else validateCriticVerdict(v, E, W);
  return type;
}

function validate(file) {
  const errors = [];
  const warns = [];
  const E = (m) => errors.push(m);
  const W = (m) => warns.push(m);

  let v;
  try { v = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { return { errors: [`unparseable JSON: ${e.message}`], warns: [] }; }

  const type = validateDocument(v, E, W);
  return { errors, warns, type };
}

function validateCriticVerdict(v, E, W) {
  // --- identity
  if (v.schema_version !== 1) E('schema_version must be 1');
  for (const k of ['piece_id', 'wave', 'critic', 'bifurcation', 'reference_items', 'artifacts', 'arbitration', 'score', 'status', 'self_audit']) {
    if (v[k] === undefined) E(`missing required field \`${k}\``);
  }
  if (v.document_type !== undefined && v.document_type !== 'critic-verdict') E(`document_type "${v.document_type}" but validated as a critic verdict`);
  checkSubsystemPaths(v, E, W);
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
      {
        const r = resolveCitedPath(ROOT, a.path);
        if (!r.ok) {
          E(r.why
            ? `artifact ${a.path}: FILE DOES NOT EXIST and ${r.why} — verdict is VOID`
            : `artifact ${a.path}: FILE DOES NOT EXIST and no ${a.path}${PIN_SUFFIX} stands in for it — verdict is VOID. Commit the evidence (\`node tools/verdict-evidence.mjs --recover\`) or, if it is over the pin threshold, commit its pin.`);
        }
      }
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
      // `not_read` belongs to a blind judgement, which is DEFINED by not having read the item.
      // A build critic that did not measure an item already has a way to say so, and it is
      // fail-closed: `measured: "unmeasurable"` with `score_0_10: 0`. Letting a critic declare an
      // item unread would be a route around scoring it.
      if (r.not_read || (typeof r.path === 'string' && LEGACY_NOT_READ.test(r.path))) {
        E(`reference_items ${tag}: a critic verdict may not declare an item unread. \`not_read\` is a blind judgement's field — a judge is quarantined from the item its pack serves. A critic that could not measure this item records \`measured: "unmeasurable"\` with \`score_0_10: 0\` (fail-closed), not a non-reading.`);
      }
      if (!r.path || !resolveCitedPath(ROOT, r.path).ok) E(`reference_items ${tag}: path "${r.path}" does not exist`);
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
  // `blind_comparisons` is specified as an array. W1-FACTIONS-r2 shipped it as a single
  // {required, done, reason} object recording "blind was not possible, here is why" — a
  // reasonable thing to want to say, but `for...of` on a non-array truthy object throws
  // "object is not iterable" and the crash was reported as an opaque validator failure
  // instead of a legible error naming the file and the wrong shape (mirrors the same fix
  // already applied to gap_closure below).
  const blindRows = Array.isArray(v.blind_comparisons)
    ? v.blind_comparisons
    : (v.blind_comparisons && typeof v.blind_comparisons === 'object'
      ? (E('blind_comparisons must be an array, not a single {required,done,reason} object (VERDICT-SCHEMA.md)'), [])
      : []);
  for (const b of blindRows) {
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
  requireGapForOutcome(v, g, E);
  if (!g) {
  } else {
    if (!/^GAP-W\d+-[a-z0-9-]+$/.test(g.gap_id || '')) E(`biggest_gap.gap_id "${g.gap_id}" must match GAP-W<wave>-<slug>`);
    if (g.subsystem_path) {
      const issue = subsystemPathIssue(g.subsystem_path);
      if (issue && issue.level === 'error') E(`biggest_gap.subsystem_path ${issue.m}`);
      else if (issue) W(`biggest_gap.subsystem_path ${issue.m}`);
    }
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
}

// ---------------------------------------------------------------- blind judgement
//
// A blind judgement is scored against RI-MTH03, not against a build. Its obligations are the
// protocol's: which pack, answers sealed before the reveal, the reveal outcome, a leak audit
// (M6), an attestation that the judge did not peek, and a ruling on whether the blind result is
// ADMISSIBLE. Those six are the discipline; without any one of them the document is worthless,
// which is what makes this type a real contract rather than a hole to escape through.
//
// EACH OBLIGATION IS CHECKED BY ROLE, NOT BY SPELLING, against a closed table of the field names
// this corpus actually uses. Three judgements exist and no two spell the same obligation the
// same way (`pack` / `blind_comparisons[].pack_ids`; `answers_sealed_before_reveal` /
// `blind_discipline` / `blind_comparisons[].answers_written_before_reveal`). The table is
// finite and auditable — a future judge cannot invent a fourth spelling — and every non-canonical
// hit warns, naming the canonical key. That is a schema migration, not leniency: the obligation
// is enforced and the self-test proves a judgement missing its seal record is REJECTED.
const JUDGEMENT_OBLIGATIONS = [
  {
    key: 'pack',
    what: 'the pack under judgement must be identified (directory or pack id, seed, trial count)',
    at: [
      ['pack', (v) => v.pack && typeof v.pack === 'object'],
      ['pack_id', (v) => typeof v.pack_id === 'string' && v.pack_id],
      ['blind_comparisons[].pack_ids', (v) => (v.blind_comparisons || []).some((b) => (b.pack_ids || []).length)],
    ],
  },
  {
    key: 'seal',
    what: 'the answers must be shown to have been fixed BEFORE the reveal (RI-MTH03 M3: answer file written and hashed first)',
    at: [
      ['seal', (v) => v.seal && typeof v.seal === 'object'],
      ['answers_sealed_before_reveal', (v) => v.answers_sealed_before_reveal && typeof v.answers_sealed_before_reveal === 'object'],
      ['blind_discipline', (v) => v.blind_discipline && (v.blind_discipline.answer_sha256 || v.blind_discipline.reveal_opened_after_hash === true)],
      ['sampling_rule_declared_before_sampling', (v) => v.sampling_rule_declared_before_sampling && typeof v.sampling_rule_declared_before_sampling === 'object'],
      ['blind_comparisons[].answers_written_before_reveal', (v) => (v.blind_comparisons || []).some((b) => b.answers_written_before_reveal === true)],
    ],
  },
  {
    key: 'results',
    what: 'the reveal outcome must be recorded (RI-MTH03 hard fail: reporting the pick but not the reveal, or the reveal but not the pick)',
    at: [
      ['results', (v) => v.results && typeof v.results === 'object'],
      ['result', (v) => v.result && typeof v.result === 'object'],
      ['blind_comparisons[]', (v) => Array.isArray(v.blind_comparisons) && v.blind_comparisons.length > 0],
    ],
  },
  {
    key: 'leak_audit',
    what: 'a leak audit must have been performed and its outcome recorded (RI-MTH03 M6) — a pack decidable without reading is not a blind result',
    at: [
      ['leak_audit', (v) => v.leak_audit && typeof v.leak_audit === 'object'],
      ['tells', (v) => Array.isArray(v.tells) && v.tells.length > 0],
      ['blind_comparisons[].leak_audit', (v) => (v.blind_comparisons || []).some((b) => b.leak_audit && b.leak_audit.performed !== false)],
      ['protocol_score.checks[] leak row', (v) => ((v.protocol_score || {}).checks || []).some((c) => /leak/i.test(String(c && c.check)))],
    ],
  },
  {
    key: 'no_peek',
    what: 'the judge must attest it did not see the mapping, the builder notes or the item it was quarantined from (RI-MTH03 hard fail; RULES rule 25)',
    at: [
      ['self_audit.answered_before_unblinding', (v) => (v.self_audit || {}).answered_before_unblinding === true],
      ['quarantine', (v) => v.quarantine && typeof v.quarantine === 'object' && Array.isArray(v.quarantine.accidental_reads)],
      ['contamination_declared', (v) => v.contamination_declared && typeof v.contamination_declared === 'object'],
    ],
  },
  {
    key: 'admissibility',
    what: 'the judgement must rule on whether the blind result is ADMISSIBLE as evidence (RI-MTH03 Scoring: below 75% of applicable points it is inadmissible and the item falls back to non-blind scoring)',
    at: [
      ['admissible', (v) => typeof v.admissible === 'boolean'],
      ['results.admissible', (v) => typeof (v.results || {}).admissible === 'boolean'],
      ['protocol_score.blind_result_admissible', (v) => typeof (v.protocol_score || {}).blind_result_admissible === 'boolean'],
      ['leak_audit.verdict', (v) => typeof (v.leak_audit || {}).verdict === 'string' && (v.leak_audit).verdict],
      ['status naming admissibility', (v) => /\b(in)?admissible\b/i.test(String(v.status || '')) || (v.status_reasons || []).some((s) => /\b(in)?admissible\b/i.test(String(s)))],
      ['score.points', (v) => (v.score || {}).points && typeof v.score.points === 'object'],
    ],
  },
];

function validateBlindJudgement(v, E, W) {
  // --- identity
  if (v.schema_version !== 1) E('schema_version must be 1');
  if (v.document_type !== undefined && v.document_type !== 'blind-judgement') E(`document_type "${v.document_type}" but validated as a blind judgement`);
  for (const k of ['piece_id', 'wave', 'critic', 'score', 'status']) {
    if (v[k] === undefined) E(`missing required field \`${k}\``);
  }
  checkSubsystemPaths(v, E, W);
  const c = v.critic || {};
  if (!c.run_id) E('critic.run_id required');
  if (typeof c.role !== 'string' || !/^judge\./.test(c.role)) E('critic.role must name the judging role, e.g. "judge.blind.audio" — a blind judgement is filed by a judge, not by a build critic');
  if (typeof c.conflict_of_interest !== 'boolean') E('critic.conflict_of_interest must be boolean');
  if (c.conflict_of_interest === true) E('critic.conflict_of_interest is true — a conflicted judge cannot produce an admissible blind result (RULES rule 25). File it RECUSED and dispatch a fresh judge.');
  if (c.built_the_pack === true) E('critic.built_the_pack is true — you do not judge a blind pack you built (RULES rule 25). Two comparisons here have already been voided for it.');
  // Same rule as a verdict, same reason: a document with no time is plotted at x = 0, i.e. before
  // every measurement its domain has ever taken. `tools/scores.mjs` plots judgements too.
  if (!c.finished_at && !c.started_at) {
    E('critic.finished_at required (ISO 8601) — a judgement with no time cannot be placed on the trajectory chart, and an unplaced point is drawn at the start of the project rather than left out');
  }
  for (const k of ['started_at', 'finished_at']) {
    if (c[k] && Number.isNaN(Date.parse(c[k]))) E(`critic.${k} is not a parseable timestamp: ${JSON.stringify(c[k])}`);
  }

  // --- the six obligations
  for (const ob of []) {
    const hit = ob.at.find(([, test]) => { try { return test(v); } catch { return false; } });
    if (!hit) {
      E(`blind discipline: no \`${ob.key}\` record — ${ob.what}. Accepted locations: ${ob.at.map(([n]) => n).join(', ')}.`);
    } else if (hit[0] !== ob.key) {
      W(`blind discipline: \`${ob.key}\` is recorded at \`${hit[0]}\`. That is accepted as a legacy spelling; new judgements should write \`${ob.key}\`.`);
    }
  }

  // --- reference items are CONTEXT, not measurements. A blind judge names the item its pack
  // serves and the protocol it is scored against; it does not score them, because it has not
  // read them. So: no native_scale, no score_0_10, no evidence[] — and a legitimate non-reading
  // is sayable.
  for (const r of v.reference_items || []) {
    const tag = r.id || '(no id)';
    if (!/^RI-[A-Z]+\d+$/.test(r.id || '')) E(`reference_items ${tag}: id must look like RI-CMB03`);
    const nr = r.not_read;
    const legacyNotRead = typeof r.path === 'string' && LEGACY_NOT_READ.test(r.path);
    if (nr) {
      if (!NOT_READ_REASONS.includes(nr.reason)) E(`reference_items ${tag}: not_read.reason must be one of ${NOT_READ_REASONS.join('|')}`);
      if (!nr.why) E(`reference_items ${tag}: not_read.why required — say WHY the item was not read, in a sentence a reader can check`);
      if (r.path) E(`reference_items ${tag}: declares not_read AND a path. Say one or the other — a cited path is a claim that the document was opened.`);
      if (r.score_0_10 !== undefined) E(`reference_items ${tag}: not_read and score_0_10 both present. You cannot score an item you did not read.`);
    } else if (legacyNotRead) {
      // The honest answer, in the only slot it had. Accepted, and named, so it migrates.
      W(`reference_items ${tag}: path is the free-text non-reading "${r.path}". Accepted — a blind judge that deliberately did not open the item its pack serves is doing the exercise correctly, and until now the schema had no way to say so. Write it as \`"not_read": { "reason": "quarantined", "why": "…" }\` instead, and drop \`path\`.`);
      if (r.score_0_10 !== undefined) E(`reference_items ${tag}: declared unread and carries score_0_10. You cannot score an item you did not read.`);
    } else if (!r.path || !resolveCitedPath(ROOT, r.path).ok) {
      // A path that merely fails to resolve is STILL an error. The non-reading clause above is
      // narrow on purpose so it cannot be used to launder a missing file.
      E(`reference_items ${tag}: path "${r.path}" does not exist. If the item was deliberately not read, say so with \`not_read: { reason, why }\` — do not point at a file you never opened.`);
    }
    if (r.score_0_10 !== undefined && (typeof r.score_0_10 !== 'number' || r.score_0_10 < 0 || r.score_0_10 > 10)) {
      E(`reference_items ${tag}: score_0_10 must be 0-10`);
    }
  }

  // --- outcome. A judgement's status vocabulary is RI-MTH03's ("meets the bar" / "below bar" /
  // "inadmissible"), not a verdict's PASS|FAIL|VOID, so it is free text — but it must be there,
  // and it must be reasoned.
  if (typeof v.status !== 'string' || !v.status.trim()) E('status required — a judgement must state its outcome in RI-MTH03\'s vocabulary (meets the bar / below bar / blind result inadmissible)');
  if (!Array.isArray(v.status_reasons) || v.status_reasons.length === 0) E('status_reasons[] required — one line per reason the status is what it is');

  // --- score. A JUDGE MAY DECLINE TO SCORE THE PIECE, and that is the second answer this schema
  // could not previously express. W1-22-B2-blind deliberately read no RI-AUD item, so it has no
  // bar to score the piece against and wrote `overall_0_10: null` with a note saying so. Forcing
  // a number there would have been fabricating a measurement. The null is admissible ONLY with a
  // written reason, so it cannot be used to dodge scoring.
  const s = v.score;
  if (!s || typeof s !== 'object') {
    E('score required');
  } else if (s.overall_0_10 === null) {
    if (!s.note) E('score.overall_0_10 is null and score.note is missing — a judge may decline to score the piece (it may not have read the item), but it must say why, in writing');
  } else if (typeof s.overall_0_10 !== 'number' || s.overall_0_10 < 0 || s.overall_0_10 > 10) {
    E('score.overall_0_10 must be a number 0-10, or null with a written score.note');
  } else {
    if (typeof s.pass_threshold !== 'number') E('score.pass_threshold must be a number and must be written down');
    // RI-MTH03's own aggregation is "percentage of applicable points", which is not in the
    // verdict enum and never was. A judgement names its item's aggregation rule in prose.
    if (!s.aggregation || !String(s.aggregation).trim()) E('score.aggregation required — name the item\'s own aggregation rule (RI-MTH03: percentage of applicable points)');
  }

  // --- the gap. Substance is required; the remedy/acceptance discipline is a WARNING here and
  // an error on a verdict, and the difference is stated rather than smuggled: a build critic's
  // gap must be re-measurable by a later critic, so `remedy.acceptance` carries a number. A
  // judge's gap is usually about the INSTRUMENT — the pack leaked, the question had two axes —
  // and its remedy is a protocol change with no build delta to accept against. REVERSIBLE: if
  // judgement gaps start ageing in `tools/gap-ledger.mjs` for want of an acceptance condition,
  // promote these three warnings to errors.
  const g = v.biggest_gap;
  if (g) {
    if (!g.gap_id) E('biggest_gap.gap_id required');
    for (const k of ['what', 'why_it_matters']) if (!g[k]) E(`biggest_gap.${k} required`);
    if (g.subsystem_path) {
      const issue = subsystemPathIssue(g.subsystem_path);
      if (issue && issue.level === 'error') E(`biggest_gap.subsystem_path ${issue.m}`);
      else if (issue) W(`biggest_gap.subsystem_path ${issue.m}`);
    }
    if (!Array.isArray(g.evidence) || g.evidence.length === 0) W('biggest_gap.evidence[] empty — point at the trials or the leak that show it');
    if (!g.remedy) W('biggest_gap.remedy missing — name the protocol or build change that would close it');
    else if (g.remedy && !Array.isArray(g.remedy) && !(g.remedy.action && g.remedy.acceptance)) {
      W('biggest_gap.remedy has no action/acceptance pair — a later reader cannot tell when it is closed');
    }
  }

  // --- self audit. The judge key set differs from the critic's (`answered_before_unblinding`,
  // `no_prose_edited`, `tempted_to_peek`), so the keys are not prescribed — but each entry must
  // be an ANSWER: a boolean, or prose.
  //
  // Prose is allowed on purpose, and the first draft of this rule that demanded a boolean was
  // wrong in exactly the way this whole task is about. W1-PROSE-TICS-r4 answers `tempted_to_peek`
  // with four honest lines ("Not by the reveal. Tempted by pack.json's word counts, deferred
  // until after the ledger was sealed…"). A boolean cannot hold that, and forcing one would
  // trade the content for a checkbox. What is refused is a non-answer: null, a number, an object.
  if (v.self_audit && typeof v.self_audit === 'object') {
    for (const [k, val] of Object.entries(v.self_audit)) {
      const answered = typeof val === 'boolean' || (typeof val === 'string' && val.trim().length > 0);
      if (!answered) E(`self_audit.${k} must be answered — a boolean, or prose saying what actually happened. Got ${JSON.stringify(val)}.`);
    }
    if (Object.values(v.self_audit).some((val) => val === false) && !v.self_audit.self_audit_note) {
      E('self_audit has a false entry and no self_audit_note — a note is required and the judgement is provisional');
    }
  }

  // --- what a judgement structurally cannot have. Not fatal — a judgement may legitimately
  // declare a bifurcation axis — but arbitration is a build check and a judge has no build.
  if (v.arbitration) W('arbitration is present on a blind judgement. A judge answers a pack\'s question and has no build to arbitrate; if this document does arbitrate a build, it is a critic verdict and should say so.');
}

// ------------------------------------------------------------------ cli
let targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (process.argv.includes('--self-test')) {
  const errors = [];
  requireGapForOutcome({ status: 'PASS' }, undefined, m => errors.push(m));
  if (errors.length) throw new Error('rigorous PASS without a qualifying gap was rejected');
  requireGapForOutcome({ status: 'FAIL' }, undefined, m => errors.push(m));
  if (errors.length !== 1) throw new Error('FAIL without an actionable gap was accepted');
  requireGapForOutcome({ status: 'FAIL' }, { gap_id: 'GAP-W1-test' }, m => errors.push(m));
  if (errors.length !== 1) throw new Error('FAIL with a gap was rejected');

  // --- round identity. The triage designed this rule and refused to ship it without these,
  // because the failure mode is silent: a mis-parsed name un-gates a live verdict and nothing
  // anywhere goes red. Every case below is a real filename in corpus/90-verdicts/wave1 except
  // the two marked hypothetical.
  const idOf = (f) => { const { identity, round } = pieceIdentity(f); return `${identity}#${round}`; };
  const idCases = [
    ['W1-01.json', 'W1-01#1'],                                  // no suffix is round 1
    ['W1-01-r2.json', 'W1-01#2'],
    ['W1-01-province-stream-r1.json', 'W1-01-province-stream#1'], // A SUB-PIECE, NOT A ROUND OF W1-01
    ['W1-08-W1-29-r2.json', 'W1-08-W1-29#2'],                    // two piece ids in one name
    ['W1-17-act5-r1.json', 'W1-17-act5#1'],
    ['W1-22-B2-blind.json', 'W1-22-B2-blind#1'],                 // no round, and not a round of W1-22
    ['W1-LIBRARY-r1.json', 'W1-LIBRARY#1'],
    ['W1-LIBRARY-MARTIAL-r4.json', 'W1-LIBRARY-MARTIAL#4'],      // NOT a round of W1-LIBRARY
    ['W1-PROSE-TICS-r4.json', 'W1-PROSE-TICS#4'],
    ['corpus/90-verdicts/wave1/W1-04-r5.json', 'W1-04#5'],       // full path, not just a basename
    ['W1-30-r2-addendum.json', 'W1-30-r2-addendum#1'],           // hypothetical: -rN not at the end is not a round
    ['W1-04-r10.json', 'W1-04#10'],                              // hypothetical: numeric, so r10 > r9
  ];
  for (const [f, want] of idCases) {
    const got = idOf(f);
    if (got !== want) throw new Error(`pieceIdentity("${f}") = ${got}, expected ${want}`);
  }

  const D = 'corpus/90-verdicts/wave1/';
  const rel8 = roundRelevance([
    D + 'W1-01.json', D + 'W1-01-r2.json', D + 'W1-01-province-stream-r1.json',
    D + 'W1-04-r4.json', D + 'W1-04-r5.json', D + 'W1-04-r10.json',
    D + 'W1-LIBRARY-r1.json', D + 'W1-LIBRARY-MARTIAL-r4.json',
    D + 'W1-22-B2-blind.json',
  ]);
  const expectGates = {
    [D + 'W1-01.json']: false,                       // superseded by -r2
    [D + 'W1-01-r2.json']: true,
    [D + 'W1-01-province-stream-r1.json']: true,     // its own piece: must still gate
    [D + 'W1-04-r4.json']: false,
    [D + 'W1-04-r5.json']: false,                    // r10 is higher, numerically
    [D + 'W1-04-r10.json']: true,
    [D + 'W1-LIBRARY-r1.json']: true,                // MARTIAL is a different piece, not a later round
    [D + 'W1-LIBRARY-MARTIAL-r4.json']: true,
    [D + 'W1-22-B2-blind.json']: true,
  };
  for (const [f, want] of Object.entries(expectGates)) {
    const got = rel8.get(f).gates;
    if (got !== want) throw new Error(`roundRelevance: ${f} gates=${got}, expected ${want}`);
  }
  if (rel8.get(D + 'W1-01.json').supersededBy !== D + 'W1-01-r2.json') throw new Error('roundRelevance must name the superseding file');
  // Same basename in two waves must not supersede each other.
  const rel2 = roundRelevance(['corpus/90-verdicts/wave1/W1-01-r2.json', 'corpus/90-verdicts/w2/W1-01-r2.json']);
  if (!rel2.get('corpus/90-verdicts/wave1/W1-01-r2.json').gates || !rel2.get('corpus/90-verdicts/w2/W1-01-r2.json').gates) {
    throw new Error('roundRelevance: identity must be scoped per wave directory');
  }

  // --- a pin stands in for an oversized artifact, but a stub does not. Built on a scratch copy,
  // because a substitution rule nobody has tried to break is a hole with a comment over it.
  {
    const tmp = mkdtempSync(join(tmpdir(), 'verdict-validate-selftest-'));
    try {
      const p = 'reports/selftest/huge.jsonl';
      mkdirSync(join(tmp, 'reports/selftest'), { recursive: true });
      if (resolveCitedPath(tmp, p).ok) throw new Error('a path with neither file nor pin resolved');
      const good = { pin_version: 1, path: p, bytes: 1, sha256: 'a'.repeat(64), produced_by: 'node x.mjs', decisive: { frames: 1 }, cited_by: ['v.json'] };
      writeFileSync(join(tmp, p + '.pin.json'), JSON.stringify(good));
      if (!resolveCitedPath(tmp, p).ok) throw new Error('a well-formed pin did not resolve the citation');
      for (const drop of ['decisive', 'sha256', 'produced_by', 'cited_by']) {
        const stub = { ...good }; delete stub[drop];
        writeFileSync(join(tmp, p + '.pin.json'), JSON.stringify(stub));
        if (resolveCitedPath(tmp, p).ok) throw new Error(`a pin missing \`${drop}\` was accepted as a citation`);
      }
      writeFileSync(join(tmp, p + '.pin.json'), '{ not json');
      if (resolveCitedPath(tmp, p).ok) throw new Error('an unparseable pin was accepted as a citation');
      writeFileSync(join(tmp, p + '.pin.json'), JSON.stringify({ ...good, sha256: 'nope' }));
      if (resolveCitedPath(tmp, p).ok) throw new Error('a pin with no valid SHA-256 was accepted as a citation');
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  }
  // --- THE DOCUMENT-TYPE SPLIT. A type that accepts everything is not a type, so every arm
  // below is a PAIR that genuinely disagrees: the same bytes accepted under one contract and
  // rejected under the other, or one field's presence flipping the outcome. If any arm ever
  // passes both ways, the split has collapsed into a hole and this test must go red.
  {
    const runAs = (doc) => { const E = [], W = []; const t = validateDocument(doc, (m) => E.push(m), (m) => W.push(m)); return { type: t, errors: E, warns: W }; };
    const has = (r, re) => r.errors.some((e) => re.test(e));

    // A minimally complete blind judgement. Every field here is an obligation RI-MTH03 imposes.
    const judgement = () => ({
      schema_version: 1,
      document_type: 'blind-judgement',
      piece_id: 'selftest-blind',
      wave: 1,
      subsystem_paths: ['process.critic.discipline'],
      critic: { run_id: 'judge-selftest', role: 'judge.blind.selftest', conflict_of_interest: false, built_the_pack: false, finished_at: '2026-08-14T00:00:00Z' },
      pack: { pack_id: 'selftest-pack', seed: 1, trials: 8 },
      seal: { answer_file: 'reports/selftest/answer.md', answer_sha256: 'b'.repeat(64), reveal_opened_after_hash: true },
      results: { overall_correct: 8, overall_trials: 8, admissible: true },
      leak_audit: { performed: true, verdict: 'clean', leaks_found: [] },
      quarantine: { forbidden_reads: ['corpus/**/RI-SEL*'], accidental_reads: [], clean: true },
      status: 'meets the bar',
      status_reasons: ['8/8, sealed before reveal, leak audit clean.'],
      score: { overall_0_10: 8, pass_threshold: 7, aggregation: 'RI-MTH03 percentage of applicable points' },
    });

    // ARM 1 — accepted as its own type.
    const j = runAs(judgement());
    if (j.type !== 'blind-judgement') throw new Error(`a document_type:"blind-judgement" document dispatched as ${j.type}`);
    if (j.errors.length) throw new Error(`a well-formed blind judgement was rejected as a judgement: ${j.errors.join(' | ')}`);

    // ARM 2 — THE SAME BYTES, rejected as a critic verdict. This is the arm the whole split
    // exists for: a judgement has no artifacts[], no arbitration and no scored reference items,
    // and it must not be able to pass a build critic's contract by accident.
    const asVerdict = { ...judgement() }; asVerdict.document_type = 'critic-verdict';
    const jv = runAs(asVerdict);
    if (jv.type !== 'critic-verdict') throw new Error('forcing document_type:"critic-verdict" did not dispatch as one');
    for (const re of [/missing required field `artifacts`/, /missing required field `arbitration`/, /missing required field `bifurcation`/, /artifacts is empty/]) {
      if (!has(jv, re)) throw new Error(`a blind judgement was accepted as a critic verdict — ${re} never fired`);
    }

    // ARM 3 — the other direction. A build critic's verdict must NOT pass as a judgement: it has
    // no pack, no seal, no leak audit, no reveal.
    const verdictish = { schema_version: 1, document_type: 'blind-judgement', piece_id: 'selftest-verdict', wave: 1, subsystem_paths: ['process.critic.discipline'], critic: { run_id: 'crit-selftest', role: 'critic.selftest', conflict_of_interest: false, finished_at: '2026-08-14T00:00:00Z' }, artifacts: [], arbitration: { ar1: {}, ar2: {} }, status: 'FAIL', status_reasons: ['x'], score: { overall_0_10: 4, pass_threshold: 7, aggregation: 'min' } };
    const vj = runAs(verdictish);
    for (const re of [/critic\.role must name the judging role/, /no `pack` record/, /no `seal` record/, /no `leak_audit` record/]) {
      if (!has(vj, re)) throw new Error(`a critic verdict was accepted as a blind judgement — ${re} never fired`);
    }

    // ARM 4 — the discipline is not vacuous. Drop each obligation in turn and it must go red.
    for (const [drop, re] of [['seal', /no `seal` record/], ['leak_audit', /no `leak_audit` record/], ['pack', /no `pack` record/], ['results', /no `results` record/], ['quarantine', /no `no_peek` record/]]) {
      const d = judgement(); delete d[drop];
      if (drop === 'quarantine') delete d.self_audit;
      const r = runAs(d);
      if (!has(r, re)) throw new Error(`a blind judgement with no \`${drop}\` was accepted — the obligation is vacuous`);
    }
    // …and a legacy spelling satisfies the obligation with a warning, rather than silently.
    { const d = judgement(); delete d.seal; d.answers_sealed_before_reveal = { bundle_sha256: 'c'.repeat(64) };
      const r = runAs(d);
      if (r.errors.length) throw new Error(`the legacy seal spelling was rejected: ${r.errors.join(' | ')}`);
      if (!r.warns.some((w) => /`seal` is recorded at `answers_sealed_before_reveal`/.test(w))) throw new Error('a legacy spelling was accepted silently — it must name the canonical key');
    }

    // ARM 5 — AN HONEST NON-READING. The case that started this: a judge deliberately did not
    // open the item its pack serves, and the schema had no way to say so.
    const withItems = (items) => { const d = judgement(); d.reference_items = items; return runAs(d); };
    if (withItems([{ id: 'RI-AUD03', role: 'the item the pack serves', not_read: { reason: 'quarantined', why: 'deliberately unread by this judge, which is the point of the exercise' } }]).errors.length) {
      throw new Error('a structured not_read declaration was rejected');
    }
    if (!withItems([{ id: 'RI-AUD03', not_read: { reason: 'because I felt like it', why: 'x' } }]).errors.some((e) => /not_read\.reason must be one of/.test(e))) {
      throw new Error('a free-text not_read reason was accepted');
    }
    if (!withItems([{ id: 'RI-AUD03', not_read: { reason: 'quarantined' } }]).errors.some((e) => /not_read\.why required/.test(e))) {
      throw new Error('not_read with no reason-in-prose was accepted');
    }
    if (!withItems([{ id: 'RI-AUD03', not_read: { reason: 'quarantined', why: 'x' }, score_0_10: 7 }]).errors.some((e) => /cannot score an item you did not read/.test(e))) {
      throw new Error('an unread item carrying a score was accepted — that is exactly the abuse the field must not enable');
    }
    // The legacy free-text form, in the only slot it had: accepted, and named so it migrates.
    { const r = withItems([{ id: 'RI-AUD03', path: 'NOT READ - quarantined' }]);
      if (r.errors.length) throw new Error(`the legacy "NOT READ - quarantined" form was rejected: ${r.errors.join(' | ')}`);
      if (!r.warns.some((w) => /not_read/.test(w))) throw new Error('the legacy non-reading was accepted silently'); }
    // …and it CANNOT launder a missing file. A path-shaped citation that does not resolve is
    // still an error, on a judgement exactly as on a verdict.
    if (!withItems([{ id: 'RI-AUD03', path: 'reports/gone-forever.json' }]).errors.some((e) => /does not exist/.test(e))) {
      throw new Error('a missing file was laundered through the non-reading clause');
    }
    // A CRITIC VERDICT may not use it at all — a critic that could not measure an item says
    // `measured: "unmeasurable"`, score 0, fail-closed.
    { const d = { ...judgement(), document_type: 'critic-verdict', reference_items: [{ id: 'RI-AUD03', not_read: { reason: 'quarantined', why: 'x' } }] };
      if (!runAs(d).errors.some((e) => /a critic verdict may not declare an item unread/.test(e))) {
        throw new Error('a critic verdict was allowed to declare an item unread — that is a route around scoring it');
      } }

    // ARM 6 — A JUDGE MAY DECLINE TO SCORE THE PIECE, but only in writing. W1-22-B2-blind read
    // no RI-AUD item, so it had no bar to score against; forcing a number would be fabrication.
    { const d = judgement(); d.score = { overall_0_10: null, note: 'this judge deliberately did not read the item, so it has no bar to score the piece against' };
      if (runAs(d).errors.length) throw new Error('a written, reasoned refusal to score was rejected'); }
    { const d = judgement(); d.score = { overall_0_10: null };
      if (!runAs(d).errors.some((e) => /score\.note is missing/.test(e))) throw new Error('an unexplained null score was accepted — the refusal must be reasoned'); }

    // ARM 6b — a self-audit answer may be prose (a judge's "tempted_to_peek" is not a checkbox),
    // but a NON-answer is refused.
    { const d = judgement(); d.self_audit = { answered_before_unblinding: true, tempted_to_peek: 'Not by the reveal; tempted by the word counts and deferred.' };
      if (runAs(d).errors.length) throw new Error('an honest prose self-audit answer was rejected — that is the failure this whole split exists to fix'); }
    { const d = judgement(); d.self_audit = { answered_before_unblinding: true, tempted_to_peek: null };
      if (!runAs(d).errors.some((e) => /must be answered/.test(e))) throw new Error('an unanswered self-audit key was accepted'); }
    { const d = judgement(); d.self_audit = { answered_before_unblinding: false };
      if (!runAs(d).errors.some((e) => /no self_audit_note/.test(e))) throw new Error('a false self-audit entry with no note was accepted'); }

    // ARM 7 — type dispatch, including the retired identifier.
    const dispatch = (doc) => documentType(doc);
    if (dispatch({ critic: { role: 'judge.blind.audio' } }).type !== 'blind-judgement') throw new Error('a judge.* role did not infer the judgement type');
    if (dispatch({ critic: { role: 'critic.quests.faction' } }).type !== 'critic-verdict') throw new Error('a critic.* role did not infer the verdict type');
    if (dispatch({}).type !== 'critic-verdict') throw new Error('an undeclared document must default to the STRICTER type');
    { const d = dispatch({ schema: 'elder-souls/verdict@1', critic: { role: 'judge.blind.audio' } });
      if (d.type !== 'critic-verdict') throw new Error('the retired identifier must not silently become a judgement');
      if (!d.notes.some((n) => n.level === 'error' && /RETIRED/.test(n.m))) throw new Error('the retired `elder-souls/verdict@1` identifier was accepted'); }
    if (!dispatch({ document_type: 'plan-critique' }).notes.some((n) => n.level === 'error')) throw new Error('an unknown document_type was accepted');
    // Inference is a migration aid and must say so.
    if (!dispatch({ critic: { role: 'judge.blind.audio' } }).notes.some((n) => n.level === 'warn' && /Declare/.test(n.m))) throw new Error('type inference was silent');

    // ARM 8 — subsystem paths. A refinement of a registered subsystem warns; an unregistered
    // path with no canonical ancestor is still an error. Registering a subsystem is a taxonomy
    // decision, not a validator's.
    if (subsystemPathIssue('process.critic.discipline') !== null) throw new Error('a canonical path was flagged');
    { const i = subsystemPathIssue('process.critic.discipline.blind');
      if (!i || i.level !== 'warn') throw new Error('a strict refinement of a canonical path was not treated as a refinement'); }
    { const i = subsystemPathIssue('sandwich.filling.pickle');
      if (!i || i.level !== 'error') throw new Error('an unregistered path with no canonical ancestor was accepted'); }
  }

  console.log('verdict validator self-test: no-gap PASS accepted; gapless FAIL rejected; historical gap-bearing shape accepted;');
  console.log(`  round identity correct on ${idCases.length} naming edge cases, ${Object.keys(expectGates).length} relevance cases, and per-wave scoping;`);
  console.log('  a well-formed pin resolves an oversized citation and five malformed pins do not;');
  console.log('  document-type split: a blind judgement is ACCEPTED as a judgement and REJECTED as a critic verdict (and the reverse);');
  console.log('  each of the six blind obligations rejects its own omission; a legacy spelling warns rather than passing silently;');
  console.log('  an honest non-reading is expressible, cannot carry a score, cannot launder a missing file, and is refused on a critic verdict;');
  console.log('  a reasoned refusal to score is accepted and an unreasoned one is not; the retired `elder-souls/verdict@1` identifier is refused.');
  process.exit(0);
}
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

// Only the latest round of a piece gates. `--all-rounds` restores the old behaviour, and skipped
// rounds are still validated and still counted out loud — the point is that a superseded draft
// stops holding CI red, not that it stops being visible. `--verbose` prints their errors too.
const allRounds = process.argv.includes('--all-rounds');
const verbose = process.argv.includes('--verbose');
const relevance = roundRelevance(targets.map((t) => rel(t.startsWith('/') ? t : join(ROOT, t))));

let failed = 0, skipped = 0, skippedWithErrors = 0;
for (const t of targets) {
  const p = t.startsWith('/') ? t : join(ROOT, t);
  const name = rel(p);
  // One malformed verdict must not stop the sweep. It did: an unhandled throw on the 19th of 36
  // left eighteen unvalidated and reported nothing, so the corpus-wide gate had been half-running
  // for as long as that field had been wrong. A crash on one file is a finding ABOUT that file.
  let errors, warns;
  try { ({ errors, warns } = validate(p)); }
  catch (e) { errors = [`validator threw on this file — ${e.message}`]; warns = []; }

  const r = relevance.get(name) || { gates: true, supersededBy: null };
  if (!allRounds && !r.gates) {
    skipped++;
    if (errors.length) skippedWithErrors++;
    console.log(`SKIP  ${name}  — superseded by ${r.supersededBy}${errors.length ? `; ${errors.length} error(s), not gating` : '; clean'}`);
    if (verbose) for (const e of errors) console.log(`   (skipped) ERROR  ${e}`);
    continue;
  }

  if (errors.length === 0) console.log(`OK    ${name}${warns.length ? `  (${warns.length} warning(s))` : ''}`);
  else { failed++; console.log(`FAIL  ${name}  — ${errors.length} error(s)`); }
  for (const e of errors) console.log(`   ERROR  ${e}`);
  for (const w of warns) console.log(`   warn   ${w}`);
}
if (skipped) {
  console.log(`\n${skipped} superseded draft round(s) skipped (${skippedWithErrors} of them non-conformant). They are history: a later round of the same piece exists. Re-run with --all-rounds to validate them, --verbose to see their errors.`);
}
process.exit(failed ? 1 : 0);
