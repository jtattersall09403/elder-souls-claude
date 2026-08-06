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
down, the outcome of the next 42 to 252 frames (0.70 s to 4.20 s at 60 Hz) is decided: the
character will wind up,
the weapon will become dangerous for a handful of frames, and then the character will stand
there, exposed, until the animation lets go of them. Nothing the player does in between
changes it. That is the whole design: because attacking costs you your defence for a known
number of frames, choosing *when* to attack is the game.

"Good" means: every weapon class has a distinct, learnable startup you can read from the
windup pose; the active window is short (6–24 f@60, never a whole swing); recovery is
longer than startup for every class; and the character's displacement during the swing comes
from the animation's root track, so a greatsword lunges 1.4 m forward because the animator
made it lunge, not because someone added a velocity impulse. A player who has fought with a
straight sword for an hour must be *wrong-footed* by an ultra greatsword, and the reason must
be numeric, not vibes.

## The reference artifact

### A. `ES-FRAMES/1` — light attack (R1), one-handed, first hit of the chain

All values at fixed 60 Hz — written **`f@60`** throughout. Frame indices 1-based, inclusive.
`first_active = startup + 1`. `Ps` (input-to-first-active, the quantity RI-AI03 consumes)
`= startup + 1`.

> **REBASED — AMENDED wave 0 (rebase-s22), ARBITRATION seam S22.** The whole of `ES-FRAMES/1`
> is **doubled**. The corpus adopted Souls community frame counts, which are quoted in 1/30 s
> ticks, as if they were 60 Hz frames, so every attack in this table ran at **half its intended
> wall-clock length**. The pre-rebase values are preserved in the `Was` columns. **A frame count
> with no stated framerate is now a defect (S22).**
>
> What did **not** move: stamina, poise damage, motion values, reach and root displacement are
> not frame data and are unchanged. `Ps` is **re-derived, not doubled** — see the note under the
> table.

| Class | Startup | **Ps** | Active | Recovery | **Total** | **Was (st/act/rec/tot)** | Stamina | Poise dmg | Motion value | Reach (m) | Root Δz (m) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Dagger | 12 | **13** | 6 | 24 | **42 f@60 (700 ms)** | ~~6/3/12/21~~ | 12 | 8 | 0.72 | 1.05 | 0.15 |
| Straight sword | 24 | **25** | 10 | 40 | **74 f@60 (1233 ms)** | ~~12/5/20/37~~ | 20 | 22 | 1.00 | 1.95 | 0.35 |
| Spear (thrust) | 28 | **29** | 8 | 44 | **80 f@60 (1333 ms)** | ~~14/4/22/40~~ | 18 | 18 | 1.00 | 3.10 | 0.55 |
| Axe | 32 | **33** | 12 | 48 | **92 f@60 (1533 ms)** | ~~16/6/24/46~~ | 24 | 28 | 1.15 | 1.80 | 0.30 |
| Halberd | 38 | **39** | 14 | 56 | **108 f@60 (1800 ms)** | ~~19/7/28/54~~ | 28 | 34 | 1.25 | 2.85 | 0.45 |
| Greatsword | 44 | **45** | 16 | 66 | **126 f@60 (2100 ms)** | ~~22/8/33/63~~ | 32 | 42 | 1.45 | 2.60 | 0.85 |
| Ultra greatsword | 58 | **59** | 20 | 88 | **166 f@60 (2767 ms)** | ~~29/10/44/83~~ | 42 | 58 | 1.75 | 2.95 | 1.40 |

> **`Ps` is re-derived, not scaled — AMENDED wave 0 (rebase-s22).** `Ps = startup + 1`, and the
> `+1` is a **frame-index convention** (the first *active* frame is the one after the last
> startup frame), **not a duration**. Doubling `Ps` directly would have given the straight sword
> 26 and implied a startup of 25. The correct answer is `Ps = 2×12 + 1 = ` **25**. The one-frame
> difference is 17 ms and it is exactly the kind of error a mechanical ×2 sweep produces.

`Ps` for the straight sword is **25 f@60** *(was 13)*, which is the value RI-AI03 §A cites as
the reference light-attack startup for punish-window sizing. That is not a coincidence and must
not drift: changing this cell invalidates every `P_safe` figure in the AI items. RI-AI03 has
been amended in the same sweep.

### B. Heavy attack (R2), one-handed, uncharged

**REBASED — AMENDED wave 0 (rebase-s22).** Same treatment. Hyperarmour windows are
**re-derived from the formula on the rebased startups, not scaled** — and four of the seven
land on a different frame than a naive doubling would have given (marked ⚠).

| Class | Startup | **Ps** | Active | Recovery | **Total** | **Was (st/act/rec/tot)** | Stamina | Poise dmg | Motion value | **Hyperarmour window** | Root Δz (m) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Dagger | 28 | 29 | 6 | 44 | **78 f@60** | ~~14/3/22/39~~ | 20 | 14 | 1.05 | *none* | 0.20 |
| Straight sword | 50 | **51** | 12 | 60 | **122 f@60** | ~~25/6/30/61~~ | 34 | 40 | 1.55 | f30–f62 *(was f15–f31)* | 0.60 |
| Spear | 54 | 55 | 10 | 64 | **128 f@60** | ~~27/5/32/64~~ | 30 | 34 | 1.60 | ⚠ f33–f64 *(was f17–f32)* | 1.10 |
| Axe | 60 | 61 | 14 | 72 | **146 f@60** | ~~30/7/36/73~~ | 40 | 48 | 1.80 | f36–f74 *(was f18–f37)* | 0.50 |
| Halberd | 68 | 69 | 16 | 84 | **168 f@60** | ~~34/8/42/84~~ | 44 | 56 | 1.90 | ⚠ f41–f84 *(was f21–f42)* | 0.70 |
| Greatsword | 80 | 81 | 20 | 96 | **196 f@60** | ~~40/10/48/98~~ | 50 | 70 | 2.10 | f48–f100 *(was f24–f50)* | 1.25 |
| Ultra greatsword | 104 | 105 | 24 | 124 | **252 f@60** | ~~52/12/62/126~~ | 62 | 92 | 2.60 | ⚠ f63–f128 *(was f32–f64)* | 1.90 |

Hyperarmour windows are **derived**, not authored:
`HA window = [ ceil(0.60 × startup) , startup + active ]`. They are listed rather than left
implicit because RI-CMB05 §C consumes them, and both files must move together.

> **⚠ Why three windows are not double their old value — AMENDED wave 0 (rebase-s22).**
> `ceil()` does not commute with doubling. `ceil(0.60 × 27) = 17`, but `ceil(0.60 × 54) = 33`,
> not 34. The same happens for the halberd (41, not 42), the ultra greatsword (63, not 64) and
> the dagger's (unused) row (17, not 18). **These windows were re-derived from the formula, as
> S22 requires, not multiplied.** Anyone diffing this table against a ×2 of the old one will
> find those four cells and must not "correct" them back.

`Ps` for the straight sword R2 is **51 f@60** *(was 26)*, matching RI-AI03's reference heavy
startup as amended. Hyperarmour semantics are owned by RI-CMB05; the windows are listed here
because they are frame data.

### C. Modifiers (multiplicative on the base rows above)

**AMENDED wave 0 (rebase-s22).** The **multipliers themselves are dimensionless and do not
move**; what moves is the *base rows they multiply* (§A/§B, rebased) and the handful of cells
in this section that are themselves frame counts. Those are marked and struck through.

| Modifier | Startup | Active | Recovery | Stamina | Motion value | Poise dmg | Notes |
|---|---|---|---|---|---|---|---|
| Two-handed | ×1.00 | ×1.00 | ×1.00 | ×1.15 | ×1.15 | ×1.30 | Different clip, same frame counts. Enables R1 hyperarmour on Axe (**f20–f44**), Greatsword (**⚠ f27–f60**) and Ultra greatsword (**⚠ f35–f78**), by the same derivation. ~~f10–f22 / f14–f30 / f18–f39~~ — *re-derived, not scaled: `ceil(0.60 × 44) = 27`, not 28; `ceil(0.60 × 58) = 35`, not 36.* |
| R1 chain, hit 2 | ×0.78 | ×1.00 | ×1.05 | ×1.00 | ×0.95 | ×1.00 | Rounded to nearest frame. Multiplier unchanged. |
| R1 chain, hit 3 | ×0.78 | ×1.00 | ×1.35 | ×1.00 | ×0.90 | ×1.00 | Chain terminates here for all classes except dagger (4). Multiplier unchanged. |
| Charged R2 (held) | **+1…+60 f@60** charge ~~+1…+30 f~~ | ×1.00 | ×1.00 | ×1.00 | ×1.00→×1.30 | ×1.00→×1.50 | Charge frames inserted between startup and active; linear ramp. **Rebased**: a full charge is 1.000 s, not 500 ms. |
| Rolling attack | ×0.60 | ×1.00 | ×1.10 | ×0.85 | ×0.85 | ×0.85 | Only from **frames 31–52** of a `LIGHT` roll (RI-CMB01, rebased). ~~frames 16–26~~ |
| Running attack | ×0.70 | ×1.00 | ×1.00 | ×1.10 | ×1.05 | ×1.10 | Root Δz ×2.0. |
| Jump attack | ×1.30 | ×1.25 | ×1.20 | ×1.30 | ×1.35 | ×1.80 | Forbidden at `OVERLOADED`. |
| Backstab / riposte | fixed **124 f@60 / 156 f@60** ~~62 f / 78 f~~ | — | — | 24 / 28 | crit multiplier | breaks poise | Owned by RI-CMB05, rebased there in the same sweep. |

Rounding rule: `round-half-up` to integer frames, applied once, to the final product. A
straight-sword R1 chain hit 2 has startup `round(24 × 0.78) = 19`, `Ps = 20`.
*(AMENDED wave 0 (rebase-s22): was `round(12 × 0.78) = 9`, `Ps = 10`.)*

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
>
> > **AMENDED wave 0 (rebase-s22): the floor stays at 6 f@60 = 100 ms, and after the rebase it
> > no longer binds anything.** The floor is **not** a Souls-inherited frame count; it is a
> > *human reaction-time* bar with its wall-clock value stated in the row itself ("100 ms").
> > Reaction time does not change because our animation table was in the wrong unit, so
> > doubling this cell to 12 f = 200 ms would have been **inventing a stricter design rule
> > under cover of a unit fix**. It is the same class of figure as `RI-CMB03`'s 42 f (0.70 s),
> > which S22 explicitly protects.
> >
> > The consequence is worth stating plainly, because it is the opposite of what a mechanical
> > sweep would produce: with the base rows doubled, the smallest contextual product in the
> > game is now `DGR` rolling attack at `round(12 × 0.60) =` **7 f@60 (117 ms)**, and `FST`'s
> > (5 f base → 10 f) rolling attack at `round(10 × 0.60) =` **6 f@60**, exactly on the floor.
> > **Nothing clamps any more.** `DGR` and `FST` therefore *keep* the contextual speed
> > advantage the clamp was taking away from them, which is a better outcome than the one the
> > clamp amendment settled for. The clamp stays in force as a guard against future retuning;
> > it is simply no longer load-bearing. `RI-WPN04` §A's ⌊6⌋ markers are removed accordingly.

**Two contextual rows added wave 0**, requested by `RI-WPN04` (`corpus/12-weapons/`), which
needs them to specify per-class contextual attacks and had no base row to multiply:

| Modifier | Startup | Active | Recovery | Stamina | Motion value | Poise dmg | Notes |
|---|---|---|---|---|---|---|---|
| Backstep attack | ×0.65 | ×1.00 | ×0.95 | ×1.00 | ×1.00 | ×1.00 | Root Δz ×1.40 (backward). Subject to the 6 f@60 clamp (now non-binding). |
| Guard counter | ×0.85 | ×1.00 | ×1.05 | ×1.00 | ×1.30 | ×1.60 | Only within **24 f@60** of a successful block ~~12 f~~ — **rebased**. Subject to the 6 f@60 clamp (now non-binding). |

> **⚠ PRE-EXISTING CONTRADICTION, found while rebasing, NOT caused by the rebase, and NOT
> resolved here — AMENDED wave 0 (rebase-s22).** This row says the guard-counter window is
> **12 f** (now 24 f@60). `RI-WPN01` §Contextual triggers, `RI-WPN04` §B and `RI-WPN06` §E all
> say **20 f** (now 40 f@60). Those are two different numbers for one window, and they were
> two different numbers before this rebase; the corpus audit did not catch it. This sweep
> **doubled both faithfully rather than silently picking a winner**, because choosing between
> them is a design decision and not a unit correction. For the record, the corpus's own
> precedence resolves it mechanically if anyone wants it resolved: `RI-WPN01`'s own
> cross-dependency clause says *"RI-CMB02 wins on frame values"*, which makes **24 f@60** the
> presumptive value and leaves the three weapons items owing an amendment. Filed in
> `REBASE-S22-REPORT.md` §7 as found-not-fixed.

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

Worked *(AMENDED wave 0 (rebase-s22) — **re-derived from the rebased row, not scaled**; the
`0.45` is a ratio and does not move)*: straight-sword R1 recovery is **40 f@60**, occupying
animation frames **35–74**. `ceil(0.45 × 40) = 18`, so animation frames **35–52** are hard, and
a dodge input on animation frames **53–74** cancels directly into a roll. An *attack* input in
that same window does **not** cancel — it enters the combo buffer and fires the chain's next hit
on frame **75**.
~~Was: recovery 20 f, animation frames 18–37; `ceil(0.45 × 20) = 9`; hard 18–26; dodge-cancel
27–37; next hit on 38.~~

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
5. **The combo buffer is 8 f@60 (133 ms) wide and holds exactly one action** (same buffer as
   RI-CMB01 §C.6, which carries the reasoning for why S22 does **not** double it). An attack
   press earlier than `total − 8` is dropped, not stored. Mashing R1 through a whole
   ultra-greatsword swing produces exactly one follow-up, not four.
6. **Insufficient stamina drops the input.** Not queued, not partially executed. Stamina is
   deducted in full on `first_frame`, not spread across the animation.
7. **Frame data is identical in PvE and PvP-equivalent contexts**, identical at every level,
   and identical for every player build. Nothing in the stat sheet changes a frame count.
   Skills change *scaling* (S3 of ARBITRATION), never frames and never to-hit.

### E. Readability contract (the derived numbers that make it fair)

**AMENDED wave 0 (rebase-s22) — each row is classified.** Under a time-base rebase these rows
do **not** all behave the same way, and treating them uniformly is the single easiest way to
mis-apply S22. A **ratio** row is invariant (both terms doubled). A **separation** row measures
a distance between two of our own rebased frame counts, so it doubles or the constraint silently
weakens by half. A **wall-clock** row is anchored to human perception and does not move at all.

| Quantity | Requirement | Under S22 | Rationale |
|---|---|---|---|
| `recovery / startup`, light attacks | ≥ **1.40** for every class | **ratio — invariant** | Lights pay on the back end, or spam dominates |
| `recovery / startup`, heavy attacks | ≥ **1.15** for every class | **ratio — invariant** | Heavies already pay on the front end in startup; demanding 1.4 there would make them unusable rather than committal |
| Startup delta, light vs heavy of the same class | ≥ **16 f@60** ~~8 f~~ | **separation — ×2** | R2 must be a visibly different decision, not a slightly slower R1. Verified: deltas 16/26/26/28/30/36/46 |
| `active / total` | ≤ 0.16 for every row | **ratio — invariant** | A swing is dangerous briefly; a long active window is a hitbox, not an attack |
| Startup spread across the 7 classes, R1 | ≥ **46 f@60** ~~23 f~~ (dagger 12 → UGS 58) | **separation — ×2** | Weapon class must be legible from timing alone |
| Startup delta between adjacent classes, R1 and R2 separately | ≥ **4 f@60** ~~2 f~~, **scoped to the 7-class spine of §A/§B only** (amended wave 0) | **separation — ×2** | Adjacent classes must be distinguishable by timing alone. Re-verified over the rebased spine: R1 startups 12/24/28/32/38/44/58 → deltas 12,4,4,6,6,14; R2 startups 28/50/54/60/68/80/104 → deltas 22,4,6,8,12,24. ~~R1 6/12/14/16/19/22/29 → 6,2,2,3,3,7; R2 14/25/27/30/34/40/52 → 11,2,3,4,6,12~~ |
| Minimum startup, any player attack | ≥ **6 f@60 = 100 ms** (unchanged), **and §C's startup multipliers clamp to it** (amended wave 0) | **wall-clock — NOT rebased** | Below this the attack is unreactable and un-trade-able. This bar is a property of the human, not of the animation table; see the boxed note at the end of §C for why doubling it would have been wrong and what it costs |

> **The ≥2 f adjacent-class rule is arithmetically impossible at 15 classes, and is therefore
> scoped (amended wave 0, corpus-audit; requested by `RI-WPN02`).** `RI-WPN02` defines **15**
> weapon classes. Fourteen gaps of ≥2 f across an R1 startup range of 6 → 29 f needs **28 f**
> of range and there are **23**. The rule cannot be satisfied by any assignment, so as written
> it failed the roster automatically.
>
> *(AMENDED wave 0 (rebase-s22): the impossibility survives the rebase unchanged, as it must —
> it is a statement about ratios of separations. Fourteen gaps of ≥4 f@60 across 12 → 58 f@60
> need **56 f** of range and there are **46**. Still impossible; the scoping ruling below still
> stands, for the same reason.)*
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
| Maximum `Ps` for the intended punish weapon | ≤ **29 f@60** ~~15 f~~ | **re-derived, not scaled.** RI-AI03's absolute `P_safe` floor is **29 f@60** (itself re-derived as `Ps` 25 + 4 f of slack — a naive ×2 would have said 30); a weapon with `Ps > 29` cannot punish the tightest legal window. Straight sword R1 `Ps` = 25 ✓ |

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
  3 swings occur with startups `44, 34, 34` (`round(44×0.78) = 34`) and the chain terminates.
  *(AMENDED wave 0 (rebase-s22): was `21, 16, 16`.)*

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
    if the ultra greatsword's swing does not *look* 166 f@60 long, the frame data is a lie
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
taste: straight-sword R1 **`Ps = 25 f@60`** and R2 **`Ps = 51 f@60`** ~~`Ps = 13` / `Ps = 26`~~,
which RI-AI03 consumes when sizing punish windows. Any future amendment to those two cells must
be made as an explicit corpus amendment touching both items.

> **AMENDED wave 0 (rebase-s22).** That amendment has been made: seam **S22** rebased the whole
> of §A/§B by doubling the upstream tick counts, and `RI-AI03` §A/§B/§E was amended in the same
> sweep. Both `Ps` cells are **re-derived** (`startup + 1`), not scaled — 25 and 51, not 26 and
> 52 — because the `+1` is an index, not a duration. Full record:
> `corpus/00-doctrine/REBASE-S22-REPORT.md`.

**Unit discipline (S22).** Every frame count in this item now carries `f@60`. This item owns
`combat.framerate_hz` and `combat.min_startup_frames` in `constants.json`; a frame figure
anywhere in the corpus that does not state its framerate is a defect against S22, regardless of
whether its value happens to be right.
