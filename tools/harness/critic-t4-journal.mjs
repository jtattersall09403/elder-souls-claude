#!/usr/bin/env node
// critic-t4-journal.mjs — T4 critic: RI-UIX04. Build the 4-quest/12-entry fixture the item's
// method requires, open the journal, and measure interleave_ratio off RENDER ORDER.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT } from '../lib/cli.mjs';

const OUT = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/T4-r1');
const h = await launchGame({ width: 1920, height: 1080 });
try {
  const step1 = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    if (H.setUIVisible) await H.setUIVisible(true);
    await H.closeMenu();
    const ids = H.questBook();
    const opened = [], errs = [];
    for (const id of ids) {
      try { H.questOpen(id); opened.push(id); } catch (e) { errs.push([id, String(e.message).slice(0, 60)]); }
      if (opened.length >= 5) break;
    }
    return { opened, errs: errs.slice(0, 6), n_ids: ids.length };
  });
  console.log('opened:', JSON.stringify(step1.opened), 'errs:', JSON.stringify(step1.errs));

  const step2 = await h.page.evaluate(async (opened) => {
    const H = window.__HARNESS;
    const noted = [];
    for (const id of opened) {
      for (let i = 1; i <= 4; i++) {
        try { H.questNote(id, i); noted.push([id, i, 'ok']); }
        catch (e) { noted.push([id, i, String(e.message).slice(0, 70)]); }
      }
      await H.stepFrames(20);   // move the in-world clock between quests so dates differ
    }
    const qs = H.getQuestState();
    return { noted, journal_len: (qs.journal || []).length, journal_head: (qs.journal || []).slice(0, 4) };
  }, step1.opened);
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
