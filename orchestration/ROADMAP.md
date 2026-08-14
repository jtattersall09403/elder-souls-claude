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

**State, 2026-08-14 evening.** (a) is **diagnosed, fixed and landed**; what remains on it is the
evidence — the CONSUMPTION arms before and after, and a hardware before/after sweep with both arms on
the same Pod and the same GPU. Resumed under the new narrow regime. (b) and (c) are **not started and
not yet dispatched** — deliberately, because they are separate remedies and the honest question is
whether (a) alone moves the blind verdict. If it does not, (b) and (c) are why.

**Watch for this when (a)'s evidence lands:** the judges named contact shadow and ambient occlusion
more consistently than anything else — **5 of 5, the most universal observation in the whole run**.
The orphan fix may not touch either. If the pixels move on material response but the frames still have
no contact darkening, that is (b) becoming the next step rather than a disappointment.

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

## Step 2b — Buildings are not inside each other *(resolver done; layout is now step 2c)*

**Visible outcome:** doors open into streets rather than into other buildings.

**83 interpenetrating pairs across 8 of 8 settlements; 25 have a door inside another building.** The
shrink pass and `_deepOverlaps()` compared **axis-aligned** footprints while the renderer rotates by
`yaw_deg`, so most were invisible to the shipped check.

**Done:** `game/src/world/footprint.js` is now the single implementation of this geometry — there were
**three** private copies, two of which measured a rectangle the world does not have *and agreed with
each other*, which is exactly how the defect stayed invisible. The check now reports 76 where it used
to report 22. Archon 15→12, Lilmoth 19→16.

**The 72 was wrong, and this is the real state.** ~~72 of 83 separate with no building moved — a code
fix, not a layout migration.~~ That figure assumed buildings could shrink to `MIN_ENTERABLE_SPAN_M`.
They cannot: all 115 interiors are native records, so nothing applies `interior_bounds_m` and the room
cannot shrink to follow its building. **227 of 230 axes have one centimetre of slack**, already spent.
Shrinking clears **6, not 72**. The tolerance knob is not the answer either — the count is 76 for
*every* value between 0.50 m and 1.50 m.

**So the remaining 76 need positions moved, and that is a separate step (2c) done at the GENERATOR.**
Five Blackrose pairs are authored exactly 1.0 m apart and `thorn-gate`/`thorn-house-0` share an
**identical `offset_m`** — buildings do not land on identical offsets by coincidence. Hand-placing ten
would paper over a generator that re-authors the same collisions on the next regeneration. **Not yet
dispatched:** it sits below step 1, and step 1 is where the screen changes most.

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

## Beyond step 5 — the rest of the game

**Resolution deliberately drops with distance.** Phase A is planned to the step; later phases name the
work and its visible outcome but will be re-planned when they come into view. A roadmap that pretends
to know the detail of month three is lying, and this project has a rule about confident documents.
**But naming the whole shape is not optional** — a roadmap that stops at what is currently in flight
cannot tell anyone whether we are 5% or 50% through, which is the question it exists to answer.

**Phase A — foundations you can see** *(steps 1–5 above, in flight)*
Surfaces respond to light · the first five minutes · buildings not inside each other · conversation
with depth · reachable quests · combat feel.

---

### Phase B — the Morrowind half

Morrowind wins everywhere outside the fight, and this is what that actually costs.

- **B1 Journal and quest-telling.** A journal that reads like a person wrote it, ordered, searchable, and the *only* navigation aid. Rule: no quest markers, ever.
- **B2 Quests without markers.** Directions given in prose — *"follow the road east past the standing stone, ask for Ravel at the outfitters"* — and a world legible enough to follow them. This is the hardest single thing on the list and the one most worth getting right.
- **B3 Factions and guilds with real ladders.** Joining, rank, duties, expulsion, rivalry. Ranks that gate content and *conflict* with each other, so belonging somewhere costs you somewhere else.
- **B4 NPCs who live somewhere.** Schedules, homes, work, sleep. Disposition that moves and matters.
- **B5 Crime, justice and consequence.** Being seen, being reported, bounty, guards, prison or fine, reputation that persists.
- **B6 Economy in gold.** Prices that vary by merchant, disposition and region; barter that is a conversation; wealth that gates and unlocks. **Souls are levelling only — gold is the currency**, and every economic surface must obey that.
- **B7 Magic, alchemy and crafting.** Spellmaking, effects that do what they say (a census found **33 effects that no system reads** — that is the shape of the work), ingredients, enchanting, repair, condition.
- **B8 Skills, training and levelling.** Learning by doing, trainers, the choice of what to become.
- **B9 Books, lore and rumour.** Things to read that reward reading. Rumours that change with where you are and who you are.
- **B10 Strangeness.** The thing that makes Morrowind Morrowind and is easiest to leave out because nothing fails without it. Argonian, Hist, tidewater, insect and fungus — never a generic fantasy swamp.

### Phase C — the Souls half

Souls wins inside the fight. Frames, stamina, hitboxes, animation, enemy behaviour.

- **C1 Animation and weight.** Readable wind-ups, recovery, commitment. The single biggest contributor to whether a fight feels good.
- **C2 Weapons and movesets** with real identity, and a reason to choose one.
- **C3 Poise, stagger, parry, backstab** — the whole exchange vocabulary.
- **C4 Bosses.** Designed encounters with tells, phases and a first-death lesson.
- **C5 Bonfires, runbacks and death.** Losing your souls and going back for them; checkpoint spacing as level design.
- **C6 Difficulty and the curve.** Tuned by playing, never by inflating numbers.
- **C7 Enemy placement as authorship** — the ambush, the pair, the one you learn to skip.

### Phase D — the world

- **D1 An hour to cross, and worth crossing.** Thirteen regions that read differently on foot.
- **D2 Landmarks and legibility** — enough that prose directions can work (B2 depends on this).
- **D3 Dungeons, xanmeers and ruins** worth entering, with rewards worth finding.
- **D4 Variety within a region** — the "six minutes across one kind of ground" problem, still open.
- **D5 Weather, tide and time** as things you plan around rather than watch.

### Phase E — the whole thing

- **E1 The opening hour**, end to end, judged as an experience.
- **E2 Save, load, and returning after a week.**
- **E3 Desktop, mobile and gamepad** all genuinely playable.
- **E4 Performance and load** on ordinary hardware.
- **E5 Sound.** Barely started, and it is half of atmosphere.

### Phase F — the bar itself

- **F1 Every corpus item judged**, no unjudged backlog.
- **F2 Blind comparisons every wave**, both protocols, never skipped once things look decent — *"the blind test is most valuable exactly when the team has stopped being able to see the game."*
- **F3 The corpus audited and extended.** The owner's own question stands: do we actually have Morrowind's region and topological maps and their Black Marsh equivalents?

---

## Honest position on how far through we are

**Phase A is in flight; B through F are named and not started.** Most of what exists today is
foundations, instruments and one playable slice — not a game. Anyone quoting a completion percentage
should quote it against **this** list, not against Phase A, or it means nothing.

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

**2026-08-14 evening — the regime changed, and four pieces were found stranded.** Moving from ~14
parallel agents to two-to-four sequential ones immediately surfaced something width had hidden:
`W1-ORPHANED-SURFACE-SHADERS` (`in_progress`), `W1-WATER-LANES` (`measuring`),
`W1-UIX08-dialogue-window` (`built-probe-running`) and `W1-DLG-TOPIC-WEB` (`building`) were all sitting
part-finished with **no agent working them** — their agents had ended without completing. Nothing was
lost, because each had written a `next_step`. But nobody had noticed, and at fourteen agents nobody
would have. They are now the queue, picked up one at a time in roadmap order rather than all at once.
That is the case for this file existing.
