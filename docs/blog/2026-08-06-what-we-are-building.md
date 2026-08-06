---
title: Six weeks of arguing before a single tree
date: 2026-08-06
summary: Morrowind's world, Dark Souls' combat, Black Marsh. Why nothing was built for weeks, and the first screenshots.
---

The pitch is simple enough to say in a sentence: **Vvardenfell's design philosophy, Dark Souls'
combat, set in Black Marsh** — the Argonian province nobody has ever made a proper single-player
game in. Eight settlements from the map, thirteen regions, about an hour to cross on foot. Original
main quest, original faction lines. In a browser.

The hard part isn't either half. It's that the two games want opposite things, constantly, and
every one of those conflicts needs an answer before anyone writes code — otherwise you get a
compromise that satisfies neither, which is how most "Morrowind but with good combat" projects die.

## The rule everything hangs off

> **Inside the fight, Souls wins. Everywhere else, Morrowind wins.**

That single line resolves most of it. Does your sword connect because the geometry says so, or
because your Long Blade skill rolled well? Souls wins — geometry, always, and Morrowind's
miss-chance is deleted outright. Should there be a compass marker on your objective? Morrowind
wins — absolutely not, you get prose directions in your journal and a landmark to walk toward.

There are now **25 of these rulings**, written before building, covering every collision we could
find in advance. A few that took real thought:

**Souls are levelling only; gold is the currency.** That was in the brief, and it forces a nice
seam: gold buys the smith's *labour*, the world buys the *stone*. Reaching +10 on a weapon costs
14,400 gold **and** materials you cannot purchase at any price. There are exactly two Heart-stones
in the province, so exactly two weapons in a playthrough can ever hit +10.

**Fast travel exists**, because Morrowind has silt striders, boats, guild guides and Mark/Recall,
and travel is a world system rather than a combat one. We got this wrong at first — the doctrine
said "no fast travel," which inverted the intent — and it took an audit against the original brief
to catch it. What's actually banned is warp-to-map-pin. You get a poled-barge network instead,
which for a marsh is the primary mode rather than a curiosity: 68 purchasable services across 17
lines, and one route that only sails at high tide, when the walking route across the same tideway
is submerged.

**A fight must have a non-lethal exit.** This one came out of an audit finding that our own
boundary was drawn too greedily — "inside the fight, Souls wins" had been read as *hostility
deletes the world*, so the only sanctioned way out of a fight was killing. That quietly broke the
target of "45% of quests completable without killing anyone", because a quest target becomes
unreachable the moment they aggro. So there's now a parley: hold the interact button, and your
character spends **102 frames** — about 1.7 seconds — committed, guard down, no i-frames, 20
stamina gone. Offering mercy is a real decision under pressure, punishable if you misjudge the
spacing, and the enemy's punish window on it is wider than on a heavy attack.

## Why nothing existed for weeks

Before any code, we wrote down **how we'd know if it was any good** — 138 written standards, each
naming what "good" is and exactly how to check it. Not opinions. Measurements.

That's the part that sounds like procrastination and isn't. It's very easy to ship a swamp with
lizards and a stamina bar, technically satisfy the pitch, and produce something with none of what
made either game worth copying. That failure is undramatic. It just quietly isn't good, and by the
time you can feel it, it's structural.

Some of the standards, so you can judge whether they're the right ones:

- **Dialogue density.** We pulled every line out of Morrowind — 69,876 records — and counted.
  Balmora carries about **38,760 words** of unique dialogue, and **87% of the game's dialogue is
  person- or place-specific** rather than shared. That kills the cheapest fake, which is one
  generic pool filtered eight ways.
- **Roll i-frames.** Verified against real frame data rather than memory, and this caught
  something serious — Souls community frame counts are in 1/30s ticks, and our simulation runs at
  60Hz. We'd adopted the numbers without converting the unit, so **every duration in the game was
  half its true length**. Combat was running at double speed while passing every internal check we
  had, because all the *ratios* were still correct. It would only ever have surfaced as
  "Souls-ish but wrong" in someone's hands. DS3's light roll is 13 ticks of invulnerability =
  433ms; ours is now 26 frames at 60Hz = 433ms.
- **Geographical variation.** Morrowind is the calibration set, not just the aspiration: we measure
  how far apart *its own* regions are visually, then require our thirteen to be at least as
  dispersed — and no two of ours may be closer together than Morrowind's two most similar. There's
  a separate test at ground level, because the easiest way to fake regional variety is recolouring
  one terrain material.
- **Opacity.** Every other standard pushes toward legibility — readable telegraphs, signposted
  junctions, discoverable rumours. Nothing protected *mystery*, which is a large part of why
  Vvardenfell is remembered. So there's now a budget of 24 things in the world that are **never
  explained anywhere**, with the authorial answer sealed in the design documents and only a hash of
  it shipped in the game. That way a critic can verify a mystery is deliberate and coherent without
  the game ever revealing it — and can catch the cheap version, which is leaving something
  unexplained because nobody wrote the explanation.

## The builders and the critics argue

Work is done by AI agents split into two roles that never mix. **Builders** make things. **Critics**
get fresh context, the relevant standards, and one instruction: try to fail this. A critic that
can't find a problem is considered to have failed its own job.

It works better than I expected. Two from this week:

A builder reported the engine's seeded random-number generator working perfectly, with hashes. A
critic checked and found the generator was being **initialised correctly and never actually drawn
from**. Two different starting seeds produced runs differing in exactly one field — the echo of the
seed itself. The determinism test that should have caught this was passing *because of* that echo.
Everything green, nothing random.

A builder reported save/load round-tripping perfectly. The critic tested **forty starting
conditions instead of one** and thirty-six failed — a signed/unsigned mismatch in how the
generator's state words were stored, which only bites when a word is negative. The four that
passed included the default seed the builder had tested with.

Both fixed. Neither findable by asking nicely.

## What it actually looks like

Here's the first landscape the engine has drawn:

![A wide view over green hills with simple untextured trees under a flat blue sky](../shots/2026-08-06-first-vista.png)

That is not Black Marsh and isn't trying to be. It's a test patch — flat colours, no textures,
generic trees — whose only job is to let the machinery underneath be proven correct before anyone
makes it beautiful. It could be anywhere, which is precisely what our own art-direction standard
will fail it for later. There's a specific test for this, borrowed in spirit from the "could this
be Skyrim?" problem: show a fresh judge a screenshot, ask them to name the setting, and if the
answer is generic fantasy, the art direction has failed regardless of how good the rendering is.

A street, an interior lit by firelight, and the over-the-shoulder framing used in combat:

![Simple buildings along a path](../shots/2026-08-06-settlement.png)

![A dark interior lit by warm firelight](../shots/2026-08-06-firelit.png)

![Third-person camera framed behind the character for combat](../shots/2026-08-06-combat-framing.png)

The camera one matters more than it looks. The game is third-person always — no first-person
toggle, even outside combat, because you read your own recovery frames off your own animation, and
a perspective that changes at the combat boundary would break the exact seam the rules exist to
keep clean.

## Where things actually stand

The engine runs, deterministically — meaning identical inputs produce a byte-identical result
every time, which is the only reason any of the measurements above can be trusted. Save/load works
across forty seed variations. The first piece has been through the critics **twice** and failed
**twice**: 3/10, then 4.1/10, against a pass mark of 6. Each failure named a specific defect, all
now fixed, including three nobody had noticed at all.

We also have **808 reference images and 208 animation sequences** pulled from both source games —
including per-move boss animations named by move, which means an attack whose frame counts are
right but whose arc and follow-through are wrong can actually be caught.

Next: the province itself — 14.5 km² of it — and the combat core.
