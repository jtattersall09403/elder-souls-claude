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
- **You cannot select topics in the dialogue window, and character creation doesn't use it.** You found
  both. The window itself is *right* — it measures identically to your own Morrowind reference — but
  every check we had tested how it looks, none tested that it works. Both faults are being fixed, and
  a rule is now in the doctrine that any screen must be driven with real key presses and clicks, with
  every control operated. A control that is drawn and does nothing is a hard fail.
- **The menus are text tables where Morrowind's are painted objects.** Measured: **zero** pictorial
  elements in the inventory — no icons, no paper doll, no portraits. Panel fill 0.21 against
  Morrowind's 0.61. The out-of-combat HUD has **1 of its 6 elements**, and that one sits in the
  top-right corner like a modern minimap when Morrowind's runs along the bottom edge. Being built now.
- **The container screen prints the word `undefined`** as its title. Being fixed.
- Shadowed areas crush to black with no detail — a real fix landed, but it is small (**+4.4%**), and
  its own author reported that honestly after catching that the *first* version of the measurement was
  void: 93.7% of the improvement it was about to claim reproduced with no fix in the tree at all.
- **The characters were being drawn inside-out — found and fixed today, from your tip.** The winding
  hypothesis you passed on was right, and larger than the report you sent: **153,344 of 227,850
  triangles (67.3%)** had their normal disagreeing with their winding, and the body meshes were
  **13 of 13 inverted** — skin and clothing both. Front faces were culled, so you were seeing the
  *inside of the far surface*. Three separate generators, each wrong in a different way. Now **zero**,
  and the two body meshes went from open to closed. It survived five rounds of hole-filling because it
  is not a hole.
  Fixed alongside it: **44% of the cast rendered on a generic humanoid with no eye geometry at all**
  (now routed properly, 79 → 260 NPCs); **everyone was the wrong height** (0 of 41 figures in the
  correct 7–8 head band, now 41 of 41); and faces gained seven landmarks where the generic body had
  none.
  **Not yet confirmed by eye** — all of that is measured geometry, not appearance. No hardware frames
  were taken, so nobody has *looked* at the result. Running now; until it lands this is a promise, not
  a delivery.
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
