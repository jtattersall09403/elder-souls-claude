# Where we are right now

**Last updated: 2026-08-14, late evening.** One screen. If this is more than a day old, distrust it and say so.

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
- **Dialogue: clicking now works — the mouse had never been wired up at all.** Not a bug in the window;
  there was **no pointer path in the entire interface**. A rule written for the combat HUD's
  thumbstick screens — *"no cursor, no hover, no click target"* — was silently inherited by a window
  whose own spec describes what a click does. The keyboard always worked (arrow keys and E); the mouse
  and touch did nothing, so every control you could see was a picture of a control. Mouse, touch,
  keyboard and gamepad now all route through one place. Asking the same topic twice also printed
  nothing, and now doesn't.
  **Still open:** character creation still uses the old panel. Routing it through the new window needs
  three things the window has no element for — multi-select, a typed name, and a "waiting for two
  more" aside — so it is a real piece of design work rather than a one-line switch. Next up.
- **The menus have things drawn in them now — icons, a paper doll, a proper HUD.** They were text
  tables where Morrowind's are walls of painted objects: **zero** pictorial elements in the inventory,
  and the out-of-combat HUD had **1 of its 6 elements**, sitting in the top-right corner like a modern
  minimap. Now **22 pictorial elements** from one icon set serving five screens, a Saxhleel paper doll
  wearing what you have equipped, and **6 of 6** HUD elements moved to the bottom rail where
  Morrowind's live. Delete-the-fix returns every screen to exactly zero icons, so the change is real.
  **Not yet judged**, and one thing is honestly short: the panels are still too sparse against
  Morrowind's, because ours are oversized rather than sized to their contents. That is ruled and is
  the next fix, not a lowered bar.
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
- **But the characters are still not good, and the next problem is now visible.** With the winding
  fixed, what shows is that **there is no material work at all** — one flat colour of cloth over one
  flat colour of skin, no seam, no fold, no wear anywhere. In that one respect the fixed version looks
  *plainer* than the broken one. Heads are still eggs (seven facial landmarks are in the mesh and none
  reads at conversation distance), there are **no hands or feet at any angle**, and walking is a glide —
  across six frames the silhouette doesn't change. That is the next piece of work.
- **Nothing casts a contact shadow** — *fixed today, not yet judged.* The old "ambient occlusion" turned
  out to be an edge detector that was structurally blind to exactly this. Real occlusion has replaced
  it. Shadows still crush to black; that fix is being built now.
- Dialogue is shallow — asking about one topic mostly does not open others. Being fixed.
- Some buildings still overlap each other; 24 doors still open into another building.

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

Roughly **37% of the weekly budget** spent, in about nine hours. The approach changed this evening: fewer agents at once, working sequentially, with cheaper models on mechanical work — so that the remaining budget lasts the week rather than ending on Saturday.

---

*Kept short on purpose. Detail lives in `orchestration/ROADMAP.md`; the honest failure record in `orchestration/HAZARDS.md`.*
