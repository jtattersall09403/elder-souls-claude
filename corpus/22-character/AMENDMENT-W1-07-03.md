# AMENDMENT-W1-07-03 — what The Dry Well can actually take away

**Item:** `RI-CHR03` (birthsigns) · **Collides with:** `RI-MAG01` §A (the Focus reservoir)
**Filed by:** W1-07, wave-2 round 2 · **Status:** applied in the build, proposed to the corpus
**Prompted by:** the W1-07 round-1 verdict §3, which scored the drawback-reality axis 0.

---

## The collision

`RI-CHR03` gives `nu-ixtu` — **The Dry Well** — a headline power (max Focus × 1.60, plus 55%
spell absorption) and a drawback stated as:

> `removes_system: "focus_regeneration"` — *"You have no Focus regeneration of any kind. Ever.
> Not passive, not from resting, not from Fatigue…"*

`RI-MAG01` §A, in `game/src/sim/magic/cost.js`, is categorical and is the older ruling:

> *"Focus NEVER regenerates. There is no `restoreFocus` function in this project… RI-MAG01 M3
> asserts `focus` is monotonically non-increasing outside a HEARTH rest or a respawn."*

Read literally, therefore, The Dry Well's drawback removes a system that **does not exist for
anybody**. The round-1 critic measured exactly that and was right to:

> *"`focus_locked` is `true` for every character, so there is no Focus regeneration for anyone.
> The Dry Well's drawback removes a system that does not run: it is byte-for-byte
> indistinguishable from having no birthsign."*

That is not a build defect that can be fixed by writing more code. Two items disagree, and one
of them has to give.

## The ruling this build applies

`RI-MAG01` §A names **exactly two** things that may raise Focus: **a HEARTH rest** and **a
respawn**. That is the regeneration The Dry Well takes away.

> **A Dry Well character's Focus reservoir is filled once, at creation, at 1.60× the WILLPOWER
> curve, and is never filled again — not by resting at a Hist-stump, not by dying, not by
> anything except the sign's own absorption clause.**

Nothing in `RI-MAG01` §A changes: Focus still never regenerates passively, for anybody, and
`focus` is still monotonically non-increasing between rests. What changes is that for one
birthsign in nine, the rest does not reset it either.

## Why this reading and not another

1. **It is losable, which is the axis.** `RI-CHR03`'s whole thesis is that at least two signs
   must cost you something *a competent player can lose a run to*. Walking into a boss with an
   empty bar and no way to fill it is that. "You do not have a passive regen that nobody has"
   is not.
2. **It is measurable in one line.** Rest at a HEARTH and read `focus`. Every other character's
   number moves; a Dry Well character's does not. `__HARNESS.hearthRest()` returns
   `focus_restored: false` and the reason.
3. **It is the sign's own fiction.** *"The root gave you nothing, so nothing runs back into
   you. What you take from the world is what you will have."* A well that fills at every
   settlement is not dry.
4. **It composes correctly under Kaal-Kaal.** `RI-CHR03` method 9 requires the second sign's
   POWER at half magnitude and its DRAWBACK at full. A Two-Drink character taking The Dry Well
   second gets ×1.30 Focus (half the deviation, which is the item's own stated 1.30) and the
   full, unhalved refusal to refill. Both halves are asserted live.

## Measured, in the running build

| character | WIL | `focus_max` | `focus_restores_at_hearth` | focus after `hearthRest()` |
|---|---:|---:|---|---|
| `nu-ixtu` The Dry Well | 11 | **53** (base 33 × 1.60) | **false** | unchanged |
| `raj-xul` The Full Root | 11 | 33 | true | back to 33 |
| `kaal-kaal` + `nu-ixtu` | 11 | **43** (base 33 × 1.30) | **false** | unchanged |

The power now fires (53 vs 33 was 94 vs 94), and the drawback is a different save file.

## What a critic should do if this ruling is wrong

Reject it, and the correct consequence is not "restore the old behaviour" — the old behaviour
scored 0 and deserved to. The correct consequence is that **`RI-CHR03` must re-specify
`nu-ixtu`'s drawback in terms of a system that exists**, and until it does, the sign has a
power and no cost, which is a balance defect rather than a build defect. Either way the
round-1 state — a drawback that is definitionally unobservable — is not one of the options.
