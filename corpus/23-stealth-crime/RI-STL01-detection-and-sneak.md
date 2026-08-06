---
id: RI-STL01
title: Detection and sneak — light, sound, line of sight, the search, and the seam at the first blow
kind: number
side: split
judges: [stealth.detection.model, stealth.sneak.state, stealth.npc.search, stealth.opener.seam, combat.enemy.perception, progression.skill.gating, quests.resolution.noncombat]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

Two games meet here and the corpus has never said where. Dark Souls has stealth: a crouch, a
sound radius, and a backstab that is one of the best twenty frames in the medium — but it is
stealth *as an opening move*, a way of starting a fight advantageously, and Souls has never
once let you cross a level without fighting. Morrowind has stealth: a Sneak skill, a Chameleon
spell, and the honest promise that if you are good enough at hiding you may simply **not have
the encounter**. That promise is load-bearing for us, because `RI-QST05` puts sneak among the
five verbs that must carry the ≥45% pacifist-completable bar and caps any single verb at 40% of
non-violent resolutions — sneak has to be worth about a fifth of the game's non-combat content
on its own.

**The seam ruling this item exists to make: opening a fight from stealth is Souls; avoiding the
fight entirely is Morrowind. Both must work, and the second must work on 8 of the 13 regions.**

The bar, concretely: a detection model built from light, sound and line of sight that a player
can *read off the world* rather than off a UI meter; a sneak state with a real movement cost; an
NPC search behaviour that is frightening rather than a 12-second timer; and a measured fraction
of the enemy roster that a committed stealth build can walk past. And the constraint that binds
all of it: **per S1 and S3, Sneak gates access and never touches the hit test.** A backstab at
Sneak 20 and a backstab at Sneak 100 have identical frames, identical hitboxes and identical
damage; what differs is whether you were ever close enough to attempt one.

## The reference artifact

### 1. What this item owns, and what it does not

`RI-AI01` §B already defines the perception system: a 0–100 `alert` meter, a ±55° primary sight
cone with ±55°→±100° peripheral and a dead rear arc, hearing spheres at 14 m (sprint) / 6 m
(walk) / 2.5 m (crouch), sight radius `R` per archetype, decay at 12/s, `SUSPICIOUS` at 50,
`AGGRO` at 100. **None of that is re-opened here.** This item owns:

- the **stealth-side multipliers** that scale `RI-AI01`'s fill rates (§2–§4);
- the **sneak state** itself (§5);
- **civilian and guard perception**, which `RI-AI01` does not cover because guards are not
  hostile enemies until you make them so (§6);
- the **search behaviour** that follows losing you, beyond `RI-AI01`'s T04/T06 timers (§7);
- the **seam ruling** and the bypass census (§8–§9).

### 2. The visibility term — light and line of sight

`RI-AI01`'s primary-cone fill rate is multiplied by a **visibility factor** `V ∈ [0.05, 1.30]`:

```
V = clamp( L^0.7 × M × S × E × A , 0.05 , 1.30 )
```

| Term | Meaning | Range | Source |
|---|---|---|---|
| `L` | **light level** at the player's chest node, sampled from the lighting solution | 0.00–1.00 | §3 |
| `M` | **motion**: 0.55 still · 1.00 crouch-moving · 1.45 walking · 2.10 sprinting | 0.55–2.10 | §5 |
| `S` | **Sneak skill**: `1.00 − 0.006 × Sneak`, floored at 0.40 | 0.40–0.97 | `RI-PRG03` §6, adopted verbatim |
| `E` | **equip load band**: 0.90 light · 1.00 medium · 1.25 heavy · 1.55 overloaded | 0.90–1.55 | `RI-PRG07` bands |
| `A` | **silhouette**: 1.00 default; ×0.80 while in cover volume (any collider between chest node and eye node for ≥ 60% of the cone) | 0.80–1.00 | this item |

The same `V` multiplies the **peripheral** cone. It does **not** multiply the instant channels
(damage taken, ally death shout, weapon impact) — nothing hides you from being hit.

**Worked, an INFANTRY enemy (`R` = 16 m) at 8 m, in its primary cone:**

| Player | `L` | `M` | `S` | `E` | `A` | `V` | Fill rate | Time to `AGGRO` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Sprinting, torchlit, heavy armour, Sneak 5 | 0.85 | 2.10 | 0.97 | 1.25 | 1.00 | **1.30** (clamped) | 97.5/s | **1.03 s** |
| Walking, dim, medium, Sneak 5 | 0.35 | 1.45 | 0.97 | 1.00 | 1.00 | 0.339 | 25.4/s | 3.94 s |
| Crouched, dim, light, Sneak 45 | 0.35 | 1.00 | 0.73 | 0.90 | 1.00 | 0.157 | 11.8/s | 8.5 s |
| Crouched, unlit, light, Sneak 45, in cover | 0.06 | 1.00 | 0.73 | 0.90 | 0.80 | **0.050** (clamped) | 3.75/s | **26.7 s** |
| Still, unlit, light, Sneak 100, in cover | 0.06 | 0.55 | 0.40 | 0.90 | 0.80 | 0.050 (clamped) | 3.75/s | 26.7 s |

Two properties fall out of the table and both are deliberate:

- **The floor at 0.05 is a floor, not zero.** You are never invisible to a looking enemy. Stand
  in its cone at 8 m long enough and it finds you in 27 seconds. Stealth buys you *time and
  routes*, not immunity; immunity is what the Veiling school's invisibility is for, and that
  costs Focus and breaks on contact.
- **The ceiling is 1.30, above the naive 1.00.** Sprinting through a lit room in heavy armour
  is *worse* than the baseline the AI item was tuned against. Stealth is a spectrum with a
  penalty end, so that the choice to move loudly is also a choice.

### 3. Light — the world term, and how it is legible

`L` is sampled once per simulated frame at the player's chest node from the same lighting data
the renderer uses, normalised so that:

| Condition | `L` |
|---|---:|
| Direct sun, open marsh, midday | 1.00 |
| Overcast day, open | 0.75 |
| Deep canopy, day (`The Hive`, `Stone Forest`) | 0.30 |
| Torchlit interior, within 4 m of a flame | 0.60 |
| Torchlit interior, 4–9 m from a flame | 0.25 |
| Unlit interior / xanmeer depth | 0.04 |
| Night, open, clear, moons up | 0.22 |
| Night, open, overcast | 0.09 |
| Night, under canopy | 0.04 |
| Carrying a lit torch | **`max(L, 0.80)`** at all times, and the torch itself is a hearing-independent alert source at 18 m |

Two hard requirements follow:

1. **The player must be able to read `L` from the screen, not from a meter.** There is no
   stealth-eye icon, no "hidden/detected" HUD word, no visibility bar (`ui.hud.minimalism`,
   AR-2). The only permitted feedback is diegetic: the enemy's 18-frame head-turn tell at
   `SUSPICIOUS` (`RI-AI01` T02) and its audible grunt. This is Souls' vocabulary and Morrowind's
   restraint agreeing for once, and it means **the lighting artist is a stealth designer**: a
   room whose dark patches are not visibly dark is a broken stealth level.
2. **Light must be extinguishable.** ≥ 60% of placed interior light sources are individually
   extinguishable (snuffed by interaction, by a thrown item, or by the Veiling school's
   `Douse`), they stay out for 90–240 s, and **an NPC who finds a snuffed lamp relights it and
   raises baseline suspicion for that zone** (§7). Stealth in which you can only use the dark
   you were given is a much smaller game than stealth in which you can make it.

### 4. Sound — what the player emits

`RI-AI01`'s hearing spheres are radii for a **medium-load walking human**. This item scales
them:

```
r_effective = r_base × soundScale
soundScale  = E_sound × S_sound × surface
E_sound     = 0.75 light · 1.00 medium · 1.40 heavy · 1.80 overloaded
S_sound     = 1.00 − 0.005 × Sneak, floored at 0.50
surface     = 0.70 mud/moss · 1.00 packed earth/timber · 1.35 stone/tile · 1.60 shallow water · 1.90 dry reed
```

| Movement | `r_base` | Sneak 5, heavy, dry reed | Sneak 100, light, mud |
|---|---:|---:|---:|
| Sprint | 14 m | **36.2 m** | 5.5 m |
| Walk | 6 m | 15.5 m | 2.4 m |
| Crouch-move | 2.5 m | 6.5 m | 1.0 m |
| Still | 0 m | 0 m | 0 m |

**Surface is the term that makes level geometry into stealth content.** The dry-reed boardwalks
of Tidewrack and the tiled floors of the Gideon Provincial Office are loud; the mud under the
Lilmoth stilts is nearly silent. A route through a settlement is a choice of flooring, and that
is a thing a world builder can place.

Three discrete sound events, all unscaled by Sneak because they are not you moving:

| Event | Radius | Alert |
|---|---:|---|
| Landing a drop > 2 m | 12 m | +45 |
| Opening a locked container/door (per pick attempt, `RI-STL02`) | 8 m | +30 |
| Breaking a lockpick | 11 m | +55 |
| Throwing an object (deliberate distraction) | 10 m **at the impact point** | +70 **directed at the impact point**, not at you |

The last row is the only *offensive* stealth tool in the base kit and it is deliberately cheap
and physical rather than a skill check: you throw a thing, the sound happens where it lands,
and the NPC walks toward the sound. A stealth system without a distraction verb is a system in
which the only decision is when to move.

### 5. The sneak state

| Property | Value |
|---|---|
| Input | `crouch` — **requested harness button, see §Comparison method** |
| Movement speed | **0.85 m/s** (walk is 2.0 m/s per S17; sprint per `RI-CMB03`) |
| Stamina | **zero cost**, and stamina regenerates at the normal out-of-combat rate while crouched |
| Camera | unchanged third-person (S18); no over-the-shoulder "stealth cam" |
| Roll | permitted, exits sneak, costs normal stamina |
| Attack from sneak | permitted; a light attack from sneak against an unaware target is a **stealth opener** (§8) |
| Blocked while | in `COMBAT` with any enemy at `alert_state == AGGRO` within 8 m — **you may not crouch your way out of an active fight**, you must break line of sight and let `RI-AI01`'s de-aggro run first |
| Skill accrual | `RI-PRG03` §3: 4 points per 10 s inside a live hostile detection cone; **zero** in an empty room (the Cost Gate) |

**Sneak is free in stamina and expensive in time.** 0.85 m/s against a 2.0 m/s walk means
crossing a 40 m warehouse takes 47 s crouched against 20 s walking, and `RI-WLD01`'s hour-long
world is not padded by it because stealth routes are shorter than the fights they replace.

### 6. Civilians and guards — a second perception model

`RI-AI01` describes enemies. Most detection in this game is by people who are not enemies yet,
and their model differs in three ways.

```
suspicion_fill = base_fill(V, distance, cone)      # RI-AI01 geometry, §2's V
               × raceSuspicion[group][race]        # RI-CHR02 §5, 0.80 … 2.00
               × contextWeight
```

`contextWeight` — what you are doing, not where you are:

| Context | Weight | Threshold crossed at |
|---|---:|---|
| Standing in a public street, weapon sheathed | 0.00 | never |
| Weapon drawn in a settlement | 1.00 | `CHALLENGE` |
| Crouched in a public space | 1.60 | `CHALLENGE` |
| Inside a **trespass zone** (`RI-STL02` §4) | 2.20 | `CHALLENGE` |
| Handling an owned object (`RI-STL02` §2) | 3.00 | **`CRIME`**, see `RI-CRM01` |
| Lockpicking anything | 4.00 | **`CRIME`** |
| Standing over a fresh corpse | 3.50 | **`CRIME`** |
| Wearing an item stolen from *this* NPC | 2.50 | `CHALLENGE`, and a unique line |

Civilian alert states run `CALM → WATCHING(35) → CHALLENGE(70) → ALARM(100)`, not
`IDLE/SUSPICIOUS/SEARCH/AGGRO` — a shopkeeper who sees you crouch does not enter a combat state
machine, they say something. **`CHALLENGE` is a dialogue event**, and it is the last off-ramp:
the NPC speaks, you have ~2.5 s, and Speechcraft, a bribe, a faction token or simply leaving all
resolve it without a crime. `ALARM` is what calls a guard and is owned by `RI-CRM01`.

The **loiter-to-challenge** figures `RI-CHR02` §5 claims fall out of this: in an owned interior
(`contextWeight` 2.20), at 5 m, `L` 0.6, crouched, Sneak 5 — an Imperial player reaches
`CHALLENGE` in **11.3 s**, a Saxhleel in **6.7 s**, a Naga in **4.5 s**. Those three numbers are
the same formula with `raceSuspicion` at 0.80 / 1.35 / 2.00.

### 7. The search — what happens when they lose you

`RI-AI01` T04/T06 give the skeleton (walk to last-known-position; leash after 12 s in SEARCH).
Stealth needs the search to be *worth hiding from*, so this item adds four behaviours, all
observable in a trace:

| # | Behaviour | Specification |
|---|---|---|
| **S-1** | **Last-known-position, then the plausible set** | The searcher walks to LKP, then visits up to **3** nav-mesh cover volumes within 8 m of LKP, in order of "reachable from LKP without crossing the searcher's own cone" — i.e. it checks *where you could have gone*, not random points. |
| **S-2** | **Escalating radius** | Search radius grows 8 m → 14 m → 20 m across the 12 s, then leashes. A player who hides at 10 m and holds still is found; one who keeps moving away is not. Holding still is not a universal answer. |
| **S-3** | **Propagation, bounded** | On entering SEARCH, a searcher raises every ally within 12 m to `alert` 45 — below `SUSPICIOUS`, so the room gets *twitchy* without the whole level aggroing. **One hop only**, never chains (inherits `RI-AI01`'s ally-shout rule). |
| **S-4** | **The zone remembers** | After any SEARCH that ends without acquisition, the **zone's baseline `alert` for all its NPCs is set to 25 for 180 s**, and civilians' `contextWeight` for that zone is ×1.4 for **20 in-game minutes**. Extinguished lights are relit; opened doors are closed; a moved body is found. **This survives leaving and re-entering the zone**, and it is the single behaviour that makes a botched infiltration cost something after the immediate danger passes. |

**S-4 is the item's most important addition and the most likely to be cut**, because it requires
per-zone persistent state that nothing else in the game needs. Without it, a failed stealth
attempt has no consequence beyond a reload, and stealth becomes save-scumming with extra steps.

### 8. **The seam ruling**

> **Opening a fight from stealth is Souls. Avoiding the fight is Morrowind. Neither may delete
> the other.**

**Souls side — the opener.** A light attack landing on a target whose `alert_state` is `IDLE`,
`PATROL` or `SUSPICIOUS`, from within its rear arc (>±100°), is a **stealth opener** and
resolves as `RI-CMB05`'s backstab critical: same animation, same frames, same damage formula,
same `backstab` trace event. The stealth system's *only* contribution is **whether you were in a
position to attempt it**. Explicitly, and this is the AR-1 guard:

1. Sneak **never** modifies backstab damage, frames, i-frames or the critical multiplier.
2. Sneak **never** modifies the rear-arc angle. 100° is 100° at Sneak 5 and at Sneak 100.
3. Sneak **never** produces a to-hit roll, a "detection chance", or a percentage. Every term in
   §2 and §4 is a deterministic continuous quantity evaluated per frame.
4. `RI-PRG03`'s gate stands: **stealth openers require Sneak ≥ 20**, deterministically. Below
   20 the attack is an ordinary light attack from behind — which still hits, because geometry
   decides hits (S1); it just is not a critical.
5. Once the opener lands, **the fight is Souls' and this item has no further authority.** No
   re-entering stealth mid-fight (§5), no stealth damage bonus on subsequent hits, no
   "assassinate" instant kill.

**Morrowind side — the avoidance.** The following must all be true, and each is a measurable in
§9:

- A committed stealth build can traverse ≥ 8 of 13 regions' overworld routes without an `AGGRO`
  transition.
- ≥ 2/3 of the tier-5 (`Stone Wastes`, `Deep Marshes`) roster can be bypassed — the figure
  `RI-PRG02` §5 already claims for the Alchemist-Assassin build, made binding here.
- **Boss arenas cannot be bypassed.** A fog gate is a fog gate (`RI-AI01`: boss aggro is
  arena-wide and trigger-based). Stealth routes around a boss's *arena*, never through it. A
  stealth build that skips a boss has broken S9's lethality gating.
- Every Souls-loop dungeon (S16's eight) has ≥ 1 stealth route past ≥ 40% of its non-boss
  encounters, and every one of the 82 Morrowind caves is fully traversable crouched.

### 9. The bypass census — the numbers a critic computes

| Metric | Definition | Target | Hard fail |
|---|---|---:|---:|
| **REGION-BYPASS** | regions whose main overworld route is walkable end-to-end at Sneak 60 / light load / night with zero `AGGRO` events | **≥ 8 / 13** | < 5 |
| **R5-BYPASS** | share of tier-5 non-boss encounters avoidable at Sneak 80 | **≥ 67%** | < 40% |
| **DUNGEON-ROUTE** | Souls-loop dungeons with a ≥40%-encounter stealth route | **8 / 8** | < 5 |
| **CAVE-CROUCH** | Morrowind caves fully traversable crouched | **82 / 82** | < 70 |
| **BOSS-BYPASS** | bosses skippable by stealth | **0** | ≥ 1 |
| **SNEAK-QUESTS** | quests with ≥1 `method: "sneak"` non-violent resolution | **≥ 22** (≈ 12% of ~180, inside `RI-QST05`'s ≤40% verb-spread cap) | < 10 |
| **OPENER-PURITY** | trace-diff of a backstab at Sneak 20 vs Sneak 100 | **byte-identical except souls/skill-progress fields** | any frame/damage divergence |
| **NO-METER** | stealth HUD elements | **0** | ≥ 1 |
| **DARK-COVERAGE** | share of interior floor area with `L ≤ 0.10` in the 8 Souls-loop dungeons | **≥ 30%** | < 12% |
| **SNUFFABLE** | extinguishable share of placed interior lights | **≥ 60%** | < 25% |

## Comparison method

**Harness extensions required before any of this is runnable** (requested formally, see reply):

- **Button `crouch`** added to `HARNESS.md` §4's closed button set. Without it, no stealth
  scenario is scriptable at all. This is a blocking dependency.
- **Player trace block** `player.stealth`:
  `{"crouched":bool,"light":0.06,"V":0.157,"sound_r_m":2.4,"surface":"mud","in_cover":true}`
- **Enemy trace field** `alert_channel`: `"sight"|"peripheral"|"hearing"|"shout"|"damage"|null`
  — which channel filled `alert` this frame. Without it a critic cannot tell a light failure
  from a sound failure.
- **Civilian trace block** `civilians[]`: `{eid, group, civ_state, suspicion, context_weight}`
  with `civ_state ∈ CALM|WATCHING|CHALLENGE|ALARM`.
- **Trace events** `detect`, `challenge`, `search_start`, `search_end`, `zone_alert`,
  `light_snuffed`, `distraction`.
- **Harness method** `getLightAt(x,y,z): number` — needed to verify §3's `L` table without
  screenshotting, and needed by DARK-COVERAGE.

1. **Formula conformance.** Implement §2's `V` and §4's `soundScale` in a scratch oracle.
   Sweep `L ∈ [0,1]` × `M` (4) × Sneak `[5,100]` × load (4) × cover (2) = 100k cases; dump the
   engine's own `player.stealth.V` at each via `snapshot()`. **Assert exact match to 1e-6 on
   100% of cases**, and **assert the clamps fire** at both ends.
2. **The five worked rows.** `loadState('stl-cone-8m')` spawns one INFANTRY facing the player at
   8 m. For each of §2's five configurations, `traceStart()`, step 3,600 frames, and record the
   frame of first `alert_state == "AGGRO"`. **Assert times within 5% of
   {1.03, 3.94, 8.5, 26.7, 26.7} s.**
3. **Sound radii.** `loadState('stl-hearing-line')`: one INFANTRY, player approaching on each of
   the 5 surfaces at each of 3 movement modes. Binary-search the radius at which `alert` first
   rises with `alert_channel == "hearing"`. **Assert the 15 measured radii are within 8% of the
   §4 formula**, and **assert the dry-reed sprint radius at Sneak 5 / heavy exceeds 30 m** —
   the loud end must actually be punishing.
4. **No proximity leak.** Repeat method 2's scenario with the enemy facing **away** and the
   player crouched, still, unlit, at 1.0 m for 3,600 frames. **Assert `alert` never exceeds 0**
   and no `AGGRO` occurs. If standing behind a stationary enemy in the dark aggros it, the
   model is proximity aggro with extra fields (`RI-AI01` has the same check and it must pass
   with stealth terms active too).
5. **OPENER-PURITY — the AR-1 assertion.** Record one input script that walks to an unaware
   INFANTRY's rear and lands a light attack. Replay it at Sneak 20 and Sneak 100 with identical
   seeds. **Assert `body_sha256` of the two traces differs only in lines containing
   `skill_progress` or `souls`** — i.e. diff the traces field-by-field and **assert
   `player.hitboxes`, `anim_frame`, `phase`, damage values and the `backstab` event payload are
   byte-identical.** Any divergence is Morrowind leaking into the fight = **automatic fail**.
   Then run at Sneak 19: **assert the `backstab` event is absent and a plain `hit` occurs** —
   deterministic gate, no probability (`RI-PRG03` method 7).
6. **Search behaviour.** `loadState('stl-warehouse')`. Script: be seen, break LOS, hide in one
   of four cover volumes. Repeat 4×, once per volume. **Assert S-1**: the searcher visits LKP
   then ≤ 3 cover volumes, and the visited set is a subset of the reachable-without-crossing-own-cone
   set (compute it independently from the nav mesh). **Assert S-2**: measure searcher distance
   from LKP over the 12 s and assert it exceeds 13 m and 19 m at the band boundaries.
   **Assert S-3**: exactly the allies within 12 m reach `alert` 45, none reaches 50, and no
   second hop occurs. **Assert S-4**: after `search_end` with no acquisition, re-enter the zone
   after 60 s of simulated time and **assert baseline `alert` is 25 and any snuffed light is
   relit.** Then re-enter after 200 s and **assert it has decayed to 0.**
7. **No HUD.** `setUIVisible(true)`, screenshot at a canonical viewpoint while crouched at
   `V = 0.05` and again at `V = 1.30`. **Assert the two images are identical outside the
   character's own animation region** — any pixel that changes with detection state is a
   stealth meter and fails NO-METER (AR-2, `ui.hud.minimalism`).
8. **Light audit.** `getLightAt()` sampled on a 1 m grid over all 8 Souls-loop dungeon interiors.
   **Assert ≥ 30% of walkable area has `L ≤ 0.10`.** Then `grep` `game/data/world/interiors/*.json`
   for light records: **assert ≥ 60% carry `snuffable: true`** and harness-verify 20 of them
   actually extinguish and relight.
9. **Bypass census.** For each row of §9, run the named scenario set:
   ```
   node tools/harness/run-headless.mjs --scenario stl-region-traverse-<region> \
        --state "sneak=60,load=light,tod=1.5" --seed 991
   ```
   **Assert zero `AGGRO` events** in ≥ 8 of 13 regions. For R5-BYPASS, enumerate tier-5
   encounters from `game/data/world/pois.json` and script an avoidance route for each;
   **assert ≥ 67% complete with zero `AGGRO`.** For BOSS-BYPASS, script an attempt to reach each
   boss arena's far exit without triggering: **assert 0 succeed.**
10. **Quest verb load.** `node tools/analysis/content-stats.mjs --verb sneak`. **Assert ≥ 22
    quests carry a `method: "sneak"` non-violent resolution**, and cross-check against
    `RI-QST05`'s VERB-SPREAD ≤ 40% — **assert sneak is not itself the ≥40% verb.**

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Formula fidelity | exact on 100k cases, clamps fire | within 1e-4, clamps fire | any term missing (typically light) |
| Light | DARK-COVERAGE ≥ 40%, SNUFFABLE ≥ 75% | ≥ 30% / ≥ 60% | `L` is not sampled at all — stealth is sound-only |
| Sound | 15 radii within 4%, surface term present | within 8% | surface term absent — geometry is not stealth content |
| Search | all four S-behaviours verified, S-4 persists | S-1..S-3 verified, S-4 present | search is a 12 s walk to LKP and nothing else |
| Civilians | full CALM/WATCHING/CHALLENGE/ALARM with a dialogue off-ramp | all four states, off-ramp present | civilians use the enemy state machine |
| **OPENER-PURITY** | traces byte-identical | same | **any divergence → automatic fail of the piece** |
| Bypass | 10+/13 regions, R5 ≥ 75%, 8/8 dungeons | 8/13, ≥ 67%, ≥ 5/8 | < 5 regions — avoidance is not a route through the game |
| BOSS-BYPASS | 0 | 0 | ≥ 1 → S9 broken |
| No meter | 0 HUD elements, verified by pixel diff | 0 | a visibility eye/bar → AR-2 fail |
| Quest load | ≥ 30 sneak resolutions | ≥ 22 | < 10 — `RI-QST05`'s verb spread cannot be met |

**Failure threshold: any axis below 6.** OPENER-PURITY, BOSS-BYPASS and NO-METER are binary.

## How we lose

- **Light is never implemented.** Overwhelmingly the likeliest failure, because `L` requires
  sampling the lighting solution at a world point every frame and Three.js gives you nothing for
  free here — there is no built-in "how lit is this point". A builder will discover this,
  estimate the cost, and ship sound-and-cone stealth "for now". The result plays like a bad
  Skyrim: you crouch, you shuffle, and the world's darkness is decorative. `getLightAt()` is
  requested as a harness method precisely so this cannot be quietly skipped, and DARK-COVERAGE
  fails the item outright if it is.
- **A visibility meter appears.** Someone adds an eye icon "for readability", because the first
  playtester says they cannot tell if they are hidden. It is an immediate AR-2 fail and it will
  be defended as usability. The correct fix for that playtest note is *more legible darkness and
  a clearer head-turn tell*, not a HUD.
- **Detection becomes a dice roll.** "Sneak 60 means a 60% chance to remain unseen, rolled every
  second." This is Morrowind's actual implementation, it is the most natural thing in the world
  to write, and it is banned by S1's spirit and `RI-PRG03`'s determinism gate. It will be
  introduced by whoever ports the Sneak skill and it will feel correct to them because it *is*
  what Morrowind did. Every term in §2 and §4 is continuous and deterministic for this reason.
- **Sneak modifies backstab damage.** The single most tempting AR-1 violation, because "higher
  Sneak = better assassinations" is intuitive and every other stealth game does it. It puts a
  Morrowind skill inside Souls' damage resolution. Method 5's trace diff is the only reliable
  detector; a code read will not find it once it is buried in a damage-modifier list.
- **S-4 is cut and failure has no cost.** Persistent per-zone alert state is unglamorous
  infrastructure that nothing else needs. Without it, being spotted costs you the next thirty
  seconds and nothing more, so the optimal stealth play is to blunder forward and wait out the
  search — which is neither tense nor Morrowind.
- **The bypass is nominally possible and practically not.** Every region has *a* stealth route,
  and each one requires 40 minutes of crouch-walking at 0.85 m/s. Technically REGION-BYPASS
  passes; in practice nobody does it twice. The defence is that stealth routes must be
  *shorter* than the fights they replace, which is a level-design property this item can assert
  (route length) but not fully measure. It should be re-checked by `RI-EXP01`'s playthrough
  critic, not by a script.
- **Stealth deletes the game instead of routing through it.** The opposite failure: at Sneak 80
  a player walks past everything including bosses, and the Souls half of the project — which is
  the half with the brief's hardest requirement — is optional. BOSS-BYPASS = 0 is the hard line
  and the fog gate is the mechanism.
- **Civilians get the enemy state machine.** A shopkeeper enters `SUSPICIOUS` then `AGGRO` and
  attacks you with a moveset. This collapses the entire crime system (`RI-CRM01`) into combat
  and destroys the `CHALLENGE` off-ramp, which is the interaction that makes non-combat
  resolution reachable while you are misbehaving. It is also cheaper to build than a second
  model, which is why it will happen.
- **The `crouch` button never gets added to the harness.** Then none of this is measurable, the
  item scores 0 fail-closed under `HARNESS.md` §5, and it will look like a stealth-design
  failure rather than a tooling one.

## Provenance note

**Every number in this item is `constructed`**: the `V` formula and all its terms, the light
table, the sound scaling, surface multipliers, sneak speed, the civilian state machine and
context weights, the four search behaviours, and every row of the §9 census.

Two terms are **adopted verbatim from other corpus items** and inherit their provenance rather
than re-deriving: the Sneak detection multiplier `1.00 − 0.006 × Sneak` floored at 0.40 and the
Sneak ≥ 20 opener gate (`RI-PRG03` §6, `constructed`); and the entire perception geometry —
cones, hearing spheres, `R` by archetype, decay, thresholds (`RI-AI01` §B, `constructed`). If
either of those items retunes, this one is wrong and must be re-derived, not patched.
`raceSuspicion` comes from `RI-CHR02` §5, also `constructed`.

Structural debts, `canonical-recall`, confidence **medium**: Morrowind's Sneak skill as a
percentage chance evaluated against a detection roll (used here **only** as the negative
example — we deliberately do not reproduce it); Dark Souls' crouch, sound radius and backstab
positional check; and the general "light + sound + LOS" triad from the immersive-sim lineage
(Thief, Dishonored), which is where §2's multiplicative structure comes from and which is
**not** an Elder Scrolls or Souls source — it is named here because pretending otherwise would
be dishonest about where the design came from.

Confidence **medium**. The formula's *structure* I am confident in; the calibration is not
validated against anything. The two figures most likely to be wrong are the 0.05 visibility
floor (26.7 s to detection while sitting in a cone at 8 m may be far too generous once real
level geometry exists) and the 67% R5-BYPASS target, which was inherited from a one-line claim
in `RI-PRG02` §5 rather than derived from an encounter census that does not yet exist.
