# Brief: corpus coherence — constants, front-matter repair, wrong-bar amendments

**Run this LAST**, after the other corpus tasks land (check `node tools/orchestrate.mjs`). You edit other agents' files, which is why you go last.

Closes BAR-CRITIQUE-01 **G7** ("nobody audits the corpus — it has the exact incoherence it exists to prevent in the game"), the **wrong bars W1–W8**, and the index-integrity thin spot. Read `BAR-CRITIQUE-01.md`, `BAR-CRITIQUE-01.json`, `INTENT-AUDIT-01.md` and `INTENT-AUDIT-01.json` in full — they are your work list.

## 1. `corpus/00-doctrine/constants.json` — one owner per shared constant
The corpus has **two authoritative definitions of the same unit, 70% apart**: RI-AI07's traversal minute uses 3.4 m/s over 204 m, while seam **S17** and RI-WLD01 mandate **2.0 m/s**. Every density, beat-structure, runback and sightline figure downstream is corrupted by this. Build the shared-constant registry: each constant, its **single owning item**, its value, its unit, and every item that consumes it. Then **resolve the contradiction by amendment** and restate the affected figures.
Do the same for the other known collision: RI-PRG06's 576 hand-placed enemies vs RI-WLD07's 8 dungeons × 25–60 plus RI-WLD02's 0.7–1.2 hostile groups/min over a 79-minute road network. And the dialogue-scope discrepancy documented in `corpus/40-dialogue/data/README.md` (RI-DLG02 cites 17,298 distinct texts / 504,896 words; recomputation over the vendored file gives 28,050 / 1,869,218) — **rule which scope is canonical and restate RI-DLG02's per-settlement targets against it.**

## 2. `corpus/80-methods/RI-MTH05` — corpus coherence as a judged property
A reference item whose subject is the corpus itself: shared-constant integrity, front-matter validity, no orphaned `judges:` paths, no item judging nothing, no two items contradicting. With an executable check (extend `tools/corpus-index.mjs`) and a **blocking CI gate**.

## 3. Front-matter repair
`node tools/corpus-index.mjs` reports **19 front-matter errors, 31 holes and 206 legacy aliases**. Items with unresolvable `judges:` paths **judge nothing and are invisible to the critic hand-off** — RI-CMB08 (healing, 3,155 words) has all four paths dead; RI-WLD08, the corpus's best liveness instrument, has 5 of 7 dead. Fix every one to canonical paths. Add the new roots other agents registered (`weapon.*`, `magic.*`, `character.*`, `stealth.*`, `crime.*`, `camera.*`, `experience.*`, `composition.*`, `journey.*`) to `subsystems.json`. Then regenerate `INDEX.md` and make `--check` a blocking gate.

## 4. Apply the wrong-bar amendments W1–W8
From BAR-CRITIQUE-01, each with a specified fix — including RI-WLD05's front-loaded strangeness curve, RI-WLD02's global density floors that make deliberate emptiness illegal, RI-DLG07's `ours_win_rate ≥ 0.25` pass condition (which contradicts CORPUS-CONTRACT §6 and CRITIC-DOCTRINE §2.5, where a blind pick landing on ours is evidence the *critic* is broken), the RI-AI07/S17 unit collision, the RI-MTH03 mis-mapping for `combat.feedback.hitstop`, RI-QST05's dependence on stealth/crime, the inconsistent scoring aggregation across areas (10-combat uses weighted sums where 70/100 is "remediable"; 20-progression uses min-over-axes where any axis fails the item), and RI-AI05's unpinned fixture. Coordinate with any parallel amendments proposed in agents' replies.

## 5. Apply the intent-audit corrections
INTENT-AUDIT-01 returned **DRIFTED** with 17 drifts. Doctrine-level ones (ID-01 combat boundary, ID-03 S19/S7 teleport contradiction, ID-09/ID-10 travel) are already fixed in ARBITRATION.md. Apply the **item-level** ones — notably the one-directional travel checks that test only for the ABSENCE of warping (ID-17) and RI-PRG04's scoring that rewards "no warp code path exists" (ID-09). Every travel check must be **two-directional**: failing when the network is missing *and* when it degenerates into warp-to-map-pin.

## 6. `corpus/00-doctrine/CORPUS-COHERENCE-01.md`
The report: what you changed, what you resolved, what remains contradictory, and every constant now under single ownership.

**You MAY edit other agents' reference items** — you are the only agent with that authority. Record every edit in the report.

---

# ACCUMULATED QUEUE (appended by the orchestrator after the writing wave)

The wave is done. Below is everything agents found and **correctly refused to fix unilaterally**,
because they were forbidden from editing other agents' files. You are the only agent with that
authority. Work through all of it.

## A. Seam rulings made mid-wave that must propagate

`ARBITRATION.md` now carries **S16–S21**, all added after most items were written. Sweep the corpus
for text that predates them and contradicts them:

- **S16** dungeon census (8 Souls loops / 82 Morrowind caves)
- **S17** the hour comes from distance, never from slow walking
- **S18** third-person always; no first-person mode
- **S19** magic split; teleport effects are part of the S7 travel network
- **S20** era authority — ESO/2E material is admissible for geography, species, Hist behaviour and
  slow cultural forms; inadmissible for power, politics, named individuals, prices
- **S21** keep the die where failure is permanent, delete it where failure is a retry
- **§1 amendment** — a fight must have non-lethal exits (flee, yield, parley, bribe); crime,
  bounty and faction standing accrue *during* combat; S13 amended accordingly
- **S7 correction** — fast travel is *mandated*, not banned

**Note:** two agents independently proposed "keep the die…" as **S20**; it was adopted as **S21**
because S20 was already taken by era authority. Fix any status file or item that cites it as S20.

## B. Cross-item contradictions found by agents

1. **The traversal minute.** RI-AI07 uses 3.4 m/s over 204 m; S17 and RI-WLD01 mandate 2.0 m/s. A
   70% divergence corrupting every density, runback and sightline figure downstream. **This is the
   single most damaging one.**
2. **RI-WLD02 vs RI-WLD09** contradict directly on density; a critic handed both must fail one.
   RI-WLD09 proposes the per-region fix (see its final section).
3. **RI-WLD05 fails its own threshold** — its `E` column ticks sum to 20, not the asserted 22. And
   element 29 is pure audio, permanently `unmeasurable ⇒ 0` while counted toward the 30.
4. **RI-CMB02 internal contradiction** — §E's ≥6f minimum startup vs §C's ×0.60 rolling multiplier
   on a 6f dagger yields 4f. Five amendments requested by the weapons agent; also its ≥2f
   adjacent-class separation rule is arithmetically impossible at 15 classes.
5. **RI-DLG02 scope discrepancy** — cites 17,298 distinct texts / 504,896 words; recomputation over
   the vendored file gives 28,050 / 1,869,218. **Rule which scope is canonical and restate the
   per-settlement word targets against it**, per `corpus/40-dialogue/data/README.md`.
6. **The Jel validator rejects canon.** `jel-phonotactics.py` scores 26.7% violations against its
   own 5% threshold on attested Jel — it rejects **Saxhleel**, the Argonians' own name for
   themselves, plus Thtithil and Xeech. Fix the validator, not the canon.
7. **Three wrong lexicon glosses** in `jel-lexicon.json`: `xul` is *death/rebirth* not "root"
   (making our "Deep-Kin" read as *Death-Kin*), `uxith` is *nest/home* not "old", `ojel` is
   *outsider* not "tongue". `kaal` collides with an attested word meaning *war captain*. And
   RI-LOR04's name grammar has the minority form as the rule — see `PROVENANCE-UPGRADE-01.md`.
8. **Harness `deviceScaleFactor: 1`** (HARNESS.md §6) makes RI-UIX06's DPR-2 check — the one
   measurement that catches a `CanvasTexture` UI — structurally unmeasurable. RI-UIX06 requests UI
   shots form their own viewpoint set with their own pinned config.
9. **RI-MTH03 still claims `combat.feedback.hitstop`** in its front-matter though RI-AUD01 now owns
   it; G5's second clause needs this dropped.
10. **RI-PRG04 scores the S7 axis backwards** (10 = "no warp code path exists"); travel checks
    across the corpus are one-directional and test only for absence. See RI-TRV01/02's seven
    proposed amendments, including RI-WLD05 #22 and RI-WLD01:185 still carrying pre-correction
    "no fast travel" wording, and `subsystems.json`'s path description reading as a prohibition.
11. **RI-MAG02's price formula degenerates** for the teleport spells (`mark` prices at ~4g;
    `recall`'s price varies with player position). RI-TRV02 prices by `min_tier` instead.

## C. Taxonomy — roughly 90 new paths across eight new roots

None were invented silently; every agent listed theirs. Append to `subsystems.json`, add the new
critic roles, then regenerate `INDEX.md`:

- **`weapon.*`** (20) + `critic.weapons` — see the weapons agent's list
- **`magic.*`** — see RI-MAG items; `combat.magic.casting` is now owned
- **`character.*`** (10), **`stealth.*`** (9), **`crime.*`** (9)
- **`experience.*`** (15), **`composition.*`** (6) + `critic.experience`
- **`journey.*`** (11), **`input.*`** (10), **`platform.*`** (6 new) + `critic.journey` — see
  `corpus/88-journeys/paths-requested.json`
- **`camera.*`** (8) + the camera agent's critic assignment
- Plus `world.traversal.stations`, `world.traversal.schedule`
- RI-VIS01 needs **F17–F19 and CC-7** appended (RI-UIX06 wrote them in its table format)

`corpus-index.mjs --check` currently reports ~137 orphan paths, nearly all of these.

## D. Wrong bars and the intent audit

Apply BAR-CRITIQUE-01's **W1–W8** and INTENT-AUDIT-01's item-level drifts (doctrine-level ones are
already fixed in ARBITRATION.md). Note RI-EXP04's hard fail 6 is marked `pending_amendment` and
**unenforced** until W1 lands — an item may not fail a build for satisfying a rule still binding on
it. RI-EXP04's final section carries the exact RI-WLD05 replacement text.

## E. If `PROVENANCE-UPGRADE-02-SOULS.md` exists when you run

The Souls verification pass may have landed. Apply its amendments too, and treat any finding that
we blended mechanics from different Souls games into one model as high priority.

## F. Finally

Regenerate `INDEX.md` and `GAP-LEDGER`, run `node tools/progress.mjs`, and make
`corpus-index.mjs --check` pass cleanly. Record **every** edit you make in
`CORPUS-COHERENCE-01.md`, including the ones you decided *not* to make and why.
