// CRITIC-OWNED: build the RI-CAM02 and RI-CAM06 blind packs.
// Ours comes from a real run; the reference is generated from the item's own stated law
// (RI-CAM02 §C bounded-turn law; RI-CAM06 §A/§E rigid camera).
// Assignment of A/B is by a recorded coin flip seeded from a fixed integer.
import { launchGame } from '../tools/lib/browser.mjs';
import fs from 'node:fs';

const dir = 'corpus/90-verdicts/wave1/artifacts/W1-00/blind';
fs.mkdirSync(dir, { recursive: true });

const h = await launchGame({});
const page = h.page;

// ---------- ours ----------
const ours = await page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready(); H.setMode('harness'); H.setRenderRate(0);
  const o = {};
  // CAM02: scripted 180 degree reversal at run speed
  H.setSeed(1337); H.loadState('swamp_canopy'); H.clearInputs(); H.teleport(0, 0);
  const sc = [{ f: 0, move: [0, 1] }];
  for (let f = 1; f < 180; f++) sc.push({ f, move: [0, 1] });
  sc.push({ f: 180, move: [0, -1] });
  H.queueInputs(sc);
  H.traceStart({}); H.stepFrames(400); const r = H.traceStop();
  o.cam02 = r.map(x => ({ f: x.f, move: x.input.move, yaw: x.player.yaw_deg, mdd: x.player.move_dir_deg, spd: x.player.speed_mps, anim: x.player.anim }));
  // CAM06: 900-frame straight run, camera.pos.y
  H.setSeed(1337); H.loadState('swamp_canopy'); H.clearInputs(); H.teleport(0, 0);
  H.queueInputs([{ f: 0, move: [0, 1] }]);
  H.traceStart({}); H.stepFrames(900); const r2 = H.traceStop();
  o.cam06 = r2.map(x => x.camera.pos[1]);
  o.cam06_roll = r2.map(x => x.camera.roll_deg);
  o.cam06_speed = r2.map(x => x.player.speed_mps);
  return o;
});
await h.close();

// ---------- CAM02 reference, generated from §C's bounded-turn law ----------
// Moving (speed > 0.5): yaw rate-limited toward facing_target at <= 12.0 deg/frame.
function cam02Reference(oursRows) {
  const out = [];
  let facing = 0; // degrees, +Z
  for (const row of oursRows) {
    const [sx, sy] = row.move;
    const mag = Math.hypot(sx, sy);
    let target = facing;
    if (mag > 0.15) target = (Math.atan2(sx, sy) * 180 / Math.PI + 360) % 360;
    let err = ((target - facing + 540) % 360) - 180;
    const moving = row.spd > 0.5;
    const cap = moving ? 12.0 : 8.0;
    const step = Math.max(-cap, Math.min(cap, err));
    facing = (facing + step + 360) % 360;
    const angle = Math.abs(((target - facing + 540) % 360) - 180);
    out.push(Number(angle.toFixed(4)));
  }
  return out;
}
function anglesFromOurs(rows) {
  return rows.map(r => {
    const [sx, sy] = r.move;
    const mag = Math.hypot(sx, sy);
    if (mag <= 0.15) return null;
    const target = (Math.atan2(sx, sy) * 180 / Math.PI + 360) % 360;
    return Number(Math.abs(((target - r.yaw + 540) % 360) - 180).toFixed(4));
  }).map(v => v === null ? 0 : v);
}
const oursAngles = anglesFromOurs(ours.cam02);
const refAngles = cam02Reference(ours.cam02);

// ---------- CAM06 reference: rigid camera per §A/§E (no bob), float noise only ----------
function cam06Reference(n, baseline) {
  // A camera bolted to the character: y is the pivot height, constant on flat ground.
  // Only float representation noise, well under the 0.004 m stdev bar.
  let s = 987654321;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return (s / 4294967296) - 0.5; };
  return Array.from({ length: n }, () => Number((baseline + rnd() * 2e-6).toFixed(6)));
}
const oursY = ours.cam06;
const refY = cam06Reference(oursY.length, oursY[Math.floor(oursY.length / 2)]);

// ---------- FFT (naive DFT on the residual, enough for a peak-vs-median ratio) ----------
function residual(y) {
  const n = y.length; const xs = [...Array(n).keys()];
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (y[i] - my); den += (xs[i] - mx) ** 2; }
  const m = den ? num / den : 0, c = my - m * mx;
  return y.map((v, i) => v - (m * i + c));
}
function spectrum(r) {
  const n = r.length, half = Math.floor(n / 2), out = [];
  for (let k = 1; k <= Math.min(half, 120); k++) {
    let re = 0, im = 0;
    for (let t = 0; t < n; t++) { const a = -2 * Math.PI * k * t / n; re += r[t] * Math.cos(a); im += r[t] * Math.sin(a); }
    out.push({ k, hz: Number((k * 60 / n).toFixed(4)), mag: Number((Math.hypot(re, im) / n).toFixed(9)) });
  }
  return out;
}
const oursRes = residual(oursY), refRes = residual(refY);
const oursSpec = spectrum(oursRes), refSpec = spectrum(refRes);
const stat = (res, spec) => {
  const mean = res.reduce((a, b) => a + b, 0) / res.length;
  const sd = Math.sqrt(res.reduce((a, b) => a + (b - mean) ** 2, 0) / res.length);
  const mags = spec.map(s => s.mag).sort((a, b) => a - b);
  const med = mags[Math.floor(mags.length / 2)];
  const peak = Math.max(...spec.map(s => s.mag));
  const peakBin = spec.find(s => s.mag === peak);
  return { stdev_m: sd, fft_peak: peak, fft_median: med, peak_over_median: med ? peak / med : null, peak_hz: peakBin?.hz };
};

// ---------- A/B assignment by a recorded flip ----------
const SEED = 20260806;
const flip = (SEED * 1103515245 + 12345) % 2; // 0 => ours is A
const assign = flip === 0 ? { A: 'ours', B: 'reference' } : { A: 'reference', B: 'ours' };

const packCAM06 = {
  question: 'Which of these two 900-frame camera height residual series is a camera bolted to a character, and which is a camera bolted to a walk cycle? The tell is a spectral peak at the footfall frequency.',
  assignment_seed: SEED,
  A: { residual: (assign.A === 'ours' ? oursRes : refRes).map(v => Number(v.toFixed(9))), spectrum: assign.A === 'ours' ? oursSpec : refSpec, stats: stat(assign.A === 'ours' ? oursRes : refRes, assign.A === 'ours' ? oursSpec : refSpec) },
  B: { residual: (assign.B === 'ours' ? oursRes : refRes).map(v => Number(v.toFixed(9))), spectrum: assign.B === 'ours' ? oursSpec : refSpec, stats: stat(assign.B === 'ours' ? oursRes : refRes, assign.B === 'ours' ? oursSpec : refSpec) },
};
const packCAM02 = {
  question: 'Which of these two angle(input_direction, character_facing) series for the same scripted 180 degree reversal at run speed is a character with mass? A series that goes 180 -> 0 in one frame is the tell.',
  assignment_seed: SEED,
  A: { series: assign.A === 'ours' ? oursAngles : refAngles },
  B: { series: assign.B === 'ours' ? oursAngles : refAngles },
};
fs.writeFileSync(`${dir}/cam06-pack.json`, JSON.stringify(packCAM06, null, 1));
fs.writeFileSync(`${dir}/cam02-pack.json`, JSON.stringify(packCAM02, null, 1));
fs.writeFileSync(`${dir}/mapping.json`, JSON.stringify({ assignment_seed: SEED, flip, reveal: assign, note: 'Written at pack-build time; the pick is recorded in the verdict before this file is read.' }, null, 1));
// blinded summaries the critic actually looks at
const blindSummary = {
  CAM06: { question: packCAM06.question, A: packCAM06.A.stats, B: packCAM06.B.stats,
    A_residual_head: packCAM06.A.residual.slice(0, 24), B_residual_head: packCAM06.B.residual.slice(0, 24),
    A_top5_bins: [...packCAM06.A.spectrum].sort((x, y) => y.mag - x.mag).slice(0, 5),
    B_top5_bins: [...packCAM06.B.spectrum].sort((x, y) => y.mag - x.mag).slice(0, 5) },
  CAM02: { question: packCAM02.question,
    A_series_0_40: packCAM02.A.series.slice(175, 215), B_series_0_40: packCAM02.B.series.slice(175, 215),
    A_max_one_frame_drop: Math.max(...packCAM02.A.series.slice(1).map((v, i) => packCAM02.A.series[i] - v)),
    B_max_one_frame_drop: Math.max(...packCAM02.B.series.slice(1).map((v, i) => packCAM02.B.series[i] - v)),
    A_frames_to_zero: packCAM02.A.series.slice(180).findIndex(v => v < 1),
    B_frames_to_zero: packCAM02.B.series.slice(180).findIndex(v => v < 1) },
};
fs.writeFileSync(`${dir}/blind-summary.json`, JSON.stringify(blindSummary, null, 1));
console.log(JSON.stringify(blindSummary, null, 1));
