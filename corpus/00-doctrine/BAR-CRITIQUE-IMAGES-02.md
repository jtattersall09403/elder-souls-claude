# BAR-CRITIQUE-IMAGES-02 — re-review of the reference-image request (v2)

**Critic:** bar-critic. **Date:** 2026-08-06.
**Artifact:** `docs/REFERENCE-IMAGE-REQUEST.md` v2 (24,899 bytes, 423 lines, commit `7dbf8b3`).
**Judged against:** my own BAR-CRITIQUE-IMAGES-01 — its 17 ranked changes and its 14 gate
conditions — not against a fresh set of opinions.

---

# 1. VERDICT: **INSUFFICIENT**

This is a large, good-faith rewrite and most of it landed. Thirteen of seventeen changes are in,
eight of the fourteen gates are met, and the two hardest ones — the byte-integrity mandate (§4) and
the per-folder count floors with the anti-curation rule (§3) — are present in substance and in
force. The priority block at the top is exactly the right instrument. If I were grading effort this
would pass.

It is INSUFFICIENT for four specific reasons, three of which are *new*, created by the rewrite:

1. **§3's interval-run rule now contradicts §4 and §8a and is impossible in three of the six
   folders.** If the "unbiased run" is a video, extracting frames means the agent *creates* a file
   (breaking rule 1) whose codec artefacts §8a then rejects. If it is a screenshot series, it
   cannot produce material close-ups or 40%-of-frame character shots by construction. Half of every
   modern folder is specified by a rule the document elsewhere forbids obeying. This is my defect
   as much as the orchestrator's — v1's Rank 2 and Rank 3 contained the same collision and v2
   inherited it without the guard sentence that had been holding it apart.
2. **§8a states no numeric thresholds**, so the automatic rejection is not automatic; `upscale_test`
   is defined circularly and is not implementable as written; and the §9 exemplar record carries
   `nyq_ratio: 0.031` on a `modern/` file, which §8a says is grounds for rejection. The exemplar
   would reject itself.
3. **§8b was downgraded from a gate to a label.** v1: an image corroborated by none of
   first-party / two-hosts / pre-2023-page is not committed. v2: `"corroboration": "none"` is an
   allowed value and "single-source images are kept but flagged". That is the only check in the
   document that catches a clean-looking generated landscape, and it has been turned off.
4. **The stop condition was inverted.** Rank 15 asked for an *abort* rule — stop and report rather
   than pad a shortfall with degraded copies. §10 now contains a *completion* rule — stop when
   everything is full. Nothing forbids padding. Combined with the scope problem in §5 below, padding
   is the predicted failure mode of this run.

Everything else is a one-paragraph fix and I have written the paragraphs. There is no structural
rework left: the shape of v2 is right.

---

# 2. Change-by-change

| # | Change | Applied? | Evidence in v2 | Verdict |
|---|---|---|---|---|
| 1 | Byte-integrity mandate; cut JPEG-q90 and 1920×1080 clauses | **Applied** | §4 "File integrity — the single most important section": exact bytes, no conversion/resize/crop/metadata-strip, follow "view original", `curl -O` not a browser screenshot, no resolution minimum in `morrowind/`, "prefer native captures … do not chase it". Both offending clauses gone (`grep`: no q90, no "1920×1080 minimum"). SDR-only relocated to §5a/§6. | Faithful. Two sub-rules dropped: the `bytes_per_pixel < 0.5` mechanical recompression test (replaced by the weaker "if the only copy is *visibly* recompressed") and the `provenance_chain: rehosted` instruction. See ND10. |
| 2 | Count floors + anti-curation rule; cut "ten beat two hundred" | **Applied** | §3 carries the floor table verbatim (12/12/10/10/8/8, distinct games, distinct locations), the anti-curation paragraph, `run-<slug>-t<seconds>` naming, `"sampling"` field, Morrowind 3–5 per slot. Rule 4 of the priority block: "Count matters as much as correctness." `grep`: "two hundred" absent. | Faithful in text. But see ND1 — the rule as scoped cannot be obeyed. |
| 3 | `refs/video/` for temporal properties | **Partial** | §5b exists: 4–8 clips, 20–60 s, four clip types as bullets, "downloaded as-is", `"pixel_metrics_valid": false` with the inter-frame-codec justification, plus the good new sentence that frame-exact temporal calibration is a recorded known limit. | Substance kept, enforcement thinned. Clip IDs (`V1-dolly`…`V4-combat`) dropped, so §10's per-slot table has nothing to report against; **"no cuts" dropped**, and a montage passes as a dolly clip while being useless for LOD-pop; the required per-clip metadata list reduced to "source URL and any stated bitrate". |
| 4 | Eleven new fidelity slots + amend REF-M3 | **Partial** | §5a runs REF-M1..M7, M9..M20. M9 W3 Crookback ✔, M10 Hjaalmarch ✔, M11 Aeonia ✔, M12 Bayou Nwa ✔, night ✔ (M13), weather ✔ (M14), combat ✔ (M15), materials ✔ (M16), plus useful additions M18 (spell VFX → F16) and M20 (fog). | Three losses. **Horizon Forbidden West dropped** (four engines survive, so tolerable). **REF-M19 gutted** — "camera low, so one frame contains near water seen steeply and far water at a grazing angle" became "a shoreline / shallow water edge where water meets land", which is the generic shot the slot existed to *not* be. **The diffuse/overcast-noon reference lost its slot ID**, demoted to a sub-clause of M3 ("Also get an overcast-noon Skyrim exterior") — uncountable, unreportable, uncitable. |
| 5 | Restructure; priority block; §1–§10 numbering | **Applied** | Lines 30–53: ten numbered rules. §1..§10 all present; every cross-reference resolves (rule 4→§3, 5→§3, 6→§7, 8→§8; §2→§5b/§5c/§5d). | Faithful. One loss: the triage line — "if you run out of time, satisfy rules 1–5 on fewer slots rather than rules 6–10 on more" — was cut. That is the sentence that shapes a partial delivery, and this delivery will be partial. See ND5. |
| 6 | Nine new art-direction slots + REF-A6 → four creatures | **Partial** | §5e runs REF-A1..A17. A9 Velothi ✔ (kept my "most important row in this table"), A10 flora ≥4 ✔, A11 Bitter Coast as its own slot ✔, A12 UI ✔, A13 armour/clothing + A14 weapons + A15 books/Daedric ✔ (a sensible three-way split of my A13/A12), A16 silt strider ✔, A6 → "at least four separate images" ✔. New A17 (Imperial fort/Census interior) is a good addition. | Two rows dropped outright: **the dusk-or-night Morrowind exterior** and **the stilted/waterside settlement**. All seventeen A-slots are now daylight, against a palette spec that declares dusk and night targets; and our fen villages are specified as "stilted lashed" with nothing in the set showing that vocabulary. The Telvanni *interior* also vanished, so "three interiors of three vocabularies" rests on A4 + A17 + a maybe from A7. |
| 7 | Mechanical verification, committed script | **Partial** | §8a script with the full field list (incl. `has_alpha`, `jpeg_quality_est`, `exif_software`, `c2pa_present`) ✔; 8c three named features with rejection ✔; 8d human look last ✔; promotional/photo-mode screening relocated to §5a and §6 ✔. | **Misses the point in two places.** (a) No numeric thresholds anywhere — "near zero", "high" — and `upscale_test` defined as "ratio of high-frequency energy to what the stated resolution implies", which is not an algorithm. (b) 8b turned from a gate into a label. Also dropped: `upscaler` (DLSS/FSR/XeSS) recording, which matters because reconstruction alters precisely the `nyq_ratio` this section rejects on; and the `photo_mode` / `photo_effects_disabled` fields. |
| 8 | Seven mechanical vanilla tests | **Applied** | §7 carries V1–V7 verbatim in substance, the OpenMW ruling with both `engine` values, "no resolution minimum, larger is not better", and the `unconfirmed/` fallback. | Faithful. Best-applied change in the document. |
| 9 | Framing and comparability | **Applied** | §6: 16:9, normal FOV, foreground present, sky visible for exteriors, no photo-mode effects, SDR, reject ultrawide/telephoto/top-down, and "**The light decides the folder, not the slot label**". | Faithful in rules. Weakened in record-keeping: `aspect_mismatch`, `foreground_present`, `sky_visible` are gone from §9, so no downstream consumer can filter on them. |
| 10 | Fix output paths; reserve `refs/anti/` | **Applied** | §2 is the layout verbatim, ending with "`refs/anti/` is reserved for a file our own harness generates. Do not create it and do not write into it." All six profile folders + `hud/`, `unconfirmed/`, `anti-generic/`, `context/`, `video/`, `rejected/`. | Faithful. One omission: `LICENCE-NOTE.md` is required by §9 but is not in the §2 tree, which says "use exactly this, invent nothing". |
| 11 | REF-M6 must be the character from behind | **Applied** | §5a REF-M6 row, near verbatim including "**Not** an equipment-menu render, not a turntable, not a front portrait" and "at least half this folder must be back or three-quarter-rear views". | Faithful. |
| 12 | `anti-generic/` negative anchor | **Applied** | §5c, 4–6 images, the five archetypes, "the thing we measure ourselves *away* from. Never cited as a target." | Faithful. `"side": "anti-generic"` marking dropped — tolerable, since rule 3 makes the folder the enforcement, but the `side` field in §9 now has no defined vocabulary. |
| 13 | ESO Shadowfen/Murkmire in `context/` | **Applied** | §5d, 6–10 images, both the not-fidelity and not-art-direction arguments intact, and the payload sentence "so we can deliberately not converge on it". | Faithful. `"side": "context-neither"` and `forbidden_for` dropped; same note as above. |
| 14 | Rewrite the manifest record | **Partial** | §9 carries the record with `identified_by`, `corroboration`, `sampling`, `profile`, `nyq_ratio`/`upscale_test`/`block_score`, `c2pa_present`, `pixel_metrics_valid`, `vanilla_tests`, `engine`, `sha256`, and "Script-produced numeric fields must come from the script, not from you". `licence_note` correctly replaced by a single `LICENCE-NOTE.md`. | **`modified_by_me` dropped** — the one per-file assertion of rule 1, and the cheapest anti-tampering device in the document. Also dropped: `has_alpha`, `jpeg_quality_est`, `heavily_recompressed`, `photo_mode`, `upscaler`, `aspect_mismatch`, `foreground_present`, `sky_visible`. `provenance_chain` survives in the exemplar but is defined nowhere in the prose. |
| 15 | Rejection log + stop condition | **Partial** | §10 items 1–5 are all there and item 3 keeps my justification for the rejection log verbatim. Copyright position correctly moved to `LICENCE-NOTE.md`. | The **stop condition was inverted**: "when every folder meets its floor and every slot is filled or reported, stop" is a completion rule. The abort/anti-padding rule is absent. §4's "if a whole folder can only be filled with degraded copies, say so" is a partial substitute and does not cover the case that matters (a *quarter* of a folder padded). |
| 16 | Six cuts, three do-not-cuts | **Applied** | All six cuts made (`grep`: no "two hundred", no q90, no "photo mode is ideal", no `alt1`, no per-record `licence_note`; `capture_date` retained as "or unknown", i.e. demoted). All three do-not-cuts survive: §1 two-axis explanation, the repo/branch + "do not modify any file outside `corpus/70-visual/refs/`", and the closing anti-fabrication paragraph. | Faithful. |
| 17 | Corpus-side amendments (orchestrator, not prompt text) | **Not applied** | `RI-VIS02:42` still reads "image files are not vendored into this repo (copyright)". RI-VIS02 still defines only REF-M1..M8; REF-M9..M20 exist nowhere in the corpus. `grep -rn "REF-A[0-9]" corpus/70-visual/` returns nothing — the entire REF-A series is prompt-invented. The pairing table still maps `combat_midfight` → `REF-M6 + REF-M2`. | Outstanding. **Does not block the run** — Codex reads only the prompt — but items 1 and 2 must land before anyone reads the delivered set, or the manifest will cite IDs no item defines while sitting in a repo whose own doctrine says these files are not vendored. |

**Score: 9 applied faithfully, 6 partial, 1 missing the point in part (Rank 7's 8b), 1 not applied
(Rank 17, orchestrator-owed).**

---

# 3. Gate conditions

| Gate | Met? | Note |
|---|---|---|
| **G1** byte-integrity mandate; both offending clauses gone | **MET** | §4. `bytes_per_pixel` floor and the rehosted rule dropped; not gating. |
| **G2** hard floor table + "ten beat two hundred" gone | **MET** | §3 table exact. |
| **G3** anti-curation rule, `run-` naming, `sampling` field | **MET** (unworkable as scoped) | §3. Present in text; see ND1 — it must be scoped to three folders and to native screenshot series. |
| **G4** `refs/video/` with dolly/static/locomotion/combat and `pixel_metrics_valid: false` | **MET** | §5b. IDs and "no cuts" should be restored (ND13) but the gate as written is met. |
| **G5** diffuse noon; night; weather; combat; ≥5 material surfaces; low shoreline with both water angles; ≥5 wetlands from ≥4 engines | **NOT MET** | Night ✔ (M13), weather ✔ (M14), combat ✔ (M15), materials ✔ (M16 names six surfaces), wetlands ✔ (M4, M9, M10, M11, M12 across RAGE / REDengine / Creation / FromSoft = 4 engines). **Diffuse noon has no slot** (sub-clause of M3). **The shoreline two-angle requirement is gone** (M19). |
| **G6** REF-M6 back / three-quarter-rear, menu renders excluded | **MET** | §5a REF-M6. |
| **G7** ten art-direction additions incl. dusk-or-night and stilted settlement | **NOT MET** | Eight of ten present. **Dusk-or-night Morrowind exterior absent. Stilted/waterside settlement absent.** "Three interiors of three vocabularies" is weakened — the Telvanni interior is gone. |
| **G8** mechanical verification with stated rejection thresholds, three-way corroboration, `identified_by`, eyes last | **NOT MET** | Script ✔, fields ✔, `identified_by` ✔, eyes-last ✔. **No numeric thresholds** and `upscale_test` unimplementable. **Corroboration is a label, not a gate**, and `first-party` / `pre-2023-page` are not in the enum. |
| **G9** seven vanilla tests, `vanilla_tests`, OpenMW, no resolution minimum | **MET** | §7, fully. |
| **G10** framing rules + upscaler recorded + light-decides-folder | **NOT MET** | Framing rules ✔, light-decides-folder ✔. **`upscaler` is absent from the whole document** — DLSS/FSR/XeSS reconstruction is not mentioned once, and it alters `nyq_ratio` directly. One-line fix. |
| **G11** `refs/modern/<profile>/`, `refs/anti/` reserved, six new folders | **MET** | §2, exactly. |
| **G12** `anti-generic/` and `context/` with `side` markings and `forbidden_for` | **MET in substance, not in marking** | Both folders exist with the right framing and counts. Neither instructs any manifest marking, and `side` has no defined vocabulary anywhere. |
| **G13** ≤10-rule priority block covering the ten named items, sections numbered for cross-reference | **MET** | Lines 30–53; all cross-references resolve. "No HUD" migrated out of the ten into §5a/§2, and the triage sentence was cut — restore it (RC5). |
| **G14** count table, rejection log, could-not-obtain, copyright once, **stop condition** | **NOT MET** | Items 1–5 ✔, copyright ✔ via `LICENCE-NOTE.md`. **The stop condition is a completion rule, not the anti-padding abort rule.** |

**8 met, 6 not met.**

---

# 4. New defects introduced by the rewrite, ranked

### ND1 — CRITICAL. §3's interval-run rule contradicts §4 and §8a, and is impossible in three folders

§3 requires that **at least half** of every modern folder come from "one continuous gameplay video
or one continuous screenshot series", sampled at fixed intervals. Thirty of the sixty required
modern images. Follow that instruction by either route and the document stops you:

- **By video.** Extracting a frame means *encoding a new file*. Rule 1 says "commit the exact bytes
  you downloaded"; §4 says no conversion, no re-encoding. And an extracted frame carries inter-frame
  codec artefacts — §5b says so itself ("clips are usable for motion judgement only, never for
  texture or anti-aliasing statistics") and §8a would reject the frames on `nyq_ratio` and
  `block_score`. Half of every modern folder would be rejected by the prompt's own script. v1's Rank
  3 carried the guard sentence "a still extracted from a clip must never be placed in
  `refs/modern/`"; v2 dropped it, so nothing now prevents the agent from taking the video route and
  quietly poisoning exactly the metrics this whole critique exists to protect.
- **By screenshot series.** An unbiased run cannot produce `material_closeup` ("one surface filling
  the frame" is a *selected* shot by definition), cannot reliably produce `character_closeup` at
  "≥40% of frame height" (over-the-shoulder gameplay puts the character at 25–35%), and cannot be
  counted on for `combat`. Four images of the eight-image `material_closeup` floor are specified as
  something that does not exist.

This is the one defect that makes the ask self-defeating rather than merely large. Fix at RC1.

### ND2 — HIGH. The stop condition was inverted; nothing forbids padding

See §2 Rank 15. With no abort rule and an over-scoped ask (§5), the cheapest path to "every folder
meets its floor" is to fill the last few slots of each folder with re-hosted, promotional or
single-source images — which §8b now explicitly permits ("kept but flagged"). That is the exact
failure BAR-CRITIQUE-IMAGES-01 was written about: a complete-looking set with a degraded quarter we
cannot identify afterwards. Fix at RC2.

### ND3 — HIGH. §8a has no numbers, and §9's exemplar contradicts §8a's rejection rule

"Near zero", "high", "flags an image enlarged" — none of these is a threshold, so the "flag and move
to `rejected/`" instruction cannot be executed. Worse, `upscale_test` is defined as "ratio of
high-frequency energy to what the stated resolution implies", which is circular: the stated
resolution implies nothing measurable. And the §9 exemplar — a 2560×1440 PNG at 9.1 bpp, i.e. a
pristine file — records `"nyq_ratio": 0.031`, which under §8a ("any with a `nyq_ratio` near zero in
`refs/modern/`") is a rejection. An agent that copies the exemplar produces a manifest its own
script disagrees with. Fix at RC3.

### ND4 — HIGH. Corroboration downgraded from gate to label

v1: first-party / two-hosts / pre-2023-page, and "an image satisfying none of the three is not
committed". v2: `"two-hosts" | "one-host" | "none"`, and "single-source images are kept but flagged".
This is the only check in the document that catches a competently generated landscape, because such
an image looks correct and *has no history* — which is precisely what "corroboration: none" records
while still admitting the file. The loss of `first-party` also means a publisher's own store-page
screenshot, the best provenance available, must be logged as the weak value `one-host`. Fix at RC4.

### ND5 — MEDIUM-HIGH. The triage line was cut from the priority block

"If you run out of time or budget, satisfy rules 1–5 on fewer slots rather than rules 6–10 on more."
Given the scope (§5), this run *will* run short, and the document no longer says what to sacrifice.
An agent short on budget will thin every folder evenly, which is the worst available outcome: six
folders each just under their floor calibrate nothing. Fix at RC5.

### ND6 — MEDIUM. REF-M17 contradicts its own folder definition

§2 defines `interior_darkemissive` as "caves and interiors lit **mainly by emissive sources**". §5a
REF-M17 is "a cave or ruin interior lit by a **daylight shaft**". Only two slots feed a floor of ten,
so up to half that folder could be daylight-lit interiors — a different lighting regime, sitting
inside a *per-profile* band. It would inflate the p10–p90 spread of M1 (mean luminance / dynamic
range) and M6 (shadow retention) for that profile with variance that has nothing to do with
rendering, which is the exact error §6 forbids one paragraph later ("the light decides the folder").
Fix at RC6.

### ND7 — MEDIUM. REF-M19 lost the clause that justified the slot

"A shoreline / shallow water edge where water meets land" is a photograph anyone would take. The
slot existed because the water metric compares **grazing-angle** and **steep-downward** water inside
a *single* frame, which requires a low camera close to the surface. As written, M19 is a duplicate of
M4 with less mist. Fix at RC7.

### ND8 — MEDIUM. The diffuse/overcast-noon reference has no slot ID

Folded into REF-M3's cell as "Also get an overcast-noon Skyrim exterior". It cannot be counted in
§10's per-slot table, cannot be reported unfilled, and cannot be cited by RI-VIS02's pairing table
for `exterior_marsh_noon`. Overcast noon is the declared default weather of our world — the single
lighting condition our game spends most of its time in — and it is now a parenthetical inside a row
about god rays. Fix at RC8.

### ND9 — MEDIUM. Two art-direction rows dropped; the Morrowind set is now entirely daylight

The dusk/night exterior (palette targets for dusk and night have nothing to anchor them) and the
stilted/waterside settlement (our fen villages are specified as "stilted lashed"; A8's town street
does not show it). Two table rows. Fix at RC9.

### ND10 — MEDIUM. Manifest fields with no defining rule, and rules with no recording field

- `provenance_chain` appears once, in the §9 exemplar, with no vocabulary and no rule that produces
  it. The agent will copy `"original"` onto everything.
- `side` appears once, with one value and no enumeration; §5c and §5d no longer instruct any marking.
- `modified_by_me` is gone — the single per-file assertion of rule 1.
- §6's framing rules and §5a's photo-mode rule are recorded nowhere (`aspect_mismatch`,
  `foreground_present`, `sky_visible`, `photo_mode`), so they cannot be audited or filtered on.
- `upscaler` is absent from the entire document. DLSS/FSR/XeSS reconstruct high-frequency detail;
  they are the one capture-side setting that moves `nyq_ratio` as much as a resize does.
Fix at RC10.

### ND11 — LOW. `LICENCE-NOTE.md` is required by §9 but missing from §2's tree

§2 says "use exactly this, invent nothing". Add the line.

### ND12 — LOW. The REF-M8 gap is unexplained

The table jumps M7 → M9. An agent will either renumber to close the gap (breaking every corpus
reference) or invent an M8. One sentence fixes it.

### ND13 — LOW. Video clips have no IDs, no filename convention, no "no cuts", no metadata list

§10 item 2 requires a per-slot filled/unfilled table; the video bullets are unnumbered, so there is
nothing to report against. And without "no cuts", a montage satisfies the dolly clip — a cut is
indistinguishable from a pop-in event, which is the only thing that clip measures.

### ND14 — LOW (clarify, don't change). §3's "pick **one** continuous series" reads as a conflict

One series per folder, plus "min 3 distinct games / 6 distinct locations", looks impossible on first
read. It is not: six run frames from game A along one route (2–3 locations) plus six selected frames
from games B and C at the remaining locations satisfies both. Worth one clarifying sentence so the
agent does not abandon one of the two rules.

---

## Consistency and arithmetic — what checks out

I found no orphaned slots and no unreachable folders. For the record:

- **§5a is REF-M1..M7 + M9..M20 = 19 slots.** Every slot's `profile` column names a folder that
  exists in §2. Distribution: `exterior_daylight` 7 slots (M2, M3, M7, M9, M10, M12, M19),
  `exterior_lowlight` 6 (M1, M4, M11, M13, M14, M20), `interior_darkemissive` 2 (M5, M17),
  `character_closeup` 1 (M6), `combat` 2 (M15, M18), `material_closeup` 1 (M16).
- **§3's floors sum to 60** and are consistent with that distribution: 12/7 ≈ 1.7 per daylight slot,
  12/6 = 2 per lowlight slot, 10/2 = 5 per interior slot, 10 and 8 on the single-slot folders. No
  floor is unreachable and no slot is orphaned.
- **§5a's opening sentence resolves the floors-vs-slots tension correctly** — "Fill the folder floors
  in §3. The slots below say what to look for" — which is the right precedence and was worth getting
  right. §10's "every slot is filled **or reported**" is consistent with it.
- **§5e is REF-A1..A17, contiguous, all mapping to `morrowind/<slot>/`**, which §2 provides for.
  A6 and A10 say "at least four images", compatible with §5e's "three to five per slot".
- **Every folder in §2 has a route to content**: six profiles + `hud/` (§5a), `morrowind/` slots and
  `unconfirmed/` (§5e, §7), `anti-generic/` (§5c), `context/` (§5d), `video/` (§5b), `rejected/`
  (§4, §8a). `refs/anti/` is correctly reserved and correctly matches RI-VIS02's
  `refs/anti/threejs-default.png`.

The only numeric incoherence is ND3's exemplar and the missing M8 note (ND12).

---

# 5. Feasibility ruling

**Not achievable as written in one shot.** Counting the demand:

| Item | Files |
|---|---|
| `modern/` floors | 60 |
| `morrowind/` 17 slots × 3–5 | 51–85 |
| `anti-generic/` | 4–6 |
| `context/` | 6–10 |
| **Images total** | **121–161** |
| `video/` | 4–8 clips |
| Plus | `make-manifest.py` (FFT, EXIF, C2PA, JPEG quantisation tables), a 130–170-record manifest, a five-section report |

Every one of those images additionally needs: a full-size original located and downloaded, a
two-host corroboration search, three named identifying features, and — for the fifty-odd Morrowind
files — seven vanilla tests recorded individually. Realistically that is three to five distinct web
operations per file, i.e. 400–700 operations, before the script is written. The predicted outcome is
a thin version of everything, which as the brief says is worse than a complete version of the
essentials — and worse still here, because a folder at 60% of its floor produces a band that looks
computed and is not.

**Priority order — what we keep if the agent can only do half.** Highest first:

1. **`modern/exterior_daylight`** — anchors M2, M4, M5, M10 and half of M1/M3. Our game is an
   outdoor game.
2. **`modern/exterior_lowlight`** — anchors M1, M6, M7, M9, M10; our signature scenes (marsh dusk,
   mist, night) all live here, and dark scenes are where flat shading hides.
3. **`anti-generic/`** — 4 images, any game, any quality, no corroboration burden, and it is the only
   thing that can tell us whether `ForbiddenHits > 0.06` is a strict bar or an unreachable one.
   Highest value per unit of effort in the entire document.
4. **`morrowind/` core rows: A9 (Velothi), A10 (flora), A11 (Bitter Coast), A2, A3, A6, A12** — the
   seven that carry the transposition chain and the two named failure modes ("the green trap", the
   xanmeer's ancestry).
5. **`modern/material_closeup`** — cheap to find, and the blind protocol crops both sides to a
   subject-neutral surface patch; without it that protocol has nothing to crop.
6. **`modern/interior_darkemissive`**.
7. **`modern/character_closeup`** — expensive (HUD-free rear views are rare) but RI-CAM07 depends on
   it entirely.
8. **`modern/combat`** — `combat_midfight` currently has no reference at all, so this is a real gap;
   it is eighth only because it is the hardest to get HUD-free.
9. **`video/`** — reduce to V1-dolly and V2-static, the two nobody can substitute with a still.
10. **`morrowind/` remaining rows** (A1, A4, A5, A7, A8, A13, A14, A15, A16, A17).
11. **`context/` (ESO)** — first to go. It is explicitly cited by nobody; four images is plenty.

**Recommended cuts — make these to the prompt, they cost nothing we need:**

- **C1.** Morrowind per-slot count: **2–3 by default, 4–5 only for A6, A9, A10, A11, A12.** Takes the
  Morrowind block from 51–85 files to ~40, and puts the extra images where the design language
  actually needs multiple samples. (Literal text at RC11.)
- **C2.** Corroborate the **series**, not the frame, for `"sampling": "interval-run"` files — one
  search covering six images instead of six searches. Saves ~30 operations and loses nothing, since
  frames from one attested album share provenance. (Folded into RC4.)
- **C3.** `context/` from 6–10 to **4**.
- **C4.** `video/` from 4–8 to **2 required (V1, V2) + 2 wanted (V3, V4)**. (Folded into RC13.)
- **C5.** Leave the six `modern/` floors alone. They are the only numbers in the document with a
  statistical justification, and lowering them defeats the purpose of the acquisition. If the agent
  cannot reach them, the abort rule at RC2 is how we find out honestly.

Net after cuts: ~109 images + 2–4 clips. Large, but a competent agent can do that in one pass, and
the priority order protects the outcome if it cannot.

---

# 6. Remaining required changes

Literal prompt text. Fourteen changes; none requires restructuring.

---

## RC1 — REPLACE the anti-curation paragraph in §3 (the single blocking fix)

**Target:** §3, the paragraph beginning "**The anti-curation rule — read this twice.**" through
"...one magnificent one."

```
**The anti-curation rule — read this twice.** It applies to three folders only:
`exterior_daylight`, `exterior_lowlight` and `interior_darkemissive`. In each of those, **at least
half** the images must come from an *unbiased run*: pick one continuous **native screenshot
series** — a Steam screenshot showcase, an imgur or Flickr album, a gallery upload set from a
single play session — and take every Nth image **regardless of whether the frame is attractive**.
Skip a sampled image only if it is a menu, cutscene, loading screen, HUD-covered, or almost
entirely black. Name these `run-<source-slug>-<index>.<ext>` and set `"sampling": "interval-run"`.
The rest may be deliberately chosen and are marked `"sampling": "selected"`.

**Never extract a frame from a video into `refs/modern/`.** Extracting a frame means encoding a new
file, which breaks §4, and every frame of a compressed video carries codec artefacts that §8a
rejects. Video lives in `refs/video/` and is measured for motion only, never for texture,
anti-aliasing or colour.

`character_closeup`, `combat` and `material_closeup` are **exempt** from the interval-run rule: an
unbiased run cannot produce a surface filling the frame or a character at 40% of frame height. Fill
those three deliberately — but spread them across as many games, locations, characters and armour
sets as you can. Variety is what the band needs; one game's art director is not a population.

One series per folder is enough for the run half. The selected half is where the distinct-games and
distinct-locations minimums get satisfied: six run frames from one game's route plus six chosen
frames from two other games meets 3 games and 6 locations comfortably.

This exists because the natural instinct — find the most beautiful shot of each place — produces a
set of 99th-percentile frames. **We would rather have twelve ordinary frames than one magnificent
one.**
```

**Also amend priority rule 5** to match:

```
5. **Half of each modern *exterior and interior* folder must be interval-sampled from a native
   screenshot series, not hand-picked, and never cut from a video** (§3). A set of beautiful frames
   produces a bar nobody can reach, which is a bar everybody ignores.
```

**Why:** ND1. Without this, thirty of the sixty modern images are specified by a rule the document
elsewhere forbids obeying, and the likeliest resolution — video frame extraction — silently destroys
the four hard-fail metrics this entire acquisition exists to calibrate.

---

## RC2 — REPLACE §10's stop condition

**Target:** §10, "**Stop condition:** when every folder meets its floor…"

```
**Stop conditions — there are two.**

*Completion.* When every folder meets its floor and every slot is filled or reported, stop. Do not
keep collecting.

*Abort.* If, after genuine effort, more than half the folders in §3 are below their floor, **stop
and report rather than padding the shortfall.** Do not fill the gap with re-hosted, promotional,
uncorroborated or visibly recompressed images to make the count table read PASS. A half-filled
honest set is repairable — we go and get the rest. A full set with a quarter of it quietly degraded
is not, because we will never know which quarter, and every band we compute on top of it will look
exactly as legitimate as a real one.
```

**Why:** ND2.

---

## RC3 — REPLACE §8a's metric definitions with implementable ones, and fix the §9 exemplar

**Target:** §8a's code block (the `nyq_ratio` / `upscale_test` / `block_score` lines) and the
paragraph beginning "Flag and move to `rejected/`".

```
nyq_ratio        = 2-D FFT of the luminance channel; energy in radial frequency
                   [0.45,0.50) divided by energy in [0.20,0.45). A native capture
                   typically lands in 0.05-0.30. **Below 0.02 in refs/modern/ means the
                   image was downscaled or blurred and its real edge detail is gone.**
upscale_test     = box-downsample the luminance to 2/3 size, bilinear-upsample it back
                   to the original size, take the mean absolute difference in 0..1
                   luminance. A native capture typically lands in 0.01-0.05.
                   **Below 0.004 means the image carries no detail at its stated
                   resolution: it was enlarged from a smaller original.**
block_score      = mean |horizontal gradient| across 8-pixel-aligned column boundaries
                   divided by the same across non-aligned boundaries. Native or lightly
                   compressed: 0.95-1.10. **Above 1.15 means JPEG block artefacts are
                   visible in the pixels we measure.**
```

```
Move to `rejected/`: any file with `upscale_test < 0.004`; any `refs/modern/` file with
`nyq_ratio < 0.02`; any file with `block_score > 1.15` (unless nothing better exists for that slot,
in which case keep it and set `"heavily_recompressed": true`); any file whose `exif_software` names
an editor (Photoshop, GIMP, ImageMagick, "Save for Web") or a generative tool; any file with
`c2pa_present` or AI-generator metadata. Record every rejection and its failing statistic in the
rejection log.

If your environment cannot compute one of these statistics, write `"unknown"` in the manifest, say
so in the report, and do the human check instead. **Do not estimate a number you did not compute** —
an invented `nyq_ratio` is worse than a missing one, because we would trust it.
```

**And in §9, change the exemplar's three statistics** from
`"nyq_ratio": 0.031, "upscale_test": 0.98, "block_score": 0.004` to:

```json
  "nyq_ratio": 0.118, "upscale_test": 0.019, "block_score": 1.02,
```

**Why:** ND3. As written the rejection rule cannot be executed, `upscale_test` cannot be
implemented, and the exemplar record is one the script would reject.

---

## RC4 — RESTORE §8b as a gate

**Target:** all of §8b.

```
**8b — Source corroboration.** For every file, one of these three must be true, and you record which
one in `"corroboration"`:

  - `"first-party"` — the source is the publisher, the developer, the official wiki, or the game's
    own store page;
  - `"two-hosts"` — you found the same image, or the same scene from the same capture, on two
    independent sites that are not mirrors of each other;
  - `"pre-2023-page"` — the hosting page carries a visible date before 2023-01-01.

**An image satisfying none of the three goes in `rejected/`.** This is the anti-AI-generation check
and it is far more reliable than looking at the image, because a competently generated landscape
looks completely correct and has no history — which is exactly what "I could only find it in one
place, recently" means.

For `"sampling": "interval-run"` files, corroborate the **series once** and record the same value on
every frame taken from it. Do not repeat the search per frame.
```

**Why:** ND4 and cut C2. "Kept but flagged" means kept, and the flag is a field nobody downstream is
instructed to filter on.

---

## RC5 — RESTORE the triage line to the priority block

**Target:** insert immediately after rule 10, before the `---`.

```
If you run out of time or budget, satisfy rules 1-5 on fewer folders rather than rules 6-10 on more.
A complete, honest `exterior_daylight` is worth more than six folders at 60%. Folder priority,
highest first: `exterior_daylight`, `exterior_lowlight`, `anti-generic/`, the Morrowind rows marked
**core** in §5e, `material_closeup`, `interior_darkemissive`, `character_closeup`, `combat`,
`video/`, the remaining Morrowind rows, `context/`.
```

**Why:** ND5 and the feasibility ruling. This run will be partial; this is the sentence that decides
whether the partial set is usable.

---

## RC6 — REPLACE the REF-M17 row

```
| `REF-M17` | **A second dark interior lit by emissive sources** — a different game from REF-M5: a torchlit crypt, a forge, a lantern-lit cave, glowing fungus or lava. If a daylight shaft is the dominant light source, the shot is not a dark interior and belongs in `exterior_daylight` | `interior_darkemissive` |
```

**Why:** ND6. The band for this profile is a per-profile band; a daylight-shaft interior belongs to a
different lighting population and would widen it with variance that is not about rendering.

---

## RC7 — REPLACE the REF-M19 row

```
| `REF-M19` | **Water at a shoreline, camera low and close to the surface**, so that one frame contains both **near water seen steeply from above** and **far water seen at a grazing angle**. Our water metric compares those two regions inside a single frame; a wide vista of a lake cannot supply it | `exterior_daylight` or `exterior_lowlight` |
```

**Why:** ND7.

---

## RC8 — GIVE the diffuse-noon reference its own slot

**Add** as a new row at the end of the §5a table:

```
| `REF-M21` | **A flat, overcast, no-direct-sun exterior at midday**, any of the four games. Deliberately undramatic: no god rays, no low sun, no golden hour | Overcast noon is our declared default weather and every other exterior slot here is dramatic directional sun. Diffuse light is the hardest lighting to fake and we currently have no reference for it at all | `exterior_daylight` |
```

**And amend REF-M3** — delete "**Also get an overcast-noon Skyrim exterior** — overcast is our
default weather and this slot is otherwise all dramatic sun" and end the cell with:

```
(this is a directional-light, high-chroma reference; REF-M21 is its diffuse counterpart and both are required)
```

**Why:** ND8. A requirement that is not a slot cannot be counted, reported, or paired.

---

## RC9 — RESTORE the two dropped Morrowind rows, and name the Telvanni interior

**Add** to the §5e table:

```
| `REF-A18` | **A dusk or night exterior** — any region; moons and stars in frame if possible | Our palette specification declares dusk and night colour targets and every other row in this table is daylight. Nothing else in the set can anchor them |
| `REF-A19` | **A stilted or waterside settlement** — Hla Oad, Vos, Seyda Neen's shacks, or any village built over water | Our fen villages are specified as "stilted lashed" and this is the source vocabulary. The town street in REF-A8 does not show it |
```

**And amend REF-A4:**

```
| `REF-A4` | **Interiors, at least two of different kinds** — a Dunmer house, shop or temple, *and* a Telvanni tower interior (grown, organic, no right angles): lighting and clutter | Interiors differ by faction and class, and that difference is the property we are copying. One interior cannot show it |
```

**Why:** ND9 and G7.

---

## RC10 — DEFINE the orphaned manifest fields; RESTORE the ones that assert the rules

**Add** to §4's bullet list:

```
- **Record how you got it.** `"provenance_chain": "original"` if you downloaded the file from the
  page that first published it; `"rehosted"` if the only reachable copy was a mirror, a Reddit or
  imgur re-post, or a wiki upload of somebody else's screenshot. Rehosted files are kept but are not
  used for band calibration, so mark them honestly.
```

**Add** to §5a's requirements paragraph:

```
If a source page or video description says an upscaler was in use (DLSS, FSR, XeSS), prefer a
different image — reconstruction invents high-frequency detail, which is exactly what we measure.
Either way, record `"upscaler": "dlss" | "fsr" | "xess" | "off" | "unknown"`.
```

**Add** these fields to the §9 record, and the paragraph beneath it:

```json
  "modified_by_me": false,
  "upscaler": "unknown",
  "photo_mode": false,
  "aspect_mismatch": false,
  "foreground_present": true,
  "sky_visible": true,
```

```
**`modified_by_me` must be `false` on every record.** If it is ever `true`, say in the report exactly
what you did and why — a `true` here means the file cannot be used for measurement.

`"side"` is one of `"modern-fidelity"`, `"morrowind-art"`, `"anti-generic"`, `"context-neither"`,
`"video"`, and **must agree with the folder the file is in**. Files in `anti-generic/` and `context/`
are never cited as targets by anything: `"context-neither"` files additionally carry
`"forbidden_for": ["fidelity-bands", "art-direction-judgement", "blind-pairing"]`.
```

**Why:** ND10. Three of these fields are the only machine-readable trace of rules the document
states elsewhere and would otherwise have no way to audit.

---

## RC11 — RESCALE the Morrowind counts (feasibility cut C1)

**Target:** §5e's opening line, "**Three to five images per slot.** No resolution minimum."

```
**Two to three images per slot.** No resolution minimum. Five slots are **core** and get **four to
five** because they carry design language that one or two images cannot demonstrate:
**REF-A6** (creatures), **REF-A9** (Velothi stone), **REF-A10** (flora), **REF-A11** (Bitter Coast),
**REF-A12** (the UI). If you are running short, fill the core five completely and report the rest
thin — do not spread the shortfall evenly.
```

**Why:** §5 feasibility. Takes the Morrowind block from 51–85 vanilla-verified files to ~40 and puts
the surplus where multiple samples actually buy something.

---

## RC12 — EXPLAIN the REF-M8 gap

**Add** immediately beneath the §5a table:

```
**There is deliberately no REF-M8.** That ID belongs to an anti-reference our own harness generates
into `refs/anti/`. Do not create it, do not write into `refs/anti/`, and do not renumber this table
to close the gap — every ID here is cited by name elsewhere in our corpus.
```

**Why:** ND12.

---

## RC13 — GIVE the video clips IDs, a no-cuts rule and a metadata list (with cut C4)

**Target:** §5b's four bullets and the "Prefer, in order" paragraph.

```
| Clip | Must contain | What we measure |
|---|---|---|
| `V1-dolly` | camera moving forward continuously through open landscape for >= 20 s, **no cuts**, no HUD | LOD pop-in and streaming — a cut is indistinguishable from a pop, so a montage is worthless here |
| `V2-static` | camera **stationary** for >= 15 s looking at water and vegetation, **no cuts** | temporal variance, wind at more than one frequency, ambient particles |
| `V3-locomotion` | third-person character walking, running, stopping and turning 180 degrees, seen from behind | foot planting, foot sliding, blend between clips |
| `V4-combat` | >= 15 s of continuous third-person melee, no cuts | impact, hit reaction, attack commitment, effects |

**V1 and V2 are required. V3 and V4 are wanted; skip them before you skip anything in §5a.** Name
files `V1-dolly__<source-slug>.<ext>`. Prefer, in order: a publisher's or developer's own channel;
Digital Foundry or a comparable technical channel; a high-bitrate gameplay capture that states its
setup. Record `duration_s`, `container`, `video_codec`, `bitrate_kbps`, `fps`, `width`, `height`,
`source_url`, `uploader`, `game`, and `"pixel_metrics_valid": false`.
```

**Why:** ND13 and cut C4.

---

## RC14 — Two one-line fixes

- **§2:** add `  LICENCE-NOTE.md            copyright position for every file (§9)` to the tree,
  beneath `make-manifest.py`. (ND11 — §2 says "invent nothing".)
- **§5d:** change "**Six to ten screenshots**" to "**Four screenshots**". (Cut C3 — this folder is
  cited by nobody and is last in the priority order.)

---

## Orchestrator-owed, outside the prompt (Rank 17, still outstanding)

None of this blocks sending the prompt. All of it must land before anyone reads the delivered set:

1. `RI-VIS02:42` still reads "image files are not vendored into this repo (copyright)". The moment
   Codex commits, that sentence is false and a future critic will cite it. Amend it to state the new
   position and point at the `refs/` layout.
2. RI-VIS02 defines **REF-M1..M8 only**; the prompt's REF-M9..M21 exist nowhere in the corpus, and
   `grep -rn "REF-A[0-9]" corpus/70-visual/` returns **nothing** — the whole REF-A series is
   prompt-invented. Register both series, or the delivered manifest cites IDs no item defines.
3. RI-VIS02's pairing table still maps `combat_midfight` → `REF-M6 + REF-M2`. Repoint it at REF-M15,
   and point `exterior_marsh_noon` at `REF-M3 + REF-M21`.
4. Record in RI-VIS03, RI-VIS08 and RI-CAM07 that M11, M12's `TemporalVar`, RI-VIS08 §C and
   RI-CAM07 §C8 cannot be externally calibrated at frame-exact fidelity — §5b now says this on the
   prompt side and the corpus should agree, so "uncalibrated" is never mistaken for "forgotten".
5. RI-CAM07's `player_back_closeup` / `player_front_closeup` and RI-VIS08's `creature_closeup` are
   still absent from RI-VIS01's fixed eight capture slots, so REF-M6 will have a reference with no
   counterpart on our side.

---

## Closing

v2 is one honest afternoon away from being sendable. The rewrite understood the argument — that these
files are instruments and not illustrations — and §3, §4, §7 and the priority block all carry it
properly. What went wrong is what usually goes wrong in a large rewrite: the sentences that were
doing quiet load-bearing work got compressed out. "Not committed" became "kept but flagged". "Stop
and report rather than pad" became "stop when you're done". A threshold became "near zero". A slot
became a parenthesis. Each of those is one word away from the original and each one reverses the
instruction.

Restore the four in §4 above, scope the interval-run rule so the document stops contradicting itself,
cut the Morrowind counts so the ask fits in one run, and this is a genuinely good prompt.

**INSUFFICIENT.** Fourteen changes, all of them paste-ready.
