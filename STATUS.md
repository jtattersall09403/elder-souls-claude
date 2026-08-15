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
- Shadowed areas crush to black with no detail.
- **The characters are bad, and we now know exactly why.** Judged for the first time against real
  reference plates: **ART 1/10, FIDELITY 3/10.** Specifically — every figure is **5.9 to 6.8 heads
  tall** when a real one is 7.5 to 8, so the whole cast reads slightly dwarfish and *none* of the 41
  is in the right band; shoulders are ellipsoids on a slab torso and legs are cones; the face has
  **1 of 7** landmarks; and **41 different characters collapse to 12 silhouettes** — an argonian
  rootkeeper and a breton mudborn are *pixel-identical*. Nobody shifts their weight when standing.
  **The skeleton underneath is sound** — feet don't slide, hands grip correctly, no T-pose in 3,005
  frames — so this is a rebuild of the surface, not the rig.
  **The cheapest single fix, now dispatched:** 181 of 408 NPCs are tagged `argonian`, but only
  `saxhleel` and `naga` are routed to the reptilian body, so **44% of the cast renders on a generic
  humanoid with no eye geometry at all**.
  (A shader bug also removed every body entirely for part of yesterday; that is fixed — 124/124
  programs link — but it was a regression on top of this, not this.)
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
