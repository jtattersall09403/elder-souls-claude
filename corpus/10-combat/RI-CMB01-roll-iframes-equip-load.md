---
id: RI-CMB01
title: Roll and dodge — i-frame windows, equip-load tiers, and the fat-roll threshold
kind: number
side: souls
judges: [combat.player.dodge, combat.player.equipload, combat.player.movement, combat.invulnerability, combat.input.buffer]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

The roll is the single most-executed action in a Souls fight and the one the player's hands
learn first. "Good" means: pressing dodge produces a **fixed-length animation with a fixed,
frame-counted window of invulnerability that begins a few frames after the press and ends
well before the animation does**, so that a roll is a *commitment* — you can be hit at the
start of it and you can be hit at the end of it, and the skill of the game is placing the
middle of it on top of the enemy's weapon. The player must be able to feel, without being
told, that heavier armour makes the window smaller and the recovery longer, and that
crossing the fat-roll threshold is a cliff, not a slope. A roll that is invulnerable for its
whole duration is a dash; a roll whose invulnerability is a boolean set on animation start
and cleared on animation end is not a Souls roll at all; a roll that can be interrupted or
re-issued mid-animation deletes the entire risk model.

## The reference artifact

### A. Upstream models (what the two games actually do)

> **UNIT WARNING — AMENDED wave 0 (corpus-audit), from `PROVENANCE-UPGRADE-02-SOULS.md` §0.
> The Souls columns below are in 1/30-second ticks. Ours are 60 Hz frames. THEY ARE NOT THE
> SAME UNIT AND MUST NOT BE COMPARED DIRECTLY.**
>
> Souls community frame counts are quoted at **30 fps** — in DS1, DS3 *and* Elden Ring.
> Elden Ring Reforged states it outright; DS3 corroborates it arithmetically, since the
> Carthus Bloodring is documented as raising i-frames "from 12 (.4 sec) to 16 (.533 sec)", and
> 12 ÷ 0.4 s = 30 fps exactly. **A Souls figure of N frames is 2N of ours.**
>
> DS3's 13 i-frames are **433 ms**. Our 13 i-frames are **217 ms**. The table below put both
> numbers in the same column with no unit stated, and §B's design rationale then rested on the
> comparison. That false equivalence is what this warning removes.
>
> ~~**The corpus-wide consequence, stated plainly: our combat currently runs at roughly double
> Souls wall-clock speed while looking correct on paper.**~~ Every *ratio* is preserved — §E's
> derived table is healthy, our LIGHT roll is invulnerable for 0.500 of its animation against
> DS1's fast-roll 0.458 — so the discrepancy survived every internal consistency check, every
> blind pair over frame vectors, and every M-check in every method script. It surfaced only
> when a human played it.
>
> ~~**This audit declared the unit; it did not rebase the numbers.**~~ ~~Rebasing … must be
> settled by a wave that can play the result.~~ **REBASE APPLIED — AMENDED wave 0
> (rebase-s22).** The orchestrator ruled **REBASE** (`ORCHESTRATOR-RULINGS.md` R1, now
> ARBITRATION seam **S22**), superseding the audit's *declare-only* position recorded in
> `CORPUS-COHERENCE-01.md` §9a. **Every frame count in §B, §C, §D and §E below has been
> doubled**, so that the durations they describe are correct in wall-clock at 60 Hz. The
> superseded values are kept in the `Was` columns and struck-through text below; nothing is
> deleted. Applied across `RI-CMB01`, `RI-CMB02`, `RI-CMB05`, `RI-CMB08`, `RI-AI02`, `RI-AI03`,
> `RI-WPN01`–`RI-WPN06` and `RI-CAM04` as one sweep — see
> `corpus/00-doctrine/REBASE-S22-REPORT.md`.
>
> **The unit is now stated on every figure: `f@60` means frames at our 60 Hz simulation step;
> `t@30` means a Souls community tick. A frame count with no stated framerate is a defect
> (S22).**
>
> Sanity check after the rebase, against `corpus/10-combat/data/souls-frame-data.json`:
>
> | | Upstream | Ours, before | Ours, after |
> |---|---|---|---|
> | Light-roll i-frames | DS3 13 t@30 = **433 ms** | 13 f@60 = 217 ms | **26 f@60 = 433 ms** |
> | Light-roll total | DS1 fast 24 t@30 = **800 ms** | 26 f@60 = 433 ms | **52 f@60 = 867 ms** |
> | Medium-roll total | DS1 33 t@30 = **1100 ms** | 30 f@60 = 500 ms | **60 f@60 = 1000 ms** |
> | Fat-roll total | DS1 48 t@30 = **1600 ms** | 44 f@60 = 733 ms | **88 f@60 = 1467 ms** |
>
> Note that `RI-CMB03` got this right in the one place it worked from a figure denominated in
> seconds: it took the measured 0.70 s regen pause and correctly wrote **42 f@60**. The error
> was confined to figures recalled as *frame counts* rather than as durations, and **`RI-CMB03`
> is therefore excluded from the rebase** — see S22 and R1.

| Property | Dark Souls 1 (PTDE/Remastered) **@30 fps ticks** | Dark Souls 3 **@30 fps ticks** |
|---|---|---|
| Equip-load breakpoints | **25%** (fast) / **50%** (mid) / **100%** (fat) | **30%** (light) / **70%** (medium) / **100%** (heavy/fat) |
| i-frames, light roll | 11 | 13 |
| i-frames, medium roll | 11 (more ending lag) | 13 |
| i-frames, heavy/fat roll | ~11 nominal but effectively negated by instability + lag | 12 |
| Ninja-flip (Dark Wood Grain Ring, ≤25%) | 13, instability frames removed | n/a |
| Roll stamina cost | fixed, moderate | low; chainable ~10× on a full bar |
| Community verdict | i-frames are stingy, recovery is the differentiator | i-frames are generous, cost is too cheap |

Both models are legitimate. **Neither is ours.**

### B. `ES-ROLL/1` — the canonical model for this game (BINDING)

We take **DS3's 30% / 70% breakpoints** (they read better on a stat sheet and give a real
middle tier) with **DS1's stinginess about what a roll buys you** (fewer i-frames than DS3,
a real recovery tail, a stamina cost you can run out of). Frames are at a fixed 60 Hz
simulation step. Frame indices are 1-based and inclusive.

> **AMENDED wave 0 (corpus-audit): "fewer i-frames than DS3" is true only if the units are
> ignored.** At 30 fps ticks DS3's 13 i-frames are 433 ms; our 13 were 217 ms at 60 Hz. In
> *duration* we were far stingier than either game — about half of DS1's. ~~what is **not**
> established is that 217 ms is the right number rather than an artefact of adopting tick
> counts as frame counts.~~
>
> **AMENDED wave 0 (rebase-s22): it was an artefact, and it is now corrected.** Under seam
> **S22** the ladder is rebased by doubling: `26 / 22 / 10 / 0` i-frames at 60 Hz. Our light
> roll's 26 f@60 = **433 ms** is now *exactly* DS3's 13 t@30, and §B's stated design intent
> ("DS3's breakpoints with DS1's stinginess") has to be re-read: at 26 i-frames we are **no
> longer stingier than DS3 on the light roll** — we match it, and we buy our stinginess back
> in the `MEDIUM` and `HEAVY` rows (22 and 10 against DS3's flat 13/13/12 t@30 = 26/26/24 f@60)
> and in the recovery tail. That is a real design change caused by the unit fix, and it is
> recorded rather than papered over. **This item's numbers are binding as written** — a build
> must implement **26/22/10/0 at 60 Hz** — and a builder may not improvise around them.
>
> **This item owns the equip-load ladder inside the fight, tier boundaries included**
> (ARBITRATION seam **S23**). `RI-PRG07` owns out-of-fight encumbrance and may keep finer
> granularity there provided its extra tiers have no in-fight effect.
>
> **UNDECLARED BLEND, now declared (orchestrator ruling R5).** This item pairs **DS3's 30/70
> breakpoints** with **DS1's tier-DURATION model**. In DS3, light and medium rolls are the same
> length and the light roll buys *distance* only; our ~~26 f / 30 f / 44 f~~ **52 / 60 / 88 f@60**
> ladder makes duration scale with tier, which is DS1's model. That is defensible — it makes the
> tier legible from the animation alone — but it is a third blend on top of the two §B already
> names, and it was not stated. It is now.

**`ES-ROLL/1`, REBASED — AMENDED wave 0 (rebase-s22), seam S22.** Every frame column below is
**doubled** from the pre-rebase table, which is preserved in the `Was` column. Frame windows are
mapped `[a,b] → [2a−1, 2b]`, which preserves 1-based inclusive indexing and doubles the length
exactly. **Stamina costs, ground distances and animation speed multipliers are NOT frame data
and are unchanged.**

| Tier | Equip load | Startup (vulnerable) | **i-frames** | Recovery (vulnerable) | Total | **Was (total / i-f)** | Stamina | Ground distance | Speed of animation |
|---|---|---|---|---|---|---|---|---|---|
| `LIGHT` | ≤ **30.00%** | f1–f4 (4 f@60) | **f5–f30 (26 f@60)** | f31–f52 (22 f@60) | **52 f@60 (867 ms)** | ~~26 f / 13~~ | **22** | 5.20 m | 1.00× |
| `MEDIUM` | 30.01–**70.00%** | f1–f4 (4 f@60) | **f5–f26 (22 f@60)** | f27–f60 (34 f@60) | **60 f@60 (1000 ms)** | ~~30 f / 11~~ | **26** | 4.40 m | 1.00× |
| `HEAVY` (fat roll) | 70.01–**100.00%** | f1–f6 (6 f@60) | **f7–f16 (10 f@60)** | f17–f88 (72 f@60) | **88 f@60 (1467 ms)** | ~~44 f / 5~~ | **34** | 2.60 m | 0.72× |
| `OVERLOADED` | > 100.00% | — | **0** | — | **120 f@60** stumble (2000 ms) | ~~60 f / 0~~ | **40** | 1.10 m | 0.55× |

Backstep (dodge input with no directional input):

| Tier | Startup | i-frames | Recovery | Total | **Was (total / i-f)** | Stamina | Distance |
|---|---|---|---|---|---|---|---|
| `LIGHT` / `MEDIUM` | f1–f4 | **f5–f12 (8 f@60)** | f13–f42 | 42 f@60 (700 ms) | ~~21 f / 4~~ | 14 | 2.30 m |
| `HEAVY` | f1–f6 | **0** | f7–f60 | 60 f@60 (1000 ms) | ~~30 f / 0~~ | 20 | 1.60 m |
| `OVERLOADED` | — | 0 | — | 80 f@60 (1333 ms) | ~~40 f / 0~~ | 26 | 0.70 m |

**The fat-roll threshold is 70.00%.** At 70.00% the player has 22 i-frames and a 60-frame
roll. At 70.01% they have 10 i-frames and an 88-frame roll. This discontinuity is deliberate
and must be audible/visible: the roll animation changes clip, the footfall gains a thud, and
the equip-load readout in the menu changes colour. `OVERLOADED` additionally forbids
sprinting and jump-attacks.

### C. Rules that are as binding as the numbers

1. **Invulnerability is a frame window, never a flag with a timer.** The simulation asks
   "is `anim_frame ∈ [iframe_start, iframe_end]`?" every fixed step. There is no
   `setTimeout`, no `invulnerable = true; ... invulnerable = false`, no seconds-based
   comparison anywhere on this path.
2. **I-frames grant *hit-negation*, not *hitbox removal*.** The player's hurtbox continues
   to exist and continues to be swept and tested (RI-CMB04); the overlap is detected, an
   `IFRAME_NEGATE` event is emitted, and damage/poise/status are all zeroed. This matters
   because the trace must be able to prove the dodge was *timed*, not *spatial*.
3. **A roll is uncancellable.** From press to the final recovery frame, no input changes the
   outcome. There is no roll→roll cancel, no roll→attack cancel, no turning mid-roll beyond
   the direction chosen at frame 1.
4. **Direction is latched at frame 1** from the movement-stick vector at the moment of the
   press (under lock-on, see RI-CMB06). Stick movement during frames 2–52 (`LIGHT`) is ignored.
   *(AMENDED wave 0 (rebase-s22): was "frames 2–26".)*
5. **Root motion is authoritative.** The 5.20 m of a `LIGHT` roll comes from the animation
   clip's root track, not from `velocity × dt`. The character controller consumes the root
   delta and resolves it against collision; it never adds its own translation.
6. **Input buffer = 8 f@60 (133 ms).** A dodge press during the last 8 frames of any animation
   is stored and fires on the first frame the character is actionable. A press earlier than
   that is **dropped**, not queued. Exactly one action may be buffered at a time; a later
   press overwrites the buffer.
   > **NOT REBASED — AMENDED wave 0 (rebase-s22), and this is a judgement, not an oversight.**
   > The buffer is a **wall-clock allowance for human input error**, not an animation length:
   > it exists because a player presses a few tens of milliseconds before they are actionable.
   > That error does not change because our animations got longer, so 8 f@60 = **133 ms** is
   > already the physically correct figure and doubling it to 267 ms would be inventing a more
   > forgiving game under cover of a unit fix. Recorded here because the buffer's *relative*
   > generosity does halve (8 f against a 52-frame roll rather than a 26-frame one), which is a
   > real consequence a later wave may wish to revisit with hands on the controller. Same
   > reasoning as `RI-CMB02` §E's 6 f@60 = 100 ms startup floor. S22's list does not name the
   > buffer.
7. **Insufficient stamina drops the input.** If `stamina < cost` on the frame the roll would
   start, nothing happens — no partial roll, no queued roll, no debt. (See RI-CMB03; this is
   the rule that produces the `no_stamina` drops in the RI-CMB07 exemplar.)
8. **Equip load is evaluated once, at the frame of the press**, from
   `carried_equipment_weight / max_equip_load`. Changing gear mid-roll cannot change the
   roll in flight.

### D. State machine (roll subgraph)

```mermaid
stateDiagram-v2
    [*] --> ACTIONABLE
    ACTIONABLE --> ROLL_STARTUP: dodge press AND stamina >= cost AND dir != 0
    ACTIONABLE --> BACKSTEP_STARTUP: dodge press AND stamina >= cost AND dir == 0
    ACTIONABLE --> STUMBLE: dodge press AND equip_load > 100%
    ROLL_STARTUP --> ROLL_IFRAME: anim_frame == iframe_start
    ROLL_IFRAME --> ROLL_RECOVER: anim_frame > iframe_end
    ROLL_RECOVER --> ACTIONABLE: anim_frame > total
    ROLL_RECOVER --> BUFFERED: input during last 8 f
    BUFFERED --> ACTIONABLE: consumed on first actionable frame
    ROLL_STARTUP --> HITSTUN: enemy hitbox overlap
    ROLL_RECOVER --> HITSTUN: enemy hitbox overlap
    ROLL_IFRAME --> ROLL_IFRAME: enemy hitbox overlap -> IFRAME_NEGATE
```

Note the two `HITSTUN` edges and the absence of a third. Being hit on frames 1–4 or 31–52 of
a `LIGHT` roll is the entire cost model of dodging. *(AMENDED wave 0 (rebase-s22): was
"frames 1–2 or 16–26".)*

### E. Derived quantities a critic should recompute rather than trust

**AMENDED wave 0 (rebase-s22).** Every row below is **re-derived from the rebased §B table,
not scaled** — which matters, because the rows behave differently: the fractions are
*invariant* (both terms doubled), the frame counts *double*, the stamina row is *unchanged*
(stamina is not frame data), and `rolls/second` **halves**. Anyone who "rebased" this table by
multiplying every cell by 2 would have got three of five rows wrong.

| Quantity | `LIGHT` | `MEDIUM` | `HEAVY` | Behaviour under S22 |
|---|---|---|---|---|
| Invulnerable fraction of animation | 26/52 = **0.500** | 22/60 = **0.367** | 10/88 = **0.114** | **invariant** (ratio) |
| Vulnerable frames after i-frames end | 22 f@60 | 34 f@60 | 72 f@60 | ×2 |
| Max rolls on a full 120 bar (no regen) | 5 | 4 | 3 | **unchanged** (stamina, not frames) |
| Widest enemy active window fully negated | 26 f@60 | 22 f@60 | 10 f@60 | ×2 |
| Rolls/second if chained back-to-back | **1.15** | **1.00** | **0.68** | **÷2** — a rate, not a count |

~~Pre-rebase: 13/26, 11/30, 5/44; 11/17/36 vulnerable; 13/11/5 negated; 2.31/2.00/1.36 rolls per
second.~~

Tolerances for all frame counts in §B: **±0 frames**. These are integers in a fixed-step
simulation; "close enough" is not a category. Distances: **±0.15 m**. Stamina costs: **±0**.

## Comparison method

Script: **`corpus/80-methods/m-cmb01-roll-iframes.mjs`**

Harness assumption: headless Node + Three.js sim, fixed 60 Hz step, seeded, driven by a
scripted input file (frame-indexed button/stick events), emitting the `es-combat-trace/1`
JSONL defined in RI-CMB07.

**M1 — Animation census.** For each of the 4 tiers × {8 roll directions, backstep}:
1. Set equip load to the tier's midpoint (15%, 50%, 85%, 120%).
2. Inject a dodge input on a known frame with the enemy disabled.
3. From the trace, extract `total` = frames from press to the first `ACTIONABLE` frame,
   and the contiguous run of frames with `p.invuln == 1`.
4. Report `startup = first_invuln_frame − press_frame`, `iframes = run length`,
   `recovery = total − startup − iframes`.
- **FAIL** if any value differs from §B by ≥1 frame.
- **FAIL** if `iframes` is not a single contiguous run.
- **FAIL** if `total` varies by more than 0 frames across the 8 directions.

**M2 — I-frame boundary probe (the real test).** For each tier, for each offset
`k ∈ [−12, +96]` relative to the dodge press *(AMENDED wave 0 (rebase-s22): was `[−6, +34]`;
the sweep must span the longest total, now 88 f@60 for `HEAVY`, with margin)*:
1. Reset to a seeded state, player at fixed distance, enemy scripted to activate a 1-frame
   hitbox exactly on frame `press + k`.
2. Run 60 frames. Record `hit = (player hp decreased)`.
3. Build the vector `H[k]`.
- The transition from `hit` to `no-hit` must occur **exactly** at `k = startup` and back at
  `k = startup + iframes`.
- **FAIL** on any hole (a `hit` inside the invulnerable run) or any leak (a `no-hit`
  outside it). This is the check a naive implementation fails.
- Report the measured window as `[k_first_negated, k_last_negated]` and diff against §B.

**M3 — Root-motion / skate check.** With a scripted roll on flat ground, sample world
position every frame. Compute `d[i] = |pos[i] − pos[i−1]|`.
- Fit `d[i]` against the animation clip's root-track delta for the same frame.
- **FAIL** if `max |d_sim − d_clip| > 0.02 m` on any frame (this catches velocity-integrated
  movement pretending to be root motion).
- **FAIL** if `d[i]` is constant across the animation (a constant per-frame delta is a
  translate, not root motion — a real roll's speed curve is front-loaded).
- Report total displacement and diff against §B (±0.15 m).

**M4 — Uncancellability.** Inject dodge, then on each frame `k ∈ [1, total]` inject every
other action input (attack, dodge, block, sprint, heal, item).
- **FAIL** if any input before `total − 8` changes the frame on which `ACTIONABLE` returns.
- **FAIL** if any input before `total − 8` is later observed to execute (i.e. it was queued
  rather than dropped).
- Verify buffer: an input on frame `total − 3` must execute on frame `total + 1`, ±0.

**M5 — Threshold cliff.** Sweep equip load `29.0% → 31.0%` and `69.0% → 71.0%` in 0.1%
steps, running M1 at each.
- **FAIL** if the i-frame count changes anywhere other than at exactly 30.00→30.01 and
  70.00→70.01.
- **FAIL** if any interpolation is observed (an i-frame count of 12 at 60% load means
  someone lerped a design cliff into a ramp).

## Scoring

Per-check scoring, then a gate.

| Check | Weight | Pass condition |
|---|---|---|
| M1 animation census | 20 | All 4 tiers exact to the frame |
| M2 i-frame boundary probe | 35 | Zero holes, zero leaks, boundaries exact |
| M3 root motion | 20 | Per-frame delta matches clip; non-constant curve |
| M4 uncancellability + buffer | 15 | No cancel, no queue, buffer exactly 8 f |
| M5 threshold cliff | 10 | Discontinuity at exactly 30.00% / 70.00% |

Score = sum of passed weights, 0–100.

- **≥ 90** — parity. The roll is a Souls roll.
- **70–89** — playable, gap named, remediable within a wave.
- **< 70** — **we lose.**
- **Automatic fail regardless of score** (these are AR-1 Souls-leakage violations):
  - i-frames implemented as a boolean + `setTimeout`/seconds rather than a frame window;
  - any dodge-chance, agility-roll, or skill-modified evasion (Morrowind leakage into the
    fight — S1 of ARBITRATION);
  - roll displacement produced by `velocity × dt` rather than root motion;
  - a roll that can be cancelled into another action before its final frame;
  - i-frames that scale with anything other than the four equip-load tiers (no ring, no
    stat, no difficulty setting alters the window in this corpus).

**Blind pair procedure:** give the critic two i-frame probe vectors `H[k]` from M2 with
no labels — one from our build, one generated from §B — and ask which describes a game with
a learnable dodge. If the critic picks ours, re-run with the tolerance halved and re-examine.

## How we lose

Written in advance, pessimistically. A naive browser Three.js implementation will do these:

1. **The boolean-flag roll.** `isRolling = true` on press, `false` on animation end, and
   damage skipped whenever `isRolling`. Result: 52 i-frames instead of 26, a roll that
   beats everything, and a game with no dodge skill. This is the single most likely failure
   and M2 exists to catch it.
2. **The seconds-based window.** `if (rollTime > 0.067 && rollTime < 0.50)` — which drifts
   with frame rate, gives 26 i-frames at 60 Hz and 52 at 120 Hz, and is untestable. Every
   number in this item is a frame count **with its framerate stated** for exactly this reason
   (S22). *(AMENDED wave 0 (rebase-s22).)*
   **The sibling failure, and the one that actually happened to this corpus:** a frame count
   with the framerate *omitted*, copied across a unit boundary. That is what S22 exists to
   forbid, and it cost the whole combat area a factor of two.
3. **The skate.** `mesh.position.add(dir.multiplyScalar(speed * dt))` with a roll animation
   playing on top. The feet slide, the roll covers the wrong distance, and the distance
   changes with frame rate. Three.js's `AnimationMixer` does not apply root motion by
   default — you have to extract the root track and drive the controller with it, and the
   default path is exactly the wrong one.
4. **Constant-velocity roll.** Even with root motion nominally wired, if the clip is
   authored with a linear root track the roll has no lunge; it reads as a slide. M3's
   non-constant-curve check catches this.
5. **The cancel leak.** An input queue that stores *every* press during the animation and
   flushes them all on the actionable frame, producing roll→roll→roll on a single mashed
   input and a player who is never actionable and never vulnerable.
6. **The lerped cliff.** Someone will make i-frames a function of equip-load percentage
   (`iframes = lerp(13, 5, load)`) because it "feels smoother". It deletes the build
   decision that equip load exists to create.
7. **Stamina check at the wrong time.** Checking stamina at the *end* of the roll rather
   than the start, or allowing a roll at 1 stamina and going negative. The exemplar trace
   in RI-CMB07 contains an input dropped for exactly this reason; if our trace never drops
   an input, our stamina gate is not real.
8. **Frame-rate-coupled simulation.** Running combat in `requestAnimationFrame` with a
   variable `dt`. On a 144 Hz monitor the roll becomes a different move. The fix (fixed 60 Hz
   accumulator with render interpolation) has to be in place before any of this is
   measurable at all — if it isn't, this entire item scores 0 by default.
9. **Directional roll under lock-on resolved in world space rather than camera/target
   space**, so "roll left" rolls toward a fixed compass direction. Owned by RI-CMB06 but it
   surfaces here first, as an M1 direction-variance failure.

## Provenance note

- §A (upstream DS1/DS3 numbers): `community-data`, confidence **medium**. The 25%/50%
  DS1 breakpoints, the 11 i-frames for standard DS1 rolls, the 13 for the ninja-flip, and
  the 30%/70% DS3 breakpoints with 13/13/12 i-frames come from community wiki and forum
  reporting, not from our own frame-stepping. Sources:
  [Rolling — Dark Souls Remastered Wiki](https://dark-souls-remastered.fandom.com/wiki/Rolling),
  [Equip Load — Dark Souls Wiki (Fextralife)](https://darksouls.wiki.fextralife.com/Equip+Load),
  [Dark Souls 3 weight thresholds — TheGamer](https://www.thegamer.com/dark-souls-3-weight-ratio-dodge-roll/),
  [DS3 invincibility frames — Steam community](https://steamcommunity.com/app/374320/discussions/0/1733217528121996749/).
  Community frame counts for these games are contested and version-dependent; treat ±1
  frame of uncertainty on every §A cell. **They are context, not our bar.**
- The brief that commissioned this item described the DS1 breakpoints as 30%/70%. That is a
  conflation: 30%/70% are DS3's. DS1's are 25%/50%. Both are recorded above and neither is
  binding.
- §B, §C, §D, §E (`ES-ROLL/1`, all rules, all derived values): `provenance: constructed`,
  confidence **high**. We defined these. They are binding precisely because we can measure
  them exactly, which is more than can be said for any recalled number. The `LIGHT` tier
  values (~~13 i-frames, 26 f total~~ **26 i-frames, 52 f@60 total**, 22 stamina) are the ones
  used by the RI-CMB07 exemplar trace and any change here invalidates that artifact.
- **AMENDED wave 0 (rebase-s22).** The S22 rebase changed exactly that, so **the RI-CMB07
  exemplar is invalidated** and is marked as such in its own item and in the four exemplar
  files. See `corpus/00-doctrine/REBASE-S22-REPORT.md` §4.
