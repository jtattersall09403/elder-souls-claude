#!/usr/bin/env node
// Draw the W1-19 round-3 headline as a picture: which reveal channels a player can actually walk,
// and what one line of a measuring tool was worth.
//
// No browser. This is a picture of a MEASUREMENT, not of the game, so `tools/capture/` is the
// wrong instrument (RULES.md rule 20 asks for the capture service for pictures OF THE GAME). The
// minimal PNG writer and the 5x7 font are the same ones
// `tools/analysis/ambience-onsets-chart.mjs` uses.
//
//   node tools/quests/reveal-route-chart.mjs --out docs/shots/<name>.png
//
// W1-18 ROUND 2 added `--round w1-18-r2`, which draws the same report with this round's headline
// instead of the last one's. It is a flag rather than a second file because the picture is of the
// same measurement and a second copy of a chart tool is how two charts start disagreeing; the
// default is untouched, so `docs/shots/2026-08-07-w1-19-r3-*.png` still regenerates byte-for-byte.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeText } from '../lib/chart-font.mjs';

const argv = process.argv.slice(2);
const argOf = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const rep = JSON.parse(readFileSync(argOf('--in') || join(ROOT, 'reports/runs/W1-19-R3/reveal-route-audit.json'), 'utf8'));
const OUT = argOf('--out') || join(ROOT, 'docs/shots/2026-08-07-w1-19-r3-the-reveals-no-play-produces.png');

const W = 1280, H = 800;
const px = new Uint8Array(W * H * 3).fill(0x12);
const set = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b; };
const rect = (x, y, w, h, r, g, b) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, r, g, b); };
function png(path) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
  const crcT = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
// The 5x5 chart font now comes from tools/lib/chart-font.mjs. It used to be a copy-pasted table
// of 23-character strings indexed as bits[j * 5 + i] — two characters short of the 25 the stride
// demands, so every row below each missing character was sheared one pixel left and both digits
// and letters rendered wrong. Do not paste a font back in here; see W1-CHARTFONT.
const text = makeText(rect);

const ROUND = argOf('--round') || 'w1-19-r3';

// THE FONT DEFECT THAT WAS PATCHED HERE UNDER A FLAG IS NOW FIXED AT SOURCE.
//
// This round's own diagnosis was wrong twice and the correction is worth keeping. It said the
// glyph strings were "23 characters read as 35, so the last two pixels of the fifth row are
// undefined", and that on letters the corruption was invisible. Both halves were false. The font
// is a 5x5 — 25 characters — and the two missing characters are deleted from the MIDDLE, which
// shears every row BELOW each cut one pixel left; three or four rows of five are wrong per glyph,
// not one corner. And it is not invisible on letters: the picture this round published rendered
// BOOK as POOK and BY CHANNEL as PY CHANNEL.
//
// The flagged ten-digit patch that used to sit here is gone. The whole 52-glyph table now comes
// from `tools/lib/chart-font.mjs` for every round, so the older `--round` renders no longer
// reproduce their original bytes — by design: those bytes contained the misspelling.
const world = (() => { try { return JSON.parse(readFileSync(join(ROOT, 'reports/runs/W1-18-R2/reveal-route-world.json'), 'utf8')); } catch { return null; } })();

// ---- title -----------------------------------------------------------------------------------
if (ROUND === 'w1-readables-r2') {
  text('THE SOURCES NOBODY HAD MADE, FOR THE TRUTHS THE QUESTS DEMAND', 40, 30, 0xEE, 0xEE, 0xE4, 3);
  text('W1-READABLES ROUND 2 / 26 DOCUMENTS WRITTEN AND 25 MARKS PUT IN THE WORLD', 40, 66, 0x8A, 0x94, 0x88, 2);
} else if (ROUND === 'w1-readables') {
  text('THE LEDGERS NOBODY HAD WRITTEN, ON SHELVES NOBODY COULD REACH', 40, 30, 0xEE, 0xEE, 0xE4, 3);
  text('W1-READABLES / A LEDGER IS A BOOK WITH A DIFFERENT NOUN AND A DIFFERENT VERB', 40, 66, 0x8A, 0x94, 0x88, 2);
} else if (ROUND === 'w1-18-r2') {
  text('THE PEOPLE WHO KNEW, AND NOBODY COULD ASK THEM', 40, 30, 0xEE, 0xEE, 0xE4, 3);
  text('W1-18 ROUND 2 / TALKING TO THE PERSON THE QUEST FILE NAMES NOW TELLS YOU WHAT THEY KNOW', 40, 66, 0x8A, 0x94, 0x88, 2);
} else {
  text('THE TRUTHS THE GAME ASKS FOR AND NEVER TELLS YOU', 40, 30, 0xEE, 0xEE, 0xE4, 3);
  text('W1-19 ROUND 3 / QUEST RESOLUTIONS DEMAND A REVEAL / CAN PLAY PRODUCE IT', 40, 66, 0x8A, 0x94, 0x88, 2);
}

// ---- the channel bars ------------------------------------------------------------------------
const ch = Object.entries(rep.by_channel).sort((a, b) => b[1].total - a[1].total);
const X0 = 230, X1 = 640, Y0 = 130;
const maxV = Math.max(...ch.map(([, v]) => v.total));
const rowH = 34;
text('BY CHANNEL: HOW THE FICTION SAYS YOU LEARN IT', 40, 104, 0xCC, 0xC4, 0x9A, 2);
ch.forEach(([name, v], i) => {
  const y = Y0 + i * rowH;
  text(name, 40, y + 6, 0xCC, 0xCC, 0xC4, 2);
  const wTot = Math.round((v.total / maxV) * (X1 - X0));
  const wOk = Math.round((v.routed / maxV) * (X1 - X0));
  rect(X0, y, wTot, 18, 0x6E, 0x2B, 0x2B);                    // demanded but unroutable = red
  if (wOk > 0) rect(X0, y, wOk, 18, 0x2E, 0x7A, 0x44);        // routed = green
  text(`${v.routed}/${v.total}`, X0 + (X1 - X0) + 20, y + 6, 0x9A, 0x9A, 0x92, 2);
  if (v.routed === 0) text('NO READER IN GAME/SRC', X0 + (X1 - X0) + 110, y + 6, 0x7A, 0x50, 0x50, 2);
});

// ---- the two instruments ---------------------------------------------------------------------
const BY = Y0 + ch.length * rowH + 40;
const box = (x, y, w, h, r, g, b) => { rect(x, y, w, 2, r, g, b); rect(x, y + h, w, 2, r, g, b); rect(x, y, 2, h, r, g, b); rect(x + w, y, 2, h + 2, r, g, b); };

if (ROUND === 'w1-readables-r2') {
  // W1-READABLES round 2. Three arms now, from `document-route-world.mjs --chain`: the same
  // mainline chain, the same verbs, differing only in whether the body may read a document and
  // whether it may look at a mark. Talking is held constant in all three.
  const chain = (() => { try { return JSON.parse(readFileSync(join(ROOT, 'reports/runs/W1-READABLES-R2/document-route-chain.json'), 'utf8')).arms; } catch { return null; } })();
  const mk = (() => { try { return JSON.parse(readFileSync(join(ROOT, 'reports/runs/W1-READABLES-R2/mark-route-world.json'), 'utf8')); } catch { return null; } })();
  const A = (chain && chain.reading_and_looking) || { completed: 0, of: 32, stopped_at: null };
  const B = (chain && chain.neither) || { completed: 0, of: 32, stopped_at: null };
  text('THE MAIN LINE, PLAYED THREE TIMES, DIFFERING ONLY IN WHAT THE BODY MAY DO', 40, BY, 0xCC, 0xC4, 0x9A, 2);

  box(40, BY + 26, 570, 100, 0x2E, 0x7A, 0x44);
  text('READING AND LOOKING ALLOWED', 56, BY + 40, 0xAA, 0xCC, 0xAA, 2);
  text(`${A.completed} OF ${A.of} MAINLINE QUESTS FINISHED`, 56, BY + 62, 0xCC, 0xEE, 0xCC, 2);
  text(`STOPS AT ${A.stopped_at ? A.stopped_at.quest : 'NOTHING'}`, 56, BY + 90, 0x7A, 0x9A, 0x7A, 2);

  box(650, BY + 26, 570, 100, 0x6E, 0x2B, 0x2B);
  text('THE SAME RUN, NEITHER PERMITTED', 666, BY + 40, 0xCC, 0xAA, 0xAA, 2);
  text(`${B.completed} OF ${B.of} MAINLINE QUESTS FINISHED`, 666, BY + 62, 0xEE, 0xCC, 0xCC, 2);
  text(`STOPS AT ${B.stopped_at ? B.stopped_at.quest : 'NOTHING'}`, 666, BY + 90, 0x9A, 0x7A, 0x7A, 2);

  const FY = BY + 145;
  const passed = mk ? mk.legs_passed : 0, ranN = mk ? mk.legs_run : 0;
  text(`${rep.routed} OF ${rep.demanded_reveals} REVEALS A RESOLUTION DEMANDS NOW HAVE A ROUTE IN PLAY - WAS 58`, 40, FY, 0xEE, 0xEE, 0xE4, 2);
  text(`IN THE RUNNING GAME: ${passed} OF ${ranN} LEGS WALKED TO THE THING, PRESSED THE INTERACT`, 40, FY + 28, 0x7A, 0xAA, 0x88, 2);
  text('BUTTON AT IT, AND WATCHED THE RESOLUTION STOP REFUSING. NO SCREEN OPENS AT A MARK.', 40, FY + 50, 0x7A, 0xAA, 0x88, 2);
  text('CONTROLS: OUT OF REACH LEARNS NOTHING, AND THE WRONG MARK MOVES NO REFUSAL.', 40, FY + 72, 0x9A, 0x9A, 0x92, 2);
  text('DELETE THE READER ON A COPY OF THE TREE AND THE SAME LEGS GO 4 OF 4 TO 0 OF 3.', 40, FY + 94, 0x9A, 0x9A, 0x92, 2);
  text(`STILL UNROUTED: ${rep.unrouted}. NINE EAVESDROP ROWS AND ONE CORPSE ROW HAVE NO READER, AND`, 40, FY + 122, 0xCC, 0xAA, 0x6A, 2);
  text('ELEVEN PERSON ROWS NAME SOMEBODY WHO IS IN NO NPC FILE. NONE OF THOSE IS CONTENT.', 40, FY + 144, 0xCC, 0xAA, 0x6A, 2);
} else if (ROUND === 'w1-readables') {
  // The chain arms come from `document-route-world.mjs --chain`, which plays the main line twice
  // with the same two verbs and differs only in whether reading a document is permitted.
  const chain = (() => { try { return JSON.parse(readFileSync(join(ROOT, 'reports/runs/W1-READABLES/document-route-chain.json'), 'utf8')).arms; } catch { return null; } })();
  const wr = (() => { try { return JSON.parse(readFileSync(join(ROOT, 'reports/runs/W1-READABLES/document-route-world.json'), 'utf8')); } catch { return null; } })();
  const A = (chain && chain.reading_allowed) || { completed: 0, of: 32, stopped_at: null };
  const B = (chain && chain.reading_refused) || { completed: 0, of: 32, stopped_at: null };
  text('THE MAIN LINE, PLAYED TWICE, DIFFERING ONLY IN WHETHER A BOOK MAY BE OPENED', 40, BY, 0xCC, 0xC4, 0x9A, 2);

  box(40, BY + 26, 570, 100, 0x2E, 0x7A, 0x44);
  text('READING ALLOWED', 56, BY + 40, 0xAA, 0xCC, 0xAA, 2);
  text(`${A.completed} OF ${A.of} MAINLINE QUESTS FINISHED`, 56, BY + 62, 0xCC, 0xEE, 0xCC, 2);
  text(`STOPS AT ${A.stopped_at ? A.stopped_at.quest : 'NOTHING'}`, 56, BY + 90, 0x7A, 0x9A, 0x7A, 2);

  box(650, BY + 26, 570, 100, 0x6E, 0x2B, 0x2B);
  text('THE SAME RUN, READING REFUSED', 666, BY + 40, 0xCC, 0xAA, 0xAA, 2);
  text(`${B.completed} OF ${B.of} MAINLINE QUESTS FINISHED`, 666, BY + 62, 0xEE, 0xCC, 0xCC, 2);
  text(`STOPS AT ${B.stopped_at ? B.stopped_at.quest : 'NOTHING'}`, 666, BY + 90, 0x9A, 0x7A, 0x7A, 2);

  const FY = BY + 145;
  const passed = wr ? wr.legs_passed : 0, ranN = wr ? wr.legs_run : 0;
  text(`${rep.routed} OF ${rep.demanded_reveals} REVEALS A RESOLUTION DEMANDS NOW HAVE A ROUTE IN PLAY - WAS 48`, 40, FY, 0xEE, 0xEE, 0xE4, 2);
  text(`IN THE RUNNING GAME: ${passed} OF ${ranN} LEGS WALKED INTO THE ROOM, REACHED FOR THE`, 40, FY + 28, 0x7A, 0xAA, 0x88, 2);
  text('DOCUMENT AND WATCHED THE RESOLUTION STOP REFUSING. THE ONLY ACT IS THE INTERACT', 40, FY + 50, 0x7A, 0xAA, 0x88, 2);
  text('BUTTON, PRESSED THROUGH THE INPUT PIPELINE.', 40, FY + 72, 0x7A, 0xAA, 0x88, 2);
  text('CONTROLS: OUT OF REACH OPENS NOTHING, AND THE WRONG DOCUMENT MOVES NO REFUSAL.', 40, FY + 94, 0x9A, 0x9A, 0x92, 2);
  text(`STILL UNROUTED: ${rep.unrouted}. 18 ENVIRONMENT SOURCES ARE PLACES, NOT DOCUMENTS, AND`, 40, FY + 122, 0xCC, 0xAA, 0x6A, 2);
  text('24 LEDGERS AND LETTERS ARE STILL UNWRITTEN. BOTH ARE NAMED IN THE AUDIT.', 40, FY + 144, 0xCC, 0xAA, 0x6A, 2);
} else if (ROUND === 'w1-18-r2') {
  const p = rep.people_channel || { legs_run: 0, journal_writes: 0 };
  const w = (world && world.cases || []).find((c) => c.passed) || null;
  text('THE ROUTER, AND THE SAME RUN WITH THE ROUTER TAKEN OUT', 40, BY, 0xCC, 0xC4, 0x9A, 2);

  box(40, BY + 26, 570, 100, 0x2E, 0x7A, 0x44);
  text('TALK TO THE PERSON THE FILE NAMES', 56, BY + 40, 0xAA, 0xCC, 0xAA, 2);
  text(`${p.legs_run} OF ${p.legs_run} GATES STOP REFUSING`, 56, BY + 62, 0xCC, 0xEE, 0xCC, 2);
  text(`AND NOTE() WRITES ${p.journal_writes} JOURNAL ENTRIES`, 56, BY + 90, 0x7A, 0x9A, 0x7A, 2);

  box(650, BY + 26, 570, 100, 0x6E, 0x2B, 0x2B);
  text('THE SAME RUN, REVEALROUTES EMPTIED', 666, BY + 40, 0xCC, 0xAA, 0xAA, 2);
  text(`0 OF ${p.legs_run} GATES STOP REFUSING`, 666, BY + 62, 0xEE, 0xCC, 0xCC, 2);
  text('AND 0 JOURNAL ENTRIES ARE WRITTEN', 666, BY + 90, 0x9A, 0x7A, 0x7A, 2);

  // The footer sits 145px below the boxes, not 160: at 160 the last line lands at y=810 on an
  // 800px canvas and is silently clipped. A picture that loses its caveat is worse than none.
  const FY = BY + 145;
  text(`${rep.routed} OF ${rep.demanded_reveals} REVEALS A RESOLUTION DEMANDS NOW HAVE A ROUTE IN PLAY - WAS 8`, 40, FY, 0xEE, 0xEE, 0xE4, 2);
  if (w) {
    text(`IN THE RUNNING GAME: ${w.quest} - TALK TO ${String(w.npc).toUpperCase()}`, 40, FY + 28, 0x7A, 0xAA, 0x88, 2);
    // The 5x7 font has no brackets, so the arrows carry the before/after on their own.
    text(`KNOWS NOTHING > KNOWS ${w.knows_after.join(' ')}`, 40, FY + 50, 0xCC, 0xEE, 0xCC, 2);
    text(`JOURNAL ${(w.journal_indices_before || []).join(' ')} > ${(w.journal_indices_after || []).join(' ')} - THE MIDDLE OF IT, WRITTEN BY PLAY`, 40, FY + 72, 0xCC, 0xEE, 0xCC, 2);
    text('CONTROLS: THE WRONG PERSON TELLS YOU NOTHING, AND NOR DOES THE RIGHT ONE', 40, FY + 94, 0x9A, 0x9A, 0x92, 2);
    text('BEFORE YOU HAVE TAKEN THE JOB.', 40, FY + 116, 0x9A, 0x9A, 0x92, 2);
  }
  text(`STILL UNROUTED: ${rep.unrouted}. LEDGER, LETTER AND ENVIRONMENT NAME OBJECTS THIS BUILD`, 40, FY + 136, 0xCC, 0xAA, 0x6A, 2);
  text('DOES NOT CONTAIN. THAT IS CONTENT, NOT A READER.', 40, FY + 158, 0xCC, 0xAA, 0x6A, 2);
} else {
  text('THE SAME COMMIT, TWO INSTRUMENTS, ONE LINE APART', 40, BY, 0xCC, 0xC4, 0x9A, 2);
  box(40, BY + 26, 570, 100, 0x6E, 0x2B, 0x2B);
  text('MAINLINE-CHAIN-FLOOR, AS SHIPPED IN ROUND 2', 56, BY + 40, 0xCC, 0xAA, 0xAA, 2);
  text('40/40 SIGNATURES COMPLETE BOTH CHAINS', 56, BY + 62, 0xEE, 0xCC, 0xCC, 2);
  text('IT CALLED H.QUESTREVEAL() ON EVERY STEP', 56, BY + 90, 0x9A, 0x7A, 0x7A, 2);

  box(650, BY + 26, 570, 100, 0x2E, 0x7A, 0x44);
  text('THE SAME TOOL, THAT ONE LINE REMOVED', 666, BY + 40, 0xAA, 0xCC, 0xAA, 2);
  text('0/40 - ALL STOP AT Q-MAIN-06', 666, BY + 62, 0xCC, 0xEE, 0xCC, 2);
  text('WHERE THE WALK ALWAYS SAID THEY STOP', 666, BY + 90, 0x7A, 0x9A, 0x7A, 2);

  const FY = BY + 160;
  text(`${rep.unrouted} OF ${rep.demanded_reveals} REVEALS A RESOLUTION DEMANDS HAVE NO ROUTE IN PLAY`, 40, FY, 0xEE, 0xEE, 0xE4, 2);
  text(`${rep.fully_blocked_quests.length} QUESTS HAVE EVERY RESOLUTION BLOCKED, ALL OF THEM MAINLINE:`, 40, FY + 24, 0x9A, 0x9A, 0x92, 2);
  text(rep.fully_blocked_quests.map((q) => q.id).join(', '), 40, FY + 46, 0xCC, 0xAA, 0x6A, 2);
  text('REPAIRED THIS ROUND: THE HOOK TABLE IS NOW REACHABLE FROM A PLAYED RESOLUTION,', 40, FY + 78, 0x7A, 0xAA, 0x88, 2);
  text(`AND ${rep.end_to_end.demonstrable} REVEALS NOW FIRE FROM PLAY WITH NO HARNESS VERB TOUCHED.`, 40, FY + 100, 0x7A, 0xAA, 0x88, 2);
}

png(OUT);
console.log('wrote', OUT);
