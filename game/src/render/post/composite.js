// W1-30S seam pass — move only, zero behaviour change.
//
// The HDR world target and the fullscreen composite (AA edge-blend, depth AO ring, bloom,
// grade, vignette, tonemap/colourspace) that `Renderer._buildCompositor` used to build inline.
// The shader source, the uniform block and every literal below are copied verbatim; only the
// file and the calling convention changed — `renderer.js` now calls `buildCompositor(w, h)`
// and installs the result via `renderer.registerComposite(mod)`. Future owner: W1-30A, who
// owns `render/renderer.js` and this directory outright once this commit lands.
'use strict';

import * as THREE from '../../../vendor/three/three.module.js';

export function buildCompositor(w, h) {
  // Preserve scene-linear HDR until the final composite. An sRGB 8-bit target clipped the
  // highlights before bloom and the fullscreen ShaderMaterial then bypassed ACES entirely.
  const worldTarget=new THREE.WebGLRenderTarget(w,h,{depthBuffer:true,stencilBuffer:false,type:THREE.HalfFloatType});
  worldTarget.texture.colorSpace=THREE.LinearSRGBColorSpace;
  worldTarget.depthTexture=new THREE.DepthTexture(w,h,THREE.UnsignedIntType);
  worldTarget.texture.name='w1-30-hdr-world-colour';
  worldTarget.depthTexture.name='w1-30-world-depth';
  const compositeMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:true,
    uniforms:{tWorld:{value:worldTarget.texture},tDepth:{value:worldTarget.depthTexture},
      uResolution:{value:new THREE.Vector2(w,h)},uAO:{value:1},uAA:{value:1},uPost:{value:1}},
    vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`varying vec2 vUv; uniform sampler2D tWorld,tDepth; uniform vec2 uResolution; uniform float uAO,uAA,uPost;
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
    }`});
  const compositeScene=new THREE.Scene(); const compositeCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  compositeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),compositeMaterial));
  return { worldTarget, compositeMaterial, compositeScene, compositeCamera };
}
