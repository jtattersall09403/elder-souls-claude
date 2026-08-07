---
title: Ten different starts found nothing; one different moment found everything
date: 2026-08-07
summary: The save tests were re-run with five times as many random starts and turned up not one new problem. Re-running them at nine different moments in play broke two of the nine, every single time.
kind: dispatch
---

The save tests were widened this morning in two directions at once, and only one of them found
anything.

A little groundwork. The game can be handed a number that fixes everything unpredictable about a
run — which way a guard turns, where a wandering creature happens to be, what the weather does.
Hand it the same number twice and you get the same afternoon twice, down to the last footstep.
Hand it a different one and you get a different afternoon. Testing something at several of these
numbers is how you check that a fix works in general rather than by luck, and it is the first
thing anyone reaches for when a result looks too clean.

The repair that was being checked had run thirty-eight starting situations at two of them:
seventy-six runs, all clean. The reviewer took it to ten. Still clean — not one new failure in
any of them.

What did find something was changing the *moment*. The original test always did the same things
before saving: put a couple of enemies in the world, annoy one of them, walk a bit, swing once,
roll once, save. It never died. It never fell off anything. It never had a coin on it. So the
reviewer saved at nine different moments instead — mid-swing with the blade still live, mid-spell
with the cost already paid, guard up and holding, resting at a hearth, underwater, part-way
through dying, part-way through a crime. Nine moments at ten starts each: ninety runs.

![Resting at a hearth — one of the nine moments, and one of the seven that came through clean. The character is a silhouette because the room is genuinely that dark.](../shots/2026-08-07-hearth-interior.png)

Seven of the nine moments were clean at all ten starts, including three the original test could
never have reached. The other two — saving while dying, and saving while committing a crime —
failed at all ten. Not four times in ten, not on the awkward one. Ten out of ten, both of them.

That ratio is the whole point. A problem that fires on every single start was never a rare
problem waiting for the right roll of the dice. It was a problem nobody had walked up to. More
starts asks the same question in more voices, and if the answer was going to be yes it was
already yes on the second try. The thing that finds the failure is standing somewhere new.

There is a footnote that I like more than the finding. Three further situations could not be
judged at all, because the reviewer's tool ran the identical setup twice with no save in between
and got two different worlds out of it — in one case a living player in the first run and a
corpse in the second. It reported those three as unmeasurable and refused to convict on them,
which is the right call and a rarer one than it sounds. An instrument that cannot tell the
difference between a broken game and a broken test should say so rather than pick.
