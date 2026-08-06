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
images. RI-VIS02 lists twenty modern reference slots and RI-VIS05 lists seventeen Morrowind
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

## §1 What exists

Root: `corpus/70-visual/refs/`. 103 files in slot folders, 8 in `rejected/`.

| Folder | n | Source | What it is |
|---|---|---|---|
| `morrowind/REF-A1 … REF-A17` | **73** | `dehero/mwscr` | Vanilla-Morrowind art-direction reference, 15 of 17 slots, 4–6 images each. **AVIF previews, ≤ 569×320, mostly 320×320 square crops.** |
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

## §2 Which corpus items consume which images

| Item | May cite | May **not** cite |
|---|---|---|
| **RI-VIS02** (modern fidelity set) | `refs/modern/character_closeup/` | anything under `refs/morrowind/` |
| **RI-VIS03** (image metrics) | `refs/reference-metrics.json` populations `modern-hud`, `modern-character_closeup` | the `morrowind` population as a *target* — it is a contrast population only |
| **RI-VIS04** (renderer feature checklist) | `refs/modern/` for "what a shipped renderer does here" | `refs/morrowind/` |
| **RI-VIS05** (Morrowind transposition) | all 15 filled `refs/morrowind/REF-A*` slots | anything under `refs/modern/` |
| **RI-VIS06 Protocol A** (fidelity blind) | `refs/modern/character_closeup/` as the `--ref` side | `refs/morrowind/`, `refs/modern/hud/` |
| **RI-VIS06 Protocol B** (art-direction blind) | `refs/morrowind/REF-A*` as the `--ref` side | `refs/modern/` |
| **RI-VIS07** ("could this be Skyrim?") | `refs/anti-generic/` as the thing to measure distance **from** | `refs/anti-generic/` as a target — ever |
| **RI-VIS08** (character animation) | nothing — `refs/video/` is empty | — |

**`refs/modern/hud/` is never cited in a numeric comparison by anything.** It is composition,
framing and over-the-shoulder-camera reference for builders, and the source of the
`anti-generic/` anchor. `REFERENCE-IMAGE-REQUEST.md` §5a is the rule; this item does not soften it.

**`refs/anti/` remains reserved** for the file our own harness generates. Nothing in this item
writes there.

## §3 Coverage gaps — stated up front, not buried

1. **Five of six `modern/` profile folders are empty and the sixth holds one image.** RI-VIS03's
   `exterior_lowlight`, `interior_darkemissive`, `combat` and `material_closeup` bands have **no**
   reference population and cannot be calibrated at all. RI-VIS02's slots REF-M1, M2, M3, M5, M7,
   M10, M11, M12, M13, M14, M15, M16, M17, M18, M19 and M20 are unfilled.
2. **The one modern population that exists is n=24, one game, one session, one operator, HUD on
   every frame.** Any p10/p90 derived from it is indicative, not authoritative.
3. **The Morrowind set is thumbnails.** ≤ 569×320, mostly 320×320 square crops, 0.41–2.77
   bytes/pixel. `pixel_metrics_valid: false` on all 73. Usable for palette, silhouette, built
   form, flora and creature design language — **never** for texture resolution, texel density,
   anti-aliasing or sharpness, and the square crop has destroyed original framing for ~92% of them.
4. **`vanilla_confidence` is `"medium"` on all 73, never `"high"`.** V1, V5 and V7 were confirmed
   by eye; V2 was assessed per image (7 files show distant land and are recorded
   `engine: "openmw-distant-land"`); **V3, V4 and V6 could not be assessed at 320×320 and are
   recorded `null`.**
5. **REF-A12 (the Morrowind UI) and REF-A13 (armour on NPCs) are unfilled**, and REF-A8 (NPC
   density) and REF-A17 (Imperial interior) are partial. See ACQUISITION-REPORT §4 for what a
   realistic version of each would be.
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
`MANIFEST.json`** — it is generated, and hand edits are lost on the next run.

## §4 What the set already changed

Running `tools/metrics/image-metrics.mjs` over the acquired images produced the first measured
numbers the visual area has ever had. ACQUISITION-REPORT §10 gives the full table and the
mapping caveats. The three results that matter here:

- **RI-VIS03's M4, M5 HFR, M5 alpha, M2 C_global and M8 bands were guessed close** — the measured
  p10–p90 of a real current-generation population sits inside or nearly inside each of them.
- **Five bands are proposed for amendment** (M1 `mean Yp` floor, M1 `blown`/`crushed` maxima,
  M7 `dY_sky` floor, M2 `C_local_med` floor), and one metric — **M5 `NYQ_ratio ≤ 0.18`** — is
  failed by **100% of the real reference population**, with the 2002 Morrowind set scoring
  *nominally better* than the 1440p modern set. A band that every reference fails is a broken
  instrument, not a bar. ACQUISITION-REPORT §10 amendment 5 proposes the fix.
- **RI-VIS03's M3 could not be checked at all**: it specifies CIELAB C\* and the harness reports
  HSV saturation. `tools/metrics/image-metrics.mjs` needs a CIELAB chroma path before M3 is
  calibratable.

**RI-VIS03 has not been edited.** These are proposals, and RI-VIS03 keeps `provenance:
constructed` until a wave adopts them.

## §5 The blind procedure — the only part a blind judge may read

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

## §6 Failure modes this item is meant to prevent

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

**Untested.** No blind run has been executed against these files. The most likely correction is
that RI-VIS06 §B1's degradation recipe does not neutralise a 320×320 reference and Protocol B
has to be re-specified — possibly by degrading *our* shot to 320×320 square crop rather than
meeting in the middle. Record the outcome in RI-VIS06 rather than improvising it at run time.

**Known-incomplete by construction.** This item registers a set that is one-sided by a factor of
seventy-three to one. It is entered into the corpus in that state deliberately: a set that exists
and is honestly bounded is auditable, and the gaps in §3 are a shot-list an external acquisition
can work against. It is **not** evidence that the fidelity side has a reference population. It has
one image.
