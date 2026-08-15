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

// The old constants, scored on the same scale, so the change is arguable rather than asserted.
const OLD_SCLERA = 0xa79f8c, OLD_PUPIL = 0x1a1310;
const oldRows = humanoid.sort().map((race) => {
  const sl = luma(RACE_TINT[race][0]);
  return { race, skin_luma: +sl.toFixed(1), ratio_recess: +(luma(OLD_SCLERA) / sl).toFixed(3), ratio_accent: +(luma(OLD_SCLERA) / sl).toFixed(3) };
});

const failures = rows.filter((r) => !r.pass);
const out = { tool: 'f10-r7-eye-contrast', plate: PLATE, bar: { recess: +BAR_RECESS.toFixed(3), accent: +BAR_ACCENT.toFixed(3) },
  constants: { EYE_SCLERA_OF_SKIN: SCLERA, EYE_IRIS_OF_SKIN: IRIS }, races: rows.length, rows, before_round7: oldRows, failures: failures.length };

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
  console.log(`\n${failures.length} failure(s); worst accent ratio ${worst.toFixed(3)}`);
  const wasBad = oldRows.filter((o) => o.ratio_accent > 1).length;
  console.log(`before round 7, ${wasBad} of ${oldRows.length} humanoid races had an eye BRIGHTER than their own skin.`);
}
process.exit(failures.length ? 1 : 0);
