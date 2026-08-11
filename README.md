# Elder Souls — Argonia

Morrowind in almost every system — quests, factions, dialogue, journal, lore, world design, systems
depth, strangeness — set in Black Marsh, with Dark Souls' combat, stats and bonfires. Souls are for
levelling only; gold is the currency. The world takes about an hour to cross on foot.

The rule that settles every argument: **where Morrowind and Souls conflict, Souls wins inside the
fight — frames, stamina, hitboxes, animation, enemy behaviour. Morrowind wins everywhere else.**

## The links

| | |
|---|---|
| **Play it** | **https://jtattersall09403.github.io/elder-souls-claude/game/index.html** |
| **The blog and the build status** | **https://jtattersall09403.github.io/elder-souls-claude/docs/index.html** |

Or just **https://jtattersall09403.github.io/elder-souls-claude/**, which is a landing page with both.

GitHub Pages publishes this repository from its root, so `game/` on the web is the same directory
the instruments test — there is no copy to go stale. (There briefly was one, and deleting it removed
a whole class of defect at the cost of nothing.)

### On a desktop or laptop

Open the play link in Chrome, Edge, Firefox or Safari. Nothing to download, no Node, no git. It is
about 17 MB of world, so give it a few seconds.

**New** to start. You wake in a barge hold with a woman on the other bench. Walk over and press
**E**. Nothing will tell you to.

The controls, read out of `game/data/input/profiles.json` rather than from memory:

| | |
|---|---|
| Walk | **W A S D** (or the arrow keys) |
| Look | **mouse** |
| Sprint | **hold Left Shift** |
| Roll | **Space** |
| Jump | **X** |
| Crouch | **C** or **Z** |
| Talk, open a door, pick something up | **E** or **Enter** |
| Light attack | **left click** |
| Heavy attack | **R** |
| Block | **hold right click**, or **F** |
| Parry | **middle click**, or **V** |
| Lock on | **Tab** |
| Two-hand your weapon | **G** |
| Swap weapon | **3** / **4**, or the **scroll wheel** |
| Use item | **1** |
| Cycle spell | **T** or **2** |
| Menus, and back out of anything | **Escape** or **M** |

**Escape gives you your cursor back**, which is also how you leave a menu. **A gamepad works** if
you plug one in — the entire opening plays on a pad alone, and the sticks are analogue rather than
on/off.

### With a GameSir X2s Type-C

The **wired USB-C GameSir X2s Type-C Mobile Gaming Controller** is the project's reference mobile
pad (not the similarly named Bluetooth model). Clamp the phone in landscape, connect the pad, then
press any pad button once so the browser exposes it to the game. On a phone it uses this layout:

| GameSir control | Action |
|---|---|
| Left stick / right stick | Move / look |
| **A** | Jump |
| **B** | Tap to roll; hold to sprint |
| **X** | Use item |
| **Y** | Tap to interact; hold to two-hand your weapon |
| **LB / RB** | Block / light attack |
| **LT / RT** | Parry / heavy attack (hold RT to charge) |
| **L3 / R3** | Interact / lock on |
| **Back / Start** | Lock on / menu |
| D-pad **Up / Down** | Cycle spell / crouch |
| D-pad **Left / Right** | Swap left / right weapon |

Both of the X2s browser layouts the game knows about — standard and generic HID — are normalised
to this table. If the browser reports an unfamiliar layout, a six-press, pad-only calibration opens
instead of leaving the buttons scrambled; its result is kept for the next session. The software
path is tested with simulated X2s descriptors, but the exact owner unit's browser-reported mapping,
trigger ranges and hardware modes have **not yet been verified on physical hardware**.

### On a phone or tablet

Same link. **The touch controls are wired and working** — a floating stick under your left thumb,
camera drag on the right, the same roll/sprint timing the gamepad uses, and eleven controls drawn.
An earlier version of this file said they were not; that was wrong and this is the correction.

Use the game in **landscape**. Put your left thumb down anywhere on the left half to create the
movement stick; drag anywhere free on the right half to look. The lower-right buttons provide
**roll (hold to sprint), block, light attack, interact, jump, parry, heavy attack (hold to charge),
use item, crouch, and lock on**. The eleventh, drawer button opens **two-hand, swap left, swap right,
cycle spell, and menu**. Multi-touch is supported, so movement, camera drag, and two action buttons
can be held at the same time. When a pad is active the overlay fades after two seconds; touching the
screen brings it back.


### From a clone — only if you want to change something

```sh
git clone https://github.com/jtattersall09403/elder-souls-claude.git
cd elder-souls-claude
./play.sh
```

Then open the URL it prints. **Node 20 or newer** and nothing else — no `npm install`, no build
step. `./play.sh --port 9000` if 8080 is taken; `./play.sh --host 0.0.0.0` to reach it from a phone
on the same wifi. The only reason to prefer this over the link is that it serves your working copy,
so it shows uncommitted work.

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

- **[The blog](https://jtattersall09403.github.io/elder-souls-claude/docs/index.html)** — what was found, in plain words, written as it happened. The good
  posts are the ones about mistakes.
- **[The build status page](https://jtattersall09403.github.io/elder-souls-claude/docs/progress.html)** — critic scores per domain over time. A dot
  appears every time a verdict lands. Scores fall as well as rise.
- `corpus/90-verdicts/` — every verdict, in full.
- `corpus/00-doctrine/ARBITRATION.md` — the doctrine and the 38 seam rulings.
- `orchestration/RULES.md` — the 28 rules every agent reads. Each one has already cost this project
  a wasted round.

## How it is built

The bar is built before the thing: a reference corpus of measurable requirements, then waves of
work, wide before deep. Every piece gets one builder and one **separate critic with fresh context**,
and a critic must try to falsify each piece but may PASS when evidence meets the bar. Nothing counts as done because someone says it is
— a model that nothing in the running world reads scores zero, and a fix is not a fix until it has
been deleted on a copy and the old number has come back.
