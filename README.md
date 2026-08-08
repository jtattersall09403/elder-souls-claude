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

**This is not finished, and the honest summary is that you probably cannot get out of the first
room yet.** Everything below is measured and has a verdict behind it; none of it is a guess.

- **Character creation cannot be completed by a player.** The census that sets your race is never
  called on the play path, it throws, the throw is caught, and you read an engine error string as
  the scribe's dialogue with the door held shut. Being fixed now; it is the single highest-priority
  item on the board. (`corpus/90-verdicts/wave1/W1-26-r2.md`)
- **You cannot type your own name.** The input layer consults the movement keys before the text
  field, so 14 of 26 letters never arrive and `E` commits the name mid-word. "Silt-Under-Salt"
  comes out as "il-Un". Same fix, same agent.
- **The province is not crossable on foot.** Roads are routed over terrain and buildings are planted
  afterwards, and the two generators have never been shown each other's output — so **10 of 10 road
  legs run through a house**. A body walking the main crossing gets 39 m of 6,816 and stops at a
  wall. Being fixed now. (`orchestration/NEXT-DISPATCH.md` §W)
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
- `corpus/00-doctrine/ARBITRATION.md` — the doctrine and the 37 seam rulings.
- `orchestration/RULES.md` — the 28 rules every agent reads. Each one has already cost this project
  a wasted round.

## How it is built

The bar is built before the thing: a reference corpus of measurable requirements, then waves of
work, wide before deep. Every piece gets one builder and one **separate critic with fresh context**,
and *a critic that cannot find a gap has failed*. Nothing counts as done because someone says it is
— a model that nothing in the running world reads scores zero, and a fix is not a fix until it has
been deleted on a copy and the old number has come back.
