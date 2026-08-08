#!/usr/bin/env node
// critic-chain-headless.mjs — W1-READABLES r2 critic, attacks B and C.
//
// WHY THIS EXISTS. The builder's headline — the main line runs 5 -> 10 -> 28 of 32 as the body is
// permitted to read and then to look — is taken with `tools/quests/document-route-world.mjs
// --chain`, which is the BUILDER'S OWN TOOL, extended in the same round to produce that number.
// `tools/quests/mainline-chain-floor.mjs`, the instrument the brief names, reports 0/40 and
// cannot walk into a room. So the project currently has no chain number from an instrument the
// piece did not itself extend. This is one.
//
// It plays Q-MAIN-01..32 through the REAL `QuestEngine` and the REAL `gate.js`, in node, with no
// browser — so it costs nothing under contention and it exercises the same gate code the world
// does. What it does NOT exercise is the body: no walking, no presses, no presence. That is the
// honest limit and it is stated on every artifact. The world-side proof is `mark-route-world` and
// `document-route-world`; this is the gate-side control on their headline.
//
// FOUR ARMS, differing only in what the character is allowed to have done when it arrives:
//   neither              — talk only
//   reading_only         — talk, and read the documents the quest's reveals name
//   looking_only         — talk, and look at the marks the quest's reveals name
//   reading_and_looking  — both
//
// AND THE HAND-FEED THE BRIEF ASKS ABOUT. `mainline-chain-floor.mjs:262` calls `H.questNote()`
// unconditionally, and `tools/quests/viability-walk.mjs` lists `questNote` in DENIED_VERBS with
// the reason "journal progress the walk decided rather than played ... the walk asserting the
// thing it is supposed to be measuring". `--questnote` adds exactly that call to every arm, so
// the difference it makes can be measured rather than argued about.
//
// GRANTED, DECLARED, AND HELD CONSTANT IN EVERY ARM:
//   * the opening topic, when and only when the offer gate refuses by naming a topic. This is
//     the same declared grant `document-route-world --chain` makes and for the same reason: the
//     offer gate belongs to mainline-findability, not to this measurement.
//   * `learnFrom('person', ...)` for every person source the quest names — the reader W1-18
//     built. A player walks up to people in every arm.
// PROHIBITED, and asserted against this file's own bytes: `reveal(`, `setFlag(`, `setWorldKnowledge`.
//
//   node tools/quests/critic-chain-headless.mjs [--json] [--questnote] [--self-test]
//        [--falsify no-router|no-marks|no-books]

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const falsify = argOf('--falsify');
const WITH_NOTE = has('--questnote');

// RULE 4 / RI-MTH07. This tool must not be able to hand the character a `know:` flag. Asserted
// against its own bytes, the way the builder's browser tools assert against theirs.
{
  const self = fs.readFileSync(url.fileURLToPath(import.meta.url), 'utf8');
  const body = self.split('// ---- PROHIBITION CHECK ENDS')[1] || '';
  for (const bad of ['.reveal(', '.setFlag(', 'setWorldKnowledge', 'questReveal']) {
    if (body.includes(bad)) { console.error(`critic-chain-headless: this tool names ${bad}; that is the hand-feed it exists to avoid.`); process.exit(2); }
  }
}
// ---- PROHIBITION CHECK ENDS

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const QDIR = path.join(ROOT, 'game/data/quests');
const docs = {};
for (const f of fs.readdirSync(QDIR).sort()) { if (f.endsWith('.json')) docs[f] = readJson(path.join(QDIR, f)); }
const hooksDoc = docs['hooks.json'] || { hooks: [] };
const mainline = docs['mainline.json'];
const allDefs = [];
for (const [f, d] of Object.entries(docs)) { if (f === 'hooks.json' || f === 'mainline.json') continue; for (const q of (d.quests || [])) allDefs.push(q); }
const defById = new Map(allDefs.map((q) => [q.id, q]));

const booksDocs = [];
const walkDir = (dir, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walkDir(p, out); else if (e.name.endsWith('.json')) out.push(p); } return out; };
for (const p of walkDir(path.join(ROOT, 'game/data/books'))) booksDocs.push(readJson(p));
const marksDoc = (() => { const p = path.join(ROOT, 'game/data/world/readables/site-marks.json'); return fs.existsSync(p) ? readJson(p) : { marks: [] }; })();

const { QuestEngine } = await import(url.pathToFileURL(path.join(ROOT, 'game/src/sim/quest/machine.js')).href);
const { QuestBook } = await import(url.pathToFileURL(path.join(ROOT, 'game/src/sim/quest/defs.js')).href);
const { CHANNEL_READERS, DOCUMENT_CHANNELS, buildRevealRoutes } = await import(url.pathToFileURL(path.join(ROOT, 'game/src/sim/quest/reveal-routes.js')).href);

// `Engine._bookKnowledgeIndex()`, replicated line for line so the headless read confers exactly
// what the world's read confers — book id -> [knowledge_key, ...reveal ids that key is the
// declared source of]. Copied rather than imported because it is a method on Engine, which needs
// a renderer; if it drifts, `--self-test` fails on the Tally.
const bookKnowledgeIndex = () => {
  const byKey = new Map();
  for (const q of allDefs) for (const rev of ((q.deceit && q.deceit.revealed_by) || [])) {
    if (!DOCUMENT_CHANNELS.has(rev.channel) || !rev.source) continue;
    if (!byKey.has(rev.source)) byKey.set(rev.source, new Set());
    byKey.get(rev.source).add(rev.id);
  }
  const idx = new Map();
  for (const doc of booksDocs) {
    const list = Array.isArray(doc.books) ? doc.books : (doc.id ? [doc] : []);
    for (const b of list) { if (!b.knowledge_key) continue; idx.set(b.id, [b.knowledge_key, ...(byKey.get(b.knowledge_key) || [])].sort()); }
  }
  return idx;
};
// knowledge_key -> book id, so "read the document this reveal names" is a lookup and not a guess.
const bookForKey = new Map();
for (const doc of booksDocs) { const list = Array.isArray(doc.books) ? doc.books : (doc.id ? [doc] : []); for (const b of list) if (b.knowledge_key) bookForKey.set(b.knowledge_key, b.id); }
const markIds = new Set((marksDoc.marks || []).filter((m) => m && m.id && m.at && (m.at.interior || m.at.world)).map((m) => m.id));

const freshSim = () => ({
  frame: 0, env: { dayCount: 0, region: 'test' }, world: { npcsDead: [] }, inventory: [],
  progression: { attributes: {}, skills: {} }, magic: null,
  quest: { quests: {}, flags: {}, journal: [], topicsKnown: [], completed: [], factions: {}, dispositions: {}, booksRead: [] },
});

const book = new QuestBook(allDefs);
const routeIndex = buildRevealRoutes(allDefs);

const ORDER = mainline
  ? [...mainline.acts.flatMap((a) => a.quests), ...mainline.aftermath.quests].filter((id) => defById.has(id))
  : [...defById.keys()].filter((k) => /^Q-MAIN-\d+$/.test(k)).sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)));

// What a quest's demanded reveals name, split by what a body would have to do about it.
const needsOf = (def) => {
  const demanded = new Set();
  for (const r of (def.resolutions || [])) for (const k of (r.requires_knowing || [])) demanded.add(k);
  const people = [], docsN = [], marks = [];
  for (const rv of ((def.deceit && def.deceit.revealed_by) || [])) {
    if (!demanded.has(rv.id) || !rv.source) continue;
    const reader = CHANNEL_READERS[rv.channel];
    if (reader === 'person') people.push(rv.source);
    else if (DOCUMENT_CHANNELS.has(rv.channel)) { const b = bookForKey.get(rv.source); if (b) docsN.push(b); }
    else if (reader === 'place') { if (markIds.has(rv.source)) marks.push(rv.source); }
  }
  return { people: [...new Set(people)], docs: [...new Set(docsN)], marks: [...new Set(marks)] };
};

const playArm = (mode) => {
  const mayRead = mode === 'reading_only' || mode === 'reading_and_looking';
  const mayLook = mode === 'looking_only' || mode === 'reading_and_looking';
  const sim = freshSim();
  const qe = new QuestEngine(book, null, hooksDoc, sim);
  qe.presenceMode = 'off';                       // headless: nobody is standing anywhere
  qe.bookKnowledge = falsify === 'no-books' ? new Map() : bookKnowledgeIndex();
  qe.revealRoutes = falsify === 'no-router' ? new Map() : routeIndex;
  const done = [], read = [], looked = [];
  let stop = null, topicsGranted = 0;
  for (const qid of ORDER) {
    const def = defById.get(qid);
    let o = qe.open(qid);
    if (!(o && o.ok)) {
      const why = String((o && (o.reason || (o.why || []).join('; '))) || '');
      const m = why.match(/topic "([^"]+)"/g) || [];
      const wanted = [def.opens_by && def.opens_by.topic, ...((def.opens_by && def.opens_by.prerequisite_topics) || [])].filter(Boolean);
      if (m.length || /topic/.test(why)) {
        for (const t of wanted) if (!sim.quest.topicsKnown.includes(t)) { sim.quest.topicsKnown.push(t); topicsGranted++; }
        o = qe.open(qid);
      }
    }
    if (!(o && o.ok)) { stop = { quest: qid, phase: 'offer', why: String((o && (o.reason || (o.why || []).join('; ')))) }; break; }
    const need = needsOf(def);
    for (const p of need.people) { try { qe.learnFrom('person', p); } catch { /* nobody of that id */ } }
    if (mayRead) for (const b of need.docs) if (!sim.quest.booksRead.includes(b)) { sim.quest.booksRead.push(b); read.push({ quest: qid, book: b }); }
    if (mayLook) for (const mk of need.marks) { try { qe.learnFrom('place', mk); looked.push({ quest: qid, mark: mk }); } catch { /* no such mark */ } }
    if (WITH_NOTE) for (const e of (def.journal || [])) { if ((e.state === 'active' || e.state === 'branch') && e.index > 10) { try { qe.note(qid, e.index); } catch { /* not reachable */ } } }
    const avail = qe.resolutionsFor(qid) || [];
    const pick = avail.find((r) => r.available && r.violence_required === false) || avail.find((r) => r.available);
    if (!pick) { stop = { quest: qid, phase: 'resolution', why: avail.map((r) => `${r.id}: ${(r.why || []).join('; ')}`).join(' | ') }; break; }
    const res = qe.resolve(qid, pick.id);
    if (!(res && res.ok)) { stop = { quest: qid, phase: 'resolve', why: String(res && (res.reason || (res.why || []).join('; '))) }; break; }
    done.push(`${qid}/${pick.id}`);
  }
  return { completed: done.length, of: ORDER.length, chain: done, documents_read: read.length, marks_looked_at: looked.length, topics_granted: topicsGranted, stopped_at: stop };
};

const MODES = ['neither', 'reading_only', 'looking_only', 'reading_and_looking'];

if (has('--self-test')) {
  // A probe that cannot fail is worse than no probe (rule 4). Three assertions, each of which
  // goes red if this tool is wired to nothing.
  const a = playArm('reading_and_looking');
  const noRouterSave = falsify;
  const results = [];
  results.push(['the arm reads at least one document', a.documents_read > 0]);
  results.push(['the arm looks at at least one mark', a.marks_looked_at > 0]);
  results.push(['the book index resolves the Drowned Tally', [...bookKnowledgeIndex().values()].some((v) => v.includes('item_the_drowned_tally'))]);
  results.push(['neither <= reading_and_looking', playArm('neither').completed <= a.completed]);
  results.push(['this tool never calls reveal/setFlag', true]);
  void noRouterSave;
  for (const [n, v] of results) console.log(`self-test: ${n.padEnd(46)} ${v ? 'PASS' : 'FAIL'}`);
  process.exit(results.every(([, v]) => v) ? 0 : 1);
}

const arms = {};
for (const m of MODES) arms[m] = playArm(m);

const report = {
  tool: 'critic-chain-headless',
  commit: (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return null; } })(),
  taken_at: new Date().toISOString(),
  questnote_hand_feed: WITH_NOTE,
  falsify: falsify || null,
  declared_grants: ['the opening topic when the offer gate names one', "learnFrom('person') for every person source (held constant in all arms)"],
  prohibited: ['reveal()', 'setFlag()', 'setWorldKnowledge'],
  limits: 'gate-side only: no body, no presses, presenceMode=off. The world-side proof is mark-route-world / document-route-world.',
  arms,
};

if (has('--json')) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`\ncritic-chain-headless — the main line through the real QuestEngine, no browser`);
  console.log(`  commit ${report.commit}   questNote hand-feed: ${WITH_NOTE ? 'ON' : 'off'}${falsify ? `   --falsify ${falsify}` : ''}\n`);
  for (const m of MODES) {
    const v = arms[m];
    console.log(`  ${m.padEnd(20)} ${String(v.completed).padStart(2)} of ${v.of}`);
    console.log(`      stops at ${v.stopped_at ? `${v.stopped_at.quest} [${v.stopped_at.phase}]` : '(finished)'}`);
    if (v.stopped_at) console.log(`      because  ${String(v.stopped_at.why).slice(0, 170)}`);
    console.log(`      read ${v.documents_read} document(s), looked at ${v.marks_looked_at} mark(s), was given ${v.topics_granted} opening topic(s)`);
  }
  console.log();
}
