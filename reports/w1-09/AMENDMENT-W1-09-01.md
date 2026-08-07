# AMENDMENT-W1-09-01 — `RI-CMB09` §3's roll-spam table asserts a regeneration of 0 that its own constants forbid

**Filed by:** W1-09 (combat core), wave 1
**Item:** `corpus/10-combat/RI-CMB09-recovery-and-exhaustion.md` §3
**Kind:** arithmetic correction to a derived table. **No design change is proposed and no
threshold in any item moves.**
**Evidence:** `reports/w1-09/cmb-probe-all.json` → `probes.stamina.rollspam`, from a live
seeded 60 Hz run. Reproduce with `node tools/harness/cmb-probe.mjs --probe stamina`.

---

## The claim

`RI-CMB09` §3 tabulates the arithmetic that punishes a roll-spammer, for the `RI-CMB07`
exemplar build (Endurance 20, 120 stamina, `LIGHT` tier, regen 0.75/frame, delay 42 f@60):

| Quantity | Derivation as printed | Value as printed |
|---|---|---|
| Roll cadence, chained back to back | 52 f | 0.867 s |
| **Regen recovered between chained rolls** | **"52 f elapsed < 42 f delay re-armed every 52 f → delay never expires"** | **0** |
| **Rolls before the bar denies you** | ⌊120 / 22⌋ | **5** |
| **Time from full bar to input denial** | 5 × 52 f | **260 f = 4.33 s** |
| **Stamina at denial** | 120 − 110 | **10** |

## The error

**52 is not less than 42.** The delay is re-armed on the frame of each spend and expires 42
frames later; the next roll is 52 frames later. Ten frames of every cycle therefore fall
*after* the delay has expired, and nine of them regenerate (`RI-CMB03` M1 fixes the first
regenerating frame at `f0 + 43`, so the regenerating frames of a 52-frame cycle are `f0+43 …
f0+51`).

`9 × 0.75 = 6.75` stamina per cycle, not 0. The three rows that follow are consequences of the
wrong 0 and are wrong with it.

This is not a disagreement about design. The item's own two constants — a 52-frame `LIGHT`
roll (`RI-CMB01` §B as rebased, restated in `RI-CMB09` §1) and a 42-frame delay (`RI-CMB03`
§A, deliberately excluded from S22) — determine the answer, and the answer is not 0.

The most likely cause is worth recording because it is S22 again from a different angle: the
row reads correctly **against the pre-rebase ladder**, where a `LIGHT` roll was 26 f. 26 < 42,
the delay genuinely never expired, and regen between chained rolls genuinely was 0. The rebase
doubled the roll and left the delay alone — S22 says explicitly that `RI-CMB03` is scoped out —
and the *relationship between them inverted*. `RI-CMB09` was written post-S22 and states so in
its own header, but this row was carried across without re-deriving it. **It is the same class
of defect S22 exists to catch: a figure that was right in one unit regime and was not
re-checked when the regime changed.**

## Measured

Dodge pressed on every actionable frame for 800 frames, seed 1337, `LIGHT`, 120 stamina, no
enemy:

```
roll starts (frame):   2, 54, 106, 158, 210, 262, 314, 378, 450, 526, ...
cadence:               52 f                                    (as printed — correct)
rolls before denial:   7                                       (printed: 5)
first denial:          frame 366                               (printed: 260)
stamina floor:         0.0, held for 43 frames
inputs dropped for insufficient stamina: 38                    (RP2 requires >= 4)
exhausted_enter:       1, at frame 450                         (RP2 requires >= 1)
```

The stamina trace confirms the mechanism directly: after six rolls the bar reads **21.75**,
which is `120 − 6×22 + 5×6.75` exactly. The 6.75 is the missing term.

Note the cadence breaking after roll 7 (`314 → 378 → 450 → 526`): once the bar can no longer
afford a roll on the actionable frame, the input is dropped and the next roll waits for
regeneration. That is the economy working, and it is visible in the gaps.

## Proposed correction

Replace the three affected rows of `RI-CMB09` §3's table. **Nothing else in the item changes.**

| Quantity | Derivation | Corrected value |
|---|---|---|
| Regen recovered between chained rolls | the delay expires at `f0+42`; frames `f0+43 … f0+51` regenerate → `9 × 0.75` | **6.75** |
| Rolls before the bar denies you | net cost per cycle `22 − 6.75 = 15.25`; the bar denies when it holds < 22 | **7** |
| Time from full bar to input denial | measured | **366 f = 6.10 s** |
| Stamina at denial | measured | **6.5** |

And a sentence for the surrounding prose, because the item's own §3 headline is the thing worth
preserving:

> The `LIGHT` roll is 52 f@60 and the regeneration delay is 42 f@60, so a chained roll is
> **not** free of regeneration: nine frames of every cycle refund 6.75 stamina, and the
> spammer's net cost is 15.25 rather than 22. The punishment is slower to arrive than the
> pre-rebase arithmetic suggested — seven rolls and 6.1 s rather than five and 4.3 s — and it
> arrives all the same.

## What does not change

- **`RP1` and `RP2` both still pass**, and their thresholds are unaffected: the run drops 38
  inputs (≥ 4) and enters `EXHAUSTED` once (≥ 1).
- **§3's design ruling stands unchanged**: there is still no escalating anti-spam penalty, and
  adding one would still be a defect. The economy still punishes the spammer without one.
- **No frame count, cost, pool size or delay in `RI-CMB01`, `RI-CMB03` or `RI-CMB09` moves.**
  This corrects a *derived* table, not a binding one.

## Why this amendment is earned

Two prior amendments were rejected as unearned. This one is not a request to relax a bar or to
reinterpret a ruling in the builder's favour. It reports that a printed derivation contradicts
the two constants it is derived from, shows the contradiction arithmetically (52 > 42), shows
it again in a live seeded trace, and proposes values that make the item **harder** to satisfy
by accident, not easier: seven rolls of margin instead of five means the roll-spam scenario has
to run 40% longer before `RP2`'s counters can fire, and a build that stopped at 260 frames
would now record zero dropped inputs and fail.
