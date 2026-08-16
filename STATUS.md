# Where we are right now

**Last updated: 2026-08-15, late evening.** One screen. If this is more than a day old, distrust it and say so.

---

## What the agents are working on this minute

**The container restarted at 20:03 and killed all four agents mid-round.** Their unfinished work is
preserved on a side branch and all four rounds have been restarted from it — nothing is lost, but
roughly two hours of work has to be re-derived rather than trusted. Same four jobs, all on ring 1:

- **The sun, round three** — a judge found the fix: our daylight needs to go **cooler**, and both
  previous rounds pushed it warmer.
- **Characters, round twelve** — the crowd stands differently now but nobody in it moves. 392 poses,
  zero motion.
- **The water, round four** — the fade works; it just does nothing in the one region we kept testing
  it in.
- **Judging the container screen** — the header collision is closed and the description now has a way
  to be read in full.

## If you play right now, expect this

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
  the dialogue window, so every control you could see was a picture of a control. And character
  creation ran on the old panel, so the first conversation a new player ever had was the worse one.
  **Driving it turned up a bug that would have trapped you:** creation **dead-ended permanently** at
  the class verdict on all three routes, because the window only reset its selection when the *speaker*
  changed and the speaker never changes inside the Writ House.
- **The menus are denser *and* readable now.** Sizing each panel to its contents cleared all five
  density failures and then made the text collide — level-up drew name, value and gauge into the same
  pixels on 9 of 10 rows, and 8 of 19 journal entries laid out past the panel onto the world. Both are
  now **0**.
- **The menus were judged independently and FAILED at 2 of 10 — three times — though each round closes
  real defects.** The reflow work was confirmed by the judge: level-up's rows read at both sizes and
  the journal runs **0 of 19** blocks off the page. The container was the failure: its description
  **declared 137 characters and drew 100** — ten words gone with no "…" — and **all seven rows declared
  a gold price and none drew one**. Both were fixed, and the fix broke the weight column (`11.5` →
  `11…`) — a wrong number, not a shortened label. **Now: no numeric column truncates, the density is
  better than before it broke, and a third defect
  nobody had reported is fixed** — the item's condition was being drawn 24 units outside its own box
  and clipped away entirely on every conditioned item.
  **Three of the checks meant to catch this could not fail.** One read the text the screen *declared*
  rather than what it *drew*; one was written as a literal `true`; and the legibility pass called the
  container clean **while two headers were printed through the first row**, because it only looked
  inside one row band — a judge found that by cropping the picture at 2× and looking. All three now
  assert real numbers and were proven to go red on the broken build first. **The collision itself is
  fixed**, and long descriptions finally have somewhere to be read: a reading view opens over the
  lists, and all **45 of 45** items now show their full text.
- **⚠ A measurement scare, and the answer was the opposite of what I told you.** I said a filed
  verdict's numbers wouldn't reproduce and to distrust the screen scores. They reproduce **exactly**.
  The four "isolated" copies compared had all quietly measured **the same live tree** — the tools work
  out where the repo is from *their own location on disk*, so copying the game elsewhere and running
  the normal command measures the original. Four results agreeing to four decimals was the tell, and
  it reads as rigour. **Everything ever proved by "we deleted the fix and the old number came back" is
  now worth re-checking.**
- **The water: the depth colouring was running backwards, and now it exists at all.** Two of the four
  things the standard requires of water were simply not in the code. They are now, from one mechanism:
  light is absorbed through the water column against **each region's own murkiness value, which reaches
  the renderer for the first time in this project**. And the reason depth looked absent is better than
  that — it was *present, unlabelled and inverted*: the old body colour leaned on a term that gets
  **brighter** the deeper the water.
  **The first water result a dimmer switch cannot fake** — a matched-brightness control reproduces 118%
  of the luma change and **none** of the widening.
  **And the judge found why it looked like nothing.** In a second region it is obvious — the band where
  water meets land goes **1 pixel to 15** — while in the region three rounds kept testing, the water is
  **drowned**: no real bank exists there at all, and the three "shoreline close-ups" everyone had been
  chasing turn out to contain no shoreline. So the fade is real and the test site was wrong. Round four
  is making the fade work in metres rather than in murkiness, so it survives where you actually stand.
  **Still true: nobody knows what draws the marsh stripes.** Switch the reflection off entirely and 76%
  of them remain; two further explanations were proposed and killed by the same test.
- Shadowed areas crush to black with no detail — a real fix landed, but it is small (**+4.4%**), and
  its author caught that 93.7% of the gain it was about to claim reproduced with no fix in the tree.
- **The characters were being drawn inside-out — fixed, and confirmed by eye.** Your winding tip was
  right and bigger than the report you sent: **153,344 of 227,850 triangles (67.3%)** had normals
  disagreeing with winding, body meshes **13 of 13 inverted**. Now zero, photographed on hardware over
  332 frames. A Gideon market stand that held *chrome-and-glass skeletons with black shards jutting
  from their backs* now holds solid people in coloured clothes.
- **Four more things about the cast, all fixed and all from one shared body plan.** 44% of them were on
  a generic body with **no eye geometry at all** (79 → 260 NPCs routed correctly); **everyone was the
  wrong height** (0 of 41 in the 7–8 head band → 41 of 41); the clothing textures were pasted **5.5×
  too fine**, which averages to a flat colour — a smith who was one tone shoulder-to-ankle now has a
  sash, cord rings, a hem and a yoke, and *a background NPC gained one nobody targeted*; and the eyes
  went from cream googly balls to dark sockets.
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
- **Everybody in the game stood in one identical pose. Now 392 of 408 stand differently.** Measured on
  the pose the game actually draws, every NPC had shoulder and hip tilt of **exactly 0.000°** — nobody
  put their weight on one leg, which is the first thing that makes a crowd read as people. In the
  running game at Lilmoth, **60 of 60 townspeople now clear the bar** (which asks for 90%), each with a
  different stance seeded from their own identity so the same person always stands the same way.
  **It is photographed at last** — nine frames, five angles and two motion offsets, the first pictures
  of this work in eleven rounds. The builder had reported the camera and the townspeople running on two
  different clocks; **that turned out to be false**, and the real cause was one object reporting its
  position as the origin.
  **And the photograph shows the next problem: they are statues.** Over sixty frames, **not one person
  moves a single joint** — 392 different poses, all frozen. Round twelve is giving them breathing,
  staggered per person so a crowd doesn't inhale in unison.
  **A counting error worth knowing:** two rounds reported 60 people at that spot. **29 of them are
  invisible, heaped at the map origin 41 metres underground.** The real crowd is 27, and nobody has
  looked at why the other 29 are down there.
- **A side-effect of that pose, found and closed: it lifted everyone 8.9 mm off the floor.** Fixed and
  photographed; worst planting error across all 408 people is now effectively zero.
- **The eye had a pupil worth literally zero pixels — now it has one, and it reads in conversation.**
  The pupil rendered **0 pixels at every angle on 4 of 5 face shapes**, and the cause was not the eye:
  **the snout was in front of it.** Moved 6 mm out and 12 mm forward, then photographed on hardware:
  at talking distance you now see a dark pupil with a catchlight. At third-person distance it is still
  two amber smudges.
- **The hover is fixed and photographed** — both feet back down within a millimetre of where they sat
  before the new pose, cross-checked by two independently written capture tools.
- **Some good news in the same verdict:** the character bar now has **12 of its 18 checks published**
  for the first time, and the head-count proportion check **has quietly gone from a hard fail to a pass**
  — 0 of 41 figures in band, to 41 of 41.
- **The four-round argument about "cracks" in the body got a photograph and a ruling.** The tool that
  counts them **emits no images**, so four rounds argued about the number blind. Someone finally dumped
  the frames and looked: the two largest "cracks" are **daylight between a hanging forearm and the
  body, capped by the greatsword's crossguard** — you can see the crossguard. Not holes.
- **Still owed on characters:** none of this has been photographed in the game yet. And there is a
  measured reason the foot work kept photographing as "no change" — the three camera stands used for
  character captures offer **at most 34 mm of ground height difference between the two feet**, so a
  photograph there was predetermined to show nothing whatever the fix did.
- **Nothing casts a contact shadow** — *fixed today, not yet judged.* The old "ambient occlusion" turned
  out to be an edge detector that was structurally blind to exactly this. Real occlusion has replaced
  it. Shadows still crush to black; that fix is being built now.
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
