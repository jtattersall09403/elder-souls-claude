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
