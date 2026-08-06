---
id: RI-LOR07
title: Canon conformance — Argonians and the geography of Black Marsh, checked against the mined record
kind: structure
side: morrowind
judges: [lore.canon.argonian, lore.canon.geography]
provenance: community-data
confidence: high
blind_pair: no
---

## The bar

`RI-LOR01` is the canon **dossier** — what is true. `RI-LOR06` is the **contradiction discipline** —
how sources are allowed to disagree. `RI-LOR04` is the **naming grammar**. None of them is a
conformance test, and until this item existed **nothing in the corpus checked shipped content against
the mined record**. A dossier nobody diffs against is a reading list.

This item is the diff. It has two halves and one instrument.

**Argonians.** Not "are they lizard people" — everyone gets that right. The things that are actually
canon and are actually got wrong: that they are **Saxhleel, "People of the Root"**; that the **Hist**
made them and still decides what hatches; that Argonians are *"at home in water and on land"* with
**natural immunities to disease and poison**; that they wear **no footwear**; that **naga** are a
distinct Argonian people rather than a monster; that outsiders call them *"lizards"* and *"the Lizard
Folk"* **and mean it as an insult**; that they have a **human lifespan**; that they are, in 3E 427,
being **legally raided for slaves by House Dres**; and that their names come in **three distinct
shapes**, not one.

**Geography.** Every place name in our world must be classifiable as **canon**, **canon-adjacent**
(derived from a canon name by a stated rule), or **invented** — and the invented ones must obey
`RI-LOR04`'s phonotactics. Beyond names, the *arrangement* must not contradict canon: **Topal Bay is
west**, the **Padomaic is east**, the **Onkobra runs eastward from Topal Bay into the dark heart of
the province**, **Helstrom is the impenetrable centre**, **Gideon is a real city with real slavers in
it**, and **Blackrose is a prison**. Those are not flavour; they are checkable statements, and three
of them constrain the map we have already drawn.

**And the era gate is automatic.** Seam **S20**: our window is **3E 427**; the richest Argonian
material in existence is ESO's, at **2E 582 — 855 years earlier** — and is admissible only where the
subject has a long half-life. `blackmarsh-canon.json` already stamps every one of its 194 places, 66
creatures, 471 NPCs and 147 lore facts with an `era` field. This item is where that field is
*enforced* rather than merely present.

## The reference artifact

### 1. The Argonian conformance checklist

Every row is checkable against shipped `game/data/**`. **Source column: `X` = verified this session in
the vendored UESP extract; `D` = `corpus/60-lore/data/blackmarsh-canon.json`; `C` = `RI-CHR02`/corpus
commitment.**

| # | Canon property | Bar on shipped content | Src |
|---:|---|---|---|
| A1 | **Saxhleel**, "People of the Root", is the endonym; "Argonian" is the outsiders' word | both appear; Argonian NPCs use *Saxhleel* of themselves in ≥ 20% of self-referential lines; no non-Argonian NPC uses it casually | **X** |
| A2 | The **Hist** created them and shape what hatches; the Hist are sapient spore-trees connected by root | ≥ 12 dialogue topics and ≥ 4 books treat the Hist as an **agent**, never as scenery; no text calls a Hist "a big tree" without a speaker who is wrong on purpose | **X**, D |
| A3 | *"At home in water and on land"* — **water breathing**, and the amphibious clause | `RI-WLD10` §3's amphibious privileges are implemented; no Argonian NPC drowns | **X**, C |
| A4 | **Resist Poison 100%, Resist Common Disease 75%** in Morrowind | `RI-CHR02`/`RI-PRG09` values present; **divergence declared**, not silent | **X** |
| A5 | **No footwear**, and limited headgear | 0 Argonian NPCs with boots; the constraint is remarked on in ≥ 2 places | **X** |
| A6 | **Naga** are a distinct Argonian people, with settlements and their own language | naga are a *culture* with dialogue, dwellings and a non-combat resolution path, not a monster archetype | **X**, D |
| A7 | Outsiders say *"lizards"* / *"the Lizard Folk"*, derogatively | ≥ 6 non-Argonian NPCs use it; **≥ 2** are corrected or answered for it | **X** |
| A8 | Lifespan **similar to humans** | no text implies elven longevity | **X** |
| A9 | Reputation as *"the foremost experts in guerrilla warfare"* from defending their borders | ≥ 3 sources say so; ≥ 1 Argonian finds the reputation useful and ≥ 1 finds it insulting | **X** |
| A10 | **3E 427: House Dres slaving is legal and current** | present as an active pressure, not history (`RI-LOR02` §1) | C, D |
| A11 | **Three name shapes**: Jel-derived (*Heem-Ja*), hyphenated deed-names in the common tongue (*Sees-All-Colors*), and Cyrodilic given names among the assimilated | all three present; ratios within `RI-LOR04`'s bands; Jel-derived names pass `jel-phonotactics.py` | D |
| A12 | **Egg-tending and clutches** are ordinary domestic life | egg-clutches are placed, owned, and legally protected (`RI-WLD05` #15/#27) | D |
| A13 | Argonians of Gideon are ruled by **Archeins** — *"pompous, assimilated, slaver kleptocrats"* — i.e. **Argonians collaborate** | ≥ 1 named Argonian collaborator faction; the province is not one moral bloc | **X** |
| A14 | Black Marsh was **incorporated into the Empire** after the Argonians retreated to Helstrom's impenetrable centre | the Empire's presence is late, thin and resented (`RI-WLD14` E1–E5) | **X** |

**A13 and A7 together are the item's real Argonian bar.** A province where every Argonian is a
sympathetic victim and every Imperial a villain is not canon, it is a modern habit; the extract
supplies the corrective in the Argonians' own literature.

### 2. The geography conformance rules

| # | Rule | Bar |
|---|---|---|
| **G1** | Every named place in `game/data/world/pois.json`, `settlements/`, `regions.json` carries a `canon_class` ∈ `canon` / `canon-adjacent` / `invented` and, for the first two, the `blackmarsh-canon.json` record or extract page it derives from | 100% classified |
| **G2** | Named POIs that are `canon` or `canon-adjacent` | **≥ 25%** |
| **G3** | The **8 settlements** are all real Black Marsh place names | **8/8** |
| **G4** | `invented` names pass `corpus/80-methods/jel-phonotactics.py` | 100% |
| **G5** | No `invented` name collides with a canon name for a **different** kind of thing | 0 collisions |
| **G6** | **Arrangement constraints** (§3) | all 6 satisfied |
| **G7** | Canon places used **outside** their canon zone | 0 |
| **G8** | **Era gate (S20):** every canon claim sourced from a 2E record carries an admissibility justification from the allow-list — geography, rivers, ruins, xanmeers, species, flora, the Hist, deep history, naming practice, egg-tending, Jel, religious structure | 100%; **0** 2E facts used for power, living individuals, current alignments, prices or active conflicts |

### 3. The six arrangement constraints — verified this session

Each is quoted from the vendored extract and each is a statement our map can contradict.

| # | Canon | Our map | Status |
|---:|---|---|---|
| **P1** | **Topal Bay is to the west.** *"…soon revealed the bright blue expanse of Topal Bay far to the west"* (*The Argonian Account, Book 3*) | `RI-WLD10` §9 assigns Topal Bay to the **west and south** coasts (Marauder's Coast x 268–898, the southern seaboard) | ✔ **conformant** |
| **P2** | **The Padomaic is the eastern ocean** | Crimson Coast (x 3872–4642) and the Eastern Rootlands' seaward edge face it | ✔ conformant |
| **P3** | **The Onkobra River runs eastward from Topal Bay, "deep into Black Marsh, to the very dark heart of the province"** | **our map has no Onkobra.** This is a **gap to close**, not a contradiction: a west-to-east trunk river from the Topal seaboard toward the Deep Marshes is *available* on our layout and would be the single cheapest canon win in the world area | ⚠ **missing — action** |
| **P4** | **Helstrom is the impenetrable centre.** *"they retreated to Helstrom, into the impenetrable center of the Province where the men and mer wouldn't follow"* (PGE3, Argonia) | Helstrom sits in The Stone Forest (x 1982–3418, z 1580–2840) — central — and `settlements.json` calls it *"the hub of the root-network, so every road and every travel route ends here"* | ✔ conformant, and stronger than it knew |
| **P5** | **Gideon is a real city whose Argonian rulers, the Archeins, are slavers**; a caravan bound for Gideon is going **south** | Gideon is in Blackwood (x 355–1808) on the Cyrodiil side, which is where a Reman-era castle and an assimilated kleptocracy belong | ✔ conformant; **A13's faction must be sited here** |
| **P6** | **Blackrose is a prison** (`Blackrose Prison`, attested) | `RI-WLD03` gives Blackrose a prison as its attached loop-dungeon | ✔ conformant |

**P3 is this item's single most useful output.** It is a named, canonical, west-to-east river that our
world does not have, on a map whose water system (`RI-WLD10`) was just specified. Adding it costs one
polyline and one name and buys a canon anchor that a critic can check.

### 4. What the extract can and cannot confirm — stated, because it matters

| Settlement | Attested in the vendored extract? |
|---|---|
| **Lilmoth** | ✔ directly (multiple pages) |
| **Stormhold** | ✔ directly |
| **Blackrose** | ✔ directly, **as a prison** |
| **Helstrom** | ✔ by reference (PGE3; and the *Helstrom Ancestor Lizard* is *"named for the city of Helstrom"*) |
| **Gideon** | ✔ by reference (Castle Giovesse, 1E 2899; the Archeins) |
| **Soulrest** | ✔ by reference only (5 hits) |
| **Archon** | ✔ by reference only (11 hits) |
| **Thorn** | ✔ by reference only (65 hits, most of them other senses of the word) |

**All 8 clear G3**, but four of them rest on passing references rather than on a page of their own.
A critic must not report "8/8 canon settlements" without also reporting **which four are thin**, and
any content that *characterises* Soulrest, Archon or Thorn is therefore **ours** and must be labelled
`constructed` in whatever item states it. Silence about the thinness is the dishonesty this section
exists to prevent.

### 5. The era gate, made mechanical

`blackmarsh-canon.json` stamps every record: *"ESO (Online:*) and Stormhold material is Second Era,
roughly 855 years before our window… Where an ESO fact and a Morrowind-era fact conflict, this file
reports both and flags it; it does not choose."* **S20 chooses: the Morrowind-era source wins
outright.** The gate:

```
for each canon claim C used by shipped content:
    if C.era startswith "2E":
        require C.admissibility in ALLOW_LIST                       # G8's list
        require no 3E-era record contradicts C                      # else the 3E record wins (S20)
    if C.era startswith "2E" and C.subject in {power, living_individuals,
                                               alignments, prices, active_conflicts}:
        REJECT                                                      # hard, no justification available
```

The file also records that the **only sources within a generation of our window are two Arena pages
(3E 399) and they are nearly empty**. That is the honest state of the evidence and every lore verdict
should say so rather than implying a rich 3E record exists.

## Comparison method

**M1 — Registry integrity.** `python3 corpus/80-methods/canon-check.py --validate-registry`.
- **FAIL** on exit 1. Cited from `RI-LOR06`; not re-specified here.

**M2 — Claim triage against shipped text.**
`python3 corpus/80-methods/canon-check.py --claims game/data/dialogue/**/*.json game/data/books/*.json game/data/quests/*.json --strict`
- Produces, for every lore-bearing text, the registry facts it touches. **A human or model critic then
  adjudicates** — the script does not, and this item does not pretend it does.
- **FAIL** if any shipped text touches a `deliberately_open` or late/never-discoverable fact
  (`--strict`'s exit 1), or if the adjudication finds a text contradicting a non-disputed fact.

**M3 — The Argonian checklist (A1–A14).** For each row, run its stated count over `game/data/**`
(dialogue topics, greetings, rumours, books, NPC records, faction records, item records).
- **FAIL** if fewer than **12 of 14** pass; **FAIL** outright on A2, A6, A7 or A13 failing — those four
  are the ones a build gets wrong by default (Hist as scenery, naga as monsters, no slur and no answer
  to it, no Argonian collaborators).
- Report every row's measured count, not a verdict.

**M4 — Name classification (G1–G5).** Join every named place in `game/data/world/**` against
`blackmarsh-canon.json`'s 194 places and against the extract by title search
(`node tools/uesp/uesp-query.mjs --re "<name>" --count`).
- **FAIL** if any name is unclassified; if `canon` + `canon-adjacent` < 25%; if any of the 8
  settlements is unattested; if any `invented` name fails
  `python3 corpus/80-methods/jel-phonotactics.py`; or on any G5 collision.
- Report the thin-attestation list (§4) alongside the pass count. **A run that reports 8/8 without the
  thin list has failed its own method.**

**M5 — Arrangement (G6/P1–P6).** Assert each of §3's six constraints against `world-scale.json`,
`regions.json` and `settlements.json` by coordinate.
- **FAIL** if Topal Bay is placed east, the Padomaic west, Helstrom off-centre, Gideon away from the
  Cyrodiil border, or Blackrose without its prison.
- **REPORT (not fail) P3** until the Onkobra exists; **FAIL** once a river is added that contradicts
  it (a westward Onkobra, or an Onkobra that does not reach the interior).

**M6 — The era gate (G8).** Walk every canon claim cited by shipped content; read its `era` from
`blackmarsh-canon.json`.
- **FAIL** on any 2E claim used for power, living individuals, current alignments, prices or active
  conflicts; on any 2E claim used without an admissibility justification; or on any 2E claim retained
  where a 3E record contradicts it (**S20**).
- Report the 2E/3E ratio of all canon claims in use. **Expect it to be dominated by 2E** — that is the
  evidence base, and a build that reports a 3E-dominant ratio has probably invented its sources.

**M7 — The negative check: canon we are contradicting on purpose.** Every deliberate divergence
(the Argonian amphibious upgrade in `RI-CHR02`, disease **immunity** against Morrowind's 75%, our
invented regions, the Rootward Tide) must appear in a **declared divergence list** in
`game/data/lore/divergences.json` with a reason.
- **FAIL** on any divergence found by M2–M6 that is not declared. **An undeclared divergence is a
  lore bug; a declared one is a design decision** — the same rule `constants.json` applies to numbers.

## Scoring

| Check | Weight | Pass condition |
|---:|---|---|
| M1 registry integrity | 8 | exit 0 |
| M2 claim triage + adjudication | 16 | no contradiction of a non-disputed fact |
| **M3** Argonian checklist | **26** | ≥ 12/14, and A2/A6/A7/A13 all pass |
| **M4** name classification | **20** | 100% classified, ≥ 25% canon, 8/8 settlements, thin list reported |
| M5 arrangement | 14 | P1, P2, P4, P5, P6 conformant |
| M6 era gate | 12 | zero inadmissible 2E uses |
| M7 declared divergences | 4 | none undeclared |

- **≥ 85** — the province is the one in the books.
- **70–84** — playable, gap named.
- **< 70** — **we lose.**

**Automatic fail regardless of score:** the Hist treated as scenery (A2); naga as a monster archetype
rather than a people (A6); no in-world use of the "lizard" slur *and* no answer to it (A7); no
Argonian collaborators (A13); any of the 8 settlements not being a real Black Marsh place name; a 2E
fact used for a 3E political claim (**S20**); any undeclared canon divergence; a verdict reporting
"8/8 canon settlements" without §4's thin-attestation caveat.

## How we lose

1. **Lizard people in leather armour.** The default. Every canon property in §1 passes as flavour text
   and nothing about the culture — egg-law, name-changes, no chairs, no boots, mud as a social
   material — reaches the systems. `RI-WLD05`'s how-we-lose says the same thing from the art side.
2. **The Hist as a big glowing tree.** The single most important canon object in the province and the
   easiest to render as scenery. A2 is an automatic fail for that reason.
3. **Naga as an enemy type.** They are an Argonian people with kiln-cities, a language and patrols
   (`regions.json`: *"the only hostile CULTURE"*). Shipping them as a monster archetype deletes a
   people and a non-combat resolution path in one move.
4. **One moral bloc.** Every Argonian oppressed, every Imperial complicit. The Archeins of Gideon —
   *"pompous, assimilated, slaver kleptocrats"* — are Argonians, in the Argonians' own literature, and
   leaving them out is both a canon failure and a writing failure.
5. **ESO smuggled in wholesale.** It is the richest Black Marsh material that exists, it is 855 years
   early, and it is *right there* in the data file. A build that ships Murkmire's living politics as
   3E politics passes every internal check and fails S20 entirely. M6 is the only guard.
6. **The era field present and never read.** `blackmarsh-canon.json` stamps every record; nothing
   consumed the stamp until this item. A field nobody enforces is a comment.
7. **Invented names that sound Cyrodilic.** `jel-phonotactics.py` exists; the risk is that 60% of the
   world's POIs are `invented` and nobody notices, because each name passes individually. G2's 25%
   canon floor is the aggregate guard.
8. **The Onkobra never added.** The one named river of Black Marsh in the fiction, absent from a
   province whose entire water system we just specified. It will stay absent because nothing currently
   asks for it; M5 asks.
9. **"8/8 canon settlements" reported as strength.** Four of them are passing references. Reporting
   the count without the thinness is exactly the provenance dishonesty `CORPUS-CONTRACT` §3 forbids,
   and it is easy to do accidentally because the count is true.
10. **Divergences that are never written down.** The amphibious upgrade, the disease immunity, thirteen
    invented regions — all legitimate, all deliberate, and all indistinguishable from errors once the
    people who made them are gone. M7 is cheap and will be skipped.

## Provenance note

- **`community-data`, confidence high**, verified this session from the vendored UESP extract
  (`corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz`, 2019-11-07 dump, read via
  `tools/uesp/uesp-query.mjs`). Direct quotations used above:
  - *Morrowind:Argonian* — *"Argonians (Saxhleel, or People of the Root…)"*; *"The other races often
    refer to them as 'lizards' or the 'Lizard Folk'… especially when meaning to be derogatory"*;
    *"known as the foremost experts in guerrilla warfare"*; *"Argonians have a lifespan similar to
    that of humans"*; *"At home in water and on land… with natural immunities protecting them from
    disease and poison"*; *"limited to some headgear and no footwear"*; and the racial package
    **Water Breathing 120 s, Resist Poison 100%, Resist Common Disease 75%, Athletics +15**. (A1,
    A3, A4, A5, A7, A8, A9.)
  - *Lore:The Argonian Account, Book 3* — *"soon revealed the bright blue expanse of Topal Bay far to
    the west"*; *"a fast-moving stream, running eastward from Topal Bay… called the Onkobra River. It
    ran deep into Black Marsh, to the very dark heart of the province."* (P1, P3.)
  - *Lore:The Argonian Account, Book 4* — *"the Archeins of Gideon…"* / *"Pompous, assimilated, slaver
    kleptocrats."* (A13, P5.)
  - *Lore:People T* — Reman III imprisoned his empress *"in Castle Giovesse of Gideon, Black Marsh"*
    (1E 2899). (P5.)
  - *Lore:Pocket Guide to the Empire, 3rd Edition/Argonia* — after the Battle of Argonia *"they
    retreated to Helstrom, into the impenetrable center of the Province where the men and mer wouldn't
    follow. The following year, Black Marsh was officially incorporated…"* (P4, A14.)
  - *Lore:Bestiary H* — the Helstrom Ancestor Lizard is *"named for the city of Helstrom"*. (P4.)
  - Attestation counts for the 8 settlements in §4 are `uesp-query.mjs --count` results, run this
    session: Gideon 19, Thorn 65, Archon 11, Helstrom 8, Soulrest 5, plus direct pages for Lilmoth,
    Stormhold and Blackrose. **The counts are community-data; the "thin" judgement in §4 is ours and
    is `derived`.**
- **`derived`:** every bar, ratio and threshold in §1 and §2 — the 20% self-reference rate, the 12 topics
  / 4 books, the 25% canon floor, the ≥ 12/14 pass mark and the four automatic-fail rows. These are
  ours and are not canon.
- **Cited, not redefined:** the canon dossier and its tiers (`RI-LOR01`); the contradiction discipline
  and the disputed/authorially-true machinery (`RI-LOR06`); the naming grammar and its ratio bands
  (`RI-LOR04`); the era rule (**S20**); the 3E political brief (`RI-LOR02`); the race table and the
  amphibious clause (`RI-CHR02`); the water model those privileges act on (`RI-WLD10` §3); the
  affliction resistances (`RI-PRG09`); the Empire's visible condition (`RI-WLD14` §3); the mined
  record itself (`corpus/60-lore/data/blackmarsh-canon.json`, `argonian-names.json`,
  `canon-facts.json`) and the two scripts that already exist to read it
  (`corpus/80-methods/canon-check.py`, `corpus/80-methods/jel-phonotactics.py`). **This item adds no
  new canon fact and no new script**; it adds the diff nobody was running.
- **Known defect in the record, reported not repaired:** `blackmarsh-canon.json`'s
  `cross_check_against_canon_facts` already records that **CF-045 is contradicted** — the Knahaten Flu
  ran *"43 years, from the year 2E 560 to 2E 603"*, not 41 years to 2E 601. That correction belongs to
  `canon-facts.json`'s owner (`RI-LOR01`/`RI-LOR06`) and is proposed, not applied, here.
