---
id: RI-QST08
title: Reward design — the unique-named fraction and non-item rewards
kind: number
side: morrowind
judges: [quests.rewards, quests.rewards.unique, economy.loot, progression.items, world.property]
provenance: community-data
confidence: medium
blind_pair: yes
---

## The bar

Morrowind quest rewards are memorable for one structural reason: they are **finite and specific**. A
quest reward is generally a unique item — armour, clothing, a weapon, or an Artifact — with a unique
appearance and a significant enchantment, and rare equipment exists in very limited quantities, so each
piece is a fact about the world rather than a number from a table [13]. The contrast case is explicit
and is the thing we must not become: Skyrim's leveled quest rewards scale to the player's level at the
moment of handover, which makes the reward a function of *when* you did the quest rather than *what* you
did, incentivises deferring content, and dissolves permanence [13][14]. ARBITRATION S12 already rules
loot to Morrowind — hand-placed, named, weird, no procedural drop tables. This item sets the number.

Beyond items, Morrowind's most durable rewards are not items at all: a rank and the access it carries, a
piece of information that opens a topic, a stronghold you had to build, a person who will now speak to
you. The bar is a **quantified mix**: a hard floor on the fraction of quests granting a unique named
thing, a ceiling on gold-only payoffs, minimum counts for access/information/property/ally rewards, and
an absolute prohibition on any reward whose value is computed from character level.

## The reference artifact

### A. What Morrowind actually pays you in

| Reward class | Morrowind form | Why it is memorable | Our field |
|---|---|---|---|
| Unique named item | Artifacts and one-off enchanted gear with unique appearance and significant enchantments, existing in very limited quantities [13] | It is the only one. Its name is a proper noun. You can point at where you got it | `type: "item", unique_named: true` |
| Faction access | A rank, and with it trainers, merchants, safe beds, guild transport, and a new tier of quest | The reward is *more world* | `type: "access"` / `"faction_rank"` |
| Information | A dialogue topic that now exists everywhere. Knowing a name, a debt, a route | It re-opens content you already walked past | `type: "information"` |
| Property / land | Great House strongholds, which the player must build to advance past Kinsman [7] | You made a place exist and it stays | `type: "property"` |
| Training / service | A trainer who will now take your gold; a healer; a fence | Converts gold into build | `type: "training"` / `"service"` |
| Ally | An NPC who will now talk to you, follow you, or vouch for you | A person is a better reward than a sword | `type: "ally"` |
| Gold | Plain coin. Common for small work, and the *least* memorable | Fine as texture, fatal as the default | `type: "gold"` |

**The anti-pattern, stated for the critic:** a reward scaled to player level [13][14]. Under
ARBITRATION S9 our world does not level-scale at all; under S12 loot is hand-placed. A leveled quest
reward violates both and is an AR-2 auto-fail.

### B. Targets (constructed, binding)

| Metric | Definition | Target | Hard fail |
|---|---|---:|---:|
| **UNIQUE-FRACTION** | quests with ≥ 1 reward where `unique_named == true` | **≥ 40%** of all quests | < 25% |
| UNIQUE-FRACTION (faction, rank ≥ 4) | same, restricted | **≥ 60%** | < 40% |
| UNIQUE-FRACTION (main quest, acts III–V) | same, restricted | **100%** | < 80% |
| UNIQUE-FRACTION (side quests) | same, restricted | ≥ 30% | < 15% |
| **GOLD-ONLY** | quests whose only reward is `type: "gold"` | **≤ 20%** | > 40% |
| **NON-ITEM SHARE** | rewards of type `access`, `information`, `property`, `training`, `service`, `ally` as a share of all reward entries | **≥ 35%** | < 20% |
| INFORMATION rewards | quests granting ≥ 1 `information` reward | ≥ 15% of quests | < 8% |
| PROPERTY rewards | distinct property rewards game-wide | ≥ 4 (one per joinable faction) | 0 |
| ALLY rewards | distinct `ally` rewards game-wide | ≥ 8 | < 3 |
| **UNIQUENESS INTEGRITY** | every `unique_named: true` reward id appears in exactly one quest file and exists in exactly one place in the item data | 100% | any duplicate |
| **RESOLUTION-DIFFERENTIATED** | multi-resolution quests where `on_resolution` differs between ≥ 2 reward entries | ≥ 40% | < 20% |
| **LEVEL SCALING** | rewards whose value references character level | **0** | ≥ 1 |

Supporting rules:

1. **A unique named item must be nameable in one sentence by a player who has it.** Practical test: its
   `name` is a proper noun, it has a property no other item has, and its `id` appears nowhere else in
   the item tables. "Fine Steel Longsword +3" is not unique; a sword with a name and a history is.
2. **Uniqueness is global, not per-quest.** The same reward may not be granted by two quests, and a
   unique item may not also spawn as world loot. This is the check that keeps S12 honest.
3. **Rewards vary by resolution.** If the player can resolve a quest four ways and gets 300 gold every
   time, the branching is cosmetic (RI-QST04 also tests this from the resolution side). At least 40% of
   multi-resolution quests must pay differently depending on the route — and the *non-violent* route
   must not be systematically the poorer one. Specifically: the mean count of `unique_named` rewards on
   non-violent resolutions must be ≥ 0.8 × the mean on violent ones.
4. **Information as reward is real.** An `information` reward must correspond to a topic id that (a)
   exists in the dialogue data, (b) is not otherwise obtainable, and (c) is referenced by at least one
   other quest's `requires.knowledge` or by a merchant/service unlock. Otherwise it is a journal line
   pretending to be a payoff.
5. **Property rewards persist and are placeable.** A stronghold/holding analogue must exist as a world
   location that changes state, per faction (RI-QST03 rank-5 world-state requirement).
6. **Gold is the only currency (S15).** Souls never buy anything, so gold rewards must be tuned against
   the economy in `corpus/20-progression/`, not set arbitrarily per quest.

### C. Reward mix, target shape

| Reward type | Target share of all reward entries |
|---|---:|
| `item` (of which ≥ 55% `unique_named`) | 30% |
| `gold` | 25% |
| `information` | 12% |
| `access` / `faction_rank` | 12% |
| `ally` | 8% |
| `training` / `service` | 8% |
| `property` | 5% |

## Comparison method

```bash
# Headline unique fraction, by category.
jq -s '{
  all: ((map(select([.rewards[]|select(.unique_named)]|length>0))|length)/length*100),
  faction_high: (map(select(.category=="faction" and (.rank_gate.min_rank // 0) >= 4)) as $f
                 | (($f|map(select([.rewards[]|select(.unique_named)]|length>0))|length)
                    / ($f|length) * 100)),
  main_late: (map(select(.category=="main" and .act >= 3)) as $m
              | (($m|map(select([.rewards[]|select(.unique_named)]|length>0))|length)
                 / ($m|length) * 100)),
  side: (map(select(.category=="side" or .category=="hidden")) as $s
         | (($s|map(select([.rewards[]|select(.unique_named)]|length>0))|length)
            / ($s|length) * 100))
}' game/src/data/quests/*.json

# Gold-only quests.
jq -s '{gold_only_pct: ((map(select([.rewards[].type]|unique == ["gold"]))|length)/length*100),
        gold_only: (map(select([.rewards[].type]|unique == ["gold"]) | .id))}' \
   game/src/data/quests/*.json

# Reward type mix and non-item share.
jq -s '[.[].rewards[]] | length as $n
       | {mix: (group_by(.type)|map({type: .[0].type, pct: (length/$n*100)})|sort_by(-.pct)),
          non_item_pct: (([.[]|select(.type != "item" and .type != "gold")]|length)/$n*100)}' \
   game/src/data/quests/*.json

# UNIQUENESS INTEGRITY — a duplicate unique is a contradiction in terms.
jq -s -r '[.[] | .id as $q | .rewards[] | select(.unique_named) | {q: $q, id: .id}]
   | group_by(.id) | map(select(length > 1))
   | .[] | "DUPLICATE unique reward \(.[0].id) granted by \(map(.q)|join(", "))"' \
   game/src/data/quests/*.json
# ...then confirm none of those ids also appear in game/src/data/items/ world-placement tables.

# Resolution-differentiated rewards.
jq -s 'map(select((.resolutions|length) > 1)) as $m
       | {n: ($m|length),
          differentiated: ($m | map(select(
              ([.rewards[] | (.on_resolution // ["*"])] | unique | length) > 1)) | length)}' \
   game/src/data/quests/*.json

# Non-violent routes must not be systematically poorer.
jq -s '[.[] | . as $q | $q.resolutions[] | . as $r
        | {v: $r.violence_required,
           uniques: ([$q.rewards[] | select(.unique_named)
                      | select(((.on_resolution // [$r.id]) | index($r.id)) != null)] | length)}]
       | group_by(.v)
       | map({violent: .[0].v, n: length, mean_uniques: ((map(.uniques)|add)/length)})' \
   game/src/data/quests/*.json

# LEVEL SCALING — must return nothing.
grep -rEn '"(level|player_level|scaled|leveled)"' game/src/data/quests/ game/src/data/items/ || true

# Information rewards must resolve to a real, otherwise-unobtainable topic.
jq -s -r '[.[].rewards[] | select(.type=="information") | .id] | unique[]' \
   game/src/data/quests/*.json
# ...cross-check each against game/src/data/dialogue/topics/*.json for existence and exclusivity.
```

**Blind test (blind_pair: yes).** Present a critic with ten reward descriptions, unlabelled: five real
Morrowind quest rewards, five of ours, stripped of proper nouns that identify the game. Ask which set
they would rather earn and which set they could describe from memory an hour later. If they pick
Morrowind's, ask which specific property distinguished it — that answer becomes an amendment to this
item.

## Scoring

| Band | Condition |
|---|---|
| 9–10 | UNIQUE-FRACTION ≥ 40% overall / ≥ 60% high-rank / 100% late main; gold-only ≤ 20%; non-item share ≥ 35%; zero duplicates; ≥ 40% resolution-differentiated; non-violent routes pay comparably; zero level references |
| 7–8 | UNIQUE-FRACTION ≥ 32%; gold-only ≤ 28%; non-item ≥ 28%; no duplicates |
| 5–6 | UNIQUE-FRACTION ≥ 25%; rewards mostly gold and generic items; information/ally/property present but token |
| 3–4 | UNIQUE-FRACTION 15–25%; every quest pays gold plus an item from a shared table |
| 0–2 | Any level-scaled reward, or unique items duplicated in world loot, or rewards identical across all resolutions everywhere |

**Hard fails:** any reward scaled to character level (AR-2, S9, S12); any `unique_named` id granted
twice or also present in world loot; UNIQUE-FRACTION < 25%; zero `property` rewards; non-violent
resolutions paying < 0.5 × the unique-reward rate of violent ones (which would make the pacifist route
in RI-QST05 a punishment).

## How we lose

- **Gold as the default.** Gold is one integer and needs no art, no name, no placement, and no lore.
  Every quest ships "500 gold" plus a generic item and the UNIQUE-FRACTION lands near 12%. This is the
  overwhelmingly likely failure and it happens by omission, not by decision.
- **Uniques that are not unique.** We name forty items, then place a dozen of them in world loot chests
  as "cool finds", or grant the same amulet from two quests because two designers picked from the same
  list. The integrity check exists because this is invisible in play until someone sees two.
- **Level-scaled rewards for balance.** Somebody adds a scaling multiplier so a late-taken quest is not
  worthless. It is a two-line change, it is exactly Skyrim's mistake [13][14], and it is an auto-fail.
  Under S9 the world does not scale; the correct fix for a trivialised reward is placement, not scaling.
- **Information rewards that inform nothing.** `type: "information"` on a topic that no other quest,
  merchant, or check consumes. It reads as a reward in the data and is a journal line in play. The
  cross-check against `requires.knowledge` is the only thing that catches it, and it is the check most
  likely to be skipped because it spans two areas.
- **No property.** Strongholds/holdings are the single most expensive reward class — a location, a
  build state, a set of NPCs — and the easiest to cut. Cutting them removes the only reward the player
  *made* rather than received, and takes RI-QST03's rank-5 world-state requirement with it.
- **The pacifist tax.** Combat resolutions pay in weapons because that is what fits, so the non-violent
  route quietly pays worse. Then RI-QST05's 45% target is technically met and mechanically punished. The
  0.8× ratio check is specifically aimed at this.
- **Identical payouts across branches.** Four resolutions, one reward block, no `on_resolution`. The
  branching is real in the data and invisible in the hand.
- **Allies who do nothing.** `type: "ally"` on an NPC who says one new line. An ally reward must change
  what the player can do — a new topic, a service, a vouching in a later faction check — or it is
  information with a face.
- **Named items with generic stats.** We give an item a proper noun and a +2. The name is not the
  feature; the *only-one-of-it* and the strange specific property are. If our unique list reads as a
  rarity tier, we have shipped loot with better fonts.

## Provenance note

- `community-data`, verified by search this session: Morrowind quest rewards are generally unique items
  (armour, clothing, weapons) or Artifacts with unique appearances and significant enchantments; rare
  equipment exists in very limited quantities, which is why the items are memorable; Skyrim's quest
  rewards are frequently leveled items scaled to the player's level at handover, creating an incentive
  to defer quests and dissolving permanence [13][14].
- `community-data`: House strongholds as a build-it-yourself reward tied to rank advancement [7].
- **Every number in sections B and C is `constructed`** — no upstream source states what fraction of
  Morrowind's rewards are unique, and I have not measured it. The 40% floor is a bar we set because it
  is measurable and because it forces the authoring cost that produces the effect. Per CORPUS-CONTRACT
  §3 it is fully binding.
- The prohibition on level-scaled rewards is not constructed — it follows directly from ARBITRATION S9
  and S12 and is restated here as a computable check.
- Direct page fetches to uesp.net / fandom were refused by egress policy (403 at proxy); citations are
  to pages read via search summaries. A future wave should count Morrowind's actual unique-reward
  fraction from the Construction Set and, if it is materially above 40%, raise our floor to match.

**Sources**
[7] [Morrowind:House Hlaalu — UESP](https://en.uesp.net/wiki/Morrowind:House_Hlaalu) ·
[13] [Morrowind:Quest Items — UESP](https://en.uesp.net/wiki/Morrowind:Quest_Items) ·
[14] [Skyrim:Leveled Item Quests — UESP](https://en.uesp.net/wiki/Skyrim:Leveled_Item_Quests)
