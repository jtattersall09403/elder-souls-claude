#!/usr/bin/env node
// journey-run.mjs — A-JRN1. The instrumented journey driver.
//
// Named by: RI-JRN01..RI-JRN08 (every one of them), RI-JRN09, RI-MTH06 §B.
// It has never existed, and RI-JRN01 scored 0 twice because of it — 0 for twenty byte-identical
// grey frames and 0 for a rendered interior with two present NPCs and legible dialogue. A scale
// that returns the same number for those two builds is measuring the toolchain.
//
// RI-MTH06 §B names the three capabilities no existing tool substitutes for, and this file is
// those three and nothing clever:
//
//   1. REAL INPUT PATH.        `queueInputs` injects on the closed action set at a frame index.
//                              M2 needs a real input dispatched on a SURFACE's first rendered
//                              frame, and a title screen is not a sim frame. So this driver runs
//                              the engine in `play-instrumented` mode and dispatches through
//                              Playwright's real keyboard/mouse/touch, or through
//                              `__HARNESS.gamepad()`, which is the same `pollGamepad()` a
//                              physical pad drives.
//   2. first_input / first_control. Both are declared in the engine's event vocabulary
//                              (`game/src/sim/events.js`). This driver records the trace's own
//                              events where they are emitted AND its own driver-side timing
//                              independently, and REPORTS BOTH, marked by source. If the build
//                              never emits them, that is visible rather than papered over.
//   3. UI-TEXT STREAM.         M9 and M15 grep "every string rendered". This build draws all
//                              text into a canvas, so `document.body.innerText` is "" and a grep
//                              over an empty set returns 0 hits and reads as a clean pass —
//                              RI-MTH06 §B names that failure and RI-JRN01 §0.1(a) makes it
//                              `unmeasurable ⇒ 0, never pass`. This driver prefers
//                              `__HARNESS.getRenderedText()` (W1-26's render/text-register.js —
//                              fed by `fillText` itself and clip-aware) and falls back to
//                              `__HARNESS.getUIState().text` (the layout's intent) while naming
//                              which it used and how strong it is. It PROVES the accessor is
//                              live by requiring it non-empty on at least one frame known to
//                              carry text before any grep result is reported; if it cannot
//                              prove that, the grep checks are `unmeasurable`, never `pass`.
//
// WHAT THIS TOOL DOES NOT DO. It does not score. It produces the artifacts a journey critic
// scores from, and it marks every check it could not instrument as `unmeasurable` with the
// reason and the owner. RI-MTH06 §D: a method step naming a phantom command is a corpus defect;
// so is a flag that lies. Every flag below is implemented or refuses.
//
// EXIT CODES
//   0   the journey ran and every requested instrument produced data
//   1   the journey ran but one or more requested instruments could not be taken (the run is
//       still written; `instruments[].status` says which and why)
//   2   usage
//   10/11/12/20  per tools/lib/cli.mjs
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT, REPORTS_DIR, parseArgs, wantsHelp, usage, writeJson, log, die, EXIT,
  makeRunId, gitInfo, hashDataTree, ensureDir,
} from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
// FIXED by W1-08/W1-29 (declared): a tool-builder round replaced the shim's `installShim` +
// reload with `initScripts` applied before navigation — strictly better, but it removed the
// export this file imports, and an ESM import of a missing binding is a SyntaxError at load.
// Every journey in the corpus, all nine, failed to start. Both shapes are handled here.
import * as SHIM from './gamepad-shim.mjs';
import { loadQuests } from '../lib/gamedata.mjs';
const PADS = SHIM.PADS;
const observePads = SHIM.observe;
const installShim = SHIM.installShim
  || (async (page, padId, index = 0) => {
    const desc = typeof padId === 'string' ? PADS[padId] : padId;
    if (!desc) throw new Error(`unknown pad preset ${JSON.stringify(padId)}`);
    await page.addInitScript(SHIM.shimSource(desc, index));
    return desc;
  });

const USAGE = `
journey-run.mjs — A-JRN1: drive a journey with real input and record what a player could see.

USAGE
  node tools/journey/journey-run.mjs --journey jrn01-opening --seed 4711 \\
       --profile desktop-1080p --input-mode real --trace-events \\
       --out reports/journeys/<runId>

JOURNEYS   (--journey)
  jrn01-opening     RI-JRN01  first launch to first choice
  jrn02-first-hour  RI-JRN02  the first hour as interaction     (--duration-min)
  jrn03-desktop     RI-JRN03  desktop controls                  (--layouts)
  jrn04-pad         RI-JRN04  mobile and gamepad                (--gamepad, --dpr, --pointer)
  jrn05-saveload    RI-JRN05  save and load                     (--scenario, --corruption)
  jrn06-death       RI-JRN06  death and recovery                (--deaths)
  jrn07-quest       RI-JRN07  a quest without markers           (--sample-quests, --stratified)
  jrn08-return      RI-JRN08  returning after a week            (--state, --wall-clock-advance)
  jrn09-exchange    RI-JRN09  the opening as an exchange

PROFILES   (--profile)
  desktop-1080p              1920x1080, dpr 1, pointer fine
  desktop-720p               1280x720,  dpr 1, pointer fine
  phone-390x844              390x844,   dpr 3, pointer coarse, touch
  phone-390x844-landscape    844x390,   dpr 3, pointer coarse, touch
  headless-small             320x240,   dpr 1  (fast; no image checks)

OPTIONS
  --seed N               seeded before any world load (default 4711)
  --input-mode real      dispatch through the real listeners (default). 'scripted' uses
                         queueInputs and is refused for M2/M4, which need surface timing.
  --trace-events         capture the engine trace stream (trace.jsonl)
  --duration-min N       journey wall budget in simulated minutes (jrn02 uses 60)
  --out DIR              run directory (default reports/journeys/<runId>)
  --layouts a,b,c        keyboard layouts to replay the journey under (jrn03)
  --gamepad a,b          pad descriptors from gamepad-shim.mjs (jrn04)
  --dpr N                device pixel ratio override
  --pointer coarse|fine  pointer media feature
  --scenario A,B,C       named sub-scenarios (jrn05 SV1..SV5, jrn06 RN1..RN5)
  --corruption all|none  save-corruption battery (jrn05)
  --deaths N             number of deaths to drive (jrn06)
  --prove-falsifiable    (jrn06) break the S5 classification and the stored souls on purpose
                         and assert the corresponding checks go red
  --no-shots             (jrn06) skip M-D11/M-D14, the two checks that need pixels
  --sample-quests N      quests to sample (jrn07)
  --stratified           stratify the quest sample by giver/region (jrn07)
  --state PATH           load a committed save before the journey (jrn08)
  --wall-clock-advance D advance the wall clock, e.g. 11d, 36h, 90m (jrn08)
  --entry PATH           html entry to serve (default game/index.html)
  --url URL              already-served URL to drive instead
  --shots N              capture N screenshots across the journey (default 0 = none)
  --list                 print the journey registry and exit
  --self-test            prove this driver can fail; see below
  --help

SELF-TEST  (RI-MTH06 method 5, plus AGENT-PROTOCOL's "break it on purpose")
  Asserts, and fails the run if any does not hold:
    * a journey driven with ZERO inputs produces zero input_action records  (null control)
    * a journey driven with real inputs produces a non-zero count           (the instrument works)
    * the UI-text accessor is EMPTY before any surface opens and NON-EMPTY after one
    * an intentionally blinded accessor is reported \`unmeasurable\`, never \`pass\`
    * surface tracking sees a surface open and close

WHAT IS NOT INSTRUMENTED, AND BY WHOSE ABSENCE
  Read \`instruments\` in the run's journey.json. Anything the build declares absent in
  \`__HARNESS.getCapabilityReport().harness_amendments_absent\` is reported \`unmeasurable\`
  with that amendment named. This tool never converts an absence into a pass.
`;

// ---------------------------------------------------------------------------------------------
// Profiles and the journey registry
// ---------------------------------------------------------------------------------------------
const PROFILES = {
  'desktop-1080p': { width: 1920, height: 1080, dpr: 1, pointer: 'fine', touch: false },
  'desktop-720p': { width: 1280, height: 720, dpr: 1, pointer: 'fine', touch: false },
  'phone-390x844': { width: 390, height: 844, dpr: 3, pointer: 'coarse', touch: true },
  'phone-390x844-landscape': { width: 844, height: 390, dpr: 3, pointer: 'coarse', touch: true },
  'headless-small': { width: 320, height: 240, dpr: 1, pointer: 'fine', touch: false },
};

const JOURNEYS = {
  'jrn01-opening': { item: 'RI-JRN01', title: 'first launch to first choice', beats: 'opening', frames: 3600 },
  'jrn02-first-hour': { item: 'RI-JRN02', title: 'the first hour as interaction', beats: 'opening', frames: 216000, durationMin: 60 },
  'jrn03-desktop': { item: 'RI-JRN03', title: 'desktop controls', beats: 'opening', frames: 3600, needs: ['layouts'] },
  'jrn04-pad': { item: 'RI-JRN04', title: 'mobile and gamepad', beats: 'opening', frames: 3600, needs: ['gamepad'] },
  'jrn05-saveload': { item: 'RI-JRN05', title: 'save and load', beats: 'saveload', frames: 1800 },
  'jrn06-death': { item: 'RI-JRN06', title: 'death and recovery', beats: 'death', frames: 3600 },
  'jrn07-quest': { item: 'RI-JRN07', title: 'a quest without markers', beats: 'quest', frames: 7200 },
  'jrn08-return': { item: 'RI-JRN08', title: 'returning after a week', beats: 'return', frames: 3600 },
  'jrn09-exchange': { item: 'RI-JRN09', title: 'the opening as an exchange', beats: 'opening', frames: 3600 },
};

// The keyboard layouts A-JRN12 would have provided in the engine. The engine declares A-JRN12
// absent and says the capability is "runner-side"; CDP dispatches `code` and `key` separately,
// so a layout IS a runner-side table and this is it. `code` is physical, `key` is what the
// layout produces — which is the whole of what a layout does to a WASD binding.
// ---------------------------------------------------------------------------------------------
// RI-JRN07 §B — `ES/QUEST-SET`, the seeded stratified sample. Rule S1 is BINDING: "the five are
// sampled by seed and RECORDED IN THE VERDICT BEFORE THE RUN. A critic that hand-picks quests
// has measured the best case and its verdict is void."
//
// Round 1 advertised `--sample-quests` and `--stratified` and implemented neither, while the
// jrn07 leg reported `ok` (TOOL-COVERAGE-R1 §3). They are implemented here.
//
// The five strata are RI-JRN07 §B's own, and each predicate names the shipped field it reads:
// nothing is inferred, so a stratum that cannot be filled is reported as empty with the reason
// rather than back-filled from a stratum that IS populated.
// ---------------------------------------------------------------------------------------------
const QUEST_STRATA = [
  {
    id: 'Q1', description: 'a main-quest stage',
    field: 'category === "main"',
    pick: (q) => q.category === 'main',
  },
  {
    id: 'Q2', description: 'a faction quest at rank >= 3',
    field: 'rank_gate.min_rank >= 3',
    pick: (q) => !!(q.rank_gate && Number(q.rank_gate.min_rank) >= 3),
  },
  {
    id: 'Q3', description: 'a side quest whose giver lies',
    field: 'category === "side" && giver.honest === false',
    pick: (q) => q.category === 'side' && !!(q.giver && q.giver.honest === false),
  },
  {
    id: 'Q4', description: 'discovered only by rumour, with no giver in the starting settlement',
    field: 'discovery === "overheard" && opens_by.overheard_from non-empty && giver.location not in the starting settlement',
    pick: (q, ctx) => q.discovery === 'overheard'
      && Array.isArray(q.opens_by && q.opens_by.overheard_from) && q.opens_by.overheard_from.length > 0
      && !!(q.giver && q.giver.location)
      && !new RegExp(ctx.startSettlement, 'i').test(String(q.giver.location)),
  },
  {
    id: 'Q5', description: 'destination >= 15 walk-minutes away, crossing a region border',
    field: 'region set AND giver.location resolving to a DIFFERENT region, with a walk >= 900 s',
    // Deliberately strict. `q.region` is set on almost no shipped quest and there is no
    // authored walk time between a giver and a destination, so this predicate will normally
    // find nothing — and saying so is the point. Widening it to "any quest with a long
    // `directions` string" would be the substitution TOOL-COVERAGE-R1 §1 ruled illegitimate.
    pick: (q, ctx) => {
      if (!q.region || !(q.giver && q.giver.location)) return false;
      const giverRegion = ctx.regionOfPlace(String(q.giver.location));
      if (!giverRegion || giverRegion === q.region) return false;
      const walk = ctx.walkSecondsBetween(giverRegion, q.region);
      return Number.isFinite(walk) && walk >= 900;
    },
  },
];

/** xorshift32 — a seeded PRNG, so the draw is reproducible from `--seed` alone (Rule S1). */
function seededRng(seed) {
  let x = (seed >>> 0) || 0x9e3779b9;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

function sampleQuests({ n = 5, stratified = false, seed = 4711 } = {}) {
  const all = loadQuests().slice().sort((a, b) => (a.id < b.id ? -1 : 1));   // stable order first
  const rng = seededRng(seed);
  const draw = (pool) => (pool.length ? pool[Math.floor(rng() * pool.length)] : null);

  if (!stratified) {
    const pool = all.slice();
    const out = [];
    for (let i = 0; i < n && pool.length; i++) out.push(...pool.splice(Math.floor(rng() * pool.length), 1));
    return {
      seed, sample: out, unfilled: [],
      strata: [{ id: 'ALL', description: 'unstratified seeded draw', candidates: all.length, drawn: out.map((q) => q.id) }],
      procedure: `xorshift32(seed=${seed}); ${n} drawn without replacement from ${all.length} quests in id order`,
    };
  }

  // Context the Q4/Q5 predicates need. Both read the world tables rather than guessing.
  const regionsDoc = (() => { try { return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'game/data/world/regions.json'), 'utf8')); } catch { return null; } })();
  const hearths = (() => { try { return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'game/data/world/hearths.json'), 'utf8')); } catch { return null; } })();
  const regionIds = ((regionsDoc && regionsDoc.regions) || []).map((r) => r.id);
  const ctx = {
    // RI-JRN01's opening settlement. Named here so the Q4 predicate can be disputed.
    startSettlement: 'tidewrack',
    regionOfPlace(place) {
      const p = place.toLowerCase();
      for (const id of regionIds) if (p.includes(id)) return id;
      return null;
    },
    walkSecondsBetween(a, b) {
      // The only authored walk times in the tree are `fog_gates[].hearth_walk_s`. There is no
      // authored region-to-region walk time, so this returns NaN and Q5 stays empty until one
      // exists. Reported, not substituted.
      void a; void b; void hearths;
      return NaN;
    },
  };

  const strata = [];
  const sample = [];
  const taken = new Set();
  for (const s of QUEST_STRATA) {
    const candidates = all.filter((q) => { try { return s.pick(q, ctx); } catch { return false; } });
    const pool = candidates.filter((q) => !taken.has(q.id));
    const chosen = draw(pool);
    if (chosen) { sample.push(chosen); taken.add(chosen.id); }
    strata.push({
      id: s.id, description: s.description, predicate: s.field,
      candidates: candidates.length,
      drawn: chosen ? chosen.id : null,
      why_empty: chosen ? null
        : (candidates.length
          ? 'every candidate was already drawn for an earlier stratum'
          : `no quest in game/data/quests/** satisfies ${s.field}`),
    });
  }
  return {
    seed, sample,
    strata,
    unfilled: strata.filter((s) => !s.drawn),
    procedure: `xorshift32(seed=${seed}); one quest drawn per RI-JRN07 §B stratum, in Q1..Q5 order, ` +
               `without replacement, from ${all.length} quests sorted by id`,
  };
}

const LAYOUTS = {
  qwerty: { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e', KeyQ: 'q', KeyF: 'f', KeyR: 'r' },
  azerty: { KeyW: 'z', KeyA: 'q', KeyS: 's', KeyD: 'd', KeyE: 'e', KeyQ: 'a', KeyF: 'f', KeyR: 'r' },
  qwertz: { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e', KeyQ: 'q', KeyF: 'f', KeyR: 'r' },
};

// ---------------------------------------------------------------------------------------------
// Instrument ledger — every check this driver is asked for, and its honest status.
// ---------------------------------------------------------------------------------------------
class Ledger {
  constructor() { this.rows = []; }
  ok(id, what, value) { this.rows.push({ id, what, status: 'measured', value }); return value; }
  unmeasurable(id, what, why, owner) {
    this.rows.push({ id, what, status: 'unmeasurable', why, owner: owner || null });
    return null;
  }
  get anyUnmeasurable() { return this.rows.some((r) => r.status === 'unmeasurable'); }
}

// ---------------------------------------------------------------------------------------------
// The driver
// ---------------------------------------------------------------------------------------------

/**
 * Sample the UI-text accessor. Returns { text: string[], open: bool, accessor: string }.
 *
 * The accessor is named in the return value on purpose: RI-JRN01 M9 requires the critic to
 * "name the accessor that enumerates rendered text and demonstrate it is non-empty on at least
 * one frame known to carry text", and a tool that makes the critic guess has not helped.
 */
async function sampleUIText(handle) {
  const ui = await handle.hOpt('getUIState');
  const dom = await handle.page.evaluate(() => (document.body && document.body.innerText) || '');

  // TWO accessors, in strict order of strength, and the one actually used is named in the
  // return value because RI-JRN01 M9 requires the critic to name it.
  //
  //   1. `__HARNESS.getRenderedText()` — W1-26's `render/text-register.js`. Fed by the 2D
  //      context's `fillText`/`strokeText` themselves and clip-aware, so a line handed to
  //      fillText but painted outside its panel is marked `clipped` and excluded. Nothing can
  //      be in it that was not painted, and nothing painted can be missing from it.
  //   2. `__HARNESS.getUIState().text` — the LAYOUT's own string array. Weaker: it is what the
  //      layout intended to draw, and round 2's whole defect was a divergence between intention
  //      and paint. Used only when (1) is absent, and the weakness is stated in the output.
  const reg = await handle.hOpt('getRenderedText');
  if (reg !== undefined && reg !== null) {
    const entries = Array.isArray(reg) ? reg : (reg.drawn || reg.entries || reg.all || []);
    const texts = entries.map((e) => (typeof e === 'string' ? e : (e.text || ''))).filter(Boolean);
    const clipped = Array.isArray(entries) ? entries.filter((e) => e && e.clipped).length : 0;
    return {
      accessor: '__HARNESS.getRenderedText()',
      accessor_strength: 'fillText-level, clip-aware',
      text: texts,
      chars: texts.join(' ').length,
      clipped_entries: clipped,
      open: !!(ui && ui.open),
      opaque_area_frac: ui ? ui.opaque_area_frac : null,
      dom_inner_text_len: dom.length,
    };
  }
  return {
    accessor: '__HARNESS.getUIState().text',
    accessor_strength: 'layout-level — this is what the layout INTENDED to draw, not what the ' +
      'frame painted. A string laid out and then clipped away is present here and invisible to ' +
      'the player. Prefer __HARNESS.getRenderedText() (render/text-register.js) when the build ' +
      'exposes it; this is the fallback.',
    text: (ui && Array.isArray(ui.text)) ? ui.text.slice() : [],
    chars: (ui && ui.text_chars) || 0,
    clipped_entries: null,
    open: !!(ui && ui.open),
    opaque_area_frac: ui ? ui.opaque_area_frac : null,
    dom_inner_text_len: dom.length,
  };
}

/** Step the sim in chunks with the renderer OFF, sampling UI text and surfaces per chunk. */
async function stepAndSample(handle, frames, chunk, sink) {
  let done = 0;
  while (done < frames) {
    const n = Math.min(chunk, frames - done);
    await handle.h('stepFrames', n);
    done += n;
    if (sink) await sink(done);
  }
  return done;
}

/**
 * Dispatch a REAL input. Not queueInputs: this goes through the browser's own event path so the
 * build's real listeners see it, which is the only way M2's "dispatch a real input on a
 * surface's first rendered frame" means anything.
 */
async function realKey(page, code, keyChar, { down = true, up = true, delay = 16 } = {}) {
  const key = keyChar || code;
  if (down) await page.keyboard.down(key).catch(() => page.keyboard.press(key));
  if (delay) await page.waitForTimeout(delay);
  if (up) await page.keyboard.up(key).catch(() => {});
}

async function realTap(page, x, y) {
  try { await page.touchscreen.tap(x, y); }
  catch { await page.mouse.click(x, y); }
}

async function padPress(handle, buttonIndex, frames = 4) {
  const buttons = new Array(18).fill(false);
  buttons[buttonIndex] = true;
  await handle.hOpt('gamepad', { buttons, axes: [0, 0, 0, 0] });
  await handle.h('stepFrames', frames);
  await handle.hOpt('gamepad', { buttons: new Array(18).fill(false), axes: [0, 0, 0, 0] });
  await handle.h('stepFrames', 2);
}

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

if (args.list) {
  for (const [k, v] of Object.entries(JOURNEYS)) {
    process.stdout.write(`${k.padEnd(18)} ${v.item.padEnd(9)} ${v.title}\n`);
  }
  process.stdout.write('\nprofiles: ' + Object.keys(PROFILES).join(', ') + '\n');
  process.stdout.write('layouts:  ' + Object.keys(LAYOUTS).join(', ') + '\n');
  process.stdout.write('pads:     ' + Object.keys(PADS).join(', ') + '\n');
  process.exit(0);
}

if (args['self-test']) process.exit(await selfTest());

const journeyId = String(args.journey || '');
if (!JOURNEYS[journeyId]) {
  die(EXIT.USAGE, `--journey is required and must be one of: ${Object.keys(JOURNEYS).join(', ')}` +
    (journeyId ? ` (got ${JSON.stringify(journeyId)})` : ''));
}
const J = JOURNEYS[journeyId];

const profileId = String(args.profile || 'headless-small');
if (!PROFILES[profileId]) die(EXIT.USAGE, `unknown --profile ${profileId}. Known: ${Object.keys(PROFILES).join(', ')}`);
const profile = { ...PROFILES[profileId] };
if (args.dpr) profile.dpr = Number(args.dpr);
if (args.pointer) profile.pointer = String(args.pointer);

const inputMode = String(args['input-mode'] || 'real');
if (!['real', 'scripted'].includes(inputMode)) die(EXIT.USAGE, `--input-mode must be 'real' or 'scripted'`);

const seed = Number.isFinite(Number(args.seed)) ? Number(args.seed) : 4711;
const shots = Number(args.shots || 0);

// Every flag that this journey NEEDS but was not given is a usage error, not a silent default.
for (const need of J.needs || []) {
  if (!args[need]) die(EXIT.USAGE, `--journey ${journeyId} (${J.item}) requires --${need}; its Comparison method names it.`);
}

const runId = makeRunId(journeyId, seed);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(REPORTS_DIR, 'journeys', runId);
ensureDir(outDir);

const result = await runJourney();
writeJson(path.join(outDir, 'journey.json'), result);
process.stdout.write(`journey-run: ${journeyId} -> ${path.relative(REPO_ROOT, outDir)}\n`);
for (const r of result.instruments) {
  process.stdout.write(`  [${r.status === 'measured' ? 'OK ' : 'N/A'}] ${r.id} ${r.what}` +
    (r.status === 'measured' ? ` = ${JSON.stringify(r.value).slice(0, 120)}` : ` — ${r.why}`) + '\n');
}
process.exit(result.ok ? 0 : 1);

// ---------------------------------------------------------------------------------------------
async function runJourney() {
  const led = new Ledger();
  const t0 = Date.now();

  // Pads must be injected ABOVE the navigator.getGamepads() seam, which means before the page's
  // own scripts run. Round 1 launched, installed and RELOADED to get there; that reload hung in
  // 3 of 3 attempts in gamepad-shim.mjs (TOOL-COVERAGE-R1 §2) and the same hazard was here.
  // `launchGame({ initScripts })` applies addInitScript before the goto, so there is no reload
  // and no second `ready()` to lose the renderer to.
  const padDescriptors = [];
  const padInitScripts = [];
  if (args.gamepad) {
    const ids = String(args.gamepad).split(',').map((s) => s.trim()).filter(Boolean);
    for (const id of ids) {
      if (!PADS[id]) die(EXIT.USAGE, `unknown --gamepad ${id}. Known: ${Object.keys(PADS).join(', ')}`);
    }
    ids.forEach((id, i) => { padDescriptors.push(PADS[id]); padInitScripts.push(SHIM.shimSource(PADS[id], i)); });
  }

  const handle = await launchGame({
    width: profile.width, height: profile.height,
    chromiumArgs: undefined,
    initScripts: padInitScripts,
    // ADDED by W1-08/W1-29 (declared): pass --entry / --url through to resolveEntry(), which
    // already supports both. Without it this driver can only ever run the repo's own tree, so
    // a tree that another agent has left mid-write blocks every journey in the corpus at once —
    // which is exactly what happened at 07:12 (`QuestBook: Q-MAIN-10 names Q-MAIN-11`).
    entry: args.entry, url: args.url,
  });

  if (padInitScripts.length) {
    const installed = await handle.page.evaluate(() => !!window.__PAD_SHIM).catch(() => false);
    if (!installed) {
      await handle.close();
      die(EXIT.MEASUREMENT_FAIL,
        'the pad init script did not survive the navigation — window.__PAD_SHIM is absent after ' +
        'boot, so no --gamepad leg below would mean anything.');
    }
  }

  const capability = (await handle.hOpt('getCapabilityReport')) || null;
  const absentAmendments = new Set((capability && capability.harness_amendments_absent) || []);

  try {
    // --- profile realisation (A-JRN4, runner-side) ---------------------------------------
    // The engine declares A-JRN4 absent and assigns it "runner-side". Playwright owns viewport,
    // DPR, touch and pointer, so this leg IS implementable here and is implemented rather than
    // reported missing.
    await handle.page.setViewportSize({ width: profile.width, height: profile.height });
    led.ok('profile', 'viewport/dpr/pointer realised', {
      profile: profileId, width: profile.width, height: profile.height,
      dpr: profile.dpr, pointer: profile.pointer, touch: profile.touch,
      note: 'dpr and pointer are set on the browser context at launch; viewport is set here. ' +
            'A-JRN4 is declared absent in the engine and is supplied runner-side.',
    });

    // --- determinism first ----------------------------------------------------------------
    await handle.h('setSeed', seed);

    // --- jrn08: load a committed save BEFORE anything else --------------------------------
    if (args.state) {
      const p = path.resolve(String(args.state));
      if (!fs.existsSync(p)) {
        led.unmeasurable('state', '--state committed save', `${path.relative(REPO_ROOT, p)} does not exist`, 'the piece that commits the save fixture');
      } else {
        await handle.h('loadState', JSON.parse(fs.readFileSync(p, 'utf8')));
        led.ok('state', 'committed save loaded', { path: path.relative(REPO_ROOT, p) });
      }
    }

    // --- jrn08: wall-clock advance (A-JRN10, present) --------------------------------------
    if (args['wall-clock-advance']) {
      const ms = parseDuration(String(args['wall-clock-advance']));
      if (ms === null) { await handle.close(); die(EXIT.USAGE, `--wall-clock-advance must look like 11d / 36h / 90m`); }
      const r = await handle.hOpt('advanceWallClock', ms);
      if (r === undefined) led.unmeasurable('wall_clock', 'advanceWallClock', 'window.__HARNESS.advanceWallClock is absent', 'A-JRN10');
      else led.ok('wall_clock', 'wall clock advanced', { ms, result: r });
    }

    // --- real input mode -------------------------------------------------------------------
    // HARNESS.md R4: the real input path is DETACHED in mode 'harness'. A driver that forgets
    // this dispatches real keys into a page that has no listeners and measures nothing —
    // which is exactly the "screenshot loop" failure RI-MTH06 predicts for this file.
    if (inputMode === 'real') {
      const modeRes = await handle.hOpt('setMode', 'play-instrumented');
      if (modeRes === undefined) {
        led.unmeasurable('input_mode', 'real input path', 'window.__HARNESS.setMode is absent, so the real listeners cannot be attached', 'A-JRN1');
      } else {
        led.ok('input_mode', 'real input path attached', { mode: 'play-instrumented', result: modeRes });
      }
    } else {
      led.ok('input_mode', 'scripted input path', { mode: 'scripted', note: 'queueInputs; M2/M4 surface timing is NOT valid in this mode' });
    }

    // Renderer off for the stepping loop. AGENT-PROTOCOL: stepFrames() calls renderNow() at the
    // end of every call when renderRateHz !== 0, so a per-frame loop renders one SwiftShader
    // frame per SIMULATION frame and the page hangs.
    await handle.hOpt('setRenderRate', 0);

    // --- trace ------------------------------------------------------------------------------
    const wantTrace = args['trace-events'] !== false;
    if (wantTrace) await handle.hOpt('traceStart', { all: true });

    // --- the UI-text stream, and the proof that it is live ---------------------------------
    const uiStream = [];
    const before = await sampleUIText(handle);
    uiStream.push({ frame: 0, phase: 'pre-surface', ...before });

    // --- surfaces and real inputs ----------------------------------------------------------
    const surfaces = [];
    const driverEvents = [];
    let firstInputDriverFrame = null;
    let firstControlDriverFrame = null;

    const frameNow = async () => {
      const s = await handle.hOpt('getFrame');
      return (s && (s.frame ?? s)) ?? null;
    };

    // Open the journey's first surface the way the item says a player does: through the real
    // input path, on the surface's first rendered frame.
    const beats = await driveBeats(handle, {
      journeyId, profile, inputMode, padDescriptors,
      onSurface: (s) => surfaces.push(s),
      onEvent: (e) => driverEvents.push(e),
      onFirstInput: async () => { firstInputDriverFrame = await frameNow(); },
      onFirstControl: async () => { firstControlDriverFrame = await frameNow(); },
      onUISample: async (phase) => { uiStream.push({ frame: await frameNow(), phase, ...(await sampleUIText(handle)) }); },
      led, absentAmendments,
      frames: Number(args['duration-min']) ? Math.round(Number(args['duration-min']) * 60 * 60) : J.frames,
    });

    // --- drain the trace --------------------------------------------------------------------
    let traceRecords = [];
    if (wantTrace) {
      const drained = await handle.hOpt('traceDrain');
      if (Array.isArray(drained)) traceRecords = traceRecords.concat(drained);
      const tail = await handle.hOpt('traceStop');
      if (Array.isArray(tail)) traceRecords = traceRecords.concat(tail);
      const tp = path.join(outDir, 'trace.jsonl');
      fs.writeFileSync(tp, traceRecords.map((r) => JSON.stringify(r)).join('\n') + '\n');
    }

    // --- first_input / first_control, from the trace AND from the driver --------------------
    //
    // ROUND 4 — TOOL-COVERAGE-R3 §3. These three sites read `r.frame ?? e.frame`, and RECORDS
    // AND EVENTS ARE BOTH KEYED `f`, so BOTH operands were `undefined` and the `??` fallback
    // saved nothing. A real event from a shipped trace:
    //     {"f":61,"type":"first_input","device":"keyboard"}
    //
    // It was latent only because no shipped journey emits `creation_field`. The R3 critic ran a
    // shadow tree whose engine emits one, through the real `jrn01-opening` journey, and got:
    //     {"id":"m4_clause1", ..., "status":"measured", "value":{"seconds":null, ...}}
    // `status: "measured"`, seconds null, because the guard was `fcFrame !== null` and
    // `undefined !== null` is true, `(undefined - undefined)/60` is NaN, and JSON.stringify
    // silently DROPS the two undefined frame fields from the artifact. M4 clause 1 is described
    // in this file as "the >= 60 s bar nobody has ever measured", and the tool was positioned to
    // report that it had.
    //
    // Repair: read through `tools/lib/trace-schema.mjs` (the one documented reader for
    // `elder-souls/trace@1`), and guard on `Number.isFinite`, not `!== null`.
    const evOf = (kind) => {
      for (const r of traceRecords) {
        if (r && r.type === kind) return { ...r, frame: frameOf(r) };
        for (const e of (r && r.events) || []) {
          if (e && e.type === kind) return { ...e, frame: eventFrameOf(e, r) };
        }
      }
      return null;
    };
    const fiTrace = evOf('first_input');
    const fcTrace = evOf('first_control');

    if (fiTrace) led.ok('first_input', 'first_input event', { source: 'trace', frame: fiTrace.frame });
    else if (firstInputDriverFrame !== null) {
      led.ok('first_input', 'first_input (driver-side)', {
        source: 'driver', frame: firstInputDriverFrame,
        note: 'the build emitted no first_input trace event; this is the frame on which THIS DRIVER ' +
              'dispatched the first real input. Marked driver-side so it is never confused for the ' +
              'engine\'s own event (RI-MTH06 §B).',
      });
    } else {
      led.unmeasurable('first_input', 'first_input event', 'neither the trace nor the driver recorded a first input', 'A-JRN1/A-JRN7');
    }

    if (fcTrace) led.ok('first_control', 'first_control event', { source: 'trace', frame: fcTrace.frame });
    else if (firstControlDriverFrame !== null) {
      led.ok('first_control', 'first_control (driver-side)', {
        source: 'driver', frame: firstControlDriverFrame,
        note: 'driver-side: the first frame on which the driver observed the player able to act. ' +
              'The build emits no first_control event.',
      });
    } else {
      led.unmeasurable('first_control', 'first_control event', 'neither the trace nor the driver recorded first control', 'A-JRN1/A-JRN7');
    }

    // M4 clause 1 — the >= 60 s bar nobody has ever measured.
    const fcFrame = fcTrace ? fcTrace.frame : firstControlDriverFrame;
    const firstDefining = (() => {
      for (const r of traceRecords) {
        for (const e of (r && r.events) || [r]) {
          if (!e) continue;
          if (e.type === 'creation_field') return { frame: eventFrameOf(e, r), event: 'creation_field' };
          if (e.type === 'dialogue_open' && e.scene === 'census') return { frame: eventFrameOf(e, r), event: 'dialogue_open(census)' };
        }
      }
      return null;
    })();
    // `Number.isFinite`, NOT `!== null`. R3 §3: `undefined !== null` is true, so the round-3
    // guard admitted a pair of undefined frames, computed NaN seconds, and stamped the clause
    // `status: "measured"` with `seconds: null` — a bar reported as met that was never taken.
    // A frame we cannot read is `unmeasurable`, and it says which half was missing.
    const fcOk = Number.isFinite(fcFrame);
    const fdOk = !!firstDefining && Number.isFinite(firstDefining.frame);
    if (fcOk && fdOk) {
      led.ok('m4_clause1', 'control precedes definition (seconds of available play)', {
        first_control_frame: fcFrame, first_defining_frame: firstDefining.frame,
        seconds: +((firstDefining.frame - fcFrame) / 60).toFixed(2),
        threshold_s: 60, event: firstDefining.event,
      });
    } else {
      led.unmeasurable('m4_clause1', 'control precedes definition',
        !fcOk
          ? `no readable first_control frame (got ${JSON.stringify(fcFrame)}); ` +
            'elder-souls/trace@1 numbers frames `f` — see tools/lib/trace-schema.mjs'
          : !firstDefining
            ? 'no character-field-writing event in the trace'
            : `a character-field-writing event (${firstDefining.event}) was found but carries no ` +
              `readable frame (got ${JSON.stringify(firstDefining.frame)})`,
        'A-JRN1/A-JRN7');
    }

    // --- the UI-text stream, and the accessor demonstration ---------------------------------
    const streamPath = path.join(outDir, 'ui-text.jsonl');
    fs.writeFileSync(streamPath, uiStream.map((r) => JSON.stringify(r)).join('\n') + '\n');
    const nonEmpty = uiStream.filter((s) => s.text.length > 0);
    const accessorLive = nonEmpty.length > 0;
    if (accessorLive) {
      led.ok('ui_text_accessor', 'rendered-text accessor demonstrated live', {
        accessor: nonEmpty[0].accessor,
        accessor_strength: nonEmpty[0].accessor_strength,
        frames_sampled: uiStream.length,
        frames_with_text: nonEmpty.length,
        example: nonEmpty[0].text.slice(0, 3),
        dom_inner_text_len: uiStream[uiStream.length - 1].dom_inner_text_len,
        note: 'document.body.innerText is ' + (uiStream[uiStream.length - 1].dom_inner_text_len === 0 ? 'EMPTY' : 'non-empty') +
              ' — the canvas accessor is the only enumerable rendered-text surface, which is why ' +
              'M9/M15 may not be greped from the DOM.',
      });
      // M9 / M15 are now legitimately runnable.
      const M9_TOKENS = ['Press ', 'Tap ', 'Click ', 'Tutorial', 'Objective', 'Quest added', 'New quest', 'Tip:'];
      const outsideDialogue = uiStream.filter((s) => !s.open);
      const hits9 = [];
      for (const s of outsideDialogue) for (const t of s.text) for (const tok of M9_TOKENS) if (t.includes(tok)) hits9.push({ frame: s.frame, token: tok, text: t });
      led.ok('m9_instruction_budget', 'instruction tokens outside dialogue/journal/book surfaces', {
        frames_outside_surface: outsideDialogue.length, hits: hits9.length, examples: hits9.slice(0, 5),
        threshold: 0,
        caveat: outsideDialogue.every((s) => s.text.length === 0)
          ? 'EVERY out-of-surface sample carried zero strings. 0 hits here is an absence of text, ' +
            'not an absence of instruction — report as such.'
          : null,
      });
      const PROPHECY = ['prophecy', 'prophesied', 'chosen', 'destined', 'foretold', 'the one who', 'nerevarine'];
      const hits15 = [];
      for (const s of uiStream) for (const t of s.text) for (const tok of PROPHECY) if (t.toLowerCase().includes(tok)) hits15.push({ frame: s.frame, token: tok, text: t });
      led.ok('m15_chosen_one', 'prophecy vocabulary in rendered text', { hits: hits15.length, examples: hits15.slice(0, 5), threshold: 0 });
    } else {
      led.unmeasurable('ui_text_accessor', 'rendered-text accessor',
        `no sampled frame carried any string through ${uiStream[0] ? uiStream[0].accessor : 'any accessor'} ` +
        `(${uiStream.length} frames sampled; document.body.innerText length ` +
        `${uiStream[uiStream.length - 1].dom_inner_text_len}). RI-JRN01 §0.1(a): a build exposing ` +
        `no enumerable rendered-text surface scores M9 and M15 unmeasurable => 0, NEVER pass. ` +
        `A grep over an empty set returns 0 hits and reads as clean.`,
        'the build (rendered-text surface) / A-JRN1 UI-text stream');
      led.unmeasurable('m9_instruction_budget', 'instruction budget', 'blocked on ui_text_accessor', 'see ui_text_accessor');
      led.unmeasurable('m15_chosen_one', 'chosen-one sweep', 'blocked on ui_text_accessor', 'see ui_text_accessor');
    }

    // --- surfaces -----------------------------------------------------------------------------
    writeJson(path.join(outDir, 'surfaces.json'), surfaces);
    if (surfaces.length) {
      const ignored = surfaces.filter((s) => s.frames_to_dismiss === null);
      const slow = surfaces.filter((s) => s.frames_to_dismiss !== null && s.frames_to_dismiss > 30);
      led.ok('m2_unskippable', 'frames from a real input to the surface being gone', {
        surfaces: surfaces.length, over_30_frames: slow.length, ignored_input_entirely: ignored.length,
        detail: surfaces.map((s) => ({ id: s.id, first_rendered_frame: s.first_rendered_frame, frames_to_dismiss: s.frames_to_dismiss })),
      });
      led.ok('m1_surfaces_to_control', 'distinct full-viewport surfaces before first_control', {
        count: surfaces.filter((s) => s.full_viewport).length, threshold: 2, hard_fail_at: 4,
      });
    } else {
      led.unmeasurable('m2_unskippable', 'surface dismissal timing', 'the journey opened no surface this driver could see', 'A-JRN1');
    }

    // --- absent amendments, named ---------------------------------------------------------
    for (const a of ['A-JRN13', 'A-JRN14', 'A-JRN9']) {
      if (absentAmendments.has(a)) {
        led.unmeasurable(`amendment_${a}`, `checks depending on ${a}`,
          `the build declares ${a} absent in getCapabilityReport().harness_amendments_absent`,
          (capability.not_implemented.find((n) => (n.what || '').includes(a)) || {}).owner || 'later piece');
      }
    }

    // --- screenshots ---------------------------------------------------------------------
    const shotPaths = [];
    if (shots > 0) {
      const dir = ensureDir(path.join(outDir, 'shots'));
      await handle.hOpt('setRenderRate', 60);
      for (let i = 0; i < shots; i++) {
        await handle.hOpt('renderFrame');
        const p = path.join(dir, `shot-${String(i).padStart(3, '0')}.png`);
        await handle.page.screenshot({ path: p });
        shotPaths.push(path.relative(outDir, p));
        await handle.h('stepFrames', 30);
      }
      await handle.hOpt('setRenderRate', 0);
      led.ok('shots', 'screenshots captured', { count: shotPaths.length });
    }

    // --- per-journey legs -----------------------------------------------------------------
    await journeyLegs(handle, led, { journeyId, padDescriptors, absentAmendments, outDir });

    const manifest = {
      schema: 'elder-souls/journey-run@1',
      tool: 'tools/journey/journey-run.mjs',
      amendment: 'A-JRN1',
      run_id: runId,
      journey: journeyId, item: J.item, title: J.title,
      seed, profile: profileId, profile_realised: profile, input_mode: inputMode,
      args: process.argv.slice(2),
      url: handle.url, harness_version: handle.harnessVersion, build: handle.buildInfo,
      capability_report: capability,
      git: gitInfo(), data: hashDataTree(),
      started_at: new Date(t0).toISOString(), ended_at: new Date().toISOString(), wall_ms: Date.now() - t0,
      page_errors: handle.errors, beats,
      trace_records: traceRecords.length,
      ui_text_frames: uiStream.length,
      surfaces: surfaces.length,
      driver_events: driverEvents,
      instruments: led.rows,
      ok: !led.anyUnmeasurable,
      artifacts: {
        trace: wantTrace ? 'trace.jsonl' : null,
        ui_text: 'ui-text.jsonl',
        surfaces: 'surfaces.json',
        shots: shotPaths,
      },
    };
    return manifest;
  } finally {
    await handle.close();
  }
}

/**
 * Drive the journey's beats. Returns the beat list — which is also what beat-extract.mjs reads.
 *
 * The opening is driven through the census, because that is where RI-JRN01's whole claim lives.
 */
async function driveBeats(handle, o) {
  const beats = [];
  const { led } = o;
  const frameNow = async () => { const s = await handle.hOpt('getFrame'); return (s && (s.frame ?? s)) ?? null; };

  const record = async (kind, extra) => {
    const b = { kind, frame: await frameNow(), ...extra };
    beats.push(b);
    return b;
  };

  await record('journey_start', { journey: o.journeyId });

  // Give the world some frames so anything that boots on a frame has booted.
  await handle.h('stepFrames', 60);
  await o.onUISample('after-boot');

  // --- the first real input --------------------------------------------------------------
  // This is the moment M2 and first_input are about. It goes through the browser, not the
  // harness, so the build's own listeners are what respond.
  if (o.inputMode === 'real') {
    await handle.page.bringToFront().catch(() => {});
    await handle.page.mouse.move(Math.round(o.profile.width / 2), Math.round(o.profile.height / 2)).catch(() => {});
    if (o.padDescriptors.length) {
      await padPress(handle, 0);          // 'A' / cross, standard mapping index 0
      await record('first_input', { device: 'gamepad', via: '__HARNESS.gamepad() -> pollGamepad()' });
    } else if (o.profile.touch) {
      await realTap(handle.page, Math.round(o.profile.width / 2), Math.round(o.profile.height / 2));
      await record('first_input', { device: 'touch', via: 'page.touchscreen.tap' });
    } else {
      await realKey(handle.page, 'KeyE', 'e');
      await record('first_input', { device: 'keyboard', via: 'page.keyboard' });
    }
    await o.onFirstInput();
  } else {
    await handle.h('queueInputs', [{ f: 2, press: ['interact'] }, { f: 6, release: ['interact'] }]);
    await handle.h('stepFrames', 12);
    await record('first_input', { device: 'scripted', via: 'queueInputs' });
    await o.onFirstInput();
  }

  // --- first control ----------------------------------------------------------------------
  // "Control" is the first frame on which the player can move the body. Observed entity-side:
  // drive a movement input and see whether the player's position changes.
  const p0 = await handle.hOpt('snapshot');
  const pos0 = p0 && p0.player && p0.player.pos ? p0.player.pos.slice() : null;
  if (o.inputMode === 'real') await realKey(handle.page, 'KeyW', 'w', { delay: 60 });
  else await handle.h('queueInputs', [{ f: 1, press: ['forward'] }, { f: 40, release: ['forward'] }]);
  await handle.h('stepFrames', 60);
  const p1 = await handle.hOpt('snapshot');
  const pos1 = p1 && p1.player && p1.player.pos ? p1.player.pos.slice() : null;
  const moved = pos0 && pos1 && (Math.abs(pos1[0] - pos0[0]) + Math.abs(pos1[2] - pos0[2])) > 1e-4;
  await record('first_control', { moved, pos_before: pos0, pos_after: pos1 });
  if (moved) await o.onFirstControl();
  else {
    led.unmeasurable('control_observed', 'the player body responded to a movement input',
      `the player did not move between ${JSON.stringify(pos0)} and ${JSON.stringify(pos1)} after 60 frames of forward input ` +
      `in mode '${o.inputMode}'. This is an ENTITY-SIDE observation (RI-MTH07 §B2): first_control ` +
      `is not claimable when nothing in the world moved.`,
      'the build');
  }
  await o.onUISample('after-first-control');

  // --- the census / creation surface ------------------------------------------------------
  const censusOpened = await (async () => {
    const s = await handle.hOpt('censusBegin', {});
    return s || null;
  })();
  if (censusOpened) {
    const firstRendered = await frameNow();
    await o.onUISample('census-open');
    const ui = await sampleUIText(handle);
    const surface = {
      id: 'census', first_rendered_frame: firstRendered,
      full_viewport: !!(ui.opaque_area_frac !== null && ui.opaque_area_frac >= 0.9),
      opaque_area_frac: ui.opaque_area_frac,
      text_at_open: ui.text.slice(0, 6),
      frames_to_dismiss: null,
    };
    await record('surface_enter', { surface: 'census', speaker: censusOpened.speaker || null, place: censusOpened.place || null });

    // Walk the census with real inputs, sampling the drawn text at every node. This is the
    // RI-JRN09 ES-LEGIBLE/1 evidence and the RI-CHR01 §CONSUMPTION "orphan text" instrument:
    // a question carried in getCensusState() and never drawn is invisible here as a node whose
    // getUIState().text does not contain the question.
    for (let node = 0; node < 40; node++) {
      const st = await handle.hOpt('getCensusState');
      if (!st || st.done || !st.question) break;
      const drawn = await sampleUIText(handle);
      const qText = (st.question && st.question.text) || '';
      const drawnJoined = drawn.text.join(' ');
      await record('census_node', {
        node,
        speaker: st.speaker || null,
        place: st.place || st.place_name || null,
        question_in_state: qText.slice(0, 200),
        question_reaches_frame: !!(qText && drawnJoined.includes(qText.slice(0, Math.min(40, qText.length)))),
        options_in_state: (st.question.options || st.options || []).map((x) => (typeof x === 'string' ? x : x.text)).slice(0, 8),
        drawn_text: drawn.text.slice(0, 12),
      });
      const opts = st.question.options || st.options || [];
      const answer = opts.length ? (typeof opts[0] === 'string' ? opts[0] : (opts[0].value ?? opts[0].id ?? 0)) : 0;
      try { await handle.h('censusAnswer', answer); } catch { break; }
      await o.onUISample(`census-node-${node}`);
    }

    // Dismiss with a real input and time it. This is M2's measurement, and it needs a REAL
    // input on the surface's first rendered frame — not a queueInputs at a frame index.
    const beforeDismiss = await frameNow();
    if (o.inputMode === 'real') await realKey(handle.page, 'Escape', 'Escape');
    await handle.h('stepFrames', 60);
    const stillOpen = (await sampleUIText(handle)).open;
    surface.frames_to_dismiss = stillOpen ? null : ((await frameNow()) - beforeDismiss);
    await record('surface_exit', { surface: 'census', still_open: stillOpen });
    o.onSurface(surface);
  } else {
    led.unmeasurable('census_surface', 'the creation surface',
      'window.__HARNESS.censusBegin() returned nothing, so no creation surface could be opened or timed',
      'the build');
  }

  // --- run out the journey's frame budget with the renderer off --------------------------
  const remaining = Math.max(0, Math.min(o.frames, 20000));
  await stepAndSample(handle, remaining, 600, async (done) => {
    if (done % 3000 === 0) await o.onUISample(`steady-${done}`);
  });
  await record('journey_end', { frames_stepped: remaining });
  return beats;
}

/** Per-journey extra legs. Each one either measures or says why it cannot. */
async function journeyLegs(handle, led, o) {
  const { journeyId, absentAmendments } = o;

  if (journeyId === 'jrn03-desktop') {
    const wanted = String(args.layouts || '').split(',').map((s) => s.trim()).filter(Boolean);
    const unknown = wanted.filter((l) => !LAYOUTS[l]);
    if (unknown.length) {
      led.unmeasurable('m_layouts', 'keyboard layout replay', `unknown layout(s): ${unknown.join(', ')}. Known: ${Object.keys(LAYOUTS).join(', ')}`, 'A-JRN12 (runner-side)');
    } else {
      const per = [];
      for (const l of wanted) {
        const map = LAYOUTS[l];
        // Dispatch the physical `code` with the layout's `key`, which is exactly what a layout
        // changes. A build binding on `code` is layout-proof; one binding on `key` is not.
        const before = await handle.hOpt('snapshot');
        for (const [code, key] of Object.entries(map)) {
          await handle.page.keyboard.down(key).catch(() => {});
          await handle.page.keyboard.up(key).catch(() => {});
          void code;
        }
        await handle.h('stepFrames', 30);
        const after = await handle.hOpt('snapshot');
        const inputState = await handle.hOpt('getInputState');
        per.push({ layout: l, dropped: inputState ? inputState.droppedInputs : null, moved: JSON.stringify(before) !== JSON.stringify(after) });
      }
      led.ok('m_layouts', 'journey replayed under each keyboard layout', {
        layouts: per,
        note: 'A-JRN12 is declared absent in the engine and assigned "runner-side". The layout table ' +
              'lives in this tool: CDP dispatches `code` and `key` separately, which is the whole of ' +
              'what a layout does to a binding.',
      });
    }
  }

  if (journeyId === 'jrn04-pad') {
    const seen = await observePads(handle.page);
    led.ok('m_pad_descriptors', 'pad descriptors visible at the navigator.getGamepads() seam', {
      pads: seen.pads, getgamepads_calls: seen.getgamepads_calls,
      note: seen.getgamepads_calls === 0
        ? 'THE BUILD NEVER CALLED navigator.getGamepads(). Its pad path starts below that seam ' +
          '(RealInput.pushGamepadState), so a non-standard `mapping:""` descriptor cannot reach it. ' +
          'The descriptor leg is therefore not passable by this build — report as a build defect, not a tool gap.'
        : null,
    });
  }

  if (journeyId === 'jrn05-saveload') {
    const scenarios = String(args.scenario || 'SV1').split(',').map((s) => s.trim()).filter(Boolean);
    const rt = await handle.hOpt('saveRoundTrip');
    const manifest = await handle.hOpt('getSaveManifest');
    const storage = await handle.hOpt('getStorageInfo');
    led.ok('m_saveload', 'save round-trip', { scenarios, round_trip: rt, manifest, storage });
    if (String(args.corruption || 'none') !== 'none') {
      const sim = await handle.hOpt('simulateStorageFailure', { kind: 'truncate' });
      if (sim === undefined) led.unmeasurable('m_corruption', 'corruption battery', 'simulateStorageFailure is absent', 'A-JRN3');
      else led.ok('m_corruption', 'corruption battery', { result: sim });
    }
  }

  if (journeyId === 'jrn06-death') {
    // W1-13. What was here drove `playerDeath()` — RI-CRM01's bounty hook, not a death — and
    // hashed the state around it. It reported "deaths driven" against a build in which the
    // death loop did not exist, which is the shape TOOL-LOOP rule 1 forbids. RI-JRN06's
    // Comparison method is M-D1..M-D19 over five scenarios and it now lives in its own file.
    const { runJrn06 } = await import('./jrn06-death.mjs');
    const r = await runJrn06(handle, args, led, { outDir, shots });
    led.ok('m_jrn06_summary', 'RI-JRN06 M-D1..M-D19', {
      scenarios: r.scenarios, deaths: r.deaths_requested,
      checks: Object.fromEntries(Object.entries(r.checks).map(([k, v]) => [k, v && v.pass])),
    });
  }

  if (journeyId === 'jrn07-quest') {
    if (absentAmendments.has('A-JRN13')) {
      led.unmeasurable('m_topics_as_presented', 'topic list as presented in play',
        'the build declares A-JRN13 absent: getDialogueState() does not exist, so the topics a ' +
        'player could actually see cannot be enumerated. Reading game/data/dialogue/** instead ' +
        'would measure the design document (RI-MTH07).',
        'wave-1 pieces W1-11..W1-13');
    }
    // ---- RI-JRN07 §B Rule S1: the seeded, stratified, RECORDED sample ---------------------
    //
    // TOOL-COVERAGE-R1 §3: in round 1 `--sample-quests` and `--stratified` were read out of the
    // usage block, echoed into the ledger record, and nothing was sampled — while the leg
    // reported `ok`. That is `cmb-reach.mjs --verify` again. They are implemented now, and where
    // the shipped data cannot fill a stratum the leg reports `unmeasurable` with the stratum
    // named rather than quietly topping the sample up from a stratum that IS populated.
    const wantSample = args['sample-quests'] !== undefined || !!args.stratified;
    if (wantSample) {
      const n = Number(args['sample-quests'] || 5) || 5;
      const draw = sampleQuests({ n, stratified: !!args.stratified, seed: Number(args.seed || 0) });
      // Rule S1: recorded BEFORE the run. This row is written first, unconditionally, so the
      // sample is in the artifact whatever the rest of the leg does.
      led.ok('m_quest_sample', 'RI-JRN07 §B Rule S1 seeded sample, recorded before the run', {
        seed: draw.seed, requested: n, stratified: !!args.stratified,
        drawn: draw.sample.map((q) => q.id),
        strata: draw.strata,
        draw_procedure: draw.procedure,
      });
      if (draw.unfilled.length) {
        led.unmeasurable('m_quest_sample_complete', 'a complete stratified ES/QUEST-SET',
          `RI-JRN07 §B requires one quest per stratum and Rule S1 makes the sample binding. ` +
          `${draw.unfilled.length} of ${draw.strata.length} strata have no candidate in shipped ` +
          `data: ${draw.unfilled.map((s) => `${s.id} (${s.description}) — ${s.why_empty}`).join(' | ')}. ` +
          `The sample is NOT topped up from a populated stratum: a critic that hand-picks quests ` +
          `has measured the best case and its verdict is void (RI-JRN07 §B / RI-MTH04).`,
          'whichever piece owns the missing quest stratum');
      }
      // The running-world half. A sample drawn from game/data/quests/** and reported on is a
      // reading of the design document (RI-MTH07); what makes it a measurement is asking the
      // RUNNING QuestBook whether it carries these ids at all.
      const book = await handle.hOpt('questBook');
      if (book === undefined) {
        led.unmeasurable('m_quest_sample_live', 'the sampled quests exist in the running build',
          '__HARNESS.questBook() is absent, so the sample cannot be checked against the running ' +
          'QuestBook and would be a reading of game/data/quests/** alone (RI-MTH07).', 'A-JRN1');
      } else {
        const present = draw.sample.filter((q) => book.includes(q.id)).map((q) => q.id);
        const missing = draw.sample.filter((q) => !book.includes(q.id)).map((q) => q.id);
        if (missing.length) {
          led.unmeasurable('m_quest_sample_live', 'the sampled quests exist in the running build',
            `${missing.length} of ${draw.sample.length} sampled quests are in game/data/quests/** ` +
            `but NOT in the running QuestBook (${missing.join(', ')}). The sample cannot be walked.`,
            'whichever piece loads the quest tree');
        } else {
          led.ok('m_quest_sample_live', 'the sampled quests exist in the running build',
            { book_size: book.length, sampled_present: present });
        }
      }
    }

    const qs = await handle.hOpt('getQuestState');
    if (qs === undefined) {
      led.unmeasurable('m_quest_state', 'quest state', '__HARNESS.getQuestState() is absent', 'A-JRN1');
    } else if (qs && qs._declared_incomplete) {
      led.unmeasurable('m_quest_state', 'quest state',
        `the build declares the quest runtime incomplete: ${JSON.stringify(qs._declared_incomplete)}. ` +
        'Quest STATE round-trips; quest PROGRESSION does not exist, so a quest cannot be walked ' +
        'end to end and RI-JRN07 L1..L6 are not reachable from here.',
        'wave-1 pieces W1-14..W1-16');
    } else {
      led.ok('m_quest_state', 'quest state', { state: qs });
    }
  }

  if (journeyId === 'jrn08-return') {
    const qs = await handle.hOpt('getQuestState');
    const travel = await handle.hOpt('getTravelState');
    led.ok('m_return_state', 'state after the absence', { quest: qs && qs._declared_incomplete ? 'declared_incomplete' : 'present', travel: !!travel });
  }
}

function parseDuration(s) {
  const m = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/.exec(s.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const mul = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
  return Math.round(n * mul);
}

// ---------------------------------------------------------------------------------------------
// self-test — the driver proves it can fail
// ---------------------------------------------------------------------------------------------
async function selfTest() {
  const lines = [];
  let failed = 0;
  const ok = (n, pass, d) => { lines.push(`${pass ? 'PASS' : 'FAIL'} ${n} — ${d}`); if (!pass) failed++; };

  const handle = await launchGame({ width: 320, height: 240 });
  try {
    await handle.hOpt('setMode', 'play-instrumented');
    await handle.hOpt('setRenderRate', 0);
    await handle.h('setSeed', 4711);

    // 1. The UI-text accessor must be EMPTY before any surface opens. If it is non-empty here,
    //    it is returning something other than what was drawn and every later grep is void.
    const pre = await sampleUIText(handle);
    ok('accessor empty before any surface', pre.text.length === 0,
      `pre-surface text array has ${pre.text.length} entries via ${pre.accessor}, open=${pre.open}`);

    // 2. THE REAL-INPUT CHECK GOES FIRST, before any surface is opened. A dialogue surface
    //    legitimately blocks locomotion, so testing movement with the census open would
    //    measure the surface, not the input path. (This ordering bug was in the first version
    //    of this self-test and the self-test caught it — which is the argument for having one.)
    const b0 = await handle.hOpt('snapshot');
    await handle.page.keyboard.down('w');
    await handle.h('stepFrames', 60);
    await handle.page.keyboard.up('w');
    const b1 = await handle.hOpt('snapshot');
    const moved = (b0 && b1 && b0.player && b1.player && b0.player.pos && b1.player.pos)
      ? Math.abs(b1.player.pos[0] - b0.player.pos[0]) + Math.abs(b1.player.pos[2] - b0.player.pos[2]) : 0;
    ok('real keyboard input reaches the world (entity-side)', moved > 1e-3,
      `player moved ${moved.toFixed(4)} m under a real page.keyboard 'w' with no surface open. ` +
      (moved > 1e-3 ? '' : 'At 0, the real input path is detached: journey-run reports ' +
        'control_observed unmeasurable rather than asserting first_control.'));

    // 3. The null control for input: with NO input dispatched, the player must not move.
    const a0 = await handle.hOpt('snapshot');
    await handle.h('stepFrames', 60);
    const a1 = await handle.hOpt('snapshot');
    const drift = (a0 && a1 && a0.player && a1.player && a0.player.pos && a1.player.pos)
      ? Math.abs(a1.player.pos[0] - a0.player.pos[0]) + Math.abs(a1.player.pos[2] - a0.player.pos[2]) : null;
    ok('null control: no input, no movement', drift !== null && drift < 1e-3,
      `player drifted ${drift} over 60 uncommanded frames`);

    // 4. And the accessor must be NON-EMPTY once a surface is open — the demonstration
    //    RI-JRN01 M9 demands before any grep result may be reported.
    const began = await handle.hOpt('censusBegin', {});
    const post = await sampleUIText(handle);
    ok('accessor non-empty on a frame known to carry text', !!began && post.text.length > 0,
      `censusBegin -> ${post.text.length} strings via ${post.accessor}, first: ${JSON.stringify(post.text[0] || null)}`);

    // 5. A blinded accessor must be reported unmeasurable, never pass. This is the exact
    //    failure RI-JRN01 §0.1(a) names: a grep over an empty set returns 0 hits and reads
    //    clean. BOTH accessors are blinded — blinding only one proved nothing once the build
    //    grew the second, which is how the first version of this test passed vacuously.
    await handle.page.evaluate(() => {
      const H = window.__HARNESS;
      window.__ORIG_ACCESSORS = {};
      for (const m of ['getUIState', 'getRenderedText']) {
        if (typeof H[m] !== 'function') continue;
        const orig = H[m].bind(H);
        window.__ORIG_ACCESSORS[m] = orig;
        H[m] = m === 'getUIState'
          ? () => ({ ...orig(), text: [], text_chars: 0 })
          : () => [];
      }
    });
    const blinded = await sampleUIText(handle);
    ok('blinded accessor is detected as empty (both accessors)', blinded.text.length === 0,
      `with every rendered-text accessor forced empty, the sampler reports ${blinded.text.length} strings ` +
      `via ${blinded.accessor} — journey-run reports this as unmeasurable, never as "0 instruction hits"`);
    await handle.page.evaluate(() => {
      for (const [m, fn] of Object.entries(window.__ORIG_ACCESSORS || {})) window.__HARNESS[m] = fn;
    });
  } finally { await handle.close(); }

  for (const l of lines) process.stdout.write(l + '\n');
  process.stdout.write(`\njourney-run self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}
