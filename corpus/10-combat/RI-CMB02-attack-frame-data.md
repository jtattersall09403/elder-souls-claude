---
id: RI-CMB02
title: Attack frame data by weapon class — startup, active, recovery, and the commitment rule
kind: number
side: souls
judges: [combat.player.attack, combat.weapons.frames, combat.animation.rootmotion, combat.animation.commitment, combat.input.buffer, combat.player.tracking]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

An attack in this game is a **contract the player signs**. On the frame the button goes
down, the outcome of the next 21 to 126 frames is decided: the character will wind up,
the weapon will become dangerous for a handful of frames, and then the character will stand
there, exposed, until the animation lets go of them. Nothing the player does in between
changes it. That is the whole design: because attacking costs you your defence for a known
number of frames, choosing *when* to attack is the game.

"Good" means: every weapon class has a distinct, learnable startup you can read from the
windup pose; the active window is short (3–12 frames, never a whole swing); recovery is
longer than startup for every class; and the character's displacement during the swing comes
from the animation's root track, so a greatsword lunges 1.4 m forward because the animator
made it lunge, not because someone added a velocity impulse. A player who has fought with a
straight sword for an hour must be *wrong-footed* by an ultra greatsword, and the reason must
be numeric, not vibes.

## The reference artifact

### A. `ES-FRAMES/1` — light attack (R1), one-handed, first hit of the chain

All values at fixed 60 Hz. Frame indices 1-based, inclusive. `first_active = startup + 1`.
`Ps` (input-to-first-active, the quantity RI-AI03 consumes) `= startup + 1`.

| Class | Startup | **Ps** | Active | Recovery | **Total** | Stamina | Poise dmg | Motion value | Reach (m) | Root Δz (m) |
|---|---|---|---|---|---|---|---|---|---|---|
| Dagger | 6 | **7** | 3 | 12 | **21** | 12 | 8 | 0.72 | 1.05 | 0.15 |
| Straight sword | 12 | **13** | 5 | 20 | **37** | 20 | 22 | 1.00 | 1.95 | 0.35 |
| Spear (thrust) | 14 | **15** | 4 | 22 | **40** | 18 | 18 | 1.00 | 3.10 | 0.55 |
| Axe | 16 | **17** | 6 | 24 | **46** | 24 | 28 | 1.15 | 1.80 | 0.30 |
| Halberd | 19 | **20** | 7 | 28 | **54** | 28 | 34 | 1.25 | 2.85 | 0.45 |
| Greatsword | 22 | **23** | 8 | 33 | **63** | 32 | 42 | 1.45 | 2.60 | 0.85 |
| Ultra greatsword | 29 | **30** | 10 | 44 | **83** | 42 | 58 | 1.75 | 2.95 | 1.40 |

`Ps` for the straight sword is **13**, which is the value RI-AI03 §A cites as the reference
light-attack startup for punish-window sizing. That is not a coincidence and must not drift:
changing this cell invalidates every `P_safe` figure in the AI items.

### B. Heavy attack (R2), one-handed, uncharged

| Class | Startup | **Ps** | Active | Recovery | **Total** | Stamina | Poise dmg | Motion value | **Hyperarmour window** | Root Δz (m) |
|---|---|---|---|---|---|---|---|---|---|---|
| Dagger | 14 | 15 | 3 | 22 | **39** | 20 | 14 | 1.05 | *none* | 0.20 |
| Straight sword | 25 | **26** | 6 | 30 | **61** | 34 | 40 | 1.55 | f15–f31 | 0.60 |
| Spear | 27 | 28 | 5 | 32 | **64** | 30 | 34 | 1.60 | f17–f32 | 1.10 |
| Axe | 30 | 31 | 7 | 36 | **73** | 40 | 48 | 1.80 | f18–f37 | 0.50 |
| Halberd | 34 | 35 | 8 | 42 | **84** | 44 | 56 | 1.90 | f21–f42 | 0.70 |
| Greatsword | 40 | 41 | 10 | 48 | **98** | 50 | 70 | 2.10 | f24–f50 | 1.25 |
| Ultra greatsword | 52 | 53 | 12 | 62 | **126** | 62 | 92 | 2.60 | f32–f64 | 1.90 |

Hyperarmour windows are **derived**, not authored:
`HA window = [ ceil(0.60 × startup) , startup + active ]`. They are listed rather than left
implicit because RI-CMB05 §C consumes them, and both files must move together.

`Ps` for the straight sword R2 is **26**, matching RI-AI03's reference heavy startup.
Hyperarmour semantics are owned by RI-CMB05; the windows are listed here because they are
frame data.

### C. Modifiers (multiplicative on the base rows above)

| Modifier | Startup | Active | Recovery | Stamina | Motion value | Poise dmg | Notes |
|---|---|---|---|---|---|---|---|
| Two-handed | ×1.00 | ×1.00 | ×1.00 | ×1.15 | ×1.15 | ×1.30 | Different clip, same frame counts. Enables R1 hyperarmour on Axe (f10–f22), Greatsword (f14–f30) and Ultra greatsword (f18–f39), by the same derivation. |
| R1 chain, hit 2 | ×0.78 | ×1.00 | ×1.05 | ×1.00 | ×0.95 | ×1.00 | Rounded to nearest frame. |
| R1 chain, hit 3 | ×0.78 | ×1.00 | ×1.35 | ×1.00 | ×0.90 | ×1.00 | Chain terminates here for all classes except dagger (4). |
| Charged R2 (held) | +1…+30 f charge | ×1.00 | ×1.00 | ×1.00 | ×1.00→×1.30 | ×1.00→×1.50 | Charge frames inserted between startup and active; linear ramp. |
| Rolling attack | ×0.60 | ×1.00 | ×1.10 | ×0.85 | ×0.85 | ×0.85 | Only from frames 16–26 of a `LIGHT` roll (RI-CMB01). |
| Running attack | ×0.70 | ×1.00 | ×1.00 | ×1.10 | ×1.05 | ×1.10 | Root Δz ×2.0. |
| Jump attack | ×1.30 | ×1.25 | ×1.20 | ×1.30 | ×1.35 | ×1.80 | Forbidden at `OVERLOADED`. |
| Backstab / riposte | fixed 62 f / 78 f | — | — | 24 / 28 | crit multiplier | breaks poise | Owned by RI-CMB05. |

Rounding rule: `round-half-up` to integer frames, applied once, to the final product. A
straight-sword R1 chain hit 2 has startup `round(12 × 0.78) = 9`, `Ps = 10`.

> **AMENDED wave 0 (corpus-audit) — §C and §E contradicted each other (queue B4).**
> §E requires **≥ 6 f startup for any player attack**. §A's dagger R1 startup is **6 f**.
> §C's rolling-attack multiplier is **×0.60**, giving `round(6 × 0.60) = 4 f` — **below this
> item's own floor**, on the fastest weapon in the game, in the most-used contextual attack.
> The same product breaks the running multiplier (×0.70 → 4 f) and, for the fist class
> `RI-WPN02` adds at 5 f R1, both.
>
> **The floor wins; the multiplier clamps to it.** §E's 6 f is a *readability* rule — below
> 100 ms an attack is unreactable and un-trade-able — and a readability floor that a modifier
> can silently pass through is not a floor.
>
> **`startup_final = max(6, round(base × modifier))`**, applied after the rounding rule above
> and after **every** §C startup multiplier. The clamp is not silent: a class whose contextual
> startup clamps must be listed in the check's output, so a critic can see that the class has
> **lost its contextual speed advantage** rather than gained a hidden one. In practice this
> binds only the two fastest classes — `DGR` and `FST` — and only on rolling, running and
> chain-hit-2/3 startups. Resolved as `RI-WPN04` requested; recorded in
> `constants.json` as `combat.min_startup_frames`, owner `RI-CMB02`.

**Two contextual rows added wave 0**, requested by `RI-WPN04` (`corpus/12-weapons/`), which
needs them to specify per-class contextual attacks and had no base row to multiply:

| Modifier | Startup | Active | Recovery | Stamina | Motion value | Poise dmg | Notes |
|---|---|---|---|---|---|---|---|
| Backstep attack | ×0.65 | ×1.00 | ×0.95 | ×1.00 | ×1.00 | ×1.00 | Root Δz ×1.40 (backward). Subject to the 6 f clamp. |
| Guard counter | ×0.85 | ×1.00 | ×1.05 | ×1.00 | ×1.30 | ×1.60 | Only within 12 f of a successful block. Subject to the 6 f clamp. |

**The two-handed row is strengthened.** ~~"Different clip, same frame counts."~~ Same frame
counts is the *floor*, not the specification: `RI-WPN06` requires two-handing to produce a
**divergent moveset**, not a reskin, and this row as written licensed exactly the reskin it
warns about elsewhere. The frame multipliers stay ×1.00 — two-handing must not become a
strictly-faster mode — and `RI-WPN06` §`weapon.stance.twohand` owns which *slots* change.

### D. The commitment rule (as binding as any number)

```
STARTUP  : hard-committed. No input has any effect except the combo buffer.
ACTIVE   : hard-committed. No input has any effect except the combo buffer.
RECOVERY : split.
           frames [1 .. ceil(0.45 * recovery)]        -> hard-committed
           frames [ceil(0.45 * recovery)+1 .. end]    -> DODGE-cancellable only
```

Worked: straight-sword R1 recovery is 20 f, occupying animation frames 18–37.
`ceil(0.45 × 20) = 9`, so animation frames 18–26 are hard, and a dodge input on animation
frames **27–37** cancels directly into a roll. An *attack* input in that same window does
**not** cancel — it enters the combo buffer and fires the chain's next hit on frame 38.

Additional binding rules:

1. **No block-cancel, ever.** Raising the shield during any part of an attack is impossible.
   There is no "attack into instant guard".
2. **No turn during active frames.** Player yaw is frozen from `first_active` to the end of
   the animation. Steering during startup is capped (RI-CMB06: 180°/s for the first 40% of
   startup, 45°/s for the next 40%, 0°/s for the last 20% and everything after).
3. **Root motion is authoritative for all displacement.** `Root Δz` in §A/§B is the total
   forward displacement produced by the clip's root track, measured on flat ground with no
   collision. The controller consumes the root delta; it never adds translation of its own
   during an attack. An ultra greatsword R2 covers 1.90 m because the animation says so.
4. **One hitbox activation per swing per target.** A target hit on active frame 1 cannot be
   hit again by the same swing on active frame 2 (RI-CMB04 owns the swept-volume test; this
   is the de-dup rule).
5. **The combo buffer is 8 frames wide and holds exactly one action** (same buffer as
   RI-CMB01). An attack press earlier than `total − 8` is dropped, not stored. Mashing R1
   through a whole ultra-greatsword swing produces exactly one follow-up, not four.
6. **Insufficient stamina drops the input.** Not queued, not partially executed. Stamina is
   deducted in full on `first_frame`, not spread across the animation.
7. **Frame data is identical in PvE and PvP-equivalent contexts**, identical at every level,
   and identical for every player build. Nothing in the stat sheet changes a frame count.
   Skills change *scaling* (S3 of ARBITRATION), never frames and never to-hit.

### E. Readability contract (the derived numbers that make it fair)

| Quantity | Requirement | Rationale |
|---|---|---|
| `recovery / startup`, light attacks | ≥ **1.40** for every class | Lights pay on the back end, or spam dominates |
| `recovery / startup`, heavy attacks | ≥ **1.15** for every class | Heavies already pay on the front end in startup; demanding 1.4 there would make them unusable rather than committal |
| Startup delta, light vs heavy of the same class | ≥ **8 f** | R2 must be a visibly different decision, not a slightly slower R1 |
| `active / total` | ≤ 0.16 for every row | A swing is dangerous briefly; a long active window is a hitbox, not an attack |
| Startup spread across the 7 classes, R1 | ≥ 23 f (dagger 6 → UGS 29) | Weapon class must be legible from timing alone |
| Startup delta between adjacent classes, R1 and R2 separately | ≥ **2 f**, **scoped to the 7-class spine of §A/§B only** (amended wave 0) | Adjacent classes must be distinguishable by timing alone. Verified over the spine: R1 startups 6/12/14/16/19/22/29 → deltas 6,2,2,3,3,7; R2 startups 14/25/27/30/34/40/52 → deltas 11,2,3,4,6,12 |
| Minimum startup, any player attack | ≥ 6 f (100 ms), **and §C's startup multipliers clamp to it** (amended wave 0) | Below this the attack is unreactable and un-trade-able. See the clamp rule at the end of §C |

> **The ≥2 f adjacent-class rule is arithmetically impossible at 15 classes, and is therefore
> scoped (amended wave 0, corpus-audit; requested by `RI-WPN02`).** `RI-WPN02` defines **15**
> weapon classes. Fourteen gaps of ≥2 f across an R1 startup range of 6 → 29 f needs **28 f**
> of range and there are **23**. The rule cannot be satisfied by any assignment, so as written
> it failed the roster automatically.
>
> **Ruling: the rule binds the 7-class spine that §A and §B actually tabulate** — dagger,
> straight sword, spear, axe, halberd, greatsword, ultra greatsword — where it is verified
> above and where it does the work it was written for. The other 8 classes are separated by
> `RI-WPN02`'s **12-dimensional fingerprint distance** (`D_min ≥ 1.6` PASS, `< 1.0` HARD FAIL),
> which is the right instrument at that population: with 15 classes, timing alone cannot carry
> differentiation and was never going to. Timing separation within the spine, fingerprint
> separation across the roster — the intent survives, the arithmetic now closes.
>
> **`RI-CMB02` remains the owner of frame data.** `RI-WPN02`'s 8 additional class rows are
> adopted into `ES-FRAMES/1` by that item and cited, not restated, here.
| Maximum `Ps` for the intended punish weapon | ≤ 15 f | RI-AI03's absolute `P_safe` floor is 15 f; a weapon with `Ps > 15` cannot punish the tightest legal window |

All frame counts in §A and §B: tolerance **±0 frames**. Motion values: ±0.02. Root Δz:
±0.05 m. Modifier products in §C: ±0 frames after the stated rounding rule.

## Comparison method

Script: **`corpus/80-methods/m-cmb02-frame-data.mjs`**

Harness: headless Node + Three.js, fixed 60 Hz, seeded, scripted frame-indexed inputs,
emitting `es-combat-trace/1` (RI-CMB07). A static training-dummy enemy with a known hurtbox
at a known distance is required.

**M1 — Frame census, all 14 base rows.** For each class × {R1, R2}, one-handed, from idle:
1. Equip the class, teleport to a marked distance, face the dummy.
2. Inject a single attack press on a known frame. Emit trace to animation end.
3. From the trace compute:
   - `startup` = (first frame with `p.hitbox_active == 1`) − (press frame) − 1
   - `active` = length of the contiguous `hitbox_active == 1` run
   - `total` = (first `ACTIONABLE` frame) − (press frame)
   - `recovery` = `total − startup − active`
- **FAIL** if any cell differs from §A/§B by ≥1 frame.
- **FAIL** if `hitbox_active` is not a single contiguous run per swing.
- **FAIL** if `active == total` (a hitbox that lives for the whole animation).

**M2 — Commitment probe.** For each class × {R1, R2}, for each frame `k ∈ [1, total]`:
1. Inject the attack, then inject *each* of {dodge, attack, block, sprint, heal, use-item,
   two-hand toggle} on frame `k` in separate runs.
2. Record the frame on which the player next becomes `ACTIONABLE`, and whether the injected
   action executed.
- Build the matrix `C[action][k] ∈ {ignored, buffered, cancelled}`.
- **FAIL** if any `cancelled` appears for `k ≤ startup + active`.
- **FAIL** if `block` or `sprint` ever produces `cancelled`.
- **FAIL** if `dodge` produces `cancelled` outside frames
  `[startup + active + ceil(0.45×recovery) + 1, total]`.
- **FAIL** if `buffered` appears for any `k < total − 8`.
- Report `C` as a compact ASCII grid; it is the single most diagnostic artifact this method
  produces and should be pasted into the verdict.

**M3 — Root motion fidelity.** Per class × {R1, R2}, on flat ground, no collision:
1. Sample world position each frame; compute per-frame delta.
2. Load the clip's root track for the same clip and sample at the same frame indices.
- **FAIL** if `max |Δ_sim − Δ_clip| > 0.02 m` on any frame.
- **FAIL** if the per-frame delta is constant over the swing (a linear ramp is a translate).
- Report total forward displacement, diff against `Root Δz` (±0.05 m).
- **FAIL** if displacement changes when the sim is run at a 30 Hz or 120 Hz *render* rate
  (the fixed step must make this invariant).

**M4 — Modifier arithmetic.** For each entry in §C, run M1 under that modifier and compare
against `round(base × multiplier)`.
- **FAIL** on any ≥1 frame discrepancy.
- Specifically verify the chain: mash R1 for 300 frames with a greatsword and assert exactly
  3 swings occur with startups `21, 16, 16` and the chain terminates.

**M5 — Readability contract.** Recompute every row of §E from the M1 census.
- **FAIL** on any violated requirement. These are ratios, so they cannot be satisfied by
  accident and cannot be fudged by adjusting one number.

**M6 — Determinism.** Run M1 ten times with ten different seeds.
- **FAIL** if any frame count varies at all. There is no randomness on this path — no damage
  roll, no timing jitter, no to-hit check (ARBITRATION S1).

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 frame census | 25 | All 14 rows exact |
| M2 commitment probe | 30 | No illegal cancels, buffer exactly 8 f, dodge-cancel window exact |
| M3 root motion | 20 | Per-frame match to clip, non-linear, frame-rate invariant |
| M4 modifier arithmetic | 10 | All §C products exact |
| M5 readability contract | 10 | All six §E rows satisfied |
| M6 determinism | 5 | Zero variance across seeds |

- **≥ 90** — parity.
- **70–89** — gap named, remediable.
- **< 70** — **we lose.**
- **Automatic fail regardless of score** (AR-1 violations):
  - any attack cancellable during startup or active frames;
  - any to-hit roll, miss chance, or skill-modified accuracy anywhere in the attack path;
  - damage sampled from a random range (damage is deterministic; variance comes from
    geometry and timing only);
  - attack displacement produced by velocity/impulse rather than the root track;
  - a single "attack" animation shared by all weapon classes with the numbers swapped —
    if the ultra greatsword's swing does not *look* 83 frames long, the frame data is a lie
    the player cannot read;
  - free instant turning during active frames.

**Blind pair:** hand the critic two `C[action][k]` commitment grids and two frame censuses,
unlabelled, and ask which game rewards patience. Record the blind pick before the reveal.

## How we lose

1. **The mixer-plays-a-clip, code-does-the-damage split.** The most likely shape of our
   first implementation: `mixer.play('attack')` and, on a `setTimeout`/`mixer` event,
   `enemy.hp -= dmg`. The animation becomes decoration and the frame data becomes fiction.
   M1 catches it because `hitbox_active` will either never appear in the trace or will be a
   single frame.
2. **Attack cancel by input.** Because it is easy and feels responsive to let a new input
   interrupt the current animation, and because Three.js `AnimationMixer.crossFadeTo` makes
   it a one-liner. This deletes the entire risk model in a single commit. M2 exists solely
   for this.
3. **Everything is 20 frames.** Seven weapon classes sharing one clip length with different
   damage numbers. The startup spread requirement in §E exists because this is the path of
   least resistance and it makes weapon choice cosmetic.
4. **The teleporting greatsword.** Root motion not extracted, so the UGS R2's 1.90 m lunge
   never happens; the player swings in place and the attack has no reach, so someone
   compensates by growing the hitbox — which then hits things behind walls.
5. **Frame-rate coupling.** `dt`-scaled animation with damage applied on a wall-clock timer:
   at 144 Hz the swing lands earlier and the recovery is shorter. Every number here becomes
   unmeasurable. This is the failure that makes *all eight* CMB items score 0, so it is the
   first thing a critic should check.
6. **Recovery that is shorter than startup**, because recovery feels bad to authors and
   great to players. `recovery/startup ≥ 1.4` in §E is the tripwire.
7. **The infinite mash chain.** An input queue with no cap, so holding R1 produces an
   unbroken stream of swings and stamina becomes the only limit. §D.5 and M4's explicit
   3-swing assertion catch it.
8. **Hitbox active for the whole animation**, because activating and deactivating on precise
   frames is fiddly. Result: walking into an enemy during your own recovery damages it.
   §E's `active/total ≤ 0.16` is the tripwire.
9. **Turn-to-face on every frame of the attack.** A `lookAt(target)` in the update loop
   means the ultra greatsword tracks the player through the entire swing, spacing becomes
   meaningless, and the corresponding enemy behaviour becomes unfair. §D.2 and RI-AI02's
   tracking cutoff both forbid it.
10. **Damage applied on the frame of *input*** rather than the frame of geometric overlap,
    which makes every weapon feel identical and makes reach a cosmetic property.

## Provenance note

`provenance: constructed`, confidence **high**. Every frame count, motion value, stamina
cost, poise-damage figure, root displacement, modifier multiplier and readability threshold
in this item was defined for this project. No cell is a measurement of any FromSoftware
title and none should be cited as one.

Grounding is `canonical-recall` (confidence **medium**) of the following observed properties
of Dark Souls 1/3 and Elden Ring, which shaped the *shape* of the table but not its values:
daggers swing in a small fraction of the time an ultra greatsword does; active windows are a
small minority of any swing's duration; heavy attacks carry hyperarmour on large weapons and
not on small ones; two-handing changes poise damage more than it changes timing; recovery is
partially roll-cancellable but startup and active frames never are; and R1 chains shorten
their own startup while lengthening the terminal recovery.

Two cells are load-bearing across the corpus and are pinned by agreement rather than by
taste: straight-sword R1 `Ps = 13` and R2 `Ps = 26`, which RI-AI03 consumes when sizing
punish windows. Any future amendment to those two cells must be made as an explicit corpus
amendment touching both items.
