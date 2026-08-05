---
id: RI-VIS06
title: The blind comparison protocol — two protocols, one per side of the bifurcation
kind: structure
side: neutral
judges: [visual.process.blindtest, visual.process.judgement, visual.artdirection, visual.renderer]
provenance: constructed
confidence: high
blind_pair: yes
---

> **SIDE DECLARATION: this item is `neutral`.** Like RI-VIS01 it exists to keep the two sides
> apart, and it does so by defining **two separate blind protocols that are never run by the
> same agent**. Protocol A (fidelity) uses modern references and **refuses** Morrowind
> imagery. Protocol B (art direction) uses Morrowind imagery and our transposition spec and
> **refuses** modern AAA imagery. The blind judge for A must never have read RI-VIS05; the
> blind judge for B must never have read RI-VIS02/03/04. Running both with one agent is a
> CC-1/CC-2 contamination and voids both results.

## The bar

Metrics can be gamed and checklists can be filled in optimistically. A pairwise forced choice
by an agent that does not know which image is ours cannot be gamed by anything except
actually being better. The blind test is the backstop for the entire visual area, and its
value comes entirely from three properties: **the judge does not know which is ours**, **the
judge is forced to choose** (no ties, no "both have merits"), and **the judge must name one
single biggest gap** — a specific, buildable thing, not a mood.

CORPUS-CONTRACT §6 states the general rule; this item makes it executable for images and adds
the escalation clause: **if the blind judge picks ours, that is a signal to distrust the
judge, and the comparison is re-run with a harsher lens.**

## The reference artifact

### §A — PROTOCOL A: FIDELITY BLIND (ours vs modern)

**Judge requirements:** a fresh agent context. It is given: the two images, the prompt below,
and **nothing else**. It must not be given RI-VIS05, the project brief, the word "Morrowind",
the word "Black Marsh", or any indication that one image is from an in-development game.

**Pair construction:**
- Ours: one capture from the fixed eight (RI-VIS02 §Comparison method), 1920×1080 PNG.
- Theirs: the paired modern reference (RI-VIS02 pairing table), cropped/resized to 1920×1080
  with the same aspect and no letterboxing, no watermark, no HUD.
- Both re-encoded through the same PNG writer at the same bit depth so encoder artefacts
  cannot leak the source.
- **Filenames are `A.png` and `B.png`**, side assigned by a coin flip recorded in a sealed
  file the judge cannot read (`blind/w03/fidelity_01.key`, written before the judge runs).
- Both images stripped of EXIF/metadata (`pngcrush -rem alla` or equivalent).
- If subject matter would give it away (our shot is a xanmeer, theirs is a castle), **crop
  both to a subject-neutral region** — a patch of ground, foliage, water surface, or a
  material close-up. Fidelity is a property of surfaces and light, and a 512×512 crop of wet
  bark is a perfectly good fidelity comparison with zero subject leakage. Record that the pair
  was cropped and why.

**The exact prompt given to the blind judge (verbatim, no additions):**

```
You are judging RENDER QUALITY ONLY.

Two images: A.png and B.png. They show different subjects. Ignore the subject
matter entirely. Ignore whether you like the art, the colours, the composition,
the setting, or the mood. Ignore how "cool" anything is.

Judge only how well the image is RENDERED. Specifically:
  - material response: do different surfaces respond to light differently?
  - lighting: is there direct light, bounced/ambient light, and shadow, and do
    shadowed areas still contain readable detail?
  - shadows: are they present, soft where they should be soft, tight at contact?
  - texture detail: does surface detail hold up, or are surfaces bare?
  - edges: are silhouette edges clean, or jagged/crawling?
  - depth: does distance attenuate contrast, or is everything equally crisp?
  - tonal range: are highlights rolled off or clipped flat? are blacks crushed?
  - geometric density: are curved forms smooth or faceted?

Answer in exactly this format and nothing else:

WINNER: A            (or B — you MUST choose one; ties are not permitted)
CONFIDENCE: high     (high | medium | low)
SINGLE BIGGEST GAP: <one sentence naming the one specific thing the losing
  image most lacks, phrased as something that could be built or turned on>
SECOND GAP: <one sentence>
WHAT THE LOSER DOES BETTER: <one sentence; if genuinely nothing, write "nothing">
```

**Forbidden in Protocol A:** any Morrowind or 2002 image as the `B` side; any mention of the
project; any prompt text about setting, strangeness, or art direction. If the judge's answer
mentions the setting, the run is discarded and re-run with a fresh agent (the prompt leaked).

**Runs:** 5 pairs per wave, drawn from the eight capture slots, each with its paired
reference. Left/right assignment randomised per pair.

### §B — PROTOCOL B: ART-DIRECTION BLIND (ours vs Morrowind + our own spec)

Art direction cannot be blind-tested the same way, because a 2002 screenshot and a 2026
screenshot are trivially sortable by render quality — the judge would just pick the modern
one and tell us nothing. So Protocol B changes the **question** rather than hiding the era.

**B1 — The strangeness pairing (era-acknowledged, quality-neutralised).**

Both images are **degraded to a common presentation** so render quality cannot decide it:
- Downsample both to 640×360, then upsample to 1280×720 with a box filter.
- Convert both to a shared tonal presentation: match histograms of the luminance channel to a
  common target, and quantise both to 5 bits per channel.
- The result: two images of roughly 2002-equivalent visual quality. What survives is
  **silhouette, layout, palette relationship, and form vocabulary** — which is exactly the
  property under judgement.
- `A.png` = ours (degraded), `B.png` = a Morrowind 2002 screenshot (degraded). Coin-flipped,
  key sealed.

**The exact prompt (verbatim):**

```
You are judging IMAGINATION, not quality.

Two images, A.png and B.png. Both have been deliberately degraded to the same
low quality. Do not judge sharpness, resolution, lighting, or detail — those
have been destroyed on purpose and carry no information.

Judge only this: which image shows a world that is HARDER TO PLACE?

A world is "hard to place" when you cannot match it to an existing fantasy
setting, when its buildings are not made of shapes you recognise from other
games, when its plants and creatures could not exist on Earth, and when the
colours are not the colours you would expect those objects to be.

A world is "easy to place" when it looks like somewhere you have already been:
a fantasy village, a medieval castle, a forest, a swamp with green ferns.

Answer in exactly this format and nothing else:

WINNER (harder to place): A     (or B — you MUST choose one; ties not permitted)
CONFIDENCE: high | medium | low
NAME THE LOSER'S SETTING: <name the existing game, film, or genre the losing
  image most resembles — you must name something>
SINGLE BIGGEST GAP: <one sentence: the one specific thing in the losing image
  that most makes it recognisable/generic, phrased as something replaceable>
STRANGEST SINGLE ELEMENT IN THE WINNER: <one sentence>
```

**B2 — The spec-conformance pairing (ours vs our own written specification).**

The second half of Protocol B does not use an image on the other side at all. A fresh agent
is given **only** the RI-VIS05 §C palette table, §D flora rules, §E silhouette vocabulary and
§F forbidden-forms list — with no images and no knowledge of what we built — and is asked to
write, in 200 words, what a screenshot of this world should look like. **Then** it is shown
our capture and asked whether it matches what it wrote.

```
STEP 1 (before seeing any image): from the specification you have been given,
describe in 200 words what a single screenshot of this place would contain:
what shapes break the skyline, what the ground and water look like, what colours
dominate, what a plant looks like, what a building looks like.

STEP 2 (after being shown the image): Does the image match your description?

MATCH: strong | partial | weak | contradicts
MISSING FROM IMAGE: <the three specified elements most conspicuously absent>
PRESENT BUT UNSPECIFIED: <anything in the image that the spec does not
  account for — these are the assets that came from somewhere else>
```

`PRESENT BUT UNSPECIFIED` is the highest-value output in this whole item: it is the automatic
detector for assets that entered the project from a generic-fantasy source without passing
through the art direction.

**Forbidden in Protocol B:** any Elden Ring / Skyrim SE / RDR2 / modern AAA image on either
side; any fidelity metric; any prompt text about lighting, shadows or texture quality.

### §C — The escalation clause (what happens when the blind judge picks ours)

CORPUS-CONTRACT §6: "If the critic picks ours, that is a signal to distrust the critic, and it
must re-examine with a harsher lens." Made concrete:

**If ours wins Protocol A** (our render judged better than a current-gen AAA frame), the
result is treated as **implausible until proven**. The pair is re-run with:
1. **A fresh judge** (the first may have been primed or lazy).
2. **A harsher prompt** — the identical prompt with this paragraph appended:
   ```
   One of these two images was rendered in a web browser by a small team; the
   other is from a shipped AAA title with a hundred-person art department. Your
   previous judgement placed the browser render above the AAA frame, which is
   very unlikely to be correct. Look again, specifically for: flat regions with
   no shading variation, shadows with no internal detail, surfaces with no
   texture, clipped highlights, jagged edges, and objects that do not sit in
   the scene. Choose again.
   ```
   Note that this text does **not** say which image is which, so the judge still cannot leak
   the answer to itself — it only raises the bar.
3. **A crop escalation** — re-run on three 512×512 crops of each image at 1:1 (no
   downscaling), which removes composition and subject appeal from the comparison entirely
   and leaves only surface, light and edge quality.

If ours still wins after all three escalations, and the metrics from RI-VIS03 also pass,
record it as a genuine result with a note. **It should never happen in the first several
waves; if it happens in wave 1, the pair construction is broken** — most likely the reference
image was degraded by resizing, or the judge is being served our image twice.

**If ours wins Protocol B**, no escalation is applied. B1 asks "which is stranger", and ours
*should* win it — we have a whole corpus item aimed at that. The escalation for B is
inverted: **if ours LOSES B1 to a 2002 screenshot, that is a five-alarm result** and the
art-direction score is capped at 3 for the wave regardless of any other evidence. Losing a
strangeness contest to a twenty-four-year-old game, with quality neutralised, means the
transposition has failed.

### §D — Anti-leak requirements (the protocol's own failure modes)

| Leak vector | Mitigation |
|---|---|
| Filename, path, metadata | `A.png`/`B.png` only, EXIF stripped, written into a temp dir with no project name in the path |
| Resolution / aspect mismatch | both re-encoded at identical dimensions through the same writer |
| Compression artefacts | both PNG, same bit depth, same writer; never mix a JPEG reference with a PNG capture |
| HUD, watermark, subtitle | both cropped free of overlays; reference shots with a HUD are unusable |
| Subject leakage (our monster vs their knight) | subject-neutral crops (§A) |
| Judge has prior context | fresh agent per run; the runner asserts the judge context contains no prior turn from this project |
| Judge asked both questions | **two separate judges, always**; a single agent answering both A and B is a void result |
| Key read before judging | the coin-flip key file is written before the run and read only after the answer is captured; runner asserts read-after-write ordering |
| Prompt drift | the prompts in §A/§B are quoted verbatim by the runner from this file, never paraphrased |

### §E — The record (what goes into the verdict)

Every blind run produces exactly this block, and all runs for a wave are appended to
`corpus/90-verdicts/wNN-visual-blind.md`:

```
BLIND RUN  wave 03  protocol A  pair 02
  ours: shots/w03/water_edge.png (crop 512x512 @ 880,700)
  ref : RI-VIS02 REF-M4 (verbal spec only — no image available; run SKIPPED)
  key : blind/w03/fidelity_02.key   (A=ref, B=ours)
  judge: fresh, no project context   model: <id>
  BLIND PICK: A
  CONFIDENCE: high
  SINGLE BIGGEST GAP: "B's water is a single flat colour with no reflection of
    anything above it and no change in appearance from near to far."
  SECOND GAP: "B's edges against the sky are hard-stepped with no intermediate pixels."
  WHAT THE LOSER DOES BETTER: nothing
  REVEAL: A was the reference. Ours lost. Expected.
  ESCALATION: not required (ours lost)
  ACTION: single biggest gap -> RI-VIS04 §9 water; M12 FresnelDelta/ReflCorr
```

**Note the `run SKIPPED` case.** Where RI-VIS02 has no fetchable image (which is currently
most of them — see its provenance note), Protocol A **cannot be run for that pair** and must
be recorded as skipped, not faked from a verbal spec. A blind test needs two images. Until
`refs/modern/` is populated, Protocol A runs only on the pairs for which we hold a legally
usable reference image, and the wave verdict must state how many of the 5 pairs actually ran.
**A wave in which zero Protocol A pairs ran caps the FIDELITY score at 7** — we cannot claim
the top band without the backstop.

## Comparison method

1. Runner emits the RI-VIS01 §B declaration for the protocol it is about to run
   (`FIDELITY` for A, `ART_DIRECTION` for B).
2. Build the pairs per §A or §B, including crop/degrade steps. Write the sealed key.
   Assert: identical dimensions, identical encoder, stripped metadata, no overlay.
3. Spawn a **fresh judge agent** with the verbatim prompt and the two images. The runner must
   assert the judge context contains no prior project material. For B2, the judge receives the
   RI-VIS05 excerpts and **no image** in step 1.
4. Capture the answer exactly as returned. Do not clean it up, do not re-ask if you dislike
   the answer, do not run "best of three" — that is judge-shopping and it is forbidden. If a
   run must be discarded (prompt leak, malformed output), record the discard and its reason.
5. Read the key. Record the reveal.
6. Apply §C escalation if ours won Protocol A, or the §C cap if ours lost B1.
7. Write the §E block into the wave verdict.
8. The **SINGLE BIGGEST GAP** from the highest-confidence losing run becomes the wave's named
   biggest visual gap for that side (ARBITRATION §3 requires exactly one named gap per
   verdict — this is where it comes from, and it comes from an agent that could not see the
   label).

## Scoring

Blind results do not produce a score directly; they **modify** the scores from RI-VIS03
(fidelity) and RI-VIS05 (art direction), and they **cap** them.

| Protocol A outcome (across the pairs that ran) | Effect on FIDELITY score |
|---|---|
| Ours loses all pairs at `CONFIDENCE: high` | cap 5 |
| Ours loses all pairs, ≥ 2 at `CONFIDENCE: medium/low` | cap 7 |
| Ours loses some, wins some (post-escalation) | cap 8 |
| Ours wins ≥ half post-escalation, metrics also pass | no cap |
| Zero pairs ran (no reference images available) | cap 7 |

| Protocol B outcome | Effect on ART score |
|---|---|
| B1: ours loses to a 2002 screenshot | **cap 3** (five-alarm) |
| B1: ours wins at `CONFIDENCE: low`, or the judge names an existing setting for ours | cap 6 |
| B1: ours wins at high confidence AND B2 `MATCH: strong` | no cap |
| B2: `MATCH: weak` or `contradicts` | cap 5 |
| B2: `PRESENT BUT UNSPECIFIED` names ≥ 2 substantial assets | cap 6 and those assets are listed as art-direction defects |

**Failure threshold:** any cap below 6 blocks the wave via the RI-VIS01 §E `min()` gate.
**The protocol itself fails** (and its results are void) if: the two protocols were run by one
agent; the key was readable before judging; the prompt was paraphrased; a run was discarded
without a recorded reason; or "best of N" judging was used.

**What we lose looks like:** Protocol A run on five pairs, ours loses five out of five at high
confidence, all five judges independently name the same single biggest gap ("one image has no
shadows"). FIDELITY capped at 5. Meanwhile B1 returns `WINNER: B` with
`NAME THE LOSER'S SETTING: Skyrim` — ART capped at 3. Ship gate `min(3,5) = 3`. Blocked, and
we know exactly the two things to build.

## How we lose

- **Judge-shopping.** The first blind run returns a result we dislike, so it is re-run "to
  check" until a better one appears. This destroys the only unbiased instrument in the corpus.
  Guard: re-runs only via the §C escalation, which is *harsher*, never softer, and every
  discard is recorded with a reason.
- **The leak nobody notices.** Our capture is 1920×1080 PNG at 2 MB; the reference is a
  1280×720 JPEG upscaled. The judge picks the sharp one every time and we learn nothing about
  fidelity, only about resizing. Guard: §D, asserted mechanically before the run.
- **One agent, both protocols.** It is far cheaper to ask one judge both questions, and the
  answers will be contaminated in both directions — the fidelity answer will be softened by
  affection for the art, and the strangeness answer will be inflated by the good render.
  This is the most likely protocol violation because it is the most convenient one.
- **Protocol A never runs** because we never obtain usable reference images, so the backstop
  quietly does not exist and the whole fidelity area rests on constructed thresholds.
  Guard: the explicit `cap 7` for zero runs, which makes the absence cost something.
- **B1's degradation is done wrong** — degrading only our image, or degrading to a level where
  neither image is readable at all. Guard: the exact degradation recipe is in §B1 and both
  images go through the identical pipeline; the runner saves both degraded images into the
  verdict so the degradation is auditable.
- **The named gap is a mood.** The judge returns "SINGLE BIGGEST GAP: it lacks atmosphere."
  Useless. Guard: the prompt demands the gap be "phrased as something that could be built or
  turned on"; a gap that is not buildable is recorded as a malformed run and re-asked once
  with the format reminder only.
- **We stop running it once the game looks decent.** The blind test is most valuable exactly
  when the team has stopped being able to see the game. It must run every wave, including the
  waves where everyone is pleased.

## Provenance note

`provenance: constructed`, `confidence: high`. Every element of both protocols is authored for
this project. The general rule is inherited from CORPUS-CONTRACT §6 (blind pairing, pick
before reveal, distrust a win) and from ARBITRATION §3 (exactly one named biggest gap); the
image-specific machinery — the two-protocol split, the subject-neutral crop, the §B1
degradation recipe, the B2 spec-first-then-image inversion, the §C escalation ladder, the §D
leak table and the §E record format — is ours and has no upstream source.

**Untested.** No blind run has been executed at authoring time; there is no game to capture
and `refs/modern/` is empty. The prompts in §A and §B have not been validated against a real
judge, and the most likely correction is that they are too long and the judge's answer drifts
out of the required format. **The first wave to run this should record any format
non-compliance and amend the prompt text here**, keeping the amended text verbatim-quotable —
the value of the prompts being in the corpus is that they are identical across waves, so a
change must be recorded rather than improvised at run time.

The §B1 degradation recipe (640×360 → 1280×720 box, histogram-matched, 5 bits/channel) is a
guess at "enough degradation to neutralise a 24-year quality gap without destroying
silhouette". It is the most likely part of this file to need tuning, and it should be tuned by
running the protocol with **two known-good modern images** and confirming the judge's picks
become uncorrelated with their original render quality.
