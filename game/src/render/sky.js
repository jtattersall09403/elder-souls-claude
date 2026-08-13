// Deterministic sky and sun — the whole of `setTimeOfDay` / `setWeather`'s visible effect.
//
// HARNESS.md §6: screenshots are only comparable if the clock and the weather are pinned,
// so both are pure functions of (hours, weatherId) with no wall clock and no randomness
// anywhere. Two runs that ask for 21:00 in a storm get the identical sky, which is what
// makes the twelve canonical viewpoints comparable across waves.
'use strict';

import * as THREE from '../../vendor/three/three.module.js';
const hash1=(n)=>{let h=Math.imul(n|0,0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);return((h^(h>>>16))>>>0)/4294967295;};

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
  // Dense canopy rain stays sombre, but must retain bark/leaf value separation in motion.  The
  // previous 0.32/0.78 pair collapsed every material below the canopy into one near-black mass.
  heavy_rain:   { fogDensity: 0.0145, sunIntensity: 0.46, ambient: 0.96, tint: [0.70, 0.80, 0.72], overcast: 0.94, rain: 1.0 },
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
  // Static high cloud structure breaks the flat colour dome while remaining a pure function of
  // direction and weather. It is deliberately subtle in clear weather and broad when overcast.
  // Warped multi-octave cloud bands. Using only sine sums made the dome read as three broad
  // vertical blue stripes; domain warping produces bounded cellular banks with soft bases.
  vec2 p=d.xz/max(.18,d.y+.42);
  float warp=sin(p.x*3.7+p.y*2.1)+cos(p.y*4.6-p.x*1.8);
  float cloudField=sin(p.x*5.1+p.y*2.7+warp*.42)*.50
    +sin(p.y*9.4-p.x*4.3+warp*.24)*.28
    +cos((p.x+p.y)*17.0-warp*.15)*.14;
  float cloud=smoothstep(.13-uOvercast*.30,.55-uOvercast*.14,cloudField)*smoothstep(-.03,.28,d.y);
  float veil=smoothstep(-.30,.32,cloudField)*uOvercast*.38;
  col=mix(col,mix(uHorizon,uSunColour,.24),cloud*(.20+uOvercast*.34)+veil*.18);
  col += uSunColour * pow(max(0.0,1.0-abs(d.y)*4.2),3.0) * (1.0-uOvercast) * .035;
  gl_FragColor = vec4(col, 1.0);
}`;

export class Sky {
  constructor(scene) {
    this.features = { shadows:true, ibl:true, atmosphere:true, sky:true, lighting:true };
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

    // A low, colour-bearing fill keeps vertical and back-facing forms readable when the fitted
    // sun shadow covers them.  It is deliberately weaker than either celestial key and follows
    // the region/weather colour below; this is scene lighting, not an exposure lift or UI grade.
    this.fill = new THREE.AmbientLight(0x8b9488, 0.24);
    scene.add(this.fill);

    // Bounded deterministic precipitation. Geometry is allocated once; apply() rewrites the
    // streak endpoints from simulation frame and weather intensity, never from wall time.
    this.rainPos=new Float32Array(320*2*3);this.rainSeed=new Float32Array(320*3);
    for(let i=0;i<320;i++){this.rainSeed[i*3]=hash1(i*17+3);this.rainSeed[i*3+1]=hash1(i*29+7);this.rainSeed[i*3+2]=hash1(i*43+11);}
    const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(this.rainPos,3));
    this.rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0xb8c8cf,transparent:true,opacity:.34,depthWrite:false,toneMapped:false}));this.rain.name='weather-precipitation-bounded-320';this.rain.frustumCulled=false;this.rain.visible=false;scene.add(this.rain);

    // The moon is not a second, unrelated art light. It is the exact inverse of the one
    // celestial direction used by the dome and sun, and only contributes after sunset.
    this.moon = new THREE.DirectionalLight(0x8ca9d8, 0);
    this.moon.castShadow = false; // one fitted directional shadow atlas is the bounded policy
    scene.add(this.moon); scene.add(this.moon.target);

    // A small, deterministic equirectangular radiance map gives Standard/Physical materials
    // genuine specular environment sampling. It is recoloured in-place with sky/weather rather
    // than allocating a texture every frame. This deliberately is not a background substitute:
    // the procedural dome remains the visible sky and the texture is lighting-only.
    this.environmentBytes = new Uint8Array(16 * 8 * 4);
    this.environment = new THREE.DataTexture(this.environmentBytes,16,8,THREE.RGBAFormat);
    this.environment.mapping = THREE.EquirectangularReflectionMapping;
    this.environment.colorSpace = THREE.SRGBColorSpace;
    this.environment.name = 'w1-30-dynamic-environment-ibl';
    this.environment.needsUpdate = true;
    scene.environment = this.environment;

    this.scene = scene;
    this.scene.fog = new THREE.FogExp2(0x9aa79a, 0.0022);
  }

  /**
   * @param {number} hours 0..24
   * @param {string} weatherId a key of WEATHER
   * @param {THREE.Vector3} focus where the shadow frustum should sit
   */
  apply(hours, weatherId, focus, regionFog, env, frame=0) {
    const w = WEATHER[weatherId];
    if (!w) throw new Error(`unknown weather '${weatherId}'. Named states: ${Object.keys(WEATHER).join(', ')}`);
    this.rain.visible=this.features.atmosphere&&w.rain>0.02;
    if(this.rain.visible&&focus){const fall=(frame*.31)%22,n=Math.max(1,Math.round(320*w.rain));for(let i=0;i<n;i++){const x=(this.rainSeed[i*3]-.5)*28,z=(this.rainSeed[i*3+1]-.5)*28,y=((this.rainSeed[i*3+2]*22-fall+22)%22)-5,k=i*6;this.rainPos[k]=x;this.rainPos[k+1]=y;this.rainPos[k+2]=z;this.rainPos[k+3]=x+.12;this.rainPos[k+4]=y-(.9+w.rain*.8);this.rainPos[k+5]=z+.05;}this.rain.geometry.setDrawRange(0,n*2);this.rain.geometry.attributes.position.needsUpdate=true;this.rain.position.copy(focus);this.rain.material.opacity=.18+w.rain*.28;}

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

    this.sun.intensity = this.features.lighting ? w.sunIntensity * Math.max(0.02, day) : 0;
    this.sun.color.copy(this.uniforms.uSunColour.value);
    this.sun.position.copy(dir).multiplyScalar(120);
    if (focus) {
      // Snap the fitted 120 m shadow volume to its 2048-map texel. Slow camera motion can no
      // longer swim the shadow projection across stationary geometry.
      const texel=120/this.sun.shadow.mapSize.x;
      const sx=Math.round(focus.x/texel)*texel, sz=Math.round(focus.z/texel)*texel;
      this.sun.position.x+=sx; this.sun.position.y+=focus.y; this.sun.position.z+=sz;
      this.sun.target.position.set(sx,focus.y,sz);
    }
    else this.sun.target.position.set(0, 0, 0);
    this.sun.target.updateMatrixWorld();
    this.sun.castShadow = this.features.shadows;
    this.moon.position.copy(dir).multiplyScalar(-120).add(this.sun.target.position);
    this.moon.target.position.copy(this.sun.target.position); this.moon.target.updateMatrixWorld();

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
    this.moon.intensity = this.features.lighting ? night * (0.54 + (1-w.overcast)*0.28) : 0;
    // W1-01 round 3. `ours_night` leave-one-out was 33.3% against M17 step 6's explicit >= 70%.
    // Two thirds of the DAY separability was tint, and at night there was not even that: every
    // region rendered as the same near-black. A region's night hue is now taken from the thing it
    // OWNS — the welkynd blue of Blackwood's pillars, the ember of the Clay Moor's kilns, the amber
    // of the Hive's comb, the jelly green of the Eastern Rootlands — mixed with its fog. That is a
    // per-region light SOURCE rather than a per-region exposure, which is the distinction the item
    // is making when it says a region must be identifiable at night.
    const regionNight = regionFog ? new THREE.Color(regionFog.colour) : hor.clone();
    if (regionFog && regionFog.glow) regionNight.lerp(new THREE.Color(regionFog.glow), 0.55);
    this.hemi.intensity = this.features.ibl ? w.ambient * Math.max(0.82, 1.18 + day * 0.72) : 0;
    this.hemi.color.copy(hor).lerp(regionNight, night * 0.85);
    this.hemi.groundColor.setRGB(0.34, 0.31, 0.24).lerp(regionNight, night * 0.55);
    this.fill.intensity = this.features.lighting ? w.ambient * lerp(0.68, 1.34, day) : 0;
    this.fill.color.copy(hor).lerp(regionNight, night * 0.70);

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
      // The two extinctions ADD, because that is what extinction coefficients do, and the
      // arithmetic is load-bearing rather than pedantic. The first version of this took `max()`
      // of the region's haze and the weather's, and W1-02's own consumption probe caught what
      // that costs: in the four regions whose own extinction is already high — Blackwood at
      // 0.018/m, the Hive, Marauder's Coast, the Stone Forest — the region term won against
      // EVERY state its machine can roll, so weather changed the frame by exactly nothing in four
      // of thirteen regions. That is `RI-WLD08` §5's "weather as a colour grade" arriving through
      // a `Math.max`.
      //
      // Adding them keeps S24 intact: the region still owns the hue and still sets the floor, and
      // weather can only ever make the air thicker, never clearer than the region's own.
      const sightline = env && Number.isFinite(env.sightlineM) ? env.sightlineM : 0;
      this.scene.fog.density = this.features.atmosphere ? (sightline > 0 ? base + 1.978 / sightline : base) : 0;
    } else {
      this.scene.fog.density = this.features.atmosphere ? w.fogDensity : 0;
      this.scene.fog.color.copy(hor).multiplyScalar(0.92);
    }

    // Encode the same zenith/horizon and celestial direction into the IBL. The bright sample
    // follows uSunDir, so moving time changes both diffuse atmosphere and physical reflections.
    for(let y=0;y<8;y++) for(let x=0;x<16;x++) {
      const i=(y*16+x)*4, t=1-y/7, c=hor.clone().lerp(zen,t);
      const a=x/16*Math.PI*2, sy=(.5-y/7)*Math.PI;
      const sample=new THREE.Vector3(Math.cos(a)*Math.cos(sy),Math.sin(sy),Math.sin(a)*Math.cos(sy));
      const hot=Math.pow(Math.max(0,sample.dot(dir)),48)*(1-w.overcast)*2.2;
      const sc=this.uniforms.uSunColour.value; c.r+=sc.r*hot; c.g+=sc.g*hot; c.b+=sc.b*hot;
      this.environmentBytes[i]=Math.min(255,Math.round(c.r*255));
      this.environmentBytes[i+1]=Math.min(255,Math.round(c.g*255));
      this.environmentBytes[i+2]=Math.min(255,Math.round(c.b*255)); this.environmentBytes[i+3]=255;
    }
    this.environment.needsUpdate=true;
    this.scene.environment=this.features.ibl?this.environment:null;
    this.mesh.visible=this.features.sky;
    return weatherId;
  }

  setFeature(name,enabled) {
    if(!(name in this.features)) throw new Error(`unknown sky sabotage '${name}'`);
    this.features[name]=!!enabled; return this.features[name];
  }

  /** The dome is drawn at the far plane, so it must be centred on the camera every frame. */
  followCamera(camera) {
    this.mesh.position.copy(camera.position);
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
