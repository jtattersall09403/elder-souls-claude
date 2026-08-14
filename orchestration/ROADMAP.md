# The roadmap — ordered, one step at a time, each ending in something visible

**This file is the source of truth for what we are doing and in what order.** Started 2026-08-14
evening, when the owner ruled the fleet down from ~14 parallel agents to a narrow sequential march.

**How to use it.** Work the top unfinished step. Two to four agents at a time, never more, and never
two that can touch the same files. When a step completes: mark it, write a short update, move down.
Do not start step N+1 because step N is blocked — say what blocked it, in the step, and then move on.

**The test every step must pass:** *could the owner load the game and see the difference?* If the
honest answer is no, it is not a step, it is a task inside one.

**Do not hold this plan in an orchestrator's context.** That context compacted twice on the day this
file was written. If it is not in here, it does not exist.

---

## The goal, unchanged

**Souls in the fight** — animation, frames, stamina, hitboxes, enemy behaviour, difficulty, and how
good it *feels* to play. **Morrowind everywhere else** — quests, factions, dialogue, journal, lore,
world design, systems depth, strangeness. **Black Marsh.** **Modern graphics quality.**

---

## Step 1 — Surfaces respond to light *(in progress)*

**Visible outcome:** stone reads as stone, wood as wood, leather as leather. Objects sit on the ground
instead of floating on it. Shadowed areas have detail in them instead of being black.

**Why first:** the first blind fidelity comparison in this project's history ran today and **we lost 5
of 5**. Five independent judges, none knowing which image was ours, converged on one sentence —
*"surfaces are not shaded, they are filled."* No material response separation (4/5), no contact shadow
or ambient occlusion (**5/5, the most universal observation in the run**), shadows crushed with no
ambient fill (3/5). FIDELITY is capped at 5 against a gate of 7.0. Nothing else on the board changes
as much of the screen.

**Known mechanism:** `Material.copy()` in three r180 does not carry `onBeforeCompile` but deep-copies
`userData`, so **305 of 406 materials** hold surface uniforms that no shader ever installs — the
player's body among them. Two entirely independent methods, a code sweep and a blind comparison,
landed on the same defect.

**Sub-steps, in order:** (a) bind the material set — the orphan fix; (b) contact shadows and ambient
occlusion; (c) ambient/GI fill with tone-mapped shadow lift so shadows stop crushing.

**Closes when:** Protocol A is re-run blind against the same plates and we stop losing 5 of 5. Not
when the orphan count reaches zero — *statistics can fail a build and can never pass one*.

---

## Step 2 — The first five minutes look and behave right

**Visible outcome:** you come out of character creation in Thorn, facing somewhere sensible, in a town
that looks like a Black Marsh tidewater settlement, and you can walk out of the door without being
inside another building.

**What is already done:** door exits set facing across all 115 interiors (the writ house went from
0.50 m of clearance to 12 m); the writ house had **no door drawn in it at all** and now has one (rays
at the doorway 0% → 69%); Thorn gained `roof.needle`, the first new roof profile the game has had, and
a Tidewrack landing built 5/6 from reused parts.

**What is left:** the doorstep still does not draw the player at the shipped exit yaw — now fixable by
a facing rule, which it demonstrably was not before. The overlap resolver (step 2b) is live. And
**nobody has looked at any of the Thorn work** — the capture daemon returned zero frames under load,
so every claim about it is offline measurement.

**Closes when:** a hardware capture of the real opening path, many angles plus motion, looks right to
a person.

---

## Step 2b — Buildings are not inside each other *(in progress)*

**Visible outcome:** doors open into streets rather than into other buildings.

**83 interpenetrating pairs across 8 of 8 settlements; 25 have a door inside another building.** The
cause is one defect wearing two hats: the shrink pass and `_deepOverlaps()` compare **axis-aligned**
footprints while the renderer rotates by `yaw_deg`, so **63 of the 83 are invisible to the shipped
check**. 72 of 83 separate with no building moved — a code fix, not a layout migration.

---

## Step 3 — Conversation has depth, and looks like Morrowind

**Visible outcome:** asking about one topic opens others, so a conversation branches outward instead of
being a flat list; speakers disagree with each other; and the window looks like Morrowind's.

**Where it is:** the plan was approved after three independent review rounds (sixteen defects repaired
between them) and the builder is running — topic visibility is already 22% → 50% across landed
batches. The Morrowind dialogue window is building alongside it against the owner's own screenshot,
vendored as `REF-A12c`.

**Known open:** ten topics reachable from no greeting by anybody; 100 of 865 `npc.topics` entries name
nothing; and depending on how you count the player space, **52–61% of NPCs advertise no subject of
their own.**

---

## Step 4 — The quests that exist are reachable

**Visible outcome:** the faction ladders go past rank 5, opening **21 already-authored quests** that no
player can currently reach. This is the cheapest content in the project — it is written and shipped and
merely walled off. Twelve `world_flags` entries.

Also: W1-18's quest delivery was reverted by a merge on 10 August and nobody noticed for four days.
It is restored (563 records, all three audit numbers hitting their claimed values exactly) and is now
with an independent critic, because *restored* and *good* are different claims.

---

## Step 5 — Combat feel

**Visible outcome:** fights that feel like Souls — readable animation, weight, a difficulty curve worth
climbing, and a moment-to-moment feel worth repeating.

**Where it is:** enemies can now catch you (a chasing enemy previously never got within 9 m of a
*walking* player and never once landed inside its own attack range; now it closes to 1.6 m). Seven of
seven distinct behaviours, achieved by changing how they move, leash, block and disengage rather than
by inflating stats. The AI feints and combos.

**What has never been done:** nobody has judged how the combat *feels*, or looked at the animation.
One audit found human judges being shown **charts of enemy behaviour** instead of being asked to fight
anything. The owner has now named this explicitly — *"how good the combat is, from animations to
difficulty to user experience to how fun it feels"* — so it is a step, not a background property.

---

## Standing work, one agent at a time, never a parallel sweep

**Repo integrity.** The documents that direct the work hold false beliefs about what the repo contains.
Confirmed today: a reference item told builders for eight days that **no images were vendored** when
131 are; **282 behaviour references including 177 boss-move GIFs** cited by no combat item; a town's
`n=0` plate count that was arithmetically correct over a wrongly-chosen anchor and *could never* have
been non-zero; **648 orphan-candidate data fields** nothing reads. A tripwire now exists
(`tools/check-citations.mjs`, 10 self-test arms, 6 required red and 4 required green). But the audit
that found all this says plainly it was **a sample, not a sweep**, and that its single
highest-blast-radius finding **was found by no check** — by hand. So this continues, slowly, forever,
as one agent at a time between steps.

**The unjudged backlog.** 126 pieces built and never independently checked. Ranked queue exists; work
it a few at a time, prioritising anything on the player's path.

---

## Log of completed steps

*(Append here as steps close, newest last, with the date and the update that was published.)*
