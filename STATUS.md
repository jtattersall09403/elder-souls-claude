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
- **The menus have things drawn in them now — but two screens don't work.** The HUD went from **1 of
  6 elements to 6 of 6** and moved off the top-right corner to the bottom rail where Morrowind's lives;
  the inventory went from **zero pictorial elements to 22**, from one icon set serving five screens,
  plus a paper doll wearing what you have equipped. All verified by a critic, including the HUD
  correctly vanishing the instant a fight starts.
  **Then it pressed the buttons, and:** the **journal search view has no way out** — one press traps
  you there, 15 different actions fail to leave, and it survives closing and reopening the journal.
  Its own on-screen hint promises the escape, and the function implementing that promise exists in the
  code and is **called from nowhere**. **Equipping does nothing out of combat** — it silently applies
  90 frames after you close the screen. And on a phone, **no list on any screen can be scrolled**.
  All three are being fixed now.
- **The camera still buries itself, and we now know in what.** Not a tree — the player stands under a
  **raised deck in Lilmoth that does not exist to the collision system at all**, so three separate
  checks all reported "nothing is blocking the camera" while the camera was inside it. Measured: 26
  consecutive frames with the player hidden, against a limit of 6. The vegetation fix from earlier was
  real and simply isn't what was blocking you here. Next piece is thin architecture — decks, balconies,
  overhangs, stair undersides — which is exactly what a third-person camera hits in a town.
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
- **Faces are fixed and photographed. Feet are not — and the reason is a missing argument.**
  **Faces: clearly better on hardware.** All 16 NPC face close-ups changed; a smooth brown ovoid with a
  muzzle is now a face with brow, orbits, eyes, nose, mouth and chin. The one character predicted *not*
  to change came back byte-identical on 4 of 4 frames — the control working exactly as it should.
  **New defect, named honestly by the same agent:** the eye now reads as a **bright cream bead**, and
  usually only one of the two catches light. The reference photograph has the opposite structure — a
  dark recess with a small bright iris. The eye went from invisible to too visible.
  **Feet: still missing where it counts.** The code that sits a character on the ground is **never
  called for NPCs at all** — the call omits an argument, so none of the 408 has ever had it run. And
  the player's own starting position is a raised boardwalk where the fix's safety clamp saturates, so
  **the player still has no feet where he loads in.** It does work when walking on grass, where a
  detached brown dome became a foot at the end of the leg — though at full size it reads as a dark
  hoof-like lump.
  **And the walk is unchanged.** The camera provably moved (42% of the frame border changes per step,
  against 0.2% when stationary) but the gait measurements did not shift at all. Last round's hope that
  removing the ground-pin would restore heel-strike and toe-off is **not supported** — that is now
  measured rather than assumed.
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

## The blind comparison was re-run today, and we lost 5 of 5 again

**This is the most important thing on this page.** On 14 August, five independent judges compared our
frames against real reference plates without knowing which was which, and preferred the reference every
time. Three fixes came out of that — materials, contact shadows, ambient fill — **all three landed, all
three measured green on their own tests.**

**Re-run today: we lost 5 of 5 again.** The score did not move.

**And every judge named the same two things**, unprompted and independently: *"every surface returns
the same flat matte olive-grey"*, *"thatch, plaster, stone and ground all return light identically"*,
*"no contact darkening and no cast shadows at all, so nothing sits in space"*. Those are exactly the
two things the three fixes were built to deliver.

**Two details that make this worse, not better:**
- **The judges are biased in our favour** — they can't be made fully naive on this setup — and we still lost.
- **Our images are sharper than the references**, which are degraded JPEGs. Three judges said so
  unprompted. So this is not about resolution or jagged edges, which we win. It is entirely about
  light and material.

**What it means:** three fixes each passed a number built for it, and none of them changed what a
person sees. That is the project's own rule landing on us — *a statistic can fail a build and can never
pass one*. The next piece of work is finding out why, and **no new visual features are being built
until that is answered**, because building a fourth fix on an instrument that doesn't predict the
judgement would be spending for nothing.

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

**$8,280 spent, running at $120/hour — 103.6% of baseline.** The efficiency target is 25% of baseline
and we are not moving towards it. That is the honest position and it has not improved today.

**Why, plainly.** The one large lever is model routing, and you ruled — correctly — that 3D visuals
work goes to the stronger model because the cheaper one was not up to it. That is most of what the
fleet is currently doing, so the lever is closed while ring 1 runs. The mix is 89.5% expensive, barely
moved from 91.2%.

**What did land:** the documentation every agent must read before starting fell from **145,000 tokens
to 69,000**, which is paid back on every agent forever.

**My read:** today's spend bought findings that were worth it — the characters were being drawn
inside-out, the dialogue window had no mouse support at all, and the capture path can return frames
that are not pictures. None of those were findable cheaply. But that is a defence of *this* spend, not
a plan, and the target still needs one.
---

*Kept short on purpose. Detail lives in `orchestration/ROADMAP.md`; the honest failure record in `orchestration/HAZARDS.md`.*
