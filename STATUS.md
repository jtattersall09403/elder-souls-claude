# Where we are right now

**Last updated: 2026-08-15, late evening.** One screen. If this is more than a day old, distrust it and say so.

---

## What the agents are working on this minute

Four agents, on ring 1. (The container restarted overnight and killed a full fleet mid-round; their
work was quarantined on a side branch and every round restarted from it, so nothing was lost.)

- **The sun, round four** — a judge found the real hard fail, sitting unrecorded in the evidence since
  round one, and proved the metric we tuned against reads the wrong pixels.
- **Judging the crowd, which now breathes** — 27 of 27 townspeople move, replicated across three
  sessions, with the motion visible in pixels rather than only in numbers.
- **Judging the water, round five** — the setting is corrected, and the round found the bigger cost was
  somewhere else entirely.
- **Judging the dialogue and books guards** — the checks that could delete their own evidence have been
  rebuilt, and all seven failure tests now go red when they should.

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

**Two things you would see, found by accident — and both are now fixed.** A judge noticed a line in the
conversation window that *"reads like an authoring instruction to the writer"* — because it was one
(**5 lines from a single source**; the larger count I first quoted was legitimate authored text,
checked by hand across 43 matches). And **books were printing the literal word `undefined`**: I said
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
  HUD's thumbstick screens said *"no cursor, no hover, no click target"* and was silently inherited by
  the dialogue window, so every control you could see was a picture of a control. **Driving it turned
  up a bug that would have trapped you:** creation **dead-ended permanently** at the class verdict on
  all three routes.
- **The menus are denser *and* readable now.** Sizing each panel to its contents cleared all five
  density failures and then made the text collide — level-up drew name, value and gauge into the same
  pixels on 9 of 10 rows, and 8 of 19 journal entries laid out past the panel. Both are now **0**.
- **The container screen: three rounds, three failures, and every one closed a real defect.** Its
  description **declared 137 characters and drew 100** with no "…"; **all seven rows declared a gold
  price and drew none**; the fix for that truncated the weight column to a *wrong number*; and two
  headers were being printed straight through the first row. **All fixed** — no numeric column
  truncates, density is better than before it broke, and long descriptions now open in a reading view
  where all **45 of 45** items show their full text.
  **Three of the checks meant to catch this could not fail.** One read the text the screen *declared*
  rather than what it *drew*; one was a literal `true`; one only looked inside a single row band. All
  three now assert real numbers and go red on the broken build first.



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
  **The real finding is worse and more useful: every number this work had ever published was measured on
  a setting that drifts by up to 62% with nothing changed.** Round five found a stable one — and then
  found that the thing eating the water isn't the fade at all: a **multiplier added two rounds ago
  costs about three times more** than the setting everyone had been arguing about. That's round six.
  **And the good news is real:** for the first time in this piece's history, a proper control proves the
  effect **is not just the picture getting darker** — a matched-brightness fake produces no waterline at
  all where the real one produces 32 pixels. It also finally shot the water **in motion**, five rounds
  in, and that turned up a new hard failure nobody had measured.
  **Still true: nobody knows what draws the marsh stripes.** Switch the reflection off entirely and 76%
  of them remain; two further explanations were proposed and killed by the same test.

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
- **Armoured helmets were erasing people's eyes** — **69 of 96 camera bearings** lost the eye entirely,
  two armour sets from *every* angle, because the head was shrunk without shrinking what sits on it.
  Now 0 of 96.

- **The body is photographed on real hardware and the change is visible.** Eight angles, before and
  after, on an RTX A4500 — the picture the last four judgements were written against. The waist reads
  at player distance.
- **Everybody in the game stood in one identical pose, and none of them moved. Both are fixed.** Every
  NPC had shoulder and hip tilt of **exactly 0.000°** — nobody put their weight on one leg — and over
  sixty frames not one person moved a single joint. Now **392 of 408 stand differently**, each seeded
  from their own identity so the same person always stands the same way, and every townsperson
  breathes, staggered so the crowd doesn't inhale in unison. Verified independently in the running
  game, replicated across three sessions, and shown in pixels: three consecutive frames differ by
  42,186, 30,847 and 32,872 pixels against a control of exactly zero.
  **It is photographed at last** — nine frames, five angles, two motion offsets, the first pictures of
  this work in eleven rounds. **A counting error worth knowing:** two rounds reported 60 people at that
  spot. **29 are invisible, parked at the map origin 41 m underground** — they are the ones whose day
  is spent indoors, correctly hidden, but their position is an *interior* coordinate read as a world
  one. The real crowd is 27, and they now cost nothing to draw.

- **A side-effect of that pose, found and closed: it lifted everyone 8.9 mm off the floor.** Fixed and
  photographed; worst planting error across all 408 people is now effectively zero.
- **The eye had a pupil worth literally zero pixels — now it has one, and it reads in conversation.**
  The pupil rendered **0 pixels at every angle on 4 of 5 face shapes**, and the cause was not the eye:
  **the snout was in front of it.** Moved 6 mm out and 12 mm forward, then photographed on hardware:
  at talking distance you now see a dark pupil with a catchlight. At third-person distance it is still
  two amber smudges.


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

Two independent blind comparisons against real reference photographs, and **we lost 5 of 5 both
times** — the second one *after* three correct fixes landed. Every judge named the same two absences:
no material differentiation, and no contact shadow. Those are exactly the two things the fixes
delivered and measured as delivered.

**The diagnosis: the fixes work, and they were being applied to 19% of the picture.** Measured on the
exact window the judges looked at — **turning off every shadow in the game changed the judged pixels
less than photographing the same frame twice did**, while the sky's ambient dome moved them **28 times
as much as the entire shadow map**. The reason is that **46% of the light in a frame was indirect and
none of it could be shadowed**: the sky's contribution is a dome that, in the renderer's own comment,
contains *"no terrain, no settlement and no canopy"*, so it lights every surface as if nothing were in
the way.

**The rebalance landed, and it is four numbers.** Daytime key light ×3, sky ×0.75, fill ×0.75, ambient
dome cut to a third; night got its own moon lever. **Judged and failed at 2 of 10** — with one real
win: **at midday the settlement casts large readable shadows in 8 of 12 camera angles**.

**And the judge found the thing the numbers were missing: our sunlight has no colour.** The corpus's
own detector was sitting unused — our daylight key reads **7.2°** against a minimum of 15, where six
real photographs read 16–143°.

**Three rounds tried to fix it. A judge has now shown we were measuring the wrong thing.**

The check that has driven all three rounds splits the picture into "lit" and "shadow" — and it has
them **backwards**. Painted back onto the frame, what it calls *lit* is **the sky and a pale wall**,
and what it calls *shadow* is **speckle on open sunlit ground**. Worse: **run it with the sun switched
off entirely and it scores higher** at seven of eight test shots. And the same shipped build **passes
it outright** when the camera is walking at midday and fails it at every angle at 8 a.m. — so the
number was a property of *where the camera was pointed*, not of the light.

**Meanwhile the real hard failure was sitting in the evidence the whole time and nobody wrote it
down** — a shadow-detail measure that has been below its floor **since round one**, in the first
round's own saved picture, unrecorded by all three judgements. And the shadow system itself was never
built to spec: **one shadow map where the standard asks for three**. That is round four's work.

**Two things I told you are withdrawn.** "Our sunlight has no colour" was the wrong diagnosis. And the
rule I wrote to replace it was half wrong too — I claimed the four test shots sorted perfectly by how
much shadow they contained; they don't, and the fix I proposed would have passed shots carrying a
building's shadow across sunlit stone.

**The builder's conclusion, which a judge is now testing, would change the order of the work:** colour
in a picture is the surface times the light, and **when every surface in the world is the same olive,
the light barely matters**. That is exactly what all five blind judges wrote in words. If it holds,
the thing blocking us is giving surfaces different materials, not tuning the sun — and I also have to
withdraw "13:00 good, 08:00 empty": shadow area swings **fivefold across a camera orbit at a fixed
sun**, so that claim was an artefact of looking from one angle.

**That is because the acceptance number I wrote was wrong, and I have ruled it void.** It asked how
much the picture changes when you switch the sun off — but *a pixel in shadow does not change when you
switch the sun off*, so the measure shrinks exactly as the fix succeeds and the build is penalised for
casting shadows. Replaced with the same test taken **only on the lit parts of the frame**, plus a
clause that the shadowed area must not shrink. **This is the fourth metric in two days that got better
when the game got worse, or worse when it got better, and three of the four were mine.**

**The coverage hole:** only **2 of the 5** outdoor lighting recipes were rebalanced, and **overcast and
storm weather cover 59% of daylight** — neither touched, and storm has never been photographed at all.

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
