#!/usr/bin/env node
// critic-t4-journal.mjs — T4 critic: RI-UIX04. Build the 4-quest/12-entry fixture the item's
// method requires, open the journal, and measure interleave_ratio off RENDER ORDER.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT } from '../lib/cli.mjs';

// The journal indices each quest declares, read off the shipped data rather than guessed:
// `questDef()` does not carry `journal`, and `note()` throws on an index the quest never had.
const IDX = {};
{
  const dir = path.join(REPO_ROOT, 'game/data/quests');
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    let d; try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    for (const q of d.quests || []) IDX[q.id] = (q.journal || []).map((j) => [j.index, j.state]);
  }
}

const OUT = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/T4-r1');
const h = await launchGame({ width: 1920, height: 1080 });
try {
  const step1 = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    if (H.setUIVisible) await H.setUIVisible(true);
    await H.closeMenu();
    let gate = null;
    try { gate = H.questPresenceGate('off'); } catch (e) { gate = String(e.message); }
    const ids = H.questBook();
    const opened = [], errs = [];
    for (const id of ids) {
      let r = null;
      try { H.questPrepareOffer(id); } catch (e) { /* not preparable */ }
      try { r = H.questOpen(id); } catch (e) { errs.push([id, String(e.message).slice(0, 70)]); continue; }
      if (r && r.ok) opened.push(id); else errs.push([id, JSON.stringify(r).slice(0, 70)]);
      if (opened.length >= 4) break;
    }
    // the journal indices each opened quest actually declares
    return { opened, errs: errs.slice(0, 8), n_ids: ids.length, gate };
  });
  console.log('gate:', JSON.stringify(step1.gate), 'opened:', JSON.stringify(step1.opened));
  console.log('errs:', JSON.stringify(step1.errs));
  console.log('idx:', JSON.stringify(step1.opened.map((i) => [i, IDX[i]])));

  const step2 = await h.page.evaluate(async ({ opened, idx }) => {
    const H = window.__HARNESS;
    const noted = [];
    // interleave BY TIME: one entry per quest, round robin, stepping the clock between each,
    // which is exactly the shape RI-UIX04 J1 is about — four quests lived in one week.
    const active = {};
    for (const id of opened) active[id] = (idx[id] || []).filter((e) => e[1] === 'active').map((e) => e[0]);
    const rounds = Math.max(...opened.map((id) => active[id].length));
    for (let k = 0; k < rounds; k++) {
      for (const id of opened) {
        const i = active[id][k];
        if (i === undefined) continue;
        let r = null;
        try { r = H.questNote(id, i); } catch (e) { r = { ok: false, threw: String(e.message).slice(0, 70) }; }
        noted.push([id, i, r && r.ok ? 'ok' : JSON.stringify(r)]);
        await H.stepFrames(30);
        if (H.advanceWallClock) { try { H.advanceWallClock(3600); } catch {} }
      }
    }
    const qs = H.getQuestState();
    return { noted, journal_len: (qs.journal || []).length, journal_head: (qs.journal || []).slice(0, 4) };
  }, { opened: step1.opened, idx: IDX });
  console.log('journal entries:', step2.journal_len);
  console.log('noted sample:', JSON.stringify(step2.noted.slice(0, 6)));

  const step3 = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.openMenu('journal', {});
    await H.stepFrames(2);
    const st = H.getUIState();
    const shot = await H.screenshot();
    let search = null;
    try { search = H.uiSearch ? H.uiSearch('the') : 'no uiSearch'; } catch (e) { search = String(e.message); }
    return { st, shot, search };
  });
  fs.writeFileSync(path.join(OUT, 'screens/journal-populated__1920x1080.png'),
    Buffer.from(String(step3.shot).split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'uistate/journal-populated.json'),
    JSON.stringify({ opened: step1.opened, noted: step2.noted, journal_len: step2.journal_len,
      journal_head: step2.journal_head, uistate: step3.st, search: step3.search }, null, 2));
  console.log('journal elements:', (step3.st.elements || []).length, 'navigable:', JSON.stringify(step3.st.navigable));
  console.log('journal field:', JSON.stringify(step3.st.journal).slice(0, 900));
} finally { await h.close(); }
