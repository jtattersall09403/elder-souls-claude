---
id: RI-DLG04
title: Disposition and persuasion — derived disposition, Admire/Intimidate/Taunt/Bribe formulas, gating thresholds
kind: number
side: morrowind
judges: [dialogue.disposition, dialogue.persuasion, dialogue.filter, economy.gold, progression.skills, npc.reaction]
provenance: community-data
confidence: high
blind_pair: no
---

## The bar

Disposition is Morrowind's second combat system. It is a real number per NPC, derived from
race relations, faction politics, your reputation, your crimes, your diseases, whether your
weapon is drawn, and your Personality — and it *gates content*: topics appear, services
open, quests become available, prices move, and one line of the same greeting turns from
"Go away. FAR away" into "Anything you wish, %PCName." You attack it with four verbs with
genuinely different consequences — Admire is safe and weak, Intimidate buys temporary
compliance at permanent cost, Taunt deliberately destroys disposition to provoke a legal
duel, Bribe converts gold into goodwill at a terrible exchange rate. Under ARBITRATION §1
this is Morrowind-authoritative territory and under seam S15 the bribe is a **gold** sink,
never souls. The bar: our disposition must be a number a player can *plan around*, with the
formulas below implemented as specified, thresholds that visibly change what the world will
tell you, and at least one questline resolvable by talking a hostile NPC up rather than
killing them.

## The reference artifact

### A. GMST constants (Morrowind defaults)

| GMST | Value | Role |
|---|---:|---|
| `fDispRaceMod` | **+5.0** | speaker and player share a race |
| `fDispPersonalityBase` | **50.0** | Personality pivot |
| `fDispPersonalityMult` | **0.5** | disposition per point of Personality over the pivot |
| `fDispFactionRankBase` | **1.0** | faction term constant |
| `fDispFactionRankMult` | **0.5** | faction term per player rank |
| `fDispFactionMod` | **3.0** | faction reaction scale |
| `fDispCrimeMod` | **0.0** | per point of bounty (see note) |
| `fDispDiseaseMod` | **−10.0** | player has common or blight disease |
| `fDispWeaponDrawn` | **−5.0** | player has a weapon drawn |
| `fDispAttacking` | **−10.0** | reaction to being attacked |
| `fDispPickPocketMod` | **−25.0** | caught pickpocketing |
| `fDispStealing` | **−0.5** | per gold of value stolen while seen |
| `fDispBargainSuccessMod` | **+1.0** | successful haggle |
| `fDispBargainFailMod` | **−1.0** | failed haggle |
| `fPersonalityMod` | **5.0** | divisor in persuasion ratings |
| `fLuckMod` | **10.0** | divisor in persuasion ratings |
| `fReputationMod` | **1.0** | multiplier on Reputation |
| `fLevelMod` | **5.0** | multiplier on level (Intimidate only) |
| `fFatigueBase` | **1.25** | fatigue term at full fatigue |
| `fFatigueMult` | **0.5** | fatigue term falloff |
| `fPerDieRollMult` | **0.3** | converts the roll margin into disposition points |
| `fPerTempMult` | **1.0** | temp:permanent split |
| `iPerMinChance` | **5** | success chance floor (%) |
| `iPerMinChange` | **10** | minimum magnitude of a successful change |
| `fBribe10Mod` | **+35.0** | flat bonus to the 10-gold bribe chance |
| `fBribe100Mod` | **+75.0** | 100-gold bribe |
| `fBribe1000Mod` | **+150.0** | 1000-gold bribe |

### B. Derived disposition

```
fatigueTerm(actor):
    max     = fatigue_max(actor)
    current = fatigue_current(actor)
    norm    = 1.0 if floor(max) == 0 else max(0.0, current / max)
    return fFatigueBase - fFatigueMult * (1 - norm)          # 0.75 … 1.25

derivedDisposition(npc, player):
    x  = npc.baseDisposition + npc.crimeDispositionModifier

    if npc.race == player.race:            x += fDispRaceMod

    x += fDispPersonalityMult * (player.Personality - fDispPersonalityBase)

    # --- faction term -------------------------------------------------------
    if player is a member of npc.faction and not expelled:
        reaction = factionReaction(npc.faction, npc.faction)   # faction toward itself
        rank     = player.rank_in(npc.faction)
    elif npc.faction is not empty:
        # the WORST reaction any of the player's factions provokes, and that faction's rank
        (reaction, rank) = argmin_over_player_factions(
                              f -> factionReaction(npc.faction, f),
                              skipping factions the player was expelled from)
    else:
        (reaction, rank) = (0, 0)

    x += (fDispFactionRankMult * rank + fDispFactionRankBase) * fDispFactionMod * reaction

    # --- player condition ---------------------------------------------------
    x -= fDispCrimeMod * player.bounty
    if player.hasCommonDisease or player.hasBlightDisease:  x += fDispDiseaseMod   # negative
    if player.weaponDrawn:                                  x += fDispWeaponDrawn  # negative
    x += magnitude(player.activeEffect(Charm))

    return clamp(int(x), 0, 100)
```

Two consequences a builder must not miss:

- **Faction reaction is a matrix, not a flag.** `factionReaction(A, B)` is authored per
  ordered pair. Morrowind's Camonna Tong hates the Thieves Guild specifically; a Telvanni
  looks at a Redoran differently than at a Hlaalu. When the player belongs to several
  factions the engine picks the **worst** reaction — joining a rival costs you.
- **`fDispCrimeMod` ships at 0.0**, so raw bounty does *not* directly move disposition in
  vanilla; crime reaches disposition through the separate `crimeDispositionModifier` (set by
  witnessed theft, pickpocketing, assault). We keep both channels but set
  `fDispCrimeMod = 0.02` (constructed) so that a 1,000-gold bounty costs 20 disposition —
  see §E.

### C. Persuasion — the four verbs

```
persuasionRatings(actor, isPlayer):
    persTerm    = actor.Personality / fPersonalityMod
    luckTerm    = actor.Luck        / fLuckMod
    repTerm     = actor.Reputation  * fReputationMod
    levelTerm   = actor.level       * fLevelMod
    ft          = fatigueTerm(actor)

    r1 = (repTerm + luckTerm + persTerm + actor.Speechcraft) * ft
    if isPlayer:
        r2 = r1 + levelTerm
        r3 = (actor.Mercantile + luckTerm + persTerm) * ft
    else:
        r2 = (levelTerm + repTerm + luckTerm + persTerm + actor.Speechcraft) * ft
        r3 = (actor.Mercantile + repTerm + luckTerm + persTerm) * ft
    return (r1, r2, r3)
```

```
attempt(npc, type):
    (n1,n2,n3) = persuasionRatings(npc,    false)
    (p1,p2,p3) = persuasionRatings(player, true)
    D          = derivedDisposition(npc)

    d       = 1 - 0.02 * abs(D - 50)          # ← the "middle is easiest" curve
    target1 = d * (p1 - n1 + 50)              # Admire, Taunt
    target2 = d * (p2 - n2 + 50)              # Intimidate
    target3 = d * (p3 - n3 + 50) + bribeMod   # Bribe; bribeMod = 35 / 75 / 150

    roll = randint(0, 99)
```

| Verb | Success test | Disposition effect | Side effects | Cost |
|---|---|---|---|---|
| **Admire** | `roll ≤ max(iPerMinChance, target1)` | `c = floor(fPerDieRollMult × (target1 − roll))`; success → `+max(iPerMinChange, c)` to **both** temp and perm; failure → `c` (negative) to both | none | free |
| **Intimidate** | `roll ≤ max(iPerMinChance, target2)` | success → **temp +x, perm −x** (you are feared now and resented forever); failure → both down | success also `Flee += max(10, s)`, `Fight −= max(10, s)` where `s = floor(margin × fPerDieRollMult × fPerTempMult)` | free |
| **Taunt** | `roll ≤ max(iPerMinChance, target1)` | `x = floor(−c × fPerDieRollMult)`, always **negative**; on success at least `−iPerMinChange` | success `Fight += max(10, s)`, `Flee −= max(10,s)` — **this is how you make them attack you first** | free |
| **Bribe** | `roll ≤ max(iPerMinChance, target3)` | `c = floor((target3 − roll) × fPerDieRollMult)`; success → `+max(iPerMinChange, c)`; failure → `c` (negative) | none | **10 / 100 / 1000 gold, spent either way** |

```
    # temp/perm split, applied after the verb
    if type == Intimidate:
        tempChange = clamp_to_disposition_range(int(x))
        permChange = -int(tempChange / fPerTempMult) if success else int(y)
    else:
        tempChange = clamp_to_disposition_range(int(x * fPerTempMult))
        permChange = int(tempChange / fPerTempMult)
```
`tempChange` applies inside the current conversation; `permChange` is written back when the
conversation ends. With `fPerTempMult = 1.0` they coincide for everything except Intimidate,
whose whole character is that the two have opposite signs.

**The `d` curve is the design.** `d = 1 − 0.02·|D − 50|` means at disposition 50 the target
is the full rating difference + 50; at disposition 0 or 100 it collapses to 0 and only
`iPerMinChance` (5%) remains. **Persuasion is easiest in the middle and nearly impossible at
the extremes.** You cannot grind an NPC from 0 to 100 with Admire spam; you get the first
30 points cheaply and the last 20 barely at all. Preserve this exactly.

**Bribe economics.** `fBribe1000Mod = 150` is a flat +150 to a target that is then compared
against a `0–99` roll — a 1,000-gold bribe is effectively guaranteed, and it converts gold
straight into disposition at roughly **1,000 gold for ~30–45 points**. That is the intended
exchange rate: brutal, always available, and the reason a rich player never needs
Speechcraft. Under ARBITRATION S15 this is the *only* currency that may be used. Souls
cannot bribe anyone, ever.

### D. Barter — disposition's other job (gold economy interface)

```
offerPrice(npc, basePrice, buying):
    a = min(player.Mercantile, 100);  b = min(0.1*player.Luck, 10);  c = min(0.2*player.Personality, 10)
    d = min(npc.Mercantile, 100);     e = min(0.1*npc.Luck, 10);     f = min(0.2*npc.Personality, 10)
    pcTerm  = (derivedDisposition(npc) - 50 + a + b + c) * fatigueTerm(player)
    npcTerm = (d + e + f) * fatigueTerm(npc)
    buyTerm  = 0.01 * (100 - 0.5 * (pcTerm - npcTerm))
    sellTerm = 0.01 * ( 50 - 0.5 * (npcTerm - pcTerm))
    return max(1, int(basePrice * (buying ? buyTerm : sellTerm)))
```
Disposition enters price linearly: **every point of disposition is worth 0.5% off the buy
price.** Going from 30 to 80 disposition is a 25% discount. This is what makes bribing a
merchant a *rational economic act* rather than a flavour button.

### E. Thresholds — what disposition gates (constructed, binding)

Morrowind authors these per-INFO with the `Disposition ≥` filter; we standardise them so a
critic can test them:

| Disposition | Band | What changes |
|---:|---|---|
| **0–19** | Hostile | Greeting band 1. **Refuses all topics except the root nine.** No services, no barter, no training. Guards may initiate arrest dialogue. |
| **20–39** | Cold | Greeting band 2. Answers place/person/service topics tersely. **Barter allowed at punitive prices.** No faction business, no personal topics, no quest offers. |
| **40–59** | Neutral | Greeting band 3. Full generic topic access. Faction quests offered **if the player's rank qualifies**. Training allowed. |
| **60–79** | Friendly | Greeting band 4. Unlocks the NPC's **personal/opinion topics** and one tier of faction-internal gossip. Best prices. |
| **80–100** | Warm | Greeting band 5. Unlocks **`little secret`** and any topic marked `confidential`. Some quest branches (betrayal offers, off-books work) exist **only** here. |

Additional binding rules:

1. **≥ 6 topics per Tier-A settlement must be gated at ≥ 70** and be unreachable otherwise.
2. **≥ 2 quests in the game must be resolvable purely by raising a hostile NPC's
   disposition** (talk-down resolution), satisfying ARBITRATION's "many quests resolvable by
   talk, bribe, sneak, theft, or lore knowledge".
3. **≥ 1 quest must be gated behind Taunt** — deliberately provoking an NPC into attacking
   first so that killing them is legal. Taunt must not be a dead verb.
4. **Base disposition must vary.** Across all named NPCs, the distribution of
   `baseDisposition` must have σ ≥ 12 and must not have more than 25% of NPCs at any single
   value. A world where everyone starts at 50 has no disposition system.
5. **Race and faction terms must bite.** A player of the region's majority race must average
   ≥ 8 disposition higher than a minority-race player at level 1 with identical stats.
6. `fDispCrimeMod = 0.02` (we deviate from vanilla's 0.0): bounty visibly costs goodwill.
7. **Fatigue matters out of combat.** Per ARBITRATION S4, Fatigue survives as a non-combat
   condition and it enters here twice — `fatigueTerm` scales both persuasion ratings and
   barter. Exhausted players are bad negotiators. This is the seam's whole justification;
   if `fatigueTerm` is stubbed to 1.0 the S4 ruling is unimplemented.

## Comparison method

**Step 1 — formula conformance (unit level).** Implement the reference in a scratch script
from §B/§C *independently of our code*, then compare against our engine over a randomised
sweep:
```
node tools/corpus/disposition-oracle.mjs --sweep 100000 --out /tmp/oracle.tsv
# sweeps: Personality 10..100, Luck 10..100, Speechcraft 5..100, Mercantile 5..100,
#         level 1..40, reputation 0..50, fatigue 0..1, npc stats likewise,
#         base disposition 0..100, race match {0,1}, faction reaction -4..+4, rank 0..9
node tools/corpus/dump-engine-disposition.mjs --cases /tmp/oracle.tsv --out /tmp/ours.tsv
diff <(cut -f9-12 /tmp/oracle.tsv) <(cut -f9-12 /tmp/ours.tsv) | head -50
```
Required: **exact integer match on `derivedDisposition`** and on `target1/2/3`
(±0.001 float tolerance), on 100% of cases. Any mismatch is a fail with the offending row
printed.

**Step 2 — the `d`-curve shape test.** Fix a mid-tier character. For
`D ∈ {0,10,…,100}` run 10,000 Admire attempts each and plot success rate.
Required: unimodal, peaking at `D = 50`, with `rate(0) ≤ 0.08` and `rate(100) ≤ 0.08` and
`rate(50) ≥ 3 × rate(0)`. A flat or monotonic curve means `d` was dropped.

**Step 3 — Intimidate sign test.** 10,000 successful Intimidates. Required:
`mean(tempChange) > 0` and `mean(permChange) < 0`, and `Fight` decreased while `Flee`
increased. If perm and temp have the same sign, Intimidate has been reduced to a second
Admire and the verb is dead.

**Step 4 — Taunt provocation test.** Script: find an NPC with `Fight = 30`. Taunt until
success ×3. Required: the NPC attacks, and **killing them does not generate a bounty**.
If Taunt cannot produce a legal kill, rule 3 fails.

**Step 5 — bribe economy.** For 1,000 randomised NPCs, record disposition gained per gold
for the 10/100/1000 tiers. Required: monotonically increasing success rate by tier;
1,000-gold success rate ≥ 0.95 at disposition 50; and the gold is deducted on failure.
Cross-check against `corpus/20-progression/` gold curves that 1,000 gold is a *meaningful*
cost at mid-game (target: ≥ 15% of a mid-game player's liquid gold).

**Step 6 — gating audit.** Dump every dialogue INFO with a disposition minimum:
```
node tools/corpus/dump-dialogue.mjs --out /tmp/d.tsv --include-filters
awk -F'\t' '$8>0 {print $8}' /tmp/d.tsv | sort -n | uniq -c
```
Required: entries at every band boundary (20/40/60/80); ≥ 6 entries at ≥ 70 per Tier-A
settlement; and at least one **quest-bearing** topic gated at ≥ 80.

**Step 7 — base-disposition distribution.** `σ ≥ 12`, no single value > 25% of NPCs
(rule 4). Print the histogram.

**Step 8 — playable proof (do this, do not reason about it).** From a fresh save, with a
Personality-30 character, walk to a hostile named NPC (disposition < 20), and reach one of
their gated topics using only persuasion and gold. Record: gold spent, attempts, final
disposition, and the topic text obtained. If it cannot be done, the system is decorative.

## Scoring

| Check | Pass | Fail |
|---|---|---|
| 1 formula conformance | 100% exact | any mismatch |
| 2 `d`-curve | peak at 50, ratio ≥ 3× | flat / monotonic |
| 3 Intimidate sign | temp>0, perm<0 | same sign |
| 4 Taunt legal kill | works, no bounty | does not |
| 5 bribe economy | monotone tiers, 1000g ≥ 95% at D=50, cost ≥ 15% of liquid gold | any tier non-monotone, or bribe trivially cheap |
| 6 gating | all four boundaries populated, ≥6 at ≥70/Tier-A, ≥1 quest at ≥80 | any boundary empty |
| 7 distribution | σ ≥ 12, no mode > 25% | everyone at 50 |
| 8 playable proof | achieved and logged | not achieved |

**8/8 = PASS. 6–7 = MARGINAL. ≤ 5 = FAIL.** Checks 1, 3 and 8 are individually
disqualifying: a wrong formula, a dead verb, or an unusable system fails the item outright.

"We lose" is: a disposition bar that goes up when you click Admire, is displayed in the
dialogue window, and gates precisely nothing.

## How we lose

- **Disposition as a cosmetic number.** It renders, it moves, and no filter anywhere reads
  it. Step 6 catches it in one command: zero INFOs with a disposition minimum.
- **Everyone starts at 50.** No race term, no faction matrix, no base variance. Then the
  first 20 minutes of every playthrough are identical regardless of who you made, and the
  Argonian-in-Black-Marsh premise of our setting pays nothing.
- **The `d` curve dropped.** Someone "simplifies" persuasion to `chance = speechcraft`,
  and now Admire-spam takes any NPC to 100 in eight clicks. Disposition stops being a
  resource and becomes a loading screen.
- **Intimidate collapsed into Admire.** The temp/perm opposite-sign mechanic is subtle and
  is the first thing a reimplementation loses. Then there are four buttons and two verbs.
- **Taunt has no consumer.** No quest, no NPC, no legal-kill path uses it, so it is a
  button that makes a number go down. Rule 3 exists because this is nearly guaranteed
  otherwise.
- **Bribes priced wrong in either direction.** Too cheap → gold trivialises every social
  gate and Speechcraft is dead. Too expensive → nobody ever bribes and the gold sink is
  dead. Step 5 pins it to the actual gold curve.
- **Souls used to bribe.** Direct ARBITRATION S15 violation; automatic fail.
- **`fatigueTerm` stubbed to 1.0.** Kills seam S4's justification for keeping Fatigue as a
  separate out-of-fight bar. If fatigue does not affect persuasion and barter, delete the
  bar or implement it.
- **Persuasion inside combat.** Seam S13: topic lists are locked while `COMBAT` is active.
  An Admire button during a boss fight is Souls-side contamination and an AR-1 fail.
- **Thresholds that gate nothing anyone wants.** Band 5 unlocks a flavour line instead of a
  quest branch, so no player ever climbs past 60. Rule 1 and the "≥1 quest at ≥80" clause
  in step 6 are the defence.
- **Disposition that never falls.** No decay, no crime channel, no weapon-drawn penalty —
  so it ratchets one way and the player ends the game universally beloved.

## Provenance note

- **All formulas in §B, §C and §D are `community-data`, confidence high.** They are
  transcribed from the OpenMW reimplementation, which reproduces Morrowind's behaviour and
  is the most reliable public statement of these equations:
  <https://github.com/OpenMW/openmw/blob/master/apps/openmw/mwmechanics/mechanicsmanagerimp.cpp>
  (`getDerivedDisposition`, `getPersuasionRatings`, `getPersuasionDispositionChange`,
  `getBarterOffer`) and
  `apps/openmw/mwmechanics/creaturestats.cpp` (`getFatigueTerm`).
  Corroborating write-ups: OpenMW's research wiki
  <https://wiki.openmw.org/index.php/Research:Disposition_and_Persuasion> and UESP's
  <https://en.uesp.net/wiki/Morrowind:Disposition> / `Morrowind:Speechcraft`.
- **One documented deviation carried over from OpenMW**: on a *marginal* Intimidate win
  Morrowind does not raise disposition (widely held to be a bug; the Morrowind Code Patch
  fixes it). OpenMW applies `x = iPerMinChange` instead of the original `x = 0,
  y = -iPerMinChange`. **We take the fixed behaviour.** This is noted so a critic comparing
  against raw vanilla does not flag it as a mismatch.
- **The GMST values in §A are `community-data`, confidence medium-high.** They are the
  defaults shipped in OpenMW's Construction-Set-equivalent
  (`apps/opencs/model/world/defaultgmsts.cpp`), which mirror `Morrowind.esm`. Individual
  values could have drifted from the retail ESM; the ones this design leans on hardest
  (`fPerDieRollMult 0.3`, `fPerTempMult 1.0`, `iPerMinChance 5`, `iPerMinChange 10`,
  bribe mods 35/75/150) should be re-verified against a retail ESM dump before shipping if
  anything about persuasion feels off. Note that `fDispCrimeMod` reads **0.0** there, which
  is why §B flags it explicitly rather than silently.
- **Everything in §E — the five bands, the seven binding rules, and `fDispCrimeMod = 0.02` —
  is `constructed`** for this project. Morrowind authors its thresholds per-dialogue-entry
  with no global standard; we need a standard so a critic can test one. Binding
  (CORPUS-CONTRACT §3).
