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

// ---- a resolution that gates on a skill nobody has ------------------------------------------
//
// W1-LIBRARY round 2, found while proving that reading a book opens the three non-violent lore
// resolutions. It does — but two of the three ALSO gate on a skill id that does not exist:
//
//   Q-SOUL-02 res_seal        requires `scribing`     — there is no such skill. The register has
//                                                       nineteen and none of them is scribing.
//   Q-LILM-01 res_rootkeepers requires `root_speech`  — the skill is `root-speech`, with a hyphen
//                             (blackmarsh-coast.json:1391, blackmarsh-core.json:864)
//
// The gate looks the key up verbatim in `sim.progression.skills`, finds nothing, and reports
// `root_speech 0/45` for as long as the game runs. No amount of play moves it, so those two
// non-violent exits are shut by a typo rather than by a difficulty. Q-DEEP-01's `speechcraft`
// floor is spelled correctly and behaves correctly, which is what makes this a defect and not a
// misreading of the gate.
//
// WARNING, NOT AN ERROR, AND DELIBERATELY SO. The quest data is another item's to change, and a
// fail-closed assertion landed here would turn `check-quests` red for every agent on the box
// over content none of them owns — the exact failure this project has already paid for twice.
// It prints loudly and exits 0. Promote it to a `problems.push()` once the two ids are fixed;
// the check is written so that is a one-line change.
{
  const skillsPath = join(ROOT, 'game', 'data', 'progression', 'skills.json');
  if (existsSync(skillsPath)) {
    const real = new Set((readJSON(skillsPath).skills || []).map((s) => s.id));
    const dangling = [];
    for (const [id, q] of quests) {
      for (const r of (q.resolutions || [])) {
        for (const k of Object.keys((r.requires && r.requires.skills) || {})) {
          if (real.has(k)) continue;
          const near = [...real].find((x) => x.replace(/[-_]/g, '') === k.replace(/[-_]/g, ''));
          dangling.push(`${sourceOf.get(id)}: ${id} ${r.id} requires skill '${k}'` + (near ? ` — did you mean '${near}'?` : ' — no skill of that name exists'));
        }
      }
    }
    if (dangling.length) {
      console.warn(`check-quests: WARNING — ${dangling.length} resolution requirement(s) name a skill that is not in progression/skills.json.`);
      console.warn('  A gate on a skill nobody can have is a resolution no player can ever reach.');
      for (const d of dangling) console.warn(`  ${d}`);
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
