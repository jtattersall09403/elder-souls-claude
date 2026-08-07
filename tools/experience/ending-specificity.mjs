#!/usr/bin/env node
// ending-specificity.mjs — RI-EXP05 "Comparison method" Step 4.
//
// Written by the W1-19 builder under orchestration/TOOL-LOOP.md. RI-EXP05 names this command and
// it did not exist on disk (corpus-index C8). The rule the loop imposes is explicit:
//
//   "If the tool cannot be written honestly because the system it measures does not exist, make
//    it report that absence and exit non-zero; never stub it to pass."
//
// This is that case, and the reason is worth stating precisely rather than as "not built".
//
// WHAT THE ITEM ASKS FOR
//   "Every noun-phrase in the ending's delivered text is resolved against the PLAYER'S OWN TRACE
//    ... a cited fact counts only if it names something this playthrough actually did, locatable
//    in the chain. A line that would be identical in every playthrough scores zero. This is the
//    same resolution rule as RI-EXP02 §E and uses the same resolver."
//
// WHY IT CANNOT BE ANSWERED HONESTLY ON THIS BUILD
//   1. **There is no delivered ending text.** The ending's *journal* entries exist and are
//      authored (Q-MAIN-28 / Q-MAIN-31), but "delivered text" in RI-EXP05 means the final
//      conversation responses plus the closing lines, and the conversation responses live in a
//      per-NPC topic response system that does not exist (see tools/experience/ending-diff.mjs
//      for the same absence measured from the other side). Scoring specificity over the journal
//      alone would answer a smaller question wearing the item's name.
//   2. **There is no shared resolver.** The item requires "the same resolver" as RI-EXP02 §E.
//      `tools/experience/` contains no resolver, `RI-EXP02` names one and it is also absent, and
//      writing a second, different resolver here would produce a number that is not comparable to
//      the one RI-EXP02 is scored on — which is the failure mode RI-MTH07 exists to catch.
//   3. **There is no played chain to resolve against.** The item's step 1 requires two chains
//      produced by `tools/experience/session-run.mjs`, which does not exist either.
//      `tools/quests/mainline-trace.mjs` produces a *scripted* chain, not a played one; using it
//      would resolve the ending text against a trace that a probe wrote rather than against one a
//      player produced, and every fact would resolve trivially.
//
// WHAT WOULD MAKE IT MEASURABLE, in order:
//   a. an `askTopic(npc, topic) -> { response_id, text }` verb on window.__HARNESS (W1-17)
//   b. `tools/experience/session-run.mjs` producing a chain artifact (RI-EXP's own infrastructure)
//   c. one resolver in `tools/experience/lib/resolver.mjs`, shared with RI-EXP02 §E
//
// Until then RI-EXP05 LH11 is `unmeasurable`, which under SCORING.md §0 min-over-axes is 0 for
// that axis and a declared corpus debt — not a pass and not a silent gap.
//
//   node tools/experience/ending-specificity.mjs   → prints the absence, exits 4.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage(`
ending-specificity.mjs — RI-EXP05 step 4. Reports that the measurement is not yet possible and why.

USAGE
  node tools/experience/ending-specificity.mjs [--out <dir>]

Exit 4 = unmeasurable, with the missing prerequisites named. It never exits 0 on this build.
`);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-19-SPECIFICITY');
ensureDir(outDir);

const missing = [
  { id: 'harness.askTopic', what: 'window.__HARNESS.askTopic(npc, topic) -> { response_id, text }', owner: 'W1-17 (dialogue.topics.*)', present: false },
  { id: 'tools/experience/session-run.mjs', what: 'the played-chain runner RI-EXP05 step 1 invokes', owner: 'RI-EXP infrastructure', present: fs.existsSync(path.join(process.cwd(), 'tools/experience/session-run.mjs')) },
  { id: 'tools/experience/lib/resolver.mjs', what: 'the noun-phrase resolver shared with RI-EXP02 §E', owner: 'RI-EXP02', present: fs.existsSync(path.join(process.cwd(), 'tools/experience/lib/resolver.mjs')) },
];

// What DOES exist, so the debt is bounded rather than open: the candidate text this tool would
// resolve, counted, so a successor knows the size of the job.
const QDIR = path.join(process.cwd(), 'game/data/quests');
let endingEntries = 0, endingWords = 0;
for (const f of ['mainline-act5.json', 'mainline-backpath.json']) {
  const p = path.join(QDIR, f);
  if (!fs.existsSync(p)) continue;
  for (const q of JSON.parse(fs.readFileSync(p, 'utf8')).quests || []) {
    for (const e of q.journal || []) {
      if (e.state !== 'success') continue;
      endingEntries++; endingWords += e.text.split(/\s+/).length;
    }
  }
}

const out = {
  schema: 'elder-souls/ending-specificity@1',
  tool: 'tools/experience/ending-specificity.mjs',
  written_by: 'W1-19 under orchestration/TOOL-LOOP.md',
  at: new Date().toISOString(),
  measurable: false,
  metric: 'ending_specific_facts',
  value: null,
  reason: 'RI-EXP05 step 4 resolves ending text against a played chain using the resolver shared with RI-EXP02 §E. Neither the delivered-text channel, nor the chain runner, nor the shared resolver exists on this build.',
  missing_prerequisites: missing,
  candidate_corpus_that_would_be_resolved: { ending_journal_entries: endingEntries, words: endingWords },
  ruling: 'RI-EXP05 LH11 is unmeasurable and therefore 0 under SCORING.md §0 min-over-axes. It is a declared corpus/build debt against W1-17 and the RI-EXP infrastructure, not a property of the mainline content.',
};
writeJson(path.join(outDir, 'ending-specificity.json'), out);
console.error(`\nending-specificity: UNMEASURABLE on this build.\n  ${out.reason}\n`);
for (const m of missing) console.error(`  missing: ${m.id} — ${m.what} (owner: ${m.owner})`);
console.error(`\n  ${endingEntries} ending journal entries / ${endingWords} words are authored and waiting for a resolver.\n  wrote ${outDir}\n`);
process.exit(4);
