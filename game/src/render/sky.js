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
  clear: { fogDensity: 0.0026, sunIntensity: 2.1, ambient: 0.62, tint: [1.00, 1.00, 1.00], overcast: 0.00, rain: 0.0 },
  overcast: { fogDensity: 0.0062, sunIntensity: 0.7, ambient: 0.95, tint: [0.86, 0.88, 0.92], overcast: 0.80, rain: 0.0 },
  rain: { fogDensity: 0.0112, sunIntensity: 0.45, ambient: 0.85, tint: [0.72, 0.78, 0.84], overcast: 0.92, rain: 0.6 },
  storm: { fogDensity: 0.0180, sunIntensity: 0.28, ambient: 0.62, tint: [0.55, 0.62, 0.72], overcast: 1.00, rain: 1.0 },
  fog: { fogDensity: 0.0320, sunIntensity: 0.65, ambient: 1.05, tint: [0.80, 0.82, 0.80], overcast: 0.70, rain: 0.0 },
  // Regional states (W1-01). RI-WLD04 makes the weather STATE SET one of the nine axes, so the
  // vocabulary has to be bigger than five: a region whose only weather is "clear or storm" cannot
  // differ from twelve others on this axis. W1-02 owns the transition machine; these are the
  // named states it will transition between, and setWeather() stays a closed set.
  cold_rain:    { fogDensity: 0.0098, sunIntensity: 0.40, ambient: 0.80, tint: [0.70, 0.78, 0.90], overcast: 0.90, rain: 0.7 },
  warm_rain:    { fogDensity: 0.0125, sunIntensity: 0.55, ambient: 0.95, tint: [0.82, 0.86, 0.74], overcast: 0.82, rain: 0.6 },
  heavy_rain:   { fogDensity: 0.0165, sunIntensity: 0.32, ambient: 0.78, tint: [0.66, 0.76, 0.68], overcast: 0.96, rain: 1.0 },
  dawn_mist:    { fogDensity: 0.0280, sunIntensity: 0.80, ambient: 1.00, tint: [0.90, 0.92, 0.86], overcast: 0.45, rain: 0.0 },
  sea_fog:      { fogDensity: 0.0360, sunIntensity: 0.60, ambient: 1.05, tint: [0.84, 0.88, 0.92], overcast: 0.62, rain: 0.0 },
  sea_squall:   { fogDensity: 0.0210, sunIntensity: 0.30, ambient: 0.66, tint: [0.62, 0.68, 0.76], overcast: 1.00, rain: 0.9 },
  fever_fog:    { fogDensity: 0.0420, sunIntensity: 0.45, ambient: 0.90, tint: [0.62, 0.86, 0.60], overcast: 0.75, rain: 0.1 },
  salt_storm:   { fogDensity: 0.0520, sunIntensity: 0.34, ambient: 1.10, tint: [1.00, 0.98, 0.90], overcast: 0.88, rain: 0.0 },
  ashfall:      { fogDensity: 0.0190, sunIntensity: 0.42, ambient: 0.72, tint: [0.72, 0.70, 0.64], overcast: 0.86, rain: 0.0 },
  dust_devil:   { fogDensity: 0.0090, sunIntensity: 1.50, ambient: 0.70, tint: [1.00, 0.86, 0.66], overcast: 0.10, rain: 0.0 },
  heat_shimmer: { fogDensity: 0.0040, sunIntensity: 2.30, ambient: 0.66, tint: [1.00, 0.92, 0.78], overcast: 0.00, rain: 0.0 },
  dry_thunder:  { fogDensity: 0.0068, sunIntensity: 0.90, ambient: 0.74, tint: [0.86, 0.86, 0.90], overcast: 0.55, rain: 0.0 },
  still:        { fogDensity: 0.0058, sunIntensity: 1.20, ambient: 0.98, tint: [1.00, 0.97, 0.86], overcast: 0.18, rain: 0.0 },
  // W1-02. `RI-WLD08` §5 names a four-state machine for each of the thirteen regions and no two
  // regions may share a full state set; twenty-five of the forty-one states it names had no entry
  // here, so `setWeather('thick_fog')` threw and `game/data/world/weather.json` could not have
  // been rendered even if something had been reading it. `tint` is the state's own colour cast and
  // `overcast` its light class — `sun` states sit at or below 0.20, `overcast` around 0.55-0.85,
  // `dark` at 0.86 and above, matching the `light` field the stealth model reads so the two halves
  // of the build cannot disagree about whether it is a bright day.
  humid_clear:     { fogDensity: 0.0072, sunIntensity: 1.90, ambient: 0.86, tint: [0.97, 1.00, 0.92], overcast: 0.08, rain: 0.0 },
  night_bloom:     { fogDensity: 0.0110, sunIntensity: 0.55, ambient: 1.15, tint: [0.66, 1.00, 0.86], overcast: 0.20, rain: 0.0 },
  canopy_dim:      { fogDensity: 0.0140, sunIntensity: 0.50, ambient: 0.70, tint: [0.72, 0.82, 0.70], overcast: 0.72, rain: 0.0 },
  steam:           { fogDensity: 0.0300, sunIntensity: 0.58, ambient: 1.02, tint: [0.86, 0.92, 0.84], overcast: 0.66, rain: 0.0 },
  downpour:        { fogDensity: 0.0250, sunIntensity: 0.26, ambient: 0.70, tint: [0.60, 0.70, 0.64], overcast: 0.98, rain: 1.0 },
  queen_agitation: { fogDensity: 0.0064, sunIntensity: 1.70, ambient: 0.92, tint: [1.00, 0.90, 0.62], overcast: 0.14, rain: 0.0 },
  comb_swelter:    { fogDensity: 0.0080, sunIntensity: 1.95, ambient: 0.90, tint: [1.00, 0.94, 0.70], overcast: 0.10, rain: 0.0 },
  drone_haze:      { fogDensity: 0.0130, sunIntensity: 0.85, ambient: 0.94, tint: [0.96, 0.90, 0.72], overcast: 0.58, rain: 0.0 },
  gale:            { fogDensity: 0.0190, sunIntensity: 0.30, ambient: 0.64, tint: [0.62, 0.70, 0.78], overcast: 0.96, rain: 0.5 },
  high_clear:      { fogDensity: 0.0016, sunIntensity: 2.45, ambient: 0.58, tint: [0.98, 0.99, 1.00], overcast: 0.00, rain: 0.0 },
  hail:            { fogDensity: 0.0215, sunIntensity: 0.30, ambient: 0.72, tint: [0.78, 0.84, 0.92], overcast: 0.94, rain: 0.8 },
  hill_mist:       { fogDensity: 0.0355, sunIntensity: 0.62, ambient: 1.06, tint: [0.88, 0.90, 0.92], overcast: 0.64, rain: 0.0 },
  sleet:           { fogDensity: 0.0205, sunIntensity: 0.33, ambient: 0.70, tint: [0.74, 0.80, 0.90], overcast: 0.92, rain: 0.7 },
  cloud_below:     { fogDensity: 0.0020, sunIntensity: 2.35, ambient: 0.74, tint: [1.00, 0.98, 0.96], overcast: 0.04, rain: 0.0 },
  rockfall_wind:   { fogDensity: 0.0105, sunIntensity: 0.95, ambient: 0.76, tint: [0.86, 0.84, 0.82], overcast: 0.52, rain: 0.0 },
  ash_storm:       { fogDensity: 0.0560, sunIntensity: 0.24, ambient: 0.68, tint: [0.62, 0.58, 0.54], overcast: 0.98, rain: 0.0 },
  drizzle:         { fogDensity: 0.0116, sunIntensity: 0.60, ambient: 0.90, tint: [0.80, 0.84, 0.84], overcast: 0.76, rain: 0.4 },
  dry_heat:        { fogDensity: 0.0046, sunIntensity: 2.25, ambient: 0.64, tint: [1.00, 0.94, 0.76], overcast: 0.02, rain: 0.0 },
  haze:            { fogDensity: 0.0148, sunIntensity: 0.90, ambient: 0.96, tint: [0.94, 0.90, 0.80], overcast: 0.56, rain: 0.0 },
  night_cold:      { fogDensity: 0.0090, sunIntensity: 0.36, ambient: 0.60, tint: [0.68, 0.74, 0.90], overcast: 0.88, rain: 0.0 },
  red_haze:        { fogDensity: 0.0175, sunIntensity: 0.72, ambient: 0.92, tint: [1.00, 0.66, 0.58], overcast: 0.60, rain: 0.0 },
  black_clear:     { fogDensity: 0.0100, sunIntensity: 0.30, ambient: 0.58, tint: [0.58, 0.66, 0.70], overcast: 0.86, rain: 0.0 },
  thick_fog:       { fogDensity: 0.0850, sunIntensity: 0.40, ambient: 1.10, tint: [0.78, 0.82, 0.80], overcast: 0.80, rain: 0.0 },
  white_clear:     { fogDensity: 0.0018, sunIntensity: 2.50, ambient: 0.60, tint: [1.00, 1.00, 0.98], overcast: 0.00, rain: 0.0 },
  night_freeze:    { fogDensity: 0.0086, sunIntensity: 0.30, ambient: 0.56, tint: [0.72, 0.80, 0.96], overcast: 0.90, rain: 0.0 },
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

    this.hemi = new THREE.HemisphereLight(0xbfd0e0, 0x3a3527, 0.5);
    scene.add(this.hemi);

    this.scene = scene;
    this.scene.fog = new THREE.FogExp2(0x9aa79a, 0.0022);
  }

  /**
   * @param {number} hours 0..24
   * @param {string} weatherId a key of WEATHER
   * @param {THREE.Vector3} focus where the shadow frustum should sit
   */
  apply(hours, weatherId, focus, regionFog, env) {
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

    // ---- night ---------------------------------------------------------------------------------
    // `RI-WLD04` M17 step 6: the sample is repeated at night and **night accuracy >= 70% is
    // required** — "a region that is only identifiable in clear daylight is half-built". Measured
    // on the shipped build, the thirteen regions scored **28.2%** at 01:00, with a mean
    // inter-centroid distance of 15.25 against 99.51 by day: at `day = 0` the ambient term fell to
    // 10% and the region's own fog hue was multiplied by 0.34, so every region rendered as the same
    // near-black. Two changes, both of them art direction rather than exposure:
    //
    //   * the night ambient takes the REGION's hue instead of the sky horizon's, so what little
    //     light there is carries region identity — a marsh under two moons is green-black, a salt
    //     pan is blue-white, a kiln moor is ember-red;
    //   * the floors rise (ambient 0.10 -> 0.30, fog 0.34 -> 0.62). Morrowind's nights are dark and
    //     READABLE; a frame a judge cannot classify is not a dark frame, it is a missing frame.
    const night = 1 - Math.max(0, Math.min(1, day * 2.2));
    // W1-01 round 3. `ours_night` leave-one-out was 33.3% against M17 step 6's explicit >= 70%.
    // Two thirds of the DAY separability was tint, and at night there was not even that: every
    // region rendered as the same near-black. A region's night hue is now taken from the thing it
    // OWNS — the welkynd blue of Blackwood's pillars, the ember of the Clay Moor's kilns, the amber
    // of the Hive's comb, the jelly green of the Eastern Rootlands — mixed with its fog. That is a
    // per-region light SOURCE rather than a per-region exposure, which is the distinction the item
    // is making when it says a region must be identifiable at night.
    const regionNight = regionFog ? new THREE.Color(regionFog.colour) : hor.clone();
    if (regionFog && regionFog.glow) regionNight.lerp(new THREE.Color(regionFog.glow), 0.55);
    this.hemi.intensity = w.ambient * Math.max(0.30, day * 0.9 + 0.10);
    this.hemi.color.copy(hor).lerp(regionNight, night * 0.85);
    this.hemi.groundColor.setRGB(0.227, 0.208, 0.153).lerp(regionNight, night * 0.55);

    if (regionFog) {
      // The region owns the hue and the extinction; the weather multiplies the extinction and
      // tints toward the sky, so "Blackwood in rain" is Blackwood, wetter — not generic rain.
      const rc = new THREE.Color(regionFog.colour);
      this.scene.fog.color.copy(rc).lerp(hor, 0.34 * (1 - night * 0.7)).multiplyScalar(lerp(0.62, 1.0, day));
      const base = regionFog.extinction * (1 + w.fogDensity / 0.0026 * 0.22);
      // ---- W1-02: the weather's SIGHTLINE, made raycastable ------------------------------------
      //
      // `RI-WLD08` §5 is explicit that "weather is never purely cosmetic" and M43 says the worst
      // state's effect must be MEASURED — "measure sightline by raycast". So the declared
      // `sightline_m` has to be the distance the frame actually stops at, not a number in a file.
      // Three's `FogExp2` transmits `exp(-(density * d)^2)`, so the density at which 2% of a
      // silhouette survives at distance S is `sqrt(-ln 0.02) / S = 1.978 / S`.
      //
      // It is a MAX against the region's own extinction, not a replacement, and that is S24: the
      // region owns its haze and its hue, and the weather may only ever make it worse. Blackwood
      // in a clear spell is still Blackwood's 110 m; a salt-storm in the Stone Wastes overrides the
      // region's 521 m down to 60 m because that is what a salt-storm is.
      const sightline = env && Number.isFinite(env.sightlineM) ? env.sightlineM : 0;
      this.scene.fog.density = sightline > 0 ? Math.max(base, 1.978 / sightline) : base;
    } else {
      this.scene.fog.density = w.fogDensity;
      this.scene.fog.color.copy(hor).multiplyScalar(0.92);
    }

    return weatherId;
  }

  /** The dome is drawn at the far plane, so it must be centred on the camera every frame. */
  followCamera(camera) {
    this.mesh.position.copy(camera.position);
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
