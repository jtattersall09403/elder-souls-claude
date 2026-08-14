#!/usr/bin/env node
// Throwaway exploration for W1-MAP-DEFECTS: why does the screen walk stop at the journal?
import { launchGame } from '../lib/browser.mjs';
import { parseArgs } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
const h = await launchGame({ ...args, width: 1280, height: 720 });
const say = (s) => process.stdout.write(s + '\n');
const peek = async (label) => {
  const s = await h.page.evaluate(() => {
    const E = window.__ENGINE;
    let ring = null, nav = null, ctxErr = null;
    try { const c = E._uiCtx(); ring = E.ui._walkRing(c); nav = E.ui.navigable(c); } catch (e) { ctxErr = String(e).slice(0, 200); }
    return { mode: E.ui.mode, ring, nav, refused: E.ui.navRefused, ctxErr, inCombat: (() => { try { return E.inCombat(); } catch { return null; } })() };
  });
  say(label + ': ' + JSON.stringify(s));
};
const tryOpen = async () => h.page.evaluate(() => {
  const E = window.__ENGINE; const out = {};
  for (const m of ['inventory', 'journal', 'sheet', 'spells', 'map', 'wait']) {
    try { const c = E._uiCtx(); const before = E.ui.mode; E.ui.stack.length = 0; E.ui.mode = 'world'; E.ui.open(m, null, c); out[m] = 'ok -> ' + E.ui.mode; E.ui.mode = before; }
    catch (e) { out[m] = 'THROW ' + String(e && e.message || e).slice(0, 160); }
  }
  E.ui.mode = 'world';
  return out;
});
try {
  await h.page.goto(h.url.replace(/\?.*$/, '') + '?mode=play', { waitUntil: 'load' });
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 60000 });
  await h.page.evaluate(() => window.__HARNESS.ready());
  await h.page.waitForTimeout(1500);
  say('== during character creation (census paused at hold.come-to) ==');
  say('direct open() of each screen: ' + JSON.stringify(await tryOpen(), null, 1));
  await h.page.keyboard.press('KeyM'); await h.page.waitForTimeout(400); await peek('after M');
  for (let i = 1; i <= 3; i++) { await h.page.keyboard.press('Digit3'); await h.page.waitForTimeout(350); await peek(`Digit3 x${i}`); }

  say('');
  say('== now with creation applied through the harness (a finished character) ==');
  await h.page.evaluate(() => { window.__ENGINE.ui.close(); });
  const done = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    try { await H.applyCreation ? H.applyCreation() : null; } catch (e) { /* */ }
    try { return { applied: !!(await H.creationApply()) }; } catch (e) { return { err: String(e).slice(0, 200) }; }
  });
  say('creation attempt: ' + JSON.stringify(done));
  say('direct open() of each screen: ' + JSON.stringify(await tryOpen(), null, 1));
} finally {
  say('errors: ' + JSON.stringify(h.errors.slice(-5)));
  await h.close();
}
