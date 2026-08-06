#!/usr/bin/env node
// CRITIC-OWNED probe: RI-JRN05 M3 cold reload only.
import fs from 'node:fs';
import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';
const OUT = process.argv[2];
const h = await launchGame({});
const page = h.page;
page.setDefaultTimeout(120000);
page.setDefaultNavigationTimeout(120000);
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 90000 });
await page.evaluate(() => window.__HARNESS.ready());
const out = { produced_by: 'critic-owned p9-cold.mjs' };
out.before = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(4711); H.loadState('sv5-journal-bloodstain'); H.stepFrames(90);
  const r = H.writeSave ? await H.writeSave('critcold') : 'writeSave absent';
  const q = H.getQuestState();
  return { write: r, h0: H.getStateHash(), journal: (q.journal || []).length, flags: Object.keys(q.flags || {}).length, topics: (q.topicsKnown || []).length };
});
await page.goto(page.url(), { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 120000 });
await page.evaluate(() => window.__HARNESS.ready());
out.after = await page.evaluate(async () => {
  const H = window.__HARNESS;
  const r = H.readSave ? await H.readSave('critcold') : 'readSave absent';
  const q = H.getQuestState();
  return { read: r, h1: H.getStateHash(), journal: (q.journal || []).length, flags: Object.keys(q.flags || {}).length, topics: (q.topicsKnown || []).length };
});
out.M3_equal = out.before.h0 === out.after.h1;
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
await h.close();
