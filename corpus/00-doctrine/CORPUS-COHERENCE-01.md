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

## 4. `subsystems.json` and `INDEX.md` — index integrity restored

**Before:** `node tools/corpus-index.mjs --check` reported **148 errors**, of which **147 were
orphan `judges:` paths** across **134 distinct path spellings**. An item with an unresolvable
`judges:` path **judges nothing** — it does not appear against any subsystem in INDEX.md §2, so
the orchestrator never hands it to a critic, and nothing in the toolchain noticed, because
`--check` only gated on whether INDEX.md was stale.

**After:** **0 errors, 0 unresolved paths.** 323 canonical paths (was 200), 125 reference items,
**309 paths judged**, 14 holes — all 14 pre-existing; every path registered by this audit is
judged by at least one item.

### 4a. Paths registered — 123 across eight new roots

| Root | Paths | Source | Critic |
|---|---:|---|---|
| `weapon.*` | 20 | authored here from the six `RI-WPN*` items' front-matter | **`critic.weapons`** (new) |
| `magic.*` | 20 | `corpus/25-magic/subsystems-patch.proposed.json`, applied verbatim | **`critic.magic`** (new) + `critic.combat` for `magic.casting.*` |
| `journey.*` / `input.*` / `platform.*` | 28 | `corpus/88-journeys/paths-requested.json`, applied verbatim | **`critic.journey`** (new) |
| `experience.*` | 15 | authored here from `RI-EXP01–06` | **`critic.experience`** (new) |
| `character.*` | 10 | authored here from `RI-CHR01–03` | `critic.progression` (+`critic.dialogue` for `character.race.dialogue`) |
| `stealth.*` | 9 | authored here from `RI-STL01–02` | **`critic.stealth`** (new) |
| `crime.*` | 9 | authored here from `RI-CRM01–02`, `RI-CHR02` | `critic.stealth` |
| `composition.*` | 6 | authored here from `RI-CMP01–03` | `critic.experience` |
| `world.*` additions | 5 | `world.traversal.stations`, `world.traversal.schedule`, `world.npc.schedule`, `world.ecology.behaviour`, `world.ambient.events` | `critic.world` |
| `lore.*` addition | 1 | `lore.religion.metaphysics` | `critic.lore` |

Every appended record carries a `registered: "wave-0 corpus-audit…"` field naming where it came
from, so a later reader can tell a path an agent requested from one this audit invented.
`subsystems.json` went to `version: 2`; nothing was renamed or removed — the file is append-only
and stayed that way.

**Two agents had already done this work properly** and their files were applied unchanged:
the journeys agent's `paths-requested.json` and the magic agent's
`subsystems-patch.proposed.json` were both pre-formatted in `subsystems.json`'s exact record
shape. That is the pattern other agents should copy.

### 4b. Dead `judges:` paths fixed to canonical spellings (not aliased)

The brief called for these to be **fixed**, not papered over with new aliases — an alias would
have left the wrong spelling in the item forever.

| Item | Dead | Fixed to |
|---|---|---|
| `RI-CMB08` (healing, 3,155 words — **all four paths were dead**) | `combat.player.heal`, `combat.resource.charges`, `progression.restsite.refill`, `combat.encounter.pacing` | `combat.heal.charges`, `progression.bonfire.function`, `combat.encounter.placement`, + `combat.enemy.punish` (the heal-read punish window §, previously unjudged) |
| `RI-WLD08` (**the corpus's best liveness instrument, 5 of 7 dead**) | `world.npc-schedules`, `world.ecology`, `world.ambient-events`, `npc.behaviour`, `audio.ambient` | `world.npc.schedule`, `world.ecology.behaviour`, `world.ambient.events` (three **new** paths — nothing canonical covered schedules, ecology or ambient events), `world.npc.population`, `audio.ambience.region` |
| `RI-LOR05` (8 dead of 12) | `lore.religion`, `lore.metaphysics`, `progression.souls`, `progression.levelling`, `progression.estus`, `combat.death`, `combat.respawn`, `ui.terminology` | `lore.religion.hist`, `lore.religion.metaphysics` (**new**), `progression.souls.economy`, `progression.level.curve`, `combat.heal.charges`, `combat.death.corpserun`, `combat.death.worldreset`, `coherence.naming.consistency` |
| `RI-LOR06` (8 dead of 8 — **it judged nothing at all**) | `lore.canon`, `lore.coherence`, `books.content`, `dialogue.claims`, `quests.main`, `quests.factions`, `world.settlements`, `critic.method` | `lore.canon.registry`, `coherence.lore.consistency`, `lore.book.unreliability`, `dialogue.topics.truth`, `quests.lore.hooks`, `quests.faction.escalation`, `world.settlement.anatomy`, `process.critic.discipline` |
| `RI-TRV01` | — | **added** `world.traversal.stations`, `world.traversal.schedule` (its §2 and §6 already specify both; the paths did not exist) |

### 4c. `side: split` — the validator was wrong, not the item

`RI-STL01` declared `side: split` and failed front-matter validation, because
CORPUS-CONTRACT §2's enum is `souls | morrowind | modern-fidelity | neutral`.

**Ruling: amend the contract and the validator, not the item.** `split` is *already* a
first-class value in `subsystems.json`'s `arb_legend`, and ARBITRATION §2 carries **five SPLIT
seam rulings** (S2, S11, S13, S16, S19). `RI-STL01`'s entire subject is the seam where sneaking
hands over to the fight; forcing it to pick `souls` or `morrowind` would have made it
misdeclare itself to every critic that reads it. The contract now documents `split` with a
usage constraint — it may only be used by an item that cites the specific seam ruling it
documents — so it cannot become a way to avoid choosing a side.

### 4d. `--check` is now a blocking gate

`tools/corpus-index.mjs --check` previously exited 1 **only** if `INDEX.md` was stale; it
printed 148 errors to stdout and exited 0. That is precisely how 147 orphan paths accumulated
without anyone noticing. It now exits 1 on **any error-level problem**, and `--strict`
additionally fails on corpus holes. Two new checks were added, both specified in `RI-MTH05`:

- **C3 — "judges nothing".** An item whose entire `judges:` list fails to resolve is now an
  error in its own right, named as such. `RI-LOR06` was in exactly this state and looked
  perfectly healthy in the item inventory.
- **C4 — shared-constant registry integrity.** `constants.json` must parse, every constant
  must have exactly one owner, and every owner and named consumer must be a reference item
  that exists.

### 4e. Decisions deliberately *not* made

- **No `camera.*` root.** The queue listed "`camera.*` (8) + the camera agent's critic
  assignment". `RI-CAM01`–`RI-CAM07` all judge existing `combat.camera.behaviour`,
  `combat.lockon.*`, `render.*` and `ui.*` paths, and **indexed cleanly with zero orphans**.
  Registering 8 unused `camera.*` paths would have created **8 new corpus holes** and blocked
  builders on subsystems no item judges — strictly worse than the status quo. If the camera
  area later wants its own root, the items must move their `judges:` at the same time.
- **206 legacy aliases left in use.** They all resolve, `subsystems.json` documents aliases as
  a deliberate migration aid, `INDEX.md` §4a lists every one with its user, and `--check` does
  not gate on them. Rewriting front-matter across 60+ items for zero semantic change is churn
  with real risk of introducing the very orphans this section just removed. Recorded as
  outstanding, not silently dropped.
- **The 14 remaining holes were not filled.** All 14 pre-date this audit. Filling a hole means
  writing a reference item, which is authorship, not coherence repair.

---

## 5. The Jel validator and the lexicon — RULED

### 5a. The validator rejected canon

`corpus/80-methods/jel-phonotactics.py` scored **26.7% violations against its own 5% pass
threshold** when run on attested Jel. It rejected **Saxhleel** — the Argonians' own word for
themselves — plus **Thtithil** (egg, already cited as canon in CF-025) and **Xeech** (seed, *a
root in our own lexicon*), and five more.

**Ruling: fix the validator, and fix it by splitting it in two rather than by loosening it.**

A single-mode validator has an unresolvable conflict of duties. It is asked to (a) never reject
a real Argonian word and (b) stop us inventing *Krothgar*. Those are different questions and
they need different rules. So:

- **`--mode canon` (new default — what a critic runs).** An attested Jel form is never a
  violation. `phonology.attested_exceptions` grew from **7 to 42 elements**: every attested
  form in `argonian-names.json → jel_glossary`, split on hyphen and space.
- **`--mode coinage`.** The attested-exception list is ignored *entirely*, so the narrow
  constructed rules apply in full to anything we invent. `gr`, `kr` and geminates remain
  forbidden here **even though canon contains them**: those rules exist to stop coined Jel
  drifting into generic fantasy, and canon's licence to say *Krona* is not our licence to coin
  *Krothgar*. Verified: coinage mode still rejects `Krothgar`, `Ssaxleel`, `Blooddrinker`.
- **Inventory gaps that canon proved were gaps** were filled, since these are not matters of
  taste: coda `ch` (*Xeech*), onsets `hl` / `tht` / `xth` (*Saxhleel* = sa-xhleel, *Thtithil*,
  *Xthari*), coda cluster `rg` (*Norg*).
- **`--self-test` added as the regression guard.** It runs the attested fixture through canon
  mode and exits non-zero if a single attested word is rejected. `self-test: 33 attested Jel
  forms, 0 rejected. SELF-TEST PASSED.`

**RI-LOR04 licensed this itself.** Its §6(c) already records the same failure in miniature —
*"`xanmeer` — a canon word — failed the coda rules… **A phonology that rejects the canon word
it was derived from is wrong**"* — and fixed it by adding `r` to the coda inventory. This
amendment is that principle applied to the other eight cases.

**Verified no weaker:** the 34 worked examples still score **0.0% PASS**, and the adversarial
set (`Slays-The-Shadow-Lord`, `Grimfang-Of-The-Blackwater`, `Blooddrinker`, `Zzzarkath`,
`Fenwyck`, `Thorgrim`) still **FAILs** on the same grounds.

### 5b. Three classifier corrections found while testing — not in the queue

Each was quietly annexing an Argonian name to another culture, which is the same class of
error as the wrong glosses:

| Name | Was classified | Now | Fix |
|---|---|---|---|
| ***Skink-in-Tree's-Shade*** (Morrowind, 3E 427) — the one Argonian name every reader knows | `khajiit`, on the apostrophe | `argonian-tamrielic` | The apostrophe ban is a **Jel** rule. An English possessive in a Tamrielic-facing name is not a Khajiit apostrophe. Lowercase medial function words (`in`) are now permitted; first and last element must still be capitalised |
| ***An-Deesei***, ***Ixt-Shaneekh***, Jel compounds generally | `argonian-tamrielic` — a Jel compound also matches the hyphenated-English shape | `jel` | The Jel sound-signature test now runs **before** the shape test. This is the *same* minority-form-as-the-rule error as §5d, in code |
| ***Tree-Minder Deyapa***, ***Nisswo Ajul-Jas*** | `imperial`, then failed for "hyphen in an Imperial name" | title stripped, remainder classified | Attested title-prefixes are a register, stripped before classification **and** before checking |

### 5c. Four lexicon glosses corrected against attested Jel

| Root | Was | Now (attested: *Lore:The Sharper Tongue: A Jel Primer*) |
|---|---|---|
| `xul` | "root, that which goes down" (`inferred`) | **"death, and by the same word rebirth — they are thought to be one and the same"** (`community-data`) |
| `uxith` | "old, long-standing, kept" (`community-data`, **no source**) | **"nest, home, bed — for my people these concepts are one and the same"** (`community-data`, sourced) |
| `ojel` | "tongue, the organ" (`inferred`) | **"not of a tribe, outsider — literally *not of Argonian tongue*"** (`community-data`) |
| `kaal` | "to kneel, to put the hand down into" (`constructed`) | **"war captain"** (`community-data`) — a constructed root had landed on an attested word with an unrelated meaning |

`uxith` was the serious one: `community-data` means *verified against a source*, and there was
no source. The label was wrong twice — wrong gloss, and a provenance claim the corpus's own
definitions did not support.

**`kaal`:** our constructed sense was **renamed to `kaan`**, not deleted, so nothing coined on
it is lost. `kaal` is used nowhere else in the corpus, so the rename is contained.

**`xul` was load-bearing — five coined terms are built on it — and the ruling is to RE-GLOSS,
not rename.** `Xul-Aneekh` appears across `RI-CRM01`, `RI-CRM02`, `RI-MAG03`, `RI-TRV01` and
`travel-network.json`; renaming it would have been a corpus-wide sweep with a real chance of
leaving a dangling reference. It also turns out to be unnecessary, because under the *attested*
gloss four of the five terms get **better**:

| Coined term | Old reading | Reading under attested `xul` | Verdict |
|---|---|---|---|
| `xul-teekh` (the souls currency) | "root-tithe / sap-debt" | **"death-tithe"** | improved, and now canon-grounded |
| `xul-hesh` (soul-trapping) | "root-theft" | **"death-theft"** | improved |
| `xul-vaska` (the Estus analogue) | "tithe-gourd" | **"rebirth-gourd"** | improved |
| `ixtu-xul` (the bonfire analogue) | "the opened root" | **"the opened rebirth"** | improved — a checkpoint you return to after dying is *exactly* an opened rebirth |
| `xul-aneekh` (the faction) | "the Deep-Kin" | **"the Rebirth-Kin"** | **re-glossed**: Rebirth-Kin is a better name for an isolationist Hist-consensus than Deep-Kin was. *Deep-Kin* is kept as the **Tamrielic exonym** — what outsiders call them — so every existing reference in the corpus stays correct |

The primer's own note that death and rebirth "are one and the same in the eyes of my people" is
what makes this work; it is not a rescue, it is the source being better than our invention.

**15 attested Jel words that the lexicon simply did not contain** were added as roots (`bok`,
`greel`, `krona`, `naheesh`, `nalpa`, `norg`, `saxhleel`, `thtithil`, `thuxis`, `toteik`,
`tsona`, `xal`, `vakka`, `xanmeer`, `xthari`).

### 5d. RI-LOR04 §4 had the minority form as the rule

`RI-LOR04` §4 legislated the hyphenated descriptive name (*Counts-The-Wet-Days*) as **the**
Argonian naming system. Measured over every attested Argonian name:

| Shape | Count | Share |
|---|---:|---:|
| Jel single word | 182 | 48% |
| Jel compound | 142 | 38% |
| **Tamrielic descriptive** | **43** | **11%** |
| Mixed | 10 | 3% |

**86% of attested Argonian names are Jel.** Legislating the 11% form as the rule makes the
world sound *less* Argonian, not more — and CF-023 says a Tamrielic name is carried **in
addition to** a Jel one, not instead of it.

**Ruling — four corrections, applied to both `RI-LOR04` §4 and `jel-lexicon.json`:**

1. **The Jel name is the primary form.** A roster in which most Argonians carry hyphenated
   English names now **fails** §4 however well each individual name scores.
2. **Word count 2–5, modal 2** (~~2–4, modal 3~~). Attested: 2 words ×31, 3 ×6, 4 ×5, 5 ×1.
   The mode was wrong and the ceiling was wrong — *Morning-Star-Steals-Away-Clouds* is five.
3. **The verb-initial slot is not obligatory.** Canon has *Nine-Toes, Twice-Bitten,
   Tongue-Toad, Fine-Mouth, Grey-Throat, Big Head, Egg-Face*. The register is policed by the
   epic-register blocklist — which is what actually catches `Slays-The-Shadow-Lord` — and the
   positive vocabulary requirement moved to **coinage mode only**, where it belongs.
4. **The title-prefix register was missing entirely** and is now in the lexicon: *Tree-Minder*
   (9 bearers), *Nisswo* (7), *Sun-Eater* (7), *Dead-Water* (3), *Grave-Singer* (2),
   *Raj-Kaal* (2), *Egg-Tender, Bond-Guru, Chime-Maker, Copper-Eye, Sap-Speaker, Ux-Deelith,
   Bright-Throat, Root-House, Moss-Skin*. These do exactly the work §4 wants done, and they are
   canon.

**Closes:** queue items **B6** and **B7**; PROVENANCE-UPGRADE-01 §A and §B8.

---

## 6. The strangeness curve — W1, and two arithmetic defects

**W1 — `RI-WLD05` mandated a flat surprise curve.** "≥22 of the 30 strangeness elements
encounterable in the first 30 minutes" required **73% of the world's entire novelty vocabulary
inside half an hour**. Neither reference game does this and both would fail it: Morrowind's
Telvanni towers, Vivec, the Ghostfence, the Dwemer ruins and the Sixth House shrines arrive over
dozens of hours; Anor Londo is hour ten.

**Ruling: apply `RI-EXP04` §H's replacement text verbatim.** The item's *intent* — strangeness
must not be hero assets — was right and is untouched; that intent lives in M23's
≥6-placed-instances rule, which is unchanged. What was wrong was fixing the guard to the
opening instead of to the whole run.

| | Was | Now |
|---|---|---|
| First 30 min | ≥ 22 of 30 | **≤ 12** |
| By hour 10 | unspecified | **≥ 26** (measured by `RI-EXP04` LT5) |
| By hour 18 | unspecified | **30** |
| Sustained | unspecified | **no 90-min window after hour 2 with zero first-time elements** (`RI-EXP04` LT1) |
| M24 fail | < 12 | **> 16** — the sign of the test is reversed |
| Score table | rewarded M24 ≥22 at ladder 10 | every M24 row inverted; a high M24 is a defect |
| M23 ≥6 instances | — | **unchanged** |
| Systemic ≥8 | — | **unchanged** |

**Consequence recorded:** `RI-EXP04`'s hard fail 6 was marked `pending_amendment` and
**unenforced**, on the correct principle that *an item may not fail a build for satisfying a
rule still binding on it*. That rule is now gone, so hard fail 6 is enforceable as of this
edit, and `RI-WLD05` says so in its own amendment block.

**Two arithmetic defects in `RI-WLD05`, found by `RI-EXP04` and fixed here (queue B3):**

1. **`RI-WLD05` failed its own threshold, by its own table.** The `E` column's ✔ marks sum to
   **20**, not the asserted 22 — architecture 6 (#1, 2, 3, 4, 6, 8), flora/fauna 7 (#11, 12, 13,
   15, 17, 18, 20), systems 7 (#21, 22, 23, 24, 25, 26, 30). It had been wrong since the item
   was written and nothing checked it. Under W1 the binding number is a **ceiling of 12**, so
   20 is now a defect to reduce rather than a shortfall to pad — which is the happier direction
   to discover an arithmetic error in.
2. **Element 29, "the Hive's chord", is pure audio** — a sustained note shifting pitch with
   distance. `HARNESS.md` §3 and `PLAYTHROUGH-CRITIC.md` §4.7 both state audio is unreachable
   through the harness, so it was **permanently `unmeasurable ⇒ 0`** while being counted toward
   the 30 and toward the 15 systemic. **Ruling: keep it in the inventory, exclude it from every
   automated count, record the exclusion.** Deleting it loses a good idea to a tooling
   limitation; counting it silently makes a permanent zero look like a build failure. Scoreable
   inventory is **29**, scoreable systemic **14**, and any check reporting 30 or 15 has not
   applied the exclusion. The exclusion lapses if the element gains a non-audio observable.

---

## 7. The remaining wrong bars — W2, W3, W6, W7, W8

### W2 + queue B2 — `RI-WLD02` made deliberate emptiness illegal, and contradicted `RI-WLD09`

`RI-WLD02`'s D1 (TTNIT median ≤45 s), D2 (p90 ≤90 s) and D13 (longest nothing-stretch ≤150 s)
were **global**. `RI-WLD09` §B4 requires ≥5 declared void tracts covering ≥14% of the landmass,
each with a ≥240 s empty walk. **A critic handed both items had to fail one of them** — and
would have failed `RI-WLD09`, because `RI-WLD02` is older and has a scripted walk behind it.

Three things were wrong at once, which is why this counts as both a wrong bar and a
contradiction: sustained emptiness was illegal *everywhere*; the cheapest way to satisfy a p90
is to sprinkle, so the item was simultaneously demanding the POI inflation its own M7 scans
for; and two items in the same area disagreed.

**Ruling: `RI-WLD09` wins on emptiness, `RI-WLD02` wins on density, and they are made
commensurable rather than one being overruled.** Density is a *rhythm*; the original bar
measured only its mean. `RI-WLD09` proposed the fix in its own §B4 and this audit applied it
exactly as specified:

- **D1, D2, D13 become settled-region thresholds**, scored outside declared void tracts.
- **V5 (≥12% of road-km with TTNIT > 3 min) and V6 (≥2 regions with median TTNIT > 2 min) are
  added as peers of D1**, weighted ×2 and ×1. **It is now possible to fail `RI-WLD02` for
  having too little emptiness** — that is the correction, not the exemption.
- Inside a declared tract, D13 rises 150 s → **600 s**, D9's hostile floor drops 0.4 → **0.15**.
- The score-0 clause `D3 < 9` is scoped to **non-void** road kilometres, and `V5 < 6%` is added
  to it.
- **The anti-abuse clause:** a tract counts as declared only if it passes `RI-WLD09` V1–V9,
  including the witness-prop rule (≥6 authored, non-`poi`-tagged props per km² — *emptiness
  somebody walked through has litter in it, and unbuilt terrain is spotless*). Undeclared or
  failing emptiness is still measured by the settled-region thresholds, so "declare a void over
  the land we did not build" gains nothing.

`RI-WLD09`'s "amendments proposed, not applied" note and its "until the amendment lands, a
critic must fail one of us" bullet are both marked resolved in place.

### W3 — `RI-DLG07` scored victory where the doctrine scores suspicion

`ours_win_rate ≥ 0.25` was a **pass condition**. CORPUS-CONTRACT §6 and CRITIC-DOCTRINE §2.5
both say a blind pick landing on ours is **evidence the critic is broken** and triggers a
harsher re-run. The item therefore rewarded the exact outcome the doctrine treats as instrument
failure — and it is self-administered: we build the pack, we choose the excerpts, and §A's
"random selection" is on our honour. A team under pressure hits 0.25 by tuning the pack.

**Ruling: score indistinguishability, not victory.**

- **New pass metrics:** `professional_bet_accuracy ≤ 0.65` across ≥12 pairs (the judge, asked
  which set is the 2002 shipped game, is barely better than chance), and
  `judge_cannot_name_a_consistent_tell = true`.
- `tie_rate` band unchanged; every automatic fail unchanged.
- `ours_win_rate` is **still reported** but is no longer a pass condition.
- **New VOID outcome:** `ours_win_rate > 0.5` makes the run void — not failed, not passed — and
  the pack is rebuilt **by a different agent** before anything is scored. That matches §2.5
  instead of contradicting it.

### W6 — `RI-QST05`'s pacifist fraction was gameable by construction

The item mandates PACIFIST-ALL ≥ 45% (hard fail < 30%) and names
"speechcraft-solves-everything" as its own top failure mode. When it was written, **sneak and
theft had no subsystem path, no reference item and no builder assignment**, so speechcraft was
the *only buildable route* to 30%. **A threshold whose only reachable satisfaction is its own
named failure mode is gameable by construction.**

**Ruling: keep the threshold, close the route.**

- **VERB-SPREAD ≤ 40% promoted from a band condition to a hard fail.** One verb carrying more
  than 40% of non-violent resolutions now fails the item outright, whatever PACIFIST-ALL reads.
- **`RI-QST05` now formally depends on `RI-STL01`, `RI-STL02` and `RI-CRM01`** — which exist as
  of wave 0 and are registered under the `stealth.*` and `crime.*` roots this audit created. If
  those systems are absent from the build, **PACIFIST-ALL is `unmeasurable` and scores 0** per
  CRITIC-DOCTRINE §7.3, rather than being satisfied by dialogue alone. `RI-MAG02`'s utility
  effects (S19) are the fourth route and count as their own verb.

### W7 — a "6" meant five different things

`10-combat` uses weighted sums where 70/100 is "remediable". `20-progression` uses min-over-axes
where any axis below 6 fails the item. `70-visual` uses `min(ART, FIDELITY)`. `30-quests` uses
bands. `50-world` uses 0–10 with "WE LOSE" clauses. `pass_threshold: 6.0` was applied across all
of them, and SCORING.md §3 additionally let the critic choose `mean` / `min` / `weighted-mean`
per piece. The aggregate progress number was noise.

**Ruling: the native→ladder mapping is mandatory and tabulated per item, and aggregation is a
property of the item rather than of the critic.** SCORING.md §1.2 now requires every item's
`## Scoring` section to carry a fixed row giving the native score that maps to ladder 4, 6 and
8, plus its own aggregation rule. **An item with no ladder row is `unmeasurable` and scores 0**,
fail-closed. §3's choice of `mean`/`min`/`weighted-mean` is scoped to combining *items* into a
piece score and never to computing one.

**This is the one wave-0 amendment the audit could not finish** — see §10.

### W8 — `RI-AI05`'s health-sponge hard fail could never fire

*"Any trash enemy requiring > 20 light attacks to kill"* named no weapon, no upgrade level, no
character level and no skill grade. `RI-PRG08` puts the +0 → +10 upgrade swing at **1.92×**, so
measured with a +10 weapon at level 60 **every enemy passes and the hard fail is unreachable**.

**Ruling: pin the fixture, and make an unstated fixture score zero.**
`fixture: wave-standard-build` — region reference weapon at **+0**, region-entry level from
`RI-PRG06` §1's "typical" column, wave-standard allocation, no buffs, consumables or
enchantments. **M7 reported without a stated fixture is `unmeasurable ⇒ 0`, not a pass.**

### W5 — a protocol document was listed as the bar for combat impact

`RI-MTH03`, the blind-comparison **protocol**, claimed `combat.feel` (aliasing to
`combat.feedback.hitstop`, now owned by `RI-AUD01` and `RI-WPN05`), plus `visual.fidelity`,
`visual.artdirection`, `dialogue.prose` and `quests.structure`. **A false mapping is worse than
a hole**: a hole stops a builder, a false mapping tells them to proceed and tells the critic it
has a bar. All five removed; `RI-MTH03` keeps `process.critic.discipline` and
`process.verdict.format`, which are the two things a protocol document can actually bar. Holes
did not increase — every one of the five is judged by a real item. Generalised as `RI-MTH05` §C.

### W9 — deliberately no change

BAR-CRITIQUE-01 asks for no change to `RI-PRG07`'s "Burden clamped to 1.00 inside COMBAT"
ruling, only for the counterweight to exist. **AR-3 is in ARBITRATION §3 and `RI-CMP01` exists**,
so W9 is closed by their existence and nothing in `RI-PRG07` was touched.

---

## 8. Seam propagation, travel, and the remaining queue items

### 8a. `RI-CMB02` contradicted itself, and one of its rules was arithmetically impossible (B4)

**Two independent defects, both found by the weapons agent, both fixed.**

1. **§E requires ≥6 f startup for any player attack. §C's rolling multiplier is ×0.60. §A's
   dagger R1 startup is 6 f.** `round(6 × 0.60) = 4 f` — **below the item's own floor, on the
   fastest weapon in the game, in the most-used contextual attack.** The running multiplier
   (×0.70) breaks it too, and `RI-WPN02`'s 5 f fist class breaks both.
   **Ruling: the floor wins and the multiplier clamps to it.**
   `startup_final = max(6, round(base × modifier))`, after every §C startup multiplier. The 6 f
   floor is a *readability* rule — below 100 ms an attack is unreactable and un-trade-able — and
   a readability floor a modifier can silently pass through is not a floor. **The clamp is not
   silent:** a class whose contextual startup clamps must be named in the check's output, so a
   critic can see the class has *lost* its contextual speed advantage rather than gained a
   hidden one. Registered as `combat.min_startup_frames`, owner `RI-CMB02`.
2. **The ≥2 f adjacent-class startup separation rule cannot be satisfied at 15 classes.**
   `RI-WPN02` defines 15 weapon classes. Fourteen gaps of ≥2 f need **28 f** of R1 startup
   range; the range is 6 → 29 f, i.e. **23 f**. No assignment satisfies it, so as written the
   rule **failed the roster automatically**.
   **Ruling: scope the rule to the 7-class spine `RI-CMB02` §A/§B actually tabulates**, where
   it is verified and where it does the work it was written for. The other 8 classes are
   separated by `RI-WPN02`'s 12-dimensional fingerprint distance (`D_min ≥ 1.6` PASS, `< 1.0`
   HARD FAIL) — the right instrument at that population, because with 15 classes timing alone
   was never going to carry differentiation. **Timing separation within the spine, fingerprint
   separation across the roster.** The intent survives and the arithmetic now closes.

Also applied at `RI-WPN04`/`RI-WPN06`'s request: **backstep-attack and guard-counter rows**
added to §C (both subject to the 6 f clamp), and the two-handed row strengthened from
"different clip, same frame counts" — which licensed exactly the reskin the corpus warns
about — to a statement that same frame counts is the *floor* and `RI-WPN06` owns which slots
diverge. `RI-CMB02` remains the owner of frame data; `RI-WPN02`'s 8 extra class rows are
adopted into `ES-FRAMES/1` by that item and cited, not restated.

### 8b. Every travel check was one-directional (B10, drifts ID-09 and ID-17)

Seam **S7 mandates** fast travel — a diegetic, paid, node-to-node network you must have walked
to. Only warp-to-map-pin is banned. **Every travel check in the corpus tested only for the
absence of warping**, so *a build that shipped no transport at all passed all of them*.

| Where | Was | Now |
|---|---|---|
| `RI-PRG04` §Scoring, S7 axis | **10 = "no warp code path exists"** — the top score for the absence of the system S7 requires | 10 = the `RI-TRV01` network exists and is used (≥5 modes, ≥17 lines, ≥60 services, fares > 0, ride times > 0) **and** every warp path lies inside the transport module; **0 = a HEARTH destination menu OR warp-to-map-pin OR no network at all** |
| `CRITIC-DOCTRINE` §AR-2 leaks | B2 (bonfire warp) only — one-directional by construction | **B13 added**: board each modality from three settlements, pay gold, verify station arrival, elapsed in-world time, and prior visitation. **No modality boards → AR-2 fail.** B2 and B13 are a pair and are run together |
| `COHERENCE-AGENT` T6 | "rest → … and **no** teleport network" | scoped to the HEARTH, and joined by "transport → gold spent → clock advanced → arrival at a station, verified once per modality" |
| `RI-WLD01`:185 | "no fast travel" in the walk-measurement procedure | "transport network disabled **for the measurement**" — a measurement condition, not a design ban |
| `RI-WLD05` #22 | root-travel is "the only fast travel" | "one of five transport modes; `RI-TRV01` owns the network" |
| `subsystems.json` `world.traversal.transport` | *"In-fiction transport network only; no warp-to-pin"* — reads as a prohibition | *"The in-fiction transport network **REQUIRED** by seam S7 … warp-to-map-pin is what is banned, not travel"*. **The path string is unchanged** — renaming a path orphans every verdict that cited it; only the title moved |

**The standing rule, now stated in three places:** a travel check must fail when the network is
missing **and** when it degenerates into warp-to-map-pin. `RI-TRV01` M1's N-fail/W-fail pair is
the reference shape. A verdict reporting "no warping found, passes" on a build with zero
transport services has scored a 0 as a 10 and is **void**.

### 8c. `deviceScaleFactor: 1` made the one check that catches a fake UI unmeasurable (B8)

`HARNESS.md` §6 pinned `deviceScaleFactor: 1` globally, which made `RI-UIX06`'s **FD2
glyph-sharpness-at-DPR-2** check structurally unmeasurable — and FD2 is *the* measurement that
catches a UI drawn into a `CanvasTexture` at fixed size and mapped to a quad. Such a UI passes
at DPR 1 and fails catastrophically at DPR 2; with DPR pinned to 1, it passes everything and
ships.

This was a **real conflict, not an oversight**: fidelity metrics genuinely need one fixed DPR
so edge-density and FFT numbers stay commensurable across waves.

**Ruling: scope the constraint to the viewpoint set it protects.** `viewpoints.json` gains a
`set` field — `world` (12 canonical poses, 1920×1080 DPR 1, unchanged and still binding) and
`ui` (4 screens × 4 resolutions × 2 DPRs = 48 shots, per `RI-UIX06` §E). **A UI shot is never
admissible evidence for a fidelity metric and a world shot is never admissible evidence for a
UI metric**, which is what makes the two configurations safe to differ. Every world-shot number
taken before this amendment stays valid and comparable.

**`RI-VIS01` gained F17–F19 and CC-7**, in `RI-UIX06`'s own table format. Until they existed
there was **no fidelity property covering the interface at all**, so a critic judging UI
rendering quality was out of process and its verdict void — "the UI looks bad" had nowhere to
be recorded and "the UI looks fine" had nothing to be checked against. **CC-7** is CC-3 ("the
cardinal sin" — low fidelity excused as style) transposed to the interface, and it is the more
likely of the two to be committed, because a UI genuinely *is* meant to look like damp
parchment. The test that separates the real thing from the excuse: render at 4× and downsample
— real ink bleed persists, raster blur disappears.

### 8d. `RI-MAG02`'s price formula degenerated for the teleport spells (B11)

`round(3.9 × focus_base^1.75)` prices a spell by **computed magnitude**. The four S7/S19
teleport effects have essentially no magnitude: `mark` merely writes a position, so it priced
at **~4 gold**, and `recall`'s magnitude scales with distance travelled, so **its shelf price
varied with where the player was standing.** A price that moves when the customer walks is not
a price.

**Ruling: for the four teleport effects, price by `min_tier`, not by magnitude.** `RI-TRV02`
§P1 already does this and asserts the numbers; `RI-MAG02` now defers to it rather than
competing — `recall` and `intervention_root` at **3,400 g** (tier 3), `mark` and
`intervention_imperial` at **900 g** (tier 2). These are `RI-PRG05` §2's published prices
unmodified, so the carve-out adds **no new numbers to the economy**. The magnitude formula
remains the rule for every other effect; this is narrow, and it is recorded in both items so a
later reader does not "fix" it by re-applying the formula.

### 8e. Seam propagation (§A of the queue)

- **S21 was cited as S20 in five places.** Two agents independently proposed *"keep the die
  where failure is permanent; delete it where failure is a retry"* as S20; it was adopted as
  **S21** because S20 was already era authority. Corrected in `RI-STL02` (1) and `RI-CRM01` (4),
  and in the `character-stealth-crime` status file.
- **S16 (8 loops / 82 caves)** — no contradicting text found; `RI-WLD07`, `RI-TRV02` and
  `RI-WLD02` all agree, and the census is now registered in `constants.json`.
- **S17 (the hour comes from distance)** — the one violation was `RI-AI07`, resolved at §1.
- **S18 (third-person always)** — no contradicting text found. `RI-CAM05` owns the
  first-person ban with a detector; every other occurrence of "first person" in the corpus is
  journal voice or a critic protocol.
- **S19 (magic split; teleport is part of the S7 network)** — propagated via §8b and §8d.
- **S20 (era authority)** — no contradicting text found; `blackmarsh-canon.json` carries the
  `era` field the ruling requires.
- **§1 amendment (non-lethal exits, consequences accrue mid-fight)** — `RI-CRM02` was already
  extended for it by its own author after the ruling landed; no further edit needed.
- **S7 correction (fast travel is mandated)** — §8b.

---

## 9. The Souls verification pass — `PROVENANCE-UPGRADE-02-SOULS.md` (queue §E)

The Souls verification landed before this audit ran. It checked **64 figures**: 39 confirmed,
9 needing amendment, 6 contradicted, 10 unverifiable. Two findings needed a ruling.

### 9a. The unit finding — HIGH PRIORITY, and it is not a blend

The brief asked the verification agent to say loudly if we had blended mechanics from different
Souls games into a model no game implements. **The blending is real, mostly declared, and
coherent** — `RI-CMB01` §B says in plain text that it takes DS3's breakpoints with DS1's
i-frame stinginess and that "neither is ours", and `RI-CMB05`'s fused poise model (always-on
depleting pool + hyperarmour on declared frames) is not fictional: **Elden Ring implements
exactly that combination**, so its DS3-only attribution is a citation error, not a design one.

**The serious finding is a unit, and it is worse than any blend because it is invisible to
every internal check we have.**

Souls community frame counts are quoted in **1/30-second ticks** — in DS1, DS3 *and* Elden
Ring. Verified arithmetically: DS3's Carthus Bloodring is documented as raising i-frames
*"from 12 (.4 sec) to 16 (.533 sec)"*, and 12 ÷ 0.4 s = **30 fps exactly**. Our simulation is a
fixed **60 Hz** step, and the corpus adopted the Souls frame *numbers* without rebasing.

| | Souls (30 fps ticks) | Ours (60 Hz) | Ratio |
|---|---|---|---|
| Light-roll i-frames | DS3 13 f = **433 ms** | 13 f = **217 ms** | 0.50 |
| Light-roll total | DS1 24 f = **800 ms** | 26 f = **433 ms** | 0.54 |
| Medium-roll total | DS1 33 f = **1100 ms** | 30 f = **500 ms** | 0.45 |
| Parry active window | 8–12 f = **267–400 ms** | 7–12 f = **117–200 ms** | 0.50 |

**Our combat currently runs at roughly double Souls wall-clock speed while looking correct on
paper.** Every *ratio* is preserved — our LIGHT roll is invulnerable for 0.500 of its animation
against DS1's fast-roll 0.458 — so the discrepancy survives every internal consistency check,
every blind pair over frame vectors, and every M-check in every method script. It surfaces only
when a human plays it and says "this is Souls-ish but wrong".

**Ruling: DECLARE, do not rebase — and record the rebase as an open design question rather
than closing it.**

- **Declared.** `RI-CMB01` §A now carries a unit warning, its DS1/DS3 columns are headed
  `@30 fps ticks`, and §B's rationale ("fewer i-frames than DS3") is annotated as true only if
  units are ignored — in *duration* we are stingier than either game, by about half.
  ARBITRATION §1's I-frame-accounting row carries the same warning, because that table is what
  most agents read.
- **Registered.** `constants.json` gains `combat.sim_step_hz` (60), `combat.souls_tick_hz` (30)
  with the conversion `ours = 2 × souls`, and the open question attached to it.
- **Not rebased, deliberately.** Doubling every inherited frame count across `RI-CMB01`,
  `RI-CMB02`, `RI-CMB05` and `RI-CMB08`, and regenerating the `RI-CMB07` exemplar trace, is a
  **design decision about how the game should feel**. It must be settled by a wave that can
  play the result. This audit's standing rule is that coherence work rules which item is
  authoritative and does not improve either.
- **Not laundered.** The verification agent is explicit that the numbers were adopted without
  rebasing, i.e. this was an **error, not a decision**. The declaration therefore says the unit
  is 60 Hz and that the 2× divergence is *unresolved*, rather than describing it as intended
  pacing. Recording an error as a deliberate choice would be the more comfortable edit and the
  dishonest one.

**What is fixed regardless of how the design question is settled** is the status quo the
verification called unacceptable: DS1's 11 and DS3's 13 sitting in the same table as our 13
with no unit stated, inviting the false equivalence that §B's rationale then rested on.

### 9b. The equip-load ladder — the corpus's worst internal contradiction

`RI-CMB01` §B and `RI-PRG07` §2 described **two different equip-load systems**, both written
as binding, disagreeing in **every column**:

| | `RI-CMB01` §B `ES-ROLL/1` | `RI-PRG07` §2 |
|---|---|---|
| Tiers | **4** | **5** |
| Breakpoints | 30 / 70 / 100 | **30 / 55 / 80 / 100** |
| I-frames | 13 / 11 / **5** / 0 | 13 / 11 / **9** / **7** / — |
| Roll distance | 5.20 / 4.40 / **2.60** / 1.10 m | 5.2 / 4.4 / **3.5** / **2.4** / 0.8 m |
| Roll stamina | 22 / 26 / 34 / 40 | 20 / 22 / 25 / 32 / 40 |
| Stamina regen | 1.00 / 1.00 / 0.80 / 0.60 | 1.00 / **0.93** / **0.85** / 0.70 / 0.40 |

**The two items' own method scripts fail each other.** `RI-CMB01` M5 fails any build whose
i-frame count changes anywhere but 30.00→30.01 and 70.00→70.01; `RI-PRG07` method 4 asserts
exactly four transitions at 0.30, 0.55, 0.80 and 1.00. A builder could not satisfy both. This
is the likeliest single reason the build would not converge, and no external verification could
have caught it — it is purely internal.

`RI-PRG07` tried to pre-resolve it: *"the i-frame, roll-distance and stamina-cost columns are
provisional and subordinate to `corpus/10-combat/` … what this item owns and does not concede
is the tier structure."* **But the tier structure is exactly what conflicts** — the clause
cedes everything except the thing in dispute.

**Ruling: `RI-CMB01` owns the whole ladder, tier structure included. Four tiers at 30/70/100.**

- ARBITRATION §1 puts *"equip load changing roll type, distance and recovery"* **inside the
  fight**, where Souls is authoritative, and the canonical path `combat.dodge.equipload` sits
  in `10-combat` under `critic.combat`.
- **The tiers exist for no purpose except to change roll behaviour**, so the breakpoints are a
  combat property. `RI-PRG07`'s subordination clause is honoured in full; it simply reaches
  one step further than its author intended.

**What `RI-PRG07` keeps, and it is not nothing:** BURDEN and the entire out-of-fight
encumbrance economy (the Morrowind half, which no combat item speaks to); the **fall-damage
column**, which no combat item states; the name **`Immobilised`** for the >100% state, adopted
as the display name of `OVERLOADED` because it says what happens; and its practice of writing
**`@60 fps`** in the table header — the only equip-load table in the corpus that stated its
framerate, which `RI-CMB01` §A now copies. Its §4 Shell-Warden loadout is retiered from
Overburdened to **Heavy** (88.4% is Heavy on the 30/70/100 ladder), and method 4's
four-transition assertion is superseded by M5's two cliffs.

### 9c. The remaining verification findings — recorded, not applied

Amendments 1–11 in `PROVENANCE-UPGRADE-02-SOULS.md` are attribution and disclosure fixes to
`RI-CMB01`, `RI-CMB03`, `RI-CMB05`, `RI-CMB08` and `RI-PRG01`: naming Elden Ring rather than
DS3 for the fused poise model, disclosing that the stamina floor and the percentage heal are
ours, adding the poise-overflow rule, recording the parryability divergence. **They are correct
and they are the owning items' to apply** — each changes what an item *claims about a source*,
which is that item's authorship, not a contradiction between items. This audit applied only the
two findings that were genuine cross-item incoherence (§9a, §9b). The other nine are carried in
the ledger below.

---

## 10. Every constant now under single ownership

`corpus/00-doctrine/constants.json`, 22 constants. **Rule: a number used by more than one item
has exactly one owning item; every other item cites it and may not restate a different value.**
Owners and named consumers are validated by `corpus-index.mjs --check` (RI-MTH05 C4), so an
owner that stops existing is now a build failure rather than a dangling reference.

| Constant | Value | Unit | Owner |
|---|---|---|---|
| `world.walk_speed_mps` | 2.0 | m/s | **RI-WLD01** |
| `world.jog_speed_mps` | 3.2 | m/s | **RI-WLD01** |
| `world.sprint_speed_mps` | 5.0 | m/s | **RI-WLD01** |
| `world.swim_speed_mps` | 1.1 | m/s | **RI-WLD01** |
| `world.tide_wade_speed_mps` | 1.3 | m/s | **RI-WLD01** |
| `combat.traversal_minute_m` | 120 | m per traversal minute (TM) | **RI-AI07** |
| `world.timescale` | 20 | game minutes per real minute | **RI-WLD01** |
| `world.trunk_road_m` | 25331 | m | **RI-WLD01** |
| `world.walkable_land_km2` | 14.5 | km^2 | **RI-WLD01** |
| `world.crossing_minutes` | 79 | minutes, walking, longest settlement-to-settlement road path (Thorn to Soulrest) | **RI-WLD01** |
| `world.dungeon_census.loops` | 8 | Souls-loop dungeons | **RI-WLD07** |
| `world.dungeon_census.caves` | 82 | Morrowind-style small interiors | **RI-WLD07** |
| `world.interior_census.total` | 250 | interiors | **RI-WLD07** |
| `world.enemy_census` | 1230 | hand-placed hostile instances | **RI-WLD07** |
| `progression.total_souls_first_clear` | 1124285 | souls, 100% clear of the six regions | **RI-PRG06** |
| `progression.roster_derivation_n` | 576 | enemies | **RI-PRG06** |
| `combat.framerate_hz` | 60 | Hz | **RI-CMB02** |
| `combat.min_startup_frames` | 6 | frames | **RI-CMB02** |
| `dialogue.corpus_scope` | full-vendored-file | scope selector | **RI-DLG02** |
| `combat.sim_step_hz` | 60 | Hz | **RI-CMB01** |
| `combat.souls_tick_hz` | 30 | Hz | **RI-CMB01** |
| `combat.equipload_tiers` | 30/70/100 | % of max equip load, 4 tiers | **RI-CMB01** |

**Deliberate divergences — kept, and recorded as divergences.** An unrecorded divergence is
indistinguishable from an error; a recorded one is a design decision. Flattening these would
have been the tidier edit and the wrong one.

| Item | Constant | Its value | Why it stands |
|---|---|---|---|
| `RI-STL01` | `world.walk_speed_mps` | 0.85 | Sneak locomotion, deliberately 42.5% of walk. Not a competing definition of walk speed; RI-STL01 cites S17 correctly. KEPT. |
| `RI-CRM01` | `world.jog_speed_mps` | 3.4 | Guard pursuit speed, stated as 3.4 m/s against RI-WLD01's jog of 3.2 m/s. Found by this audit; not in the queue. A 6% divergence with no stated reason. KEPT as a divergence rather than silently retuned - guards may legitimately outrun the player's jog - but now recorded so a later reader does not treat it as the walk-speed collision returning. RI-CRM01's derived 6-90 s guard response window is unchanged; at 3.2 m/s its ceiling would be 96 s. |
| `RI-MAG02` | `world.walk_speed_mps` | 0.8 | Levitation climb rate, deliberately slower than walk so levitation is never a shortcut across flat ground (S17-compatible). KEPT. |

---

## 11. The ledger — edits made, and edits deliberately NOT made

### 11a. Files edited

| File | What |
|---|---|
| `corpus/10-combat/RI-AI07-encounter-composition.md` | traversal minute 204 → 120 m; 11 figure groups re-derived; new §H |
| `corpus/10-combat/RI-AI05-*.md` | W8: `fixture: wave-standard-build` pinned; unstated fixture ⇒ 0 |
| `corpus/10-combat/RI-CMB01-*.md` | 30 fps-tick unit warning; §B rationale annotated; ladder ownership asserted |
| `corpus/10-combat/RI-CMB02-attack-frame-data.md` | B4: 6 f startup clamp; ≥2 f rule scoped to the 7-class spine; backstep + guard-counter rows; two-handed row strengthened |
| `corpus/10-combat/RI-CMB08-healing-flask.md` | 4 dead `judges:` paths → canonical (it judged nothing) |
| `corpus/20-progression/RI-PRG04-hearth-and-death.md` | ID-09: S7 axis rewritten two-directional |
| `corpus/20-progression/RI-PRG06-souls-yield-and-pace.md` | enemy-census reconciliation; new §7 |
| `corpus/20-progression/RI-PRG07-*.md` | equip-load ladder ruled to `RI-CMB01`; §4 retiered |
| `corpus/23-stealth-crime/RI-CRM01-*.md`, `RI-STL02-*.md` | S20 → S21 renumbering (5 sites) |
| `corpus/25-magic/RI-MAG02-effect-catalogue.md` | B11: `min_tier` carve-out for the 4 teleport spells |
| `corpus/30-quests/RI-QST05-*.md` | W6: VERB-SPREAD hard fail; formal STL/CRM dependency |
| `corpus/40-dialogue/RI-DLG02-words-per-settlement.md` | scope ruling; locality floor 0.35 → 0.28; new tail section |
| `corpus/40-dialogue/RI-DLG07-blind-comparison-pack.md` | W3: indistinguishability replaces `ours_win_rate`; VOID outcome |
| `corpus/40-dialogue/data/README.md` | discrepancy note resolved |
| `corpus/50-world/RI-TRV01-transport-network.md` | +2 `judges:` paths; How-we-lose bullet marked fixed |
| `corpus/50-world/RI-TRV02-travel-magic.md` | B11 resolved-note |
| `corpus/50-world/RI-WLD01-*.md` | ID-17: "no fast travel" → measurement condition |
| `corpus/50-world/RI-WLD02-density-per-minute.md` | W2 + B2: settled-region D1/D2/D13; V5/V6 added; scoring and score-0 rewritten |
| `corpus/50-world/RI-WLD05-strangeness-bar.md` | W1 distribution rule; E-column arithmetic; element 29 excluded; #22 travel wording |
| `corpus/50-world/RI-WLD08-the-living-world.md` | 5 dead `judges:` paths → canonical, 3 of them new |
| `corpus/50-world/RI-WLD09-the-opacity-budget.md` | proposed amendments marked APPLIED |
| `corpus/60-lore/RI-LOR04-naming-and-language.md` | §4 minority-form ruling; new §6b |
| `corpus/60-lore/RI-LOR05-*.md`, `RI-LOR06-*.md` | 8 + 8 dead `judges:` paths → canonical (LOR06 judged nothing at all) |
| `corpus/60-lore/data/jel-lexicon.json` | 42 attested exceptions; inventory gaps; 4 glosses; +16 roots; grammar amended |
| `corpus/70-visual/RI-VIS01-*.md` | F17–F19 and CC-7 appended |
| `corpus/80-methods/jel-phonotactics.py` | two-mode canon/coinage; `--self-test`; 3 classifier fixes |
| `corpus/80-methods/RI-MTH03-*.md` | W5: 5 false mappings removed |
| `corpus/80-methods/HARNESS.md` | B8: UI viewpoint set with its own pinned DPR |
| `corpus/86-ui/RI-UIX06-*.md` | applied-notes |
| `corpus/00-doctrine/*` | `ARBITRATION.md` (unit warning), `CORPUS-CONTRACT.md` (`side: split`), `SCORING.md` (W7), `CRITIC-DOCTRINE.md` (B13), `COHERENCE-AGENT.md` (T6), `subsystems.json` (+123 paths, +5 critics, 1 retitle), `constants.json` (new), `INDEX.md` (regenerated) |
| `tools/corpus-index.mjs` | `--check` made blocking; C3 and C4 checks added; `side` enum |
| `corpus/80-methods/RI-MTH05-corpus-coherence.md` | **new** |

### 11b. Edits deliberately NOT made, and why

| Not done | Why |
|---|---|
| **No `camera.*` root** | `RI-CAM01`–`07` all judge existing `combat.camera.*` / `render.*` / `ui.*` paths and indexed with **zero orphans**. Registering 8 unused paths would have created **8 new corpus holes** and blocked builders on subsystems no item judges — strictly worse than doing nothing. If the camera area wants its own root, the items must move their `judges:` in the same commit |
| **202 legacy aliases left in use** | They all resolve; `subsystems.json` documents aliases as a deliberate migration aid; `INDEX.md` §4a lists every one with its user; `--check` does not gate on them. Rewriting front-matter across 60+ items for zero semantic change is churn with a real risk of reintroducing the orphans just removed |
| **The 14 corpus holes not filled** | All 14 pre-date this audit. Filling a hole means *writing a reference item*, which is authorship. A hole is an honest signal saying "do not build this yet"; a stub written to make a number go green is a false mapping in a new costume (RI-MTH05 §C) |
| **Souls frame counts not rebased to 60 Hz** | §9a. Doubling every inherited frame count across four combat items and regenerating the `RI-CMB07` exemplar trace is a **design decision about how the game feels**, settled by playing, not by auditing. Declared, registered, and left open — and deliberately *not* relabelled as intentional pacing, because the verification agent is explicit that it was an error |
| **`RI-PRG03`'s skill-event budget not retuned** | §2. At the reconciled 1,230-enemy census the kill count roughly doubles, so RI-PRG03 now *over*-delivers skill progress. Over-delivery is the softer failure, and re-deriving a skill curve is design work |
| **`RI-DLG02`'s per-settlement tier targets not restated** | §3. The brief asked for them to be restated; the arithmetic shows the correct restatement is **no change**. They derive from Balmora's measured 38,760 local words, and the corpus total grew because *Tribunal and Bloodmoon settlements* entered the population, not because Balmora got bigger. Scaling them by 1.35 would have been an error dressed as a correction |
| **`RI-DLG02` §A's per-layer entry counts not restated** | The vendored file has no `Cell` column, so the speaker-unique / cell-filtered / global split is **not recomputable**. The layer *shares* are carried forward and the entry counts are dashed. Inventing them would have been worse than admitting the gap |
| **`gr`, `kr` and geminates not removed from the Jel forbidden list** | §5a. Canon contains them (*Greel*, *Krona*, *Vakka*) and the attested-exception list handles that. Those rules exist to stop **coined** Jel drifting into generic fantasy, and canon's licence to say *Krona* is not our licence to coin *Krothgar*. They stay, enforced in coinage mode only |
| **`xul-aneekh` and `ixtu-xul` not renamed** | §5c. `Xul-Aneekh` appears in `RI-CRM01`, `RI-CRM02`, `RI-MAG03`, `RI-TRV01` and `travel-network.json`; a rename is a corpus-wide sweep with a real chance of a dangling reference. Under the attested gloss both terms get *better*, so re-glossing is both safer and truer |
| **`RI-CRM01`'s 3.4 m/s guard run not retuned** | Recorded as a deliberate divergence in `constants.json` instead. It is 6% off `RI-WLD01`'s jog and guards may legitimately outrun the player. Found by this audit; not in the queue |
| **`PROVENANCE-UPGRADE-02-SOULS` amendments 1–11 not applied** | §9c. They change what an item *claims about a source* — attribution and disclosure — which is the owning item's authorship, not cross-item incoherence |
| **W9 (`RI-PRG07` Burden clamp) untouched** | BAR-CRITIQUE-01 explicitly asks for no change to the ruling, only for the counterweight to exist. AR-3 is in ARBITRATION §3 and `RI-CMP01` exists |
| **Every item's W7 ladder-anchor row not filled in** | SCORING.md §1.2 now *requires* the row and makes its absence score 0. Filling it in for 126 items means choosing, per item, which native score means "meets the bar" — a judgement about each item's own standards, belonging to its owner |

---

## 12. What remains contradictory or outstanding

Nothing here is hidden; each is listed because closing it is authorship or a design decision,
not coherence repair.

1. **The 2× Souls pacing (§9a).** Declared and registered; **not resolved.** Whether the frame
   counts should double is an open design question for a wave that can play the result. **This
   is the largest outstanding item in the corpus**, and it is invisible to every automated check
   we have — by construction, since every ratio is preserved.
2. **W7's per-item ladder-anchor rows.** The rule binds as of this wave; **126 items do not yet
   carry the row**, and under the rule as written they would all be `unmeasurable ⇒ 0`. It was
   written harsh deliberately, but it needs a pass by item owners before the next wave scores
   anything.
3. **`PROVENANCE-UPGRADE-02-SOULS` amendments 1–11** — attribution and disclosure fixes.
   Notably: `RI-CMB05` cites DS3 exclusively and implements Elden Ring; `RI-CMB03`'s bar
   presents the drop-the-input stamina gate as what makes the economy feel like Souls, while its
   own provenance note correctly calls it constructed and no Souls game implements it.
4. **14 corpus holes**, unchanged from before the audit and honestly reported by `--check`.
5. **202 legacy alias spellings**, resolving correctly, listed in `INDEX.md` §4a.
6. **`RI-WLD05` element 29** is excluded from automated counts until it gains a non-audio
   observable. The exclusion is recorded; the observable is unwritten.
7. **`RI-WLD05`'s `E` column is 20 against a ceiling of 12.** The arithmetic is now correct; the
   *content* decision — which eight elements move out of the first 30 minutes — is the world
   author's. The advisory twelve is in the item.
8. **C5 is only half executable** (`RI-MTH05` provenance note). `--check` catches contradictions
   between *registered numbers*. It cannot catch two contradicting prose claims, a bar wrong for
   a reason arithmetic cannot see, or a constant nobody registered. **The residual risk is that
   the executable half passes and the corpus is still incoherent — which is exactly what
   happened in wave 0**, when the index reported "up to date" while 147 paths were orphaned and
   three constants had two owners each. The mitigations are weaker than a check: this report,
   and M6/M7 as a standing per-wave obligation with a named owner.

---

## 13. Final state

```
node tools/corpus-index.mjs --check

INDEX.md is up to date.
  subsystem paths : 323      (was 200)
  reference items : 126      (was 125)
  judged          : 309
  CORPUS HOLES    : 14       (all pre-existing)
  legacy aliases  : 202 in use
  unresolved paths: 0        (was 147)
  problems        : 0 error, 0 warn   (was 148 error)

CORPUS COHERENCE GATE PASSED.
```

`node tools/gap-ledger.mjs` and `node tools/progress.mjs` regenerated clean (no verdicts exist
yet, so 0 gaps — the ledger is correctly empty, not broken).

**G7 is closed by a standing gate, not by this report.** The report discharges the manual half;
`RI-MTH05` and `corpus-index.mjs --check` are what stop it happening again.


---

## 14. Orchestrator rulings R1–R7 (`orchestration/ORCHESTRATOR-RULINGS.md`)

These landed **after** §9 was written and **supersede this audit's ruling in two places**. They
are recorded here as the authority, with what was applied and what was not.

### R1 / seam S22 — the 30 Hz rebase. **SUPERSEDES §9a.**

**The orchestrator ruled REBASE. This audit had ruled DECLARE.** The orchestrator's ruling
governs: all combat durations are rebased to 60 Hz by **doubling the upstream tick count**, and
every frame figure in the corpus must state its unit — a frame count without a stated framerate
is a defect.

**Applied:** the unit is now declared everywhere it was ambiguous — `RI-CMB01` §A carries the
warning and its DS1/DS3 columns are headed `@30 fps ticks`; ARBITRATION §1's I-frame row carries
it; `constants.json` registers `combat.sim_step_hz` (60) and `combat.souls_tick_hz` (30) with the
conversion. `RI-CMB05` and `RI-CMB08` carry an explicit note that their windows are outstanding
under S22.

**NOT applied — and this is the single largest outstanding item in the corpus.** The mechanical
rebase itself was not performed, on the judgement that **a half-applied rebase is strictly worse
than none**: doubling `RI-CMB01`'s roll ladder while `RI-CMB02`'s attack table stays unrebased
would create a fresh, live contradiction between the two most load-bearing combat items, and the
edit is large enough that finishing it inside this audit's remaining budget could not be
guaranteed. **It must be done in one commit, by one agent, across the whole set:**

| Item | What doubles |
|---|---|
| `RI-CMB01` | roll i-frames, startup, recovery, totals — the whole `ES-ROLL/1` ladder |
| `RI-CMB02` | the entire `ES-FRAMES/1` attack table, §B heavies, §C's fixed backstab/riposte frames |
| `RI-CMB05` | parry windows, critical animation lengths, stagger tiers, hyperarmour windows |
| `RI-CMB08` | the 65-frame drink animation and `heal_secure_frames` |
| `RI-AI02`, `RI-AI03` | windup and punish windows — **derived against the unrebased player numbers**, so they move with them |
| `RI-WPN01`–`RI-WPN06` | all slot frame data |
| `RI-CAM04` | the tracking cutoff |
| **`RI-CMB03`** | **NOTHING — do not double the 42-frame regen pause.** It was derived from 0.70 s and is already correct at 60 Hz. It is the one place the conversion was done properly |
| **`RI-CMB07`** | the exemplar trace is **invalidated** and must be regenerated. The orchestrator accepts that cost explicitly |

Derived constraints that must be re-checked after the rebase, because they are ratios against
frame counts: `RI-CMB02` §E's `recovery/startup` floors and the **6 f minimum startup** (§8a — at
2× it should become 12 f, or be restated in milliseconds), `RI-AI03`'s `P_safe ≥ 15 f` floor
against `RI-CMB08`'s `heal_secure_frames`, and `RI-CMB01` M5's cliff test.

### R2 / seam S23 — equip load. **REFINES §9b.**

This audit ruled the whole ladder to `RI-CMB01`. **S23 splits it by domain instead**, which is
the better ruling: `RI-CMB01` owns everything the tier does **inside the fight** (boundaries as
they gate roll behaviour, i-frames, roll distance, recovery); `RI-PRG07` owns **out-of-fight
encumbrance and may keep finer granularity there** — carrying capacity, world-map movement,
fatigue, hauling — **provided its extra tiers have no in-fight effect whatsoever**. On any
in-fight disagreement `RI-CMB01` wins. **Applied:** `RI-PRG07` §2 now carries S23 explicitly and
its 55%/80% marks are licensed to survive as out-of-fight bands. Both items' method scripts are
reconciled (`RI-PRG07` method 4's four-transition assertion yields to `RI-CMB01` M5's two
cliffs); **the scripts no longer fail each other.**

### R3 — poise provenance. **APPLIED.**

`RI-CMB05` implements an always-on depleting poise pool (DS1/Elden Ring) fused with
hyperarmour-on-declared-frames (DS3), and attributed the whole thing to DS3, which does not have
an always-on pool. **The fused model is not fictional — Elden Ring ships exactly that
combination.** Citation fix, not a redesign; the model is untouched and the provenance note now
says so.

### R4 — the stamina floor. **APPLIED.**

`RI-CMB03`'s drop-the-input-below-cost rule is a **construction**, not Souls behaviour: DS3 lets
stamina go to −60 and both games gate on `stamina > 0`. It is a good construction for a
trace-verifiable sim — a dropped input is a discrete assertable event, a debt is not — so the
rule is kept and the **claim** is relabelled. The item's bar and its provenance note now agree;
previously the bar called it "what makes the economy feel like Souls" while the provenance note
correctly called it constructed.

### R5 — two undeclared blends. **APPLIED.**

`RI-CMB01` pairs DS3's 30/70 breakpoints with **DS1's tier-duration model** (in DS3 light and
medium rolls are the same length and light buys distance only). `RI-CMB08`'s flask mixes **DS1
charge counts with DS3 upgrade rules**, and its percentage heal is ours. Both are defensible;
both now say so.

### R6 — the two manifest defects. **NOT APPLIED, correctly.**

The ruling itself says *"apply when Codex's set has landed"*, to avoid racing on `MANIFEST.json`.
Restated so it is not lost: five `anti-generic/` records carry `side: "modern-fidelity"` where §9
requires `"anti-generic"` — **this one matters**, because anything selecting the fidelity
population by `side` would pull five *deliberately generic-fantasy* anchors into the set they
exist to be measured against. And two mwscr images are filed under two slots each, so REF-A18 and
REF-A19 are 4 images, not 5.

### R7 / seam S24 — biome diversity. **NOT APPLIED — a content sweep, recorded.**

Black Marsh is the *name*, not the terrain: thirteen regions, mountains through petrified forest
through two different seas, and **water, tides and wetland belong to specific regions, never to
the world globally**. Any item, brief or builder instruction implying a globally swampy world
must be corrected, and `RI-WLD04`'s blind region-identification test (≥33/39 from unlabelled
screenshots, ≥6 of 9 axes differing per pair) is the enforcement. **This is a sweep over world,
art-direction, audio and encounter prose** — a search for a *tone* rather than a contradiction
between two numbers — and it is the one queue item this audit could not scope reliably. It needs
its own pass with the map open. Recorded here rather than half-done.

### One more numbering collision found while applying these

`RI-CMB08` §E proposes a seam ruling and numbers it **S16** — which was already taken by the
dungeon census before that proposal was written. Same class of error as the S20/S21 clash. The
number is withdrawn in the item and the proposal (in-fight healing consumables locked as topic
lists are under S13) stands on its merits, awaiting a free number from the doctrine owner.
ARBITRATION §2 is at **S24** as of this wave.
