// W1-30A — the PRE-A compositor, kept verbatim, so that "before" and "after" can be measured on
// the same GPU, in the same process, on the same frames.
//
// WHY THIS FILE EXISTS AND WHY THAT IS NOT CHEATING. The defect A fixes is aliasing, and aliasing
// is a motion defect: a silhouette that looks fine in a still and crawls when the camera pans.
// Measuring it means capturing a sequence twice and differencing, and the two captures have to be
// of *the same frames* or the difference is dominated by the scene, not the change. Two commits on
// two Pod runs cannot give that: different Pod, different driver state, different wall clock.
// Holding the old pass here lets the harness flip between them inside one run.
//
// WHY IT IS NOT A SECOND IMPLEMENTATION OF ANYTHING THAT SHIPS. Nothing in the game calls this.
// `renderer.js` never imports it; only `tools/render/w1-30a-*.mjs` does, through
// `window.__ENGINE.renderer.registerComposite(buildBaselineCompositor(...))` on the page. If it
// ever drifts from the real pre-A code the check below fails, which is the whole point:
//
//   BASELINE_SHA is the sha256 of the fragment shader as it stood at 3b43ec6c — the last commit
//   in which `post/composite.js` still held the W1-30S seam version, i.e. the last frame this
//   game drew before A touched it. `tools/render/w1-30a-baseline-check.mjs` re-extracts that
//   shader from git and compares. A baseline you cannot prove is the baseline is not a baseline,
//   and this project has already certified one broken thing as fixed by trusting a comparison it
//   never checked.
//
//   (The commit id is not the seam commit's own id, and that is not an error. Banking on this
//   branch commits the whole working tree, so several agents' in-flight work rides in one commit
//   and "the commit that changed this file last" is the only identifier that means anything. The
//   check reads the FILE at that commit, so the sha is what settles it either way.)
//
// What it contains, for the reader who does not want to run git: an HDR world target with NO
// `samples` (hence no antialiasing anywhere in the frame), a depth-edge detector standing in for
// AA at `edge*0.38`, a 4-tap 2-pixel bloom, and a "grade" consisting of saturation x1.035,
// contrast x1.015 and a 0.075 vignette.
'use strict';

import * as THREE from '../../../vendor/three/three.module.js';

export const BASELINE_COMMIT = '3b43ec6c20a8acadb8b85306f97db476fa6abd03';
export const BASELINE_SHA = '5b70101d71efb48c1448b7b9ae37dcf4c2cdaed8c8c5bd86cfecc59fc43c936e';

export const BASELINE_FRAGMENT = `varying vec2 vUv; uniform sampler2D tWorld,tDepth; uniform vec2 uResolution; uniform float uAO,uAA,uPost;
    void main(){vec2 p=1./uResolution; vec3 c=texture2D(tWorld,vUv).rgb; float d=texture2D(tDepth,vUv).r;
      float dx=abs(d-texture2D(tDepth,vUv+vec2(p.x,0.)).r),dy=abs(d-texture2D(tDepth,vUv+vec2(0.,p.y)).r);
      float edge=clamp((dx+dy)*180.,0.,1.); if(uAA>.5&&edge>.08){vec3 n=(texture2D(tWorld,vUv+vec2(p.x,0.)).rgb+texture2D(tWorld,vUv-vec2(p.x,0.)).rgb+texture2D(tWorld,vUv+vec2(0.,p.y)).rgb+texture2D(tWorld,vUv-vec2(0.,p.y)).rgb)*.25;c=mix(c,n,edge*.38);}
      float occ=1.; if(uAO>.5&&d<.9999){float ring=texture2D(tDepth,vUv+vec2(p.x*3.,0.)).r+texture2D(tDepth,vUv+vec2(-p.x*3.,0.)).r+texture2D(tDepth,vUv+vec2(0.,p.y*3.)).r+texture2D(tDepth,vUv+vec2(0.,-p.y*3.)).r;occ=1.-clamp((d*4.-ring)*22.,0.,.12);} c*=occ;
      if(uPost>.5){
        vec3 b=texture2D(tWorld,vUv+vec2(p.x*2.,0.)).rgb+texture2D(tWorld,vUv-vec2(p.x*2.,0.)).rgb+texture2D(tWorld,vUv+vec2(0.,p.y*2.)).rgb+texture2D(tWorld,vUv-vec2(0.,p.y*2.)).rgb;
        b=max(b*.25-vec3(.72),0.);c+=b*.075;
        float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,1.035);c=mix(c,c*c*(3.-2.*c),.08);c=(c-.5)*1.015+.5;
        float vignette=1.-smoothstep(.40,.84,length(vUv-.5))*.075;c*=vignette;
      } gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

/** The pre-A compositor, byte-for-byte. Same call shape as `buildCompositor` so the harness can
 * swap one for the other through `renderer.registerComposite()` without any other change. */
export function buildBaselineCompositor(w, h) {
  const worldTarget = new THREE.WebGLRenderTarget(w,h,{depthBuffer:true,stencilBuffer:false,type:THREE.HalfFloatType});
  worldTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
  worldTarget.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
  worldTarget.texture.name = 'w1-30-hdr-world-colour';
  worldTarget.depthTexture.name = 'w1-30-world-depth';
  const compositeMaterial = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: true,
    uniforms: {
      tWorld: { value: worldTarget.texture }, tDepth: { value: worldTarget.depthTexture },
      uResolution: { value: new THREE.Vector2(w, h) },
      uAO: { value: 1 }, uAA: { value: 1 }, uPost: { value: 1 },
      // Present so `renderer.js` can push a grade at it without throwing; the baseline shader
      // declares none of them, and an unused uniform is silently ignored by three.
      uDither: { value: 0 }, uGradeOn: { value: 0 },
      uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) },
      uInvGamma: { value: new THREE.Vector3(1, 1, 1) },
      uShadowTint: { value: new THREE.Vector3(1, 1, 1) }, uHighlightTint: { value: new THREE.Vector3(1, 1, 1) },
      uMix: { value: new THREE.Matrix3() },
      uBalance: { value: 1 }, uContrast: { value: 1 }, uPivot: { value: 0.5 }, uSat: { value: 1 },
      uVignette: { value: 0 }, uVignInner: { value: 0.38 }, uVignOuter: { value: 0.98 },
      uBloom: { value: 0 }, uBloomThreshold: { value: 1 }, uBloomKnee: { value: 0.5 },
    },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: BASELINE_FRAGMENT,
  });
  const compositeScene = new THREE.Scene();
  const compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  compositeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compositeMaterial));
  return { worldTarget, compositeMaterial, compositeScene, compositeCamera, samples: 0, baseline: true };
}
