#!/usr/bin/env node
// book-shot.mjs — photograph a book page, because the round-2 status file states plainly that it
// never did: "No screenshot of a book page ... CLAUDE.md's directive that stills are not enough is
// unmet for this piece; a critic with a browser should open `the-sap-and-the-ledger` and read it."
//
// This is the READING SURFACE, so a still is the right artefact for it (the "stills are not
// enough" directive is about properties that live in MOTION — a character orbit — and a page of
// text is not one). It does not close RI-UIX05 K2/K3: no contrast ratio or leading is measured
// here. It answers one question the whole piece rests on and nobody had looked at: when the
// player opens one of the 24 books the fold used to break, is there prose on the page?
import { launchGame } from '../../../../../../tools/lib/browser.mjs';
import { parseArgs, writeJson } from '../../../../../../tools/lib/cli.mjs';
import path from 'node:path';
import fs from 'node:fs';

const args = parseArgs(process.argv.slice(2));
const OUT = args.out || '.';
const IDS = String(args.ids || 'the-sap-and-the-ledger,the-egg-speaks-twice,crate-tally').split(',');

const handle = await launchGame({ ...args, width: 1280, height: 720 });
const page = handle.page;
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 45000 });
await page.evaluate(async () => { const H = window.__HARNESS; await H.ready(); if (H.setUIVisible) await H.setUIVisible(true); });

const rows = [];
for (const id of IDS) {
  const ui = await page.evaluate((bid) => {
    const H = window.__HARNESS;
    try { H.closeMenu(); } catch {}
    H.openMenu('book', { id: bid });
    const u = H.getUIState();
    return {
      id: bid,
      opened: !!(u && u.book && u.book.id === bid),
      pages: u && u.book ? u.book.pages : null,
      page_index: u && u.book ? (u.book.page ?? u.book.page_index ?? null) : null,
      words_per_page: u && u.book ? (u.book.words_per_page || []).slice(0, 6) : null,
      // the exact strings that went through fillText — not the declared text
      rendered_text: u && u.rendered_text ? u.rendered_text.slice(0, 40) : null,
    };
  }, id);
  const b64 = await page.evaluate(async () => { const H = window.__HARNESS; await H.stepFrames(2); return H.screenshot(); });
  const file = path.join(OUT, `book-${id}.png`);
  fs.writeFileSync(file, Buffer.from(String(b64).split(',')[1], 'base64'));
  ui.screenshot = file;
  rows.push(ui);
  console.log(`${ui.opened ? 'ok  ' : 'FAIL'} ${id}: pages=${ui.pages} rendered_text lines=${ui.rendered_text ? ui.rendered_text.length : 'null'} -> ${file}`);
}
const report = { what: 'a photograph of the reading screen for three books, one of them from the 24 the fold used to break', rows, page_errors: errors };
if (args.report) writeJson(args.report, report);
await handle.close();
