# BAR CRITIQUE — reference-image acquisition prompt, review 03

**Critic:** bar-critic
**Date:** 2026-08-06
**Artifact:** `docs/REFERENCE-IMAGE-REQUEST.md` (v3, 35754 bytes, 496 lines, commit `e8c5b13`)
**Previous reviews:** `BAR-CRITIQUE-IMAGES-01.{md,json}`, `BAR-CRITIQUE-IMAGES-02.{md,json}`

---

# VERDICT: INSUFFICIENT

**But only just, and not for want of substance.** All fourteen RC changes are present in the
document. All fourteen gate conditions from critique 01 are now met in text. The internal
consistency check passes: no orphan slot, no unreachable folder, no slot that cannot be reported.
The two hardest things I asked for — real numeric thresholds an implementer can code against, and
an anti-curation rule that does not require the agent to break §4 to obey it — both landed
correctly.

What blocks it is smaller and more annoying than anything in review 02: **the edits were spliced in
mechanically and five of them damaged their surroundings**, and **§11 — which was written between
v2 and v3 and which none of my RC changes touched — is now a hole in the wall RC1 just built.**

Two of the six remaining items are materially damaging:

- **§3 still says "Three to five images per slot"** for Morrowind while §5e says "Two to three".
  RC11 was applied to §5e only. The section headed *How many* now contradicts the section that
  lists the slots, and the one an agent reads first for a count is §3. This silently reverses
  feasibility cut C1 — the largest cut in the document — and takes the Morrowind block back from
  ~48–67 files to 57–95.
- **§11 rung 4 still authorises extracting a frame from video for any slot**, including every
  `refs/modern/` slot, three sections after §3 says *"Never extract a frame from a video into
  `refs/modern/`."* That is not a nuance. It is the exact defect (ND1/ND14) that RC1 exists to
  close, reachable through a door added in the intervening commit.

The other four are splice artefacts: an unterminated code fence that swallows eighty lines, and
three tables where a spliced row has one cell too many. **Two of those three are my fault** — the
replacement text I supplied at RC8 and RC9 gave rows with a rationale column that the target tables
do not have, and the script applied them exactly as written. I am fixing my own error here.

**None of this needs new research or new thinking.** Six edits, all literal, all supplied below. I
expect this to be the last review.

---

# 1. RC1–RC14 verification

| Rank | Landed | Evidence in v3 | Note |
|---|---|---|---|
| **RC1** | **Yes** | §3 L125–133. "It applies to three folders only: `exterior_daylight`, `exterior_lowlight` and `interior_darkemissive`… pick one continuous **native screenshot series**". L127: "**Never extract a frame from a video into `refs/modern/`.**" L129: the three-folder exemption. L131: the one-series clause. Priority rule 5 (L45–46) amended verbatim. | Clean, complete, correctly worded. **But see the §11 conflict at RC20 — the prohibition at L127 is contradicted at L469.** Also note the rename to `run-<source-slug>-<index>` was not carried into §9 (RC19). |
| **RC2** | **Yes** | §10 L441–445. "**Stop conditions — there are two.**" / *Completion.* / *Abort.* "…more than half the folders in §3 are below their floor, **stop and report rather than padding the shortfall.**" | Verbatim. The abort rule is back and it is the right one. |
| **RC3** | **Yes** | §8a L332–344 for the three definitions with 0.05–0.30 / 0.01–0.05 / 0.95–1.10 typical bands and 0.02 / 0.004 / 1.15 thresholds; L346 for the rejection paragraph; L348 for the "do not estimate a number you did not compute" clause; §9 L396 now reads `"nyq_ratio": 0.118, "upscale_test": 0.019, "block_score": 1.02`. | Content correct and the exemplar now passes its own script. **The splice deleted the closing code fence — see SD1.** |
| **RC4** | **Yes** | §8b L350–358. Three-value enum with `first-party` / `two-hosts` / `pre-2023-page`; "**An image satisfying none of the three goes in `rejected/`.**"; the per-series corroboration clause at L358. | Verbatim. This is now a commit gate rather than a label, which was the point. |
| **RC5** | **Yes** | L56, immediately after rule 10 and before the `---`. Full folder priority ladder, `exterior_daylight` first, `context/` last. | Verbatim. Cross-reference "the Morrowind rows marked **core** in §5e" resolves — §5e L250 does mark five rows core. |
| **RC6** | **Yes** | §5a L189. "**A second dark interior lit by emissive sources** — a different game from REF-M5… If a daylight shaft is the dominant light source, the shot is not a dark interior and belongs in `exterior_daylight`". | Verbatim. Old "cave or ruin interior lit by a daylight shaft" gone. |
| **RC7** | **Yes** | §5a L191. Both regions named in one frame: "**near water seen steeply from above**" and "**far water seen at a grazing angle**"; profile widened to `exterior_daylight` or `exterior_lowlight`. | Verbatim. Both target folders exist, so the widened profile is reachable. |
| **RC8** | **Partial** | §5a L193 REF-M21 present with the flat-overcast-midday text; REF-M3 (L176) amended correctly to "(this is a directional-light, high-chroma reference; REF-M21 is its diffuse counterpart and both are required)" and the old sub-clause deleted. | **Row has four cells in a three-column table — SD3.** The `exterior_daylight` profile is the cell that gets dropped on render. My replacement text caused this. |
| **RC9** | **Partial** | §5e L271 REF-A18, L272 REF-A19, L257 REF-A4 amended to "at least two of different kinds… *and* a Telvanni tower interior". | **All three rows have three cells in a two-column table — SD4.** Rationale cells drop on render. My replacement text caused this. |
| **RC10** | **Yes** | §4 L154 `provenance_chain` bullet; §5a L204 upscaler paragraph; §9 L402–407 adds `modified_by_me`, `upscaler`, `photo_mode`, `aspect_mismatch`, `foreground_present`, `sky_visible`; L413 the `modified_by_me` paragraph; L415 the `side` vocabulary and `forbidden_for`. | All six fields and both paragraphs present and correctly placed. One residual tension in the `provenance_chain` bullet — RC21, non-gating. |
| **RC11** | **Partial** | §5e L250. "**Two to three images per slot.** No resolution minimum. Five slots are **core** and get **four to five**… **REF-A6**, **REF-A9**, **REF-A10**, **REF-A11**, **REF-A12**… do not spread the shortfall evenly." | Verbatim **in §5e**. **§3 L135–136 was not updated and still says "Three to five images per slot" — SD2, the most damaging item in this review.** |
| **RC12** | **Yes** | §5a L195, immediately beneath the slot table. "**There is deliberately no REF-M8.**… do not renumber this table to close the gap — every ID here is cited by name elsewhere in our corpus." | Verbatim, correctly positioned, and consistent with §2's reservation of `refs/anti/` at L103–104. |
| **RC13** | **Yes** | §5b L212–217 the four-row clip table with `V1-dolly`, `V2-static`, `V3-locomotion`, `V4-combat`, all "no cuts" clauses intact; L219 "**V1 and V2 are required. V3 and V4 are wanted; skip them before you skip anything in §5a.**" plus the metadata field list. | Verbatim. Table column count is correct here (3/3). The old "Get 4–8 clips, 20–60 seconds each" bullets were removed cleanly. |
| **RC14** | **Yes** | §2 L100 `LICENCE-NOTE.md            copyright position for every file (§9)`, correctly aligned beneath `make-manifest.py`; §5d L237 "**Four screenshots of The Elder Scrolls Online: Shadowfen and Murkmire.**" | Verbatim. §9 L420's "A single `LICENCE-NOTE.md` at `refs/` root" now has a matching entry in the tree, closing ND11. |

**Landed cleanly: 11 of 14. Landed with splice damage to their surroundings: 3 (RC8, RC9, RC11).
Landed but undermined by an untouched section: 1 (RC1, via §11).**

No RC was misapplied in substance. Every one of the fourteen is *present*, and the wording is the
wording I asked for. The failures are all at the seams.

---

# 2. Gate conditions from critique 01 — re-checked

| Gate | Met | Evidence / note |
|---|---|---|
| **G1** byte-integrity mandate; exact bytes, no resize either direction, no conversion, no re-encode, no metadata stripping, SDR only, original over re-host; q90 and 1920×1080 clauses gone | **Met** | §4 L148–161, rule 1 at L34–37, SDR at §5a L200 and §6 L285. `provenance_chain` (RC10) now closes the original-over-re-host half that was dropped in v2. |
| **G2** per-folder hard floor table 12/12/10/10/8/8 with min distinct games and locations | **Met** | §3 L116–123, exact, 4-column table well formed. |
| **G3** anti-curation rule: half interval-sampled, run naming, `sampling` field | **Met** | §3 L125–133. Was "met but unworkable as scoped" in review 02; RC1 makes it workable. The naming convention now disagrees with §9 (SD5) but the rule itself is sound. |
| **G4** `refs/video/` with dolly, stationary, locomotion, combat clips; every video record `pixel_metrics_valid: false` | **Met** | §5b L212–224. RC13 added the IDs, so §10's per-slot table can now report them. |
| **G5** fidelity slots for diffuse noon, night, falling weather, active combat, ≥5 material surfaces, a low shoreline shot with both steep and grazing water in one frame, ≥5 wetlands from ≥4 engines | **Met** | Diffuse noon = REF-M21 (RC8), the gap that failed this gate in review 02. Shoreline two-angle = REF-M19 (RC7). Night M13, weather M14, combat M15/M18, materials M16 (six surfaces named, floor 8 across 6 locations), wetlands M4/M9/M10/M11/M12 across RAGE, REDengine, Creation and FromSoft — five wetlands, four engines. |
| **G6** REF-M6 requires back and three-quarter-rear in-world views, excludes menu renders, character sheets, turntables | **Met** | §5a L179, unchanged and still correct. |
| **G7** art-direction slots incl. Velothi stone, ≥4 flora, Bitter Coast own slot, the interface, armour/weapons/clothing, silt strider, ≥3 interiors of 3 vocabularies, dusk-or-night exterior, stilted settlement, REF-A6 to four creatures | **Met** | The two absences that failed this in review 02 are filled: REF-A18 dusk/night, REF-A19 stilted settlement. REF-A4 now demands a Dunmer *and* a Telvanni interior, which with REF-A17's Imperial fort gives three vocabularies. A9 L262, A10 L263 (≥4), A11 L264, A12 L265, A13/A14 L266–267, A16 L269, A6 L259 (≥4). |
| **G8** mechanical verification: committed script with stated automatic-rejection thresholds, three-way corroboration, `identified_by` with three named features, the human look last | **Met** | Thresholds at §8a L332–346 are real numbers a script can branch on; `upscale_test` is now an implementable procedure rather than a circular definition; §8b restored as a commit gate with all three routes; §8c L360–363; §8d L365–368. This was the most substantive failure in review 02 and it is fully repaired. |
| **G9** seven mechanical vanilla tests recorded as `vanilla_tests`, OpenMW handled, no resolution minimum in that folder | **Met** | §7 L294–318, unchanged. |
| **G10** framing requirements plus upscaler recorded plus light-decides-folder | **Met** | §6 L285–290 framing and "The light decides the folder, not the slot label"; upscaler at §5a L204 and §9 L403 (RC10). The absence that failed this gate is closed. |
| **G11** layout uses `refs/modern/<profile>/` and `refs/morrowind/`, reserves `refs/anti/`, adds anti-generic, context, video, hud, unconfirmed, rejected | **Met** | §2 L80–104, now with `LICENCE-NOTE.md`. |
| **G12** `anti-generic/` and `context/` exist with the side markings and `forbidden_for` list | **Met** | Substance at §5c/§5d; the marking that was missing in review 02 is now at §9 L415, with the `side` vocabulary enumerated and required to agree with the folder. |
| **G13** numbered priority block of ≤10 rules covering the ten non-negotiables, rest of document numbered for cross-reference | **Met** | L32–56. The triage sentence is restored at L56 (RC5). Every `§` cross-reference in the ten rules resolves to a real section. |
| **G14** report requires count-vs-floor table, rejection log, could-not-obtain section, copyright stated once, and the stop condition | **Met** | §10 L429–445. The abort rule (RC2) is the piece that was inverted in v2. |

**14 of 14 met.** Every gate condition from critique 01, and every one of the fourteen new defects
from critique 02, is addressed in the text of v3. The verdict is not INSUFFICIENT because a
requirement is missing. It is INSUFFICIENT because of what the splice did around the requirements,
and because of a section no RC was aimed at.

---

# 3. Internal consistency

**Slot inventory.** §5a: REF-M1–M7 and REF-M9–M21 = **20 slots**, with M8 absent and its absence
now explained at L195. §5e: REF-A1–REF-A19 = **19 slots**, contiguous. §5b: V1–V4 = **4 clip
slots**, which now have IDs. Total **43 reportable slots**.

**Every slot routes to a folder that §2 creates.**

| Profile folder | Slots feeding it | Floor |
|---|---|---|
| `exterior_daylight` | M2, M3, M7, M9, M10, M12, M21, (M19) | 12 |
| `exterior_lowlight` | M1, M4, M11, M13, M14, M20, (M19) | 12 |
| `interior_darkemissive` | M5, M17 | 10 |
| `character_closeup` | M6 | 10 |
| `combat` | M15, M18 | 8 |
| `material_closeup` | M16 | 8 |

RC8 added M21 to the folder that already had the most slots, and RC7 gave M19 a choice of two
folders — neither creates an unreachable floor or an over-subscribed one. `interior_darkemissive`
remains the tightest ratio at 5 images per slot, and RC6 is what makes that honest: M17 is now
genuinely a second dark interior rather than a daylight-shaft cave that would have widened the
band with variance that is not about rendering.

**Orphaned slots: none.** **Unreachable folders: none** — `hud/` from §5a L199, `unconfirmed/`
from §7 L318, `rejected/` from §4 L159 and §8a L346, `anti-generic/` §5c, `context/` §5d,
`video/` §5b, `morrowind/<slot>/` §5e, and `refs/anti/` correctly reserved and never written.

**Every slot can be reported.** §10 item 2 requires a per-slot filled/unfilled table. All 43 slots
have an ID. RC12's paragraph means the M8 gap will not read as an omission in that table, and RC13
means V1–V4 have names to appear under. This was broken in v2 for the video clips and is now fixed.

**Numeric coherence.** The §9 exemplar's three statistics now sit inside the bands §8a calls
native and would pass every rejection rule in §8a — the contradiction ND3 identified is gone.

**One count is incoherent, and it is the important one:** §3 L135–136 and §5e L250 give different
per-slot Morrowind counts. See SD2.

---

# 4. Splice damage and new defects

## SD1 — §8a's code fence is unterminated, and it swallows eighty lines

**Severity: high (structural).**

The fences in v3 are at lines **80, 101, 327, 375 (` ```json `) and 411**. Line 327 opens the §8a
statistics block. The RC3 replacement text ran from `nyq_ratio` through `visible in the pixels we
measure.**`, and because the old text's `block_score` definition was immediately followed by the
closing ` ``` `, the splice consumed the closing fence and did not restore it.

Under CommonMark and GFM a closing fence **may not carry an info string**, so ` ```json ` at line
375 does not close the block. The code block therefore runs **from line 328 to line 410** and
contains, rendered as undifferentiated monospace with every `**` inert:

- §8a's entire rejection instruction (the four automatic rejections and the thresholds)
- §8a's "do not estimate a number you did not compute" clause
- **all of §8b** — the anti-AI-generation commit gate
- **all of §8c and §8d** — three-feature identification, and "look at it"
- §9's opening line and the whole `MANIFEST.json` exemplar

The words survive in the raw text an agent is pasted, so this is not a loss of content. But the
document's most consequential eighty lines are presented to the reader as the *output of a script*
rather than as instructions, introduced by the sentence "It walks every file and produces, per
file, without you typing any of it:". An agent that takes that framing at face value reads §8b as
a field description instead of a rejection rule. That is a plausible enough misreading of the one
gate that keeps generated images out of the set that I will not wave it through.

**Fix — insert a single line containing exactly ` ``` ` between current lines 344 and 345**, i.e.
after `                   visible in the pixels we measure.**` and before the blank line preceding
`Move to \`rejected/\`:`.

## SD2 — §3 and §5e give different Morrowind per-slot counts

**Severity: high (material).**

§5e L250 (RC11): **"Two to three images per slot."** … "Five slots are **core** and get **four to
five**".

§3 L135–136, untouched: *"`refs/morrowind/` is different: it is judged on design language, not
statistics. **Three to five images per slot**, deliberately chosen, is right."*

RC11 was targeted at §5e's opening line and applied there only. §3 carries a duplicate statement of
the same rule and it now contradicts it — and §3 is the section headed *How many, and how to choose
them*, which is where an agent looks for a count.

This is not cosmetic. C1 was the single largest feasibility cut in review 02, and its whole purpose
was to take the Morrowind block down. At §3's numbers, 19 slots × 3–5 = **57–95 vanilla-verified
files**, each needing seven individually recorded vanilla tests. At §5e's numbers it is **48–67**.
An agent that obeys §3 does roughly a third more of the hardest work in the document and, per the
priority ladder, does it *instead of* `material_closeup`, `interior_darkemissive`,
`character_closeup` and `combat`. The cut is reversed by a paragraph nobody updated.

**Fix — replace §3 L135–136 in full:**

```
`refs/morrowind/` is different: it is judged on design language, not statistics. **Two to three
images per slot** — four to five for the five rows marked **core** in §5e — deliberately chosen,
is right. §5e is authoritative on those counts; this paragraph only explains why they are smaller
than the modern floors.
```

## SD3 — the REF-M21 row has four cells in a three-column table

**Severity: medium. My error at RC8.**

§5a's table is `| Slot | What it shows | Profile |`. Every row from L174 to L192 has three cells.
**L193 has four** — because the replacement text I supplied at RC8 wrote the rationale as its own
column, which that table does not have.

GFM truncates cells beyond the header count, so on render **the cell that disappears is
`exterior_daylight`** — the profile, the routing, the thing the third column exists for. The
rationale ("Overcast noon is our declared default weather…") sits in the Profile column in its
place. REF-M21 becomes the only slot in the table with no folder assignment.

Partly self-healing — §6 says the light decides the folder, and a flat overcast midday exterior can
only be `exterior_daylight` — but it is the one row where a reader checking the Profile column gets
prose instead of a folder name, and §10's per-slot table and the manifest's `profile` field both
want that value.

**Fix — replace L193 with a three-cell row:**

```
| `REF-M21` | **A flat, overcast, no-direct-sun exterior at midday**, any of the four games. Deliberately undramatic: no god rays, no low sun, no golden hour. Overcast noon is our declared default weather and every other exterior slot here is dramatic directional sun; diffuse light is the hardest lighting to fake and we currently have no reference for it at all | `exterior_daylight` |
```

## SD4 — three rows in §5e have three cells in a two-column table

**Severity: low. My error at RC9.**

§5e's table is `| Slot | What it shows |`. Lines **257 (REF-A4)**, **271 (REF-A18)** and **272
(REF-A19)** each carry three cells. The third cell — the rationale — is dropped on render.

Lower severity than SD3 because §5e has no profile column, so nothing load-bearing is lost; what
disappears is the justification. But those justifications are the reason the rows exist ("nothing
else in the set can anchor them", "the town street in REF-A8 does not show it"), and an agent
deciding what to cut when short will cut the row it cannot see a reason for.

**Fix — replace all three rows with two-cell versions:**

```
| `REF-A4` | **Interiors, at least two of different kinds** — a Dunmer house, shop or temple, *and* a Telvanni tower interior (grown, organic, no right angles): lighting and clutter. Interiors differ by faction and class, and that difference is the property we are copying; one interior cannot show it |
```

```
| `REF-A18` | **A dusk or night exterior** — any region; moons and stars in frame if possible. Our palette specification declares dusk and night colour targets and every other row in this table is daylight; nothing else in the set can anchor them |
```

```
| `REF-A19` | **A stilted or waterside settlement** — Hla Oad, Vos, Seyda Neen's shacks, or any village built over water. Our fen villages are specified as "stilted lashed" and this is the source vocabulary; the town street in REF-A8 does not show it |
```

## SD5 — the interval-run filename convention lost its cross-reference

**Severity: low.**

RC1 renamed interval-sampled frames from `run-<source-slug>-t<seconds>.<ext>` to
`run-<source-slug>-<index>.<ext>`, because the source is now a screenshot series and a screenshot
series has no seconds. §3 L125 carries the new name. **§9 L418 still carries the old one.**

An agent following §9 will name a file after a timecode that does not exist for its source, or will
notice the conflict and stop to resolve it. Cheap to fix, and it is exactly the kind of stale
cross-reference a scripted splice leaves behind.

**Fix — replace §9 L417–418:**

```
Filenames: `REF-M4__rdr2-bluewater-marsh-dawn.png` (double underscore separator), or
`run-<source-slug>-<index>.<ext>` for interval-sampled frames, exactly as named in §3.
```

---

# 5. §11 — the substitution ladder is now a loophole

**This is the item I was asked to check specifically, and the answer is yes, it has become one.**

§11 was added in commit `b07f064`, after review 02 was written and before v3's edits were applied.
None of RC1–RC14 was aimed at it. It is a good section — the honesty about not owning these games,
and "what we need from you is not a full set, it is an accurate map of what exists", are among the
best paragraphs in the document. But RC1 and RC4 tightened §3 and §8b into absolute rules, and §11
was drafted against the looser v2 and never reconciled.

**Leak 1 — rung 4 readmits video frames to `refs/modern/`.** §11 L469–471:

> 4. **A frame extracted from video.** Only if no still exists. Mark `"provenance_chain":
>    "video-frame"` and `"pixel_metrics_valid": false` — a compressed video frame cannot be used for
>    texture or anti-aliasing statistics, only for composition, palette and design language.

This rung applies to every slot, and every §5a slot lands in `refs/modern/`. It therefore
contradicts, directly:

- **rule 1** (L34): "no format conversion, no re-encode… Commit the exact bytes you downloaded";
- **rule 5** (L45): "never cut from a video";
- **§3 L127**: "**Never extract a frame from a video into `refs/modern/`.** Extracting a frame means
  encoding a new file, which breaks §4, and every frame of a compressed video carries codec
  artefacts that §8a rejects."

Where two sections disagree, an agent under time pressure with an unfilled slot takes the one that
lets it fill the slot. And nothing downstream catches the result: §8a's `block_score > 1.15`
rejection carries the escape hatch *"unless nothing better exists for that slot, in which case keep
it and set `heavily_recompressed: true`"* — and rung 4's own precondition is "only if no still
exists", so the two clauses chain and the file is kept. §8b does not catch it either: the video's
own channel satisfies `first-party`.

**Leak 2 — degraded files still count toward the §3 floors.** Nothing in §3, §10 or §11 says a
file marked `pixel_metrics_valid: false` or `heavily_recompressed: true` is excluded from the
per-folder count. So a `refs/modern/exterior_lowlight/` with three video frames in it reports 12
against a floor of 12, and §10's count table — "the first thing we will read" — reads **PASS**,
while the population the band is actually computed from is 9. This is worse than a folder honestly
short, because the abort rule at RC2 never fires: the count says the floor was met. That defeats
the entire purpose of both §3 and RC2 at once.

**Leak 3 — rungs 1 and 2 are unscoped.** "Same requirement, different game. The profile matters
more than the title" is written for §5a and illustrated with an Elden Ring example, but nothing
limits it to REF-M slots. Applied to REF-A9 (Velothi stone) it authorises a non-Morrowind image
into `refs/morrowind/`, which is the axis-mixing failure §1 calls fatal. §7's vanilla tests would
catch most such images (grass, distant land, cast shadows, texture resolution), so this is
partly self-defending — but "partly" is not the standard for the one rule the folder layout exists
to enforce. Read strictly, rung 1 could also be taken to permit an older game into
`refs/modern/`, which §1 calls equally fatal.

**What §11 does *not* leak,** to be fair to it: modded Morrowind is explicitly barred at L489
("**Never trade vanilla-ness for image quality in that folder.**"), and there is no rung that
admits an uncorroborated image — rung 5 is "leave it empty", which is the correct terminal. The
ladder does not restate that §8b still applies, but it does not override it either.

**Fix — three edits.**

**(a) Replace §11 rung 4 (L469–471) in full:**

```
4. **A frame extracted from video — for `refs/morrowind/`, `anti-generic/` and `context/` only.**
   **Never for `refs/modern/`.** §3 forbids it absolutely there: extracting a frame encodes a new
   file, which breaks rule 1 and §4, and every frame of a compressed video carries the codec
   artefacts §8a rejects. For a REF-M slot, skip this rung and go straight to rung 5. Where it is
   allowed, mark `"provenance_chain": "video-frame"` and `"pixel_metrics_valid": false` — such a
   file is usable for composition, palette and design language only.
```

**(b) Add immediately after rung 5, before "**What we need from you is not a full set**":**

```
**The ladder changes the subject, never the standard.** A substituted file is still subject to §4
(exact bytes, original rather than re-host), §7 (all seven vanilla tests for anything in
`refs/morrowind/`), §8a (the same automatic rejections at the same thresholds) and §8b (the same
three-way corroboration gate). Rungs 1 and 2 mean a different *current-generation* game for a
REF-M slot — never an older one — and for a REF-A slot they never mean a game other than
Morrowind: a REF-A slot that cannot be filled with vanilla Morrowind goes to rung 5, not to
another title.
```

**(c) Add to §3, immediately beneath the floors table (after L123, before the anti-curation
paragraph):**

```
**Only files with `"pixel_metrics_valid": true` count toward these floors.** A video frame, or a
file the script kept but marked `"heavily_recompressed": true`, may be retained for composition and
design language but does not count toward the number in this table. A folder padded to its floor
with files we cannot measure is worse than a folder honestly reported short: the count table in
§10 reads PASS, the abort rule never fires, and the band computed from it looks exactly like a
real one.
```

With those three in place, §11 keeps everything good about it and stops being a route around §3,
§4, §7 and §8.

---

# 6. Feasibility

**Achievable in one pass by one agent — conditional on SD2 being fixed.**

**Demand as v3 actually reads, with §3 L135 governing the Morrowind count:**

| Block | Count | Note |
|---|---|---|
| `refs/modern/` | 60 | Sum of the six floors. Slots feed folders, so RC8's REF-M21 adds no images. |
| `refs/morrowind/` | **57–95** | 19 slots × 3–5 per §3 |
| `anti-generic/` | 4–6 | |
| `context/` | 4 | RC14 |
| **Images total** | **125–165** | |
| `video/` | 2 required, 2 wanted | RC13 |

**Demand with SD2 fixed, §5e governing:**

| Block | Count |
|---|---|
| `refs/modern/` | 60 |
| `refs/morrowind/` | **48–67** (14 non-core × 2–3, 5 core × 4–5) |
| `anti-generic/` | 4–6 |
| `context/` | 4 |
| **Images total** | **116–137** |

Review 02 projected ~109 after cuts. The real figure is a little higher because RC9 added two
Morrowind slots that were not in that arithmetic — a cost I asked for knowingly, and the right
trade: A18 and A19 are the only anchors for declared palette targets and for the stilted-village
vocabulary. **116–137 with the priority ladder at L56 and the abort rule at §10 is workable.**
125–165 without the cut is the same over-ask review 02 ruled infeasible, concentrated in the most
expensive block in the document — seven individually recorded vanilla tests per file, on imagery
the document itself predicts will be "overwhelmingly modded".

**What protects the outcome if the agent still runs short:** RC5's folder priority ladder means a
partial run is partial in the right order; RC2's abort rule means a run that cannot reach the
floors says so instead of padding; and fix (c) above means the count table cannot report PASS on a
folder padded with unmeasurable files. Those three together are why I am comfortable ruling this
achievable rather than asking for more cuts.

**No further cuts recommended.** Specifically: **do not lower the six modern floors.** They are the
only numbers in the document with a statistical justification, and lowering them defeats the
acquisition rather than making it cheaper. If they cannot be reached, the abort rule is how we find
that out honestly, which is itself a useful result.

One workload note, not a defect: RC1 requires half of `interior_darkemissive` (5 images) to come
from an interval-sampled native screenshot series. Screenshot albums skew heavily to exteriors, so
that half is the tightest single constraint in §3. It is satisfiable — a Steam showcase from a
dungeon or underground run supplies it, and §6's "the light decides the folder" lets one run's
frames distribute across all three interval-sampled folders at once. Flagging it so nobody is
surprised when it is the folder that reports short.

---

# 7. Remaining changes

Seven edits. Six are gating. All are literal; none requires research or judgement.

| Rank | Action | Target | Gating |
|---|---|---|---|
| **RC15** | insert | §8a — a bare ` ``` ` line between L344 and L345 | yes |
| **RC16** | replace | §3 L135–136 — the Morrowind per-slot count | yes |
| **RC17** | replace | §5a L193 — REF-M21 row, four cells → three | yes |
| **RC18** | replace | §5e L257, L271, L272 — REF-A4/A18/A19 rows, three cells → two | yes |
| **RC19** | replace | §9 L417–418 — interval-run filename convention | yes |
| **RC20** | replace + add ×2 | §11 rung 4; a scope paragraph after rung 5; a floor-counting paragraph in §3 | yes |
| **RC21** | replace | §4 L154 — the `rehosted` clause | **no** — apply while you are in the file |

Replacement text for RC15–RC20 is given in full in sections 4 and 5 above. RC21 follows.

## RC21 — non-gating: the `rehosted` clause over-excludes

§4 L154 (my own text at RC10) ends: *"Rehosted files are kept but are not used for band
calibration, so mark them honestly."*

On reflection that is stricter than it needs to be and stricter than the rest of the document. What
actually threatens calibration is re-encoding and downscaling, and §8a measures both directly — a
re-host that passes `nyq_ratio`, `upscale_test` and `block_score` is measurement-identical to the
original file. Excluding it anyway discards usable data for a provenance reason §8a has already
settled, and it sits awkwardly beside RC20(c), which counts such files toward the floors.

The failure mode here is losing good data, not admitting bad data, so this does not gate. But fix
it while you are in the file:

```
- **Record how you got it.** `"provenance_chain": "original"` if you downloaded the file from the
  page that first published it; `"rehosted"` if the only reachable copy was a mirror, a Reddit or
  imgur re-post, or a wiki upload of somebody else's screenshot. Rehosted copies are acceptable and
  count toward the §3 floors provided they pass §8a — §8a is what protects calibration, and a
  re-host that passes it is measurement-identical to the original. Mark them honestly anyway, so we
  can re-check that subset first if a band later looks strange.
```

---

# 8. What is good in v3, briefly

Worth recording, because three reviews of finding fault is a distorted picture of this document.

- **§8a is now a real specification.** `upscale_test` went from a circular sentence to a procedure
  someone can implement in six lines of numpy, with a typical band and a threshold. That was the
  hardest single change I asked for and it landed exactly.
- **§8b is a commit gate again**, with three routes rather than one, and the per-series clause
  removes roughly thirty redundant searches without weakening provenance by anything.
- **RC1 solved a problem I posed badly.** I identified that the anti-curation rule was unobeyable;
  the resolution — scope it to three folders, require native screenshot series, exempt the three
  folders where an unbiased run is incoherent, and forbid video frames outright — is cleaner than
  the constraint I described.
- **The priority ladder at L56 and the abort rule at §10** are, together, what make a partial run
  a usable result rather than a wasted one. They are the two sentences most likely to determine
  whether this acquisition produces anything we can measure.
- **RC12's paragraph** on the deliberate M8 gap is the kind of thing that prevents a whole class
  of future damage for two lines of prose.

---

# 9. Bottom line

Six literal edits stand between this document and a green light. Two of them matter — the Morrowind
count contradiction in §3, and §11 rung 4 — and four are splice tidy-up, two of which are repairing
my own replacement text from review 02.

Apply RC15–RC21, re-read §3 and §11 side by side once to confirm they now agree, and this is ready
to run. There is nothing left to research and nothing left to argue about.
