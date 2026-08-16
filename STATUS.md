# Where we are right now

**Last updated: 2026-08-15, late evening.** One screen. If this is more than a day old, distrust it and say so.

---

## What the agents are working on this minute

Four agents, on ring 1. (The container restarted overnight and killed a full fleet mid-round; their
work was quarantined on a side branch and every round restarted from it, so nothing was lost.)

- **Judging the sun, round three** — the cool key was built, measured, and deliberately **not
  shipped**; the reason reframes three rounds of this work.
- **Judging the crowd, which now breathes** — 27 of 27 townspeople move, replicated across three
  sessions, with the motion visible in pixels rather than only in numbers.
- **The water, round five** — the fade's setting is twelve times too big, and every number this work
  has ever published was measured on an unstable setting.
- **Judging the dialogue and books fix** — the authoring leak and the `undefined` book bodies are
  closed; a critic is checking them.

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

**Two things you would see, found by accident — and both are now fixed.** A judge reading the
conversation window noticed a line that *"reads like an authoring instruction to the writer rather than
in-world dialogue"* — because it was one. **I told you 25 speakers were using it; the real number is 5
lines from a single source**, and the "25" I quoted turned out to be a legitimate piece of authored
Argonian address, checked by hand across 43 candidate matches. And **books were printing the literal
word `undefined`** instead of their text: I said four, the true blast radius is **24** — a title-only
catalogue of 162 entries loads fifth of twenty-six and was overwriting every real book that loaded
before it. Both carry regression checks proven to fail on the old build and pass on the new.

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
  **The real finding is worse and more useful: every number this work has ever published was measured
  on a setting that drifts by up to 62% with nothing changed.** Measured properly, the fade's own
  control says the shipped version leaves only **41% of the water visible** that was there two rounds
  ago — and the width it was tuned for doesn't change at all between the shipped setting and one
  **twelve times smaller**. Round five sets it to the small one.
  **Still true: nobody knows what draws the marsh stripes.** Switch the reflection off entirely and 76%
  of them remain; two further explanations were proposed and killed by the same test.

- **The characters were being drawn inside-out — fixed, and confirmed by eye.** Your winding tip was
  right and bigger than the report you sent: **153,344 of 227,850 triangles (67.3%)** had normals
  disagreeing with winding. Now zero. A Gideon market stand of *chrome-and-glass skeletons with black
  shards jutting from their backs* now holds solid people in coloured clothes.
- **Four more things about the cast, all fixed from one shared body plan.** 44% were on a generic body
  with **no eye geometry at all**; **everyone was the wrong height** (0 of 41 in the correct band → 41
  of 41); the clothing textures were pasted **5.5× too fine**, which averages to a flat colour; and the
  eyes went from cream googly balls to dark sockets.

- **People stand on the ground now, and it is photographed.** Positions came from one authored constant
  per settlement, never compared to the terrain: of 31 drawn at Lilmoth, **12 were underground and 15
  in the air, worst 35 m up**. Now zero and zero, confirmed on hardware.
- **The bodies were measurably cones — now they have hips and a waist.** No instrument in the project
  could tell a cone from a body; one was written and the answer was blunt — the **hip was 18% narrower
  than the waist on 11 of 11 figures**, and the waist pinch read **0.029, identical to a synthetic
  cone**. So "slabs" was literally accurate. Fixed on the shared body plan: **one edit moved all 17
  characters**, for 96 extra triangles and no new draw call.
- **Armoured helmets were erasing people's eyes** — **69 of 96 camera bearings** lost the eye entirely,
  two armour sets from *every* angle, because the head was shrunk without shrinking what sits on it.
  Now 0 of 96.
- **The player's own eye was the worst in the game** — 2.16× the brightness of their face, on the
  player and **260 of 408** NPC records. Now 0.847×.
- **The body is photographed on real hardware and the change is visible.** Eight angles, before and
  after, on an RTX A4500 — the picture the last four judgements were written against. The waist reads
  at player distance.
- **Everybody in the game stood in one identical pose. Now 392 of 408 stand differently.** Every NPC
  had shoulder and hip tilt of **exactly 0.000°** — nobody put their weight on one leg, which is the
  first thing that makes a crowd read as people. Each now has a stance seeded from their own identity,
  so the same person always stands the same way.
  **It is photographed at last** — nine frames, five angles and two motion offsets, the first pictures
  of this work in eleven rounds. The builder had reported the camera and the townspeople running on two
  different clocks; **that turned out to be false**, and the real cause was one object reporting its
  position as the origin.
  **The photograph showed the next problem — they were statues.** Over sixty frames not one person
  moved a single joint. **They breathe now:** every townsperson at the stand moves, staggered so the
  crowd doesn't inhale in unison, replicated in three separate runs and confirmed in pixels — three
  consecutive frames differ by 42,186, 30,847 and 32,872 pixels against a control of exactly zero.
  **The builder's first attempt at the stagger passed offline and starved in the real game** — 408 of
  408 on the bench, **2 of 27 live** — because the game skips frames and its scheduler assumed it
  didn't. It found that itself, kept the failing run, and rebuilt it.
  **And the 29 buried people are explained:** they are the ones whose day is spent indoors, correctly
  hidden — but their position is an *interior* coordinate read as a world one, so each is built and
  parked at the map origin, 41 m down. They now cost nothing to draw.
- **A side-effect of that pose, found and closed: it lifted everyone 8.9 mm off the floor.** Fixed and
  photographed; worst planting error across all 408 people is now effectively zero.
- **The eye had a pupil worth literally zero pixels — now it has one, and it reads in conversation.**
  The pupil rendered **0 pixels at every angle on 4 of 5 face shapes**, and the cause was not the eye:
  **the snout was in front of it.** Moved 6 mm out and 12 mm forward, then photographed on hardware:
  at talking distance you now see a dark pupil with a catchlight. At third-person distance it is still
  two amber smudges.
- **The hover is fixed and photographed** — both feet back within a millimetre of where they sat, cross-
  checked by two independently written capture tools.
- **Some good news:** the character bar now has **12 of its 18 checks published** for the first time,
  and the head-count proportion check went from hard fail to pass — 0 of 41 figures in band, to 41/41.


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
dome cut to a third; night got its own moon lever, because the moon had no control at all. **Judged and
failed at 2 of 10** — with one real win: **at midday the settlement casts large readable shadows in 8
of 12 camera angles**, shot in motion over 54 frames.

**And the judge found the thing the numbers were missing: our sunlight has no colour.** The corpus's
own detector was sitting unused — our daylight key reads **7.2°** against a minimum of 15, where six
real photographs read 16–143°.

**Round two tried to fix it and could not — and then a judge found the answer.** The whole time, the
fix was to make the daylight **cooler**, and both rounds pushed it *warmer*. Worse, the round that
declared the whole approach exhausted **could not have tested it**: its own tool only ever applied
"warm" to the sun and "cool" to the sky, so no experiment it ran could cool the key light. Seven
untried settings were sitting written in the file.

The judge ran them. Setting the key to the game's **own night-sky blue** scores **17.1** against a
minimum of 15 — **the first passing configuration this project has ever measured** — and it survives
every check for brightness, contrast and shadow that could have caught it cheating. The switch already
exists in the code and takes a negative number; nobody had tried one. Round three is now making it a
real source change rather than a test-harness one.

**And this un-does a much bigger claim I passed on to you.** I said the builder's conclusion — that
colour barely matters while every surface is the same olive — might reorder the whole plan and make
materials the blocker instead of light. **That ruling is falsified.** The ordering stands.

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

**The coverage hole is bigger than it looked.** Only **2 of the 5** outdoor lighting recipes were
rebalanced, and **overcast and storm weather cover 59% of daylight** across the thirteen regions. So
most of the time you spend outdoors is still lit by the old flat budget.

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
