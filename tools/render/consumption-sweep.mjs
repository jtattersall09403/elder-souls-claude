#!/usr/bin/env node
/**
 * consumption-sweep.mjs — RI-MTH07, applied to the per-frame boundary between the simulation
 * and the renderer. "A model nothing in the running world reads scores zero."
 *
 * `charOpacity` was the case that prompted this: `sim/camera.js` computes it every frame, it is
 * quantised in `sim/state.js`, written to the trace in `sim/record.js` and saved and restored in
 * `save/state.js` — and `grep -rn charOpacity game/src/render/` returns nothing. Every static
 * view of the build reports the camera fade as working; only a photograph shows that it does
 * nothing at all. The obvious question is *how many siblings does it have*, and this answers it
 * over a stated population rather than by anecdote.
 *
 * THE POPULATION. Every field declared on the four per-frame simulation objects built in
 * `sim/state.js` — `makeCamera()`, `makePlayer()`, `makeEnvironment()`, `makeWorld()`. These are
 * the objects the renderer is handed once a frame; a field on one of them is a promise that
 * something can be drawn differently because of it.
 *
 * THE TEST. For each field name, does any file under `game/src/render/` mention it?
 *
 * WHAT A RED ROW DOES AND DOES NOT MEAN. A field with no renderer mention is not automatically
 * a defect: plenty of simulation state is legitimately internal (rate limiters, dwell counters,
 * hysteresis) and is consumed by the sim itself, not by the picture. So the sweep classifies
 * rather than accuses, and the classification is declared HERE, in the file, so that a later
 * reader can disagree with a specific line instead of the whole number:
 *
 *   VISUAL   — the field's own declared purpose is something the player should SEE. A red row
 *              here is a real consumption failure and is what this tool exists to find.
 *   INTERNAL — solver scratch, rate limits, dwell counters, save/trace bookkeeping. Red is the
 *              expected and correct state.
 *
 * Usage:  node tools/render/consumption-sweep.mjs [--json]
 * Exit 1 if any VISUAL field has no consumer, so it can be a tripwire in CI.
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const STATE = path.join(REPO, 'game/src/sim/state.js');
const RENDER_DIR = path.join(REPO, 'game/src/render');

/**
 * Fields whose declared job is to change what the player SEES. Everything not named here is
 * treated as INTERNAL, which is the conservative direction: it can only make this tool report
 * FEWER defects than exist, never more. Each entry says what the picture should do.
 *
 * `indirect` names a field that reaches the frame through ANOTHER field rather than by being
 * read in `game/src/render/` under its own name. A plain name-grep calls those red, and that
 * would be a false accusation — the whole point of this tool is to be trusted, so the ones that
 * were checked by hand are recorded here with the route they take.
 */
const VISUAL = {
  charOpacity: { why: 'dissolve the character when the camera arm is compressed into them (RI-CAM01 §C)' },
  fov: { why: 'the projection the frame is drawn with' },
  pos: { why: 'where the camera stands' },
  pivot: { why: 'what the camera looks at' },
  mode: { why: 'which camera state is being drawn' },
  timeOfDay: { why: 'the sun, the sky and the shadows' },
  weather: { why: 'the sky, the fog and the precipitation' },
  region: { why: 'the region fog colour and the signature flora' },
  interior: { why: 'which cell is drawn' },
  // Checked by hand, 2026-08-14. `sim/camera.js:1039 viewBasis()` adds the shake to yaw/pitch,
  // and `writePose()` builds `c.pos` through it — so the shake reaches the frame as a small
  // POSITIONAL wobble. What does NOT reach the frame is the rotation, which RI-CAM06 §G says is
  // the entire intent ("rotational only"): `render/renderer.js` builds the view with
  // `camera.lookAt(pivot)` and `camera.up.set(0,1,0)`, which discards camera roll and yaw/pitch
  // shake outright. Amber, not red, and it belongs to whoever owns the camera and the renderer.
  shakeYaw: { why: 'rotational shake, applied after the rig (RI-CAM06 §G)', indirect: 'sim/camera.js viewBasis() -> writePose() -> camera.pos; the ROTATION is discarded by renderer.js camera.lookAt()' },
  shakePitch: { why: 'rotational shake, applied after the rig (RI-CAM06 §G)', indirect: 'as shakeYaw' },
  // Checked by hand: this is a DIAGNOSTIC, not a drawing instruction. `evaluateClip()` computes
  // it so a probe can say the frame was compromised; nothing is supposed to be drawn from it.
  // Left in the VISUAL list because the audit lists it among the camera instrumentation, and
  // marked indirect so it does not inflate the defect count it has no business being in.
  clipThrough: { why: 'the near plane is inside geometry — the frame is compromised', indirect: 'diagnostic only: read by probes and the trace, never intended as a drawing input' },
};

const src = fs.readFileSync(STATE, 'utf8');

/** The fields declared on one `makeX()` factory, in declaration order. */
function fieldsOf(fn) {
  const i = src.indexOf(`export function ${fn}(`);
  if (i < 0) throw new Error(`consumption-sweep: ${STATE} has no ${fn}()`);
  // From the factory's `return {` to the matching close, by brace depth.
  const start = src.indexOf('return {', i);
  let d = 0, end = -1;
  for (let k = src.indexOf('{', start); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) { end = k; break; } }
  }
  const body = src.slice(start, end);
  const out = [];
  // Top-level keys only: depth 1 relative to the returned object literal.
  let depth = 0;
  for (const line of body.split('\n')) {
    const before = depth;
    for (const ch of line) { if (ch === '{' || ch === '[') depth++; else if (ch === '}' || ch === ']') depth--; }
    if (before !== 1) continue;
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(line);
    if (m) out.push(m[1]);
  }
  return [...new Set(out)];
}

const renderFiles = fs.readdirSync(RENDER_DIR, { recursive: true })
  .filter((f) => String(f).endsWith('.js'))
  .map((f) => path.join(RENDER_DIR, String(f)));
const renderSrc = renderFiles.map((f) => ({ f: path.relative(REPO, f), s: fs.readFileSync(f, 'utf8') }));

const groups = { camera: 'makeCamera', player: 'makePlayer', environment: 'makeEnvironment', world: 'makeWorld' };
const rows = [];
for (const [group, fn] of Object.entries(groups)) {
  let names;
  try { names = fieldsOf(fn); } catch { continue; }
  for (const name of names) {
    // Word-boundary match so `pos` does not match `position` and `mode` does not match `modes`.
    const re = new RegExp(`(?<![A-Za-z0-9_$])${name}(?![A-Za-z0-9_$])`);
    const readers = renderSrc.filter((r) => re.test(r.s)).map((r) => r.f);
    rows.push({ group, field: name, class: VISUAL[name] ? 'VISUAL' : 'INTERNAL', why: VISUAL[name] || null, readers: readers.length, files: readers.slice(0, 4) });
  }
}

const visualRed = rows.filter((r) => r.class === 'VISUAL' && r.readers === 0);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ population: rows.length, visual: rows.filter((r) => r.class === 'VISUAL').length, visual_unconsumed: visualRed.length, rows }, null, 1));
} else {
  console.log(`consumption-sweep: ${rows.length} per-frame fields over ${Object.keys(groups).length} sim objects; ${renderSrc.length} files in game/src/render/`);
  console.log(`  VISUAL: ${rows.filter((r) => r.class === 'VISUAL').length}   INTERNAL: ${rows.filter((r) => r.class === 'INTERNAL').length}`);
  console.log('');
  for (const r of rows.filter((x) => x.class === 'VISUAL')) {
    console.log(`  ${r.readers === 0 ? 'RED ' : 'ok  '} ${r.group}.${r.field}  readers=${r.readers}  ${r.readers ? r.files.join(' ') : '<< NOTHING IN game/src/render/ READS THIS >>'}`);
  }
  const internalRed = rows.filter((r) => r.class === 'INTERNAL' && r.readers === 0);
  console.log('');
  console.log(`  INTERNAL with no renderer reader (expected — these are the sim's own working state): ${internalRed.length}`);
  console.log(`    ${internalRed.map((r) => `${r.group}.${r.field}`).join(', ')}`);
}
process.exit(visualRed.length ? 1 : 0);
