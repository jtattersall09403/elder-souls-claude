#!/usr/bin/env node
// t4-r7-critic-shots.mjs — the two pictures the numbers stand on: a conditioned item SELECTED on
// the container's own side (so the third fact, `condition`, is the one round 6 clipped away), and
// the same band with a description the panel cannot hold. Owner: crit-t4-r7.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, log, REPO_ROOT, ensureDir } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.isAbsolute(String(args.out || '')) ? String(args.out)
  : path.resolve(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r7c/shots'));
ensureDir(OUT);
const h = await launchGame({ width: 1920, height: 1080, timeout: 300000, state: 'ui-journal' });
const meta = { at: new Date().toISOString(), commit: (await import('node:child_process')).execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim(), shots: [] };
try {
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', 'ui-journal');
  await h.h('setMode', 'play-instrumented');
  await h.h('stepFrames', 4);
  for (const id of ['reed-cutter', 'black-water-draught', 'bog-iron-maul']) {
    const info = await h.page.evaluate(async (itemId) => {
      const A = window.__HARNESS;
      A.openContainer('Reed Creel', [{ id: itemId, count: 1 }]);
      await A.stepFrames(3);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'KeyD', bubbles: true, cancelable: true }));
      await A.stepFrames(2);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', key: 'KeyD', bubbles: true }));
      await A.stepFrames(3);
      const st = A.getUIState();
      const els = (st.elements || []).filter((e) => e.visible);
      const band = els.find((e) => e.id === 'container.band');
      return { band_rect: band ? band.rect : null, meta: band && band.meta ? JSON.parse(JSON.stringify(band.meta)) : null };
    }, id);
    const b64 = await h.h('screenshot');
    const png = Buffer.from(String(b64).split(',')[1], 'base64');
    const full = path.join(OUT, `container-${id}-full.png`);
    fs.writeFileSync(full, png);
    meta.shots.push({ id, ...info, full });
    log(`${id}: band ${JSON.stringify(info.band_rect)} facts ${JSON.stringify((info.meta || {}).facts)} shown/needed ${(info.meta || {}).description_lines_shown}/${(info.meta || {}).description_lines_needed}`);
  }
} catch (e) { meta.threw = String((e && e.stack) || e); log(`THREW ${e}`); }
fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(meta, null, 2));
try { await Promise.race([h.close(), new Promise((r) => setTimeout(r, 20000))]); } catch { /* reaped */ }
