# CORPUS-COHERENCE-01 — the audit of the corpus itself

> **Author:** `corpus-audit`, wave 0, the only agent authorised to edit other agents'
> reference items. **Scope:** shared-constant integrity, front-matter validity, orphaned
> `judges:` paths, cross-item contradictions, the wrong-bar amendments (BAR-CRITIQUE-01
> W1–W8) and the item-level intent drifts (INTENT-AUDIT-01).
>
> Closes BAR-CRITIQUE-01 **G7** — *"nobody audits the corpus; it has the exact incoherence
> it exists to prevent in the game."*

This document is the **ledger**. Every edit made to another agent's file is recorded here
with the file, the line, the before, the after, and the reasoning. Edits **not** made are
recorded too, with why. Nothing in this file is deleted; corrections are appended.

Companion machine-readable artifact: `corpus/00-doctrine/constants.json` — the shared-constant
registry (one owner per constant, every consumer listed).

---

## 0. Standing rules this audit applied

1. **Smallest edit that resolves the contradiction.** Where a number had to move, the
   *physical* quantity was preserved and only its *label* or *unit* changed.
2. **Never delete an item's reasoning.** Superseded text is struck through or annotated
   in place, never removed. Amendment blocks are appended.
3. **A deliberate divergence is kept, and recorded as one.** Where an item's number differs
   from a reference on purpose, the divergence stays and gains an explicit note saying so,
   so a later reader does not "fix" it.
4. **Rule, don't record-both.** Where two items genuinely disagree, one is made
   authoritative and the other cites it.
5. Every amendment carries the marker `AMENDED wave 0 (corpus-audit)` so it is greppable.

---

<!-- WIP: sections filled in as the sweep proceeds -->

## 1. The traversal-minute collision — RULED

**The contradiction.** `RI-AI07` §A defined the traversal minute at **3.4 m·s⁻¹ / 204 m**.
`RI-WLD01` §Movement speeds and ARBITRATION seam **S17** fix walk speed at **2.0 m·s⁻¹**, and
`RI-WLD02` already computes at **120 m/min**. Two authoritative definitions of the same unit,
**70% apart**. Because the traversal minute is the *denominator* of every density, beat,
sightline and runback figure in RI-AI07, and RI-AI07 is handed to the combat critic alongside
RI-WLD02, a critic given both would have failed one of them for arithmetic that was correct.

**Ruling: 2.0 m·s⁻¹, 120 m per traversal minute.** Reasoning, in order of weight:

1. **S17 is a seam ruling.** ARBITRATION §5 ranks seam rulings above any individual item's
   comparison method. A reference item may not privately define a constant a seam ruling fixes.
2. **RI-WLD01 owns the movement-speed table** — walk 2.0, jog 3.2, sprint 5.0, swim 1.1,
   tide-wade 1.3 m·s⁻¹. **3.4 m·s⁻¹ appears nowhere in it.** It was not the walk, not the jog,
   not the sprint: an unowned number that no item could be held to.
3. **RI-AI07's own provenance note licensed the recomputation in advance**, in terms: *"the
   3.4 m·s⁻¹ reference walk speed is a placeholder … if it changes, the 204 m/TM constant is
   recomputed and every density figure in §D is re-derived, not re-argued."* This audit did
   exactly that and nothing more.
4. Adopting 120 m makes RI-AI07 and RI-WLD02 **commensurable for the first time** — they can
   now be handed to one critic without one of them being wrong by construction.

**Edits made to `corpus/10-combat/RI-AI07-encounter-composition.md`** (11 edits; every original
value kept struck-through or in a "Was" column):

| § | Before | After |
|---|---|---|
| A, definition | 3.4 m·s⁻¹, 204 m/TM | **2.0 m·s⁻¹, 120 m/TM** |
| C, AM1 ambush density | ≤ 1 per 1.5 TM | ≤ 1 per **2.55 TM** |
| D, enemy instances/TM | 2.8 (1.8 – 4.2) | **1.65 (1.05 – 2.45)** |
| D, encounters/TM | 1.5 (1.0 – 2.2) | **0.88 (0.59 – 1.29)** |
| D, traversal minutes per loop | 5.0 (3.5 – 7.0) | **8.5 (5.95 – 11.90)** |
| D, longest enemy-free stretch | 0.6 TM (≤ 1.0) | **1.02 TM (≤ 1.70)** |
| D, longest no-rest stretch | ≤ 1.2 TM | **≤ 2.04 TM** |
| D, region effective enemies/TM | 2.4 / 2.8 / 2.9 / 3.1 / 2.8 | **1.40 / 1.65 / 1.73 / 1.82 / 1.65** |
| E, B3 → terminal separation | ≥ 0.4 TM | **≥ 0.68 TM** (≈ 82 m, unchanged) |
| G, worked example | 5.1 TM; 2.75 e/TM; 1.57 enc/TM; 0.55 TM gap; 0.44 TM sep | **8.67 TM; 1.62; 0.92; 0.94 TM; 0.75 TM** |
| M1 | `TM = path_length_m / 204`; band 1.8 – 4.2; ±0.6 | `/ 120`; band **1.05 – 2.45**; **±0.35** |
| How-we-lose #10 | "Enemies/TM climbs past 5" | "past **2.95**" |
| Provenance note | placeholder clause | resolved; new **§H** amendment record appended |

**Nothing physical moved.** Conversions applied: per-TM rates × 120/204 = ×0.5882; TM-lengths
× 204/120 = ×1.70; **counts, ratios, fractions and metre distances unchanged** (they are
dimensionless in TM). A level that passed §D before this amendment passes it after. That
invariance is the whole point of ruling by re-derivation rather than by re-argument.

**Registered:** `world.walk_speed_mps` (owner `RI-WLD01`) and `combat.traversal_minute_m`
(owner `RI-AI07`, **derived**, not independently settable) in `constants.json`.

**Closes:** BAR-CRITIQUE-01 **W4**; queue item **B1**.

---

## 2. The enemy budget — RULED

**The contradiction.** `RI-PRG06` fixed **576** hand-placed enemies for the whole game, and
every soul value and the entire level curve rest on it. Against that:

| Source | Requires | Enemies |
|---|---|---:|
| `RI-WLD07` §2 — 8 Souls-loop dungeons | stated total, exact | **358** |
| `RI-WLD07` §3 — the 82 Morrowind interiors | 252 – 730 | **≈ 491** |
| `RI-WLD02` D9 — 0.7–1.2 hostile groups/min over `RI-WLD01`'s 25,331 m trunk network (211 min at 2.0 m·s⁻¹), at `RI-AI07` §D's mean 1.9 enemies/encounter | 281 – 481 | **≈ 381** |
| **Reconciled census** | 891 – 1,569 | **≈ 1,230** |

The **interiors alone come to 849**, so 576 could not be the whole game even before the
overworld was counted.

**Ruling — split the ownership rather than pick a number:**

- **`RI-WLD07` + `RI-WLD02` own the enemy census.** How many enemies exist is a world-design
  fact and belongs to the world items, which state it in detail and per-location.
- **`RI-PRG06` owns the soul budget and the level curve** — 1,124,285 souls, L93 at 100%
  clear, L82 typical, 20.0 h. **Unchanged by this amendment.**
- **They are joined by a normalisation rule:** `souls_each_shipped = souls_each_here ×
  576 / N_shipped`, applied per region so each region's soul total equals §1's column
  exactly. At N = 1,230 the factor is **0.468**.
- **576 is redesignated a *floor* on hand-placed enemies and the N its §3 decomposition was
  derived at** — never a ceiling.

This is not a new argument; it is the resolution `RI-PRG06`'s own provenance note already
specified: *"If the map ships 380 or 900 enemies, every soul value must be rescaled to preserve
the cumulative column, which is the binding part."* The audit chose the option the item itself
named, over rewriting the world.

**Edits made to `corpus/20-progression/RI-PRG06-souls-yield-and-pace.md`:** the §1 "576 unique
hand-placed enemies" paragraph annotated; new **§7 Amendment record** with the census table and
the normalisation rule; provenance-note item 1 marked `RESOLVED`; the "roster is a budget"
paragraph annotated. **No soul value, level, hour figure, pace-curve value or scoring threshold
was touched.** §3's tables stand verbatim as the derivation of record.

**Registered:** `world.enemy_census` (owner `RI-WLD07`), `progression.total_souls_first_clear`
and `progression.roster_derivation_n` (owner `RI-PRG06`) in `constants.json`.

**Consequence recorded, not fixed:** `RI-PRG03`'s skill-event budget assumes ~5 hits ×
1,400–2,000 kills. At the reconciled census the kill count roughly doubles, so RI-PRG03 now
*over*-delivers skill progress. Over-delivery is the softer failure and re-deriving RI-PRG03's
skill curve is a design decision, not a coherence repair — see §7, edits not made.

**Closes:** BAR-CRITIQUE-01 G7's second example; queue item under §1 of the brief.

---

## 3. The dialogue-scope discrepancy — RULED

**The contradiction.** `RI-DLG02` §A cites **17,298 distinct texts / 504,896 words**.
`corpus/40-dialogue/data/README.md` reported a recomputation over the vendored file of
**28,050 / 1,869,218** and referred the reconciliation here, noting that the per-settlement
word targets depend on it.

**First finding — the README's recomputation was itself mis-paired, and the queue did not
know this.** 28,050 counts *distinct* response texts; 1,869,218 sums words *per row* over all
69,876 rows, where a row is a speaker permutation, not an entry. The two are different
populations. Their ratio implies **66.6 words per entry**, against RI-DLG02's independently
measured ~24 median / 29.2 mean. Had the targets been restated against that pairing they
would have been inflated by roughly **2.7×** — a far worse outcome than the original
discrepancy.

Recomputed properly (all figures dedup-on-exact-text unless stated):

| Scope | Distinct texts | Words | Words/entry |
|---|---:|---:|---:|
| **Canonical — `Source ∈ {Morrowind, Tribunal, Bloodmoon}`** | **27,875** | **682,372** | **24.5** |
| Full vendored file (adds 4 bundled official plugins) | 28,050 | 687,976 | 24.5 |
| Base `Morrowind.esm` only | 22,502 | 520,654 | 23.1 |
| All rows, undeduplicated (not a valid population) | 69,876 rows | 1,866,989 | — |

**Ruling: the canonical scope is `Morrowind + Tribunal + Bloodmoon`, deduplicated on exact
response text — 27,875 texts / 682,372 words.** Reasoning:

1. It is **exactly the scope RI-DLG02 §A already declares**. The item was not wrong about
   what it meant to measure; its numbers came from a different extraction.
2. It is **reproducible in this repo today**, by anyone, in six lines of Python (the snippet
   is now in RI-DLG02). The 17,298/504,896 figures came from an extraction carrying a `Cell`
   column the vendored file does not have and **cannot be checked at all**. Per the wave-0
   network amendment, a verifiable figure beats an unverifiable one.
3. Its **24.5 words/entry corroborates RI-DLG02's own ~24 median**, measured independently
   by that agent from a different artifact. The two measurements agree on the corpus's shape
   even where they disagree on its extent, which is what makes the substitution safe.
4. The bundled official plugins (`entertainers`, `master_index`, `Siege at Firemoth`,
   `EBQ_Artifact`) are excluded — 177 texts / 5,692 words, 0.8% — because §A names three files.

**Edits made to `corpus/40-dialogue/RI-DLG02-words-per-settlement.md`:**

| Where | Change |
|---|---|
| §A total | 17,298 / 504,896 → **27,875 / 682,372**, with the superseded values kept in a "Was" column |
| §A layers | word counts restated at the preserved shares (74.3 / 12.7 / 13.0%) → 507,003 / 86,661 / 88,708. **Entry counts dashed** — the layer split needs a `Cell` filter the vendored file lacks, so it is honestly not recomputable |
| §D hard rule 1 | locality floor **0.35 → 0.28**; Balmora restated 38,760 / (38,760 + 88,708) = **0.30** |
| Comparison method | "do not compare to Morrowind's 504,896-word corpus" → **682,372** |
| New tail section | the reproduction snippet, provenance move, and the list of deliberate non-changes |

**Second finding — a wrong bar fell out of the scope correction.** At the canonical scope
Morrowind's Balmora scores **0.30** on RI-DLG02's own locality ratio, against a floor of
**0.35**. *The reference loses our bar.* Under CORPUS-CONTRACT §6 that is a broken bar, not a
demanding one. The floor is restated at **0.28**, preserving the original margin below the
reference exactly (0.35/0.37 = 0.946; 0.30 × 0.946 = 0.288). This was not in the queue.

**Restating the per-settlement targets — the ruling is that they do not move, and this is
deliberate.** The brief asked for them to be restated against the canonical scope. Doing the
arithmetic shows the correct restatement is **no change**: §D's tiers (20,000 / 9,000 /
3,000 / 1,500 and their floors) derive from Balmora's **measured 38,760 local words**, not
from the corpus total. The total grew because Tribunal's and Bloodmoon's settlements entered
the population — Mournhold, Raven Rock, Skaal Village, Fort Frostmoth — **not because Balmora
got bigger**. Scaling the targets by 682,372/504,896 = 1.35 would have been an arithmetic
error dressed as a correction. Recorded here so the non-change is not mistaken for an
oversight. §B and §C are unchanged for the same reason.

**Registered:** `dialogue.corpus_scope` (owner `RI-DLG02`) in `constants.json`.
`corpus/40-dialogue/data/README.md`'s discrepancy note is updated in place with the ruling.

**Closes:** queue item **B5**; the brief's §1 dialogue-scope clause.

---
