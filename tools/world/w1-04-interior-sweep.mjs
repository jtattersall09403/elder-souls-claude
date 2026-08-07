#!/usr/bin/env node
/**
 * w1-04-interior-sweep.mjs — THE PIXEL SWEEP. Walk into all 115 interiors from one fixed camera
 * pose and count how many distinct images come back.
 *
 * This is the second half of the W1-04 round-1 verdict's acceptance, verbatim:
 *
 *   "a pixel-hash sweep over one fixed camera pose in all 115 returns >= 100 distinct images
 *    where it currently returns 1."
 *
 * One is what it returned, because `Engine.cellFor()` folded 113 of the 115 named interiors onto
 * one generic cell and that cell was a 249-triangle hall with one hearth. The critic's two
 * captures of two buildings four kilometres apart differed only in who was standing in them.
 *
 * WHY A PIXEL HASH AND NOT A SCENE-GRAPH COUNT. Because a mesh count is a thing the builder can
 * make go up without changing what anybody sees, and this project has shipped sixteen of those.
 * The frame buffer is the player's chair. `tools/world/w1-04-consumption.mjs` §10c reports the
 * scene-graph signature alongside; where the two disagree the picture wins.
 *
 * THE CONTROL, and RULES.md rule 4 is why it is not optional. `--control` runs the identical
 * sweep with `renderer.setInteriorRecord()` cut to a no-op — which reproduces the round-1 build,
 * every door opening on the same generic hall. The sweep must report a small number there. A
 * sweep that returns 115 distinct images in BOTH arms is hashing the clock, or the people in the
 * room, or the frame counter, and is not measuring the room at all. Run both; report both.
 *
 * Usage:
 *   node tools/world/w1-04-interior-sweep.mjs [--out reports/w1-04-interior-sweep.json]
 *   node tools/world/w1-04-interior-sweep.mjs --control      # both arms, live and cut
 *
 * Exit 0 only when the live arm clears the verdict's bar of 100 distinct images AND, when
 * `--control` is given, the cut arm is strictly worse. Otherwise non-zero, with the reason.
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const USAGE = `
w1-04-interior-sweep.mjs — how many of the 115 interiors are actually different pictures?

  --out <path>   JSON report (default reports/w1-04-interior-sweep.json)
  --control      also run the arm with the room builder cut, and require it to be worse
  --bar <n>      distinct-image bar (default 100, from the round-1 verdict's acceptance)
  --timeout <ms> harness wait (default 90000)
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const outFile = args.out || 'reports/w1-04-interior-sweep.json';
const withControl = !!args.control;
const BAR = Number(args.bar ?? 100);
const timeout = Number(args.timeout ?? 90000);

let handle;
try {
  handle = await launchGame({ ...args, width: 480, height: 320 });
  const page = handle.page;
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout });

  const run = await page.evaluate(async (opts) => {
    const H = window.__HARNESS;
    const E = window.__ENGINE;

    // A 32-bit FNV-1a over the decoded PNG bytes. The image is the observation; this is only how
    // it is compared.
    const hashStr = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

    const ids = H.listInteriors().map((i) => i.id);

    // ONE fixed pose for every room, and it never moves between rooms. The whole point is that
    // the only thing that changes between two frames is which record built the cell.
    const POSE = { pos: [0, 1.62, -5.2], look: [0, 1.3, 2.0] };
    // The clock is pinned too: an interior lit by a hearth still reads the sky through the
    // renderer's ambient, and a sweep whose frames differ because time passed is a sweep of the
    // clock. Also empty the room of people, because the critic's round-1 pair differed ONLY in
    // who was standing in it and that must not be what this measures.
    H.setTimeOfDay(12);
    H.setWeather ? H.setWeather('clear') : null;

    async function sweep(label, cut) {
      let restore = null;
      if (cut) { const s = E.renderer.setInteriorRecord.bind(E.renderer); E.renderer.setInteriorRecord = () => null; restore = () => { E.renderer.setInteriorRecord = s; }; }
      const rows = [];
      const seen = new Map();
      try {
        for (const id of ids) {
          try {
            if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
            const r = H.enterInterior(id);
            if (!r || !r.entered) { rows.push({ id, entered: false, reason: r && r.reason }); continue; }
            H.stepFrames(2);
            // Nobody in the frame: the picture must be of the ROOM.
            H.clearNPCs ? H.clearNPCs() : null;
            H.camera(POSE);
            H.renderFrame();
            const url = await H.screenshot();
            const h = hashStr(url);
            const drawn = H.getDrawnInterior();
            rows.push({ id, entered: true, hash: h, bytes: url.length, drawn_cell: drawn.drawn_cell, agrees: drawn.agrees, room: drawn.interior_id });
            seen.set(h, (seen.get(h) || 0) + 1);
          } catch (e) { rows.push({ id, error: String(e && e.message ? e.message : e).slice(0, 200) }); }
        }
      } finally { if (restore) restore(); }
      const counts = [...seen.values()].sort((a, b) => b - a);
      return {
        label,
        total: ids.length,
        entered: rows.filter((r) => r.entered).length,
        refused: rows.filter((r) => r.entered === false).length,
        errors: rows.filter((r) => r.error).length,
        distinct_images: seen.size,
        largest_identical_group: counts[0] || 0,
        drawn_cell_agrees: rows.filter((r) => r.agrees).length,
        rows,
      };
    }

    const live = await sweep('live', false);
    const control = opts.withControl ? await sweep('room builder cut', true) : null;
    try { if (H.whereAmI().interior) H.exitInterior(); } catch { /* outside */ }
    return { live, control };
  }, { withControl });

  const live = run.live, control = run.control;
  log(`sweep (live)          entered ${live.entered}/${live.total}  refused ${live.refused}  errors ${live.errors}`);
  log(`  drawn cell agrees   ${live.drawn_cell_agrees}/${live.entered}`);
  log(`  DISTINCT IMAGES     ${live.distinct_images}   (largest identical group ${live.largest_identical_group})`);
  if (control) {
    log(`sweep (builder cut)   entered ${control.entered}/${control.total}`);
    log(`  DISTINCT IMAGES     ${control.distinct_images}   (largest identical group ${control.largest_identical_group})`);
  }

  const failures = [];
  if (live.distinct_images < BAR) failures.push(`live arm returned ${live.distinct_images} distinct images, below the verdict's bar of ${BAR}`);
  if (live.entered === 0) failures.push('no interior could be entered at all');
  if (live.drawn_cell_agrees !== live.entered) failures.push(`${live.entered - live.drawn_cell_agrees} of ${live.entered} entered interiors drew a cell the world had left`);
  if (control && !(control.distinct_images < live.distinct_images)) {
    failures.push(`the control is not worse (${control.distinct_images} vs ${live.distinct_images}): this sweep is not measuring the room`);
  }

  log('');
  if (failures.length) { for (const f of failures) log(`FAIL: ${f}`); } else { log('PASS: the door opens on the room the file describes.'); }
  writeJson(outFile, {
    tool: 'tools/world/w1-04-interior-sweep.mjs',
    bar: BAR, pass: failures.length === 0, failures,
    live: { ...live, rows: live.rows },
    control: control ? { ...control, rows: control.rows } : null,
    page_errors: errors,
  });
  await handle.close();
  process.exit(failures.length ? 1 : 0);
} catch (e) {
  log(`w1-04-interior-sweep: ${e && e.stack ? e.stack : e}`);
  if (handle) await handle.close().catch(() => {});
  process.exit(1);
}
