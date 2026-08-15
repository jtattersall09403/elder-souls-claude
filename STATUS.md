# Where we are right now

**Last updated: 2026-08-15, late evening.** One screen. If this is more than a day old, distrust it and say so.

---

## What the agents are working on this minute

**The container restarted at 20:03 and killed all four agents mid-round.** Their unfinished work is
preserved on a side branch and all four rounds have been restarted from it — nothing is lost, but
roughly two hours of work has to be re-derived rather than trusted. Same four jobs, all on ring 1:

- **Judging the sun, round two** — the colour fix did not work, and the builder thinks the problem
  isn't the light at all.
- **Characters, round eleven** — the crowd. Every NPC in the game stands in one identical pose, and a
  town has 14 different bodies between 408 people.
- **The water, round three** — two of the four things the bar requires of water were never in the
  shader at all.
- **Judging the container screen** — round seven closed the density regression and found a third
  defect nobody had reported.

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
  now **0**. The columns had been sized as *fractions* of the row, which was right at the old wide
  panel and collided at the new narrow one, because font sizes are fixed pixels.
- **The menus were judged independently and FAILED at 2 of 10 — twice — and round seven has now closed
  the worst of it.** The reflow work was confirmed by the judge: level-up's rows read at both sizes and
  the journal runs **0 of 19** blocks off the page. The container was the failure: its description
  **declared 137 characters and drew 100** — ten words gone with no "…" — and **all seven rows declared
  a gold price and none drew one**. Both were fixed, and the fix then broke the weight column (`11.5` →
  `11…`), which is not a shortened label but a wrong number. **Now: no numeric column truncates at all,
  the density regression is not just repaired but better than before it broke, and a third defect
  nobody had reported is fixed** — the item's condition was being drawn 24 units outside its own box
  and clipped away entirely on every conditioned item.
  **Two of the checks meant to catch this could not fail.** One read the text the screen *declared*
  rather than what it *drew*, so it passed no matter what; another was written as a literal `true`.
  Both now assert real published numbers, and both were proven to go red on a deliberately broken row
  first.
- **⚠ That measurement scare is closed, and the answer was the opposite.** I said an hour ago that a
  filed verdict's numbers wouldn't reproduce and to distrust the screen scores. They reproduce
  **exactly**. The four "isolated" copies the builder compared had all quietly measured **the same
  live tree** — the tools work out where the repo is from *their own location on disk*, so copying the
  game somewhere and running the normal command measures the original, not the copy. Four results
  agreeing to four decimal places was the tell, and it reads as rigour. The real comparison shows
  round 6's own change took the container from a pass to a fail. **Everything that was ever proved by
  "we deleted the fix and the old number came back" is now worth re-checking.**
- **The water: judged again, and kept — but the bar says we have been fixing the wrong quarter.** The
  eye-level improvement is real and was confirmed from eight camera angles: at some bearings the pale
  washed-out sheet becomes deeper teal-green with the reflection confined to the middle distance, and
  at others the same change buys almost nothing. **The finding that matters: of the four things the
  standard requires water to do, two are simply not in the code** — the colour does not vary with
  depth (it is a constant), and there is no fade where water meets land. Two rounds went into tuning
  the one component that already existed. Round three is building the missing two.
  **And I have to correct myself again.** I said the leftover stripes were the reflection being drawn
  at half resolution. Switch the reflection off entirely and **76% of the stripes remain**. The judge
  then proposed two explanations of its own and killed both by the same test. **After two rounds
  nobody knows what draws the marsh stripes**, and that is the honest state.
- **The container screen prints the word `undefined`** as its title. Being fixed.
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
- **People stand on the ground now, and it is photographed.** NPC positions came from one authored
  constant per settlement, never compared to the terrain. At Lilmoth, of 31 people drawn, **12 were
  underground and 15 were in the air, worst 35 metres up**. Now zero and zero, confirmed on hardware.
- **The bodies were measurably cones — now they have hips and a waist.** Nobody could say *how* wrong
  the torso was, because no instrument in the project could tell a cone from a body. One was written,
  and the answer was blunt: the **hip was 18% narrower than the waist on 11 of 11 figures**, and the
  waist pinch measured **0.029 — identical to the reading a synthetic cone gives**. So "slabs" was
  literally accurate. Fixed on the shared body plan, so **one edit moved all 17 characters**: hips now
  wider than waists on 11 of 11, for 96 extra triangles and no new draw call.
- **Armoured helmets were erasing people's eyes.** Not one hat — **69 of 96 camera bearings** lost the
  eye entirely, with two armour sets losing it from *every* angle, because the head was shrunk without
  shrinking what sits on it and the heights were hand-typed so the band drew straight through the eye.
  Now 0 of 96.
- **The player's own eye was the worst in the game** — 2.16× the brightness of their face, affecting
  the player and **260 of 408** NPC records. Now 0.847× — but see below: the brightness was the only
  thing fixed.
- **The body is photographed on real hardware and the change is visible.** Eight angles, before and
  after, on an RTX A4500 — the picture the last four judgements were written against. The waist reads
  at player distance.
- **The player was standing like a shop mannequin — fixed for the player, and NOT for anybody else.**
  Measured on the pose the game actually draws: shoulder tilt 0.3°, **hip tilt exactly 0.000°**, and
  frames two seconds apart were the identical stand. A real person's weight sits on one leg. **I told
  you this moved all 408 NPCs. It does not — it moves the player only**, and the next round found why:
  the code that poses townspeople never reads the stance layer at all, so **every NPC in the game
  stands in one identical rest pose**. That is now the biggest single reason a town reads as a crowd of
  copies, and it is the next job.
- **The stance was photographed, and it lifted every character in the game off the floor.** Rolling the
  hips floated one foot; that was levelled properly, but it levelled them **8.9 mm too high**, and the
  builder's reason for leaving it there turned out to be wrong — the foot-conform code it trusted is a
  *terrain difference* term that is exactly zero on flat ground, so it cannot absorb a constant. In the
  running game on real hardware: **frames of the idle loop where both soles are clear of the ground go
  from 24 of 96 to 68 of 96**, largest gap 2 mm → 11 mm. All 409 characters hover slightly. Being fixed
  now; the remedy is one line of data.
- **The eye had a pupil worth literally zero pixels — now it has one, and it reads in conversation.**
  The pupil existed the whole time and rendered **0 pixels at every camera angle on 4 of 5 face
  shapes**, and the cause was not the eye: **the snout was in front of it.** Moved 6 mm out and 12 mm
  forward, then photographed on real hardware: **at talking distance you now see a dark pupil with a
  catchlight in it.** Step back to third-person distance and it is still two amber smudges, and "no
  lid, no orbit" still stands.
- **The hover is fixed and photographed** — both feet back down within a millimetre of where they sat
  before the new pose, cross-checked by two independently written capture tools.
- **Some good news in the same verdict:** the character bar now has **12 of its 18 checks published**
  for the first time, and the head-count proportion check **has quietly gone from a hard fail to a pass**
  — 0 of 41 figures in band, to 41 of 41.
- **The four-round argument about "cracks" in the body got a photograph and a ruling.** The tool that
  counts them **emits no images**, so four rounds argued about the number blind. Someone finally dumped
  the frames and looked: the two largest "cracks" are **daylight between a hanging forearm and the
  body, capped by the greatsword's crossguard** — you can see the crossguard. Not holes.
- **The last independent look at the player is still the live verdict:** no waist, no shoulder line,
  shield and sword as planks. A critic is re-judging it now.
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
  works and is liked *where it lands*, and it lands on about half of conversations; combined with the
  first NPC you meet having none, most players would never find it. **Placement is the work now**, not
  more links. Both bugs the judges hit are fixed — the dead phrase was a topic gated to a different
  kind of person, so a phrase is now only drawn as followable if *this* speaker can answer it.
- Some buildings still overlap each other; 24 doors still open into another building.

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

**The rebalance has now landed, and it is four numbers.** Daytime key light ×3, sky ×0.75, fill
×0.75, ambient dome cut to a third; night got its own moon lever, because the moon had no control at
all — at 19:30 the game was scaling a *sun* of intensity 0.0126 while the light actually carrying the
frame was unreachable. **It has now been judged, and it failed at 2 of 10** — but with one real win in
it: **at midday the settlement casts large readable shadows in 8 of 12 camera angles**, shot in motion
on real hardware over 54 frames. At 08:00 there is still no building shadow on the ground at any angle.

**A correction I owe you.** I described the worst-scoring shot as going from "flat shadowless ground"
to "a large soft cast shadow". That was me narrating what I expected to see: re-measured, the crop was
**already 69–78% in shadow beforehand** and 90.6% of its pixels got *darker*. The fix removed the fill
that was hiding the existing shadow.

**And the judge found the thing the numbers were missing: our sunlight has no colour.** The corpus's
own detector was sitting unused — our daylight key reads **7.2°** against a minimum of 15, where six
real photographs read 16–143°.

**Round two tried to fix it and could not, and two things I told you about it were wrong.** I said the
remedy was a number that already exists in the file. It isn't: warming the key measured **worse**, and
the night-time "proof" I cited that the mechanism works turns out not to touch the moon at all — the
moon's colour is hard-coded where no lighting recipe reaches it. Eleven different configurations were
measured and every one lands between 5.8° and 7.3°, nowhere near 15.

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

**The coverage hole is bigger than it looked, and not where I said.** Only **2 of the 5** outdoor
lighting recipes were rebalanced. Dawn and dusk are a smaller band than I reported — 6.5% of the day,
not the ~10% I wrote — but **overcast and storm weather cover 59% of daylight** across the thirteen
regions' own weather, and neither was touched. So most of the time you spend outdoors is still lit by
the old flat budget.

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
