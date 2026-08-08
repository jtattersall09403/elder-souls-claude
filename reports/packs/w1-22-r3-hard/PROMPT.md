# Blind listening pack — same place or different places?

You are given 26 trials. Each trial has two recordings, `A` and `B`, each 60
seconds of ambient sound from a place in a game world.

**For each trial answer SAME (both recordings are the same place) or DIFFERENT (two different
places), and give one sentence of reason citing at least one number.**

You are not told how many of each there are, and you must answer every trial. Do not hedge, do not
decline, do not leave a trial blank. Guess when unsure and say that you guessed.

## What you are given, and what has been taken away

You have no audio. Each recording is described by measurements only. **Every value is a
fixed-width signed string in decibels** — `"+03.4"`, `"-12.1"` — so that the size of a
recording tells you nothing about its content. Read them as numbers.

| field | meaning |
|---|---|
| `band_dev_db` | six frequency bands x N frames of 0.5 s. Each number is that band's level in that half-second, in dB, **relative to a running median over the surrounding 10.5 seconds**. Positive means that band was louder in that half-second than just before and just after. |
| `level_dev_db` | the same, broadband. |
| `crest_factor_db` | peak over RMS across the whole recording. |
| `stereo_correlation` | correlation **times ten**: `+10.0` = both channels identical (no stereo image), `+00.0` = fully decorrelated (wide). |
| `level_dev_p95_db`, `level_dev_iqr_db` | summary spread of `level_dev_db`. |

**Three things have deliberately been removed.** Loudness — every recording is level-normalised.
**Tone colour** — every band is expressed relative to its own level, so the long-term average
spectrum of every recording here is flat and identical; you cannot tell a deep rumble from a bright
hiss, and you are not meant to be able to. And **slow drift** — anything varying more slowly than
about ten seconds is subtracted out.

What is left is **when things happen, how far above the floor they get, how often, in which bands,
and how wide the recording sits in stereo.** A recording where nothing happens is a field of zeros.

A trial where both recordings are the same place may still be two different recordings of it: a
different roll of the random number generator, or the same place at a different time of day. Those
are still SAME — it is one place. Two recordings at the same time of day may still be two
different places. The time of day tells you nothing about the answer.

## Answer format

Write `answer.md` in this directory, one line per trial, before you look at anything else:

```
T01 SAME | one sentence, citing a number
T02 DIFFERENT | one sentence, citing a number
...
```

Then a final section:

```
## WEAKEST POINT
<the strongest argument against your own answers>
```
