// Browser confirmation of the S26 interior dead band, in the SHIPPING game.
// Reads enemy hp out of the per-frame trace, which is the same channel every other
// measurement in this verdict uses.
'use strict';
import fs from 'node:fs';
import { serveDir } from '/home/user/elder-souls-claude/tools/lib/serve.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';
const OUT = process.argv[2] || '/dev/stdout';
const { chromium } = await loadPlaywright();
const server = await serveDir('/home/user/elder-souls-claude');
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await page.goto(server.origin + '/game/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 120000 });
await page.evaluate(() => window.__HARNESS.ready());

const out = { generated: new Date().toISOString(), method: 'wpn-dummy-arena; D2 and E1 despawned; D1 setEntityPos to each distance; one light press; hp read from the per-frame trace', rows: {} };
for (const w of ['spr_drowned_harpoon', 'spr_fishers_gig', 'hlb_garrison_bill', 'hlb_fen_hook', 'axe_bog_cleaver', 'ssw_garrison_sword']) {
  const v = await page.evaluate(async (wid) => {
    const H = window.__HARNESS; const vec = [];
    for (let x = 0.20; x <= 3.001; x += 0.05) {
      const dist = Math.round(x * 100) / 100;
      await H.loadState('wpn-dummy-arena');
      await H.setLoadout({ weapon: wid });
      try { H.despawn('D2'); } catch (e) {}
      try { H.despawn('E1'); } catch (e) {}
      H.setEntityPos('D1', 0, dist, { yaw_deg: 180 });
      H.lockOn('D1');
      H.traceStart({});
      H.queueInputs([{ f: 3, press: ['light'] }, { f: 5, release: ['light'] }]);
      await H.stepFrames(220);
      const rows = H.traceDrain(); H.traceStop();
      const hpOf = (r) => { const e = (r.enemies || []).find((z) => z.eid === 'D1'); return e ? e.hp : null; };
      const first = hpOf(rows[0]); const last = hpOf(rows[rows.length - 1]);
      vec.push(first !== null && last !== null && last < first ? 1 : 0);
    }
    return vec;
  }, w);
  const dist = (i) => Math.round((0.20 + i * 0.05) * 100) / 100;
  const idx = v.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
  const gaps = [];
  if (idx.length) { const mn = idx[0], mx = idx[idx.length - 1]; for (let i = mn; i <= mx; i++) if (!v[i]) { const s = i; while (i <= mx && !v[i]) i++; gaps.push([dist(s), dist(i - 1)]); } }
  out.rows[w] = { vector: v.join(''), gaps, min: idx.length ? dist(idx[0]) : null, max: idx.length ? dist(idx[idx.length - 1]) : null };
  console.log(`${w.padEnd(22)} band ${out.rows[w].min}..${out.rows[w].max}  gaps ${JSON.stringify(gaps)}`);
  console.log(`   0.20m ${v.join('')} 3.00m`);
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
}
await browser.close(); await server.close();
