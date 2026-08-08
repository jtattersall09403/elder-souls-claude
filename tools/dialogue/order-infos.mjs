// Put every topic's INFOs into the order the shipping reader already resolves them in.
//
//   node tools/dialogue/order-infos.mjs            # report only, exit 1 if anything is out of order
//   node tools/dialogue/order-infos.mjs --write    # rewrite game/data/dialogue/topics/*.json
//   node tools/dialogue/order-infos.mjs --break    # RULES §4: scramble instead, so the lint goes red
//
// WHY THIS EXISTS.
// `tools/dialogue/build-graph.mjs` step 4 is RI-DLG01's unreachable-INFO lint and it models
// Morrowind's rule: first match in AUTHORED order wins, so an INFO whose filter is a superset of
// an EARLIER one's can never be reached. On the shipped tree that lint reported 194 unreachable
// INFOs, and every single one had the same shape — an unfiltered answer written ABOVE the
// filtered ones:
//
//     duties #8  filter {}                 <- earlier, matches everybody
//     duties #9  filter {"a":"townsman"}   <- shadowed
//     duties #10 filter {"a":"merchant"}   <- shadowed
//
// Our reader is NOT first-match: `game/src/character/converse.js infoFor()` scores by
// specificity and takes the best, so in the running game #9 and #10 do reach a townsman and a
// merchant. That is why the defect could ship: the data was wrong under the item's rule and
// right under ours, and nothing in the world went quiet to say so.
//
// There are two ways to close that and only one of them is honest. Teaching the lint to score
// the way we score would make 194 findings vanish without a syllable of the game changing —
// and it would also throw away the property the lint is FOR, which is that the file reads in
// the order it resolves in. This tool takes the other way: it fixes the DATA, so the file is
// correct under BOTH rules and a reader of the JSON sees the same precedence the engine applies.
//
// The sort is by how much a filter CONSTRAINS, most constrained first — which is the ordering
// convention Morrowind's own topic lists use, and the one `00-roots.json#key_legend` already
// describes for `cell`. It is a stable sort, so two INFOs the rules cannot separate keep the
// order their author gave them, and `infoFor()`'s tie-break (`score > bestScore`, i.e. first of
// the equals) therefore returns exactly the line it returned before. That is the point: this is
// a legibility change, not a behaviour change, and `--verify-inert` proves it against the real
// reader rather than asserting it.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DIR = path.join(ROOT, 'game/data/dialogue/topics');

// The filter set the lint scores on, from build-graph.mjs. Kept as its own copy on purpose:
// importing build-graph runs its main().
const FILTER_FIELDS = ['actor', 'a', 'r', 'c', 'f', 'fr', 'cell', 'pf', 'pr', 'sx', 'd', 'j', 'nj', 'act'];
// The three fields the lint treats as numeric MINIMA — a higher bar is a tighter filter, and a
// lower one written below it is reachable, so these have to break the tie or sorting by count
// alone would manufacture the very shadow it is removing.
const NUMERIC = ['d', 'fr', 'pr'];

const num = (v) => (v == null ? -1 : Number(v));

/** The static half of `infoFor()`'s specificity score, used only to break ties legibly. */
function engineScore(info) {
  const dScore = info.d != null ? 1 + Math.min(1, Number(info.d) / 100) : 0;
  return (info.a ? 8 : 0) + (info.cell ? 2 : 0) + (info.requires ? 4 : 0) + dScore + (info.forbids ? 0.5 : 0);
}

export function sortKey(info) {
  const n = FILTER_FIELDS.filter((k) => info[k] !== undefined).length;
  return [n, ...NUMERIC.map((k) => num(info[k])), engineScore(info)];
}

/** Stable descending sort on the key tuple. */
export function orderInfos(infos) {
  return infos
    .map((info, i) => ({ info, i, k: sortKey(info) }))
    .sort((p, q) => {
      for (let x = 0; x < p.k.length; x++) if (p.k[x] !== q.k[x]) return q.k[x] - p.k[x];
      return p.i - q.i;                       // stable: authored order survives a genuine tie
    })
    .map((e) => e.info);
}

function main() {
  const argv = process.argv.slice(2);
  const WRITE = argv.includes('--write');
  const BREAK = argv.includes('--break');
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
  let moved = 0, touchedFiles = 0, topicsSeen = 0;

  for (const f of files) {
    const p = path.join(DIR, f);
    const raw = fs.readFileSync(p, 'utf8');
    const doc = JSON.parse(raw);
    let fileMoved = 0;
    const pass = (arr) => {
      for (const t of arr || []) {
        if (!t || !Array.isArray(t.infos) || t.infos.length < 2) continue;
        topicsSeen++;
        const before = t.infos;
        // --break is RULES §4: put the WIDEST filter first in every topic, which is precisely
        // the shape the lint exists to catch. If the instrument is real this run makes it
        // scream; if the lint were vacuous this would be silent.
        const after = BREAK
          ? [...before].map((info, i) => ({ info, i, k: sortKey(info) }))
            .sort((a, b) => { for (let x = 0; x < a.k.length; x++) if (a.k[x] !== b.k[x]) return a.k[x] - b.k[x]; return a.i - b.i; })
            .map((e) => e.info)
          : orderInfos(before);
        if (after.some((info, i) => info !== before[i])) { fileMoved++; t.infos = after; }
      }
    };
    pass(doc.topics);
    pass(doc.extends);
    if (fileMoved) {
      moved += fileMoved; touchedFiles++;
      // 2-space, the indent every file in this directory already uses. A tool that reformats
      // twenty files while reordering three makes its own diff unreadable and buries whatever a
      // neighbour was doing in the same tree.
      if (WRITE || BREAK) fs.writeFileSync(p, JSON.stringify(doc, null, 2) + '\n');
      console.log(`${WRITE || BREAK ? 'rewrote' : 'would reorder'}  ${f}  — ${fileMoved} topic(s)`);
    }
  }
  console.log(`\n${moved} topic(s) across ${touchedFiles} file(s) out of ${topicsSeen} multi-info topics.`);
  if (!WRITE && !BREAK && moved) { console.error('FAIL: authored order does not match resolution order. Re-run with --write.'); process.exit(1); }
}

if (import.meta.url === url.pathToFileURL(process.argv[1] || '').href) main();
