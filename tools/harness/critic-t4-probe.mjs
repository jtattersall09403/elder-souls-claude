#!/usr/bin/env node
// critic-t4-probe.mjs — T4 critic (independent). Boot, enumerate the harness, dump getUIState
// for every openable screen. Discovery only: no scoring here.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT } from '../lib/cli.mjs';

const OUT = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/T4-r1');
fs.mkdirSync(path.join(OUT, 'uistate'), { recursive: true });

const h = await launchGame({ width: 1920, height: 1080 });
try {
  const api = await h.page.evaluate(() => Object.keys(window.__HARNESS).sort());
  fs.writeFileSync(path.join(OUT, 'reports/harness-api.json'), JSON.stringify(api, null, 2));
  console.log('harness methods:', api.length);

  const r = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    if (H.setUIVisible) await H.setUIVisible(true);
    const out = { modes: {}, errors: {} };
    const world = H.getUIState();
    out.modes.world = world;
    const names = ['inventory', 'journal', 'sheet', 'spells', 'levelup', 'map', 'wait', 'container', 'book'];
    for (const n of names) {
      try {
        await H.closeMenu();
        await H.openMenu(n, n === 'book' ? { id: null } : {});
        out.modes[n] = H.getUIState();
      } catch (e) { out.errors[n] = String(e && e.message || e); }
    }
    try { await H.closeMenu(); } catch {}
    return out;
  });
  fs.writeFileSync(path.join(OUT, 'uistate/probe-all-modes.json'), JSON.stringify(r, null, 2));
  console.log('errors:', JSON.stringify(r.errors, null, 1));
  console.log('world keys:', Object.keys(r.modes.world).join(', '));
} finally { await h.close(); }
