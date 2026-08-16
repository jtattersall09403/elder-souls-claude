#!/usr/bin/env node
// t4-r7-critic-headers.mjs — TWO TEXT ELEMENTS IN ONE PLACE. The check the round's own numbers
// could not make, and the existing legibility pass does not either.
//
// Owner: crit-t4-r7. WHY. `tools/ui/t4-r5-legibility.mjs` reports the container `overlap=0` at
// 1920x1080 and at 1280x720 — its OVERLAP metric is the round-4 column-run test INSIDE a row band,
// so two DIFFERENT elements landing on one another is outside what it can see. A 2x crop of the
// shipped container shows the side header `Carried` printed across the first carried row and the
// header `Reed Creel` printed across the first container row. S58: "no glyph overlapping another
// glyph". So this file asks the geometric question directly, off `getUIState()`'s own declared
// rects: which pairs of TEXT-BEARING elements intersect, and by how much.
//
// It is run through EACH ARM'S OWN COPY (HAZARDS 22): `node <worktree>/tools/ui/t4-r7-critic-
// headers.mjs`, so the game served is that worktree's game, and the commit is recorded from that
// worktree's own `git rev-parse HEAD`.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, log, REPO_ROOT, ensureDir } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.isAbsolute(String(args.out || '')) ? String(args.out)
  : path.resolve(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r7c/headers'));
ensureDir(OUT);
const LABEL = String(args.label || 'arm');

const out = {
  schema: 'elder-souls/t4-r7-critic-headers@1', at: new Date().toISOString(), label: LABEL,
  repo_root: REPO_ROOT,
  commit: (await import('node:child_process')).execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim(),
};
const h = await launchGame({ width: 1920, height: 1080, timeout: 300000, state: 'ui-journal' });
try {
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', 'ui-journal');
  await h.h('stepFrames', 4);
  const data = await h.page.evaluate(async () => {
    const A = window.__HARNESS;
    A.openContainer('Reed Creel', [
      { id: 'reed-cutter', count: 1 }, { id: 'bog-iron-maul', count: 1 }, { id: 'rootweave-cowl', count: 1 },
    ]);
    await A.stepFrames(4);
    const st = A.getUIState();
    const els = (st.elements || []).filter((e) => e.visible && e.rect
      && e.text !== null && e.text !== undefined && String(e.text).trim() !== '');
    const panel = (st.elements || []).filter((e) => e.visible && e.kind === 'panel')
      .sort((a, b) => b.rect[2] * b.rect[3] - a.rect[2] * a.rect[3])[0] || null;
    const box = (e) => ({ x0: e.rect[0], y0: e.rect[1], x1: e.rect[0] + e.rect[2], y1: e.rect[1] + e.rect[3] });
    const pairs = [];
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = box(els[i]), b = box(els[j]);
        const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const hh = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (w <= 0 || hh <= 0) continue;
        const areaA = (a.x1 - a.x0) * (a.y1 - a.y0), areaB = (b.x1 - b.x0) * (b.y1 - b.y0);
        const inter = w * hh;
        // containment (one rect wholly inside the other) is a parent/child relationship, not a
        // collision; a PARTIAL intersection of two text-bearing rects is the finding.
        const contained = inter >= Math.min(areaA, areaB) * 0.99;
        pairs.push({
          a: { id: els[i].id, kind: els[i].kind, text: String(els[i].text).slice(0, 40), rect: els[i].rect },
          b: { id: els[j].id, kind: els[j].kind, text: String(els[j].text).slice(0, 40), rect: els[j].rect },
          intersection: [Math.round(w), Math.round(hh)], area: Math.round(inter), contained,
        });
      }
    }
    return {
      panel_rect: panel ? panel.rect : null,
      n_text_elements: els.length,
      elements: els.map((e) => ({ id: e.id, kind: e.kind, rect: e.rect, text: String(e.text).slice(0, 48) })),
      pairs,
    };
  });
  out.data = data;
  out.collisions = data.pairs.filter((p) => !p.contained);
  log(`${LABEL} (${out.commit.slice(0, 8)}): ${data.n_text_elements} text elements, `
    + `${out.collisions.length} partial intersections of two text-bearing rects`);
  for (const c of out.collisions.slice(0, 10)) {
    log(`   '${c.a.text}' [${c.a.id}] x '${c.b.text}' [${c.b.id}] overlap ${c.intersection.join('x')}`);
  }
  const b64 = await h.h('screenshot');
  fs.writeFileSync(path.join(OUT, `${LABEL}-container-full.png`), Buffer.from(String(b64).split(',')[1], 'base64'));
} catch (e) { out.threw = String((e && e.stack) || e); log(`THREW ${e}`); }
fs.writeFileSync(path.join(OUT, `${LABEL}-headers.json`), JSON.stringify(out, null, 2));
log(`written: ${path.join(OUT, `${LABEL}-headers.json`)}`);
try { await Promise.race([h.close(), new Promise((r) => setTimeout(r, 20000))]); } catch { /* reaped */ }
