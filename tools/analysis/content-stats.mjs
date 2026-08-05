#!/usr/bin/env node
// content-stats.mjs — static analysis of the game's content data files.
// Runs WITHOUT the game: every quest, topic, NPC, item and POI must be inspectable as data.
// Spec: corpus/80-methods/HARNESS.md §7 (data-inspection contract).
// Consumers: corpus/30-quests/RI-*, corpus/40-dialogue/RI-*, corpus/50-world/RI-*.
import fs from 'node:fs';
import path from 'node:path';
import {
  parseArgs, wantsHelp, usage, die, log, EXIT, DATA_DIR,
  writeJson, summarise, entropyOf, hashDataTree,
} from '../lib/cli.mjs';

const USAGE = `
content-stats.mjs — static metrics over game/data/** with no browser involved.

USAGE
  node tools/analysis/content-stats.mjs [--data <dir>] [--out <file>] [--json]

OPTIONS
  --data <dir>   Content root (default: game/data)
  --out <path>   Output JSON (default: reports/content-stats.json)
  --json         Print the full result on stdout
  --verbose      Log every file classified
  --help         This message

COMPUTES
  dialogue    topic count, unique words per settlement, type-token ratio, greeting variety,
              rumour distribution across settlements, per-NPC line counts
  topic_graph node count, edge count, out-degree distribution, max depth from roots,
              reachable fraction, orphan topics, cycle count
  quests      stage counts, branch counts, terminal outcomes, mutually exclusive outcomes,
              % resolvable without combat, quest-giver-lies markers
  journal     entry count and word-length distribution, first-person ratio, marker leakage
  world       POIs per region, settlements, interiors, named-vs-generic ratio
  lore        proper-noun extraction (frequency + uniqueness), book count and length
  coverage    which shapes were recognised and which files could not be classified

SCHEMA TOLERANCE
  This tool never assumes a field name it has not verified. Everything is discovered by
  shape with several accepted aliases; anything unrecognised is reported under
  coverage.unclassified rather than silently scoring zero. If your data is well-formed but
  lands in unclassified, the fix is a new alias here — not a silent 0 in a verdict.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const dataDir = path.resolve(String(args.data || DATA_DIR));
if (!fs.existsSync(dataDir)) {
  die(EXIT.MISSING_GAME,
    `content data directory not found: ${dataDir}\n` +
    '  HARNESS.md §7 makes this a hard architectural requirement: ALL quests, dialogue,\n' +
    '  NPCs, items, books and world placement must live in inspectable JSON under game/data/.\n' +
    '  Content hard-coded in .js source is unmeasurable and therefore unscoreable.');
}

// ---------------------------------------------------------------- load
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(json|jsonl)$/i.test(e.name)) files.push(p);
  }
})(dataDir);
if (!files.length) die(EXIT.MISSING_GAME, `no JSON content files under ${dataDir}`);

const docs = [];
const parseErrors = [];
for (const f of files) {
  const rel = path.relative(dataDir, f).split(path.sep).join('/');
  try {
    const txt = fs.readFileSync(f, 'utf8');
    const val = f.endsWith('.jsonl')
      ? txt.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l))
      : JSON.parse(txt);
    docs.push({ rel, path: f, val });
  } catch (e) { parseErrors.push({ file: rel, error: e.message }); }
}

// ---------------------------------------------------------------- shape helpers
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const first = (o, keys) => { for (const k of keys) if (o && o[k] !== undefined && o[k] !== null) return o[k]; return undefined; };
const ID = ['id', 'key', 'name', 'slug', 'topic', 'questId'];
const TEXT = ['text', 'body', 'line', 'response', 'content', 'prose', 'entry', 'dialogue', 'say'];
const asArray = (v) => Array.isArray(v) ? v : (isObj(v) ? Object.entries(v).map(([k, x]) => (isObj(x) ? { id: k, ...x } : { id: k, text: x })) : []);

/** Collect every object in a document that looks like a record (has an id-ish field). */
function records(val, out = [], depth = 0) {
  if (depth > 8) return out;
  if (Array.isArray(val)) { for (const v of val) records(v, out, depth + 1); return out; }
  if (!isObj(val)) return out;
  if (first(val, ID) !== undefined) out.push(val);
  for (const v of Object.values(val)) if (v && typeof v === 'object') records(v, out, depth + 1);
  return out;
}

/** Every string in a subtree that reads like authored prose (not an identifier). */
function proseOf(val, out = [], depth = 0) {
  if (depth > 10) return out;
  if (typeof val === 'string') { if (/\s/.test(val) && val.trim().length > 12) out.push(val); return out; }
  if (Array.isArray(val)) { for (const v of val) proseOf(v, out, depth + 1); return out; }
  if (isObj(val)) for (const [k, v] of Object.entries(val)) { if (k === 'id' || k === 'key') continue; proseOf(v, out, depth + 1); }
  return out;
}

const classify = (rel, val) => {
  const p = rel.toLowerCase();
  if (/(^|\/)quest/.test(p)) return 'quests';
  if (/(^|\/)(dialog|dialogue|topic|greeting|rumour|rumor|conversation)/.test(p)) return 'dialogue';
  if (/(^|\/)(npc|actor|character|people)/.test(p)) return 'npcs';
  if (/(^|\/)(book|lore|text)/.test(p)) return 'books';
  if (/(^|\/)(item|weapon|armou?r|loot|ingredient)/.test(p)) return 'items';
  if (/(^|\/)(world|region|poi|settlement|interior|map|place|location)/.test(p)) return 'world';
  if (/(^|\/)(enemy|enemies|moveset|combat|statblock)/.test(p)) return 'combat';
  if (/(^|\/)(journal)/.test(p)) return 'journal';
  // shape fallbacks
  const recs = records(val);
  if (recs.some((r) => first(r, ['stages', 'steps', 'journal', 'objectives']))) return 'quests';
  if (recs.some((r) => first(r, ['topic', 'topics', 'responses', 'greetings']))) return 'dialogue';
  if (recs.some((r) => first(r, ['disposition', 'faction', 'class', 'race']))) return 'npcs';
  if (recs.some((r) => first(r, ['pois', 'settlements', 'region', 'bounds']))) return 'world';
  return 'unclassified';
};

const buckets = { quests: [], dialogue: [], npcs: [], books: [], items: [], world: [], combat: [], journal: [], unclassified: [] };
for (const d of docs) { const c = classify(d.rel, d.val); buckets[c].push(d); if (args.verbose) log(`${c.padEnd(13)} ${d.rel}`); }

// ---------------------------------------------------------------- text metrics
const STOP = new Set(('the a an and or but if then of to in on at by for with from as is are was were be been being it its this that these those i you he she they we me him her them us my your his their our not no yes do does did have has had will would can could shall should may might must so than there here when where what which who whom whose how why all any both each few more most other some such only own same too very s t don now'.split(' ')));
const words = (s) => (s || '').toLowerCase().replace(/[^a-z' -]+/g, ' ').split(/\s+/).filter((w) => w.length > 1);

function textStats(strings) {
  const all = strings.join(' ');
  const w = words(all);
  const uniq = new Set(w);
  const content = w.filter((x) => !STOP.has(x));
  return {
    strings: strings.length,
    words: w.length,
    unique_words: uniq.size,
    unique_content_words: new Set(content).size,
    type_token_ratio: w.length ? +(uniq.size / w.length).toFixed(4) : 0,
    mean_words_per_string: strings.length ? +(w.length / strings.length).toFixed(2) : 0,
  };
}

function properNouns(strings) {
  const freq = new Map();
  for (const s of strings) {
    const sentences = s.split(/(?<=[.!?])\s+/);
    for (const sent of sentences) {
      const toks = sent.split(/\s+/);
      for (let i = 0; i < toks.length; i++) {
        const t = toks[i].replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '');
        if (!t || t.length < 3) continue;
        if (!/^[A-Z][a-z'-]+$/.test(t)) continue;
        if (i === 0) continue;                      // sentence-initial: not evidence
        if (STOP.has(t.toLowerCase())) continue;
        freq.set(t, (freq.get(t) || 0) + 1);
      }
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  return { unique: sorted.length, total: sorted.reduce((s, [, c]) => s + c, 0), top: sorted.slice(0, 60).map(([w, c]) => ({ word: w, n: c })) };
}

// ---------------------------------------------------------------- dialogue + topic graph
const dialogueRecords = buckets.dialogue.flatMap((d) => records(d.val));
const npcRecords = buckets.npcs.flatMap((d) => records(d.val));
const npcById = new Map(npcRecords.map((n) => [String(first(n, ID)), n]));

const topics = new Map(); // id -> {id, texts[], links:Set, settlements:Set, npcs:Set}
for (const r of dialogueRecords) {
  const id = String(first(r, ['topic', 'id', 'key', 'name']) ?? '');
  if (!id) continue;
  if (!topics.has(id)) topics.set(id, { id, texts: [], links: new Set(), settlements: new Set(), npcs: new Set(), conditions: 0, root: false });
  const t = topics.get(id);
  const body = first(r, TEXT);
  if (typeof body === 'string') t.texts.push(body);
  for (const s of proseOf(first(r, ['responses', 'lines', 'variants']) ?? [])) t.texts.push(s);
  for (const l of asArray(first(r, ['links', 'unlocks', 'leadsTo', 'adds', 'addTopics', 'next', 'children']) ?? [])) {
    const lid = typeof l === 'string' ? l : String(first(l, ID) ?? '');
    if (lid) t.links.add(lid);
  }
  const settlement = first(r, ['settlement', 'town', 'location', 'place', 'region', 'city']);
  if (settlement) t.settlements.add(String(settlement));
  const speaker = first(r, ['npc', 'speaker', 'actor', 'who']);
  if (speaker) {
    t.npcs.add(String(speaker));
    const n = npcById.get(String(speaker));
    const s2 = n && first(n, ['settlement', 'town', 'location', 'home', 'region']);
    if (s2) t.settlements.add(String(s2));
  }
  if (first(r, ['condition', 'conditions', 'requires', 'req', 'filter'])) t.conditions++;
  if (first(r, ['root', 'isRoot', 'greeting']) || /greeting/i.test(id)) t.root = true;
}
// implicit links: a topic whose keyword appears inside another topic's prose (Morrowind-style discovery)
for (const [id, t] of topics) {
  const kw = id.toLowerCase().replace(/[_-]+/g, ' ');
  if (kw.length < 4) continue;
  for (const [oid, o] of topics) {
    if (oid === id) continue;
    if (o.texts.some((x) => x.toLowerCase().includes(kw))) o.links.add(id);
  }
}
const topicIds = [...topics.keys()];
const outDeg = topicIds.map((id) => [...topics.get(id).links].filter((l) => topics.has(l)).length);
const roots = topicIds.filter((id) => topics.get(id).root);
const rootSet = roots.length ? roots : topicIds.filter((id) => !topicIds.some((o) => o !== id && topics.get(o).links.has(id)));
// BFS depth + reachability
const depth = new Map();
{
  const q = rootSet.map((id) => [id, 0]);
  for (const [id] of q) depth.set(id, 0);
  while (q.length) {
    const [id, d] = q.shift();
    for (const l of topics.get(id)?.links || []) {
      if (!topics.has(l) || depth.has(l)) continue;
      depth.set(l, d + 1); q.push([l, d + 1]);
    }
  }
}
let cycles = 0;
for (const [id, t] of topics) for (const l of t.links) if (topics.has(l) && topics.get(l).links.has(id)) cycles++;

const bySettlement = {};
for (const t of topics.values()) {
  for (const s of (t.settlements.size ? t.settlements : new Set(['__unassigned']))) {
    bySettlement[s] = bySettlement[s] || [];
    bySettlement[s].push(...t.texts);
  }
}
const settlementDialogue = Object.fromEntries(Object.entries(bySettlement).map(([s, txts]) => [s, textStats(txts)]));
// cross-settlement distinctiveness: unique words present in exactly one settlement
const settlementVocab = Object.fromEntries(Object.entries(bySettlement).map(([s, t]) => [s, new Set(words(t.join(' ')).filter((w) => !STOP.has(w)))]));
const exclusivity = {};
for (const [s, v] of Object.entries(settlementVocab)) {
  let excl = 0;
  for (const w of v) if (!Object.entries(settlementVocab).some(([s2, v2]) => s2 !== s && v2.has(w))) excl++;
  exclusivity[s] = { vocab: v.size, exclusive_words: excl, exclusivity_ratio: v.size ? +(excl / v.size).toFixed(4) : 0 };
}

// ---------------------------------------------------------------- quests
const COMBAT_RE = /\b(kill|slay|slain|murder|destroy|defeat|exterminate|butcher|behead|assassinat)\w*/i;
const PEACEFUL_RE = /\b(persuade|bribe|convince|talk|negotiat|steal|sneak|pickpocket|forge|lie|deceive|trade|pay|barter|intimidat|charm|blackmail)\w*/i;
const questDocs = buckets.quests.flatMap((d) => records(d.val));
const quests = [];
for (const q of questDocs) {
  const id = String(first(q, ID) ?? '');
  const stages = asArray(first(q, ['stages', 'steps', 'phases']) ?? []);
  const outcomes = asArray(first(q, ['outcomes', 'resolutions', 'endings', 'branches']) ?? []);
  if (!stages.length && !outcomes.length) continue;
  const prose = proseOf(q);
  const text = prose.join(' ');
  const terminal = stages.filter((s) => first(s, ['terminal', 'final', 'end', 'isEnd']) === true
    || /\b(complete|finished|failed)\b/i.test(String(first(s, ['status', 'state']) ?? '')));
  const outcomeMethods = outcomes.map((o) => String(first(o, ['method', 'via', 'how', 'type']) ?? '')).filter(Boolean);
  const declaredPeaceful = outcomes.filter((o) => {
    const m = String(first(o, ['method', 'via', 'how', 'type']) ?? '').toLowerCase();
    const t = proseOf(o).join(' ');
    const flag = first(o, ['requiresCombat', 'combat']);
    if (flag === false) return true;
    if (flag === true) return false;
    if (m && PEACEFUL_RE.test(m)) return true;
    if (m && COMBAT_RE.test(m)) return false;
    return PEACEFUL_RE.test(t) && !COMBAT_RE.test(t);
  });
  const journal = asArray(first(q, ['journal', 'entries', 'log']) ?? [])
    .concat(stages.map((s) => first(s, ['journal', 'entry', 'log'])).filter(Boolean));
  const journalTexts = journal.map((j) => (typeof j === 'string' ? j : String(first(j, TEXT) ?? ''))).filter(Boolean);
  quests.push({
    id,
    stages: stages.length,
    outcomes: outcomes.length,
    terminal_stages: terminal.length,
    branch_count: Math.max(outcomes.length, terminal.length, countBranches(stages)),
    outcome_methods: outcomeMethods,
    peaceful_outcomes: declaredPeaceful.length,
    resolvable_without_combat: declaredPeaceful.length > 0
      || (first(q, ['requiresCombat']) === false)
      || (PEACEFUL_RE.test(text) && outcomes.length > 1),
    mutually_exclusive: !!first(q, ['mutuallyExclusive', 'exclusive', 'excludes']) || outcomes.length > 1,
    giver_lies: /\b(lie|lied|lying|deceiv|betray|double.cross|not the whole truth)\w*/i.test(text)
      || !!first(q, ['giverLies', 'unreliable', 'deceit']),
    journal_entries: journalTexts.length,
    journal_word_lengths: journalTexts.map((t) => words(t).length),
    has_marker: /\b(marker|waypoint|objective arrow|compass)\b/i.test(text) || !!first(q, ['marker', 'waypoint']),
    words: words(text).length,
  });
}
function countBranches(stages) {
  let n = 0;
  for (const s of stages) {
    const nx = first(s, ['next', 'choices', 'options', 'branches']);
    if (Array.isArray(nx) && nx.length > 1) n += nx.length - 1;
  }
  return n ? n + 1 : 0;
}
const allJournalLengths = quests.flatMap((q) => q.journal_word_lengths);

// ---------------------------------------------------------------- world
const worldRecords = buckets.world.flatMap((d) => records(d.val));
const POI_KINDS = /^(poi|site|ruin|camp|shrine|cave|dungeon|landmark|tomb|village|town|city|settlement|interior|house|shop|tavern|bonfire|dock|bridge|tower)$/i;
const regions = new Map();
let interiors = 0, settlements = 0, namedPois = 0, pois = 0;
for (const r of worldRecords) {
  const kind = String(first(r, ['kind', 'type', 'category', 'class']) ?? '');
  const region = String(first(r, ['region', 'zone', 'area', 'province']) ?? 'unassigned');
  const isPoi = POI_KINDS.test(kind) || first(r, ['pos', 'position', 'x']) !== undefined;
  if (!isPoi) continue;
  pois++;
  if (/interior|house|shop|tavern/i.test(kind)) interiors++;
  if (/village|town|city|settlement/i.test(kind)) settlements++;
  const nm = first(r, ['name', 'title', 'label']);
  if (nm && !/^[a-z0-9_]+$/.test(String(nm))) namedPois++;
  regions.set(region, (regions.get(region) || 0) + 1);
}

// ---------------------------------------------------------------- books / lore
const bookRecords = buckets.books.flatMap((d) => records(d.val));
const bookTexts = bookRecords.map((b) => proseOf(b).join(' ')).filter((t) => t.length > 40);
const allProse = [
  ...dialogueRecords.flatMap((r) => proseOf(r)),
  ...questDocs.flatMap((r) => proseOf(r)),
  ...bookTexts,
];

// ---------------------------------------------------------------- assemble
const out = {
  schema: 'elder-souls/content-stats@1',
  computed_at: new Date().toISOString(),
  data_root: dataDir,
  data_hash: hashDataTree(dataDir),
  files: { total: files.length, parse_errors: parseErrors },
  coverage: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.map((d) => d.rel)])),
  dialogue: {
    topic_records: dialogueRecords.length,
    npc_records: npcRecords.length,
    text: textStats(dialogueRecords.flatMap((r) => proseOf(r))),
    per_settlement: settlementDialogue,
    settlement_exclusivity: exclusivity,
    settlements_with_dialogue: Object.keys(bySettlement).filter((k) => k !== '__unassigned').length,
    unassigned_topics: topicIds.filter((id) => topics.get(id).settlements.size === 0).length,
  },
  topic_graph: {
    nodes: topicIds.length,
    edges: outDeg.reduce((s, x) => s + x, 0),
    out_degree: summarise(outDeg),
    out_degree_entropy_bits: +entropyOf(outDeg.reduce((a, d) => { a[d] = (a[d] || 0) + 1; return a; }, {})).toFixed(4),
    roots: rootSet.length,
    max_depth: depth.size ? Math.max(...depth.values()) : 0,
    depth_distribution: summarise([...depth.values()]),
    reachable: depth.size,
    reachable_frac: topicIds.length ? +(depth.size / topicIds.length).toFixed(4) : 0,
    orphans: topicIds.filter((id) => !depth.has(id)),
    conditional_topics: [...topics.values()].filter((t) => t.conditions > 0).length,
    reciprocal_edges: cycles,
  },
  quests: {
    count: quests.length,
    stages: summarise(quests.map((q) => q.stages)),
    branches: summarise(quests.map((q) => q.branch_count)),
    with_multiple_outcomes: quests.filter((q) => q.outcomes > 1).length,
    resolvable_without_combat: quests.filter((q) => q.resolvable_without_combat).length,
    pct_resolvable_without_combat: quests.length
      ? +((quests.filter((q) => q.resolvable_without_combat).length / quests.length) * 100).toFixed(2) : null,
    mutually_exclusive: quests.filter((q) => q.mutually_exclusive).length,
    giver_lies: quests.filter((q) => q.giver_lies).length,
    with_objective_markers: quests.filter((q) => q.has_marker).length,
    per_quest: quests,
  },
  journal: {
    entries: allJournalLengths.length,
    word_lengths: summarise(allJournalLengths),
    histogram: bucketise(allJournalLengths, [0, 10, 20, 40, 60, 100, 200]),
  },
  world: {
    pois: pois,
    named_pois: namedPois,
    named_ratio: pois ? +(namedPois / pois).toFixed(4) : null,
    settlements,
    interiors,
    regions: Object.fromEntries([...regions.entries()].sort((a, b) => b[1] - a[1])),
    region_count: regions.size,
    pois_per_region: summarise([...regions.values()]),
  },
  lore: {
    books: bookTexts.length,
    book_word_lengths: summarise(bookTexts.map((t) => words(t).length)),
    proper_nouns: properNouns(allProse),
    total_authored_words: words(allProse.join(' ')).length,
  },
};

function bucketise(arr, edges) {
  const out = {};
  for (let i = 0; i < edges.length; i++) {
    const lo = edges[i], hi = edges[i + 1];
    const label = hi === undefined ? `${lo}+` : `${lo}-${hi - 1}`;
    out[label] = arr.filter((v) => v >= lo && (hi === undefined || v < hi)).length;
  }
  return out;
}

const outPath = args.out ? path.resolve(String(args.out)) : path.join(path.resolve(dataDir, '../..'), 'reports', 'content-stats.json');
writeJson(outPath, out);
log(`files=${files.length} topics=${out.topic_graph.nodes} quests=${out.quests.count} pois=${out.world.pois} ` +
    `unclassified=${buckets.unclassified.length}`);
if (buckets.unclassified.length) log(`unclassified: ${buckets.unclassified.map((d) => d.rel).join(', ')}`);
if (args.json) process.stdout.write(JSON.stringify(out, null, 2) + '\n');
else process.stdout.write(outPath + '\n');
