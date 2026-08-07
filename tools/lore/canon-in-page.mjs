#!/usr/bin/env node
// The canon register, in the page. One browser, one page, no stepping loop.
//
// Owner: W1-23. `tools/lore/canon-consumption.mjs` proves the register is read by running the
// engine's own modules in bare Node, which is the right instrument for the gate's logic and is
// NOT proof that the engine installs it. Two things can only be seen in the page:
//
//   1. `game/data/lore/canon.json` is actually LOADED. A data file that matches no branch in
//      `loadData`'s chain is fetched, counted in the byte total and dropped on the floor — the
//      defect that left `dialogue/persuasion-gmst.json` unreadable for a round. If the branch is
//      missing, `getCanonState()` reports `present: false` and the build still boots, so nothing
//      else in the project would notice.
//   2. `_installCanon()` ran and resolved. It throws on a dangling source, so a clean boot with a
//      present register is the resolve having passed in the real loader over the real data.
//
// Deliberately not a stepping loop: `setRenderRate(0)` and 320x240, one page, no frames.
'use strict';

import { launchGame } from '../lib/browser.mjs';
import { parseArgs } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
let handle; let code = 1;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));

  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: Number(args.timeout ?? 45000) });
  await page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch { /* not every build exposes it */ } });

  const st = await page.evaluate(() => (window.__HARNESS.getCanonState ? window.__HARNESS.getCanonState() : { missing: true }));
  const fails = [];
  const ok = (m) => console.log(`  ok   ${m}`);
  const bad = (m) => { fails.push(m); console.log(`  FAIL ${m}`); };

  if (st.missing) bad('the harness has no getCanonState()');
  else if (!st.present) bad(`the register is NOT installed in the page: ${st.note || 'present:false'} — game/data/lore/canon.json was fetched and dropped`);
  else {
    ok(`the register is installed in the page: ${st.facts} facts, ${st.disputed} disputed`);
    if (st.disputes.length !== st.disputed) bad('the state reports a different number of disputes than it lists');
    else ok(`${st.disputes.length} disputes enumerated from the running world`);
    if (st.carries_answers !== false) bad('the running register claims to carry answers');
    else ok('the running register carries no rulings, and reports so');
    const blob = JSON.stringify(st);
    if (/authorially_true/.test(blob)) bad('a ruling field reached the harness surface');
    else ok('no ruling field on the harness surface');
    if (st.heard_any !== 0) bad('a fresh boot has already heard a dispute argued');
    else ok('a fresh boot has heard 0 disputes argued (the counter starts empty and is not decorative)');
  }
  if (errs.length) console.log(`  note: ${errs.length} page error(s): ${errs.slice(0, 3).join(' | ')}`);

  console.log(fails.length ? `\nCANON IN PAGE: ${fails.length} FAILED` : '\nCANON IN PAGE: PASS');
  code = fails.length ? 1 : 0;
} catch (e) {
  console.log(`CANON IN PAGE: ERROR — ${String(e).slice(0, 400)}`);
} finally {
  if (handle && handle.close) await handle.close();
}
process.exit(code);
