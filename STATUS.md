# Where we are right now

**Last updated: 2026-08-15, afternoon.** One screen. If this is more than a day old, distrust it and say so.

---

## What the agents are working on this minute

**Making the game look like a game** — four agents, all on ring 1:

- **Making the sun the dominant light.** This is the one that matters. See the section below: shadows
  and occlusion only reach a fifth of the picture, and this is the fix for that.
- **Judging the character work** — an independent critic, shooting the new standing pose on real
  hardware, which the builder shipped without a photograph and said so itself.
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
- **⚠ Something is wrong with how we measure the screens, and it is bigger than the screens.** The
  round-6 builder could not reproduce round 5's filed density numbers **even on a byte-identical
  checkout of the exact commit round 5 was judged on** — it reads a hard fail where the verdict records
  a pass, in four separate arms. It proved its own change is not the cause (moves the number by exactly
  0.0000) and reported it rather than working around it. Until that is settled, treat density scores on
  these screens as unreliable in both directions.
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
- **The characters were being drawn inside-out — fixed, and now confirmed by eye.** Your winding tip
  was right and bigger than the report you sent: **153,344 of 227,850 triangles (67.3%)** had normals
  disagreeing with winding; the body meshes were **13 of 13 inverted**. Front faces were culled, so you
  were seeing the inside of the far surface. Three generators, each wrong differently. Now zero.
  **Photographed on real hardware, before and after, 332 frames.** A market stand in Gideon that held
  *chrome-and-glass skeletons with black shards jutting from their backs* now holds solid people in
  blue, green and brown clothes. The NPC a critic called "a bald egg head, a wooden artist's mannequin"
  is a coherent matte figure. A lizard NPC went from a chrome insect to a green-coated figure with a
  snout.
  Also fixed: **44% of the cast was on a generic body with no eye geometry at all** (79 → 260 NPCs
  routed correctly), and **everyone was the wrong height** (0 of 41 in the 7–8 head band → 41 of 41).
- **Characters have clothes with detail on them now.** The flat-colour problem turned out to be two
  things, both already paid for: all 17 characters **already declared** a palette and a wear level and
  **nothing read them**; and the body's texture coordinates were wrong by **5.5×**, so the authored
  linen and leather — bound and on disk the whole time — were pasted about eight texels to the
  millimetre, which averages out to a single flat colour. Fixed: a smith NPC that was one uninterrupted
  tone from shoulder to ankle now has a sash with a bone toggle, three cord rings per forearm, a hem, a
  yoke and tonal variation. **A background NPC in the same frame gained a sash too — nobody targeted
  it**, which is the shared body plan working as intended.
- **People stand on the ground now, and it is photographed.** NPC positions came from one authored
  constant per settlement, never compared to the terrain. At Lilmoth, of 31 people drawn, **12 were
  underground and 15 were in the air (worst 35 metres up)**; four of thirty-one stood on the ground.
  Now zero and zero, confirmed on hardware — in the before frame people are simply *absent*, in the
  after frame they stand beside the wall. It turned out to be **mostly a Lilmoth defect**: five of the
  eight towns were already fine.
- **The eyes are the clearest win of the day.** The same Imperial goes from two cream googly eyeballs
  to two dark sockets, and against the reference photograph the new version is on the right side of it
  where the old one was its opposite. Two caveats, both found by the agent that made it: it may have
  overshot — under a hat brim the eye can vanish entirely — and **the player character got nothing from
  it**, because the fix landed in the human block and the player is a saxhleel.
- **A new defect nobody had reported: a wide-brim hat is drawn as a flat hexagonal plank across the
  eyebrows**, hiding the wearer's eyes completely. At conversation distance that is more disfiguring
  than either thing this round fixed.
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
- **The player's own eye was the worst in the game** — 2.16× the brightness of their face, worse than
  the case that was fixed two rounds ago, affecting the player and **260 of 408** NPC records. Now
  0.847×.
- **The body is now photographed on real hardware, and the change is visible.** Eight angles, before
  and after, on an RTX A4500 — the exact picture the last four judgements were written against. The
  waist reads at player distance.
- **And the character was standing like a shop mannequin — that is now fixed but NOT yet photographed.**
  Measured on the pose the game actually draws: shoulder tilt 0.3°, **hip tilt exactly 0.000°**, and
  frames two seconds apart were the identical stand. A real person's weight sits on one leg. The fix
  puts the hips and shoulders on opposite tilts on the shared stance layer, so **one edit moved the
  player and all 408 NPCs**. The catch is honest and the builder led with it: the paid photo run
  happened *before* the stance was written, so **the stance itself has never been seen on hardware** —
  a critic is shooting it now, along with eight face frames that were photographed and never opened.
- **Two costs of that fix, both found by measurement.** Rolling the hips floated one foot **17.4 mm**
  off the ground; that was solved properly (both feet now land level) but leaves the whole character
  standing **8.9 mm higher**, which nobody has yet checked in the game. And the small-cracks number
  went up another 0.8%.
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
- **Both dialogue bugs the judges hit are fixed.** The highlighted phrase that did nothing turned out
  not to be a UI bug at all: the topic was real, but *that speaker* could never answer it — her rumour
  handed out a topic gated to a different kind of person. So the fix is in **what gets marked as a
  link**, not in the pressing: a phrase is only drawn as followable if the person you are talking to
  can actually answer it. And re-asking a topic no longer prints the paragraph twice — it moves the
  existing answer to the bottom instead.
- **Dialogue: the topic links work, and were preferred — the first real quality judgement this project
  has ever completed.** Two people played two builds of the game blind — ours, and one with the inline
  links removed but every topic still reachable from the list. Neither knew which was which. **Both
  preferred ours**, and a third reader who never played confirmed their accounts were genuinely
  distinguishable rather than a coin-flip.
  **The catch, and it is the useful part:** of six people they talked to, the links were **absent on
  two, present on four, and noticed on only two** — and on one of those the highlighted phrase **did
  nothing when pressed**. So the feature works and is liked *where it lands*, and it lands on about
  half of conversations. Combined with the first NPC you meet having no links at all, most players
  would never discover it. Fixing placement is now the work, not adding more links.
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
