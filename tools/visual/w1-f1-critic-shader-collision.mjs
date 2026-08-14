#!/usr/bin/env node
/**
 * w1-f1-critic-shader-collision.mjs — the F1 critic's own instrument.
 *
 * WHY IT EXISTS. The F1 evidence pack (W1-ORPHANED-SURFACE-SHADERS) proves the surface pass is
 * re-installed on cloned materials, and its census reports 0 of 422 orphans. Both are true. But
 * the pack's own `hardware-ab/consumption-after/frames/player-yaw*-base.png` show the player's
 * BODY missing at all eight angles, while the equipment, frills, horns and eyes still draw. The
 * census cannot see that, because it asks whether a hook installs uniforms — not whether the
 * shader those hooks compose is a LEGAL PROGRAM.
 *
 * THE HYPOTHESIS THIS TESTS. On an actor body material two hooks now chain (they did not before
 * the fix, because `installWaterline` used to ASSIGN over the surface hook and delete it):
 *
 *   installSurfaceShader (visual-foundation.js) prepends:  uniform float uWetness;
 *   installWaterline     (actor.js)             prepends:  uniform float uWetness;
 *
 * Two declarations of one uniform in one fragment shader is a GLSL redefinition error, so the
 * program fails to link and the mesh draws nothing. Every other material on the actor skips
 * `installWaterline` and is therefore unaffected — which is exactly the pattern in the frames.
 *
 * HOW IT CAN FAIL, because a probe that cannot fail is worse than no probe (RULES rule 4):
 *   - If the composed shader declares `uWetness` once, DUPLICATE-UNIFORM-DECLARATION passes and
 *     the hypothesis is refuted.
 *   - If the body materials cannot be found at all, the run exits non-zero as INSTRUMENT-BLIND
 *     rather than reporting a clean sheet.
 *   - It re-runs itself against a control material that never goes through `installWaterline`
 *     (equipment / frill). That control MUST come back clean, or the probe is measuring the
 *     wrong thing and says so.
 *
 * Evidence class: this asks whether a shader SOURCE STRING is legal GLSL and whether the driver
 * reports a link error. That is renderer-independent, so a software backend is admissible here —
 * unlike an appearance claim. See `renderer-class.mjs`.
 *
 * Usage:  node tools/visual/w1-f1-critic-shader-collision.mjs [--out <dir>] [--gpu software]
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchForCapture, resolveGpuMode } from './lib/gpu-launch.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/f1-critic-shader-collision');
fs.mkdirSync(OUT, { recursive: true });

const { g, attestation } = await launchForCapture({
  mode: resolveGpuMode(args), requireHardware: false, entry: 'game/index.html', width: 960, height: 540,
});

// Capture EVERYTHING the page says. three.js reports a failed program link through
// console.error('THREE.WebGLProgram: Shader Error ...'), which never reaches `pageerror`.
const consoleLines = [];
g.page.on('console', (m) => consoleLines.push(`${m.type()}: ${m.text()}`));

await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 120000 });
await g.page.evaluate(async () => { await window.__HARNESS.ready?.(); });
await g.page.evaluate(async () => { await window.__HARNESS.stepFrames?.(24); });

const report = await g.page.evaluate(() => {
  const R = window.__ENGINE.renderer;
  // `__ENGINE.renderer` is the game's own wrapper, not THREE.WebGLRenderer. Find the real one so
  // program diagnostics are readable; if it cannot be found, say so rather than report a clean sheet.
  const GL = [R.gl, R.webgl, R.three, R.renderer, R.threeRenderer, window.__ENGINE.gl]
    .find((c) => c && c.properties && typeof c.properties.get === 'function') || null;
  const out = { body: [], control: [], meshes_found: 0, webgl_renderer_found: !!GL,
    renderer_wrapper_keys: Object.keys(R).slice(0, 40) };

  // Compose the real fragment shader the way the renderer does: run the material's own
  // onBeforeCompile against a stand-in carrying the chunks both hooks target.
  const STUB = () => ({
    uniforms: {},
    vertexShader: '#include <begin_vertex>\n#include <skinning_vertex>\n',
    fragmentShader: '#include <clipping_planes_fragment>\n#include <normal_fragment_maps>\n'
      + '#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <lights_physical_fragment>\n',
  });
  const countDecl = (src, name) => (src.match(new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`, 'g')) || []).length;

  const inspect = (m, mesh) => {
    const s = STUB();
    let threw = null;
    try { if (typeof m.onBeforeCompile === 'function') m.onBeforeCompile(s, GL || R); } catch (e) { threw = String(e && e.message || e); }
    const dupes = {};
    for (const n of ['uWetness', 'uWaterY', 'uWear', 'uWorldWetness', 'uDetailStrength', 'uWetTop', 'uWetBottom']) {
      const c = countDecl(s.fragmentShader, n);
      if (c > 1) dupes[n] = c;
    }
    // Did the driver actually reject this material's program?
    const props = GL ? (GL.properties.get(m) || {}) : {};
    const prog = props.currentProgram;
    return {
      mesh: mesh.name, material: m.name || m.type, visible: mesh.visible,
      threw, duplicate_declarations: dupes,
      program_diagnostics: prog && prog.diagnostics ? {
        runnable: prog.diagnostics.runnable,
        fragment_log: String(prog.diagnostics.fragmentShader?.log || '').slice(0, 400),
        vertex_log: String(prog.diagnostics.vertexShader?.log || '').slice(0, 400),
      } : null,
    };
  };

  if (!R.playerMesh) return { error: 'renderer.playerMesh missing' };
  R.playerMesh.traverse((o) => {
    if (!o.material) return;
    out.meshes_found++;
    for (const m of [].concat(o.material)) {
      if (!m) continue;
      // The body is the ONLY thing installWaterline touches (actor.js:607).
      if (/^actor-body:/.test(o.name || '')) out.body.push(inspect(m, o));
      else if (/^actor-(equipment|secondary-frill)/.test(o.name || '')) out.control.push(inspect(m, o));
    }
  });
  return out;
});

await g.page.evaluate(async () => { await window.__HARNESS.stepFrames?.(4); });
await g.close();

const shaderErrors = consoleLines.filter((l) => /Shader Error|WebGLProgram|redefinition|ERROR:/i.test(l));
const bodyDupes = (report.body || []).filter((r) => Object.keys(r.duplicate_declarations || {}).length > 0);
const ctrlDupes = (report.control || []).filter((r) => Object.keys(r.duplicate_declarations || {}).length > 0);

const checks = [
  { id: 'INSTRUMENT-FOUND-THE-BODY', ok: (report.body || []).length > 0,
    detail: `${(report.body || []).length} actor-body material(s) inspected across ${report.meshes_found} player meshes` },
  { id: 'CONTROL-IS-CLEAN', ok: (report.control || []).length > 0 && ctrlDupes.length === 0,
    detail: `${(report.control || []).length} equipment/frill material(s) inspected, ${ctrlDupes.length} with duplicate declarations `
      + '— these never pass through installWaterline, so a duplicate here would mean the probe is measuring the wrong seam' },
  { id: 'NO-DUPLICATE-UNIFORM-DECLARATION', ok: bodyDupes.length === 0,
    detail: bodyDupes.length === 0 ? 'no uniform is declared twice in any composed body fragment shader'
      : `${bodyDupes.length} body material(s) compose a fragment shader declaring a uniform twice: `
        + bodyDupes.map((r) => `${r.mesh} -> ${JSON.stringify(r.duplicate_declarations)}`).join('; ') },
  { id: 'NO-SHADER-ERROR-ON-THE-CONSOLE', ok: shaderErrors.length === 0,
    detail: shaderErrors.length === 0 ? 'the page reported no shader compile/link error'
      : `${shaderErrors.length} shader error line(s): ${shaderErrors.slice(0, 3).join(' | ').slice(0, 600)}` },
];

const manifest = { tool: 'w1-f1-critic-shader-collision', renderer: attestation, report, checks,
  console_shader_errors: shaderErrors.slice(0, 40), console_line_count: consoleLines.length };
fs.writeFileSync(path.join(OUT, 'shader-collision.json'), JSON.stringify(manifest, null, 2));
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.id}  — ${c.detail}`);
console.log(`written ${path.join(OUT, 'shader-collision.json')}`);
if (!checks[0].ok) { console.error('INSTRUMENT-BLIND: could not find the player body materials'); process.exit(3); }
process.exit(checks.every((c) => c.ok) ? 0 : 1);
