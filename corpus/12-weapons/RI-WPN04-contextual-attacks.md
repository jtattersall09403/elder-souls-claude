---
id: RI-WPN04
title: Contextual attacks — rolling, backstep, running, jumping, plunging, guard counter
kind: number
side: souls
judges: [weapon.context.rolling, weapon.context.running, weapon.context.backstep, weapon.context.aerial, weapon.moveset.slots, combat.attack.moveset, combat.frames.cancel]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

The contextual attacks are where a Souls moveset stops being a list and becomes a language.
They are not "the light attack, but faster because you were moving". Each one is a separate
authored animation with its own startup, its own arc, its own displacement and its own
tactical job, reachable **only** through a specific state and a specific frame window inside
that state. The rolling attack is how you turn a dodge into a punish without paying for an
approach. The backstep attack is how you punish a whiff without spending a roll's i-frames.
The running attack is how you close on something that will not come to you. The jumping
attack is how you break poise. The guard counter is how a shield becomes a weapon. Learning
*which* of those to use, and threading the input into a window eleven frames wide, is a large
fraction of what it means to be good at these games.

"Good" means: every contextual slot on every weapon resolves to its own clip, with the frame
data in §A, reachable only inside the window in §B, and doing the tactical job in §C. A
player who presses light coming out of a roll must see something they could not have got by
pressing light while standing still — different pose, different arc, different distance
covered, different result against the same enemy.

**The specific fake this item exists to detect:** a contextual slot that is wired up, appears
in the data, appears in the menus, and silently plays the standard light attack. It is
invisible to every check that does not compare clips and root tracks, it is what a
time-pressured build ships, and here it is a **hard fail** — not a deduction.

## The reference artifact

### A. `ES-CONTEXT/1` — per-class frame data for the four grounded/aerial contextual slots

Derived from RI-CMB02 §C's modifier multipliers applied to the R1 base rows of RI-WPN02 §B,
`round-half-up` to integer frames, applied once to the final product (RI-CMB02's stated
rounding rule). Two multipliers are **new here** and are amendment requests against
RI-CMB02 §C, which has no backstep row and no guard-counter row.

| Modifier | Startup | Active | Recovery | Stamina | Motion value | Poise dmg | Root Δz | Source |
|---|---|---|---|---|---|---|---|---|
| Rolling attack | ×0.60 | ×1.00 | ×1.10 | ×0.85 | ×0.85 | ×0.85 | ×1.00 | RI-CMB02 §C |
| Running attack | ×0.70 | ×1.00 | ×1.00 | ×1.10 | ×1.05 | ×1.10 | ×2.00 | RI-CMB02 §C |
| Jump attack | ×1.30 | ×1.25 | ×1.20 | ×1.30 | ×1.35 | ×1.80 | ×0.60 | RI-CMB02 §C |
| **Backstep attack** | **×0.65** | ×1.00 | **×0.95** | **×0.80** | **×0.80** | **×0.75** | **×1.40** | **new — amendment request** |
| **Guard counter** | **×0.85** | ×1.00 | **×1.05** | **×1.20** | **×1.30** | **×1.60** | **×0.80** | **new — amendment request** |

**The 6-frame floor.** RI-CMB02 §E sets an absolute minimum of 6 f startup for any player
attack, and RI-CMB02 §C's ×0.60 rolling multiplier applied to the dagger's 6 f base yields 4.
**That is an internal contradiction in RI-CMB02** and it is reported as such (see the
provenance note). This item resolves it by applying the §E floor after the multiplier: any
derived startup below 6 is clamped to 6. The clamp binds for **DGR and FST only**, on their
rolling, running and backstep slots.

Startup / active / recovery, one-handed, at 60 Hz. Clamped cells are marked ⌊6⌋.

| Class | `r1.1` (base) | `roll.r1` | `run.r1` | `backstep.r1` | `jump.r1` |
|---|---|---|---|---|---|
| DGR | 6 / 3 / 12 | ⌊6⌋ / 3 / 13 | ⌊6⌋ / 3 / 12 | ⌊6⌋ / 3 / 11 | 8 / 4 / 14 |
| FST | 7 / 2 / 13 | ⌊6⌋ / 2 / 14 | ⌊6⌋ / 2 / 13 | ⌊6⌋ / 2 / 12 | 9 / 3 / 16 |
| CSW | 10 / 5 / 17 | 6 / 5 / 19 | 7 / 5 / 17 | 7 / 5 / 16 | 13 / 6 / 20 |
| TSW | 11 / 4 / 18 | 7 / 4 / 20 | 8 / 4 / 18 | 7 / 4 / 17 | 14 / 5 / 22 |
| SSW | 12 / 5 / 20 | 7 / 5 / 22 | 8 / 5 / 20 | 8 / 5 / 19 | 16 / 6 / 24 |
| SPR | 14 / 4 / 22 | 8 / 4 / 24 | 10 / 4 / 22 | 9 / 4 / 21 | 18 / 5 / 26 |
| AXE | 16 / 6 / 24 | 10 / 6 / 26 | 11 / 6 / 24 | 10 / 6 / 23 | 21 / 8 / 29 |
| MCE | 17 / 6 / 25 | 10 / 6 / 28 | 12 / 6 / 25 | 11 / 6 / 24 | 22 / 8 / 30 |
| HLB | 19 / 7 / 28 | 11 / 7 / 31 | 13 / 7 / 28 | 12 / 7 / 27 | 25 / 9 / 34 |
| WHP | 20 / 5 / 29 | 12 / 5 / 32 | 14 / 5 / 29 | 13 / 5 / 28 | 26 / 6 / 35 |
| GSW | 22 / 8 / 33 | 13 / 8 / 36 | 15 / 8 / 33 | 14 / 8 / 31 | 29 / 10 / 40 |
| CGS | 24 / 9 / 35 | 14 / 9 / 39 | 17 / 9 / 35 | 16 / 9 / 33 | 31 / 11 / 42 |
| GHM | 26 / 8 / 40 | 16 / 8 / 44 | 18 / 8 / 40 | 17 / 8 / 38 | 34 / 10 / 48 |
| UGS | 29 / 10 / 44 | 17 / 10 / 48 | 20 / 10 / 44 | 19 / 10 / 42 | 38 / 13 / 53 |

BOW substitutes `bow.roll` (draw 14 / release / 22 recovery, MV 0.60) for all four and has no
`jump` variant. `guard.counter` frames are derived by the §A multiplier from each class's
base row and are not tabulated separately; a critic recomputes them.

Tolerance on every cell: **±0 frames**. These are integer products of published multipliers
and published base rows; a discrepancy is an arithmetic error or a lie, never a rounding
difference.

### B. Input windows — the part that makes them skills

A contextual slot is reachable **only** from its state, **only** inside its window, and
**never** from `IDLE`. Windows are read from RI-CMB01 §B's roll and backstep animations.

| Slot | State | Window | Notes |
|---|---|---|---|
| `roll.r1` / `roll.r2` | `ROLL`, tier `LIGHT` | **f16–f26** (11 f) | The roll's recovery frames. RI-CMB01 §B. |
| | `ROLL`, tier `MEDIUM` | **f14–f29** (16 f) | Recovery is f14–f30; capped at 16 f. |
| | `ROLL`, tier `HEAVY` | **f9–f24** (16 f) | Recovery is f9–f44; capped at 16 f. **The cap exists so that fat-rolling does not buy the most generous rolling-attack window in the game** — otherwise the heaviest equip load would be rewarded with a 36-frame input window, which inverts RI-CMB01's whole equip-load design. |
| | `ROLL`, tier `OVERLOADED` | **none** | No rolling attack at all. |
| `backstep.r1` | `BACKSTEP`, `LIGHT`/`MEDIUM` | **f7–f21** (15 f) | Backstep total is 21 f; the window is its entire recovery. |
| | `BACKSTEP`, `HEAVY` | **f4–f19** (16 f) | Capped, same rationale. |
| | `BACKSTEP`, `OVERLOADED` | **none** | |
| `run.r1` / `run.r2` | `SPRINT` | held **≥12 consecutive frames**, plus an 8 f grace after sprint release | The grace exists because the player releases sprint as they commit; without it the running attack is unreliable and players stop using it. |
| | `SPRINT`, `OVERLOADED` | **none** | |
| `jump.r1` / `jump.r2` | `AIRBORNE` **and** `vel_y < 0` | any descending frame | **No rising jump attacks.** Forbidden entirely at `OVERLOADED` (RI-CMB02 §C). |
| `plunge` | `AIRBORNE`, fall height ≥ **3.0 m**, a valid target inside a 2.0 m radius cylinder below | any descending frame | Takes precedence over `jump.r1` when both are legal. |
| `guard.counter` | within **20 f** of a `BLOCK_SUCCESS` event | 20 f | Requires the `BLOCK_SUCCESS` event to exist in the trace vocabulary — see the harness request. |
| `guardbreak` | `IDLE`, `move` forward magnitude ≥ 0.9, no `light` press in the previous 8 f | — | The only contextual slot reachable from idle, and the awkward input is deliberate. |

**Buffer interaction (binding).** The combo buffer is 8 frames wide and holds exactly one
action (RI-CMB02 §D.5, RI-CMB01 §C.6). Therefore:

1. A `light` press within 8 frames **before** a window opens is buffered and fires the
   contextual slot on the window's first frame.
2. A `light` press earlier than that is **dropped**, not stored. Mashing light through a
   roll's i-frames produces exactly one rolling attack, on frame 16, not a queue.
3. A `light` press after a window closes produces the standard `r1.1` once the state ends —
   correctly, and this is the *only* legal path from a contextual state to the standard
   attack. It must be distinguishable in the trace by *when* the attack starts.
4. Insufficient stamina drops the input entirely (RI-CMB02 §D.6). A rolling attack attempted
   at 3 stamina does not degrade into a light attack.

### C. Tactical role — what each slot is *for*

A slot with correct frames and no reason to exist will be built and never used. Each row
names the enemy behaviour it answers (RI-AI05 archetypes) so the encounter designers and the
weapon authors are aiming at the same thing.

| Slot | The job | Answers | Why the player picks it over `r1.1` |
|---|---|---|---|
| `roll.r1` | Turn a successful dodge into a punish with no approach frames | A1, A3, A4, A9 | Shortest startup available on every class; you are already inside the enemy's recovery |
| `roll.r2` | The same, but breaking poise (classes with arc ≥ 120° only) | A4, A9 | Trades reach for a poise event |
| `run.r1` | Close 2× the root distance while attacking | A5, A8 | The only way to attack a retreating or ranged enemy without arriving in neutral |
| `run.r2` | Gap-close *through* an attack (heavy classes carry hyperarmour into it) | A4, A5 | Accepts a hit to arrive |
| `backstep.r1` | Whiff-punish while staying square to the target | A3, A10 | 4 i-frames instead of 13, ×1.40 root recovery — a **read**, not a panic button. This is the slot that separates good players from rolling. |
| `jump.r1` | Poise damage ×1.80 | A2, A4, A9 | The cheapest poise break in the kit; costs a fixed landing spot |
| `jump.r2` | Poise damage on a class that cannot charge | A4 | |
| `plunge` | Open an encounter from above, unanswerable | A6, A9 | The level-design verb; RI-WLD07 owns the geometry that makes it possible |
| `guard.counter` | Convert a block into offence within 20 f | A1, A2, A4 | The shield's only offensive line; ×1.60 poise damage |
| `guardbreak` | Strip a raised guard | **A2 TURTLE** | RI-AI05 §7 requires this to ship before TURTLE's first appearance |

Every contextual slot must be the **strictly better** choice in at least one measurable
situation — that is what M5 tests. A slot that is never the right answer is decoration with
frame data.

### D. The headline measurable — the fallback detector and `CFS`

For every weapon × every contextual slot `X` (the ten in §C plus their `2h.*` mirrors), run
five tests against the same weapon's `r1.1`:

| Test | Condition that **FAILS** |
|---|---|
| **T1 — clip identity** | `anim(X) == anim(r1.1)` |
| **T2 — frame signature** | `\|startup(X) − startup(r1.1)\| ≤ 1` **and** `\|active\| ≤ 1` **and** `\|recovery\| ≤ 1` |
| **T3 — root track** | `max` per-frame `\|Δpos_X − Δpos_r1.1\| < 0.02 m` across the whole animation |
| **T4 — hitbox path** | `max` distance between corresponding active-frame hitbox capsule midpoints `< 0.03 m` |
| **T5 — derived conformance** | measured frames ≠ §A's table (±0 f) |
| **T6 — window enforcement** | `X` fires from a press 1 frame **before** the window opens, or 1 frame **after** it closes |
| **T7 — no free contextual** | `X` is reachable from `IDLE` (except `guardbreak`) |

```
CFS = (contextual slot instances passing ALL of T1..T4) / (total contextual slot instances)
```

| Threshold | Value | Meaning |
|---|---|---|
| **`CFS = 1.00`** | **PASS** | Every contextual slot on every weapon is its own attack |
| **`CFS < 1.00`** | **HARD FAIL** | At least one slot silently falls back to the standard light attack. **This is the specific fake this item exists to detect and there is no partial credit for it.** |

T1–T4 are deliberately layered. T1 catches the honest version (the code literally plays
`r1.1`). T2 catches the version where someone copied the row. T3 and T4 catch the version
that defeats both: a separate clip id, separate numbers, and an animation that is the light
attack re-exported. A build cannot pass T3 and T4 without an animator having made a different
animation, which is the whole point.

## Comparison method

Script: **`corpus/80-methods/m-wpn04-contextual.mjs`**

**M1 — Contextual census (harness, all 87 weapons × 10 slots × 2 stances).** For each,
build the input script from §B and drive it:
```js
// roll.r1, LIGHT tier:
H.queueInputs([{f:0,move:[0,1]},{f:10,tap:'roll',hold:3},{f:28,tap:'light'}]);
// window opens at roll frame 16 => absolute frame 10+16 = 26; press at 28 is inside f16-f26?
// NO — 28 is roll frame 18, inside [16,26]. The scenario file states every absolute frame
// explicitly and asserts the derived roll frame, so an off-by-one is a tooling failure and
// not a game failure.
```
Extract `player.anim`, `anim_slot`, `startup/active/recovery`, the per-frame root delta, and
every hitbox record. Run T1–T5.
- Report the `87 × 20` pass/fail grid and `CFS`.
- **HARD FAIL** on `CFS < 1.00`.

**M2 — Window probe.** For each weapon × contextual slot, inject the `light` press at every
frame `k` of the enclosing state, in separate runs, and record which slot fired.
- Build `Wgrid[slot][k] ∈ {none, contextual, standard, buffered}`.
- **FAIL** if `contextual` appears outside §B's window by even one frame.
- **FAIL** if `buffered` appears earlier than 8 frames before the window opens.
- **FAIL** if mashing `light` every 2 frames through a whole roll produces more than one
  attack.
- **FAIL** if a press at 3 stamina produces a standard attack instead of nothing.
- The `Wgrid` is this item's second diagnostic artifact and belongs in the verdict.

**M3 — Equip-load window conformance.** Repeat M2 at each of the four RI-CMB01 tiers.
- **FAIL** if `OVERLOADED` produces any contextual attack.
- **FAIL** if `HEAVY`'s rolling-attack window exceeds 16 f (the fat-roll inversion).
- **FAIL** if any window varies with anything other than the tier.

**M4 — Aerial rules.** Drive `jump.r1` on the ascending half of a jump and on the descending
half; drive `plunge` from 2.9 m and from 3.1 m above a target and from 3.1 m above nothing.
- **FAIL** if a rising jump attack exists.
- **FAIL** if `plunge` fires below 3.0 m or with no target.
- **FAIL** if `jump.r1` fires at `OVERLOADED`.
- **FAIL** if the landing position is not the root track's (an aerial attack must not be a
  velocity impulse; RI-CMB02 §D.3).

**M5 — Situational superiority.** For each contextual slot, construct the situation it claims
in §C and run it against the named archetype dummy, comparing the slot against `r1.1` in the
same situation over 20 trials each:
- `roll.r1` vs `r1.1` immediately after dodging an A4 heavy: compare damage dealt before the
  enemy's next active frame.
- `run.r1` vs `r1.1` against a retreating A5 at 6 m: compare hits landed in 5 s.
- `backstep.r1` vs `roll.r1` against an A3 whiff: compare damage dealt and facing error.
- `jump.r1` vs `r1.1` against an A2 with a raised guard: compare enemy `poise_cur` delta.
- `guard.counter` vs `r1.1` after blocking an A1 swing: compare damage and stamina left.
- **FAIL** any slot that is not strictly better on its own metric in ≥70% of trials. A
  contextual attack that is never correct is a slot nobody will press twice.

**M6 — Declared-vs-observed.** Diff §A's derived table against both the declared moveset
data and the M1 measurement.
- **HARD FAIL** on any mismatch (HARNESS.md §7.4).

**M7 — Determinism.** M1 at five seeds.

### Harness extensions this method requires

1. `player.anim_slot` (shared request with RI-WPN01) — without it, M1 cannot distinguish "the
   rolling attack fired" from "a light attack fired that happens to look like one".
2. `player.vel_y` and `player.airborne_since_f` in the frame record, for M4.
3. `player.fall_height_m` — height above the last grounded frame, for `plunge`.
4. A `block` event vocabulary extension: `block_success` as a distinct event type from the
   existing `block`, carrying the blocked attack's id. `guard.counter` is unmeasurable
   without it.
5. `player.roll_tier` — the RI-CMB01 tier in force this frame, so M3 does not have to infer
   it from equip load.
6. `H.getClipTrack(clipId)` (shared request with RI-WPN03), for T3/T4 without playing every
   clip.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 contextual census / `CFS` | 30 | `CFS = 1.00`; every T5 cell exact |
| M2 window probe | 25 | Windows exact to the frame; buffer 8 f; no multi-fire; stamina drops the input |
| M3 equip-load conformance | 10 | Four tiers exact; `OVERLOADED` produces nothing; `HEAVY` capped at 16 f |
| M4 aerial rules | 10 | No rising jump attack; plunge gated on height and target; root-track landing |
| M5 situational superiority | 15 | Every slot strictly better on its own metric in ≥70% of trials |
| M6 declared-vs-observed | 10 | 100% agreement |

Max 100.

| Native | Verdict band |
|---|---|
| ≥ 88 | Meets the bar |
| 66–87 | Below bar — named remedy required |
| < 66 | Loses outright |

**Native-to-ladder mapping (SCORING.md §1.2 / BAR-CRITIQUE-01 W7):**

| Ladder | Native score |
|---|---|
| 4 | 66 |
| 6 | 79 |
| 8 | 92 |

**Hard fails regardless of score:**
- **`CFS < 1.00`** — any contextual slot falling back to the standard light attack, by any of
  T1–T4. This is the item's reason for existing.
- Any contextual slot reachable from `IDLE` (except `guardbreak`).
- Any contextual window implemented as a time in seconds rather than a frame range.
- A rising jump attack.
- Any contextual attack at `OVERLOADED`.
- Mashing producing more than one contextual attack per state (buffer violation).
- Contextual displacement produced by an impulse rather than the root track.
- A contextual slot that is a damage multiplier on `r1.1` with no separate animation — the
  same failure as `CFS < 1.00`, stated in the form a code reviewer would recognise.

**Blind pair:** hand the critic ten unlabelled 90-frame animation root-track plots — five
`r1.1` and five `roll.r1` from the same five weapons — and ask which five are the same move.
If it cannot separate them, T3 has already failed and the blind test is confirmation.

## How we lose

1. **`attack(context)` with a multiplier table.** One function, one clip, a switch on the
   player's state that scales damage and startup. Every contextual slot exists in the data,
   plays correctly, and is the light attack. This is the default implementation, it is the
   user's stated concern, and `CFS` is a binary check on exactly it.
2. **The backstep attack is never built.** It is the least-known slot in the reference games
   and the easiest to omit without anyone filing a bug. It is also the one that rewards
   reading over reacting, so its absence quietly converts the game into roll-spam. It is in
   RI-WPN01's mandatory 25 for this reason alone.
3. **Windows implemented in milliseconds.** `if (Date.now() - rollStart < 200)`. Frame-rate
   coupled, unmeasurable, and it will feel *fine* on the developer's machine. HARNESS.md §8
   D3/D4 forbid it; M2 detects it as a window that moves between runs.
4. **The window is the whole animation.** Pressing light at any point in a roll produces a
   rolling attack, including during i-frames, because bounding the window is fiddly. The
   input stops being a skill; roll-attack becomes strictly better than attack; the game
   collapses into one verb. M2's `Wgrid` is the artifact that shows it in one glance.
5. **Fat-roll gets the best window.** Nobody caps the `HEAVY` tier's 36-frame recovery, so
   the heaviest build has a three-times-wider input window than the lightest. The equip-load
   design in RI-CMB01 inverts silently and the tuning conversation that follows is about
   damage numbers.
6. **Rising jump attacks.** Trivially easy to allow, and it turns the jump attack from a
   commitment into a get-out-of-jail button that can be thrown at any moment with no landing
   risk. M4 is one line and it must be run.
7. **Plunging attacks with no height gate**, so a 0.4 m hop off a rock is a plunge. The verb
   stops being about level design, becomes the strongest attack in the game, and RI-WLD07's
   verticality work is wasted because nobody needs the high ground.
8. **Guard counter built as "attack while blocking"**, which RI-CMB02 §D.1 forbids outright.
   The correct shape needs a `block_success` event that does not exist in the trace
   vocabulary yet — so it will be built wrong, or not built, unless the harness amendment
   lands first.
9. **Slots that exist and are never correct.** All ten built, all ten with unique clips, all
   ten strictly worse than `r1.1` in every situation because nobody tuned them against a real
   enemy. `CFS` passes at 1.00 and the game plays as if none of them exist. M5 is the only
   check that catches it, it is the most expensive check in the item, and it is the one most
   likely to be skipped.
10. **The 6-frame floor is applied inconsistently.** DGR and FST are the only classes it
    binds, so it will be implemented as a special case, forgotten in the two-handed table,
    and produce a 4-frame dagger rolling attack that is unreactable — violating RI-CMB02 §E's
    stated rationale ("below this the attack is unreactable and un-trade-able") in the one
    place the corpus's own arithmetic pushed it there.

## Provenance note

`provenance: constructed`, confidence **high**. Every frame cell in §A is an arithmetic
product of RI-CMB02 §C's multipliers and RI-WPN02 §B's base rows, computed here and checkable
by hand. The backstep and guard-counter multiplier rows, the 6-frame clamp, every window in
§B, the 16-frame window cap, the 12-frame sprint requirement, the 3.0 m plunge gate, the
20-frame guard-counter window, the T1–T7 tests and `CFS` are **defined for this project**.

**Two corpus defects found while deriving this item, reported rather than silently patched:**

1. **RI-CMB02 internal contradiction.** §E requires ≥6 f startup for any player attack; §C's
   rolling-attack multiplier (×0.60) applied to §A's dagger row (6 f) yields 4 f. The two
   sections of one item disagree. Resolved here by clamping, which is a choice this item made
   and RI-CMB02's owner may override.
2. **RI-CMB02 §C has no backstep-attack row and no guard-counter row**, while RI-CMB01 §B
   fully specifies the backstep animation and RI-AI05 §7 depends on a guard-break/counter
   verb existing. Both are proposed here as new §C rows and require an amendment to RI-CMB02
   to become binding.

Grounding is `community-data`, confidence **medium**:
- Dark Souls 1 is documented as having exactly five basic attack types — R1, R2, rolling,
  jumping and running — with no weapon skills, which is the minimal contextual set §A's four
  columns extend ([Moveset — Dark Souls Wiki, Fandom](https://darksouls.fandom.com/wiki/Moveset)).
- Dark Souls II's own beginner documentation describes the running attack and the
  roll-into-attack as distinct moves triggered by pressing an attack button *during* another
  action, rather than as modified standard attacks — the state-plus-window model of §B
  ([Combat 101 — Gamer Guides](https://www.gamerguides.com/dark-souls-2/guide/beginners-guide/combat-101/exploring-your-melee-moveset)).
- Elden Ring's community motion-value tables enumerate `Running R1`, `Running R2`,
  `Rolling R1`, `Backstep R1`, `Jumping R1`, `Jumping R2` and `Guard Counter` as separate
  rows with their own values per weapon class, one-handed and two-handed — i.e. upstream
  treats each of these as a first-class attack with its own data, not as a modifier
  ([Motion Values — Elden Ring Wiki, Fextralife](https://eldenring.wiki.fextralife.com/Motion+Values);
  [Motion Values Viewer — Tarnished Traveler](https://tarnishedtraveler.com/elden-ring-motion-values-viewer/)).
  That the backstep attack appears there as its own row, in a game where most players never
  use it, is the strongest available evidence that omitting it is a real deficit and not a
  scope decision.

Cross-dependencies, and who wins on a conflict: RI-CMB02 wins on the multiplier values and
the 6 f floor; RI-CMB01 wins on the roll and backstep animation lengths and the four equip-load
tiers that set every window in §B; RI-CMB03 wins on the stamina costs; RI-CMB05 wins on poise
damage semantics; RI-AI05 wins on the archetype names in §C; RI-WLD07 owns the geometry that
makes `plunge` reachable; RI-CAM04 owns what the camera does during a locked-on rolling
attack. RI-WPN02 §B supplies the base rows and is itself subordinate to RI-CMB02.
