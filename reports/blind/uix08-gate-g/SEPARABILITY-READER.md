# The third reader — the separability check

**This is a different job from the two players' job, and it must go to a different
agent, who plays nothing.**

§G adopts `ARBITRATION` S52's shape, and S52's last clause is *"a separability check
by a **third** fresh reader, because an inseparable pair is `inert` and cannot pass."*
This file is what that reader gets, and it exists because the two failure modes of a
played gate look identical from the outside:

* the arms really are alike, and the thing under test does nothing — **`inert`**;
* the arms differ, and the players did not notice — **a finding**;
* the players *did* notice, and only because something other than the thing under
  test gave it away — **`void`**.

A gate that cannot separate those three is not a gate. Ruling W2 puts the same point
the other way round: *"Can you tell these apart?" is a leak check and is never the
quality verdict.* Which is why this reader is **not** asked whether the arms are
good, and the players are **not** asked whether the arms are distinguishable.

---

## What the reader receives

Everything below, and **nothing else**. In particular the reader does not receive
the reference item, the plan, the source, or the key.

1. Both players' five verbatim answers, per arm, labelled by codename only.
2. Both players' preference answer.
3. The screenshot directories from both players' sessions, unedited.
4. This file.

It does **not** receive `leakcheck.json`, the `pack.json`, or anything naming what
was ablated. If the reader can work out what the manipulation was from its own
materials, that is itself a finding and it should say so.

## What the reader is asked

Four questions, and the fourth is the one that decides `inert`.

1. **Reading only the answers, can you tell which arm is which?** Say what you keyed
   on. If you cannot, say that.
2. **Did the two players key on the same thing as each other?** Two players
   describing the same difference in different words is a signal. Two players
   describing different differences is close to noise.
3. **Is there anything in the answers or the pictures that could have told a player
   which arm was which *without playing* it** — a label, a title, a filename in a
   path they quoted, a console line, a URL? Name it. This is the leak check, and it
   is asked of the reader rather than of the players because a player who spotted a
   leak has already been contaminated by it.
4. **Is this pair separable at all?** If neither player names any difference, and you
   cannot find one in the pictures, the correct answer is *inseparable*, and the
   correct disposition is `inert` — the gate does not pass and it does not fail; it
   did not run. Say that plainly. It is a much more useful result than a guess, and
   it is the one result that no amount of statistics elsewhere can substitute for.

## How the reader's answer is used

| reader says | players say | disposition |
|---|---|---|
| inseparable | neither names a difference | **`inert`** — the gate did not run; the item stays capped |
| separable, no leak found | the arm without the mechanism read worse, ≥2 players | **the gate returns**, and §G's ladder row applies |
| separable, no leak found | the arm without the mechanism read *better* or equal | **the gate returns against us** — that is a real result and it is not re-run until it flatters |
| separable, but a leak is named | anything | **`void`** — rebuild the pack, do not reuse the answers |

Note the third row, and note that it is deliberate. `ARBITRATION` S51's retroactivity
clause is asymmetric on purpose: *where a void pack produced a result AGAINST us, the
finding stands and the score is not raised.* A gate that can only ever confirm the
build is not a gate either.
