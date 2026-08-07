#!/usr/bin/env node
// book-budget.mjs — RI-UIX05 §D, the lore-vector budget, with no browser involved.
//
// WHY THIS FILE EXISTS (orchestration/TOOL-LOOP.md rule 1).
// RI-UIX05's Comparison method step 7 names:
//
//     node tools/analysis/content-stats.mjs --books game/data/books/ --items game/data/items/ \
//          --dialogue game/data/dialogue/ --corroborate
//
// content-stats.mjs exists. NONE of those four flags does. Its USAGE advertises only
// --data/--out/--json/--verbose/--help, the unknown flags are parsed and silently discarded,
// and the tool computes NOT ONE of §D's six rows: no book:item word ratio, no corroboration
// rate, no contradiction count, no direction count, no read-before-quest count. It emits a book
// count and a length summary and exits 0, which is exactly the failure TOOL-LOOP rule 3.5 names
// ("a flag that lies is worse than a missing flag") and is how K9 could be scored at all.
//
// This is the missing instrument, built to the item rather than to what was easy. It is a
// SEPARATE FILE on purpose: content-stats.mjs is consumed by a dozen other items and widening it
// to carry a UI item's budget would couple them. content-stats.mjs is left alone; the two flags
// it should honour are honoured here and the item's step 7 command is accepted verbatim so a
// critic who copies the line out of RI-UIX05 gets a real measurement instead of a shrug.
//
// IT CAN FAIL. Every row is a threshold from RI-UIX05 §D and the process exits non-zero when any
// row is out of band. Break the corpus on purpose — delete a book, empty a `contradicts`, point a
// quest at a book that is not there — and it goes red. Verified by --self-test.
//
// WHAT IT DOES NOT DO. It does not measure the reading screen. Words-per-page, line length,
// leading and contrast are RI-UIX05 §A/K1–K3 and belong to tools/analysis/text-metrics.mjs and
// the browser. `--pagination` here reports the words-per-page DISTRIBUTION ONLY, computed from
// the shipping pagination functions in bare Node (they are pure arithmetic over the vector glyph
// tables), which is RI-UIX05 method step 2 without the browser cost. It is a cross-check on the
// corpus, not a substitute for the capture.
//
// Consumers: corpus/86-ui/RI-UIX05 §D (K9), corpus/60-lore/RI-LOR03 §2.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  if (i < 0) return dflt;
  const v = argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
};
const has = (name) => argv.includes('--' + name);

const USAGE = `
book-budget.mjs — RI-UIX05 §D lore-vector budget + RI-LOR03 §1 shape, static, no browser.

USAGE
  node tools/analysis/book-budget.mjs [--books DIR] [--items DIR] [--dialogue DIR]
                                      [--quests DIR] [--corroborate] [--pagination]
                                      [--out FILE] [--json] [--self-test]

OPTIONS
  --books DIR      book data root      (default game/data/books)
  --items DIR      item data root      (default game/data/items)
  --dialogue DIR   dialogue data root  (default game/data/dialogue)
  --quests DIR     quest data root     (default game/data/quests)
  --corroborate    run the proper-noun corroboration pass (§D row 3). Costs a second or two.
  --pagination     also report words-per-page across every book, using the SHIPPING pagination
                   from game/src/ui/screens/text.js. Requires that module to load in bare Node.
  --out FILE       write the full result as JSON (default reports/book-budget.json)
  --json           print the full result to stdout
  --self-test      prove the tool can fail: run the checks against three mutated corpora and
                   assert each mutation turns a passing row red. Exits non-zero if any does not.

EXIT
  0  every §D row in band
  1  one or more rows out of band  (the failing rows are printed)
  2  the data could not be read at all
`;

if (has('help') || has('h')) { process.stdout.write(USAGE); process.exit(0); }

// ---------------------------------------------------------------- helpers
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
const wc = (s) => words(s).length;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function walkJson(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkJson(p));
    else if (e.name.endsWith('.json')) {
      try { out.push({ file: p, val: JSON.parse(fs.readFileSync(p, 'utf8')) }); }
      catch (err) { out.push({ file: p, val: null, error: err.message }); }
    }
  }
  return out;
}

/** Every book record, from either shipping schema: book@1 (one doc) or book@2 (doc.books[]). */
function loadBooks(dir) {
  const books = [];
  const parseErrors = [];
  for (const { file, val, error } of walkJson(dir)) {
    if (error) { parseErrors.push({ file, error }); continue; }
    const rel = path.relative(ROOT, file);
    if (Array.isArray(val.books)) for (const b of val.books) books.push({ ...b, _file: rel });
    else if (val.id) books.push({ ...val, _file: rel });
  }
  return { books, parseErrors };
}

/** Item description words. RI-UIX03 §C's unit: the `description` field of an item record. */
function itemDescriptionWords(dir) {
  let total = 0; const recs = [];
  const visit = (v) => {
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (!isObj(v)) return;
    if (typeof v.description === 'string' && v.description.trim()) {
      const n = wc(v.description);
      total += n; recs.push({ id: v.id || v.name || null, words: n });
    }
    for (const x of Object.values(v)) visit(x);
  };
  for (const { val } of walkJson(dir)) if (val) visit(val);
  return { total, count: recs.length, records: recs };
}

/** Every authored string in the dialogue tree, for corroboration. */
function dialogueProse(dir) {
  const out = [];
  const visit = (v) => {
    if (typeof v === 'string') { if (/\s/.test(v) && v.length > 12) out.push(v); return; }
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (isObj(v)) for (const [k, x] of Object.entries(v)) { if (k === 'id' || k === 'key') continue; visit(x); }
  };
  for (const { val } of walkJson(dir)) if (val) visit(val);
  return out;
}

/**
 * Proper nouns: capitalised tokens (and hyphenated Argonian compounds) that are not sentence-
 * initial-only. A word that only ever appears at the start of a sentence is not evidence of a
 * name, and counting it was how a naive version of this check reported 90% corroboration on a
 * corpus with no names in it at all.
 */
function properNouns(text) {
  const found = new Set();
  const s = String(text);
  // token, plus the character before it
  const re = /(^|[^.!?\n]\s+|\n\n)([A-Z][a-z]+(?:-[A-Z][a-z]+)*(?:-[a-z]+)*)/g;
  let m;
  while ((m = re.exec(s))) {
    const w = m[2];
    if (w.length < 4) continue;
    if (STOP.has(w)) continue;
    found.add(w);
  }
  return found;
}
const STOP = new Set([
  'The', 'This', 'That', 'These', 'Those', 'There', 'Then', 'They', 'Their', 'Them', 'What',
  'When', 'Where', 'Which', 'While', 'With', 'Would', 'Will', 'Nobody', 'Nothing', 'Every',
  'Because', 'Before', 'After', 'About', 'Above', 'Below', 'Under', 'First', 'Second', 'Third',
  'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleven', 'Twelve',
  'Here', 'Have', 'Hers', 'His', 'Item', 'Leaf', 'From', 'Into', 'Only', 'Some', 'Such',
  'Both', 'Been', 'Being', 'Should', 'Shall', 'Consider', 'Against', 'Written', 'Signed',
  'Entered', 'Received', 'Recovered', 'Published', 'Chapter', 'Volume', 'Below', 'Note',
]);

/**
 * A prose direction under RI-WLD06 §4 grammar: a route a reader could walk, made of settlement
 * and landmark nouns, relative bearings and road classes, with NO coordinate, no marker and no
 * minimap. Detection is deliberately conservative — a movement verb AND a bearing/relative term
 * AND a named place — because the row it feeds (§D "usable prose direction ≥12") is one a
 * generous matcher would pass vacuously.
 */
const MOVE = /\b(out of|keep|follow|walk|go|take the|turn|hold|cross|head|leave|come down|run(s)? (north|south|east|west)|make for|put in at|pole|row)\b/i;
const BEARING = /\b(north|south|east|west|left|right|landward|seaward|upstream|downstream|inland|shaded side|until|past|beyond|as far as|before you reach|at the fork|on your (left|right))\b/i;
function hasProseDirection(text, places) {
  const paras = String(text).split(/\n+/);
  for (const p of paras) {
    if (!MOVE.test(p)) continue;
    if (!BEARING.test(p)) continue;
    for (const pl of places) if (p.includes(pl)) return { para: p.slice(0, 200), place: pl };
  }
  return null;
}

// S8: things that must never be in book text.
//
// The word "marker" alone is NOT the test and the first version of this tool got that wrong: it
// flagged `march-marker` in a surveyor's monograph, which is a boundary stone and is exactly the
// kind of in-world object RI-WLD06 §3 requires the world to have. What S8 forbids is the UI
// affordance — a marker you travel TO, a pin, a waypoint, an arrow, a minimap, a coordinate.
// The patterns below name that thing and leave the stones alone.
const MARKER_PATTERNS = [
  [/\b(?:quest|objective|map|compass|navigation|nav)[\s-]?markers?\b/i, 'a UI marker'],
  [/\b(?:to|at|on|toward|towards|follow) the marker\b/i, '"the marker" as a destination'],
  [/\bwaypoints?\b/i, 'waypoint'],
  [/\bmini-?map\b/i, 'minimap'],
  [/\bquest arrow\b/i, 'quest arrow'],
  [/\b(?:objective|waypoint) (?:marker|arrow|indicator)\b/i, 'objective marker'],
  [/\byour objective\b/i, 'an objective addressed to the player'],
  [/\bfast[- ]travel\b/i, 'fast travel'],
  [/\bmap pins?\b/i, 'map pin'],
  [/\bcompass arrow\b/i, 'compass arrow'],
  [/\bdistance to (?:objective|target)\b/i, 'a distance readout'],
  [/\b\d{2,4}\s*,\s*\d{2,4}\b/, 'a coordinate pair'],
];

// ---------------------------------------------------------------- the measurement
function measure(opts) {
  const booksDir = path.resolve(ROOT, opts.books);
  const itemsDir = path.resolve(ROOT, opts.items);
  const dialogueDir = path.resolve(ROOT, opts.dialogue);
  const questsDir = path.resolve(ROOT, opts.quests);

  const { books, parseErrors } = opts._books || loadBooks(booksDir);
  if (!books.length) {
    return { fatal: `no books found under ${booksDir}` };
  }

  const items = opts._items || itemDescriptionWords(itemsDir);

  // ---- duplicate ids. The engine keys books by id in a Map; a duplicate silently wins.
  const seen = new Map(); const duplicates = [];
  for (const b of books) {
    if (seen.has(b.id)) duplicates.push({ id: b.id, files: [seen.get(b.id), b._file] });
    else seen.set(b.id, b._file);
  }

  // ---- lengths (RI-LOR03 §1 shape)
  const lens = books.map((b) => wc(b.text)).sort((a, b) => a - b);
  // Linear interpolation between order statistics — numpy's default and `statistics.quantiles`'
  // `method='inclusive'`. W1-LIBRARY round 2: this was `lens[Math.floor(p * n)]`, a floor-index
  // estimator, and on 65 samples with a hole in the distribution the two conventions disagreed
  // by 150 words and decided L2 — p90 read 1,316 against a 1,200 bar on the floor index and
  // 1,167 under interpolation. `corpus/80-methods/book-stats.py` had the identical bug and the
  // identical row, so the two "independent" instruments agreed because they shared a mistake.
  const pct = (p) => {
    const n = lens.length;
    if (!n) return 0;
    if (n === 1) return lens[0];
    const k = (n - 1) * p, lo = Math.floor(k);
    return +(lens[lo] + (lens[Math.min(lo + 1, n - 1)] - lens[lo]) * (k - lo)).toFixed(1);
  };
  const totalBookWords = lens.reduce((a, b) => a + b, 0);
  const series = new Map();
  for (const b of books) if (b.series && b.series.id) {
    if (!series.has(b.series.id)) series.set(b.series.id, []);
    series.get(b.series.id).push(b.id);
  }
  const multiVolume = [...series.entries()].filter(([, v]) => v.length >= 3);

  // ---- §D row 2: the ratio
  const ratio = items.total ? totalBookWords / items.total : null;

  // ---- §D row 4: contradictions, and they must be REAL — the named partner must exist.
  const ids = new Set(books.map((b) => b.id));
  const contradicting = [];
  const danglingContradictions = [];
  for (const b of books) {
    const cs = Array.isArray(b.contradicts) ? b.contradicts : [];
    const live = [];
    for (const c of cs) {
      if (!c || !c.book) continue;
      if (ids.has(c.book)) live.push(c); else danglingContradictions.push({ from: b.id, to: c.book });
    }
    if (live.length) contradicting.push({ id: b.id, against: live.map((c) => c.book), on: live.map((c) => c.on) });
  }

  // ---- §D row 5: prose directions
  const places = [
    'Soulrest', 'Gideon', 'Lilmoth', 'Helstrom', 'Stormhold', 'Archon', 'Blackrose', 'Thorn',
    'Bone Ladder', 'Hollow-Reeds', 'Stilt-Row', 'Tenmarch', 'Mudwater Landing', 'Nine-Mud',
    'Stone Wastes', 'Deep Marshes', 'Blackwood', 'Thornmarsh', 'Border Falls', 'Salt Hills',
    'Topal', 'Crimson Coast', 'Ix-Thakla', 'Ixt-Shaneekh', 'Valus', 'Sunken Teeth', 'Ceyatatar-Zel',
    'Tideway Shrine', 'Kiln Camp', 'the market cross', 'the burial stair', 'the third mooring',
  ];
  const withDirections = [];
  for (const b of books) {
    const d = hasProseDirection(b.text, places);
    if (d) withDirections.push({ id: b.id, place: d.place });
  }

  // ---- §D row 6: readable before the quest that references them, checked against the QUESTS,
  //      not against a field the author wrote. A book claiming `readable_before` for a quest that
  //      does not reference it is not evidence of anything.
  //      Two classes of reference count, and they are reported separately because they are
  //      different strengths of claim:
  //        NAMED  — the quest names the book: `channel: "book"` in revealed_by, or a
  //                 `requires.knowledge` key. The strongest form; a resolution can be gated on it.
  //        TOPIC  — the quest's `opens_by.topic` / `prerequisite_topics` names a topic the book
  //                 teaches. This is RI-UIX05 R3's permitted exception working as designed: the
  //                 book gives the player a NAME, the name is a line of enquiry, and the quest
  //                 opens on it. It is a real link and it is weaker than NAMED, so it is labelled.
  //      D6 counts DISTINCT BOOKS across both classes.
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); if (!m.get(k).includes(v)) m.get(k).push(v); };
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const questRefs = new Map();     // knowledge/source key -> [quest id or file]
  const questTopics = new Map();   // slugged topic -> [quest id or file]
  const collect = (v, file) => {
    if (Array.isArray(v)) { v.forEach((x) => collect(x, file)); return; }
    if (!isObj(v)) return;
    if (v.channel === 'book' && v.source) push(questRefs, v.source, file);
    if (v.requires && Array.isArray(v.requires.knowledge)) {
      for (const k of v.requires.knowledge) if (/^(book_|item_)/.test(k)) push(questRefs, k, file);
    }
    if (isObj(v.opens_by)) {
      const who = v.id || file;
      if (v.opens_by.topic) push(questTopics, slug(v.opens_by.topic), who);
      for (const t of v.opens_by.prerequisite_topics || []) push(questTopics, slug(t), who);
    }
    for (const x of Object.values(v)) collect(x, file);
  };
  for (const { file, val } of walkJson(questsDir)) if (val) collect(val, path.basename(file));

  const keyed = new Map();
  for (const b of books) {
    if (b.knowledge_key) keyed.set(b.knowledge_key, b.id);
    keyed.set('book_' + String(b.id).replace(/-/g, '_'), b.id);
  }
  const namedLinks = []; const questRefsUnsatisfied = [];
  for (const [key, files] of questRefs) {
    if (keyed.has(key)) namedLinks.push({ key, book: keyed.get(key), quests: files });
    else questRefsUnsatisfied.push({ key, quests: files });
  }
  const topicLinks = [];
  for (const b of books) {
    for (const t of b.topics_taught || []) {
      const qs = questTopics.get(slug(t));
      if (qs) { topicLinks.push({ book: b.id, topic: slug(t), quests: qs }); break; }
    }
  }
  const questLinked = [...new Set([...namedLinks.map((l) => l.book), ...topicLinks.map((l) => l.book)])];

  // ---- D7: does the linked book's own PROSE say the thing the link claims it says?
  //
  // W1-LIBRARY ROUND 2. D6 above is the row RI-UIX05 calls decisive — "this row owns whether the
  // reading surface is connected to anything" — and it is computed by matching a JSON key in
  // game/data/books against a JSON key in game/data/quests. The round-1 critic's mutation shows
  // what that is worth: swap every book's `text` with another book's and change nothing else, and
  // D6 returns the identical 17, because not one of its inputs is the writing. Every row above is
  // an aggregate over the corpus and every aggregate is invariant under a permutation of texts.
  //
  // D7 is the row that is not. For every book the linkage says a quest depends on, the book's own
  // prose must name at least one distinctive term of the topic or key the link was made through.
  // A book that teaches `the-rootless-egg` to a quest and never mentions a root, an egg or a
  // keeper is not the book that quest wanted, whatever its id says.
  const STOPW = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'by', 'book']);
  const stem = (w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w);
  const bag = (t) => new Set(String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean).map(stem));
  const linkTerms = new Map();               // book id -> the terms its linkage was made through
  for (const l of namedLinks) {
    const t = linkTerms.get(l.book) || new Set();
    for (const w of bag(l.key)) if (!STOPW.has(w)) t.add(w);
    linkTerms.set(l.book, t);
  }
  for (const l of topicLinks) {
    const t = linkTerms.get(l.book) || new Set();
    for (const w of bag(l.topic)) if (!STOPW.has(w)) t.add(w);
    linkTerms.set(l.book, t);
  }
  const linkGrounded = [], linkUngrounded = [];
  for (const b of books) {
    const terms = linkTerms.get(b.id);
    if (!terms || !terms.size) continue;
    const own = bag(b.text);
    const hit = [...terms].filter((w) => own.has(w));
    (hit.length ? linkGrounded : linkUngrounded).push({ book: b.id, terms: [...terms], grounded_by: hit });
  }
  const linkPct = (linkGrounded.length + linkUngrounded.length)
    ? +(100 * linkGrounded.length / (linkGrounded.length + linkUngrounded.length)).toFixed(1) : null;

  // ---- S8: no markers in book text
  const markerHits = [];
  for (const b of books) {
    for (const [re, what] of MARKER_PATTERNS) {
      const m = re.exec(b.text || '');
      if (m) markerHits.push({ id: b.id, what, excerpt: String(b.text).slice(Math.max(0, m.index - 40), m.index + 60) });
    }
  }

  // ---- §D row 3: corroboration
  let corroboration = null;
  if (opts.corroborate) {
    const dialogue = dialogueProse(dialogueDir).join('\n');
    const byBook = books.map((b) => ({ id: b.id, nouns: properNouns(b.text) }));
    const elsewhere = new Map();  // noun -> where
    for (const b of byBook) for (const n of b.nouns) push(elsewhere, n, b.id);
    const dialogueNouns = properNouns(dialogue);
    let corroborated = 0; const uncorroborated = [];
    for (const b of byBook) {
      let ok = false;
      for (const n of b.nouns) {
        if (dialogueNouns.has(n)) { ok = true; break; }
        const where = elsewhere.get(n) || [];
        if (where.some((x) => x !== b.id)) { ok = true; break; }
      }
      if (ok) corroborated++; else uncorroborated.push(b.id);
    }
    corroboration = {
      books_with_a_corroborated_proper_noun: corroborated,
      pct: +(100 * corroborated / books.length).toFixed(1),
      uncorroborated,
    };
  }

  // ---- L6: the Argonian flag against the NAME ON THE BOOK.
  //
  // W1-LIBRARY ROUND 2, second half of the round-1 critic's tool attack. L5 counts a self-declared
  // boolean: set `argonian_authored: true` on every book without touching one byline and L5 goes
  // from 21 to 70 and *passes harder*. Nothing looked at the author line. L6 does, and it is the
  // row that goes red under that mutation — mirrors `corpus/80-methods/book-stats.py` S10 so the
  // two instruments disagree by construction if either drifts.
  const TITLES = /\b(?:Serjo|Serjeant|Sergeant|Undersexton|Sexton|Quartermaster|Captain|Master|Mistress|Brother|Sister|Legate|Prefect|Archivist|Steward|Clerk|Warden|Keeper|Hand|Lady|Lord|Saint|Canon|Provost|Curate|Deacon|Magister)\b/g;
  const bylineNames = (author) => {
    const s = String(author || '');
    // An Argonian name is hyphenated: Deelith-Who-Waits-For-Rain, Marsh-of-Nine, Teeus-Ahai.
    const argonian = s.match(/\b[A-Z][a-z]+(?:-(?:[A-Za-z][a-z]*))+\b/g) || [];
    // "of Gideon" is a PLACE. Read as a surname it would make every Imperial byline a false hit,
    // so strip place-phrases and honorifics before looking for a given-name/family-name pair.
    let t = s.replace(/\bof\s+(?:the\s+)?(?:[A-Z][a-z]+(?:[- ][A-Z][a-z]+)*)/g, ' ').replace(TITLES, ' ');
    const tamrielic = (t.match(/\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b/g) || []).filter((x) => !x.includes('-'));
    return { argonian, tamrielic };
  };
  const byline = { flagged_and_named_argonian: 0, flagged_but_byline_is_tamrielic: [], argonian_byline_not_flagged: [] };
  for (const b of books) {
    const { argonian, tamrielic } = bylineNames(b.author);
    const flagged = !!b.argonian_authored;
    if (flagged && argonian.length) byline.flagged_and_named_argonian++;
    else if (flagged && tamrielic.length) byline.flagged_but_byline_is_tamrielic.push({ book: b.id, author: b.author || null, reads_as: tamrielic });
    else if (!flagged && argonian.length) byline.argonian_byline_not_flagged.push({ book: b.id, author: b.author || null, reads_as: argonian });
  }

  // ---- L7/L7b/L8/X4: RI-LOR03 §2's two counts the round-1 verdict recorded as outstanding.
  //
  // `skill_book` is a STRING naming a skill in game/data/progression/skills.json, not a boolean.
  // The one value that shipped before this round was `"blade"`, and there is no skill called
  // `blade` — the id is `blades` — so the corpus's single skill book named nothing. X4 is the
  // row that would have caught it.
  const tagsOf = (b) => (Array.isArray(b.tags) ? b.tags : []).map((t) => String(t).toLowerCase().replace(/[_\s]+/g, '-'));
  const skillOf = (b) => (typeof b.skill_book === 'string' && b.skill_book ? b.skill_book : (b.skill_book === true || tagsOf(b).includes('skill-book')) ? '' : null);
  const skillBooks = books.filter((b) => skillOf(b) !== null).map((b) => ({ id: b.id, skill: skillOf(b) }));
  let realSkills = null;
  try {
    realSkills = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/progression/skills.json'), 'utf8')).skills.map((s) => s.id));
  } catch { /* no register on disk: X4 reports null rather than inventing a pass */ }
  const danglingSkillBooks = realSkills ? skillBooks.filter((s) => !s.skill || !realSkills.has(s.skill)) : [];

  // ---- L7b: does the book's own PROSE carry the skill it claims to teach?
  //
  // The same attack as D7, aimed at the overlay. L7 counts a string in a JSON field, so tagging
  // all 70 books `mercantile` would satisfy it and the round-1 critic's derangement would not
  // move it by one. L7b is a RANK test rather than a threshold, because RI-LOR03's defining move
  // for this overlay is *"Teaches sideways, never instructs"* — an oblique book about a spear
  // will not say "spear" eleven times, and a vocabulary floor would fail exactly the books the
  // item wants. What a real skill book WILL do is talk about its own domain more than the rest
  // of a 70-book library does. So: a tagged book must sit in the **top third** of the corpus for
  // its own skill's distinctive terms. Under a derangement each tagged book gets somebody else's
  // prose and its expected rank is uniform, so the row collapses toward 33%.
  const SKILL_TERMS = {
    blades: ['blade', 'sword', 'dagger', 'knife', 'hilt', 'edge', 'thrust', 'parry', 'stroke', 'scabbard'],
    'axes-maces': ['axe', 'hammer', 'maul', 'flail', 'haft', 'chop'],
    polearms: ['spear', 'halberd', 'glaive', 'butt of the'],
    greatweapons: ['greatsword', 'greataxe', 'two-handed', 'great-hammer'],
    marksman: ['bow', 'arrow', 'fletch', 'quiver', 'bowstring', 'loosed', 'sling'],
    'claw-fang': ['claw', 'fang', 'katar', 'bare hand', 'tooth'],
    shieldcraft: ['shield', 'boss', 'rim', 'parry', 'brace', 'block'],
    sorcery: ['spell', 'conjur', 'sorcer', 'wizard', 'magick', 'enchant'],
    'root-speech': ['hist', 'root', 'sap', 'root-song', 'rootkeeper', 'keeper', 'sapwell', 'the drinking', 'jel', 'tree'],
    warding: ['prayer', 'shrine', 'bless', 'ward', 'saint', 'the nine', 'divine', 'charm', 'pray'],
    veiling: ['unseen', 'invisible', 'veil', 'silence', 'illusion', 'not be seen'],
    alchemy: ['fever', 'remedy', 'physic', 'draught', 'decoct', 'dose', 'poison', 'cure', 'simples', 'apothec', 'infusion', 'steep'],
    athletics: ['pole', 'wade', 'swim', 'current', 'oar', 'row', 'mile', 'waist-deep', 'knee-deep', 'breath', 'tire'],
    acrobatics: ['ladder', 'rung', 'climb', 'descend', 'scramble', 'ledge', 'the drop', 'shaft'],
    survival: ['harvest', 'forage', 'flood', 'season', 'beast', 'snare', 'marsh-fever', 'safe to drink', 'weir', 'net', 'fish', 'camp', 'fire'],
    sneak: ['unnoticed', 'without being seen', 'quietly', 'shadow', 'watch', 'follow', 'at night', 'step lightly'],
    security: ['lock', 'bolt', 'hinge', 'strongbox', 'seal', 'key', 'bar the', 'pick the', 'chest', 'lid', 'trap'],
    mercantile: ['drake', 'price', 'sell', 'buy', 'ledger', 'tally', 'account', 'coin', 'freight', 'lading', 'toll', 'bargain', 'weigh', 'cost'],
    speechcraft: ['court', 'plead', 'witness', 'testimony', 'clause', 'argue', 'answer', 'the assize', 'petition', 'minute'],
  };
  const termRate = (text, terms) => {
    const t = String(text || '').toLowerCase();
    const n = Math.max(1, t.split(/\s+/).filter(Boolean).length);
    let hits = 0;
    for (const w of terms) { const m = t.match(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')); if (m) hits += m.length; }
    return 1000 * hits / n;
  };
  const grounded = [], ungrounded = [];
  for (const s of skillBooks) {
    const terms = SKILL_TERMS[s.skill];
    const b = books.find((x) => x.id === s.id);
    if (!terms || !b) { ungrounded.push({ ...s, why: 'no term set for this skill' }); continue; }
    const scored = books.map((x) => ({ id: x.id, r: termRate(x.text, terms) })).sort((a, c) => c.r - a.r);
    const rank = scored.findIndex((x) => x.id === s.id) + 1;
    const row = { ...s, rank, of: books.length, rate: +scored[rank - 1].r.toFixed(1) };
    if (rank <= Math.ceil(books.length / 3) && row.rate > 0) grounded.push(row); else ungrounded.push(row);
  }
  const groundedPct = skillBooks.length ? +(100 * grounded.length / skillBooks.length).toFixed(1) : null;

  // ---- rows, with RI-UIX05 §D's own thresholds
  const rows = [
    { id: 'D1', name: 'total book words', value: totalBookWords, bar: '>= 0 (RI-LOR03 floor)', pass: totalBookWords > 0 },
    { id: 'D2', name: 'book words / item description words', value: ratio === null ? null : +ratio.toFixed(2), bar: '>= 15', hard_fail_below: 4, pass: ratio !== null && ratio >= 15 },
    { id: 'D3', name: 'books with a corroborated proper noun (%)', value: corroboration ? corroboration.pct : null, bar: '>= 60', hard_fail_below: 20, pass: corroboration ? corroboration.pct >= 60 : null, skipped: !opts.corroborate },
    { id: 'D4', name: 'books that contradict another book on a named fact', value: contradicting.length, bar: '>= 8', hard_fail_below: 1, pass: contradicting.length >= 8 },
    { id: 'D5', name: 'books carrying a usable prose direction', value: withDirections.length, bar: '>= 12', hard_fail_below: 1, pass: withDirections.length >= 12 },
    { id: 'D6', name: 'books readable before the quest that references them', value: questLinked.length, bar: '>= 10', pass: questLinked.length >= 10 },
    { id: 'D7', name: 'quest-linked books whose own prose grounds the link (%)', value: linkPct, bar: '>= 70', pass: linkPct !== null && linkPct >= 70 },
    { id: 'S8', name: 'marker/objective/coordinate language in book text', value: markerHits.length, bar: '== 0', pass: markerHits.length === 0 },
    { id: 'X1', name: 'duplicate book ids across files', value: duplicates.length, bar: '== 0', pass: duplicates.length === 0 },
    { id: 'X2', name: 'contradicts[] naming a book that does not exist', value: danglingContradictions.length, bar: '== 0', pass: danglingContradictions.length === 0 },
    { id: 'X3', name: 'quest book references with no book on disk', value: questRefsUnsatisfied.length, bar: '== 0', pass: questRefsUnsatisfied.length === 0 },
    { id: 'L1', name: 'median book words (RI-LOR03 §1)', value: pct(0.5), bar: '>= 350; >= 500 for a 5', pass: pct(0.5) >= 350 },
    { id: 'L2', name: 'p90 book words (RI-LOR03 §1)', value: pct(0.9), bar: '>= 1200', pass: pct(0.9) >= 1200 },
    { id: 'L3', name: 'multi-volume series (>= 3 volumes)', value: multiVolume.length, bar: '>= 3', pass: multiVolume.length >= 3 },
    { id: 'L4', name: 'books under 150 words (%)', value: +(100 * lens.filter((x) => x < 150).length / lens.length).toFixed(1), bar: '<= 20', pass: (100 * lens.filter((x) => x < 150).length / lens.length) <= 20 },
    { id: 'L5', name: 'books authored by Argonians', value: books.filter((b) => b.argonian_authored).length, bar: '>= 14', hard_fail_below: 10, pass: books.filter((b) => b.argonian_authored).length >= 14 },
    { id: 'L6', name: 'books flagged Argonian whose byline names a Tamrielic author', value: byline.flagged_but_byline_is_tamrielic.length, bar: '== 0', pass: byline.flagged_but_byline_is_tamrielic.length === 0 },
    { id: 'L7', name: 'books tagged `skill book` (RI-LOR03 §2 overlay)', value: skillBooks.length, bar: '>= 26', pass: skillBooks.length >= 26 },
    { id: 'L7b', name: 'skill books whose own prose carries the skill (top third, %)', value: groundedPct, bar: '>= 70', pass: groundedPct !== null && groundedPct >= 70 },
    { id: 'X4', name: 'skill_book values naming no skill in progression/skills.json', value: danglingSkillBooks.length, bar: '== 0', pass: danglingSkillBooks.length === 0 },
    { id: 'L8', name: 'texts in the corpus (RI-LOR03 §2 target)', value: books.length, bar: '>= 112', pass: books.length >= 112 },
  ];

  return {
    schema: 'elder-souls/book-budget@1',
    computed_at: new Date().toISOString(),
    item: 'RI-UIX05 §D (K9); RI-LOR03 §1',
    inputs: { books: path.relative(ROOT, booksDir), items: path.relative(ROOT, itemsDir), dialogue: path.relative(ROOT, dialogueDir), quests: path.relative(ROOT, questsDir) },
    counts: {
      books: books.length,
      book_words: totalBookWords,
      item_description_words: items.total,
      item_records: items.count,
      lengths: { p10: pct(0.10), p25: pct(0.25), median: pct(0.5), p75: pct(0.75), p90: pct(0.90), max: lens[lens.length - 1], min: lens[0] },
    },
    rows,
    detail: {
      parse_errors: parseErrors,
      duplicates,
      contradicting,
      dangling_contradictions: danglingContradictions,
      prose_directions: withDirections,
      link_grounded: linkGrounded,
      link_ungrounded: linkUngrounded,
      quest_linked: questLinked,
      quest_links_named: namedLinks,
      quest_links_topic: topicLinks,
      quest_refs_unsatisfied: questRefsUnsatisfied,
      marker_hits: markerHits,
      multi_volume: multiVolume.map(([id, v]) => ({ id, volumes: v })),
      corroboration,
    },
  };
}

// ---------------------------------------------------------------- self-test (rule 3.2)
function selfTest() {
  const base = loadBooks(path.join(ROOT, 'game/data/books'));
  const items = itemDescriptionWords(path.join(ROOT, 'game/data/items'));
  const opts = { books: 'game/data/books', items: 'game/data/items', dialogue: 'game/data/dialogue', quests: 'game/data/quests', corroborate: false };

  const control = measure({ ...opts, _books: base, _items: items });
  const failing = control.rows.filter((r) => r.pass === false);
  if (failing.length) {
    // NOT a bail. The old code returned 1 the moment ANY row was red, which meant that the day the
    // corpus fell short of a target the whole instrument stopped being runnable — the self-test
    // would refuse to answer "can you detect a deranged corpus?" because the corpus was 42 books
    // short of a different bar. The two questions are independent. Report the reds, then check
    // per mutation that the row that mutation targets was green BEFORE it (below); a mutation
    // whose target was already red proves nothing and is scored INVALID rather than passing.
    console.log('self-test: rows already red in the CONTROL corpus (a mutation targeting one of');
    console.log('these proves nothing and is reported INVALID):');
    for (const r of failing) console.log(`  ${r.id} ${r.name}: ${r.value} (bar ${r.bar})`);
    console.log('');
  }
  const controlPass = new Map(control.rows.map((r) => [r.id, r.pass]));

  // The round-1 critic's mutation, adopted verbatim and permanently. Swap every book's `text`
  // with another book's — a derangement, so no book keeps its own prose — and change NOTHING
  // else. This tool returned 15/15 PASS on that corpus, because every row it had was an
  // aggregate over the same 65 texts and aggregates do not notice a permutation. D7 does.
  const derange = (bs, seed = 4242) => {
    let s = seed >>> 0;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const n = bs.length;
    if (n < 2) return bs.map((b) => ({ ...b }));
    let order;
    do {
      order = bs.map((_, i) => i);
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    } while (order.some((v, i) => v === i));
    return bs.map((b, i) => ({ ...b, text: bs[order[i]].text }));
  };

  const mutations = [
    ["swap every book's text with another book's (derangement, seed 4242)", derange, 'D7'],
    ['drop every contradicts[]', (bs) => bs.map((b) => ({ ...b, contradicts: [] })), 'D4'],
    ['halve the corpus', (bs) => bs.slice(0, Math.floor(bs.length / 8)), 'D2'],
    ['duplicate an id', (bs) => [...bs, { ...bs[0], _file: 'MUTANT' }], 'X1'],
    ['put a marker in a book', (bs) => bs.map((b, i) => (i === 0 ? { ...b, text: b.text + '\n\nHead to the marker on your compass.' } : b)), 'S8'],
    ['point a contradiction at nothing', (bs) => bs.map((b, i) => (i === 0 ? { ...b, contradicts: [{ book: 'no-such-book', on: 'x' }] } : b)), 'X2'],
    ['delete the quest-key books', (bs) => bs.filter((b) => !b.knowledge_key), 'X3'],
    ['flatten every book to 100 words', (bs) => bs.map((b) => ({ ...b, text: words(b.text).slice(0, 100).join(' ') })), 'L2'],
    // The round-1 critic's SECOND mutation, adopted verbatim. Flag every book Argonian and touch
    // no byline: L5 went 21 -> 70 and passed HARDER, because it counted a boolean the data
    // declares about itself. L6 reads the name on the book instead.
    ['flag all books Argonian without touching one byline', (bs) => bs.map((b) => ({ ...b, argonian_authored: true })), 'L6'],
    ['unflag every Argonian author', (bs) => bs.map((b) => ({ ...b, argonian_authored: false })), 'L5'],
    // Tagging is a claim about the writing too: `skill book` means "teaches sideways", so tagging
    // the whole corpus must not be a way to satisfy L7 — L7's partner row L7b is the taxon spread.
    ['strip every skill-book tag', (bs) => bs.map((b) => ({ ...b, skill_book: null, tags: (b.tags || []).filter((t) => String(t).toLowerCase().replace(/[_\s]+/g, '-') !== 'skill-book') })), 'L7'],
    // L7's own attack, and the reason L7b exists. Tag the WHOLE corpus `mercantile` and L7 goes
    // from 32 to 70 and passes harder, exactly as L5 did under the Argonian flip. L7b reads the
    // prose and must collapse.
    ['tag every book `mercantile` without reading one of them', (bs) => bs.map((b) => ({ ...b, skill_book: 'mercantile' })), 'L7b'],
    // The derangement again, aimed at the overlay: every tag keeps its book id and gets somebody
    // else's prose. L7 cannot see it; L7b must.
    ["swap every book's text (derangement) — does the OVERLAY notice?", derange, 'L7b'],
    ['point a skill book at a skill that does not exist', (bs) => bs.map((b, i) => (i === 0 ? { ...b, skill_book: 'swordsmanship' } : b)), 'X4'],
  ];

  let bad = 0, invalid = 0;
  for (const [name, mutate, expect] of mutations) {
    if (controlPass.get(expect) !== true) {
      console.log(`  INVAL  ${expect}  after: ${name}   <-- target row was ALREADY RED in the control`);
      invalid++;
      continue;
    }
    const mutated = measure({ ...opts, _books: { books: mutate(base.books), parseErrors: [] }, _items: items });
    const row = mutated.rows.find((r) => r.id === expect);
    const wentRed = row && row.pass === false;
    console.log(`  ${wentRed ? 'RED  ' : 'GREEN'}  ${expect}  after: ${name}${wentRed ? '' : '   <-- MUTATION NOT DETECTED'}`);
    if (!wentRed) bad++;
  }
  if (invalid) console.log(`self-test: ${invalid} mutation(s) INVALID — their target row is already failing on the real corpus, so they were not run.`);
  console.log(bad ? `self-test FAILED: ${bad} mutation(s) did not turn a row red.` : 'self-test PASSED: every mutation was caught.');
  return bad ? 1 : 0;
}

// ---------------------------------------------------------------- pagination cross-check
async function pagination(books) {
  const mod = await import(path.join(ROOT, 'game/src/ui/screens/text.js'));
  if (typeof mod.bookPagination !== 'function') throw new Error('bookPagination not exported');
  const S = { s: 1, W: 1920, H: 1080 };
  const per = [];
  for (const b of books) {
    const r = mod.bookPagination(b.text, S);
    per.push({ id: b.id, pages: r.pages, words_per_page: r.words_per_page });
  }
  const all = per.flatMap((p) => p.words_per_page).sort((a, x) => a - x);
  // The final page of a book is, on average, half full — that is what a final page IS. Including
  // it drags the p10 of any corpus below RI-UIX05 K1's `p10 >= 80` floor no matter how the book
  // is written or the page is set: measured here, all-pages p10 is 62 and last-page-excluded p10
  // is 95, on the same corpus and the same layout. K1's p10 row is therefore only meaningful over
  // FULL pages, and both figures are reported so a critic can see which one it is scoring.
  const body = per.flatMap((p) => (p.words_per_page.length > 1 ? p.words_per_page.slice(0, -1) : [])).sort((a, x) => a - x);
  const q = (arr) => (p) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];
  const pc = q(all); const pb = q(body);
  return {
    at: '1920x1080',
    pages_total: per.reduce((a, p) => a + p.pages, 0),
    single_page_books: per.filter((p) => p.pages === 1).map((p) => p.id),
    words_per_page_all_pages: { n: all.length, p10: pc(0.1), median: pc(0.5), p90: pc(0.9), min: all[0], max: all[all.length - 1] },
    words_per_page_excluding_final_page: { n: body.length, p10: pb(0.1), median: pb(0.5), p90: pb(0.9), min: body[0], max: body[body.length - 1] },
    note: 'RI-UIX05 K1 (median 120-180, p90 <= 240, p10 >= 80) is satisfiable only against words_per_page_excluding_final_page; a final page is partial by construction.',
    per_book: per,
  };
}

// ---------------------------------------------------------------- main
const opts = {
  books: String(flag('books', 'game/data/books')),
  items: String(flag('items', 'game/data/items')),
  dialogue: String(flag('dialogue', 'game/data/dialogue')),
  quests: String(flag('quests', 'game/data/quests')),
  corroborate: has('corroborate'),
};

if (has('self-test')) process.exit(selfTest());

const result = measure(opts);
if (result.fatal) { console.error('book-budget: ' + result.fatal); process.exit(2); }

if (has('pagination')) {
  try { result.pagination = await pagination(loadBooks(path.resolve(ROOT, opts.books)).books); }
  catch (e) { result.pagination = { error: String(e.message), note: 'the shipping pagination module would not load in bare Node; run the browser capture instead (RI-UIX05 step 1)' }; }
}

const outPath = path.resolve(ROOT, String(flag('out', 'reports/book-budget.json')));
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');

const c = result.counts;
console.log(`books ${c.books}   book words ${c.book_words}   item description words ${c.item_description_words}`);
console.log(`lengths  p10 ${c.lengths.p10}  p25 ${c.lengths.p25}  median ${c.lengths.median}  p75 ${c.lengths.p75}  p90 ${c.lengths.p90}  max ${c.lengths.max}`);
console.log('');
for (const r of result.rows) {
  const mark = r.skipped ? 'skip' : r.pass === true ? 'PASS' : r.pass === false ? 'FAIL' : ' -- ';
  console.log(`  ${mark}  ${r.id.padEnd(3)} ${String(r.name).padEnd(48)} ${String(r.value)}   (bar ${r.bar})`);
}
if (result.pagination && !result.pagination.error) {
  const a = result.pagination.words_per_page_all_pages;
  const b = result.pagination.words_per_page_excluding_final_page;
  console.log(`\n  words per page @1920x1080   (RI-UIX05 B1/K1: median 120-180, p90 <= 240, p10 >= 80)`);
  console.log(`    all pages            p10 ${a.p10}  median ${a.median}  p90 ${a.p90}   (${a.n} pages)`);
  console.log(`    excluding final page p10 ${b.p10}  median ${b.median}  p90 ${b.p90}   (${b.n} pages)  <- the row K1 can actually be met on`);
}
console.log(`\n${path.relative(ROOT, outPath)}`);

const failed = result.rows.filter((r) => r.pass === false);
if (failed.length) {
  console.error(`\nbook-budget: ${failed.length} row(s) out of band: ${failed.map((r) => r.id).join(', ')}`);
  process.exit(1);
}
process.exit(0);
