# Pre-registered answering procedure — judge-audio-b2
Written BEFORE any trial data was examined. Timestamped by writing it to disk first.

## What a SAME pair physically is
A SAME pair is one place rendered twice at two different capture seeds. So its two recordings
share a *stationary spectral character* but not their *stochastic event timing*. A DIFFERENT pair
is two places: the stationary character itself should move.

## Consequence for the decision rule
- The transient-onset lists are the WRONG discriminator. Onsets are seed-driven; two recordings of
  one place will disagree about them completely. Using onset similarity would systematically call
  SAME pairs DIFFERENT.
- The stationary fields are the RIGHT discriminator: the 24 band levels, the spectral centroid, the
  stereo correlation, the crest factor.

## The statistic
For each trial, from the 24 `band_levels_db_rel_loudest` values of A and B:
- `mad_db`  = mean |A_band - B_band| over the 24 bands
- `max_db`  = max |A_band - B_band|
- `dcent`   = |centroid_A - centroid_B| / mean(centroid)
- `dcorr`   = |stereo_correlation_A - stereo_correlation_B|
- `dcrest`  = |crest_A - crest_B|

## The threshold (absolute, declared in advance)
Answer **SAME** iff `mad_db < 1.5` AND `dcent < 0.05`; otherwise **DIFFERENT**.

Grounding: 1.5 dB mean deviation across a 24-band spectrum, with the spectral centre inside 5%, is
below what a listener would call a different place; it is the size of re-roll noise, not of a
different bed. This threshold is fixed now and will not be moved after seeing the distribution.

## Two things I will NOT do
1. **I will not use the class balance.** I know from the pack's own JUDGE.md and from the builder
   source that the design is 24 DIFFERENT / 8 SAME. Ranking the trials and calling the 8 closest
   SAME would exploit that leak and would not be a blind answer. The absolute threshold above is
   independent of how many of each there are. I will report, separately and only as a sensitivity
   check after unblinding, what a count-constrained rule would have scored.
2. **I will not try to identify regions.** No lookup of region names, no reading of audio data.

## What counts as a finding rather than a failure
If two trials sit inside the threshold and the reveal says DIFFERENT, that is a report that those
two places are acoustically indistinguishable on every measured axis — a finding about the game,
not an error by me. I will name them by trial id and give the numbers.

## Unanswerable trials
If a trial's two recordings are degenerate (all bands floored, no data, identical serialisation),
I will score it `UNANSWERABLE` and say so rather than guess.

## Tool
One analysis script, `scratchpad/analyse.mjs`, reading only `trials.json`. Declared under
`method_deviations`. It does no rendering and opens no browser.
