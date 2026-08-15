# Where we are right now

**Last updated: 2026-08-15, afternoon.** One screen. If this is more than a day old, distrust it and say so.

---

## What the agents are working on this minute

**Making the game look like a game** — four agents, all on ring 1:

- **Judging the sun.** The key-light rebalance landed — this is the one that matters, and it is the
  first change all day that should be visible the moment you walk outside.
- **Characters, round ten** — the new standing pose was judged and it lifted everyone off the floor;
  that, and an eye that still doesn't read as an eye.
- **The water, round two** — round one was judged and failed; the sea still acts as a 17% mirror when
  you look straight at it.
- **Judging the container screen fix** — and settling a worrying finding: a filed verdict's numbers
  don't reproduce on a byte-identical copy of the code it judged.

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
  are closed. On the first: there was **no pointer path in the entire interface** — a rule written for
  the combat HUD's thumbstick screens said *"no cursor, no hover, no click target"* and was silently
  inherited by the dialogue window. The keyboard always worked; the mouse and touch did nothing, so
  every control you could see was a picture of a control. On the second: character creation ran on the
  old panel, so the first conversation a new player ever had was the worse one. It now runs on the
  Morrowind window, all-or-nothing by construction so you can never see both in one scene.
  **Driving it turned up a bug that would have trapped you:** creation **dead-ended permanently** at
  the class verdict, on all three class routes — the window only reset its selection when the *speaker*
  changed, and the speaker never changes inside the Writ House. Also fixed: starting a new game with a
  conversation open crashed the simulation step.
- **The menus are denser *and* readable now.** Sizing each panel to its contents cleared all five
  density failures, and then made the text collide — level-up drew name, value and gauge into the same
  pixels on 9 of 10 rows, and 8 of 19 journal entries laid out past the panel onto the world. Both are
  now **0**. The cause was subtle: the columns were sized as *fractions* of the row, which was correct
  at the old wide panel and collided at the new narrow one, because font sizes are fixed pixels. Fixed
  by measuring the longest attribute name the game actually has, rather than guessing a fraction.
  **And the density score fell when the text stopped overlapping** — level-up sits at 0.1521 against a
  0.15 floor, because the overlapping ink that had been inflating it stopped counting. That is the
  clearest possible confirmation that the measure was rewarding the defect, and the builder flagged the
  thin margin rather than padding it out of sight.
- **The menus were judged independently and FAILED, scoring 2 of 10.** The reflow work is real and the
  judge confirmed it — level-up's rows read at both sizes, and the journal now runs **0 of 19** blocks
  off the page across all ten spreads. It fails on the **container** screen, on two things nobody had
  looked at: its description **declares 137 characters and draws 100** — ten words simply gone, with no
  "…" to tell you they were cut, and *the same sentence draws whole on the inventory screen* — and
  **all seven rows declare a gold price and not one of them draws it**, because the price column starts
  12 units past the edge of the box that clips it. **Both are now fixed** — every row shows its price,
  and the description ends in a "…" when there is more, instead of just stopping. Two honest costs the
  builder declared against itself: making the price column fit shrank *every* column by 27%, so long
  item names now truncate harder (`Black-water draught` → `Black-wat…`); and most items still show only
  2 of the 4–6 lines they need, because the box was not made bigger. Being judged now.
- **⚠ That measurement scare is closed, and the answer was the opposite.** I said an hour ago that a
  filed verdict's numbers wouldn't reproduce and to distrust the screen scores. They reproduce
  **exactly**. The four "isolated" copies the builder compared had all quietly measured **the same
  live tree** — the tools work out where the repo is from *their own location on disk*, so copying the
  game somewhere and running the normal command measures the original, not the copy. Four results
  agreeing to four decimal places was the tell, and it reads as rigour. The real comparison shows
  round 6's own change took the container from a pass to a fail. **Everything that was ever proved by
  "we deleted the fix and the old number came back" is now worth re-checking.**
- **The water: I told you it was 28% better yesterday. A judge has now failed it at 2 of 10, and the
  "28%" was mostly the water getting darker.** The diagnosis was right — the sea was compositing a
  **61% mirror at every viewing angle**, including looking straight down, where real water reflects
  about 2% — and the fix is real. But the tool that reported the improvement prints **three** numbers
  and only the one that fell was passed on: the other two went **up** 12% and 48%. Measured properly,
  the water is 16.9% *dimmer* and the fine-scale stripes are 5.8% *stronger*. Worst of all, **the four
  camera positions a player actually occupies are indistinguishable between before and after** — the
  whole visible effect lives at a straight-down camera 120 m up that the game never puts you in. Round
  two is building the real fix now, and it is in the same file: the sea still composites a fixed **17%
  mirror when you look straight at it**.
- **The container screen prints the word `undefined`** as its title. Being fixed.
- Shadowed areas crush to black with no detail — a real fix landed, but it is small (**+4.4%**), and
  its own author reported that honestly after catching that the *first* version of the measurement was
  void: 93.7% of the improvement it was about to claim reproduced with no fix in the tree at all.
- **The characters were being drawn inside-out — fixed, and confirmed by eye.** Your winding tip was
  right and bigger than the report you sent: **153,344 of 227,850 triangles (67.3%)** had normals
  disagreeing with winding, body meshes **13 of 13 inverted**, three generators each wrong differently.
  Now zero, photographed on hardware over 332 frames. A Gideon market stand that held *chrome-and-glass
  skeletons with black shards jutting from their backs* now holds solid people in blue, green and brown
  clothes.
- **Four more things about the cast, all fixed and all from one shared body plan.** 44% of them were on
  a generic body with **no eye geometry at all** (79 → 260 NPCs routed correctly); **everyone was the
  wrong height** (0 of 41 in the 7–8 head band → 41 of 41); the clothing textures were pasted **5.5×
  too fine**, which averages to a flat colour — a smith who was one tone shoulder-to-ankle now has a
  sash, cord rings, a hem and a yoke, and *a background NPC in the same frame gained a sash nobody
  targeted*; and the eyes went from cream googly balls to dark sockets.
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
- **The eye had a pupil worth literally zero pixels — now it has one.** Eight face frames shot on
  hardware two rounds ago went unopened until today; what they showed was *a flat amber lozenge — no
  pupil, no lid, no orbit*. The pupil existed the whole time and was worth **0 pixels at every camera
  angle on 4 of 5 face shapes**, and the cause was not the eye: **the snout was in front of it.** Moved
  6 mm out and 12 mm forward — **0 → 10,316 pupil pixels**, and every one of 30 angle-and-subject pairs
  now shows one. "No lid, no orbit" still stands, and none of this is photographed yet.
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

The blind comparison was re-run and **we lost 5 of 5 again**, exactly as before three fixes landed.
Every judge named the same two absences: no material differentiation, and no contact shadow. Those are
the two things the fixes delivered and measured as delivered.

**The diagnosis is now in, and it is not that the fixes are broken. They work. They are being applied
to 19% of the picture.**

Measured on the exact window the judges looked at, as change from the shipped game:

| turning this off | changes the picture by |
|---|---|
| the **entire** sun shadow map | **0.78** |
| the ambient occlusion | **0.92** |
| *(re-taking the same photo, camera unmoved)* | *1.25* |
| the sky's ambient dome | **21.79** |

**Turning off every shadow in the game changes the judged pixels less than photographing it twice.**
The sky dome moves them **28 times as much as the entire shadow map.**

The reason: **46% of the light in a frame is indirect — and none of it can be shadowed.** The sky's
contribution is an analytic dome that, in the renderer's own comment, contains *"no terrain, no
settlement and no canopy"*. It lights every surface as if nothing were in the way. And the occlusion
texture that would let a surface darken itself is switched off on **53 of 53** materials on screen.

So shadows and occlusion only affect the fifth of the light coming straight from the sun, and the
other four-fifths washes the result out. **That is why three correct fixes changed nothing a person
could see** — and why the next work is the lighting recipe rather than more shadow features.

**That rebalance has now landed, and it is four numbers.** Daytime key light ×3, sky ×0.75, fill
×0.75, ambient dome cut to a third; night got its own moon lever, because the moon had no control at
all — at 19:30 the game was scaling a *sun* of intensity 0.0126 while the light actually carrying the
frame was unreachable. **The thing to look at:** the shot that scores *worst* on the acceptance number
is the one where the fix visibly worked — flat shadowless olive ground before, a large soft cast
shadow with readable stonework after.

**That is because the acceptance number I wrote was wrong, and I have ruled it void.** It asked how
much the picture changes when you switch the sun off — but *a pixel in shadow does not change when you
switch the sun off*, so the measure shrinks exactly as the fix succeeds and the build is penalised for
casting shadows. Replaced with the same test taken **only on the lit parts of the frame**, plus a
clause that the shadowed area must not shrink. **This is the fourth metric in two days that got better
when the game got worse, or worse when it got better, and three of the four were mine.**

**Two honest limits, both the builder's own words.** Only **2 of the 5** outdoor lighting recipes were
rebalanced; dawn and dusk (roughly 05:20–06:40 and 17:20–18:40) still carry the old flat look, and
applying the new numbers there was *measured and refused* because it crushed the bottom tenth of the
frame to black. And there is **not one moving frame** in the whole piece — nine camera setups, all
stills. A critic is shooting it in motion now.

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
the landing tool no longer spends five minutes on a step that times out under load and which the CI
redoes anyway; **3.2 GB of dead GPU captures** were pruned off a disk that was at 96% and silently
failing writes; and agents were leaving background waiters armed that **re-woke them after they had
finished** — one burned 39,000 tokens and eight turns that way.

Together those moved the rate about 1.7 points. Real, but small against a target of 25%.

**My read:** today's spend bought findings that were worth it — the characters were being drawn
inside-out, the dialogue window had no mouse support at all, and the capture path can return frames
that are not pictures. None of those were findable cheaply. But that is a defence of *this* spend, not
a plan, and the target still needs one.
---

*Kept short on purpose. Detail lives in `orchestration/ROADMAP.md`; the honest failure record in `orchestration/HAZARDS.md`.*
