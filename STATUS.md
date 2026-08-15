# Where we are right now

**Last updated: 2026-08-15, midday.** One screen. If this is more than a day old, distrust it and say so.

---

## What the agents are working on this minute

**Making the game look like a game.** Specifically: surfaces responding to light, and things sitting *on* the ground instead of floating above it.

Alongside that: shrinking the documentation every agent reads before it can start (done today — 145k tokens down to 69k).

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
- **The menus were made denser and became unreadable.** Sizing each panel to its contents cleared all
  five density failures — and then a critic looked at the result: on the level-up screen the attribute
  name, its value and its gauge are drawn **into the same pixels on 9 of 10 rows** ("STRENGTH" renders
  as `STREN` with `12` through it); three of the character sheet's ten rows collide; **8 of 19 journal entries
  are laid out past the bottom of the panel onto the world behind it**, and 11 of 19 print over the
  footer. All at normal resolution.
  **The measure rewarded it.** The density score counts any pixel that differs from the background — so
  text printed on top of other text still counts as content, and the level-up screen's number *doubled*
  as it became illegible. Shrinking the boxes was the right fix; nobody reflowed what was inside them.
  That reflow is the work now, and the acceptance has been changed so a density number only counts
  when the screen is also legible.
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
- **The body is still wrong.** Eight orbit angles of the player: a flat pale-blue sandwich-board torso,
  no waist, no shoulder line, shield and sword as planks. That verdict is unchanged.
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
