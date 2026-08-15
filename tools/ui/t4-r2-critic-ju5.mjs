#!/usr/bin/env node
// t4-r2-critic-ju5.mjs — RI-UIX04 JU5, the append-only byte-diff. Owed since round 1.
//
// Owner: crit-t4-r2. RI-UIX04 Comparison method step 5, verbatim: "Capture the full rendered
// journal text at frame f; advance the quest through >= 3 more stages; capture again. Every entry
// present in the first capture must be BYTE-IDENTICAL in the second, and the second must be a
// strict superset."
//
// The round-1 verdict scored JU5 `fail — unmeasured` and said so plainly: the store's refusals
// were observed but "that is the store, not the screen". This runs it on the SCREEN: both captures
// are the rendered `journal_entry` elements in render order, taken from `getUIState()`.
//
// HOW THE QUEST IS ADVANCED, stated because it is a method deviation. There is no
// `advanceQuest` in the harness API (`grep -n questAdvance game/src/harness/api.js` returns
// nothing). The only writer in the build is `sim.quest.journal.write(questDef, index, dayCount)`,
// which is what the quest machine itself calls, and which refuses backwards and duplicate writes.
// Three further entries are written through it, on real quest definitions, at real indices.
//
// EXIT 0 = append-only holds · 1 = it does not · 2 = could not run.
'use strict';

import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, writeJson } from '../lib/cli.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('t4-r2-critic-ju5.mjs [--state ui-journal] [--out <dir>]');
const OUT = path.join(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r2c/reports'));
ensureDir(OUT);
const STATE = String(args.state || 'ui-journal');

const report = { schema: 'elder-souls/t4-ju5@1', at: new Date().toISOString(), state: STATE, checks: [], data: {} };
const push = (id, pass, detail) => { report.checks.push({ id, pass, detail }); log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`); };

const h = await launchGame({ width: 1920, height: 1080, timeout: 300000 });
let exit = 0;

/** The RENDERED journal, in render order — the screen, not the store. */
async function capture() {
  return h.page.evaluate(() => {
    const s = window.__HARNESS.getUIState();
    const els = (s.elements || []).filter((e) => e.visible && e.kind === 'journal_entry');
    return {
      frame: window.__HARNESS.getFrame(),
      page: s.focus ? s.focus.page : null,
      entries: els.map((e) => ({ id: e.id, text: String(e.text === null || e.text === undefined ? '' : e.text) })),
    };
  });
}

/** Walk every page of the chronicle and concatenate, so a capture is the whole journal. */
async function captureAll() {
  await h.h('openMenu', 'journal');
  await h.h('uiFocus', { journal: { view: 'chronicle', page: 0 } });
  await h.h('stepFrames', 2);
  const all = [];
  const seen = new Set();
  for (let p = 0; p < 24; p++) {
    await h.h('uiFocus', { journal: { view: 'chronicle', page: p } });
    await h.h('stepFrames', 2);
    const c = await capture();
    let added = 0;
    for (const e of c.entries) { const k = `${e.id}`; if (!seen.has(k)) { seen.add(k); all.push(e); added++; } }
    if (added === 0 && p > 0) break;
  }
  return all;
}

try {
  await h.h('setMode', 'harness');
  await h.h('setRenderRate', 0);
  await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', STATE);
  await h.h('stepFrames', 4);

  const before = await captureAll();
  push('JU5-A the first capture is non-empty', before.length > 0, `${before.length} rendered journal entries`);

  // ---- advance the quest through >= 3 more stages, through the game's own writer -------------
  const wrote = await h.page.evaluate(() => {
    const eng = window.__ENGINE;
    const jr = eng.sim.quest.journal;
    const quests = {};
    for (const doc of Object.values(eng.data.quests || {})) for (const q of (doc.quests || [])) quests[q.id] = q;
    const out = [];
    // For every quest already in the journal, write the next index its definition contains.
    const openIds = [...new Set(jr.entries.map((e) => e.quest))];
    for (const qid of openIds) {
      const q = quests[qid];
      if (!q || !q.journal) continue;
      const last = jr.lastIndexOf(qid);
      const next = (q.journal || []).map((e) => e.index).filter((i) => i > last).sort((a, b) => a - b);
      for (const idx of next) {
        try {
          const e = jr.write(q, idx, eng.sim.env.dayCount + out.length + 1, {});
          if (e) out.push({ quest: qid, index: idx, seq: e.seq });
        } catch (err) { out.push({ quest: qid, index: idx, refused: String(err.message || err) }); }
        if (out.filter((o) => o.seq !== undefined).length >= 4) break;
      }
      if (out.filter((o) => o.seq !== undefined).length >= 4) break;
    }
    return out;
  });
  report.data.wrote = wrote;
  const written = wrote.filter((w) => w.seq !== undefined);
  push('JU5-B the quest advanced by at least 3 stages', written.length >= 3,
    `${written.length} new entries written through sim.quest.journal.write: ${JSON.stringify(written)}`);

  await h.h('stepFrames', 4);
  const after = await captureAll();
  report.data.counts = { before: before.length, after: after.length };

  // ---- the diff -------------------------------------------------------------------------------
  const beforeById = new Map(before.map((e) => [e.id, e.text]));
  const afterById = new Map(after.map((e) => [e.id, e.text]));
  const missing = [...beforeById.keys()].filter((k) => !afterById.has(k));
  const altered = [...beforeById.entries()].filter(([k, v]) => afterById.has(k) && afterById.get(k) !== v)
    .map(([k, v]) => ({ id: k, before: v, after: afterById.get(k) }));
  const added = [...afterById.keys()].filter((k) => !beforeById.has(k));
  report.data.diff = { missing, altered, added, before_ids: [...beforeById.keys()], after_ids: [...afterById.keys()] };

  push('JU5 every entry in the first capture is byte-identical in the second, and the second is a strict superset',
    missing.length === 0 && altered.length === 0 && added.length > 0,
    `${before.length} -> ${after.length} rendered entries; removed ${missing.length} ${JSON.stringify(missing)}; ` +
    `altered ${altered.length} ${JSON.stringify(altered.map((a) => a.id))}; added ${added.length} ${JSON.stringify(added)}`);

  report.data.before = before;
  report.data.after = after;
  writeJson(path.join(OUT, 'ju5-append-only.json'), report);
  exit = report.checks.every((c) => c.pass) ? 0 : 1;
} catch (e) {
  log(`could not run: ${e && e.message || e}`);
  report.error = String(e && e.stack || e);
  writeJson(path.join(OUT, 'ju5-append-only.json'), report);
  exit = 2;
} finally {
  await h.close();
}
process.exit(exit);
