#!/usr/bin/env node
/**
 * f10-r7-eye-contrast.mjs — the eye must be DARKER than the face it sits in, on every race.
 *
 * THE BAR IS A MEASUREMENT OF THE REFERENCE PLATE, NOT A PREFERENCE. `corpus/70-visual/refs/modern/
 * character_closeup/REF-ER__steam-dyules-2764067250.jpg` decoded at native 1920x1080 and sampled
 * with Rec.709 luma over patches:
 *
 *     open eye (iris + sclera)   mean 63.6   brightest pixel in the patch 134.9
 *     cheek below the eye        mean 157.4
 *     forehead                   mean 151.7
 *     nose bridge                mean 153.1
 *
 * Two ratios follow, and they are the whole rule:
 *
 *     eye mean / skin mean    = 63.6 / 157.4  = 0.40    a dark recess
 *     eye BRIGHTEST / skin    = 134.9 / 157.4 = 0.86    the small light iris — still darker than skin
 *
 * WHY A CONSTANT CANNOT SATISFY IT. `W1-F10-r6-appearance` reported the sclera as "lighter than
 * every humanoid skin swatch". Recomputed here rather than inherited, that is not quite true and
 * the correction is the point: round 6's 0xa79f8c (luma 159.3) is 1.69x a Dunmer's skin and 0.89x
 * a Nord's. ONE CONSTANT IS A BEAD ON ONE RACE AND INVISIBLE ON ANOTHER. So round 7 sets both eye
 * colours as fractions of each actor's own resolved skin, and this tool checks the fractions hold
 * across every shipped tint.
 *
 * It reads `game/src/render/renderer.js`'s RACE_TINT table and `game/src/render/actor.js`'s eye
 * constants OUT OF THE SOURCE — no browser, no GPU, no fixture copy that can drift.
 *
 * USAGE  node tools/visual/f10-r7-eye-contrast.mjs [--json]
 * Exits non-zero if any race's eye is brighter than its skin.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

/** Rec.709 luma of a 0xRRGGBB integer, 0..255. */
const luma = (hex) => 0.2126 * ((hex >> 16) & 255) + 0.7152 * ((hex >> 8) & 255) + 0.0722 * (hex & 255);

// ---- the bar, from the plate ----------------------------------------------------------------
const PLATE = { eye_mean: 63.6, eye_max: 134.9, skin_mean: 157.4 };
const BAR_RECESS = PLATE.eye_mean / PLATE.skin_mean;   // 0.404
const BAR_ACCENT = PLATE.eye_max / PLATE.skin_mean;    // 0.857

// ---- the shipped race tints, parsed out of the renderer ---------------------------------------
const tintSrc = src('game/src/render/renderer.js');
const block = tintSrc.slice(tintSrc.indexOf('const RACE_TINT = {'), tintSrc.indexOf('const IMPACT_DECAL_COLOUR'));
const RACE_TINT = {};
for (const m of block.matchAll(/^\s*(\w+):\s*\[(0x[0-9a-fA-F]+),\s*(0x[0-9a-fA-F]+)\]/gm)) {
  RACE_TINT[m[1]] = [Number(m[2]), Number(m[3])];
}
// `lib/race-art.js` decides which races use the humanoid body plan, and only that plan carries the
// eye block this tool judges. Read, not assumed.
const artSrc = src('game/src/render/lib/race-art.js');
const humanoid = Object.keys(RACE_TINT).filter((r) => {
  const m = artSrc.match(new RegExp(`${r}\\s*:\\s*'([a-z]+)'`));
  return m ? m[1] === 'humanoid' : !/saxhleel|argonian|naga/.test(r);
});

// ---- the eye constants, parsed out of actor.js ------------------------------------------------
const actorSrc = src('game/src/render/actor.js');
const grab = (name) => {
  const m = actorSrc.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`));
  if (!m) throw new Error(`${name} not found in game/src/render/actor.js — the eye block moved or was reverted`);
  return Number(m[1]);
};
const SCLERA = grab('EYE_SCLERA_OF_SKIN');
const IRIS = grab('EYE_IRIS_OF_SKIN');

const rows = [];
let worst = 0;
for (const race of humanoid.sort()) {
  const skinHex = RACE_TINT[race][0];
  const sl = luma(skinHex);
  // `Color.multiplyScalar` scales the LINEAR components. THREE parses `setHex` as sRGB into linear
  // working space, so scaling by k and re-encoding is not the same as scaling the sRGB byte. Both
  // are reported: `ratio_linear` is what the renderer actually does, `ratio_srgb` is what a reader
  // measuring the frame with a luma formula will see.
  const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  const scaleSrgbByte = (byte, k) => Math.round(Math.min(1, Math.max(0, toSrgb(toLin(byte / 255) * k))) * 255);
  const scaled = (hex, k) => (scaleSrgbByte((hex >> 16) & 255, k) << 16) | (scaleSrgbByte((hex >> 8) & 255, k) << 8) | scaleSrgbByte(hex & 255, k);
  const scleraHex = scaled(skinHex, SCLERA), irisHex = scaled(skinHex, IRIS);
  const r = { race, skin: `0x${skinHex.toString(16)}`, skin_luma: +sl.toFixed(1),
    sclera: `0x${scleraHex.toString(16).padStart(6, '0')}`, sclera_luma: +luma(scleraHex).toFixed(1),
    iris: `0x${irisHex.toString(16).padStart(6, '0')}`, iris_luma: +luma(irisHex).toFixed(1) };
  r.ratio_recess = +(r.sclera_luma / sl).toFixed(3);
  r.ratio_accent = +(r.iris_luma / sl).toFixed(3);
  r.pass = r.ratio_accent < 1.0 && r.ratio_recess < 1.0;
  worst = Math.max(worst, r.ratio_accent);
  rows.push(r);
}

// ---- ROUND 8: THE SAXHLEEL FAMILY, WHICH THIS TOOL DID NOT COVER AND THE PLAYER IS IN ---------
//
// The nine races above are `base.humanoid` and carry round 7's eye block. The PLAYER is
// `player.saxhleel`, and so are 260 of the 408 shipped NPC records (`argonian` 181, `saxhleel` 77,
// `naga` 2, counted from `game/data/npcs/*.json` by `lib/race-art.js`'s own map). Their eye was a
// typed `0xe2c46c` with an emissive on top and was never scored by anything.
//
// Round 8 keeps the amber HUE — it is Morrowind's Argonian eye and `RI-VIS10` B2 asks for a
// non-human one — and takes the VALUE from the same two constants, with the roles swapped because a
// saxhleel eye is a large iris with a dark slit rather than a sclera with a small iris: the ball
// carries the ACCENT fraction and the slit sits far below the recess one. The bar that both
// families are judged against is the one the plate actually establishes and the one that was being
// failed: **nothing in the eye may be brighter than the skin around it.**
const SAX_HUE_M = actorSrc.match(/SAX_EYE_HUE\s*=\s*(0x[0-9a-fA-F]+)/);
if (!SAX_HUE_M) throw new Error('SAX_EYE_HUE not found in game/src/render/actor.js — the saxhleel eye block moved or was reverted');
const SAX_HUE = Number(SAX_HUE_M[1]);
const SAX_PUPIL_M = actorSrc.match(/multiplyScalar\(EYE_SCLERA_OF_SKIN \* ([0-9.]+)\)/);
const SAX_PUPIL_K = SAX_PUPIL_M ? Number(SAX_PUPIL_M[1]) : null;
if (SAX_PUPIL_K === null) throw new Error('the saxhleel pupil fraction was not found in actor.js');

const toLinC = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgbC = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const linOf = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((b) => toLinC(b / 255));
const linLuma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const hexOf = (lin) => lin.map((c) => Math.round(Math.min(1, Math.max(0, toSrgbC(c))) * 255))
  .reduce((acc, b, i) => acc | (b << (8 * (2 - i))), 0) >>> 0;

const saxRaces = Object.keys(RACE_TINT).filter((r) => {
  const m = artSrc.match(new RegExp(`${r}\\s*:\\s*'([a-z]+)'`));
  return m ? m[1] === 'saxhleel' : false;
}).sort();

const OLD_SAX_EYE = 0xe2c46c;              // the shipped colour before round 8, emissive on top
const saxRows = saxRaces.map((race) => {
  const skinHex = RACE_TINT[race][0];
  const skinLin = linOf(skinHex), sl = luma(skinHex);
  const hueLin = linOf(SAX_HUE), hueL = linLuma(hueLin);
  const target = linLuma(skinLin) * IRIS;
  const eyeHex = hexOf(hueLin.map((c) => c * (hueL > 1e-5 ? target / hueL : 0)));
  const pupHex = hexOf(skinLin.map((c) => c * SCLERA * SAX_PUPIL_K));
  const r = { race, skin: `0x${skinHex.toString(16)}`, skin_luma: +sl.toFixed(1),
    eye: `0x${eyeHex.toString(16).padStart(6, '0')}`, eye_luma: +luma(eyeHex).toFixed(1),
    pupil: `0x${pupHex.toString(16).padStart(6, '0')}`, pupil_luma: +luma(pupHex).toFixed(1) };
  r.ratio_accent = +(r.eye_luma / sl).toFixed(3);
  r.ratio_recess = +(r.pupil_luma / sl).toFixed(3);
  r.before_round8 = +(luma(OLD_SAX_EYE) / sl).toFixed(3);
  r.pass = r.ratio_accent < 1.0 && r.ratio_recess < 1.0;
  return r;
});

// The old constants, scored on the same scale, so the change is arguable rather than asserted.
const OLD_SCLERA = 0xa79f8c, OLD_PUPIL = 0x1a1310;
const oldRows = humanoid.sort().map((race) => {
  const sl = luma(RACE_TINT[race][0]);
  return { race, skin_luma: +sl.toFixed(1), ratio_recess: +(luma(OLD_SCLERA) / sl).toFixed(3), ratio_accent: +(luma(OLD_SCLERA) / sl).toFixed(3) };
});

const failures = [...rows, ...saxRows].filter((r) => !r.pass);
const out = { tool: 'f10-r7-eye-contrast', plate: PLATE, bar: { recess: +BAR_RECESS.toFixed(3), accent: +BAR_ACCENT.toFixed(3) },
  constants: { EYE_SCLERA_OF_SKIN: SCLERA, EYE_IRIS_OF_SKIN: IRIS, SAX_EYE_HUE: `0x${SAX_HUE.toString(16)}`, SAX_PUPIL_K },
  races: rows.length + saxRows.length, rows, saxhleel_rows: saxRows, before_round7: oldRows, failures: failures.length };

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
} else {
  console.log(`plate bar: eye mean is ${BAR_RECESS.toFixed(3)}x skin; brightest eye pixel is ${BAR_ACCENT.toFixed(3)}x skin. Nothing in the eye may exceed 1.000x.`);
  console.log(`constants read from actor.js: sclera ${SCLERA} of skin, iris ${IRIS} of skin\n`);
  console.log('race       skin      luma   sclera    luma  recess   iris      luma  accent   BEFORE r7 (0xa79f8c)');
  for (const r of rows) {
    const b = oldRows.find((o) => o.race === r.race);
    console.log(`${r.race.padEnd(10)} ${r.skin.padEnd(9)} ${String(r.skin_luma).padStart(5)}  ${r.sclera} ${String(r.sclera_luma).padStart(6)}  ${String(r.ratio_recess).padStart(6)}  ${r.iris} ${String(r.iris_luma).padStart(6)}  ${String(r.ratio_accent).padStart(6)}   ${String(b.ratio_accent).padStart(6)}${b.ratio_accent > 1 ? '  <- BRIGHTER THAN THE FACE' : ''}`);
  }
  console.log('\nsaxhleel family (round 8) — the amber hue is kept, the value is the plate; the BALL is the accent and the slit is the dark');
  console.log('race       skin      luma   eye       luma  accent   pupil     luma  recess   BEFORE r8 (0xe2c46c)');
  for (const r of saxRows) {
    console.log(`${r.race.padEnd(10)} ${r.skin.padEnd(9)} ${String(r.skin_luma).padStart(5)}  ${r.eye} ${String(r.eye_luma).padStart(6)}  ${String(r.ratio_accent).padStart(6)}  ${r.pupil} ${String(r.pupil_luma).padStart(6)}  ${String(r.ratio_recess).padStart(6)}   ${String(r.before_round8).padStart(6)}${r.before_round8 > 1 ? '  <- BRIGHTER THAN THE FACE' : ''}`);
  }
  const saxWorstBefore = Math.max(...saxRows.map((r) => r.before_round8));
  console.log(`\nbefore round 8, ${saxRows.filter((r) => r.before_round8 > 1).length} of ${saxRows.length} saxhleel races had an eye BRIGHTER than their own skin — worst ${saxWorstBefore.toFixed(3)}x, and that is the body plan the PLAYER is on.`);
  console.log(`\n${failures.length} failure(s); worst accent ratio ${Math.max(worst, ...saxRows.map((r) => r.ratio_accent)).toFixed(3)}`);
  const wasBad = oldRows.filter((o) => o.ratio_accent > 1).length;
  console.log(`before round 7, ${wasBad} of ${oldRows.length} humanoid races had an eye BRIGHTER than their own skin.`);
}
process.exit(failures.length ? 1 : 0);
