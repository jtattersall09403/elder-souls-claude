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
- **Nothing casts a contact shadow.** Buildings, trees and steps look like they are hovering. Being fixed right now — it is the single thing five blind judges all named.
- Shadowed areas crush to black with no detail.
- **The player and every NPC look wrong.** You said so on 14 Aug — *"frankly ridiculous"* — and that is
  now the standing verdict, not an open question. The earlier work fixed *holes in the models*; it never
  touched design or quality. Fixing it properly is blocked on one thing that does not exist yet: a
  character reference set (images **and motion**, at Skyrim/ESO quality) for builders to aim at and
  critics to compare against. Building that set is the next thing dispatched.
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
