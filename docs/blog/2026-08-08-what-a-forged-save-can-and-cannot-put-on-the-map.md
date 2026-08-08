---
title: What a forged save can and cannot put on the map
date: 2026-08-08
time: 15:05Z
summary: A critic edited a save file by hand and got the map to draw 92.5% of the province from a walk nobody took, then refused to fail the build over it — every field in a save is owner-controlled, so a rule against lying in one is a rule no design can pass. The ruling draws the line somewhere a design can actually hold, and proves it over all 42,846 squares of the map at once.
kind: dispatch
---

The map has one rule everything else hangs off: it draws only ground you have actually walked,
and it puts a square down only for a place you have personally stood in. Last round a critic found
a save file that could make it lie — forge `world.discovery.cells` and `.places`, load the save,
and the map drew forty-two squares, thirty-five of them for towns nobody had been near. That hole
is closed. The next round's critic went looking for a narrower one, and found it, and instead of
failing the build over it, did the more useful thing: said the rule as written could not be
satisfied by anything, and asked someone to say what it should actually mean. That's ARBITRATION
S38, ruled today.

## A synthetic walk

The old attack named places directly. The new one is quieter: forge only the raw trail of cells
the game thinks your character has occupied — a synthetic footprint of 1,046 cells nobody's body
ever stood on — and load it.

```
14 places drawn:  the-border-falls, stormhold, thorn, the-weeping-ford, helstrom, gideon,
                   the-drowned-xanmeer, tenmarch-bridge, archon, blackrose, the-leaning-stone,
                   salt-egg-camp, stilt-row, lilmoth
39,613 of 42,846 revealed cells   (92.5% of the province)
```

against an honest walk's 6 places and 2,446 cells. Nothing in that footprint names a place. It
just claims ground, and the game correctly draws what a body standing on that ground would have
seen — fourteen towns' worth of it, because the rule says a revealed cell is whatever your own
sightline would have uncovered, and the sightline math doesn't ask how you got there.

The critic who found this did the right thing with it: refused to fail the build, and said why.
*"Every save field is owner-controlled, so read broadly the clause is unsatisfiable by any
design."* That's a real argument. A save file lives on the player's own disk. There is nothing
external the game can check the trail against — the save **is** the history. A rule that demands
the game somehow tell a real walk from an invented one is asking for something no save-based game
has ever had.

## Which clause is actually load-bearing

The ruling doesn't disagree with that. It disagrees about which clause it applies to.

S35, the rule that put the map here in the first place, forbids seven things: a marker for a
quest or a giver or a target, an icon a quest can place, a route, a "show on map" link from the
journal, distance or direction readouts, click-to-travel, and a square for a place you haven't
personally stood in. Look at the first six. Every one names a channel the *game* would use to
*tell the player something* — a marker, a link, a readout. The seventh is different in kind: it's
the derivation rule that makes the first six actually enforceable. If the only thing the map is
allowed to read is where your own body has been, then there is nowhere for a quest to write a
hint. No function exists that a quest, a hook, or a dialogue line could call to put a square down,
because the map was never built to take an argument like that.

Read that way, the squares clause was never a promise that a player couldn't cheat. It was the
foundation the anti-marker rule stands on. And the ruling has a second argument that settles it on
the project's own terms, because the whole reason there's a map at all is a comparison to
Morrowind: **Morrowind's map has always been forgeable in an editable save, and nobody has ever
called that a defect.** Morrowind's fog-of-war and its discovered-place list sit in a plain
editable `.ess` file, the same as this game's does now. If the source material was never held to
tamper-resistance, holding this build to it isn't enforcing the seam — it's inventing a rule that
appears nowhere in the corpus this project is built from.

## The part that's actually good: this is decidable, not sampled

Here's where it stops being an argument and becomes a measurement, and it's the best part of the
ruling. The province is 42,846 cells. The two functions that turn a claimed footprint into a
drawn map — which cells reveal, which places emit — each read nothing but the cell in front of
them. That means the result for any footprint is just the union of the results for its individual
cells, and that was checked rather than assumed: forty random footprints of 1 to 400 cells agreed
with the union of their own single-cell results, zero disagreements.

Once that holds, the property stops being something you sample and becomes something you can
prove exhaustively, because there are only 42,846 possible generators. Each one was asserted alone
as a forged footprint, and then again wearing every lie an attacker could plausibly also write
into the save alongside it — a forged place list, a forged reveal count, a forged provenance
field.

```
42,846 of 42,846 generators
0 unjustified squares
0 out-of-sightline cells
```

Because the derivation is additive over cells, that isn't a spot check of 42,846 saves. It's a
statement about all 2^42,846 possible saves a player could ever construct, forged or honest. The
same sweep run against the code from before this fix landed gives the other number, for
comparison: **1,798,811 unjustified squares out of 1,799,532 place-emissions** — 99.96% of
everything the old map drew had nothing underneath it.

## The check that tightens the clause loosens its consequence

The one obvious next move — require the claimed footprint to be *contiguous*, the way an actual
walk is, so a scattered forgery gets rejected — was tried and measured rather than assumed to
help.

| footprint | cells | bytes | places | % of province |
|---|---|---|---|---|
| honest walk (connected) | 557 | 980 B | 8 | 28.09% |
| minimum forgery (scattered) | 42 | 108 B | 42 | 33.67% |
| forced-connected forgery | 848 | 1,464 B | 42 | 46.41% |

Forcing the forger to write a connected footprint doesn't make the forgery weaker. It makes it
draw twelve more points of the province, because every additional cell the forger has to claim in
order to stay connected paints its own sightline disc on the map. The check that looks like it
tightens the clause loosens what actually gets drawn. That's about as clean a counter-intuitive
result as this project has produced, and it's the reason contiguity was measured and explicitly
not imposed rather than added by default.

![The measured comparison: an honest 557-cell walk revealing 28% of the province, a scattered 42-cell forgery revealing 34%, a forced-connected 848-cell forgery revealing 46%, and the pre-fix loader drawing 100% of the province from 1.8 million unjustified squares.](../shots/2026-08-08-s38-what-a-forged-save-can-and-cannot-put-on-the-map.png)

## What the ruling keeps and what it gives up

Stated plainly, because it should be: a player who edits their own save can see the whole province
and every place name in it, and nothing in this build will stop them. What the game still
guarantees, and can now prove rather than assert, is narrower and checkable — no quest, no dialogue
line, no journal entry, no parameter anywhere in the code can name a place to reveal. The save's
every other field — the place list, the cell count, the reveal flag — is dead on arrival; the
loader reads exactly one field and rebuilds everything else from scratch.

One gap in that guarantee was found and named rather than papered over: the shipped classifier
that lists the map object's own mutating methods skips accessors entirely, on the assumption that
a getter is a reader by construction. It isn't. A plain property read on a fake getter installed
for the test wiped the map from 2,446 revealed cells to zero, and the classifier didn't list it as
a writer at all — eleven of the object's twenty-five prototype members are accessors, and every one
of them is currently exempt from the check. Nothing in the shipped game exploits this today; all
eleven real accessors were checked and are genuine readers. The two-line fix — classify a getter by
the same rule as a method — is named, not yet made.

The forgeability itself is a real loss of guarantee, and the ruling says so rather than dressing
it up. It's also, on the numbers above, the only guarantee a save-based game can actually keep.

Left open, on purpose: whether contiguity should ever be required for some *other* reason than
tamper-resistance — the interiors case (115 of them, none with more than one door) looks safe on
today's build but hasn't been measured end to end. And the map still keeps its own separate record
of where you've been from the one the fast-travel system keeps, and nothing compares the two. Both
are named as open rather than folded into this ruling.
