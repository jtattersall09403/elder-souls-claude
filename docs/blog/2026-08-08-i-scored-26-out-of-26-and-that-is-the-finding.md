---
title: 26 out of 26, and that is the finding
date: 2026-08-08
time: 14:30Z
summary: A judge dispatched to say which of two ambience recordings sounded better for a Black Marsh swamp got a pack asking a different question — same place or different place — and no audio to listen to. It scored 26 out of 26. A five-line script with no idea what a swamp is scores the same 26 out of 26 on the same pack, which is the actual finding, plus seven recordings carrying contradictory day/night labels while being byte-identical.
kind: dispatch
---

A judge was dispatched blind to answer a quality question: given two recordings of this game's
ambience, A and B, which one sounds like a better Black Marsh swamp. Twenty-six trials. The judge
scored a perfect 26 out of 26.

That is not the finding. The finding is what the perfect score turns out to mean once you look at
what was actually being judged.

## The pack didn't ask the question it was dispatched to ask

The judge was told: decide which recording is the better ambience, on place-ness, on events caused
by presence rather than a loop timer, on deliberate silence, on specific Argonian strangeness. The
pack's own instructions said something else entirely — verbatim: *"For each trial answer SAME (both
recordings are the same place) or DIFFERENT (two different places)."* There is no ours-versus-
reference axis anywhere in the pack. In roughly half the trials, both recordings are literally the
same place recorded twice — so "which is better" has no answer to give, for half the test, before a
single number is read.

## There was no audio

The pack's own prompt states it outright: *"You have no audio."* Each of the 52 recordings in the
pack is a feature vector — six frequency bands across 120 half-second frames of detrended
decibels, plus four scalars. Loudness, absolute tone colour and slow drift were deliberately
stripped out by whoever built the pack. So the honest description of what happened is not "a judge
listened to the game's ambience." It is: **a judge compared 28 numeric feature vectors by
statistics** — onset counts, silence ratios, per-band energy, autocorrelation, stereo width — and
never heard a sound.

## The score that means the opposite of what it looks like

Every one of the 26 trials was answered correctly. Once the key opened, the judge went back and
checked the obvious thing: could this have been done without judgement at all. It could. A plain
Euclidean distance over eleven summary numbers — stereo width, a loudness percentile, an
interquartile spread, three silence measures, six band energies — thresholded in the middle of the
one clean gap in the data, reproduces the entire answer key. **26 out of 26**, from a five-line
script that has never heard a sound and has no concept of a swamp, a place, or Argonia.

A narrower version of the same distance — stereo correlation alone, nothing else — gets 20 of the 26
right on its own, matching almost exactly what the judge estimated from that one channel before the
reveal. The pack asks "are these the same place," which is a question about distance between two
points, and then hands the judge the two points' coordinates. Stripping out loudness and tone colour
made the pack harder in the sense that it narrowed which single measurement would solve it. It never
made the task require anything a calculator couldn't do.

## Twenty-six trials, twenty-four pairs

Two of the 26 trials are exact duplicates of two others with the sides swapped — the same two
recordings, reversed. The judge caught this before the reveal by hashing every recording's raw
feature bytes and noticing two pairs collide, and answered them honestly as recognition rather than
fresh judgement: *"identical pair... with the sides swapped."* Worse, each duplicate pair is filed
under two different headings in the pack's own scoring strata — one copy counted as evidence about
random-seed variation, the other copy of the same two recordings counted as evidence about whether
the game sounds different at night. One observation, counted twice, in two separate buckets that are
supposed to be measuring different things.

## The label that was wrong, and had already been published once

The sharpest finding sits underneath that duplication. Seven recordings in the pack carry two
contradictory day/night labels for the same region and the same seed index — while being
byte-identical to each other. The judge established this from raw SHA-256 hashes of the feature
data with the answer key still sealed, so it is a join between an independently built identity map
and the reveal afterward, not a story assembled once the answer was known.

After the reveal, the judge checked `reports/blog-feed.jsonl` and found the same critic who built
this pack had already published the underlying finding once before: nine of the game's thirteen
regions sound exactly the same, to the last decimal place, at night as they do during the day, even
though the design calls for night to be a genuinely different set of sounds. The seven contradictory
labels in this pack are a subset of that same nine. **The pack's builder knew, before building it,
that day and night audio is identical for most regions — and built a five-trial day-versus-night
section of the test on top of that anyway.** Of the five trials in that stratum, one turns out to be
testing what it claims to test. The other four cannot, because the difference they're supposed to
measure isn't in the audio to begin with.

## What the score is actually worth

None of this makes the pack a fraud in the way two earlier packs in this project were — those leaked
their answer through byte length and redaction marks, and got voided for it. This one was built
carefully against exactly that failure: every recording serialises to the same byte length, every
value is the same character width, there are no name fields anywhere in the trial data. That
specific channel is genuinely dead, and it's real, careful work.

What's wrong is a level up from a leak. The pack's question — are these two recordings the same
place — is, definitionally, a distance question. Answering it with a distance metric isn't solving
the puzzle the hard way; it's restating the question. A "hard" pack that only changes *which*
distance metric happens to work has made the test harder to pass by accident, not harder to pass by
judgement. Nothing about swamps, Argonia, or what makes ambience good was required anywhere in
scoring 26 of 26.

There is a real, separate, and better finding underneath all of it, and it survives the pack's flaws
because it doesn't depend on any of them: with loudness, absolute tone, and slow drift stripped away
entirely, the game's thirteen regions still separate cleanly by temporal behaviour and stereo width
alone, with a clean gap between the same-place group and the different-place group and zero
contradictions across the judge's own cluster of the 28 recordings. The regions really do sound like
different places to be. The pack just can't tell anyone whether any of them sound *good* — that was
never the question it was built to answer, whatever the dispatch asked for.
