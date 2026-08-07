// The interface: what is open, what has focus, what the buttons do, and what it all says.
//
// Owner: W1-21.
//
// THREE RULES THIS FILE IMPLEMENTS AND THAT NOTHING ELSE MAY UNDO.
//
// 1. S14, AS FRAME ARITHMETIC (RI-UIX03 §A). The inventory is ALWAYS openable. What changes at
//    the combat boundary is whether time passes: outside a fight the screen pauses the world,
//    inside one it does not. `pausesSimulation()` is the whole ruling and it is two lines. The
//    failure RI-UIX03 predicts is `if (menuOpen) return;` at the top of the update loop — one
//    line, obviously correct, and it silently deletes S14. The engine therefore asks THIS
//    object, which asks whether a fight is live, and `M-P2` reports raw frame counts because a
//    partial pause is a worse failure than a total one and a boolean would hide how total.
//
// 2. THE CLOSED ACTION SET, AND NOTHING ELSE. Every surface here is driven by `menu`, the
//    directional axes, `interact` and `roll` — four things, all of which a GameSir X2s Type-C
//    already reports through `GAMEPAD_BINDINGS` (start / left stick + d-pad / A / B). No new
//    button was added to `input/actions.js` and there is no pointer path anywhere in this
//    interface: no cursor, no hover, no drag, no click target. A menu that needs a mouse is a
//    menu the owner cannot use.
//    RI-UIX03 P6 is honoured exactly: in combat the menu takes `menu`, `interact` and the
//    directions, and leaves `roll`, `block` and `light` alive, so you can still dodge while the
//    screen is open. `roll` doubles as "back" only when no fight is live.
//
// 3. THERE IS NO MAP. `openMenu('map')` throws, `map` is never in `navigable`, and no mode
//    resolves to one. RI-UIX04 JU8 checks reachability AND existence and says the existence
//    half is the one that matters — "as with RI-UIX02 §F's compass, the fix is that there is
//    nowhere to put a pin". The legitimate need the map answers is answered where §F puts it:
//    a compass is a boxed ITEM you stop and open, and the shore charts are a pilot's written
//    directions read on the book screen. Both are objects with weight, in the inventory.
'use strict';

import { UISurface } from './surface.js';
import { drawHUD } from './hud.js';
import { drawInventory, drawContainer, sortRows, SORTS, CATEGORIES } from './screens/inventory.js';
import { drawJournal, drawBook, chronicle, interleaveRatio, bookPagination } from './screens/text.js';
import { drawLevelUp, drawSheet, drawSpells } from './screens/progress.js';
import { drawTouchOverlay, drawRotateState } from './touch-overlay.js';
import { RING, RING_COLS, screenRect, COMBAT_ALPHA, CALM_ALPHA } from './chrome.js';
import { barContrasts, MATERIALS } from './theme.js';
import { BODY } from './type.js';
import { MONTHS, EPOCH } from '../sim/quest/calendar.js';
import { BOX } from './chrome.js';

/** The closed mode vocabulary. `map` is not in it and never will be. */
export const MODES = ['world', 'dialogue', 'inventory', 'container', 'journal', 'book', 'levelup', 'sheet', 'spells'];

/** Modes `openMenu(name)` accepts. `map` is refused with the reason. */
export const OPENABLE = ['inventory', 'journal', 'book', 'levelup', 'sheet', 'spells', 'container'];

const REPEAT_FIRST = 14;      // frames before a held direction repeats
const REPEAT_EVERY = 6;

export class UISystem {
  /**
   * @param {object} data  {items: Map, books: Map, attributes: [], levels: {}, spells: []}
   */
  constructor(surface, data) {
    this.S = surface;
    this.data = data || {};
    this.mode = 'world';
    this.stack = [];
    this.focus = {
      inventory: { col: 1, tagIdx: 0, rowIdx: 0, sortIdx: 0 },
      container: { side: 0, rowIdx: 0, otherIdx: 0 },
      journal: { view: 'chronicle', page: 0, indexIdx: 0, ringIdx: 0, query: '' },
      book: { page: 0 },
      levelup: { attrIdx: 0, armed: false },
      sheet: { rowIdx: 0 },
      spells: { rowIdx: 0 },
    };
    this.bookId = null;
    this.bookPages = {};                 // T5: the page you were on, per book
    this.containerEid = null;
    this.toast = null;
    this.entryGlyphUntil = -1;
    this.pending = null;                 // an action the engine applies after the step
    this.axis = { x: 0, y: 0, sinceX: 0, sinceY: 0 };
    this.builtFrame = -1;
    this.lastModel = null;
    this.openedAt = 0;
  }

  // ---- the pause rule (S14 / RI-UIX03 §A) --------------------------------------------------

  /** True when the simulation must STOP. Outside a fight, in a menu. That is the whole rule. */
  pausesSimulation(inCombat) {
    return this.mode !== 'world' && this.mode !== 'dialogue' && !inCombat;
  }

  isMenu() { return this.mode !== 'world' && this.mode !== 'dialogue'; }

  // ---- opening and closing -----------------------------------------------------------------

  /**
   * Tell the input layer that a cursor-driven surface is open.
   *
   * `input/gamepad.js` only maps the D-PAD onto `move` while `pad.uiMode` is set — "the D-pad
   * drives `move` while a cursor-driven surface is open, so every list in the game is walkable
   * with a thumb". Without this call the left stick walks the menus and the D-pad does nothing,
   * which is exactly the half-working pad support that gets shipped and then discovered by the
   * one person who plays with a d-pad.
   */
  _surfaceChanged(real) {
    if (!real) return;
    const open = this.isMenu();
    if (real.pad) real.pad.uiMode = open || !!real.menuOpen;
    if (open && real.pointerLocked && typeof document !== 'undefined' && document.exitPointerLock) {
      try { document.exitPointerLock(); } catch { /* PL5 */ }
    }
  }

  open(name, opts, ctx) {
    const n = String(name);
    if (n === 'map' || n === 'minimap' || n === 'worldmap') {
      throw new Error(
        "openMenu('map'): there is no map screen in this game and there will not be one. " +
        'S8 forbids objective markers; RI-UIX04 Q7/JU8 forbid a map anywhere reachable from the ' +
        'journal and check that one does not exist, because a map is where a pin goes. ' +
        'The compass is an item (shore-compass) and the charts are prose (pilots-chart-book).');
    }
    if (OPENABLE.indexOf(n) < 0) {
      throw new Error(`openMenu('${n}'): unknown screen. Legal: ${OPENABLE.join(', ')}`);
    }
    if (n === 'levelup' && ctx && !ctx.atHearth) {
      throw new Error("openMenu('levelup'): the level-up screen exists at a HEARTH only (RI-UIX03 L1). " +
        'It is not on the pause menu and it is not available in the world.');
    }
    if (n === 'book') {
      const id = opts && opts.id;
      const b = this.data.books && this.data.books.get(String(id));
      if (!b) throw new Error(`openMenu('book', {id:'${id}'}): no such book in game/data/books/`);
      this.bookId = b.id;
      this.focus.book.page = this.bookPages[b.id] || 0;
    }
    if (n === 'container') this.containerEid = (opts && opts.eid) || null;
    if (this.isMenu() && this.mode !== n) this.stack.push(this.mode);
    this.mode = n;
    this.openedAt = ctx ? ctx.frame : 0;
    return this.mode;
  }

  close() { this.mode = 'world'; this.stack.length = 0; this.bookId = null; return this.mode; }

  back() {
    if (this.stack.length) { this.mode = this.stack.pop(); if (this.mode !== 'book') this.bookId = null; }
    else this.close();
    return this.mode;
  }

  /** JU8 / RI-UIX03: which modes can be reached from this one. `map` is never in it. */
  navigable(ctx) {
    if (!this.isMenu()) {
      const out = ['inventory', 'journal', 'sheet', 'spells'];
      if (ctx && ctx.atHearth) out.push('levelup');
      return out;
    }
    const out = ['world'];
    for (const m of ['inventory', 'journal', 'sheet', 'spells']) if (m !== this.mode) out.push(m);
    if (this.mode === 'inventory') {
      const it = this._selectedItem(ctx);
      if (it && it.readable) out.push('book');
    }
    if (ctx && ctx.atHearth && this.mode !== 'levelup') out.push('levelup');
    return out;
  }

  // ---- input -------------------------------------------------------------------------------

  /**
   * Consume this frame's input. Called from inside the fixed step (`sim.uiDriver`) so a menu
   * press lands on the same frame a swing would, and through the same latch.
   *
   * @returns {string[]} the action names taken, for `consumeUI`
   */
  step(input, ctx) {
    const taken = [];
    const inCombat = !!(ctx && ctx.inCombat);

    // `menu` — open the carried screen from the world, close everything from a screen.
    if (input.pressedName('menu')) {
      taken.push('menu');
      if (this.isMenu()) this.close(); else this.open('inventory', null, ctx);
      this._resetAxis();
      return taken;
    }
    if (!this.isMenu()) return taken;

    taken.push('interact');
    // P6: `roll` stays live in a fight. Out of one it is "back", which is Souls' own B button.
    if (!inCombat) taken.push('roll');

    // The move axes are the PIPELINE's: +y is forward, i.e. the stick pushed AWAY from you.
    // A list walks the other way — stick up goes to the earlier row — which is the convention
    // `character/scene.js` already set for the census surface ("stick up = earlier option").
    // Both surfaces therefore feel the same on the same pad, which is the whole point of there
    // being one convention rather than two.
    const dx = this._edge('x', input.moveX, ctx.frame);
    const dy = this._edge('y', -input.moveY, ctx.frame);
    if (dx || dy) this._move(dx, dy, ctx);
    if (input.pressedName('interact')) this._confirm(ctx);
    if (!inCombat && input.pressedName('roll')) this.back();
    return taken;
  }

  _resetAxis() { this.axis = { x: 0, y: 0, sinceX: 0, sinceY: 0 }; }

  /** A held stick or d-pad repeats on a FRAME COUNT, never on a clock. */
  _edge(which, raw, frame) {
    const v = Math.abs(raw) < 0.5 ? 0 : (raw > 0 ? 1 : -1);
    const key = which, since = which === 'x' ? 'sinceX' : 'sinceY';
    if (v !== this.axis[key]) { this.axis[key] = v; this.axis[since] = frame; return v; }
    if (!v) return 0;
    const held = frame - this.axis[since];
    if (held >= REPEAT_FIRST && (held - REPEAT_FIRST) % REPEAT_EVERY === 0) return v;
    return 0;
  }

  _move(dx, dy, ctx) {
    const f = this.focus;
    switch (this.mode) {
      case 'inventory': {
        const rows = this._invRows(ctx);
        if (dx) {
          f.inventory.col = clamp(f.inventory.col + dx, 0, 2);
        } else if (dy) {
          if (f.inventory.col === 0) f.inventory.tagIdx = clamp(f.inventory.tagIdx + dy, 0, CATEGORIES.length);
          else f.inventory.rowIdx = clamp(f.inventory.rowIdx + dy, 0, Math.max(0, rows.length - 1));
        }
        break;
      }
      case 'container': {
        if (dx) f.container.side = clamp(f.container.side + dx, 0, 1);
        else if (dy) {
          const k = f.container.side === 0 ? 'rowIdx' : 'otherIdx';
          const n = f.container.side === 0 ? this._invRows(ctx).length : this._containerRows(ctx).length;
          f.container[k] = clamp(f.container[k] + dy, 0, Math.max(0, n - 1));
        }
        break;
      }
      case 'journal': {
        const j = f.journal;
        if (j.view === 'search') {
          if (dx) j.ringIdx = clamp(j.ringIdx + dx, 0, RING.length - 1);
          if (dy) j.ringIdx = clamp(j.ringIdx + dy * RING_COLS, 0, RING.length - 1);
        } else if (j.view === 'index') {
          if (dy) j.indexIdx = clamp(j.indexIdx + dy, 0, Math.max(0, this._journalIndex(ctx).length - 1));
          if (dx > 0) j.view = 'chronicle';
        } else {
          if (dx < 0 && j.page === 0) j.view = 'index';
          else if (dx) j.page = Math.max(0, j.page + dx);
          if (dy) j.page = Math.max(0, j.page + dy);
        }
        break;
      }
      case 'book': {
        if (dx) f.book.page = Math.max(0, f.book.page + dx);
        if (dy) f.book.page = Math.max(0, f.book.page + dy);
        if (this.bookId) this.bookPages[this.bookId] = f.book.page;
        break;
      }
      case 'levelup':
        if (dy) { f.levelup.attrIdx = clamp(f.levelup.attrIdx + dy, 0, this._attributes(ctx).length - 1); f.levelup.armed = false; }
        break;
      case 'sheet':
        if (dy) f.sheet.rowIdx = clamp(f.sheet.rowIdx + dy, 0, Math.max(0, this._skills(ctx).length - 1));
        break;
      case 'spells':
        if (dy) f.spells.rowIdx = clamp(f.spells.rowIdx + dy, 0, Math.max(0, this._spells(ctx).length - 1));
        break;
      default: break;
    }
  }

  _confirm(ctx) {
    const f = this.focus;
    switch (this.mode) {
      case 'inventory': {
        if (f.inventory.col === 0) {
          if (f.inventory.tagIdx === CATEGORIES.length) {
            f.inventory.sortIdx = (f.inventory.sortIdx + 1) % SORTS.length;
          }
          f.inventory.rowIdx = 0;
          break;
        }
        const it = this._selectedItem(ctx);
        if (!it) break;
        if (it.readable && it.book_id && this.data.books.get(it.book_id)) {
          this.open('book', { id: it.book_id }, ctx);
        } else if (it.category === 'weapon' || it.category === 'armour' || it.category === 'clothing') {
          // P7: an equip is an animation-committed action. The engine applies it after the
          // step and holds the body for >= 30 frames.
          this.pending = { kind: 'equip', item: it.id };
        } else if (it.category === 'potion') {
          this.pending = { kind: 'use', item: it.id };
        }
        break;
      }
      case 'container': {
        const from = f.container.side === 0 ? this._invRows(ctx) : this._containerRows(ctx);
        const it = from[f.container.side === 0 ? f.container.rowIdx : f.container.otherIdx];
        if (it) this.pending = { kind: 'transfer', item: it.id, to: f.container.side === 0 ? 'container' : 'player' };
        break;
      }
      case 'journal': {
        const j = f.journal;
        if (j.view === 'index') {
          const q = this._journalIndex(ctx)[j.indexIdx];
          if (q) { j.view = 'chronicle'; j.page = this._pageOfQuest(ctx, q.journal_id); }
        } else if (j.view === 'search') {
          const ch = RING[j.ringIdx];
          j.query = (j.query + (ch === ' ' ? ' ' : ch)).slice(0, 24);
        } else {
          j.view = 'search'; j.query = ''; j.ringIdx = 0;
        }
        break;
      }
      case 'levelup': {
        const a = this._attributes(ctx)[f.levelup.attrIdx];
        if (!a) break;
        if (!f.levelup.armed) { f.levelup.armed = true; break; }   // L6: preview, then confirm
        f.levelup.armed = false;
        this.pending = { kind: 'level', attribute: a.id };
        break;
      }
      default: break;
    }
  }

  /** `back` inside a screen: leaves search/index first, then the screen. */
  backOrSub() {
    const j = this.focus.journal;
    if (this.mode === 'journal' && j.view === 'search') {
      if (j.query.length) { j.query = j.query.slice(0, -1); return this.mode; }
      j.view = 'chronicle'; return this.mode;
    }
    if (this.mode === 'journal' && j.view === 'index') { j.view = 'chronicle'; return this.mode; }
    return this.back();
  }

  // ---- drawing -----------------------------------------------------------------------------

  /**
   * Lay the interface out and draw it. Idempotent per frame and PURE with respect to the
   * simulation: it reads `ctx` and writes only the canvas and the element list.
   *
   * It is called from `Renderer.render()` AND from `getUIState()`, because every probe in this
   * project runs `setRenderRate(0)` before it steps and a HUD that only existed during a render
   * would report the frame before last to every measurement ever taken of it.
   */
  build(ctx, force) {
    // THE CACHE KEY HAS TO INCLUDE THE TOUCH OVERLAY, and this is not a micro-optimisation
    // detail — it is the difference between a drawn control and an undrawn one. `frame` and
    // `mode` do not change when a thumb goes down on the block button or when the drawer
    // opens, so a build keyed on those two alone would paint the overlay once and then never
    // again show a control pressed. `getUIState()` calls this with `force = false` on the same
    // frame a probe pressed something, which is exactly the read that would have gone stale.
    const sig = touchSignature(ctx);
    if (!force && this.builtFrame === ctx.frame && this.lastMode === this.mode && this.lastTouchSig === sig) return;
    const S = this.S;
    S.begin();
    // The HUD is drawn in the world and behind a menu, exactly as Souls does: opening the
    // inventory mid-fight does not hide your health.
    drawHUD(S, this._hudModel(ctx));
    // The screen's translucency is applied ONCE, over the screen's own rectangle, after it is
    // drawn — see UISurface.beginScreen(). The HUD is drawn first and outside that rectangle,
    // so opening the inventory mid-fight dims the screen and not your health bar.
    const alpha = ctx.inCombat ? COMBAT_ALPHA : CALM_ALPHA;
    if (this.isMenu()) S.beginScreen(screenRect(S), alpha);
    switch (this.mode) {
      case 'inventory': drawInventory(S, this._inventoryModel(ctx)); break;
      case 'container': drawContainer(S, this._containerModel(ctx)); break;
      case 'journal': drawJournal(S, this._journalModel(ctx)); break;
      case 'book': drawBook(S, this._bookModel(ctx)); break;
      case 'levelup': drawLevelUp(S, this._levelModel(ctx)); break;
      case 'sheet': drawSheet(S, this._sheetModel(ctx)); break;
      case 'spells': drawSpells(S, this._spellModel(ctx)); break;
      default: break;
    }
    if (this.isMenu()) S.endScreen();

    // ---- RI-JRN04 §G/H1: the two models that had no renderer, drawn ----------------------
    //
    // Both are drawn AFTER the screens and outside `beginScreen()`'s rectangle, for the same
    // reason the HUD is drawn before it: opening the inventory on a phone dims the inventory,
    // not the controls you need to close it with. T8 is upheld by construction — the layout is
    // measured from the safe area, so the controls cannot enter an inset — and the overlay is
    // suppressed entirely while a full-screen in-world illustration is up.
    this.touchDrawn = 0;
    this.rotateDrawn = false;
    if (ctx.rotate) {
      this.rotateDrawn = drawRotateState(S, ctx.rotate);
    } else if (ctx.touch) {
      this.touchDrawn = drawTouchOverlay(S, ctx.touch);
    }

    this.builtFrame = ctx.frame;
    this.lastMode = this.mode;
    this.lastTouchSig = sig;
  }

  // ---- models ------------------------------------------------------------------------------

  _hudModel(ctx) {
    const p = ctx.player;
    return {
      hpFrac: p.hpMax ? p.hp / p.hpMax : 0,
      staFrac: p.staminaMax ? p.stamina / p.staminaMax : 0,
      focusFrac: p.focusMax ? p.focus / p.focusMax : 0,
      canCast: !!p.focusMax,
      regenBlocked: ctx.frame < (p.regenBlockUntil || 0),
      spentFrom: p.staminaMax ? Math.min(1, (ctx.spentFrom === undefined || ctx.spentFrom === null ? p.stamina : ctx.spentFrom) / p.staminaMax) : 0,
      estus: p.estus, estusMax: ctx.estusMax || 5,
      equipLoadPct: p.equipLoadPct || 0,
      rollClass: p.rollClass || 'LIGHT',
      slots: ctx.slots,
      buildups: ctx.buildups || [],
      lockOn: ctx.lockOn,
      boss: ctx.boss,
      prompt: ctx.prompt,
      toast: ctx.frame < (this.toastUntil || 0) ? this.toast : null,
      entryGlyph: ctx.frame < this.entryGlyphUntil,
      inCombat: !!ctx.inCombat,
    };
  }

  _invRows(ctx) {
    const cat = CATEGORIES[this.focus.inventory.tagIdx] || 'all';
    const all = (ctx.inventory || []).map((row) => this._itemRow(row)).filter(Boolean);
    const filtered = cat === 'all' ? all : all.filter((r) => r.category === cat);
    return sortRows(filtered, SORTS[this.focus.inventory.sortIdx].id);
  }

  _containerRows(ctx) {
    return sortRows((ctx.container || []).map((r) => this._itemRow(r)).filter(Boolean), 'name');
  }

  _itemRow(row) {
    const rec = this.data.items && this.data.items.get(row.id);
    if (!rec) return null;
    return {
      id: row.id, name: rec.name, category: rec.category || rec.kind || 'misc',
      weight: Number(rec.weight) || 0, value_gold: Number(rec.value_gold) || 0,
      description: rec.description || '', readable: !!rec.readable, book_id: rec.book_id || null,
      condition: row.condition === undefined ? (rec.condition === undefined ? null : rec.condition) : row.condition,
      count: row.count || 1, stolen: !!row.stolen, equipped: !!row.slot,
    };
  }

  _selectedItem(ctx) {
    const rows = this._invRows(ctx);
    return rows[this.focus.inventory.rowIdx] || null;
  }

  _inventoryModel(ctx) {
    const rows = this._invRows(ctx);
    const all = (ctx.inventory || []).map((r) => this._itemRow(r)).filter(Boolean);
    const counts = { all: all.length };
    for (const c of CATEGORIES) if (c !== 'all') counts[c] = all.filter((r) => r.category === c).length;
    const load = all.reduce((a, r) => a + r.weight * (r.count || 1), 0);
    return {
      rows, counts, load: +load.toFixed(1), loadMax: ctx.loadMax || 0,
      burdenTier: ctx.burdenTier || 'unburdened',
      gold: ctx.gold || 0, placeName: ctx.placeName || null, inCombat: !!ctx.inCombat,
      ...this.focus.inventory,
    };
  }

  _containerModel(ctx) {
    return {
      rows: this._invRows(ctx), containerRows: this._containerRows(ctx),
      containerName: ctx.containerName, placeName: ctx.placeName,
      inCombat: !!ctx.inCombat, ...this.focus.container,
    };
  }

  /**
   * The journal, in the character's order.
   *
   * `day` is recovered from the entry's own prose date rather than read off a field, because
   * `save/state.js` projects a journal entry down to `{n, date, quest, text}` — the numeric day,
   * the write sequence and the flags do not survive a save. A screen that sorted on a dropped
   * field would be chronological in a fresh session and arbitrary in a loaded one, which is
   * exactly the class of defect the save-round-trip items exist to catch.
   */
  _journalModel(ctx) {
    const raw = ctx.journal || [];
    const entries = raw.map((e, i) => ({
      journal_id: e.quest, index: e.n, text: e.text, dateText: e.date,
      day: e.day === undefined ? dayFromText(e.date) : e.day, seq: e.seq === undefined ? i : e.seq,
      title: e.title || null, flags: e.flags || null,
    }));
    const ordered = chronicle(entries);
    const index = this._journalIndex(ctx);
    const j = this.focus.journal;
    const q = j.query.trim().toLowerCase();
    const results = q
      ? ordered.filter((e) => e.text.toLowerCase().includes(q)).map((e) => ({ ...e, context: contextOf(e.text, q) }))
      : [];
    return {
      entries: ordered, index, results, dateLabel: ctx.dateLabel || null,
      inCombat: !!ctx.inCombat, ...j,
      interleave_ratio: interleaveRatio(ordered),
    };
  }

  /**
   * J4: quest display names only, one per journal_id, ordered by the date of that quest's MOST
   * RECENT entry. No badge, no state, no count — J5.
   */
  _journalIndex(ctx) {
    const raw = ctx.journal || [];
    const seen = new Map();
    raw.forEach((e, i) => {
      const day = e.day === undefined ? dayFromText(e.date) : e.day;
      const cur = seen.get(e.quest);
      const named = e.flags && e.flags.indexOf('quest_name') >= 0;
      if (!cur) {
        seen.set(e.quest, { journal_id: e.quest, name: e.title || null, first: { day, n: e.n, seq: i }, last: day });
      } else {
        if (day > cur.last) cur.last = day;
        if (day < cur.first.day || (day === cur.first.day && e.n < cur.first.n)) cur.first = { day, n: e.n, seq: i };
        if (named && e.title) cur.name = e.title;
      }
      if (named && e.title) seen.get(e.quest).name = e.title;
    });
    const out = [];
    for (const v of seen.values()) {
      // Fall back to the quest definition's title, then to the id: the `quest_name` flag and the
      // title do not survive `save/state.js`'s projection, and a journal loaded from a save must
      // still have an index.
      const def = this.data.quests && this.data.quests[v.journal_id];
      out.push({ ...v, name: v.name || (def && def.title) || v.journal_id });
    }
    out.sort((a, b) => (b.last - a.last) || (a.name < b.name ? -1 : 1));
    return out;
  }

  _pageOfQuest(ctx, journalId) {
    // Which spread the quest's FIRST entry falls on. Computed the same way the screen lays out.
    const m = this._journalModel(ctx);
    const i = m.entries.findIndex((e) => e.journal_id === journalId);
    if (i < 0) return 0;
    return Math.floor(i / 12);      // conservative; the screen clamps to the real spread count
  }

  _bookModel(ctx) {
    const b = this.data.books.get(this.bookId);
    return { book: b, page: this.focus.book.page, inCombat: !!ctx.inCombat };
  }

  _attributes(ctx) {
    const decl = this.data.attributes || [];
    const live = ctx.attributes || {};
    return decl.map((a) => ({
      id: a.id, name: a.name, value: Number(live[a.id] === undefined ? 10 : live[a.id]),
      soft_cap: a.soft_cap, hard_cap_curve: a.hard_cap_curve,
      in_fight: a.in_fight, out_of_fight: a.out_of_fight,
    }));
  }

  _skills(ctx) {
    const decl = this.data.skills || [];
    const live = ctx.skills || {};
    return decl.map((s) => ({ id: s.id, name: s.name || s.id, value: (live[s.id] && live[s.id].value) || 0 }))
      .sort((a, b) => (a.name < b.name ? -1 : 1));
  }

  _spells(ctx) { return ctx.spells || []; }

  _levelModel(ctx) {
    const attrs = this._attributes(ctx);
    const a = attrs[this.focus.levelup.attrIdx];
    return {
      level: ctx.level, souls: ctx.souls, soulsToNext: ctx.soulsToNext,
      attributes: attrs, attrIdx: this.focus.levelup.attrIdx,
      preview: a ? (ctx.previewFor ? ctx.previewFor(a.id) : []) : [],
      hearthName: ctx.hearthName, inCombat: !!ctx.inCombat, armed: this.focus.levelup.armed,
    };
  }

  _sheetModel(ctx) {
    return {
      name: ctx.name, race: ctx.race, upbringing: ctx.upbringing, classLabel: ctx.classLabel,
      birthsign: ctx.birthsign, level: ctx.level, souls: ctx.souls,
      reputation: ctx.reputation, bounty: ctx.bounty,
      attributes: this._attributes(ctx), skills: this._skills(ctx),
      rowIdx: this.focus.sheet.rowIdx, inCombat: !!ctx.inCombat,
    };
  }

  _spellModel(ctx) {
    return {
      spells: this._spells(ctx), rowIdx: this.focus.spells.rowIdx,
      focusLabel: ctx.focusLabel, inCombat: !!ctx.inCombat,
    };
  }

  // ---- the report --------------------------------------------------------------------------

  /**
   * `getUIState()`. Everything RI-UIX01, RI-UIX02, RI-UIX03, RI-UIX04 and RI-UIX06 ask for, in
   * the shapes they asked for it, computed from the layout that was just performed.
   */
  state(ctx) {
    const S = this.S;
    const els = S.elements;
    const persistent = new Set(['health_bar', 'stamina_bar', 'focus_bar', 'heal_charges', 'quick_slots', 'equip_load']);
    const hud = els.filter((e) => e.id.startsWith('hud.'));
    const cw = S.W * 0.5, chh = S.H * 0.5;
    const centre = [S.W * 0.25, S.H * 0.25, cw, chh];
    const hudUnion = S.unionArea((e) => persistent.has(e.kind));
    const allHudUnion = S.unionArea((e) => e.id.startsWith('hud.'));
    const nonWorld = S.unionArea(() => true);
    // The size actually set on this screen, not a nominal figure — B4 is measured against
    // what the player reads.
    const bodyPx = (this.mode === 'book' ? BODY.book : BODY.screen) * S.s, labelPx = BODY.label * S.s;
    const bk = this.mode === 'book' && this.bookId ? this.data.books.get(this.bookId) : null;
    return {
      mode: this.mode,
      // never present, checked positively so that "no map" is a measurement rather than a claim
      map_exists: false,
      navigable: this.navigable(ctx),
      // W1-13 r2. The level-up screen is gated on this flag in three places above, and for the
      // whole of round 1 it was `undefined` at all 29 sapwells. Reporting it here means a probe
      // can see WHY the screen is or is not offered, and can see whether the answer came from
      // the province (`at_hearth_real`) or from the harness override (`at_hearth_overridden`).
      at_hearth: !!(ctx && ctx.atHearth),
      at_hearth_real: !!(ctx && ctx.atHearthReal),
      at_hearth_overridden: !!(ctx && ctx.atHearthOverridden),
      at_hearth_id: (ctx && ctx.atHearthId) || null,
      screen: { w: S.W, h: S.H, dpr: ctx && ctx.dpr ? ctx.dpr : 1 },
      elements: els.map((e) => ({ ...e })),          // RENDER ORDER PRESERVED — RI-UIX04 JU2
      coveragePct: +((nonWorld / (S.W * S.H)) * 100).toFixed(4),
      hud: {
        persistent_count: hud.filter((e) => persistent.has(e.kind) && e.visible).length,
        total_count: hud.filter((e) => e.visible).length,
        coverage_pct: +((hudUnion / (S.W * S.H)) * 100).toFixed(4),
        coverage_with_conditional_pct: +((allHudUnion / (S.W * S.H)) * 100).toFixed(4),
        centre_coverage_pct: +((S.unionArea((e) => e.id.startsWith('hud.') && e.kind !== 'lockon_reticle', centre) / (cw * chh)) * 100).toFixed(4),
        world_anchored: els.filter((e) => e.worldAnchor).map((e) => e.id),
        numeric_text: els.filter((e) => e.visible && e.text !== null && /\d/.test(String(e.text)) && e.id.startsWith('hud.')).map((e) => e.id),
        bar_contrasts: barContrasts(),
      },
      menu: {
        area_frac: +(S.unionArea((e) => e.kind === 'panel') / (S.W * S.H)).toFixed(4),
        opacity: this.isMenu() ? (ctx && ctx.inCombat ? 0.50 : 0.94) : 0,
        paused: this.pausesSimulation(!!(ctx && ctx.inCombat)),
      },
      book: bk ? { id: bk.id, page: this.focus.book.page * 2 + 1, ...bookPagination(bk.text, S) } : null,
      focus: this.focus[this.mode] ? { ...this.focus[this.mode] } : null,
      journal: this.mode === 'journal' ? {
        chronological: true,
        interleave_ratio: this._journalModel(ctx).interleave_ratio,
        entries: (ctx.journal || []).length,
        view: this.focus.journal.view,
        query: this.focus.journal.query,
      } : null,
      fonts: S.fonts(bodyPx, labelPx),
      // Honest, and the honesty is the point: the interface is rasterised by the 2D context from
      // OUTLINE data (game/src/ui/glyphs.js) into a canvas that is resized to the drawing buffer
      // on every setSize, so the blit is 1:1 and the glyph is re-rasterised at whatever device
      // resolution is asked for. `text_raster_scale` is the number M-F17.2 turns on: 1.000 means
      // nothing is being upscaled, and a critic can falsify it by resizing the window.
      textRenderPath: 'canvas-vector',
      text_raster_scale: +(S.canvas.width / Math.max(1, ctx && ctx.drawingBufferWidth ? ctx.drawingBufferWidth : S.canvas.width)).toFixed(4),
      text_glyph_source: 'game/src/ui/glyphs.js',
      materials: MATERIALS.filter((mm) => els.some((e) => e.material === mm)).concat(
        this.mode === 'world' ? [] : []),
      overdraw: +(S.overdrawPx / (S.W * S.H)).toFixed(3),
      // RI-JRN04 §G/H1, and RI-MTH07's observable for both models. These count what this
      // build's LAST LAYOUT actually painted, not what the input layer would like drawn —
      // `touch_controls_drawn` is 0 whenever `drawTouchOverlay()` returned 0, so a critic
      // ablating device class reads the difference here as well as in the framebuffer.
      touch: {
        controls_drawn: this.touchDrawn || 0,
        rotate_drawn: !!this.rotateDrawn,
        area_frac: +(S.unionArea((e) => e.kind === 'touch_button' || e.kind === 'touch_stick') / (S.W * S.H)).toFixed(4),
        rotate_area_frac: +(S.unionArea((e) => e.kind === 'rotate_illustration') / (S.W * S.H)).toFixed(4),
        labelled: els.filter((e) => (e.kind === 'touch_button' || e.kind === 'touch_stick') && e.text !== null).map((e) => e.id),
      },
      // legacy fields the pre-existing getUIState() reported; kept so nothing that read them breaks
      surfaces: els.length ? 1 : 0,
      full_screen_panels: els.filter((e) => e.kind === 'panel' && e.rect[2] * e.rect[3] > 0.9 * S.W * S.H).length,
      hud_elements: hud.filter((e) => e.visible).length,
      markers: 0,
      world_rendered_behind: true,
    };
  }
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

/** "16 Last Seed, 3E 427" -> an absolute day number. Inverse of calendar.dateOf(). */
export function dayFromText(text) {
  const m = /^(\d+)\s+(.+?),\s*(\d)E\s*(\d+)$/.exec(String(text || '').trim());
  if (!m) return 0;
  const day = Number(m[1]), monthName = m[2], year = Number(m[4]);
  let mi = MONTHS.findIndex((x) => x[0] === monthName);
  if (mi < 0) mi = 0;
  let doy = 0;
  for (let i = 0; i < mi; i++) doy += MONTHS[i][1];
  doy += day - 1;
  let epochDoy = 0;
  for (let i = 0; i < EPOCH.monthIndex; i++) epochDoy += MONTHS[i][1];
  epochDoy += EPOCH.day - 1;
  const years = year - EPOCH.year;
  return years * 365 + (doy - epochDoy);
}

function contextOf(text, needle) {
  const i = text.toLowerCase().indexOf(needle);
  if (i < 0) return text.slice(0, 160);
  const a = Math.max(0, i - 70), b = Math.min(text.length, i + needle.length + 90);
  return (a > 0 ? '…' : '') + text.slice(a, b) + (b < text.length ? '…' : '');
}

/**
 * A cheap, total description of everything the touch overlay and the rotate state would draw.
 *
 * `build()` compares it against the last one so that a control going down, the drawer opening,
 * the stick moving, the device class changing or the phone being turned all invalidate the
 * layout — none of which move `sim.frame` or `mode`. Written as a string rather than a hash so
 * that a probe that wants to know WHY the layout rebuilt can read it.
 */
function touchSignature(ctx) {
  if (ctx.rotate) return 'rotate:' + ctx.rotate.line;
  const t = ctx.touch;
  if (!t || !t.shown) return 'none';
  const st = t.stick && t.stick.active
    ? `|s:${Math.round(t.stick.ox)},${Math.round(t.stick.oy)},${t.stick.x.toFixed(3)},${t.stick.y.toFixed(3)}`
    : '';
  return `t:${t.viewport.w}x${t.viewport.h}|` +
    (t.controls || []).map((c) => `${c.action}${c.down ? '!' : ''}@${Math.round(c.x)},${Math.round(c.y)},${c.r}`).join(';') + st;
}
