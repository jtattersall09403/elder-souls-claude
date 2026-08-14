// RI-DLG01 Comparison method, steps 1, 2 and 4 — dump the graph, compute the topology, and
// run the unreachable-INFO lint.
//
//   node tools/dialogue/build-graph.mjs --out /tmp/dlg [--settlement lilmoth] [--write-index]
//
// Emits, in the §C format the item specifies:
//   <out>/topic_graph.tsv   src_topic \t dst_topic \t via \t scope
//   <out>/topics.tsv        topic \t n_infos \t is_root \t added_by_journal
//   <out>/infos.tsv         topic \t info_id \t filter_json \t words \t result_script
//   <out>/metrics.json      every row of §D
// and, with --write-index, game/data/dialogue/topic-graph.json — the expanded, degree-annotated
// index a critic can read without running anything.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DLG = path.join(ROOT, 'game/data/dialogue');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const OUT = String(arg('out', '/tmp/dlg'));
const ONLY = arg('settlement', null);
// W1-DLG-TOPIC-WEB §4B. `--visibility` adds the visibility census and the two lints; `--gate`
// makes A1/A1b/A5c/A7b hard failures rather than printed numbers. The thresholds are the plan's
// §5 table and are overridable ONLY upward in strictness by a critic replaying this.
const VISIBILITY = !!arg('visibility', false);
const GATE = !!arg('gate', false);
const MIN_STRICT = Number(arg('min-strict', 0.90));
const MAX_UNREACHABLE = Number(arg('max-unreachable', 10));

export const ROOT_TOPICS = ['duties', 'background', 'specific-place', 'someone-in-particular',
  'services', 'my-trade', 'little-secret', 'latest-rumors', 'little-advice'];

// Filter fields, in the Construction Set order RI-DLG01 §A tabulates.
// `a` (archetype) IS filter field 3, Class. It is not decoration: an INFO tagged `a:"legionary"`
// is only ever spoken by a legionary, exactly as a Morrowind INFO with Class=Ordinator is only
// spoken by an Ordinator. Leaving it out of the filter set would make the shadowing lint report
// every differently-voiced answer to the same topic as unreachable, which is the opposite of true.
export const FILTER_FIELDS = ['actor', 'a', 'r', 'c', 'f', 'fr', 'cell', 'pf', 'pr', 'sx', 'd', 'j', 'nj', 'act'];

export function loadTopics() {
  const dir = path.join(DLG, 'topics');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const topics = new Map();
  const extensions = [];
  for (const f of files) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const t of doc.topics || []) {
      // `topics/thorn.json` is a different (quest-link) schema whose rows key on `topic`, not
      // `id`. Indexing those put FOUR records into the graph under the key `undefined`, which
      // showed up in the orphan list as a blank entry and in `nodes` as a topic that does not
      // exist. `buildTopicIndex()` has skipped them since W1-07 for the same reason; the two
      // loaders now agree about what a topic record is.
      if (!t || typeof t.id !== 'string') continue;
      // W1-19 round 2. This threw on a duplicate id and had therefore been unrunnable on every
      // build since `the-marsh-fever` was authored in two files — 40 topic ids in this corpus
      // are declared more than once, which is the authoring idiom the tree actually uses. It is
      // not a defect in the data: the LIVE reader, `game/src/character/converse.js
      // buildTopicIndex()`, MERGES the infos of same-named topic records, so an id in two files
      // is one subject two groups have something to say about, and it works in the game. A tool
      // that refuses what the engine accepts is measuring the paperwork (RI-MTH07 §3), so this
      // now merges the same way the engine does. Order is file order; the engine SCORES infos by
      // specificity rather than taking the first match, so a merged record cannot shadow.
      const prev = topics.get(t.id);
      if (prev) { prev.infos = [...(prev.infos || []), ...(t.infos || [])]; prev._file += `,${f}`; continue; }
      topics.set(t.id, { ...t, infos: [...(t.infos || [])], _file: f, _group: doc.group });
    }
    for (const e of doc.extends || []) extensions.push({ ...e, _file: f });
  }
  // A settlement file's contribution to a GLOBAL topic is inserted AHEAD of the global answer.
  // This is not a specificity sort — RI-DLG01 §A is explicit that ordering is authored, not
  // computed — it is a one-line authoring convention with a reason: a cell-filtered INFO placed
  // behind an unfiltered one can never be reached, so appending would manufacture exactly the
  // unreachable-INFO bug class step 4 exists to catch. The lint verifies the convention works.
  for (const e of extensions) {
    const t = topics.get(e.id);
    if (!t) throw new Error(`${e._file}: extends '${e.id}' which is not a topic`);
    t.infos = [...(e.infos || []), ...(t.infos || [])];
  }
  return topics;
}

export function loadGreetings() {
  const dir = path.join(DLG, 'greetings');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .flatMap((f) => { const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); return (d.greetings || []).map((g) => ({ ...g, _file: f })); });
}

export function loadRumours() {
  const out = [];
  const dir = path.join(DLG, 'rumours');
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      for (const r of d.rumours || []) out.push({ ...r, settlement: r.settlement || d.settlement, _file: f });
    }
  }
  // W1-19 round 2: `dialogue/rumours.json` was invisible to this tool, which only ever looked in
  // the (empty) `rumours/` directory — so the one file in the tree that actually holds rumours
  // contributed no edges and the lint reported on nothing. The live reader is
  // `game/src/sim/quest/topic-supply.js RumourBook`, which takes both authored shapes:
  // `rumours[settlement] = [string | {x, adds_topics}]` and `race_gated[] = {settlement, x,
  // requires|forbids, adds_topics}`. `adds_topics` and `to` are the same field under two names,
  // because the quest side of this tree spells AddTopic `adds_topics` and the dialogue side
  // spells it `to`; both are read here for the same reason `core/topics.js` exists.
  const file = path.join(DLG, 'rumours.json');
  if (fs.existsSync(file)) {
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [settlement, lines] of Object.entries(d.rumours || {})) {
      for (const line of lines || []) {
        const r = typeof line === 'string' ? { x: line } : { ...line };
        out.push({ id: r.id || `rumour:${settlement}`, ...r, settlement: r.settlement || settlement, to: r.to || r.adds_topics || [], _file: 'rumours.json' });
      }
    }
    for (const r of d.race_gated || []) {
      out.push({ id: r.id || `rumour:${r.settlement}`, ...r, to: r.to || r.adds_topics || [], _file: 'rumours.json' });
    }
  }
  return out;
}

/**
 * Every topic keyword any person in the province wears on their own record — the fourth way in
 * (see THE FOURTH DOOR below). Read from `game/data/npcs/**` exactly as
 * `Engine._npcRecords()` does, and folded with the same rule as `game/src/core/topics.js`,
 * because the NPC records write the prose spelling and the dialogue files write slugs.
 */
export function topicFold(id) {
  return String(id == null ? '' : id).toLowerCase().replace(/[\u2018\u2019'`]/g, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function loadAdvertisedTopics() {
  const dir = path.join(ROOT, 'game/data/npcs');
  const out = new Set();
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const arr = Array.isArray(d) ? d : (d.npcs || d.records || []);
    for (const n of arr || []) for (const t of (n && n.topics) || []) out.add(topicFold(t));
  }
  return out;
}

const words = (s) => (String(s).match(/[A-Za-z'%]+/g) || []).length;

// =====================================================================================
// VISIBILITY — W1-DLG-TOPIC-WEB §4B. Does the player ever SEE the word they just learned?
// =====================================================================================
//
// The owner's complaint, in the form a machine can check: in Morrowind, asking about one subject
// puts new subjects in your list *and shows you the words for them in the answer you just read*.
// This corpus has 1,630 edges and, before this round, showed the player the destination's word in
// about one case in ten. A topic silently appeared in the column; there was nothing to notice.
//
// So for every `to` entry of every INFO, this asks: does the destination's PLAYER-VISIBLE LABEL
// occur, literally, in the text of the answer that unlocks it — and at which characters?
//
// THE LABEL IS `topicLabel()`'s ANSWER, NOT THE ID. Since W1-DLG-TOPIC-WEB step A,
// `game/src/character/converse.js topicLabel()` returns the topic record's authored `name` when it
// has one and the de-slugged id otherwise. This tool resolves it the same way and by the same rule,
// so authoring a `name` moves this number — which is the point of giving `name` a reader at all.
//
// THE FOLD RULES, STATED HERE ON PURPOSE. `RI-UIX08`'s own "Untested" note predicts the recall
// floor will be argued over morphology, so the matcher's tolerance is declared rather than
// discovered:
//   * case is folded — `Warden Eshi` matches `warden eshi`;
//   * apostrophes VANISH rather than becoming a break — `Xul'Teekh` folds to `xulteekh`, so an id
//     spelled `the-xul-teekh` will NOT match it and that is a real miss, correctly reported;
//   * hyphens and underscores become spaces, so a slug and its prose spelling fold together;
//   * every other non-alphanumeric run becomes a single space, so punctuation cannot hide a match
//     and cannot manufacture one;
//   * matches are WHOLE-WORD on the folded text. `the tolls` does not match `the tollsman`.
// NO STEMMING, NO PLURALS, NO SYNONYMS. `the blight storms` does not match "a blight storm". That
// is deliberate: a matcher generous about morphology reports a link the window cannot draw, and the
// span columns below are a contract with a renderer, not a literary judgement.
//
// TWO MATCHERS, AND ONLY ONE IS THE CONTRACT.
//   strict — the whole label, contiguous, whole-word. **These are the spans the window marks**, and
//            this is the matcher A1 is measured on.
//   loose  — every CONTENT word of the label occurs somewhere in the answer, in any order, possibly
//            far apart. Reported because §1 reports it, and because the gap between the two is the
//            honest size of the "we nearly said it" population. A loose row's span is the first
//            content word's occurrence and **is not a link span**; a window that drew them would
//            break `RI-UIX08` §C1's precision from its own side.
export const VIS_STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'at', 'for', 'from', 'with', 'by']);

/**
 * Fold a string for matching AND keep the way back. `map[i]` is the index in the original string of
 * the character that produced `folded[i]`, so a match found in folded coordinates can be reported
 * as a character span in the text a player actually reads. Without the map this tool could say
 * *whether* a label appears and never *where*, and "where" is the whole of the seam contract.
 */
export function foldWithMap(s) {
  const src = String(s == null ? '' : s);
  let folded = '';
  const map = [];
  let lastWasSpace = true;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '‘' || ch === '’' || ch === "'" || ch === '`' || ch === 'ʼ') continue;
    const lower = ch.toLowerCase();
    if (lower >= 'a' && lower <= 'z' || lower >= '0' && lower <= '9') { folded += lower; map.push(i); lastWasSpace = false; }
    else if (!lastWasSpace) { folded += ' '; map.push(i); lastWasSpace = true; }
  }
  while (folded.endsWith(' ')) { folded = folded.slice(0, -1); map.pop(); }
  return { folded, map };
}

export const foldPhrase = (s) => foldWithMap(s).folded;

/** Whole-word `indexOf` on a folded string: the hit must be bounded by a space or an end. */
export function findWholeWord(folded, needle, from = 0) {
  if (!needle) return -1;
  let i = folded.indexOf(needle, from);
  while (i >= 0) {
    const okBefore = i === 0 || folded[i - 1] === ' ';
    const okAfter = i + needle.length === folded.length || folded[i + needle.length] === ' ';
    if (okBefore && okAfter) return i;
    i = folded.indexOf(needle, i + 1);
  }
  return -1;
}

/**
 * Is `label` visible in `text`, and where? Returns `{matcher, start, end}` in ORIGINAL-string
 * character coordinates, `-1/-1` when nothing matched.
 */
export function visibilityOf(text, label) {
  const { folded, map } = foldWithMap(text);
  const needle = foldPhrase(label);
  const at = findWholeWord(folded, needle);
  if (at >= 0) return { matcher: 'strict', start: map[at], end: map[at + needle.length - 1] + 1 };
  const content = needle.split(' ').filter((w) => w && !VIS_STOPWORDS.has(w));
  if (content.length && content.every((w) => findWholeWord(folded, w) >= 0)) {
    const first = findWholeWord(folded, content[0]);
    return { matcher: 'loose', start: map[first], end: map[first + content[0].length - 1] + 1 };
  }
  return { matcher: 'none', start: -1, end: -1 };
}

/**
 * The topic records as THE SHIPPING READER sees them: `game/src/character/converse.js
 * buildTopicIndex()` walks `doc.topics` only, merging same-id records in the manifest's declared
 * file order, and **never looks at `doc.extends`**. `loadTopics()` above deliberately DOES apply
 * `extends`, because the graph it builds is about the corpus; A1 is about what a player reads, so
 * it must not be. The difference is exactly 4 `to` occurrences in `30-texture.json`'s three
 * `extends` blocks — the 1,605 / 1,601 discrepancy two plan rounds spent time reconciling, and it
 * is NOT `thorn.json` (whose four `links`-schema records are a separate 4, carrying no `to` at all
 * and no `id` either). Both exclusions are the plan's §5 denominator, held to here by construction
 * rather than by arithmetic.
 */
export function loadTopicRecordsAsRead() {
  const dir = path.join(DLG, 'topics');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const byId = new Map();
  for (const f of files) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const t of doc.topics || []) {
      if (!t || typeof t.id !== 'string') continue;
      const cur = byId.get(t.id) || { id: t.id, infos: [], files: [] };
      if (cur.name === undefined && typeof t.name === 'string' && t.name) cur.name = t.name;
      // `_file` and `_idx` are the way back to the byte on disk: `_idx` is the info's index inside
      // THIS file's record, which is what an editor has to address, while the position in
      // `cur.infos` is the index in the MERGED record, which is what the player's reader sees and
      // what `visibility.tsv`'s `info_id` column reports. 92 of the 470 ids are declared in more
      // than one file, so the two indices differ for 38% of the corpus and conflating them edits
      // the wrong sentence.
      (t.infos || []).forEach((info, ii) => cur.infos.push({ ...info, _file: f, _idx: ii }));
      cur.files.push(f);
      byId.set(t.id, cur);
    }
  }
  return byId;
}

/** The label a player reads, resolved exactly as `converse.js topicLabel()` resolves it. */
export const labelForRecord = (rec) => (rec && typeof rec.name === 'string' && rec.name ? rec.name : String(rec ? rec.id : '').split('-').join(' '));

/** Every `npc.topics` entry in the province, with the record it sits on — the A7b population. */
export function loadAdvertisedTopicEntries() {
  const dir = path.join(ROOT, 'game/data/npcs');
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const arr = Array.isArray(d) ? d : (d.npcs || d.records || []);
    for (const n of arr || []) {
      if (!n) continue;
      for (const t of n.topics || []) out.push({ file: f, npc: n.id || n.name || '(unnamed)', topic: t });
    }
  }
  return out;
}

function main() {
  const topics = loadTopics();
  const greetings = loadGreetings();
  const rumours = loadRumours();

  // ---- edges -------------------------------------------------------------------------
  const edges = [];   // {src, dst, via, scope}
  const errors = [];
  const journalAdded = new Set();

  for (const [id, t] of topics) {
    for (const info of t.infos || []) {
      const scope = info.cell ? `settlement:${info.cell}` : (t.settlement ? `settlement:${t.settlement}` : 'global');
      for (const dst of info.to || []) {
        if (!topics.has(dst)) { errors.push(`topic '${id}' AddTopic -> '${dst}' which does not exist`); continue; }
        edges.push({ src: id, dst, via: 'AddTopic', scope });
      }
    }
  }
  // Greeting text names the root topics; RI-DLG01 §C's first two rows are exactly this shape.
  for (const g of greetings) {
    const node = `GREETING${g.class}_${(g.cell || 'ANY').toUpperCase()}_${g.id}`;
    for (const dst of g.to || []) {
      if (!topics.has(dst)) { errors.push(`greeting '${g.id}' offers -> '${dst}' which does not exist`); continue; }
      edges.push({ src: node, dst, via: 'greeting_text', scope: g.cell ? `settlement:${g.cell}` : 'global' });
    }
  }
  // Rumours are INFOs under `latest-rumors`; their AddTopic calls are graph edges too.
  for (const r of rumours) {
    for (const dst of r.to || []) {
      if (!topics.has(dst)) { errors.push(`rumour '${r.id}' AddTopic -> '${dst}' which does not exist`); continue; }
      edges.push({ src: 'latest-rumors', dst, via: 'AddTopic', scope: `settlement:${r.settlement}` });
    }
  }
  // Journal-seeded topics (RI-DLG01 §B note 3: "a journal entry adds a topic").
  for (const [id, t] of topics) if (t.added_by_journal) {
    journalAdded.add(id);
    edges.push({ src: `JOURNAL:${t.added_by_journal}`, dst: id, via: 'AddTopic', scope: 'global' });
  }

  // ---- unreachable-INFO lint (§ step 4) --------------------------------------------------
  // For each topic, for each pair (i<j) in AUTHORED order: if filter[j] is a strict superset of
  // filter[i] — every constraint in i present in j and equal or weaker — j can never be reached,
  // because first-match-wins returns i whenever j would have passed.
  const unreachable = [];
  const filt = (info) => {
    const o = {};
    for (const k of FILTER_FIELDS) if (info[k] !== undefined) o[k] = info[k];
    // W1-17 successor round. THE LINT WAS BLIND TO EVERY RACE GATE IN THE CORPUS.
    //
    // `FILTER_FIELDS` spells Morrowind filter field 2 `r`, the Construction Set's own column
    // name. Measured over `game/data/dialogue/topics/**`: `r` is authored on **0 of 1,220
    // infos**. The corpus writes the same gate as `requires.race` (144 infos) and
    // `forbids.race` (39), because that is the shape `game/src/character/converse.js
    // infoAllowed()` reads — the shipped reader has no `r` branch at all.
    //
    // The consequence was not a missed finding; it was 105 false ones. Three answers to
    // `the-provincial-office`, one for an Imperial, one for a Saxhleel and one for everybody
    // else, all carry filter `{"a":"clerk"}` as far as `filt()` can see, so the lint declared
    // two of the three unreachable while in the running game a Dunmer and a Saxhleel demonstrably
    // hear different sentences. A lint that calls the province's best-gated writing dead is not
    // a strict lint, it is a broken one, and it hides the shadows that are real underneath a
    // hundred that are not.
    //
    // So the player-side gates are folded in under names that cannot collide with a CS column:
    // whitelists (`requires`) narrow as the set SHRINKS, blacklists (`forbids`) narrow as the
    // set GROWS, and the knowledge gates are whitelists over world flags. Same rule as
    // `game/src/core/topics.js`: fold the two authored spellings of one idea before comparing.
    const req = info.requires || {}, forb = info.forbids || {};
    for (const k of ['race', 'upbringing', 'knows', 'knows_all']) if (Array.isArray(req[k])) o[`req:${k}`] = [...req[k]].sort();
    for (const k of ['race', 'upbringing', 'knows']) if (Array.isArray(forb[k])) o[`forb:${k}`] = [...forb[k]].sort();
    return o;
  };
  const subset = (x, y) => x.every((v) => y.includes(v));
  const impliesSameOrWeaker = (a, b, k) => {
    // b's constraint on k must be satisfied whenever a's is.
    if (a[k] === undefined) return false;
    if (k === 'd' || k === 'fr' || k === 'pr') return Number(b[k]) <= Number(a[k]);   // numeric MINIMUMS
    // A whitelist is satisfied whenever a NARROWER whitelist is: passing `race in {saxhleel}`
    // implies passing `race in {saxhleel, naga}`, so a ⊆ b.
    if (k.startsWith('req:')) return subset(a[k], b[k]);
    // A blacklist is satisfied whenever a WIDER blacklist is: surviving `race not in {dunmer,
    // nord}` implies surviving `race not in {dunmer}`, so b ⊆ a.
    if (k.startsWith('forb:')) return subset(b[k], a[k]);
    return JSON.stringify(a[k]) === JSON.stringify(b[k]);
  };
  for (const [id, t] of topics) {
    const infos = t.infos || [];
    for (let j = 1; j < infos.length; j++) {
      for (let i = 0; i < j; i++) {
        const fi = filt(infos[i]), fj = filt(infos[j]);
        const ki = Object.keys(fi), kj = Object.keys(fj);
        // j unreachable if every constraint of i is present in j and equal-or-tighter, i.e.
        // passing j implies passing i.
        const jImpliesI = ki.every((k) => impliesSameOrWeaker(fj, fi, k));
        if (jImpliesI && kj.length >= ki.length) unreachable.push({ topic: id, earlier: i, shadowed: j, earlier_filter: fi, shadowed_filter: fj });
      }
    }
  }

  // ---- topology ---------------------------------------------------------------------------
  const nodes = new Set([...topics.keys()]);
  const outDeg = new Map(), inDeg = new Map();
  for (const n of nodes) { outDeg.set(n, 0); inDeg.set(n, 0); }
  const seenEdge = new Set();
  for (const e of edges) {
    const key = `${e.src} ${e.dst}`;
    if (seenEdge.has(key)) continue;   // multi-edges collapse: a graph, not a multigraph
    seenEdge.add(key);
    if (outDeg.has(e.src)) outDeg.set(e.src, outDeg.get(e.src) + 1);
    inDeg.set(e.dst, (inDeg.get(e.dst) || 0) + 1);
  }

  const roots = new Set(ROOT_TOPICS);
  // THE FOURTH DOOR.
  //
  // This lint modelled three ways into a topic — it is one of the nine roots, a greeting names
  // it, or another topic's AddTopic fires it — and reported 151 orphans against a build in which
  // a player can walk up to somebody and ask about most of them. The reason is that the shipped
  // reader has a fourth: `game/src/character/converse.js topicsFor()` offers **the subjects the
  // speaker's own record advertises**, `npc.topics`, whether or not anything ever said the word
  // first. That is how you learn a topic from a person rather than from a sentence, it is 136
  // distinct keywords across `game/data/npcs/**`, and it accounted for 42 of the 151.
  //
  // Counting it is not softening the gate, and the split below is the proof: `orphans` is still
  // ZERO-tolerance and still means "nothing in the world can put this word in the player's
  // mouth". `orphans_npc_advertised` is reported separately and does NOT clear the gate — it
  // names topics that only ever arrive because somebody wears them, which is legal but is a
  // thinner way in than being mentioned, and a critic should be able to see the number.
  // CORRECTED IN W1-17 ROUND 2 — THE SPLIT ABOVE WAS HONEST DISCLOSURE FILED IN THE WRONG BUCKET.
  //
  // Round 1 subtracted the npc-advertised topics OUT of `orphans` and reported them alongside, so
  // the headline read `orphans: 0` (+23 disclosed). The round-1 critic accepted that the discovery
  // and the disclosure were the larger half of the work — the fourth door is real and nothing else
  // in the tree modelled it — and still ruled the bucket wrong, for a reason that is simply the
  // item's own text:
  //
  //     RI-DLG01 §D: "Orphans (in-degree 0, not a root, NOT JOURNAL-ADDED) — 0 by intent —
  //                   >=1 = fail"
  //
  // `npc.topics` is not journal-added. On the item's own definition those 23 ARE orphans and the
  // row fails. A builder does not get to widen an exemption the item wrote narrowly, however
  // genuine the mechanism it found.
  //
  // So `orphans` is now exactly the item's definition and the gate fails on it. The fourth door is
  // NOT discarded — it survives as a BREAKDOWN of that number rather than as an exemption from it,
  // which keeps everything the round-1 disclosure was worth while reporting the figure where the
  // item says it goes.
  const advertised = loadAdvertisedTopics();
  const noWayIn = (n) => (inDeg.get(n) || 0) === 0 && !roots.has(n) && !journalAdded.has(n);
  const orphans = [...nodes].filter(noWayIn);
  const orphansNpcAdvertised = orphans.filter((n) => advertised.has(topicFold(n)));
  const orphansNoWayInAtAll = orphans.filter((n) => !advertised.has(topicFold(n)));

  // BFS depth from every greeting node
  const adj = new Map();
  for (const e of edges) { if (!adj.has(e.src)) adj.set(e.src, new Set()); adj.get(e.src).add(e.dst); }
  const greetNodes = [...new Set(edges.filter((e) => e.src.startsWith('GREETING')).map((e) => e.src))];
  const depth = new Map();
  for (const s of greetNodes) {
    const q = [[s, 0]]; const seen = new Set([s]);
    while (q.length) {
      const [n, dd] = q.shift();
      if (n !== s) depth.set(n, Math.min(depth.get(n) ?? 99, dd));
      for (const m of adj.get(n) || []) if (!seen.has(m)) { seen.add(m); q.push([m, dd + 1]); }
    }
  }

  const nz = [...outDeg.values()].filter((d) => d > 0);
  const leaves = [...nodes].filter((n) => outDeg.get(n) === 0);
  const conv = [...nodes].filter((n) => (inDeg.get(n) || 0) >= 2);
  const questNodes = [...topics.values()].filter((t) => t.quest).map((t) => t.id);
  const localTopics = [...topics.values()].filter((t) => (t.infos || []).some((i) => i.cell) || t.settlement);
  const depths = [...depth.values()].filter((d) => d < 99).sort((a, b) => a - b);
  const median = depths.length ? depths[Math.floor(depths.length / 2)] : 0;

  // menu_quest_fraction: quest topic reachable from a greeting in <= 1 hop
  const menuQuests = questNodes.filter((q) => (depth.get(q) ?? 99) <= 1);

  // per-settlement answerable count
  const settlements = [...new Set([...greetings.map((g) => g.cell), ...rumours.map((r) => r.settlement)].filter(Boolean))];
  const perSettlement = {};
  for (const s of settlements) {
    const answerable = [...topics.values()].filter((t) => (t.infos || []).some((i) => !i.cell || i.cell === s));
    const localAnswer = [...topics.values()].filter((t) => (t.infos || []).some((i) => i.cell === s));
    perSettlement[s] = { answerable: answerable.length, with_local_answer: localAnswer.length };
  }

  const metrics = {
    schema: 'elder-souls/dialogue-graph-metrics@1',
    generated_by: 'tools/dialogue/build-graph.mjs',
    nodes: nodes.size,
    edges: seenEdge.size,
    roots: [...roots].filter((r) => nodes.has(r)).length,
    root_ids_missing: [...roots].filter((r) => !nodes.has(r)),
    mean_out_degree_nonleaf: nz.length ? +(nz.reduce((a, b) => a + b, 0) / nz.length).toFixed(4) : 0,
    leaf_fraction: +(leaves.length / nodes.size).toFixed(4),
    reachable_only_via_another_topic: +(([...nodes].filter((n) => !roots.has(n) && !journalAdded.has(n)).length) / nodes.size).toFixed(4),
    max_depth: depths.length ? depths[depths.length - 1] : 0,
    median_depth: median,
    unreachable_from_greeting: [...nodes].filter((n) => !depth.has(n) && !roots.has(n)),
    orphans,
    orphans_definition: 'RI-DLG01 §D: in-degree 0, not a root, not journal-added. 0 by intent; >=1 = fail.',
    orphans_npc_advertised: orphansNpcAdvertised,
    orphans_no_way_in_at_all: orphansNoWayInAtAll,
    orphans_breakdown_note: 'orphans_npc_advertised is a BREAKDOWN of `orphans`, not an exemption from it. These topics are reachable in play only because a speaker\'s own record advertises the word (converse.js topicsFor() -> npc.topics), which is a real fourth door the lint did not model before W1-17 r1 found it — but it is not journal-added, so RI-DLG01 §D counts them as orphans and so does this tool.',
    unreachable_infos: unreachable,
    convergence: +(conv.length / nodes.size).toFixed(4),
    quest_topic_fraction: +(questNodes.length / nodes.size).toFixed(4),
    quest_topics: questNodes,
    menu_quest_fraction: +(questNodes.length ? menuQuests.length / questNodes.length : 0).toFixed(4),
    menu_quests: menuQuests,
    topics_with_settlement_local_answer: localTopics.length,
    infos_total: [...topics.values()].reduce((a, t) => a + (t.infos || []).length, 0),
    mean_infos_per_topic: +([...topics.values()].reduce((a, t) => a + (t.infos || []).length, 0) / nodes.size).toFixed(3),
    per_settlement: perSettlement,
    errors,
  };

  fs.mkdirSync(OUT, { recursive: true });

  // ---- --visibility (§4B) ------------------------------------------------------------------
  // Three things in one pass over data already parsed: the visibility census (A1/A1b), the
  // dangling-`npc.topics` lint (A7b) and the unreachable-from-greeting lint (A5c). None of the
  // three existed in this tree before; all three exit non-zero when they fire.
  let visReport = null;
  if (VISIBILITY) {
    const records = loadTopicRecordsAsRead();
    const rows = [];
    let strict = 0, loose = 0, none = 0, flagged = 0, unflaggedInvisible = 0, missingLabel = 0;
    for (const [srcId, rec] of records) {
      rec.infos.forEach((info, k) => {
        const text = String(info.x == null ? '' : info.x);
        const impliedSet = new Set(Array.isArray(info.implied) ? info.implied : []);
        for (const dst of info.to || []) {
          const dstRec = records.get(dst);
          const label = dstRec ? labelForRecord(dstRec) : '';
          if (!dstRec) missingLabel++;
          const v = label ? visibilityOf(text, label) : { matcher: 'none', start: -1, end: -1 };
          const isImplied = impliedSet.has(dst) ? 1 : 0;
          if (v.matcher === 'strict') strict++;
          else if (v.matcher === 'loose') loose++;
          else none++;
          if (isImplied) flagged++;
          // A1b's population: an occurrence that fails A1 (i.e. is not strict) and carries no
          // `implied` flag. This is the number with no budget — an unlock nobody can see and
          // nobody chose to hide.
          if (v.matcher !== 'strict' && !isImplied) unflaggedInvisible++;
          rows.push([srcId, `${srcId}#${k}`, dst, label, v.matcher, v.start, v.end, isImplied].join('\t'));
        }
      });
    }
    const total = rows.length;
    fs.writeFileSync(path.join(OUT, 'visibility.tsv'),
      ['src_topic\tinfo_id\tdst_topic\tlabel\tmatcher\tchar_start\tchar_end\timplied', ...rows].join('\n') + '\n');

    // ---- LINT 1: dangling `npc.topics` (A7b) -------------------------------------------------
    // `topicsFor()` walks `npc.topics` and calls `infoFor()` on each; an entry naming no topic at
    // all returns null and is DROPPED SILENTLY. Nothing in this tree reported it, so 100 of 865
    // entries — a person advertising a subject that does not exist — were invisible to every gate.
    //
    // TWO DEFINITIONS, BOTH REPORTED, BOTH GATED — because they disagree by 84 entries and a
    // builder and a critic each picking one would argue about the wrong thing. RULES rule 11: a
    // field census over data cannot prove a read dead; the loader decides what shapes are legal.
    //
    //   strict     — the entry is not, byte for byte, a topic id. **100 of 865 at the plan's
    //                baseline commit**, 66 distinct, 52 records. This is the figure the plan's §2c,
    //                §4B, §4D and A7b all quote.
    //   effective  — the entry does not resolve THROUGH THE SHIPPING READER. `topicsFor()` calls
    //                `infoFor()`, which does `topicIndex.get(topicKey(id))`, and `topicKey` is the
    //                same fold as `topicFold` here — added deliberately in W1-07 because "the
    //                dialogue files write slugs and the NPC records write the prose form of the
    //                same keyword". **16 of 865**, 16 distinct, 16 records.
    //
    // So 84 of the plan's 100 are prose spellings of topics that DO exist and DO answer in the
    // running game (`the drowned tally` -> `the-drowned-tally`), and 16 name subjects nothing in
    // the corpus answers at all. That is a correction to the plan's baseline and it is published
    // rather than quietly adopted. The repair takes BOTH to zero: the 16 are pointed at a real
    // topic or removed, and the 84 are normalised to the slug they already fold to — which changes
    // no behaviour and makes the data say what the reader already does.
    const validIds = new Set(records.keys());
    const validFolds = new Set([...validIds].map(topicFold));
    const entries = loadAdvertisedTopicEntries();
    const danglingStrict = entries.filter((e) => !validIds.has(e.topic));
    const dangling = entries.filter((e) => !validFolds.has(topicFold(e.topic)));
    const danglingDistinct = [...new Set(dangling.map((e) => e.topic))].sort();
    const danglingRecords = [...new Set(dangling.map((e) => e.npc))];

    visReport = {
      occurrences: total,
      strict, loose, none,
      strict_fraction: total ? +(strict / total).toFixed(4) : 0,
      loose_or_better_fraction: total ? +((strict + loose) / total).toFixed(4) : 0,
      flagged_implied: flagged,
      unflagged_invisible: unflaggedInvisible,
      destinations_with_no_record: missingLabel,
      dangling_npc_topics: dangling.length,
      dangling_npc_topics_distinct: danglingDistinct,
      dangling_npc_topics_records: danglingRecords.length,
      dangling_npc_topics_detail: dangling.map((e) => `${e.file}:${e.npc} -> ${e.topic}`),
      dangling_npc_topics_strict: danglingStrict.length,
      dangling_npc_topics_strict_distinct: [...new Set(danglingStrict.map((e) => e.topic))].sort(),
      dangling_npc_topics_strict_records: [...new Set(danglingStrict.map((e) => e.npc))].length,
      dangling_npc_topics_strict_detail: danglingStrict.map((e) => `${e.file}:${e.npc} -> ${e.topic}`),
      npc_topics_entries: entries.length,
      unreachable_from_greeting_count: metrics.unreachable_from_greeting.length,
    };
    // The three headline fields §4B commissions, at the top level where a gate can read them.
    metrics.visibility_strict_fraction = visReport.strict_fraction;
    metrics.visibility_loose_or_better_fraction = visReport.loose_or_better_fraction;
    metrics.visibility_unflagged_invisible = unflaggedInvisible;
    metrics.visibility = visReport;
    fs.writeFileSync(path.join(OUT, 'visibility_report.json'), JSON.stringify(visReport, null, 2) + '\n');
  }

  const tsv = ['# topic_graph.tsv  —  src_topic \t dst_topic \t via \t scope'];
  for (const e of edges) tsv.push([e.src, e.dst, e.via, e.scope].join('\t'));
  fs.writeFileSync(path.join(OUT, 'topic_graph.tsv'), tsv.join('\n') + '\n');

  const tt = ['topic\tn_infos\tis_root\tadded_by_journal\tin_degree\tout_degree\tdepth'];
  for (const [id, t] of topics) tt.push([id, (t.infos || []).length, roots.has(id) ? 1 : 0, t.added_by_journal || '', inDeg.get(id) || 0, outDeg.get(id) || 0, depth.get(id) ?? ''].join('\t'));
  fs.writeFileSync(path.join(OUT, 'topics.tsv'), tt.join('\n') + '\n');

  const ii = ['topic\tinfo_id\tarchetype\tfilter_json\twords\tresult_script\ttext'];
  for (const [id, t] of topics) (t.infos || []).forEach((info, k) => {
    ii.push([id, `${id}#${k}`, info.a || '', JSON.stringify(filt(info)), words(info.x || ''),
      JSON.stringify({ addTopic: info.to || [], ...(info.res || {}) }), String(info.x || '').replace(/\t/g, ' ')].join('\t'));
  });
  fs.writeFileSync(path.join(OUT, 'infos.tsv'), ii.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(metrics, null, 2) + '\n');

  if (arg('write-index', false)) {
    const index = {
      schema: 'elder-souls/dialogue-topic-graph@1',
      generated_by: 'tools/dialogue/build-graph.mjs --write-index',
      note: 'Generated from game/data/dialogue/topics/**, greetings/** and rumours/**. Do not hand-edit; edit the source files and regenerate. Present so a critic can read the graph without running the game (HARNESS.md §7).',
      metrics: { ...metrics, unreachable_infos: unreachable.length },
      nodes: [...topics.keys()].sort().map((id) => ({
        id, root: roots.has(id), quest: topics.get(id).quest || null,
        infos: (topics.get(id).infos || []).length,
        in_degree: inDeg.get(id) || 0, out_degree: outDeg.get(id) || 0,
        depth_from_greeting: depth.get(id) ?? null,
        out: [...(adj.get(id) || [])].sort(),
      })),
    };
    fs.writeFileSync(path.join(DLG, 'topic-graph.json'), JSON.stringify(index, null, 1) + '\n');
  }

  const bad = errors.length + orphans.length + unreachable.length;
  console.log(JSON.stringify({ ...metrics, unreachable_infos: unreachable.length, unreachable_info_detail: unreachable.slice(0, 5) }, null, 2));

  // ---- the visibility summary and its gates ------------------------------------------------
  let visBad = 0;
  if (visReport) {
    const v = visReport;
    console.log(`\n---- visibility (W1-DLG-TOPIC-WEB §4B) — ${v.occurrences} \`to\` occurrences ----`);
    console.log(`  strict  ${v.strict} (${(v.strict_fraction * 100).toFixed(1)}%)   the destination's label is in the answer, whole and contiguous`);
    console.log(`  loose   ${v.loose} more (${(v.loose_or_better_fraction * 100).toFixed(1)}% cumulative)   every content word appears, scattered`);
    console.log(`  none    ${v.none}   the player is never shown the word`);
    console.log(`  flagged \`implied\`: ${v.flagged_implied}    UNFLAGGED INVISIBLE (A1b, no budget): ${v.unflagged_invisible}`);
    console.log(`\n---- lint: dangling npc.topics (A7b) ----`);
    console.log(`  strict    ${v.dangling_npc_topics_strict} of ${v.npc_topics_entries} entries are not, byte for byte, a topic id`);
    console.log(`            — ${v.dangling_npc_topics_strict_distinct.length} distinct string(s) over ${v.dangling_npc_topics_strict_records} record(s). This is the plan's figure.`);
    console.log(`  effective ${v.dangling_npc_topics} entries do not resolve through the SHIPPING reader either`);
    console.log(`            (topicsFor -> infoFor -> topicIndex.get(topicKey(id)), which folds slug against prose)`);
    console.log(`            — ${v.dangling_npc_topics_distinct.length} distinct over ${v.dangling_npc_topics_records} record(s). topicsFor() drops each silently.`);
    console.log(`  Both are gated at 0. The lists, not the counts:`);
    console.log(`    -- effective (no topic answers these at all):`);
    for (const s of v.dangling_npc_topics_distinct) console.log(`       ${s}`);
    console.log(`    -- strict-only (prose spelling of a topic that DOES exist; normalise to its slug):`);
    for (const s of v.dangling_npc_topics_strict_distinct.filter((x) => !v.dangling_npc_topics_distinct.includes(x))) console.log(`       ${s}`);
    console.log(`\n---- lint: unreachable_from_greeting (A5c) ----`);
    console.log(`  ${metrics.unreachable_from_greeting.length} topic(s) reachable from no greeting node by any route. The list, not the count:`);
    for (const s of metrics.unreachable_from_greeting) console.log(`    ${s}`);
    if (v.dangling_npc_topics > 0 || v.dangling_npc_topics_strict > 0) { console.error(`\nLINT FAIL: ${v.dangling_npc_topics_strict} strict / ${v.dangling_npc_topics} effective dangling npc.topics entries (A7b gate is 0 on both).`); visBad++; }
    if (metrics.unreachable_from_greeting.length > MAX_UNREACHABLE) { console.error(`\nLINT FAIL: ${metrics.unreachable_from_greeting.length} topics unreachable from any greeting, above the A5c ceiling of ${MAX_UNREACHABLE}.`); visBad++; }
    if (GATE) {
      if (v.strict_fraction < MIN_STRICT) { console.error(`\nGATE FAIL (A1): visibility ${(v.strict_fraction * 100).toFixed(1)}% is below the floor of ${(MIN_STRICT * 100).toFixed(0)}%.`); visBad++; }
      if (v.unflagged_invisible > 0) { console.error(`\nGATE FAIL (A1b): ${v.unflagged_invisible} invisible unlock(s) carry no \`implied\` flag. A1b has no budget.`); visBad++; }
    }
  }

  if (bad) { console.error(`\nFAIL: ${errors.length} dangling edges, ${orphans.length} orphans (RI-DLG01 §D definition: in-degree 0, not a root, not journal-added), ${unreachable.length} unreachable INFOs`); console.error(`      of those ${orphans.length} orphans: ${orphansNpcAdvertised.length} are reachable in play ONLY because a speaker advertises the word (npc.topics), and ${orphansNoWayInAtAll.length} have no way in at all.`); process.exit(1); }
  if (visBad) process.exit(1);
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) main();
