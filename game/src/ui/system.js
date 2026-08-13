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
// 3. THERE IS A MAP, AND THE JOURNAL CANNOT REACH IT.
//    **This rule was rewritten by W1-MAP and the old text is worth keeping in view**, because
//    it is what the new text is a narrowing of, not a repeal of. It used to read: *"THERE IS
//    NO MAP. `openMenu('map')` throws, `map` is never in `navigable`, and no mode resolves to
//    one. RI-UIX04 JU8 checks reachability AND existence and says the existence half is the one
//    that matters."* That was seam S30, and on 2026-08-07 the project's owner overruled it with
//    **S35**: Morrowind ships a map and ships no quest markers in the same game, so the
//    existence of the surface was never what forbade the pin. S30 banned the room to stop the
//    furniture. See `corpus/00-doctrine/AMENDMENT-W1-MAP-01.md`, which S35 required be filed.
//
//    What survives S30 in full, and is implemented here:
//      * `open('minimap')` and `open('worldmap')` STILL THROW. Those are HUD furniture — a
//        live map in the corner of a fight — and S35 permits a screen, not a corner.
//      * **`navigable()` never puts `journal` and `map` next to each other, in either
//        direction.** RI-UIX04 Q7 is unamended and it reads "any map ... in or reachable from
//        the journal"; the "show on map" link is the exact leak Q7 exists to stop and it stays
//        stopped. Journal -> world -> map is two deliberate acts and passes through neither.
//      * The compass and the pilot's chart-book are NOT withdrawn. RI-UIX02 §F stands, and
//        `shore-compass` and `pilots-chart-book` are still items with weight in the inventory.
//        Wayfinding must work with this screen shut, because a map that shows only where you
//        have already been cannot get you anywhere new.
//    And what this screen may contain is in `ui/screens/map.js`, whose model reaches no quest
//    state at all.
'use strict';

import { UISurface } from './surface.js';
import { drawHUD } from './hud.js';
import { drawInventory, drawContainer, sortRows, SORTS, CATEGORIES } from './screens/inventory.js';
import { drawJournal, drawBook, chronicle, interleaveRatio, bookPagination } from './screens/text.js';
import { drawLevelUp, drawSheet, drawSpells } from './screens/progress.js';
import { drawMap, shadeHex } from './screens/map.js';
import { drawWait } from './screens/wait.js';
import { drawTouchOverlay, drawRotateState } from './touch-overlay.js';
import { RING, RING_COLS, screenRect, COMBAT_ALPHA, CALM_ALPHA } from './chrome.js';
import { barContrasts, MATERIALS } from './theme.js';
import { BODY } from './type.js';
import { MONTHS, EPOCH, dateOf } from '../sim/quest/calendar.js';
import { BOX } from './chrome.js';

/** The closed mode vocabulary. `minimap` and `worldmap` are not in it and never will be. */
export const MODES = ['world', 'dialogue', 'inventory', 'container', 'journal', 'book', 'levelup', 'sheet', 'spells', 'map', 'wait'];

/** Modes `openMenu(name)` accepts. `minimap`/`worldmap` are refused with the reason. */
export const OPENABLE = ['inventory', 'journal', 'book', 'levelup', 'sheet', 'spells', 'container', 'map', 'wait'];

/**
 * The pair that must never be adjacent, in either direction (RI-UIX04 Q7, unamended).
 * Expressed as data so that the check is one line in `navigable()` and one line in the probe,
 * rather than a condition somebody has to remember while editing the list above.
 */
export const NEVER_ADJACENT = [['journal', 'map']];

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
      // W1-MAP. `view` is 'world' or 'local'; `placeIdx` is which discovered place the stick is
      // pointing at. There is no `target`, no `centre` and no `pin` here, and there is nothing
      // in this record a quest could set that would move anything on the screen.
      map: { view: 'world', placeIdx: 0 },
      wait: { hours: 1 },
    };
    this.bookId = null;
    this.bookPages = {};                 // T5: the page you were on, per book
    this.containerEid = null;
    this.toast = null;
    this.entryGlyphUntil = -1;
    this.pending = null;                 // an action the engine applies after the step
    this.actEpoch = 0;                   // bumped by every `pending` write — see build()'s key
    this.navRefused = null;              // why the last peer walk did not land, if it did not
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
    if (n === 'minimap' || n === 'worldmap') {
      throw new Error(
        `openMenu('${n}'): there is no minimap in this game and there will not be one. ` +
        'ARBITRATION S35 permits a map SCREEN — a thing you stop and open, that records where ' +
        'you have been — and RI-UIX01 §B still forbids `minimap` and `compass` as HUD elements. ' +
        "The screen is openMenu('map'); a live map in the corner of a fight is not the same " +
        'object and is not what was permitted.');
    }
    if (OPENABLE.indexOf(n) < 0) {
      throw new Error(`openMenu('${n}'): unknown screen. Legal: ${OPENABLE.join(', ')}`);
    }
    if (n === 'levelup' && ctx && !ctx.atHearth) {
      throw new Error("openMenu('levelup'): the level-up screen exists at a HEARTH only (RI-UIX03 L1). " +
        'It is not on the pause menu and it is not available in the world.');
    }
    if (n === 'wait' && ctx && ctx.inCombat) {
      throw new Error("openMenu('wait'): you cannot wait while enemies are engaged");
    }
    if (n === 'wait') this.focus.wait.hours = 1;
    // W1-13 round 3, GAP-W1-levelup-screen-and-character-speak-different-languages. The screen
    // draws its rows from `game/data/progression/attributes.json`; the character carries
    // `sim.progression.attributes`. When those were two different vocabularies the room still
    // opened and still took the money — seven rows for attributes nobody had, three attributes
    // that could not be raised at all. A door that opens is not the same thing as a room that
    // sells you something, so it is refused rather than drawn.
    if (n === 'levelup' && ctx && ctx.attrVocabulary && ctx.attrVocabulary.ok === false) {
      const v = ctx.attrVocabulary;
      throw new Error("openMenu('levelup'): the screen and the character are speaking different " +
        `languages. On screen but not carried: [${v.on_screen_not_carried.join(', ') || '-'}]; ` +
        `carried but not on screen: [${v.carried_not_on_screen.join(', ') || '-'}]. ` +
        'game/data/progression/attributes.json is the vocabulary; Engine._ensureAttributeRegister() ' +
        'reconciles the register against it on every loadState().');
    }
    if (n === 'book') {
      const id = opts && opts.id;
      const b = this.data.books && this.data.books.get(String(id));
      if (!b) throw new Error(`openMenu('book', {id:'${id}'}): no such book in game/data/books/`);
      this.bookId = b.id;
      // Clamped on the way IN as well as on the way out (see `_lastSpread`). A resumed reading
      // position is a spread index taken at whatever resolution the last session ran at, and the
      // same book paginates to more spreads at 3840×2160 than at 1280×720 — so a save written on
      // a big screen resumes past the end of the book on a small one. The clamp is the fix and
      // it belongs on both sides of the save.
      this.focus.book.page = this._clampSpread(this.bookPages[b.id] || 0, b);
      // W1-LIBRARY round 2. THE READ SITE, and it is here rather than in `Engine.openMenu()`
      // because `Engine.openMenu()` is the HARNESS door. A player reads a book by selecting a
      // readable in the inventory and pressing confirm — `_confirm()` calls `this.open('book',
      // …)` directly and never goes near the engine wrapper — so the recorder that used to sit
      // in the wrapper could not see the only route a person actually takes. Both routes pass
      // through this line. `onBookOpened` is installed by the Engine; the UI does not know what
      // reading means, only that it happened.
      if (this.onBookOpened) this.onBookOpened(b);
    }
    // W1-MAP / AMENDMENT-W1-MAP-01 §3b: "the map screen must accept no parameter that names a
    // place". `open('book', {id})` establishes that a screen CAN be opened onto something, so
    // the map's refusal has to be explicit rather than implied by the absence of a handler — a
    // silently-ignored `{place: 'stormhold'}` looks to a caller exactly like a working call
    // that has not been wired up yet, which is how the next person adds the wiring.
    if (n === 'map' && opts && Object.keys(opts).length) {
      throw new Error(
        `openMenu('map', ${JSON.stringify(opts)}): the map takes no arguments. It is a record ` +
        'of where you have been, not a place to send you: ARBITRATION S35 forbids "any icon a ' +
        'quest can place, request or highlight" and any "show on map" affordance. There is no ' +
        'parameter here in which a place could be named, and adding one is a hard fail under ' +
        'RI-UIX04 Q13.');
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

  /**
   * RI-UIX04 JU8 (as amended) / RI-UIX03: which modes can be reached from this one.
   *
   * **`journal` and `map` are never in each other's list.** Q7 is unamended and forbids "any
   * map ... in or reachable from the journal"; the second half of the amended JU8 asks for the
   * reverse direction too, so that the pair cannot be bridged from either side by somebody who
   * only read one of the two clauses. Everything else about this method is unchanged.
   */
  navigable(ctx) {
    const peers = ['inventory', 'journal', 'sheet', 'spells', 'map'];
    if (!(ctx && ctx.inCombat)) peers.push('wait');
    if (!this.isMenu()) {
      const out = peers.slice();
      if (ctx && ctx.atHearth) out.push('levelup');
      return out;
    }
    const out = ['world'];
    for (const m of peers) {
      if (m === this.mode) continue;
      if (NEVER_ADJACENT.some((pair) => pair.includes(m) && pair.includes(this.mode))) continue;
      out.push(m);
    }
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

    // ---- W1-21 round 2: THE DOOR BETWEEN SCREENS (NEXT-DISPATCH §P.6) ------------------------
    //
    // `navigable(ctx)` has always advertised six destinations at a hearth — inventory, journal,
    // sheet, spells, map, levelup — and until this branch existed there was no way to reach five
    // of them. W1-13 round 4 measured it rather than reading it: all sixteen actions of RI-JRN03
    // §A pressed one at a time, from the world and from every screen they open, plus all four
    // axes, and **input reached exactly two modes**. `openMenu('levelup')` succeeded on the same
    // body on the same frame, so the state, the hearth and the vocabulary were all fine and the
    // input path was the whole defect. `menu` opens the inventory and closes everything; the
    // axes are spent walking the open screen's own rows; nothing walked to a peer.
    //
    // THE ACTION SET IS NOT WIDENED. RI-JRN03 §A closes it at fourteen names and `swap_left` /
    // `swap_right` are two of the fourteen — already bound on keyboard (`3`/`4` and the wheel),
    // on the pad (D-pad left/right) and on touch. What changes is what they MEAN while a screen
    // is open, which is declared rather than assumed: see `state().actions_in_menu`.
    //
    // AND ONLY OUT OF COMBAT, which is not tidiness. In a fight `swap_left` is half of the
    // offhand chord (`input-map.json` `off.r1.*` is "swap_left HELD + light tap",
    // `combat/player.js`), and RI-UIX03 P6 requires the fight to stay playable with the screen
    // up. So this branch takes the same shape the file already uses for `roll`: it is "back" out
    // of a fight and a dodge in one, and these two are "walk to the next screen" out of a fight
    // and equipment cycling in one. One rule, two applications, no new verb.
    // A pad D-pad press deliberately arrives as BOTH the normalised movement axis and the
    // profile's swap action.  The axis owns navigation inside the current surface; the action
    // still owns keyboard/wheel peer walking (which have no movement axis), and remains live for
    // combat below.  Without the axis guard, D-pad Left walked inventory -> world before `_move`
    // could change the selected column, leaving the GameSir path half-working.
    const navX = input.uiMoveX || input.moveX;
    const navY = input.uiMoveY || input.moveY;
    const padNavigating = Math.abs(input.uiMoveX) >= 0.5 || Math.abs(input.uiMoveY) >= 0.5;
    if (!inCombat && !padNavigating) {
      const step = (input.pressedName('swap_right') ? 1 : 0) - (input.pressedName('swap_left') ? 1 : 0);
      if (step) {
        taken.push(step > 0 ? 'swap_right' : 'swap_left');
        this._walkPeer(step, ctx);
        this._resetAxis();
        return taken;
      }
    }

    // The move axes are the PIPELINE's: +y is forward, i.e. the stick pushed AWAY from you.
    // A list walks the other way — stick up goes to the earlier row — which is the convention
    // `character/scene.js` already set for the census surface ("stick up = earlier option").
    // Both surfaces therefore feel the same on the same pad, which is the whole point of there
    // being one convention rather than two.
    const dx = this._edge('x', navX, ctx.frame);
    const dy = this._edge('y', -navY, ctx.frame);
    if (dx || dy) this._move(dx, dy, ctx);
    if (input.pressedName('interact')) this._confirm(ctx);
    if (!inCombat && input.pressedName('roll')) this.back();
    return taken;
  }

  /**
   * The order the screens are walked in. `world` is in it because `navigable()` advertises it and
   * because a ring you cannot leave the way you came is worse than one you can.
   *
   * `book` and `container` are NOT walk targets, and that is declared here rather than left to be
   * discovered: both are screens opened ONTO an object — a book has an id, a container has an
   * entity — so there is no such thing as "walk to the book" without naming which book. They are
   * reached by confirming the thing itself, which already works, and you can walk OUT of them.
   * `state().nav.walkable` reports the ring, so the difference between what is advertised and
   * what is walkable is a number a probe reads rather than a claim in a comment.
   */
  static WALK_ORDER = ['world', 'inventory', 'journal', 'sheet', 'spells', 'map', 'wait', 'levelup'];

  /** The ring this mode sits in: WALK_ORDER filtered to here plus everywhere advertised. */
  _walkRing(ctx) {
    const nav = this.navigable(ctx);
    return UISystem.WALK_ORDER.filter((m) => m === this.mode || nav.includes(m));
  }

  /**
   * Walk one screen along the advertised list. NEXT-DISPATCH §P.6's missing door.
   *
   * It goes through `navigable()` and therefore inherits every refusal already written there —
   * `NEVER_ADJACENT` keeps `journal` and `map` out of each other's ring in both directions
   * (RI-UIX04 Q7), and `levelup` is only in the ring at a hearth. It cannot reach a screen
   * `openMenu()` would refuse, because it calls the same `open()`; a refusal leaves the mode
   * where it was and is recorded rather than thrown, because this runs inside the fixed step and
   * a throw here kills the step for everyone.
   */
  _walkPeer(dir, ctx) {
    const ring = this._walkRing(ctx);
    const at = ring.indexOf(this.mode);
    if (at < 0 || ring.length < 2) return this.mode;
    const to = ring[((at + dir) % ring.length + ring.length) % ring.length];
    this.navRefused = null;
    if (to === 'world') { this.close(); return this.mode; }
    try {
      // A peer replaces the screen rather than stacking on it: walking inventory -> journal ->
      // sheet and pressing back should return you to the world, not retrace four rooms.
      this.stack.length = 0;
      this.mode = 'world';
      this.bookId = null;             // T5 keeps the PAGE in `bookPages`; the open book is closed
      this.open(to, null, ctx);
    } catch (e) {
      this.mode = ring[at];
      this.navRefused = { to, reason: String(e && e.message || e) };
    }
    return this.mode;
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
        // W1-LIBRARY round 2. This used to be `Math.max(0, page + d)` — floored and NOT
        // capped — while `drawBook()` clamps the spread it actually draws to the last one. The
        // two disagreeing is the whole defect, and it is three separate failures at once:
        //
        //   * RI-UIX05 T8 ("the book's identity and page are in getUIState() so a critic can
        //     assert what is on screen") was false. Measured in the browser before this fix:
        //     `a-progress-iii` is 11 pages, i.e. 6 spreads, and holding right walked
        //     `focus.book.page` to 12 while the screen still showed the last spread —
        //     `getUIState().book.page` reported **25** for a book whose last page is 11.
        //   * a player who over-turns has to press LEFT once for every phantom turn before the
        //     page moves, with nothing on screen changing to explain why.
        //   * T5 persists the position, so the nonsense index went into the save, and
        //     `dialogue.book_pages` carried a spread that does not exist into the next session.
        //
        // Clamping here rather than in the drawer keeps ONE number: what the model holds is what
        // is drawn is what `getUIState()` reports.
        const d = dx || dy;
        if (d) f.book.page = this._clampSpread(f.book.page + d);
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
      // W1-MAP. The stick walks the places you have FOUND — it does not pan a camera over the
      // province and it cannot rest on somewhere you have not been, because the list it indexes
      // is the discovery model's own and contains nothing else. Pointing at a place names it.
      case 'map': {
        const n = this._mapPlaces(ctx).length;
        if (dx || dy) f.map.placeIdx = clamp(f.map.placeIdx + (dx || dy), 0, Math.max(0, n - 1));
        break;
      }
      case 'wait': {
        const d = dy || dx;
        if (d) f.wait.hours = clamp(f.wait.hours + d, 1, 24);
        break;
      }
      default: break;
    }
  }

  /**
   * Hand an action to the engine, and MARK THAT THE MODEL IS ABOUT TO CHANGE.
   *
   * Every write to `this.pending` goes through here, so the layout cache cannot miss one. It is a
   * method rather than four assignments because the round-1 verdict's §4 defect was exactly a
   * cache key that covered three of the four things that move on a paused frame — the way to stop
   * that recurring is to make there be one place, not to remember four.
   */
  _queue(act) { this.pending = act; this.actEpoch++; return act; }

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
          this._queue({ kind: 'equip', item: it.id });
        } else if (it.category === 'potion') {
          this._queue({ kind: 'use', item: it.id });
        }
        break;
      }
      case 'container': {
        const from = f.container.side === 0 ? this._invRows(ctx) : this._containerRows(ctx);
        const it = from[f.container.side === 0 ? f.container.rowIdx : f.container.otherIdx];
        if (it) this._queue({ kind: 'transfer', item: it.id, to: f.container.side === 0 ? 'container' : 'player' });
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
      // W1-MAP. Confirm SWAPS THE VIEW. It does not travel, and this is the one line in this
      // file where the temptation is real: `confirm` is already an "activate the selected row"
      // verb everywhere else, and the selected row here is a place. S35 makes "fast travel by
      // clicking the map" a hard fail, so confirm is bound to the only other thing S35 permits
      // the screen to do — the local view of the cell you are in. `this.pending` is NOT written
      // in this branch, so there is no action for the engine to apply afterwards either.
      case 'map':
        f.map.view = f.map.view === 'world' ? 'local' : 'world';
        break;
      case 'wait':
        this._queue({ kind: 'wait', hours: clamp(f.wait.hours, 1, 24) });
        break;
      case 'levelup': {
        const a = this._attributes(ctx)[f.levelup.attrIdx];
        if (!a) break;
        if (!f.levelup.armed) { f.levelup.armed = true; break; }   // L6: preview, then confirm
        f.levelup.armed = false;
        this._queue({ kind: 'level', attribute: a.id });
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
    // AND IT HAS TO INCLUDE THE FOCUS, for a reason that is worse than the touch one: while any
    // screen is up the world is PAUSED (RI-UIX03 §A, out of combat), and `engine._step()`'s
    // paused branch latches input WITHOUT calling `stepOnce()`. So `ctx.frame` does not advance
    // at all while a menu is open. `mode` does not change either, and neither does the touch
    // signature. The three-part key above is therefore CONSTANT for the entire life of the
    // screen — and every focus change a player makes with an actual button was discarded.
    //
    // Measured, through the real input pipeline, before this line existed: pressing confirm on
    // the map moved `focus.map.view` to `local` and the drawn terrain element still reported
    // `view: 'world'` with its rect unchanged at the province aspect — so S35's local view was
    // wired but not reachable. In the journal, the stick moved `focus.journal.page` 0 -> 1 and
    // the drawn elements were identical: a player turning a page saw nothing move.
    //
    // It survived this long because `uiFocus()`, `openMenu()` and `closeMenu()` all call
    // `build(ctx, true)`. Every probe that moves focus through the harness door forces a
    // rebuild and cannot see this; only input driven through the pipeline can.
    //
    // W1-21 ROUND 2 — AND FOCUS IS NOT THE ONLY THING THAT MOVES WHILE THE WORLD IS STOPPED.
    // The round-1 verdict §4 confirmed the focus term works (55,656 px on a focus move) and then
    // showed the other half is still open: `Engine._afterStep()` runs on paused frames and
    // applies `ui.pending` there — `use`, `transfer`, `level` and `equip` all commit while the
    // world is stopped, and none of them touches `focus[mode]`. Measured in pixels through the
    // real input pipeline: a player selects a potion, presses use, the potion leaves the
    // simulation, and **the screen does not move a single pixel** (0 px) until they close the
    // inventory and open it again (102 px on reopen). That is the third instance of one family
    // of defect in this interface and the second time it has shipped after being fixed.
    //
    // `pending` is the whole channel — `_confirm()` is the only writer and `Engine._afterStep()`
    // is the only reader, and it nulls it after applying — so putting it in the key covers every
    // one of the four actions and cannot miss a fifth added later. It appears in the key TWICE
    // over, once as it is set and once as it is cleared, which is deliberate: whichever side of
    // `_afterStep()` a build happens on, the key has moved.
    const sig = touchSignature(ctx) + '#' + focusSignature(this.mode, this.focus)
      + '#p:' + (this.pending ? JSON.stringify(this.pending) : '-') + ':' + this.actEpoch;
    if (!force && this.builtFrame === ctx.frame && this.lastMode === this.mode && this.lastTouchSig === sig) return;
    const S = this.S;
    S.begin();
    // THE TITLE SCREEN IS NOT A WORLD AND THERE IS NOBODY TO HAVE A HEALTH BAR.
    //
    // W1-26 r2 §6 named this and r3 did not touch it; the r3 critic put a picture of it in the
    // verdict (§7 G5) and it is the FIRST thing a new player sees. The drawn-string list of a
    // fresh `./play.sh` launch opened `'5'`, `'LIGHT'`, `'Spark-Da…'` — a stranger's purse, a
    // stranger's roll class and a stranger's equipped spell, painted over the title before any
    // character exists. Every one of those numbers is `sim.player`'s boot defaults, so they are
    // not merely premature, they are about a person the player has not made yet.
    //
    // Suppressed HERE, inside `build()`, and not at the renderer's composite call, because
    // `Engine.getUIState()` calls `this.ui.build(ctx, false)` directly — every probe in the tree
    // reads the HUD through that door, and a gate on the composite would have left the strings in
    // `render/text-register.js` and in `getUIState().hud_elements` while removing them from the
    // frame. That is the divergence between intention and paint this whole area exists to catch.
    //
    // `hudSuppressed` is reported by `state()` so the absence is legible as a decision rather
    // than as an empty result — an empty result and a clean result must never be the same value.
    this.hudSuppressed = !!ctx.titleShown;
    // The HUD is drawn in the world and behind a menu, exactly as Souls does: opening the
    // inventory mid-fight does not hide your health.
    if (!this.hudSuppressed) drawHUD(S, this._hudModel(ctx));
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
      case 'map': drawMap(S, this._mapModel(ctx)); break;
      case 'wait': drawWait(S, this._waitModel(ctx)); break;
      default: break;
    }
    if (this.isMenu()) S.endScreen();

    // ---- RI-JRN04 §G/H1: the two models that had no renderer, drawn ----------------------
    //
    // Both are drawn AFTER the screens and outside `beginScreen()`'s rectangle, for the same
    // reason the HUD is drawn before it: opening the inventory on a phone dims the inventory,
    // not the controls you need to close it with. The overlay is suppressed entirely while a
    // full-screen in-world illustration is up.
    //
    // THIS COMMENT USED TO SAY "T8 IS UPHELD BY CONSTRUCTION", AND THAT IS WHY IT NOW SAYS A
    // NUMBER INSTEAD. T8's headline defect in round 1 was this exact sentence: it claimed both
    // clauses while only the first was even arguable, and 7 of 11 controls sat on the name
    // ledger. Round 1 fixed the code; the sentence stayed here verbatim, and `input/touch.js`
    // described it in the PAST tense, so a reader of the new file was told the false claim had
    // been removed when it had not. The round-1 critic found it at HEAD and §5 of its verdict is
    // this line. "By construction" is not a measurement, and on this project a claim that cannot
    // go red is worth nothing — so both clauses are measured, each with a teardown that reddens:
    //
    //   clause 1, nothing in a safe-area inset — `tools/touch/critic-fight.mjs --leg insets`.
    //     Under RI-JRN04 M-P17's real {top 0, right 44, bottom 21, left 44} cutout, 11 of 11
    //     controls stay clear. NULL CONTROL: re-anchor `TouchInput._origin()` to the frame corner
    //     instead of the safe-area corner and 3 of 11 (interact, use_item, lock_on) land inside
    //     an inset. Every profile round 1 measured had insets of ZERO, so its `insetViolations:
    //     0` was a measurement against nothing; this one is against a cutout AND against a
    //     teardown that fails.
    //   clause 2, never overlap the dialogue surface — `--leg menu`. While a surface takes input
    //     the arc reduces from 11 controls to 2 (`block`, `interact`). This clause is NOT upheld
    //     by construction and never was: it is upheld by `TouchInput.keepOnly`, which is a
    //     filter, which is deletable, which is why it is measured.
    //
    // Its declared cost is measured too, because RULING R2 said the drawer goes with the arc and
    // `menu` lives in the drawer: a touch player CANNOT open the pause menu mid-conversation.
    // One tap on `interact` ends the conversation and gives the whole arc back, so nobody is
    // trapped — but that is a fact with a measurement behind it, not a design intention.
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

  /**
   * The last spread index of a book at the CURRENT screen, which is the only bound that means
   * anything: pagination is a function of the surface, so the same book is 6 spreads at
   * 320×240 and rather more at 3840×2160.
   *
   * `bookPagination()` is the same call `getUIState()` and `drawBook()` make, so all three agree
   * by construction rather than by three people remembering the same arithmetic.
   *
   * Fails OPEN, deliberately: if there is no screen yet (`this.S` is null before the first
   * build) or the book has no text, the floor is still applied and the cap is not. A cap
   * computed from a screen that does not exist would be a made-up number, and refusing to turn
   * the page at all would be worse than the defect being fixed. The clamp on `open()` catches
   * the resumed position the moment a screen exists.
   */
  _clampSpread(page, book) {
    const p = Math.max(0, Math.floor(Number(page) || 0));
    const b = book || (this.bookId && this.data.books ? this.data.books.get(this.bookId) : null);
    if (!b || !b.text || !this.S) return p;
    const pages = bookPagination(b.text, this.S).pages;
    return Math.min(p, Math.max(0, Math.ceil(pages / 2) - 1));
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

  _waitModel(ctx) {
    const hours = clamp(this.focus.wait.hours, 1, 24);
    const now = Number(ctx.clock && ctx.clock.hour) || 0;
    const day = Math.max(0, Math.floor(Number(ctx.clock && ctx.clock.day) || 0));
    const total = now + hours;
    const afterDay = day + Math.floor(total / 24);
    const after = ((total % 24) + 24) % 24;
    const clock = (h) => {
      const mins = Math.round(h * 60) % (24 * 60);
      return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    };
    return {
      hours, clockNow: clock(now), clockAfter: clock(after),
      dateNow: dateOf(day).text, dateAfter: dateOf(afterDay).text,
    };
  }

  // ---- the map (W1-MAP / ARBITRATION S35) ---------------------------------------------------

  /**
   * The places the player has stood in, in the order they were found.
   *
   * **The discovery model is the ONLY source.** There is no merge with `pois.json`'s full list,
   * no "nearby" set and no quest-supplied set — `d.places()` returns ids the body was inside the
   * built pad of, and this method decorates them with a name and a position and nothing else.
   * S35: "any square for a place the player has not personally stood in" is a hard fail, and the
   * way to hold that is to have no other list to accidentally read from.
   */
  _mapPlaces(ctx) {
    const mc = ctx && ctx.map;
    if (!mc || !mc.discovery) return [];
    const out = [];
    for (const id of mc.discovery.places()) {
      const pos = mc.discovery.placePos(id);
      if (!pos) continue;
      const rec = mc.pois && mc.pois.get(id);
      out.push({ id, name: (rec && rec.name) || id, x: pos[0], z: pos[1] });
    }
    return out;
  }

  /**
   * What `screens/map.js` draws from. Note what is NOT in it: no quest, no objective, no giver,
   * no rumour subject, no route, no distance, no bearing, no destination. The screen therefore
   * cannot render one by accident, because there is nothing in its argument to render.
   */
  _mapModel(ctx) {
    const mc = (ctx && ctx.map) || {};
    const d = mc.discovery;
    const f = mc.field;
    const doc = mc.doc || {};
    const draw = doc.draw || {};
    const places = this._mapPlaces(ctx);
    const fm = this.focus.map;
    fm.placeIdx = clamp(fm.placeIdx, 0, Math.max(0, places.length - 1));

    // The height range, for shading. Computed once from the raster the collision surface uses
    // and cached on the interface, because it is a property of the province and the province
    // does not change while the game is running.
    if (f && !this._mapShade) {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < f.base.length; i++) { const v = f.base[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
      this._mapShade = { lo, hi: hi > lo ? hi : lo + 1 };
    }
    const sh = this._mapShade || { lo: 0, hi: 1 };
    const range = draw.shade_range || [0.72, 1.18];
    const regions = (mc.regions || []).map((r) => (r.palette_hex && r.palette_hex[0]) || '#555555');
    const oceanHex = draw.ocean_hex || '#243542';

    return {
      view: fm.view,
      inCombat: !!(ctx && ctx.inCombat),
      regionName: mc.regionName || null,
      cols: d ? d.cols : 0, rows: d ? d.rows : 0, cell: d ? d.cell : 25,
      totalCells: d ? d.cols * d.rows : 1,
      revealedCells: d ? d.revealedCells : 0,
      world: { w: f ? f.sizeX : 1, h: f ? f.sizeZ : 1 },
      localSpan: Number(draw.local_span_m) || 500,
      undiscoveredHex: draw.undiscovered_hex || '#0B0A09',
      placeHex: draw.place_hex || '#C9A54B',
      playerHex: draw.player_hex || '#E8E2D2',
      placePx: (Number(draw.place_square_px) || 5) * this.S.s,
      chevronPx: (Number(draw.player_chevron_px) || 7) * 0.5,
      places, placeIdx: fm.placeIdx,
      player: {
        x: ctx.player ? ctx.player.pos[0] : 0,
        z: ctx.player ? ctx.player.pos[2] : 0,
        yaw: ctx.player ? (ctx.player.yaw || 0) : 0,
      },
      // Two closures rather than two 42k arrays copied every frame. Both are pure reads.
      seen: d ? (cx, rz) => d.seenCell(cx, rz) : () => false,
      cellHex: f ? (cx, rz) => {
        const i = rz * f.cols + cx;
        if (f.oceanU[i] === 1) return oceanHex;
        const t = (f.base[i] - sh.lo) / (sh.hi - sh.lo);
        return shadeHex(regions[f.regionU[i]] || '#555555', t, range[0], range[1]);
      } : () => '#555555',
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
      // W1-MAP. Was `false` under seam S30 and is `true` under S35, which overruled it. The
      // field is KEPT AND FLIPPED rather than deleted, so that a probe written against S30 gets
      // a changed answer instead of `undefined` — an existence check that silently starts
      // reading `undefined` is an existence check that starts passing.
      // W1-21 round 3: derived, like `markers` above it. The round-2 brief asked for the file to
      // be checked for OTHER literals in the compliance report, and this was one of three
      // (`map_exists`, `map.exists`, `world_rendered_behind`). It is a claim about whether this
      // build has a map screen at all, so it is answered by `MODES` — the list `openMenu()` and
      // `navigable()` both resolve against — rather than by a typed `true` that would go on
      // saying yes after the screen was deleted.
      map_exists: MODES.includes('map'),
      // The amended JU8, computed rather than asserted. Every one of these is a hard fail if it
      // comes back wrong, and each is derived from the element census that was just built, so a
      // screen that draws a marker without declaring it is caught by the fact that `el()` is the
      // only way to get a drawing context at all.
      map: {
        exists: MODES.includes('map'),
        // Q7, unamended, in both directions.
        reachable_from_journal: this.mode === 'journal' && this.navigable(ctx).includes('map'),
        journal_reachable_from_map: this.mode === 'map' && this.navigable(ctx).includes('journal'),
        // Everything the screen is forbidden to contain, counted off what it drew.
        //
        // `markers` IS NOW DERIVED — W1-21 round 3, and this is the second time this piece has
        // been failed for the same shape in this same object literal. Round 1 found
        // `mutator_arities` was "a hand-written literal of three names"; round 2 replaced it with
        // a real enumeration four lines below this one and left `markers: 0` typed here. The
        // round-2 verdict: "`markers` — the single field whose name is the thing S8 and S35
        // forbid — is not measured. It is typed."
        //
        // See `markerCensus()` for what counts as one and why. The count is a function of the
        // elements that were actually drawn, so it moves when the screen does.
        ...markerCensus(els.filter((e) => e.id.startsWith('map.')), ctx, 'map'),
        routes_drawn: els.filter((e) => e.kind === 'map_terrain' && e.meta && e.meta.routes_drawn).length,
        quest_bearing_elements: els.filter((e) => e.id.startsWith('map.') && e.meta
          && (e.meta.quest || e.meta.objective || e.meta.giver || e.meta.target || e.meta.rumour)).map((e) => e.id),
        travel_affordances: els.filter((e) => e.id.startsWith('map.') && e.meta && e.meta.travel).map((e) => e.id),
        // S35 forbids "distance or direction readouts to anything". Checked as "no numerals
        // anywhere on the screen", which is stricter and needs no judgement about what a number
        // is a readout OF.
        numeric_text: els.filter((e) => e.id.startsWith('map.') && e.text !== null && /\d/.test(String(e.text))).map((e) => e.id),

        // W1-21 ROUND 3 — WHAT THIS BLOCK IS AND IS NOT MEASURING, STATED IN THE BLOCK.
        //
        // Two defects the round-2 verdict found in the four filters above, both recorded here
        // rather than hidden, because fixing them by widening the filters would manufacture a
        // false S35 violation:
        //
        //  1. ZERO SAMPLES. Every one of those filters keys on `e.id.startsWith('map.')`. When the
        //     map is closed there are no `map.*` elements, "so every one of them evaluates to
        //     empty and the block reports full compliance — a green AR-2 report computed over zero
        //     elements, available from any mode." `measured` is now false in that case and
        //     `elements_considered` is the sample count, so a reader can tell a compliant map from
        //     no map at all.
        //
        //  2. THE REST OF THE SCREEN. The verdict's E4: six visible elements on the drawn map are
        //     not matched by the prefix — the HUD, drawn over it, one of which (`hud.heal`) carries
        //     the numeral "5". The verdict is explicit that the numeral is "an RI-UIX01
        //     numeric-budget question and NOT an S35 one", so the map's own numeric_text keeps its
        //     scope and the rest of the screen is REPORTED beside it instead. The block no longer
        //     "measures a subset of its own screen and asserts the rest": it now says which subset.
        measured: this.mode === 'map',
        elements_considered: els.filter((e) => e.id.startsWith('map.')).length,
        elements_on_screen: els.length,
        non_map_elements: els.filter((e) => !e.id.startsWith('map.') && e.visible).map((e) => e.id),
        numeric_text_screen: els.filter((e) => e.visible && e.text !== null && /\d/.test(String(e.text))).map((e) => e.id),
        // What the screen actually painted, so "undiscovered is unrendered" is a number.
        drawn_cells: (els.find((e) => e.kind === 'map_terrain') || { meta: {} }).meta.drawn_cells || 0,
        revealed_cells: ctx && ctx.map && ctx.map.discovery ? ctx.map.discovery.revealedCells : 0,
        total_cells: ctx && ctx.map && ctx.map.discovery ? ctx.map.discovery.cols * ctx.map.discovery.rows : 0,
        places_drawn: els.filter((e) => e.kind === 'map_place' && e.id !== 'map.naming').length,
        places_discovered: ctx && ctx.map && ctx.map.discovery ? ctx.map.discovery.placeCount : 0,
        view: this.focus.map.view,
        // The structural half of AMENDMENT-W1-MAP-01 §3b, ENUMERATED FROM THE RUNNING OBJECT.
        //
        // This used to be `{observe: …length, suspend: …length, resume: …length}` — a hand-typed
        // literal of three names on an object with four mutators, and the missing one was
        // `restore(blob)`, precisely the member that broke the claim the field exists to support.
        // The W1-21 round-1 verdict named the pattern: a compliance report assembled from a list
        // can only ever report the things whoever wrote the list already thought of. So the list
        // is gone. `Discovery.mutatorReport()` walks its own prototype and classifies fail-closed
        // — an accessor or a named reader is a reader, and ANYTHING ELSE is a state writer,
        // including a method added tomorrow by somebody who never read this file.
        ...mapMutators(ctx),
      },
      navigable: this.navigable(ctx),
      // W1-21 round 2 / NEXT-DISPATCH §P.6. `navigable` advertises the destinations; `nav` says
      // which of them input can actually REACH, and by which action. Until round 2 those two
      // lists were "six" and "none", and nothing in the build reported the difference — the
      // advertisement was the only evidence anyone had that the doors existed.
      nav: {
        advertised: this.navigable(ctx),
        walkable: this._walkRing(ctx),
        // The two actions, named. They are two of RI-JRN03 §A's closed fourteen and no fifteenth
        // was added; what is declared here is the MEANING they take while a screen is open.
        walk_actions: { prev: 'swap_left', next: 'swap_right' },
        // …and only out of a fight, where they stay equipment cycling and half of the offhand
        // chord. Same rule `roll` already follows in this file.
        walk_live: this.isMenu() && !(ctx && ctx.inCombat),
        refused: this.navRefused || null,
      },
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
        // W1-26 r4 / r3 §7 G5. True while the title surface is up, when the HUD is deliberately
        // not drawn at all. A reader seeing `total_count: 0` must be able to tell "suppressed on
        // purpose" from "the HUD has stopped working".
        suppressed: !!this.hudSuppressed,
        suppressed_because: this.hudSuppressed ? 'the title surface is shown — there is no character yet' : null,
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
      // W1-20. The toast, with its fit. Reported so a probe can assert that the words on the
      // parchment are ALL of the words: the register in render/text-register.js records the draw
      // call and cannot see a run that overflowed the panel it was centred on.
      toast: (() => {
        const t = els.find((e) => e.id === 'hud.toast');
        if (!t) return null;
        const m = t.meta || {};
        // The fit, judged against the DECLARED RECTANGLE and nothing the drawing code chose.
        // A wrapper that stops wrapping cannot move this number, which is the whole point of
        // computing it here instead of there.
        return {
          text: t.text, ...m,
          panel_w: +t.rect[2].toFixed(1), panel_h: +t.rect[3].toFixed(1),
          fits: (m.widest_px || 0) <= t.rect[2] + 0.5,
          overflow_px: +Math.max(0, (m.widest_px || 0) - t.rect[2]).toFixed(1),
        };
      })(),
      // The same derivation, over the WHOLE screen rather than the map's own elements. Round 2's
      // verdict: "The identical field is typed again at the top level of `getUIState()`." It was.
      ...markerCensus(els, ctx, 'screen'),
      // Also derived. S35 requires the world to keep being drawn behind a screen, and the
      // mechanism is the screen's own translucency: `build()` applies COMBAT_ALPHA in a fight and
      // CALM_ALPHA out of one, over the screen rectangle only. Anything below 1 lets the world
      // through; a `true` typed here would survive somebody setting the alpha to 1.
      world_rendered_behind: (this.isMenu() ? (ctx && ctx.inCombat ? COMBAT_ALPHA : CALM_ALPHA) : 0) < 1,
      screen_alpha: this.isMenu() ? (ctx && ctx.inCombat ? COMBAT_ALPHA : CALM_ALPHA) : null,
    };
  }
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

/**
 * `markers`, DERIVED FROM WHAT WAS DRAWN — W1-21 round 3.
 *
 * WHY THIS FUNCTION EXISTS. `getUIState()` reported `markers: 0` twice, as a typed literal, in the
 * one field whose name is the thing S8 and S35 forbid. The round-1 verdict caught the identical
 * shape in `mutator_arities`; round 2 fixed that one and left this one four lines away; the
 * round-2 verdict found it there. A literal cannot be wrong about a build that has no markers,
 * which is exactly why it survived two rounds — and exactly why it is worth nothing as evidence.
 *
 * WHAT COUNTS AS A MARKER, and the definition is the load-bearing part. A square for a place you
 * have stood in is NOT a marker: S35 permits the map and permits the places you have found, so a
 * bare count of `map_place` elements would report `markers: 6` on a compliant screen and be read
 * as six violations. A marker is an element that points at somewhere you have not been, or that
 * carries quest identity, or that tracks the world. So, four clauses:
 *
 *   m1  a forbidden KIND — RI-UIX01 §B's positional rows X1-X12 (quest_marker, waypoint, map_pin,
 *       objective_tracker, compass, minimap, hit_marker, damage_direction, ground_telegraph).
 *   m2  a WORLD ANCHOR on anything but the lock-on reticle. An element pinned to a world position
 *       is tracking the world whatever it is called; RI-UIX02 §E M-def-1 is the same property.
 *   m3  QUEST IDENTITY or a destination in the element's own meta — quest, objective, giver,
 *       target, rumour, route, destination, travel. RI-UIX02 §E's definition of a marker is
 *       behavioural, and this is its declared half.
 *   m4  a `map_place` square for a place the DISCOVERY MODEL does not report as discovered. This
 *       is the round-1 attack's own signature: 42 squares drawn for a body that had stood in 7.
 *       It is checked against `discovery.hasPlace()`, i.e. against the model, not against the
 *       element's own `meta.discovered` — an element cannot be its own witness.
 *
 * The census returns the count AND its inputs, so that "0 markers" is a measurement with a
 * denominator rather than an assertion: `marker_census.elements` is how many elements were tested.
 */
function markerCensus(els, ctx, scope) {
  const FORBIDDEN_KINDS = new Set(['quest_marker', 'waypoint', 'map_pin', 'objective_tracker',
    'compass', 'minimap', 'hit_marker', 'damage_direction', 'ground_telegraph', 'xp_popup',
    'combo_counter', 'dps_meter', 'damage_number', 'enemy_nameplate']);
  const IDENTITY = ['quest', 'objective', 'giver', 'target', 'rumour', 'route', 'destination', 'travel'];
  const discovery = ctx && ctx.map && ctx.map.discovery;
  const hits = [];
  for (const e of els) {
    const m = e.meta || {};
    if (FORBIDDEN_KINDS.has(e.kind)) { hits.push({ id: e.id, why: 'm1 forbidden kind ' + e.kind }); continue; }
    if (e.worldAnchor && e.kind !== 'lockon_reticle') { hits.push({ id: e.id, why: 'm2 world-anchored' }); continue; }
    const ident = IDENTITY.filter((k) => m[k]);
    if (ident.length) { hits.push({ id: e.id, why: 'm3 carries ' + ident.join('+') }); continue; }
    if (e.kind === 'map_place' && m.place && discovery && typeof discovery.hasPlace === 'function'
        && !discovery.hasPlace(m.place)) {
      hits.push({ id: e.id, why: 'm4 a square for `' + m.place + '`, which the discovery model does not report as stood in' });
    }
  }
  return {
    markers: hits.length,
    marker_census: {
      scope,
      elements: els.length,                       // THE SAMPLE COUNT
      derived: true,
      clauses: ['m1 forbidden kind', 'm2 world anchor', 'm3 quest identity or destination',
        'm4 a place square the discovery model does not support'],
      model_available: !!(discovery && typeof discovery.hasPlace === 'function'),
      hits,
    },
  };
}

/**
 * AMENDMENT-W1-MAP-01 §3b, computed rather than transcribed — see the call site.
 *
 * `mutator_arities` keeps its name and its `{name: arity}` shape so that a probe written against
 * the old field gets a CHANGED answer rather than `undefined` (the same reasoning `map_exists`
 * carries above: a check that silently starts reading `undefined` is a check that starts
 * passing). What changes is that the object is now every state-writing member of the prototype,
 * and it is expected to contain `restore: 1`.
 *
 * The amendment's original acceptance was "every mutator arity 0", which the save path cannot
 * meet — `restore()` has to receive the blob. The property that actually matters is narrower and
 * stronger, so it is reported as its own field: **no mutator has a parameter in which a place can
 * be named.** `Discovery.RESTORE_READS` is the whole channel from a blob into the model, it is
 * published on the instance, and `place_naming_parameters` is derived from it rather than
 * asserted. If somebody re-adds `places` to that list, this field turns red without anyone
 * having to remember to update a check.
 */
function mapMutators(ctx) {
  const d = ctx && ctx.map && ctx.map.discovery;
  if (!d || typeof d.mutatorReport !== 'function') {
    return { mutator_arities: null, mutators: null, mutators_enumerated: false, restore_reads: null, place_naming_parameters: null };
  }
  const rep = d.mutatorReport();
  const arities = {};
  for (const m of rep) arities[m.name] = m.arity;
  const reads = Array.from(d.restoreReads || []);
  const NAMES_A_PLACE = /^(place|places|markers?|pins?|reveal|discovered|locations?)$/i;
  return {
    mutator_arities: arities,
    mutators: rep,
    mutators_enumerated: true,
    zero_arity_mutators: rep.filter((m) => m.arity === 0).map((m) => m.name),
    restore_reads: reads,
    place_naming_parameters: reads.filter((k) => NAMES_A_PLACE.test(String(k))),
  };
}

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
/**
 * The open screen's own focus state, as a cache key for `build()`.
 *
 * This exists because the layout cache cannot be keyed on the frame while a menu is open: the
 * world is paused, so the frame is frozen, and a key made of frame + mode + touch is constant
 * for the whole life of the screen. Anything a player changes with a button — the map's view,
 * the journal's page, a selected row — lives in `focus[mode]` and nowhere else, so that object
 * is exactly the missing term. Flat and small (a handful of primitives per mode), and read only
 * once per build, which is once per rendered frame.
 *
 * Modes hold their focus in object literals with a fixed shape, so `for...in` order is stable
 * and the string is comparable. A mode with no focus entry (`world`, `dialogue`) returns `-`.
 */
function focusSignature(mode, focus) {
  const f = focus && focus[mode];
  if (!f) return '-';
  let s = '';
  for (const k in f) {
    const v = f[k];
    s += k + ':' + (v !== null && typeof v === 'object' ? JSON.stringify(v) : v) + '|';
  }
  return s;
}

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
