# REBASE-S22-REPORT — applying seam S22 (the 30 Hz → 60 Hz rebase) and seam S24 (the biome sweep)

> **Author:** `rebase-s22`, wave 0. **Authority:** `ARBITRATION.md` seams **S22** and **S24**;
> `orchestration/ORCHESTRATOR-RULINGS.md` **R1** and **R7**; scope table at
> `CORPUS-COHERENCE-01.md` **§14**. **Standing rules followed:** `CORPUS-COHERENCE-01.md` §0 —
> smallest edit, never delete reasoning, keep deliberate divergences and say they are deliberate,
> mark every amendment greppably. **Marker: `AMENDED wave 0 (rebase-s22)`.**
>
> This document is the ledger. Every figure moved, every figure deliberately **not** moved, every
> edit refused and why, and four consequences the ruling did not anticipate.

---

## 1. The two jobs, in one line each

1. **S22 / R1 — REBASE.** Souls community frame counts are quoted in **1/30 s ticks** (DS1, DS3
   and Elden Ring alike, verified arithmetically in
   `corpus/10-combat/data/souls-frame-data.json`). Our simulation is a fixed **60 Hz** step. The
   corpus adopted the upstream *numbers* without converting the *unit*, so every combat duration
   was **half its true wall-clock length**. Every ratio stayed internally consistent, so it passed
   every internal check. **Applied as one sweep across 14 reference items.**
2. **S24 / R7 — the biome sweep.** The world is not "entirely standing water"; it is thirteen
   distinct regions. **Applied as a prose-tone sweep across 7 corpus files and 2 briefs.**

**The headline sanity check, against the verified upstream figures:**

| | Upstream | Ours, before | Ours, after |
|---|---|---|---|
| Light-roll i-frames | DS3 **13 t@30 = 433 ms** | 13 f@60 = 217 ms | **26 f@60 = 433 ms** ✔ exact |
| Light-roll total | DS1 fast **24 t@30 = 800 ms** | 26 f@60 = 433 ms | **52 f@60 = 867 ms** ✔ +8% |
| Medium-roll total | DS1 **33 t@30 = 1100 ms** | 30 f@60 = 500 ms | **60 f@60 = 1000 ms** ✔ −9% |
| Fat-roll total | DS1 **48 t@30 = 1600 ms** | 44 f@60 = 733 ms | **88 f@60 = 1467 ms** ✔ −8% |
| Parry active window | recalled **8–12 t@30 = 267–400 ms** | 7–12 f@60 = 117–200 ms | **14–24 f@60 = 233–400 ms** ✔ |

The rebase lands the roll on DS3's i-frame duration *exactly* and within ±9% of DS1's roll
durations. **It has been applied correctly.**

---

## 2. The classification rule that governs every edit

S22 says "double the upstream tick count". Applied naively that is wrong in four different ways,
so every figure was first classified. **This table is the method, and a future amendment should
reuse it.**

| Class | Test | Treatment | Examples |
|---|---|---|---|
| **Upstream-derived frame count** | an animation length, window, index or frame delta, recalled or authored as a bare frame count | **×2** | roll i-frames, attack startup/active/recovery, stagger, parry, backstab, drink |
| **Frame window `[a,b]`** | a 1-based inclusive index range | **`[2a−1, 2b]`** — preserves indexing, doubles the length exactly | i-frames `f3–f15` → `f5–f30` |
| **Derived from a formula** | computed from a rebased input | **re-derive the formula on the rebased input** — never scale the output | hyperarmour windows, `Ps`, `b1`/`Tc`, the `P_safe` floor |
| **Ratio / fraction / percentage** | dimensionless, or a frame count over a frame count | **unchanged** | `PWR`, `recovery/startup`, `active/total`, committed-frame ratio |
| **Separation bar in frames** | a required distance between two of our own rebased frame counts | **×2**, or the constraint silently halves in strength | startup spread, adjacent-class delta, `Tc ≤ W − 4` |
| **Rate** | per second, per minute, degrees per second | **unchanged** — but anything expressed *per minute of play* **halves** | 45 stamina/s, 20 poise/s, 180 °/s, attacks/min |
| **Wall-clock human bar** | anchored to human perception, with its ms value stated | **NOT rebased** | 6 f = 100 ms startup floor, 8 f input buffer, 12 f windup floor |
| **Not frame data at all** | stamina, damage, HP, metres, degrees, counts | **unchanged** | roll distance 5.20 m, roll stamina 22, 45° yaw cap |

---

## 3. Every file touched by JOB 1, with before and after

**14 reference items rebased · 1 flagged-only · 1 invalidated · 4 data files flagged · 3 doctrine
files updated. 22 files in total for Job 1.**

### 3.1 `corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md` — the roll ladder

| Tier | Startup | i-frames | Recovery | Total | Was |
|---|---|---|---|---|---|
| `LIGHT` | f1–f4 (4) | **f5–f30 (26)** | f31–f52 (22) | **52 f@60 (867 ms)** | 2 / 13 / 11 / 26 |
| `MEDIUM` | f1–f4 (4) | **f5–f26 (22)** | f27–f60 (34) | **60 f@60 (1000 ms)** | 2 / 11 / 17 / 30 |
| `HEAVY` | f1–f6 (6) | **f7–f16 (10)** | f17–f88 (72) | **88 f@60 (1467 ms)** | 3 / 5 / 36 / 44 |
| `OVERLOADED` | — | **0** | — | **120 f@60** | — / 0 / — / 60 |

Backstep `LIGHT`/`MEDIUM` 21 → **42 f@60**, i-frames f3–f6 → **f5–f12**; `HEAVY` 30 → **60**;
`OVERLOADED` 40 → **80**. M2's probe sweep `[−6, +34]` → **`[−12, +96]`**.

**Unchanged, and stated as unchanged in the item:** all four equip-load breakpoints (30/70/100%),
all four roll stamina costs (22/26/34/40), all four ground distances (5.20/4.40/2.60/1.10 m), all
four animation-speed multipliers.

**§E re-derived, not scaled — three of five rows behave differently:**

| Quantity | Before | After | Behaviour |
|---|---|---|---|
| Invulnerable fraction | 0.500 / 0.367 / 0.114 | **0.500 / 0.367 / 0.114** | **invariant** |
| Vulnerable frames after i-frames | 11 / 17 / 36 | **22 / 34 / 72** | ×2 |
| Max rolls on a full 120 bar | 5 / 4 / 3 | **5 / 4 / 3** | **unchanged** (stamina) |
| Widest active window negated | 13 / 11 / 5 f | **26 / 22 / 10 f** | ×2 |
| Rolls per second, chained | 2.31 / 2.00 / 1.36 | **1.15 / 1.00 / 0.68** | **÷2** |

**A design consequence recorded rather than hidden.** §B's rationale was "DS3's breakpoints with
DS1's stinginess — *fewer i-frames than DS3*". At 26 i-frames we now **match** DS3's light roll
exactly rather than undercutting it; the stinginess moves into the `MEDIUM` and `HEAVY` rows
(22 and 10, against DS3's flat 26/26/24 f@60) and into the recovery tail. That is a real change in
what the item claims, caused by the unit fix, and it is written into §B rather than left implied.

### 3.2 `corpus/10-combat/RI-CMB02-attack-frame-data.md` — the attack table

**§A, light attack (R1), one-handed** — `startup / active / recovery / total`:

| Class | Before | After | `Ps` before → after |
|---|---|---|---|
| Dagger | 6/3/12/21 | **12/6/24/42** | 7 → **13** |
| Straight sword | 12/5/20/37 | **24/10/40/74** | 13 → **25** |
| Spear | 14/4/22/40 | **28/8/44/80** | 15 → **29** |
| Axe | 16/6/24/46 | **32/12/48/92** | 17 → **33** |
| Halberd | 19/7/28/54 | **38/14/56/108** | 20 → **39** |
| Greatsword | 22/8/33/63 | **44/16/66/126** | 23 → **45** |
| Ultra greatsword | 29/10/44/83 | **58/20/88/166** | 30 → **59** |

**§B, heavy attack (R2)** — `startup / active / recovery / total` and the hyperarmour window:

| Class | Before | After | HA before → after |
|---|---|---|---|
| Dagger | 14/3/22/39 | **28/6/44/78** | *none* |
| Straight sword | 25/6/30/61 | **50/12/60/122** | f15–f31 → **f30–f62** |
| Spear | 27/5/32/64 | **54/10/64/128** | f17–f32 → **⚠ f33–f64** |
| Axe | 30/7/36/73 | **60/14/72/146** | f18–f37 → **f36–f74** |
| Halberd | 34/8/42/84 | **68/16/84/168** | f21–f42 → **⚠ f41–f84** |
| Greatsword | 40/10/48/98 | **80/20/96/196** | f24–f50 → **f48–f100** |
| Ultra greatsword | 52/12/62/126 | **104/24/124/252** | f32–f64 → **⚠ f63–f128** |

Two-handed R1 hyperarmour: Axe f10–f22 → **f20–f44**; Greatsword f14–f30 → **⚠ f27–f60**; UGS
f18–f39 → **⚠ f35–f78**.

**§C:** charged R2 hold `+1…+30 f` → **`+1…+60 f@60`**; rolling-attack window "frames 16–26 of a
`LIGHT` roll" → **"frames 31–52"**; guard-counter window 12 f → **24 f@60**; backstab/riposte
62 f / 78 f → **124 / 156 f@60**. Rounding worked example `round(12 × 0.78) = 9` →
`round(24 × 0.78) = 19`. Mash-chain assertion `21, 16, 16` → **`44, 34, 34`**.

**§D:** commitment worked example re-derived — recovery 40 f@60 occupying animation frames
**35–74**, `ceil(0.45 × 40) = 18` so **35–52 hard, 53–74 dodge-cancellable**, next chain hit on
**75**. (Was: 20 f, frames 18–37, hard 18–26, cancel 27–37, next on 38.)

**§E, classified per row:** the two `recovery/startup` ratios and `active/total` — **invariant**.
Light-vs-heavy startup delta 8 → **16 f@60**. Startup spread 23 → **46 f@60**. Adjacent-class
delta 2 → **4 f@60**. Max punish `Ps` 15 → **29 f@60**. **Minimum startup 6 f = 100 ms —
unchanged** (see §5).

### 3.3 `corpus/10-combat/RI-CMB05-poise-stagger-criticals.md`

Stagger tiers 16/22/32/48 → **32/44/64/96 f@60**; Massive knockdown getup +30 f → **+60**, its
i-frames 8 → **16**. Backstab 62 f → **124 f@60**, invuln f8–f54 → **f15–f108**, damage frame 30
→ **60**, getup 24 f → **48**, getup i-frames 6 → **12**. Parry animations 34/32/40 →
**68/64/80 f@60**; active windows f5–f13, f3–f14, f8–f14 → **f9–f26, f5–f28, f15–f28**; whiff
recovery 21/18/26 → **42/36/52**. `PARRIED` 28 f → **56 f@60**, riposte-able f4–f26 → **f7–f52**.
Riposte 78 f → **156 f@60**, invuln f10–f68 → **f19–f136**, damage frame 40 → **80**.
Hyperarmour windows re-derived to match `RI-CMB02` §B.

**NOT rebased, and stated inline:** the poise pool arithmetic, `poise_resist`, `poise_health_max`,
all four poise-damage thresholds (1–19 / 20–39 / 40–69 / ≥70), the regeneration **rate** (20/s),
the regeneration **delay** (90 f@60 = 1.500 s — authored as a duration), every HA pool size, and
every geometric condition of the backstab (±35°, 1.20 m, ±45°). §E's trade arithmetic is entirely
poise quantities and is untouched.

### 3.4 `corpus/10-combat/RI-CMB08-healing-flask.md`

Drink total 65 f (1.083 s) → **130 f@60 (2.167 s)**; phases 1–21 / 22–52 / 53–65 → **1–42 /
43–104 / 105–130**; heal ramp 31 → **62 f@60**; `heal_secure_frames` 52 → **104**; the enemy-heal
commitment floor 52 → **104**; the cancel window 59–65 → **117–130**; the movement and turn-rate
windows 1–52 → **1–104**; M4's interrupt probes at frames 10 / 37 / 60 → **20 / 74 / 120**.
The `P_safe ≥ 60` heal-window requirement → **`≥ 120 f@60`**, and `RI-AI03` §C amended to match.

**Unchanged:** every heal percentage and HP total, the charge count, the `heal_pct` formula. The
per-frame HP column was **recomputed** (`HP / 62`), not scaled — it *halves*, because the same
total is now spread over twice as many frames. The 42 f stamina-regen re-arm is left alone
(`RI-CMB03`).

### 3.5 `corpus/10-combat/RI-AI02-telegraph-doctrine.md` — **the independent-vs-derived question**

The brief asked which of these are independent bars and which are derived ratios. **They are not
homogeneous, and the answer is per column:**

| Figure | Verdict | Treatment |
|---|---|---|
| `Min W` per severity S0–S7 | **independent bar**, authored beside the player table so the windup is long enough to *see and answer with a roll* — and the roll now takes twice as long | **×2**: 12/16/24/34/45/40/24 → **24/32/48/68/90/80/48 f@60** |
| The **12 f absolute floor** | **wall-clock human bar** — its own provenance note derives it as *"at 60 fps, 12 frames is 200 ms, at the edge of simple visual reaction time"* | **NOT rebased**, stays 12 f@60 = 200 ms |
| `Min W (ms)` | derived | recomputed: 200/267/400/567/750/667/400 → **400/533/800/1133/1500/1333/800** |
| Target W bands | independent bar | ×2 |
| `Min f_sil` | independent bar | ×2: 6/8/10/12/14/12/10 → **12/16/20/24/28/24/20** |
| `Max Tc` as a **fraction of W** | **derived ratio** | **unchanged** (0.75 / 0.70 / 0.65 / 0.60 / 0.55 / 0.50 / 0.70) |
| `Tc ≤ W − 4` | separation between two rebased counts | **×2 → `Tc ≤ W − 8`** |
| §C yaw ceilings (°/s) and budgets (°) | rates and angles | **NOT rebased** |
| §D pose distance 0.35 | dimensionless | unchanged |
| §F `INFANTRY` worked moveset | derived from the above | every column ×2, `Tc ≤ W − 8` re-verified for all six moves |
| M1 headline "median W < 14 fails" | bar against **our** rebased table | ×2 → **< 28 f@60** |
| M7's `+6 f` human recognition allowance | wall-clock | **NOT rebased** |
| M7's `≥ 6 f` reaction-budget slack | bar against rebased windups | **×2 → ≥ 12 f@60** |

**A consequence worth naming:** before the rebase the `S0 Chip` minimum (12 f) and the absolute
floor (12 f) were the same number, which concealed that they are different *kinds* of number.
They now separate — S0 is 24 f@60, the floor is 12 f@60 — and the floor becomes what it always
claimed to be: a backstop no legitimate attack approaches.

### 3.6 `corpus/10-combat/RI-AI03-punish-windows.md` — **the same question, different answers**

| Figure | Verdict | Treatment |
|---|---|---|
| `Ps` reference values | **derived** from `RI-CMB02`, and `Ps = startup + 1` | **re-derived**: 13 → **25**, 26 → **51** — *not* 26 and 52 |
| `safety_margin` | independent bar in frames | ×2 → **6 f@60** |
| `PWR` and **every** PWR threshold, band and CV cap | **dimensionless ratio** | **unchanged** |
| `Min P_safe` per class | independent bar in frames | ×2: 20/22/26/24/30/18/16/15 → **40/44/52/48/60/36/32/29** |
| The **absolute `P_safe` floor** | derived from its own stated derivation `Ps + slack` | **re-derived: 25 + 4 = 29 f@60** — a naive ×2 says 30 and is one frame wrong in the row the item calls absolute |
| §C `P_safe ≥ 30` / `≥ 60` | derived against `RI-CMB08` | ×2 → **60** and **120 f@60**; 120 against `heal_secure_frames = 104` leaves the same 16 f of slack the old pair left |
| §D exceptions: 180 f phase transition, 40 f grab recovery, `P_safe ≥ 40` utility | frame counts | ×2 → **360 / 80 / 80 f@60** |
| M1 `Rc < 12` fail, `stdev(Rc) > 3` | bars against rebased recoveries | ×2 → **24** and **6 f@60** |
| M3 optimal roll input at `W − 8` | separation | ×2 → **`W − 16`** |
| **`t_reach`** | **locomotion time** over an unchanged distance at an unchanged m/s on an unchanged clock | **NOT rebased** — see §7.3 |

**`PWR` does not move at all.** It is `P_safe / (W + A + Rc)` and every term doubles. That is
precisely why the defect survived a whole wave: the metric this item is built around is blind to
it. `PWR` for all six `INFANTRY` moves is identical before and after — 0.553 / 0.488 / 0.531 /
0.541 / 0.490 / 0.533.

### 3.7 `corpus/12-weapons/RI-WPN01`–`RI-WPN06`

- **`RI-WPN01`** — states no frame values of its own; `charge_max_f` 1–30 → **1–60 f@60**,
  guard-counter 20 → **40 f@60**, M2's 12-frame trigger tolerance → **24 f@60**. The `moveset.json`
  frame-field contract now says explicitly that a moveset authored pre-rebase is wrong by 2×.
- **`RI-WPN02`** — all 15 class rows doubled (R1 startup 6…29 → **12…58**, R1 total 21…83 →
  **42…166**, R2 startup 14…52 → **28…104**, R2 total 39…126 → **78…252**; BOW draw 24 → **48**,
  aimed 24+45 → **48+90**, totals 46/118 → **92/236**). All nine 1h-R2 hyperarmour windows
  re-derived (six differ from a naive ×2). Derived constraints: the three ratios **unchanged**;
  R2−R1 ≥ 8 → **≥ 16 f@60**; spread ≥ 23 → **≥ 46 f@60**; arc-sweep and reach spreads unchanged.
- **`RI-WPN03`** — `art.1` Hist-sap lunge 62 → **124 f@60**; rusted-levy +4 f recovery → **+8**;
  marsh-guard 2 f faster → **4 f**; the `DEV` parameter-override threshold ≥3 f → **≥6 f@60**.
- **`RI-WPN04`** — the whole `ES-CONTEXT/1` 14×5 table **re-derived** (multipliers applied to the
  rebased bases, `round-half-up` once each — *not* the old cells doubled). All windows re-derived
  from `RI-CMB01`: `roll.r1` `LIGHT` f16–f26 → **f31–f52**, `MEDIUM` f14–f29 → **f27–f58**,
  `HEAVY` f9–f24 → **f17–f48**; the fat-roll cap 16 f → **32 f@60**; `backstep.r1` f7–f21 →
  **f13–f42**, `HEAVY` f4–f19 → **f7–f38**; sprint hold ≥12 → **≥24 f@60**.
- **`RI-WPN05`** — both hitstop grids doubled (light flesh 2 → **4 f@60 = 67 ms**; ultra stone
  14 → **28 f@60 = 467 ms**); victim hitstop +2/+1 → **+4/+2**; deflect recovery +8 → **+16 f@60**;
  weapon trail 6 → **12 f@60**; camera-shake decay `hitstop+4` → **`hitstop+8`**; the `ILS`
  spread bar ≥4 → **≥8 f@60**. Knockback metres, material multipliers and every §E ratio
  unchanged.
- **`RI-WPN06`** — stance switch 18 → **36 f@60**; `TDV` frame-delta clause ≥3 → **≥6 f@60**;
  all four parry rows copied from the rebased `RI-CMB05` §D; guard-counter 20 → **40 f@60**.
  Block angles, stability, absorption and stamina unchanged.

### 3.8 `corpus/15-camera/RI-CAM04-locked-movement-directional-roll-soft-lock.md`

`Tc = min(floor(0.80 W), W − 4)` → **`W − 8`**. Both per-class steering tables **re-derived** from
the rebased `W` (R1: dagger `W` 6→12, `Tc` 2→**4**; UGS `W` 29→58, `Tc` 23→**46**. R2: SSW `W`
25→50, `Tc` 20→**40**; UGS `W` 52→104, `Tc` 41→**83**). Charged R2 +30 → **+60 f@60**. Sprint
handoff 6 f and every °/s rate **NOT rebased**.

### 3.9 `corpus/10-combat/RI-CMB03-stamina-economy.md` — **no number changed**

Left alone exactly as S22 and R1 require. The 42 f (0.70 s) pause, 45/s regen, 0.75/frame slope,
every stamina cost and the whole block formula stand. **One figure flagged, not fixed** — see §7.1.
§E's `Frames at exactly 0 stamina` band is marked provisional (it is a frame count) while every
other band in §E is a percentage or a count and remains binding.

### 3.10 Doctrine and registry

- `ARBITRATION.md` §1's I-frame-accounting row and §2's S22 entry now say the rebase is
  **applied**, and mandate the `f@60` / `t@30` notation.
- `constants.json`: `combat.souls_tick_hz`'s `open_design_question` is **resolved**, with an
  explicit `not_rebased` list and a `known_open` pointer; `combat.equipload_tiers` restated at
  26/22/10/0 i-frames and 52/60/88/120 totals; `combat.min_startup_frames` and
  `combat.framerate_hz` annotated.
- `CORPUS-COHERENCE-01.md` §14: R1's "NOT applied — the single largest outstanding item in the
  corpus" is struck and marked applied; R7's "NOT APPLIED" likewise.

---

## 4. The `RI-CMB07` decision — **INVALIDATED, not regenerated**

**Decision: mark invalidated, loudly and machine-visibly, with a precise regeneration
worklist.** The ruling permits either; this is the honest one at this budget.

**What was done.** All four artifacts carry an `INVALIDATED` block:
`RI-CMB07-exemplar-trace.segments.jsonl`, `RI-CMB07-exemplar-frames-150-265.jsonl` and
`RI-CMB07-exemplar-frames-990-1125.jsonl` each have it as the **first field of their `META`
record**, so a harness that loads one fails loudly rather than silently diffing against a wrong
fixture; `RI-CMB07-exemplar-scenario.json` has it at the root, with an eleven-line
`regeneration_worklist`. `RI-CMB07` itself gains a **§0** status block. All four files still parse.

**Why not a mechanical `f → 2f` dilation of the trace.** It would produce an artifact that is
wrong in exactly the place this exemplar exists to be right. **Three things do not dilate:**

1. **Stamina.** Regen is 45/s and the delay is 42 f@60, and `RI-CMB03` is excluded from S22. A
   doubled timeline is twice as long in wall-clock and therefore regenerates **twice as much
   stamina**. Rows 15–19 and 28 — the entire stamina economy, and the whole point of §C's failure
   beat — would come out wrong, and the single dropped input row 28 makes **mandatory** might not
   occur at all.
2. **Locomotion.** 2.0 m/s over an unchanged arena: approach and spacing cost the same frames as
   before while every animation around them doubled.
3. **`GUARD_BREAK`.** 40 f in `RI-CMB03`, unrebased, sitting next to a stagger that doubled from
   22 to 44. §C's eight lines are a worked demonstration of precisely that interaction.

Regeneration therefore means **re-running the authored 54-input / 18-action script against the
rebased constants**, which is a fresh authoring job, not a transform. Producing a
plausible-looking trace that had not actually been simulated would be worse than producing none.

**The gap ledger.** `corpus/90-verdicts/GAP-LEDGER.{json,md}` is a **generated** file —
`tools/gap-ledger.mjs` builds it from verdicts' `biggest_gap`, and its own header forbids
hand-editing. There are no verdicts yet (`verdicts read: 0`), so filing there would require
fabricating a verdict, which `SCORING.md` §5 exists to prevent. **The gap is filed in the two
hand-authored places a builder reads first**: `RI-CMB07` §0 and this report. **The first critic to
touch `combat.trace` must open it as its `biggest_gap`**, at which point the ledger picks it up
automatically. Acceptance condition is stated in `RI-CMB07` §0.

**What survives and is still binding:** `es-combat-trace/1`, `es-combat-scenario/1`, the record
types, field layouts, closed enums, segment encoding and expansion rule, the RI-AI01 join, and the
*definitions* of all 29 statistics. **None of that is frame data.** M0 and M4 are unaffected.

---

## 5. Figures deliberately NOT rebased — the refused edits

Each of these would have been doubled by a mechanical sweep. Each is recorded in its own item
with the reasoning, so a later reader does not "fix" it.

| Figure | Item | Why not |
|---|---|---|
| **42 f (0.70 s) stamina-regen pause** | `RI-CMB03` §A | Derived from a figure denominated in seconds at 60 Hz. The one place the conversion was done right. **S22 protects it by name.** |
| **6 f = 100 ms minimum startup** | `RI-CMB02` §E | A human reaction-time bar with its wall-clock value stated in the row. Reaction time did not change when our tables were corrected. Doubling it to 200 ms would be inventing a stricter design rule under cover of a unit fix — **and would have clamped `DGR` and `FST`'s contextual attacks to exactly their base startup, destroying the speed advantage the clamp amendment was worried about.** |
| **8 f = 133 ms input/combo buffer** | `RI-CMB01` §C.6, `RI-CMB02` §D.5 | A wall-clock allowance for human input error, not an animation length. Its *relative* generosity does halve; that is recorded as a thing a later wave may revisit with hands on a controller. S22's list does not name it. |
| **90 f = 1.500 s poise-regen delay**, 20/s poise rate | `RI-CMB05` §A | Authored as a duration; the rate is per-second and unit-invariant. |
| **12 f = 200 ms absolute windup floor** | `RI-AI02` §B | Its own provenance note derives it from a reaction-budget argument at 60 fps. Its *severity rows* did rebase. |
| **`t_reach`** | `RI-AI03` §E | Locomotion time: unchanged distance, unchanged m/s, unchanged clock. |
| **45° global yaw cap**, all °/s ceilings, all yaw budgets | `RI-CAM04` §D, `RI-AI02` §C | Degrees and degrees-per-second. `180 °/s ÷ 60 Hz = 3.00 °/frame` was and remains correct. |
| **6 f sprint-handoff return** | `RI-CAM04` §B | A responsiveness bar in wall-clock. |
| Every ratio, fraction, percentage, stamina cost, damage figure, poise quantity, metre and degree in the corpus | all | Not frame data. |

**Also refused, with reasons:**

- **Resolving the 12-f-vs-20-f guard-counter collision** (§7.2). Rebased faithfully on both sides
  (24 and 40 f@60) and flagged. Choosing between them is a design decision, not a unit correction,
  and silently retuning three weapons items under cover of a rebase is exactly the laundering the
  audit's standing rules forbid.
- **Rebasing `RI-CMB03` §D's `GUARD_BREAK`** (§7.1). It is an animation length that S22's
  exclusion does not reason about, but overriding an explicit exclusion in a seam ruling is the
  doctrine owner's call. Flagged in three places with a concrete recommendation.
- **Rebasing `RI-CMB06`** (§7.4). Not in S22's list; its §D worked example now disagrees with
  `RI-CAM04`. Flagged in `RI-CAM04` §D.
- **Inventing six region palettes in `RI-VIS05` §C** (§6). Naming the gap is a coherence sweep's
  job; authoring seven-slot colour specifications is the item's.
- **Adding capture slots to `RI-VIS02`** (§6). Would leave dangling reference pairs.

---

## 6. JOB 2 — the S24 biome sweep

Swept with `corpus/50-world/black-marsh-map-source.jpg` and `corpus/50-world/regions.json` open.
`regions.json` defines **thirteen** regions, each with `palette_hex`, `flora`, `fauna`,
`architecture`, `ambient_audio`, `weather`, `hazard` and an `only_here`. **7 corpus files and 2
briefs corrected; 6 files inspected and deliberately left alone.**

### 6.1 Corrected

| File | What was wrong | Correction |
|---|---|---|
| **`corpus/70-visual/RI-VIS05`** §Bar | *"Black Marsh is standing water, rot, root and the Hist. Therefore … **everything is wet**"* — **the root of the item's entire derivation chain**, so everything downstream inherited it | Struck and replaced with a **two-column per-region chain** (wetland vs dry/high), keeping the mechanism, which is sound. Province-wide claims retained: nothing quarried *by people*, the xanmeer is the one built thing |
| **`RI-VIS05` §C** | Specifies palettes for **seven** regions (Hixinoct Fen, The Rootways, Xal-Meeru, The Chitin Reach, Blackrot Mire, Hist Grove, Ashen Coast) — **none of which appears in `regions.json`**, and all seven of which are wetland, canopy or ruin. A build implementing exactly this ships a world that is entirely swamp with a recoloured fog | Rescoped as **region-*type*** palettes; `regions.json` named as owner; **six missing palettes named as an open gap** (Valus Ridge, Stone Wastes, Stone Forest, Clay Moor, Crimson Coast, Salt Hills); `RI-WLD04`'s blind test named as the enforcement. **Not invented here** |
| **`RI-VIS05` §C** water note | *"Water is not blue anywhere"* read as though every region has water | Rescoped to hue-not-ubiquity, with an explicit warning not to add water planes so the rule has something to bind to. Added: **the two seas must not share a material**; **the Crimson Coast's red cannot be produced by any swatch in the table** |
| **`RI-VIS05` §D1** | Three plant families — MANGROVE/CYPRESS, FUNGAL, AQUATIC/PARASITIC — and *"every plant asset must belong to exactly one"*. **No legal family for a thorn-pine, a rime-grass or a petrified trunk**, making five regions unbuildable | Added a fourth family, **XERIC/MINERAL**, with the inverse material signature (dry-matte, no subsurface, no wet-line). D2/D3 apply to it unchanged |
| **`RI-VIS05` §D4** | *"Marsh fauna … often translucent or wet-glossy"* as a province-wide rule | Rescoped: wet-gloss is a wetland signature. `regions.json` puts **mountain chitin-hounds** on Valus Ridge, where the read is dry and dust-matte |
| **`RI-VIS05` §F** | Forbidden-forms list bans **"pine forests"** and **"mountains with snow caps"** — but `regions.json` gives Valus Ridge *"stunted thorn-pine"* and *"cloud BELOW the player on high paths"*, and `RI-WLD11` gives the Salt Hills the only cold nights in Argonia. **The list contradicted the binding map** | Narrowed to *"generic conifer forest"* and *"the Skyrim/Tolkien snow-capped peak"*, with the `RI-VIS07` test restated: it fails if the honest answer is "a pine forest", it passes if it is "cold thorn-scrub on humming rock" |
| **`RI-VIS05` §E, §G** | Silhouette vocabulary had no entry for open-sky rock; materials table said **"Standing water \| everywhere"** | Added **Dry-stacked and wind-cut** vocabulary; rescoped standing water to the wetland regions and added four materials — **fired clay, bare rock/cliff-lichen, petrified wood, salt crust** |
| **`RI-VIS05` "How we lose"** | Named the green trap but not its subtler sibling | Added **"the thirteen-tints-of-one-swamp trap"**, and the note that `ForbiddenHits` cannot detect it because none of the tints is forbidden — only `RI-WLD04`'s blind test can |
| **`corpus/70-visual/RI-VIS04`** §7 | *"our most likely and most damaging single failure because **Black Marsh is made of standing water**"* | Rescoped to the water-bearing regions; M12 must report **`N/A — region has no water`** for the five dry regions rather than scoring 0 or skipping; two seas must not share a material |
| **`RI-VIS04`** How-we-lose | *"**Black Marsh is 70% vegetation**"* | Rescoped, with the observation that the arid regions punish the *opposite* failure — a quad billboard reads worst of all against open sky |
| **`corpus/70-visual/RI-VIS08`** | *"Black Marsh is mangrove roots, boardwalks and ziggurat steps"* as the IK test terrain | Rescoped to *"in some regions, and cliff paths, scree, fired-clay crack networks and salt terraces in others"* — the dry regions are the harsher IK test, having no water surface to hide a floating foot |
| **`corpus/87-audio/RI-AUD03`** | *"Black Marsh is thirteen regions and **twelve of them are swamps**"*, and *"Black Marsh is loud. It is a swamp full of animals"* | Both corrected. **The item's own §B table is exemplary** — it quotes `regions.json` verbatim for all thirteen — so the prose and the table disagreed and the table was right. "Absence is a layer" restated for dry regions |
| **`orchestration/briefs/holes.md`** | *"**Our entire world is standing water**"* — the orchestrator misstatement R7 names, still live in a brief a future agent would read | Corrected in place with the thirteen regions and the `RI-WLD10` §7 water-class figures |
| **`orchestration/briefs/travel.md`** | *"**this world is a marsh** — water travel should be primary"* | Rescoped to the wetland and coastal regions; a network that is all barges fails S24 as surely as an all-swamp palette |

### 6.2 Flagged, not changed

- **`corpus/70-visual/RI-VIS02`** — six of eight capture slots are wetland or interior
  (`exterior_marsh_dusk`, `exterior_marsh_noon`, `water_edge`, `foliage_dense`,
  `interior_rootway`, `xanmeer_vista`), so **no capture exercises the dry and high half of the
  world**, which poses genuinely different fidelity problems (long-sightline aerial perspective,
  hard sun with no canopy diffusion, dry-matte materials). Adding slots without the matching
  `REF-M` entries — which requires finding, citing and analysing new source imagery — would leave
  dangling pairs. **The gap belongs to that item: one arid/high-altitude reference and an
  `exterior_ridge_noon` slot.**

### 6.3 Inspected and correctly region-scoped — no edit made

Per the brief's instruction not to manufacture edits, these were checked and left alone, and it is
worth recording that they are **models of what S24 asks for**:

- **`corpus/50-world/regions.json`** — thirteen regions, each with nine identity axes. The
  binding source, and it is complete.
- **`corpus/50-world/RI-WLD10-the-water-model.md`** — cites S24 in its own opening, states *"Black
  Marsh is the name, not the terrain"*, gives a **per-region water-class index** (13 rows), and
  says outright *"the tide is not a global shader and this is a hard rule … five regions have a
  tide, eight do not"*. It calls its own §7 *"the table that fails a globally-swampy world"*.
- **`corpus/50-world/RI-WLD11-environmental-hazards.md`** — per-region hazards, and names
  *"everything is swamp with a recoloured fog"* as the hazard-shaped failure it exists to prevent.
- **`corpus/50-world/RI-WLD04-region-identity.md`** — thirteen regions with per-region palettes,
  and names *"one green swamp"* and *"thirteen tints of the same swamp"* as failure modes.
- **`corpus/50-world/RI-WLD05-strangeness-bar.md`** — per-region strangeness census; uses "generic
  swamp" only as the named failure mode.
- **`corpus/87-audio/RI-AUD03` §B** — thirteen regional briefs quoting `regions.json` verbatim,
  with wind-through-rock-flutes on Valus Ridge and salt rime on the Salt Hills. **The best example
  in the corpus of what §C of `RI-VIS05` should look like.**
- **`corpus/95-experience/RI-EXP01`** — "the swamp" refers to the *starting region*, which is a
  fen. Region-scoped in fact. **"The marsh" as the province's name is not the defect; "the marsh"
  as a description of the terrain everywhere is.**

---

## 7. Four things the ruling did not anticipate

### 7.1 `RI-CMB03`'s `GUARD_BREAK` is an animation length, and excluding the item inverts a ladder

S22 scopes `RI-CMB03` out *because of the 42 f regen pause*. But §D also holds
`duration := 40 frames` and `riposte_window := frames 6..34`, which are **animation lengths, not
seconds-derived figures**. They were not rebased, and everything around them was. **The result is
a live inversion: a medium stagger is now 44 f@60 and a guard break is 40 f@60**, so shattering
the player's guard punishes them *less* than poking them out of poise — contradicting `RI-CMB03`
§D's own claim that *"zero on a block is catastrophic"*.

**Not fixed.** Overriding an explicit exclusion in a seam ruling is the doctrine owner's call.
Flagged in `RI-CMB03` §D, `RI-CMB05` §D and `constants.json`. **Recommendation: rebase to
`duration := 80 f@60`, `riposte_window := frames 11..68`.**

### 7.2 A pre-existing guard-counter contradiction, surfaced by touching both sides

`RI-CMB02` §C says the guard-counter window is **12 f**; `RI-WPN01`, `RI-WPN04` and `RI-WPN06` all
say **20 f**. Two numbers for one window, **before** this rebase — the corpus audit did not catch
it. Both were doubled faithfully (**24** and **40 f@60**), preserving the disagreement rather than
resolving it under cover of a unit fix. For the record, the corpus resolves it mechanically if
anyone wants it resolved: `RI-WPN01`'s own cross-dependency clause says *"RI-CMB02 wins on frame
values"*, making **24 f@60** presumptive and leaving the three weapons items owing an amendment.

### 7.3 A time-base rebase is not neutral on rates — and `RI-CMB07`'s own bands would have failed it

`RI-CMB07` §D's 29 statistics are not homogeneous. Twelve are **ratios** and are invariant. Seven
are **counts** and are unaffected. But eight are **durations, per-minute rates or frame deltas**,
and S22 moves them — some up, some **down**.

**Left alone, they would have silently failed a correct rebased build.** A regenerated exemplar
would score 12.17 attacks/min against its own `14 – 34` band, and run 118 s against its own
`35 – 110 s` band. **The exemplar would have failed its own item.** Bands re-derived in §D:
duration `35–110 s` → **`70–220 s`**; attacks/min `14–34` → **`7–17`**; rolls/min `8–26` →
**`4–13`**; roll-Δ mean `−8.0…−1.0` → **`−16.0…−2.0`**; roll-Δ σ `≤4.0` → **`≤8.0`**; roll-Δ range
`[−12,+4]` → **`[−24,+8]`**; frames at zero stamina `10–300` → **`20–600`** (provisional);
longest committed run `90–260 f` → **`180–520 f@60`**.

The same class of error was found and fixed in `RI-CMB03` §E (`Frames at exactly 0 stamina`) and
in `RI-CMB01` §E (`rolls/second`, which **halves**).

**A closely related discovery:** `RI-AI03` §E's realistic-position table was **never the closed
form**. Running its pre-rebase numbers through `P_safe = Rc − Ps − t_reach + W_next − margin` gives
**0** for the tuned thrust, not the **20** the table stated. It was asserted, legitimately — M3
defines that variant as empirical — but it meant the table could not be doubled and had to be
genuinely re-derived. Combined with `t_reach` holding still while `Rc` doubled, **the realistic
punish variant is the one place in the sweep where the arithmetic is not a uniform dilation**.

### 7.4 The rebase collapses `RI-CAM04`'s steering budget into the cap, and breaks `RI-CMB06`

Steering *rates* (°/s) are unchanged and windups doubled, so the **uncapped yaw budget roughly
doubles** — and the 45° global cap, which bound **3 of 14** rows, now binds **10 of 14**. The
per-class budget column has largely collapsed to a single value, so the table discriminates
between weapon classes far less than it did. This is arguably correct (a 400 ms windup gives the
player more real time to correct, and the enemy still moves at an unchanged m/s), and the cap is
doing exactly the job §D says it exists for — but it is a design question the ruling did not
raise, and both obvious answers (lower the band-1 rate, or raise the cap) are **retunes, not unit
corrections**. Recorded in `RI-CAM04` §D, not answered.

**And `RI-CMB06` is not in S22's list.** Its §D worked example (33° / 8.3° / 41.3°) was computed
against the pre-rebase UGS `W = 29`; at `W = 58` the figures are 69° / 16.5° / 85.5°, capped to
45°. `RI-CAM04` cited that example as its consistency check, and **the check is now broken**.
`RI-CMB06` §D needs the same amendment. Flagged in `RI-CAM04` §D.

---

## 8. Verification

- **Roll, against the real figures.** Light-roll i-frames **26 f@60 = 433 ms** against DS3's
  **13 t@30 = 433 ms** — exact. Light-roll total **52 f@60 = 867 ms** against DS1's fast roll
  **24 t@30 = 800 ms** — within 8%. Parry windows **233–400 ms** against the recalled
  **267–400 ms**. **The rebase is correctly applied.**
- **Internal re-verification after rebasing.** `RI-CMB02` §E's six readability rows re-checked
  against the rebased spine and all pass (adjacent-class deltas 12/4/4/6/6/14 and 22/4/6/8/12/24
  against the ≥4 f bar; light-vs-heavy deltas 16…46 against ≥16; spread 46 against ≥46).
  `RI-AI02` §F's six moves re-checked against `Tc ≤ W − 8` and all pass. `RI-WPN02`'s R2−R1 ≥ 16
  and spread ≥ 46 re-checked and both pass, the latter exactly on the bar as it was before.
- `node tools/corpus-index.mjs --check` — **exit 0, gate passed** (`INDEX.md` regenerated).
- All four `RI-CMB07` artifacts and `constants.json` re-parsed as valid JSON/JSONL after flagging.

## 9. File count

| Job | Files |
|---|---|
| **Job 1 (S22)** | **22** — 14 reference items rebased (`RI-CMB01`, `RI-CMB02`, `RI-CMB05`, `RI-CMB08`, `RI-AI02`, `RI-AI03`, `RI-WPN01`–`RI-WPN06`, `RI-CAM04`), 1 flagged-only (`RI-CMB03`), 1 invalidated (`RI-CMB07`) + its 4 data files, 3 doctrine files (`ARBITRATION.md`, `constants.json`, `CORPUS-COHERENCE-01.md`) |
| **Job 2 (S24)** | **9** — 5 corpus files corrected (`RI-VIS05`, `RI-VIS04`, `RI-VIS08`, `RI-AUD03`, plus `RI-VIS02` flagged), 2 briefs corrected (`holes.md`, `travel.md`), and `CORPUS-COHERENCE-01.md` / `ARBITRATION.md` shared with Job 1 |
| **This report** | 1 |
