// Deterministic sky and sun — the whole of `setTimeOfDay` / `setWeather`'s visible effect.
//
// HARNESS.md §6: screenshots are only comparable if the clock and the weather are pinned,
// so both are pure functions of (hours, weatherId) with no wall clock and no randomness
// anywhere. Two runs that ask for 21:00 in a storm get the identical sky, which is what
// makes the twelve canonical viewpoints comparable across waves.
'use strict';

import * as THREE from '../../vendor/three/three.module.js';

/** The named weather states. Closed set — `setWeather` throws on anything else. */
export const WEATHER = {
  clear: { fogDensity: 0.0022, sunIntensity: 3.1, ambient: 0.42, tint: [1.00, 1.00, 1.00], overcast: 0.00, rain: 0.0 },
  overcast: { fogDensity: 0.0060, sunIntensity: 0.9, ambient: 0.62, tint: [0.86, 0.88, 0.92], overcast: 0.80, rain: 0.0 },
  rain: { fogDensity: 0.0110, sunIntensity: 0.5, ambient: 0.55, tint: [0.72, 0.78, 0.84], overcast: 0.92, rain: 0.6 },
  storm: { fogDensity: 0.0180, sunIntensity: 0.3, ambient: 0.38, tint: [0.55, 0.62, 0.72], overcast: 1.00, rain: 1.0 },
  fog: { fogDensity: 0.0320, sunIntensity: 0.8, ambient: 0.70, tint: [0.80, 0.82, 0.80], overcast: 0.70, rain: 0.0 },
};

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w;   // always at the far plane
}`;

const SKY_FRAG = `
varying vec3 vDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColour;
uniform vec3 uSunDir;
uniform float uSunSize;
uniform float uOvercast;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  // smoothstep rather than a linear ramp: a linear gradient bands badly at 8 bits, and
  // VP02-sky-only exists precisely to measure that (HARNESS.md §6).
  float t = smoothstep(0.0, 1.0, pow(h, 0.62));
  vec3 col = mix(uHorizon, uZenith, t);
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  float disc = smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.35, sd);
  float glow = pow(sd, 24.0) * 0.55 + pow(sd, 6.0) * 0.18;
  col += uSunColour * (disc * 1.6 + glow) * (1.0 - uOvercast * 0.92);
  gl_FragColor = vec4(col, 1.0);
}`;

export class Sky {
  constructor(scene) {
    this.uniforms = {
      uZenith: { value: new THREE.Color(0x2f5f95) },
      uHorizon: { value: new THREE.Color(0xbfc6b4) },
      uSunColour: { value: new THREE.Color(0xfff0d0) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunSize: { value: 0.004 },
      uOvercast: { value: 0 },
    };
    const geo = new THREE.SphereGeometry(1, 32, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);

    this.sun = new THREE.DirectionalLight(0xfff0d8, 3.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 40;
    this.sun.shadow.camera.far = 210;
    this.sun.shadow.camera.left = -60;
    this.sun.shadow.camera.right = 60;
    this.sun.shadow.camera.top = 60;
    this.sun.shadow.camera.bottom = -60;
    // 120 m of frustum across 2048 texels is 0.059 m per texel, so the normal bias has to
    // be of that order or every lit surface shadow-acnes itself and the whole scene comes
    // back black. It is set in world units deliberately: a depth bias alone cannot fix
    // acne at this ratio, and a black scene is a fail-closed 0 for every fidelity metric.
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.25;
    // Three.js does NOT recompute an orthographic shadow frustum from its properties, so
    // this call is load-bearing: without it the shadow camera keeps its default 10x10 m
    // box and the entire scene renders fully shadowed.
    this.sun.shadow.camera.updateProjectionMatrix();
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbfd0e0, 0x2c2a20, 0.5);
    scene.add(this.hemi);

    this.scene = scene;
    this.scene.fog = new THREE.FogExp2(0x9aa79a, 0.0022);
  }

  /**
   * @param {number} hours 0..24
   * @param {string} weatherId a key of WEATHER
   * @param {THREE.Vector3} focus where the shadow frustum should sit
   */
  apply(hours, weatherId, focus) {
    const w = WEATHER[weatherId];
    if (!w) throw new Error(`unknown weather '${weatherId}'. Named states: ${Object.keys(WEATHER).join(', ')}`);

    // Sun elevation: noon is up, midnight is down. Pure arithmetic, deterministic.
    const ang = ((hours - 6) / 24) * Math.PI * 2;
    const elev = Math.sin(ang);                       // -1 .. 1
    const azim = ((hours / 24) * Math.PI * 2) - Math.PI * 0.5;
    const dir = new THREE.Vector3(Math.cos(azim) * 0.75, Math.max(-0.4, elev), Math.sin(azim) * 0.75).normalize();

    const day = Math.max(0, Math.min(1, elev * 1.6 + 0.28));   // 0 at night, 1 at noon
    const dusk = Math.max(0, 1 - Math.abs(elev) * 4.2);        // warm band near the horizon

    const zen = new THREE.Color(
      lerp(0.024, 0.115, day) * w.tint[0] + dusk * 0.05,
      lerp(0.036, 0.305, day) * w.tint[1] + dusk * 0.03,
      lerp(0.082, 0.620, day) * w.tint[2] + dusk * 0.02);
    const hor = new THREE.Color(
      lerp(0.045, 0.760, day) * w.tint[0] + dusk * 0.36,
      lerp(0.058, 0.790, day) * w.tint[1] + dusk * 0.17,
      lerp(0.090, 0.700, day) * w.tint[2] + dusk * 0.06);
    const overcast = w.overcast;
    zen.lerp(new THREE.Color(0.30 * day + 0.02, 0.31 * day + 0.02, 0.33 * day + 0.03), overcast);
    hor.lerp(new THREE.Color(0.40 * day + 0.03, 0.41 * day + 0.03, 0.42 * day + 0.04), overcast);

    this.uniforms.uZenith.value.copy(zen);
    this.uniforms.uHorizon.value.copy(hor);
    this.uniforms.uSunDir.value.copy(dir);
    this.uniforms.uOvercast.value = overcast;
    this.uniforms.uSunColour.value.setRGB(
      lerp(0.55, 1.00, day) + dusk * 0.35, lerp(0.42, 0.94, day) + dusk * 0.10, lerp(0.62, 0.82, day));

    this.sun.intensity = w.sunIntensity * Math.max(0.02, day);
    this.sun.color.copy(this.uniforms.uSunColour.value);
    this.sun.position.copy(dir).multiplyScalar(120);
    if (focus) { this.sun.position.add(focus); this.sun.target.position.copy(focus); }
    else this.sun.target.position.set(0, 0, 0);
    this.sun.target.updateMatrixWorld();

    this.hemi.intensity = w.ambient * Math.max(0.10, day * 0.9 + 0.10);
    this.hemi.color.copy(hor);

    this.scene.fog.density = w.fogDensity;
    this.scene.fog.color.copy(hor).multiplyScalar(0.92);

    return weatherId;
  }

  /** The dome is drawn at the far plane, so it must be centred on the camera every frame. */
  followCamera(camera) {
    this.mesh.position.copy(camera.position);
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
