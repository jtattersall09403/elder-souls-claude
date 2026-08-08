# Elder Souls — Argonia

Morrowind in almost every system — quests, factions, dialogue, journal, lore, world design, systems
depth, strangeness — set in Black Marsh, with Dark Souls' combat, stats and bonfires. Souls are for
levelling only; gold is the currency. The world takes about an hour to cross on foot.

The rule that settles every argument: **where Morrowind and Souls conflict, Souls wins inside the
fight — frames, stamina, hitboxes, animation, enemy behaviour. Morrowind wins everywhere else.**

## Running it

```sh
./play.sh
```

Then open the URL it prints. Node 20+ and a browser with WebGL; nothing to install, no build step.
`./play.sh --port 9000` if 8080 is taken.

## What to expect

A title screen, then **New**. You wake in a barge hold with someone on the other bench. Nothing
explains itself to you — no tutorial, no objective marker, no quest arrow. That is the design, not
an omission. Walk over to her and reach out to start talking.

There is a map. It shows terrain only where you have actually walked, and one square for each place
you have personally stood in, which names itself when you hover it. It will never show you where to
go — that is a seam ruling (`corpus/00-doctrine/ARBITRATION.md` S35), and the rest of the game is
built on it holding.

## What is broken today, plainly

**A critic has now played this start to finish, and it took about three minutes.** No flags, no
test hooks: title, New, walk, name yourself, answer the census, get your writ stamped, walk out
into the world. It typed *Jackdaws-Love-My-Big-Sphinx-Of-Quartz* and got all twenty-six letters
back. It hesitated once, at the moment the panel closes and nothing tells you to go up the
companionway — which is the design working, not a bug.

It still failed the piece, and that is not a contradiction: the question "can a person play this"
and the question "is it any good" are different, and this project scores the second one.
Everything below is measured and has a verdict behind it; none of it is a guess.

Two things that were broken this morning are fixed: **character creation completes** (the census
that sets your race is driven from the play path, and a caught error can no longer render as an
NPC's dialogue), and **you can type your own name** — every letter arrives, and `E` no longer
commits the name mid-word. Both were measured through real keyboard input with no test hooks.

And **a body has now walked the province**: Stormhold to Lilmoth, 6,646.7 m in 55.4 in-world
minutes, with settlement collision on, no teleports, and never once leaving the road. That is the
"about an hour on foot" this whole world is built around, and it came from the distance rather than
from anything slowing you down.

- **The opening has not been graded since it was fixed.** A fresh critic is owed one, and until
  then the claim that it plays as a scene is the builder's, not a judge's.
- **A gamepad works, and is ungraded.** The whole opening plays on a pad alone — title, New, walk
  to the woman on the other bench, ten census questions, a name, out into the world — with not one
  keyboard event dispatched anywhere. All six screens open and close on it. If you have a pad, use
  it. (Name entry picks from a ledger rather than an on-screen keyboard, because a full-screen
  panel is forbidden by the opening's own rules; say if that annoys you and it can change.)
- Doors now work and are **ungraded**: 115 of them, 0 bodies inside a building at 1, 30, 120 and
  600 frames after you step out, and re-entry takes you back into the room you left 112 times out
  of 115. A critic is checking it. Two rounds ago every door was recorded at its building's centre
  and 39 of 40 left you standing inside the room you had just walked out of.
- **An enemy cannot catch you if you walk away.** Five of seven close at 0.20 m/s, never get nearer
  than 8 m, hit their leash and go home. (`corpus/90-verdicts/wave1/W1-12-r1.md`)
- **Interiors are lit wrongly.** 1,584 floor tiles are drawn lit and simulated pitch black, because
  the renderer caps lamps at five and invents a hearth where a room declares none, and the stealth
  model does neither. (`corpus/90-verdicts/wave1/W1-15-r3.md`)
- Fences will buy you your victim's own furniture; equipping a weapon does not change your equip
  load and the fight may keep swinging the previous one; a tenth of the written dialogue can be
  heard by nobody.

Nothing here is gated on you playing it, and no testing is asked of you. If you do play it and
something is wrong that is not on this list, that is genuinely useful — it means an instrument is
missing, which is a worse defect than the bug.

## Where the real record is

- **[The blog](docs/blog/)** — what was found, in plain words, written as it happened. The good
  posts are the ones about mistakes.
- **[The build status page](docs/progress.html)** — critic scores per domain over time. A dot
  appears every time a verdict lands. Scores fall as well as rise.
- `corpus/90-verdicts/` — every verdict, in full.
- `corpus/00-doctrine/ARBITRATION.md` — the doctrine and the 38 seam rulings.
- `orchestration/RULES.md` — the 28 rules every agent reads. Each one has already cost this project
  a wasted round.

## How it is built

The bar is built before the thing: a reference corpus of measurable requirements, then waves of
work, wide before deep. Every piece gets one builder and one **separate critic with fresh context**,
and *a critic that cannot find a gap has failed*. Nothing counts as done because someone says it is
— a model that nothing in the running world reads scores zero, and a fix is not a fix until it has
been deleted on a copy and the old number has come back.
