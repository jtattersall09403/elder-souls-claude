---
id: RI-STL02
title: Theft — ownership of every object, the lock ruling, pickpocketing, trespass, and the fence economy
kind: number
side: morrowind
judges: [stealth.theft.ownership, stealth.theft.pickpocket, stealth.lock.picking, stealth.trespass.zones, stealth.fence.economy, world.property.ownership, world.locks.security, progression.gold.economy]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

Morrowind's greatest quiet achievement is that **every object in the world belongs to
somebody**. Not "loot containers are unowned and houses are locked" — every fork, every
cheap-shirt, every ash yam on a shelf in a stranger's kitchen has an owner string, and picking
it up in front of that owner is a crime with a price. That single data field is what makes
Morrowind's world feel inhabited rather than dressed: the difference between a room full of
props and a room full of *someone's things* is one field on every object and one line of
checking code, and almost no game has ever paid for it.

Dark Souls has no ownership model at all, because nothing in Lordran is anybody's. This is
entirely outside the fight, so Morrowind wins outright and the bar is Morrowind's: **100% of
takeable objects owned, a real trespass model, a lockpicking system, a pickpocket system, and a
fence economy that makes theft a viable route through the game's gold curve without making it
the optimal one.**

And one thing this item must rule rather than inherit. Seam **S1** bans to-hit dice *inside the
fight*. Lockpicking is outside it, so S1 does not reach it, and the question is genuinely open:
**does lockpicking keep a probability roll?** §3 rules that it does not, and argues it rather
than asserting it, because the opposite answer was defensible and the corpus should show its
work.

## The reference artifact

### 1. Ownership — the field on every object

Every entity in `game/data/items/**` and every placed instance in
`game/data/world/interiors/*.json` carries:

```jsonc
{
  "id": "cup_tin_03", "instance": "gideon_ledger_house_k12",
  "owner":       "npc:ollo-vantine" | "faction:wet-ledger" | "settlement:gideon" | null,
  "owner_scope": "personal" | "shared" | "public",
  "value_g":     4,
  "unique":      false,          // named, hand-placed, one in the world (S12)
  "stolen_from": null            // set at runtime when taken while owned
}
```

| `owner_scope` | Meaning | Taking it is |
|---|---|---|
| `personal` | one NPC's possession | **theft**, always, seen or not |
| `shared` | a faction's or household's stock | **theft** unless you hold rank ≥ 2 in that faction / live there |
| `public` | placed in a commons — a well bucket, a temple offering bowl, a shrine's flowers | **theft only if observed**; unobserved it is petty and generates no `stolen_from` |
| `null` | genuinely unowned — wilderness, ruins, corpses of hostiles, the eight Souls-loop dungeons | free |

**Coverage requirements (the item's headline data claim):**

| Metric | Target | Hard fail |
|---|---:|---:|
| Takeable placed objects carrying a non-absent `owner` field | **100%** | < 100% |
| Placed objects inside settlements with `owner != null` | **≥ 92%** | < 75% |
| Distinct `owner` strings across the world | **≥ 240** | < 100 |
| Interiors where every object shares one owner string | **≤ 15%** | > 40% |

The last row is the one that catches a lazy pass: a builder who sets
`owner: "settlement:gideon"` on every object in Gideon has technically achieved 100% coverage
and has built a world where nothing belongs to a *person*. Morrowind's fork belonged to a named
Dunmer with an address.

### 2. Theft — the act, and what it costs

Taking an owned object resolves through `RI-STL01` §6's civilian model at `contextWeight 3.00`.

| Situation | Result |
|---|---|
| Taken, **not observed** | Item enters inventory with `stolen_from` set. No bounty. No disposition change. **The owner notices on their next schedule tick at that location** (`world.npc.population`) if `value_g ≥ 25`, and adds a topic: *"Something of mine is gone."* |
| Taken, **observed** by anyone | `CRIME` event → `RI-CRM01`. Bounty = §5. Owner disposition `−0.5 × value_g` (`fDispStealing`, `RI-DLG04` §A, adopted verbatim). |
| Taken, observed **only by the owner**, `value_g < 10` | `CHALLENGE`, not `CRIME`. They tell you to put it back. Putting it back within 8 s clears it entirely. |
| Owned object **in your inventory**, shown to its owner in barter or dialogue | Unique dialogue; disposition `−25`; owner may demand it back or call a guard depending on `RG` group |

**`stolen_from` is permanent and travels with the item**, including through containers, drops,
and gifting to NPCs. It is cleared by exactly two things: fencing (§6), and the owner's death —
which is `RI-CRM01`'s S10 problem and is *deliberately a working strategy with a large cost*.

### 3. **THE LOCK RULING** — no probability roll, and why

> **Ruled: lockpicking does not keep a probability roll. There is no per-attempt success
> chance, no hidden die, and no retry loop that converges on success. Locks are opened by a
> deterministic, skill-gated, input-expressive interaction, and a lock you cannot open stays
> shut until your Security is higher or you find another way in.**

#### 3a. The argument for a roll (which we reject, stated fairly)

1. **S1 does not reach here.** The Arbitration Rule bans to-hit dice *inside the fight*.
   Lockpicking is outside it, Morrowind is authoritative outside it, and Morrowind's lockpicking
   is a `chance = (pickQuality × Security + Agility/5 + Luck/10) × fatigueTerm − lockLevel×...`
   roll. A strict reading of ARBITRATION §1 would hand this to Morrowind, dice and all.
2. **Dice are a real texture.** Morrowind's world *feels* uncertain partly because its verbs
   are. Removing every roll from the game removes something, and a corpus that only ever
   subtracts Morrowind's randomness is quietly building Dark Souls with a wider stat sheet.
3. **A roll gives failure a cheap home.** `RI-PRG03` §3's budget assumes ~170 failed pick
   attempts across a playthrough, each consuming a pick and granting 6 skill points. A
   probability roll produces those failures for free.

#### 3b. Why we rule against it anyway — four reasons, in order of weight

1. **A retry-able roll is not a gate; it is a tax on time.** This is decisive. A lock can be
   attempted repeatedly at no cost but lockpicks and seconds, so a 12%-per-attempt chance is not
   a 12% chance of opening the lock — it is a **100% chance of opening the lock after an average
   of 8 attempts**. The roll therefore gates nothing. It converts a design decision ("is this
   character good enough to get in here?") into a stamina-free clicking exercise, which is
   precisely and famously Morrowind's worst-remembered interaction. The corpus already knows
   this: `RI-PRG03` "How we lose" names *"Lockpicking has a success chance based on skill"* as
   the single most natural way to reintroduce Morrowind's dice, and its method 7 asserts
   100/100 failure below the threshold and 100/100 success at it. **This item is bound by that
   precedent and would be re-litigating a decided seam if it ruled otherwise** (ARBITRATION §5
   precedence, rung 3).
2. **A roll destroys the Security tier table.** `RI-PRG03` §6 ships five lock tiers with hard
   Security *and* AGILITY requirements, and 11 tier-5 locks each sealing a named hand-placed
   item (S12). If a roll exists, a Security-20 character opens a tier-5 lock eventually, and
   the entire tier structure — which is the thing that makes investing in Security a *build*
   decision rather than a patience decision — evaporates.
3. **The whole project runs on deterministic verbs.** Souls' hit resolution is geometry (S1);
   `RI-PRG03`'s gates are deterministic; `RI-STL01`'s detection is a continuous per-frame
   quantity with no roll; `RI-DLG04`'s persuasion is the *one* place we deliberately kept a
   die, and it is kept there because persuasion's failure is interesting (disposition is lost,
   permanently, and you cannot retry your way out of it). Lockpicking's failure has no such
   cost. **Keep the die where failure is permanent; delete it where failure is a retry.** That
   is the general rule this ruling establishes, and it is the reason the two answers differ.
4. **Determinism is measurable and dice are not.** `HARNESS.md` D5 requires byte-identical
   traces. A seeded roll satisfies the letter of that and defeats its purpose: a critic
   verifying "can a Security-40 character open a tier-4 lock" gets a different answer per seed
   and must resort to statistics over 1,000 trials to state a design fact. `RI-PRG03` method 7
   is written as a 100/100 assertion because that is what a *design* fact looks like.

#### 3c. What replaces it — the ward-collar

The interaction must still be a **skill**, or we have replaced a die with a button. Locks in
Argonia are **ward-collars**: a rotating brass collar with `N` internal wards, each of which
binds at one angle. You feel for the bind and set it.

| Tier | Name | Wards `N` | Security req | AGILITY req | Picks consumed per attempt | Count in world |
|---:|---|---:|---:|---:|---:|---:|
| 1 | simple | 1 | 0 | 10 | 1 | ~410 |
| 2 | sturdy | 2 | 20 | 18 | 1 | ~230 |
| 3 | warded | 3 | 40 | 26 | 2 | ~120 |
| 4 | masterwork | 4 | 60 | 38 | 2 | ~48 |
| 5 | sealed | 5 | 80 | 50 | 3 | **11** |

*(Tier requirements and pick costs are `RI-PRG03` §6 verbatim; ward counts and world counts are
this item's.)*

```
Below the tier's Security OR AGILITY requirement:  the interaction is not offered.
   The prompt reads "you do not know this kind of lock" and no pick is consumed.
   This is RI-PRG03's deterministic gate and it is absolute.

At or above both requirements:
   collar_rate      = 90 °/s, constant, never randomised
   ward_angle[i]    = fixed per lock instance, authored in the interior data, never generated
   tell             = the pick visibly flexes and the audio changes 0.25 s (22.5°) before centre
   tolerance W      = clamp( 4 + 0.55 × (Security − req_tier), 4, 34 ) degrees, centred on ward_angle[i]
   press inside W   -> ward set, permanently, for this attempt
   press outside W  -> ONE PICK BREAKS, sound event r=11 m alert +55 (RI-STL01 §4), ward resets
   sweeps allowed   = 3 per ward
   all N wards set  -> open, permanently, for the rest of the game
```

| Security | Tier-3 lock (`req` 40) | `W` | Window duration at 90°/s | Feels like |
|---:|---|---:|---:|---|
| 40 | at requirement | 4.0° | **44 ms** (2.7 frames at 60 Hz) | brutal — three wards, three near-frame-perfect inputs |
| 55 | +15 | 12.3° | 137 ms (8.2 f) | tight |
| 70 | +30 | 20.5° | 228 ms (13.7 f) | comfortable |
| 100 | +60 | 34.0° (clamped) | 378 ms (22.7 f) | trivial, as mastery should be |

**Why this is not a die in disguise:** the ward angles are authored per lock instance and fixed
forever, the collar rate is constant, the tell is deterministic, and the same input sequence
always produces the same result. A player who fails is a player who mistimed a press, and a
player who repeats the exact input succeeds. The uncertainty lives in the human, which is where
Souls puts it, while the *gate* lives in the skill, which is where Morrowind puts it. **This is
the same reconciliation S1 makes for swings, applied to a door.**

**Where the 170 failures in `RI-PRG03` §3's budget come from:** mistimed presses at low
Security against high-tier locks, at 3 sweeps per ward. They still consume picks and still grant
6 progress points. Nothing in the progression budget changes.

**Three consequences that must be built:**

- **`interact` is the press.** No new button (`HARNESS.md` §4's set is closed). Collar rotation
  is automatic; the player only times.
- **Every ward angle is authored data.** `interiors/*.json` carries `ward_angles: [deg,...]` per
  lock instance. Procedurally generated angles would be a die by another name and are banned.
- **Locks are never the only way in.** `RI-PRG03` method 8: every tier-4 and tier-5 lock has
  ≥ 1 alternate route (a key on a named NPC, a window, a `Veiling`/`Warding` open-lock spell
  per S19, a bribe, a quest, or a wall that can be broken). **11/11 tier-5 locks and 48/48
  tier-4 locks must have a documented second route.**

#### 3d. What about the Open spell?

S19 makes utility magic first-class outside the fight, and an open-lock spell is the canonical
example. Ruled: an **`Unbind`** spell exists at Sorcery tiers 2/3/4/5 opening lock tiers 2/3/4/5
respectively, **deterministically, with no roll and no interaction** — it is the alternate route
for characters who invested elsewhere, it costs Focus, and it is strictly *more* expensive per
door than picking. It does not work on the 11 tier-5 locks' *quest* variants (4 of the 11),
which need the key, because a spell that opens everything is a level-design solvent (S19).

### 4. Trespass — being somewhere that is not yours

A **trespass zone** is any interior or bounded exterior volume with an `owner` and a schedule.

| Zone class | Trespass when | `contextWeight` (`RI-STL01` §6) | Escalation |
|---|---|---:|---|
| **Shop, open hours** | never (public) | 0.00 | — |
| **Shop, closed** | always | 2.20 | `CHALLENGE` → `ALARM` → guard |
| **Private dwelling** | always, unless invited by quest flag | 2.20 | as above |
| **Faction interior** | unless rank ≥ 1 in that faction | 2.20 | as above, **plus** expulsion risk (`quests.faction.expulsion`) |
| **Legion / Provincial Office restricted** | always | **3.00** | straight to `ALARM` on sight, no `CHALLENGE` |
| **Rootkeeper sapwell precinct** | non-Argonian without rootkeeper disposition ≥ 60 | 2.20 | no guards; **the well refuses you** — you cannot rest there for 24 in-game hours. A checkpoint denied is worse than a bounty. |
| **Blackrose Prison** | always | 3.00 | capture, not bounty (`RI-CRM01` §7) |

**Being inside a trespass zone is not itself a crime and generates no bounty.** It generates
suspicion, and the crime is what a witness reports (`RI-CRM01`). This distinction matters: it
means walking into an unlocked house is a *social* event with an off-ramp, exactly as it is in
Morrowind, and only stealing or fighting there escalates it.

**Coverage:** ≥ **180** trespass zones across the eight settlements, ≥ 14 per settlement, with
≥ 3 distinct zone classes per settlement.

### 5. Pickpocketing

Same ruling, same reasons: **no roll.**

```
Eligible when:  target's civ_state == CALM, you are crouched, within 1.4 m,
                inside the target's rear arc (>±100°, RI-AI01 §B), and stationary.
Offered slots:  visible inventory only -- what an NPC is CARRYING, not their whole sheet.
                Slot count = clamp( 1 + floor((AGILITY - 10) / 8), 1, 6 )
                Item weight ceiling = 0.5 kg + 0.25 kg per point of Sneak above 20
Duration:       a hold of `interact` for  T = 2.60 - 0.014 x Sneak  seconds, floored at 0.90 s
During T:       the target's suspicion fills at 3x contextWeight (RI-STL01 §6).
                Release early -> nothing taken, nothing lost, no crime.
                Complete T    -> item taken, `stolen_from` set.
                Target's suspicion reaching CHALLENGE during T -> caught: CRIME,
                fDispPickPocketMod -25 (RI-DLG04 §A), bounty per §6.
```

The interaction is therefore a **held-breath commitment window**, which is the Souls grammar
(a committed action you cannot cancel profitably) applied to a Morrowind verb. Whether you get
away with it is fully determined by geometry, light, Sneak and how long you held — no die at
any point.

**Equipped items cannot be stolen.** A guard's weapon and armour are not pickpocketable, because
the alternative is a game where the answer to every Legion patrol is to undress it.

**Ceiling:** at Sneak 100 / AGILITY 60, `T` = 1.20 s, 6 slots, 20.5 kg ceiling. At Sneak 5 /
AGILITY 10, `T` = 2.53 s, 1 slot, 0.5 kg — you can steal a key, and that is the point: the
lowest-skill pickpocket is still the solution to exactly one puzzle, which `RI-QST05` counts.

### 6. Fencing — where stolen goods actually go

A merchant refuses any item whose `stolen_from` resolves to an NPC in **their settlement**, or
to **their faction**, or to any NPC whose disposition toward them is ≥ 60 — and says so, by
name. That refusal is the whole reason fences exist.

| Property | Value |
|---|---|
| **Fences in the world** | **9** — Lilmoth rot-quarter (2), Gideon docks, Archon salvage yard, Soulrest (attached to the Drowned Court), Stormhold outside-the-wall market, Blackrose, and 2 itinerant (a barge factor, a Sap-Cutter) |
| **Access** | Mercantile ≥ 25 **or** an introduction from a quest **or** Thieves-network rank ≥ 1. Never race-gated. |
| **Price paid** | `0.35 × value_g × mercantileTerm(player) × fenceGreed` where `fenceGreed ∈ [0.85, 1.10]` per fence, authored |
| **vs legitimate sale** | legitimate sell multiplier tops out at `0.60×` (`RI-PRG05`); a fence at Mercantile 100 pays ≈ `0.35 × 1.71 × 1.0 = 0.60×` — **the best fence in the game, at maximum skill, pays what an honest merchant pays a mediocre character** |
| **Gold pools** | 400–2,600 g, refreshing every 3 in-game days (`RI-PRG05` merchant-pool rules) |
| **`stolen_from` clearing** | fencing clears it. The fence's own inventory retains a hidden `laundered_from` used by exactly 3 quests. |
| **`unique: true` items** | a fence will buy a named hand-placed item **once**, at `0.20×`, and it **generates a bounty of `0.5 × value_g` 3 in-game days later** in the settlement it was stolen from, because named things are recognised. Fencing the Full Root Chalice is a decision, not a transaction. |

**The economic claim, and it is the point of the whole section:** `RI-PRG05` puts lifetime
income at 98,000 g against 62,100 g of necessary sinks. A dedicated thief must be able to reach
that income by theft, and must not beat it by much.

| Route | Modelled lifetime gold | vs baseline |
|---|---:|---:|
| No theft at all (combat + quests + selling loot) | 98,000 | — |
| Casual theft (opportunistic, ~200 items) | 111,000 | +13% |
| **Dedicated thief** (Security 80, Sneak 80, Mercantile 70, ~900 items, 4 fences worked) | **127,000** | **+30%** |
| Dedicated thief, if fences paid `0.60×` | 168,000 | +71% — **the failure case** |

+30% is the target: theft is a real economic strategy, it funds a build that cannot fight well,
and it does not trivialise a 215,000 g total price-of-everything. The `0.35×` base rate is
reverse-engineered from that target and should be re-derived if `RI-PRG05` retunes.

## Comparison method

**Harness extensions required** (see also `RI-STL01`): trace events `theft`, `pickpocket`,
`lock_attempt`, `lock_open`, `pick_break`, `trespass_enter`, `fence_sale`; a `lock` block in
the player record `{"tier":3,"wards":3,"set":1,"collar_deg":214.5,"W_deg":12.3}`; and a harness
method `listOwnedObjects(interiorId): [{instance, owner, owner_scope, value_g}]`.

1. **Ownership coverage.** `node tools/analysis/content-stats.mjs --facet ownership` over
   `game/data/world/interiors/**` and `items/**`. **Assert 100% of takeable placed objects have
   an `owner` key present** (may be `null`); **assert ≥ 92% of settlement-interior objects have
   `owner != null`**; **assert ≥ 240 distinct owner strings**; **assert ≤ 15% of interiors are
   single-owner.** Print the histogram of objects per owner — a long tail is the signal, a
   spike at one string is the failure.
2. **Ownership is enforced, not just declared.** Harness: `loadState('gideon-ledger-house')`,
   `listOwnedObjects`, take 20 of them unobserved. **Assert all 20 carry `stolen_from` in
   `saveState()`**, and that the value survives a `saveState`/`loadState` round trip. Then take
   one observed. **Assert a `theft` event and a `crime` event fire in the same frame.**
3. **LOCK DETERMINISM — the ruling's assertion.** For a tier-3 lock at Security 40:
   - Replay one identical input script 100 times at 100 different seeds. **Assert 100/100
     identical outcomes and identical `body_sha256`.** A single differing outcome means a die is
     present and the item **fails outright.**
   - At Security 39 (below `req`): **assert the interaction is never offered, 100/100, and zero
     picks are consumed.**
   - At Security 40 with a deliberately mistimed script: **assert 100/100 failures.**
   - `grep -rn "random\|rng\|Math.random" ` in the lock module: **assert zero draws** appear in
     the trace's `rng.draws` delta across a full lock interaction — the counter must not move.
4. **Tolerance curve.** For Security ∈ {40, 55, 70, 100} against a tier-3 lock, read
   `player.lock.W_deg` from `snapshot()`. **Assert {4.0, 12.3, 20.5, 34.0} ± 0.1°** and
   **assert the clamp holds at Security 140** (hypothetical) at exactly 34.0.
5. **Ward-angle authoring.** `jq` all `ward_angles` arrays out of `interiors/*.json`.
   **Assert every lock instance has exactly `N` angles for its tier**, **assert the multiset of
   angles across the world is not uniform-random** (χ² against uniform over 10° bins, p < 0.01
   required — authored data clusters, generated data does not), and **assert two locks of the
   same tier in the same interior do not share an identical angle vector.**
6. **No-lockout audit.** For all 59 tier-4 and tier-5 locks: **assert each has ≥ 1 documented
   alternate route** in its data record (`alt_routes: [...]`), and harness-verify a sample of 10
   by executing the alternate. **Assert the 4 quest-variant tier-5 locks reject `Unbind`.**
7. **Pickpocket determinism and geometry.** 100 identical scripted pickpockets at 100 seeds:
   **assert 100/100 identical.** Then sweep: at 1.5 m (outside 1.4 m) **assert not offered**; at
   ±99° (inside the rear-arc boundary) **assert not offered**; while walking **assert not
   offered**. **Assert `T` matches `2.60 − 0.014 × Sneak` within 1 frame at Sneak ∈ {5, 45, 100}.**
   **Assert equipped items never appear in the slot list**, over 200 sampled NPCs.
8. **Trespass census.** From `interiors/*.json`: **assert ≥ 180 zones with an `owner` and a
   `schedule`, ≥ 14 per settlement, ≥ 3 distinct classes per settlement.** Harness: enter a
   closed shop and stand still. **Assert `trespass_enter` fires, `contextWeight` reads 2.20,
   `CHALLENGE` precedes `ALARM`, and no bounty accrues before `ALARM`.** Enter a Legion
   restricted room: **assert `ALARM` fires with no `CHALLENGE`.** Enter a sapwell precinct as a
   Nord at rootkeeper disposition 30: **assert the rest interaction is refused for 24 in-game
   hours and that no bounty is generated.**
9. **Fence economics.** For all 9 fences: **assert the refusal rule fires** — offer each fence
   an item stolen from its own settlement and **assert refusal with a by-name line**; offer a
   legitimate merchant the same **assert refusal**. **Assert paid price matches
   `0.35 × value × mercantileTerm × fenceGreed` within 1%.** **Assert the best achievable fence
   multiplier at Mercantile 100 is in [0.58, 0.62].** Fence a `unique` item and **assert a
   bounty of `0.5 × value_g` appears in that settlement exactly 3 in-game days later.**
10. **The economy claim.** Run `tools/analysis/economy-model.mjs --profile thief` over shipped
    item values, fence rates and world object counts. **Assert modelled dedicated-thief lifetime
    gold is in [118,000, 136,000]** — inside `RI-PRG05`'s frame, +20% to +40% over baseline.
    Below 110,000 theft is not a strategy; above 145,000 it is the only one.

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Ownership coverage | 100% field, ≥ 95% owned in settlements, ≥ 320 owners | 100% / ≥ 92% / ≥ 240 | < 100% field coverage, or ≤ 30 owner strings |
| Ownership enforcement | persists through save, containers, gifting | persists through save | `stolen_from` declared and never read |
| **Lock determinism** | 100/100 identical, `rng.draws` unmoved | same | **any variance across seeds → item fails outright** |
| Lock skill expression | curve exact, 5 tiers, authored angles pass χ² | within 0.5°, angles authored | one-button "open" — a die replaced by nothing |
| No lockout | all 59 high locks with ≥ 2 alternates | ≥ 1 alternate each | any lock is the only route to content |
| Pickpocket | deterministic, all geometry gates fire, equipped excluded | deterministic, gates fire | a percentage chance, or full-inventory access |
| Trespass | ≥ 220 zones, all 7 classes present | ≥ 180 zones, ≥ 5 classes | trespass = instant bounty with no `CHALLENGE` |
| Fencing | 9 fences, refusal by name, unique-item bounty built | 6 fences, refusal enforced | stolen goods sellable anywhere |
| Economy | thief route +20–40% | +15–45% | +>70% (theft is optimal) or +<5% (theft is decorative) |

**Failure threshold: any axis below 6.** Lock determinism is binary and is the ruling this item
exists to make.

## How we lose

- **Ownership is declared and never read.** The `owner` field ships on every object, content
  stats pass at 100%, and the take-verb never checks it because checking it requires the
  witness system, which requires the crime system, which is a different item. The world looks
  owned in the data and is free in the hand. Method 2 is the only check that catches this, and
  it must be run in the harness rather than by grepping for the field.
- **One owner per building.** The cheapest way to hit 92% coverage. It passes every count and
  produces a world where stealing from a house is stealing from "Gideon" — no name, no face, no
  disposition hit that means anything, no NPC who notices their thing is gone. The ≤15%
  single-owner-interior assertion is deliberately strict for this reason.
- **The roll comes back.** Not as a lockpicking chance — that is now explicitly ruled out and a
  builder will know it — but as a *critical failure chance* on the pick, or a "Luck affects
  whether the pick breaks", or a small random jitter on the collar rate "so it doesn't feel
  robotic". Every one of those is the die returning through a side door, and method 3's
  `rng.draws` assertion is written to catch all three at once: **the RNG counter must not move
  during a lock interaction at all.**
- **The ward-collar is replaced by a button.** The genuinely hard part of this ruling is that
  removing the die obliges us to build an *interaction*, and building an interaction is a week
  of work with animation, audio, camera and input in it. The path of least resistance is
  `if (security >= req) open()`, which is deterministic, passes method 3 perfectly, and turns
  the most-used verb in the thief build into a keypress. Method 4's tolerance curve is the
  defence and it must be measured, not read.
- **Ward angles get generated.** `angle = rng(seed + lockId)` is deterministic per lock, passes
  method 3, and is one line instead of authoring 819 angle vectors. It fails method 5's χ²,
  and it should, because hand-authored locks are how a designer makes *this* door in *this*
  house feel like a specific obstacle — which is the S12 hand-placement principle applied to
  locks.
- **Fences pay too well.** `0.35×` feels punitive next to a merchant's `0.60×` and somebody will
  raise it. At `0.60×` the thief route yields +71% lifetime gold, every other economic strategy
  becomes irrelevant, and `RI-PRG05`'s 45.6% affordability figure — which is what makes gold
  matter at all — collapses. Method 10 is the guard and its upper bound is as important as its
  lower one.
- **Unique items are fenceable for free.** The 3-day delayed bounty on a named item is fiddly
  (a timer, a settlement reference, a bounty source that is not a witness) and it is the only
  thing stopping "steal the 11 tier-5 items, fence them, buy the game". It will be cut as an
  edge case.
- **Trespass becomes instant crime.** Merging trespass into the bounty system is simpler than
  routing it through `RI-STL01`'s `CHALLENGE` state, and it deletes the off-ramp — walking into
  a house by mistake becomes a fine, players stop entering buildings, and half the world's
  interiors go unvisited. Morrowind let you wander into anyone's home and be *told off*, and
  that is a completely different world to live in.
- **The sapwell precinct rule is dropped.** "A checkpoint you are refused" is a strange and
  expensive interaction, it touches the S7/HEARTH system that another item owns, and it will
  look like scope creep. It is also the single best thing in §4, because it is a punishment
  that costs a foreign player something Souls players actually fear and that no bounty can
  express.

## Provenance note

**Everything in this item is `constructed`**: the ownership schema and coverage targets, the
ward-collar interaction and every one of its numbers, the pickpocket formula, the seven trespass
classes, the nine fences, the `0.35×` rate, and the economy model.

Values **adopted verbatim from other corpus items**, inheriting their provenance: the five lock
tiers with their Security/AGILITY requirements and pick costs (`RI-PRG03` §6, `constructed`);
`fDispStealing = −0.5/gold` and `fDispPickPocketMod = −25` (`RI-DLG04` §A, `community-data` —
these two are genuine Morrowind GMST values); the `0.60×` legitimate sell ceiling and the
98,000/62,100/215,000 gold frame (`RI-PRG05`, `constructed`); the rear-arc geometry and hearing
radii (`RI-AI01`/`RI-STL01`).

The **lock ruling in §3 is a ruling, not a recollection.** Its factual premises about
Morrowind — that lockpicking used a per-attempt probability formula involving Security, Agility,
Luck, pick quality and fatigue, retry-able at the cost of picks — are `canonical-recall`,
confidence **medium**, and the exact formula is deliberately not reproduced here because I
cannot verify it. The ruling does not depend on the formula's details: it depends only on the
retry-ability, which is not in dispute.

**Requested amendment:** ARBITRATION §2 currently has no seam for out-of-fight randomness.
§3b establishes a general principle — *keep the die where failure is permanent, delete it where
failure is a retry* — which cleanly explains why persuasion (`RI-DLG04`) keeps its roll and
lockpicking loses its. I propose this as a new seam ruling ~~**S20**~~ **— ADOPTED wave 0 as
ARBITRATION seam S21**, not S20: S20 was already taken by era authority (Morrowind-era sources
win over 2E/ESO). Renumbered by the corpus audit. I flag it in my reply
rather than editing `ARBITRATION.md`.

Confidence **medium**. The determinism ruling I hold with high confidence; the *calibration* of
the ward-collar is unvalidated and the number most likely to be wrong is the 4° minimum
tolerance — a 44 ms window at 60 Hz is roughly a Souls parry, which may be far too demanding for
a verb performed hundreds of times outside combat, and the first playtest should be allowed to
raise the floor without reopening the ruling.
