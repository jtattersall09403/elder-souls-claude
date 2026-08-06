---
id: PROVENANCE-UPGRADE-01
title: Provenance upgrade 01 — recalled figures audited against the UESP extract
kind: audit
side: both
judges: [doctrine.provenance, lore.canon_fidelity, quest.structure, world.settlements, progression.shape]
provenance: community-data (source quotations) + derived (all arithmetic and verdicts)
confidence: high on what the source says; medium on the classifications we built over it
blind_pair: no
---

## What this is

Nearly every Morrowind and Black-Marsh figure in the corpus was written while `en.uesp.net` was
returning 403 at the proxy, so it carries `provenance: canonical-recall` or `community-data` from
search snippets. Several items say in writing that a future pass should re-derive them. This is that
pass, run against `corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz` — 6,299 pages of raw UESP
wikitext, the first primary-ish source the project has had.

**It does not edit anyone else's item.** Each entry below states the claim, its stated provenance,
what the source actually says, and a verdict. Amendment text is supplied where the claim is wrong;
applying it is the owning item's call.

### Provenance ladder used here

| label | meaning |
|---|---|
| `community-data` | UESP editors' transcription of Bethesda's shipped content (2019-11-07 dump). Quoted text is this. |
| `derived` | Arithmetic or classification **we** performed over that data. Every fraction below is this. |
| `measured` | **Nothing here is measured.** We did not read the game's ESM files. A tool printing a number does not make it measured. |

### Verdict vocabulary

`confirmed` · `confirmed-with-correction` · `contradicted` · `unsettled` (source silent or not yet read)
· `flag-for-ruling` (source speaks, but from the wrong era)

### Tooling

Everything below is reproducible:

```bash
node tools/uesp/mine-quests.mjs          # corpus/30-quests/data/morrowind-quest-census.json
node tools/uesp/mine-world.mjs           # corpus/50-world/data/morrowind-world-census.json
node tools/uesp/mine-blackmarsh.mjs      # corpus/60-lore/data/blackmarsh-canon.json
node tools/uesp/mine-argonian-names.mjs  # corpus/60-lore/data/argonian-names.json
```

---

## Scoreboard

| verdict | count |
|---|---|
| confirmed | 9 |
| confirmed-with-correction | 6 |
| **contradicted** | **8** |
| unsettled (could not settle — reasons in §D) | 5 |
| flag-for-ruling (era conflict) | 1 |

The eight contradictions are the point of this document. Four of them are in `jel-lexicon.json`, and
one of those four is a claim marked `community-data` that has no source.

---

## A. The headline: the corpus's own Jel validator rejects canon

**Item:** RI-LOR04 · `corpus/60-lore/data/jel-lexicon.json` · `corpus/80-methods/jel-phonotactics.py`
**Claimed:** a constructed Jel phonology, with a validator that fails a piece at >5% violations. RI-LOR04
argues the decomposition is sound because "the system reproduces a canon creature name" (*haj mota*).
**Stated provenance:** `constructed`, confidence `high`.

**What the source says.** The extract contains `Lore:The Sharper Tongue: A Jel Primer` — an **in-world
24-word Jel glossary**, plus ~9 more attested Jel words and compounds elsewhere. Running the corpus's
own validator against those attested words:

```
python3 corpus/80-methods/jel-phonotactics.py --names <30 attested Jel words> --culture jel --verbose
violation rate: 26.7%  (threshold 5%)     RESULT: FAIL
```

| attested word | gloss | why our validator rejects it |
|---|---|---|
| **Saxhleel** | the Argonians' own word for themselves | unsplittable medial cluster `xhl` |
| **Thtithil** | egg — *already cited as canon by the corpus in CF-025* | illegal initial cluster `tht` |
| **Xeech** | seed — *a root in our own lexicon* | illegal final cluster `ch` |
| Greel | enemy | `gr` is on our forbidden-cluster list as an "epic fantasy" cluster |
| Krona | big, colossal | illegal initial cluster `kr` |
| Norg | forbidden | illegal final cluster `rg` |
| Vakka | sun | geminate `kk`, banned by our no-doubles rule |
| Xthari | a marsh plant | illegal initial cluster `xth` |

**Verdict: contradicted.**

This is not an argument that the phonology is bad design — a constructed dialect may legitimately be
narrower than the attested corpus. It is an argument that **a canon-fidelity tool is currently
calibrated to fail canon**, which is the opposite of its job. As it stands the validator would reject
an Argonian NPC saying *Saxhleel*.

**Amendment (choose one, both are defensible):**
1. *Minimal.* Add every attested word to `phonology.attested_exceptions` — they are exceptions
   **because** they are attested, exactly as `kaoc`, `naga`, `hist`, `jel`, `lukiul` already are. This
   preserves the coinage rules and stops the validator failing canon.
2. *Honest.* Drop `gr` and `kr` from `forbidden.clusters`, allow `ch` and `rg` as codas, permit
   geminates in attested loans, and add `tht`/`xth`/`xhl` to the onset and medial inventories.
   The forbidden-cluster list was written to keep Jel from sounding like generic fantasy; canon Jel
   contains those clusters, so the rule was protecting us from the source.

Either way, **`corpus/60-lore/data/argonian-names.json` now carries all 30 attested words**, so the fix
is a data edit, not research.

---

## B. Contradictions

### B1 — RI-QST05 · the Morrowind pacifist fraction (the corpus's most-flagged debt)

**Claimed:** "≈44% of Morrowind's quests are completable without killing"; honest range stated as 35–45%.
**Stated provenance:** `derived`, confidence **low**. The item says outright: *"Everything else in that
table — every per-segment estimate and the ≈44% total — is my own segment-level reasoning and must not
be cited as a measured figure,"* and asks a future wave to *"enumerate every quest's completion
conditions and count those with no required kill."*

**What the source says.** 488 quest pages carry a `{{Quest Header}}` infobox (Morrowind base 396,
Tribunal 38, Bloodmoon 54). Classifying each by whether UESP's **Quick Walkthrough** — its list of
required steps — demands a kill:

| | base game (396) | all three games (488) |
|---|---|---|
| no kill verb in the required steps | 237 | 289 |
| kill offered, alternative stated | 27 | 32 |
| kill required | 122 | 155 |
| unclear | 10 | 12 |
| **completable without a required kill (upper bound)** | **264 = 66.7%** | **321 = 65.8%** |
| same, also excluding quests routed through a hostile-by-construction location (lower bound) | 223 = 56.3% | 272 = 55.7% |

**Verdict: contradicted.** The real figure is **about two thirds**, not ≈44%. The corpus
under-estimated Morrowind's pacifism by roughly twenty points, and the stated "honest range" of 35–45%
does not contain the answer.

**Confidence discipline.** This is `derived`, `medium-low`, not measured. The classifier is a lexical
rule over UESP's editorial prose. It was hand-audited twice — 30 quests, then 22 — and corrected between
rounds; round 1 found five quests wrongly marked `kill_required` because UESP writes optional violence as
a disjunction inside the step list (*"Convince him… or kill him"*, *"Either: kill the slave-hunters /
convince them to leave"*, *"Evil Path is to keep the items or kill him"*). Round 2 found one more of
those plus one false negative ("Take him down" as a euphemism for a kill). Residual error is estimated
at 5–10% and now runs in **both** directions. The full audit record is in
`corpus/30-quests/data/morrowind-quest-census.json → kill_requirement.hand_audit`.

**Amendment text for RI-QST05 §A:**
> Approximately **two thirds** of Morrowind's quests can be completed without a required kill
> (base game: 264 of 396 quest pages = 66.7% upper bound; 56.3% if quests routed through hostile
> dungeons are also excluded). `derived` from a classification of UESP's Quick Walkthroughs;
> `confidence: medium-low`, residual classifier error 5–10%. See
> `corpus/30-quests/data/morrowind-quest-census.json`. Cite the range **56–67%**, not a point value.

**The finding the item did not anticipate, and the more useful one.** Morrowind does not buy its
pacifism by giving every quest an alternative. It buys it by making **whole questlines** non-violent:

| line | quests | completable without a required kill |
|---|---|---|
| Mages Guild | 33 | 88% |
| Thieves Guild | 23 | 87% |
| Tribunal Temple | 23 | 87% |
| House Hlaalu | 31 | 77% |
| House Telvanni | 29 | 76% |
| Imperial Legion | 19 | 68% |
| Main Quest (base) | 23 | 65% |
| House Redoran | 36 | 64% |
| Imperial Cult | 25 | 64% |
| **Fighters Guild** | 31 | **32%** |
| Vampire clans | 14 | 29% |
| Daedric | 7 | 29% |
| **Morag Tong** | 25 | **24%** |

A pacifist run in Morrowind is not "44% of content" spread thinly — it is *most of six factions and
almost none of three*. That is a structural lesson RI-QST05 §B/§C should absorb: allocate the
non-combat routes by **faction identity**, not as a uniform quota across the quest list.

### B2 — RI-QST03 · faction advancement ceilings

**Claimed:** "the ~33–34 attribute and 70–80 skill ceilings"; rank counts "8–10", exact per-rank
thresholds "**not** reproduced here".
**Stated provenance:** `community-data` (search snippets) for the ceilings; `canonical-recall`,
confidence medium, for rank counts. The item asks for the real tables *"transcribed into an appendix."*

**What the source says.** Every faction page carries a full rank table. **Twenty transcribed**, now in
`morrowind-quest-census.json → faction_rank_tables`. Morrowind runs **two** ladders, not twenty.

**Ladder 1 — the joinable guilds and Great Houses** (Fighters Guild, Mages Guild, Thieves Guild,
Tribunal Temple, Morag Tong, Imperial Legion, Houses Hlaalu / Redoran / Telvanni, and — with a gentler
secondary column — the Imperial Cult). Identical everywhere, reskinned only in *which* two attributes
and six skills it reads:

| index | rank name (varies by faction) | required attributes | required skills |
|---|---|---|---|
| 0 | Associate / Hireling / Novice / … | A 30, B 30 | — |
| 1 | | 30, 30 | one at 10 |
| 2 | | 30, 30 | one at 20 |
| 3 | | 30, 30 | one at 30 and two at 5 |
| 4 | | 30, 30 | one at 40 and two at 10 |
| 5 | | 31, 31 | one at 50 and two at 15 |
| 6 | | 32, 32 | one at 60 and two at 20 |
| 7 | | 33, 33 | one at 70 and two at 25 |
| 8 | | 34, 34 | one at 80 and two at 30 |
| 9 | Master / Archmagister / Grandmaster / … | **35, 35** | **one at 90 and two at 35** |

**Ladder 2 — the unjoinable and special factions** (Ashlanders, Camonna Tong, the Berne / Aundae /
Quarra vampire clans, Blades, Census and Excise, Imperial Knights). Much steeper: attributes run
**40 → 80**, and the top rank demands **one skill at 110** and two at 35.

Documented deviations, all narrow: House Hlaalu adds *"must have started stronghold"* at rank 7; the
Imperial Cult's secondary-skill column is gentler (5, 8, 10, 12, 15, 18, 20, 25, 25); the East Empire
Company has **nine** ranks (0–8) rather than ten; the Dark Brotherhood lists no skill requirement at all.
Every other faction has **10 ranks, indices 0–9**.

**Verdict: contradicted** on the ceilings — the real top of the joinable ladder is **35 attribute /
90 skill**, not "33–34 attribute and 70–80 skill" — and **settled** on rank counts: the honest range
"8–10" resolves to exactly **10** (EEC 9).

**Amendment text for RI-QST03:**
> Morrowind's advancement gate is **two curves, not one per faction.** Joinable guilds and Great Houses
> share one: attribute requirement 30 for ranks 0–4 then +1 per rank to **35** at rank 9; skill
> requirement one favoured skill at 10× the rank index, plus two more at 5×(index−2) from rank 3. The
> unjoinable/special factions share a steeper one (attributes 40→80, top rank one skill at 110). Ten
> ranks everywhere except the East Empire Company (nine). Full transcription:
> `corpus/30-quests/data/morrowind-quest-census.json → faction_rank_tables`. `community-data`.

Note what this does to RI-QST03 §B: our constructed 8-rank ladder with per-faction variation is a
**deliberate deviation from a system that is deliberately uniform**, not a simplification of a varied
one. Morrowind reskins one curve so that joining a second faction feels like the same climb in a
different costume — that uniformity is doing work, and abandoning it should be argued, not assumed.

### B3 — RI-QST07 · "roughly a third of Morrowind's quests are side content"

**Claimed:** ~139 side quests from 427 total, after subtracting ~28 main and ~260 faction; "roughly a
third" named as the load-bearing claim.
**Stated provenance:** total is `community-data`; the subtraction is `derived` from `canonical-recall`
per-faction estimates at ±5.

**What the source says.** Base-game quest pages: 396. Main Quest 23. Faction lines (Redoran 36, Mages 33,
Fighters 31, Hlaalu 31, Telvanni 29, Imperial Cult 25, Morag Tong 25, Thieves 23, Temple 23, Legion 19)
= 275. Remainder — settlement miscellanea, Daedric, Vampire, Bal Molagmer, regional one-offs — **98**.

**Verdict: contradicted.** Side content is **98 / 396 ≈ 25%**, about a **quarter**, not a third. The
per-faction estimates were low (real range 19–36 per line, not 20–30), which inflated the residual in
the wrong direction — RI-QST07 assumed ~260 faction quests and there are 275, while its main-quest
figure of ~28 is close to the real 23.

Caveat that cuts the other way: our denominator is UESP **pages**, and the community total of 427
scripted quests exceeds our 396 pages by ~7%. The *ratio* is robust; the absolute counts are page
counts.

**Amendment:** replace "roughly a third" with "**roughly a quarter** (98 of 396 base-game quest pages)"
and mark it `derived` from `community-data` page counts.

### B4–B7 — RI-LOR04 / `jel-lexicon.json` · four glosses contradicted by the in-world primer

| root | our gloss | our provenance | what `Lore:The Sharper Tongue: A Jel Primer` says |
|---|---|---|---|
| **xul** | "root, that which goes down" | `inferred` | **"Death, or pertaining to death. Also known as rebirth, for they are thought to be one and the same."** |
| **uxith** | "old, long-standing, kept" | **`community-data`** | **"Nest, home, bed. For my people, these concepts are one in the same."** |
| **ojel** | "tongue, the organ" | `inferred` | **"Not of a tribe, outsider. Literally, 'Not of Argonian Tongue.'"** |
| **kaal** | "to kneel, to put the hand down into" | `constructed` | **"War captain. The more violent the tribe, the more this title is revered."** |

**`uxith` is the serious one.** It is marked `community-data`, which the corpus defines as *verified
against a community-wiki summary*. It is not in any source; it is recall wearing a source's label. That
is exactly the failure RI-LOR01 exists to prevent, and it should be found and fixed wherever else the
same mislabelling happened.

**`xul` is the load-bearing one.** Ten coined terms are built on it — `xul-teekh` (souls), `ixtu-xul`
(sapwell), `xul-vaska`, `xul-hesh`, `xul-aneekh` (the Deep-Kin). With the real gloss:
- `xul-teekh` "death-tithe" for the souls currency — **improved**, and now canon-grounded.
- `xul-hesh` "death-theft" for soul-trapping — **improved**.
- `xul-aneekh` "the Deep-Kin" — **broken**. It reads as *Death-Kin*. Rename, or re-gloss the faction.
- `ixtu-xul` "the opened root" for a sapwell — **broken**. It reads as *the opened death*. Which is
  arguably better, but it is not what the corpus says it means.

**`kaal` is a collision:** a `constructed` root landed on an attested one with an unrelated meaning, and
canon uses it as a title prefix (**Raj-Kaal**, attested twice in the extract). Rename ours.

**Confirmed unchanged:** `beeko` (friend), `deelith` (teacher), `vastei` (change), `lukiul` (assimilated
Argonian), `haj` (hides/hidden — which also confirms the corpus's decomposition of *haj mota*), and
`xeech` (seed). `xeech` is a gift: canon glosses it *"Nut, seed. Also the beginning, birth, something with
unreleased potential"* — the metaphor the corpus was going to have to invent is already in the word.

**Still unsourced:** `kaoc` (curse) is marked `community-data` and does **not** appear in the primer. It
is also the only Jel item in our lexicon containing `c`. Re-source it or downgrade it.

**Twenty-three further attested words are missing from our lexicon entirely** — *bok, greel, kaal,
krona, naheesh, nalpa, norg, reel-ka, saxhleel, thuxis, toteik, tsona, uxith, vakka, xal, xanmeer,
xthari, xinchei-konu…* — all listed with glosses in `argonian-names.json → jel_glossary`.

### B8 — RI-LOR04 · the Tamrielic name grammar

**Claimed:** *"`[Verb-3sg] - [optional Determiner|Possessive] - [Noun (+Noun)]`, **2–4 words, modal 3**"*,
presented as the Argonian naming system; apostrophes forbidden.
**Stated provenance:** `constructed`, confidence high, resting on CF-023/CF-024.

**What the source says.** 377 attested Argonian personal names across both regions:

| shape | count |
|---|---|
| single Jel word (*Huleeya, Okur, Shatalg, Chuna*) | 182 |
| **Jel compound `Xxx-Yyy`** (*Am-Lai, Heem-La, Miun-Gei, Okan-Shei, Beela-Kaar*) | **142** |
| Tamrielic descriptive (*Hides-His-Foot, Nine-Toes, Twice-Bitten*) | 43 |
| mixed | 10 |

Word counts among the descriptive names: **2 → 31, 3 → 6, 4 → 5, 5 → 1**.

**Verdict: contradicted, twice.**
1. The hyphenated English phrase is **not** the Argonian naming system; it is the *minority* form. The
   dominant attested shape is the two-part Jel compound. Restricting Argonian names to the descriptive
   template makes our world sound less Argonian, not more.
2. The word count is wrong at both ends: the mode is **2**, not 3, and five-word names exist
   (*Morning-Star-Steals-Away-Clouds*, Morrowind, 3E 427).

Two more corrections:
- Not all descriptive names are verb-initial. Canon has *Nine-Toes, Twice-Bitten, Tongue-Toad,
  Fine-Mouth, Grey-Throat, Big Head, Egg-Face* — noun- and adjective-initial epithets. The "[Verb-3sg]"
  slot is not obligatory.
- **Skink-in-Tree's-Shade** (Morrowind, 3E 427) contains an **apostrophe** and a **lowercase** medial
  word. RI-LOR04's letter forbids both. The apostrophe rule is written for *Jel*, so this is arguably
  compliant — but the validator's culture classifier should be checked against this exact name, because
  it is the one every reader will recognise.
- A whole register is missing: **attested Argonian title-prefixes** — *Tree-Minder* (9), *Nisswo* (7),
  *Sun-Eater* (7), *Dead-Water* (3), *Grave-Singer* (2), *Raj-Kaal* (2), *Egg-Tender, Sap-Speaker,
  Bond-Guru, Chime-Maker, Ux-Deelith*. These do the work RI-LOR04 wants "affectionate, faintly
  insulting, domestic" names to do, and they are canon.

**Amendment for RI-LOR04 §4:** state the Jel compound as the **primary** Argonian name form, the
descriptive hyphenated name as the **Tamrielic-facing** form (which is what CF-023 actually says — a
Tamrielic name *in addition to* a Jel one), set the descriptive mode to 2 words with a 2–5 range, drop
the obligatory verb slot, and add the title-prefix register. Data: `argonian-names.json →
naming_grammar_as_attested`.

### B9 — CF-045 · Knahaten Flu duration

**Claimed:** "began at Stormhold in 2E 560 and persisted 41 years, to 2E 601." `community-data`, high.
**Source:** `Lore:Knahaten Flu` — *"lasting for 43 years, from the year 2E 560 to 2E 603."*
**Verdict: contradicted.** Start date right; **duration 43 years, end 2E 603**.

### B10 — RI-WLD03 · service density in a Morrowind town

**Claimed (constructed targets):** a capital carries **7 shops** and **5 skill trainers**; a town, 3 and 2.
**What the source says.** Counting service providers off `{{NPC Summary}}` flags:

| settlement | named NPC pages | barter NPCs | training NPCs |
|---|---|---|---|
| Vivec (city) | 187 | 67 | 46 |
| Ald'ruhn | 111 | 25 | 19 |
| Mournhold | 87 | 15 | 1 |
| **Balmora** | **85** | **36** | **39** |
| Ebonheart | 56 | 19 | 11 |
| Sadrith Mora | 53 | 19 | 11 |
| Gnisis | 31 | 11 | 4 |
| Caldera | 29 | 7 | 8 |

**Verdict: contradicted, and deliberately so.** Balmora — RI-WLD03's own calibration reference — has
**36 barter NPCs and 39 trainers**, against targets of 7 and 5. Morrowind's service NPCs are *ubiquitous*:
guild members, temple priests and cornerclub publicans all trade and train. Our capital target is an
order of magnitude below the town it was calibrated against.

This may still be the right target — 45 hand-authored NPCs cannot carry 36 shops — but RI-WLD03 currently
presents 7/5 as *derived from* Balmora, and it is not. **Amendment:** restate the shop and trainer
targets as an explicit, argued reduction from Morrowind's density (roughly 1 service NPC in 2.3 at
Balmora), rather than as a calibration.

---

## C. Confirmations (the corpus was right)

| item | claim | source | verdict |
|---|---|---|---|
| RI-WLD03 | "Balmora ~94 NPCs" | 85 NPC pages resolve to Balmora; UESP does not page every NPC | **confirmed** (within ~10%, in the expected direction) |
| RI-QST01 | "the Thieves Guild's ~23 catalogued quests" | 23 Thieves Guild quest pages | **confirmed exactly** |
| RI-QST01 | "20–30 quests per faction line" | real range **19–36** across ten lines | **confirmed-with-correction** — widen the band |
| RI-QST01 / QST03 | Fighters Guild favoured skills Axe, Long Blade, Blunt, Heavy Armor, Armorer, Block; attributes Strength, Endurance | `{{Faction Summary}}` on `Morrowind:Fighters Guild` | **confirmed verbatim** |
| RI-QST01 | Fighters Guild ↔ Thieves Guild conflict, Percius Mercius as in-guild dissenter offering alternate resolutions | `Morrowind:Fighters Guild`, `Morrowind:The Code Book` — *"he'll tell you the mission seems okay but that you should try to avoid killing Sottilde… suggests you talk her into handing it over"* | **confirmed** |
| RI-QST03 | Fighters Guild readmission: "supposed to only let you make amends once", circumventable | `Morrowind:Fighters Guild`, verbatim including the variable-not-set bug | **confirmed** |
| RI-PRG03 | "Morrowind's 27-skill sheet" (`canonical-recall`, medium) | `Morrowind:Skills` — *"There are 27 skills in Morrowind"*, five major / five minor / seventeen misc, ten major-or-minor increases per level | **confirmed — upgrade to `community-data`** |
| RI-PRG05 | "finite merchant gold pools that regenerate over time" (`canonical-recall`, medium) | 345 merchants carry an explicit `gold` pool: min 0, **median 350**, mean 790, max 10,000; modal values 300 (43×), 150 (33×), 400 (27×) | **confirmed, and now quantified** |
| CF-028 / CF-029 | Shadowscales taken at birth under the sign of the Shadow, given to the Dark Brotherhood, survivors become full members, may leave to serve Black Marsh with impunity | `Lore:Shadowscales`, near-verbatim | **confirmed** |
| CF-026 | Naga are a distinct serpentine Argonian people; Imperial sources call them bandits | `Lore:Naga`, `Lore:Naga-Kur` | **confirmed** |
| CF-041 / CF-040 | xanmeers as pre-Duskfall stone ziggurats | `Lore:Xanmeer` + 99 pages mentioning *xanmeer* | **confirmed** |
| CF-067 | the An-Xileel do not exist in 3E 427 | `Lore:An-Xileel` — *"formed sometime during the Oblivion Crisis"* | **confirmed** (softer wording; conclusion holds) |
| CF-088 | the eight city names are canon | all eight attested; coverage wildly uneven (Lilmoth and Stormhold rich, Helstrom and Thorn near-empty) | **confirmed** |

### Confirmations that came with a gift

- **CF-006 (Hist sap as non-Argonian hallucinogen) — confirmed, and it hands the project three things
  it invented.** `Lore:Hist Sap` documents **sap-poisoning in Argonians** with named progressive
  symptoms: *"gold tongue" (permanent change of mouth pigmentation to a golden hue), "bark scale"
  (thickening and darkening of surface scales), and unwanted hallucinations*, suffered by the Miredancer
  Sap-Speakers who ingest large quantities. **The corpus's constructed five-band sap-taint (CF-C011) has
  a canonical ancestor and should cite it instead of standing alone.** The same page says a *badly
  treated* Hist produces the bloodlust effect in Argonians too — so the effect is a fact about the
  **tree's condition**, not the drinker's race, which is a better story than the one in the registry.
  And it names **Amber Plasm**: Chaotic Creatia leaking through a Hist *"like blood from a wound"* —
  sitting directly on top of the corpus's constructed sapwell-as-open-wound (CF-C009).
- **CF-046 — confirmed with hedges that matter.** The Kothringi were *"thought to be"* exterminated and
  a shipload sailed west on the **Crimson Ship**; the Lilmothiit are *"mostly"* extinct; Argonians
  *"appear"* immune. `Lore:On the Knahaten Flu` records the live accusation that Argonians introduced
  the flu deliberately in retaliation for Dunmer slaving — *"never been proven or disproven"*. That is a
  usable political fact in a 3E 427 Black Marsh and it is not in the registry.
- **CF-050 — corrected.** The prison is **The Rose**, raised **in a single day** by **Pelladil Direnni**
  summoning an army of stone atronachs, commissioned by Akaviri Potentate **Versidue-Shaie** (the
  registry misspells him *Versidae-Shae*). The Lilmothiit founded **both** Lilmoth and Blackrose.
- **CF-047 — corrected.** Silver-skinned, indigenous, sailors: confirmed, plus the epithet **"the
  Lustrous Folk"**. *"Nedic descent"* is **not** stated by the source and should be dropped or
  re-sourced.
- **CF-025 — corrected.** `beeko, deelith, lukiul, thtithil, vastei` confirmed; `kaoc` unsourced;
  and the primer supplies 20 more words the registry does not have.
- **CF-028/029 — three additions.** Shadowscales follow a **distinct** set of Five Tenets (a Shadowscale
  may not kill a fellow Shadowscale even outside the Brotherhood); tenet-breaking is treason, executed
  by the **Argonian Royal Court** through an unaffiliated assassin; and the source is explicitly
  **sceptical** that a King of Black Marsh ever existed — *"no such king is thought to have ruled since
  the height of Argonian civilization in ages past — if at all"*, with the Shadowscale-commander role
  *"said to be overstated"*. Any project that wants a Black Marsh throne should read that sentence first.

---

## D. Debts that remain open, and why

1. **RI-QST08 — the unique-reward fraction.** The item asks for "Morrowind's actual unique-reward
   fraction" against its constructed 40% floor. We can say that **263 of 448 quests with a reward field
   (58.7%) name at least one item**. We *cannot* say what fraction of those items are unique: UESP's
   `Reward` field links common potions and leveled gear alongside artifacts, and telling them apart
   needs the item pages' rarity data, which this pass did not mine. **58.7% is a ceiling on the answer,
   not the answer.** Next step: join the reward item links against `Morrowind:Quest Items` and the item
   pages' `Value`/`Unique` fields.
2. **RI-WLD03 — named interiors per settlement.** Our floor is 15 for Balmora, median 5 across 40
   settlements, against a capital target of 26. But UESP does not give every Morrowind house a page, so
   this is a **floor, not a total**, and RI-WLD03's target cannot be falsified from it. Settling this
   needs the Construction Set cell list, not the wiki.
3. **RI-WLD08 / RI-WLD03 — "2,824 NPCs on Vvardenfell".** The extract holds **1,429** `NPC Summary`
   pages across all three games. UESP pages named NPCs; 2,824 is presumably a Construction Set record
   count including generics. The two numbers are not comparable and the claim is **unsettled** from this
   source. It should keep its current `community-data`/medium label, not be upgraded.
4. **CF-044 (the Ruddy Man).** Marked `canonical-recall`, confidence **low**, and flagged in RI-LOR01 as
   "must not carry plot weight until verified". **There is no page for it in the Black Marsh half of the
   extract.** It stays unverified.
5. **RI-QST05 §D and RI-QST07 §A type-mix.** The per-type breakdown of side quests (fetch / escort /
   investigate / weird) is not derivable from `{{Quest Header}}`; UESP does not tag quest type. It would
   need the same classifier treatment as the kill analysis, with the same error bar, and this pass did
   not do it.

---

## E. The era problem — one thing needing a ruling, not a fix

**Flag for ruling.** The single richest body of Argonian culture in the extract — the Murkmire tribes
(**Bright-Throats, Black-Tongues, Miredancers, Root-House People, Ghost People, Dead-Water/Naga-Kur**),
their settlements, their Tree-Minders, Nisswos and Sap-Speakers, 64 Murkmire place pages and ~330 named
ESO Argonians — is **ESO, 2E 582: roughly 855 years before our 3E 427 window**.

It is simultaneously the best Argonian material that exists and the least safe. The corpus has **no
ruling** on it. Absorbing it silently would put Second-Era tribal politics in a Third-Era game; refusing
it throws away most of what is known about Argonian daily life.

Every record in `blackmarsh-canon.json` carries an `era` field so the choice can be made per fact rather
than wholesale. The only sources actually *near* our window are the two Arena pages (3E 399), and they
are nearly empty. **This needs an ARBITRATION entry.** It is not this document's call.

---

## F. What changed about how we should label things

Three process findings, worth more than any single number:

1. **`community-data` was applied to at least one claim with no source** (`uxith`). The label means
   *verified against a source*; if it is applied to recall, the registry stops being a provenance
   system and becomes decoration. Every `community-data` entry written during the 403 window should be
   re-checked against this extract before wave 2.
2. **The recalled figures erred in a consistent direction.** Pacifism 44% → ~66%; side content a third →
   a quarter; faction ceilings 33/70–80 → 35/90; per-faction quest counts 20–30 → 19–36. Recall
   *compressed toward the middle* — it under-estimated the extremes in both directions. Where a
   recalled figure is still unverified, expect the real one to be further from the average than
   remembered.
3. **A constructed validator can drift into rejecting canon without anyone noticing**, because it is
   only ever run against our own content. Any rule-based canon-fidelity tool should carry a fixture of
   **attested** examples it must accept, and that fixture should be part of its test suite. For
   `jel-phonotactics.py` that fixture now exists: `argonian-names.json → jel_glossary`.
