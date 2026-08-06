# BAR-CRITIQUE-02 — is the repaired corpus sufficient?

**Critic:** bar-critic, second pass. **Date:** 2026-08-06.
**Scope:** all 137 reference items across 20 corpus areas, 323 subsystem paths, all of
`00-doctrine`, `CORPUS-COHERENCE-01`, `METRICS-IMPLEMENTATION-01`, `REBASE-S22-REPORT`,
`ORCHESTRATOR-RULINGS`, `docs/PLAN.md`, and `tools/corpus-index.mjs` run live.
**Judged against:** the fifteen gate conditions I wrote in `BAR-CRITIQUE-01` §6 — not a fresh
set of opinions.

---

# 1. VERDICT: **SUFFICIENT**

**Gates met: 12 of 15.** Three are not met, and none of the three is a design gap. They are a
missing scoring-metadata pass, a missing arithmetic sheet, and a CI invocation that was
asserted to exist and does not. Each is closable in under a day by someone making no design
decisions. They are carried forward in §5 as binding conditions on specific later steps, not
as a reason to hold the wave.

I said in `BAR-CRITIQUE-01` that the corpus "measures the game's parts and never the game."
That is no longer true, and it is not true in a way I did not expect. I asked for an
experience area with standing. What came back was `PLAYTHROUGH-CRITIC.md` §4 — a document
that takes seriously the thing I only gestured at, which is that an agent has no hedonic
ground truth, and answers it not by pretending otherwise but by making the *instrument's
validity an empirical question*: every wave the battery is run over a sabotaged control pair
from the same commit, and **if it cannot separate the live build from the dead one, the
verdict is `VOID`, not `FAIL`.** That is a better answer than the one I proposed. It is the
single most important thing in this repair.

Three other things persuaded me more than any individual item.

**S22.** Verification found that the corpus had adopted Souls community frame counts —
counted in 1/30 s ticks — into a 60 Hz simulation, so every combat duration was half its real
wall-clock length. Our light roll was invulnerable for 217 ms against DS3's 433 ms. Because
every *ratio* stayed internally consistent, this passed every M-script, every trace statistic
and every blind pair, and would have surfaced only as "Souls-ish but wrong" in a human's
hands. The corpus caught it, ruled on it, rebased it, and wrote down the four things the
ruling did not anticipate. A corpus that finds an error invisible to all of its own automated
checks will find its remaining errors. One that only passes its checks will not.

**RI-DLG08 argued back with data.** I proposed an indifference ratio of 0.45–0.75, defined as
the fraction of NPC content that never references the player. The item measured that quantity
over 28,051 distinct texts from the vendored `Morrowind.esm` extraction and got **0.3723** —
*below* my floor. Rather than adopting a band its own reference game fails, it split the
metric: `non_address_rate` keeps a band around the measured value, and the headline
indifference ratio was redefined as a *stance* measure (0.8746 measured, band 0.78–0.92).
That is a corpus correcting its critic, with the arithmetic attached.

**RI-CMP01 declared a debt instead of lowering a bar.** Its 41 seam-crossing cells split 30
world→fight / 11 fight→world, which is 27% — below its own `crossing_both_directions` gate of
one third. It records this as an unmet obligation with a named remedy rather than moving the
gate to 25%. That is the behaviour I most wanted to see and least expected.

The corpus went from 64 items to 137, from 200 paths to 323, and from 148 index errors and 147
orphaned paths to zero. `node tools/corpus-index.mjs --strict` exits 0 with **0 holes, 0
orphans, 0 problems.** Every gap I ranked 1 through 13 is closed or substantively closed.

It is time to build.

---

# 2. The fifteen gate conditions

| # | Condition (abridged from BAR-CRITIQUE-01 §6) | Status | Evidence |
|---|---|---|---|
| **G1** | `corpus/95-experience/` + `critic.experience` + `PLAYTHROUGH-CRITIC.md` granting scoring authority over quality across the whole game; RI-EXP01, 02, 04 at minimum; `experience.*` root | **MET** | Area holds 11 files. `PLAYTHROUGH-CRITIC.md` §1 inverts the coherence remit table clause for clause; §2 grants `wave_experience_verdict ∈ ALIVE / ALIVE_WITH_FINDINGS / **DEAD**` with `min` aggregation and bans "every piece passed" as a defence; §3 sets a FRAGMENT/PARTIAL/FULL dosage (3/8/20 h) with P1–P11 mandatory activities; §4.5 is the sabotage control. All six RI-EXP items exist plus RI-CMP01–03. `subsystems.json` carries 15 `experience.*` and 6 `composition.*` paths and a `critic.experience` role. |
| **G2** | `ARBITRATION.md` §3 carries AR-3 (seam sterility); RI-CMP01 exists with a numeric floor on boundary-crossing interactions | **MET** | AR-3 is the third bullet of §3, requires `seam_sterile: true` with justification in any verdict with zero crossings, and defers the floor to RI-CMP01. RI-CMP01 §H sets per-wave floors on demonstrated crossings (my `≥8` is its W2 floor, then exceeded), §D registers 41 crossings, and its hardest rule is stated first: **a cell that cannot be demonstrated firing in a trace scores zero.** |
| **G3** | RI-EXP06 with ≥12 sanctioned breakages asserted to *work*; no `20-progression` item may add an anti-exploit hard fail without naming a register entry it leaves open | **MET** | RI-EXP06: **15 live entries, 8 systemic, 2 permanent** against thresholds of 12/4/2. Each carries a probe that must **succeed**; `probes_run` is a hard fail, not a metric. `PB-RULE` is symmetric in both directions and clause 3 forbids the register falling below twelve. Wave-over-wave regression detection is hard fail 4 (`REGRESSION` when a previously-passing entry fails with no strike recorded). |
| **G4** | Magic in the corpus: `ARBITRATION` S19, RI-MAG01 (effects+spellmaking) and RI-MAG02 (casting) minimum; `magic.*` paths; `combat.magic.casting` no longer a hole | **MET** | S19 is in §2 and splits the seam explicitly ("Ruling added wave 0 in response to BAR-CRITIQUE-01 G4"), reconciles Mark/Recall/Intervention with S7, and bans teleport as a level-design solvent. **20 `magic.*` paths.** RI-MAG01–05, 55 effects. `combat.magic.casting` → RI-MAG01 + RI-TRV02 in INDEX.md. |
| **G5** | RI-CMB09 (impact/hitstop) and RI-AUD01 (combat audio) exist; `combat.feedback.hitstop` no longer lists RI-MTH03 | **MET** | The hitstop item arrived as **RI-WPN05** rather than under my proposed ID — irrelevant, the bar is what matters. `combat.feedback.hitstop` → RI-WPN05 + RI-CAM06 + RI-AUD01. `audio.combat.impact` → RI-AUD01 + RI-AUD02. Audio grew from 4 paths / 3 holes / 1 world-item to 5 dedicated items with a `critic.audio`. W5 applied: all five of RI-MTH03's false mappings removed; it keeps only `process.critic.discipline` and `process.verdict.format`. |
| **G6** | A `camera.*` root with ≥6 paths, and RI-CAM01 covering the S18 clause list with thresholds in the game's three worst geometries | **MET WITH DEFECT** | RI-CAM01–07 cover S18 in more depth than I asked: rig geometry and spring arm, free-camera mapping, lock-on containment, locked movement and directional roll, the camera outside the fight (including the first-person ban and AR-2 on shot-reverse-shot dialogue), camera feel as derivative statistics, and third-person character presentation. Shared values with RI-CMB06 §B are marked `[CMB06]` and locked against unilateral change. **But there is no `camera.*` root and no `critic.camera`** — all seven items resolve onto `combat.camera.behaviour` plus paths owned by other areas. See defect **N6**. |
| **G7** | `constants.json` with one owner per constant; RI-MTH05; W4 resolved; the enemy-budget contradiction reconciled with explicit arithmetic in one item; **an aggregate content-budget sheet with a stated feasibility argument** | **NOT MET** | First four clauses met and met well. `constants.json`: 28 constants, one owner each, **plus three deliberate divergences recorded as divergences rather than flattened** (RI-STL01 sneak 0.85 m/s, RI-CRM01 guard pursuit 3.4 m/s, RI-MAG02 levitation 0.8 m/s) — that is the right instinct. W4 resolved: the traversal minute is 120 m, owned by RI-AI07, with eleven figure groups re-derived. Enemy budget reconciled in `RI-PRG06` §7 with the census table and the normalisation rule `souls_each × 576 / N_shipped`. RI-MTH05 exists with C1–C5. **The fifth clause is not met: no aggregate content-budget sheet exists anywhere.** See defect **N2**. |
| **G8** | `stealth.*` and `crime.*` roots with RI-STL01 and RI-CRM01; RI-QST05 amended per W6 to `unmeasurable → 0` | **MET** | 9 `stealth.*` + 9 `crime.*` paths, `critic.stealth` registered. RI-STL01 (detection and sneak), RI-STL02 (theft, locks, fencing), RI-CRM01 (witnesses, bounty, arrest, jail), RI-CRM02 (faction crime and writs). W6 applied: VERB-SPREAD ≤40% promoted from band condition to **hard fail**, and RI-QST05 now formally depends on RI-STL01/02 and RI-CRM01 with PACIFIST-ALL scoring `unmeasurable → 0` if they are absent. S21 was added at the stealth author's request and rules where the die survives — a genuinely good principle that neither reference game states. |
| **G9** | Player moveset contract with the archetype answer matrix; weapon identity; `combat.attack.charge` and `combat.weapon.identity` no longer holes; the arrows priced in RI-PRG05 have a mechanic | **MET** | RI-WPN01 §E is titled "The answer matrix (BAR-CRITIQUE-01 **G9**)": every RI-AI05 archetype × answering slot × region of availability, with M5 hard-failing any archetype whose earliest answer arrives after its first appearance **and** any archetype whose only answer is a `shoot` slot out-ranging its aggro radius — "out-range it wearing a mechanic's clothes". 20 `weapon.*` paths, RI-WPN01–06, a `moveset.schema.json`, and a dedicated `WEAPON-CRITIC.md`. Ranged is present across six items. |
| **G10** | `character.*` with RI-CHR01; `progression.build.identity` no longer a hole | **MET** | 10 `character.*` paths. RI-CHR01 (creation flow, custom class, irreversibility), RI-CHR02 (race and standing), RI-CHR03 (birthsigns — nine tides, three that take something from you). `progression.build.identity` → RI-CHR01 + RI-CHR03, with RI-CMP03 (build-identity viability) as the composition-side check. |
| **G11** | RI-WLD09 (opacity budget) and RI-DLG08 (tonal range / indifference ratio) exist | **MET** | Both exist and both are *measured*, not asserted. RI-WLD09's void tracts forced a resolution of my own W2 against RI-WLD02 — see below. RI-DLG08 measured eleven surface statistics and the full indifference decomposition over the real Morrowind dialogue extraction, and corrected my proposed band with the arithmetic attached. |
| **G12** | RI-PLT01 exists and `CRITIC-DOCTRINE` §2.4.3 cites it, so the fidelity/performance trade is judgeable rather than banned | **MET WITH DEFECT** | 13 `platform.*` paths, `critic.platform`, RI-PLT01 (frame budget, M1–M15), RI-PLT02 (memory and asset budgets), RI-PLT03 (load, streaming, hitches), with the two-tier valid-here/needs-hardware split. §2.4.3's clause — "platform limits are judged only where a `platform.*` item explicitly sets the budget" — now resolves, because one does. **But neither §2.4.3 nor RI-VIS04's "a different corpus area" sentence names the item or the area**, so a fresh critic reading either cannot find the budget. See defect **N7**. |
| **G13** | Wrong bars W1–W8 amended as specified | **NOT MET** | **W1** applied (RI-WLD05: ≤12 in the first 30 min, ≥26 by hour 10, 30 by hour 18, no empty 90-min window after hour 2; M24's sign reversed; and the audit found the item's own E column summed to 20, not the 22 it claimed). **W2** applied (D1/D2/D13 scoped to settled regions; V5/V6 added as peers so it is now possible to fail RI-WLD02 for having *too little* emptiness; the witness-prop anti-abuse clause is a good addition I did not think of). **W3** applied (`ours_win_rate` demoted from pass condition to reported statistic; `professional_bet_accuracy ≤ 0.65` and `judge_cannot_name_a_consistent_tell` are the pass metrics; `ours_win_rate > 0.5` now VOIDs the run). **W4** applied. **W5** applied. **W6** applied. **W8** applied (`fixture: wave-standard-build` pinned; unstated fixture is `unmeasurable ⇒ 0`). **W9** correctly left alone. **W7 is not applied.** The rule is in `SCORING.md` §1.2; the per-item execution is not. See defect **N1**. |
| **G14** | `corpus-index.mjs` reports 0 front-matter errors; `--check` is a blocking CI gate; every remaining hole filled or accepted in writing | **NOT MET** | First and third clauses met: `--strict` exits 0 with 323 paths, 137 items, **0 errors, 0 warnings, 0 unresolved paths, 0 holes**, and `ACCEPTED-HOLES.md` is the register (currently empty, because all fourteen holes were closed with real items rather than accepted). **Second clause not met:** there is no `.github/`, no `package.json`, and no git hook. Nothing runs `--check`. RI-MTH05 M8 states it "is wired as a blocking gate". It is not. See defect **N5**. |
| **G15** | Every stated user requirement maps to ≥1 reference item | **MET** | All eleven areas I listed as mapping to zero now map to real items: magic/spellmaking/enchanting → RI-MAG01–05; character creation and race → RI-CHR01–03; stealth → RI-STL01–02; crime and justice → RI-CRM01–02; ranged combat → RI-WPN01 §E; hit impact and combat audio → RI-WPN05 + RI-AUD01; the camera → RI-CAM01–07; the endings → RI-EXP05; the first hour → RI-EXP01 + RI-JRN02; the shape of a session → RI-EXP03; whether it is fun → the whole of `95-experience` under `PLAYTHROUGH-CRITIC.md`. |

**Tally: 12 met (two with named defects), 3 not met — G7, G13, G14.**

---

# 3. The thirteen gaps

| Rank | Gap | Status | Note |
|---|---|---|---|
| **1** | The only agent that plays the game is forbidden from having an opinion about it | **CLOSED** | And closed better than proposed. `PLAYTHROUGH-CRITIC.md` grants standing, sets dosage, and — the part I did not specify — makes the instrument's own validity a per-wave empirical test (§4.5). The `DEAD` wave verdict mirrors the coherence agent's `INCOHERENT`. §10 pre-registers the eight ways the role fails, of which "the control is never run" is correctly named as the most likely. |
| **2** | Arbitration policed in one direction only; nothing checks whether the seam is *too clean* | **CLOSED** | AR-3 + RI-CMP01. The demonstrated-not-declared rule is the load-bearing part and it is stated as the item's hardest rule, first. RI-CMP02 (emergence fuzzing) and RI-CMP03 (build-identity viability) were not asked for and are the right two companions. |
| **3** | Anti-exploit monoculture; no bar defends the player's right to break the game | **CLOSED** | RI-EXP06, 15 entries against a floor of 12, probes that must succeed, a symmetric cross-rule, and a wave-over-wave regression hard fail. The item is honest that B-08 is conditional on a ruling that does not exist and that entries will be struck — hence the three-entry margin. |
| **4** | Magic does not exist in the taxonomy | **CLOSED** | S19 + 20 paths + 5 items + 55 effects + `critic.magic`. S19 also resolved a contradiction with S7 that I did not spot (an earlier drafting banned utility teleport outright). |
| **5** | Nothing judges impact; combat is specified to *measure* like Souls, not *feel* like it | **CLOSED** | RI-WPN05 (hitstop, material impact, whiff, mass), RI-CAM06 (camera-side hitstop and shake), RI-AUD01 (combat impact audio with onset within one frame and a parry ring identifiable with the screen off). The false RI-MTH03 mapping is gone. |
| **6** | Camera: one path, no item, against an eighteen-clause seam ruling | **SUBSTANTIVELY CLOSED** | Seven items, in depth, with the own-body-legibility check S18 says is the reason it exists. The taxonomy half is not done — see **N6**. |
| **7** | Nobody audits the corpus | **CLOSED** | `CORPUS-COHERENCE-01` is 1,114 lines and is the most valuable single document produced by this repair, because §11b ("edits deliberately NOT made") and §12 ("what remains contradictory") are longer and more useful than the fix list. It found things I did not: RI-CMB02 contradicting itself with an arithmetically impossible rule; RI-LOR06 judging nothing at all; the Jel validator rejecting canon; `deviceScaleFactor: 1` making the fake-UI check unmeasurable. |
| **8** | Stealth, crime and justice have no paths, and three items depend on them | **CLOSED** | 18 paths, 4 items, a critic, a seam ruling (S21), and W6 applied so RI-QST05 can no longer be satisfied by speechcraft alone. |
| **9** | The player's verb list is smaller than the corpus assumes | **CLOSED** | RI-WPN01–06 + the answer matrix. `combat.attack.charge` and `combat.weapon.identity` are judged by real items. |
| **10** | Character creation, race and birthsign: no path, no item, two items depend on them | **CLOSED** | RI-CHR01–03 + 10 paths. RI-CHR02 in particular does the thing the gap was about — making the Argonian-in-Black-Marsh premise pay mechanically. |
| **11** | No opacity budget | **CLOSED** | RI-WLD09, and it did more than exist: it forced the W2 resolution, and its witness-prop clause ("emptiness somebody walked through has litter in it, and unbuilt terrain is spotless") closes the obvious abuse of declaring a void over the land you did not build. |
| **12** | Tone is checked for consistency and never for existence | **CLOSED** | RI-DLG08, measured against 28,051 real texts, with anti-gaming floors on both sides of the indifference ratio. |
| **13** | Platform budget is a hole while "good for a browser game" is a banned defence | **CLOSED** | RI-PLT01–03 with the two-tier split. Two cross-references still dangle (**N7**). |

**13 of 13 closed or substantively closed.** The two "substantive" qualifications are taxonomy
and cross-reference hygiene, not missing bars.

---

# 4. New defects introduced by the repair, ranked

Seventy-three new items and nine new seams is a large amount of new surface. This is what it
brought with it.

### N1 — Thirty-five items score **zero** under a rule the repair itself created

`SCORING.md` §1.2, as amended for W7, requires every reference item's `## Scoring` section to
carry a fixed row giving the native score that maps to ladder 4, 6 and 8, plus its own
aggregation rule, and states: **"An item with no ladder row is `unmeasurable` and scores 0",
fail-closed.**

Measured across the corpus today:

- **6 of 137** items carry the mandated row verbatim — all six are `12-weapons`.
- **102 of 137** carry a native-score band table that does the job in a different format
  (RI-EXP01's `≥ 85 → 8`, RI-CMP01's `Native → ladder anchors:` prose). These are
  substantively compliant and formally not.
- **35 of 137 carry no native→ladder mapping in any form** and therefore score 0 as written.

The 35 are not scattered. They are **all six `86-ui` items** — including RI-UIX02, which is
the enforcement point for AR-2/S8, the most-cited arbitration rule in the corpus. **Four of
five `87-audio` items.** **Five of eight `40-dialogue` items**, including RI-DLG01 (the topic
graph) and RI-DLG05 (the journal). **Five of seven `60-lore` items.** **Seven of nine
`30-quests` items, including RI-QST06** — the main quest architecture, the single
most-requested creative deliverable in the brief and the item I flagged in §5.1 as the corpus's
thinnest load-bearing spot. Plus six of nine `70-visual`, RI-AI01 and RI-MTH01.

Three of the fourteen wave-1 pieces in `docs/PLAN.md` — `quests.main`, `quests.factions`,
`dialogue.topics` — are therefore **unscoreable on day one**.

What makes this a defect of the repair rather than an inherited one: `CORPUS-COHERENCE-01`
§12.2 named it honestly at the time ("126 items do not yet carry the row, and under the rule as
written they would all be `unmeasurable ⇒ 0`"). **Seventy-three items were then written after
the rule was live, and only the six weapons items complied.** The rule is mandatory, is
fail-closed, and is invisible to `corpus-index.mjs --check`, so nothing told the authors it
existed. That is the exact shape of the failure W5 described: a stated rule with no enforcement
behind it.

**Fix:** one pass by area owners filling the row for the 35, plus a format reconciliation for
the other 96 (or an amendment to §1.2 accepting any table that maps a native band to a ladder
number, which is the cheaper and equally sound option). Then add the row's presence to
`corpus-index.mjs --check` as C6 so it can never silently lapse again.

### N2 — The corpus grew 114% and nobody re-summed it. There is still no aggregate content budget.

This was the third clause of G7 and it is the only gap on my original list that is materially
*worse* than when I wrote it.

The enemy budget was reconciled properly — 576 redesignated a derivation-N and a floor, the
census set at 1,230, and a normalisation rule that preserves RI-PRG06's soul column. That was
one axis. Nobody did the others, and 73 new items added new counts.

Summing what the corpus currently demands, from the items themselves:

| Source | Demand |
|---|---|
| RI-DLG02 tier targets × `settlements.json` (1 capital, 2 cities, 3 towns, 2 villages, 16 minor) | **≈ 117,000 words** of settlement-local dialogue at target |
| RI-DLG02 locality ratio ≥ 0.28 | a global reachable pool on the order of **80–90,000 words** |
| RI-LOR03 | **112 texts**, median 520 words, p90 1,600 ≈ **65,000 words**, ≥3 multi-volume |
| RI-QST01 × the faction lines | **24–28 quests per line** |
| RI-QST07 | **≥ 5.5 × N ≈ 80** side quests, ≥40% non-`given` |
| RI-QST06 | a main quest at Morrowind's depth (Morrowind's is ~28 quests) |
| `settlements.json` + RI-WLD07 | **269 named NPCs**, **250 interiors**, 8 Souls-loop dungeons, 82 caves |
| RI-WLD07 / RI-WLD02 | **1,230 hand-placed enemies** over 14.5 km² |
| RI-WLD05 | 30 strangeness elements × ≥6 placed instances = **180 instances** |
| RI-MAG02 | **55 spell effects**, ≥12 with an out-of-fight use |
| RI-WPN02 | **15 weapon classes**, each with a full moveset to `moveset.schema.json` |
| RI-CHR01/03 | ≥6 origins, **9 birthsigns**, a custom-class system |
| RI-EXP06 | **15 working sanctioned breakages** |
| RI-CMP01 | **41 seam crossings, each demonstrated firing in a trace** |
| RI-WLD09 | **≥15 opacity register entries**, ≥5 void tracts |

That is an authored surface at or above Morrowind's base game, for a browser game, and **no
item, report, or plan states the total or argues that it is reachable.**

Why this matters more than it looks: a dozen items individually warn against meeting their
count by duplication, and RI-DLG02 even has a cross-settlement Jaccard duplication check. But
duplication is not the failure mode an unreachable aggregate produces. **Uniform thinning is** —
every count met, every count met at its floor, every settlement at exactly 6,000 words, every
faction at exactly 18 quests, and no instrument in the corpus that fires when everything is
simultaneously at the minimum. RI-EXP04's novelty curve and RI-EXP02's anecdote census are the
closest thing to a defence and neither is an aggregate check.

**Fix:** `corpus/00-doctrine/CONTENT-BUDGET.md` — one table summing every count threshold in
the corpus into totals for words, quests, NPCs, interiors, enemies, unique assets and placed
instances; each total carrying a named owning item; and one paragraph, signed, stating whether
the total is producible in the planned number of waves and what gets cut first if it is not.
It is half a day of arithmetic and one judgement. It should be done before wave 1's content
pieces are briefed, not after.

### N3 — The wave plan did not grow with the corpus

`docs/PLAN.md`'s wave-1 decomposition is unchanged: fourteen pieces, written against a
200-path taxonomy. There is no builder for camera, character creation, weapon movesets, magic,
stealth, crime, UI, audio or platform.

Against that, the new items are not optional in wave 1:

- **RI-EXP01** is a `DEAD`-capable item whose binding beat sheet (B01–B18) requires character
  creation, ≥7 exercised verbs including sneak, and a hub with ≥3 unfenced exits.
- **RI-QST05**'s PACIFIST-ALL is now `unmeasurable ⇒ 0` without RI-STL01/02 and RI-CRM01. The
  W6 fix I asked for makes wave 1 fail the quest dimension by construction if stealth and
  crime are not built.
- **RI-CMP01**'s crossing floor cannot be met by fourteen pieces that do not include most of
  the systems that cross.
- **S18/S25 interact**: water depth is read off the player's own silhouette against anatomical
  landmarks, which makes the third-person camera load-bearing for the water model, not a
  presentation choice deferrable to a later wave.

This is not a corpus defect — it is the orchestration consequence of a corpus that doubled. But
it will present as a corpus defect in wave 1's verdicts, as a run of hard fails on items whose
prerequisites were never assigned.

**Fix:** re-derive the wave-1 piece list against all 323 paths and assign every path a wave,
so that "not built yet" is a declared state rather than a surprise at scoring time.

### N4 — RI-VIS03 still carries four bands its own reference population fails

This is the direct answer to "does any new bar fail its own reference game the way RI-DLG02's
locality floor and M9's ShoulderRatio did." Yes — and it is M9 itself, still live.

`tools/metrics/image-metrics.mjs` now implements all twelve metrics with a self-test that
proves the instrument can fail, which is real and welcome progress from two. But
`METRICS-IMPLEMENTATION-01` §8 states the position plainly: **M1 and M8 are calibrated; M2, M4,
M5 are close; M3, M6, M9 and M10 have bands that the reference population fails; M11 and M12
have never been run on real data at all.**

Specifically, with the necessary `highlight_frac` gate already applied, **17 of 24 real
Witcher 3 next-gen frames still hard-fail `M9.ShoulderRatio < 0.12 → LINEAR CLAMP`, and not one
of them is a linear clamp.** `M10.R_aerial`'s band 0.25–0.70 is failed at p10, p50 and p90 by
the same population. The report proposes the corrections with the evidence attached, in exactly
the form RI-VIS03's own step 7 demands — and **RI-VIS03 has not adopted them.** A grep of the
item for `ShoulderRatio`, `advisory` or an amendment block returns only the original band table.

Compounding it: the modern fidelity reference set holds **one usable HUD-free frame** against
RI-VIS03's own requirement of ≥3 legally-usable frames per profile across four profiles. Only
`exterior_daylight` has any population at all, and that one is HUD-bearing and barred from
numeric comparison by the acquisition request's own §5a.

So the fidelity dimension today has a working instrument pointed at bands that are known-wrong
for four of twelve metrics, and no calibration population for three of four profiles. The
honest state is that **`critic.fidelity` cannot issue an admissible verdict yet**, and nothing
in the corpus says so. Two of the report's own withdrawals (W1, W2) show why this must not be
rushed — both were band amendments computed from a broken statistic, and adopting either would
have hard-coded an instrument bug into the corpus.

**Fix:** adopt A1–A3 and the two withdrawals into RI-VIS03 now (the direction is unambiguous
and independently confirmed); mark M3, M6, M9, M10 **advisory, not scoring**, until the modern
set lands; and record in RI-VIS02 that fidelity verdicts are `unmeasurable ⇒ 0` until each
profile has its ≥3 frames. This is not a wave-1 blocker — visual fidelity is wave 4 — but it
must be written down now, because a critic reading RI-VIS03 today would fail a correct
renderer.

### N5 — `--check` is asserted to be a blocking CI gate and is wired to nothing

`RI-MTH05` M8: *"`--check` is wired as a blocking gate. It must run on any change to…"*, and
its failure mode 4 is *"`--check` made non-blocking, or the gate removed from CI."*

There is no `.github/`, no `package.json`, and no git hook in the repository. Nothing invokes
it. The tool itself is good and exits nonzero correctly — but a gate nobody runs is exactly the
false-enforcement pattern W5 identified: it tells a reader the check is happening and it is not.
This is the mechanism that let 147 orphaned paths and three doubly-owned constants survive an
entire wave while `INDEX.md` reported "up to date".

**Fix:** a pre-commit hook or a two-line CI job running `node tools/corpus-index.mjs --check`.
Twenty minutes. Until it exists, RI-MTH05 M8 should say "must be wired", not "is wired".

### N6 — Seven camera items, one subsystem path

RI-CAM01–07 all resolve onto `combat.camera.behaviour` plus paths owned by other areas
(`combat.player.movement`, `ui.dialogue.presentation`, `render.fidelity.character`,
`platform.determinism.harness`). There is no `camera.*` root and no `critic.camera`.

`CORPUS-COHERENCE-01` §11b gives the reason and it is a good one: registering eight unused
paths would have created eight new corpus holes and blocked builders on subsystems no item
judges — strictly worse than doing nothing, *"if the camera area wants its own root, the items
must move their `judges:` in the same commit."* That is exactly right, and it is also the fix,
which nobody has performed.

The residual cost is real: `critic.combat` silently inherits the exploration camera, dialogue
framing, interior collision and comfort; there is no path on which a defect in any of those can
be recorded as a hole; and the hole count — the corpus's only automated coverage signal —
cannot see camera coverage regress. Given S18 is the user's single most explicit instruction
and S25 makes the third-person body load-bearing for the water model, that is more exposure
than the taxonomy should carry.

**Fix:** one commit that adds `camera.*` (rig, springarm, lockon.framing, explore, dialogue,
comfort, presentation) and moves RI-CAM01–07's `judges:` onto them in the same change, so the
hole count never goes above zero.

### N7 — Two dangling cross-references that make correct behaviour undiscoverable

`CRITIC-DOCTRINE.md` §2.4.3 still reads *"Platform limits are judged only where a `platform.*`
item explicitly sets the budget"* without naming RI-PLT01. `RI-VIS04` still reads
*"Performance is a different axis with a different corpus area"* without naming
`corpus/85-platform/`. Both sentences were written when the area did not exist and both now
resolve — but only for a reader who already knows. A fresh `critic.fidelity` with no context,
which is the design, cannot follow either.

**Fix:** two one-line edits.

### N8 — Two of the seven "judged by an item about something else" thin spots survived

Five of my §5.3 thin spots were closed with real items — `world.persistence.state` → RI-CRM01,
`world.property.ownership` → RI-STL02, `world.locks.security` → RI-STL02, `ui.hud.combat` →
RI-UIX01, `coherence.systems.composition` → RI-CMP01, `lore.canon.argonian` → RI-LOR07. Two did
not:

- **`progression.crafting.alchemy`** — the whole crafting loop — is still judged by
  **RI-PRG03**, a skill-growth-curve item, on one axis.
- **`progression.inventory.model`** is still judged by **RI-QST08**, a reward-design item.

Alchemy is one of Morrowind's four signature systems, is named in RI-CMB08's leakage warning,
and is one of the systems RI-EXP06's permissiveness register most obviously runs through — the
alchemy loop is the canonical Morrowind sanctioned breakage. It should not be one axis of
someone else's item. Not a wave-1 blocker; wave-3 content depends on it.

Also disclosed and worth carrying: **RI-PRG03's skill-event budget now over-delivers** at the
reconciled 1,230-enemy census (the kill count roughly doubled). The audit recorded this and
correctly declined to retune it, since re-deriving a skill curve is design work. It is a real
open number.

---

# 5. Would a game that scored well on all 137 items be the thing that was asked for?

Last time my answer was no: you could pass everything and be hollow, because nothing in the
corpus looked at the game. That answer has changed, and the reason is not that there are 73
more items. It is one specific mechanism.

A build that scores at the bar on `95-experience` has, necessarily:

- a first hour with a decision that persists inside 14 minutes, content the player found rather
  than was handed inside 10, a verifiable lie and a stateful refusal inside 20, two authored
  events with no explanation attached, four named NPCs with opinions about each other, three
  unfenced exits from the hub of which one is lethal, and under 400 characters of instructional
  text (RI-EXP01);
- **≥1.5 verified anecdotes per hour**, where "verified" means located in the trace within ±2
  minutes with every proper noun resolving against `game/data/**`, and inventing one costs −1
  (RI-EXP02, `PLAYTHROUGH-CRITIC` §4.6);
- no 90-minute window after hour 2 without a first-time event (RI-EXP04);
- fifteen working, probed, deliberately-unclosed exploits, at least eight arising from two
  systems meeting (RI-EXP06);
- a floor of demonstrated seam crossings, each shown firing in a trace, in both directions
  (RI-CMP01);
- and an ending whose antagonist's case survives it (RI-EXP05).

That is not a hollow game. But the reason I now believe it is because of §4.5. Every one of
those numbers is meaningless in isolation — nobody knows what `detour_rate = 2.1/h` should be.
The corpus's answer is that the battery is **only ever interpreted as a difference from a
control**: each wave, the same commit is run twice, once through a sabotage filter, the critic
is not told which is which, and **if the instrument cannot separate them at the stated margin
the verdict is `VOID`, not `FAIL`.** That converts "can an agent tell whether a game is any
good" from a philosophical objection into a per-wave experiment with a recorded answer. I
proposed nothing this good and I would not have thought of it.

Two honest routes by which it could still be hollow, both named by the corpus itself:

**(a) The control lapses.** `PLAYTHROUGH-CRITIC` §10 identifies this as the most likely single
failure: the control is the most expensive thing in the corpus and the least obviously
necessary, and once it stops running the numbers become decoration and the area reverts to the
travelogue §4.8 bans. There is currently **no mechanical enforcement** — it depends entirely on
the orchestrator producing sabotage variants every wave. The verdict extension has a
`sabotage_control` object but nothing rejects a verdict that omits it.

**(b) Everything the harness cannot reach.** §4.7 is admirably honest about this: audio, impact,
tactile feel, input latency, frame rate, physical comfort, beauty, frustration, fatigue, and
attachment over weeks are all outside the instrument. They score `unmeasurable ⇒ 0`,
fail-closed, which is the right rule and does not make them measured. §4.7 then says the true
thing: *"the ultimate instrument for those properties is a human playing the game, and this
corpus should say so."*

**The corpus does not yet say so anywhere binding.** There is no item, no doctrine clause and no
wave gate requiring that a human ever play this before it is called done. `PLAYTHROUGH-CRITIC`
describes its own job as *"a machine for pointing a human at the right five percent of the
game"*, builds exactly the right packs to do it — the worst-twenty-minutes clips, the blind
first hours, the two endings, the sabotage pair — and then nothing requires anyone to look at
them. That is the last real hole in the bar, and it is not one I can close by commissioning
another reference item.

Otherwise: yes. A build at the bar on these 137 items is Morrowind's world, quests, dialogue,
factions, journal, lore and strangeness, with Dark Souls' combat, in Black Marsh — and, because
of S22, at the right speed.

---

# 6. Carry-forward conditions

These do not block a builder from starting. Each blocks a specific later step, and each is
concrete and checkable.

**C1 — Before any wave-1 verdict is issued.** Every reference item carries a native→ladder
mapping. Close the 35 with none; either reconcile the other 96 to the mandated format or amend
`SCORING.md` §1.2 to accept any table mapping a native band to a ladder number. Add the check
to `corpus-index.mjs --check` as C6 so it cannot lapse.
*Checkable:* `--check` exits 0 with C6 enabled.

**C2 — Before wave 1's content pieces are briefed.** `corpus/00-doctrine/CONTENT-BUDGET.md`
exists: one table summing every count threshold in the corpus into totals for words, quests,
NPCs, interiors, enemies, placed instances and unique assets; each total with a named owning
item; and a signed paragraph stating whether the total is producible in the planned waves and
what is cut first if not.
*Checkable:* the file exists, every total names an owner, and the feasibility paragraph names a
cut order.

**C3 — Before wave 1 starts.** `node tools/corpus-index.mjs --check` runs automatically on any
change to `corpus/**` — CI job or pre-commit hook, either is fine. And `docs/PLAN.md`'s wave-1
piece list is re-derived against all 323 paths, with every path assigned a wave.
*Checkable:* the hook or workflow file exists and fails a deliberately broken front-matter; no
path in `subsystems.json` lacks a wave assignment.

**C4 — Before any wave is declared complete.** One clause, in `PLAYTHROUGH-CRITIC.md` or
`SCORING.md`, requiring (a) that `sabotage_control.picked_correctly` be present in every
`critic.experience` verdict and rejected as a schema error by `tools/verdict-validate.mjs` when
absent, and (b) that a human spend twenty minutes on the packs the playthrough critic builds
before a wave is signed off. §4.7 already says this is the ultimate instrument; the corpus
should make it an obligation rather than an observation.
*Checkable:* the validator rejects a verdict with no sabotage control; the wave sign-off record
names the human and the date.

**C5 — Before wave 4 (visual).** RI-VIS03 adopts `METRICS-IMPLEMENTATION-01` §7.1's A1–A3 and
§7.2's two withdrawals; M3, M6, M9 and M10 are marked advisory-not-scoring until the modern
reference set lands; RI-VIS02 records that fidelity verdicts are `unmeasurable ⇒ 0` for any
profile with fewer than three legally-usable frames.
*Checkable:* RI-VIS03 carries an amendment block; `image-metrics.mjs` reports the four as
advisory.

**C6 — Housekeeping, any time.** Add the `camera.*` root and move RI-CAM01–07's `judges:` in
the same commit. Name RI-PLT01 in `CRITIC-DOCTRINE` §2.4.3 and `corpus/85-platform/` in
RI-VIS04. Give `progression.crafting.alchemy` an item of its own.

---

## Closing note

The people who wrote this corpus were told their work measured the parts and never the game,
and instead of adding an item that says "is it fun: yes/no", they wrote a document that begins
by explaining, in five specific ways, why an agent cannot answer that question — and then
designs around all five. The rule that a memory is what survives a 500-word baton across twelve
agents is a genuinely original piece of instrument design. The rule that inventing a memory
scores −1 rather than 0 is the kind of detail that only occurs to someone who has watched the
failure happen.

They also found, unprompted, that their own combat system was running at double speed and
would have passed every check they had, and they wrote that down in a ruling that begins by
saying the exemplar trace must be regenerated and the cost is accepted.

Three things remain and none of them is a design question. Build it.

**SUFFICIENT.** 12 of 15. Six carry-forward conditions above.
