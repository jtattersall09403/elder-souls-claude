# answer.md — RI-AUD03 B2, pack w1-22-b2-78aebc7, 32 trials, seed 22071
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

T01: DIFFERENT | spectra differ by 13.02 dB mean and 33 dB at 880-1097Hz, with the spectral centre moving 30% (2842->2112 Hz) and stereo correlation 0.796->0.024
T02: SAME | spectra agree to 0.76 dB mean (worst band 1.8 dB at 62-78Hz) and the spectral centre moves only 4.7% (327->312 Hz) — re-roll noise, not a different bed
T03: DIFFERENT | spectra differ by 9.14 dB mean and 21.5 dB at 6415-8000Hz, with the spectral centre moving 41% (2280->3469 Hz) and stereo correlation 0.792->0.242
T04: SAME | spectra agree to 0.62 dB mean (worst band 1.3 dB at 150-188Hz) and the spectral centre moves only 1.5% (1493->1471 Hz) — re-roll noise, not a different bed
T05: DIFFERENT | spectra differ by 20.17 dB mean and 46.3 dB at 40-50Hz, with the spectral centre moving 86% (588->1471 Hz) and stereo correlation 0.357->0.991
T06: DIFFERENT | spectra differ by 19.47 dB mean and 34.2 dB at 121-150Hz, with the spectral centre moving 141% (327->1870 Hz)
T07: DIFFERENT | spectra differ by 17.71 dB mean and 44.4 dB at 40-50Hz, with the spectral centre moving 13% (588->514 Hz) and stereo correlation 0.357->0.994
T08: DIFFERENT | spectra differ by 15.66 dB mean and 36.2 dB at 40-50Hz, with the spectral centre moving 34% (1493->2112 Hz) and stereo correlation 0.989->0.024
T09: DIFFERENT | spectra differ by 21.37 dB mean and 53.8 dB at 40-50Hz, with the spectral centre moving 3% (1925->1870 Hz)
T10: DIFFERENT | spectra differ by 19.45 dB mean and 44.7 dB at 5144-6415Hz, with the spectral centre moving 160% (2842->312 Hz)
T11: DIFFERENT | spectra differ by 22.35 dB mean and 48.5 dB at 40-50Hz, with the spectral centre moving 61% (588->312 Hz) and stereo correlation 0.357->0.999
T12: SAME | spectra agree to 0.6 dB mean (worst band 1.7 dB at 62-78Hz) and the spectral centre moves only 2.8% (2344->2280 Hz) — re-roll noise, not a different bed
T13: DIFFERENT | spectra differ by 27.42 dB mean and 60.4 dB at 2653-3308Hz, with the spectral centre moving 181% (2280->112 Hz)
T14: DIFFERENT | spectra differ by 25.12 dB mean and 68.1 dB at 78-97Hz, with the spectral centre moving 114% (1934->528 Hz)
T15: DIFFERENT | spectra differ by 17.21 dB mean and 37.5 dB at 6415-8000Hz, with the spectral centre moving 147% (350->2280 Hz)
T16: DIFFERENT | spectra differ by 14.65 dB mean and 40.6 dB at 121-150Hz, with the spectral centre moving 112% (1870->528 Hz)
T17: SAME | spectra agree to 0.95 dB mean (worst band 2.8 dB at 50-62Hz) and the spectral centre moves only 3.0% (3469->3366 Hz) — re-roll noise, not a different bed
T18: DIFFERENT | spectra differ by 15.42 dB mean and 27.5 dB at 40-50Hz, with the spectral centre moving 17% (3366->2842 Hz) and stereo correlation 0.231->0.796
T19: SAME | spectra agree to 0.14 dB mean (worst band 0.7 dB at 454-566Hz) and the spectral centre moves only 0.5% (1925->1934 Hz) — re-roll noise, not a different bed
T20: DIFFERENT | spectra differ by 16.03 dB mean and 31.8 dB at 2127-2653Hz, with the spectral centre moving 90% (133->350 Hz)
T21: SAME | spectra agree to 0.24 dB mean (worst band 1.3 dB at 50-62Hz) and the spectral centre moves only 0.0% (1870->1870 Hz) — re-roll noise, not a different bed
T22: DIFFERENT | spectra differ by 4.39 dB mean and 9.2 dB at 97-121Hz, with the spectral centre moving 12% (131->116 Hz)
T23: DIFFERENT | spectra differ by 9.78 dB mean and 23.2 dB at 40-50Hz, with the spectral centre moving 43% (2178->3366 Hz)
T24: DIFFERENT | spectra differ by 14.4 dB mean and 22.4 dB at 1097-1368Hz, with the spectral centre moving 42% (1493->2280 Hz)
T25: SAME | spectra agree to 0.54 dB mean (worst band 1.4 dB at 150-188Hz) and the spectral centre moves only 3.1% (2178->2112 Hz) — re-roll noise, not a different bed
T26: DIFFERENT | spectra differ by 15.99 dB mean and 44.7 dB at 6415-8000Hz, with the spectral centre moving 146% (528->3366 Hz) and stereo correlation 0.994->0.231
T27: DIFFERENT | spectra differ by 15.65 dB mean and 32.1 dB at 2127-2653Hz, with the spectral centre moving 100% (116->350 Hz)
T28: DIFFERENT | spectra differ by 35.76 dB mean and 59.3 dB at 40-50Hz, with the spectral centre moving 167% (1471->131 Hz)
T29: DIFFERENT | spectra differ by 10.72 dB mean and 22 dB at 880-1097Hz, with the spectral centre moving 5% (2178->2280 Hz) and stereo correlation 0.001->0.792
T30: SAME | spectra agree to 0.26 dB mean (worst band 0.8 dB at 62-78Hz) and the spectral centre moves only 0.5% (2842->2856 Hz) — re-roll noise, not a different bed
T31: DIFFERENT | spectra differ by 4.59 dB mean and 22.3 dB at 121-150Hz, with the spectral centre moving 23% (2344->1870 Hz)
T32: DIFFERENT | spectra differ by 9.84 dB mean and 15.3 dB at 50-62Hz, with the spectral centre moving 15% (2178->1870 Hz) and stereo correlation 0.001->0.925
