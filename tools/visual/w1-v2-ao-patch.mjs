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
 *
 * Both text blocks below are LITERAL, hardcoded strings, not extracted from the live file at run
 * time — the first version of this tool extracted the "fixed" block from the live file, which
 * only works when the file is ALREADY fixed; running --revert then --apply back to back produced
 * a file with the literal text "null" spliced in. Caught by this file's own round-trip self-test
 * (node tools/visual/w1-v2-ao-patch.mjs --self-test), not shipped broken.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.ES_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const TARGET = path.join(ROOT, 'game/src/render/post/composite.js');
const CHECK = process.argv.includes('--check');
const REVERT = process.argv.includes('--revert');
const APPLY = process.argv.includes('--apply');
const SELFTEST = process.argv.includes('--self-test');
if (!CHECK && !REVERT && !APPLY && !SELFTEST) { console.error('usage: w1-v2-ao-patch.mjs --check|--revert|--apply|--self-test'); process.exit(2); }

const MARKER = 'W1-V2';

// ---- the four edits, as (baseline -> fixed) pairs, both sides literal -------------------------
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
      uAORadius: { value: 0.42 }, uAOStrength: { value: 3.1 }, uAOBias: { value: 0.03 },
      uAOMaxOcclusion: { value: 0.6 },
      uBloom: { value: 0.16 }, uBloomThreshold: { value: 0.9 }, uBloomKnee: { value: 0.45 },`,
  },
  {
    id: 'uniform-decl-glsl',
    baseline: `    uniform float uBalance, uContrast, uPivot, uSat, uVignette, uVignInner, uVignOuter;`,
    fixed: `    uniform float uBalance, uContrast, uPivot, uSat, uVignette, uVignInner, uVignOuter;
    uniform mat4 uProjMat, uInvProjMat;
    uniform float uAORadius, uAOStrength, uAOBias, uAOMaxOcclusion;`,
  },
  {
    id: 'ao-functions-block',
    baseline: `    float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

    void main(){`,
    fixed: `    float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

    // ---- W1-V2: real screen-space ambient occlusion / contact shadow ------------------------
    // Replaces the old depth-DISCONTINUITY detector, which only darkened a hard silhouette edge
    // (an object against distant background) and could not see a CONTINUOUS-depth contact — the
    // exact case the blind judges named 5/5: a step meeting a path, a wall meeting the ground,
    // an eave. Both are the same surface locally (no depth cliff), so the old edge test
    // (d*4-ring)*22, clamped to a 12% cap, reads them as flat and fires nothing. A hemisphere
    // kernel around the true
    // view-space position, tested against nearby occluder depth, darkens exactly a concave
    // JUNCTION rather than a silhouette — which is what "contact shadow" means.
    //
    // No G-buffer normal exists in this pipeline (single HDR colour + depth target), so the
    // surface normal is estimated from the screen-space derivative of the reconstructed
    // view-space position itself, cross(dFdx(P), dFdy(P)) — the standard normal-free SSAO
    // trick. AO is computed from vUv directly (not a moved/blurred uv), so the derivative stays
    // well-defined at the pixel it is shading.
    vec3 viewPosFromDepth(vec2 uv, float depth){
      vec4 ndc = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 vp = uInvProjMat * ndc;
      return vp.xyz / vp.w;
    }

    // Ten-tap hemisphere kernel, hand-generated once (seeded RNG, biased toward the origin so
    // more samples fall close to the surface, where a contact gap actually is) and hardcoded —
    // deterministic across frames and platforms, which the dither above is already a gate for.
    vec3 aoKernel(int i){
      if(i==0) return vec3(-0.1009,0.0393,0.1038);
      if(i==1) return vec3(0.0979,-0.0304,0.1209);
      if(i==2) return vec3(0.1596,0.0770,0.0495);
      if(i==3) return vec3(-0.0051,-0.2184,0.0598);
      if(i==4) return vec3(-0.0120,-0.1720,0.2282);
      if(i==5) return vec3(0.0267,-0.3187,0.1706);
      if(i==6) return vec3(-0.2714,-0.3250,0.1693);
      if(i==7) return vec3(-0.3139,0.3833,0.2748);
      if(i==8) return vec3(0.2986,0.2934,0.5535);
      return vec3(-0.0836,-0.1737,0.8160);
    }

    float computeAO(vec2 uv, float depth){
      vec3 P = viewPosFromDepth(uv, depth);
      vec3 dx = dFdx(P), dy = dFdy(P);
      vec3 N = normalize(cross(dx, dy));
      // View space looks down -Z, so a surface facing the camera has a normal pointing back
      // toward the eye, i.e. +Z. Getting this sign wrong points every kernel sample INTO the
      // surface instead of out over it, so nearly every sample reads as occluded — measured,
      // full-frame black, before this line was flipped from testing N.z > 0.0.
      if (N.z < 0.0) N = -N;
      vec3 up = (abs(N.z) < 0.98) ? vec3(0., 0., 1.) : vec3(1., 0., 0.);
      vec3 T = normalize(cross(up, N));
      vec3 B = cross(N, T);
      // Rotate the kernel per-pixel with the same static hash the dither pass uses, so ten taps
      // read as a soft hemisphere rather than ten fixed screen-space stripes.
      float ang = ign(uv * uResolution) * 6.2831853;
      float ca = cos(ang), sa = sin(ang);
      float occlusion = 0.0;
      for (int i = 0; i < 10; i++) {
        vec3 k = aoKernel(i);
        vec2 kr = vec2(k.x * ca - k.y * sa, k.x * sa + k.y * ca);
        vec3 samplePos = P + (T * kr.x + B * kr.y + N * k.z) * uAORadius;
        vec4 clip = uProjMat * vec4(samplePos, 1.0);
        if (clip.w <= 0.0) continue;
        vec2 sUV = (clip.xy / clip.w) * 0.5 + 0.5;
        if (sUV.x < 0.0 || sUV.x > 1.0 || sUV.y < 0.0 || sUV.y > 1.0) continue;
        float sd = texture2D(tDepth, sUV).r;
        if (sd > 0.99999) continue;             // sky — nothing to occlude against
        vec3 SP = viewPosFromDepth(sUV, sd);
        float rangeCheck = smoothstep(0.0, 1.0, uAORadius / max(abs(P.z - SP.z), 1e-4));
        occlusion += (SP.z >= samplePos.z + uAOBias) ? rangeCheck : 0.0;
      }
      // Capped below 1.0 (see uAOMaxOcclusion): on real low-poly ground the per-pixel normal is
      // reconstructed from a ONE-PIXEL depth derivative, so it faithfully reads every terrain
      // triangle's own flat facet rather than a smoothed vertex normal — measured on a real
      // settlement ground plane, this reads as a hard black-diamond checker at full strength.
      // The cap keeps a genuine object/ground contact reading clearly darker without letting
      // ordinary bumpy terrain crush to solid black. See the instrument's production-scene note.
      return clamp(occlusion / 10.0 * uAOStrength, 0.0, uAOMaxOcclusion);
    }

    void main(){`,
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

function report(live) {
  const hasMarker = live.includes(MARKER);
  const rows = EDITS.map((e) => {
    const wantFixed = live.includes(e.fixed);
    const wantBaseline = live.includes(e.baseline) && !wantFixed;
    return { id: e.id, state: wantFixed ? 'fixed' : (wantBaseline ? 'baseline' : 'UNRECOGNISED — anchor moved') };
  });
  return { hasMarker, rows, allFixed: rows.every((r) => r.state === 'fixed'), allBaseline: rows.every((r) => r.state === 'baseline') };
}

function doRevert(file) {
  const live = fs.readFileSync(file, 'utf8');
  const status = report(live);
  if (status.allBaseline) return { ok: true, note: 'already at baseline — nothing to do' };
  if (!status.allFixed) return { ok: false, error: 'one or more anchors did not match the known fixed text', status };
  let out = live;
  for (const e of EDITS) {
    if (!out.includes(e.fixed)) return { ok: false, error: `mid-way: ${e.id} anchor not found during rewrite` };
    out = out.replace(e.fixed, e.baseline);
  }
  if (out.includes(MARKER)) return { ok: false, error: `REVERT DID NOT FULLY APPLY — marker ${MARKER} still present. NOT A CONTROL.` };
  fs.writeFileSync(file, out);
  return { ok: true, note: `REVERT applied to ${file}` };
}

function doApply(file) {
  const live = fs.readFileSync(file, 'utf8');
  const status = report(live);
  if (status.allFixed) return { ok: true, note: 'already fixed — nothing to do' };
  if (!status.allBaseline) return { ok: false, error: 'one or more anchors did not match the known baseline text', status };
  let out = live;
  for (const e of EDITS) out = out.replace(e.baseline, e.fixed);
  if (!out.includes(MARKER)) return { ok: false, error: 'APPLY DID NOT WORK — marker missing after rewrite' };
  fs.writeFileSync(file, out);
  return { ok: true, note: `APPLY (re-fix) written to ${file}` };
}

if (SELFTEST) {
  // Proves the round trip on a SCRATCH copy, never on the real repo file, and proves double-apply
  // and double-revert are both no-ops rather than corrupting anchors.
  const os = await import('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'w1-v2-ao-patch-selftest-'));
  const scratch = path.join(tmp, 'composite.js');
  fs.mkdirSync(path.dirname(scratch), { recursive: true });
  fs.copyFileSync(TARGET, scratch);
  const originalFixed = fs.readFileSync(scratch, 'utf8');
  const arms = [];
  let r = doRevert(scratch); arms.push(['revert-1', r]);
  const afterRevert = fs.readFileSync(scratch, 'utf8');
  arms.push(['revert-has-no-marker', { ok: !afterRevert.includes(MARKER) }]);
  r = doRevert(scratch); arms.push(['revert-2-is-noop', { ok: r.ok && /already at baseline/.test(r.note || '') }]);
  r = doApply(scratch); arms.push(['apply-1', r]);
  const afterApply = fs.readFileSync(scratch, 'utf8');
  arms.push(['apply-roundtrips-byte-identical', { ok: afterApply === originalFixed }]);
  r = doApply(scratch); arms.push(['apply-2-is-noop', { ok: r.ok && /already fixed/.test(r.note || '') }]);
  fs.rmSync(tmp, { recursive: true, force: true });
  let allOk = true;
  for (const [id, res] of arms) { console.log(`${res.ok ? 'PASS' : 'FAIL'}  ${id}${res.error ? '  — ' + res.error : ''}`); if (!res.ok) allOk = false; }
  process.exit(allOk ? 0 : 1);
}

const status = report(fs.readFileSync(TARGET, 'utf8'));
console.log(JSON.stringify(status, null, 2));

if (CHECK) process.exit(status.allFixed || status.allBaseline ? 0 : 1);
if (REVERT) { const r = doRevert(TARGET); console.log(r.note || r.error); process.exit(r.ok ? 0 : 1); }
if (APPLY) { const r = doApply(TARGET); console.log(r.note || r.error); process.exit(r.ok ? 0 : 1); }
