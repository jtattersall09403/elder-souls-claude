#!/usr/bin/env node
// t4-r2-critic-focus.mjs — the five things `t4-r2-critic-drive.mjs` could not settle, plus the
// RI-UIX07 withdrawal measurement that neither the round-1 critic nor the round-2 builder got.
//
// Owner: crit-t4-r2. Every interaction is a real DOM event. CRITIC-DOCTRINE §1.2b.
//
// WHAT EACH LEG IS FOR, AND WHY IT IS SEPARATE:
//   EQ  the equip control, out of combat. The first probe saw nothing happen and could not tell a
//       DEAD control from a DEFERRED one, and the difference decides whether this is a hard fail.
//   HUD `two_hand` is behind a 12-frame hold gate on desktop (`desktop.hold_gate_frames.two_hand`,
//       consumed at `input/real.js:496`). The first probe held it for 4 and 8 frames and recorded a
//       failure that was its own. Held past the gate here.
//   JS  the journal's search view. The first probe found `back` exits the whole screen and the view
//       survives a re-open. This leg tries EVERY action in the closed set and both axes, so
//       "there is no way out" is an enumeration rather than an inference.
//   CT  the container, with correctly-shaped contents. The first probe passed a string array to
//       `openContainer`, which spreads into a character map — its own defect, fixed here.
//   TS  the touch stick, on a screen whose list is longer than one row.
//   WD  RI-UIX07 V7/V8, E-T2/E-T3 across a REAL fight boundary. The builder's two attempts ran on
//       fixtures with zero enemies (`ui-journal`, `arena_duel`) and its own gate marked both
//       inadmissible. An enemy is spawned and aggroed here, which is the move `ui-pause.mjs`
//       already uses, and the leg refuses a verdict unless both phases were actually seen.
'use strict';

import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, writeJson } from '../lib/cli.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('t4-r2-critic-focus.mjs [--state ui-journal] [--out <dir>]');
const OUT = path.join(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r2c/reports'));
ensureDir(OUT);
const STATE = String(args.state || 'ui-journal');

const checks = [];
const push = (id, pass, detail) => { checks.push({ id, pass, detail }); log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`); };
const report = { schema: 'elder-souls/t4-critic-focus@1', at: new Date().toISOString(), state: STATE, checks: [], data: {} };
const J = (o) => JSON.stringify(o);

const h = await launchGame({ width: 1920, height: 1080, timeout: 300000 });
let exit = 0;

async function key(code, holdFrames = 2) {
  await h.page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c, bubbles: true, cancelable: true })), code);
  await h.h('stepFrames', holdFrames);
  await h.page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c, bubbles: true })), code);
  await h.h('stepFrames', 2);
}
async function read() {
  return h.page.evaluate(() => {
    const s = window.__HARNESS.getUIState();
    const els = (s.elements || []).filter((e) => e.visible);
    return {
      mode: s.mode, phase: s.combat_phase, focus: s.focus ? { ...s.focus } : null,
      hud_mode: s.hud ? s.hud.mode : null,
      rows: els.filter((e) => e.kind === 'list_row').map((e) => ({ id: e.id, text: e.text, focused: !!e.focused })),
      detail: els.filter((e) => e.kind === 'detail_panel').map((e) => e.text),
      doll_children: els.filter((e) => String(e.id).startsWith('inventory.worn.')).map((e) => e.id),
      texts: els.filter((e) => e.text != null).map((e) => String(e.text)),
      elements: els.map((e) => ({ id: e.id, kind: e.kind, rect: e.rect.map((v) => Math.round(v)), text: e.text })),
    };
  });
}
async function inv() {
  return h.page.evaluate(() => {
    const eng = window.__ENGINE;
    const a = Array.isArray(eng.sim.inventory) ? eng.sim.inventory : [];
    return { n: a.length, equipped: a.filter((r) => r.slot).map((r) => `${r.id}@${r.slot}`), frame: window.__HARNESS.getFrame() };
  });
}
async function goto(target) {
  for (let i = 0; i < 3; i++) { const r = await read(); if (r.mode !== 'world') break; await key('KeyM'); }
  for (let i = 0; i < 12; i++) {
    const r = await read();
    if (r.mode === target) return target;
    if (r.mode === 'world') await key('KeyM'); else await key('Digit3');
  }
  return (await read()).mode;
}

try {
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', STATE);
  await h.h('setMode', 'play-instrumented');
  await h.h('stepFrames', 4);
  const attached = await h.page.evaluate(() => !!(window.__ENGINE.real && window.__ENGINE.real.attached));
  push('I0 the real input listeners are attached', attached, `real.attached=${attached}`);
  if (!attached) throw new Error('input listeners detached');

  // ---- EQ. THE EQUIP CONTROL, OUT OF COMBAT --------------------------------------------------
  {
    for (let i = 0; i < 6; i++) { const r = await read(); if (r.mode === 'world') break; await key('Escape'); }
    await goto('inventory');
    // walk to a weapon the character is NOT already holding
    let target = null;
    for (let i = 0; i < 45; i++) {
      const r = await read();
      const f = r.rows.find((x) => x.focused);
      if (f && /bog-iron|maul|bow|blade|knife|axe/i.test(String(f.text)) && !/reed.cutter/i.test(String(f.text))) { target = f; break; }
      await key('KeyS', 1);
    }
    const b = await read(); const wb = await inv();
    if (!target) { push('EQ1 a weapon row can be focused', false, 'no weapon row reachable'); }
    else {
      await key('KeyE');
      await h.h('stepFrames', 60);              // 60 frames of "waiting for it to happen"
      const m = await read(); const wm = await inv();
      const screenMoved = J(b.rows.map((x) => x.text)) !== J(m.rows.map((x) => x.text))
        || J(b.doll_children) !== J(m.doll_children) || J(b.detail) !== J(m.detail);
      push('EQ1 confirming a weapon row changes SOMETHING on the screen within 60 frames',
        screenMoved || J(wb.equipped) !== J(wm.equipped),
        `row '${target.text}': equipment ${J(wb.equipped)} -> ${J(wm.equipped)}; frame ${wb.frame} -> ${wm.frame}; ` +
        `doll ${J(b.doll_children)} -> ${J(m.doll_children)}; screen moved=${screenMoved}`);

      // …and then: does it land at all once the screen is CLOSED and time resumes?
      await key('Escape');
      await h.h('stepFrames', 90);
      const wc = await inv();
      await goto('inventory');
      const a2 = await read();
      report.data.equip = { before: wb, with_menu_open: wm, after_close: wc, doll_after: a2.doll_children };
      push('EQ2 the equip lands once the screen is shut and time resumes',
        J(wc.equipped) !== J(wb.equipped),
        `equipment ${J(wb.equipped)} -(confirm, menu open, 60f)-> ${J(wm.equipped)} ` +
        `-(menu closed, 90f)-> ${J(wc.equipped)}; frames ${wb.frame} / ${wm.frame} / ${wc.frame}`);
    }
  }

  // ---- HUD. `two_hand`, held past its 12-frame gate ------------------------------------------
  {
    await goto('inventory');
    const b = await read();
    await key('KeyG', 20);
    const a = await read();
    report.data.hud_switch = { before: b.hud_mode, after: a.hud_mode };
    push('HUD1 the full/minimal switch responds to a press held past its 12-frame gate',
      b.hud_mode !== a.hud_mode, `hud.mode ${b.hud_mode} -(20f hold of KeyG)-> ${a.hud_mode}`);
    if (b.hud_mode !== a.hud_mode) await key('KeyG', 20);
  }

  // ---- JS. THE JOURNAL'S SEARCH VIEW: is there a way out? ------------------------------------
  {
    await goto('journal');
    // get to the chronicle, then into search
    for (let i = 0; i < 6; i++) { const r = await read(); if (r.focus && r.focus.view === 'chronicle') break; await key('KeyA', 1); }
    let r = await read();
    if (r.focus && r.focus.view !== 'search') { await key('KeyE'); r = await read(); }
    push('JS0 the search view is entered by confirming on the chronicle',
      r.focus && r.focus.view === 'search', `view='${r.focus && r.focus.view}'`);

    // EVERY action in the closed set, one at a time, plus both axes. Nothing else is available.
    const ACTIONS = [
      ['Space', 'roll (back)'], ['KeyF', 'block'], ['KeyV', 'parry'], ['KeyR', 'heavy'],
      ['ShiftLeft', 'sprint'], ['KeyX', 'jump'], ['Digit1', 'use_item'], ['Tab', 'lock_on'],
      ['KeyG', 'two_hand'], ['KeyC', 'crouch'], ['KeyT', 'spell_cycle'],
      ['KeyW', 'up'], ['KeyS', 'down'], ['KeyA', 'left'], ['KeyD', 'right'],
    ];
    const tried = [];
    let escaped = null;
    for (const [code, name] of ACTIONS) {
      // make sure we are in the search view before each attempt
      let cur = await read();
      if (cur.mode !== 'journal' || !cur.focus || cur.focus.view !== 'search') {
        await goto('journal');
        cur = await read();
        if (cur.focus && cur.focus.view !== 'search') { await key('KeyE'); cur = await read(); }
      }
      const before = await read();
      await key(code, 14);
      const after = await read();
      const stillJournal = after.mode === 'journal';
      const out = stillJournal && after.focus && after.focus.view !== 'search';
      tried.push({ action: name, code, mode_after: after.mode, view_after: after.focus ? after.focus.view : null, query_after: after.focus ? after.focus.query : null });
      if (out) { escaped = name; break; }
      void before;
    }
    report.data.journal_search_escape = { tried, escaped };
    push('JS1 SOME action returns the journal from the search view to the chronicle',
      escaped !== null,
      escaped ? `'${escaped}' does it` : `none of the ${tried.length} actions tried leaves the search view: ${J(tried.map((t) => `${t.action}->${t.mode_after}/${t.view_after}`))}`);

    // does it survive a re-open and a walk to a peer and back?
    await goto('journal');
    const rj = await read();
    report.data.journal_after_reopen = rj.focus;
    push('JS2 the journal does not persist the search view across a close and a re-open',
      rj.focus && rj.focus.view !== 'search',
      `after closing and walking back to the journal: view='${rj.focus && rj.focus.view}', query='${rj.focus && rj.focus.query}'`);
  }

  // ---- CT. THE CONTAINER, with correctly-shaped contents -------------------------------------
  {
    await h.page.evaluate(() => { window.__ENGINE.closeMenu(); });
    await h.h('stepFrames', 2);
    await h.page.evaluate(() => {
      window.__HARNESS.openContainer('Reed Creel', [{ id: 'bog-iron-maul', count: 1 }, { id: 'guar-jerky', count: 2 }]);
    });
    await h.h('stepFrames', 4);
    const b = await read(); const wb = await inv();
    report.data.container_open = { mode: b.mode, rows: b.rows.length, headers: b.texts.slice(0, 6) };
    if (b.mode !== 'container') { push('CT1 items transfer in both directions', false, `container did not open; mode=${b.mode}`); }
    else {
      await key('KeyD');                            // to the container side
      await key('KeyE');                            // take
      await h.h('stepFrames', 8);
      const wm = await inv();
      await key('KeyA');                            // back to the carried side
      await key('KeyE');                            // put
      await h.h('stepFrames', 8);
      const wa = await inv();
      report.data.container_transfer = { before: wb.n, after_take: wm.n, after_put: wa.n };
      push('CT1 items transfer in both directions through real presses',
        wm.n > wb.n && wa.n < wm.n,
        `carried ${wb.n} -(take)-> ${wm.n} -(put)-> ${wa.n}`);
    }
    await h.page.evaluate(() => { window.__ENGINE.closeMenu(); });
    await h.h('stepFrames', 2);
  }

  // ---- TS. THE TOUCH STICK on a screen with a long list --------------------------------------
  {
    await h.h('setViewport', { pointer: 'coarse' });
    await h.h('stepFrames', 2);
    await goto('inventory');
    const b = await read();
    await h.page.evaluate(() => {
      const cv = document.querySelector('canvas');
      const r = cv.getBoundingClientRect();
      const mk = (t, x, y) => new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 11, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true });
      const x0 = r.left + r.width * 0.18, y0 = r.top + r.height * 0.55;
      cv.dispatchEvent(mk('pointerdown', x0, y0));
      window.dispatchEvent(mk('pointermove', x0, y0 + 120));
    });
    await h.h('stepFrames', 12);
    const m = await read();
    await h.page.evaluate(() => {
      const cv = document.querySelector('canvas');
      const r = cv.getBoundingClientRect();
      const mk = (t, x, y) => new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 11, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true });
      window.dispatchEvent(mk('pointerup', r.left + r.width * 0.18, r.top + r.height * 0.55 + 120));
    });
    await h.h('stepFrames', 3);
    report.data.touch_stick = { before: b.focus, mid: m.focus };
    push('TS1 the floating touch stick walks an open screen\'s list',
      J(b.focus) !== J(m.focus), `focus ${J(b.focus)} -(touch drag down 120 px)-> ${J(m.focus)} on mode '${m.mode}'`);
    await h.h('setViewport', { pointer: 'fine' });
    await h.h('stepFrames', 2);
  }

  // ---- WD. RI-UIX07 V7/V8, ACROSS A REAL BOUNDARY --------------------------------------------
  {
    await h.page.evaluate(() => { window.__ENGINE.closeMenu(); });
    await h.h('stepFrames', 3);
    const frames = [];
    const snap = (tag) => h.page.evaluate((t) => {
      const s = window.__HARNESS.getUIState();
      const els = (s.elements || []).filter((e) => e.visible);
      const WORLD = new Set(['bearing_dial', 'effect_strip', 'sneak_state', 'place_name', 'breath_meter']);
      return {
        tag: t, frame: window.__HARNESS.getFrame(),
        phase: s.combat_phase, source: s.combat_phase_source, since: s.frames_since_phase_change,
        in_combat: !!(window.__ENGINE.inCombat && window.__ENGINE.inCombat()),
        world: els.filter((e) => WORLD.has(e.kind)).map((e) => ({ id: e.id, kind: e.kind, opacity: e.opacity === undefined ? null : e.opacity, rect: e.rect.map(Math.round) })),
        souls: els.filter((e) => String(e.id).startsWith('hud.') && !WORLD.has(e.kind)).map((e) => e.id).sort(),
        all_hud: els.filter((e) => String(e.id).startsWith('hud.')).map((e) => e.id).sort(),
        hud_world: s.hud && s.hud.world ? JSON.parse(JSON.stringify(s.hud.world)) : null,
      };
    }, tag);

    for (let i = 0; i < 6; i++) { await h.h('stepFrames', 1); frames.push(await snap('pre')); }
    const spawned = await h.page.evaluate(() => {
      const A = window.__HARNESS;
      const p = A.getPlayerStats ? A.getPlayerStats() : null;
      let eid = null;
      try { eid = A.spawn('inf_trash', (p && p.x || 0) + 4.6, (p && p.z || 0)); } catch (e) { return { error: String(e.message || e) }; }
      const id = eid && eid.eid !== undefined ? eid.eid : eid;
      let ag = null;
      try { ag = A.aggro(id); } catch (e) { ag = String(e.message || e); }
      return { eid: id, aggro: ag };
    });
    report.data.spawn = spawned;
    for (let i = 0; i < 14; i++) { await h.h('stepFrames', 1); frames.push(await snap('post')); }

    const phases = [...new Set(frames.map((f) => f.phase))];
    const crossed = phases.includes('world') && phases.includes('fight');
    const entryIdx = frames.findIndex((f, i) => i > 0 && frames[i - 1].phase === 'world' && f.phase === 'fight');
    const fightFrames = frames.filter((f) => f.phase === 'fight');
    const worldFrames = frames.filter((f) => f.phase === 'world');
    report.data.withdrawal = {
      spawn: spawned, phases_seen: phases, boundary_crossed: crossed, entry_index: entryIdx,
      world_set_on_world_frames: [...new Set(worldFrames.flatMap((f) => f.world.map((w) => w.kind)))],
      world_set_on_fight_frames: [...new Set(fightFrames.flatMap((f) => f.world.map((w) => w.kind)))],
      souls_identical: fightFrames.length && worldFrames.length
        ? J([...new Set(fightFrames.map((f) => J(f.souls)))]) === J([...new Set(worldFrames.map((f) => J(f.souls)))]) : null,
      any_fractional_opacity: frames.some((f) => f.world.some((w) => w.opacity !== null && w.opacity > 0 && w.opacity < 1)),
      frames,
    };
    push('WD0 GATE the probe actually crossed the fight boundary',
      crossed, `phases seen ${J(phases)}; spawn ${J(spawned)}; entry at index ${entryIdx}`);
    if (crossed) {
      const leaked = report.data.withdrawal.world_set_on_fight_frames;
      push('WD1 (RI-UIX07 V7 / E-T2) no world-set element is declared on any fight frame',
        leaked.length === 0,
        `world-set kinds on world frames ${J(report.data.withdrawal.world_set_on_world_frames)}; on fight frames ${J(leaked)} over ${fightFrames.length} fight frame(s)`);
      push('WD2 (RI-UIX07 V8 / E-T3) the withdrawal is instantaneous — no opacity ramp across entry',
        !report.data.withdrawal.any_fractional_opacity && entryIdx > 0
          && frames[entryIdx - 1].world.length > 0 && frames[entryIdx].world.length === 0,
        `frame ${entryIdx - 1} (world) declared ${frames[entryIdx - 1].world.length} world element(s); ` +
        `frame ${entryIdx} (fight) declared ${frames[entryIdx].world.length}; fractional opacity anywhere=${report.data.withdrawal.any_fractional_opacity}`);
      push('WD3 (RI-UIX07 V9 / E-T1) the Souls set is on every frame in both phases',
        frames.every((f) => f.souls.includes('hud.stamina') && f.souls.includes('hud.health')),
        `${frames.length} frame(s); every one carries hud.health and hud.stamina: ` +
        `${frames.every((f) => f.souls.includes('hud.stamina'))}`);
    }
  }

  report.checks = checks;
  report.data.errors = h.errors ? h.errors.slice(0, 8) : [];
  writeJson(path.join(OUT, 'screens-focus.json'), report);
  exit = checks.every((c) => c.pass) ? 0 : 1;
  log(`\n${checks.filter((c) => c.pass).length}/${checks.length} checks passed`);
} catch (e) {
  log(`could not run: ${e && e.message || e}`);
  report.error = String(e && e.stack || e);
  report.checks = checks;
  writeJson(path.join(OUT, 'screens-focus.json'), report);
  exit = 2;
} finally {
  await h.close();
}
process.exit(exit);
