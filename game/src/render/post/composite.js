// W1-30A — the frame pipeline. Owned by W1-30A (`render/renderer.js`, `render/post/**`).
//
// History: W1-30S moved this out of `renderer.js` verbatim so that A could own it alone. This
// commit is the first one that changes what it DOES. Four things are different and each is
// separately switchable, so each can be proved to be doing something by turning it off:
//
//  1. MSAA. `worldTarget` now carries `samples`. Before this, `renderer.js` asked the WebGL
//     CONTEXT for `antialias: true` and then rendered the entire world into an offscreen target
//     — and a context's multisampling applies only to the default framebuffer. The game shipped
//     with no antialiasing of any kind. This is the largest single defect in the frame and it is
//     invisible in a still, because what aliasing costs you is a silhouette that CRAWLS when the
//     camera moves. See `orchestration/plans/W1-30A.md`, "Where we are, precisely", row 1.
//
//  2. A real edge pass instead of the depth-blur that stood in for one. The old `uAA` branch
//     compared the depth of four neighbours and, on a hit, blended them in at `edge * 0.38`. That
//     construction cannot see a colour edge at constant depth (a painted doorframe), cannot see
//     an alpha-tested edge (every leaf in the province, whose depth is written by the whole quad),
//     and against sky the depth delta saturates so it smears the horizon instead of resolving it.
//     Replaced by a luma-directed FXAA, which is aimed at exactly the edges MSAA cannot reach:
//     alpha-test cutouts and specular sparkle. The plan named SMAA; see `SUBSTITUTION` below.
//
//  3. A grade that is a grade — `post/grade.js`, driven per region, per time of day, per weather.
//     What was here was `saturation x 1.035`.
//
//  4. Ordered dither at the output, +/-0.5 LSB, after the colour-space transform. Sky and fog are
//     smooth ramps over hundreds of pixels and 8-bit sRGB cannot hold them; every sky in the game
//     banded. One line.
//
// SUBSTITUTION, recorded rather than hidden (plan §2 asked for SMAA, vendored from the r180
// addons). SMAA needs two precomputed lookup textures shipped as ~100 KB of base64 inside the
// addon, a three-pass ping-pong, and its own render targets; FXAA is one branch inside a pass that
// already exists and costs one texture fetch set. With MSAA carrying the geometric silhouettes —
// which is the whole reason MSAA went in first and alone — what is left for the post pass is
// cutout and specular edges, where FXAA and SMAA are close. If the motion gate below fails, the
// escalation is SMAA and then TAA, in that order, and the plan's reasoning for *not* starting at
// TAA (history invalidation on cuts, teleports, resize, cell changes, animated foliage) still
// stands.
//
// ORDER, and why. AA -> AO -> bloom -> white balance -> vignette -> ACES -> sRGB -> grade ->
// dither. The creative grade is display-referred, so it runs AFTER the tonemap and after the
// colour-space transform, which is where lift/gamma/gain and split-toning are defined; the white
// balance is a physical operation, so it runs before. There is exactly one tonemap in the frame
// (`#include <tonemapping_fragment>`, from `renderer.toneMapping`) and this file adds no second
// one — "double tone-mapping" is a hard fail in the plan.
'use strict';

import * as THREE from '../../../vendor/three/three.module.js';
import { identityGrade } from './grade.js';

/** MSAA sample counts per quality tier, before the device's own `MAX_SAMPLES` clamps them.
 * `high` is 4, not 8: `worldTarget` is HalfFloat, so a 1920x1080 8x multisample colour buffer is
 * 133 MB of bandwidth per resolve before depth. 8 is available through `samples` for a device that
 * reports it and a caller that asks; the plan's "8x where the device reports it" is a knob here,
 * not a default, because the measurement that would justify it is the frame budget on the T4 and
 * that is the one number this builder could not take on every Deck vista. */
export const MSAA_BY_TIER = { high: 4, medium: 2, low: 0 };

/**
 * Build the HDR world target and the fullscreen composite.
 *
 * @param {number} w
 * @param {number} h
 * @param {object} [opts]
 * @param {number} [opts.samples]  MSAA samples on the world target. 0 disables (the null control).
 * @param {number} [opts.maxSamples]  device `MAX_SAMPLES`; `samples` is clamped to it.
 */
export function buildCompositor(w, h, opts = {}) {
  const maxSamples = Number.isFinite(opts.maxSamples) ? Math.max(0, opts.maxSamples | 0) : 4;
  const samples = Math.max(0, Math.min(maxSamples, Number.isFinite(opts.samples) ? opts.samples | 0 : MSAA_BY_TIER.high));

  // Preserve scene-linear HDR until the final composite. An sRGB 8-bit target clipped the
  // highlights before bloom and the fullscreen ShaderMaterial then bypassed ACES entirely.
  //
  // `samples` is the fix for defect 1. `resolveDepthBuffer` is left at its default (true) on
  // purpose: three blits DEPTH_BUFFER_BIT alongside colour in `updateMultisampleRenderTarget`,
  // so `depthTexture` below stays readable by the AO ring after the resolve. Turning it off is
  // the standard "we only wanted colour" optimisation and it would silently break AO here.
  const worldTarget = new THREE.WebGLRenderTarget(w,h,{ depthBuffer: true, stencilBuffer: false, type: THREE.HalfFloatType, samples });
  worldTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
  worldTarget.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
  worldTarget.texture.name = 'w1-30-hdr-world-colour';
  worldTarget.depthTexture.name = 'w1-30-world-depth';

  const g = identityGrade();
  const compositeMaterial = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: true,
    uniforms: {
      tWorld: { value: worldTarget.texture }, tDepth: { value: worldTarget.depthTexture },
      uResolution: { value: new THREE.Vector2(w, h) },
      // The three original sabotage switches, unchanged in name and meaning so every existing
      // tool that flips them (`tools/render/w1-30-*.mjs`) keeps working.
      uAO: { value: 1 }, uAA: { value: 1 }, uPost: { value: 1 },
      // New switches. Each is a null control for exactly one of this commit's changes.
      uDither: { value: 1 }, uGradeOn: { value: 1 },
      // W1-V2 — real screen-space ambient occlusion. `uAO` above is unchanged in name and
      // meaning (still the on/off sabotage switch every existing tool flips); what changed is
      // what happens when it is 1. `uInvProjMat` reconstructs a view-space position from the
      // depth buffer alone (no G-buffer normal exists, so the normal is estimated from the
      // position's own screen-space derivative — see `computeAO` below); `uProjMat` re-projects
      // each hemisphere-kernel sample back to screen space to read its occluder depth. Both are
      // pushed every frame by `renderer.js` from `camera.projectionMatrix`/`.projectionMatrixInverse`;
      // the identity default here is inert until the first frame feeds it, matching the grade
      // block's own convention above.
      uProjMat: { value: new THREE.Matrix4() }, uInvProjMat: { value: new THREE.Matrix4() },
      // World-space (metres) sample radius and darkening strength/bias. Defaults tuned for a
      // human-scale contact gap (a boot sole, a step riser); `w1-v2-contact-ao.mjs` is the
      // instrument that proves the acceptance bar (RI-VIS04 §4 / RI-VIS03 M6b: contact junction
      // >=25% darker than open ground) rather than this comment.
      uAORadius: { value: 0.16 }, uAOStrength: { value: 2.6 }, uAOBias: { value: 0.02 },
      uBloom: { value: 0.16 }, uBloomThreshold: { value: 0.9 }, uBloomKnee: { value: 0.45 },
      // The grade block. Pushed every frame by `renderer.js` from `post/grade.js`; the identity
      // values here mean a compositor built and never fed is a no-op rather than a colour cast.
      uLift: { value: new THREE.Vector3(...g.lift) },
      uGain: { value: new THREE.Vector3(...g.gain) },
      uInvGamma: { value: new THREE.Vector3(...g.invGamma) },
      uShadowTint: { value: new THREE.Vector3(...g.shadowTint) },
      uHighlightTint: { value: new THREE.Vector3(...g.highlightTint) },
      uMix: { value: new THREE.Matrix3() },
      uBalance: { value: g.balance }, uContrast: { value: g.contrast }, uPivot: { value: g.pivot },
      uSat: { value: g.saturation },
      uVignette: { value: g.vignette }, uVignInner: { value: g.vignetteInner }, uVignOuter: { value: g.vignetteOuter },
    },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: /* glsl */`
    varying vec2 vUv;
    uniform sampler2D tWorld, tDepth;
    uniform vec2 uResolution;
    uniform float uAO, uAA, uPost, uDither, uGradeOn;
    uniform float uBloom, uBloomThreshold, uBloomKnee;
    uniform vec3 uLift, uGain, uInvGamma, uShadowTint, uHighlightTint;
    uniform mat3 uMix;
    uniform float uBalance, uContrast, uPivot, uSat, uVignette, uVignInner, uVignOuter;
    uniform mat4 uProjMat, uInvProjMat;
    uniform float uAORadius, uAOStrength, uAOBias;

    const vec3 LUMA = vec3(.2126, .7152, .0722);

    // Perceptual luma for an UNBOUNDED linear value. A raw dot product puts a specular highlight
    // at 40.0 and the sky at 3.0, and every threshold below then fires on the sky. The Reithard
    // compression maps 0..inf onto 0..1 so the FXAA thresholds mean the same thing in a cave and
    // in noon sun, which is the only way one constant can serve both.
    float lum(vec3 c){ float l = dot(max(c, 0.), LUMA); return l / (1. + l); }

    // ---- FXAA (defect 2) --------------------------------------------------------------------
    // The classic luma-directed variant: find the local luma range, bail on flat areas, derive the
    // edge direction from the four diagonals, and blend along it. Two candidate blends are formed
    // and the wider one is rejected if it left the local luma range, which is what stops FXAA from
    // eating a one-pixel-wide bright detail (a lamp flame, a rain streak) that is not an edge.
    #define FXAA_SPAN 6.0
    #define FXAA_REDUCE_MUL 0.125
    #define FXAA_REDUCE_MIN 0.0078125
    #define FXAA_EDGE_MIN 0.028
    #define FXAA_EDGE_MUL 0.150
    vec3 fxaa(vec2 uv, vec2 px){
      vec3 cM = texture2D(tWorld, uv).rgb;
      float lM  = lum(cM);
      float lNW = lum(texture2D(tWorld, uv + vec2(-1., -1.) * px).rgb);
      float lNE = lum(texture2D(tWorld, uv + vec2( 1., -1.) * px).rgb);
      float lSW = lum(texture2D(tWorld, uv + vec2(-1.,  1.) * px).rgb);
      float lSE = lum(texture2D(tWorld, uv + vec2( 1.,  1.) * px).rgb);
      float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
      float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
      float range = lMax - lMin;
      if (range < max(FXAA_EDGE_MIN, lMax * FXAA_EDGE_MUL)) return cM;
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
      float reduce = max((lNW + lNE + lSW + lSE) * .25 * FXAA_REDUCE_MUL, FXAA_REDUCE_MIN);
      float rcpMin = 1. / (min(abs(dir.x), abs(dir.y)) + reduce);
      dir = clamp(dir * rcpMin, -FXAA_SPAN, FXAA_SPAN) * px;
      vec3 a = .5 * (texture2D(tWorld, uv + dir * (1. / 3. - .5)).rgb
                   + texture2D(tWorld, uv + dir * (2. / 3. - .5)).rgb);
      vec3 b = a * .5 + .25 * (texture2D(tWorld, uv + dir * -.5).rgb
                             + texture2D(tWorld, uv + dir *  .5).rgb);
      float lB = lum(b);
      return (lB < lMin || lB > lMax) ? a : b;
    }

    // ---- the grade (defect 3), display-referred ----------------------------------------------
    // Lift/gain/gamma, then a split-tone that rotates shadows one way and highlights the other,
    // then contrast about a pivot below mid-grey, then saturation. Order matters: saturation last
    // means the contrast expansion does not also pump chroma, which is what makes a naive grade
    // look like a phone filter.
    vec3 grade(vec3 c){
      c = clamp(c * uGain + uLift, 0., 1.);
      c = pow(c, uInvGamma);
      float l = dot(c, LUMA);
      c *= mix(uShadowTint, uHighlightTint, smoothstep(0., 1., pow(l, uBalance)));
      c = clamp((c - uPivot) * uContrast + uPivot, 0., 1.);
      float l2 = dot(c, LUMA);
      return clamp(mix(vec3(l2), c, uSat), 0., 1.);
    }

    // Interleaved gradient noise: one hash, no texture, no temporal term. Static on purpose —
    // an animated dither is better at hiding banding and would make every frame hash unstable,
    // and determinism ("same seed -> identical frame hash") is a gate.
    float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

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
      return clamp(occlusion / 10.0 * uAOStrength, 0.0, 1.0);
    }

    void main(){
      vec2 p = 1. / uResolution;
      vec3 c = (uAA > .5) ? fxaa(vUv, p) : texture2D(tWorld, vUv).rgb;
      float d = texture2D(tDepth, vUv).r;

      float occ = 1.;
      if (uAO > .5 && d < .9999) {
        occ = 1. - computeAO(vUv, d);
      }
      c *= occ;

      if (uPost > .5) {
        // Three rings rather than one. At 1080p the old single ring was 2 px wide, which is a
        // halo nobody can see; a light source has to spill across a dozen pixels before it reads
        // as light rather than as a bright texel. Still not the 5-mip chain the plan asks for.
        vec3 b = vec3(0.);
        for (int i = 0; i < 3; i++) {
          float r = 2. + float(i) * 4.5;
          vec3 s = texture2D(tWorld, vUv + vec2(p.x * r, 0.)).rgb + texture2D(tWorld, vUv - vec2(p.x * r, 0.)).rgb
                 + texture2D(tWorld, vUv + vec2(0., p.y * r)).rgb + texture2D(tWorld, vUv - vec2(0., p.y * r)).rgb;
          b += s * .25 * (1. - float(i) * .28);
        }
        b /= 2.16;
        // Soft knee: a hard threshold makes a light source pop into existence as it brightens,
        // which is visible as flicker on anything animated (a flame, a spell).
        float bl = dot(b, LUMA);
        float soft = clamp(bl - uBloomThreshold + uBloomKnee, 0., 2. * uBloomKnee);
        soft = soft * soft / (4. * uBloomKnee + 1e-4);
        float contrib = max(soft, bl - uBloomThreshold) / max(bl, 1e-4);
        c += b * contrib * uBloom;

        c = uMix * c;                                   // white balance, linear, pre-tonemap
        c *= 1. - smoothstep(uVignInner, uVignOuter, length(vUv - .5)) * uVignette;
      }
      gl_FragColor = vec4(c, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      if (uGradeOn > .5) gl_FragColor.rgb = grade(gl_FragColor.rgb);
      // Dither LAST, after the colour-space conversion, because banding is a property of the
      // 8-bit encoding and nothing else. +/-0.5 LSB is exactly enough to break a flat run and
      // not enough to be visible as noise.
      if (uDither > .5) gl_FragColor.rgb += (ign(gl_FragCoord.xy) - .5) / 255.;
    }`,
  });

  const compositeScene = new THREE.Scene();
  const compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  compositeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compositeMaterial));
  return { worldTarget, compositeMaterial, compositeScene, compositeCamera, samples };
}

/** Push a resolved grade (`post/grade.js`) into a compositor's uniforms. Kept here rather than in
 * `renderer.js` so that any other consumer of the grade — a reference-plate renderer, a settings
 * preview — applies it through the same code the game does. */
export function applyGrade(compositeMaterial, g) {
  const u = compositeMaterial.uniforms;
  u.uLift.value.set(g.lift[0], g.lift[1], g.lift[2]);
  u.uGain.value.set(g.gain[0], g.gain[1], g.gain[2]);
  u.uInvGamma.value.set(g.invGamma[0], g.invGamma[1], g.invGamma[2]);
  u.uShadowTint.value.set(g.shadowTint[0], g.shadowTint[1], g.shadowTint[2]);
  u.uHighlightTint.value.set(g.highlightTint[0], g.highlightTint[1], g.highlightTint[2]);
  // THREE.Matrix3.set is row-major and `g.mix` is written row-major, so this is a straight copy.
  u.uMix.value.set(g.mix[0], g.mix[1], g.mix[2], g.mix[3], g.mix[4], g.mix[5], g.mix[6], g.mix[7], g.mix[8]);
  u.uBalance.value = g.balance; u.uContrast.value = g.contrast; u.uPivot.value = g.pivot;
  u.uSat.value = g.saturation;
  u.uVignette.value = g.vignette; u.uVignInner.value = g.vignetteInner; u.uVignOuter.value = g.vignetteOuter;
  return g;
}
