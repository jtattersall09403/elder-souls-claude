# Where we are right now

**Last updated: 2026-08-15, late evening.** One screen. If this is more than a day old, distrust it and say so.

---

## What the agents are working on this minute

Four agents, on ring 1. (The container restarted overnight and killed a full fleet mid-round; their
work was quarantined on a side branch and every round restarted from it, so nothing was lost.)

- **Judging the sun, round four** — the hard fail that sat unrecorded since round one is closed, and
  storm weather has been photographed for the first time.
- **Judging the crowd, which went from 14 different bodies to 72** — and four more people who were
  standing 6 km out to sea are back in their towns.
- **The water, round six** — chasing the thing that actually costs the water, now that the measurement
  we judged three rounds on has been thrown out.
- **The dialogue leak, round three** — we fixed a third of it twice; the rest is still being spoken by
  every line that NPC says.

## If you play right now, expect this

**The interface has now been judged blind, and it failed.** Six people were each shown one screenshot
of one screen, with the game world blacked out entirely, and asked what it was — no context, no
comparison. **Nobody said "don't know" and meant it as a compliment:** four screens read as a real
game's menu, and **two — the inventory and the combat HUD — were called "nothing physical", flat
panels and bars.** That is the sharpest failure the standard has, and it caps the interface's art
score at **2 out of 10**.

**The most useful thing to come out of it is a shopping list.** Our own art direction names nine
materials the interface should be made of. Across six people looking hard, only **parchment and ink**
were ever seen. **Chitin, root, bone, shell inlay and reed weave: nobody saw them anywhere** — and the
two screens carrying none of them are exactly the two that failed hardest.

**Two things you would see, found by accident.** A judge noticed a line in the conversation window that
*"reads like an authoring instruction to the writer"* — because it was one. **And I have to withdraw a
withdrawal.** I told you the second half of that line was legitimate authored text and not part of the
defect; a builder and a critic both checked the word list and agreed. A third judge drove the actual
game and found **all five lines that NPC speaks still carry it, sometimes as the opening words**. The
first two were reading the *word list*; the judge was reading *the sentence a player hears*. Being
fixed properly now, with a check that reads composed speech rather than fragments. And **books were printing the literal word `undefined`**: I said
four, the true blast radius is **24** — a title-only catalogue of 162 entries loads fifth of twenty-six
and was overwriting every real book before it. **The checks guarding them failed their own audit, and are now rebuilt.** One **imported a generator
that rewrites the very file it then scans**, so hand-authoring the defect back in made it *vanish* and
the check reported all clear. Two others tested the fixed function while nothing verified anything
still called it. All seven failure tests now go red when they should — and the books repair is proven
**in the running game**, not just in the data: with the fix reverted the library collapses from 1,897
pages to 1,715 and single-page books go from 15 to 57. The books defect was also **understated**:
across 500 shuffled load orders the old code broke anywhere from 0 to 162 books depending purely on
file order; the new code is invariant in all 500.

**It is a slice, not a game.** You can walk around, look at things, open the map and journal, talk to people, and fight. It will not look good yet.

**Better than it was:**
- The world has hills and distance instead of grey haze.
- Edges are clean instead of jagged.
- Surfaces have just started responding to light properly — this landed hours ago and is the first thing you might actually notice.
- You come out of character creation in **Thorn** facing somewhere sensible, through a door that now exists (it was drawn as a solid wall).
- The map opens, shows the whole province, and hides only the markers you haven't found.

**Still wrong, and you will see it:**
- **Dialogue: clicking works, and character creation now uses the same window.** Both faults you found
  are closed. There was **no pointer path in the entire interface** — a rule written for the combat
  HUD's thumbstick screens was silently inherited by the dialogue window, so every control you could see
  was a picture of a control. Driving it also turned up a bug that would have trapped you: creation
  **dead-ended permanently** at the class verdict on all three routes.


- **The container screen: three rounds, three failures, and every one closed a real defect.** Its
  description **declared 137 characters and drew 100**; **all seven rows declared a gold price and drew
  none**; the fix for that truncated the weight column to a *wrong number*; and two headers printed
  straight through the first row. **All fixed** — no numeric column truncates, density is better than
  before it broke, and long descriptions open in a reading view where all **45 of 45** items show their
  full text. **Three of the checks meant to catch this could not fail** — one read the text the screen
  *declared* rather than what it *drew*, one was a literal `true`, one only looked inside a single row
  band. All three now go red on the broken build first.

- **The water: three rounds in, and the honest state is that we still cannot see the fix.** The sea was
  compositing a **61% mirror at every viewing angle**, including looking straight down where real water
  reflects 2%; that is fixed and at eye level it reads deeper and less washed-out. Two of the four
  things the standard requires of water were **never in the code** — depth did not change the colour
  (the term it leaned on got *brighter* the deeper the water) and there was no fade where water meets
  land. Both are built.

  **Two things I told you about it were wrong, and judges caught both.** I said the region we test in is
  drowned with no real bank — it has **47 waterline cells within 120 m, the nearest 17.7 metres away**;
  the close-ups were simply shot 5 metres from a stand whose bank is 18 metres off. And I passed on a
  measurement as proof that our tools were mis-measuring; it turned out to be an artefact of *which
  order the pictures were taken in*.
  **The real finding is worse and more useful: the ruler itself was broken.** A judge rebuilt the width
  measurement this work has been graded on for three rounds and found it returns **the identical answer
  on a picture nobody could see** — squash the contrast twenty-five-fold until the edge is invisible and
  it still reports the same 32 pixels. **Every width number in this piece's history is now void**, and
  the target I set for it is retired. Round five found a stable one — and then
  found that the thing eating the water isn't the fade at all: a **multiplier added two rounds ago
  costs about three times more** than the setting everyone had been arguing about. That's round six.
  **And a correction the builder made against itself, after it had already filed.** It had declared its
  fairness control a clean pass; re-checking its own logs it found a fifth run that half-fails, and
  rewrote the ruling. Its words: *"had I stopped ten minutes earlier I would have published the clean
  version and been wrong."* It also finally shot the water **in motion**, five rounds in, which turned
  up a new hard failure nobody had measured.

- **The characters were being drawn inside-out — fixed, and confirmed by eye.** Your winding tip was
  right and bigger than the report you sent: **153,344 of 227,850 triangles (67.3%)** had normals
  disagreeing with winding. A Gideon market stand of *chrome-and-glass skeletons with black shards
  jutting from their backs* now holds solid people in coloured clothes.
- **Four more things about the cast, all fixed from one shared body plan.** 44% were on a generic body
  with **no eye geometry at all**; **everyone was the wrong height** (0 of 41 in the correct band → 41
  of 41); the clothing textures were pasted **5.5× too fine**, which averages to a flat colour; and the
  eyes went from cream googly balls to dark sockets.

- **People stand on the ground now, and it is photographed.** Positions came from one authored constant
  per settlement, never compared to the terrain: of 31 drawn at Lilmoth, **12 were underground and 15 in
  the air, worst 35 m up**. Now zero and zero.

- **The bodies were measurably cones — now they have hips and a waist.** No instrument in the project
  could tell a cone from a body; one was written and the answer was blunt — the **hip was 18% narrower
  than the waist on 11 of 11 figures**, and the waist pinch read **0.029, identical to a synthetic
  cone**. So "slabs" was literally accurate. Fixed on the shared body plan: **one edit moved all 17
  characters**, for 96 extra triangles and no new draw call.

- **Everybody in the game stood in one identical pose, and none of them moved. Both are fixed.** Every
  NPC had shoulder and hip tilt of **exactly 0.000°** — nobody put their weight on one leg — and over
  sixty frames not one person moved a single joint. Now **392 of 408 stand differently**, each seeded
  from their own identity so the same person always stands the same way, and every townsperson
  breathes, staggered so the crowd doesn't inhale in unison, verified independently and replicated
  across three sessions. **Be calibrated about what that means: you will not see it.** The builder
  opened two frames 48 steps apart and said plainly *"I cannot see the breathing"* — at under 1.5° of
  joint movement per person per second, that is the predicted answer. It stops them being statues; it
  is not something you notice. **The body variety below is the part you would.**
  It is photographed at last, eleven rounds in.
- **And the crowd was still fourteen people. It is now seventy-two.** For 408 townspeople the game was
  drawing **14 distinct bodies** — one body per 29 people, with 93 identical pairs standing within 15
  metres of each other. Now **72**, one per 5.7, built from a new age/posture axis, twelve new body
  types and race-specific proportions. The builder **deliberately refused the easy version**: scaling
  people up and down would have satisfied the count while being invisible to the checks that police it.
  At Lilmoth, **26 distinct bodies among the 31 people drawn**.
- **Four people were standing 6 km out to sea, and the reason is worse than a typo.** A quest data file
  invented coordinates for 16 witnesses — **15 of them 5 to 10 km from the town each record names** —
  and all 16 were **already real people elsewhere in the game**, so the file had quietly stolen four
  residents from Archon and Gideon. The invented positions are gone and all 31 people at Lilmoth now
  stand where they belong.


- **The eye had a pupil worth literally zero pixels — now it has one, and it reads in conversation.**
  The pupil rendered **0 pixels at every angle on 4 of 5 face shapes**, and the cause was not the eye:
  **the snout was in front of it.** At talking distance you now see a dark pupil with a catchlight; at
  third-person distance it is still two amber smudges.

- **Dialogue: the topic links work, and were preferred — the first real quality judgement this project
  has ever completed.** Two people played two builds blind — ours, and one with the inline links
  removed but every topic still reachable from the list. **Both preferred ours**, and a third reader
  confirmed their accounts were genuinely distinguishable rather than a coin-flip.
  **The catch is the useful part:** of six people they talked to, the links were **absent on two,
  present on four, noticed on only two** — and on one the phrase **did nothing when pressed**. So it
  works and is liked *where it lands*, and it lands on about half of conversations. **Placement is the
  work now**, not more links. Both bugs the judges hit are fixed.
- Some buildings overlap; 24 doors open into another building.

## Why the game doesn't look better — answered today, and it's one number

**The diagnosis: the fixes work, and they were being applied to 19% of the picture.** Turning off every
shadow in the game changed the judged pixels **less than photographing the same frame twice** — because
**46% of the light was indirect and none of it could be shadowed**.

**The rebalance landed** — daytime key ×3, sky ×0.75, fill ×0.75, ambient dome cut to a third, and a
moon lever that never existed. **Judged and failed at 2 of 10**, with one real win: at midday the
settlement casts large readable shadows in 8 of 12 camera angles.

**Three rounds tried to fix it, and a judge showed we were measuring the wrong thing.** The check that
drove all three splits the picture into "lit" and "shadow" — and had them **backwards**: what it called
*lit* was the sky and a pale wall, what it called *shadow* was speckle on sunlit ground. Run it with
the sun switched off entirely and it scores *higher*. The number was a property of **where the camera
was pointed**, not of the light — which is why three rounds of tuning could not move it. Two things I
told you are withdrawn: "our sunlight has no colour" was the wrong diagnosis, and the rule I wrote to
replace it was half wrong too.

**The real hard failure was sitting in the evidence the whole time and nobody wrote it down** — a
shadow-detail measure below its floor **since round one**, in the first round's own saved picture,
unrecorded by all three judgements. **It is now closed, by one line**: shadows keep four times as much
detail as they did, contrast inside them passes for the first time, and it comes with the project's
first hue reading that is both passing *and* proven to be measuring the right pixels. **Shadowed areas
having detail in them is the thing you would actually see.**

**And storm weather has been photographed for the first time by anyone.** It fails on every count —
no cast shadow at all, flat and milky, **no rain visible**, and it renders **brighter than clear
noon**. Together with overcast that is **30 of the game's 43 weather states**, so most of the time you
spend outdoors is still lit by something nobody has looked at until tonight.

## The honest standard

**Do not assume anything is "delivered to 7/10" yet.** The bar is min-over-axes ≥ 7.0 and the visual work currently scores **5** — measured, not guessed: the first blind comparison against real reference plates ran on 14 August and **our images lost 5 out of 5**.

When a step here says *done*, it means done to the bar and independently checked. Nothing above says that yet.

## Roadmap

**Rebuilt 2026-08-14 from the repo** — `orchestration/ROADMAP.md`. 8 rings, 69 items, covering all
**149 reference items, 49 plans and 79 open gaps**, with the coverage proven by a generator that exits
non-zero if anything has no home. The previous one was written from memory and left the camera, the
main quest, travel, inventory and endings out entirely.

**We are in ring 1 — the frame.** Materials landed today; shadows and ambient occlusion are being
built now. Rings 2–7 (the fight, the world, the character, quests, platform, the whole thing) are
enumerated and not started.

## Cost

**$8,618 spent, running at $118/hour — 101.9% of baseline** (was 103.6% a few hours ago). The efficiency target is 25% of baseline
and we are not moving towards it. That is the honest position and it has not improved today.

**Why, plainly.** The one large lever is model routing, and you ruled — correctly — that 3D visuals
work goes to the stronger model because the cheaper one was not up to it. That is most of what the
fleet is currently doing, so the lever is closed while ring 1 runs. The mix is 89.5% expensive, barely
moved from 91.2%.

**What has landed, and it is all plumbing rather than model choice:** the documentation every agent
must read before starting fell from **145,000 tokens to 69,000**, paid back on every agent forever;
the landing tool stopped spending five minutes on a step the CI redoes anyway; **3.2 GB of dead GPU
captures** were pruned off a disk at 96% that was silently failing writes; and agents were leaving
background waiters armed that **re-woke them after they had finished** — one burned 39,000 tokens that
way. Together those moved the rate about 1.7 points. Real, but small against a target of 25%.

**My read:** today's spend bought findings that were worth it — the characters were being drawn
inside-out, the dialogue window had no mouse support at all, and the capture path can return frames
that are not pictures. None of those were findable cheaply. But that is a defence of *this* spend, not
a plan, and the target still needs one.
---

*Kept short on purpose. Detail lives in `orchestration/ROADMAP.md`; the honest failure record in `orchestration/HAZARDS.md`.*
