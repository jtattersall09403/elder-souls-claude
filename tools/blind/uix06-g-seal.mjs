#!/usr/bin/env node
/**
 * uix06-g-seal.mjs — turn the RI-UIX06 §G capture into a shippable stimulus pack, and refuse
 * to ship one that leaks.
 *
 * §G's stimulus contract, quoted: "one 1920x1080 PNG of a single UI screen, with the game world
 * cropped out or blacked, metadata stripped, neutral temp path, filename `ui.png`". Every clause
 * of that is a check here rather than a habit.
 *
 * WHAT THIS FILE IS NOT. It is not tools/blind/image-leakcheck.mjs and it does not replace it.
 * That battery is built for a PAIR: nearly all of its rules ask whether some provenance channel
 * separates arm A from arm B. §G has no counterpart arm — it is a single stimulus and a "what is
 * this?" question — so "does a statistic separate the arms" is not a question that exists here,
 * and running it would produce a green tick that means nothing. The channels that DO exist for a
 * single-arm identification stimulus are the ones below, and the report prints every one with its
 * value whether it hit or not, because a battery that only prints hits cannot be told from a
 * rubber stamp.
 *
 * THE CHECKS, and why each is a real channel for THIS instrument:
 *
 *   C1  dimensions == 1920x1080          §G's own contract.
 *   C2  ancillary PNG chunks             tEXt/iTXt/zTXt/tIME/eXIf can carry a filename, a tool
 *                                        name, a timestamp. Chrome's toDataURL does not write
 *                                        them, but "does not" is a claim, so it is measured and
 *                                        then the file is rewritten from IHDR/PLTE/tRNS/IDAT/IEND
 *                                        only, and re-read to prove the rewrite took.
 *   C3  world-blacked control            the same frame with the UI switched off must be 100%
 *                                        pure #000000. This is the only check that can prove the
 *                                        world is gone rather than merely dim; a "mostly black"
 *                                        result means a sky, a fog colour or a graded black
 *                                        survived, and the pack is refused.
 *   C4  non-black coverage of the        reported, never gated. It is how much of the frame the
 *       stimulus                         interface occupies, which is a property of the thing
 *                                        under test, not a leak.
 *   C5  burnt-in text                    every string the frame drew, read out of
 *                                        __HARNESS.getRenderedText(), matched against a
 *                                        project-identity blocklist. This is the check the r2
 *                                        Protocol A pack needed and did not have: a HUD name-plate
 *                                        burned legible text into one arm and every summary
 *                                        statistic passed it green, because a few dozen text
 *                                        pixels move no statistic. Text is caught by reading the
 *                                        text, not by measuring the image.
 *   C6  byte size                         reported, never gated. In a PAIR, size is a leak channel
 *                                        (the r2 pack's own PNGs ran 25-30% larger because real
 *                                        detail costs bytes, and that difference WAS the thing
 *                                        under test). With one arm there is nothing to compare it
 *                                        to, so it is recorded for the record and gates nothing.
 *   C7  path and filename                 the shipped path must contain none of a blocklist of
 *                                        project tokens, and the file must be named `ui.png`.
 *
 * USAGE
 *   node tools/blind/uix06-g-seal.mjs --in <capture dir> --pack <neutral dir> --json <out>
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PNG } from '../node_modules/pngjs/lib/png.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));

const IN = String(args.in || '');
const PACK = String(args.pack || '');
const JSONOUT = String(args.json || '');
if (!IN || !PACK) { console.error('need --in <dir> --pack <dir>'); process.exit(2); }

/**
 * Tokens that would tell a judge what it is looking at. Two classes, kept apart on purpose.
 *
 * PROJECT tokens name THIS project or its machinery. Any hit is a leak and the pack is refused:
 * a judge that reads "elder-souls" in a path has been handed the answer to question 1.
 *
 * SETTING tokens name the fictional world. A hit is NOT automatically a leak — the interface is
 * supposed to be of its world, and a place name drawn inside a journal entry is the game doing
 * its job. But "Black Marsh" and "Argonian" are also Elder Scrolls property, so a judge who
 * reads one may answer `FROM: an Elder Scrolls game`, which is §G's FAIL row ("FROM names an
 * existing game") arrived at from the CONTENT rather than from the LOOK. That is a finding about
 * the instrument, not a defect in the pack, so these are REPORTED LOUDLY AND DO NOT GATE, and
 * the caller is required to carry the list into the dispatch file.
 */
const PROJECT_TOKENS = [
  'elder-souls', 'elder souls', 'eldersouls', 'claude', 'anthropic', 'orchestration',
  'corpus/', 'RI-UIX', 'RI-VIS', 'wave1', 'wave-1', 'jacktattersall', 'home/user',
  'codex/', 'bootstrap-test', 'blind_pair', '__HARNESS', 'harness',
];
const SETTING_TOKENS = [
  'black marsh', 'argonian', 'morrowind', 'elder scroll', 'tamriel', 'skyrim',
  'hist', 'helstrom', 'saxhleel',
  // ADDED AFTER LOOKING AT THE JOURNAL FRAME, which is the only reason they are here — the
  // first list was written from the item's own vocabulary and would have missed these.
  // The in-fiction CALENDAR is Elder Scrolls property in a way a place name is not:
  // "3E 427" is Morrowind's own year and "Second Seed" is a Tamrielic month. A judge who
  // recognises either can answer question 1 from a DATE STAMP without ever reading the
  // interface, which is §G's FAIL row reached entirely off the look.
  'second seed', "sun's dawn", "sun's height", "sun's dusk", 'morning star',
  "rain's hand", 'mid year', 'last seed', 'hearthfire', 'frostfall',
  "evening star", '3e 4', '2e 5', '4e 2',
];

const decode = (p) => PNG.sync.read(fs.readFileSync(p));

/** Every chunk type present, in order, with lengths. A PNG is a chunk list and nothing else. */
function chunks(buf) {
  const out = [];
  let off = 8; // signature
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    out.push({ type, len });
    off += 12 + len;
    if (type === 'IEND') break;
  }
  return out;
}

const KEEP = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);

/** Rewrite a PNG keeping only the chunks a decoder needs. Returns {buf, dropped}. */
function stripMeta(buf) {
  const parts = [buf.subarray(0, 8)];
  const dropped = [];
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const whole = buf.subarray(off, off + 12 + len);
    if (KEEP.has(type)) parts.push(whole);
    else dropped.push({ type, len, sample: buf.toString('latin1', off + 8, off + 8 + Math.min(len, 120)) });
    off += 12 + len;
    if (type === 'IEND') break;
  }
  return { buf: Buffer.concat(parts), dropped };
}

/** Count pixels that are not exactly opaque black. */
function nonBlack(png) {
  let n = 0;
  const d = png.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] !== 0 || d[i + 1] !== 0 || d[i + 2] !== 0) n++;
  }
  return n;
}

const renderedText = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(IN, 'renderedtext.json'), 'utf8')); }
  catch (e) { return null; }
})();

const uistate = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(IN, 'uistate.json'), 'utf8')); }
  catch (e) { return null; }
})();

const manifest = JSON.parse(fs.readFileSync(path.join(IN, 'manifest.json'), 'utf8'));

fs.mkdirSync(PACK, { recursive: true });

const report = {
  tool: 'tools/blind/uix06-g-seal.mjs',
  at: new Date().toISOString(),
  item: 'RI-UIX06 §G',
  gates_that_can_refuse: ['C1 dimensions', 'C2 ancillary chunks after strip', 'C3 world-blacked control is pure black', 'C5 project token burnt into the frame', 'C7 path/filename'],
  reported_never_gated: ['C4 UI coverage', 'C6 byte size', 'setting-token hits'],
  screens: {},
  refusals: [],
};

let seq = 0;
for (const [screen, files] of Object.entries(manifest.files)) {
  seq++;
  const r = { screen, checks: {} };
  const stimPath = files.stimulus;
  const ctrlPath = files.control_ui_off;

  const raw = fs.readFileSync(stimPath);
  const before = chunks(raw);
  const { buf: stripped, dropped } = stripMeta(raw);
  const after = chunks(stripped);

  const png = PNG.sync.read(stripped);
  r.checks.C1_dimensions = { w: png.width, h: png.height, pass: png.width === 1920 && png.height === 1080 };
  r.checks.C2_chunks = {
    before: before.map((c) => c.type),
    after: after.map((c) => c.type),
    dropped,
    ancillary_remaining: after.filter((c) => !KEEP.has(c.type)).map((c) => c.type),
    pass: after.every((c) => KEEP.has(c.type)),
  };

  if (ctrlPath && fs.existsSync(ctrlPath)) {
    const ctrl = decode(ctrlPath);
    const nb = nonBlack(ctrl);
    r.checks.C3_world_blacked = {
      control_non_black_px: nb,
      control_total_px: ctrl.width * ctrl.height,
      pass: nb === 0,
      means: 'UI off + world blacked must be 100% #000000. Anything else is a surviving sky, fog or graded black.',
    };
  } else {
    r.checks.C3_world_blacked = { pass: false, means: 'no control frame captured' };
  }

  r.checks.C4_ui_coverage = {
    non_black_px: nonBlack(png),
    frac: +(nonBlack(png) / (png.width * png.height)).toFixed(4),
    gates: false,
  };
  r.checks.C6_bytes = { raw: raw.length, stripped: stripped.length, gates: false };

  // C5 — burnt-in text, read out of the frame's own text register.
  //
  // FIRST VERSION OF THIS CHECK WAS WRONG AND FAILED ALL SIX SCREENS, and the failure is the
  // point: it walked every string in the `getRenderedText()` RETURN VALUE rather than the
  // strings that were DRAWN. The return value carries its own provenance block —
  // `accessor: "window.__HARNESS.getRenderedText()"` — so the battery matched `__HARNESS`
  // against the instrument's own name and reported a project leak in a frame that had none.
  // A leak check that reads the instrument instead of the picture manufactures its own hits.
  // Only `entries[].text` is drawn; `clipped` entries were painted outside their surface's
  // clip and are NOT in the picture, so they are excluded and counted separately.
  //
  // AND THE REGISTER IS CUMULATIVE ACROSS THE SESSION, which is the second way this check can
  // lie. `getRenderedText()` returns every string drawn since the run started, and because the
  // simulation does not advance while a menu is open, several screens share one frame number —
  // journal and book both report `frame: 400`. So "filter to the last frame" does NOT isolate
  // one screen either. NEITHER SOURCE IS SUFFICIENT ALONE, and the honest thing is to say so
  // and read both:
  //
  //   CHANNEL A — `getUIState().elements[].text`. Exactly this frame, and it is the census the
  //     surface itself clips to. It UNDER-reports: a string drawn INSIDE an element's callback
  //     (the journal's red date line, "1 Second Seed, 3E 427") is in the picture and not in the
  //     census, and that specific string is the sharpest content channel in this whole pack.
  //   CHANNEL B — the cumulative rendered-text register. It OVER-reports: it carries strings
  //     from screens captured earlier in the same run.
  //
  // A LEAK CHECK MUST FAIL TOWARD OVER-REPORTING, so the gate is the UNION and every hit is
  // labelled with the channel it came from, leaving the caller to separate "in this picture"
  // from "in this session". The thing that actually settled which strings are in which picture
  // was opening all six images and reading them, which is recorded in the dispatch file.
  const reg = renderedText && renderedText[screen] ? renderedText[screen] : null;
  const all = (reg && Array.isArray(reg.entries)) ? reg.entries : [];
  const chanB = all.filter((e) => !e.clipped).map((e) => String(e.text == null ? '' : e.text));
  const ui = uistate && uistate[screen] ? uistate[screen] : null;
  const chanA = ((ui && ui.elements) || [])
    .filter((e) => e.visible !== false && e.text != null)
    .map((e) => String(e.text));
  const tagged = [
    ...chanA.map((t) => ({ t, ch: 'A:getUIState().elements (this frame, under-reports)' })),
    ...chanB.map((t) => ({ t, ch: 'B:rendered-text register (session-cumulative, over-reports)' })),
  ];
  const entries = reg;
  const hitsFor = (tokens) => {
    const out = [];
    for (const tok of tokens) {
      for (const e of tagged) {
        if (e.t.toLowerCase().includes(tok.toLowerCase())) out.push({ token: tok, channel: e.ch, text: e.t.slice(0, 160) });
      }
    }
    return out;
  };
  const projHits = hitsFor(PROJECT_TOKENS);
  const setHits = hitsFor(SETTING_TOKENS);
  r.checks.C5_burnt_in_text = {
    channel_A_element_census: chanA.length,
    channel_B_register_cumulative: chanB.length,
    register_complete: !!(reg && reg.complete),
    blind_surfaces: (reg && reg.blind_surfaces) || null,
    register_present: !!entries,
    element_census_present: !!ui,
    project_token_hits: projHits,
    setting_token_hits: setHits.slice(0, 60),
    setting_token_hit_count: setHits.length,
    pass: projHits.length === 0 && !!entries && !!ui,
    means: 'project hits GATE (union of both channels). setting hits are reported and must be carried into the dispatch file — they can produce a FAIL by content rather than by look.',
  };

  // Ship it. Neutral directory name: an opaque index, not the screen name.
  const dirName = `s${String(seq).padStart(2, '0')}-${crypto.randomBytes(3).toString('hex')}`;
  const dir = path.join(PACK, dirName);
  fs.mkdirSync(dir, { recursive: true });
  const outFile = path.join(dir, 'ui.png');
  fs.writeFileSync(outFile, stripped);

  const lowPath = outFile.toLowerCase();
  const pathHits = PROJECT_TOKENS.filter((t) => lowPath.includes(t.toLowerCase()));
  r.checks.C7_path = {
    shipped: outFile,
    basename: path.basename(outFile),
    project_token_hits_in_path: pathHits,
    pass: pathHits.length === 0 && path.basename(outFile) === 'ui.png',
  };

  r.shipped = outFile;
  r.sha256 = crypto.createHash('sha256').update(stripped).digest('hex');
  r.pass = Object.values(r.checks).every((c) => c.pass !== false);
  if (!r.pass) report.refusals.push({ screen, failed: Object.entries(r.checks).filter(([, c]) => c.pass === false).map(([k]) => k) });
  report.screens[screen] = r;
}

report.overall_pass = report.refusals.length === 0;
if (JSONOUT) { fs.mkdirSync(path.dirname(JSONOUT), { recursive: true }); fs.writeFileSync(JSONOUT, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ overall_pass: report.overall_pass, refusals: report.refusals, screens: Object.fromEntries(Object.entries(report.screens).map(([k, v]) => [k, { pass: v.pass, shipped: v.shipped, coverage: v.checks.C4_ui_coverage.frac, control_non_black: v.checks.C3_world_blacked.control_non_black_px, setting_hits: v.checks.C5_burnt_in_text.setting_token_hit_count, project_hits: v.checks.C5_burnt_in_text.project_token_hits.length }])) }, null, 2));
process.exit(report.overall_pass ? 0 : 1);
