#!/usr/bin/env node
// Content integrity for the quest layer, checked over the JSON with no engine and no browser.
//
// Why this exists. These checks used to throw from `new QuestEngine(...)`, which meant a hook
// naming a quest that had not been authored yet did not fail the author — it failed *everybody*,
// because the engine then refused to construct and every agent on the box boot-checks before it
// measures. That happened four times in one day. The checks are right; the place was wrong. A
// dangling reference should fail the commit, not thirteen concurrent measurements.
//
// Exits non-zero on any problem. Run it directly to see the whole list.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const QDIR = join(ROOT, 'game', 'data', 'quests');
const problems = [];

function readJSON(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch (e) { problems.push(`${p.slice(ROOT.length + 1)}: not readable as JSON — ${e.message}`); return null; }
}

// ---- the quest book ----------------------------------------------------------------------
const quests = new Map();          // id -> quest
const sourceOf = new Map();        // id -> file it came from
if (!existsSync(QDIR)) { console.error('check-quests: game/data/quests does not exist'); process.exit(2); }
for (const f of readdirSync(QDIR).filter((f) => f.endsWith('.json'))) {
  const doc = readJSON(join(QDIR, f));
  if (!doc) continue;
  const list = Array.isArray(doc) ? doc : (doc.quests || []);
  for (const q of list) {
    if (!q || typeof q.id !== 'string') { problems.push(`${f}: a quest with no id`); continue; }
    if (quests.has(q.id)) { problems.push(`${q.id}: defined twice (${sourceOf.get(q.id)} and ${f})`); continue; }
    quests.set(q.id, q);
    sourceOf.set(q.id, f);
  }
}
const journalHas = (q, ix) => (q.journal || []).some((e) => e.index === Number(ix));

// ---- hooks.json --------------------------------------------------------------------------
const hooksPath = join(QDIR, 'hooks.json');
const hooks = existsSync(hooksPath) ? readJSON(hooksPath) : null;
if (hooks) {
  for (const h of hooks.hooks || []) {
    if (!h.quest) continue;
    const q = quests.get(h.quest);
    if (!q) { problems.push(`hooks.json: flag "${h.flag}" -> ${h.quest}, which is not a quest in game/data/quests/**`); continue; }
    if (h.journal != null && !journalHas(q, h.journal)) {
      problems.push(`hooks.json: flag "${h.flag}" -> ${h.quest}#${h.journal}, an entry ${sourceOf.get(h.quest)} does not contain`);
    }
  }
  for (const t of hooks.entry_topics || []) {
    const q = quests.get(t.quest);
    if (!q) { problems.push(`hooks.json entry_topics: ${t.quest}#${t.index} names no quest`); continue; }
    if (!journalHas(q, t.index)) problems.push(`hooks.json entry_topics: ${t.quest}#${t.index} is not an entry in ${sourceOf.get(t.quest)}`);
  }

  // RI-DLG05 §A.3: "Every quest chain must have >= 1 such edge." A quest that seeds no topic
  // from a journal write is a quest the player can be doing and cannot ask anybody about.
  const seeded = new Set((hooks.entry_topics || []).map((t) => t.quest));
  const mute = [...quests.keys()].filter((id) => !seeded.has(id)).sort();
  if (mute.length) {
    problems.push(`hooks.json: ${mute.length} quest(s) seed no topic from a journal write (RI-DLG05 §A.3): ${mute.slice(0, 12).join(', ')}${mute.length > 12 ? ' …' : ''}`);
  }
}

// ---- deceit.revealed_by[].journal (AM-QST04-W1-18-02) -------------------------------------
//
// The authored link from "the player learned this truth" to "this is the entry in which they
// wrote it down". `QuestEngine.learnFrom()` writes it through `note()`, and `note()` throws on an
// index the quest does not have and refuses a terminal entry — so both mistakes belong here,
// where they fail the commit, rather than inside a world action every agent's boot-check walks
// through. Same reasoning as the hooks block above; RULES.md rules 13 and 14.
function revealJournalProblems(book) {
  const out = [];
  for (const q of book) {
    for (const rev of ((q.deceit && q.deceit.revealed_by) || [])) {
      if (rev.journal == null) continue;
      const e = (q.journal || []).find((x) => x.index === Number(rev.journal));
      if (!e) { out.push(`${q.id}: reveal "${rev.id}" declares journal ${rev.journal}, an entry the file does not contain`); continue; }
      if (e.state === 'success' || e.state === 'failure') {
        out.push(`${q.id}: reveal "${rev.id}" declares journal ${rev.journal}, which is state "${e.state}" — note() refuses terminal entries, so the entry would never be written`);
      }
    }
  }
  return out;
}
problems.push(...revealJournalProblems([...quests.values()]));

// ---- self-test ---------------------------------------------------------------------------
// A check that cannot fail is worse than no check. `--self-test` proves each rule goes red by
// feeding it a book and a hooks document that violate exactly that rule and nothing else.
if (process.argv.includes('--self-test')) {
  const cases = [
    ['dangling quest', () => { const h = { hooks: [{ flag: 'f', quest: 'Q-NOPE', journal: 1 }] }; return checkAgainst(h, [{ id: 'Q-REAL', journal: [{ index: 1 }] }]); }],
    ['dangling journal index', () => checkAgainst({ hooks: [{ flag: 'f', quest: 'Q-REAL', journal: 9 }] }, [{ id: 'Q-REAL', journal: [{ index: 1 }] }])],
    ['entry topic on no quest', () => checkAgainst({ entry_topics: [{ quest: 'Q-NOPE', index: 1, adds_topics: [] }] }, [{ id: 'Q-REAL', journal: [{ index: 1 }] }])],
    ['entry topic on a missing index', () => checkAgainst({ entry_topics: [{ quest: 'Q-REAL', index: 4, adds_topics: [] }] }, [{ id: 'Q-REAL', journal: [{ index: 1 }] }])],
    ['a mute quest', () => checkAgainst({ entry_topics: [] }, [{ id: 'Q-REAL', journal: [{ index: 1 }] }])],
    ['a clean book stays clean', () => !checkAgainst({ entry_topics: [{ quest: 'Q-REAL', index: 1, adds_topics: ['t'] }] }, [{ id: 'Q-REAL', journal: [{ index: 1 }] }])],
    // AM-QST04-W1-18-02
    ['reveal journal index that does not exist', () => revealJournalProblems([{ id: 'Q-REAL', journal: [{ index: 1, state: 'active' }], deceit: { revealed_by: [{ id: 'r', journal: 9 }] } }]).length > 0],
    ['reveal journal index that is terminal', () => revealJournalProblems([{ id: 'Q-REAL', journal: [{ index: 90, state: 'success' }], deceit: { revealed_by: [{ id: 'r', journal: 90 }] } }]).length > 0],
    ['a reveal with no journal index is fine', () => revealJournalProblems([{ id: 'Q-REAL', journal: [{ index: 1, state: 'active' }], deceit: { revealed_by: [{ id: 'r' }] } }]).length === 0],
    ['a good reveal journal index is fine', () => revealJournalProblems([{ id: 'Q-REAL', journal: [{ index: 1, state: 'active' }], deceit: { revealed_by: [{ id: 'r', journal: 1 }] } }]).length === 0],
  ];
  let bad = 0;
  for (const [name, run] of cases) {
    const red = run();
    if (!red) { console.error(`check-quests --self-test: "${name}" did NOT go red`); bad++; }
  }
  console.log(`check-quests --self-test: ${cases.length - bad}/${cases.length}`);
  process.exit(bad ? 1 : 0);
}

function checkAgainst(hooksDoc, book) {
  const by = new Map(book.map((q) => [q.id, q]));
  const out = [];
  for (const h of hooksDoc.hooks || []) {
    const q = by.get(h.quest);
    if (!q) { out.push('dangling quest'); continue; }
    if (h.journal != null && !journalHas(q, h.journal)) out.push('dangling index');
  }
  for (const t of hooksDoc.entry_topics || []) {
    const q = by.get(t.quest);
    if (!q) { out.push('entry topic on no quest'); continue; }
    if (!journalHas(q, t.index)) out.push('entry topic on a missing index');
  }
  const seeded = new Set((hooksDoc.entry_topics || []).map((t) => t.quest));
  if ([...by.keys()].some((id) => !seeded.has(id))) out.push('mute quest');
  return out.length > 0;
}

// ---- a resolution nobody can reach: the attribute scale, and skills that do not exist ---------
//
// Two shapes of the same defect, and the second one was found three separate times by three
// builders who were each looking for something else.
//
// 1. A SKILL ID THAT DOES NOT EXIST. Found by W1-LIBRARY round 2 while proving that reading a
//    book opens the three non-violent lore resolutions. It does — and two of the three then
//    gated on `scribing` (no such skill; the register has nineteen and none is scribing) and
//    `root_speech` (the skill is `root-speech`, with a hyphen — `root_speech` is the *school*
//    id in game/data/magic/effects.json, one underscore away). `gate.js canResolve()` looks the
//    key up verbatim, finds nothing, and reports `root_speech 0/45` forever.
//    The class turned out to be **eleven**, not two, and nine of them came from one identity
//    entry in `tools/analysis/gen-magic-quests.mjs`'s school->skill map.
//
// 2. AN ATTRIBUTE DEMAND ON THE WRONG SCALE. Quest demands were authored on Morrowind's 0-100
//    attribute scale. Attributes here are worth `creation + 6 per governing skill` and no more
//    (`character/derive.js:359`), so personality tops out at 18/22/31 across the p10, median and
//    best of 240 measured signatures. `personality: 45` is not hard; it is unreachable by every
//    character the game can create. And clamping such a demand TO the ceiling is the same defect
//    one point lower — W1-19 round 1 did exactly that and shut Act IV for 11 of 40 signatures.
//
// `tools/quests/attr-scale-audit.mjs` owns both, computes its bands from the measured sweep
// rather than from any written-down number, and has a `--self-test` that goes red on each rule.
//
// WARNING, NOT AN ERROR, AND DELIBERATELY SO. The quest data is another item's to change, and a
// fail-closed assertion landed here would turn `check-quests` red for every agent on the box over
// content none of them owns — the exact failure this project has already paid for twice. It
// prints loudly and exits 0. Run the audit directly for the full table and a non-zero exit.
{
  const sweepPath = join(ROOT, 'reports', 'faction-signature-sweep.json');
  const skillsPath = join(ROOT, 'game', 'data', 'progression', 'skills.json');
  if (existsSync(sweepPath) && existsSync(skillsPath)) {
    try {
      const { audit } = await import('./quests/attr-scale-audit.mjs');
      const book = [];
      for (const [id, q] of quests) book.push({ file: sourceOf.get(id), quest: q });
      const rep = audit(book, readJSON(sweepPath), readJSON(skillsPath), 'p10');
      if (rep.defects.length) {
        console.warn(`check-quests: WARNING — ${rep.defects.length} quest demand(s) sit outside a band any real character reaches.`);
        console.warn('  A gate nobody can meet is a resolution no player can ever take; run');
        console.warn('  `node tools/quests/attr-scale-audit.mjs` for the bands and the reserve.');
        for (const d of rep.defects) {
          const why = d.kind === 'skill'
            ? (d.near ? `did you mean '${d.near}'?` : 'no skill of that name exists in progression/skills.json')
            : `measured ceiling ${d.caps.no_reserve} on a median sheet / ${d.caps.max_only} on the best of 240; hard cap ${d.caps.dedicated}`;
          console.warn(`  [${d.band}] ${d.file}: ${d.quest} ${d.resolution} requires ${d.key} ${d.need} — ${why}`);
        }
      }
      if (rep.non_combat.nonviolent_resolutions_shut_by_defect) {
        console.warn(`check-quests: WARNING — ${rep.non_combat.nonviolent_resolutions_shut_by_defect} non-violent resolution(s) are shut for EVERY character by one of the above.`);
        console.warn('  ARBITRATION.md requires a non-lethal exit from any fight with a person; each of these');
        console.warn('  silently converts a talkable quest into a violent one.');
      }
      for (const l of rep.ladders.filter((x) => !x.monotone)) {
        console.warn(`check-quests: WARNING — ${l.line}'s ${l.attribute} ladder is not ordered: ${l.inversions.join('; ')}`);
      }
    } catch (e) {
      console.warn(`check-quests: could not run the attribute-scale audit — ${e.message}`);
    }
  }
}

// ---- GAP-FCT-02: the resolution `method` vocabulary is closed -----------------------------
// The build's only violence-consistency guard (`sim/quest/defs.js`) works by membership in
// `RES_METHODS_NONVIOLENT`, so a method value it has never heard of used to be waved through
// silently — which blinded it to 38 of 383 resolutions. The engine now reports an unknown method
// as a problem in its own right; this repeats it here so a drift fails the commit and not just
// the boot. `tools/quests/method-guard-control.mjs` breaks the guard on purpose and proves it
// still goes red.
{
  const { RES_METHODS_KNOWN } = await import('../game/src/sim/quest/defs.js');
  const unknown = new Map();
  for (const [id, q] of quests) {
    for (const r of q.resolutions || []) {
      if (r.method == null || RES_METHODS_KNOWN.has(r.method)) continue;
      if (!unknown.has(r.method)) unknown.set(r.method, []);
      unknown.get(r.method).push(`${id}.${r.id}`);
    }
  }
  for (const [m, where] of [...unknown].sort()) {
    problems.push(`resolution method ${JSON.stringify(m)} is not in the declared vocabulary (${where.length} resolution(s), e.g. ${where[0]}) — the violence guard cannot see it. Declare it in RES_METHODS_NONVIOLENT or RES_METHODS_VIOLENT in game/src/sim/quest/defs.js (GAP-FCT-02).`);
  }
}

// ---- W1-READABLES: a document channel whose document is not an object -----------------------
// `deceit.revealed_by[].channel` of `book`, `ledger` or `letter` says the truth arrives by
// reading a thing somebody wrote, and `.source` names the thing. Two ways for that to be a route
// to nothing, and they are different jobs: no document of that id exists in `game/data/books/**`
// at all, or one exists and is an object in no room, so the only way to open it is the harness
// door. Both are reported here.
//
// WARNING, NOT AN ERROR, for the same reason as the attribute-scale audit above and RULES.md
// rule 13: 24 of the 39 demanded document rows have no text written for them on this tree, and a
// fail-closed assertion would take `check-quests` red for every agent on the box over content
// nobody has written yet. The standing tool with the full table and a non-zero exit is
// `tools/quests/reveal-route-audit.mjs`.
{
  const DOC_CHANNELS = new Set(['book', 'ledger', 'letter']);
  const bookById = new Map();
  const bdir = join(ROOT, 'game', 'data', 'books');
  if (existsSync(bdir)) {
    for (const f of readdirSync(bdir).filter((x) => x.endsWith('.json'))) {
      const j = readJSON(join(bdir, f));
      for (const b of (Array.isArray(j.books) ? j.books : (j.id ? [j] : []))) {
        if (!b.id) continue;
        bookById.set(b.id, b.id);
        if (b.knowledge_key) bookById.set(b.knowledge_key, b.id);
      }
    }
  }
  const placed = new Set();
  const idir = join(ROOT, 'game', 'data', 'world', 'interiors');
  if (existsSync(idir)) {
    for (const f of readdirSync(idir).filter((x) => x.endsWith('.json'))) {
      const rec = readJSON(join(idir, f));
      const list = Array.isArray(rec.readable) ? rec.readable : (rec.readable ? [rec.readable] : []);
      for (const r of list) if (r && r.book) placed.add(r.book);
    }
  }
  const itdir = join(ROOT, 'game', 'data', 'items');
  if (existsSync(itdir)) {
    for (const f of readdirSync(itdir).filter((x) => x.endsWith('.json'))) {
      for (const it of (readJSON(join(itdir, f)).items || [])) if (it && it.readable && it.book_id) placed.add(it.book_id);
    }
  }
  const missing = [], unplaced = [];
  for (const [id, q] of quests) {
    const demanded = new Set();
    for (const r of q.resolutions || []) for (const k of (r.requires_knowing || [])) demanded.add(k);
    for (const rev of ((q.deceit && q.deceit.revealed_by) || [])) {
      if (!DOC_CHANNELS.has(rev.channel) || !rev.source) continue;
      const where = `${sourceOf.get(id)}: ${id}.${rev.id} (${rev.channel})`;
      const dem = demanded.has(rev.id) ? '' : ' [not demanded by any resolution]';
      if (!bookById.has(rev.source)) missing.push(`${where} names ${rev.source}${dem}`);
      else if (!placed.has(bookById.get(rev.source))) unplaced.push(`${where} names ${rev.source} — written, in no room${dem}`);
    }
  }
  if (missing.length) {
    console.warn(`check-quests: WARNING — ${missing.length} document reveal(s) name a source with no document written for it.`);
    console.warn('  A reader wired to a source that does not exist is a route to nothing; see');
    console.warn('  `node tools/quests/reveal-route-audit.mjs` section A.2.');
    for (const m of missing) console.warn(`  ${m}`);
  }
  if (unplaced.length) {
    console.warn(`check-quests: WARNING — ${unplaced.length} document reveal(s) name a document that is an object in no room.`);
    console.warn('  It can then be opened only through openMenu(), which is the harness door and not a player.');
    for (const m of unplaced) console.warn(`  ${m}`);
  }
}

// ---- W1-READABLES round 2: an `environment` reveal whose mark is not an object ---------------
// `deceit.revealed_by[].channel === 'environment'` says the truth is learned by looking at a
// thing that is there, and `.source` names the thing. `game/data/world/readables/site-marks.json`
// is where the thing is, and `Engine._takePropPending()` reads it. Three ways for the row to be
// a route to nothing: no mark of that id, a mark that names no place, or a mark placed inside a
// room where a player cannot press it — within 4 m of `continuity.interior_spawn` the way out
// takes `interact` first and the press walks you through the door instead of at the mark.
//
// FAIL-CLOSED, unlike the document warning above, and the difference is rule 13 and not taste:
// every one of the 27 `environment` rows on this tree has a mark and every mark is placed, so
// this is silent on the shipped tree today. Its document neighbour cannot say that — twelve
// undemanded document rows are still unwritten — which is why that one warns and this one stops
// the commit. Proved red by `--self-test` and by deleting a mark on a copy of the tree.
{
  const marksPath = join(ROOT, 'game', 'data', 'world', 'readables', 'site-marks.json');
  const marks = new Map();
  if (existsSync(marksPath)) for (const m of (readJSON(marksPath).marks || [])) if (m.id) marks.set(m.id, m);
  const rooms = new Map();
  const idir2 = join(ROOT, 'game', 'data', 'world', 'interiors');
  if (existsSync(idir2)) {
    for (const f of readdirSync(idir2).filter((x) => x.endsWith('.json'))) {
      const rec = readJSON(join(idir2, f));
      if (rec.id) rooms.set(rec.id, rec);
    }
  }
  for (const [id, q] of quests) {
    for (const rev of ((q.deceit && q.deceit.revealed_by) || [])) {
      if (rev.channel !== 'environment' || !rev.source) continue;
      const where = `${sourceOf.get(id)}: ${id}.${rev.id} (environment)`;
      const m = marks.get(rev.source);
      if (!m) { problems.push(`${where} names ${JSON.stringify(rev.source)}, which is not a mark in game/data/world/readables/site-marks.json — there is nothing in the world to look at.`); continue; }
      const at = m.at || {};
      if (Array.isArray(at.world) && at.world.length === 2 && at.world.every((n) => Number.isFinite(n))) continue;
      if (!at.interior) { problems.push(`${where}: mark ${m.id} names neither at.world nor at.interior, so it stands nowhere.`); continue; }
      const rec = rooms.get(at.interior);
      if (!rec) { problems.push(`${where}: mark ${m.id} is placed in ${at.interior}, which is not a room in game/data/world/interiors/.`); continue; }
      const p = m.pos || [];
      const b = rec.bounds_m || { x: [-5, 5], z: [-5, 5] };
      const sp = (rec.continuity || {}).interior_spawn || [0, 0, 0];
      if (!(p.length === 3 && p[0] > b.x[0] + 0.6 && p[0] < b.x[1] - 0.6 && p[2] > b.z[0] + 0.6 && p[2] < b.z[1] - 0.6)) {
        problems.push(`${where}: mark ${m.id} at ${JSON.stringify(p)} is outside ${at.interior}'s bounds, or on the wall ring where the documents are drawn.`);
        continue;
      }
      if (Math.hypot(p[0] - sp[0], p[2] - sp[2]) < 4.0) {
        problems.push(`${where}: mark ${m.id} at ${JSON.stringify(p)} is within 4 m of ${at.interior}'s doorway — sim/settlement.js takes interact for the way out first and the press can never reach it.`);
      }
    }
  }
}

// ---- report ------------------------------------------------------------------------------
if (problems.length) {
  console.error(`check-quests: ${problems.length} problem(s) across ${quests.size} quests:`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('These used to throw from the engine constructor, which took every running agent down with them.');
  process.exit(1);
}
console.log(`check-quests: ${quests.size} quests, hooks and entry topics all resolve.`);
