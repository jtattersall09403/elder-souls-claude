---
id: RI-MAG01
title: Combat casting — cast frames per weight class, the Focus/stamina dual cost, commitment, and spell geometry
kind: number
side: souls
judges: [combat.magic.casting, magic.casting.frames, magic.casting.resource, magic.casting.commitment, magic.casting.geometry, magic.casting.enemy]
provenance: constructed
confidence: high
blind_pair: yes
---

> **Seam S19, first half.** *Inside the fight, Souls owns casting.* This item is written to
> the same standard as `RI-CMB02` (attack frame data) and is subordinate to `RI-AI02`
> (telegraph doctrine) and `RI-CMB03` (stamina economy). Every AR-1 automatic-fail in those
> items applies here verbatim, with casting substituted for swinging. It fills the declared
> corpus hole `combat.magic.casting`.

## The bar

A spell is an attack. It has a startup you cannot take back, an active window in which a
piece of geometry exists in the world, and a recovery tail during which you are a target.
The player must be able to read an enemy's cast off its body — which spell, and roughly
when — with the same lead time RI-AI02 grants a sword, and the player's own casts must cost
them the same thing a sword costs them: a bet that the next second belongs to them. "Good"
means a caster in this game is playing Dark Souls, not playing a menu: no pause, no dice, no
cast-cancel, no free re-aim after commitment, no instantaneous escape, and no spell whose
outcome is decided by a random number. It also means casting is *not* free tempo. The single
most likely way this fails is a build where casting costs only a blue bar, so the correct
play is to cast and immediately roll, and magic becomes strictly better than every weapon in
the game because it is the only action that does not mortgage your defence.

Above all: **magic never restores the die that S1 abolished.** No to-hit roll, no magnitude
range, no proc chance, no resist roll, no spell failure chance. A spell that could miss
because of a number is Morrowind leaking into the fight and is an automatic fail of the
piece.

## The reference artifact

### A. The resource ruling — Focus *and* stamina, and why both

**RULING (binding): a cast spends BOTH resources, and they mean different things.**

| Resource | What it is | Spent | Refilled |
|---|---|---|---|
| **Focus** (`FP`) — in-world **`vei-jul`**, "the standing sap" | The **ammunition**. A deep, finite reservoir governed by WILLPOWER (RI-PRG02 §1). It decides *how many spells this expedition contains*. | Full cost, on **frame 1** of the cast, never refunded | **Only** at a HEARTH rest and on respawn (RI-PRG04). **Never** regenerates over time, never by potion, never by gold, never by a spell. |
| **Stamina** | The **tempo**. A flat per-class cost charged on frame 1 exactly like an attack, which re-arms RI-CMB03's 42-frame regen delay. It decides *whether you can still defend yourself in the next second*. | Full cost, on **frame 1** | RI-CMB03's ordinary regen, unmodified |

The two candidate single-resource designs were both considered and both rejected, and the
reasons are the ruling's justification:

- **Stamina only** (the "casting is just another weapon" design). It is Souls-legal and it is
  sterile. It deletes the attrition dimension entirely — magic becomes infinitely repeatable
  at a tempo cost, which is exactly what a sword already is, so a caster is a swordsman with
  different particles. It also strands WILLPOWER: one of RI-PRG02's ten attributes would
  govern a resource that does no work, and the stat sheet quietly narrows from ten to nine.
  And it destroys RI-PRG03's Cost Gate, which explicitly lists **Focus** among the things the
  world can run out of — with no Focus there is nothing a cast consumes, and casting stops
  granting skill progress.
- **Focus only** (the "Morrowind magicka bar" design). It is an AR-1 failure in slow motion.
  If a cast costs no stamina, the caster can cast and roll in the same 30 frames, which means
  casting is the only offensive action in the game that does not mortgage the defensive one.
  In every punish window the optimal input becomes "cast", forever. It also breaks the
  spacing economy RI-CMB03 §A is built on: the 42-frame regen delay is the clock the whole
  fight runs on, and an action that does not re-arm it is an action outside the fight's time.

Both is the only construction that satisfies S19 literally — "costs a resource on the stamina
model's terms" — while keeping the thing that makes Morrowind's magic feel like a
*supply*: you left the well with eleven spells in you, and you have used four.

**Focus pool** (WILLPOWER-driven; the curve mirrors RI-PRG02's soft cap at WIL 30, hard at 50):

| Band | Focus per point | Focus at band end |
|---|---:|---:|
| WIL 10 (base) | — | **30** |
| 10 → 30 | +3.2 | **94** |
| 30 → 50 | +0.9 | **112** |
| 50 → 99 | +0.25 | **124** |

Sampled: WIL 10 = 30 · 15 = 46 · 20 = 62 · **30 = 94 (soft cap)** · 40 = 103 ·
**50 = 112 (hard cap)** · 99 = 124.

**Attuned spell slots** (RI-PRG02 §3): base **2**, +1 at WIL 15 / 25 / 35 / 50 ⇒ maximum **6**.
Slots are set at a HEARTH only. You cannot re-attune in the field and you cannot re-attune in
combat (S14: no menu that pauses the fight).

**Focus never regenerates. This is the load-bearing rule of the whole magic area.**
It is the exact analogue of RI-CMB08's flask charges, and it is what makes levitation,
spellmaking magnitude, and every utility effect a *budget decision* rather than a fence.
Anything that restores Focus in the field — a potion, a merchant, a shrine, a slow trickle,
a "focus regen" stat — deletes RI-MAG02's bounds on levitation and RI-MAG03's bounds on
spellmaking simultaneously. It is an automatic fail of this item.

The caster's *sustain* is not Focus. It is **enchanted items**, which carry their own charge
pool refilled from soul gems (RI-MAG03). That is deliberate: it makes enchanting load-bearing
rather than a bonus, and it is why RI-MAG03's soul-gem ruling matters mechanically and not
just politically.

### B. `ES-CAST/1` — cast frame data by spell weight class (BINDING)

Fixed 60 Hz. Frame indices 1-based, inclusive. `first_active = startup + 1`.
`Ps = startup + 1`, the same quantity RI-AI03 consumes for punish-window sizing.

| Class | Startup | **Ps** | Active (release) | Recovery | **Total** | Stamina | **Focus ×** | Hyperarmour | Move speed, startup | Move speed, active+recovery |
|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| `CANTRIP` | 14 | **15** | 3 | 20 | **37** | **10** | 0.50 | *none* | 1.10 m/s | 1.10 m/s |
| `LIGHT` | 24 | **25** | 4 | 28 | **56** | **16** | 1.00 | *none* | 0.55 m/s | 0 |
| `HEAVY` | 36 | **37** | 6 | 40 | **82** | **24** | 2.10 | **f22–f42** | 0 | 0 |
| `GREAT` | 52 | **53** | 8 | 60 | **120** | **34** | 4.40 | **f32–f60** | 0 | 0 |
| `RITUAL` | 150 | — | 12 | 48 | **210** | **0** | 1.00 | *none* | 0 (movement input aborts) | 0 |

`Focus ×` multiplies the spell's computed Focus cost from RI-MAG02 §D. A `LIGHT`-class spell
pays its listed cost; the same effect authored as `GREAT` pays 4.4× and is a different spell.

**Hyperarmour windows are derived, not authored**, by RI-CMB02's own formula
`HA = [ceil(0.60 × startup), startup + active]`, and apply **only** when the caster is
two-handing a catalyst (staff/rod/bare Root-Speech). One-handed casting with a shield or a
weapon in the off-hand has **no hyperarmour at any class**. This is the caster's version of
RI-CMB02 §C's two-handed modifier and it is the same trade: commitment buys poise.

**`RITUAL` is uncastable inside the fight, and it is uncastable by construction, not by a
rule.** A 150-frame startup with zero hyperarmour and zero movement cannot survive contact
with anything in RI-AI05's roster. This is how S19's "no recall out of a fight, no
intervention as an escape button" is enforced: the escape spells are `RITUAL` class, and a
`RITUAL` cast **aborts** (Focus refunded — the only refund in this item) if the caster takes
any damage, enters `COMBAT`, or supplies any movement input. There is no `no_casting_in_combat`
flag to forget to set, and no message telling the player they may not. The clock does it.

Catalyst modifier on Focus cost (multiplicative, applied after RI-PRG03's skill discount):

| Catalyst in hand | Focus × | Note |
|---|---:|---|
| Great staff (two-handed only) | **0.80** | The efficiency build; costs you a shield |
| Rod / focus (one-handed) | **1.00** | Baseline |
| Enchanted weapon used as catalyst | **1.15** | Sword-and-board caster tax |
| No catalyst (bare-handed / Root-Speech only) | **1.35** | Always possible; always worst |

### C. Commitment, aim latch, and movement (as binding as the numbers)

```
STARTUP  : hard-committed. No input has any effect except the cast buffer.
ACTIVE   : hard-committed. No input has any effect except the cast buffer.
RECOVERY : split.
           frames [1 .. ceil(0.60 * recovery)]      -> hard-committed
           frames [ceil(0.60 * recovery)+1 .. end]  -> DODGE-cancellable only
```

The 0.60 constant is **harsher than RI-CMB02 §D's 0.45 for weapons**, and deliberately: a
caster is already spending the fight at range with the spacing advantage. The recovery tail
is what the range costs. Concretely — `CANTRIP` hard-committed f1–f12 of 20 recovery frames;
`LIGHT` f1–f17 of 28; `HEAVY` f1–f24 of 40; `GREAT` f1–f36 of 60.

**Aim latch.** The player's own aim obeys RI-AI02's tracking-cutoff law:

```
Tc_player = ceil(0.65 * startup)      # last frame on which aim may change
```

| Class | Startup | **Tc** | `Tc ≤ startup − 4` |
|---|---:|---:|---|
| `CANTRIP` | 14 | 10 | ✔ (10 ≤ 10) |
| `LIGHT` | 24 | 16 | ✔ |
| `HEAVY` | 36 | 24 | ✔ |
| `GREAT` | 52 | 34 | ✔ |

After `Tc` the spell goes where it was aimed, not where the target now is. Player yaw rate
before `Tc` is capped at **120 °/s** with a total budget of **≤ 100°** over the startup — the
identical ceiling RI-AI02 §C gives a boss's standard move. **This is the item's most
important asymmetry-killer:** the player must predict a rolling boss exactly as the boss must
predict a rolling player, and a build in which the player's spell homes but the enemy's does
not is an unearned advantage that will be introduced by someone trying to make casting "feel
responsive".

**Movement is root-motion authoritative.** The cast-walk speeds in §B come from the clip's
root track (RI-CMB01 §C rule 5), never from `velocity × dt`. `HEAVY` and `GREAT` plant the
feet; a caster who has committed to a `GREAT` spell is standing still for two seconds.

**Lock-on** (RI-CMB06 owns the camera; this item owns what casting does inside it):

- Locked on: the spell's aim point is the target's lock-on socket **as of frame `Tc`**.
- Not locked on: the spell fires along the camera-forward ray from the caster's cast socket,
  resolved at frame `Tc`. Free-aim is always available and is the only way to hit a target
  the lock-on will not take (a wall sconce, a chain, a barrel, a distant lever).
- **Target switch during a cast is ignored after `Tc`.** The projectile does not re-home.
- There is no soft-lock magnetism on spells. A spell that curves toward whatever is nearest
  is a to-hit roll expressed as geometry, and it fails this item.

**Inputs.** Casting is the `light` button (quick cast) and the `heavy` button (the spell's
heavy variant, where it has one) with a catalyst equipped in the right hand — exactly the
Souls mapping, and it needs no new verb. Cycling the attuned slot needs **one** new button,
`spell_cycle`, requested as a HARNESS §4 amendment below. **Attuning is a HEARTH action; the
cycle button only rotates among already-attuned spells and is free (0 stamina, 0 focus,
6 frames, cancellable).**

**The drop rules** (RI-CMB03's idiom, extended):

| Condition on the frame the cast would begin | Result |
|---|---|
| `focus < cost` | **Input dropped.** No partial cast, no debt, no queue. |
| `stamina < cost` | **Input dropped.** Identical to RI-CMB01 rule 7. |
| `SILENCE` status active | **Input dropped, no Focus spent.** Silence acts on the input, not the reservoir. |
| Spell's skill requirement not met | The spell **could not have been attuned** (RI-PRG03 §6). It is not in a slot; there is nothing to drop. |

### D. Interrupt, poise, and what a lost cast costs

| Interrupted on | Focus | Stamina | Effect |
|---|---|---|---|
| Frames 1 … `startup` | **Consumed. Never refunded.** | Consumed | None. The spell did not happen. |
| Frames `startup+1` … `startup+active` | Consumed | Consumed | **The spell released.** Geometry already exists in the world and resolves normally. |
| Recovery frames | Consumed | Consumed | Spell resolved; you are staggered on top of it. |
| Guard-broken mid-cast (RI-CMB03 §D) | Consumed | 0 (already 0) | As startup-interrupt |
| `RITUAL`, any abort cause | **Refunded** | n/a | None. Outside the fight, a mis-tap is not a lesson. |

This mirrors RI-CMB08's flask exactly, and for the same reason: *the charge is spent whether
or not the heal lands.* The best teaching moment magic has is a `GREAT` spell eaten on frame
30 of 52 with 42 Focus gone and nothing to show for it.

Poise during a cast is RI-CMB05's ordinary player poise. Casting grants **no** i-frames at any
class, at any time, under any catalyst, ever. A cast with i-frames is a dodge with damage
attached and is an automatic fail.

### E. Spell geometry — hitboxes, not dice

Every spell resolves through the same swept-volume machinery as a weapon (RI-CMB04). There
are exactly three geometry kinds and each has a trace record.

| Kind | Representation | Resolution |
|---|---|---|
| `contact` | A capsule swept from the cast socket, active for `active` frames — a touch spell. | Identical to a weapon hitbox. |
| `projectile` | A sphere of radius `r` swept along its per-frame path from spawn to expiry, tested every fixed step. | Continuous sweep, never a raycast at spawn, never a distance check. |
| `volume` | A sphere or vertical cylinder placed at a resolved world point, with an explicit `active_f` window and, for lingering effects, a fixed `ticks_every_f` period. | Re-arms on an integer frame period. **Never a per-frame probability.** |

**Projectile ballistics table (binding):**

| Class | Speed (m/s) | Turn rate | Tracking cutoff | Radius | Lifetime | Min dodge window at 12 m |
|---|---:|---:|---:|---:|---:|---:|
| `CANTRIP` dart | 22.0 | **0 °/s** | — | 0.14 m | 1.5 s | 33 f |
| `LIGHT` bolt | 16.0 | 60 °/s | 0.35 of flight | 0.22 m | 2.5 s | 45 f |
| `HEAVY` orb | 11.0 | 45 °/s | 0.30 of flight | 0.45 m | 4.0 s | 65 f |
| `GREAT` | 8.0 | **0 °/s** | — | 0.90 m | 5.0 s | 90 f |

- **Absolute ceiling: 30 m/s.** Above that the projectile is hitscan in a costume and the
  player has no reaction budget. RI-AI02's M7 argument applies unchanged.
- **`min_dodge_window` ≥ 20 frames** from spawn-visible to earliest possible contact at the
  encounter's design range, for every enemy spell in the game. This is the ranged analogue of
  RI-AI02's `reaction_budget`.
- A tracking projectile stops tracking at its cutoff and flies straight thereafter. A
  projectile that tracks for its whole flight is a homing attack (RI-AI02 M2's failure) and
  fails outright.

**`volume` telegraph rule.** An AoE placed at or near the player must have a **ground decal
that appears ≥ 20 frames before the volume goes active**, and the decal footprint must match
the hitbox footprint in area within **±5%**. No `volume` may become active on the same frame
it spawns. This is RI-AI02's silhouette requirement transposed to a shape that has no
silhouette: the tell is on the floor because it cannot be on the body.

**The four things spell resolution must never do** (S1, restated for magic):

1. **No to-hit roll.** Contact is geometric overlap, always.
2. **No magnitude range.** Morrowind's "Fire Damage 5–15 points" is **deleted**. A spell has
   exactly one magnitude, deterministically scaled (RI-MAG02 §E). Damage variance is a to-hit
   roll wearing a hat, exactly as RI-PRG03 warns.
3. **No spell-failure chance.** Morrowind's cast-failure roll is deleted. Below its skill
   requirement a spell cannot be attuned; at or above it, it always casts.
4. **No resist roll and no proc chance.** Elemental resistance is a deterministic multiplier
   on damage. Status (paralysis, poison, rot, fear) is a **fixed integer of buildup per
   contact** on RI-CMB05/S11's meter — never a coin flip. A spell that "has a 30% chance to
   paralyse" fails this item and AR-1 together.

### F. Enemy casters

An enemy cast **is an attack** and RI-AI02 governs it in full and without exemption: §B's
severity/windup table (a spell's severity is its damage as a fraction of the reference HP
pool for its region), §C's yaw budgets, §D's silhouette requirement at `f_sil`, and every one
of AP1–AP12. `W ≥ 12` is a hard floor for a cast exactly as it is for a swing; a ranged spell
is severity **S6** and therefore `W ≥ 24`.

Six additional anti-patterns specific to casters. **Each is an automatic fail.**

| # | Anti-pattern | Trace signature |
|---|---|---|
| **AP-M1** | **Hitscan spell.** Damage applied on the release frame at range, with no travelling geometry. | Player `hp` decreases on a frame where no `projectile` hitbox record exists between caster and player |
| **AP-M2** | **Untelegraphed AoE.** A `volume` that goes active with <20 f of decal, or whose decal does not match its footprint. | `volume` hitbox `active_f` start minus decal spawn frame < 20, or footprint area ratio outside [0.95, 1.05] |
| **AP-M3** | **The homing orb.** A projectile still turning past its tracking cutoff. | `turn_rate_dps > 2` on any projectile frame past `0.35 × travel_f` |
| **AP-M4** | **Instant status.** Paralysis, silence, fear or curse applied to the player from a single contact with no buildup meter. | A status transitions 0 → applied in one frame with no `buildup` field crossing its threshold |
| **AP-M5** | **The blink caster.** An enemy caster repositioning by teleport. | Already AP6 (position delta > 1.2 m in one frame); restated because casters are where it will appear |
| **AP-M6** | **Cast poses that collide.** Two spells in one caster's kit sharing a windup silhouette, distinguished only by particle colour. | RI-AI02 §D `D(m1,m2,f_sil) < 0.35`; the "the colour of the light tells you" defence is explicitly rejected by RI-AI02 §D and rejected again here |

**The caster is also a fighter.** An enemy caster whose only behaviour is "back away and cast"
is a bad enemy and a design failure, though not an automatic fail: RI-AI01's spacing rules
apply, and every caster archetype in RI-AI05 must have at least one melee move and one
reposition that is not a retreat. A caster that kites forever converts every fight into a
chase, and RI-AI01's leash rules are the guard.

### G. Worked exemplar — `SPARK-DART` (`CANTRIP`, Sorcery, req 0)

The tier-1 spell every caster starts with, given in full so the shape is unambiguous.

| Field | Value |
|---|---|
| Class | `CANTRIP` |
| Startup / active / recovery / total | 14 / 3 / 20 / **37** |
| `Ps` | 15 |
| `Tc` (aim latch) | 10 |
| Stamina | 10 |
| Focus (RI-MAG02 §D: `shock_damage`, M = 17, instantaneous, projectile ⇒ `focus_base` 7) | `ceil(7 × 0.50 × 1.00)` = **4** |
| Geometry | `projectile`, r = 0.14 m, 22.0 m/s, no tracking, 1.5 s lifetime |
| Damage | 34 shock at INT 10 (RI-MAG02 §E scaling) |
| Poise damage | 6 |
| Status | shock buildup 8 per contact |
| Commitment | f1–f14 hard, f15–f17 hard, f18–f29 hard, f30–f37 dodge-cancellable |
| Casts on a full 94-Focus bar | **23** |

At WIL 30 (94 Focus) and a great staff the same caster gets 29 Spark-Darts, or 5 `HEAVY`
casts, or 2 `GREAT` casts and change, **per rest**. That distribution — many small, few
large, none free, nothing regenerating — is the shape this item exists to produce.

## Comparison method

Harness: headless, fixed 60 Hz, seeded, `elder-souls/trace@1` JSONL per `corpus/80-methods/HARNESS.md`.
**Requires the trace and API extensions listed in §Provenance note → "Harness amendments
requested". Until they land, M1–M4 and M7 score 0, fail-closed** (HARNESS §5).

Scenario files to be added under `tools/harness/scenarios/`: `mag-cast-census`,
`mag-iframe-probe`, `mag-projectile-sweep`, `mag-enemy-caster`, `mag-focus-budget`.

**M1 — Cast census.** For each of the 5 weight classes × each catalyst tier, with the enemy
disabled: attune a representative spell, inject a cast input on a known frame, and read
`player.cast.phase` per frame.
- Compute `startup` = frames with `phase=="windup"`, `active` = frames with a live spell
  hitbox record, `recovery` = frames from last active to first `ACTIONABLE`.
- **FAIL** if any value differs from §B by ≥ 1 frame.
- **FAIL** if `total` varies across seeds or across repeated casts of the same spell.
- **Headline number: `Ps` per class.** Any drift from {15, 25, 37, 53} invalidates RI-AI03's
  punish-window arithmetic and must be reported as a cross-item break.

**M2 — Dual-cost probe (the resource ruling's test).** From a known state
(`focus = F0`, `stamina = S0`), cast once and read the trace at frames 0, 1, 2.
- **Assert `focus` drops by exactly the computed cost on frame 1**, and `stamina` drops by
  exactly the §B class cost on frame 1.
- **Assert `stamina_regen_blocked == true` for the following 42 frames** (RI-CMB03 §A).
  A cast that does not re-arm the regen delay is the AR-1 failure this item exists for.
- Interrupt a cast on frame `ceil(startup/2)`: **assert Focus is gone and no spell hitbox
  ever appeared.** **FAIL** if the cast refunds.
- Attempt a cast at `focus = cost − 1`: **assert nothing happens, no partial cast, no queue,
  and the input does not fire later.** Repeat at `stamina = cost − 1`.

**M3 — Focus never regenerates (binary).** Run a 20-minute scripted session: walk, sprint,
sit, wait, drink every consumable in `game/data/items/**`, enter and leave combat, visit
every merchant, sleep in a rented bed, pray at a shrine, and pass in-game midnight.
- **Assert `focus` is monotonically non-increasing across the entire trace** except on frames
  carrying a `bonfire_rest` or a respawn `load` event.
- **FAIL** on a single frame of unexplained increase. This is the guard for RI-MAG02's
  levitation bound and RI-MAG03's spellmaking bound simultaneously.
- Static cross-check: `node tools/analysis/content-stats.mjs` + grep every item, spell and
  service record for a `restores: focus` field. **Assert zero outside `hearth_rest`.**

**M4 — Commitment and aim latch.** For each class, inject a cast, then on every frame
`k ∈ [1, total]` inject every other action (light, heavy, roll, block, parry, sprint, jump,
use_item, spell_cycle, menu).
- **FAIL** if any input before `ceil(0.60 × recovery)` past the last active frame changes the
  frame on which `ACTIONABLE` returns, or is later observed to execute.
- **FAIL** if `roll` during startup or active produces any i-frame (`player.iframe == true`
  at any point between cast frame 1 and the last active frame is an automatic fail).
- Aim latch: script the target to strafe at full speed from frame `Tc + 1`. Compute
  `residual_aim_error` = angle between the spell's resolved direction and the bearing to the
  target at the release frame. **Assert median `residual_aim_error ≥ 25°` across 30 trials.**
  **FAIL if median < 10°** — the player's spells are homing.
- **Assert `player.yaw_rate_dps ≤ 120` for frames 1..Tc and `≤ 2` for frames Tc+1..total**,
  and that the integrated yaw over the startup is ≤ 100°.

**M5 — Geometry, not dice (the S1 guard).** Cast the same spell 200 times at a stationary
dummy from a fixed pose at three seeds.
- **Assert all 200 damage values are byte-identical.** Any variance is a magnitude range and
  an **automatic fail**.
- **Assert `rng.draws` in the trace is unchanged across the cast** — casting must draw zero
  random numbers. This is the decisive check and it is cheap: a spell that consults the PRNG
  at all is doing something this corpus forbids.
- Static: `grep -rniE "random|chance|miss|resist_roll|proc" game/src/**/{spell,magic,effect}*`
  and inspect every hit. **Assert none is on a damage, contact, status or duration path.**
- Fire 40 projectiles at a target moving perpendicular at 3 m/s and 40 at the same target
  standing still. **Assert the hit/no-hit outcome is fully explained by the swept geometry**
  (recompute the sweep offline from `pos` and `r` per frame and compare to `hits[]`, 40/40).

**M6 — Projectile ballistics.** For each projectile class, spawn and trace to expiry.
- **Assert speed within ±0.2 m/s of §E, lifetime within ±1 frame, radius exact.**
- **Assert `turn_rate_dps ≤ 2` on every frame past the tracking cutoff.**
- **Assert no spell in `game/data/magic/spells.json` declares `speed_mps > 30`.**
- Compute `min_dodge_window` for every enemy spell at its encounter's design range.
  **FAIL if any is < 20 frames.**

**M7 — Enemy caster sweep.** Run RI-AI02's M1, M2, M3, M5 and M6 unmodified against every
caster archetype in RI-AI05, treating each spell as a move.
- **Assert `min W ≥ 12` over every cast instance and `median W ≥` the §B row for its severity.**
- Run the AP-M1…AP-M6 detector over the same traces plus a 20-minute free-roam trace.
  **Any AP-M with count > 0 is a hard fail** and must be named individually in the verdict.
- **Assert every caster archetype has ≥ 1 melee move and ≥ 1 non-retreat reposition.**

**M8 — Declared-vs-observed (HARNESS §7 rule 4).** Diff `game/data/magic/spells.json` and
`game/data/combat/movesets/spell-*.json` against the frames measured in M1.
- **Any mismatch between the declared frame data and the measured trace is a hard fail** — the
  same rule the weapon movesets live under. Two independent sources that must agree.

**M9 — Blind pair.** Produce two `H[k]`-style vectors from M4: for each frame offset of a
cast, whether an input was accepted. Hand a critic ours and one generated from §C, unlabeled,
and ask which describes a game where casting is a commitment. If the critic picks ours,
re-run with the tolerance halved (CORPUS-CONTRACT §6).

## Scoring

| Check | Weight | Pass condition |
|---|---:|---|
| M1 cast census | 15 | All 5 classes exact to the frame; `Ps` = {15,25,37,53} |
| M2 dual cost | 15 | Both resources charged frame 1; regen delay re-armed; interrupt keeps the Focus; both starvation cases drop the input |
| M3 Focus never regenerates | 15 | Monotonic non-increase outside rest/respawn; zero `restores: focus` records |
| M4 commitment + aim latch | 15 | No cancel, no cast i-frames, median residual aim error ≥ 25° |
| M5 geometry not dice | 15 | 200/200 identical damage; zero PRNG draws; sweep fully explains 40/40 |
| M6 ballistics | 10 | All classes within tolerance; no speed > 30 m/s; every `min_dodge_window` ≥ 20 f |
| M7 enemy casters | 10 | RI-AI02 clean; zero AP-M detections |
| M8 declared vs observed | 5 | Zero mismatches |

Score = sum of passed weights, 0–100.

| Total | Verdict |
|---|---|
| ≥ 90 | Parity. Casting is a Souls action. |
| 70–89 | Playable; named gap; remediable within a wave |
| < 70 | **We lose** |

**Automatic fail regardless of score (AR-1 enforcement):**

- Any i-frame granted by any cast at any class.
- Any cast cancellable before its commitment window ends.
- Any damage, magnitude, duration, contact, status or resist value drawn from the PRNG.
- Any spell-failure chance, to-hit roll, glancing blow, or magnitude range.
- Casting that does not spend stamina, or does not re-arm RI-CMB03's 42-frame regen delay.
- Focus regenerating in the field by any mechanism, including a purchasable one (this is also
  an S15 violation: gold would be buying a fight resource).
- Any enemy cast with `W < 12`, or any AP-M1…AP-M6 detection.
- A hitscan spell, or a projectile resolved by raycast-at-spawn rather than a per-frame sweep.
- A `RITUAL` spell that can complete inside `COMBAT`.

## How we lose

Written pessimistically, for a naive browser Three.js build.

1. **Casting costs only the blue bar.** The single most likely failure and the one that looks
   most like a feature. The caster casts, the caster rolls, the caster casts again; stamina
   never enters the loop; and within an hour every tester's optimal play is magic, because
   magic is the only action in the game that does not put your defence at risk. Nothing
   *breaks* — the game is simply solved. M2's regen-delay assertion is the only thing that
   catches it, and it must be run as a trace read, not a code read.
2. **`Math.random()` in the damage line.** `damage = base + Math.random() * spread` is what
   every RPG tutorial writes and it is the exact Morrowind dice this corpus abolished in S1.
   It will be defended as "so it doesn't feel robotic." M5's `rng.draws` assertion is
   deliberately blunt: casting must draw zero.
3. **The spell that is a raycast.** `raycaster.intersectObject(enemy)` on the release frame,
   damage applied instantly at any range. It is four lines, it works, and it deletes the
   dodge from every ranged fight in the game. AP-M1.
4. **Focus regenerates because the caster "runs dry and it feels bad".** Someone adds
   0.5 FP/s. It is a small number and it is catastrophic: levitation becomes free flight,
   spellmaking's cost formula stops bounding anything, the caster stops rationing, and three
   reference items lose their only enforcement mechanism at once. M3 is binary for this reason.
5. **Casting has i-frames** — added because the caster "has no defensive option". The caster
   has three: distance, `slowfall`/`buoyancy` mobility, and `warding`. A cast with i-frames
   is a roll that deals damage.
6. **The cast that can be cancelled into a roll.** Trivially easy in an animation-mixer-driven
   build where every clip is interruptible by default, and it converts every spell into a
   zero-risk poke. Three.js's `AnimationMixer` will let you cross-fade out of anything; the
   commitment window has to be enforced by the state machine, not by the animation system.
7. **Player spells home and enemy spells do not.** Introduced as "responsiveness". It is the
   same unfairness AR-1 forbids, pointed the other way, and no existing check would catch it
   because AR-1 is written about enemies. M4's residual-aim-error assertion on the *player*
   exists for this.
8. **The AoE with no floor.** A ground slam or a poison cloud whose hitbox appears where the
   player is standing, on the frame it is cast. It is the easiest AoE to implement and it is
   undodgeable by construction. AP-M2.
9. **Cast animations are one clip retinted per school.** All four schools share a "raise arms"
   pose, the fire one is orange and the frost one is blue, and RI-AI02 §D's rule that colour
   is never sufficient is quietly ignored because the spells "obviously look different".
   AP-M6.
10. **Spell frame data lives in JavaScript.** The movesets are in `combat/movesets/*.json` but
    the spells are a `switch` in `magic.js`, so M8 has nothing to diff and half the numbers in
    §B are decorative. HARNESS §7 makes this a hard architectural requirement and it will
    still happen, because spells feel like code and weapons feel like data.
11. **Attuning becomes a pause menu.** The player opens a spell wheel mid-fight, the world
    stops, and S14 dies. The 6-frame `spell_cycle` and HEARTH-only attunement exist precisely
    so nobody needs a wheel.
12. **`RITUAL` gets a "combat variant" for convenience.** Someone shortens Recall to 40 frames
    so it is usable "in an emergency". That is S19's forbidden escape button, and it arrives
    labelled as a quality-of-life fix.

## Provenance note

**Every number in this item is `provenance: constructed`.** No frame count, cost, speed or
threshold here is measured in, or recalled from, Dark Souls, Elden Ring or Morrowind. They are
defined for this project and they are binding because they are exactly measurable.

Three structural debts are `canonical-recall`, confidence **medium**, and are context rather
than bar: that Dark Souls/Elden Ring casting is an animated, committed action driven from the
weapon buttons with a catalyst equipped; that FP-style casting resources in that lineage are
finite-per-rest and refilled at the checkpoint; and that Morrowind's magic used a magnitude
*range*, a cast-failure roll, and a regenerating magicka pool — all three of which this item
**deletes**, and the deletions are rulings, not recollections.

Values inherited (not invented here) and which must move together if they move at all:

- WILLPOWER → Focus and spell slots, and the WIL 30/50 caps: **RI-PRG02 §1, §3.**
- Spell tiers, the `req 0/25/45/65/85` ladder, "below the requirement a spell cannot be
  equipped at all", and the `−0.5%/pt` Focus discount floored at −35%: **RI-PRG03 §6.**
- 42-frame regen delay, 0.75 stamina/frame flat regen, the drop-don't-queue rule:
  **RI-CMB03 §A/§B.**
- Hyperarmour derivation `[ceil(0.60×startup), startup+active]` and the commitment split:
  **RI-CMB02 §B/§D**, with the recovery constant changed from 0.45 to **0.60 for casts** —
  that change is ours and is argued in §C.
- Every telegraph threshold applied to enemy casters: **RI-AI02 §B/§C/§D/§E.**
- The charge-spent-on-frame-1-never-refunded rule: **RI-CMB08 §B**, transposed to Focus.

The two decisions most worth re-litigating with evidence:

1. **The dual cost's stamina column** (10/16/24/34). These are set so a `LIGHT` cast costs
   less stamina than a straight-sword R1 (20) but more than a dagger R1 (12), which encodes
   "casting is cheaper in tempo than swinging, and much more expensive in supply". If TTK
   data from `corpus/10-combat/` shows casters out-trading melee in the punish window, the
   stamina column rises before anything else changes.
2. **`Focus ×` per class** (0.50 / 1.00 / 2.10 / 4.40). The 4.4× on `GREAT` is what makes a
   `GREAT` spell a two-per-rest decision. It is arithmetic on the §G exemplar and a taste
   judgement about how many big spells a run should contain, and it should be re-derived from
   RI-PRG06's encounter pacing once that exists.

**`vei-jul`** as Focus's in-world name is `constructed` and **provisional**: built from
`vei` (blood/sap, RI-LOR05 §2) and `jul` (to stand/to rise, `jel-lexicon.json:roots`).
`corpus/60-lore/` owns the final noun and must register it in `jel-lexicon.json:coined_terms`.
Renaming it must not change a number in this file — the same treatment RI-PRG02 gives
HIST-BOND.

### Harness amendments requested (HARNESS.md §10 procedure)

Nothing in `## Comparison method` is scoreable without these. They are **additions**, so
`__HARNESS.version` 1 → 2 and `elder-souls/trace@1` → `@2`.

1. **§4 button set** — add exactly one verb: **`spell_cycle`**. Casting itself reuses `light`
   and `heavy`; no other new button is requested.
2. **§5 frame record, `player` and `enemies[]`** — add:
   `focus`, `focus_max`, `focus_locked` (bool, true everywhere but a HEARTH),
   `attuned` (array of spell ids, ≤ 6), and
   `cast: {spell, class, phase, anim_frame, tc_frame, aim_latched, focus_spent, stamina_spent}`.
3. **§5 hitbox record** — `kind` gains `"projectile"` and `"volume"`; add optional fields
   `spell`, `speed_mps`, `turn_rate_dps`, `travel_f`, `ticks_every_f`, `decal_spawn_f`.
4. **§5 event vocabulary** — add `cast_start`, `cast_release`, `cast_interrupt`, `focus_spend`,
   `effect_apply`, `effect_expire`.
5. **API** — add `setAttuned(spellIds: string[]): string[]` so a scenario can pin a loadout
   without walking to a HEARTH, and extend `getPlayerStats()` with
   `effects_active: [{effect, magnitude, remaining_f, source}]`.
6. **§7 data layout** — add `game/data/magic/effects.json`, `game/data/magic/spells.json`, and
   `game/data/combat/movesets/spell-<id>.json` (so HARNESS §7 rule 4's declared-vs-observed
   discipline covers spells exactly as it covers weapons).

### New subsystem paths requested (`subsystems.json`, append-only)

`magic.casting.frames` · `magic.casting.resource` · `magic.casting.commitment` ·
`magic.casting.geometry` · `magic.casting.enemy` — all `arb: souls`, `area: 25-magic`,
`critic: critic.combat` (they are inside the fight; AR-1 applies and the combat critic must
own them). The full `magic.*` set requested by this area is listed in RI-MAG02's provenance
note.
