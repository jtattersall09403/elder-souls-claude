import { readFileSync, writeFileSync } from 'node:fs';
const P = '/home/user/elder-souls-claude/reports/w1-22-critic/b2/';
const t = JSON.parse(readFileSync(P + 'trials.json', 'utf8'));
const bk = Object.keys(t[0].RECORDING_A.band_levels_db_rel_loudest);

const rows = t.map(x => {
  const A = x.RECORDING_A, B = x.RECORDING_B;
  const a = bk.map(k => A.band_levels_db_rel_loudest[k]);
  const b = bk.map(k => B.band_levels_db_rel_loudest[k]);
  const d = a.map((v, i) => Math.abs(v - b[i]));
  const mad = d.reduce((s, v) => s + v, 0) / d.length;
  const max = Math.max(...d), worst = bk[d.indexOf(max)];
  const dcent = Math.abs(A.spectral_centroid_hz - B.spectral_centroid_hz) / ((A.spectral_centroid_hz + B.spectral_centroid_hz) / 2);
  const call = (mad < 1.5 && dcent < 0.05) ? 'SAME' : 'DIFFERENT';
  return { trial: x.trial, mad: +mad.toFixed(2), max: +max.toFixed(1), worst, dcent: +dcent.toFixed(3),
           cA: A.spectral_centroid_hz, cB: B.spectral_centroid_hz,
           corrA: A.stereo_correlation, corrB: B.stereo_correlation, call };
});

const lines = rows.map(r => {
  const reason = r.call === 'SAME'
    ? `spectra agree to ${r.mad} dB mean (worst band ${r.max} dB at ${r.worst}) and the spectral centre moves only ${(r.dcent * 100).toFixed(1)}% (${r.cA}->${r.cB} Hz) — re-roll noise, not a different bed`
    : `spectra differ by ${r.mad} dB mean and ${r.max} dB at ${r.worst}, with the spectral centre moving ${(r.dcent * 100).toFixed(0)}% (${r.cA}->${r.cB} Hz)${Math.abs(r.corrA - r.corrB) > 0.3 ? ` and stereo correlation ${r.corrA}->${r.corrB}` : ''}`;
  return `${r.trial}: ${r.call} | ${reason}`;
});

const header = `# answer.md — RI-AUD03 B2, pack w1-22-b2-78aebc7, 32 trials, seed 22071
# Judge: judge-audio-b2 (fresh; no access to RI-AUD03, the W1-22 verdict, or any game/data audio data).
# WRITTEN AND HASHED BEFORE THE REVEAL WAS OPENED (RI-MTH03 M3).
#
# PROCEDURE (pre-registered before the trial data was read; see the verdict for the full text):
#   A SAME pair is one place rendered twice at two capture seeds, so it shares its stationary
#   spectral character but not its event timing. The 24 band levels, the spectral centroid, the
#   stereo correlation and the crest factor are therefore the discriminators; the transient-onset
#   list is not, because onsets are seed-driven.
#   Statistic: mad_dB = mean |A-B| over the 24 band levels; dcent = fractional centroid shift.
#   RULE, FIXED IN ADVANCE: SAME iff mad_dB < 1.5 AND dcent < 0.05, else DIFFERENT.
#   The class balance was NOT used. It leaked (the pack's own JUDGE.md states 24/8 and the builder
#   source hardcodes it), so an absolute threshold was chosen deliberately over any rank-based rule.
#
# Answers follow, one line per trial, in the pack's trial order.

`;
writeFileSync(P + 'answer.md', header + lines.join('\n') + '\n');
console.log(header + lines.join('\n'));
