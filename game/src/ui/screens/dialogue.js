// The dialogue window — a floating index of keywords you find by reading, not a menu of replies.
//
// Owner: W1-UIX08. Binding: `corpus/86-ui/RI-UIX08-dialogue-window.md`, read in full; the reading
// note naming every reference opened and what was deliberately not copied from each is at
// `reports/uix08/READING-NOTE.md`, which the item requires as its first deliverable.
//
// WHAT THIS REPLACES AND WHY IT IS A NEW FILE. `render/ui.js` draws a bottom-anchored vellum panel
// with an `opts[]` list of selectable replies. That is RI-UIX08's **hard fail** — "the window
// renders a list of selectable replies instead of prose with inline links" caps the item at 2
// regardless of every other row — and it is also unmeasurable: `render/ui.js` paints straight to a
// 2D context and declares no elements, which is RI-UIX01's "everything drawn straight to canvas is
// invisible". This window is built on `ui/surface.js`, where `el()` is the only way to get a
// drawing context and clips every callback to the rect it declared, so the element census and the
// pixels cannot disagree.
//
// THE SEAM THAT WAS CUT AND NEVER USED. `ui/surface.js` line 46 has declared a `topic_link`
// element kind since W1-21, and until this file `grep -rn topic_link game/src/` returned exactly
// one hit — the declaration itself. The central mechanism of Morrowind's dialogue had a name in
// this build and no implementation.
//
// ---------------------------------------------------------------------------------------------
// THE SIX ELEMENTS, AND THERE IS NO SEVENTH (§A). Measured from
// `REF-A12c-dialogue__mw-owner-20260814.png` and corroborated against the native-engine control
// `REF-A12b-dialogue__mw-3296790844.jpg`:
//
//   1. a floating panel over the RUNNING world, translucent, near-black interior;
//   2. a title strip with the speaker's name CENTRED, in a gap cut in the tiled border band;
//   3. the history pane — the running transcript as continuous prose, oldest at top;
//   4. the topic column, right, fixed width, two sections split by a rule;
//   5. the disposition bar directly above the column, the same width, reading `N/100`;
//   6. the Goodbye button below the column, the full width of that column.
//
// No portrait, no relationship meter, no reply-tone icons, no timer, no "[Persuade]" chrome.
//
// ---------------------------------------------------------------------------------------------
// GEOMETRY IS IN LAYOUT UNITS, NOT FRACTIONS, AND THAT IS REQUIREMENT B1.
//
// `openmw_dialogue_window.layout` nominal client is 588 × 433 with `MinSize 380 × 230`. The
// history box is `align="Stretch"`; the disposition bar, the topic list and the Goodbye button are
// `align="Right *"` at a **fixed 166**. `REF-A12/README.md` states the opposite — "both columns
// align to stretch, so the ratio holds as the window is resized" — and it is wrong; the owner's
// capture proves it in pixels, with the column at 23.9% of a wider-than-nominal panel instead of
// the nominal 28.2%. Every extra pixel of width went to the prose.
//
// So: `LU` below is the layout file's own arithmetic, generalised over a client of (W, H) layout
// units, and `COL_LU = 166` is a constant that never becomes a percentage. A column specified as a
// fraction is an explicit fail of the item: it makes the prose narrower on a phone, where the
// prose is the thing being read.
//
// ---------------------------------------------------------------------------------------------
// COLOUR (§C). Every constant here is quoted from `REF-A12/config/openmw.cfg` lines 71–115.
// Four families, and they are load-bearing rather than decorative — see `dialogue-links.js`.
//
// The column is BRONZE. The owner's own capture shows it green, ~(144,196,146); no entry in the
// 45-entry `[FontColor]` table is that colour, the nearest green (`fatigue`, #00963C) is nothing
// like it, and all five native-engine captures render the list in `normal` bronze. The green is a
// mod or a user setting on the owner's device. Copying it would be `RI-VIS09` §6's hazard running
// backwards: silently DEGRADING by copying a reference's known defect.
'use strict';

import { C, Ca, idHash, jitter } from '../theme.js';
import { drawText, faceOf, measure, wrap } from '../type.js';
import { markLinks } from './dialogue-links.js';

// ---- §C, verbatim from openmw.cfg lines 71–115 ----------------------------------------------
export const DLG = {
  /** `FontColor_color_normal 202,165,96` — body prose, and the speaker's name in the title. */
  normal: '#caa560',
  /** `FontColor_color_header 223,201,159` — a topic name repeated as a heading above its answer. */
  header: '#dfc99f',
  /** `FontColor_color_link 112,126,207` — THE MECHANISM. Inline, inside the prose. */
  link: '#707ecf',
  /** `FontColor_color_link_over 143,155,218` / `_pressed 175,184,228` — a two-step ramp. */
  link_over: '#8f9bda',
  link_pressed: '#afb8e4',
  /** `FontColor_color_magic 53,69,159` — the disposition fill. */
  fill: '#35459f',
};

/**
 * §E1. OpenMW's `menu transparency` default. The panel interior is near-black AND TRANSLUCENT —
 * brightened 3.2×, REF-A12c shows the NPC's own face and shoulders through the prose pane.
 *
 * This is an alpha on the INTERIOR. The tiled frame band reads as solid material in both
 * references and is drawn at 0.97, which is why `metrics()` reports the two separately: a check
 * that sampled the frame and concluded "opaque" would be measuring the wrong rectangle.
 */
export const INTERIOR_ALPHA = 0.84;
const FRAME_ALPHA = 0.97;

/** The layout file's own numbers. Nothing here is a fraction. */
const LU = { NOM_W: 588, NOM_H: 433, MIN_W: 380, MIN_H: 230, COL: 166, FRAME: 8, CAPTION: 22 };

/** Layout-unit rects for a client of `w × h` layout units — the layout file, generalised. */
export function clientRects(w, h) {
  return {
    historyBox: [8, 8, w - 207, h - 52],
    historyText: [15, 15, w - 224, h - 63],
    vscroll: [w - 218, 13, 14, h - 62],
    disposition: [w - 190, 8, LU.COL, 18],
    topics: [w - 190, 31, LU.COL, h - 105],
    goodbye: [w - 190, h - 67, LU.COL, 23],
  };
}

/**
 * The running transcript. §D3: "the history accumulates and scrolls; it is never cleared
 * mid-conversation", each answer preceded by its topic name as a heading, and the greeting
 * carries no heading.
 *
 * It lives HERE and not in `character/converse.js` because `Conversation` keeps only the LAST
 * thing said (`this.said`) — a design that is correct for a reply menu and cannot express this
 * window. Owning it on the UI side also means the dialogue-text and topic-graph pieces keep their
 * files: nothing in `converse.js` is edited by this item.
 */
export class DialogueHistory {
  constructor() { this.speaker = null; this.blocks = []; }

  /** A new conversation. The greeting opens it and carries no heading (§D3). */
  open(speaker, greeting) {
    this.speaker = speaker || null;
    this.blocks = [];
    if (greeting) this.blocks.push({ heading: null, text: String(greeting), topic: null });
    return this;
  }

  /**
   * §D1: clicking a blue word "appends the answer to the bottom of the history pane. It does not
   * clear the pane, it does not open a sub-window, and it does not close the conversation."
   */
  append(topicId, heading, text) {
    if (!text) return this;
    const last = this.blocks[this.blocks.length - 1];
    if (last && last.topic === topicId && last.text === String(text)) return this;   // idempotent
    this.blocks.push({ heading: heading || null, text: String(text), topic: topicId || null });
    return this;
  }

  close() { this.speaker = null; this.blocks = []; return this; }
}

// ---------------------------------------------------------------------------------------------

/**
 * Lay the window out. Pure: it reads the surface's size and the model and returns geometry, so a
 * probe can assert every rect without a browser and `drawDialogue` cannot disagree with it.
 *
 * @param {UISurface} S
 * @param {object} m  see `ui/system.js _dialogueModel()`
 */
export function layoutDialogue(S, m) {
  const s = S.s, W = S.W, H = S.H;
  const minPx = Number(S.ctx && S.ctx.__esMinTextPx) || 0;

  // One scale factor, layout units → pixels. Tied to frame HEIGHT so the type is the same
  // physical size on a 16:9 and a 21:9 screen of the same height — which is exactly what makes
  // the anchor rule visible: widen the frame and the column does not move, the prose grows.
  const u = s * 1.9;

  const face = faceOf('ink'), boneFace = faceOf('bone');
  // Mean advance per character at size 1, measured from the shipped outlines rather than assumed,
  // because the face is not monospaced and a guessed constant would put the measure out of band on
  // exactly the viewport nobody captures.
  const SAMPLE = 'the quick brown fox jumps over a lazy dog and asks about netch leather';
  const perChar = measure(SAMPLE, face, 100) / SAMPLE.length / 100;

  // The column is FIXED (B1). The prose absorbs everything else.
  const colPx = LU.COL * u;
  // Body size: aim for the middle of RI-UIX05's 45–75 character measure, never below RI-UIX06
  // B4's floors (18 CSS px at 1080p AND 1.6% of screen height), never below the phone floor
  // `UISurface.begin()` sets — `drawText` clamps to `__esMinTextPx` and `measure` does not, so a
  // layout computed at an unclamped size would wrap to a width the paint pass then overflows.
  const floorPx = Math.max(minPx, 19 * s, H * 0.016);

  // Solve panel width and body size together: start at the reference's 57% of frame width, then
  // widen (never narrow) until the prose holds at least MEASURE_MIN characters at the body size we
  // can actually draw. This is F2's clamp applied to the PANEL, not to the column — the column
  // stays fixed and right-anchored, which is what B1 asks for.
  const MEASURE_MIN = 52, MEASURE_AIM = 60;
  let clientW = Math.max(LU.MIN_W, Math.round((W * 0.57 - 2 * LU.FRAME * u) / u));
  let bodyPx = 0, proseW = 0;
  for (let pass = 0; pass < 6; pass++) {
    const r = clientRects(clientW, LU.MIN_H);
    proseW = r.historyText[2] * u - 20 * u;                     // less the scrollbar gutter
    bodyPx = Math.max(floorPx, proseW / (MEASURE_AIM * perChar));
    const need = MEASURE_MIN * perChar * bodyPx;
    if (proseW >= need) break;
    const deficit = (need - proseW) / u;
    const capped = Math.min(clientW + deficit, (W * 0.94 - 2 * LU.FRAME * u) / u);
    if (capped <= clientW + 0.5) break;                          // the frame is as wide as allowed
    clientW = capped;
  }
  let clientH = Math.max(LU.MIN_H, (H * 0.76 - (LU.CAPTION + LU.FRAME) * u) / u);

  const outerW = (clientW + 2 * LU.FRAME) * u;
  const outerH = (clientH + LU.CAPTION + LU.FRAME) * u;
  const panelX = Math.round((W - outerW) / 2);
  const panelY = Math.round((H - outerH) / 2);
  const clientX = panelX + LU.FRAME * u;
  const clientY = panelY + LU.CAPTION * u;

  const R = clientRects(clientW, clientH);
  const px = (r) => [clientX + r[0] * u, clientY + r[1] * u, r[2] * u, r[3] * u];

  const headPx = bodyPx * 1.0;
  const lineH = bodyPx * 1.45;                                   // inside RI-UIX05's 1.35–1.65
  const rowPx = Math.max(floorPx, 15.5 * u);
  const rowH = rowPx * 1.5;

  // ---- the prose, wrapped, with its links found ------------------------------------------
  //
  // A LINK IS FOUND ONCE, ON THE WHOLE BLOCK, AND THEN CUT AT THE WRAP. Wrapping first and
  // matching per line would lose every link that straddles a line break — `netch` at the end of
  // one line and `leather` at the start of the next — which is a silent recall hole that grows
  // as the window narrows, i.e. worst exactly on a phone.
  const linkable = m.links_enabled === false ? [] : (m.linkable || []);
  const lines = [];                     // {frags:[{text,topic,x,w}], heading:bool}
  const links = [];                     // {topic, line, frag} in reading order
  for (const b of m.blocks || []) {
    if (lines.length) lines.push({ frags: [], heading: false, gap: true });
    if (b.heading) {
      for (const t of wrap(b.heading, face, headPx, proseW)) {
        lines.push({ frags: [{ text: t, topic: null }], heading: true });
      }
    }
    const spans = markLinks(b.text, linkable);
    let cur = { frags: [], heading: false };
    let curW = 0;
    const flush = () => { lines.push(cur); cur = { frags: [], heading: false }; curW = 0; };
    for (const sp of spans) {
      // Split a span into words, keeping the separators, so wrapping happens at spaces and a
      // link's own words stay attributed to the link.
      const parts = sp.text.split(/(\s+)/).filter((x) => x.length);
      for (const w of parts) {
        if (/^\s+$/.test(w)) {
          if (!cur.frags.length) continue;                       // no leading space on a line
          const ww = measure(' ', face, bodyPx);
          if (curW + ww > proseW) { flush(); continue; }
          // THE SPACE INSIDE A LINK BELONGS TO THE LINK. It used to be pushed with `topic: null`,
          // which broke the adjacency merge below and turned `netch leather` into TWO link
          // entries with a dead gap between them — two carets to walk, two underlines, and a
          // count that overstated how many subjects were on the page.
          pushFrag(cur, ' ', sp.topic || null, ww); curW += ww;
          continue;
        }
        const ww = measure(w, face, bodyPx);
        if (curW + ww > proseW && cur.frags.length) flush();
        pushFrag(cur, w, sp.topic || null, ww);
        curW += ww;
      }
    }
    if (cur.frags.length) flush();
  }
  // x positions and the link index, in reading order
  for (let li = 0; li < lines.length; li++) {
    const ln = lines[li];
    let x = 0;
    let openLink = null;
    for (let fi = 0; fi < ln.frags.length; fi++) {
      const f = ln.frags[fi];
      f.x = x; x += f.w;
      if (!f.topic) { openLink = null; continue; }
      // Adjacent fragments of the same topic on the same line are ONE clickable word-group.
      if (openLink && openLink.topic === f.topic) { openLink.w = f.x + f.w - openLink.x; continue; }
      openLink = { topic: f.topic, line: li, x: f.x, w: f.w, size: bodyPx };
      links.push(openLink);
    }
  }

  const histPx = px(R.historyText);
  const visibleLines = Math.max(1, Math.floor(histPx[3] / lineH));
  // §D3: scrolled to the bottom. `scrollUp` is how far back the player has walked.
  const maxScroll = Math.max(0, lines.length - visibleLines);
  let scrollUp = Math.max(0, Math.min(maxScroll, m.scroll_up || 0));
  // Keep the focused link on screen. A caret that walks off the page is a caret a player loses.
  if (m.focus && m.focus.pane === 'prose' && links[m.focus.linkIdx]) {
    const ln = links[m.focus.linkIdx].line;
    const top = lines.length - visibleLines - scrollUp;
    if (ln < top) scrollUp = Math.min(maxScroll, lines.length - visibleLines - ln);
    else if (ln >= top + visibleLines) scrollUp = Math.max(0, lines.length - visibleLines - (ln - visibleLines + 1));
  }
  const firstLine = Math.max(0, lines.length - visibleLines - scrollUp);

  return {
    u, s, bodyPx, headPx, lineH, rowPx, rowH, perChar,
    panel: [panelX, panelY, outerW, outerH],
    client: [clientX, clientY, clientW * u, clientH * u],
    clientLU: [clientW, clientH],
    caption: [panelX, panelY, outerW, LU.CAPTION * u],
    history: px(R.historyBox), historyText: histPx, vscroll: px(R.vscroll),
    disposition: px(R.disposition), topics: px(R.topics), goodbye: px(R.goodbye),
    colPx, proseW, lines, links, visibleLines, firstLine, scrollUp, maxScroll,
    chars_per_line: charsPerLine(lines, firstLine, visibleLines),
  };
}

function pushFrag(line, text, topic, w) { line.frags.push({ text, topic, w }); }

function charsPerLine(lines, from, count) {
  let n = 0, total = 0;
  for (let i = from; i < Math.min(lines.length, from + count); i++) {
    const t = lines[i].frags.map((f) => f.text).join('');
    if (!t.trim()) continue;
    n++; total += t.length;
  }
  return n ? +(total / n).toFixed(2) : 0;
}

// ---------------------------------------------------------------------------------------------

/**
 * Draw the window and declare every element on it.
 *
 * @returns {object} the metrics `getUIState()` publishes and every check in this item reads.
 */
export function drawDialogue(S, m) {
  const L = layoutDialogue(S, m);
  // §E1's alpha, as a MODEL FIELD rather than a constant, so the opaque arm is a frame that was
  // actually rendered rather than a number computed on paper. RULES rule 6: a control you have
  // never seen fail is not evidence, it is a second copy of the experiment.
  const interiorAlpha = m.interior_alpha === undefined ? INTERIOR_ALPHA : m.interior_alpha;
  const s = S.s, u = L.u;
  const seed = idHash('dialogue') & 0xffff;

  // ---- 1. the floating panel (§A1, §E1) ------------------------------------------------------
  //
  // NOT fullscreen, NOT letterboxed, NOT a scene change: "the world staying visible behind a
  // translucent panel is what makes a conversation happen IN A PLACE."
  S.el({
    id: 'dialogue.panel', kind: 'panel', rect: L.panel, material: 'chitin',
    opacity: interiorAlpha,
    meta: {
      element: 1, interior_alpha: interiorAlpha, frame_alpha: FRAME_ALPHA,
      area_frac: +((L.panel[2] * L.panel[3]) / (S.W * S.H)).toFixed(4),
      client_lu: L.clientLU,
    },
  }, (c, r) => {
    // The interior: near-black and translucent, so the person you are talking to is visible
    // through their own answer.
    c.globalAlpha = interiorAlpha;
    c.fillStyle = C('chitin_dark');
    c.fillRect(r[0], r[1], r[2], r[3]);
    // The frame: a TILED band, not a stretched nine-slice. REF-A12's `TileRect` with `TileH`/
    // `TileV` true is the construction, and RI-UIX06 G10 is why the substance is root-fibre
    // rather than Morrowind's tooled stone — an element whose appearance would be unchanged if
    // the game's setting changed is a hard fail of the art side.
    c.globalAlpha = FRAME_ALPHA;
    band(c, r[0], r[1], r[2], LU.CAPTION * u, u, seed, true);
    band(c, r[0], r[1] + r[3] - LU.FRAME * u, r[2], LU.FRAME * u, u, seed + 7, false);
    band(c, r[0], r[1], LU.FRAME * u, r[3], u, seed + 13, false);
    band(c, r[0] + r[2] - LU.FRAME * u, r[1], LU.FRAME * u, r[3], u, seed + 19, false);
  });

  // ---- 2. the title strip: the speaker's name, CENTRED, in a gap cut in the band (§A2, §E2) ---
  //
  // "There is no separate bar and no plate behind the name. The tiled border strip runs the full
  // width and is INTERRUPTED — a gap is cut in the tiling — and the name sits in that gap."
  // Name only: no portrait, no faction, no disposition word, no location.
  const namePx = Math.max(Number(S.ctx.__esMinTextPx) || 0, 15 * u);
  const nameFace = faceOf('bone');
  const name = String(m.speaker || '');
  const nameW = measure(name, nameFace, namePx);
  S.el({
    id: 'dialogue.title', kind: 'panel_header', rect: L.caption, text: name,
    opacity: FRAME_ALPHA, meta: { element: 2, centred: true, gap_px: +(nameW + 26 * u).toFixed(1) },
  }, (c, r) => {
    const gapW = nameW + 26 * u;
    const gapX = r[0] + r[2] / 2 - gapW / 2;
    c.globalAlpha = 1;
    c.fillStyle = C('chitin_dark');
    c.fillRect(gapX, r[1] + 2.5 * u, gapW, r[3] - 5 * u);
    // The beaded edging continues past the gap on both sides (§E2).
    beads(c, r[0] + 2 * u, r[1] + 2 * u, r[2] - 4 * u, u);
    beads(c, r[0] + 2 * u, r[1] + r[3] - 3 * u, r[2] - 4 * u, u);
    drawText(c, name, r[0] + r[2] / 2 - nameW / 2, r[1] + r[3] * 0.68, nameFace, namePx, DLG.normal);
  });

  // ---- 3. the history pane (§A3, §D3) --------------------------------------------------------
  const face = faceOf('ink');
  const HT = L.historyText;
  const drawnText = [];
  S.el({
    id: 'dialogue.history', kind: 'book_page', rect: L.history,
    text: null,
    meta: {
      element: 3, lines_total: L.lines.length, lines_visible: L.visibleLines,
      first_line: L.firstLine, chars_per_line: L.chars_per_line, body_px: +L.bodyPx.toFixed(2),
      leading: +(L.lineH / L.bodyPx).toFixed(3), scrolled_to_bottom: L.scrollUp === 0,
    },
  }, (c) => {
    c.globalAlpha = 1;
    for (let i = 0; i < L.visibleLines; i++) {
      const ln = L.lines[L.firstLine + i];
      if (!ln) break;
      const y = HT[1] + (i + 0.82) * L.lineH;
      for (const f of ln.frags) {
        // The BRONZE runs are painted here. Every link fragment is painted by its own
        // `topic_link` element below, so the mechanism is in the element census and not only in
        // the pixels — an inline link that exists solely as a colour is one a probe cannot find.
        if (f.topic) continue;
        if (!f.text.trim()) continue;
        drawText(c, f.text, HT[0] + f.x, y, face, L.bodyPx, ln.heading ? DLG.header : DLG.normal);
        drawnText.push(f.text);
      }
    }
  });

  // ---- 3b. THE MECHANISM: the coloured topic keywords, inline, inside the prose (§C1) ---------
  //
  // "You do not pick a reply. You read an answer, notice that `netch leather` and `Sadrith Mora`
  // and `Mages Guild` are a different colour from the sentence around them, and click one."
  //
  // Each link is its own declared element carrying the topic id it promises, so the census, the
  // link-precision probe and the pixels are all looking at the same object. `links_enabled:false`
  // — the item's §G ablated arm and this build's plausible null control — leaves every one of
  // these undeclared and paints the words in body bronze inside the history element above.
  let linkEls = 0;
  if (m.links_enabled !== false) {
    for (let i = 0; i < L.links.length; i++) {
      const lk = L.links[i];
      const row = lk.line - L.firstLine;
      if (row < 0 || row >= L.visibleLines) continue;
      const y = HT[1] + (row + 0.82) * L.lineH;
      const focused = m.focus && m.focus.pane === 'prose' && m.focus.linkIdx === i;
      const text = L.lines[lk.line].frags
        .filter((f) => f.topic === lk.topic && f.x >= lk.x - 0.01 && f.x + f.w <= lk.x + lk.w + 0.01)
        .map((f) => f.text).join('');
      S.el({
        id: `dialogue.link.${i}`, kind: 'topic_link',
        rect: [HT[0] + lk.x - 1 * u, y - L.bodyPx * 0.86, lk.w + 2 * u, L.bodyPx * 1.15],
        text, focused: !!focused,
        meta: { element: 3, topic: lk.topic, index: i, line: lk.line },
      }, (c, r) => {
        c.globalAlpha = 1;
        // §C's two-step ramp: `link` / `link_over` / `link_pressed`. NOT a fill lighten and not a
        // focus ring — RI-UIX06 G6 forbids both, and Morrowind's own affordance is the ink.
        const colour = focused ? (m.pressed ? DLG.link_pressed : DLG.link_over) : DLG.link;
        drawText(c, text, r[0] + 1 * u, y, face, L.bodyPx, colour);
        if (focused) {
          // A cut mark under the word, in the link's own ink. It is a material mark, not a
          // hairline border: 2 layout units, tapered, and it moves with the caret.
          c.beginPath();
          c.moveTo(r[0] + 1 * u, y + L.bodyPx * 0.20);
          c.lineTo(r[0] + 1 * u + lk.w, y + L.bodyPx * 0.20);
          c.strokeStyle = colour; c.lineWidth = Math.max(1, 1.4 * u); c.stroke();
        }
      });
      drawnText.push(text);
      linkEls++;
    }
  }

  // the scrollbar. `Visible=false` until the text overflows — the layout file says so explicitly.
  if (L.maxScroll > 0) {
    S.el({
      id: 'dialogue.history.scroll', kind: 'scroll_extent', rect: L.vscroll,
      meta: { element: 3, from: L.firstLine, shown: L.visibleLines, total: L.lines.length },
    }, (c, r) => {
      c.globalAlpha = 1;
      c.fillStyle = Ca('root', 0.45);
      c.fillRect(r[0] + r[2] * 0.3, r[1], r[2] * 0.4, r[3]);
      const a = r[1] + (r[3] * L.firstLine) / L.lines.length;
      const b = r[1] + (r[3] * Math.min(L.lines.length, L.firstLine + L.visibleLines)) / L.lines.length;
      c.fillStyle = C('root_pale');
      c.fillRect(r[0], a, r[2], Math.max(6 * u, b - a));
    });
  }

  // ---- 5. the disposition bar (§A5, §D4) -----------------------------------------------------
  //
  // A NUMBER OUT OF 100, AND NEVER A WORD. No "Friendly", no five hearts, no colour-coded face.
  // `RI-DLG04` owns what moves it; this window owns that it is legible and that it is a number.
  //
  // RI-UIX06 G8 forbids "progress bars with a percentage numeral" and this is deliberately not
  // one: it is a relationship stat read out of the simulation, not a task completing, and
  // RI-UIX08's arbitration header gives this item the arrangement of this window. Recorded as a
  // ruling in the status file rather than left as an unremarked overlap.
  const dispo = Math.max(0, Math.min(100, Math.round(Number(m.disposition) || 0)));
  const dispoText = `${dispo}/100`;
  S.el({
    id: 'dialogue.disposition', kind: 'disposition_meter', rect: L.disposition,
    text: dispoText, meta: { element: 5, value: dispo, of: 100, is_word: false },
  }, (c, r) => {
    c.globalAlpha = 1;
    c.fillStyle = Ca('chitin', 0.85);
    c.fillRect(r[0], r[1], r[2], r[3]);
    c.fillStyle = DLG.fill;
    c.fillRect(r[0], r[1], r[2] * (dispo / 100), r[3]);
    const f = faceOf('bone'), sz = Math.max(Number(S.ctx.__esMinTextPx) || 0, 11 * u);
    const w = measure(dispoText, f, sz);
    drawText(c, dispoText, r[0] + r[2] / 2 - w / 2, r[1] + r[3] * 0.74, f, sz, DLG.header);
  });

  // ---- 4. the topic column: TWO SECTIONS, split by a rule (§A4, §D2) --------------------------
  //
  // Above the rule, the things you can DO with this person — `Persuasion`, `Barter`. Below it,
  // alphabetically, the things you can ASK them about the world. This is in neither the layout XML
  // nor any written description of the window; it is only in
  // `REF-A12b-dialogue__mw-3296790844.jpg`, and "a build that mixes `Barter` into the alphabetical
  // run has lost the distinction between doing something with this person and asking them about
  // the world."
  //
  // NOTHING HERE IS MARKED READ (§F1). Vanilla marks nothing; OpenMW's own `color topic enable`
  // defaults to false. Marking read topics grey turns a vocabulary into a checklist, and a
  // checklist is the FAQ failure this window exists to prevent.
  const TC = L.topics;
  const actions = m.actions || [];
  const topics = m.topics || [];
  const rowsFit = Math.max(1, Math.floor((TC[3] - (actions.length ? L.rowH * 0.9 : 0)) / L.rowH) - actions.length);
  const colScroll = Math.max(0, Math.min(Math.max(0, topics.length - rowsFit), m.column_scroll || 0));
  let ty = TC[1];
  const colFace = faceOf('ink');
  const colRow = (id, kind, label, idx, isAction) => {
    const focused = m.focus && m.focus.pane === 'column' && m.focus.rowIdx === idx;
    S.el({
      id, kind, rect: [TC[0], ty, TC[2], L.rowH], text: label, focused: !!focused,
      meta: { element: 4, section: isAction ? 'actions' : 'topics', topic: isAction ? null : id.split('/').pop() },
    }, (c, r) => {
      c.globalAlpha = 1;
      // §E3/§F1: ONE colour for every entry. No read/unread split, and the focused row is marked
      // by a cut mark in the margin rather than by a lightened fill (G6).
      drawText(c, clip(label, colFace, L.rowPx, r[2] - 10 * u), r[0] + 6 * u, r[1] + L.rowH * 0.72,
        colFace, L.rowPx, DLG.normal);
      if (focused) {
        c.beginPath();
        c.moveTo(r[0] + 1.5 * u, r[1] + L.rowH * 0.25);
        c.lineTo(r[0] + 1.5 * u, r[1] + L.rowH * 0.80);
        c.strokeStyle = DLG.header; c.lineWidth = Math.max(1, 2 * u); c.stroke();
      }
    });
    drawnText.push(label);
    ty += L.rowH;
  };
  actions.forEach((a, i) => colRow(`dialogue.action.${a.id}`, 'list_row', a.label, i, true));
  if (actions.length) {
    // The rule. A worked-bone divider, not a 1 px hairline (RI-UIX06 G4).
    const ry = ty + L.rowH * 0.35;
    S.el({
      id: 'dialogue.topics.rule', kind: 'divider', rect: [TC[0] + 2 * u, ry - 2 * u, TC[2] - 4 * u, 4 * u],
      meta: { element: 4, separates: ['actions', 'topics'] },
    }, (c, r) => {
      c.globalAlpha = 1;
      c.fillStyle = Ca('bone_dim', 0.65);
      c.fillRect(r[0], r[1] + r[3] * 0.4, r[2], Math.max(1, 1.6 * u));
    });
    ty = ry + L.rowH * 0.35;
  }
  const shown = topics.slice(colScroll, colScroll + rowsFit);
  shown.forEach((t, i) => colRow(`dialogue.topic/${t.id}`, 'list_row', t.label, actions.length + colScroll + i, false));

  // ---- 6. Goodbye (§A6, §D5) -----------------------------------------------------------------
  //
  // The full width of the topic column, caption centred, pinned to the corner. "It is the only way
  // out that the window advertises."
  const byeIdx = actions.length + topics.length;
  const byeFocused = m.focus && m.focus.pane === 'column' && m.focus.rowIdx === byeIdx;
  S.el({
    id: 'dialogue.goodbye', kind: 'dialogue_exit', rect: L.goodbye, text: m.goodbye || 'Goodbye',
    focused: !!byeFocused, meta: { element: 6, full_column_width: true },
  }, (c, r) => {
    c.globalAlpha = 1;
    // Bone: RI-UIX06 §A gives bone to "dividers, tick marks, level-up attribute pips, buttons".
    c.fillStyle = Ca(byeFocused ? 'bone' : 'bone_dim', byeFocused ? 0.42 : 0.22);
    c.fillRect(r[0], r[1], r[2], r[3]);
    const f = faceOf('bone'), sz = Math.max(Number(S.ctx.__esMinTextPx) || 0, 12 * u);
    const t = m.goodbye || 'Goodbye';
    const w = measure(t, f, sz);
    drawText(c, t, r[0] + r[2] / 2 - w / 2, r[1] + r[3] * 0.72, f, sz, DLG.header);
  });
  drawnText.push(m.goodbye || 'Goodbye');

  return {
    open: true,
    speaker: m.speaker || null,
    panel_px: [Math.round(L.panel[2]), Math.round(L.panel[3])],
    frame_px: [S.W, S.H],
    panel_width_frac: +(L.panel[2] / S.W).toFixed(4),
    panel_height_frac: +(L.panel[3] / S.H).toFixed(4),
    // B1, and this is the number the anchor check reads: the column is a fixed count of layout
    // units, so its FRACTION of the panel falls as the panel widens. A build that specified it as
    // a percentage would hold this constant, which is the fail.
    column_px: +L.colPx.toFixed(2),
    column_lu: LU.COL,
    column_frac_of_panel: +(L.colPx / L.panel[2]).toFixed(4),
    prose_px: +L.proseW.toFixed(2),
    layout_unit_px: +L.u.toFixed(4),
    client_lu: L.clientLU.map((v) => +v.toFixed(2)),
    interior_alpha: interiorAlpha,
    world_visible_behind: interiorAlpha < 1,
    body_px: +L.bodyPx.toFixed(2),
    chars_per_line: L.chars_per_line,
    leading: +(L.lineH / L.bodyPx).toFixed(3),
    disposition: dispo,
    disposition_text: dispoText,
    lines_total: L.lines.length,
    lines_visible: L.visibleLines,
    links_enabled: m.links_enabled !== false,
    links_total: L.links.length,
    links_drawn: linkEls,
    link_topics: L.links.map((l) => l.topic),
    // Published so a probe that finds no links can tell WHICH of the two reasons it is —
    // "nothing was offered to light" or "the prose does not name what was offered" — instead of
    // reporting a zero that could mean either. The first run of the browser probe reported
    // exactly that zero and cost a round to diagnose offline.
    linkable: (m.linkable || []).map((t) => t.id),
    blocks: (m.blocks || []).map((b) => ({ topic: b.topic, heading: b.heading, chars: b.text.length })),
    actions: actions.map((a) => a.id),
    topics: topics.map((t) => t.id),
    topics_shown: shown.length,
    focus: m.focus ? { ...m.focus } : null,
    text: drawnText,
  };
}

/** A tiled material band. Tiled, never stretched — REF-A12's `TileRect` is the construction. */
function band(c, x, y, w, h, u, seed, caption) {
  c.fillStyle = C('root');
  c.fillRect(x, y, w, h);
  const step = Math.max(3 * u, 6 * u);
  const along = w >= h;
  const n = Math.ceil((along ? w : h) / step);
  for (let i = 0; i < n; i++) {
    const j = jitter(seed, i);
    c.fillStyle = Ca(j > 0.2 ? 'root_pale' : 'chitin_lit', 0.16 + 0.12 * Math.abs(j));
    if (along) c.fillRect(x + i * step, y + h * 0.18, step * 0.62, h * 0.64);
    else c.fillRect(x + w * 0.18, y + i * step, w * 0.64, step * 0.62);
  }
  if (caption) { beads(c, x + 2 * u, y + 1.5 * u, w - 4 * u, u); beads(c, x + 2 * u, y + h - 2.5 * u, w - 4 * u, u); }
}

/** The fine beaded edging that runs the full width and continues past the name gap (§E2). */
function beads(c, x, y, w, u) {
  const step = 2.6 * u;
  c.fillStyle = Ca('bone_dim', 0.5);
  for (let i = 0; i * step < w; i++) c.fillRect(x + i * step, y, Math.max(1, u), Math.max(1, u));
}

function clip(text, face, size, maxW) {
  const t = String(text);
  if (measure(t, face, size) <= maxW) return t;
  let s = t;
  while (s.length > 2 && measure(s + '…', face, size) > maxW) s = s.slice(0, -1);
  return s + '…';
}
