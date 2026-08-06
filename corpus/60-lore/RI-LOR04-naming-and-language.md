---
id: RI-LOR04
title: Naming and language — Jel phonology, the lexicon, and the naming conventions of every culture in the marsh
kind: structure
side: morrowind
judges: [lore.language, lore.names, world.placenames, world.settlements, npc.names, items.names, creatures.names, dialogue.voice, books.content]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

A player will read roughly five hundred proper nouns before they finish this game — villages, ruins,
beasts, weapons, potions, people. If those five hundred nouns come from one consistent sound-world, the
player learns the language without being taught it: they will look at a word they have never seen and
know it is a place in the deep marsh, and they will look at another and know a Khajiit named it. That is
what Morrowind achieved with *Balmora, Ald'ruhn, Sadrith Mora, Vvardenfell, Ghostgate, kwama, netch,
guar, comberry, Dagoth Ur* — you can tell a Dunmer word from a Nord word from a Khajiit word by ear,
without ever being told a rule.

The bar is therefore mechanical, not aesthetic: **an unseen proper noun from our game must be
classifiable to its culture by a validator that has never seen it.** The failure state is
apostrophe-salad — *Xa'thril, Ssythra'nu, Qyx'lor* — which is what happens when each name is invented
independently by whoever needed one that afternoon.

## The reference artifact

Machine-readable spec: **`corpus/60-lore/data/jel-lexicon.json`**
Validator: **`corpus/80-methods/jel-phonotactics.py`** (verified working, §6)

### 1. Jel phonology — generator-grade

**Romanised consonant units** (digraphs are single units): `b ch d g h j k kh l m n p r s sh t th ts tl v w x z`

| Unit | Value | Note |
|---|---|---|
| `x` | /x/, voiceless velar fricative — **never** /ks/ | The signature sound. If a word has an `x`, it is Jel. |
| `j` | /dʒ/ | as in *Jel* |
| `th` | /θ/ | |
| `kh` | aspirated /kʰ/ | initial or medial only |
| `ts` | affricate | valid onset **and** coda |
| `tl` | lateral affricate | onset only |

**Vowels:** short `a e i o u`; long `aa ee oo`; diphthongs `ai ei ua ia`.
The long `ee` is doing enormous work in the attested corpus — *beeko, deelith, An-Xileel* — and should
appear in roughly one word in four.

**Syllable template:** `(C)(C)V(V)(C)(C)`, max **4 syllables per element**.

**Permitted onset clusters** (2+ units): `xl xn xt tsl sk sl sn st sw kw shl shn thl`
**Permitted codas:** single `x k kh th sh s l r n m j t ts z`; clusters `xt kt st lk lm lth nth`
Every medial consonant run must split into a legal coda + a legal onset. The validator enforces this
with a maximal-onset preference.

**Absolutely forbidden:**

| Forbidden | Why |
|---|---|
| **`'` apostrophes** | **The single most important rule in this file.** Apostrophes belong to Khajiit (*J'zhirr*, *Ra'dashi*) and rarely to Redguard. An apostrophe inside an Argonian name is an automatic validator failure. Apostrophes are meaningful *because* only one culture has them. |
| letters `q`, `y`, `f` | Jel has no /q/, no /f/, and never spells a glide with `y`. |
| clusters `br cr dr fr gr pr tr bl cl fl gl pl spr str scr thr shr chr phr wr kn gn ps pn` | These are the sound of English fantasy. Their absence is most of why Jel sounds foreign. |
| geminates (`nn ll tt ss kk mm rr dd`) | `thth` is permitted **medially only**, as in *Thitithil*. |

**Stress:** penultimate syllable of each element; in a hyphenated compound, primary stress falls on the
**final** element. *ixt-sha-NEEKH*, *WU-xal-MUUL-kha*.

**Attested exceptions** (exempt because canon predates our rules; nothing new may be coined on their
pattern): `kaoc, naga, hist, jel, lukiul`. Note `kaoc` is the only Jel item containing `c`.

### 2. Morphology

**Prefixes:** `an-` (we/our/the collective of) · `ku-` (needed, owed, proper) · `ix-` (opened, cut) ·
`xan-` (stone) · `wux-` (standing water) · `tsa-` (small, young) · `nu-` (not, refused) ·
`raj-` (great, elder) · `deek-` (near, of this water)

**Suffixes:** `-meer` (built place, nest) · `-eel` (collective of persons) · `-eeko` (one bound to) ·
`-lith` (one who does/passes on) · `-tei` (change, becoming) · `-xh` (exact, finished, sacred) ·
`-kha` (place of) · `-ei` (one, a single) · `-uj` (diminutive)

**Reduplication** marks repetition/plurality **of the object, not the actor**: `thith` (egg) →
`thitithil` (a clutch, egg-after-egg). Inferred directly from the canon ruin name
*Ixtaxh-Thitithil-Meht*, "Exact Egg-Cracker" (CF-043).

**Compounding:** modifier-first (`A-B` = "B of/for/made-of A"), maximum **3** elements. Hyphenate when
any element is 2+ syllables (*Ixtaxh-Thitithil-Meht*); fuse when both are monosyllabic (*xanmeer*, *wuxal*).

### 3. The lexicon

**59 roots** in `data/jel-lexicon.json`, each tagged `community-data` (gloss reported by a wiki summary),
`inferred` (our decomposition of a canon proper noun), or `constructed` (ours). Representative sample:

| Root | Gloss | Provenance |
|---|---|---|
| `jel` | the root-tongue; speech that is owed | community-data |
| `xul` | root; that which goes down | inferred |
| `xan` / `meer` | stone / nest, built thing | inferred (*xanmeer*) |
| `thith` | egg | inferred (*Thitithil*) |
| `haj` / `mota` | hidden / shell | community-data (*haj mota* = "hidden shell", the canon turtle-beast — **the system reproduces a canon creature name, which is the strongest evidence the decomposition is right**) |
| `beeko` / `deelith` / `vastei` / `lukiul` / `kaoc` | friend / teacher / change / salted-one / curse | community-data |
| `vei` | **blood; also sap — Jel does not distinguish them** | constructed |
| `teekh` | tithe, debt owed downward; the residue of a death | constructed, load-bearing |
| `ixtu` | an opened thing; a wound kept from closing | constructed, load-bearing |
| `eixa` | pattern; the shape a thing is held in | constructed, load-bearing |
| `tsleek` | quiet; gone silent; no longer answering | constructed |
| `muul` `kesh` `vosh` `nux` `omu` `shal` `tuk` | silt / salt / good-rot / dark water / dream / scale / bone | constructed |

`vei` is the most important constructed root in the file. **The language encodes CF-002**: an Argonian
cannot say "blood" without saying "sap." Every translated Argonian line in the game should occasionally
force an English translator into an awkward bracket because of it — that is Exemplar 2's whole texture.

**Ten coined game-terms** (`coined_terms` in the JSON) fix the mechanical vocabulary so no two builders
name the bonfire differently: `xul-teekh` (souls) · `ixtu-xul` (sapwell) · `xul-vaska` (tithe-gourd) ·
`teekh-shuja` (the bloom) · `vastei-eixa` (levelling) · `teekh-kaoc` (sap-taint) · `xul-hesh`
(soul-trapping) · `an-tsleek` (the gone-silent) · `xul-aneekh` (the Deep-Kin) · `ixtu-vakh` (the Sap-Cutters).

### 4. Argonian Tamrielic names — the hyphenated system

> **AMENDED wave 0 (corpus-audit). The rule below had the minority form as the rule.** Measured
> over every attested Argonian name in `argonian-names.json → naming_grammar_as_attested`:
>
> | Shape | Count | Share |
> |---|---:|---:|
> | Jel single word (*Huleeya, Okur, Chuna, Shatalg*) | 182 | 48% |
> | Jel compound (*An-Deesei, Heem-La, Vistha-Kai, Keel-Raniur*) | 142 | 38% |
> | **Tamrielic descriptive** (*Hides-His-Foot, Nine-Toes*) | **43** | **11%** |
> | Mixed | 10 | 3% |
>
> **The Jel name is the primary form — 86% of attested Argonian names are Jel.** The hyphenated
> descriptive name is the *Tamrielic-facing* form, which is what CF-023 actually says: a
> Tamrielic name **in addition to** a Jel one. Legislating the descriptive template as *the*
> Argonian naming system makes our world sound **less** Argonian, not more. Three further
> corrections follow, all from the same measurement. See CORPUS-COHERENCE-01 §5.

**Primary form: the Jel name** (single word or two-element compound), validated by §1–§3.
A settlement roster in which most Argonians carry hyphenated English names has failed this
section however well each individual name scores.

**Secondary form, Tamrielic-facing:** `[Verb-3sg | Noun | Adjective] - [optional
Determiner|Possessive] - [Noun (+Noun)]`, **2–5 words, modal 2** (~~2–4, modal 3~~).

- **The word count was wrong at both ends.** Attested hyphenated names: 2 words ×31, 3 ×6,
  4 ×5, 5 ×1. The mode is **2** (*Nine-Toes, Twice-Bitten, Fine-Mouth, Grey-Throat,
  Tongue-Toad, Egg-Face*), and five-word names exist —
  *Morning-Star-Steals-Away-Clouds* (Morrowind, 3E 427).
- **The verb-initial slot is not obligatory.** ~~`[Verb-3sg]` first, always.~~ Canon has
  noun- and adjective-initial epithets: *Nine-Toes, Twice-Bitten, Tongue-Toad, Fine-Mouth,
  Grey-Throat, Big Head, Egg-Face*. The validator no longer errors on a non-verb head; it
  warns only if **neither** the head nor any element is attested material.
- **A whole register was missing: attested title-prefixes.** *Tree-Minder* (9 bearers),
  *Nisswo* (7), *Sun-Eater* (7), *Dead-Water* (3), *Grave-Singer* (2), *Raj-Kaal* (2),
  *Egg-Tender, Sap-Speaker, Bond-Guru, Chime-Maker, Copper-Eye, Ux-Deelith, Bright-Throat,
  Root-House, Moss-Skin*. These do exactly the work this section wants "affectionate, faintly
  insulting, domestic" names to do, and they are canon. A title-prefix is **stripped before
  classification** and does not count toward the word budget.
- ***Skink-in-Tree's-Shade*** (Morrowind, 3E 427) carries an **apostrophe** and a **lowercase
  medial word**, both of which the letter below forbids. The apostrophe rule is written for
  *Jel*, so a Tamrielic-facing name is not bound by it — but it is the one name every reader
  will recognise, and it is now a fixture the classifier is tested against.

- Verbs (44 attested in the JSON): Hides, Lifts, Counts, Tastes, Wades, Keeps, Breaks, Drowns, Weighs,
  Salts, Buries, Refuses, Forgets, Answers, Ties, Sells…
- Determiners: The, His, Her, Their, Many, No, Nine, Three, Too, Own, Late
- Nouns: **concrete and marsh-local only** — Rain, Reeds, Mud, Eggs, Bones, Nets, Ropes, Debts, Ledgers,
  Tides, Flies, Salt, Coin, Silence, Fever, Wet Days, Nails, Paper, Poles, Baskets, Clay

**The rule for how it should sound, stated so a writer can use it:**

> An Argonian's Tamrielic name reads as **something an adult once said about a hatchling**, or as
> **the thing that person is known for doing badly**. It is never a title earned in battle.

*Counts-The-Wet-Days. Wades-Backwards. Keeps-No-Ledger. Buries-Too-Deep. Answers-Late.
Splits-Her-Own-Nets. Forgot-Her-Rope.* These are affectionate, faintly insulting, and domestic. That
register **is** the culture: a people who name each other after small observed failures.

**Blocklist — automatic fail.** Nouns: Doom, Destiny, Fate, Shadow, Death, Blood, Darkness, Vengeance,
Glory, Legend, Souls, Dragon, Void, Chaos, Eternity, Wrath, Storm, Thunder, Flame. Forms: `-Of-`,
`Bringer`, `Bearer`, `Slayer`, `Lord`, `King`, `Master`.
**`Slays-The-Shadow-Lord` is the exact failure this list exists to catch**, and the validator catches it
(§6). One registered exception is permitted: an in-fiction epithet that mocks the epic register, which
an Argonian NPC may use sarcastically about a foreigner.

### 5. The other cultures

| Culture | Structure | Endings / markers | Examples | Forbidden |
|---|---|---|---|---|
| **Imperial** | praenomen + nomen; officers/scholars add a post, not a title (*"formerly Quartermaster of the Ninth Cohort"*) | m `-us -ius -o -anus -inus`; f `-a -ia -illa -ina`; nomina `-ellus -andus -entus -ianus -orus -atus` | Sergius Verrent, Casimir Bellandus, Marcia Ottellus, Prefect Lucia Menandra, Falco Drusius | apostrophes, hyphens |
| **Dunmer** | given + family/House name; honorific *Serjo* (noble) / *Sera* (polite) precedes | `-as -is -en -yn -el -ur -oth -am -yr -an -ir` | Andrel Vorin, Ivrys Dram, Fals Rethan, Serjo Ravel Sedran | apostrophes, **hyphens** (a hyphenated Dunmer name is an Argonian name wearing a hat), English words |
| **Khajiit** | honorific prefix + name; the prefix encodes standing | `J' S' Ra' Ri' Dro' Ma' Ahn`; suffixes `-iit -ir -dar -zhi -ja -eem` | J'zhirr, Ra'dashi, S'kamma, Dro'shanji | hyphens. **Khajiit are the ONLY culture permitted apostrophes.** Third-person self-reference is a *speech* convention, not a naming one. |
| **Kothringi** *(constructed — canon gives the people, CF-047, but no name corpus)* | single given name, two syllables, soft onsets | `-an -eth -ir -a -en` | Serrin, Halveth, Mereth, Ardan, Iselen, Tavir | must not read Breton (`-ien -ard -aud`) or Nord (`-gar -olf -ulf`). Found on graves, ship registers, and one impossible living person (CF-049). |

**Houses present in Black Marsh:** Dres (slavers, dominant), Hlaalu (trade), Telvanni (individual mages
buying soul gems — which in Argonian eyes is `xul-hesh`, root-theft; see RI-LOR05).

### 6. Verified validator output (run 2026-08-05)

The corpus set — the 34 worked example names in `jel-lexicon.json` across all five cultures:

```
names checked : 34
  argonian-tamrielic      8 names,   0 violations
  dunmer                  2 names,   0 violations
  imperial                3 names,   0 violations
  jel                    18 names,   0 violations
  khajiit                 3 names,   0 violations
violation rate: 0.0%  (threshold 5%)
RESULT: PASS      exit=0
```

The adversarial set — ten names written the way an unbriefed builder writes them:

```
  Grimfang-Of-The-Blackwater  [argonian-tamrielic] first element not an attested 3sg verb; blocklisted form 'Of'
  Slays-The-Shadow-Lord       [argonian-tamrielic] first element not an attested 3sg verb;
                                                   epic-register noun 'Shadow'; blocklisted form 'Lord'
  Blooddrinker                [jel] forbidden cluster 'dr'; forbidden cluster 'bl'; geminate 'dd';
                                    illegal initial cluster 'bl'; unsplittable medial cluster 'ddr'
  Zzzarkath / Fenwyck / Thorgrim  [unknown] unclassifiable — belongs to no culture in the lexicon
violation rate: 60.0%  (threshold 5%)
RESULT: FAIL      exit=1
```

Forcing the Argonian culture on apostrophe-salad (`--culture jel`) flags all four of
*Xa'thril, Ssythra'nu, Qyx'lor, Z'hakar* at 100%, each on the apostrophe first.

**Three real defects were found by writing the validator and are recorded here rather than hidden:**
(a) a coined root was spelled `sheck`, which violates my own consonant inventory — corrected to `shekh`;
(b) the classifier annexed the Dunmer name *Andrel* as `an-` + *drel*, and the English name
*Answers-Late* as `an-` + *swers*, so the affix heuristic is now restricted and the attested-verb test
runs first; (c) `xanmeer` — a canon word — failed the coda rules, because `r` was missing from the coda
inventory. **A phonology that rejects the canon word it was derived from is wrong**, and only running it
found that.

### 6b. Re-run after the wave-0 validator amendment (corpus-audit)

§6 above stands as recorded. It was run against **our own** worked examples, which is why it
passed — and that is exactly how the defect below survived. Running the same validator against
**attested Jel** instead:

```
BEFORE (wave 0, as found)
python3 corpus/80-methods/jel-phonotactics.py --names <30 attested Jel> --culture jel
violation rate: 26.7%   (threshold 5%)   RESULT: FAIL
rejected: Saxhleel, Thtithil, Xeech, Greel, Krona, Norg, Vakka, Xthari

AFTER
python3 corpus/80-methods/jel-phonotactics.py --self-test
self-test: 33 attested Jel forms, 0 rejected (must be 0)
SELF-TEST PASSED

python3 corpus/80-methods/jel-phonotactics.py --names <34 worked examples>
names checked : 34    violation rate: 0.0%    RESULT: PASS      (unchanged)

python3 corpus/80-methods/jel-phonotactics.py --names <adversarial 6> 
Grimfang-Of-The-Blackwater  blocklisted form 'Of'
Slays-The-Shadow-Lord       epic-register noun 'Shadow'; blocklisted form 'Lord'
Blooddrinker                forbidden clusters 'bl','dr'; geminate 'dd'
Zzzarkath / Fenwyck / Thorgrim   unclassifiable
RESULT: FAIL      (unchanged — the tool is no weaker)
```

**What changed and why.** §6(c) already states this item's own governing principle: *"A
phonology that rejects the canon word it was derived from is wrong."* The validator was
rejecting **Saxhleel**, the Argonians' own word for themselves. The fix is a **two-mode
split**, not a loosening:

- **`--mode canon` (default, what a critic runs):** an attested Jel form is never a violation.
  The attested-exception list grew from 7 elements to 42 — every attested form in
  `argonian-names.json → jel_glossary`.
- **`--mode coinage`:** the exception list is ignored entirely, so the narrow constructed rules
  apply in full to anything we *invent*. `gr`, `kr` and geminates stay forbidden here even
  though canon contains them — those rules exist to stop coined Jel drifting into generic
  fantasy, and canon's licence to say *Krona* is not our licence to coin *Krothgar*.
- **Inventory gaps proved by canon were filled**: coda `ch` (*Xeech* — a root in our own
  lexicon), onsets `hl` / `tht` / `xth` (*Saxhleel*, *Thtithil*, *Xthari*), coda cluster `rg`
  (*Norg*).
- **`--self-test` is now the regression guard**: it runs the attested fixture through canon
  mode and exits non-zero if any attested word is rejected. Run it after any lexicon edit.

**Three classifier corrections in the same pass**, each of which had been quietly annexing an
Argonian name to another culture:

| Name | Was | Now |
|---|---|---|
| *Skink-in-Tree's-Shade* (Morrowind, 3E 427) | `khajiit`, on the apostrophe | `argonian-tamrielic`; an English possessive is not a Khajiit apostrophe, and lowercase medial function words are permitted |
| *An-Deesei*, *Ixt-Shaneekh* and other Jel compounds | `argonian-tamrielic`, because a Jel compound also matches the hyphenated-English shape | `jel`; the sound-signature test now runs before the shape test |
| *Tree-Minder Deyapa*, *Nisswo Ajul-Jas* | `imperial`, then failed for "hyphen in an Imperial name" | title prefix stripped before classification and checking |

**Four lexicon glosses corrected against attested Jel** — see `jel-lexicon.json.amendments` and
CORPUS-COHERENCE-01 §5.

## Comparison method

1. **Harvest every proper noun in the game.**
   ```
   python3 corpus/80-methods/jel-phonotactics.py --extract game/data/**/*.json --verbose
   ```
   The harvester pulls `name / displayName / title / npc / speaker / author / place / region` keys.
2. **Run the validator.** Default threshold **5%**. Exit 1 = the critic fails the piece.
   ```
   python3 corpus/80-methods/jel-phonotactics.py --extract game/data/**/*.json --threshold 0.05 --json
   ```
3. **Culture-forced pass on Argonian NPCs only.** Extract names of NPCs whose `race` is Argonian and run
   with `--culture jel` or, for hyphenated names, confirm every one classifies as `argonian-tamrielic`
   with zero violations. **Any apostrophe in an Argonian name → FAIL, no threshold.**
4. **Unclassifiable count.** `by_culture.unknown.n / total > 0.02` → **FAIL.** A name belonging to no
   culture is a name someone typed.
5. **Coverage of the sound-world.** Of Jel-classified names, at least 40% must contain `x`, and at least
   20% must contain a long vowel (`ee aa oo`). Below either → **FAIL for flavourless Jel**: legal but
   characterless words are the subtler failure and the rules alone will not catch them.
6. **Blind culture-attribution test.** Show a critic 20 proper nouns from our game with no context and
   ask them to assign each to a culture. **Fail below 80% accuracy.** This is the test that actually
   matters; §§1–5 are proxies for it.
7. **Registry consistency for game terms.** `grep -ri "bonfire\|estus\|soul.*currency" game/` — any UI or
   dialogue string using an out-of-world term instead of the `coined_terms` vocabulary → FAIL.
8. **Regression.** Re-run §§1–2 on the 34-name corpus set after any lexicon edit. It must stay at 0.0%.

## Scoring

| Score | Condition |
|---|---|
| **5** | Violation rate ≤1%; unknown ≤0.5%; blind culture-attribution ≥90%; `x`-density ≥40%; zero apostrophes outside Khajiit |
| **4** | ≤3%; unknown ≤1%; blind attribution ≥80% |
| **3** | ≤5%; unknown ≤2%; blind attribution ≥70% |
| **2** | 5–15% violations, or blind attribution 50–70% — the languages exist but bleed into each other |
| **1** | >15% violations; names clearly invented per-asset |
| **0 — FAIL** | Any apostrophe in an Argonian name; or >2% unclassifiable; or a place name from the map (CF-088) respelled |

**Failure threshold: below 3 blocks the wave.** Names are cheap to fix early and ruinous to fix late —
they end up in save files, dialogue audio, and quest scripts.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 2 / 5 | 3 / 5 | 5 / 5 |

**Aggregation (a property of this item, not of the critic):** band on the 0-5 native scale.

## How we lose

1. **Random apostrophes.** *Xa'thril. Ssythra'nu. Kel'zhar.* The default failure, because apostrophes
   read as "exotic" to an English eye and cost nothing to type. Under our rules an apostrophe means
   *Khajiit*, full stop, and the validator hard-fails otherwise.
2. **Epic-register Argonian names.** *Walks-With-Destiny. Bringer-Of-Storms. Slays-The-Shadow-Lord.*
   This is the naming system misread as a title system. The real register is domestic and mildly
   insulting: *Buries-Too-Deep*.
3. **Names invented per-asset.** A creature named on Tuesday by the bestiary builder, a village named on
   Thursday by the world builder, neither having opened this file. Check 6 (blind attribution) is the
   only test that reliably catches it, because each name in isolation looks fine.
4. **Legal but flavourless Jel.** Words that pass every rule and sound like nothing — *Talen, Sorik,
   Belan*. Rules produce validity, not character. Check 5 (`x`-density, long vowels) is the guard.
5. **Every culture sounding the same.** Imperial officers with Dunmer-shaped names; Khajiit traders with
   English nicknames. The player learns culture by ear or not at all.
6. **English words in Jel.** *Xul-Watcher*, *Deep-Hist-Grove*. Compounds must be Jel roots. The Tamrielic
   name of a place is a *separate string* — "Wuxal-Muulkha, which the Imperials call Silt Bottom" — and
   both should exist, because that doubling is exactly how a colonised province sounds.
7. **Renaming the map.** CF-088's names are binding. A builder who "improves" Helstrom or Clay Moor has
   broken the one hard geographic constraint we were given.
8. **A lexicon nobody uses.** 59 roots in a JSON file and 500 names typed from imagination. The validator
   must run in the build, not in a critic's discretion.

## Provenance note

- **Canon material** (CF-022 – CF-025, CF-043): Jel as a metaphor-driven root-tongue, the dual naming
  system, gendered possessives, the roots *beeko / deelith / ku-vastei / lukiul / kaoc / xanmeer /
  thtithil*, and the ruin-name template *Ixtaxh-Thitithil-Meht = "Exact Egg-Cracker"* are
  `community-data`, **confidence medium** — every gloss here came from a search-result summary of a wiki
  page, not from the primary text of *The Sharper Tongue: A Jel Primer*, because direct fetches to UESP,
  Fandom and the Imperial Library were refused at the proxy (see RI-LOR01 provenance). **An agent with
  unblocked access should re-verify the glosses before wave 2.**
- **Our decompositions** (`xan` + `meer`, `haj` + `mota`, `ix-` + `-taxh`, `thith` + reduplication) are
  labelled `inferred`. They are reasonable and internally consistent, and *haj mota* → "hidden shell"
  independently reproduces a canon creature name, which is the best evidence available that the method
  is sound. They are still inferences, not canon.
- **Everything else is `constructed`**: the full phonotactic rule set, all 40-odd invented roots, the
  entire morphology beyond the two attested prefixes, the ten coined game-terms, the Tamrielic-name
  grammar with its verb/noun/blocklist inventories, and the Kothringi naming scheme (explicitly flagged
  in the JSON — canon gives us the people and no names). Confidence is `high` **as a specification**,
  which is the only sense in which a constructed rule can have confidence: it is precise, it is
  executable, and it has been run.
- The validator's verified outputs in §6 are `measured` — actual stdout from
  `corpus/80-methods/jel-phonotactics.py` on 2026-08-05, reproducible by re-running the commands in
  Comparison method §1–2.
