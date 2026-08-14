#!/usr/bin/env node
// readpath.mjs — measure the mandatory cold-start read path, and prove no hazard fell off it.
//
// WHY. Every agent pays the read path before it does anything, so a token saved here is a token
// saved on every agent, forever. Measured 2026-08-14 it was ~145,000 tokens. `DOC-POLICY.md`
// sets the acceptance test for any cleanup, and it has TWO halves:
//
//   1. the measured read path is materially smaller — before and after, in tokens;
//   2. a NAMED list of critical facts is still reachable within two hops of `CLAUDE.md`.
//
// "A cleanup that hits its token target and loses a hazard has failed, and it will fail silently
// unless something is checking." This is the something. Half 1 alone is the easy half and this
// tool refuses to report it on its own: a missing fact exits non-zero.
//
// Usage:
//   node tools/readpath.mjs                 measure + check facts; exit 1 if any fact is lost
//   node tools/readpath.mjs --json          machine-readable
//   node tools/readpath.mjs --facts         only the facts check, with where each was found
//   node tools/readpath.mjs --self-break    prove the instrument can go red (RULES.md rule 4)
//
// TOKENS ARE ESTIMATED AT 4 CHARACTERS PER TOKEN, and that is stated rather than hidden. It is
// the same estimator the 145,000 figure was taken with — checked against its own published
// components (INDEX 205,192 ch/51k, ARBITRATION 170,082 ch/42k, COST 66,906 ch/17k, all 3.94-4.05
// ch/tok). Bytes are also printed, and bytes are exact. Use the SAME estimator on both sides of a
// change or the delta means nothing.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const P = (...p) => join(ROOT, ...p);
const CHARS_PER_TOKEN = 4;

// ---- the read path -----------------------------------------------------------------------
// Every entry names WHO tells an agent to read it. This list is the claim; if a document stops
// pointing at one of these, the entry should go, and that is a deliberate edit, not a drift.
const READ_PATH = [
  ['CLAUDE.md', 'the front door — loaded before the agent does anything'],
  ['orchestration/RULES.md', 'CLAUDE.md: "Read orchestration/RULES.md next"'],
  ['orchestration/INDEX.md', 'CLAUDE.md: "then orchestration/INDEX.md"'],
  ['orchestration/DOC-POLICY.md', 'the specification for every document on this list'],
  ['orchestration/HAZARDS.md', 'CLAUDE.md: "HAZARDS.md\'s opening section is the whole instruction"'],
  ['orchestration/OWNER-DIRECTIVES-2026-08-14.md', 'CLAUDE.md: "Read it after this file"'],
  ['orchestration/COST.md', 'CLAUDE.md: "orchestration/COST.md is binding"'],
  ['corpus/00-doctrine/ARBITRATION.md', 'ARBITRATION §3: every critic prompt must carry it; RULES rule 5'],
  ['orchestration/TICK.md', 'CLAUDE.md: "orchestration/TICK.md is the loop"'],
  ['orchestration/AGENT-PROTOCOL.md', 'RULES.md line 4: the evidence for every rule'],
  ['orchestration/EFFORT-POLICY.md', 'dispatch-time policy every agent is briefed against'],
];

// ---- the critical facts, written down BEFORE the 2026-08-14 cleanup ------------------------
// Each is a fact whose loss costs real work or real money. `probe` must match somewhere within
// two hops of CLAUDE.md. Keep the visceral half of the fact in the probe where there is one:
// a rule that has lost its reason gets re-derived by the next clever agent (DOC-POLICY rule 3).
const FACTS = [
  ['land-recipe', /tools\/land\.mjs["'`\s].*--paths|--paths\s+<yours>/s],
  ['land-pushes', /exits? non-zero unless the bytes are (actually )?on the remote/i],
  ['banned-recipe', /read-tree\s+origin/i],
  ['banned-recipe-cost', /22,209 lines/],
  ['head-not-baseline', /HEAD.{0,4} is not your baseline/i],
  ['diff-against-head', /against `?HEAD`?, never against `?origin`?/i],
  ['pkill-headless-fleetwide', /pkill -f headless_shell/],
  ['runpod-cleanup-kills-siblings', /`?cleanup`? (with no arg|used to)/i],
  ['gpu-deck-help-rents-a-pod', /gpu-deck\.mjs `?--help`?[^\n]{0,80}(rents?|Pod)/i],
  ['git-gc-prune', /git gc --prune=now/],
  ['five-non-negotiables', /five non-negotiables/],
  ['arbitration-rule', /Inside the fight, Souls wins\. Everywhere else, Morrowind wins\./],
  ['S55-cap-is-2', /S55[\s\S]{0,600}?AMENDED TO 2|cap is amended to \*\*2\*\*|CAP IS AMENDED TO 2/],
  ['consumption-rimth07', /RI-MTH07/],
  // ---- the character directive, 2026-08-14. The owner asked for certainty it survives compaction,
  // ---- so forgetting it fails a check rather than merely being regrettable.
  ['characters-look-ridiculous', /look frankly\s*\n?\s*ridiculous/i],
  ['characters-need-reference-set', /reference (images\/gifs|set)[\s\S]{0,400}?(Skyrim|ESO)/i],
  ['characters-motion-not-stills', /stills are not enough/i],
  ['character-design-seam-hole', /design\/quality seam for creatures/i],
  ['events-vocabulary-closed', /events\.js`? is closed/i],
  ['commit-only', /git commit --only/],
  ['rule-0-never-wait', /AskUserQuestion/],
  ['gold-is-the-currency', /Gold is the only currency|gold is the currency/i],
  // Deliberately NOT just /append-only/i — that matched the filename `check-append-only.mjs` in
  // the tool listing, so the probe passed while saying nothing about the doctrine it is for.
  ['rulings-append-only', /Amendments are append-only[\s\S]{0,200}?(struck|superseded)/i],
  ['model-routing-sonnet-default', /C6[\s\S]{0,400}?Sonnet|Sonnet[\s\S]{0,200}?default/],
  // G1 was INVERTED on 2026-08-14 evening — from a floor of 12 concurrent agents to roadmap steps
  // delivered. The fact that must stay reachable is the negative one: there is no parallelism floor.
  ['G1-inverted-not-a-floor', /no parallelism floor/i],
  ['land-self-test', /land\.mjs --self-test/],
  ['control-clone-writable', /--writable/],
  ['contention-gate', /contention\.mjs --gate/],
  ['one-browser-is-six', /one browser is six|six `?headless_shell`? entries/i],
  ['batch-probes-rule-19b', /probe\.mjs/],
];

// ---- two-hop reachability from CLAUDE.md ---------------------------------------------------
// Hop 0 is CLAUDE.md. Hop 1 is every repo document CLAUDE.md names. Hop 2 is every repo document
// those name. Anything deeper is not "reachable in two hops" and does not count, which is the
// whole point of the test — a hazard that has drifted three documents away is lost in practice
// even though grep can still find it.
const DOCLIKE = /\.(md|json|mjs|js)$/;
// `orchestration/status/` is EXCLUDED from the graph on purpose. A status file is one agent's
// working note for a few hours, not documentation — and counting it would let this instrument
// pass because the very agent doing the cleanup happened to write the fact into its own status
// file. That is exactly the self-fulfilling probe rule 4 is about; it happened on the first run.
const EXCLUDE = [/^orchestration\/status\//, /^\.claude\/worktrees\//, /^node_modules\//];

// Documents here refer to siblings by bare name — CLAUDE.md says "HAZARDS.md", not
// "orchestration/HAZARDS.md". A resolver that only accepts full paths would score those as
// unreachable and hide real coverage, so bare names are resolved against the directories the
// governing documents actually live in.
const BARE_DIRS = ['', 'orchestration/', 'corpus/00-doctrine/', 'tools/'];
function resolvePath(p) {
  for (const d of BARE_DIRS) {
    const c = d + p;
    if (existsSync(P(c)) && statSync(P(c)).isFile()) return c;
  }
  return null;
}
function namedPaths(src) {
  const out = new Set();
  // markdown links, backticked paths, and bare repo paths
  for (const m of src.matchAll(/(?:\]\(|`|\s|^)([A-Za-z0-9_./-]+\.(?:md|json|mjs|js))(?:`|\)|\s|$|[.,;:])/gm)) {
    const raw = m[1].replace(/^\.\//, '');
    if (raw.startsWith('http')) continue;
    const p = resolvePath(raw);
    if (p && !EXCLUDE.some(re => re.test(p))) out.add(p);
  }
  return out;
}

function reachable(maxHops = 2) {
  const hop = new Map([['CLAUDE.md', 0]]);
  let frontier = ['CLAUDE.md'];
  for (let h = 1; h <= maxHops; h++) {
    const next = [];
    for (const f of frontier) {
      let src; try { src = readFileSync(P(f), 'utf8'); } catch { continue; }
      for (const p of namedPaths(src)) {
        if (hop.has(p) || !DOCLIKE.test(p)) continue;
        hop.set(p, h); next.push(p);
      }
    }
    frontier = next;
  }
  return hop;
}

// ---- measure -------------------------------------------------------------------------------
function measure() {
  const rows = [];
  for (const [p, why] of READ_PATH) {
    const bytes = existsSync(P(p)) ? statSync(P(p)).size : null;
    rows.push({ path: p, why, bytes, tokens: bytes === null ? null : Math.round(bytes / CHARS_PER_TOKEN) });
  }
  const missing = rows.filter(r => r.bytes === null).map(r => r.path);
  const bytes = rows.reduce((a, r) => a + (r.bytes || 0), 0);
  return { rows, missing, bytes, tokens: Math.round(bytes / CHARS_PER_TOKEN) };
}

// A checker must never satisfy its own probes. `tools/readpath.mjs` contains every FACTS regex as a
// literal, so if it is reachable in the hop map it will match almost any probe and the whole suite
// silently proves itself. Found 2026-08-14 by breaking a fact in CLAUDE.md and watching the probe stay
// green at `hop 1 tools/readpath.mjs` — the vacuous-control shape HAZARDS 0b is about, in the guard
// that exists to prevent exactly that.
const SELF_EXCLUDED = ['tools/readpath.mjs'];

function checkFacts(hopMap, injectMiss = null) {
  const files = [...hopMap.entries()]
    .filter(([f]) => !SELF_EXCLUDED.some(x => f === x || f.endsWith('/' + x)))
    .sort((a, b) => a[1] - b[1]);
  const cache = new Map();
  const read = f => { if (!cache.has(f)) { try { cache.set(f, readFileSync(P(f), 'utf8')); } catch { cache.set(f, ''); } } return cache.get(f); };
  const results = [];
  for (const [id, probe] of FACTS) {
    if (injectMiss === id) { results.push({ id, found: false, where: null, hop: null }); continue; }
    let hit = null;
    for (const [f, h] of files) { if (probe.test(read(f))) { hit = { f, h }; break; } }
    results.push({ id, found: !!hit, where: hit && hit.f, hop: hit && hit.h });
  }
  return results;
}

// ---- run -----------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const has = f => argv.includes(f);

if (has('--self-break')) {
  // RULES.md rule 4: a probe that cannot fail is worse than no probe. Drop one fact on purpose
  // and require the instrument to go red; if the two arms agree, the suite is vacuous.
  const hopMap = reachable();
  const clean = checkFacts(hopMap);
  const broken = checkFacts(hopMap, 'arbitration-rule');
  const cleanLost = clean.filter(r => !r.found).length;
  const brokenLost = broken.filter(r => !r.found).length;
  console.log(`self-break: clean arm lost ${cleanLost} fact(s); sabotaged arm lost ${brokenLost}.`);
  if (brokenLost <= cleanLost) {
    console.error('self-break FAILED — the arms agree, so this instrument proves nothing.');
    process.exit(1);
  }
  console.log('self-break OK — the arms disagree, so a lost fact is actually detected.');
  process.exit(0);
}

const m = measure();
const hopMap = reachable();
const facts = checkFacts(hopMap);
const lost = facts.filter(f => !f.found);

if (has('--json')) {
  console.log(JSON.stringify({ chars_per_token: CHARS_PER_TOKEN, ...m, facts, lost: lost.map(f => f.id) }, null, 2));
} else {
  if (!has('--facts')) {
    console.log('The mandatory cold-start read path\n');
    console.log('| file | bytes | ~tokens | who sends you here |');
    console.log('|---|---:|---:|---|');
    for (const r of m.rows) {
      console.log(`| ${r.path} | ${r.bytes === null ? 'MISSING' : r.bytes.toLocaleString()} | ${r.tokens === null ? '-' : r.tokens.toLocaleString()} | ${r.why} |`);
    }
    console.log(`| **TOTAL** | **${m.bytes.toLocaleString()}** | **${m.tokens.toLocaleString()}** | at ${CHARS_PER_TOKEN} chars/token |`);
    if (m.missing.length) console.log(`\nNOT ON DISK: ${m.missing.join(', ')} — the list is a claim about the tree and it is wrong.`);
  }
  console.log(`\nCritical facts reachable within two hops of CLAUDE.md: ${facts.length - lost.length}/${facts.length}`);
  for (const f of facts) {
    console.log(`  ${f.found ? 'ok  ' : 'LOST'} ${f.id.padEnd(32)} ${f.found ? `hop ${f.hop}  ${f.where}` : '— NOT REACHABLE IN TWO HOPS'}`);
  }
}

if (m.missing.length) process.exit(2);
process.exit(lost.length ? 1 : 0);
