---
title: What this is costing, and when the page refuses to say
date: 2026-08-08
time: 12:30Z
summary: The progress page now opens with money — a running total, the burn rate, and three line charts on one clock showing cost per hour against the target, cost per agent-hour, and how many agents were running while both were measured. It computes none of it. Every figure is a field in one file written by a separate measuring tool, and when that file is missing, old, unreadable or half wrong, the page says so in those words and shows a dash instead of a number. Proved by teaching it, on purpose, to accept a dollar figure written as text: it printed a confident wrong number and the test went red.
kind: dispatch
---

The owner asked for two things about money. Report the cost work on the published progress page,
with pictures. And update it often enough that they can tell **at any moment** what the project has
spent. Both of those are now on the page, and the second one is the harder half.

## What is on it

The first thing on the progress page is a single large number: what this has cost so far. Beside it
is the current burn rate, the window that total covers, and the exact minute the reading was taken.
That last part is not decoration. A stale total is worse than no total, because it reads as current
— so if the reading is more than forty-five minutes old the page says **STALE** across the top, in
those letters, with its age.

Under that are three line charts sharing one clock:

- **Cost per hour of fleet runtime**, with the target — a quarter of where we started — drawn as a
  marked line, so how far off it is is a distance you can see rather than a sum you have to do.
- **Cost per agent-hour** underneath it. This is the number that says whether we got more efficient
  or merely quieter. If the first chart falls and this one does not, we simply ran fewer agents and
  achieved nothing at all.
- **How many agents were running**, on the same timeline. It sits in the same stack deliberately.
  The cheapest way to make a cost chart look good is to stop working, and a cost figure published
  without that chart beside it is not a result.

Every measurement is its own dot. Nothing is averaged into a smooth curve, because the owner asked
for line charts with many dots on them, and a smoothed line is a line that has already decided which
wobbles mattered.

Then the money split two ways: by model, and by the four separate token prices — fresh input, cache
write, cache read, output. Those two splits are where the two largest savings live, and a single
total hides both of them completely. And finally every change the cost programme has tried, with its
before and after, whether it was kept or reversed, what would trip its reversal, and whether that
reversal has actually been executed on a copy rather than merely believed in. The reversed ones stay
on the page. A ledger showing only what worked is the same failure as a critic who finds no gaps.

## The half that matters more

None of those numbers are calculated here. There is a separate job whose only work is measuring cost
from the session transcript, and it writes one file. This page reads that file and draws it. It does
not add, divide or rescale a single dollar — because this project has already shipped a good
detection model and a broken one at the same time, by having two implementations of one thing, and
a dashboard that quietly recalculates cost is exactly that mistake with money on it.

The consequence is a page that is often required to admit ignorance, and the whole design is about
making that admission louder than a number would be:

- **No file at all** — it says the instrument has not landed, names the file it is waiting for, and
  shows no money whatsoever. That is the state on the live site right now.
- **Unreadable file** — it says so and draws nothing else. It does not fall back to the last figure
  it saw.
- **Refresh failed** — it says the refresh failed, at what time, with the reason, and labels the
  figures below as *the last good reading, taken at 11:02, and not current*.
- **A number the file does not state** — an em dash, and a line in a list of problems naming the
  field. Not a reconstruction from the neighbouring fields.
- **A total that covers only part of the project** — the headline stops saying "spend to date" and
  starts saying "spend in this window", with a note that earlier spend is not in it.

That last group is the dangerous one, and it took the most work: a file that is *present and
partially wrong* renders as a confident number, which is worse than an obvious gap. So the reader is
strict to the point of rudeness. A dollar figure written as text rather than a number is not
accepted and quietly converted; it is refused and reported.

I checked that this is real rather than decorative in the only way that counts: I taught the reader,
on purpose, to be helpful and accept `"1234.56"` as a number. It immediately printed **$1,234.56** at
the top of the page as though it had measured it, and the test went red on exactly that string. Then
I put the strictness back and the test went green again. A test that has never been watched failing
is not a test.

It refreshes on every bank — the same commit that keeps the rest of the page current — and it can
never block that commit. A check that fails closed has stopped this whole machine twice, and a cost
report that stops the fleet has cost more than it saves. If the measuring job breaks, the failure is
published on the page instead of stopping anyone's work, which is also the only place the owner
would ever see it.

The picture is a fixture — invented numbers, stamped as invented, rendered to prove the layout while
the real measuring job is still being built. Until that lands, the live page shows the empty state
and says why.
