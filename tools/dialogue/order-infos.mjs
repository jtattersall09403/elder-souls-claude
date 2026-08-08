// Put every topic's INFOs into the order the reader resolves them in — which, since ARBITRATION
// S37, is simply the order they are written in.
//
//   node tools/dialogue/order-infos.mjs                 # report only, exit 1 if anything is out of order
//   node tools/dialogue/order-infos.mjs --write         # rewrite game/data/dialogue/topics/*.json
//   node tools/dialogue/order-infos.mjs --break         # RULES §4: scramble instead, so the lint goes red
//   node tools/dialogue/order-infos.mjs --verify-inert  # how many ANSWERS this reordering moves,
//                                                       # asked of the live reader
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
// WHAT CHANGED, AND IT CHANGES WHAT THIS TOOL IS.
// This header used to continue: *"Our reader is NOT first-match: `infoFor()` scores by specificity
// and takes the best, so in the running game #9 and #10 do reach a townsman and a merchant."*
// That was true when it was written and it is false now. **ARBITRATION S37 ruled that RI-DLG01 §A
// governs and the engine yielded**: `infoFor()` takes the first admissible INFO in authored order
// and does not score anything. So #9 and #10 above are now genuinely dead text, the lint was right
// all along, and this tool stopped being a cosmetic pass over the JSON.
//
// Three consequences, and the second one is the one to read.
//
//   1. The sort is unchanged and still legitimate. S37 forbids the score in the READER; it
//      explicitly permits it here ("`order-infos.mjs` may keep sorting files by them; S37 forbids
//      the score in the reader, not in the tool that prepares the corpus for it"). `engineScore()`
//      below survives as a legibility tie-break with no authority over anything.
//
//   2. **`--verify-inert` did not exist.** This header cited it as proof that reordering changes
//      no answers — *"proves it against the real reader rather than asserting it"* — and there was
//      no such flag anywhere in this file. The claim it was supposed to support, the W1-17 verdict's
//      "0 of 75,151 answers changed", was therefore never produced by the thing named as producing
//      it. It exists now, and it calls `infoFor()`.
//
//      It was also, under the old rule, **arithmetically incapable of returning anything else**.
//      S37 measured it: under the scoring reader authored order decided 268,800 of 1,460,324,864
//      resolutions — 0.018%, in exactly one topic — so a tool that only reorders INFOs could not
//      have moved more than that one topic's answers whatever it did. "0 answers changed" was very
//      nearly forced before the tool ran, which makes it arithmetic and not evidence (RULES 6).
//      Under S37 reversing authored order moves 18.242% of resolutions across 64 topics, so the
//      same measurement can finally come out either way. That is what `--verify-inert --break`
//      is for: the control has to be watched moving, or it is not a control.
//
//   3. The corpus is already at this tool's fixed point — an earlier `--write` sorted it — so a
//      plain run reports 0 of 353 multi-info topics today. That is the tool having already done
//      its job, not the tool doing nothing.
//
// The sort is by how much a filter CONSTRAINS, most constrained first — the ordering convention
// Morrowind's own topic lists use, and the one `00-roots.json#key_legend` already describes for
// `cell`. It is a stable sort, so two INFOs the rules cannot separate keep the order their author
// gave them. Under S37 that stability is load-bearing rather than incidental: a reorder here is a
// change to what people say.
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

/**
 * `--verify-inert` — how many ANSWERS does this reordering move? Asked of the reader that runs.
 *
 * The point of the flag is that since ARBITRATION S37 it can answer something other than zero.
 * With `--break` it reorders the wrong way on purpose and the number MUST move; if it does not,
 * the measurement is not reading the corpus and its zero means nothing (RULES 6).
 */
async function verifyInert(scramble) {
  const { buildTopicIndex, infoFor } = await import('../../game/src/character/converse.js');
  const { loadNpcs } = await import('./answer-census.mjs');
  const { topicKey } = await import('../../game/src/core/topics.js');
  const rr = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/progression/race-reactions.json'), 'utf8'));

  const read = () => fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
    .sort().map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
  const authored = read();
  const reordered = read();
  let movedTopics = 0;
  for (const doc of reordered) for (const arr of [doc.topics, doc.extends]) {
    for (const t of arr || []) {
      if (!t || !Array.isArray(t.infos) || t.infos.length < 2) continue;
      const before = t.infos;
      const after = scramble
        ? [...before].map((info, i) => ({ info, i, k: sortKey(info) }))
          .sort((a, b) => { for (let x = 0; x < a.k.length; x++) if (a.k[x] !== b.k[x]) return a.k[x] - b.k[x]; return a.i - b.i; })
          .map((e) => e.info)
        : orderInfos(before);
      if (after.some((info, i) => info !== before[i])) { movedTopics++; t.infos = after; }
    }
  }
  const npcs = loadNpcs();
  // one speaker per distinct (actor, place) — the two speaker-side filter fields — and a spread of
  // players across race and the authored disposition bands.
  const seen = new Set(), speakers = [];
  for (const n of npcs) { const k = `${n.actor || '-'}|${n.settlement || n.cell || '-'}`; if (!seen.has(k)) { seen.add(k); speakers.push(n); } }
  const players = [];
  for (const race of rr.races) for (const disposition of [0, 30, 60, 90]) {
    players.push({ race, upbringing: rr.upbringings[0].id, disposition, knows: new Set() });
  }
  const idxA = buildTopicIndex(authored), idxB = buildTopicIndex(reordered);
  const ids = [...new Set(authored.flatMap((d) => (d.topics || []).filter((t) => t && typeof t.id === 'string').map((t) => t.id)))].sort();
  let compared = 0, changed = 0; const topics = new Set();
  for (const tid of ids) {
    if (!idxA.get(topicKey(tid))) continue;
    for (const npc of speakers) for (const p of players) {
      const a = infoFor(idxA, tid, npc, p), b = infoFor(idxB, tid, npc, p);
      compared++;
      if ((a ? a.text : null) !== (b ? b.text : null)) { changed++; topics.add(tid); }
    }
  }
  console.log(`--verify-inert${scramble ? ' --break' : ''}: reordering moved ${movedTopics} topic record(s)`);
  console.log(`  ${changed.toLocaleString()} of ${compared.toLocaleString()} answers change, across ${topics.size} topic(s), through the LIVE infoFor()`);
  if (scramble) {
    if (changed === 0) { console.error('  FAIL: the --break arm changed no answers. This measurement is not reading the corpus.'); process.exit(2); }
    console.log('  OK — the control moves, so a zero from the unbroken arm is evidence rather than arithmetic.');
    return;
  }
  if (changed === 0) console.log('  the corpus is already in resolution order; this reordering is inert.');
  else console.log(`  NOT INERT — this reordering changes what ${topics.size} topic(s) say. Under S37 that is a content change.`);
}

async function main() {
  const argv = process.argv.slice(2);
  const WRITE = argv.includes('--write');
  const BREAK = argv.includes('--break');
  if (argv.includes('--verify-inert')) { await verifyInert(BREAK); return; }
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
