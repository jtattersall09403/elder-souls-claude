#!/usr/bin/env node
// critic-w1-21-r2-a.mjs — the W1-21 ROUND-2 CRITIC's own instrument. Written by the critic,
// declared in orchestration/status/critic-w1-21-r2.json. ONE browser, kept for every pass.
//
// The round-1 verdict failed this piece on four things. Round 2 claims three of them closed and
// leaves three edited detectors UNRUN. This instrument re-measures the claims from outside the
// build's own vocabulary, in six passes:
//
//   B  THE DOORS, WITH REAL KEYS AND A REAL PAD. The builder's own N1b drives `queueInputs()`,
//      which injects ACTION NAMES straight onto the pipeline and therefore cannot see a broken
//      or unbound key. This runs `setMode('play-instrumented')` — the one mode where the real
//      listener in `game/src/input/real.js` is attached and `stepFrames()` still drives the sim
//      — and presses `Escape` / `KeyM` / `Digit3` / `Digit4` through Playwright's own keyboard,
//      then repeats the whole walk on a synthetic standard-mapping GAMEPAD through
//      `__HARNESS.gamepad()`, which is `RealInput.pollGamepad()`'s own path. For each of the six
//      advertised screens: can a player get IN and can they get OUT, and by which exact keys.
//
//   C  THE FORGED-SAVE MAP ROUTE, RE-RUN. Round 1 got 35 squares for places never visited by
//      forging BOTH `world.discovery.cells` and `world.discovery.places`. Re-run against the
//      shipping build, and then push harder: forge `stood` itself, forge every OTHER key of the
//      blob, and check whether the hole is closed or only the report is.
//
//   D  EVERY WRITE TO THE DISCOVERY OBJECT, FOUND RATHER THAN TAKEN FROM A LIST. The round-1
//      defect was a hand-typed literal of three names on an object with four mutators. Round 2
//      enumerates the prototype. So: enumerate it independently, compare, and then FALSIFY the
//      classifier — RULES 4 — by installing a member the classifier's own rule should catch.
//
//   E  AR-2 ON THE DRAWN SCREEN. S35's hard-fail list applied to what is actually on the map,
//      read off the element census AND out of the framebuffer, not off the screen's self-report.
//
//   F  CONSUMPTION (RI-MTH07 / ARBITRATION §3). Perturb the model; watch something change.
//
//   G  THE SIX SCREENS, PHOTOGRAPHED. docs/shots/.
//
// USAGE  node tools/ui/critic-w1-21-r2-a.mjs [--out DIR] [--shots DIR] [--width] [--height]
// EXIT   0 = every assertion held · 1 = at least one failed · 2 = could not measure
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-21-r2-a.mjs — the W1-21 round-2 critic's own instrument (B..G).`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const say = (s) => process.stdout.write(s + '\n');

const W = Number(args.width || 1280), H = Number(args.height || 720);
const RUN = path.join(RUNS_DIR, String(args.out || 'CRITIC-W1-21-R2'));
const SHOTS = path.join(REPO_ROOT, String(args.shots || 'docs/shots'));
ensureDir(RUN); ensureDir(SHOTS);
const decode = (u) => PNG.sync.read(Buffer.from(u.split(',')[1], 'base64'));

const out = {
  probe: 'critic-w1-21-r2-a',
  at: new Date().toISOString(),
  commit: (() => { try { return fs.readFileSync(path.join(REPO_ROOT, '.git/HEAD'), 'utf8').trim(); } catch { return null; } })(),
  viewport: [W, H],
  loadavg_start: fs.readFileSync('/proc/loadavg', 'utf8').trim(),
  checks: [], data: {},
};
const push = (id, what, ok, detail) => {
  out.checks.push({ id, what, result: ok ? 'pass' : 'fail', detail });
  say(`${ok ? 'ok  ' : 'FAIL'} ${id}  ${what}  — ${detail}`);
};

const h = await launchGame({ width: W, height: H, timeout: 300000 });
const mode = async () => (await h.h('getUIState')).mode;

/** ONE real key press, through window's own keydown listener, latched by one fixed step. */
async function key(code, settle = 2) {
  await h.page.keyboard.down(code);
  await h.h('stepFrames', 1);
  await h.page.keyboard.up(code);
  await h.h('stepFrames', settle);
}
/** ONE real pad button press, through RealInput.pollGamepad()'s own path. */
async function pad(index, settle = 2) {
  const buttons = new Array(17).fill(false);
  buttons[index] = true;
  await h.h('gamepad', { buttons, axes: [0, 0, 0, 0] });
  await h.h('stepFrames', 1);
  await h.h('gamepad', { buttons: new Array(17).fill(false), axes: [0, 0, 0, 0] });
  await h.h('stepFrames', settle);
}

try {
  await h.h('setRenderRate', 60);
  await h.h('loadState', 'ui-journal');
  await h.h('setAtHearth', true);
  await h.h('stepFrames', 4);

  // =========================================================================================
  // B — THE DOORS, WITH REAL KEYS
  // =========================================================================================
  await h.h('setMode', 'play-instrumented');
  await h.h('stepFrames', 2);
  const ui0 = await h.h('getUIState');
  out.data.touch_controls_drawn_after_real_attach = ui0.touch.controls_drawn;
  // Declared, not hidden: `levelup` is only in the ring at a hearth, and this run reaches the
  // hearth through the harness override rather than by walking to one. Say which.
  out.data.hearth = { at_hearth: ui0.at_hearth, real: ui0.at_hearth_real, overridden: ui0.at_hearth_overridden, id: ui0.at_hearth_id };
  push('B0', 'the real input path is attached and the touch fallback did not take over',
    (await h.page.evaluate(() => window.__ENGINE.real.attached)) === true && ui0.touch.controls_drawn === 0,
    `real.attached=${await h.page.evaluate(() => window.__ENGINE.real.attached)}, mode=${await h.page.evaluate(() => window.__ENGINE.mode)}, touch_controls_drawn=${ui0.touch.controls_drawn}`);

  // B1 — CONTROL FIRST. A key the game binds to nothing must move nothing, or every "the key
  // worked" below is a claim about the harness rather than about the binding table.
  await h.h('closeMenu'); await h.h('stepFrames', 2);
  const beforeCtl = await mode();
  await key('KeyQ');
  const afterCtl = await mode();
  push('B1', 'CONTROL: an UNBOUND key (KeyQ) changes nothing', beforeCtl === afterCtl && afterCtl === 'world',
    `${beforeCtl} -> ${afterCtl}`);

  // B1b — and a BOUND key does. Escape from the world must open a screen, or the walk below is
  // measuring a dead keyboard.
  await key('Escape');
  const afterEsc = await mode();
  push('B1b', 'CONTROL: the bound key Escape opens a screen from the world', afterEsc !== 'world',
    `world -> ${afterEsc}`);

  // B2 — the ring, walked right with Digit3 only, from the world, recording every mode.
  const walk = async (openKey, stepKey, n) => {
    await h.h('closeMenu'); await h.h('stepFrames', 2);
    const seq = [{ keys: [], mode: await mode() }];
    await key(openKey);
    seq.push({ keys: [openKey], mode: await mode() });
    for (let i = 1; i <= n; i++) {
      await key(stepKey);
      seq.push({ keys: [openKey, `${stepKey} x${i}`], mode: await mode() });
    }
    return seq;
  };
  const right = await walk('KeyM', 'Digit3', 8);
  const left = await walk('KeyM', 'Digit4', 8);
  out.data.key_walk_right = right;
  out.data.key_walk_left = left;
  say('  key walk right: ' + right.map((s) => s.mode).join(' -> '));
  say('  key walk left : ' + left.map((s) => s.mode).join(' -> '));

  // Shortest real-key route to each advertised screen, from the world.
  const SIX = ['inventory', 'journal', 'sheet', 'spells', 'map', 'levelup'];
  const routes = {};
  for (const s of SIX) {
    const r = right.findIndex((x) => x.mode === s);
    const l = left.findIndex((x) => x.mode === s);
    if (r < 0 && l < 0) { routes[s] = null; continue; }
    const pick = (l < 0 || (r >= 0 && r <= l)) ? { arr: right, i: r, k: 'Digit3' } : { arr: left, i: l, k: 'Digit4' };
    routes[s] = pick.i === 1 ? 'KeyM' : `KeyM, then ${pick.k} x${pick.i - 1}`;
  }
  out.data.key_routes_in = routes;
  const missing = SIX.filter((s) => !routes[s]);
  push('B2', 'all six advertised screens are reachable from the world BY REAL KEY PRESSES ALONE',
    missing.length === 0, `routes ${JSON.stringify(routes)}; unreachable [${missing.join(',') || '-'}]`);

  // B3 — and OUT again. From each screen, one real key must return the player to the world.
  const exits = {};
  for (const s of SIX) {
    if (!routes[s]) { exits[s] = null; continue; }
    await h.h('closeMenu'); await h.h('stepFrames', 2);
    await key('KeyM');
    const steps = routes[s] === 'KeyM' ? 0 : Number(/x(\d+)$/.exec(routes[s])[1]);
    const k = /Digit4/.test(routes[s]) ? 'Digit4' : 'Digit3';
    for (let i = 0; i < steps; i++) await key(k);
    const at = await mode();
    if (at !== s) { exits[s] = `NOT REACHED (at ${at})`; continue; }
    await key('Escape');
    const viaEsc = await mode();
    let viaBack = null;
    if (viaEsc !== 'world') {
      await key('Space');            // `roll` is "back" out of a fight
      viaBack = await mode();
    }
    exits[s] = { after_escape: viaEsc, after_space: viaBack };
  }
  out.data.key_routes_out = exits;
  const stuck = SIX.filter((s) => exits[s] && exits[s].after_escape !== 'world' && exits[s].after_space !== 'world');
  push('B3', 'every screen a real key opens, a real key closes', stuck.length === 0,
    `${JSON.stringify(exits)}; no way out of [${stuck.join(',') || '-'}]`);

  // B4 — THE PAD. Same walk, on a synthetic standard-mapping gamepad: 9 = menu, 15 = swap_right.
  await h.h('closeMenu'); await h.h('stepFrames', 2);
  const padSeq = [{ btn: null, mode: await mode() }];
  await pad(9); padSeq.push({ btn: 9, mode: await mode() });
  for (let i = 0; i < 6; i++) { await pad(15); padSeq.push({ btn: 15, mode: await mode() }); }
  await pad(9); padSeq.push({ btn: 9, mode: await mode() });
  out.data.pad_walk = padSeq;
  const padReached = new Set(padSeq.map((s) => s.mode));
  const padMissing = SIX.filter((s) => !padReached.has(s));
  push('B4', 'the same six screens are reachable on a PAD (button 9 then button 15)',
    padMissing.length === 0, `pad walk ${padSeq.map((s) => s.mode).join(' -> ')}; missing [${padMissing.join(',') || '-'}]`);

  // B5 — the fight must stay a fight. RI-UIX03 P6 / S14.
  await h.h('setMode', 'harness');
  await h.h('closeMenu');
  await h.h('loadState', 'ui-journal');
  await h.h('stepFrames', 2);
  // The aggro must happen INSIDE the page. `tools/lib/browser.mjs` turns any harness throw into
  // a process-level `die()`, so a try/catch around `h.h('aggro', …)` on the Node side never runs
  // — which is exactly the defect the builder reported for `ui-layer.mjs`'s ui_combat_neutral
  // viewpoint, and it took this probe down once before I moved the call in here. Reproduced
  // independently and recorded: `listEntities()` returns eids that `aggro()` rejects.
  const combatSetup = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const ents = H.listEntities().filter((e) => e.archetype && e.archetype !== 'player');
    const tried = [];
    let ok = null;
    for (const e of ents) {
      try { H.aggro(e.eid); ok = e.eid; tried.push({ eid: e.eid, threw: false }); break; }
      catch (err) { tried.push({ eid: e.eid, threw: true, error: String(err && err.message || err) }); }
    }
    return { entities: ents.length, tried, aggroed: ok };
  });
  out.data.combat_setup = combatSetup;
  await h.h('stepFrames', 2);
  const inCombat = !!(await h.h('getCombatState')).inCombat;
  await h.h('setMode', 'play-instrumented');
  await h.h('openMenu', 'inventory');
  await h.h('stepFrames', 2);
  const cBefore = await mode();
  await key('Digit3');
  const cAfter = await mode();
  out.data.in_combat_walk = { inCombat, before: cBefore, after: cAfter };
  push('B5', 'in a fight the walk keys do NOT navigate (they stay the offhand chord)',
    !inCombat || cBefore === cAfter, `inCombat=${inCombat}, ${cBefore} -> ${cAfter}`);
  await h.h('setMode', 'harness');

  // =========================================================================================
  // C — THE FORGED-SAVE MAP ROUTE
  // =========================================================================================
  await h.h('loadState', 'ui-journal');
  await h.h('stepFrames', 2);
  await h.h('closeMenu');
  // Walk a real body, so there is an honest footprint to compare a forged one against.
  const pois = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'game/data/world/pois.json'), 'utf8')).pois;
  const targets = pois.slice(0, 7);
  for (const p of targets) {
    try { await h.h('teleport', p.pos[0], p.pos[2], {}); await h.h('stepFrames', 3); } catch { /* */ }
  }
  await h.h('stepFrames', 4);
  const honest = await h.h('mapState');
  const honestSave = await h.h('saveState');
  out.data.honest = { places: honest.places, revealed: honest.revealed_cells };

  // Forge EVERY field of the discovery blob, not just the two round 1 forged.
  const allIds = pois.map((p) => p.id);
  const forged = JSON.parse(JSON.stringify(honestSave));
  const dblob = forged.world.discovery;
  const cellBytes = Buffer.from(String(dblob.cells || ''), 'base64').length || 5356;
  dblob.cells = Buffer.alloc(cellBytes, 0xFF).toString('base64');
  dblob.places = allIds.slice();
  dblob.revealed = 42846;
  dblob.derived_from = 'places';          // lie about the provenance too
  dblob.discovered = allIds.slice();      // a key the loader does not know about
  dblob.reveal = allIds.slice();
  await h.h('loadState', 'ui-journal');
  await h.h('stepFrames', 2);
  await h.h('loadState', forged);
  await h.h('stepFrames', 4);
  const after = await h.h('mapState');
  await h.h('openMenu', 'map');
  await h.h('stepFrames', 2);
  const uiF = await h.h('getUIState');
  const forgedShot = decode(await h.h('screenshot'));
  fs.writeFileSync(path.join(RUN, 'map-forged.png'), PNG.sync.write(forgedShot));
  out.data.forged = {
    places: after.places, place_count: after.place_count, revealed: after.revealed_cells,
    dropped_on_load: after.dropped_on_load,
    places_drawn: uiF.map.places_drawn, places_discovered: uiF.map.places_discovered,
    drawn_cells: uiF.map.drawn_cells, revealed_cells: uiF.map.revealed_cells,
  };
  const phantom = after.places.filter((p) => !honest.places.includes(p));
  push('C1', 'a save forged in EVERY discovery field names no place the body did not stand in',
    phantom.length === 0,
    `honest ${honest.places.length} places / ${honest.revealed_cells} cells; forged load -> ${after.place_count} places / ${after.revealed_cells} cells; phantom [${phantom.join(',') || '-'}]; dropped ${after.dropped_on_load.length}`);
  push('C2', 'and the SCREEN draws no more squares than the body stood in',
    uiF.map.places_drawn <= honest.places.length,
    `places_drawn=${uiF.map.places_drawn} places_discovered=${uiF.map.places_discovered} stood_in=${honest.places.length} drawn_cells=${uiF.map.drawn_cells}`);
  push('C3', 'the compliance report was NOT closed by both numbers coming off the same forged model',
    uiF.map.places_drawn === honest.places.length && after.revealed_cells === honest.revealed_cells,
    `revealed honest ${honest.revealed_cells} -> forged ${after.revealed_cells} (delta ${after.revealed_cells - honest.revealed_cells})`);

  // C4 — the limit the builder declared: forging `stood` itself. Not a place name, but it IS
  // "terrain rendered where the player has not been", which S35 also hard-fails.
  const wide = JSON.parse(JSON.stringify(honestSave));
  const walkAll = [];
  { let prev = 0; for (let i = 0; i < 42846; i += 97) { let v = i - prev; prev = i; v = v < 0 ? -v * 2 - 1 : v * 2; while (v >= 0x80) { walkAll.push((v & 0x7F) | 0x80); v = Math.floor(v / 128); } walkAll.push(v); } }
  wide.world.discovery.stood = Buffer.from(walkAll).toString('base64');
  await h.h('closeMenu');
  await h.h('loadState', 'ui-journal'); await h.h('stepFrames', 2);
  await h.h('loadState', wide);
  await h.h('stepFrames', 4);
  const wideState = await h.h('mapState');
  out.data.forged_footprint = { places: wideState.place_count, revealed: wideState.revealed_cells, names: wideState.places };
  push('C4', 'DECLARED LIMIT, MEASURED: forging the FOOTPRINT still reveals province and names places',
    false,
    `a forged 'stood' of 442 synthetic cells loads ${wideState.place_count} places and ${wideState.revealed_cells} revealed cells against the honest ${honest.places.length}/${honest.revealed_cells}. Recorded as the limit the builder declared, not as a claim it hid.`);

  // =========================================================================================
  // D — EVERY WRITE TO THE DISCOVERY OBJECT
  // =========================================================================================
  await h.h('loadState', 'ui-journal'); await h.h('stepFrames', 4);
  const census = await h.page.evaluate(() => {
    const d = window.__ENGINE.sim.discovery;
    const proto = Object.getPrototypeOf(d);
    const members = [];
    for (const n of Object.getOwnPropertyNames(proto)) {
      const desc = Object.getOwnPropertyDescriptor(proto, n);
      members.push({
        name: n,
        kind: desc.get ? 'getter' : (typeof desc.value === 'function' ? 'method' : 'value'),
        arity: typeof desc.value === 'function' ? desc.value.length : null,
        src: typeof desc.value === 'function' ? String(desc.value).slice(0, 4000)
          : (desc.get ? String(desc.get).slice(0, 4000) : null),
      });
    }
    const rep = typeof d.mutatorReport === 'function' ? d.mutatorReport() : null;
    return { members, mutatorReport: rep, frozen: Object.isFrozen(d), restoreReads: Array.from(d.restoreReads || []) };
  });
  // A member WRITES if its own source assigns to a #private field or calls a member that does.
  const WRITES = /this\.#\w+\s*(=|\+\+|--|\+=|-=|\|=|&=)|this\.#\w+\.(push|pop|add|clear|delete|fill|sort|splice)|this\.#\w+\.length\s*=|this\.#\w+\[[^\]]*\]\s*(\||&|\^)?=/;
  const CALLS_WRITER = /this\.#(occupy|derivePlaces|deriveReveal|set)\(/;
  const independent = census.members
    .filter((m) => m.kind === 'method' && m.name !== 'constructor')
    .filter((m) => WRITES.test(m.src || '') || CALLS_WRITER.test(m.src || ''))
    .map((m) => ({ name: m.name, arity: m.arity }));
  const reported = (census.mutatorReport || []).map((m) => ({ name: m.name, arity: m.arity }));
  const key2 = (a) => a.map((x) => `${x.name}/${x.arity}`).sort().join(',');
  out.data.mutator_census = { independent, reported, all_members: census.members.map((m) => ({ name: m.name, kind: m.kind, arity: m.arity })) };
  push('D1', "the build's own mutator enumeration matches an independent scan of every prototype member that writes state",
    key2(independent) === key2(reported),
    `independent [${key2(independent)}] vs reported [${key2(reported)}]`);
  push('D2', 'no mutator has a parameter in which a place can be named (RESTORE_READS is the channel)',
    JSON.stringify(census.restoreReads) === JSON.stringify(['stood']),
    `restore_reads=${JSON.stringify(census.restoreReads)}, frozen=${census.frozen}`);

  // D3 — FALSIFY THE CLASSIFIER (RULES 4). It claims to be fail-closed: "an accessor or a named
  // reader is a reader; ANYTHING ELSE is a state writer, including a method added tomorrow by
  // somebody who never read this file." Add one and see whether it goes red.
  const falsify = await h.page.evaluate(() => {
    const d = window.__ENGINE.sim.discovery;
    const proto = Object.getPrototypeOf(d);
    const r = {};
    // (a) a METHOD nobody declared — the case the comment names
    Object.defineProperty(proto, '__criticMethod', { value: function (x) { return x; }, configurable: true, writable: true });
    r.method_caught = d.mutatorReport().some((m) => m.name === '__criticMethod');
    delete proto.__criticMethod;
    // (b) an ACCESSOR that mutates — the case the comment dismisses with
    //     "getters are readers by construction"
    Object.defineProperty(proto, '__criticGetter', {
      configurable: true,
      get() { this.restore({ stood: '' }); return 1; },
    });
    const before = d.revealedCells;
    void d.__criticGetter;                 // a plain property READ wipes the map
    const after = d.revealedCells;
    r.getter_caught = d.mutatorReport().some((m) => m.name === '__criticGetter');
    r.getter_mutated = before !== after;
    r.revealed_before = before; r.revealed_after = after;
    delete proto.__criticGetter;
    return r;
  });
  out.data.classifier_falsification = falsify;
  push('D3', 'the classifier goes RED when an undeclared METHOD is added to the prototype',
    falsify.method_caught === true, `caught=${falsify.method_caught}`);
  push('D4', 'the classifier goes RED when a state-writing ACCESSOR is added to the prototype',
    falsify.getter_caught === true,
    `a getter that calls restore() wiped the map (${falsify.revealed_before} -> ${falsify.revealed_after} revealed cells) and mutatorReport() reported it as ${falsify.getter_caught ? 'a writer' : 'NOTHING AT ALL'}. The classifier skips every accessor: \`if (!d || typeof d.value !== 'function') continue\`.`);

  // =========================================================================================
  // E — AR-2 ON THE DRAWN MAP
  // =========================================================================================
  await h.h('loadState', 'ui-journal'); await h.h('stepFrames', 2);
  for (const p of targets) { try { await h.h('teleport', p.pos[0], p.pos[2], {}); await h.h('stepFrames', 3); } catch { /* */ } }
  await h.h('openMenu', 'map'); await h.h('stepFrames', 3);
  const uiMap = await h.h('getUIState');
  const mapEls = uiMap.elements.filter((e) => e.visible);
  const notPrefixed = mapEls.filter((e) => !e.id.startsWith('map.') && !e.id.startsWith('hud.') && e.kind !== 'panel');
  const numerals = mapEls.filter((e) => e.text !== null && /\d/.test(String(e.text)));
  const questish = mapEls.filter((e) => e.meta && (e.meta.quest || e.meta.objective || e.meta.giver || e.meta.target || e.meta.rumour || e.meta.route || e.meta.travel));
  out.data.map_screen = {
    element_ids: mapEls.map((e) => e.id), kinds: [...new Set(mapEls.map((e) => e.kind))].sort(),
    self_report: uiMap.map,
    numerals: numerals.map((e) => [e.id, e.text]),
    not_map_prefixed: notPrefixed.map((e) => e.id),
  };
  push('E1', 'no numeral anywhere on the map screen (S35: no distance or direction readouts)',
    numerals.length === 0, `${numerals.length}: ${JSON.stringify(numerals.map((e) => [e.id, e.text]))}`);
  push('E2', 'no quest / objective / giver / target / rumour / route / travel identity on any drawn element',
    questish.length === 0, `${questish.length}`);
  push('E3', 'the map is not reachable from the journal and the journal is not reachable from the map',
    !(await (async () => { await h.h('openMenu', 'journal'); await h.h('stepFrames', 1); const j = await h.h('getUIState'); await h.h('openMenu', 'map'); await h.h('stepFrames', 1); const m = await h.h('getUIState'); out.data.q7 = { from_journal: j.navigable, from_map: m.navigable }; return j.navigable.includes('map') || m.navigable.includes('journal'); })()),
    JSON.stringify(out.data.q7));
  // The screen's own report filters on `id.startsWith('map.')`. Say whether anything escapes it.
  push('E4', "the screen's own AR-2 filters cover every element it drew (they key on the id prefix `map.`)",
    notPrefixed.length === 0, `elements not covered by the id-prefix filters: [${notPrefixed.map((e) => e.id).join(',') || '-'}]`);

  // =========================================================================================
  // F — CONSUMPTION (RI-MTH07)
  // =========================================================================================
  // The world-side consumer of the discovery model is the MAP SCREEN's drawn raster. Perturb
  // the model (suspend recording; walk; resume) and read the change out of the FRAMEBUFFER,
  // not out of the register that the model also feeds.
  await h.h('loadState', 'ui-journal'); await h.h('stepFrames', 2);
  await h.h('teleport', targets[0].pos[0], targets[0].pos[2], {}); await h.h('stepFrames', 4);
  await h.h('openMenu', 'map'); await h.h('stepFrames', 3);
  const shotA = decode(await h.h('screenshot'));
  const mA = await h.h('mapState');
  await h.h('closeMenu');
  for (const p of targets.slice(1, 5)) { try { await h.h('teleport', p.pos[0], p.pos[2], {}); await h.h('stepFrames', 3); } catch { /* */ } }
  await h.h('openMenu', 'map'); await h.h('stepFrames', 3);
  const shotB = decode(await h.h('screenshot'));
  const mB = await h.h('mapState');
  let diff = 0;
  for (let i = 0; i < shotA.width * shotA.height; i++) {
    const o = i * 4;
    if (Math.abs(shotA.data[o] - shotB.data[o]) + Math.abs(shotA.data[o + 1] - shotB.data[o + 1]) + Math.abs(shotA.data[o + 2] - shotB.data[o + 2]) > 6) diff++;
  }
  fs.writeFileSync(path.join(RUN, 'consume-A.png'), PNG.sync.write(shotA));
  fs.writeFileSync(path.join(RUN, 'consume-B.png'), PNG.sync.write(shotB));
  out.data.consumption_map = { A: { places: mA.place_count, revealed: mA.revealed_cells }, B: { places: mB.place_count, revealed: mB.revealed_cells }, differing_px: diff };
  push('F1', 'CONSUMPTION: perturbing the discovery model changes the DRAWN map, not only the register',
    diff > 0 && mB.revealed_cells > mA.revealed_cells,
    `places ${mA.place_count} -> ${mB.place_count}, revealed ${mA.revealed_cells} -> ${mB.revealed_cells}, ${diff} pixels changed on screen`);

  // F2 — the OTHER model round 2 shipped: the nav ring. Its consumer is the UI mode machine,
  // which is not "an entity in the world". Perturb it (enter combat) and watch the answer move.
  await h.h('closeMenu'); await h.h('stepFrames', 2);
  const navOut = (await h.h('getUIState')).nav;
  await h.h('openMenu', 'inventory'); await h.h('stepFrames', 1);
  const navMenu = (await h.h('getUIState')).nav;
  out.data.nav_model = { from_world: navOut, from_inventory: navMenu };
  push('F2', 'CONSUMPTION: the nav model reports walkable destinations and they change with context',
    JSON.stringify(navOut.walkable) !== JSON.stringify(navMenu.walkable),
    `world walkable ${JSON.stringify(navOut.walkable)} (walk_live ${navOut.walk_live}) vs inventory walkable ${JSON.stringify(navMenu.walkable)} (walk_live ${navMenu.walk_live})`);

  // F3 — DOES ANYTHING OUTSIDE THE MAP SCREEN READ THE FOOTPRINT? S7 says you may only travel
  // to somewhere you have walked to. If travel reads its own record instead, there are two
  // parallel implementations of "where the body has been".
  const travelReads = await h.page.evaluate(() => {
    const E = window.__ENGINE;
    return {
      travel_has_own_visited: !!(E.travel && E.travel.visited),
      travel_visited_size: E.travel && E.travel.visited ? E.travel.visited.size : null,
      travel_mentions_discovery: /discovery/.test(String(E.travelQuote || E.travelFare || '')),
    };
  });
  out.data.travel = travelReads;
  push('F3', 'the discovery footprint has more than one consumer in the running world',
    travelReads.travel_has_own_visited === false,
    `the travel network keeps its OWN visited record (${JSON.stringify(travelReads)}); the discovery footprint's only consumer is the map screen`);

  // =========================================================================================
  // G — THE SIX SCREENS, PHOTOGRAPHED
  // =========================================================================================
  const stamp = '2026-08-08-w1-21-r2-critic';
  const shots = [];
  await h.h('loadState', 'ui-journal'); await h.h('setAtHearth', true); await h.h('stepFrames', 2);
  for (const p of targets) { try { await h.h('teleport', p.pos[0], p.pos[2], {}); await h.h('stepFrames', 3); } catch { /* */ } }
  for (const s of SIX) {
    await h.h('closeMenu'); await h.h('stepFrames', 1);
    await h.h('openMenu', s); await h.h('stepFrames', 3);
    const got = await mode();
    const png = decode(await h.h('screenshot'));
    const f = path.join(SHOTS, `${stamp}-${s}.png`);
    fs.writeFileSync(f, PNG.sync.write(png));
    // A blank shot and a working shot are both "a PNG arrived": count the ink.
    let ink = 0;
    for (let i = 0; i < png.width * png.height; i++) { const o = i * 4; if (png.data[o] + png.data[o + 1] + png.data[o + 2] > 90) ink++; }
    shots.push({ screen: s, mode_reached: got, file: path.relative(REPO_ROOT, f), lit_px: ink });
    say(`  shot ${s}: mode=${got}, ${ink} lit px -> ${path.relative(REPO_ROOT, f)}`);
  }
  out.data.shots = shots;
  push('G1', 'all six screens photographed, each showing the screen it claims to show',
    shots.every((s) => s.mode_reached === s.screen && s.lit_px > 10000),
    JSON.stringify(shots.map((s) => [s.screen, s.mode_reached, s.lit_px])));
} finally {
  out.loadavg_end = fs.readFileSync('/proc/loadavg', 'utf8').trim();
  out.console_errors = h.errors.slice(0, 20);
  await h.close();
}

out.pass = out.checks.filter((c) => c.result === 'pass').length;
out.fail = out.checks.filter((c) => c.result === 'fail').length;
writeJson(path.join(RUN, 'critic-w1-21-r2-a.json'), out);
say(`\n${out.pass} pass, ${out.fail} fail — ${path.join(RUN, 'critic-w1-21-r2-a.json')}`);
process.exit(out.fail ? 1 : 0);
