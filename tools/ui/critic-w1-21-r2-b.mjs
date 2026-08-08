#!/usr/bin/env node
// critic-w1-21-r2-b.mjs — the W1-21 ROUND-2 CRITIC's own instrument, passes C..G.
// Written by the critic; declared in orchestration/status/critic-w1-21-r2.json. ONE browser.
//
// Pass B (the doors, real keys and a real pad) is in `critic-w1-21-r2-a.mjs` and is done. This
// file is the AR-2 half, and it exists as a separate file for one reason worth writing down:
//
//   MY FIRST RUN OF THESE PASSES WAS A VACUOUS PASS, AND I AM RECORDING IT RATHER THAN DELETING
//   IT. I loaded `ui-journal`, teleported to seven `pois.json` positions, and got a body that had
//   stood in ZERO places and revealed ZERO cells — so "the forged save named no place the body
//   had not stood in" was true against a baseline of nothing. `ui-journal` sets
//   `env.interior: 'thorn-hall'` and `Discovery.observe()` suspends indoors by design; and
//   `pois.json` positions are waystations rather than built pads, so standing on one discovers
//   nothing even outdoors. The builder's own probe hit BOTH of those traps first and wrote them
//   down, which is how I knew to look. Three checks that had said `ok` said nothing.
//
// So this file establishes the baseline the hard way and REFUSES TO GRADE THE FORGERY UNTIL THE
// HONEST WALK HAS DISCOVERED SOMETHING — C0 is a gate, not a nicety.
//
// USAGE  node tools/ui/critic-w1-21-r2-b.mjs [--out DIR] [--shots DIR]
// EXIT   0 = every assertion held · 1 = at least one failed · 2 = could not measure
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-21-r2-b.mjs — the W1-21 round-2 critic's instrument, passes C..G.`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const say = (s) => process.stdout.write(s + '\n');

const W = Number(args.width || 1280), H = Number(args.height || 720);
const RUN = path.join(RUNS_DIR, String(args.out || 'CRITIC-W1-21-R2'));
const SHOTS = path.join(REPO_ROOT, String(args.shots || 'docs/shots'));
ensureDir(RUN); ensureDir(SHOTS);
const decode = (u) => PNG.sync.read(Buffer.from(u.split(',')[1], 'base64'));
const diffPx = (a, b) => {
  let n = 0;
  for (let i = 0; i < a.width * a.height; i++) {
    const o = i * 4;
    if (Math.abs(a.data[o] - b.data[o]) + Math.abs(a.data[o + 1] - b.data[o + 1])
      + Math.abs(a.data[o + 2] - b.data[o + 2]) > 6) n++;
  }
  return n;
};

const out = {
  probe: 'critic-w1-21-r2-b', at: new Date().toISOString(),
  commit: (() => { try { return fs.readFileSync(path.join(REPO_ROOT, '.git/HEAD'), 'utf8').trim(); } catch { return null; } })(),
  viewport: [W, H], loadavg_start: fs.readFileSync('/proc/loadavg', 'utf8').trim(),
  checks: [], data: {},
};
const push = (id, what, ok, detail) => {
  out.checks.push({ id, what, result: ok ? 'pass' : 'fail', detail });
  say(`${ok ? 'ok  ' : 'FAIL'} ${id}  ${what}  — ${detail}`);
};

/**
 * Everything that has to survive a neighbour's throw runs INSIDE the page.
 * `tools/lib/browser.mjs` turns a harness throw into a process-level `die()`, so a Node-side
 * try/catch never runs — reproduced independently on `aggro()` in pass B, and it is why the
 * whole walk is one `page.evaluate`.
 */
const WALK = `() => {
  const H = window.__HARNESS, eng = window.__ENGINE;
  const notes = [];
  const clearHostiles = () => {
    try { for (const e of (H.listEntities() || [])) {
      if (e && e.eid !== undefined && e.archetype !== 'player' && !e.isPlayer) {
        try { H.despawn(e.eid); } catch (x) { /* gone */ }
      } } } catch (x) { /* none */ }
  };
  const step = (n) => { for (let i = 0; i < n; i++) {
    try { H.stepFrames(1); } catch (e) {
      const m = String(e && e.message || e).slice(0, 90);
      if (notes.indexOf(m) < 0) notes.push(m);
      clearHostiles();
    } } };
  try { H.closeMenu(); } catch (e) { /* none open */ }
  H.loadState('default'); step(4);
  try { H.exitInterior(); } catch (e) { /* already outside */ }
  step(4);
  // The body must stand in REAL PLACES: field.sites carries each site's own centre, which is the
  // middle of the pad r_flat measures. pois.json positions are waystations and discover nothing.
  const sites = (eng.field.sites || []).slice(0, 7);
  const reached = [], refused = [];
  for (const s of sites) {
    try { H.teleport(s.x, s.z); clearHostiles(); step(20); reached.push(s.id); }
    catch (e) { refused.push({ id: s.id, error: String(e && e.message || e).slice(0, 120) }); }
  }
  clearHostiles(); step(20);
  const m = H.mapState();
  return {
    reached, refused, neighbour_throws: notes,
    interior: (eng.sim.env || {}).interior || null,
    suspended: m.suspended,
    places: m.places.slice(), revealed: m.revealed_cells, total: m.total_cells,
    blob: H.saveState(),
  };
}`;

const h = await launchGame({ width: W, height: H, timeout: 300000 });
try {
  await h.h('setRenderRate', 60);

  // =========================================================================================
  // C — THE FORGED-SAVE MAP ROUTE
  // =========================================================================================
  const honest = await h.page.evaluate(eval(`(${WALK})`));
  out.data.honest = { ...honest, blob: undefined };
  say(`  honest walk: reached [${honest.reached.join(',')}], interior=${honest.interior}, `
    + `suspended=${honest.suspended}, places ${honest.places.length}, revealed ${honest.revealed}`);
  if (honest.neighbour_throws.length) say(`  neighbour throws survived: ${JSON.stringify(honest.neighbour_throws)}`);

  push('C0', 'GATE: the honest baseline is non-empty, so a refused forgery means something',
    honest.places.length > 0 && honest.revealed > 0,
    `stood in ${honest.places.length} places [${honest.places.join(',')}], ${honest.revealed} of ${honest.total} cells revealed, interior=${honest.interior}, suspended=${honest.suspended}`);
  if (honest.places.length === 0) {
    say('  REFUSING TO GRADE C1-C3 AGAINST A BASELINE OF ZERO.');
  } else {
    await h.h('openMenu', 'map'); await h.h('stepFrames', 3);
    const shotHonest = decode(await h.h('screenshot'));
    fs.writeFileSync(path.join(RUN, 'map-honest.png'), PNG.sync.write(shotHonest));
    const uiHonest = await h.h('getUIState');
    out.data.honest_screen = uiHonest.map;

    // Forge EVERY field of the discovery blob, not the two round 1 forged.
    const forgeResult = await h.page.evaluate(({ blob }) => {
      const H = window.__HARNESS, eng = window.__ENGINE;
      const ids = (eng.data.pois.pois || []).map((p) => p.id);
      const f = JSON.parse(JSON.stringify(blob));
      const d = f.world.discovery;
      const bytes = atob(String(d.cells || ''));
      let s = ''; for (let i = 0; i < (bytes.length || 5356); i++) s += String.fromCharCode(255);
      d.cells = btoa(s);
      d.places = ids.slice();
      d.revealed = 42846;
      d.derived_from = 'places';        // lie about the provenance too
      d.discovered = ids.slice();       // keys the loader does not know about
      d.reveal = ids.slice();
      d.stood_places = ids.slice();
      try { H.closeMenu(); } catch (e) { /* */ }
      H.loadState(f);
      for (let i = 0; i < 6; i++) { try { H.stepFrames(1); } catch (e) { /* neighbour */ } }
      const m = H.mapState();
      const audit = eng.sim.discovery.lastRestore;
      H.openMenu('map');
      for (let i = 0; i < 3; i++) { try { H.stepFrames(1); } catch (e) { /* */ } }
      return {
        forged_keys: Object.keys(d),
        places: m.places.slice(), place_count: m.place_count, revealed: m.revealed_cells,
        dropped_on_load: m.dropped_on_load, audit,
        screen: H.getUIState().map,
      };
    }, { blob: honest.blob });
    out.data.forged = forgeResult;
    const shotForged = decode(await h.h('screenshot'));
    fs.writeFileSync(path.join(RUN, 'map-forged.png'), PNG.sync.write(shotForged));
    const phantom = forgeResult.places.filter((p) => !honest.places.includes(p));
    push('C1', 'a save forged in EVERY discovery field names no place the body did not stand in',
      phantom.length === 0 && forgeResult.place_count <= honest.places.length,
      `forged ${forgeResult.forged_keys.length} keys ${JSON.stringify(forgeResult.forged_keys)}; `
      + `places ${honest.places.length} -> ${forgeResult.place_count}; phantom [${phantom.join(',') || '-'}]; `
      + `dropped ${forgeResult.dropped_on_load.length}; audit ${JSON.stringify(forgeResult.audit)}`);
    push('C2', 'and the DRAWN screen draws no more squares than the body stood in',
      forgeResult.screen.places_drawn <= honest.places.length,
      `places_drawn=${forgeResult.screen.places_drawn} places_discovered=${forgeResult.screen.places_discovered} `
      + `stood_in=${honest.places.length} drawn_cells=${forgeResult.screen.drawn_cells} `
      + `(honest screen drew ${uiHonest.map.places_drawn} squares over ${uiHonest.map.drawn_cells} cells)`);
    push('C3', 'no terrain is rendered where the player has not been (the raster did not grow)',
      forgeResult.revealed === honest.revealed,
      `revealed honest ${honest.revealed} -> forged ${forgeResult.revealed} (delta ${forgeResult.revealed - honest.revealed})`);
    push('C3b', 'the two map pictures are IDENTICAL — the forgery changed nothing a player can see',
      diffPx(shotHonest, shotForged) === 0, `${diffPx(shotHonest, shotForged)} differing pixels`);

    // C4 — the limit the builder declared. Forging `stood` is not "name a place I have not been",
    // but it IS "terrain rendered where the player has not been", which S35 also hard-fails.
    const wideResult = await h.page.evaluate(({ blob }) => {
      const H = window.__HARNESS, eng = window.__ENGINE;
      const f = JSON.parse(JSON.stringify(blob));
      const bytes = []; let prev = 0;
      for (let i = 0; i < 42846; i += 41) {
        let v = i - prev; prev = i; v = v < 0 ? -v * 2 - 1 : v * 2;
        while (v >= 0x80) { bytes.push((v & 0x7F) | 0x80); v = Math.floor(v / 128); }
        bytes.push(v);
      }
      let s = ''; for (const b of bytes) s += String.fromCharCode(b);
      f.world.discovery.stood = btoa(s);
      try { H.closeMenu(); } catch (e) { /* */ }
      H.loadState(f);
      for (let i = 0; i < 6; i++) { try { H.stepFrames(1); } catch (e) { /* */ } }
      const m = H.mapState();
      return { places: m.places.slice(), place_count: m.place_count, revealed: m.revealed_cells, total: m.total_cells, synthetic_cells: bytes.length ? 1046 : 0 };
    }, { blob: honest.blob });
    out.data.forged_footprint = wideResult;
    push('C4', 'DECLARED LIMIT, MEASURED: forging the FOOTPRINT itself still reveals and still names',
      false,
      `a synthetic 'stood' of 1,046 cells the body never occupied loads ${wideResult.place_count} places `
      + `[${wideResult.places.join(',')}] and ${wideResult.revealed} of ${wideResult.total} revealed cells, `
      + `against the honest ${honest.places.length}/${honest.revealed}. S35 hard-fails "terrain rendered where `
      + `the player has not been" and this renders it. Recorded as the limit the builder DECLARED (status `
      + `note "LIMIT, stated"), not as a claim it concealed — but it is a hard-fail clause, not a footnote.`);
  }

  // =========================================================================================
  // D — EVERY WRITE TO THE DISCOVERY OBJECT
  // =========================================================================================
  await h.page.evaluate(eval(`(${WALK})`));      // a non-empty map, so a wipe is visible
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
        src: typeof desc.value === 'function' ? String(desc.value) : (desc.get ? String(desc.get) : null),
      });
    }
    return {
      members, mutatorReport: d.mutatorReport(), frozen: Object.isFrozen(d),
      restoreReads: Array.from(d.restoreReads || []), revealed: d.revealedCells,
    };
  });
  const WRITES = /this\.#\w+\s*(=[^=]|\+\+|--|\+=|-=|\|=|&=)|this\.#\w+\.(push|pop|add|clear|delete|fill|sort|splice)\(|this\.#\w+\.length\s*=|this\.#\w+\[[^\]]*\]\s*(\||&|\^)?=/;
  const CALLS = /this\.#(occupy|derivePlaces|deriveReveal|set)\(/;
  const independent = census.members
    .filter((m) => m.kind === 'method' && m.name !== 'constructor')
    .filter((m) => WRITES.test(m.src || '') || CALLS.test(m.src || ''))
    .map((m) => ({ name: m.name, arity: m.arity }));
  const reported = census.mutatorReport.map((m) => ({ name: m.name, arity: m.arity }));
  const k = (a) => a.map((x) => `${x.name}/${x.arity}`).sort().join(',');
  out.data.mutator_census = {
    independent, reported,
    members: census.members.map((m) => ({ name: m.name, kind: m.kind, arity: m.arity })),
    methods: census.members.filter((m) => m.kind === 'method').length,
    getters: census.members.filter((m) => m.kind === 'getter').length,
  };
  push('D1', "the build's own mutator enumeration matches an INDEPENDENT scan of every prototype member that writes state",
    k(independent) === k(reported),
    `${census.members.length} prototype members (${out.data.mutator_census.methods} methods, ${out.data.mutator_census.getters} accessors); `
    + `independent scan finds [${k(independent)}]; the build reports [${k(reported)}]`);
  push('D2', 'no mutator has a parameter in which a place can be named',
    JSON.stringify(census.restoreReads) === JSON.stringify(['stood']),
    `restore_reads=${JSON.stringify(census.restoreReads)}, instance frozen=${census.frozen}`);

  const falsify = await h.page.evaluate(() => {
    const d = window.__ENGINE.sim.discovery;
    const proto = Object.getPrototypeOf(d);
    const r = { revealed_before: d.revealedCells };
    Object.defineProperty(proto, '__criticMethod', { value: function (x) { return x; }, configurable: true, writable: true });
    r.method_caught = d.mutatorReport().some((m) => m.name === '__criticMethod');
    delete proto.__criticMethod;
    Object.defineProperty(proto, '__criticGetter', {
      configurable: true, get() { this.restore({ stood: '' }); return 1; },
    });
    void d.__criticGetter;                       // a plain PROPERTY READ wipes the map
    r.revealed_after = d.revealedCells;
    r.getter_mutated = r.revealed_before !== r.revealed_after;
    r.getter_caught = d.mutatorReport().some((m) => m.name === '__criticGetter');
    delete proto.__criticGetter;
    return r;
  });
  out.data.classifier_falsification = falsify;
  push('D3', 'RULES 4: the classifier goes RED when an undeclared METHOD is added to the prototype',
    falsify.method_caught === true, `caught=${falsify.method_caught}`);
  push('D4', 'RULES 4: the classifier goes RED when a state-writing ACCESSOR is added to the prototype',
    falsify.getter_caught === true,
    `an accessor whose getter calls restore() wiped the map on a plain property READ `
    + `(${falsify.revealed_before} -> ${falsify.revealed_after} revealed cells, mutated=${falsify.getter_mutated}) `
    + `and mutatorReport() reported it as ${falsify.getter_caught ? 'a writer' : 'NOTHING AT ALL'}. `
    + `The classifier's loop is \`if (!d || typeof d.value !== 'function') continue\`, and the file's own `
    + `comment says "getters are readers by construction", which is not true of JavaScript.`);

  // =========================================================================================
  // E — AR-2 ON THE DRAWN MAP
  // =========================================================================================
  await h.page.evaluate(eval(`(${WALK})`));
  await h.h('openMenu', 'map'); await h.h('stepFrames', 3);
  const uiMap = await h.h('getUIState');
  const vis = uiMap.elements.filter((e) => e.visible);
  const mapEls = vis.filter((e) => e.id.startsWith('map.'));
  const otherEls = vis.filter((e) => !e.id.startsWith('map.'));
  const mapNumerals = mapEls.filter((e) => e.text !== null && /\d/.test(String(e.text)));
  const otherNumerals = otherEls.filter((e) => e.text !== null && /\d/.test(String(e.text)));
  const questish = mapEls.filter((e) => e.meta && (e.meta.quest || e.meta.objective || e.meta.giver
    || e.meta.target || e.meta.rumour || e.meta.route || e.meta.travel));
  out.data.map_screen = {
    map_element_ids: mapEls.map((e) => e.id),
    other_element_ids: otherEls.map((e) => e.id),
    kinds: [...new Set(vis.map((e) => e.kind))].sort(),
    self_report: uiMap.map,
    map_numerals: mapNumerals.map((e) => [e.id, e.text]),
    other_numerals: otherNumerals.map((e) => [e.id, e.text]),
  };
  push('E1', 'no numeral on any element the MAP drew (S35: no distance or direction readouts)',
    mapNumerals.length === 0,
    `${mapEls.length} map elements, ${mapNumerals.length} numerals ${JSON.stringify(mapNumerals.map((e) => [e.id, e.text]))}`);
  push('E2', 'no quest / objective / giver / target / rumour / route / travel identity on any map element',
    questish.length === 0, `${questish.length} of ${mapEls.length}`);
  push('E1b', 'and nothing ELSE on the screen while the map is open carries a numeral either',
    otherNumerals.length === 0,
    `${otherEls.length} non-map elements visible over the map [${otherEls.map((e) => e.id).join(',')}]; `
    + `numerals ${JSON.stringify(otherNumerals.map((e) => [e.id, e.text]))}. These are HUD elements, not map `
    + `readouts, so this is an RI-UIX01 numeric-budget question and NOT an S35 one — recorded on the right item.`);
  const q7 = await (async () => {
    await h.h('openMenu', 'journal'); await h.h('stepFrames', 1);
    const j = await h.h('getUIState');
    await h.h('openMenu', 'map'); await h.h('stepFrames', 1);
    const m = await h.h('getUIState');
    return { from_journal: j.navigable, from_map: m.navigable };
  })();
  out.data.q7 = q7;
  push('E3', 'RI-UIX04 Q7: map absent from the journal ring and journal absent from the map ring',
    !q7.from_journal.includes('map') && !q7.from_map.includes('journal'), JSON.stringify(q7));
  push('E4', "the screen's own AR-2 filters cover every element it drew (they key on the id prefix `map.`)",
    otherEls.length === 0,
    `${otherEls.length} visible elements are NOT matched by \`id.startsWith('map.')\` and are therefore `
    + `invisible to routes_drawn / quest_bearing_elements / travel_affordances / numeric_text: `
    + `[${otherEls.map((e) => e.id).join(',') || '-'}]`);

  // =========================================================================================
  // F — CONSUMPTION (RI-MTH07 / ARBITRATION §3)
  // =========================================================================================
  const consume = await h.page.evaluate(() => {
    const H = window.__HARNESS, eng = window.__ENGINE;
    const step = (n) => { for (let i = 0; i < n; i++) { try { H.stepFrames(1); } catch (e) { /* */ } } };
    try { H.closeMenu(); } catch (e) { /* */ }
    H.loadState('default'); step(4);
    try { H.exitInterior(); } catch (e) { /* */ }
    step(4);
    const sites = (eng.field.sites || []).slice(0, 7);
    try { H.teleport(sites[0].x, sites[0].z); } catch (e) { /* */ }
    step(20);
    const a = { places: H.mapState().place_count, revealed: H.mapState().revealed_cells };
    return { sites: sites.map((s) => s.id), a };
  });
  await h.h('openMenu', 'map'); await h.h('stepFrames', 3);
  const shotA = decode(await h.h('screenshot'));
  const more = await h.page.evaluate(() => {
    const H = window.__HARNESS, eng = window.__ENGINE;
    const step = (n) => { for (let i = 0; i < n; i++) { try { H.stepFrames(1); } catch (e) { /* */ } } };
    H.closeMenu(); step(2);
    for (const s of (eng.field.sites || []).slice(1, 5)) {
      try { H.teleport(s.x, s.z); step(20); } catch (e) { /* */ }
    }
    step(10);
    H.openMenu('map'); step(3);
    return { places: H.mapState().place_count, revealed: H.mapState().revealed_cells };
  });
  const shotB = decode(await h.h('screenshot'));
  fs.writeFileSync(path.join(RUN, 'consume-A.png'), PNG.sync.write(shotA));
  fs.writeFileSync(path.join(RUN, 'consume-B.png'), PNG.sync.write(shotB));
  const d1 = diffPx(shotA, shotB);
  out.data.consumption_map = { A: consume.a, B: more, differing_px: d1 };
  push('F1', 'CONSUMPTION: perturbing the discovery model changes the DRAWN map, not only the register',
    d1 > 0 && more.revealed > consume.a.revealed,
    `places ${consume.a.places} -> ${more.places}, revealed ${consume.a.revealed} -> ${more.revealed}, `
    + `${d1} pixels changed on the screen a player looks at`);

  // F1b — the ablation. Suspend the model and walk the same distance: the screen must NOT move.
  const ablate = await h.page.evaluate(() => {
    const H = window.__HARNESS, eng = window.__ENGINE;
    const step = (n) => { for (let i = 0; i < n; i++) { try { H.stepFrames(1); } catch (e) { /* */ } } };
    H.closeMenu(); step(2);
    eng.sim.discovery.suspend();
    for (const s of (eng.field.sites || []).slice(5, 7)) {
      try { H.teleport(s.x, s.z); step(20); } catch (e) { /* */ }
    }
    step(10);
    H.openMenu('map'); step(3);
    const r = { places: H.mapState().place_count, revealed: H.mapState().revealed_cells, suspended: H.mapState().suspended };
    eng.sim.discovery.resume();
    return r;
  });
  const shotC = decode(await h.h('screenshot'));
  fs.writeFileSync(path.join(RUN, 'consume-C-ablated.png'), PNG.sync.write(shotC));
  const d2 = diffPx(shotB, shotC);
  out.data.consumption_ablation = { ...ablate, differing_px_vs_B: d2 };
  push('F1b', 'ABLATION: with the model suspended the same walk moves NOTHING on the screen',
    ablate.revealed === more.revealed && d2 === 0,
    `suspended=${ablate.suspended}; revealed ${more.revealed} -> ${ablate.revealed}; ${d2} pixels changed. `
    + `Arm 1 moved ${d1} px, arm 2 moved ${d2} px — the two arms differ.`);

  // F2 — does ANYTHING outside the map screen read the footprint?
  const consumers = await h.page.evaluate(() => {
    const E = window.__ENGINE;
    return {
      travel_keeps_its_own_visited: !!(E.travel && E.travel.visited),
      travel_visited_legs: E.travel && E.travel.visited ? E.travel.visited.size : null,
      travel_walked_legs: E.travel && E.travel.walked ? E.travel.walked.size : null,
    };
  });
  out.data.consumers = consumers;
  push('F2', 'the discovery footprint has a consumer anywhere OUTSIDE the map screen',
    consumers.travel_keeps_its_own_visited === false,
    `no. The S7 travel network — the one other system in the build whose rule is "you must have `
    + `walked there once" — keeps its OWN record (${JSON.stringify(consumers)}), 25 m bins per leg, and `
    + `never reads Discovery. Two parallel implementations of "where the body has been" (RULES 10).`);

  // =========================================================================================
  // G — THE SIX SCREENS, PHOTOGRAPHED
  // =========================================================================================
  await h.page.evaluate(eval(`(${WALK})`));
  await h.h('setAtHearth', true); await h.h('stepFrames', 2);
  const SIX = ['inventory', 'journal', 'sheet', 'spells', 'map', 'levelup'];
  const stamp = '2026-08-08-w1-21-r2-critic';
  const shots = [];
  for (const s of SIX) {
    await h.h('closeMenu'); await h.h('stepFrames', 1);
    await h.h('openMenu', s); await h.h('stepFrames', 3);
    const got = (await h.h('getUIState')).mode;
    const png = decode(await h.h('screenshot'));
    const f = path.join(SHOTS, `${stamp}-${s}.png`);
    fs.writeFileSync(f, PNG.sync.write(png));
    let ink = 0;
    for (let i = 0; i < png.width * png.height; i++) { const o = i * 4; if (png.data[o] + png.data[o + 1] + png.data[o + 2] > 90) ink++; }
    shots.push({ screen: s, mode_reached: got, file: path.relative(REPO_ROOT, f), lit_px: ink, size: [png.width, png.height] });
    say(`  shot ${s}: mode=${got}, ${ink} lit px -> ${path.relative(REPO_ROOT, f)}`);
  }
  out.data.shots = shots;
  push('G1', 'all six screens photographed, each showing the screen it claims to show and not a blank frame',
    shots.every((s) => s.mode_reached === s.screen && s.lit_px > 10000),
    JSON.stringify(shots.map((s) => [s.screen, s.mode_reached, s.lit_px])));
} finally {
  out.loadavg_end = fs.readFileSync('/proc/loadavg', 'utf8').trim();
  out.console_errors = h.errors.slice(0, 20);
  await h.close();
}

out.pass = out.checks.filter((c) => c.result === 'pass').length;
out.fail = out.checks.filter((c) => c.result === 'fail').length;
writeJson(path.join(RUN, 'critic-w1-21-r2-b.json'), out);
say(`\n${out.pass} pass, ${out.fail} fail — ${path.join(RUN, 'critic-w1-21-r2-b.json')}`);
process.exit(out.fail ? 1 : 0);
