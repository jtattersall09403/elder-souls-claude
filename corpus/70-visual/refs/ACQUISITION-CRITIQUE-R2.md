# Reference coverage critique — round 2

**Role:** REFERENCE COVERAGE CRITIC. I build nothing. **Round:** 2 of a loop that closes only when a
critic is completely satisfied.
**Measured:** 2026-08-06, by walking the directory tree and by re-measuring pixels myself. Where a
number here disagrees with `MANIFEST.json` or with `ACQUISITION-REPORT.md` §15, mine was computed
from the bytes on disk and the disagreement is itself reported.

---

# VERDICT: **NOT SATISFIED**

Round 1's builder did a great deal of real work and most of it is good. `souls-behaviour/` went from
a missing directory to 93 filed frames with per-file `depicts` text of a quality this corpus has not
seen before. `REF-A12b` went from zero pixels to 33 across eight resolutions and eleven sub-kinds.
The Morrowind crop defect (F1) is closed with 57 full-frame captures and the crops honestly marked
`superseded_by` rather than deleted. `context/` is at 23 with five subject kinds. I am not asking for
that work to be redone.

I am not satisfied for four reasons, in descending order of importance:

1. **The set still cannot judge animation.** 449 media files, **zero temporal**. `video/` is an empty
   directory. Every claim on the A5 axis that is about *behaviour* — windup, arc, follow-through,
   recovery, hitstop, telegraph legibility over time, camera lag — is a claim about change over time,
   and the axis built to serve it contains only stills. The project has written this off as blocked
   by YouTube. **It is not blocked.** See **F12** — I downloaded an 81-frame Elden Ring longsword
   moveset animation today, and read `frameCount: 81, duration: 5.67 s` out of a MediaWiki API that
   returns HTTP 200.
2. **The binding constraint on the modern side is misdiagnosed, and round 2 was about to be spent
   chasing it.** The builder's `block_score` story — "Steam re-encodes user uploads, so more Steam
   downloads cannot fix it" — is **contradicted by the builder's own computed fields** and by a
   controlled experiment I ran. See **F13**. Two profiles are failing a threshold that a dark scene
   cannot pass at any encoder quality below lossless.
3. **A7 has zero acquisition, and the current set could not support A7's measurement even if the
   images existed**, because nothing distinguishes "valid for fidelity metrics" from "valid for
   art-direction metrics" and 199 files are flagged `heavily_recompressed`. See **F18**.
4. **Several catalogue fields are folder constants rather than observations**, which silently
   overstates the population of the items that depend on them. `has_hud` is `true` for 93 of 93
   souls files; **29 of those 93 have literally zero saturated pixels in the DS3 HP-bar region.**
   See **F14**.

---

## 0. What would make me satisfied

Concretely and closably. This is the whole list; nothing else is required of round 2.

1. **`refs/souls-behaviour/anim/` exists and holds at least 20 animated sequences**, per named move,
   from the two wiki APIs verified live in **F12**, with `frame_count` and `duration_s` copied from
   `iiprop=metadata` into each record. That closes V1/V2's *purpose* even though V1/V2's *form*
   stays unobtainable.
2. **`block_score` is either made exposure-invariant or given a per-profile threshold**, and
   `exterior_lowlight` / `interior_darkemissive` are re-scored against it. If the project prefers a
   source fix instead, it must be a genuinely lossless one — I verified `deadendthrills.com` serves
   2560×1440 and 3840×2160 **PNG** and that a dark frame from it (mean luminance 47.5) scores
   `block_score 0.998`.
3. **`REF-A21-regions/`, `REF-A22-intraregion/`, `REF-A23-ground/` exist and are populated**, and a
   `metrics_valid_for: ["art-direction"]` flag (or equivalent) exists so A7's dispersion computation
   has a defined input set.
4. **`has_hud`, `slot` and `side` are per-file observations, not folder constants.** Specifically:
   `has_hud` set by eye or by measurement; `side` uses one string per side, not two; and every
   `REF-M*` slot is either filled by name or listed as unfilled by name.
5. **`video/` no longer has a manifest record for a file that is not on disk**, and
   `acquire.py --check`'s pass count is true.
6. Every remaining gap classified per A3, with **no gap BLOCKING for a reason I have not named a
   search for below**, and the three A3-IMPOSSIBLE items written down with the dependent bar
   actually lowered in the reference item, not just noted here.

If those six are done I will sign this off, even if several floors are still short on count. A4 says
breadth beats depth and I am applying it.

---

# 1. Pass 1 — coverage against what was asked

Counted by walking the tree. `find` over `{jpg,jpeg,png,avif,webp,gif,mp4,webm,mkv}`:
**449 media files on disk** (359 JPEG, 90 AVIF). `MANIFEST.json` holds **488 records**, of which
**450** are media. The one-record difference is a ghost — see **H6**.

## 1a. `refs/modern/` — the fidelity side

Floors from `docs/REFERENCE-IMAGE-REQUEST.md` §3 as amended by A1/A2/A4. §3 counts only
`pixel_metrics_valid: true`. "Locations" is the count of distinct `depicts` strings.

| Folder | Floor img/games/loc | Files on disk | **Countable** | Games | Distinct `depicts` | Interval-run | Verdict |
|---|---|---:|---:|---:|---:|---:|---|
| `exterior_daylight` | 12 / 3 / 6 | **43** | **33** | 4 | 20 | 24 (56%) | **PASS on every clause — but see F16** |
| `exterior_lowlight` | 12 / 3 / 6 | **24** | **8** | 4 | 24 | **0** | count FAIL, games PASS, anti-curation FAIL |
| `interior_darkemissive` | 10 / 2 / 5 | **22** | **3** | 4 | 22 | **0** | count FAIL, games PASS, anti-curation FAIL |
| `character_closeup` | 10 / 2 / 6 | **13** | **7** | 3 | 13 | exempt | count FAIL — **and mis-populated, see F17** |
| `combat` | 8 / 2 / 4 | **12** | **8** | 4 | 12 | exempt | **PASS** |
| `material_closeup` | 8 / 2 / 6 | **9** | **5** | 3 | 9 | exempt | count FAIL (5/8), games PASS |
| `modern/ui` (`REF-M22`) | ≥2 games | **8** | 0 (n/a) | 3 | 8 | n/a | **PASS** — 6 of 8 at 1920×1080, thin for F18 |
| `modern/hud` | dissolved by A1 | **0** | — | — | — | — | **correctly dissolved** |

The builder's §15.2 table agrees with mine on every number. **I confirm it.** The change from round 1
is real: 1-of-6 profiles with ≥2 games became 6-of-6 with ≥3.

**Where I disagree with the builder is the *cause* of the two remaining count failures** — see
**F13**. It is not the source.

## 1b. `refs/morrowind/` — the art-direction side

| Slot group | Floor | Full-frame | Superseded crops | Total | Verdict |
|---|---|---:|---:|---:|---|
| `REF-A1`–`REF-A19` excl. A12 | 2–3, core five 4–5 | **57** | 84 | 141 | **PASS on count.** F1 closed. |
| `REF-A3` (Telvanni) | 2–3 | **0** | 5 | 5 | **FAIL** — the one slot with no full-frame capture |
| `REF-A12` (MyGUI XML) | 4–5 | — | — | 38 text files, 0 images | structurally unfillable as images; A12b supersedes |
| **`REF-A12b`** (A2) | 2–3 × 8 sub-kinds | **33** | — | 33 | **PASS.** 11 sub-kinds, 8 distinct resolutions, 4:3 and 16:9 |
| **`REF-A20`** (A2) | loading/splash | **4** | — | 4 | **PASS** at the floor |
| **`REF-A21-regions`** (A7) | 4–6 × 9 regions = 36–54 | **directory absent** | — | **0** | **FAIL — never created** |
| **`REF-A22-intraregion`** (A7) | 6–8 × 2 regions | **directory absent** | — | **0** | **FAIL — never created** |
| **`REF-A23-ground`** (A7) | ≥1 × 9 regions | **directory absent** | — | **0** | **FAIL — never created** |

**A7 is at zero across all three of its sets.** Region names do appear incidentally in the 94
full-frame records' text — Bitter Coast 6, Ascadian 5, Ashlands 4, Ald 3, Telvanni 2, Seyda 2,
Balmora 2, Vivec 1, Molag Amur 1 — but that is a by-product of slot-driven acquisition, not a region
set. **Four of A7's nine named regions (West Gash, Grazelands, Sheogorad, Azura's Coast) do not
appear at all**, and A7 needs ≥4 per region for a centroid that is not noise.

## 1c. Everything else

| Folder | Floor | Files | Verdict |
|---|---|---:|---|
| `anti-generic/` | 4–6 | 5 | **PASS** |
| `context/` (A6) | **12–16** | **23** | **PASS on count, INCOMPLETE on subject** — see F25 |
| `souls-behaviour/` (A5 + F3/F4) | whole axis | **93** | **built** — see F14, F15, F19 for what it does and does not cover |
| `video/` | V1 + V2 **required** | **0 files on disk** | **FAIL — empty directory** |
| `rejected/` | n/a | 14 | ok |

### `refs/souls-behaviour/` by subfolder

| Subfolder | Files | Games | Notes from my own read of the `depicts` text and the pixels |
|---|---:|---|---|
| `stance/` | **18** | DS3 only | The largest folder and the easiest subject — a character standing at a bonfire. Genuinely good for `RI-CAM07` §B. |
| `arena/` | 14 | DS3 only | Good. Two genuine fog-gate frames. F3 closed. |
| `camera/` | 12 | DS3 only | Good; three explicitly note over-the-shoulder height. |
| `attacks/` | 12 | DS3 only | **Best folder in the set.** Contains three windup/mid/recovery *pairs of the same attack*, which is the only place in the corpus that approaches a temporal claim. |
| `ui-combat/` | 12 | DS3 only | **8 of 12 are menus** (title, options, equipment, storage ×2, inventory ×2, covenant), not in-combat UI. See **F19**. |
| `telegraph/` | 10 | DS3 8, DSR 2 | 5 genuine windups; 5 are approach or idle. |
| `death/` | 10 | DS3 only | Good. The `searchText=bloodstain` find in §15.8 was the right call. |
| `impact/` | **5** | DS3 only | Smallest folder, hardest subject, and the one a still can least serve. |

**The clustering the brief suspected is real: `stance` 18 versus `impact` 5.** The two items that are
most temporal — impact and telegraph — are the two least populated, which is the expected outcome of
searching for stills.

## 1d. Catalogue defects

| # | Defect | Status |
|---|---|---|
| **H1** *(R1)* | manifest/disk out of sync | **fixed for 449 of 450** — see H6 |
| **H2** *(R1)* | provenance rewritten not merged | **fixed.** §15.5's path-key copy-down is the right fix and is well explained. |
| **H3** *(R1)* | all modern records `REF-M-supplemental`; no real `REF-M*` slot ids | **NOT FIXED, and now worse.** Of 131 `modern/` records: **83 have `slot: null`**, 39 `REF-M-supplemental`, 8 `REF-M22`, **1 `REF-M6`**. Twenty of §5a's twenty-one `REF-M*` slots are still formally unfilled and now most records do not even carry a placeholder. §15 never mentions H3. |
| **H4** *(R1)* | headline count ≫ measurable count | **still true and now quantified**: 449 files, **69 with `pixel_metrics_valid: true`**. Every `pixel_metrics_valid: false` is defensible individually (A5 mandates it; art-direction does not use it) but nobody should quote 449 as a coverage number. |
| **H5** *(R1)* | 3 `corroboration: unknown` | **fixed** — all three moved to `rejected/`. |
| **H6** *(new)* | `MANIFEST.json` holds a record for `video/V4-combat__archive-pc-longplay-dark-souls-remastered.ia.mp4`. **The file is not on disk.** `video/` is empty. §15.1's claim that `acquire.py --check` "passes: 323 of 323 fetchable records verify byte-for-byte, including the 3.3 GB video" is **no longer true** — the video was removed after that sentence was written and the record was not. |
| **H7** *(new)* | **`side` has two names for one side**: `morrowind-art-direction` (127 records) and `morrowind-art` (94). Any per-side query returns one or the other, silently. Similarly `game` carries both `The Elder Scrolls III: Morrowind` and `The Elder Scrolls III: Morrowind (2002)`, which makes a naive distinct-games count report **2** for a one-game side. |
| **H8** *(new)* | `has_hud` is a **folder constant**, not an observation, in three folders: `souls-behaviour/` 93 of 93, `REF-A12b` 33 of 33, `anti-generic/` 5 of 5. Measured: **29 of the 93 souls frames have exactly 0.0000 saturated pixels** in the region a DS3 HP/stamina bar occupies. See **F14**. Elsewhere (`modern/`, `REF-A1`–`A19`) the field does vary per file, so this is specifically the axis added this round. |
| **H9** *(new)* | §15.2 reports `REF-A12b` sub-kind "menu-mode multi-window 8". **The catalogue has no such sub-kind** — `ui_subkind` runs dialogue 5, map 5, book_reader 4, character_sheet 4, inventory 4, barter 3, journal 3, level_up 2, tooltip 2, char_creation 1 = 33, with no multi-window value. Critic finding **F5**'s multi-window requirement therefore **cannot be verified from the catalogue**, only from the prose. |
| **H10** *(new)* | Only **162 of 488** records cite any `RI-*` item id. All 162 are on the souls axis or `context/`. **No `refs/modern/` or `refs/morrowind/` record names the reference item it serves.** A critic cannot ask "what serves `RI-WLD03`?" and get an answer. |

---

# 2. Pass 2 — fresh findings

Re-derived ignoring the slot list. Each names the reference item that cannot otherwise be judged, and
each is argued from something I measured rather than something I assumed.

---

## F12 — The set supports judging **pose**, not **animation** — and the fix is a MediaWiki API, not a video host. *(This is the most important finding in this document.)*

**449 media files, zero of them temporal.** Extension census of the whole tree: 359 `.jpg`, 90
`.avif`, and nothing else. `video/` is an empty directory.

Now read what the corpus asks:

- **`RI-WPN01`–`RI-WPN04`** are, in order, *windup silhouette*, *arc type*, *follow-through*,
  *recovery posture*. Three of those four are defined by what happens **between** frames. `attacks/`
  contains three windup/mid/recovery pairs, which is real evidence — and it is three attacks, of one
  weapon class, in one game, with no timing.
- **`RI-AI02`**'s bar is *"the player must be able to see, from the enemy's silhouette alone, which
  attack is coming **and roughly when**."* "Roughly when" is a duration. A still cannot contain one.
- **`RI-WPN05`** hitstop, **`RI-CAM01`/`RI-CAM03`** camera lag and lock-on containment, **M11** and
  **M12** — all temporal, all uncalibrated.
- **A5 rule 3** says in terms: *"Video is first-class here, not a fallback… a still cannot show a
  windup."* The axis was built entirely of stills.

The project has concluded this is IMPOSSIBLE because YouTube is closed to the container and
archive.org's current-gen holdings are too large. **Both premises are true and the conclusion is
wrong**, because the artifact that actually serves these items is not a longplay. It is a per-move
animation, and two wikis publish libraries of them. All of the following I verified today:

| Step | Verified result |
|---|---|
| `https://darksouls.fandom.com/api.php?action=query&list=categorymembers&cmtitle=Category:Dark%20Souls:%20Boss%20Attack%20Animations&cmlimit=500&format=json` | **HTTP 200.** 12 members, named per move: `Artorias - Heavy Slam`, `- Somersault Attack`, `- Overwhelming Leap`, `- Heavy Spin`, `- Heavy Thrust`, `- Wrath of the Abyss`, `- Spin Attack`, `- Abyss Sludge`. *(R1 found this. The builder did not act on it and §15.6 does not list it as attempted or blocked — it was silently dropped.)* |
| `https://eldenring.fandom.com/api.php?action=query&list=categorymembers&cmtitle=Category:Images%20-%20Animated%20gifs&cmlimit=500&cmtype=file&format=json` | **HTTP 200. 31 members, and nobody has ever looked at this one.** Includes `ER Moveset Neutral Attack Chain Longsword`, `ER Moveset Strong Attack Chain Longsword`, `ER Moveset War Cry Strong Attack Longsword`, `ER Moveset Barbaric Roar Strong Attack Longsword` — i.e. **`RI-WPN01`–`RI-WPN04` for one named weapon class, four times over** — plus **11 `ER Skill Quickstep …` clips** (forward/back/left/right/reverse, and the attack out of each), which is a locomotion and dodge library, plus `Bloodstain rogier.gif` for `RI-JRN06`, plus five enemy Ash-of-War clips for `RI-AI02`. |
| Download `ER_Moveset_Neutral_Attack_Chain_Longsword.gif` | **HTTP 200, 6,169,534 bytes.** Arrives as animated WebP, exactly as R1's F2 warned. PIL reports **`n_frames = 81`, 600×338**. |
| `&prop=imageinfo&iiprop=metadata` on the same file | **Returns `frameCount: 81`, `duration: 5.67`, `looped: true`.** |

**That last row is the finding.** The WebP transcode strips per-frame delays — but the **API serves
the original GIF's frame count and total duration as metadata**, so 81 frames over 5.67 s gives
**14.29 fps, ≈70 ms per frame**, and the frame *index* of the contact pose is readable off the WebP.
Which means:

- **`RI-WPN01`–`RI-WPN04` become measurable**, not constructed: windup / active / recovery expressed
  as fractions of a known total duration.
- **`RI-WPN05`'s ordering claim becomes measurable** (dagger < ultra greatsword), which is exactly
  what §15.6 said the bar should be reduced to. It can now be *met* rather than merely restated.
- **`RI-AI02`'s "roughly when"** gets a number at ±70 ms.
- **Absolute frame-exact calibration (16.7 ms) stays IMPOSSIBLE** and I am not asking for it. 70 ms
  is 4 frames at 60 Hz; say so in the record and lower `RI-WPN05`'s bar to that resolution.

**Classification: BLOCKING, cheap, and the route is proven end to end.** The specific searches are in
the table above; they are two URLs. Destination: a new `souls-behaviour/anim/`, `side:
souls-behaviour`, `pixel_metrics_valid: false` (already mandated by A5 rule 3, so the WebP transcode
is in-policy *here and nowhere else*), and `frame_count` / `duration_s` copied from the API.

**Secondary route for V1/V2 proper, if the project still wants a real dolly and static shot:**
`gamersyde.com` returns HTTP 200 and publishes its own high-bitrate MP4 captures for direct download
rather than via YouTube. The download links are behind a free account and are JS-injected, so the
specific next step is: register, then re-fetch an article and read the download URLs. I did not do
this because it needs an account. **I would not hold round 2 open for it** — F12 serves the purpose
V1/V2 exist for, and V1's LOD-pop measurement is the only thing it does not serve.

---

## F13 — `block_score` is confounded with scene darkness. The "Steam re-encodes user uploads" diagnosis is refuted by the builder's own computed fields.

The brief asked me to verify this diagnosis independently, because it is the stated binding
constraint on the modern side. **It does not survive.**

**Evidence 1 — the builder's own numbers say these files are near-lossless.** `jpeg_quality_est` is
computed from the luma quantisation table by `make-manifest.py`. Its **median is 100.0 in every
single Steam-sourced folder**, including the ones called heavily recompressed, and
`bytes_per_pixel` runs 1.29–2.31. For comparison, I re-encoded a corpus image at JPEG q=95 and got
**0.31 bytes/pixel**. A file at 1.3 bytes/pixel with a q≈100 quantisation table is not a heavy
re-encode.

**Evidence 2 — the metric's own formula.** `make-manifest.py` line 138:

```python
return (aligned / n_aligned) / (other / n_other)
```

mean |Δ| across 8-aligned columns, divided by mean |Δ| across all other columns. **The denominator
is the scene's own detail.** A dark, smooth scene has a small denominator, so the ratio rises for a
fixed amount of blocking. The metric measures how *visible* blocking is relative to scene content,
not how much information was destroyed.

**Evidence 3 — a controlled experiment.** One image (`run-w3nextgen-t0007.jpg`, the corpus's cleanest
at `block_score` 0.987), one encoder, one quality setting, only luminance varied:

| Treatment | mean luminance | `block_score` at **constant q=95** |
|---|---:|---:|
| original | 161.9 | **1.093** — PASS |
| ×0.5 brightness | 80.7 | 1.203 — FAIL |
| ×0.3 brightness | 48.1 | 1.313 — FAIL |
| ×0.18 brightness | 28.6 | **1.447** — FAIL |

Darkening alone, with nothing else changed, moves a file from PASS to a score higher than
`interior_darkemissive`'s entire observed median. **The luminance effect (+0.35) is larger than the
whole margin between §8a's threshold (1.15) and the failing profile's median (1.29).**

**Evidence 4 — the same pattern across the real corpus, one host, one encoder.** Over the 106
Steam-sourced `modern/` files, Pearson **r(mean luminance, block_score) = −0.369** and
**r(bytes/pixel, block_score) = −0.588**, and by luminance quintile:

| luminance band | n | median `block_score` | fail >1.15 |
|---|---:|---:|---:|
| 4–33 | 21 | **1.284** | 14/21 (67%) |
| 36–57 | 21 | 1.246 | 16/21 |
| 58–70 | 21 | 1.162 | 12/21 |
| 71–89 | 21 | 1.133 | 10/21 |
| 90–136 | 21 | 1.133 | **8/21 (38%)** |

Monotone. Same host, same uploader pipeline, same encoder — the only variable that moves is how dark
the picture is.

**Evidence 5 — a genuinely lossless dark image passes easily.** I found and tested a real lossless
current-gen source. `deadendthrills.com` returns HTTP 200 and serves 2560×1440 and 3840×2160 **PNG**
(3–11 MB). Measured:

| file | resolution | mean luminance | `block_score` |
|---|---|---:|---:|
| `battle.png` | 3840×2160 | **47.5** (squarely in the failing quintile) | **0.998** |
| `cheese.png` | 2560×1440 | 123.8 | 0.991 |
| `hammer_heart.png` | 2560×1440 | 109.4 | 0.995 |
| `departure.png` | 3840×2160 | 207.8 | 0.996 |

**So the correct statement is:** the metric is not broken — a lossless dark frame scores 1.00 and it
correctly reports "no blocking". What is broken is applying **one absolute threshold to all
profiles**, when relative encode damage is inherently larger in dark scenes at any fixed quality.
`interior_darkemissive` — the profile *defined by* darkness — is being held to a strictly harder
standard than `exterior_daylight` for identical source quality. That is a permanent self-inflicted
fail of exactly the kind A3's IMPOSSIBLE class exists to stop.

**Two ways out, and the builder should pick one, not both:**

- **(a) Fix the threshold, zero downloads.** Make it exposure-relative. The corpus already contains
  the calibration: the luminance-quintile table above is the expected `block_score` of an
  undamaged-enough Steam frame at each exposure. Setting the threshold at *quintile median + 0.10*
  takes `interior_darkemissive` from 3 countable to roughly 14 and `exterior_lowlight` from 8 to
  roughly 18, at the cost of one code change. Alternatively drop `block_score` as the gate for dark
  profiles and gate on `jpeg_quality_est` and `bytes_per_pixel`, which are exposure-independent and
  already computed, and which say these files are fine.
- **(b) Fix the source, and it must be lossless — not "a press kit".** `deadendthrills.com` is
  verified above. **Its serious caveat, stated plainly: these are art-directed photo-mode captures.**
  They are the *most curated* images in existence and importing them into a profile whose §3 rule is
  an anti-curation rule is a real cost. They are defensible for `material_closeup` (a surface study
  is legitimately posed) and as a small lossless anchor set for `interior_darkemissive`; they are not
  defensible as the bulk of a profile.

**My recommendation is (a), and (b) only for `material_closeup`.** Chasing a lossless source for a
whole profile is the expensive answer to a threshold problem.

**Classification: the gap is INFERABLE, not BLOCKING** — the reasoning above is the inference and it
is sound. Both profiles should be re-scored, not re-acquired.

---

## F14 — `has_hud` is a folder constant, so `RI-UIX01`'s population is ~10 frames, not 93 — and nothing in the set shows a lock-on reticle or a status buildup bar.

`has_hud` is `true` for **93 of 93** souls files, **33 of 33** `REF-A12b`, **5 of 5** `anti-generic`.
In `modern/` and `REF-A1`–`A19` it varies per file, so this is not the tool's fault — it is a value
typed once per folder this round.

I measured it. Counting strongly-saturated pixels in the frame region a DS3 HP/stamina/FP bar
occupies, **29 of the 93 souls frames return exactly 0.0000** — no HUD at all. One I opened by eye
(`souls-behaviour/telegraph/SB-TEL__ds3-3620431452.jpg`) is a clean, HUD-free, photo-mode-style
portrait of a robed scythe-bearer in an archway; its record says `has_hud: true` and describes it as
*"Dancer of the Boreal Valley standing with blades trailing before an attack."* It has no HUD and no
attack.

**Why this matters more than tidiness, twice over:**

1. **A1 clause 3** makes the metrics battery *mask a border band* wherever `has_hud` is true. Applied
   to 29 frames that have no HUD, the mask discards real image data from the measurement.
2. **A5 rule 4** says *"HUD is wanted, not tolerated: `RI-UIX01` needs it."* `RI-UIX01` measures
   *"HP/stamina/flask placement, lock-on reticle, status buildup — as screen coverage and
   contrast."* Its population is not 93. From the `depicts` text plus the measurement, it is
   **about 10 frames** that actually contain a combat HUD.

And within those ten, reading all 93 `depicts` strings: **not one names a lock-on reticle, and not
one names a status-buildup bar.** Both are named explicitly by `RI-UIX01`. They are also the two HUD
elements that only appear under a specific condition — lock-on engaged, bleed/frost accumulating —
which is precisely why a "search for combat screenshots" pass will never surface them.

**Classification: BLOCKING, and the specific search is a query nobody has run.** Steam app **374320**
(DS3) and **1245620** (Elden Ring), `searchText=lock on`, `lock-on`, `target`, and separately
`bleed`, `frostbite`, `scarlet rot`, `poison` — the status names are what uploaders title a frame
where the bar is filling. Triage by eye for the reticle glyph and for a partially-filled status bar.
The `has_hud` repair itself is free and needs no download.

---

## F15 — The behavioural axis is 91 of 93 one game, and A5 rule 5 asked for two.

`souls-behaviour/`: **DARK SOULS III 91, Dark Souls Remastered 2, Elden Ring 0.**

A5 rule 5: *"Both games count. Dark Souls 1/3 and Elden Ring are equally valid here — behaviour is
what is being referenced, and it is consistent across the series in the ways we care about."*
That sentence is an invitation to breadth and it was read as permission for depth in one title.

The consequence is not pedantic. **Elden Ring's camera is not DS3's camera** — different default FOV,
different lock-on distances, a mounted mode, and much larger arenas. `RI-CAM01`'s pivot height and
shoulder offset and `RI-CAM03`'s lock-on containment law are being measured off one game's camera and
generalised to "Souls". That is the single-source problem §3's `min distinct games` rule exists to
prevent, arriving on the one axis where §3's rule was not written down.

Elden Ring is abundant in this repository — 46+ files in `modern/` — so this is not a source problem.
It is that the souls harvest ran against apps 374320 and 570940 and not 1245620.

**Classification: BLOCKING, cheap.** Steam app **1245620**, `searchText=` the same queries the DS3
harvest used: `lock on`, `boss fight`, `greatsword`, `swing`, `shield`, `jump attack`, `bloodstain`.
**And F12's Elden Ring animated-GIF category fills `attacks/`, `stance/` and a new `anim/` with
Elden Ring material in one API call.** Target: ≥⅓ of each subfolder from a second title.

---

## F16 — The interval run is 56% of `exterior_daylight` and it is the negative anchor's location. §3's anti-curation rule and its distinct-locations rule are in tension.

The 24 released Witcher 3 frames were R1's rank-0 free win and they did what was promised: 0% → 56%
interval-run compliance in `exterior_daylight`. I uphold the release (see ruling R1 below). But
nobody has looked at what they *are*.

I opened two. `run-w3nextgen-t0007.jpg` and `run-w3nextgen-t0305.jpg` are both **Novigrad**:
half-timbered gables, whitewash-and-timber townhouses, cobbles. The catalogue agrees — **all 24 share
one identical `depicts` string.**

Now open `anti-generic/`. It holds five files, `role: "NEGATIVE anchor only. RI-VIS02 names The
Witcher 3 as the canonical fantasy look we must not converge on; RI-VIS07 measures distance away from
it. Never a target."* One of the five is literally `ANTI__w3-novigrad-half-timbered.jpg`.

**So 56% of the mass of the profile that sets our `exterior_daylight` fidelity bands is one
three-to-fifty-minute walk through the exact town another folder designates as the thing we must
measure distance away from.** For purely rendering-quality metrics (M4 edge density, M2 local
contrast) that is defensible — A1's whole argument is that fidelity is content-agnostic. For the
content-sensitive bands (colour entropy, sky fraction, palette centroid, foliage statistics) it is
not: one location at 56% weight *is* the band.

The deeper point is structural. **§3 requires ≥6 distinct locations *and* ≥half interval-run, and
those two rules fight each other**, because an interval run is by construction one location. The
builder satisfied the second by concentrating the first. Nobody wrote a rule about weight.

**Classification: INFERABLE — no download. The fix is a computation rule**, and it should be filed as
an amendment: *when computing a profile's `[p10,p90]` band, any single interval-run series counts as
one location and is downweighted to at most `1/locations` of the population mass.* Then run a second,
cheaper check I would like to see reported: **compute `exterior_daylight`'s bands with and without
the 24, and state the difference.** If it is small, this finding costs nothing and can be closed. If
it is large, the profile needs a second run from a non-Novigrad location — and the same source
(`elfhuo-github/sksebp-og.github.io`, already in the repo) may have one.

---

## F17 — `character_closeup` is not short by three files; it is mostly the wrong camera.

Thirteen files. Reading every `depicts`: **nine are Elden Ring cutscene or NPC portraits** — Melina
standing in Limgrave, Melina facial close-up, Godrick grafting cutscene ×2, Godrick portrait,
Godrick arena cutscene, Godrick dialogue close-up, Godrick confrontation, Malenia beneath the
Haligtree.

`REF-M6` is the **player character from behind at 40–70% of frame height**, and `RI-CAM07` §B is
explicit about why: *"the back of the head, the back of the armour, the backs of the legs and the
hanging scabbard get more screen-time than any other surface in the game, and they must be authored
accordingly."* A cutscene close-up of Godrick answers none of that, and it is not even the same
renderer path — cutscene cameras use different framing, different LOD selection and often a
different lighting rig from the gameplay camera. **It is the wrong camera, not merely the wrong
angle.**

The genuinely useful files here are three: the RDR2 Arthur-from-behind camp shot, the RDR2
three-quarter-rear rider, and (partially) the two Witcher 3 close-range pairs.

**The builder named the fix and did not run it.** §15.6: *"the 24 relocated Witcher 3 frames are all
rear-view Geralt and could be cross-filed rather than re-downloaded."* I checked by eye and the claim
is **half true**: `t0305` is a textbook three-quarter-rear — back of armour, hanging swords, backs of
the legs, exactly `RI-CAM07` §B. `t0007` is a **side profile** with the face visible. So cross-filing
works but needs eyes on all 24, not a bulk copy.

**Classification: BLOCKING, and free.** No download: eyeball the 24, cross-file the rear-view subset
into `character_closeup` with `sampling: interval-run` preserved, and **re-file the nine Elden Ring
cutscene portraits out of `character_closeup`** — they are legitimate `material_closeup`-adjacent
skin/cloth references and should be recorded as such rather than counted against `REF-M6`.

---

## F18 — A7 cannot be computed even once its images exist, because "valid for fidelity metrics" and "valid for art-direction metrics" are the same flag.

`pixel_metrics_valid` is **`false` for all 183 `refs/morrowind/` records**, all 23 `context/`, all 8
`modern/ui`. That is correct as written: those files are not used for texture, anti-aliasing or
colour-statistics *fidelity* judgements.

But **A7 asks for a different kind of measurement over exactly those files**: *"pairwise distance
between region centroids across the metric vector (palette in CIELAB, luminance distribution, edge
density, colour entropy, sky fraction, silhouette statistics)."* Those are art-direction metrics, and
they are computed on the same pixels.

Two of them — **edge density and colour entropy** — are precisely the quantities JPEG blocking
corrupts. And **199 files across the set carry `heavily_recompressed: true`**, including, by my count
from the manifest, 3–5 in most `REF-A*` slots and 12 of 33 in `REF-A12b`. Slot-level medians make it
concrete: `REF-A4` `block_score` 1.50, `REF-A19` 1.42, `REF-A2` 1.42, `REF-A18` 1.33 — all far worse
than `interior_darkemissive`'s 1.29, and for the same reason (low-detail scenes, small denominators),
compounded by genuinely low `bytes_per_pixel` of 0.53–0.91.

**So A7's headline number — `inter_median / intra_median` — would today be computed over a
population where a meaningful fraction of the between-region variance is JPEG artefacts.** And there
is no flag to filter on, because the one flag that exists means something else.

**Classification: BLOCKING for the acquisition, INFERABLE for the flag.** Two separate actions:

- **The flag.** Add `metrics_valid_for: ["fidelity"] | ["art-direction"] | both | none` (or a second
  boolean), computed, so A7 has a defined input set. This is a `make-manifest.py` change and a
  re-run. It also fixes F13's threshold problem cleanly, because the two validities can carry
  different thresholds.
- **The acquisition.** A7's three sets, from Steam app **22320**, `searchText=` the region names A7
  itself lists: `Ascadian`, `Bitter Coast`, `West Gash`, `Grazelands`, `Ashlands`, `Molag Amur`,
  `Sheogorad`, `Azura's Coast`, `Red Mountain`. **Four of those nine currently have zero
  representation anywhere in the corpus.** For `REF-A23-ground` the query is not a region name —
  uploaders do not title downward shots by region — it is `alchemy`, `ingredient`, `harvest`,
  `flowers`, `mushroom`, `plants`, which return the near-ground framing A7 wants, plus eye-triage on
  every region set for frames whose lower third is ground. **Apply §15.5's `sid < 2,900,000,000`
  pre-2023 filter and the builder's vanilla triage (native width ≤1366, then eyes on the fog wall) —
  both are proven and both must be re-used here.**

---

## F19 — `ui-combat/` is two-thirds menus, which double-counts against `REF-M22` and inflates `RI-UIX01`.

Of 12 files in `souls-behaviour/ui-combat/`, the `depicts` text identifies **eight as menu screens**:
title screen, options screen, equipment screen, storage box ×2, inventory ×2, covenant screen. Only
four are in-combat HUD.

A5 assigns `ui-combat/` to `RI-UIX01` (in-combat UI). Menus belong to `REF-M22` / `modern/ui`
(`RI-UIX06` F17–F19). The consequence is two errors pointing opposite ways: **`REF-M22`'s real
population is 8 + 8 = 16 across four games, not 8 across three** — which would move it from
"PASS at the floor" to comfortably passed — **and `RI-UIX01`'s is 4, not 12.**

One of the eight is worth calling out because R1 flagged it and it landed: the **DS3 status screen
with a live-rendered armoured character beside the attribute column** (`3670478265`). That one file
serves `REF-M22`, `stance/` and F7's armour-at-2 m need simultaneously. Good acquisition; wrong
folder.

**Classification: INFERABLE — free, a re-file plus a cross-reference.** No download.

---

## F20 — Morrowind's UI is catalogued at rest; its defining property is that it is *arranged*.

`REF-A12b`'s 33 files span **eight distinct resolutions**, 1152×864 to 1920×1080, in both 4:3 and
16:9. **That is genuinely good and I want to credit it** — `RI-UIX06` **F18** (scaling and layout
integrity) is a claim about the same interface at two different resolutions, and this set can support
it. What is missing is only the *pairing*: no field records "this is the same window as that one, at
a different resolution", so the comparison has to be rediscovered by eye every time. **Record a
`ui_resolution_pair` id and F18 is served.** That is a one-pass annotation, not an acquisition.

What genuinely is not there is **the UI mid-use**. R1's F5 established that Morrowind's interface is
a user-arranged, resizable, simultaneous tiling, and §15.2 claims eight multi-window frames — but
**the catalogue records no such sub-kind** (H9), so the claim is unverifiable from the data. Beyond
that, nothing in the set shows a window *being* dragged or resized, a scrollbar part-way down a long
topic list, a tooltip *over* an inventory item, or the inventory in a partially-full state. `RI-UIX03`
owns inventory and the pause rule; `RI-UIX06` §A1 wants ≥6 of nine materials across the assembled UI.

**Classification: SUBSTITUTABLE.** The static tiling frames serve the density and material questions.
Record the `multi_window` sub-kind so F5 is checkable, add the resolution pairing, and move on. **Do
not spend a round hunting for a screenshot of a drag in progress** — people do not photograph that,
and this has now been open long enough that keeping it BLOCKING would violate A3.

---

## F21 — The set has weather and time-of-day **states**, and no **transitions** — but it is sitting on an unexploited labelled dataset.

`REF-M14` rain, `REF-M20` fog, `REF-M21` overcast each name one image. R1's F11 correctly classified
weather scarcity as INFERABLE. What neither round has asked is the *transition* question, and it is a
different question: how a sky moves from clear to overcast, how the light rotates through dusk,
whether our renderer's transitions are continuous or steppy. Nothing in a set of independent stills
can answer it.

**Here is the unexploited asset.** The Witcher 3 interval-run frames **print the game clock and the
weather state in the frame**: I read `10:04 AM / CLEAR` off `t0007` and `11:17 AM / CLEAR` off
`t0305`. The filenames are elapsed seconds, and they run `t0000` to `t3197` — **53 minutes of real
time, in one continuous session, with ground-truth time-of-day and weather stamped in every frame.**
That is a labelled temporal dataset and nothing in the corpus uses it. It is enough to fit a measured
time-of-day → metric curve for one game, which is exactly the *basis* R1's F11 needed to make the
overcast inference `derived` rather than asserted.

The limit is honest: 53 minutes of game clock spanning 10:04 → 11:17, all `CLEAR`. It cannot serve
dusk or overcast. But it establishes the **method**, and the same source
(`elfhuo-github/sksebp-og.github.io`) is already vendored and may hold other runs.

**Classification: INFERABLE.** No download. Read the in-frame clock and weather off all 24 into
`capture_time_of_day` and `capture_weather`, and use the resulting curve as the basis for `REF-M21`'s
`derived` band. **The specific extra search, if a real transition series is wanted:** a Steam user
screenshot showcase filtered by app, sorted by upload time — §15.5 already proved `publishedfileid`
is monotonic in time, which makes "consecutive uploads by one user in one session" a *findable*
object rather than a hopeful one. That is also the answer to the interval-run gap in
`exterior_lowlight` and `interior_darkemissive`, which has now been restated twice without a method.

---

## F22 — There is no reference for enemy placement, first-sight distance, or sightlines.

`RI-AI06`: the arena is part of the moveset, spacing behaviour is only meaningful in a legible space.
`RI-AI02`: telegraph legibility **at combat distance**. `RI-WLD06`: markerless navigation.
`RI-WLD07`: verticality and interiors.

`arena/`'s 14 frames answer *"what does the fighting space look like"*. Not one answers *"from where,
and at what distance, does the player first see the enemy"* — which is the placement question, and
the one that decides whether a fight is readable before it starts. Every combat frame in the corpus
is taken **inside** an engagement, because that is when people press the screenshot key.

**Classification: SUBSTITUTABLE, low priority.** `arena/`'s wide framings partly serve it, and two of
them ("player at a parapet looking across a colonnaded ruin toward the next arena", "an open arena
floor among ruined columns with several enemies spread across it") are close to exactly right. Tag
those two `serves: RI-AI06 placement`, add `searchText=ambush`, `mimic`, `first time seeing` to any
future souls harvest, and do not block on it.

---

## F23 — Nothing in the set records viewing distance, so no "legible at combat distance" claim can be checked.

`RI-AI02`'s bar and `RI-VIS08`'s creature-design seam both turn on **angular size**: a silhouette
that reads at 8 m may be mush at 20 m, and a texture that reads at screenshot distance may be
invisible at play distance. The corpus has `width`, `height`, `depicts` — and **no field for subject
distance, subject pixel height, or the fraction of frame height the subject occupies.**

`REF-M6` even states its own constraint in those terms — *"40–70% of frame height"* — and **no record
carries the number**, so that clause has never been checked on any file.

This is R1's F9 in a new place: a constraint that is not a search problem and that more images will
never fix. The fix is one computed or eyeballed field.

**Classification: INFERABLE — a field, not a download.** Add `subject_frame_fraction` (0–1) to every
record in `character_closeup`, `souls-behaviour/telegraph`, `souls-behaviour/attacks` and
`souls-behaviour/camera`. Set by eye at a coarse three-level scale if measuring is too slow. Then
`REF-M6`'s 40–70% rule, `RI-AI02`'s combat-distance bar and `RI-CAM01`'s framing geometry all become
filterable instead of asserted.

---

## F24 — `RI-VIS07`'s naming test needs "Dark Souls" and "Elden Ring" added, by A6's own argument.

A6 reasoned carefully about a real risk: handing builders ESO imagery invites convergence on ESO's
Black Marsh, so **"add ESO to `RI-VIS07`'s forbidden answers"**, and the builder correctly recorded
that on all 23 `context/` records.

The identical argument now applies with more force to a larger set. **93 Dark Souls frames were just
added to a builder-facing reference tree**, and A5 rule 2's guard — *"cited by combat, camera and
weapon critics, never by the fidelity or art-direction critics"* — protects the *critics*. It does
nothing about a builder who has been looking at 91 DS3 screenshots and reaches for a gothic-cathedral
silhouette, a grey-brown palette and a fog gate. Our art direction descends from Morrowind. A fresh
judge shown our screenshot must not answer "Dark Souls" any more than they may answer "Skyrim",
"Witcher" or "ESO".

**Classification: INFERABLE — an amendment, no acquisition.** Add `Dark Souls` and `Elden Ring` to
`RI-VIS07`'s forbidden answers and put the same `admissibility_note` on all 93 souls records that
`context/` already carries. **This costs nothing and it is the cheapest insurance in this document.**

---

## F25 — `context/` reads PASS on count and is missing two of A6's six named subjects.

23 files, five subject kinds, and the `depicts` text is good — two Hist records explicitly note scale
against a human reference (*"figures resting beneath Hist trees in mist, giving the trees scale"*),
which is the thing the brief asked whether anyone had thought about. **They had. Credit where due.**

Against A6's six named subjects:

| A6 subject | Files | Verdict |
|---|---:|---|
| **xanmeer ziggurats** (stepped, half-sunk, vine-taken) | **2** | **FAIL** — "a curved carved stone form" and "cut stone blocks half-taken by the marsh". Neither is a *stepped ziggurat*, which is the defining form. A6 lists it **first**. |
| Hist trees at scale | 6 | **PASS**, including two with human scale |
| Argonian settlement architecture | 7 | **PASS** |
| marsh vegetation and water | 4 | PASS |
| **naga** and Argonian character design | 4 Argonian, **0 naga** | **PARTIAL** |
| **root-tunnel interiors** | **0** | **FAIL — zero** |

§15.6 reports that Steam app 306130's listing returned zero cards for every query, which I accept.
**The specific unrun search is therefore not Steam.** ESO's own wiki runs on the same MediaWiki
software as the two wikis verified in F12: **`en.uesp.net` is 403 (its own bot protection, per the
agent protocol) but `elderscrolls.fandom.com/api.php` is the same Fandom stack that returned 200
twice for me today.** Query `list=categorymembers` for `Category:Online-Places-Murkmire`,
`Category:Online-Murkmire`, `Category:Online-Argonians`, and `prop=images` on the pages
`Online:Xanmeer`, `Online:Murkmire`, `Online:Lilmoth`. **Root tunnels: `Online:Vakka-Bok Xanmeer`,
`Online:Root-Whisper Village`.** That is a specific, unrun, verified-stack search.

**Classification: SUBSTITUTABLE.** `context/` is builder reference, cited by no critic, and A6 put it
at mid priority. Two missing subjects out of six on a folder that already passed its count does not
hold a round open — but a builder asked to draw a xanmeer today still has no picture of a stepped
ziggurat, which is the exact failure A6 was written to prevent.

---

# 3. Gap register — every gap, classified per A3

IDs are `R2C-*`. Where a round-1 gap persists I say so and give its age, because **A3 forbids
BLOCKING past three rounds.**

| ID | Gap | Class | Specific search / resolution |
|---|---|---|---|
| **R2C-01** | No temporal reference anywhere. `video/` empty. `RI-WPN01`–`05`, `RI-AI02`, `RI-CAM01`/`03`, M11, M12 uncalibrated. **(F12)** | **BLOCKING — round 2, route proven today** | `https://eldenring.fandom.com/api.php?action=query&list=categorymembers&cmtitle=Category:Images%20-%20Animated%20gifs&cmlimit=500&cmtype=file&format=json` (31 files, HTTP 200) and the DS equivalent `Category:Dark%20Souls:%20Boss%20Attack%20Animations` (12 files, HTTP 200). Resolve with `&prop=imageinfo&iiprop=url|size|mime|metadata` — **`metadata` carries `frameCount` and `duration`**. Bytes arrive as animated WebP; in-policy under A5 rule 3 only. Destination `souls-behaviour/anim/`. |
| **R2C-02** | `V1-dolly` / `V2-static` proper. **(F12 secondary)** | **SUBSTITUTABLE → reclassified from BLOCKING (age 2)** | R2C-01 serves the *purpose*; only V1's LOD-pop measurement is lost. If the project still wants true video: `gamersyde.com` (HTTP 200) publishes own-capture high-bitrate MP4 for direct download; links need a free account and are JS-injected. **Do not hold round 3 open for this** — record the LOD-pop bar as `derived` and state the risk. |
| **R2C-03** | `exterior_lowlight` 8/12 and `interior_darkemissive` 3/10 countable. **(F13)** | **INFERABLE — reclassified from BLOCKING (age 2). The builder's source diagnosis is refuted.** | **No download.** Make `block_score` exposure-relative or gate dark profiles on `jpeg_quality_est` + `bytes_per_pixel`. Calibration table is in F13. Optional lossless anchor set: `deadendthrills.com/wp-content/gallery/bigsamples/*.png` (verified 200, 2560×1440–3840×2160 PNG, dark frame scores 0.998) — **art-directed photo mode, so a small anchor set only, never the bulk of a profile.** |
| **R2C-04** | `exterior_lowlight` / `interior_darkemissive` interval-run at 0%. | **BLOCKING (age 2) — but now with a method** | §15.5 proved Steam `publishedfileid` is monotonic in time. Therefore: fetch one uploader's `/id/<user>/screenshots/?appid=<app>` showcase, sort by sid, and take runs of consecutive sids — those are one session by construction. That converts "find an unbiased series" from luck into a query. Apps 1245620 / 374320 / 489830 for night and cave. |
| **R2C-05** | A7: `REF-A21-regions`, `REF-A22-intraregion`, `REF-A23-ground` all absent. Four of nine regions have no representation at all. **(F18)** | **BLOCKING — round 1 for A7** | Steam app **22320**, `searchText=` `Ascadian`, `Bitter Coast`, `West Gash`, `Grazelands`, `Ashlands`, `Molag Amur`, `Sheogorad`, `Azura's Coast`, `Red Mountain`. Ground set: `alchemy`, `ingredient`, `harvest`, `flowers`, `mushroom`, `plants`, plus eye-triage for a lower-third-ground frame in every region set. Re-use §15.4's vanilla triage (width ≤1366, then the fog wall) and §15.5's `sid < 2.9e9` filter. |
| **R2C-06** | No metric-validity distinction between fidelity and art direction; A7's inputs undefined. **(F18)** | **INFERABLE** | `make-manifest.py`: add computed `metrics_valid_for`. Enables both A7 and R2C-03's fix. |
| **R2C-07** | `has_hud` is a folder constant; 29 of 93 souls frames have no HUD. `RI-UIX01`'s population is ~10, not 93. **(F14)** | **BLOCKING (hygiene) — free** | No download. Set per file. My detector: fraction of pixels with `max−min > 55` and `max > 70` in the box `(0.03w, 0.03h)–(0.35w, 0.13h)`; `< 0.012` means no DS3 HUD. |
| **R2C-08** | No lock-on reticle and no status-buildup frame anywhere. `RI-UIX01` names both. **(F14)** | **BLOCKING** | Apps 374320 and 1245620, `searchText=lock on`, `lock-on`, `target`, `bleed`, `frostbite`, `scarlet rot`, `poison`. Triage by eye for the reticle glyph and a partially-filled status bar. |
| **R2C-09** | `souls-behaviour/` is 91/93 one game. A5 rule 5 asked for two. **(F15)** | **BLOCKING, cheap** | Steam app **1245620**, the same queries the DS3 harvest used. R2C-01's ER GIF category also fills `attacks/`, `stance/` and `anim/` with ER in one call. Target ≥⅓ per subfolder from a second title. |
| **R2C-10** | `character_closeup` is 9/13 cutscene camera; `REF-M6`'s rear-view rule effectively 3/13. **(F17)** | **BLOCKING, free** | No download. Eyeball the 24 W3 run frames (`t0305` verified rear, `t0007` verified side — **not a bulk copy**), cross-file the rear subset, and re-file the nine ER cutscene portraits out of the slot. |
| **R2C-11** | `REF-A3` (Telvanni) has no full-frame capture; the only such slot. | **BLOCKING (age 2)** | §15.6's own next step, unrun: app 22320, `searchText=tel vos`, `tel branora`, `mushroom tower`, `tel aruhn`, at ≤1366 native width. |
| **R2C-12** | `material_closeup` 5 countable of 8. | **SUBSTITUTABLE (age 2)** | R2C-03's threshold fix alone takes this to 7–8 without a download. If still short, `deadendthrills.com` PNG is *legitimate here* — a surface study is properly posed, so photo-mode curation costs nothing in this slot. |
| **R2C-13** | 20 of 21 `REF-M*` slots formally unfilled; 83 of 131 modern records `slot: null`. **(H3, age 2)** | **BLOCKING (hygiene) — free** | No download. Assign real slot ids; list by name any slot that stays unfilled. |
| **R2C-14** | Ghost manifest record for a deleted 3.3 GB video; `acquire.py --check` claim is stale. **(H6)** | **BLOCKING (hygiene) — free** | Remove or mark the record `evidence_only: true` with the source URL retained (the source *should* stay catalogued — that part was right). Re-run `--check` and restate the true pass count. |
| **R2C-15** | Two `side` strings for one side; two `game` strings for Morrowind. **(H7)** | **BLOCKING (hygiene) — free** | Normalise. Any per-side or per-game query is currently wrong. |
| **R2C-16** | No record outside the souls axis names the `RI-*` item it serves. **(H10)** | **INFERABLE** | Add `serves: [RI-…]` to `modern/` and `morrowind/` records, following the souls axis's own good example. |
| **R2C-17** | Interval run is 56% of `exterior_daylight` and is the anti-generic negative-anchor location. **(F16)** | **INFERABLE — computation rule, no download** | Cap any one series at `1/locations` of band mass. **And report `exterior_daylight`'s bands computed with and without the 24** — if the delta is small this closes for free. |
| **R2C-18** | No `subject_frame_fraction`; `REF-M6`'s 40–70% rule has never been checked on any file. **(F23)** | **INFERABLE — a field** | By eye at three levels if measuring is slow. Applies to `character_closeup`, `telegraph`, `attacks`, `camera`. |
| **R2C-19** | `ui-combat/` is 8/12 menus; `REF-M22` undercounted, `RI-UIX01` overcounted. **(F19)** | **INFERABLE — re-file** | Free. |
| **R2C-20** | `context/`: 0 root-tunnel interiors, 0 naga, 2 weak xanmeer. **(F25)** | **SUBSTITUTABLE** | `elderscrolls.fandom.com/api.php` (same stack verified 200 twice today): `list=categorymembers` on `Category:Online-Places-Murkmire`, `Category:Online-Argonians`; `prop=images` on `Online:Xanmeer`, `Online:Vakka-Bok Xanmeer`, `Online:Root-Whisper Village`, `Online:Lilmoth`. |
| **R2C-21** | No weather / time-of-day **transition** reference. **(F21)** | **INFERABLE** | Free first: read `10:04 AM / CLEAR` style stamps off all 24 W3 frames into `capture_time_of_day` / `capture_weather` and fit the curve; that is the basis `REF-M21`'s `derived` band needs. Then R2C-04's consecutive-sid method for a real dusk series. |
| **R2C-22** | Morrowind UI mid-use; multi-window sub-kind unrecorded. **(F20, H9)** | **SUBSTITUTABLE — closing** | Record `ui_subkind: multi_window` and `ui_resolution_pair`. **Do not search for a drag-in-progress screenshot.** |
| **R2C-23** | No enemy-placement / first-sight-distance reference. **(F22)** | **SUBSTITUTABLE, low** | Tag the two `arena/` wide frames that already serve it; add `ambush`, `mimic` to any future harvest. |
| **R2C-24** | `RI-VIS07` naming test lacks `Dark Souls` / `Elden Ring`. **(F24)** | **INFERABLE — amendment** | Free. |
| **R2C-25** | Frame-exact hitstop calibration (`RI-WPN05`, 2 f vs 8 f). | **IMPOSSIBLE — confirmed, but the bar rises** | R1 accepted this and I uphold it for 16.7 ms. **But R2C-01 delivers ±70 ms**, so the bar should be set at 70 ms and at *ordering*, not abandoned. **This must be written into `RI-WPN05` itself, not just noted in a critique.** |
| **R2C-26** | `REF-M19` within-frame near/far water; §5a foreground/sky. | **INFERABLE — closed** | §15.6's `foreground_present` / `sky_visible` booleans are the right fix and are in place. **I consider R1's F9/R1C-17 discharged.** |
| **R2C-27** | `REF-A12` as images. | **IMPOSSIBLE — accept and close** | OpenMW MyGUI XML is structure, not pixels, and `REF-A12b` now supplies the pixels. Delete the expectation that A12 holds images; it is not a gap, it is a different artifact. |

**Reclassified downward this round, as A3 requires:** R2C-02 (BLOCKING → SUBSTITUTABLE), R2C-03
(BLOCKING → INFERABLE), R2C-12 (BLOCKING → SUBSTITUTABLE), R2C-22 (BLOCKING → SUBSTITUTABLE, and
closing), R2C-26 (closed), R2C-27 (closed).

---

# 4. Ranked work list for the round-2 builder

Ranks 0–2 involve **no downloads at all** and should be finished before anything is fetched.

| Rank | Work | Why here | Gaps |
|---|---|---|---|
| **0** | **Repair the four folder-constant / ghost defects.** `has_hud` per file; one `side` string; one `game` string per game; remove the ghost video record and restate `--check`. Assign real `REF-M*` slot ids. | Every count in circulation depends on these, `RI-UIX01`'s population is currently overstated by 9×, and A1's HUD mask is being applied to frames with no HUD. Nothing here costs a byte of bandwidth. | R2C-07, 13, 14, 15 |
| **1** | **Fix `block_score`.** Make it exposure-relative (or gate dark profiles on `jpeg_quality_est` + `bytes_per_pixel`), add `metrics_valid_for`, and re-score. | This is the stated binding constraint on the whole modern side and it is a threshold bug, not a source problem. It should take two profiles from 8 and 3 countable to roughly 18 and 14. **Do this before spending a single fetch on press kits.** | R2C-03, R2C-06 |
| **2** | **The other free re-files.** Cross-file the rear-view subset of the 24 (eyes on each), re-file the 9 ER cutscene portraits, re-file the 8 menus out of `ui-combat/`, tag the 2 placement frames, read the in-frame clock/weather off the 24, add `subject_frame_fraction` and `serves`. | Six findings discharged with no acquisition. F17 and F19 both move a floor. | R2C-10, 16, 17, 18, 19, 21, 23 |
| **3** | **`souls-behaviour/anim/` from the two wiki APIs.** ~43 named-move animations, with `frame_count` and `duration_s` from `iiprop=metadata`. | **The single highest-value acquisition available.** It converts an axis the project had written off as IMPOSSIBLE into a measured one, serves `RI-WPN01`–`05` and `RI-AI02` directly, and simultaneously puts Elden Ring into a folder that is 91/93 one game. Two URLs. | R2C-01, R2C-09 |
| **4** | **A7's three sets** — `REF-A21-regions` (9 regions × 4–6), `REF-A22-intraregion` (2 × 6–8), `REF-A23-ground` (≥1 × 9). | The user's newest direction and the only amendment with **zero** acquisition against it. Four of the nine regions have no image anywhere in the corpus. Depends on rank 1's `metrics_valid_for`. | R2C-05 |
| **5** | **Elden Ring into the souls axis**, plus the lock-on and status-buildup search. | A5 rule 5, and two HUD elements `RI-UIX01` names by hand that no search has ever targeted. | R2C-08, R2C-09 |
| **6** | **Interval-run series for `exterior_lowlight` and `interior_darkemissive`**, via the consecutive-sid method. | Restated twice without a method; now it has one. | R2C-04 |
| **7** | `REF-A3` Telvanni full-frame; `material_closeup` top-up (probably unnecessary after rank 1); `context/` root tunnels and a real xanmeer via the Fandom API. | Real, small, all with named searches. | R2C-11, 12, 20 |
| **8** | **Write the reclassifications into the reference items themselves**, not into a critique: `RI-WPN05`'s bar at 70 ms and ordering; `REF-M21`'s band as `derived`; `RI-VIS07` gains `Dark Souls` and `Elden Ring`; `REF-A12`'s image expectation deleted. | A3: an accepted IMPOSSIBLE that is only recorded in a critique is still a permanent fail in the corpus. **This is the step both previous rounds skipped.** | R2C-24, 25, 27 |

---

# 5. Rulings

## 5a. The builder's three flagged-reversible judgements

### Ruling 1 — the `exif_software: "ACDSee Ultimate 8"` promotion of the 24 Witcher 3 frames. **UPHELD on integrity. QUALIFIED on weight.**

§8a says an editor in `exif_software` is a rejection. That rule exists as a **proxy for degradation**,
and here the degradation can be measured directly and is absent: I re-measured
`run-w3nextgen-t0007.jpg` myself and got `block_score 0.9868` — **the lowest in the entire corpus**,
against a Steam median of 1.16 for the same profile. Every one of the 24 sits at 0.99–1.01. A direct
measurement supersedes a proxy for that measurement. ACDSee was used as a batch converter, not an
editor. **Keep them, keep the `integrity_flag` verbatim as the builder did — that transparency is
what makes the promotion defensible.**

**But** the promotion carries a cost nobody priced: those 24 are one location, all `CLEAR` mid-morning
Novigrad, and they are 56% of the profile they now dominate — and Novigrad is `anti-generic/`'s
negative anchor. **Apply the weighting rule in R2C-17 and report the band delta with and without
them.** The free win was real; it was not free of consequences.

### Ruling 2 — three-valued vanilla tests, `null` for interior `REF-A12b` captures. **UPHELD, with one addition.**

V1 (grass), V2 (distant land) and V4 (water reflections) are literally unevaluable in an interior.
Recording `null` with a `vanilla_tests_note` is more honest than `unknown` and it is exactly A3's
reasoning applied to a test rather than a slot. Reading §7 literally would have emptied the slot A2
calls the highest-value art-direction acquisition left. **This was the right call and it was
correctly flagged rather than buried.**

**The addition, and it is not optional:** 33 files are being admitted with **three of seven vanilla
tests voided and nothing put in their place**. A menu capture has a decisive vanilla test the outdoor
ones do not — **the UI chrome itself**. MGE XE, OpenMW and the popular UI replacers all change the
bevel, the panel colour and the font in visible ways. Add **V8: the UI chrome matches vanilla
Morrowind's bevel, panel colour and type**, and score all 33 against it. `REF-A12`'s MyGUI data
supplies checkable anchors — the dialogue window at 588×433 and `normal` text at RGB 202,165,96 —
with the caveat that OpenMW is a re-implementation, so treat those as corroboration, not ground
truth. **Without V8, `REF-A12b` is the least-verified folder in the corpus and it is the one the
whole art-direction UI transposition will be built from.**

### Ruling 3 — retaining 168 `corroboration: "one-host"` records. **SPLIT: upheld for the non-band axes, REVERSED for band-setting records.**

§8b exists to stop an unverified image from setting a `[p10,p90]` band. That risk is **zero** for
records that can never enter a band, and `souls-behaviour/` (93, `pixel_metrics_valid: false`,
`forbidden_for: [fidelity-bands, art-direction-judgement]`) and `context/` (23, same) cannot. **Keep
them. The deviation is well-reasoned and well-recorded.**

It is **not** zero for the 36 records that are both `one-host` **and** `pixel_metrics_valid: true` —
those are, by definition, the records that set the bands, and §8b's entire purpose is to stop exactly
that. They are: 24 W3 interval-run frames, 5 in `combat`, 4 in `material_closeup`, 2 in
`interior_darkemissive`, 1 `REF-M6`.

**In practice this is much less painful than it sounds.** The 24 W3 frames are not Steam at all —
they come from a GitHub-hosted mirror with a stated capture provenance, and §8b's "one-host" label is
simply the wrong bucket for them; re-label, do not remove. That leaves **12 genuinely
weakly-corroborated band-setting records**. For each: fetch the Steam detail page and read the
printed date (§15.5's method, 95 records already done this way), or drop the record from band
computation while keeping it for composition. **Twelve pages at one request per 4 s is under a
minute.**

## 5b. The builder's five filed amendments

| # | Amendment | Ruling |
|---|---|---|
| **1** | A5 gains `arena/` and `death/` | **ADOPT as filed.** Both were my predecessor's findings F3/F4, both were built, and `death/` in particular found the right query (`bloodstain`, not `you died` — §15.8 is the best single paragraph in the report). **Add one more: `anim/`**, per F12. |
| **2** | §5e gains a framing floor: *full frame, native aspect, uncropped* for `refs/morrowind/` | **ADOPT as filed**, with one clause: **the 84 superseded crops must be excluded from every count.** They are currently 84 of the 449 headline number and they are, by the amendment's own logic, not references. Keep the files, keep `superseded_by`, exclude from counts. |
| **3** | §7 gains a three-valued vanilla test (`true`/`false`/`null`) | **ADOPT**, conditional on **V8** per ruling 2. Adopting the `null` without adding a replacement test is where this becomes a loophole. |
| **4** | §8b gains a fourth corroboration category for post-2023 dated Steam apphub uploads | **ADOPT, NARROWED.** Name it `dated-apphub` and permit it **only** for records that never enter a band — i.e. `pixel_metrics_valid: false` **and** a `forbidden_for` list. Any record that sets a `[p10,p90]` band must still satisfy one of §8b's original three. Otherwise the amendment repeals the rule it is amending. |
| **5** | `RI-VIS07`'s naming test gains "ESO" | **ADOPT, EXTENDED** — add **`Dark Souls`** and **`Elden Ring`** for the reason in F24, and put the same `admissibility_note` on all 93 souls records. A6 identified this risk precisely and then the project created a larger instance of it in the same round. |

---

# 6. Verified this round — routes and dead ends

**New working routes, all tested today:**

| Route | Result |
|---|---|
| `eldenring.fandom.com/api.php` `Category:Images - Animated gifs` | **200, 31 files.** Four `ER Moveset … Longsword` clips, 11 `ER Skill Quickstep …`, `Bloodstain rogier.gif`, 5 enemy Ash-of-War clips. **Never previously searched by anyone.** |
| `darksouls.fandom.com/api.php` `Category:Dark Souls: Boss Attack Animations` | **200, 12 files**, named per move. R1 found it; nobody used it. |
| `&prop=imageinfo&iiprop=metadata` on a Fandom GIF | **Returns `frameCount` and `duration`.** Verified: 81 frames / 5.67 s = 14.29 fps. **This is what makes the temporal axis measurable despite the WebP transcode.** |
| `static.wikia.nocookie.net/.../revision/latest` | 200, 6,169,534 bytes, **animated WebP with `n_frames` intact and per-frame delays stripped**. Confirms R1's F2 caveat exactly. |
| `deadendthrills.com/wp-content/gallery/bigsamples/*.png` | **200. Lossless PNG, 2560×1440 and 3840×2160, 3–11 MB.** A dark frame (luminance 47.5) scores `block_score 0.998`. Art-directed photo mode — anchor set only. |
| `gamersyde.com` | **200.** Own-capture high-bitrate MP4 downloads, not YouTube. Links behind a free account and JS-injected. |

**Dead ends confirmed or added:**

- `imgsli.com` — **503**. Do not retry this round.
- `en.uesp.net` — still 403 (its own bot protection). **But `elderscrolls.fandom.com/api.php` is the
  same MediaWiki stack that answered twice for me and has not been tried.** That is the unrun ESO
  search.
- Everything in R1 §5 and in `ACQUISITION-CRITIQUE-R1-code.md` stands unchanged; I re-tested none of
  it and neither should the builder.

**One methodological note for whoever writes round 3.** Two of the four largest findings in this
document came from **re-measuring the pixels rather than reading the catalogue** — F13's confound and
F14's HUD constant were both invisible in `MANIFEST.json` and obvious in thirty lines of Pillow. The
catalogue is now good enough that the next critic's marginal value is in the bytes, not the JSON.
