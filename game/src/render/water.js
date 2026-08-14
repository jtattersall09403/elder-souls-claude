// W1-30S seam pass — move only, zero behaviour change.
//
// The water surface shader and its live phase/reflection state, moved out of
// `visual-foundation.js` so that after this commit W1-30H owns exactly one file for water
// surface presentation (`render/spell-vfx.js` is its other one). `visual-foundation.js`
// (W1-30C) still owns `worldMaterial()`'s family dispatch and builds the base
// MeshPhysicalMaterial for the `water` family; this module installs the animated
// ripple/reflection shader ONTO that material via `installWaterShader(mat)`, so
// visual-foundation.js remains the single place that decides which family gets which
// treatment while the treatment itself lives here.
//
// Every statement below — the uniform block, the `onBeforeCompile` shader source, the
// program cache key, `updateVisualFoundationFrame` and `bindWaterReflection` — is copied
// verbatim from `visual-foundation.js`. Nothing here computes a different value than it did
// before the move; only the file and the entry point changed. Future owner: W1-30H.
'use strict';

import * as THREE from '../../vendor/three/three.module.js';

const animatedWaterMaterials = new Set();
let waterReflectionTexture = null;
let waterReflectionResolution = new THREE.Vector2(1, 1);
let waterReflectionStrength = 0;
let waterReflectionMatrix = new THREE.Matrix4();

/** Install the animated ripple + reflection shader onto a water-family material. `mat` must
 * already be the base MeshPhysicalMaterial `worldMaterial()` builds for the `water` family;
 * this only attaches the onBeforeCompile injection and registers it for the frame/reflection
 * drivers below. */
export function installWaterShader(mat) {
  // A deterministic, presentation-only ripple field. Static texture maps made the surface
  // read as lacquer and made RI-VIS03 M12 TemporalVar correctly report static water. The
  // displacement is centimetres, leaves collision/tides authoritative, and is evaluated from
  // simulation frame rather than wall time so capture hashes remain reproducible.
  const u={uWaterPhase:{value:0},uWaterReflection:{value:waterReflectionTexture},uWaterReflectionResolution:{value:waterReflectionResolution.clone()},uWaterReflectionStrength:{value:waterReflectionStrength},uWaterReflectionMatrix:{value:waterReflectionMatrix.clone()}};mat.userData.waterUniforms=u;
  mat.onBeforeCompile=(shader)=>{shader.uniforms.uWaterPhase=u.uWaterPhase;shader.uniforms.uWaterReflection=u.uWaterReflection;shader.uniforms.uWaterReflectionResolution=u.uWaterReflectionResolution;shader.uniforms.uWaterReflectionStrength=u.uWaterReflectionStrength;shader.uniforms.uWaterReflectionMatrix=u.uWaterReflectionMatrix;
    shader.vertexShader='uniform float uWaterPhase;\nuniform mat4 uWaterReflectionMatrix;\nattribute float waterShore;\nvarying float vEsWaterWave;\nvarying float vEsWaterShore;\nvarying vec2 vEsWaterXZ;\nvarying vec3 vEsWaterWorld;\nvarying vec4 vEsWaterReflectionCoord;\n'+shader.vertexShader
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        // Crossed, incommensurate waves avoid the axis-aligned 20 m light/dark lanes produced
        // by the former independent X and Z sines. Displacement remains centimetre-scale.
        float esA=position.x*.23+position.z*.17+uWaterPhase*1.37;
        float esB=-position.x*.19+position.z*.31-uWaterPhase*.91;
        float esC=position.x*.73-position.z*.61+uWaterPhase*1.83;
        vEsWaterWave=sin(esA)*.48+sin(esB)*.36+sin(esC)*.16;
        vEsWaterShore=waterShore;
        vEsWaterXZ=position.xz;
        transformed.y += vEsWaterWave*.018;`)
      .replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
        vEsWaterWorld=(modelMatrix*vec4(transformed,1.0)).xyz;
        vEsWaterReflectionCoord=uWaterReflectionMatrix*vec4(vEsWaterWorld,1.0);`);
    shader.fragmentShader='uniform float uWaterPhase;\nuniform sampler2D uWaterReflection;\nuniform vec2 uWaterReflectionResolution;\nuniform float uWaterReflectionStrength;\nvarying float vEsWaterWave;\nvarying float vEsWaterShore;\nvarying vec2 vEsWaterXZ;\nvarying vec3 vEsWaterWorld;\nvarying vec4 vEsWaterReflectionCoord;\n'+shader.fragmentShader
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        float esA=vEsWaterXZ.x*.23+vEsWaterXZ.y*.17+uWaterPhase*1.37;
        float esB=-vEsWaterXZ.x*.19+vEsWaterXZ.y*.31-uWaterPhase*.91;
        float esC=vEsWaterXZ.x*.73-vEsWaterXZ.y*.61+uWaterPhase*1.83;
        float esD=vEsWaterXZ.x*2.7+vEsWaterXZ.y*1.9-uWaterPhase*2.4;
        vec2 esSlope=vec2(cos(esA)*.030-cos(esB)*.019+cos(esC)*.012+cos(esD)*.010,
                          cos(esA)*.022+cos(esB)*.031-cos(esC)*.010+cos(esD)*.007);
        normal=normalize(normal+vec3(esSlope.x,0.0,esSlope.y));`)
      .replace('#include <color_fragment>',`#include <color_fragment>
        diffuseColor.rgb*=1.015+vEsWaterWave*.008;`)
      // Reflection is radiance arriving from the environment. Applying it to diffuseColor
      // before Three's lighting multiplied it back toward black under the canopy. More
      // importantly, `normal` is declared by normal_fragment_begin AFTER color_fragment, so
      // the old injection referenced it before declaration and the water draw never linked.
      .replace('#include <opaque_fragment>',`
        float esFresnel=pow(1.0-clamp(abs(dot(normalize(normal),normalize(vViewPosition))),0.0,1.0),2.2);
        vec3 esSky=vec3(0.20,0.37,0.44);
        vec2 esReflUV=clamp(vEsWaterReflectionCoord.xy/max(.0001,vEsWaterReflectionCoord.w)*.5+.5,vec2(.001),vec2(.999));
        esReflUV+=esSlope*.0015;
        vec3 esReflection=texture2D(uWaterReflection,esReflUV).rgb;
        // Screen-aligned reflection retains the mirrored bank/sky relationship required at
        // grazing angles; the projected lookup above supplies local parallax and ripple warp.
        vec2 esScreenUV=gl_FragCoord.xy/max(uWaterReflectionResolution,vec2(1.0));
        vec3 esScreenReflection=texture2D(uWaterReflection,esScreenUV+esSlope*.0025).rgb;
        esReflection=mix(esReflection,esScreenReflection,.62);
        float esCaustic=pow(.5+.5*sin(vEsWaterWorld.x*.72+uWaterPhase*2.3)*sin(vEsWaterWorld.z*.61-uWaterPhase*1.7),3.0);
        float esShimmer=.5+.5*sin(uWaterPhase*5.1+vEsWaterWorld.x*.08-vEsWaterWorld.z*.05);
        float esPulse=sin(uWaterPhase*5.1)*.5+.5;
        // Distance raises the grazing response across a broad marsh vista while the actual
        // view/normal term preserves it on close oblique water. Reflected radiance is colour
        // graded back into the regional water rather than copied as a white mirror.
        float esGrazing=max(esFresnel,smoothstep(10.0,52.0,length(vViewPosition))*.72);
        float esReflLuma=dot(esReflection,vec3(.2126,.7152,.0722));
        esReflection=mix(esReflection,vec3(esReflLuma*.70,esReflLuma*.83,esReflLuma*.88),.48);
        vec3 esDepth=vec3(.038,.105,.118)+diffuseColor.rgb*.21;
        vec3 esSurface=mix(esDepth,esReflection,(.25+esGrazing*.50)*uWaterReflectionStrength);
        outgoingLight=mix(outgoingLight,esSurface,.68);
        float esRipples=.5+.5*sin(vEsWaterWorld.x*4.7+uWaterPhase*2.1)*sin(vEsWaterWorld.z*4.1-uWaterPhase*1.7);
        float esCapillary=.5+.5*sin(vEsWaterWorld.x*13.7+vEsWaterWorld.z*9.3-uWaterPhase*3.4);
        float esMicro=.5+.5*sin(vEsWaterWorld.x*26.3-vEsWaterWorld.z*21.7+uWaterPhase*4.7);
        // Fine terms break the normal/specular lobe; they must not become visible wallpaper.
        outgoingLight+=vec3(.006,.010,.011)*esCaustic+vec3(.003,.005,.006)*esShimmer+vec3(.006,.010,.012)*esPulse+vec3(.007,.010,.011)*(esRipples-.5)+vec3(.005,.007,.008)*(esCapillary-.5)+vec3(.004,.006,.007)*(esMicro-.5);
        float esShore=smoothstep(.04,.92,vEsWaterShore);
        float esFoam=esShore*smoothstep(.40,.78,.5+.5*sin(vEsWaterWorld.x*2.3-vEsWaterWorld.z*2.7+uWaterPhase*1.8));
        outgoingLight=mix(outgoingLight,vec3(.055,.064,.048)+outgoingLight*.34,esShore*.76);
        outgoingLight+=vec3(.095,.105,.082)*esFoam;
        #include <opaque_fragment>`);
  };mat.customProgramCacheKey=()=>`w1-30-water-ripple-reflection-v14`;animatedWaterMaterials.add(mat);
}

/** Drive all live water shaders from the fixed simulation frame. */
export function updateVisualFoundationFrame(frame=0){
  const phase=(Number(frame)||0)/60;
  for(const mat of animatedWaterMaterials)if(mat.userData?.waterUniforms)mat.userData.waterUniforms.uWaterPhase.value=phase;
}

/** Bind the renderer's true mirrored scene pass to every live regional water material. */
export function bindWaterReflection(texture,width=1,height=1,strength=1,matrix=null){
  waterReflectionTexture=texture||null;waterReflectionResolution.set(Math.max(1,width),Math.max(1,height));waterReflectionStrength=texture?Math.max(0,Math.min(1,strength)):0;
  if(matrix)waterReflectionMatrix.copy(matrix);
  for(const mat of animatedWaterMaterials){const u=mat.userData?.waterUniforms;if(!u)continue;u.uWaterReflection.value=waterReflectionTexture;u.uWaterReflectionResolution.value.copy(waterReflectionResolution);u.uWaterReflectionStrength.value=waterReflectionStrength;u.uWaterReflectionMatrix.value.copy(waterReflectionMatrix);}
}
