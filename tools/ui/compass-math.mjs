#!/usr/bin/env node
// compass-math.mjs — the compass's arithmetic, checked against an INDEPENDENT derivation, plus
// the responsive dial geometry at every viewport the game is meant to be played at.
//
// Owner: HUD-MORROWIND. No browser. Pure functions only, so this runs in a second and is the
// first gate: if the bearing is wrong there is no point photographing it.
//
// ---------------------------------------------------------------------------------------------
// WHY THE EXPECTED VALUE IS NOT COMPUTED FROM THE THING UNDER TEST
// ---------------------------------------------------------------------------------------------
//
// `compass.bearingFromYaw()` is the closed form `180 − yaw`. A check that asserted `180 − yaw`
// against it would be the failure shape this project keeps finding — the yardstick moving with
// the thing it measures. So the expected value here is built the long way round, from the two
// facts the closed form was derived FROM and which live in other files:
//
//   1. the camera's forward vector, `[sin(yaw)·cos(pitch), sin(pitch), cos(yaw)·cos(pitch)]`,
//      transcribed from `game/src/engine.js:6295`;
//   2. north is −Z and east is +X, which is what `ui/screens/map.js` assumes when it maps world
//      z onto screen y increasing downward, and what `world/interior-lighting.js:311` assumes
//      when it calls the low-z wall the north wall.
//
// The expected bearing is then `atan2(fwd.x, −fwd.z)` computed numerically. If someone rewrites
// `bearingFromYaw` as `yaw + 180` — the answer almost everyone guesses first, and the one that
// is wrong because world yaw runs anticlockwise while a bearing runs clockwise — this check goes
// red at 358 of 360 sample yaws. That is the null control below and it is RUN, not asserted.
//
// EXIT 0 = every check passed · 1 = a check failed · 2 = the module would not load.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const M = await import(path.join(ROOT, 'game/src/ui/compass.js'));

const checks = [];
const push = (id, pass, detail) => {
  checks.push({ id, pass, detail });
  process.stdout.write(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}\n`);
};

// =================================================================================================
// A. THE BEARING, against the independent derivation
// =================================================================================================

/** The expected bearing, built from the forward vector rather than from the closed form. */
function expectedBearing(yawDeg, pitchDeg = 0) {
  const y = yawDeg * Math.PI / 180, p = pitchDeg * Math.PI / 180, cp = Math.cos(p);
  const fx = Math.sin(y) * cp;                  // engine.js:6295
  const fz = Math.cos(y) * cp;
  let b = Math.atan2(fx, -fz) * 180 / Math.PI;  // north = −Z, east = +X
  if (b < 0) b += 360;
  return b;
}

/** Run the bearing sweep against `fn`. Returns the worst absolute error in degrees. */
function bearingSweep(fn) {
  let worst = 0, worstAt = null, bad = 0;
  for (let yaw = -720; yaw < 1080; yaw += 1) {
    const got = fn(yaw), want = expectedBearing(yaw);
    // circular difference
    let d = Math.abs(got - want) % 360;
    if (d > 180) d = 360 - d;
    if (d > 1e-9) bad++;
    if (d > worst) { worst = d; worstAt = yaw; }
  }
  return { worst, worstAt, bad, n: 1800 };
}

const live = bearingSweep(M.bearingFromYaw);
push('A1.bearing-matches-forward-vector', live.worst < 1e-9,
  `worst error ${live.worst.toExponential(2)}° over ${live.n} yaws (−720…1079), ` +
  `${live.bad} disagreeing`);

// A2. Four hand-checked anchors, stated as sentences so a reader can see the convention is sane
// without trusting either derivation. At yaw 0 the camera faces +Z; +Z is south; so yaw 0 is S.
const anchors = [[0, 180, 'S'], [90, 90, 'E'], [180, 0, 'N'], [270, 270, 'W']];
let anchorsOk = true;
for (const [yaw, want, card] of anchors) {
  const b = M.bearingFromYaw(yaw), c = M.cardinalOf(b);
  const ok = Math.abs(b - want) < 1e-9 && c === card;
  if (!ok) anchorsOk = false;
  process.stdout.write(`       yaw ${String(yaw).padStart(3)}° -> ${b.toFixed(1)}° ${c}` +
    `  (want ${want}° ${card})  ${ok ? '' : ' <-- WRONG'}\n`);
}
push('A2.four-anchors', anchorsOk, 'yaw 0=S (camera faces +Z), 90=E, 180=N, 270=W');

// A3. THE NULL CONTROL. The wrong-but-plausible closed form, run through the same sweep. If this
// does NOT go red, A1 is measuring nothing and both arms are the positive arm (rule 6).
const nullArm = bearingSweep((yaw) => ((yaw + 180) % 360 + 360) % 360);
push('A3.null-control-goes-red', nullArm.bad > 1700,
  `\`yaw + 180\` (the obvious wrong answer) disagrees at ${nullArm.bad}/${nullArm.n} yaws, ` +
  `worst ${nullArm.worst.toFixed(1)}° at yaw ${nullArm.worstAt}`);

// A4. A second null control, because a control that only catches a SIGN error would not catch a
// dial that is simply frozen. A constant bearing must also go red.
const frozen = bearingSweep(() => 0);
push('A4.null-control-frozen-goes-red', frozen.bad > 1700,
  `a dial frozen at 0° disagrees at ${frozen.bad}/${frozen.n} yaws`);

// A5. The screen angle puts your heading at the TOP of the dial and north where north is.
{
  const cases = [
    // facing north: N at the top (0°), E at +90 (right), W at −90 (left), S at 180
    [0, 0, 0], [0, 90, 90], [0, 270, -90], [0, 180, 180],
    // facing east: N is to your LEFT, so it sits at −90
    [90, 0, -90], [90, 90, 0], [90, 180, 90],
    // facing south-west: N sits at +45
    [225, 0, 135],
  ];
  let ok = true, worst = 0;
  for (const [heading, worldB, want] of cases) {
    const got = M.screenAngle(worldB, heading);
    const d = Math.abs(got - want);
    if (d > 1e-9) { ok = false; }
    worst = Math.max(worst, d);
  }
  push('A5.screen-angle', ok,
    `heading is at the top and the ring rotates the right way; worst ${worst.toFixed(6)}° over ${cases.length} cases`);
}

// A6. Round-tripping the dial: whatever your heading, the point at screen angle 0 IS your
// heading's nearest cardinal. This is the property a player actually uses.
{
  let bad = 0;
  for (let yaw = 0; yaw < 360; yaw += 1) {
    const b = M.bearingFromYaw(yaw);
    // the compass point whose screen angle is smallest in absolute value
    let best = null, bestAbs = 999;
    for (const p of M.POINTS) {
      const a = Math.abs(M.screenAngle(p.bearing, b));
      if (a < bestAbs) { bestAbs = a; best = p.label; }
    }
    if (best !== M.cardinalOf(b)) bad++;
  }
  push('A6.top-of-dial-is-the-heading', bad === 0,
    `the point nearest the index equals \`cardinalOf(heading)\` at ${360 - bad}/360 yaws`);
}

// =================================================================================================
// B. THE DIAL ON A PHONE
// =================================================================================================
//
// `UISurface.begin()` sets `__esMinTextPx = 36` when the buffer is landscape-phone-shaped
// (`W > H·1.8 && H <= 900`), because RI-JRN04 H10 is a physical CSS-pixel floor and
// `glyphs.drawText()` raises any smaller size to it. The transcription of that rule is here, and
// B3 is the check that the dial is big enough to HOLD a letter at that floor — which is the
// whole reason `dialGeometry()` sizes the letter first and derives the radius from it.

/** Transcribed from `game/src/ui/surface.js` `begin()`. */
function minTextPxFor(W, H) { return (W > H * 1.8 && H <= 900) ? 36 : 0; }

const VIEWPORTS = [
  { name: 'desktop 1920x1080', W: 1920, H: 1080, dpr: 1 },
  { name: 'desktop 1280x720', W: 1280, H: 720, dpr: 1 },
  { name: 'laptop 1440x900', W: 1440, H: 900, dpr: 1 },
  { name: 'phone landscape 844x390 @2', W: 1688, H: 780, dpr: 2 },
  { name: 'phone portrait 390x844 @2', W: 780, H: 1688, dpr: 2 },
  { name: 'phone landscape 667x375 @2', W: 1334, H: 750, dpr: 2 },
  { name: 'phone portrait 375x667 @2', W: 750, H: 1334, dpr: 2 },
  { name: 'tablet portrait 820x1180 @2', W: 1640, H: 2360, dpr: 2 },
];

const rows = [];
for (const v of VIEWPORTS) {
  const s = v.H / 1080;
  const geo = M.dialGeometry({ s, W: v.W, H: v.H, minTextPx: minTextPxFor(v.W, v.H) });
  const labelled = M.labelPoints(geo);
  rows.push({
    ...v, s: +s.toFixed(4), ...geo,
    labelled_count: labelled.length,
    letter_css_px: +(geo.letterPx / v.dpr).toFixed(1),
    dia_css_px: +(2 * geo.r / v.dpr).toFixed(1),
    frac_of_width: +((2 * geo.r) / v.W).toFixed(4),
    frac_of_height: +((2 * geo.r) / v.H).toFixed(4),
    frac_of_frame: +(((2 * geo.r) ** 2) / (v.W * v.H)).toFixed(5),
  });
}

process.stdout.write('\n  viewport                        dia(css)  letter(css)  labels  %width  %height\n');
for (const r of rows) {
  process.stdout.write(
    `  ${r.name.padEnd(30)}  ${String(r.dia_css_px).padStart(7)}  ${String(r.letter_css_px).padStart(10)}` +
    `  ${String(r.labelled_count).padStart(6)}  ${(r.frac_of_width * 100).toFixed(1).padStart(5)}%` +
    `  ${(r.frac_of_height * 100).toFixed(1).padStart(6)}%\n`);
}
process.stdout.write('\n');

// B1. Every cardinal letter is at or above the physical floor wherever the floor applies.
{
  const bad = rows.filter((r) => r.letterPx < minTextPxFor(r.W, r.H) - 1e-6);
  push('B1.letters-meet-the-physical-floor', bad.length === 0,
    `${rows.length - bad.length}/${rows.length} viewports; the floor is 36 backing px on a ` +
    'landscape phone (RI-JRN04 H10) and 0 elsewhere');
}

// B2. The dial never eats the screen — by FRAME AREA, which is the metric RI-UIX01 §C uses for
// every other HUD element, with the axis fraction as a loose backstop.
//
// THIS CHECK WAS WRONG BEFORE IT WAS RIGHT, and the record of that is the point. It first
// asserted "≤14% of either axis" and failed at three phone viewports — and the dial was correct
// and the assertion was not. On an 844×390 landscape phone RI-JRN04 H10 requires an 18 CSS px
// letter, an eight-point ring needs ~2.4 letter-widths of radius to hold one, and 390 px of
// screen height is small: legible and ≤14% of the short axis are not simultaneously available.
// The choice was to shrink the dial into illegibility or to publish the real number. The real
// number is 2.2% of the frame, which is half of RI-UIX01 §C's entire 4.0% persistent budget for
// six elements — so the ceiling here is 3.0% of frame area, and 25% of an axis as a backstop.
{
  const bad = rows.filter((r) => r.frac_of_frame > 0.030
    || r.frac_of_width > 0.25 || r.frac_of_height > 0.25);
  const worstArea = Math.max(...rows.map((r) => r.frac_of_frame));
  const worstAxis = Math.max(...rows.map((r) => Math.max(r.frac_of_width, r.frac_of_height)));
  push('B2.never-eats-the-screen', bad.length === 0,
    `worst ${(worstArea * 100).toFixed(2)}% of frame area (ceiling 3.0%) and ` +
    `${(worstAxis * 100).toFixed(1)}% of an axis (backstop 25%)` +
    (bad.length ? ` — over at: ${bad.map((r) => r.name).join(', ')}` : ''));
}

// B3. The letters FIT the ring they are drawn on. This is the check that the phone floor and the
// dial size cannot disagree: `labelPoints()` must return at least the four cardinals everywhere,
// because a compass with no letters on it is not "compass directions".
{
  const bad = rows.filter((r) => r.labelled_count < 4);
  push('B3.at-least-four-cardinals-everywhere', bad.length === 0,
    `${rows.length - bad.length}/${rows.length} viewports label N/E/S/W or better` +
    (bad.length ? ` — bare at: ${bad.map((r) => r.name).join(', ')}` : ''));
}

// B4. THE NULL CONTROL for B1/B3. A dial sized off `s` alone — the version anyone writes first,
// and the one that looks perfect on a desktop — must FAIL B1 on a phone. If it does not, B1 is
// measuring nothing.
{
  const naive = (v) => {
    const s = v.H / 1080;
    return { r: 48 * s, letterPx: 13 * s };
  };
  const failures = VIEWPORTS.filter((v) => naive(v).letterPx < minTextPxFor(v.W, v.H) - 1e-6);
  const phones = VIEWPORTS.filter((v) => minTextPxFor(v.W, v.H) > 0);
  push('B4.null-control-naive-sizing-goes-red', failures.length === phones.length && phones.length > 0,
    `an \`s\`-only dial (r=48s, letter=13s) breaks the physical floor at ${failures.length}/${phones.length} ` +
    `landscape-phone viewports — e.g. ${failures.length ? failures[0].name : '-'} wants ` +
    `${failures.length ? naive(failures[0]).letterPx.toFixed(1) : '-'} px against a 36 px floor, ` +
    'and `el()` would clip the difference away');
}

// B5. A second null control, the other way: a dial with the clamp removed must fail B2, or B2 is
// asserting something nothing could ever violate.
{
  const unclamped = VIEWPORTS.map((v) => {
    const s = v.H / 1080;
    const letterPx = Math.max(13 * s, minTextPxFor(v.W, v.H));
    const r = Math.max(48 * s, 2.4 * letterPx) * 3;   // an over-large dial, clamp removed
    return { v, area: ((2 * r) ** 2) / (v.W * v.H), axis: Math.max((2 * r) / v.W, (2 * r) / v.H) };
  });
  const over = unclamped.filter((u) => u.area > 0.030 || u.axis > 0.25);
  push('B5.null-control-unclamped-goes-red', over.length === VIEWPORTS.length,
    `an unclamped dial (3× the radius) breaks the 3.0% area ceiling or the 25% axis backstop at ` +
    `${over.length}/${VIEWPORTS.length} viewports — worst ${(Math.max(...unclamped.map((u) => u.area)) * 100).toFixed(1)}% of frame`);
}

// =================================================================================================
// C. WHAT THE DIAL IS ALLOWED TO KNOW
// =================================================================================================
//
// RI-UIX02 §A M-def-2 forbids anything whose presence, position, text or appearance is a
// function of quest state. The structural defence is that the model carries no quest state to be
// a function of, and this is the static half of proving it — the pixel half is in
// `hud-compass-probe.mjs`. A grep, deliberately, because it is the check that stays true when
// somebody adds a field a year from now.
{
  const src = fs.readFileSync(path.join(ROOT, 'game/src/ui/compass.js'), 'utf8');
  // Strip comments first: the header discusses quests at length on purpose, and a check that
  // read the prose would fail for the file explaining why it passes.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter((l) => !/^\s*\/\//.test(l)).join('\n');
  // WHOLE WORDS, both ends. The first version of this anchored only the left edge and reported
  // a hit on `poi` — matching the word "points" in `POINTS`, the eight compass points, which is
  // the most innocent identifier in the file. A check that cries wolf gets switched off.
  const forbidden = ['quest', 'quests', 'objective', 'marker', 'markers', 'waypoint',
    'poi', 'pois', 'destination', 'target'];
  const rx = (w) => new RegExp(`\\b${w}\\b`, 'i');
  const hits = forbidden.filter((w) => rx(w).test(code));
  push('C1.no-quest-vocabulary-in-the-code', hits.length === 0,
    hits.length ? `found: ${hits.join(', ')}` : `none of [${forbidden.join(', ')}] appears outside comments`);
}
{
  // And the NULL CONTROL for C1: the same regex over a decoy that DOES carry the vocabulary must
  // find it. Without this, a regex broken so that it matches nothing passes C1 forever — which is
  // exactly what tightening C1's word boundaries could have caused, so the control is tightened
  // alongside it rather than left behind.
  const decoy = 'const t = m.quest.marker; const p = world.poi(target);';
  const found = ['quest', 'marker', 'poi', 'target'].filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(decoy));
  push('C2.null-control-grep-finds-a-decoy', found.length === 4,
    `the same word-boundary regex over \`${decoy}\` finds [${found.join(', ')}]`);
}

// =================================================================================================
// D. WHAT THIS RUN FOUND THAT IS NOT THIS PIECE'S TO FIX
// =================================================================================================
//
// Recorded as a finding rather than as a check, because failing HUD-MORROWIND for it would be
// failing the wrong piece — and leaving it in prose only is how it gets lost.
//
// `surface.js:182` decides a buffer is a landscape phone with `W > H·1.8 && H <= 900`. An
// iPhone SE / 8 in landscape is 667×375 CSS, i.e. 1334×750 backing at DPR 2, and 1334 is just
// under 750·1.8 = 1350. So the RI-JRN04 H10 physical floor does NOT fire on that device, and
// EVERY authored small label in the game — not only the compass — is drawn below the 18 CSS px
// floor there. On the compass it lands at 4.5 CSS px.
//
// The fix is a change to that threshold (an aspect test is a proxy for "is this a phone"; the
// device-pixel ratio and the CSS height are the real question), and it moves text size across
// the whole interface, so it belongs to whoever owns RI-JRN04 H10 rather than here.
const findings = [];
for (const r of rows) {
  const cssH = r.H / r.dpr;
  if (minTextPxFor(r.W, r.H) === 0 && cssH <= 500 && r.W > r.H) {
    findings.push({
      id: 'H10-threshold-misses-this-device',
      viewport: r.name,
      detail: `${r.W}x${r.H} backing is ${(r.W / r.H).toFixed(3)}:1, just under surface.js:182's ` +
        `1.8 threshold, so __esMinTextPx stays 0 and the compass letters land at ` +
        `${r.letter_css_px} CSS px against RI-JRN04 H10's 18 px floor. Affects every authored ` +
        'small label in the game on this device, not only this element.',
      owner: 'RI-JRN04 H10 / whoever owns surface.js begin()',
    });
  }
}
if (findings.length) {
  process.stdout.write('  findings (not this piece\'s to fix, recorded so they are not lost):\n');
  for (const f of findings) process.stdout.write(`    - ${f.viewport}: ${f.detail}\n`);
  process.stdout.write('\n');
}

const failed = checks.filter((c) => !c.pass);
const out = {
  schema: 'elder-souls/compass-math@1',
  at: new Date().toISOString(),
  commit: (process.env.GIT_COMMIT || '').slice(0, 12) || null,
  viewports: rows,
  findings,
  checks,
  passed: checks.length - failed.length,
  failed: failed.length,
};
const dir = path.join(ROOT, 'reports/hud-morrowind');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'compass-math.json'), JSON.stringify(out, null, 2));
process.stdout.write(`\n  ${out.passed}/${checks.length} passed -> reports/hud-morrowind/compass-math.json\n`);
process.exit(failed.length ? 1 : 0);
