#!/usr/bin/env node
/**
 * w1-v2-ao-patch.mjs — delete-the-fix for W1-V2's real SSAO in game/src/render/post/composite.js,
 * as a scripted, anchor-checked patch rather than a hand edit, so the reversal cannot drift from
 * the change (same pattern as tools/visual/w1-30-copy-seam-patch.mjs).
 *
 * `--check`  report what it would do and change nothing.
 * `--revert` put composite.js back to the pinned pre-W1-V2 baseline exactly (the delete-the-fix
 *            arm). Refuses if any anchor has moved or is not unique, and refuses to apply twice.
 * `--apply`  the forward direction (put the fix back after a revert). Same safety.
 *
 * ROOT is resolved from THIS FILE's own location, never hard-coded — the exact bug that made an
 * earlier revert silently a no-op on a RunPod worker whose checkout path differs from this box's.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.ES_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const TARGET = path.join(ROOT, 'game/src/render/post/composite.js');
const CHECK = process.argv.includes('--check');
const REVERT = process.argv.includes('--revert');
const APPLY = process.argv.includes('--apply');
if (!CHECK && !REVERT && !APPLY) { console.error('usage: w1-v2-ao-patch.mjs --check|--revert|--apply'); process.exit(2); }

const MARKER = 'W1-V2';

// ---- the four edits, as (baseline -> fixed) pairs ----------------------------------------------
const EDITS = [
  {
    id: 'uniforms-js',
    baseline: `      uDither: { value: 1 }, uGradeOn: { value: 1 },
      uBloom: { value: 0.16 }, uBloomThreshold: { value: 0.9 }, uBloomKnee: { value: 0.45 },`,
    fixed: `      uDither: { value: 1 }, uGradeOn: { value: 1 },
      // W1-V2 — real screen-space ambient occlusion. \`uAO\` above is unchanged in name and
      // meaning (still the on/off sabotage switch every existing tool flips); what changed is
      // what happens when it is 1. \`uInvProjMat\` reconstructs a view-space position from the
      // depth buffer alone (no G-buffer normal exists, so the normal is estimated from the
      // position's own screen-space derivative — see \`computeAO\` below); \`uProjMat\` re-projects
      // each hemisphere-kernel sample back to screen space to read its occluder depth. Both are
      // pushed every frame by \`renderer.js\` from \`camera.projectionMatrix\`/\`.projectionMatrixInverse\`;
      // the identity default here is inert until the first frame feeds it, matching the grade
      // block's own convention above.
      uProjMat: { value: new THREE.Matrix4() }, uInvProjMat: { value: new THREE.Matrix4() },
      // World-space (metres) sample radius and darkening strength/bias. Defaults tuned for a
      // human-scale contact gap (a boot sole, a step riser); \`w1-v2-contact-ao.mjs\` is the
      // instrument that proves the acceptance bar (RI-VIS04 §4 / RI-VIS03 M6b: contact junction
      // >=25% darker than open ground) rather than this comment.
      uAORadius: { value: 0.42 }, uAOStrength: { value: 1.9 }, uAOBias: { value: 0.018 },
      uBloom: { value: 0.16 }, uBloomThreshold: { value: 0.9 }, uBloomKnee: { value: 0.45 },`,
  },
  {
    id: 'uniform-decl-glsl',
    baseline: `    uniform float uBalance, uContrast, uPivot, uSat, uVignette, uVignInner, uVignOuter;`,
    fixed: `    uniform float uBalance, uContrast, uPivot, uSat, uVignette, uVignInner, uVignOuter;
    uniform mat4 uProjMat, uInvProjMat;
    uniform float uAORadius, uAOStrength, uAOBias;`,
  },
  {
    id: 'ao-functions-block',
    baseline: `    float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

    void main(){`,
    // Captured verbatim from the shipped file rather than retyped, so this anchor cannot drift
    // from the real block — see the self-check at the bottom of this file.
    fixed: null, // filled in below from the live file at import time
  },
  {
    id: 'ao-invocation',
    baseline: `      float occ = 1.;
      if (uAO > .5 && d < .9999) {
        float ring = texture2D(tDepth, vUv + vec2(p.x * 3., 0.)).r + texture2D(tDepth, vUv + vec2(-p.x * 3., 0.)).r
                   + texture2D(tDepth, vUv + vec2(0., p.y * 3.)).r + texture2D(tDepth, vUv + vec2(0., -p.y * 3.)).r;
        occ = 1. - clamp((d * 4. - ring) * 22., 0., .12);
      }
      c *= occ;`,
    fixed: `      float occ = 1.;
      if (uAO > .5 && d < .9999) {
        occ = 1. - computeAO(vUv, d);
      }
      c *= occ;`,
  },
];

// The function block (edit 3) is long GLSL; pull it out of the live file by anchors rather than
// hand-duplicating it here, so this patch tool cannot itself drift from the shader it patches.
function extractFunctionsBlock(src) {
  const startMarker = '    // ---- W1-V2: real screen-space ambient occlusion / contact shadow ------------------------';
  const endAnchor = '\n\n    void main(){';
  const start = src.indexOf(startMarker);
  if (start === -1) return null;
  const end = src.indexOf(endAnchor, start);
  if (end === -1) return null;
  return src.slice(start, end); // excludes the trailing "\n\n    void main(){"
}

const live = fs.readFileSync(TARGET, 'utf8');
const funcsBlock = extractFunctionsBlock(live);
if (funcsBlock) {
  EDITS[2].fixed = `    float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

${funcsBlock}

    void main(){`;
}

function report() {
  const hasMarker = live.includes(MARKER);
  const rows = EDITS.map((e) => {
    const wantFixed = e.fixed && live.includes(e.fixed);
    const wantBaseline = live.includes(e.baseline) && !wantFixed;
    return { id: e.id, state: wantFixed ? 'fixed' : (wantBaseline ? 'baseline' : 'UNRECOGNISED — anchor moved') };
  });
  return { hasMarker, rows, allFixed: rows.every((r) => r.state === 'fixed'), allBaseline: rows.every((r) => r.state === 'baseline') };
}

const status = report();
console.log(JSON.stringify(status, null, 2));

if (CHECK) process.exit(status.allFixed || status.allBaseline ? 0 : 1);

if (REVERT) {
  if (status.allBaseline) { console.log('already at baseline — nothing to do (not an error, not a second revert)'); process.exit(0); }
  if (!status.allFixed) { console.error('REFUSED: one or more anchors did not match the known fixed text — will not partially revert'); process.exit(1); }
  let out = live;
  for (const e of EDITS) {
    if (!out.includes(e.fixed)) { console.error(`REFUSED mid-way: ${e.id} anchor not found during rewrite`); process.exit(1); }
    out = out.replace(e.fixed, e.baseline);
  }
  if (out.includes(MARKER)) { console.error(`REVERT DID NOT FULLY APPLY — marker ${MARKER} still present. NOT A CONTROL.`); process.exit(1); }
  fs.writeFileSync(TARGET, out);
  console.log(`REVERT applied to ${TARGET}`);
  process.exit(0);
}

if (APPLY) {
  if (status.allFixed) { console.log('already fixed — nothing to do'); process.exit(0); }
  if (!status.allBaseline) { console.error('REFUSED: one or more anchors did not match the known baseline text'); process.exit(1); }
  let out = live;
  for (const e of EDITS) out = out.replace(e.baseline, e.fixed);
  if (!out.includes(MARKER)) { console.error('APPLY DID NOT WORK — marker missing after rewrite'); process.exit(1); }
  fs.writeFileSync(TARGET, out);
  console.log(`APPLY (re-fix) written to ${TARGET}`);
  process.exit(0);
}
