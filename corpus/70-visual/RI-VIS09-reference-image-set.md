---
id: RI-VIS09
title: The reference image set — what pixels we actually hold, and what each side may do with them
kind: structure
side: neutral
judges: [visual.process.blindtest, visual.process.judgement, visual.artdirection, visual.renderer]
provenance: measured
confidence: medium
blind_pair: yes
---

> **SIDE DECLARATION: this item is `neutral`.** It registers a *file set*, and the file set is
> split by the same bifurcation RI-VIS01 defines. `refs/modern/` may be cited only by the
> fidelity side; `refs/morrowind/` may be cited only by the art-direction side; `refs/context/`
> and `refs/anti-generic/` may be cited by neither as a target. **Reading this item does not
> contaminate a blind judge** — it deliberately contains no description of what any individual
> image looks like beyond its slot label. A blind judge may read §5 and nothing else.

## The bar

Until this item, every visual verdict in the corpus was a comparison against **remembered**
images. RI-VIS02 lists twenty modern reference slots and RI-VIS05 lists nineteen Morrowind
slots, and there were no pixels behind any of them; RI-VIS06 says so in its own provenance note
("there is no game to capture and `refs/modern/` is empty"), and RI-VIS03 admits its twelve
metric bands are `constructed` and asks to be re-derived from a reference population.

**The bar this item sets: a visual claim that cites a reference must cite a file that exists.**
An agent asserting "our marsh is flatter than a real game's" must name a path under
`corpus/70-visual/refs/` and, where the claim is numeric, a population in
`refs/reference-metrics.json`. A claim that cannot name one is an opinion and is scored as such.

The corollary is the reason this item is `neutral` and not `fidelity`: **the set is badly
lopsided, and pretending otherwise would be worse than having no set at all.** §3 states the
coverage honestly.

## The reference artifact

### §1 What exists

Root: `corpus/70-visual/refs/`. **119 files in slot folders, 8 in `rejected/`.**

**This table is a snapshot. Regenerate it rather than trusting it:**

```
python3 -c "import json,collections,os; \
 r=json.load(open('corpus/70-visual/refs/MANIFEST.json'))['records']; \
 c=collections.Counter(os.path.dirname(x['path']) for x in r); \
 [print(k,c[k]) for k in sorted(c)]"
```

| Folder | n | Source | What it is |
|---|---|---|---|
| `morrowind/REF-A1 … REF-A19` | **89** | `dehero/mwscr` | Vanilla-Morrowind art-direction reference, **18 of 19 slots**, 4–6 images each. **AVIF previews, ≤ 569×320, mostly 320×320 square crops.** |
| `modern/hud/` | **24** | `elfhuo-github/sksebp-og.github.io` | Native 2560×1440 Witcher 3 gameplay, one 2022-12-17 session, twelve locations shot old-gen and next-gen. **Every frame carries HUD.** |
| `modern/character_closeup/` | **1** | `BAAI-Agents/Cradle` | RDR2, Arthur Morgan from behind at Horseshoe Overlook, 1921×1081, HUD-free. |
| `anti-generic/` | **5** | (copies of `modern/hud/`) | The negative anchor: crenellated castle, half-timbered street, pitched-roof village, thatched hamlet, birch-and-meadow woodland. |
| `modern/exterior_daylight`, `exterior_lowlight`, `interior_darkemissive`, `combat`, `material_closeup` | **0** | — | empty |
| `context/`, `video/` | **0** | — | empty |
| `rejected/` | 8 | — | with per-file reasons and the failing statistic |

Machine-readable: `refs/MANIFEST.json` (one record per file, provenance joined to
script-computed integrity fields), `refs/_computed.json` (script output alone),
`refs/_provenance.json` (hand-authored fields alone), `refs/reference-metrics.json` (per-image
and per-population statistics), `refs/make-manifest.py` (the integrity script; `--check` re-runs
it and diffs), `refs/LICENCE-NOTE.md`, `refs/ACQUISITION-REPORT.md` (the full account).

### §2 Which corpus items consume which images

| Item | May cite | May **not** cite |
|---|---|---|
| **RI-VIS02** (modern fidelity set) | `refs/modern/character_closeup/` | anything under `refs/morrowind/` |
| **RI-VIS03** (image metrics) | `refs/reference-metrics.json` population `modern-character_closeup` as a target; population `modern-hud` **only** as evidence in a band-amendment proposal, always with its `n` and its HUD caveat | `modern-hud` as the band a render is scored against; the `morrowind` population as a *target* — it is a contrast population only |
| **RI-VIS04** (renderer feature checklist) | `refs/modern/` for "what a shipped renderer does here" | `refs/morrowind/` |
| **RI-VIS05** (Morrowind transposition) | all **18** filled `refs/morrowind/REF-A*` slots | anything under `refs/modern/` |
| **RI-VIS06 Protocol A** (fidelity blind) | `refs/modern/character_closeup/` as the `--ref` side | `refs/morrowind/`, `refs/modern/hud/` |
| **RI-VIS06 Protocol B** (art-direction blind) | `refs/morrowind/REF-A*` as the `--ref` side | `refs/modern/` |
| **RI-VIS07** ("could this be Skyrim?") | `refs/anti-generic/` as the thing to measure distance **from** | `refs/anti-generic/` as a target — ever |
| **RI-VIS08** (character animation) | nothing — `refs/video/` is empty | — |

**No render is ever scored against `refs/modern/hud/`.** §5a of
`REFERENCE-IMAGE-REQUEST.md` is the rule and this item does not soften it: those frames are
composition, framing and over-the-shoulder-camera reference for builders, and the source of the
`anti-generic/` anchor. The one thing they *may* do is inform a **proposal to amend a band** in
RI-VIS03 — as they do in §4 — because a flawed reference population is still strictly more
informative than a guess, and the flaw (roughly 4% of frame area is synthetic maximum-contrast
HUD geometry, biasing M4, M8 and M2 upward) is stated wherever the numbers are used. A proposal
is not a verdict. Nothing in `hud/` may appear on the `--ref` side of a blind pair, and no wave
may pass or fail a render by comparing it to a HUD-bearing frame.

**`refs/anti/` remains reserved** for the file our own harness generates. Nothing in this item
writes there.

### §3 Coverage gaps — stated up front, not buried

0. **The binding constraint is the tool, not the pixels.** `tools/metrics/image-metrics.mjs`
   does not implement RI-VIS03 as written. It applies no `FG_MASK`; it box-downscales every frame
   to 256×256 before the FFT, which destroys the entire frequency range M5 exists to interrogate;
   and it computes **neither** of M8's two hard-fail statistics (`FS_score`, `LargestFlat`).
   **Of RI-VIS03's twelve metrics, exactly two — M1 and, loosely, M4 — can be calibrated by any
   reference image today.** M2 and M7 need the statistic corrected; M3, M5, M6, M8, M9, M10, M11
   and M12 need implementing before a photograph can calibrate them at all. Full derivation in
   ACQUISITION-REPORT §13.2. **Extending the metrics tool is a prerequisite for more images being
   worth anything numerically, and it is cheaper than another acquisition session.**
1. **Five of six `modern/` profile folders are empty and the sixth holds one image.** RI-VIS03's
   `exterior_lowlight`, `interior_darkemissive`, `combat` and `material_closeup` bands have **no**
   reference population and cannot be calibrated at all. RI-VIS02's slots REF-M1, M2, M3, M5, M7,
   M10, M11, M12, M13, M14, M15, M16, M17, M18, M19 and M20 are unfilled.
2. **The one modern population that exists is n=24, one game, one session, one operator, HUD on
   every frame.** Any p10/p90 derived from it is indicative, not authoritative.
3. **The Morrowind set is thumbnails.** ≤ 569×320, mostly 320×320 square crops, 0.41–2.77
   bytes/pixel. `pixel_metrics_valid: false` on all 89. Usable for palette, silhouette, built
   form, flora and creature design language — **never** for texture resolution, texel density,
   anti-aliasing or sharpness, and the square crop has destroyed original framing for ~92% of them.
4. **`vanilla_confidence` is `"medium"` on all 89, never `"high"`.** V1, V5 and V7 were confirmed
   by eye; V2 was assessed per image (7 files show distant land and are recorded
   `engine: "openmw-distant-land"`); **V3, V4 and V6 could not be assessed at 320×320 and are
   recorded `null`.**
5. **REF-A12 (the Morrowind UI) is the one unfilled Morrowind slot**, and REF-A8 (NPC density)
   and REF-A17 (Imperial interior) are partial. REF-A12 is **permanently unfillable from this
   source** — the archive's editorial policy is "no interface", so no menu, journal, dialogue list
   or map exists anywhere in it. **The right fix is not a screenshot:** Morrowind's UI is
   recoverable exactly from OpenMW's `resources/mygui/` layout XML, which gives real widget
   geometry rather than a photograph of it. `RI-UIX*` should cite those files. REF-A13 (armour and
   clothing), REF-A18 (dusk/night exterior) and REF-A19 (stilted settlement) were filled in the
   acquisition's second revision; see ACQUISITION-REPORT §13.1.
6. **`refs/context/` is empty**, so no builder has seen a depiction of Shadowfen or Murkmire. The
   "deliberately do not converge on ESO" instruction in RI-VIS05 currently has nothing behind it.
7. **`refs/video/` is empty**, so every motion claim in RI-VIS08 — LOD pop, foliage frequency,
   water temporal variance, foot planting — remains uncalibrated. This is a known limit, recorded
   as such rather than as a missing deliverable.
8. **No image in the set is two-host corroborated.** Every image host except GitHub is blocked
   from the acquiring container; `corroboration: "one-host"` on every record.
9. **`identified_by` on the Morrowind files is slot-level, not per-image**, and every record says
   so in `identified_how`. This is weaker than the specification asks for.

**A merge with an externally acquired set is expected and the manifest schema is built for it.**
`_provenance.json` is keyed by path, so a second acquisition can add records without touching
these; re-running `make-manifest.py` rebuilds `MANIFEST.json` over the union. **Do not hand-edit
`MANIFEST.json`** — it is generated, and hand edits are lost on the next run. The step-by-step
merge procedure is `ACQUISITION-REPORT.md` §13.5.

**This item is written to survive new images.** When a population arrives, it changes the §1
snapshot (regenerated by the command above it), one row in §2, one line in §3, and the numbers in
§4. **§2's routing table, §4a's prohibitions, §5's blind procedure and §6's failure list are
rules, not inventory, and do not change when files land.** An external agent (Codex) is running
the same specification with unrestricted network access; as of this writing it had produced
nothing in `corpus/`. The correct action when it does is to re-run the two scripts and edit those
four places — **not** to rewrite this item.

## Comparison method

### §4 What the set already changed

Running `tools/metrics/image-metrics.mjs` over the acquired images produced the first measured
numbers the visual area has ever had. ACQUISITION-REPORT §10 gives the full table and the
mapping caveats. The three results that matter here:

- **RI-VIS03's M4, M5 HFR, M5 alpha, M2 C_global and M8 bands were guessed close** — the measured
  p10–p90 of a real current-generation population (n=24) sits inside or nearly inside each of them.
  For bands chosen with no reference population at all, that is a good showing.
- **Four bands are proposed for amendment**, all of them *tighter*: `M1 mean Yp` floor 0.28 →
  **0.23** (measured p10 is 0.236, so a quarter of genuine daylight frames fail as written);
  `M1 blown` 0.05 → **0.005** and `M1 crushed` 0.10 → **0.02** (measured p90 is 0.0013 and 0.0067,
  so the thresholds cannot fire on anything short of a broken renderer); `M7 dY_sky` floor 0.06 →
  **0.15** (measured p10 is 0.248); `M2 C_local_med` floor 0.045 → **0.052**, with the tile-size
  caveat below.
- **`M1 dynamic_range_stops` separates the two eras with no overlap** — modern **9.20–11.75**
  against Morrowind **5.61–8.31**. It is not currently one of M1's reported fields and it should
  be. **Propose adding `stops` to M1's reported triple.**
- **The apparent M5 `NYQ_ratio` catastrophe is an artefact, not a finding.** Revision 1 measured
  0.363–0.465 against a `≤ 0.18` band and read it as a broken bar. Revision 2 found the mechanical
  cause: the tool box-downscales to 256×256 before transforming, and its band edges are a
  different quantity entirely. **The measured numbers are not RI-VIS03's `NYQ_ratio` and must not
  be read as a failure.** The conclusion stands for a different reason: **do not ship an AA verdict
  on this number until M5 is implemented as specified.**
- **RI-VIS03's M3 could not be checked at all**: it specifies CIELAB C\* and the harness reports
  HSV saturation. A CIELAB chroma path is one of the several things §3.0 says must be built.

**RI-VIS03 has not been edited.** These are proposals, and RI-VIS03 keeps `provenance:
constructed` until a wave adopts them — and it should not adopt any of them until the metrics
tool computes the statistics they name. `reference-metrics.json` carries the same warning in its
own `metric_name_warning` field so a consumer who never reads this item still meets it.

### §4a The measurement gap — read this before quoting any number in `reference-metrics.json`

**`tools/metrics/image-metrics.mjs` is the only image-measurement tool in this repository and it
does not implement RI-VIS03.** The metric names in `reference-metrics.json` are the *nearest*
statistics, not the defined ones. The file carries this warning in its own `metric_name_warning`
field so a consumer who never reads this item still meets it. Three of the divergences are not
"close enough" — they make the numbers incomparable:

| RI-VIS03 defines | The tool computes | Usable? |
|---|---|---|
| every band over `FG_MASK` (**NOT sky**) | no masking anywhere | **contaminated.** Sky enters `mean_Y`, `C_global`, `ED_1` and both flat fractions, by a different amount per frame |
| M5 on a **native-resolution** centre 1024² crop | FFT of the **whole frame box-downscaled to 256²** (`radialSpectrum` → `resampleSquare(Y,w,h,256)`) | **no.** Everything above 256 cycles is destroyed *before* the transform. M5 exists to measure texture resolution and aliasing; as implemented it measures the box filter, and it is resolution-dependent |
| M5 `NYQ_ratio` = `E([0.45,0.50)) / E([0.20,0.45))` | `E([0.5,1.0)) / E([0.25,1.0))` | **no — a different quantity.** Measured values of 0.36–0.46 against a `max 0.18` band are **not a failure of the games** |
| M2 `C_local_med` = **median** of **32²** tiles | **mean** of **16²** tiles | loosely |
| M4 `ED_1` **+ `ED_2` + `ED_4` + `scale_ratio`** | `ED_1` only | partly — **`scale_ratio` is absent, so the alias-storm / noise-injection guard does not exist** |
| M3 `meanC` in CIELAB C\*, `chroma_frac`, `p95C`, `H_hue` | HSV saturation, RGB max−min | **no — different colour space** |
| M8 `FS_score` (216-bin colour cube) and `LargestFlat` (9×9 local-σ connected components) | a 16²-tile flat count at a different threshold | **no. M8 — the headline metric, the one that caps FIDELITY at 2 — has no implementation.** |
| M6, M9, M10, M11, M12 | — | **not computed at all** |

This is also the mechanical explanation for §4's most alarming result. The 2002 Morrowind set
measuring *nominally better anti-aliased* than a 1440p Witcher 3 set is **not a fact about either
game**: both were box-downscaled to 256² before the transform, so the comparison was between two
resamplers. The conclusion stands — do not ship an anti-aliasing verdict on that number — but the
reason is worse than "different band edges".

**Of RI-VIS03's twelve metrics, two (M1, and loosely M4) can be calibrated by a reference image
today.** M2 and M7 need the statistic corrected. M3, M5, M6, M8 and M9–M12 need implementing.

> **Consequence for planning.** More pixels are necessary and no longer sufficient. **Extending
> `image-metrics.mjs` to implement RI-VIS03 as written is the blocking task** — it is cheaper than
> another acquisition run and it is a prerequisite for any images that arrive later being worth
> anything numerically. Until it lands, this set serves RI-VIS05 and RI-VIS06 Protocol B, which
> need no numbers at all, and nothing else.

**Standing prohibition:** no band in RI-VIS03 may be published as `provenance: measured` on the
strength of `reference-metrics.json` until the statistic behind it is the statistic RI-VIS03
defines. Pasting these values in would replace a guess that is *labelled* a guess with a
measurement of the wrong thing, which is strictly worse.

### §5 The blind procedure — the only part a blind judge may read

Both protocols in RI-VIS06 run through `tools/blind/make-pair.mjs`, which strips labels, assigns
A/B under a recorded seed, and writes the reveal key **outside** the pack directory.

**Protocol A — fidelity.** Judge must not have read RI-VIS05.

```
node tools/blind/make-pair.mjs \
  --ours runs/<wave>/shots/<scene>.png \
  --ref  corpus/70-visual/refs/modern/character_closeup/REF-M6__rdr2-horseshoe-overlook-camp.jpg \
  --out  runs/<wave>/blind/vis-A --item RI-VIS02 \
  --question "Which of these two frames was rendered by a more capable renderer?"
```

With exactly one reference image, **Protocol A can be run for `character_closeup` and for no
other profile.** Do not substitute a `modern/hud/` frame to fill a pair: the HUD is a label, and
a label defeats the blind before the judge has looked at the render.

**Protocol B — art direction.** Judge must not have read RI-VIS02/03/04.

```
node tools/blind/make-pair.mjs \
  --ours runs/<wave>/shots/<scene>.png \
  --ref  corpus/70-visual/refs/morrowind/REF-A9/<file>.avif \
  --out  runs/<wave>/blind/vis-B --item RI-VIS05 \
  --question "Which of these two frames comes from a world with a more distinctive design language?"
```

**Protocol B has a hazard this item must name.** The Morrowind references are 320×320 AVIF; our
shots are full-resolution PNG. **The resolution difference is itself a tell**, so RI-VIS06 §B1's
degradation step is not optional here — it is the only thing making the pair blind at all, and
its recipe (640×360 → 1280×720 box, histogram-matched, 5 bits/channel) was written for
1024×768-era references, not for 320×320 ones. **The first wave to run Protocol B must re-tune
that recipe against these files and record the tuned values in RI-VIS06**, per that item's own
instruction. Until it does, a Protocol B result is not trustworthy.

Everything else — forced choice, no ties, one named biggest gap, distrust a win — is unchanged
from RI-VIS06 and CORPUS-CONTRACT §6.

## Scoring

This item is a *register*, not a scored bar in its own right; the score it carries is a
compliance check that any wave can run in under a minute.

| Check | Pass |
|---|---|
| `python3 corpus/70-visual/refs/make-manifest.py --check` | exits 0 — every file's sha256 still matches its record |
| every reference cited in this wave's visual verdicts resolves to a path under `refs/` | 0 unresolvable citations |
| every such citation obeys the routing table in §2 | 0 cross-side citations |
| every numeric band citation names its `reference-metrics.json` population **and** that population's `n` | 0 bare bands |
| no verdict cites a file under `modern/hud/` or `anti-generic/` as a *target* | 0 |

**Any single failure is a hard fail for the visual area of that wave**, in the same way
RI-VIS03 hard-fails a verdict reported as a bare number. A citation that cannot be resolved is
indistinguishable from a remembered image, which is the exact condition this item exists to end.

## How we lose

### §6 Failure modes this item is meant to prevent

- **Citing an image that does not exist.** The whole point. `MANIFEST.json` has no record without
  a file, and `make-manifest.py --check` will catch a file that changed underneath a record.
- **Folder laundering.** Moving a Morrowind image into `modern/` to make a fidelity comparison
  winnable, or a modern image into `morrowind/` to import somebody else's design language. The
  folders are the enforcement (RI-VIS01, REFERENCE-IMAGE-REQUEST §2); `side` on every manifest
  record is the audit trail.
- **Promoting `hud/` frames into a comparison** because the fidelity folders are empty and a
  wave needs a number. §2 forbids it and §5 explains why it also breaks the blind.
- **Treating the thumbnails as a fidelity floor.** Every Morrowind record carries
  `pixel_metrics_valid: false`. A claim of the form "our textures beat the reference" made
  against a 320×320 AVIF is measuring the AVIF encoder.
- **Quietly widening the amended bands.** RI-VIS03 §"how this gets gamed" already names
  threshold-tuning as the primary risk. The amendments in §4 move four bands **tighter** and one
  is a request to fix a broken metric; a future amendment that loosens a band must cite a larger
  reference population, not a failing render.
- **Pasting `reference-metrics.json` into RI-VIS03.** §4a is the reason. The `NYQ_ratio` line
  alone would install a band of 0.36–0.46 that measures a resampler, and it would carry
  `provenance: measured`, which is the one label nobody re-checks.
- **Promoting `modern/hud/` out of `hud/` because it is the only good modern imagery we have.**
  It is native 1440p, clean, correctly framed, and 24 files — everything the empty
  `exterior_daylight` folder wants. It also has a minimap in the corner and an editor's name in
  its EXIF. **This is the single most likely corruption of this set**, it will be argued for on
  good grounds, and §2 is the answer.
- **Merging an external acquisition without re-running `make-manifest.py`**, so the new records'
  integrity statistics are typed rather than computed. `_computed.json` has exactly one writer for
  this reason, and `--check` is how a reviewer catches it.
- **Silently improving the numbers by improving the reference set.** If a later wave adds images,
  the bands move. Every band citation must name the `reference-metrics.json` `n` it was derived
  from, so a moved band is visible as a changed `n` rather than as an unexplained pass.

## Provenance note

`provenance: measured`, `confidence: medium`.

The **file inventory, the integrity statistics and the metric values are measured** — produced by
`refs/make-manifest.py` and `tools/metrics/image-metrics.mjs` over the committed bytes, and
reproducible by re-running both. The **band comparisons in §4 are measured but under-powered**:
n=24 from one game, one session, one operator, with HUD on every frame, where the specification
asked for 12 images from 3 games per profile. `confidence: medium` is the honest reading, and it
should rise only when the modern folders are filled — not when someone re-reads the same 24 files.

The **routing rules in §2, the hazards in §6 and the Protocol B warning in §5 are `constructed`**
— they are this item's own authoring, derived from RI-VIS01's bifurcation and
`docs/REFERENCE-IMAGE-REQUEST.md` §§2, 5a, 7 and 11.

**The tooling caveat is load-bearing and is stated in §4a rather than here so it cannot be
skipped:** the values in `reference-metrics.json` are measured, deterministic and reproducible,
but they are measurements of statistics that differ from RI-VIS03's definitions — materially for
M3, M5 and M8. `measured` describes how the numbers were obtained, **not** that they are the
numbers RI-VIS03 asks for.

**Untested.** No blind run has been executed against these files. The most likely correction is
that RI-VIS06 §B1's degradation recipe does not neutralise a 320×320 reference and Protocol B
has to be re-specified — possibly by degrading *our* shot to 320×320 square crop rather than
meeting in the middle. Record the outcome in RI-VIS06 rather than improvising it at run time.

**Known-incomplete by construction.** This item registers a set that is one-sided by a factor of
eighty-nine to one. It is entered into the corpus in that state deliberately: a set that exists
and is honestly bounded is auditable, and the gaps in §3 are a shot-list an external acquisition
can work against. It is **not** evidence that the fidelity side has a reference population. It has
one image.
