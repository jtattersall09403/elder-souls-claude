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

### 0.1 AMENDED wave 1 — BAR-CRITIQUE-W1-09-R1 §R2. **M1's thirty points are a CORPUS DEBT and may not be charged to a build.**

This item has now judged three rounds of `W1-09` while **its own reference artifact did not
exist**. The brief is explicit about what a reference item is for: *"for each dimension find or
construct a reference artifact a later agent can hold its own work against and lose to"*
(`INTENT-AUDIT-CHARTER` §4). Since wave 0 there has been nothing here to lose to. M1 is a replay
of `RI-CMB07-exemplar-scenario.json`; that file carries an `INVALIDATED` block; a conforming
harness fails loudly on it by design; and `SCORING.md` §1.1 then scores M1 **0, fail-closed**.
Thirty of this item's hundred points have been deducted from every build for a debt the corpus
owes and has not paid, and no builder can pay it.

**Ruling — and it is not a relaxation, it is an accounting correction:**

- While any of the four artifact files carries an `INVALIDATED` block, **M1's weight is
  `corpus_debt`** and is removed from **both** the numerator and the denominator. The item's
  native score is `100 × (earned weight) / (runnable weight)`, and the verdict **must** report
  the raw score, the runnable weight, and the debt on the same line, e.g.
  `RI-CMB07 native 46/70 runnable (raw 46/100; 30 weight = corpus_debt: exemplar INVALIDATED since wave 0)`.
- **The bands do not move.** ≥90 parity, 70–89 gap named, <70 we lose, and every automatic fail
  apply to the renormalised score exactly as written. A build that would have scored 46/100 still
  scores 66/70 → still below 70 → still loses. Nothing is forgiven.
- **The debt is owned, dated and visible.** It is filed as an open corpus gap against
  `combat.trace`, owner `critic.combat`, and it is **not** a `W1-09` gap. A verdict that reports
  M1 as a build failure while the fixture is invalidated is itself defective and must be
  corrected on the next round.
- **The renormalisation ends the moment the exemplar is regenerated.** It is a bridge, not a
  concession, and it expires by its own condition rather than by anyone's discretion.

**Why this is the correct disposition and "score it 0" is not.** A bar that no build can satisfy
is not a bar; it is a tax. `SCORING.md` §0 already names this class of thing — *"An item that
cannot reach 10 because **the corpus is broken** is a corpus bug. Fix the corpus."* — and lists
three existing instances. This is the fourth and it is the most expensive, because it sits on the
one item whose whole job is to judge whether the fight is Souls-shaped. The fix is to pay the
debt. Until it is paid, the accounting must not pretend the build incurred it.

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
| `HIT` | 26 | `src`, `dst`, `wpn`/`atk`, `dmg`, `pd`, `part`, resulting hp, **`via`** |
| `CRIT_HIT` | 1 | as `HIT`, plus critical kind |
| `WHIFF` | 2 | `src`, `wpn`, `reason`, `dist_m` |
| `IFRAME_NEGATE` | 14 | `src`, `atk`, `swing`, `pstate` |
| `BLOCK` | 4 | `atk`, `stam_cost`, `chip`, `stam_left`, `guard_break` |
| `GUARD_BREAK` | 1 | `who`, `frames`, `cause` |
| `STAGGER` | 5 | `who`, `frames`, `cause` |
| `ESTUS_START` | 2 | `left` |
| *(also legal, absent here)* | 0 | `AVOID`, `PARRY`, `RIPOSTE`, `LOCK_BREAK`, `LOCK_SWITCH`, `DEATH` |

> **`via` — REQUIRED on every `HIT` and `CRIT_HIT`, added wave 1 (BAR-CRITIQUE-W1-09-R1 §R3).**
> Closed set `{"weapon", "body", "projectile", "status", "environment"}`; an unknown value is
> **fail-closed** exactly like an unknown state. It records *what volume actually connected*, and
> it is emitted by the resolver — never inferred by the statistics script, and never derived from
> distance. Seam **S26** made an attacker's own moving body a hazard in its own right; without
> this field the trace cannot tell a sword from a shoulder, and §D's 29 rows scored a fight in
> which five to seven of eight killing blows were a torso as a healthy hit distribution. See
> §D.2 for the three statistics built on it and their hard fail.

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

### D.1 The banded rows, enumerated — *(ADDED wave 1, BAR-CRITIQUE-W1-09-R1 §R2)*

M2 said "the 24 rows that carry a band" and the table has always carried **26**. The gap let an
implementation choose its own denominator, and one did — un-banding row 9, which it failed 5 of
5, and keeping the total at 24. The banded set is now closed and is exactly:

```
1 2 4 5 6 7 8 9 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 27 28 29        (26 rows)
```

Rows **3, 10 and 26** carry no band and are diagnostic context (hits landed, enemy swings faced,
punish windows offered); they are the denominators of rows 11–13 and 27 and must still be
reported. **A build may not add to, remove from, or re-band this set.** Doing so is a method
deviation of the same class as editing the acceptance condition, and it is `VOID`.

### D.2 Damage attribution — three new rows. *(ADDED wave 1, BAR-CRITIQUE-W1-09-R1 §R3.)*

The 29 rows above count *how many* hits landed. Not one of them records **what hit you**, and
that blindness has now cost this project a full round. In `W1-09` round 3, five to seven of the
eight blows that killed a motionless player were the champion's **torso walking through them**,
each paying the greatsword's 96 damage — 96 whether the blade cut at 3.65 m or the chest arrived
at 0.05 m. The weapon volume could not reach a stationary target one metre in front of it, and a
second volume covered the hole and paid the sword's damage. **Rows 10–14 scored that fight as a
healthy hit distribution**, because a hit is a hit and no row asks by what.

The trace already has the field: `E.k == "HIT"` carries `wpn`/`atk` and `part`. It gains a
required `via` field, closed set `{"weapon", "body", "projectile", "status", "environment"}`, and
three rows join §D:

| # | Statistic | Mode-B band | Note |
|---|---|---|---|
| 30 | **`body_share_of_hits`** — `HIT` events with `via == "body"` ÷ all `HIT` events, both directions | **0.00 – 0.20** | An attacker's own body corridor is a hazard (seam **S26**) and must be a *minority* of contacts. Above this the weapon arcs are not doing the work |
| 31 | **`body_share_of_damage`** — damage from `via == "body"` ÷ total damage, both directions | **0.00 – 0.10** | A shove is a shove. See the hard fail below |
| 32 | **`mean_body_dmg / mean_weapon_dmg`** for the same attacker | **≤ 0.50** | A body corridor paying the blade's damage makes reach cosmetic — `RI-CMB02` "How we lose" #10 in a different disguise |

Rows 30–32 are **banded rows and count toward M2's denominator, which becomes 29** — see the
M2 amendment box for the resulting pass and degenerate-ceiling figures, both of which hold the
original 20/24 = 0.833 fraction rather than loosening it.

- **Automatic fail:** row 31 above **0.50**, or row 32 above **1.00**. A build in which the
  majority of damage a player takes comes from an attacker's torso, or in which a torso hits as
  hard as the weapon it is carrying, has replaced its weapons with its bodies. This is the check
  that would have caught round 3's cover, and it did not exist.
- `via` is emitted by the resolver, not inferred by the statistics script. A trace with no `via`
  field on `HIT` fails **M0** as an unknown-shape record, fail-closed.

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

> **M2 splits into two named modes with separate weights. *(AMENDED wave 1,
> BAR-CRITIQUE-W1-09-R1 §R2.)*** As written, all forty of M2's points required *"our real game
> with real AI … RI-AI01–05 govern it"*, which is unreachable until `W1-12` ships — so the
> single most important check in this area has been worth zero to every build in wave 1, and
> three verdicts scored a scripted exchange against it anyway while calling it "Mode B-prime".
> The clause is right about what it wants and wrong to bundle two different questions into one
> weight:
>
> | Mode | Enemy | The question it answers | Weight | Status in wave 1 |
> |---|---|---|---|---|
> | **M2-CTRL** | a **declared, published, unchanging** enemy action script | *Is the fingerprint caused by play?* | **25** | **runnable today** |
> | **M2-LIVE** | real AI, `RI-AI01`–`RI-AI05` | *Is the fingerprint caused by our game?* | **15** | blocked on `W1-12`; a **cross-piece coupling debt owned by the seam**, per `CORPUS-CONTRACT` §4 as amended and `RI-MTH07` "How we lose" clause 2 |
>
> **The falsification triple (below) runs in M2-CTRL**, and a scripted enemy is the *right*
> control for it: when the question is whether the player's policy moves the statistics, a fixed
> enemy is a feature. **M2-LIVE is not waived** — it is recorded at 0 against the `W1-09`↔`W1-12`
> seam, carried in the ledger, and re-run the round the roster exists. A dependency is a debt
> with an owner, never a reason to soften the check, and this ruling **upholds the orchestrator's
> refusal of a reduced row set**: no row is dropped, no band moves, and rows that need enemy AI
> stay out of band and visible.
>
> **The M2-CTRL enemy script is subject to exactly the discipline §F imposes on the player.** It
> is published in full in the verdict, it is **diffed against the previous round's**, and an
> undeclared change to it is `VOID`. Otherwise the free parameter simply moves from the bot to
> the boss. The script need not be *fair* — it must be **fixed**, and it must be one that
> `ES-MASHER/1` and `ES-TURTLE/1` both lose to and `ES-PILOT/1` survives.

1. Build a scripted *bot* player (or record a competent human session) fighting a single
   humanoid enemy of roughly the exemplar's threat profile, for 60 seconds, in our real game
   with real AI. The enemy is **not** scripted; RI-AI01–05 govern it. *(This step describes
   **M2-LIVE**. For **M2-CTRL**, substitute the declared enemy script above; every other step is
   identical.)*
2. Dump the trace; compute the 29 statistics; diff against §D's Mode-B bands.
- Score = number of rows inside band, out of the **26** rows that carry a band — enumerated in
  §D.1 below. *(AMENDED wave 1: the text said 24 and §D has always shown 26, which let an
  implementation pick its own denominator. See §D.1.)*
- **FAIL** any row that is out of band, and report by how much.
- Repeat over **≥ 5 independent fights** and report the per-row median and interquartile
  range. A single lucky fight is not evidence. **The median is the median of the per-row values
  across fights, not the median over rows of a single fight** — a build that reports "18 of 25 is
  the median row" has computed a different and easier number. *(AMENDED wave 1: M2 said "median
  over ≥ 5 fights" without saying median of what, and a build chose the generous reading.)*

> ### M2 as amended, wave 1 — BAR-CRITIQUE-W1-09-R1 §R2. **The player is the corpus's, not the build's.**
>
> **The defect.** Every one of the 26 banded rows is a joint function of two things: the engine,
> and the policy the player follows. M2 as written let the party being measured author the second
> one. Three rounds of `W1-09` are the proof, and each round moved the fingerprint by editing the
> bot rather than the engine:
>
> | Round | What moved the statistics | Consequence |
> |---|---|---|
> | 1 | a bot that was never hit | rows 13, 14, 16, 19, 29 all wrong together; "the exemplar has no danger" |
> | 2 | `eatRate` — a per-swing probability that the bot declines to defend, whose own comment said *"it is where rows 13, 14 and 21 come from"* | the danger **was** a tuned constant |
> | 3 | `staminaFloor` (18–30 per profile), below which the bot declines to swing | rows 16, 17, 22 and **28** left band; row 28 = 0 fired the item's own automatic fail and capped the item at 2 |
>
> Round 3's build did not break the stamina economy. It wrote a player who never tested it, and
> this item could not tell the difference. **An instrument with a free parameter under the control
> of the thing it measures is not a measurement.** It is the same disease
> `BAR-CRITIQUE-W1-10-R1` §R6 found in the weapons area, where both mandatory blind tests
> returned PASS on a build in which every weapon was unreachable.
>
> **The fix — three parts, all required, and all of them make M2 harder.**
>
> **(a) The pilot is declared by the corpus.** §F below publishes `ES-PILOT/1`, a deterministic
> player policy with every threshold fixed. A build implements it; it may not tune it. Its only
> inputs are quantities the player can actually perceive — own state, own stamina and hp, the
> target's distance and bearing, and the target's *telegraph* (state and animation id, never the
> enemy's internal timers or its future action). Any build-side parameter that changes its
> behaviour is a **declared deviation**, listed in the verdict with its value; an undeclared one
> is `VOID` on the same terms as a fabricated measurement.
>
> **(b) The falsification triple.** M2 is run three times, with three policies, on the same
> engine and the same encounter:
>
> | Policy | What it does | Required result |
> |---|---|---|
> | `ES-PILOT/1` | the competent player (§F.1) | **≥ 25 of 29** rows in band |
> | `ES-MASHER/1` | attacks whenever the input is accepted; never rolls, never blocks, never heals (§F.2) | **≤ 13 of 29** rows in band |
> | `ES-TURTLE/1` | holds guard; attacks only inside a punish window it has already observed; never rolls (§F.3) | **≤ 13 of 29** rows in band |
>
> *(The banded set is the 26 rows enumerated in §D.1 plus the three attribution rows added in
> §D.2, so the denominator is **29**. Both figures hold the original 20/24 = 0.833 pass fraction
> and a 0.46 degenerate ceiling exactly: `ceil(29 × 0.833) = 25`, `floor(29 × 0.46) = 13`.)*
>
> - **FAIL** if either degenerate policy lands above its ceiling. A fingerprint that is in band
>   however the player plays is measuring nothing about the player's decisions, which means the
>   engine has no economy and no commitment — and *today nothing in this corpus detects that*.
> - **FAIL** if `ES-MASHER/1` does not die, or `ES-TURTLE/1` does not die, against an encounter
>   `ES-PILOT/1` survives. That is the same statement in the outcome rather than the histogram.
> - The three runs are the discriminator. `ES-PILOT/1` alone answers "can a fingerprint be
>   produced"; the triple answers **"is the fingerprint caused by play"**, which is the question
>   the item claims to ask.
>
> **(c) The pilot diff is a verdict deliverable.** Every round must publish the full parameter set
> of every policy it ran and a **diff against the previous round's**. Round 2's deletion of
> `eatRate` and round 3's introduction of `staminaFloor` were each a one-line change to the thing
> being measured, and each cost a full critic round to find by hand.
>
> **Denominator note, so this is not read as a relaxation.** The corrected denominator is 26, not
> 24. Holding the original *fraction* (20/24 = 0.833) gives `ceil(26 × 0.833) =` **22**, which is
> 0.846 — very slightly **stricter** than the rule it replaces. Taking ≥20 of 26 would have been
> a quiet relaxation of the bar under cover of a counting fix, and is refused.

**M2b — Breadth. *(ADDED wave 1, BAR-CRITIQUE-W1-09-R1 §R2.)*** An exemplar is one scripted
fight; the player will fight thousands. Run M2 against **≥ 3 distinct enemy archetypes** from
`RI-AI05` and report `n_archetypes` and the per-archetype row table.
- **FAIL** if the same 26 rows land in band for every archetype **with the same policy** to
  within one row — identical fingerprints across genuinely different enemies means the enemy is
  not shaping the exchange, and rows 5, 7, 11, 22, 25 and 27 should all move between a fast
  humanoid and a slow heavy.
- At `n_archetypes == 1` **M2-LIVE cannot pass**, whatever the row counts say. Declare
  `n_archetypes` in every verdict; a verdict that omits it is `VOID`.
- M2b is part of **M2-LIVE** and therefore carries M2-LIVE's disposition: blocked on
  `W1-12`/`RI-AI05`, recorded at 0 against the seam, never scored against a piece that ships no
  roster and never waived. A dependency is not a defect in the bar; it is a debt with an owner,
  per `RI-MTH07` "How we lose" clause 2.

### F. `ES-PILOT/1`, `ES-MASHER/1`, `ES-TURTLE/1` — the corpus-owned player policies

*(ADDED wave 1, BAR-CRITIQUE-W1-09-R1 §R2. These are part of the **reference artifact**, not of
the method: they are the fixed player against which the engine is measured, exactly as the
exemplar is the fixed fight. A build implements them; it does not author them.)*

**Common contract, binding on all three.** The policy is a pure function of the frame's
*observable* state and its own internal counters — nothing else. Permitted inputs:

```
own:     state, anim_id, anim_frame, stamina, hp, invuln, equip_load tier, flask charges
target:  distance_m, bearing_deg, state, anim_id, anim_frame, hitbox_active
memory:  the policy's own record of previously observed (anim_id -> observed startup) pairs
```

Explicitly forbidden as inputs: the enemy's scheduled future action, its internal timers, its
declared frame table, the frame index, the RNG, and any value read from `game/data/**`. A policy
that knows when the swing is coming is not a player; it is the answer key. **A build that supplies
any forbidden input has voided M2**, on the same terms `RI-MTH04` voids a critic who reads source
and writes numbers.

Every threshold below is fixed by this item. There are **no tunable parameters**, and there is in
particular **no greed, eat-rate, aggression or stamina-floor knob** — those are the two constants
that carried `W1-09`'s danger in rounds 2 and 3 and they are the reason this section exists.

**F.1 `ES-PILOT/1` — the competent player.** Priority-ordered; the first rule whose guard holds
fires.

| # | Guard | Action |
|---|---|---|
| 1 | `hp ≤ 0.35 × hp_max` and flask charges > 0 and target is in `ATK_RECOVER` with ≥ 90 f@60 remaining by *observed* history | drink |
| 2 | target `hitbox_active`, or target in `ATK_WINDUP` and the *observed* startup for this `anim_id` puts first-active within 8 f@60 | roll, directional, away-and-through the swing plane |
| 3 | target in `ATK_RECOVER` and `distance_m ≤ own reach` and `stamina ≥ R1 cost` | R1 |
| 4 | target in `ATK_RECOVER` and `distance_m > own reach` | close |
| 5 | `stamina < R1 cost` | back out beyond `own reach + 1.0 m` and hold |
| 6 | otherwise | strafe at `own reach + 0.5 m` |

- **The pilot never learns a startup it has not observed.** On the first instance of an unseen
  `anim_id` it must react to `hitbox_active` alone, which is a hit taken. This is deliberate: a
  player fights an unfamiliar enemy badly, and a bar built on a player who never does is a bar
  built on a fight that never happens.
- Rule 5 is the *only* stamina rule. It backs off; it does not decline to swing at the margin,
  which is precisely how round 3's `staminaFloor` removed all pressure from rows 16–19 and 28.
  **The pilot is required to spend into the bar and get caught doing it.**

**F.2 `ES-MASHER/1`.** Press R1 on every frame the input would be accepted. Never roll, never
block, never heal, never back off. Face the target. Nothing else.

**F.3 `ES-TURTLE/1`.** Hold guard at all times except: R1 once, immediately, whenever the target
enters `ATK_RECOVER` and is within reach. Never roll. Never heal. Never disengage.

Both degenerate policies are **required deliverables**, not options. They are how this item
distinguishes "our engine produces Souls-shaped fights" from "our bot plays like a Souls player",
and until wave 1 it could not tell those two apart at all.

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

### CONSUMPTION (`RI-MTH07` / `ARBITRATION` §3) — *(ADDED wave 1, BAR-CRITIQUE-W1-09-R1 §R4)*

`ARBITRATION` §3's CONSUMPTION check landed in wave 1 and reached the combat **critics** through
the doctrine while reaching **none of the items in `corpus/10-combat/`**. The consequence was
visible immediately: `W1-09` round 3 enumerated six models by its own choice, found two with
`coupling == 0`, and recorded the result as `partial` — a disposition `RI-MTH07` does not have,
because its threshold is binary. Which models must be enumerated, and what a zero costs, are
properties of the item, not of the critic's diligence. So, for this item:

1. **Enumerate exhaustively** every model this item requires to act — every table, curve, window
   and constant it publishes that the running game must read — and list it in the verdict. A
   sample is not an enumeration.
2. **Perturb and observe** per `RI-MTH07` §B: two well-separated values, everything else held
   fixed, an **entity-side** observable (a state transition, an hp change, a position, a denied
   input), plus the null control. `"the trace carries it"` is not a consumer; a trace is an
   observer.
3. **Apply the consequence.** Any `coupling == 0` scores **that dimension 0**, fail-closed, and
   appears in the piece's `status_reasons`. There is no `partial`.
4. **Report the coupling table in the verdict**, as data, not in prose.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M0 format conformance | 15 | Parseable, closed enums, monotonic, AI stream agrees, **`via` present on every `HIT`** |
| M1 Mode A replay | **30 — `corpus_debt` while the exemplar is INVALIDATED (§0.1)** | Every row inside Mode-A tolerance, deterministic |
| **M2-CTRL** Mode B, declared enemy script | 25 | **The falsification triple passes: `ES-PILOT/1` ≥ 25 of 29 banded rows, `ES-MASHER/1` ≤ 13, `ES-TURTLE/1` ≤ 13**, per-row median over ≥ 5 fights per policy; pilot and enemy script published and diffed |
| **M2-LIVE** Mode B, real AI | 15 — **seam debt while `W1-12` does not exist** | The same triple against `RI-AI01`–`05`-governed enemies, plus M2b's `n_archetypes ≥ 3` |
| M3 fingerprint plots | 10 | All four produced; (d) shows clustering |
| M4 adversarial self-check | 5 | Bad trace fails |

- **≥ 90** — parity. Our fights are shaped like Souls fights.
- **70–89** — gap named. Report which rows are out of band and in which direction.
- **< 70** — **we lose.**
- **Bands apply to the renormalised score while M1 is `corpus_debt` (§0.1) and M2-LIVE is a seam
  debt.** Report raw and runnable on the same line, e.g. `native 41/55 runnable (raw 41/100;
  30 = corpus_debt exemplar INVALIDATED, 15 = seam debt W1-09↔W1-12 no enemy AI)`. **Runnable
  weight in wave 1 is therefore 55** — M0 15, M2-CTRL 25, M3 10, M4 5 — and 70 of the 100 points
  a build must earn to reach the "gap named" band come from checks that are runnable **today**.
  Neither debt reduces what a build must prove; both stop it being charged for what it cannot.
- **Automatic fail regardless of score:**
  - row 22 (committed-frame ratio) below **0.25** — attacks are being cancelled somewhere,
    whatever CMB02's probe said;
  - ~~row 28 equal to 0 — the stamina bar never denied an input, so there is no economy;~~
    **AMENDED wave 1 (BAR-CRITIQUE-W1-09-R1 §R2) — relocated, not deleted.** As written this
    clause fired on a property of the **bot**, not of the engine: a correct stamina economy plus a
    pilot with a `staminaFloor` that declines to over-commit gives row 28 = 0, and in `W1-09`
    round 3 exactly that capped the whole item at 2 for a build whose stamina denial worked. The
    requirement is right and its instrument was wrong, so it moves to where it discriminates:
    - **row 28 equal to 0 under `ES-MASHER/1`** is the automatic fail. A player pressing attack
      on every accepted frame who is *never* refused has no stamina economy, and that is an
      engine fact no policy can fake.
    - **row 28 equal to 0 under `ES-PILOT/1`** is an ordinary out-of-band row. It costs M2 a row
      and it does not cap the item.
    - The **directed** proof that the engine denies an input at all now lives in `RI-CMB03` M-STAM
      (inject an action at `stamina < cost`, assert `INPUT_DROPPED reason:"no_stamina"`; inject at
      `stamina ≥ cost`, assert it executes). That is where an invariant belongs. `RI-CMB02` §D.6
      is the rule; `RI-CMB03` proves it; this row measures whether *play* ever reaches it.
  - row 8 (roll Δ σ) above 6.0 with row 11 still above 0.6 — dodges are succeeding without
    being timed, which means the i-frame window is too wide;
  - row 27 equal to 1.00 with row 22 below 0.35 — free damage with no commitment;
  - **row 31 (`body_share_of_damage`) above 0.50, or row 32 above 1.00** — the attacker's own
    body is doing the weapon's job (§D.2, seam **S26**);
  - **either degenerate policy landing above its ceiling in M2's falsification triple** — the
    fingerprint is not caused by play;
  - the trace missing entirely, or emitted only for the player, or emitted at render rate.

**Blind pair — AMENDED wave 1 (BAR-CRITIQUE-W1-09-R1 §R5). `not_possible` until the exemplar
exists, and synthesising the counterpart is VOID.** ~~Hand the critic the four M3 plots for our
fight and for the exemplar, with no labels, and ask which is the Souls fight.~~ The intended
protocol compares our fight against **the exemplar's** plots. The exemplar is INVALIDATED (§0)
and there is therefore no legitimate counterpart. `W1-09` round 3 generated one *"from §D's
stated fingerprint"* — i.e. from this item's own published bands — and our side won it. That is
not a blind test of feel; it is a test of which strip better matches a table both sides can read,
and it is the identical defect `BAR-CRITIQUE-W1-10-R1` §R6 found in the weapons area, where blind
packs were being passed by reciting JSON columns with the header removed.

- **A pack whose counterpart is generated from §D, from this item's text, or from any published
  design table is `VOID`**, and a verdict citing one must record `blind: void` with the reason.
- Until the exemplar is regenerated, record `blind_pair: not_possible`, reason
  `"reference artifact INVALIDATED since wave 0"`, per `SCORING.md` §1's allowance. An honest
  `not_possible` is worth more than a test the build can win by reading the bar.
- **When the exemplar returns**, the pack is the four M3 plots, both sides runtime-generated,
  with all axis labels, band annotations and row numbers stripped. If the critic picks ours, the
  existing re-run rule applies **and** the fine discriminator below must be reported, because
  `W1-09` round 3 won the coarse strip and lost the frame-resolution version of the same
  question:
  - **`p90_iframe_to_hitbox`** — the 90th-percentile distance, in frames, from an invulnerable
    frame to the nearest enemy-hitbox-active frame. Band **≤ 40 f@60**. Round 3 measured 58–96 f
    while winning the coarse pack, with the player invulnerable for 803–1014 frames against 360–443
    frames of anything trying to hit it. A coarse strip cannot see that; this number can, and a
    blind test that can be won coarsely and lost finely is not yet an instrument.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 70 / 100 | 80 / 100 | 92 / 100 |

**Aggregation (a property of this item, not of the critic):** weighted-sum of passed check weights, max 100.

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
12. **The bot is the bar.** *(ADDED wave 1.)* The single largest failure this item has actually
    produced, three rounds running: the statistics move because someone edited the player, and
    the item cannot see the difference between a better engine and a better bot. `eatRate`,
    `wobble`, `staminaFloor`, "greed" — every one of them is a knob that writes a row of §D
    directly. §F removes the knobs by publishing the player; M2's falsification triple makes the
    absence of knobs *provable* rather than promised.
13. **A hit is a hit.** *(ADDED wave 1.)* Twenty-nine statistics and not one asking what
    connected. A build can cover a hole in every weapon arc with a body corridor that pays the
    blade's damage, and rows 10–14 will report an ordinary fight. §D.2 and the `via` field exist
    because this happened.
14. **The reference artifact does not exist and the item keeps scoring anyway.** *(ADDED wave 1.)*
    An invalidated exemplar makes M1 unrunnable, makes the blind pair unbuildable, and turns
    §D's bands into a free-standing table with nothing behind it. **Four of §D's own rows — 1
    (59.17 s against 70–220), 2 (24.34 against 7–17), 5 (16.23 against 4–13) and 25 (174 f against
    180–520) — fall outside the bands the rebase derived for them**, i.e. the reference fight
    fails its own item. That is expected of an invalidated fixture and intolerable in a live one,
    and it is the check a regenerated exemplar must pass first. §0.1 stops the debt being charged
    to builds; only regeneration closes it.

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
