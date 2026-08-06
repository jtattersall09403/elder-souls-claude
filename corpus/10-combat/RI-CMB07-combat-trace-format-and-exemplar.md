---
id: RI-CMB07
title: The combat trace — machine-readable format and a 59-second hand-authored exemplar fight
kind: trace
side: souls
judges: [combat.trace, combat.pacing, combat.player.dodge, combat.player.stamina, combat.player.attack, combat.enemy.punishwindows, combat.telemetry, combat.determinism]
provenance: constructed
confidence: high
blind_pair: yes
---

## 0. STATUS: the exemplar is INVALIDATED — AMENDED wave 0 (rebase-s22)

> **ARBITRATION seam S22 (the 30 Hz → 60 Hz rebase) invalidates the exemplar fight and every
> statistic derived from it. The ruling accepts that cost explicitly.** The four artifact files
> each carry an `INVALIDATED` block in their `META` record, so a harness that loads one fails
> loudly rather than silently comparing against a wrong fixture.
>
> **What is still binding, and it is most of this item:** `es-combat-trace/1` and
> `es-combat-scenario/1` — the record types, the field layouts, the closed state and event
> enums, the segment encoding and its expansion rule, the RI-AI01 join, and the *definitions* of
> all 29 statistics. **None of that is frame data.** M0 and M4 are unaffected. What is
> invalidated is the exemplar *fixture* (§B, §C, and the `Exemplar` column of §D), M1's Mode-A
> replay, and — less obviously, and this is the part the ruling did not anticipate — **eight of
> §D's Mode-B bands**, because a time-base rebase is not neutral on rates.
>
> ### Why a mechanical ×2 of the trace is the wrong repair
>
> The obvious "regeneration" is to dilate the whole timeline `f → 2f`. **It produces a wrong
> artifact, and specifically it produces one that is wrong in the exact place this exemplar
> exists to be right.** Three things do not dilate:
>
> 1. **Stamina.** Regeneration is 45/s and the post-spend delay is 42 f@60, and `RI-CMB03` is
>    deliberately excluded from S22. A doubled timeline is twice as long in wall-clock, so it
>    regenerates **twice as much stamina**. Rows 15–19 and 28 — the stamina economy, the whole
>    point of the failure beat in §C — would all be wrong, and the single dropped input that row
>    28 requires might not happen at all.
> 2. **Locomotion.** Walking speed is 2.0 m/s (`RI-WLD01`, seam S17) over an unchanged arena, so
>    approach and spacing cost the *same* number of frames as before while every animation
>    around them doubled.
> 3. **The `GUARD_BREAK` in §C.** It is 40 f in `RI-CMB03` §D and S22 leaves it alone, so it does
>    **not** double while the medium stagger next to it does (22 → 44 f@60). §C's eight lines are
>    a worked demonstration of exactly that interaction.
>
> **Regeneration therefore means re-running the authored input script against the rebased
> constants — not scaling the output.** The scenario file carries a `regeneration_worklist` for
> whoever does it. This sweep did not do it: a hand-authored 3550-frame fight re-evaluated by
> hand against ~40 changed constants is a fresh authoring job, and producing a plausible-looking
> trace that had not actually been simulated would be worse than producing none. **Recorded as
> invalidated, loudly, rather than left stale in place** — which is the disposition S22 and
> orchestrator ruling R1 both permit.
>
> ### The gap ledger
>
> `corpus/90-verdicts/GAP-LEDGER.{json,md}` is a **generated** file — `tools/gap-ledger.mjs`
> builds it from verdicts' `biggest_gap`, and hand-editing it is forbidden by its own header.
> There are no verdicts yet (`verdicts read: 0`), so this gap cannot be filed there without
> fabricating a verdict, which `SCORING.md` §5 exists to prevent. It is therefore filed in the
> two places that *are* hand-authored and are read before any builder starts: this block, and
> `corpus/00-doctrine/REBASE-S22-REPORT.md` §4. **The first critic to touch `combat.trace` must
> open this as its `biggest_gap`, at which point the ledger will pick it up automatically.**
>
> **Acceptance condition for closing it:** a regenerated `RI-CMB07-exemplar-trace.segments.jsonl`
> whose `META` carries no `INVALIDATED` block, whose player constants match `RI-CMB01` §B and
> `RI-CMB02` §A/§B as rebased, and whose 29 statistics are recomputed into §D with the Mode-B
> bands re-derived per the classification table below.

## The bar

Everything else in `corpus/10-combat/` is a number in isolation. This item is the number
**in motion**: a full fight, frame by frame, as data. It exists so that a critic does not
have to play our game to judge it. They run it headless against a scripted enemy, dump a
trace in the format below, compute a dozen statistics, and lay them next to the statistics
of a fight that is known to be good. Where the shapes differ, the game differs.

"Good" is not "the numbers in RI-CMB01–06 are implemented". Good is: **over sixty seconds,
roughly 44% of the player's frames are spent inside animations they cannot escape; they
attack about 24 times and roll about 16; their i-frame windows open on average 4 frames
before the enemy's weapon goes live, with a standard deviation under 2; their stamina bar
touches zero exactly once and lives above 90% for barely a quarter of the fight; they take
the punish on four windows out of five and deliberately decline the rest; and one of the
declines is because they spent a ~~78-frame~~ **156 f@60** recovery drinking instead.** That
paragraph is a
statistical fingerprint, and this item makes it computable.

A build that satisfies every frame count in CMB01–06 and produces a trace whose statistics
look like a hack-and-slash game has failed. This is the item that catches that.

## The reference artifact

Four files, all in `corpus/10-combat/`. **All four are INVALIDATED by seam S22 — see §0.**

| File | Records | What it is |
|---|---|---|
| `RI-CMB07-exemplar-scenario.json` | — | The **reproducible input**: arena, both movesets, the enemy's 18 scripted actions, and the player's 54 scripted inputs. This is what you feed a harness. |
| `RI-CMB07-exemplar-trace.segments.jsonl` | 1 META + **259** `S` + **102** `E` | The **exemplar trace**, run-length encoded. The whole 3550-frame fight. |
| `RI-CMB07-exemplar-frames-150-265.jsonl` | 1 META + 116 `F` | Per-frame excerpt: the canonical exchange (roll through an overhead chop, two-hit punish). |
| `RI-CMB07-exemplar-frames-990-1125.jsonl` | 1 META + 136 `F` | Per-frame excerpt: the failure beat (over-greedy punish → guard break → hit taken). |

### A. `es-combat-trace/1` — the format

One JSON object per line. Four record types, distinguished by `t`.

**`META`** — exactly one, the first line. Declares `schema`, `fps`, `encoding`
(`"per-frame"` or `"segment-rle"`), `duration_frames`, both actors' constants, both
movesets, a `fields` dictionary, and (in the exemplar) an `expected_statistics` block.

**`F`** — one per frame. The canonical form.

```json
{"t":"F","f":166,
 "i":[0.0,1.0,4],
 "p":["ROLL_IFRAME","roll_light",7,98.0,620,1,0],
 "e":["ATK_ACTIVE","e_overhead_chop",35,2876,1],
 "v":[{"k":"IFRAME_NEGATE","src":"E1","atk":"A1","swing":0,"pstate":"ROLL_IFRAME"}]}
```

| Field | Type | Meaning |
|---|---|---|
| `f` | int | Frame index, 1-based, monotonic, no gaps |
| `i` | `[float, float, int]` | `[stick_x, stick_y, button_bitmask]` — the latched input for this frame |
| `p` | 7-tuple | `[state, anim_id, anim_frame, stamina, hp, invuln, hitbox_active]` |
| `e` | 5-tuple, or array of them | `[state, anim_id, anim_frame, hp, hitbox_active]` per live enemy, in stable id order |
| `v` | array, optional | Events resolved on this frame. Omitted entirely when empty |

Button bitmask:

| Bit | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|---|
| Action | `ATTACK_LIGHT` | `ATTACK_HEAVY` | `GUARD` | `SKILL/PARRY` | `DODGE` | `SPRINT` | `HEAL` | `LOCK_TOGGLE` | `TWO_HAND` |
| Value | 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128 | 256 |

Player `state` enum (closed set; an unknown value is a **fail-closed** condition):

```
IDLE  WALK  RUN  SPRINT
ATK_STARTUP  ATK_ACTIVE  ATK_RECOVER
ROLL_STARTUP  ROLL_IFRAME  ROLL_RECOVER  BACKSTEP
BLOCK_HOLD  BLOCK_IMPACT  GUARD_BREAK
PARRY_ACTIVE  PARRY_RECOVER  CRIT_ATTACK
HEAL_STARTUP  HEAL_ACTIVE  HEAL_RECOVER
STAGGER  KNOCKDOWN  DEAD
```

Enemy `state` enum: `REPOSITION  APPROACH  ATK_WINDUP  ATK_ACTIVE  ATK_INTERVAL
ATK_RECOVER  STAGGER  GUARD_BREAK  PARRIED  DEAD`.

**`S`** — segment, the run-length-encoded form. One record per maximal run of frames sharing
`(p.state, p.anim, e.state, e.anim, invuln, hitbox_active, enemy hitbox_active)`.

```json
{"t":"S","f0":166,"f1":170,
 "p":["ROLL_IFRAME","roll_light",7,11],"sp":[98,98],"hp":[620,620],"iv":1,"hb":0,
 "e":["ATK_ACTIVE","e_overhead_chop",35,39],"ehp":[2876,2876],"ehb":1}
```

**Expansion rule, `S` → `F` (deterministic, and part of the format):**

```
for f in f0..f1:
    k              = f - f0
    p.state        = p[0];  p.anim = p[1]
    p.anim_frame   = p[2] + k                # p[3] must equal p[2] + (f1 - f0)
    p.stamina      = round( lerp(sp[0], sp[1], k/(f1-f0)), 1 )    # f1==f0 -> sp[0]
    p.hp           = round( lerp(hp[0], hp[1], k/(f1-f0)) )
    p.invuln       = iv ;  p.hitbox_active = hb
    e.*            = same rule using e[], ehp[], ehb
    v              = all E records whose f == this frame, in file order
```

A conforming expander must reproduce the per-frame excerpt files byte-for-byte on their
ranges (modulo the `i` field, which the segment form does not carry — see §D).

**`E`** — event. `{"t":"E","f":<frame>,"k":<kind>, ...}`. Closed kind set, with the exemplar's
counts:

| `k` | Count in exemplar | Payload |
|---|---|---|
| `LOCK_ON` | 1 | `tgt`, `range_m` |
| `ACTION_START` | 42 | `mv`, `tag`, `stam_after` |
| `GUARD_UP` | 4 | — |
| `HIT` | 26 | `src`, `dst`, `wpn`/`atk`, `dmg`, `pd`, `part`, resulting hp |
| `CRIT_HIT` | 1 | as `HIT`, plus critical kind |
| `WHIFF` | 2 | `src`, `wpn`, `reason`, `dist_m` |
| `IFRAME_NEGATE` | 14 | `src`, `atk`, `swing`, `pstate` |
| `BLOCK` | 4 | `atk`, `stam_cost`, `chip`, `stam_left`, `guard_break` |
| `GUARD_BREAK` | 1 | `who`, `frames`, `cause` |
| `STAGGER` | 5 | `who`, `frames`, `cause` |
| `ESTUS_START` | 2 | `left` |
| *(also legal, absent here)* | 0 | `AVOID`, `PARRY`, `RIPOSTE`, `LOCK_BREAK`, `LOCK_SWITCH`, `DEATH` |

**Interop with RI-AI01 §A.** The AI reference items compute over an enemy-authoritative
per-frame record with a much wider field set. That is a *second stream from the same run*,
not a competing format. A conforming harness emits both, and they are joined on `f`:

```
trace.player.jsonl   ->  es-combat-trace/1   (this item; player-authoritative)
trace.enemy.jsonl    ->  RI-AI01 §A record   (enemy-authoritative, one per enemy per frame)
```

Hard consistency check, run by every critic touching either stream: for every frame,
`es-combat-trace F.e[k].state` must equal the RI-AI01 record's `phase`-derived state for
enemy `k`, and `F.p.stamina` must equal the RI-AI01 record's embedded `player.stamina`.
Any disagreement fails **both** items.

### B. Excerpt — the canonical exchange (frames 159–203, abridged) — **INVALIDATED (§0)**

> **AMENDED wave 0 (rebase-s22): every frame index below is pre-rebase and must not be cited.**
> What survives, and what a regenerated excerpt must still demonstrate, is the single line the
> section exists for: `p[5] == 1` and `e[4] == 1` on the *same frame* resolving to
> `IFRAME_NEGATE` rather than `HIT`. That is a statement about the trace format and the
> i-frame model, not about any particular frame number.

Enemy `A1` overhead chop: windup 34 f, hitbox live on frames 166–170, recovery 171–208.
The player rolls on 160; i-frames run 162–174; the chop is negated on its first active frame;
the punish starts on 186 and connects on 198, comfortably inside the recovery.

```jsonl
{"t":"F","f":159,"p":["WALK","strafe_r",24,120,620,0,0],"e":["ATK_WINDUP","e_overhead_chop",28,2876,0]}
{"t":"F","f":160,"p":["ROLL_STARTUP","roll_light",1,98,620,0,0],"e":["ATK_WINDUP","e_overhead_chop",29,2876,0],"v":[{"k":"ACTION_START","mv":"ROLL","tag":"dodge","stam_after":98}]}
{"t":"F","f":161,"p":["ROLL_STARTUP","roll_light",2,98,620,0,0],"e":["ATK_WINDUP","e_overhead_chop",30,2876,0]}
{"t":"F","f":162,"p":["ROLL_IFRAME","roll_light",3,98,620,1,0],"e":["ATK_WINDUP","e_overhead_chop",31,2876,0]}
{"t":"F","f":166,"p":["ROLL_IFRAME","roll_light",7,98,620,1,0],"e":["ATK_ACTIVE","e_overhead_chop",35,2876,1],"v":[{"k":"IFRAME_NEGATE","src":"E1","atk":"A1","swing":0,"pstate":"ROLL_IFRAME"}]}
{"t":"F","f":170,"p":["ROLL_IFRAME","roll_light",11,98,620,1,0],"e":["ATK_ACTIVE","e_overhead_chop",39,2876,1]}
{"t":"F","f":174,"p":["ROLL_IFRAME","roll_light",15,98,620,1,0],"e":["ATK_RECOVER","e_overhead_chop",43,2876,0]}
{"t":"F","f":175,"p":["ROLL_RECOVER","roll_light",16,98,620,0,0],"e":["ATK_RECOVER","e_overhead_chop",44,2876,0]}
{"t":"F","f":185,"p":["ROLL_RECOVER","roll_light",26,98,620,0,0],"e":["ATK_RECOVER","e_overhead_chop",54,2876,0]}
{"t":"F","f":186,"p":["ATK_STARTUP","ss_r1_h",1,78,620,0,0],"e":["ATK_RECOVER","e_overhead_chop",55,2876,0],"v":[{"k":"ACTION_START","mv":"R1","tag":"punish","stam_after":78}]}
{"t":"F","f":198,"p":["ATK_ACTIVE","ss_r1_h",13,78,620,0,1],"e":["ATK_RECOVER","e_overhead_chop",67,2758,0],"v":[{"k":"HIT","src":"P","dst":"E1","wpn":"R1","dmg":118,"pd":22,"part":"torso","ehp":2758}]}
{"t":"F","f":203,"p":["ATK_RECOVER","ss_r1_h",18,78,620,0,0],"e":["ATK_RECOVER","e_overhead_chop",72,2758,0]}
```

Read the fifth line closely. `p[5] == 1` (invulnerable) and `e[4] == 1` (enemy hitbox live)
on the *same frame*, and the result is `IFRAME_NEGATE` rather than `HIT`. That single line is
the difference between a Souls game and everything else, and it is the thing the trace format
exists to make provable.

### C. Excerpt — the failure beat (frames 1010–1040, abridged) — **INVALIDATED (§0)**

> **AMENDED wave 0 (rebase-s22).** Do not cite these indices. This excerpt is the *most*
> affected of the four artifacts, because it is a worked demonstration of three systems
> interacting and **S22 moves them by different amounts**: the medium stagger doubles (22 →
> 44 f@60), the guard break does **not** (40 f, `RI-CMB03` scoped out), and the 42 f regen delay
> does not either. The "44 frames at exactly 0.0 stamina" it narrates is a *consequence* of that
> interaction and will come out differently. See the inversion flagged in `RI-CMB03` §D.

The player over-committed: a four-hit punish left **11.1** stamina. They raise the guard
against `A2`'s first swing. The block costs `96 × (1 − 0.62) = 36.5`. It is more than they
have.

```jsonl
{"t":"F","f":1010,"p":["BLOCK_HOLD","shield_hold",21,10.4,617,0,0],"e":["ATK_WINDUP","e_two_hit_combo",21,1814,0],"v":[{"k":"GUARD_UP"}]}
{"t":"F","f":1015,"p":["BLOCK_HOLD","shield_hold",26,11.1,617,0,0],"e":["ATK_WINDUP","e_two_hit_combo",26,1814,0]}
{"t":"F","f":1016,"p":["GUARD_BREAK","guard_break_stagger",1,0.0,611,0,0],"e":["ATK_ACTIVE","e_two_hit_combo",27,1814,1],"v":[{"k":"BLOCK","src":"E1","atk":"A2","stam_cost":36.5,"chip":6,"stam_left":0.0,"guard_break":true},{"k":"GUARD_BREAK","who":"P","frames":40,"cause":"stamina_exhausted_on_block"}]}
{"t":"F","f":1038,"p":["STAGGER","stagger_med",1,0.0,515,0,0],"e":["ATK_ACTIVE","e_two_hit_combo",49,1814,1],"v":[{"k":"HIT","src":"E1","dst":"P","atk":"A2","dmg":96,"pstate":"GUARD_BREAK","php":515},{"k":"STAGGER","who":"P","frames":22,"cause":"poise_broken"}]}
{"t":"F","f":1059,"p":["STAGGER","stagger_med",22,0.0,515,0,0],"e":["ATK_RECOVER","e_two_hit_combo",70,1814,0]}
{"t":"F","f":1060,"p":["WALK","strafe_r",7,0.8,515,0,0],"e":["ATK_RECOVER","e_two_hit_combo",71,1814,0]}
{"t":"F","f":1061,"p":["WALK","strafe_r",8,1.5,515,0,0],"e":["ATK_RECOVER","e_two_hit_combo",72,1814,0]}
```

Three separate rules are visible in eight lines. The guard break on 1016 costs 6 chip and
zeroes the bar (RI-CMB03 §C/§D). Twenty-two frames later the combo's second swing lands for
full damage on a guard-broken target and re-staggers it for 22 frames (RI-CMB05 §B). And the
bar reads exactly `0.0` from 1016 through 1059 — **44 frames** — because regeneration is
suspended for the whole of `GUARD_BREAK` and `STAGGER`, and the 42-frame delay had not
expired anyway. The first tick appears on 1060, the frame after hitstun ends. That is
RI-CMB03 §A being visible in data.

### D. The exemplar's statistics — the actual bar

Computed from `RI-CMB07-exemplar-trace.segments.jsonl`. Fight length **3550 frames
(59.17 s)**, ending in the enemy's death. `Tol` is the acceptance band for a Mode-B
(free-play) comparison; Mode-A (scenario replay) tolerances are given in §E and are far
tighter.

> **AMENDED wave 0 (rebase-s22). The `Exemplar` column is INVALIDATED (§0). The Mode-B bands
> are NOT uniformly invalid — they split three ways, and the split is the useful finding.**
>
> | Kind | Rows | Under S22 | Disposition |
> |---|---|---|---|
> | **Ratios and fractions** — of frames, of swings, of attacks | 4, 6, 11, 12, 13, 15, 17, 18, 19, 22, 23, 24, 27 | **invariant** under a uniform time-base change: numerator and denominator move together | **bands stand, unchanged and still binding** |
> | **Absolute counts and amounts** — hits, HP, charges, guard breaks | 3, 10, 14, 20, 21, 28, 29 | unaffected: nothing about them is a duration | **bands stand** |
> | **Durations, rates and frame deltas** | 1, 2, 5, 7, 8, 9, 16, 25 | **not invariant** — a per-minute rate *halves*, a frame delta *doubles*, a duration in seconds *doubles* | **bands re-derived below** |
>
> **This is the thing the ruling did not anticipate.** S22 says the exemplar trace is
> invalidated and must be regenerated. It does not say that the *acceptance bands* — which are
> not part of the exemplar, and which a critic would reasonably keep — are themselves partly
> unit-bearing. Left alone, they would have silently failed a **correct** rebased build: at half
> the action rate the exemplar's own 24.34 attacks/min becomes 12.17, which is **below the
> 14–34 band it defines**, and its 59.17 s duration becomes 118 s, **above the 35–110 s band**.
> A regenerated exemplar would have failed its own item.
>
> | # | Statistic | Old band | **Rebased band** | Why |
> |---|---|---|---|---|
> | 1 | Fight duration | 35 – 110 s | **70 – 220 s** | every action takes twice as long; the same *number* of actions spans twice the wall clock |
> | 2 | Attack animations started / min | 14 – 34 | **7 – 17** | a rate: halves |
> | 5 | Rolls / min | 8 – 26 | **4 – 13** | a rate: halves |
> | 7 | Roll timing Δ, mean (frames) | −8.0 – −1.0 | **−16.0 – −2.0** | a frame delta: doubles |
> | 8 | Roll timing Δ, standard deviation | ≤ 4.0 | **≤ 8.0** | a frame delta: doubles |
> | 9 | Roll timing Δ, range | within [−12, +4] | **within [−24, +8]** | a frame delta: doubles |
> | 16 | Frames at exactly 0 stamina | 10 – 300 | **20 – 600** *(provisional)* | a frame count spanning wall-clock that the stamina system did **not** rebase — must be re-measured, not assumed |
> | 25 | Longest unbroken committed run | 90 – 260 f (1.5 – 4.3 s) | **180 – 520 f@60 (3.0 – 8.7 s)** | a committed run is a chain of animations: doubles |
>
> **Row 22 (committed-frame ratio, 0.34 – 0.56) is untouched and remains the single most
> diagnostic number in this corpus.** That it survives a factor-of-two error in every frame
> count unchanged is precisely why the error went undetected for a wave — and is also why the
> row is worth what the item claims: it measures the *shape* of play, not its tempo.

| # | Statistic | Exemplar | Mode-B band |
|---|---|---|---|
| 1 | Fight duration | 59.17 s | ~~35 – 110 s~~ → **70 – 220 s** |
| 2 | **Attack animations started / min** | **24.34** | ~~14 – 34~~ → **7 – 17** |
| 3 | Hits landed | 22 | — |
| 4 | Whiff rate (attacks that hit nothing) | 0.083 | 0.03 – 0.25 |
| 5 | **Rolls / min** | **16.23** | ~~8 – 26~~ → **4 – 13** |
| 6 | Dodge rolls (within 20 f of an enemy hitbox) | 14 of 16 | ≥ 0.70 of all rolls |
| 7 | **Roll timing Δ, mean** (i-frame-window start − enemy hitbox activation frame) | **−4.36 f** | ~~−8.0 – −1.0~~ → **−16.0 – −2.0** |
| 8 | Roll timing Δ, standard deviation | **1.54 f** | ~~≤ 4.0~~ → **≤ 8.0** |
| 9 | Roll timing Δ, range | −8 … −2 | ~~[−12, +4]~~ → all within **[−24, +8]** |
| 10 | Enemy swings faced | 23 | — |
| 11 | Swings negated by i-frames | 14 (60.9%) | 0.40 – 0.80 |
| 12 | Swings blocked | 4 (17.4%) | 0.00 – 0.35 |
| 13 | Swings taken | 5 (21.7%) | 0.05 – 0.35 |
| 14 | Damage taken | 576 (93% of max HP) | 0.4 – 1.6 × max HP |
| 15 | **Stamina floor** | **0.0 (0.0% of max)** | ≤ 15% of max |
| 16 | Frames at exactly 0 stamina | 44 | ~~10 – 300~~ → **20 – 600** *(provisional)* |
| 17 | % frames below 25% stamina | 5.10% | 3% – 20% |
| 18 | % frames above 90% stamina | 25.4% | 12% – 45% |
| 19 | Mean stamina | 81.0 / 120 (67.5%) | 55% – 80% |
| 20 | Guard breaks suffered | 1 | 0 – 3 |
| 21 | Estus charges used | 2 of 5 | 1 – 5 |
| 22 | **Committed-frame ratio** (`ATK_*`+`ROLL_*`+`HEAL_*`+`STAGGER`+`GUARD_BREAK`+`CRIT_ATTACK`) | **0.448** | **0.34 – 0.56** |
| 23 | Block-hold ratio | 0.019 | 0.00 – 0.20 |
| 24 | Free-frame ratio (`IDLE`/`WALK`/`RUN`/`SPRINT`) | 0.532 | 0.28 – 0.62 |
| 25 | Longest unbroken committed run | 174 f (2.90 s) | ~~90 – 260 f~~ → **180 – 520 f@60** |
| 26 | Punish windows offered by the enemy | 18 | — |
| 27 | **Punish-window usage rate** (hit landed inside `[w0,w1]`) | **0.778** | 0.50 – 0.95 |
| 28 | Inputs dropped for insufficient stamina | 1 | **≥ 1** |
| 29 | Player hp at fight end | 510 / 620 | > 0 |

**How to read row 22.** In a good Souls fight the player spends nearly half of every second
unable to change their mind. In a hack-and-slash it is under 0.15, because attacks are
cancellable and dodges are dashes. In a turtling failure state it is under 0.25 with row 23
above 0.5. Row 22 is the single most diagnostic number in this corpus.

**How to read rows 7–9.** A good player's i-frames *open before* the weapon goes live and
*close after* it goes dead — the window brackets the threat with a small negative bias. Mean
around −4 with σ under 2 means deliberate, learned timing. A mean near 0 with σ above 5 means
reaction-mashing that happens to work because the i-frame window is too generous — which is
the shape you get if RI-CMB01 has been implemented with a boolean flag. **Rows 7–9 are the
statistical fingerprint of RI-CMB01's correctness, measured from play rather than from a
probe.**

**How to read row 27 against row 26.** 18 windows, 14 taken. The four declined were: one
where the player held 11 stamina and could not afford the swing, one where they were mid-stagger, one where a backstab
landed ~~10 frames~~ **20 f@60** after the window closed (greed, punished by nothing this time), and one
where they spent the enemy's ~~78-frame~~ **156 f@60** recovery drinking. A usage rate of 1.00 is not better;
it means the enemy's windows are too generous or the player has no resource pressure.

## Comparison method

Scripts: **`corpus/80-methods/m-cmb07-expand.mjs`**, **`m-cmb07-stats.mjs`**,
**`m-cmb07-diff.mjs`**.

`m-cmb07-expand.mjs <segments.jsonl>` → per-frame JSONL, implementing §A's expansion rule.
`m-cmb07-stats.mjs <trace.jsonl>` → the 29-row statistics object in §D.
`m-cmb07-diff.mjs <ours.json> <exemplar.json> --mode A|B` → per-row pass/fail and a score.

**M0 — Format conformance.** Run `m-cmb07-expand.mjs` on our trace and on the exemplar.
- **FAIL** if our trace is not parseable line-by-line as JSON.
- **FAIL** on any unknown `p.state`, `e.state`, or `E.k` value (fail-closed; a critic never
  scores an unknown field as "probably fine").
- **FAIL** on any gap or non-monotonicity in `f`.
- **FAIL** if `p.anim_frame` ever resets without a state change, or increments by anything
  other than 1.
- **FAIL** if the RI-AI01 §A enemy stream is absent, or disagrees with `F.e[]` on any frame.

**M1 — Mode A, scenario replay (engine conformance).**
1. Load `RI-CMB07-exemplar-scenario.json` into the headless harness. The enemy executes its
   18 scripted actions on the exact frames given; the player executes the 54 scripted inputs
   on the exact frames given. No AI, no randomness, seed 0.
2. Dump our trace; run `m-cmb07-stats.mjs`; run `m-cmb07-diff.mjs --mode A`.
- Mode-A tolerances: rows 2, 3, 5, 10, 11, 12, 13, 16, 20, 21, 26, 27, 28 must match
  **exactly**. Rows 7, 8 must match within **±0.25 f**. Rows 15, 17, 18, 19, 22, 23, 24 must
  match within **±0.02** (absolute, on the ratio or percentage-of-max). Row 1 within ±30 f.
- **FAIL** on any row outside Mode-A tolerance. A Mode-A mismatch is an engine bug in
  CMB01–06, and `m-cmb07-diff.mjs` must name the first frame at which our trace diverges from
  the exemplar's state sequence. That frame number is the deliverable.
- Run 20 seeds. **FAIL** if any two runs differ (RI-CMB04 §E).

**M2 — Mode B, free play (game conformance).** This is the harder and more important test.
1. Build a scripted *bot* player (or record a competent human session) fighting a single
   humanoid enemy of roughly the exemplar's threat profile, for 60 seconds, in our real game
   with real AI. The enemy is **not** scripted; RI-AI01–05 govern it.
2. Dump the trace; compute the 29 statistics; diff against §D's Mode-B bands.
- Score = number of rows inside band, out of the 24 rows that carry a band.
- **FAIL** any row that is out of band, and report by how much.
- Repeat over **≥ 5 independent fights** and report the per-row median and interquartile
  range. A single lucky fight is not evidence.

**M3 — The fingerprint plots.** From the Mode-B traces, produce and attach to the verdict:
- (a) stamina vs frame, overlaid with the exemplar's;
- (b) a histogram of roll Δ (row 7's underlying distribution), overlaid;
- (c) a state-occupancy bar chart (fraction of frames in each `p.state`), overlaid;
- (d) a timeline strip: enemy hitbox-active frames in one colour, player invuln frames in
  another, player hitbox-active frames in a third. This one picture shows immediately whether
  dodges are timed or sprayed.
- **FAIL** if (d) shows player invuln frames that do not cluster around enemy hitbox frames.

**M4 — Adversarial trace.** Generate a deliberately bad trace (attacks cancellable, i-frames
for the whole roll, no stamina delay) and run `m-cmb07-diff.mjs` against §D.
- **FAIL the method itself** if the bad trace passes. A comparison method that cannot fail is
  not a method, and this check protects the corpus from a diff script that silently no-ops.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M0 format conformance | 15 | Parseable, closed enums, monotonic, AI stream agrees |
| M1 Mode A replay | 30 | Every row inside Mode-A tolerance, deterministic |
| M2 Mode B free play | 40 | ≥ 20 of 24 banded rows inside band, median over ≥ 5 fights |
| M3 fingerprint plots | 10 | All four produced; (d) shows clustering |
| M4 adversarial self-check | 5 | Bad trace fails |

- **≥ 90** — parity. Our fights are shaped like Souls fights.
- **70–89** — gap named. Report which rows are out of band and in which direction.
- **< 70** — **we lose.**
- **Automatic fail regardless of score:**
  - row 22 (committed-frame ratio) below **0.25** — attacks are being cancelled somewhere,
    whatever CMB02's probe said;
  - row 28 equal to 0 — the stamina bar never denied an input, so there is no economy;
  - row 8 (roll Δ σ) above 6.0 with row 11 still above 0.6 — dodges are succeeding without
    being timed, which means the i-frame window is too wide;
  - row 27 equal to 1.00 with row 22 below 0.35 — free damage with no commitment;
  - the trace missing entirely, or emitted only for the player, or emitted at render rate.

**Blind pair:** hand the critic the four M3 plots for our fight and for the exemplar, with no
labels, and ask which is the Souls fight. Record the blind pick before the reveal. If the
critic picks ours, re-run M2 with a *worse* bot player and re-examine — a bot that plays
better than the exemplar can produce a prettier fingerprint from a broken engine.

## How we lose

1. **No trace at all.** The most likely outcome by far. Telemetry is the first thing cut and
   the last thing added, and without it every item in this directory is unjudgeable. The
   trace emitter is a **deliverable of the combat milestone**, not of a later polish pass.
2. **A trace emitted from the render loop.** Written in `requestAnimationFrame`, so it has
   3600 lines on one machine and 8600 on another, and `f` is a render frame rather than a
   simulation frame. Every statistic becomes machine-dependent. M0's monotonic-`f` and
   `anim_frame`-increments-by-1 checks catch it.
3. **Committed ratio around 0.15.** Because attacks got cancellable somewhere in week three
   to make the game "feel responsive". This is the failure the whole item exists to name, and
   it will be defended on the grounds that testers liked it.
4. **Roll Δ mean near 0 and σ near 8**, with a high negation rate. Reads as "our dodging
   works". It means the i-frame window is so wide that timing is irrelevant, which is
   RI-CMB01's boolean-flag failure showing up in play rather than in a probe.
5. **Stamina floor around 55% of max.** No spending pressure, so rows 15–19 are all wrong
   together and the fight has no rhythm. Usually caused by regen with no delay (RI-CMB03) or
   costs that are too small relative to the pool.
6. **Punish usage 1.00.** Every window taken, because the enemy's recoveries are enormous and
   the player is never resource-limited. Superficially this looks like *better* play than the
   exemplar. It is a worse game.
7. **Free-frame ratio above 0.75.** Long stretches of two actors circling each other doing
   nothing, because the AI's re-engage timer is too slow. The fight is technically correct and
   dramatically dead.
8. **Block ratio above 0.5.** Turtling dominates because stability is too high or guard break
   is not implemented. Row 23 with row 20 at zero identifies this in one glance.
9. **A diff script that always passes.** Written to compare `abs(a-b) < tolerance` with a
   tolerance wide enough that nothing ever trips. M4 exists solely to make the method
   falsifiable.
10. **Statistics computed over a 10-second clip** because a 60-second fight was hard to
    produce. Rows 26–28 need a fight long enough to contain a dozen-plus enemy attacks;
    anything under 35 seconds is noise wearing a table.
11. **Mode A passing and Mode B failing, and shipping anyway.** Mode A proves the engine
    obeys CMB01–06. Only Mode B proves the *game* does. A verdict that reports Mode A alone
    has not done its job.

## Provenance note

`provenance: constructed`, confidence **high**.

The `es-combat-trace/1` format, the `es-combat-scenario/1` format, the state and event enums,
the segment encoding and its expansion rule, the 29 statistics and both sets of tolerances,
and the entire exemplar fight are ours. Nothing here is extracted from, or a measurement of,
any FromSoftware title, and no cell should be cited as one.

The exemplar fight is **hand-authored**: an 18-beat encounter script (enemy action frames and
move ids) and a 54-input player script were written by hand and then evaluated deterministically
against the constants in RI-CMB01 (`LIGHT` roll: 26 f, i-frames 3–15, 22 stamina), RI-CMB02
(straight sword R1: 12/5/20, 20 stamina, 118 damage; R2: 25/6/30, 34 stamina), RI-CMB03
(120 max stamina, 45/s, 42-frame delay, stability 0.62, guard break at zero), RI-CMB05
(22-frame medium stagger), and RI-CMB08 (65-frame drink, 248 heal).

> **AMENDED wave 0 (rebase-s22): every one of those constants except RI-CMB03's has changed.**
> The rebased set is `LIGHT` roll **52 f@60, i-frames f5–f30**, 22 stamina; straight sword R1
> **24/10/40**, R2 **50/12/60**; medium stagger **44 f@60**; drink **130 f@60**. RI-CMB03 is
> unchanged by ruling. That is the regeneration input; see §0. Every number in §D is a
*consequence* of those constants plus the authored script — none was chosen to make the table
look good, and several (the 0.778 punish usage, the single guard break, the 5 hits taken) are
deliberately imperfect play, because a flawless exemplar produces unreachable bands.

This means the exemplar is **brittle by design**: change any constant in CMB01–03, 05 or 08
and this artifact must be regenerated, or Mode A will fail for the wrong reason. That coupling
is the point. **It has now been exercised: seam S22 changed most of them at once, and the
artifact is duly invalidated (§0). The brittleness worked — it is the reason the invalidation is
visible rather than silent.** It is what makes the eight items in this directory one system rather than eight
opinions.

Grounding is `canonical-recall`, confidence **medium**, for the *shapes* the bands encode: that
a competent Souls player attacks on the order of twenty-something times per minute rather than
a hundred; that they roll slightly early rather than on reaction; that roughly half their frames
are spent in committed animations; that they decline some punish windows deliberately; and that
a good fight against an elite humanoid costs one to three Estus and ends with the player alive
but visibly spent. No community frame data or telemetry was consulted for any figure in §D.
