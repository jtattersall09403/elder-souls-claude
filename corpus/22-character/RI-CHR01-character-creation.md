---
id: RI-CHR01
title: Character creation — what the Writ House asks, what it changes, and what it never locks
kind: structure
side: morrowind
judges: [character.creation.flow, character.creation.identity, character.creation.irreversibility, character.class.custom, progression.build.identity, progression.level.attributes, progression.skill.gating]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

A Dark Souls character is a **loadout**. You pick Knight because Knight starts with a shield,
and by level 40 the word means nothing: the ten classes have converged into the same
soul-level arithmetic and the only durable trace of your choice is which two starting items
you sold. That is a correct design for a game whose subject is the fight. It is the wrong
design for a game whose subject is a province.

A Morrowind character is an **identity**. Somebody asked you your name and then used it. A
customs officer asked you ten questions about wounded dogs and inheritance disputes and told
you what you apparently are. You emerged with a race, a birthsign, a profession, a stamped
document with your answers on it, and a set of *facts about yourself* that other people in the
world would go on to react to for the next eighty hours. Morrowind wins this, decisively and
without a seam to argue about: character creation happens entirely outside the fight.

The bar has three parts and the third is the one that is usually failed.

1. **Creation is a scene, not a screen.** Owned by `RI-JRN01` §C (O6–O10), which this item
   does not restate and must not contradict. Every field below is delivered as an answer to a
   named person in a named room.
2. **Every answer changes something a save file can prove** — a number, a price, a greeting,
   a quest, an encounter. An input with no downstream read is a decoration and a lie.
3. **Class shapes and never locks.** Morrowind's own worst habit was making the class screen
   feel like a commitment it was not; Souls' is making it a commitment that is not even felt.
   The correct property is precise: *at level 1 your class is most of what you are; at level 60
   it is a fact about your history and nothing about your ceiling.* Nothing in the game may
   ever check your class to decide whether you may do something.

The measurable claim: **540 meaningfully distinct starting configurations, ≥ 90% of them
end-to-end viable**, where "distinct" and "viable" are both defined below as procedures rather
than as adjectives.

## The reference artifact

### 1. The eight inputs, in order, and who asks for them

Beats are `RI-EXP01`'s (B01, B03) and the presentation contract is `RI-JRN01`'s. This item owns
the **content** of each input and the **consequence** of each answer.

| # | Input | Asked at | Asked by | Form of the question | Reversible? |
|---|---|---|---|---|---|
| 1 | **Hatch-name** | B01, in the barge hold, ~0:00 | a sick fellow prisoner | *"They will take the other one off you at the writ house. Tell me the one they cannot."* | **Never.** |
| 2 | **Race** | B03, the Writ House | Warden-Scribe | Not asked. **Observed**, and read back to you wrongly at least once. | **Never.** |
| 3 | **Sex** | B03 | Warden-Scribe | recorded on the writ | Never (cosmetic only; no mechanical term anywhere) |
| 4 | **Upbringing** | B03 | Warden-Scribe | *"Where were you a child? Answer in the name of a water, not a country."* | **Never.** |
| 5 | **Given name** | B03 | Warden-Scribe | *"And the name they will use."* | **Once**, for 250 g, at any Provincial Office (a writ amendment). |
| 6 | **Class / profession** | B03 | Warden-Scribe | Three routes (§4) | Never — **and it does not matter that it is never**, see §6. |
| 7 | **Birthsign** | B03 | Warden-Scribe | *"Which tide were you drawn on?"* — see `RI-CHR03` | **Once**, at the greatest Hist (Helstrom), at real cost. `RI-CHR03` §5 owns the terms. |
| 8 | **Favoured attributes** | B03, only on the custom route | Warden-Scribe | *"What has carried you this far?"* | Never |

Creation terminates with `RI-JRN01` O10: a **stamped reed-case writ** in the inventory,
readable, bearing every answer above in the Warden-Scribe's own hand, and referenced by name by
≥ 6 NPCs later in the game. The writ is also the diegetic home of the `lukiul` tag, the caste
line, and the bounty ledger reference used by `RI-CRM01` §4.

**The hatch-name is not cosmetic.** It is a second name string, never displayed in the HUD,
which exactly **11** NPCs in the game use — rootkeepers, a Deep-Kin war-leader, the Hist at
sap-taint band 4 (`RI-LOR05` §4a), and one person you will not expect. A non-Argonian player is
asked for it too and may refuse; refusing is recorded and is itself referenced later. This is
the cheapest high-value character-creation feature in the item and the first one that will be
cut.

### 2. What each input actually changes

| Input | Attributes | Skills | Social | Content | Fight |
|---|---|---|---|---|---|
| Race | +12 total, shaped (`RI-CHR02` §1) | 5 skills raised | the whole 12×10 reaction matrix; price surcharge; guard `lawFactor` | 34 race-gated quests | **Yes** — encounter composition and aggro (`RI-CHR02` §4e) |
| Upbringing | — | — | 6 reaction-group rows (`RI-CHR02` §3) | 9 upbringing-gated topics, 2 quests | via disposition-gated parley only |
| Class | ±4 across ≤4 attributes, **net zero** | 5 skills set to 15–25 | 3 caste topics | **0 gates** (§6) | no |
| Birthsign | — | — | 2 topics; rootkeepers can read it off you | 4 birthsign-gated topics, 1 quest | **Yes** — the power and the drawback (`RI-CHR03`) |
| Given name | — | — | used in ~2,400 dialogue lines via `%PCName` | — | no |
| Hatch-name | — | — | 11 NPCs | 1 topic chain | no |
| Sex | — | — | 0 terms | 0 gates | no |

**Sex has zero mechanical terms and this is deliberate and stated**, so that a critic does not
go looking for a hidden one and a builder does not invent one to make the field feel earned.

**The attribute reconciliation** (important, and an inconsistency in the corpus that this item
resolves rather than papers over): `RI-PRG02` §1 says all attributes start at 10 and "origins
may shift up to ±4 across at most four attributes, net zero" — but `RI-PRG02` predates race
existing as an input. The composed rule is:

```
attribute_at_creation(a) = 10
                         + raceDelta[race][a]        # sums to +12 across the sheet, per RI-CHR02 §1
                         + classDelta[class][a]      # ±4 on at most 4 attributes, sums to 0
```

**Race is the only source of net attribute gain at creation; class only redistributes.** Every
character therefore begins with exactly `100 + 12 = 112` attribute points, no matter what they
picked, and the choices are entirely about shape. A builder who lets class add net points has
made one class better than the others and broken `RI-PRG02`'s scaling assumptions.
*This is proposed to `RI-PRG02`'s owner as a clarifying amendment; nothing in `RI-PRG02` changes numerically.*

**The skill reconciliation:** `RI-PRG03` §1 says all skills start at 5 and "origins may set up
to five skills to 15–25". Race also raises five (`RI-CHR02` §1). The composed rule is
`skill_at_creation = max(5, raceSkill, classSkill)`, so a character starts with **between 5 and
10 of the 19 skills above baseline** — 5 if their race and class overlap completely (a Khajiit
Wet-Foot: both push Sneak/Security/Acrobatics), 10 if they do not overlap at all (an Orsimer
Sap-Reader). Overlap is a real and intentional choice: overlapping starts are *deeper*,
non-overlapping starts are *wider*, and neither is better.

### 3. Upbringing — the four answers

Upbringing is the axis that lets a player partly buy out of, or double down on, their race
(`RI-CHR02` §3 owns the numbers). It is asked as a question about water because the answer is
a place, not a nationality.

| Answer | Given as | Who you are | Reaction rows moved |
|---|---|---|---|
| `interior` | *"black water, no bottom"* | Raised in the marsh proper, by kin, in Jel | RG-DEEP **+10**, RG-ROOT +8, RG-LUKIUL −8, RG-LEDGER −6, RG-EMPIRE −8, RG-TOWN −4 |
| `lukiul` | *"the harbour at Lilmoth"* / *"the Gideon cut"* | Raised in a coastal town under Imperial law, literate, assimilated | RG-DEEP **−16**, RG-ROOT −10, RG-LUKIUL +10, RG-LEDGER +8, RG-EMPIRE +4, RG-TOWN +6 |
| `foreign-born` | *"a river you have not heard of"* | Raised outside the province entirely | RG-DEEP −4, RG-ROOT −2, RG-LUKIUL +2, RG-LEDGER +4, RG-EMPIRE +6 |
| `blackrose` | *"the ditch under the wall"* | Born in the prison town, to a guard's family or an inmate's | RG-DEEP −6, RG-ROOT −4, RG-EMPIRE +4, RG-TOWN −2 |

All four are legal for all ten races and every combination has at least one authored dialogue
line acknowledging it. The three that are *strange* — an `interior` Dunmer, a `foreign-born`
Saxhleel, a `blackrose` Khajiit — each get a dedicated exchange with the Warden-Scribe, because
a game that permits an odd combination and then never notices it has permitted nothing.

### 4. Class — three routes to the same object

Per `RI-JRN01` O9, three routes, and the questionnaire route is mandatory.

**Route A — name a profession.** Fourteen authored classes. Each sets four attribute deltas
(two at +4, two at −4) and five skills (three at 25, two at 15).

| # | Class | Family | +4 / +4 | −4 / −4 | Skills at 25 | Skills at 15 |
|---:|---|---|---|---|---|---|
| 1 | **Salt-Blade** | Fighter | STR, END | INT, PER | Blades, Shieldcraft, Athletics | Axes & Maces, Survival |
| 2 | **Marsh-Knight** | Fighter | END, VIG | AGI, SPD | Greatweapons, Shieldcraft, Axes & Maces | Speechcraft, Survival |
| 3 | **Hollow-Hunter** | Thief | AGI, LCK | VIG, PER | Sneak, Blades, Alchemy | Acrobatics, Marksman |
| 4 | **Wet-Foot** | Thief | AGI, SPD | STR, VIG | Security, Sneak, Acrobatics | Mercantile, Athletics |
| 5 | **Ledger-Hand** | Social | PER, INT | STR, VIG | Mercantile, Speechcraft, Security | Blades, Alchemy |
| 6 | **Net-Cutter** | Social | PER, AGI | STR, WIL | Speechcraft, Sneak, Veiling | Blades, Athletics |
| 7 | **Deelith** *(one who passes on)* | Social | INT, PER | STR, END | Speechcraft, Alchemy, Sorcery | Warding, Mercantile |
| 8 | **Reed-Walker** | Scout | SPD, AGI | INT, PER | Marksman, Survival, Athletics | Sneak, Acrobatics |
| 9 | **Xanmeer-Delver** | Scout | AGI, VIG | PER, WIL | Acrobatics, Security, Marksman | Athletics, Blades |
| 10 | **Bone-Setter** | Scout | VIG, INT | STR, LCK | Survival, Alchemy, Root-Speech | Athletics, Warding |
| 11 | **Sap-Reader** | Mage | INT, WIL | STR, END | Sorcery, Alchemy, Warding | Veiling, Speechcraft |
| 12 | **Tide-Caller** | Mage | INT, END | PER, LCK | Sorcery, Warding, Shieldcraft | Blades, Athletics |
| 13 | **Root-Speaker** | Root | HIST, WIL | STR, AGI | Root-Speech, Warding, Alchemy | Speechcraft, Survival |
| 14 | **Egg-Tender** | Root | HIST, PER | STR, SPD | Root-Speech, Speechcraft, Survival | Alchemy, Mercantile |

Six families — Fighter, Thief, Social, Scout, Mage, Root — and every family contains at least
two classes that play differently within it. **Only three of fourteen classes put a weapon
skill first.** That ratio is the item's statement about what a class is for.

**Route B — declare a custom profession.** You type a name (free text, stored, and used
verbatim by NPCs who ask what you do), then choose:

- **two favoured attributes** (+4 each) and **two neglected** (−4 each) — the four must be
  distinct, and the neglected pair may not include a favoured one;
- **three primary skills** (→ 25) and **two secondary** (→ 15), all distinct, from the 19.

Legal custom configurations: `C(10,2) × C(8,2) × C(19,3) × C(16,2) = 45 × 28 × 969 × 120 =
146,588,400`. That is not a design claim, it is an upper bound; §5 says what the *meaningful*
count is. The builder must not gate the custom route behind "advanced" or hide it — Morrowind's
custom class is where the memorable characters come from.

**Route C — the questions.** Twelve in-fiction dilemmas, of which the Warden-Scribe asks
**ten**, drawn deterministically from your race + upbringing so the questions themselves are
characterised. Each answer scores three skills by +1 weight; the three highest-weighted skills
become primaries, the next two secondaries, and the two most-weighted governing attributes
become the favoured pair. Per `RI-JRN01` M7, **no question may contain a skill name, an
attribute name, a numeral used as a stat, `+`, or `%`.**

Four of the twelve, in full, as the artifact:

> **Q3.** *A tithe-barge has grounded on the flats and the crew have gone for help. In the hold
> there is salt, and rope, and a man in a collar who says he was put there yesterday. The tide
> turns in an hour.*
> **(a)** Cut the collar. It is one cut. — `Security +1, Sneak +1, Speechcraft +1`
> **(b)** Carry what will sell and go. He was in the hold when you found him. — `Mercantile +1, Athletics +1, Survival +1`
> **(c)** Wait for the crew and put the question to them in front of witnesses. — `Speechcraft +1, Mercantile +1, Warding +1`
> **(d)** Break the hold's ribs so the tide takes the salt as well as the barge. — `Axes & Maces +1, Greatweapons +1, Acrobatics +1`

> **Q6.** *Your kin has been dead four days and the roots here are grey and will not drink her.
> The nearest living well is two days' walk and she will not last it.*
> **(a)** Walk. Carry her. — `Athletics +1, Survival +1, Root-Speech +1`
> **(b)** Cut a new well. You know how. It is not permitted. — `Alchemy +1, Security +1, Root-Speech +1`
> **(c)** Burn her, and let the Drowned Court argue about it. — `Sorcery +1, Speechcraft +1, Warding +1`
> **(d)** Sit with her until it is finished either way. — `Warding +1, Veiling +1, Survival +1`

> **Q9.** *A Legion clerk in Gideon has your name on a list and cannot read the hand it is
> written in. He asks you what it says.*
> **(a)** Read it to him correctly. — `Speechcraft +1, Mercantile +1, Warding +1`
> **(b)** Read it to him incorrectly. — `Speechcraft +1, Sneak +1, Veiling +1`
> **(c)** Take the list. — `Sneak +1, Security +1, Acrobatics +1`
> **(d)** Tell him you cannot read either, and watch what he does. — `Veiling +1, Marksman +1, Survival +1`

> **Q11.** *Three of you are on a rope over a channel and the rope is failing. The one below you
> is heavier and is holding a child.*
> **(a)** Climb over them both, fast. — `Acrobatics +1, Athletics +1, Sneak +1`
> **(b)** Take the child up and then go back down. — `Athletics +1, Shieldcraft +1, Root-Speech +1`
> **(c)** Brace the rope with your own body and shout for the bank. — `Shieldcraft +1, Survival +1, Speechcraft +1`
> **(d)** Cut above yourself so the drop is shorter for everyone. — `Blades +1, Acrobatics +1, Alchemy +1`

Each question offers four answers, each answer weights three skills, and **every one of the 19
skills appears in ≥ 5 answers across the twelve questions** so no route through the
questionnaire is unreachable. The questionnaire may produce a configuration identical to a
named class, and when it does the Warden-Scribe says the name aloud — which is the moment the
route is *for*.

### 5. **540 meaningfully distinct starting configurations** — the measurable claim

Raw legal starts on the named-class route: `10 races × 4 upbringings × 14 classes ×
9 birthsigns = 5,040`, plus the custom route's 146.6M. Both numbers are meaningless on their
own. The number that matters is how many of them the *world* can tell apart.

**Signature.** Every start reduces to a four-part signature:

```
signature = ( race,                        # 10  — indexes the RI-CHR02 reaction matrix column
              class_family,                # 6   — Fighter/Thief/Social/Scout/Mage/Root
              birthsign_family,            # 3   — RI-CHR03 §2: Given / Withheld / Turned
              upbringing_class )           # 3   — interior / assimilated (lukiul+blackrose) / foreign
```

`10 × 6 × 3 × 3 = ` **540**. Two starts with the same signature are *variations*; two with
different signatures are **meaningfully distinct**, because each of the four components is read
by a different subsystem (encounters and prices; skills and attributes; a power and a drawback;
disposition rows) and a difference in any one is observable in play without inspecting a menu.

**Viability** is not an opinion either. A configuration is **end-to-end viable** if a scripted
run at that configuration can:

1. complete every `category: "main"` quest stage to an ending;
2. reach rank 5 in ≥ 3 factions;
3. never encounter a gate with no route it can take (`RI-PRG03` method 8's principle);
4. survive the tier-5 region at level ≥ 55 in ≤ 3 attempts per encounter in the sim model.

| Metric | Target | Hard fail |
|---|---:|---:|
| Distinct signatures shipped | **540** (all cells populated) | < 400 |
| Signatures end-to-end viable | **≥ 486 (90%)** | < 70% |
| Signatures a blind judge can partially identify from 5 min of trace (≥ 3 of 4 components) | **≥ 70%** of a 20-sample | < 40% |
| Classes with a unique 5-skill set | 14 / 14 | < 12 |
| Named classes reachable from the questionnaire | ≥ 10 / 14 | < 6 |
| Custom-route configurations that are strictly dominated by a named class | **0** | any |

### 6. **Class shapes, never locks** — the property, stated as five prohibitions

This is the item's third bar and the one most likely to be quietly failed.

1. **No content gate may reference class.** Not a quest, not a topic, not a door, not a
   faction, not a trainer, not an item. `grep -r '"class"' game/data/**` must return only
   `npcs/*.json` (NPC statblock archetypes) and `progression/classes.json`. **Zero** hits in
   `quests/`, `dialogue/`, `items/`, `world/`.
2. **No skill may be class-restricted.** All 19 skills are trainable to 100 by all classes at
   the same `12 × level` gold rate (`RI-PRG05`). There are no major/minor progression-rate
   multipliers. Morrowind gated levelling on major skills; we do not, because `RI-PRG01` owns
   levelling and it is souls-driven (S2).
3. **No weapon or armour may be class-restricted.** `RI-PRG03` §5's grade-shift is the only
   penalty for using something unfamiliar, and it is a *skill* penalty that any character can
   train away.
4. **Class's share of the level-60 character must be small and measurable.** Sum of
   `classDelta` = 0 attributes out of 112 at creation and out of ~170 at L60 (**0%**). Class
   skill points at creation = **80** above baseline (3×20 + 2×10) out of a level-60 total of
   ≈ 700 skill points above baseline: **≤ 15% at creation, ≤ 4% at level 60.**
   *AMENDED wave 1 (`W1-07`, `AMENDMENT-W1-07-02.md` §D): this clause read 105, which its own
   parenthesis contradicts — 3×20 + 2×10 = 80, and 80 is what all fourteen shipped classes
   deliver. The bound is met more comfortably at 80 (11.4%), not less; no threshold moves.*
5. **But class must still be visible.** The prohibitions above make it easy to satisfy the
   letter by making class do nothing. The counterweight: **three caste topics** keyed on the
   class string appear on ≥ 25 NPCs each ("you have the Ledger's hands"), the custom class's
   free-text name is spoken back by ≥ 4 NPCs, and the writ carries it forever. Class is
   **archaeology** — a permanent, referenced fact about where you came from, with no power over
   where you go.

### 7. Irreversibility — what is fixed, what is bought back, and where

| Field | Reversible | Cost | Where | Why this ruling |
|---|---|---|---|---|
| Hatch-name | **No** | — | — | It is the name the world did not give you. Nothing may take it or trade it. |
| Race | **No** | — | — | The entire `RI-CHR02` matrix reads it; a race-change item would delete the item. |
| Upbringing | **No** | — | — | It is a fact about a past, and the game contains people who were there. |
| Sex | No | — | — | No mechanical term; a cosmetic-only change would be a UI feature, not a system. |
| Given name | Yes, **once** | 250 g | any Provincial Office | Writ amendment. NPCs who knew the old name keep using it, and one of them says so. |
| Class | **No** | — | — | Costless by construction (§6). Nothing is locked, so nothing needs unlocking. |
| Birthsign | Yes, **once**, whole game | `RI-CHR03` §5 | the great Hist at Helstrom | The tide can be re-cut; it is `vastei-eixa` on the largest scale, and it is a quest, not a menu. |
| Attributes / skills | No respec, ever | — | — | `RI-PRG02`: no attribute may be reduced after allocation. Souls-side respec would flatten S2's earned stream. |

**There is no respec and no rebuild.** A player who has built badly at level 40 fixes it by
levelling *into* what they need — which the soul curve (`RI-PRG01`) makes expensive and the
use-based skill system (`RI-PRG03`) makes possible. This is a hard ruling and the most likely
one to be lobbied against.

## Comparison method

1. **Field inventory.** Load `game/data/progression/creation.json`. **Assert all eight §1
   inputs exist**, each with an `asked_by` resolving to a real NPC record and an `asked_at`
   resolving to a beat id in `RI-EXP01`. **Assert `sex` has zero entries in any `requires`
   clause anywhere in `game/data/`** (`grep -rn '"sex"' game/data/quests game/data/dialogue`
   must be empty).
2. **Attribute arithmetic.** For all 10 races × 15 class options: **assert
   `sum(raceDelta) == 12`, `sum(classDelta) == 0`, `|classDelta[a]| ≤ 4` on ≤ 4 attributes, and
   total starting attribute points == 112 for every single combination.** Any combination
   summing to something else is a broken class.
3. **Skill composition.** For all 150 race×class pairs: **assert the count of skills > 5 is in
   [5, 10]**, **assert no skill exceeds 25 at creation**, and **assert every one of the 19
   skills is above baseline in ≥ 1 pair.**
4. **Questionnaire purity (`RI-JRN01` M7, re-run here on content).** Extract all 12 questions
   and 48 answers from `game/data/dialogue/creation-questions.json`. **Assert zero occurrences
   of any of the 19 skill names, any of the 10 attribute names, `+`, `%`, or a digit used as a
   quantity.** Then **assert every one of the 19 skills appears in ≥ 5 answers' weight lists**
   and **assert ≥ 10 of the 14 named classes are reachable** by exhaustively enumerating all
   `4^10` answer combinations (1,048,576 — trivial) and computing the resulting primaries.
5. **Signature coverage.** Enumerate the 540 signatures from shipped data. **Assert all 540 are
   constructible** (no signature is unreachable because, e.g., no Root-family class exists for a
   given race). Print the empty cells.
6. **Viability sim.** For each of the 540 signatures, run the static viability checker:
   ```
   node tools/analysis/build-viability.mjs --signatures all --out reports/viability.json
   ```
   which walks `game/data/quests/**` stage graphs against the configuration's gate-passing
   ability at simulated levels 1/20/40/60. **Assert ≥ 486 signatures pass all four §5 criteria**,
   and **print every failing signature with the gate that stopped it.** A failure list is the
   useful output; a pass/fail summary is not.

   > **AMENDED wave 1 — `BAR-CRITIQUE-W1-07-R1` §R2.5. While `tools/analysis/build-viability.mjs`
   > does not exist, the Distinctness axis is `corpus_debt`: removed from the min-over-axes
   > aggregation entirely, reported at its measured value of `unmeasurable`, and filed against
   > `RI-MTH06` — not scored as a 0 against the build.**
   >
   > The reason is arithmetic, not charity. This item aggregates **min-over-axes**. An axis that no
   > build can measure is an axis every build fails, so **`RI-CHR01`'s native score has been pinned
   > at 0 since wave 0 for every build that will ever be written**, and it was: `W1-07` rounds 1
   > and 2 both record `native_score: 0` with the stated reason *"distinctness axis unmeasurable
   > (build-viability.mjs absent)"*. `RI-MTH06` itself records the same observation about round 1
   > — *"an item whose other nine axes scored between 5 and 8 aggregated to 0 by its own
   > min-over-axes rule, because one axis could not be measured at all"* — and then left the
   > mechanism in place for a second wave.
   >
   > `CRITIC-DOCTRINE` §7 already rules this case: *"if an item cannot reach 10 because the corpus
   > is broken — an unmeasurable metric, a missing constant … file it as `corpus_extended`, do not
   > absorb it into the piece's score."* §7.3's fail-closed 0 governs a **harness gap the piece
   > could close**; a tool the corpus mandated, assigned to nobody, and never wrote is not that.
   >
   > **Nothing is relaxed.** The axis keeps its bands, its 486/540 target and its `< 70%` floor
   > verbatim, and returns to the aggregation the day the tool exists — at which point a build that
   > cannot clear it fails on it. What changes is only that the debt is charged to the party that
   > incurred it. This is the mechanism `BAR-CRITIQUE-W1-09-R1` §R2.3 established for `RI-CMB07`
   > M1 and it is applied here unchanged.

11. **The naming moment, and the delivered scene** *(ADDED wave 1, `BAR-CRITIQUE-W1-07-R1` §R3).*
    Method 4 enumerates `4^10` answer combinations **against the data file** and asserts named
    classes are reachable *in principle*. A route can be reachable in principle and never taken,
    and this build proved it: the round-3 builder's own measurement is that
    `reachableClasses()` reaches **11 of 14 in principle** while a 1,600-run play sweep produces
    **0**, because the matcher requires set equality on a space of 116,280 shapes. Method 4 could
    not tell those two apart, and the item's most important sentence — *"the Warden-Scribe says the
    name aloud, which is the moment the route is for"* — had no check at all.
    **Run `RI-JRN09` M3 (`ES-NAMED/1`) and M1 (`ES-LEGIBLE/1`) and cite both here.** Specifically:
    **assert ≥ 6 distinct named `class_id` values over a ≥ 240-run sweep with a published a/b/c/d
    histogram**, **assert `on_match_named_class`'s line reaches the frame on 100% of named
    matches**, and **assert the ten dilemma questions reach the frame at 10 of 10 questionnaire
    nodes.** Method 4's in-principle enumeration remains, and is now explicitly *not* sufficient
    for the Questionnaire or Class-roster axes.
7. **Legibility (blind, manual, `blind_pair` at the trace level).** Sample 20 signatures. For
   each, produce 5 minutes of harness trace of ordinary play (walk into a settlement, talk to
   three NPCs, buy something, open one lock, fight one trash enemy) with all creation metadata
   stripped from the trace header. Hand each to a fresh agent and ask it to name the race,
   class family, birthsign family and upbringing class. **Assert ≥ 14 of 20 traces yield ≥ 3
   correct of 4.** Record the confusion matrix — which components are unreadable is more useful
   than the score.
8. **The five prohibitions (§6), each a separate hard check.**
   - `grep -rn '"class"\|"requires_class"\|"class_min"' game/data/quests game/data/dialogue game/data/items game/data/world` → **must be empty.**
   - Harness: at a trainer, request every one of the 19 skills as each of the 14 classes.
     **Assert 19×14 = 266 offers, all at the same price.**
   - Harness: equip every weapon and armour archetype as each class. **Assert zero refusals.**
   - Compute class share of the level-60 sheet from a replayed typical clear. **Assert ≤ 4%.**
   - `grep` for the three caste topics. **Assert each appears on ≥ 25 NPC records**, and
     **assert ≥ 4 NPCs echo the custom class free-text string.**
9. **Irreversibility audit.** For each row of §7 marked "No", **assert no item, spell, service,
   quest reward or console-reachable action in `game/data/**` sets that field.** For the two
   reversible rows, **assert the service exists, costs what §7 says, and fires exactly once**
   (attempt it twice in the harness; the second must be refused in dialogue, not by a greyed
   button).
10. **The strangeness acknowledgement.** For the three odd combinations named in §3
    (`interior` Dunmer, `foreign-born` Saxhleel, `blackrose` Khajiit), **assert a dedicated
    Warden-Scribe exchange exists** and **assert ≥ 1 later NPC references it.**

### CONSUMPTION (`RI-MTH07` / `ARBITRATION` §3) — *(ADDED wave 1, `BAR-CRITIQUE-W1-07-R1` §R4)*

`ARBITRATION` §3's CONSUMPTION check reached the critics and reached **none** of the fourteen items
judging creation, the opening or the journeys. Which models must be enumerated, and what a zero
costs, are properties of the item and not of a critic's diligence. For this item:

1. **Enumerate exhaustively** — `creation.json`, `classes.json`, `creation-questions.json` and its
   48 weighted answers, the upbringing table, the custom-route option sets, `creation-names.json`,
   the writ record, and the three caste topics. A sample is not an enumeration.
2. **Perturb and observe** per `RI-MTH07` §B: two well-separated values, everything else fixed, an
   **entity-side or frame-side** observable, plus the null control. For creation the admissible
   observables are what a save file or a frame can prove — an attribute a fight reads, a price a
   merchant quotes, a topic an NPC offers, **a string a player can see**. This item's §The-bar
   clause 2 already says it: *"an input with no downstream read is a decoration and a lie."*
3. **Apply the consequence.** Any `coupling == 0` scores **that axis 0**, fail-closed, and appears
   in `status_reasons`. There is no `partial`.
4. **The fourth shape of the failure lives here.** `RI-MTH07` §A names orphan model, orphan data
   and orphan predicate. This item produced **orphan text** — ten authored dilemmas, computed
   correctly, carried in `getCensusState().question.text`, exposed to the harness, and drawn
   **zero** times. From the player's chair that is identical to their never having been written.
   `RI-JRN09` `ES-LEGIBLE/1` is its instrument.

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Inputs | all 8, all diegetic, all with a named asker | all 8 present | ≥ 2 delivered as a menu with no speaker → also a `RI-JRN01` hard fail |
| Consequence | every input has ≥ 1 measurable downstream read; hatch-name used by ≥ 11 NPCs | every input except sex has ≥ 1 read | any input with zero reads (a decorative field) |
| Attribute/skill arithmetic | 112 points and 5–10 raised skills for all 150 pairs | same, ≤ 2 exceptions documented | classes grant net attribute points |
| Class roster | 14 unique, ≥ 10 questionnaire-reachable **in play (method 11)**, ≤ 3 weapon-first | 12 unique, ≥ 6 reachable **in play** | classes are Souls' ten with new names, **or reachable only in principle: 0 in a published-histogram sweep** |
| Questionnaire | 12 questions, zero stat tokens, all 19 skills ≥ 5 answers, **`DTR_q = 1.00` (method 11)** | 8 questions, zero stat tokens, **`DTR_q = 1.00`** | questionnaire cut, questions read "Do you prefer Strength or Agility?", **or the questions are computed and never drawn** |
| Custom route | present, unhidden, 0 dominated configs | present and unhidden | absent, or gated behind "advanced" |
| Distinctness | 540 signatures, ≥ 486 viable | 540 constructible, ≥ 70% viable | < 400 signatures — the axes are not independent. *`corpus_debt` while `build-viability.mjs` is absent — see method 6* |
| Legibility | ≥ 16/20 at ≥ 3 of 4 | ≥ 14/20 | ≤ 8/20 — nothing about the character is visible in play |
| **Class never locks** | all five prohibitions hold, and §6.5's visibility holds | all five prohibitions hold | **any content gate reading class → automatic fail of the piece** |
| Irreversibility | audit clean, both reversible services exist and fire once | audit clean | a race-change or respec item exists → automatic fail |

**Failure threshold: any axis below 6.** The class-never-locks axis and the irreversibility
audit are binary.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 0 | 2 | 4 | 6 | 8 |
|---|---|---|---|---|---|
| Native | 0 / 10 | 2 / 10 | 4 / 10 | 6 / 10 | 8 / 10 |

> **AMENDED wave 1 — `BAR-CRITIQUE-W1-07-R1` §R5. The 0 and 2 rungs are added, and the reason is
> that their absence was load-bearing.** The row as originally written spanned 4, 6 and 8 only, on
> an item whose aggregation is **min-over-axes** and which therefore produces a native **0**
> routinely. It produced one three times: `W1-07` round 2 records `native_score: 0` for
> `RI-CHR01`, `RI-CHR02` **and** `RI-CHR03`, and all three were translated to ladder **4** — a
> number the row does not license and which `SCORING` §1.2's "the native band is a ceiling" only
> permits by accident, because the anchor row was silent below 4 and the critic had to fall back
> on §1's prose.
>
> The consequence is not cosmetic: **min-over-axes stopped being dispositive.** An axis at its 0
> band — the whole point of a min rule — cost the item six ladder points in principle and zero in
> practice. With the rungs filled in, a native 0 is a ladder 0 and the aggregation means what it
> says.
>
> **Two further rules, neither of which lowers anything:**
>
> 1. **`SCORING` §1.1's hard-fail cap binds here and is now checkable.** *"Any triggered hard fail
>    caps the whole item at 2."* Round 2 recorded **two** triggered hard fails against this item
>    (`questionnaire-route-unreadable`, `questionnaire-names-no-class`), in the verdict's own
>    `hard_fails[]` array, and scored the item **4**. `tools/verdict-validate.mjs` reads that array
>    to force `status: FAIL` and **never checked the cap**, so a binding rule with its data
>    already in hand went unenforced. It is enforced from this pass — the correct score for round 2
>    on this item is **2**, and this amendment therefore makes the piece score *lower*, not higher.
> 2. **An axis in `corpus_debt` (method 6) is removed from the min, not scored 0 into it.** See
>    method 6's amendment for why, and for why nothing is relaxed by it.

**Aggregation (a property of this item, not of the critic):** min-over-axes, over the axes that are
**measurable**; axes in `corpus_debt` are excluded from the min and reported separately.

## How we lose

- **Creation becomes a screen and `RI-JRN01` is quietly overridden.** The Writ House is
  expensive: an interior, an NPC with 60 lines, a branching dialogue, a stamped item. A menu is
  two hours of work. The menu ships "for now" and never leaves. This item cannot catch that on
  its own — `RI-JRN01`'s M5/M6 do — but every field below inherits the failure, because a
  question asked by a dropdown cannot be answered *wrongly*, cannot be reacted to, and cannot
  be remembered by anyone.
- **The questionnaire is cut.** It is the most expensive route (twelve authored dilemmas, 48
  weighted answers, and a reachability proof) and the one nobody strictly needs, because routes
  A and B already produce a class. It is also the only route that *teaches the setting while
  creating the character* — Q3 tells you slavery is current, Q6 tells you the roots are failing,
  Q9 tells you the Empire is illiterate in its own province. Cutting it turns creation into a
  spreadsheet and drops three world facts the first hour otherwise has to deliver another way.
- **The questionnaire is written, is excellent, and is never drawn.** *(ADDED wave 1,
  `BAR-CRITIQUE-W1-07-R1`.)* Worse than cutting it, because cutting it is visible. Twelve authored
  dilemmas exist, are in the register, are computed per race and upbringing, are returned through
  the harness — and the surface that draws the scene reads a different field, so ten nodes print
  one identical stock line above four answers with no question attached. The route's own reachability
  check passes (it enumerates the data), the diegesis checks pass (the room is there, the speaker
  resolves, the world is behind the panel), and **the player is shown forty answers to questions
  nobody asked**. This is not a prediction; it is `W1-07` round 2, and no check in this item or in
  `RI-JRN01` owned it until method 11 and `RI-JRN09` existed.
- **The route is reachable in principle and never in play.** A matcher requiring set equality
  against fourteen classes in a space of 116,280 shapes is *provably* able to reach eleven of them
  and *measurably* reaches none, because exact match is a measure-zero event under real answering.
  Method 4's `4^10` enumeration returns a comfortable number and method 11's sweep returns zero,
  and only one of the two is a fact about the game a player plays.
- **Class gets a gate.** Somebody writes a Fighters-Guild-equivalent quest that requires a
  Fighter-family class, because it is one line of JSON and it feels like flavour. It is the
  exact thing §6 prohibits, it silently deletes ~4/6 of the class axis for that content, and it
  will be defended as "the guild wouldn't take a scholar". The correct implementation of that
  fiction is a *skill* requirement, which every class can meet by playing.
- **Class gets a net attribute bonus.** "Salt-Blade gets +4 STR, +4 END" with no negatives,
  because negatives feel bad at creation. Now Salt-Blade is strictly better, the 112-point
  invariant is gone, and `RI-PRG02`'s scaling curves are being fed numbers they were not
  derived against. Caught only by method 2, which must be run over all 150 pairs and not
  spot-checked.
- **The 540 signatures are constructible and 200 of them are unplayable.** The likeliest form:
  Mage- and Root-family starts cannot survive the first hour because `RI-EXP01`'s B08 fight is
  tuned for someone with a weapon skill, so half the class roster is a trap. Method 6 is a
  static walk and will not catch a *lethality* problem; the viability checker's criterion 4
  exists for it and must actually be implemented rather than stubbed to `true`.
- **The hatch-name is cut, then the upbringing is cut.** Both are pure content with no system
  behind them, both look like polish, and together they are most of what makes the creation
  scene feel like it happened to a person. Their removal is invisible to every automated check
  except methods 1 and 10, which is why those methods assert *NPC references* rather than field
  existence.
- **Everything is reversible because players ask for it.** A respec shrine, a race-change
  amulet, a "reset your birthsign" service. Each is individually reasonable and collectively
  they convert an identity back into a loadout — and they specifically destroy `RI-CHR02`,
  whose entire value is that the race column of the reaction matrix is a thing you live with.
  The pressure for this is real and it will be framed as accessibility. The honest answer is
  that the game must be finishable by every signature (method 6), not that every signature must
  be escapable.
- **The custom route is hidden behind "Advanced".** Morrowind put it second in a list of three
  and it produced most of the memorable characters people still describe twenty years later.
  Any UI treatment that codes it as expert-only halves its use and the class roster collapses
  to fourteen presets.
- **Distinctness is claimed and never computed.** "Hundreds of viable builds!" appears in a
  verdict with no signature enumeration behind it. §5 exists so that the claim is a number a
  script prints, and the failing-signature list is the part of method 6 that must appear in the
  verdict.

## Provenance note

**Everything in this item is `constructed`** — the eight inputs, the fourteen classes and every
one of their deltas, the four upbringings, the twelve questions and their weightings, the 540
signature arithmetic, the viability criteria, the five prohibitions, and the irreversibility
table. All of it is binding on that basis.

Structural debts, `canonical-recall`, confidence **medium**: Morrowind's creation flow (name
asked in the hold, race/birthsign/class taken by an official in a customs office, three class
routes with a ten-question inference route, a stamped document you carry out) — recalled and
described in `RI-JRN01` §A at the same confidence and *not independently verified here*; and
Morrowind's 21 named classes plus custom-class builder with favoured attributes and
major/minor skills. Dark Souls' ten starting classes as pure loadouts is `canonical-recall`,
high confidence, and is used only as the negative example.

Setting content is inherited from `corpus/60-lore/`: the Writ House / Warden-Scribe framing and
Tidewrack come from `RI-EXP01` §D (itself `constructed`); *lukiul* as a real and resented
category is CF-031 (`community-data`, medium); the Jel term *deelith* ("one who passes on
wisdom") used as a class name is CF-025 (`community-data`, medium — the gloss comes from a
summary, not the primary text); `vastei-eixa` and the great Hist at Helstrom are
`RI-LOR05`/`RI-LOR02`, `constructed`.

Confidence **high**, and the reason is that this item's claims are almost entirely *internal*:
the 112-point invariant, the 540 signatures, the ≤ 4% class share and the five prohibitions are
arithmetic over tables printed in this file and in `RI-CHR02`/`RI-PRG02`/`RI-PRG03`, all of
which a critic can recompute. The two soft spots are the viability rate (90% is a target chosen
before any content exists, and the true figure will be discovered, not designed) and the
questionnaire's 10-of-14 reachability claim, which is asserted from the weight tables' shape
and has not been exhaustively enumerated — method 4 does that enumeration and may well come
back with 7.
