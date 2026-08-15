#!/usr/bin/env node
/**
 * deck-motion.mjs — the twelve motion sequences the Deck declares and has never captured.
 *
 * `tools/visual/deck.json` has carried a `motion` list since it was generated: walk, run,
 * sprint-stop, turn-180, roll-4dir, jump-land, attack-light, attack-heavy, block-hit, spell,
 * boundary-walk, day-night. Every profile lists them. Nothing has ever read them, so no gate in
 * the tree is motion-satisfied, and W1-30V named that as its own largest gap.
 *
 * Motion is where aliasing, crawling silhouettes, foot-slide, blend pops and animation defects
 * live. A still cannot show any of them. W1-30-EVIDENCE §1: "A reviewer that looked at one frame
 * of a motion sequence has not reviewed it."
 *
 * WHAT THIS TOOL WILL NOT DO, each for a reason already paid for:
 *
 *  1. **It never silently skips a sequence.** A sequence that cannot be set up — no enemy to be
 *     hit by, no catalyst to cast with, no border to walk across — is written to the manifest as
 *     `status: "red"` with the reason. A shorter report is not a better result.
 *  2. **It never claims GPU.** The evidence class comes from the renderer string the browser
 *     reported, through tools/visual/lib/renderer-class.mjs, which fails closed.
 *  3. **It checks that the picture actually moved.** A sequence whose frames are all byte
 *     identical is a sequence of one still repeated, which is exactly the shape of evidence this
 *     standard exists to refuse. `distinct_frames` is in every row and `moving: false` is a red.
 *  4. **Every input goes through the real input pipeline.** `queueInputs` → ACTIONS → the same
 *     bindings a keyboard drives. Nothing poses the player.
 *
 * Usage:
 *   node tools/visual/deck-motion.mjs --profile smoke --tag local
 *   node tools/visual/deck-motion.mjs --profile full --tag hw --gpu hardware --require-hardware
 *   node tools/visual/deck-motion.mjs --only walk,roll-4dir --frames 60      (a fast check)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { launchForCapture, resolveGpuMode } from './lib/gpu-launch.mjs';
import { manifestRendererFields, rendererBanner } from './lib/renderer-class.mjs';
import { gateBuffer, T as LIVENESS_T } from './frame-liveness.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}

const DECK = JSON.parse(fs.readFileSync(path.join(REPO, args.deck || 'tools/visual/deck.json'), 'utf8'));
const PROFILE_NAME = String(args.profile || 'smoke');
const PROFILE = DECK.profiles[PROFILE_NAME];
if (!PROFILE) {
  console.error(`unknown profile '${PROFILE_NAME}'. have: ${Object.keys(DECK.profiles).join(', ')}`);
  process.exit(2);
}
const TAG = String(args.tag || `motion-${PROFILE_NAME}`);
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/deck-motion/${TAG}`);
const SEED = Number(args.seed || DECK.capture.seed);
const [CW, CH] = String(args.canvas || `${DECK.capture.width}x${DECK.capture.height}`).split('x').map(Number);
const SETTLE = Number(args.settle || DECK.capture.settle_frames);
const EVERY = Math.max(1, Number(args.every || 1));           // capture every Nth simulated frame
const SHEET_EVERY = Math.max(1, Number(args['sheet-every'] || 6));
const FRAME_CAP = args.frames ? Number(args.frames) : null;    // shorten every sequence (smoke use)
const ONLY = args.only ? String(args.only).split(',').map((s) => s.trim()).filter(Boolean) : null;
// `inf_trash` is a real archetype in game/data/combat/enemies/. The id vt-play.mjs reaches for,
// `pop-0027-infantry`, is a POPULATION row and not an archetype — the engine rejects it by name
// ("no such archetype... a phantom eid would be a fabricated measurement"), which is the engine
// being right. --enemy-id overrides; the known list is printed in the refusal.
const SPAWN_ID = String(args['enemy-id'] || 'inf_trash');
fs.mkdirSync(OUT, { recursive: true });

// The character stage: the same spot the Deck's mandatory character close-ups use, so a motion
// sequence and a still of the same body are taken in the same light and the same ground.
const STAGE = { x: 2766, z: 5011 };

/** Per-frame `look` must be re-emitted every frame — the sim zeroes it after consuming it. */
const lookFrames = (from, count, degPerFrame) => Array.from({ length: count + 1 }, (_, i) => ({
  f: from + i, look: i < count ? [degPerFrame, 0] : [0, 0],
}));

/**
 * The twelve scripts. `setup` runs before the window opens and may return a reason string to send
 * the whole sequence red; `inputs` is a plain queueInputs script; `perFrame` (optional) runs
 * between captured frames for sequences whose subject is the world rather than the player.
 */
const SCRIPTS = {
  // The stick magnitude is not decoration: game/src/sim/player.js:188 puts the WALK/RUN threshold
  // at mag > 0.55, so a full-stick "walk" sequence is a RUN sequence with the wrong label — which
  // is exactly what the first hardware capture recorded (state RUN, anim `run`, 3.2 m/s) before
  // this was fixed. Walk walks, run jogs, sprint-stop sprints, and the per-frame samples in the
  // manifest record which state the sim actually entered, so the label stays checkable.
  walk: { inputs: () => [{ f: 0, move: [0, 0.55] }] },
  run: { inputs: () => [{ f: 0, move: [0, 1] }] },
  'sprint-stop': {
    inputs: (n) => [
      { f: 0, move: [0, 1], press: ['sprint'] },
      { f: Math.floor(n * 0.6), move: [0, 0], release: ['sprint'] },
    ],
  },
  'turn-180': { inputs: (n) => lookFrames(0, Math.min(60, Math.floor(n * 0.4)), 3) },
  'roll-4dir': {
    inputs: (n) => {
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      const gap = Math.max(12, Math.floor(n / 4));
      return dirs.flatMap((move, i) => [
        { f: i * gap, move },
        { f: i * gap + 4, press: ['roll'] },
        { f: i * gap + 7, release: ['roll'] },
      ]);
    },
  },
  'jump-land': {
    inputs: (n) => {
      const gap = Math.max(30, Math.floor(n / 2));
      return [0, 1].flatMap((i) => [
        { f: i * gap, move: [0, 1] },
        { f: i * gap + 10, press: ['jump'] },
        { f: i * gap + 12, release: ['jump'] },
      ]);
    },
  },
  'attack-light': {
    inputs: (n) => {
      const gap = Math.max(24, Math.floor(n / 3));
      return [0, 1, 2].flatMap((i) => [
        { f: 10 + i * gap, press: ['light'] },
        { f: 13 + i * gap, release: ['light'] },
      ]);
    },
  },
  'attack-heavy': {
    inputs: (n) => {
      const gap = Math.max(60, Math.floor(n / 2));
      return [0, 1].flatMap((i) => [
        { f: 10 + i * gap, press: ['heavy'] },
        { f: 40 + i * gap, release: ['heavy'] },
      ]);
    },
  },
  'block-hit': {
    // The only sequence that needs a second body. No enemy, no sequence — and it says so.
    async setup(ctx) {
      const s = await ctx.call('snapshot');
      if (!s.ok) return `snapshot failed before spawning a sparring partner: ${s.e}`;
      const [px, , pz] = s.v.player.pos;
      const sp = await ctx.call('spawn', SPAWN_ID, px, pz + 4);
      if (!sp.ok) return `spawn('${SPAWN_ID}') refused: ${sp.e} — no body to be hit by, so a block/hit-reaction sequence cannot be photographed`;
      await ctx.call('stepFrames', 10);
      const s2 = await ctx.call('snapshot');
      const eid = s2.ok && s2.v.enemies && s2.v.enemies[0] ? s2.v.enemies[0].eid : null;
      if (!eid) return `spawn('${SPAWN_ID}') returned but no enemy is in the snapshot`;
      await ctx.call('aggro', eid);
      await ctx.call('lockOn', eid);
      ctx.row.enemy = { id: SPAWN_ID, eid };
      return null;
    },
    inputs: (n) => [{ f: 0, press: ['block'] }, { f: n - 1, release: ['block'] }],
  },
  spell: {
    async setup(ctx) {
      const attune = await ctx.call('setAttuned', [String(args.spell || 'spark_dart')]);
      if (!attune.ok) return `setAttuned refused: ${attune.e} — no spell to cast`;
      // A catalyst KIND, not an item id: setCatalyst knows great_staff, rod, enchanted_weapon,
      // none. The first hardware run reddened this row with `setCatalyst('root-speakers-rod'):
      // unknown` — which is the tool working, not failing: a named reason and a one-word fix,
      // rather than 180 frames of a character standing still filed under "spell".
      const cat = await ctx.call('setCatalyst', String(args.catalyst || 'rod'));
      if (!cat.ok) return `setCatalyst refused: ${cat.e} — casting requires a catalyst in hand`;
      await ctx.call('magicEventsDrain');
      ctx.row.magic = { attuned: attune.v, catalyst: cat.v };
      return null;
    },
    inputs: () => [{ f: 10, press: ['light'] }, { f: 14, release: ['light'] }],
    async after(ctx) {
      const ev = await ctx.call('magicEventsDrain');
      const events = ev.ok && Array.isArray(ev.v) ? ev.v : [];
      ctx.row.magic_events = events.slice(0, 20).map((e) => e.type || e.kind || String(e));
      // Fail loudly rather than ship 180 frames of a character standing still labelled "spell".
      if (!events.length) return 'no magic event fired: the cast never happened, so these frames are not a spell sequence';
      return null;
    },
  },
  'boundary-walk': {
    // Streamed-boundary pop only shows when you cross one, so find a real border rather than
    // walking in a straight line and calling it a boundary.
    async setup(ctx) {
      const borders = await ctx.call('listBorders');
      const list = borders.ok && Array.isArray(borders.v) ? borders.v : [];
      if (!list.length) return 'listBorders() returned nothing, so no streamed boundary can be crossed on purpose';
      const marks = await ctx.call('listBorderMarkers', { id: list[0].id || list[0] });
      const point = marks.ok && Array.isArray(marks.v) && marks.v.length ? marks.v[0] : null;
      const x = point ? (point.x ?? point.pos?.[0]) : null;
      const z = point ? (point.z ?? point.pos?.[2]) : null;
      if (!Number.isFinite(x) || !Number.isFinite(z)) return `border '${list[0].id || list[0]}' exposed no usable marker coordinate`;
      const tp = await ctx.call('teleport', x - 40, z);
      if (!tp.ok) return `teleport to the approach of border ${list[0].id || list[0]} refused: ${tp.e}`;
      await ctx.call('stepFrames', SETTLE);
      ctx.row.border = { id: list[0].id || list[0], from: [x - 40, z] };
      return null;
    },
    inputs: () => [{ f: 0, move: [0, 1], press: ['sprint'] }],
  },
  'day-night': {
    // No input at all: the subject is the grade, not the body — so the "did the player move?"
    // check below does not apply to it, and that exemption is declared here rather than assumed.
    subject: 'world',
    inputs: () => [],
    perFrame: async (ctx, index, total) => {
      const hour = 4 + (18 * index) / Math.max(1, total - 1);
      await ctx.call('setTimeOfDay', Number(hour.toFixed(3)));
    },
  },
};

// ---- launch ------------------------------------------------------------------------------
const t0 = Date.now();
const GPU_MODE = resolveGpuMode(args);
const REQUIRE_HARDWARE = args['require-hardware'] === true || args.requireHardware === true;
const { g, attestation } = await launchForCapture({
  mode: GPU_MODE,
  requireHardware: REQUIRE_HARDWARE,
  entry: 'game/index.html',
  width: 1280,
  height: 720,
});
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 120000 });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view');
  c.width = w; c.height = h;
  window.__ENGINE.renderer.setSize(w, h);
}, { w: CW, h: CH });

/**
 * A harness call that CANNOT kill the run.
 *
 * `browser.mjs`'s `h()` routes a page-side throw into `die()`, which calls `process.exit`. A
 * try/catch around it does nothing, so one bad setup ends the whole sweep — which is exactly what
 * happened on the first local run of this tool: `spawn('pop-0027-infantry')` threw "no such
 * archetype", the process exited at sequence 9 of 12, and NO manifest was written. A tool whose
 * whole promise is "a sequence that cannot be set up goes red rather than vanishing" cannot reach
 * the harness through a function that exits. So this speaks to the page directly and returns the
 * failure as a value.
 */
const call = async (m, ...a) => {
  try {
    const res = await g.page.evaluate(async ({ method, callArgs }) => {
      const H = window.__HARNESS;
      if (!H) return { __err: 'window.__HARNESS is not defined' };
      if (typeof H[method] !== 'function') return { __err: `window.__HARNESS.${method} is not a function` };
      try { return { __ok: await H[method](...callArgs) }; }
      catch (e) { return { __err: `${method}() threw: ${e && e.message || e}` }; }
    }, { method: m, callArgs: a });
    if (res && res.__err) return { ok: false, e: String(res.__err).split('\n')[0].slice(0, 240) };
    return { ok: true, v: res ? res.__ok : undefined };
  } catch (e) {
    return { ok: false, e: `evaluate failed: ${String(e.message).split('\n')[0].slice(0, 200)}` };
  }
};

const build = await g.h('getBuildInfo');
const wanted = (PROFILE.motion || []).filter((id) => !ONLY || ONLY.includes(id));
const sequences = DECK.motion.filter((m) => wanted.includes(m.id));
const missingScripts = sequences.filter((m) => !SCRIPTS[m.script || m.id]);

console.log(`deck-motion: profile=${PROFILE_NAME} tag=${TAG} seed=${SEED} canvas=${CW}x${CH} gpu=${GPU_MODE}`);
console.log(rendererBanner(attestation));
console.log(`plan: ${sequences.length} sequence(s), ${sequences.reduce((a, m) => a + Math.ceil((FRAME_CAP || m.frames) / EVERY), 0)} frames to capture\n`);

const rows = [];

for (const seq of sequences) {
  const scriptId = seq.script || seq.id;
  const script = SCRIPTS[scriptId];
  const frames = FRAME_CAP || seq.frames;
  const dir = path.join(OUT, 'frames', seq.id);
  const row = {
    sequence: seq.id, script: scriptId, why: seq.why,
    frames_planned: frames, capture_every: EVERY, frames_captured: 0,
    status: 'red', reason: null, distinct_frames: 0, moving: false, degenerate_frames: 0, degenerate_first: null,
    dir: path.relative(REPO, dir), contact_sheet: null, hashes: [], samples: [],
  };
  rows.push(row);
  const started = Date.now();

  if (!script) {
    row.reason = `no capture script is implemented for '${scriptId}'. The Deck declares it; this tool must be taught it. Nothing was captured.`;
    console.log(`  RED  ${seq.id} — ${row.reason}`);
    continue;
  }

  fs.mkdirSync(dir, { recursive: true });
  const ctx = { call, row, g };
  try {
    // A clean, identical stage for every sequence: same seed, same place, same light, no
    // leftover inputs and no leftover enemy state from the sequence before.
    await call('setSeed', SEED);
    await call('clearInputs');
    const where = await call('whereAmI');
    if (where.ok && where.v && where.v.interior) await call('exitInterior');
    const tp = await call('teleport', STAGE.x, STAGE.z);
    if (!tp.ok) { row.reason = `teleport to the character stage refused: ${tp.e}`; console.log(`  RED  ${seq.id} — ${row.reason}`); continue; }
    await call('setWeather', 'clear');
    if (seq.id !== 'day-night') await call('setTimeOfDay', 13);
    await call('camera', { mode: 'gameplay' });
    await call('stepFrames', SETTLE);

    const setupError = script.setup ? await script.setup(ctx) : null;
    if (setupError) { row.reason = setupError; console.log(`  RED  ${seq.id} — ${setupError}`); continue; }

    // HARNESS §4: re-anchor free-running clocks so the window is warm-up independent.
    await call('reanchorFreeRunning');
    const trace = await call('traceStart', { frames });
    const inputs = script.inputs(frames);
    if (inputs.length) {
      const queued = await call('queueInputs', inputs);
      if (!queued.ok) { row.reason = `queueInputs refused: ${queued.e}`; console.log(`  RED  ${seq.id} — ${row.reason}`); continue; }
      row.input_events = inputs.length;
    }

    const captureCount = Math.ceil(frames / EVERY);
    const seen = new Set();
    for (let i = 0; i < captureCount; i++) {
      if (script.perFrame) await script.perFrame(ctx, i, captureCount);
      const stepped = await call('stepFrames', EVERY);
      if (!stepped.ok) { row.reason = `stepFrames refused at frame ${i * EVERY}: ${stepped.e}`; break; }
      const data = await call('screenshot');
      if (!data.ok) { row.reason = `screenshot refused at frame ${i * EVERY}: ${data.e}`; break; }
      const buf = Buffer.from(String(data.v).replace(/^data:image\/png;base64,/, ''), 'base64');
      const file = `f${String(i * EVERY).padStart(4, '0')}.png`;
      fs.writeFileSync(path.join(dir, file), buf);
      const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
      seen.add(hash);
      row.hashes.push(hash);
      row.frames_captured++;
      // PER-FRAME SANITY GATE — HAZARDS.md §15, roadmap I2. `distinct_frames` below already asks
      // "did the picture change"; it cannot ask "is any of these a picture at all". A sequence of
      // 180 distinct degenerate frames passes the distinctness test perfectly. This asks the other
      // question, once per frame, at capture time.
      const live = gateBuffer(buf, { label: `${seq.id}/${file}`, subject: false, throwOnDegenerate: false });
      if (live.verdict !== 'LIVE') {
        row.degenerate_frames = (row.degenerate_frames || 0) + 1;
        if (!row.degenerate_first) row.degenerate_first = { file, verdict: live.verdict, why: live.why };
      }
      if (i % SHEET_EVERY === 0) {
        const s = await call('snapshot');
        if (s.ok) {
          row.samples.push({
            f: i * EVERY, state: s.v.player.state, anim: s.v.player.anim,
            speed_mps: s.v.player.speed_mps, stamina: s.v.player.stamina,
            pos: s.v.player.pos.map((n) => +Number(n).toFixed(2)),
            // Yaw is here because `turn-180` is a sequence in which nothing translates: without
            // it the "did the player move?" check below would redden a perfectly good pivot.
            yaw_deg: s.v.player.yaw_deg ?? null,
            cam_yaw_deg: s.v.camera ? (s.v.camera.yaw_deg ?? null) : null,
          });
        }
      }
    }
    if (trace.ok) {
      const drained = await call('traceDrain');
      await call('traceStop');
      const events = drained.ok && drained.v && Array.isArray(drained.v.events) ? drained.v.events : [];
      row.trace_events = events.slice(0, 60);
    }

    // The capture loop breaks with a reason rather than throwing, so a sequence that died halfway
    // keeps the frames it did get AND is recorded red with the frame it stopped at.
    if (row.reason) { console.log(`  RED  ${seq.id} — ${row.reason}`); continue; }

    const afterError = script.after ? await script.after(ctx) : null;
    row.distinct_frames = seen.size;
    // Two checks a still can never make, and they are not the same check.
    //
    //  (a) did the PICTURE change? Frame hashes catch a frozen renderer.
    //  (b) did the PLAYER move? Frame hashes do NOT catch this — foliage sways, water moves and
    //      the clock ticks, so a sequence where the body never budged still produces 180 distinct
    //      frames. The first hardware capture is what taught this: `walk` looked healthy on
    //      hashes alone while the character spent its first 15 frames turning on the spot.
    row.moving = seen.size > Math.max(2, row.frames_captured * 0.25);
    const poses = row.samples.map((s) => s.pos).filter(Boolean);
    const anims = new Set(row.samples.map((s) => s.anim));
    const states = new Set(row.samples.map((s) => s.state));
    let travelled = 0;
    for (const p of poses) travelled = Math.max(travelled, Math.hypot(p[0] - poses[0][0], p[2] - poses[0][2]));
    const spread = (key) => {
      const values = row.samples.map((s) => s[key]).filter((v) => Number.isFinite(v));
      return values.length ? Math.max(...values) - Math.min(...values) : 0;
    };
    row.player_travelled_m = +travelled.toFixed(2);
    row.player_yaw_span_deg = +spread('yaw_deg').toFixed(1);
    row.camera_yaw_span_deg = +spread('cam_yaw_deg').toFixed(1);
    row.player_anims = [...anims];
    row.player_states = [...states];
    row.player_moved = travelled > 0.25 || anims.size > 1 || states.size > 1
      || row.player_yaw_span_deg > 15 || row.camera_yaw_span_deg > 15;
    if (afterError) { row.reason = afterError; console.log(`  RED  ${seq.id} — ${afterError}`); continue; }
    // A THIRD CHECK, and it is prior to both of the above: were these frames PICTURES?
    // HAZARDS.md §15. A sequence of 180 distinct, moving, degenerate frames satisfies (a) and (b)
    // completely — the hashes differ, the player travelled — and is worth nothing. This is the
    // failure that produced a +223% result from a near-uniform capture with every gate green.
    if (row.degenerate_frames) {
      const d = row.degenerate_first;
      row.reason = `${row.degenerate_frames} of ${row.frames_captured} frames are not pictures of anything (first: ${d.file} ${d.verdict} — ${(d.why || []).join('; ')}). The sequence may well have moved; it is still not usable evidence.`;
      console.log(`  RED  ${seq.id} — ${row.reason}`);
      continue;
    }
    if (!row.moving) {
      row.reason = `captured ${row.frames_captured} frames but only ${seen.size} are distinct: nothing moved, so this is one still repeated and not a motion sequence`;
      console.log(`  RED  ${seq.id} — ${row.reason}`);
      continue;
    }
    if (script.subject !== 'world' && !row.player_moved) {
      row.reason = `the picture changed but the player did not: ${row.frames_captured} frames, ${travelled.toFixed(2)} m travelled, ${row.player_yaw_span_deg}° of body yaw, ${row.camera_yaw_span_deg}° of camera yaw, one anim (${[...anims].join(', ')}) and one state (${[...states].join(', ')}). The input never reached the body, so this is a sequence of the weather.`;
      console.log(`  RED  ${seq.id} — ${row.reason}`);
      continue;
    }
    row.status = 'ok';
    row.seconds = +((Date.now() - started) / 1000).toFixed(1);
    console.log(`  ok   ${seq.id}  ${row.frames_captured} frames, ${seen.size} distinct, ${row.seconds}s`);
  } catch (e) {
    row.reason = `sequence threw: ${String(e.message).slice(0, 240)}`;
    console.log(`  RED  ${seq.id} — ${row.reason}`);
  } finally {
    await call('clearInputs');
  }
}

// ---- contact sheets: the artefact that makes "I reviewed the sequence" checkable -----------
for (const row of rows) {
  if (row.status !== 'ok') continue;
  const out = path.join(OUT, 'contact', `${row.sequence}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  try {
    execFileSync(process.execPath, [
      path.join(REPO, 'tools/visual/contact-sheet.mjs'),
      '--in', path.join(OUT, 'frames', row.sequence),
      '--out', out, '--every', String(SHEET_EVERY), '--cols', '6', '--scale', '0.35',
    ], { stdio: 'pipe' });
    row.contact_sheet = path.relative(REPO, out);
  } catch (e) {
    row.contact_sheet_error = String(e.message).split('\n')[0].slice(0, 200);
  }
}

const manifest = {
  schema: 'elder-souls/visual-deck-motion@1',
  tag: TAG, profile: PROFILE_NAME, seed: SEED, canvas: [CW, CH],
  deck_version: DECK.version, deck_manifest_hash: DECK.manifest_hash,
  frame_liveness_thresholds: LIVENESS_T,
  commit: process.env.GIT_COMMIT || null,
  build: { name: build.name, version: build.version, commit: build.commit, three: build.threeVersion },
  gpu_mode_requested: GPU_MODE,
  gpu_backend: attestation.backend || null,
  gpu_backend_attempts: attestation.backend_attempts && attestation.backend_attempts.length ? attestation.backend_attempts : null,
  ...manifestRendererFields(attestation),
  declared_sequences: DECK.motion.length,
  profile_sequences: (PROFILE.motion || []).length,
  unimplemented_scripts: missingScripts.map((m) => m.script || m.id),
  counts: {
    planned: sequences.length,
    ok: rows.filter((r) => r.status === 'ok').length,
    red: rows.filter((r) => r.status !== 'ok').length,
    frames: rows.reduce((a, r) => a + r.frames_captured, 0),
  },
  seconds: +((Date.now() - t0) / 1000).toFixed(1),
  rows,
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${manifest.counts.ok} ok, ${manifest.counts.red} red, ${manifest.counts.frames} frames, ${manifest.seconds}s`);
console.log(`frames:   ${path.relative(REPO, path.join(OUT, 'frames'))}`);
console.log(`sheets:   ${path.relative(REPO, path.join(OUT, 'contact'))}`);
console.log(`manifest: ${path.relative(REPO, path.join(OUT, 'manifest.json'))}`);
await g.close();
// A red row is a finding, not a crash — the manifest is the thing that is read.
