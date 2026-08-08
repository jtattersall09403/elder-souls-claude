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
  const advertised = loadAdvertisedTopics();
  const noWayIn = (n) => (inDeg.get(n) || 0) === 0 && !roots.has(n) && !journalAdded.has(n);
  const orphansNpcAdvertised = [...nodes].filter((n) => noWayIn(n) && advertised.has(topicFold(n)));
  const orphans = [...nodes].filter((n) => noWayIn(n) && !advertised.has(topicFold(n)));

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
    orphans_npc_advertised: orphansNpcAdvertised,
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
  if (bad) { console.error(`\nFAIL: ${errors.length} dangling edges, ${orphans.length} orphans, ${unreachable.length} unreachable INFOs  (+${orphansNpcAdvertised.length} reachable only because a speaker advertises them)`); process.exit(1); }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) main();
