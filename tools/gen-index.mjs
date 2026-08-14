#!/usr/bin/env node
// gen-index.mjs — regenerate orchestration/INDEX.md, the one page an agent reads to orient.
//
// Why. There are 400+ tools, 145 reference items and 30 pieces. With a dozen agents running,
// every hour of "where does X live / is there already a tool for this / who owns this file" is
// paid a dozen times over. Worse, an agent that cannot find a tool writes a second one: the
// project already has duplicate instruments that were each written by someone who could not see
// the other. The index is generated, so it cannot drift from the tree the way a hand-written map
// would — and a hand-written map is what everyone would stop trusting after the first week.
//
// It is DERIVED, never authored. Everything here comes from the tree: the first comment line of
// each tool, the front-matter of each reference item, the piece list, the gates, the harness
// surface, and who currently owns which files.
//
// Run: node tools/gen-index.mjs   (wired into .githooks/pre-commit)
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const P = (...p) => join(ROOT, ...p);
const rel = p => relative(ROOT, p).split('\\').join('/');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|__pycache__|\.git/.test(e.name)) walk(p, out); }
    else out.push(p);
  }
  return out;
}

/** A tool's purpose is the first real sentence of its header comment — the thing its author wrote
 *  to explain it. If there isn't one, say so: an unexplained tool is a finding, not a blank. */
function purposeOf(file) {
  let head;
  try { head = readFileSync(file, 'utf8').slice(0, 2600).split('\n'); } catch { return null; }
  const lines = [];
  for (const l of head) {
    const t = l.trim();
    if (t.startsWith('#!')) continue;
    if (/^(\/\/|#)/.test(t)) { lines.push(t.replace(/^(\/\/|#)\s?/, '')); continue; }
    if (!t && !lines.length) continue;
    break;                                   // first non-comment line ends the header
  }
  const text = lines.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  // The first sentence, minus the tool's own filename if the author led with it.
  const first = (text.split(/(?<=[.!?])\s/)[0] || text).replace(/^[\w.-]+\.(mjs|py|cjs|js)\s*[—:-]\s*/, '');
  return first.slice(0, 160);
}

// ---- tools ---------------------------------------------------------------------------------
const toolFiles = walk(P('tools')).filter(f => /\.(mjs|cjs|js|py)$/.test(f) && !/\/lib\/.*\.json$/.test(f));
const byArea = new Map();
for (const f of toolFiles) {
  const r = rel(f);
  const area = r.split('/').length > 2 ? r.split('/')[1] : '(top level)';
  if (!byArea.has(area)) byArea.set(area, []);
  byArea.get(area).push({ path: r, purpose: purposeOf(f) });
}
for (const list of byArea.values()) list.sort((a, b) => a.path.localeCompare(b.path));
const undocumented = [...byArea.values()].flat().filter(t => !t.purpose);

// ---- reference items -----------------------------------------------------------------------
const itemFiles = walk(P('corpus')).filter(f => /\/RI-[A-Z0-9-]+.*\.md$/.test(rel(f)));
const items = itemFiles.map(f => {
  const src = readFileSync(f, 'utf8');
  const id = (rel(f).match(/(RI-[A-Z]+\d+)/) || [])[1] || rel(f);
  const title = (src.match(/^#\s+(.+)$/m) || [, ''])[1].replace(/^RI-[A-Z0-9]+\s*[—:-]\s*/, '');
  const judges = (src.match(/^judges:\s*(.+)$/m) || [, ''])[1].trim();
  return { id, title: title.slice(0, 90), judges: judges.slice(0, 160), path: rel(f) };
}).sort((a, b) => a.id.localeCompare(b.id));

// ---- gates ---------------------------------------------------------------------------------
const gates = [
  ['node tools/boot-check.mjs', 'does the engine construct AND draw a frame'],
  ['node tools/check-data.mjs', 'every file in game/data/index.json exists; NPC settlements resolve; **the two soul ledgers agree**'],
  ['node tools/check-souls-world.mjs', "the world's cached soul roll-up (`population-posts.json`) equals what the statblocks pay, row by row. `--totals` prints the current figure in one line"],
  ['node tools/check-quests.mjs', 'hooks and entry topics name quests and journal entries that exist'],
  ['node tools/check-content.mjs', 'no quest resolution has disappeared'],
  ['node tools/check-prose.mjs', 'questions, exclamations, punchline rate, tic list'],
  ['node tools/corpus-index.mjs', 'corpus coherence; C8 reports tools named by items but absent'],
  ['node tools/publish.mjs', 'rebuilds the site and fails on an unplotted verdict or a broken image'],
].filter(([cmd]) => existsSync(P(cmd.split(' ')[1])));

// ---- who owns what, right now --------------------------------------------------------------
const statusDir = P('orchestration', 'status');
const live = [];
if (existsSync(statusDir)) {
  for (const f of readdirSync(statusDir).filter(f => f.endsWith('.json'))) {
    try {
      const j = JSON.parse(readFileSync(join(statusDir, f), 'utf8'));
      const mtime = statSync(join(statusDir, f)).mtime;
      live.push({
        task: j.task_id || f.replace(/\.json$/, ''),
        state: j.state || '?',
        files: (j.files_touched || j.files || []).slice(0, 6),
        next: String(j.next_step || '').slice(0, 90),
        at: mtime,
      });
    } catch { }
  }
}
live.sort((a, b) => b.at - a.at);
const active = live.filter(l => !/complete|blocked/i.test(l.state));

// ---- harness surface -----------------------------------------------------------------------
let verbs = [];
const apiPath = P('game', 'src', 'harness', 'api.js');
if (existsSync(apiPath)) {
  const src = readFileSync(apiPath, 'utf8');
  verbs = [...new Set([...src.matchAll(/^\s{2,4}([a-zA-Z_$][\w$]*)\s*(?:\(|:\s*(?:async\s*)?\()/gm)].map(m => m[1]))]
    .filter(v => !/^(if|for|while|switch|catch|return|function|constructor)$/.test(v)).sort();
}

// ---- render --------------------------------------------------------------------------------
const stamp = await execish('git rev-parse --short HEAD').catch(() => 'unknown');
async function execish(cmd) {
  const { execSync } = await import('node:child_process');
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
}

let out = `<!-- GENERATED by tools/gen-index.mjs. Do not edit; your changes will be overwritten. -->
# The index

**Read this before you go looking for anything.** It is regenerated from the tree on every commit,
so it cannot drift. Generated at \`${stamp}\`: ${toolFiles.length} tools, ${items.length} reference
items, ${active.length} pieces in flight.

Its purpose is to stop ${active.length}+ concurrent agents each paying separately to discover the
same things — and to stop a second copy of a tool being written by someone who could not find the
first. **If what you need is not here, that is a finding: say so in your report.**

## The gates, and what each one actually asserts

Run these; do not invent your own equivalents.

| command | asserts |
|---|---|
${gates.map(([c, w]) => `| \`${c}\` | ${w} |`).join('\n')}

\`tools/boot-check.mjs\` is a forwarding shim; the real file is \`tools/harness/boot-check.mjs\`.
Both work. Note that \`node … 2>&1 | tail -1 ; echo exit=$?\` reports the **pipe's** exit code, so
a check that never ran can read as one that passed.

## CI health — read this before re-deriving it

The \`corpus gate\` workflow has one step that is allowed to be red, and it is telling the truth
when it is. Two write-ups own it; **read them rather than re-running the whole triage:**

| what | where |
|---|---|
| why the gate was red for eight days across 1222 runs, and the rulings | \`reports/ci-triage/TRIAGE-20260814.md\` |
| the evidence recovery that took fresh-checkout verdict FAIL from **54 to 9** | \`reports/ci-triage/EVIDENCE-RECOVERY-20260814.md\` |
| the document-type split, **9 to 8**, and what the last 8 are owed | \`reports/ci-triage/DOCTYPE-20260814.md\` |

**\`corpus/90-verdicts/\` holds two document types and they are not interchangeable.** A build
critic files a \`critic-verdict\` (\`corpus/00-doctrine/verdict.schema.json\`); a blind judge files a
\`blind-judgement\` (\`corpus/00-doctrine/blind-judgement.schema.json\`) — no \`artifacts[]\`, no
\`arbitration\`, no scored \`reference_items[]\`, because it answers a masked pack's question and has
no build in front of it. **Write \`"document_type"\` in your file.** Omit it and the validator falls
back to the stricter critic-verdict contract, which is deliberate: forgetting the field can never
buy leniency. \`"schema": "elder-souls/verdict@1"\` is RETIRED and is refused — four documents
claimed it and no two share a layout. A judge that deliberately did **not** read the item its pack
serves says so with \`reference_items[].not_read: { reason, why }\` and carries no score for it; a
critic that could not measure an item says \`measured: "unmeasurable"\` with \`score_0_10: 0\`
instead, and may not use \`not_read\` at all.

The remaining 8 are named, owned content defects, not plumbing — see the third report §5 and
\`orchestration/NEXT-DISPATCH.md\`. **A verdict citation must resolve in a fresh clone**: anything
you write under \`reports/\` is gitignored, so run \`node tools/verdict-evidence.mjs --recover\`
before you file a verdict that cites it. Evidence over 1 MiB is pinned, not committed.

This block lives in \`tools/gen-index.mjs\`, not in \`INDEX.md\`. The triage put its pointer straight
into \`INDEX.md\` and the next \`gen-index\` run erased it — which is the same staleness Owner
Directive #7 is about. Anything that must survive regeneration belongs in the generator.

## Numbers you must not read off a status file

A status file records what was true at the commit it was written at. Twice in one day an
orchestrator handed an agent a soul total it had read off one (**16,335**, then **21,664**) and both
were stale — the second by a third. **Ask the tree, it costs one command:**

| question | the one line that answers it |
|---|---|
| what is the placed world worth in souls, and what level does the crossing buy? | \`node tools/check-souls-world.mjs --totals\` |
| have the two soul ledgers drifted apart again? | same command — it exits non-zero and names the stale one |
| what is one enemy worth? | \`node -p "require('./game/data/combat/enemies/inf_trash.json').souls"\` — the statblock is the ledger a kill actually reads (\`game/src/sim/souls.js\` \`awardFor()\`) |

\`game/data/world/population-posts.json\` is a **generated cache**, not a source. Never hand-edit it;
re-run \`node tools/world/build-population.mjs --write\`.

## The harness

\`window.__HARNESS\` — ${verbs.length} verbs. \`window.__ENGINE\` is also published by \`main.js\`,
which is a **back door**: capability prohibitions installed on the harness do not cover it.

${verbs.length ? '`' + verbs.join('`, `') + '`' : '_(api.js not found)_'}

## Tools, by area

${[...byArea.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([area, list]) => `
### \`tools/${area === '(top level)' ? '' : area + '/'}\` — ${list.length}

${list.map(t => `- \`${t.path}\`${t.purpose ? ` — ${t.purpose}` : ' — **no header comment**'}`).join('\n')}`).join('\n')}

${undocumented.length ? `\n> **${undocumented.length} tools have no header comment**, so nobody can tell what they do without\n> reading them. That is a rediscovery tax paid by every agent that meets one.\n` : ''}

## Reference items

The \`judges:\` front-matter is authoritative for which paths an item scores. **Never assemble an
item set by listing a directory** — a piece was once scored against a set built that way and seven
of its twelve items judged none of its declared paths.

| item | judges | file |
|---|---|---|
${items.map(i => `| **${i.id}** ${i.title} | ${i.judges || '—'} | \`${i.path}\` |`).join('\n')}

## In flight right now

Read the status file of anything near your files **before you write**, and record your own as you
go. Three container restarts in one day killed every agent each time; a status file written as you
work is the difference between resuming and starting over.

${active.length ? `| piece | state | next step | files |
|---|---|---|---|
${active.map(l => `| \`${l.task}\` | ${l.state} | ${l.next} | ${l.files.map(f => `\`${f}\``).join(' ') || '—'} |`).join('\n')}` : '_nothing in flight_'}
`;

writeFileSync(P('orchestration', 'INDEX.md'), out);
console.log(`gen-index: ${toolFiles.length} tools (${undocumented.length} undocumented), ${items.length} items, ${active.length} in flight -> orchestration/INDEX.md`);
