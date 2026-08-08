# Next dispatches, in priority order

## GATE-BLAST-RADIUS. Orchestrator ruling: fail-closed gates split by actor count, not by content — FIXED, one arm; two named, not built

Rule 13, second offence. A builder hit **fourteen consecutive `git commit --only` refusals** over
two files it had never touched — a neighbour's in-flight pair, untracked on disk, imported by a
file tracked in some earlier, unrelated commit. `check-shipped-files.mjs` had already been narrowed
once (scan only tracked-or-staged importers), which fixed *which files are scanned* and did nothing
about *which problems block*, because the offending importer was itself tracked.

**The ruling: split by who can act, not by what the problem touches.** A dozen agents hitting the
same fail-closed wall over content none of them own is not a dozen problems, it is the same
non-decision made a dozen times; one actor (the orchestrator, at its one push/deploy chokepoint)
hitting it once is a decision that gets made. So:

- **`tools/check-shipped-files.mjs`**: advisory at commit time unless the offending importer or
  target is among the paths *this specific commit* is writing — proved empirically that `git commit
  --only <paths>` runs the hook against a temporary index containing exactly those paths, so this is
  precise, not a guess. `--strict` (unconditional) is the form `tools/bank.mjs` calls.
- **`tools/bank.mjs`**, the actual push/deploy chokepoint: runs the same scan after its `git add -A`
  (which already resolves most "untracked but present" cases for free) and, for what survives —
  genuinely missing files — **unstages the offending path and excludes it from that round's commit**
  rather than refusing the whole bank, matching the precedent already set there for files that fail
  `node --check`. A problem that predates this bank (already at HEAD, already live) can't be fixed by
  unstaging a no-op, so it is reported as loudly as possible instead rather than silently passed or
  used to freeze all future banking — freezing banking to punish one neighbour's unfinished import
  would just move rule 13's failure up one level, not fix it.
- **`game/src/sim/quest/defs.js` `QuestBook`**, named directly by the dispatch as a live third
  instance (`QuestBook: 16 integrity failure(s)` from a neighbour's data took down every browser
  probe in the fleet, repeatedly, per `orchestration/status/W1-15-r4.json` and others): no longer
  throws by default. Logs the same message loudly and continues. `tools/check-quests.mjs` now
  constructs the SAME class with `{ strict: true }` — imported, not reimplemented, so the rules
  cannot drift between the throwing and non-throwing paths — closing the gap where it previously
  covered only `hooks.json`/journal rules and not the constructor's own duplicate-id / cross-file
  `consequences` / mutual-exclusion checks, which were exactly the ones still throwing at boot.

**Named, not fixed — the same shape, judged not cheap enough to touch in this pass:**
`tools/check-data.mjs` (blocks any commit touching `game/data/` if ANY file the index references is
missing anywhere in the tree, not just what the commit adds) and `tools/check-content.mjs` (blocks
any commit touching `game/data/quests/` if ANY quest resolution anywhere has vanished since the
baseline, not just the touched file) are both still unconditionally repo-wide and blocking. So is the
`corpus-index.mjs --check` gate at the bottom of the hook, for `corpus/` commits. Each already carries
a deliberate, documented rationale for staying blocking (a deleted indexed file or a silently
regenerated-away quest resolution is exactly the kind of defect that must not survive a commit,
argued in each file's own header) and each is a bigger, riskier rewrite than the two above — narrowing
them the same way requires deciding what "the committer's own doing" means for a *generated index*
and a *baseline diff*, not just an import graph, and getting that wrong reintroduces silent breakage
rather than a false block. Left alone rather than rushed.

**Reversible. Evidence that would overturn it:** if `tools/bank.mjs`'s push-gate stalls repeatedly on
pre-existing (not self-introduced) problems it can't unstage — i.e. the "report loudly and proceed"
branch turns out to need to block after all — tighten it to refuse the bank instead, and say so here.
If `check-data.mjs` or `check-content.mjs` produce their own multi-agent pile-up (the same fourteen-
refusals shape), that is the trigger to give them the same self-introduced/foreign split, not to wait
for a fifth instance.

## ~~Z. The blog embedded 12 images from a directory `.gitignore` will never publish~~ — FIXED

The playability agent's live sweep found `docs/index.html` and `docs/progress.html` each embedding
12 `<img>`s under `../reports/wld12-blind/f12.png` … `f23.png` — 12 distinct files, verified by
`curl` against the live site (all 404) and against `git ls-files` (0 tracked; `reports/.gitignore`
excludes the whole directory on purpose, 701 MB of run artifacts). `reports/wld12-blind/` is not a
broken path, it is a **blind border-judging pack** (RI-WLD12, `tools/world/wld12-blind-pack.mjs`) —
measurement material, deliberately shuffled for a fresh judge, never meant to be public. Confirmed
count matches the dispatch's "12" exactly; no third page carried the same defect (root `index.html`
and `README.md` have no image refs at all).

**Root cause, one directory upstream of both broken pages:** `tools/progress.mjs`'s "Latest
captures" section (embedded into `docs/index.html` too — `tools/blog.mjs` inlines
`docs/progress.html`'s body) walked all of `reports/` and took whatever 12 files were newest by
directory-read order — not by mtime, and not restricted to anything actually publishable. Twice a
week that is a real screenshot from `tools/capture/`; this time it was the blind pack.

**Fix — a source-directory change, not a per-file copy.** `docs/shots/` is this project's one
directory that is *always* published (rule 27; 253 files, all git-tracked, all verified live 200):
`tools/progress.mjs` now walks `docs/shots/` instead of `reports/`, sorted by real mtime. No image
was moved into `docs/shots/` from the blind pack — those 12 frames are evaluation instruments with
an answer key held separately (`KEY.json`) and publishing them is the "genuinely should not be
published" case the dispatch asked to distinguish; the fix is that "Latest captures" now can only
ever draw from what is already published, so this class cannot recur through this code path.
Regenerated both pages (`node tools/progress.mjs && node tools/blog.mjs`); HEAD now has zero
`reports/` references in either.

**The check that stops it recurring:** `tools/playability/check-image-refs.mjs` — resolves every
href/src in `index.html`, `docs/index.html`, `docs/progress.html`, `README.md` and all 67
`docs/blog/*.md` posts (215 unique internal references currently), and asserts each is both
git-tracked at HEAD and live-200 via `curl` (the proxy here 403s node `fetch`; curl is what
actually reaches the host, same finding as `tools/world/verify-live-site.mjs`). `--self-test` has
three arms, not two, because the third is the actual defect reproduced live: a real published shot
comes back clean, a fabricated path is reported, and `reports/wld12-blind/f12.png` — while it still
exists on this disk — comes back both untracked and gitignored, matched against `--url` live 404.
All three currently PASS (`node tools/playability/check-image-refs.mjs --self-test`), and a full
run against the live site currently reports 0 broken of 215.

**Ruling, reversible: not wired into the pre-commit hook.** Rule 13 — a fail-closed gate that fires
on a neighbour's in-flight screenshot commit stops the whole box, and this project already paid for
that once. It is runnable on demand (`node tools/playability/check-image-refs.mjs`) and belongs in
the same "run before every bank" habit as `verify-live-site.mjs` and `verify-links.mjs`, not in a
gate nobody chose to arm. Overturn this if a week goes by with the manual habit visibly not
happening and a second broken-image round lands — that is the evidence it would take.

Note for whoever next edits `docs/index.html` or `docs/progress.html` by hand: both are on the
pre-commit hook's regenerated-file list (rule 17.2) — edit `tools/progress.mjs` / `tools/blog.mjs`
and regenerate, don't hand-patch the HTML, or the next `node tools/progress.mjs` run silently
reverts it.

## P. The playable build — when the owner gets to have a go

> Owner: *"once the game is 'playable' in some way (i.e. I could have a go at running it in the
> browser, go through the new game flow, and walk around the world to the different regions at
> least) I want to be able to have a go at it. I **do not** want anything to be gated on that or
> dependent on me doing any testing."*

Nothing waits on the owner and nothing is asked of them. This is a gift, not a test. The moment the
gate below is met, **write `README.md` at the repo root** — how to run it, what to expect, what is
known to be broken, and what is simply not built yet — and tell them.

**The gate. All six, each proven by a critic who did not build it:**

1. **It starts. MET.** `./play.sh --port 8137`, open the URL it prints. No flag, no query string,
   no harness verb.

2. **The new-game flow plays as a scene. MET**, and a critic played it rather than probing it:
   title → `New` → walked 2.67 m with nothing asked of it → `KeyE` → typed
   `Jackdaws-Love-My-Big-Sphinx-Of-Quartz` and got **all 26 letters back verbatim** → answered
   **all 11 census nodes on the keyboard** → writ stamped → out into the world walking, sprinting
   at 1.56× walk, strafing and rolling. **194 s the first time, 308 s on a re-run, 0 page errors.**
   `opening-play.mjs` also ran to completion on a quiet box: **10 pass / 0 fail**, so P7–P10 are
   independently verified.

   Its one hesitation is worth recording verbatim, because it is the design rather than a defect:
   *"I hesitated at exactly one place: `hold.out`, where the panel closes and nothing says the scene
   wants you to walk up the companionway — that is the design working, and it is the place to
   watch."*

   **The piece still FAILS at min-over-axes 0** and that is not a contradiction: the gate asks
   whether a person can play the opening, and the item asks whether it is any good. Its biggest
   remaining gap is that `Engine.bodyRace()` ends `rows.some(...) ? id : null`, so a body whose race
   is not in `races.json` is observed as **`null`, silently**, and the desk refuses eleven nodes
   later — with round 2's exact sentence behind the authored line. At this round's own base commit
   the literal in that field was `argonian`, which is not an id here either. **The round fixed the
   value and left the mechanism.** And `P9`, the check that is supposed to catch signposting,
   **tests grammar**: a start-anchored imperative regex, so six polite ways of saying "go up the
   ladder" all pass, and so does the one tutorial line the round-2 verdict named.

3. **The controls are drawn.** W1-08/W1-29 found them "correctly laid out and drawn nowhere". A
   player who cannot see the controls has not been given a game.

   **The doors are now real, measured by the W1-21 r2 critic** — all six screens open and close
   under real Playwright key presses in `play-instrumented` and under a real gamepad, not injected
   action names: `KeyM`, `Digit3` ×1–5, `Escape` out of each, pad button 9 then 15. Controls-first
   verified (an unbound `KeyQ` moves nothing), reproduced twice, re-stamped at a later HEAD. That
   is the half of this item about *reaching* the screens; whether what is on them is drawn well is
   still open, and **FD6 has been red across two rounds** (114, then 99.9, all 28 captures over).
   Round 1 was silent on it; **round 2 named it and discussed it at length** (§1.2, filed as an
   arbitration question) but could not resolve it, because the tool compared a 0–255 luma overshoot
   against 40 while `RI-UIX06` §F specifies ΔE. Round 3 converted it and it is a **hard fail**:
   worst edge ΔE2000 **58.291**, 14/14 captures over 8, **31,322 of 98,659 graded edge pixels over
   3**, which caps that item's fidelity at 2.

   (An earlier version of this line said no verdict had ever named FD6. That was wrong — a blog
   writer checked `W1-21-r2.md` rather than taking my word for it and found the discussion. Rule 18
   again: the verdict is authoritative and my summary of it is not.)
4. **You can walk between regions and the ground is there.** **MET.** A body walked Stormhold to
   Lilmoth: **6,646.7 m, 199,433 frames, 55.398 in-world minutes**, settlement collision ON, mean
   ground speed 1.9991 m/s, worst deviation from the road 1.39 m of a 6 m carriageway, **zero
   frames off the road and zero teleports**. Against RI-WLD01's own bars — time 52–65 ✓, distance
   6,300–7,600 ✓, speed honesty ≤8% ✓, mean speed 2.0±0.05 ✓. **The hour came from distance**,
   which is the whole design.

   The history is worth keeping, because two premises this project acted on were wrong. It was
   first marked Met on a walker not subject to settlement collision; retracted when a *body* got
   39 m and stopped at a wall. Then the wall was cleared and a "57.5° skirt on the Valus Ridge"
   was blamed — **and there is no skirt.** The road's worst gradient anywhere in the province is
   **24.27°** against a 40° limit, and the slope gate refuses zero samples of any centreline,
   before the fix as well as after. The 57.5/61.09/64.6° readings were `field.slopeAt()` taken
   *beside a viaduct*, where the ±5 m central difference straddles a slab edge. What is actually
   on the ridge is a **471 m viaduct standing 50.6 m above the mountainside** — 918 m of a 2,921 m
   leg is bridge — and the body was 4.98 m off the centreline and **15.3 m below the deck**. It
   had fallen off.

   The fix is steering, proved by a 2×2 with the pre-fix code restored: old steering reproduces
   the published stall **to the metre and the coordinate** (550.1 m, ending 2153.7, 1197.8), and
   the parapet turns out not to be load-bearing for this walk at all.

   **Independently re-walked by a fresh critic with its own tool and its own per-frame accumulator:
   identical to the decimal**, ending at (2765.6, 5028.8). It amends the claim rather than just
   confirming it, and the amendments belong here: the run is **`hp_pinned: true`**, it is
   **forwards-only**, there was a 116.7 m respawn, and *"zero slope-gate refusals on any
   centreline"* is a **tautology** — 25,390 of 25,390 centreline samples are exempt via `onRoadAt`,
   so that clause supports nothing. A lateral sweep with a structure-free control replaces it.

   **It does not walk backwards.** Stuck at 5,072.3 m on the `stormhold-helstrom` switchbacks,
   where a 17 m viaduct's deck slab is laid 5.74 m across and 7.51 m above its own lower limb.
   `--no-deck` goes 1,165 m further and collapses the stuck run from 900 frames to 18. Dispatched.
   Not a reason to gate the README: forwards is the direction a player walks first.

   Two numbers nobody had: a **jog** is 34.622 min (RI-WLD01 M2 step 4, never run by anybody), and
   **overladen in a storm at 02:00 still arrives**, at 71.591 min.

   Residual: a 133.8 ms worst frame, unmeasured since.

   **`--stair-grade 0.60` — RULED, and reversible.** The numbers: span 1,732 → 1,431 m, tallest fill
   50.6 → 32.7 m, **zero length cost**, worst grade 24.27 → 31.13°. **Do not land it.** A 31° road
   is not a road — it is a staircase, and Morrowind's roads are roads; the whole point of "about an
   hour on foot" is that walking it feels like walking, not climbing. Trading a 471 m viaduct for a
   1-in-1.7 gradient buys nothing a player will notice and costs the thing they will. The viaducts
   stay. **Reverse this if** a walk over the stair-graded route measures *faster or equal* in
   in-world minutes AND the body never leaves the deck — in which case the grade is not costing
   anyone anything and the simpler geometry wins.

5. **A fight is survivable and a level is spendable.** The hearth opens; **souls have no source**,
   so the loop does not close yet. Dispatched.
6. **An unassisted play session by a fresh critic** — start to a first quest to a first fight to a
   first level, driven only through input, nothing set by a harness verb, with the session recorded
   as frames. If a critic cannot play it, the owner cannot either.

Do **not** hold this until wave 1 passes. The bar is "a person can have a go and it is recognisably
the game", not "it is good". Everything else keeps running while this is assembled.

The orchestration tick reads this before choosing what to start. Delete a line when it is dispatched
and its status file exists. Respect the concurrency cap in `AGENT-PROTOCOL.md` — six or seven agents
doing browser work, no more; the cap exists because fourteen agents on four cores cost a builder its
headline measurement entirely.

## ~~0. A player who walks 750 m walks off the built world~~ — FIXED. A critic is checking it.

`Engine._streamProvince()` now runs from `_afterStep()`, on the one path every way of advancing the
world passes through, and focus follows the posed camera eye when an override exists (which closes
the `shoot.mjs --direct` half). A second defect was found and fixed on the way: `request()` released
a tile the instant it left the build ring, so a body oscillating on a tile *edge* rebuilt a 5-tile
row each time — 30 tile builds for 26.9 m of movement.

Walked 3 km: ring 25/25, 0 unbuilt, ground underfoot the whole way, against "gone by 750 m, 20 of 30
samples with no ground, discs 2,182 m behind". Full crossing walked end to end: 55.131 min, 6,615.1 m,
zero samples with no ground. Delete-the-fix returns 0 tiles built and ring 0/25. Consumption:
`radiusTiles` 1/2/3 → 9/25/49 built against predicted (2R+1)², coupling 1.00, with a null control.

**Residual, and it is real:** p99.9 is **66.8 ms and max 133.8 ms** — 194 steps over 16.7 ms out of
60,000 — from a ~59 ms ground-skin + cover rebuild every ~13.8 m. The builder assigns that to W1-01's
`updateSkin` calibration. A hitch of eight frames during a swing is a Souls-side failure, so the
critic has been asked whether that boundary is fair or a handoff of the actual defect.


## V. Handed up, not taken: a full crossing now buys level 3, where the cache said 5

The souls-ledger reconciliation found two files holding a soul total for the same 267 road bodies,
differing by **+53.0%**, with no code, check or tool that had ever compared them. The statblocks are
the truth and it proved it three ways rather than assuming: `SoulsSystem.step()` pays from
`Engine.data.enemies` and never opens `population-posts.json`; the cache has exactly one runtime
reader in all of `game/src`, inside a `report()` whose own comment says *"What a probe reads. Never
used by the simulation"*; and the cache is simply the older document, written before the seven
statblocks were re-anchored.

So `report.souls` is 16,335 → **10,679** and `crossing.level_if_fully_cleared` is **5 → 3**.

**That last number is a design question and the builder correctly declined to answer it. RULED, and
reversible.** 3 is what the shipped statblocks and curve have paid since `e97347f`; 5 was only ever
the cache saying so, and nothing was re-tuned to produce 3.

**Level 3 stands.** One leg of a province that takes an hour to cross should not buy a third of the
way to the level cap, and Souls' whole shape is that a level is expensive early. If the crossing
bought 5, a player who walked it first would arrive at the second region over-levelled for it, which
is the failure mode Morrowind's open world has and Souls' does not — and this game is Souls inside
the fight. **Reverse this if** a critic measures the first region's encounters as *unsurvivable* at
level 3 with the shipped weapons; the lever then is RI-PRG06 or the population density, never the
reconciliation and never a value edited to agree with a stale file.

**Two stale totals are now named by number** in `orchestration/INDEX.md` under *"Numbers you must not
read off a status file"*: **16,335** and **21,664**. The orchestrator handed both to agents as fact,
twice, having read them off a status file. `node tools/check-souls-world.mjs --totals` prints the
current one and exits 1 if it is stale; it is wired into `check-data.mjs`, which the pre-commit hook
already runs.

## W. The road goes through the house — dispatched

Two generators, one piece of ground, no join. `tools/world/build-roads.mjs` lays roads over terrain;
`planSettlement()` puts buildings down afterwards; nothing ever compares them. **10 of 10 built legs
are blocked**, so the province is not crossable on foot by anything with a collision body, and §P.4
above is retracted because of it.

The check exists and is red: `node tools/world/road-through-building.mjs`. Its `--self-test` moves
one building 1 km and requires flag / clear / everything-else-identical — the first draft of that
self-test was vacuous (it mutated a field `planSettlement` does not read) and its author caught it
before using it, which is the only reason the number is trustworthy.

**This is probably also W1-05's drowning defect.** With walls in, `soulrest-blackrose` stops after
11.6 m and 18.7 m of a 1,808 m leg, both on dry ground at full HP, ten metres from
`soulrest-grey-hist` — the body never reaches water at all. With walls out it runs 6,458 m off-road
and ends in 18 m of sea. Depth, tide and current were correctly exonerated; a wall pushing the body
off the road competes with the population-streaming hypothesis and nobody has tested streaming
directly.

**Not to be re-derived:** the deck clamp is exonerated, and properly — the parapet negative control
matched at 900 frames gives clamp on 0/28, clamp off 28/28, worst offset 48.03 m, 22 falls. A null
result from disabling something is worthless unless the disable is known to bite; this one bites.

## Q. Two defects found by W1-16 r2 that invalidate OTHER pieces' numbers — read before you re-measure

Filed by the progression builder, not by the pieces they damage. Neither is a gap in W1-16; both
are reasons a number somewhere else is wrong, and they are here so nobody re-derives them.

**Q1. `setBurden()` has been inert on any stepping run** since `_recomputeBurden()` landed. The verb
wrote the value and the next frame overwrote it, so a probe that set a burden, stepped, and measured
was measuring the default. **Any burden figure taken from a stepping run before commit `c36653e` is
suspect** — including figures already published in verdicts and status files. If your piece quotes
one, re-take it or mark it. The pinned-scenario path is the pattern that works: pin, and clear the
pin on the load path, because `save/fight.js` always writes a number so every load would otherwise
read as a pin (RULES rule 7).

**Q2. There are two parallel sprint implementations.** `worldDeny.sprint` was read at the press gate
only, so a denial that should persist expired after one frame — **W1-03's water denial is the known
casualty** and there may be others. Rule 10 exists for exactly this shape (two implementations of
one system, one good and one broken, live at the same time). If your piece denies, gates or
throttles an action, check which of the two paths actually carries it.

**Q6. Two dialogue critic tools model the algorithm S37 deleted, and a published verdict rests on
them.** `tools/dialogue/critic-reach.mjs` and `critic-semantics.mjs` both reimplement the specificity
score `converse.js` no longer uses. `critic-reach`'s output is **byte-identical before and after the
S37 landing** — it still reports lines as "always outscored" when nothing is outscored any more.
W1-17-r2's published 136 → 6 rests on them. The S37 builder found this in someone else's finished
work and reported rather than touched it. **Re-take that number against the shipped reader.**

**Q7. The engine and every instrument measuring it disagreed about 5,760 answers.** Topic-file merge
order came from two sorts that did not agree: tools used `readdirSync().sort()` on filename, the
engine used `Object.keys().sort()` keyed on `doc.id || basename`, and three of 21 files carry an
`id` — 36 of the 92 multi-file topic ids involve one. So a Soulrest clerk genuinely said one thing
in play and another in every check, and no instrument could see it, because the disagreement was
between the instruments and the game rather than inside either. Closed by
`game/data/dialogue/topics/_manifest.json`; 0 differing, and still 0 from a reversed arrival order.
**If your piece loads a directory and sorts it, check the engine sorts it the same way.**

**Q12. No spell could be cast anywhere in the province, and four rounds of magic never noticed.**
`MagicSystem.stepFall` ran as `M.stepFall(frame, M.groundY || 0)`, and `M.groundY` is written
**only** by `beginLevitation` — so the world's ground plane was zero. Lilmoth's quay is 2.68 m up
and Stormhold's street is 141.12. Standing perfectly still, `magic.airborne` was permanently true
and `castDropReason` returned `'airborne'`: input dropped, no `cast_start`, no Focus spent. **Four
rounds of magic were measured in arenas whose floor happens to be zero.** Found by a builder who
was not asked to look, fixed by asking `Engine.groundInActiveCell`, control restores the refusal.

**Sharpened by the round-4 critic, and my first framing of it was too strong.** It **retracts no
round-3 number** — `arena_flat`'s floor genuinely *is* 0, so the defect could not perturb anything
measured there. What it retracts is the **scope** those numbers silently carried. The reason it hid
for four rounds is now counted: **26 of the 49 named states put the player at exactly y = 0** —
every arena, every camera rig, every weapon fixture. And there is a **new instance of the same
defect**: 13 states put the player in deep water, where `groundInActiveCell` returns the sea bed, so
a swimmer is 40 m "airborne" and the press produces no event on either stream.
If your piece asks whether a body is airborne, grounded, falling or standing, check which zero it
is comparing against.

**Q13. `makeSpell` spent `magic.gold`, which is a mirror.** `getGold()` and the save never moved,
so every price this system charged was charged against a number nothing else reads. Spending routes
through `Engine._setGold` now. Same shape as the two soul ledgers: a second copy of a value, with
one writer and no reader in common.

**Q10. `path_m` counted teleports as walked distance.** A 3,484.9 m respawn made a 1,277 m walk
report 4,812 m. It is excluded and reported separately now, but in the finder's own words: **every
`path_m` this project published before may contain them.** If your piece quotes a walked distance,
check whether the run could have respawned.

**Q11. A check can be true for twenty-four minutes and stay false for twenty-four commits.** The
settlement/road join reported `0 of 10 legs blocked, 0 offences`, honestly, at `322f708`. By
`0dc0703` it was **3 of 10 legs, 5 buildings on the trunk road** — and no data under `settlements/`
or `interiors/` had changed. `exterior.js` had: a per-axis shrink pass **grew 54 of 202 exteriors
and shrank none**. The join's own handoff named the staleness door and declined to gate the check,
and that decision was the sole reason the tree was red. **If your piece's headline depends on a
generator someone else owns, gate the check or expect the number to rot.**

**Q8. "The harness cannot see that screen" has been wrong at least once — re-check yours.**
`getRenderedText()` was written off by a builder as blind to the book screen, and the round after it
that claim was refuted in one line: `ui/system.js build()` short-circuits on a cache key that
**cannot change while a screen is up** — the world is paused and `ctx.frame` is frozen. Clear the
register *before* the press instead of after and 1,531 characters come back. The critic's own words:
*"anyone who has written off a menu surface as unmeasurable should re-check."* If your piece has
graded a screen on a model read because the renderer "could not be reached", that is now a
recommendation to try again.

**Q9. Two placement mechanisms in the same rooms cannot see each other.** `render/interior.js`
spaces `readable[]` over that list alone; `site-marks.json` drops quest documents at hard-coded
coordinates; `engine.js:3270` gives the press to the nearest prop. Walking all 45 documents in the
six most loaded rooms, **4 are placed, drawn, standable-at and open nothing** — and one of the four
is half of a registered contradiction pair. Not crowding (2.60 m separation holds even in the
14-document archive) and not the exit door (pre-registered hypothesis, refuted). `place-library
--check`, `boot-check`, the reach test and two purpose-built instruments are **all green on it**.
**4 is a lower bound: 77 rooms were not walked.**

**Q17. The default player race throws in the fixed step whenever a guard is stepped.** `argonian`
is not in `law_factor`, which calls the same people `saxhleel`, so `thresholds()` throws. Found by
the audio critic, whose fixture it weakened, in a file that is not theirs. It is the third defect
today from the same root: a race id that is really a tag. `bodyRace()` returns `null` silently for
the same reason, and `raceTerm()` throws on `"argonian"` in 179 of 347 shipped NPC records. **One
of these is worth fixing properly rather than three times separately** — there is a canonical id and
a family of aliases, and nothing arbitrates between them.

**Q15. Five of the six enchanter posts are unreachable on foot** — 6.17 to 49.57 m short, every
one of them `stuck`. Only Lilmoth arrives. Found by the magic round while walking to its own
spellwrights; not its file to fix. Any piece that places a person and expects a player to reach them
should walk to them, not measure the distance.

**Q16. `on_strike` and `constant` enchantments are made, saved, and read by nothing** — declared in
the data *and* spoken by the enchanter before she takes your money. That is worse than a dead model:
the world tells the player it will happen. Same shape as `deceit.revealed_by`'s 186 authored rows,
except a character says this one out loud.

**Q14. `W1-05` is unblocked — stop testing the drowning.** `soulrest-blackrose` was walked in
**both directions, both arrived, deepest water 0.00 m**. Four sessions and three independent
attempts died on that leg; the wall was the first cause and the steering was the second, and both
are closed. `W1-05`'s mandatory reachability proof can now be taken. **But `walkPath` itself was
never fixed** — the fix landed in `_pursue`, and `walkPath` is the verb
`tools/world/w1-01-r4-soulrest-leg.mjs` drives, so re-run against the fixed path rather than the
old verb.

**Q0. FLEET HAZARD — a save/load with a hostile present kills every stepping probe, silently.**
`save/fight.js`'s `SKIP` list omits `ai`, so `saveActor(ctl)` serialises the live `SoulsAI` as a
plain object. After any round trip with a hostile in the world, the next fixed step throws
`this.ai.step is not a function` — **and `boot-check` stays green, because boot does not step.**
That is rule 13's exact failure mode: not one agent's problem, everyone's. `saveRoundTrip()` also
reports `hash_equal:false`. Found by the W1-16 critic, in someone else's file. **Dispatched.** If a
stepping probe of yours has been dying after a load, this is why, and your figures from it are void.

**Q4. `engine.spawn` ignores `opts.side`, so a summoned creature spawns hostile and fights its own
caster.** Found by W1-14 r3, which did not touch it because it lives in W1-12/W1-03 files.
`frenzy`'s `hostileTo` has no reader anywhere either. Any measurement of a summon's usefulness taken
before this is fixed is a measurement of a spell that attacks you.

**Q5. The magic census had been turning one dial of three.** `duration_s` was pinned at 20 and
`area_r_m` at **0** on all 55 rows, so two of the three dials Morrowind's spell system is built out
of had never been perturbed by anything in this project. 104 dials are declared; 23 are still dead
after round 3, and the six duration-blind ones are the real gap — "Fire Damage 10 pts for 5 s"
should tick per second, and duration currently only sets how long an unread lease row sits in
`M.active`. If your piece quotes a magic number taken from the old census, it was taken with two
dials held still.

**Q3, related and not yet acted on.** `combat.player.equipLoadPct` — the input to RI-CMB01's whole
roll ladder — had no producer at all until this round: three writers, one of them a hardcoded
`24.0`. Any roll measurement taken against a load tier before this round was taken against 24%
regardless of what the player was wearing.

## R. Orchestrator ruling: stop rebuilding build-viability, and stop granting

`tools/analysis/build-viability.mjs` has now been rejected **five times**, and the round-4 tool
critic asked the right question instead of just extending the rebuild list: after five rejections,
*"rebuild again" may be the wrong reflex.* Round 6 argues, citing the place W1-FACTIONS' own live
walk failed in this exact class, that a live in-engine probe **relocates** the substitution inside
the engine rather than removing it. That argument deserved an answer rather than another round, so
here it is.

**The ruling: the granted character is the defect, not any particular grant.**

Every rejection has been the same shape wearing different clothes — a constant, a Proxy, an
infinity, a union, a "derived" value computed from an optimistic assumption. The newest is the
clearest proof available that the whole approach is unsound: `worldFlags` is granted as the union
of every resolution of every quest, so the tool asks *"can this character finish the game?"* of a
world holding **601 contested flags at once**, in which `archon_vats_open` and
`archon_vats_burned` are simultaneously true, and `ixtu_vakh_trusts_player` sits beside
`ixtu_vakh_closed_to_player`. There is no grant that makes that world real. There is only a
smaller lie.

**So the tool stops answering the question it cannot answer.** Two instruments, and the split is
the point:

1. **A screen.** The existing walk, kept, fast, and **renamed to say what it is** — a *lower bound
   on obvious impossibility*. It may report that a demand exceeds every ceiling, or that a gate has
   no producing resolution anywhere. It may never report that a build **is** viable, and its output
   must not be quotable as a viability figure by any item or verdict.
2. **A walk.** Viability is measured by *playing*: real character signatures driven through the
   shipping gates from a cold start, in the engine, granted nothing. Expensive, slow, and the only
   thing that is not a fiction. `mainline-chain-floor.mjs` already does this for 40 signatures on
   the main quest and is the shape to follow — including its own history, since its first version
   conjured the giver it was testing for.

**What this costs, stated plainly:** the wide grid over 540 signatures × every quest is not
affordable as a walk, so the walk covers a stratified sample and says so, and the screen covers the
rest and is labelled a screen. A narrow honest number and a wide labelled screen beat one wide
number that has been wrong five times.

Whoever picks this up owns the rename, the "may never report viable" fence, and the sampled walk.
The five rebuild lists in `corpus/80-methods/TOOL-COVERAGE-R1..R4` stay on the record; most of
their individual findings remain true of the screen.


## ~~T0. Referred for a seam ruling: RI-DLG01 §A against `converse.js infoFor()`~~ — RULED. **ARBITRATION S37.**

**Closed by `arbiter-dlg-s37` at `63f41ef`. Read `corpus/00-doctrine/ARBITRATION.md` §2 S37.**
`RI-DLG01` §A governs; **the engine yields**. `game/src/character/converse.js` `infoFor()` must stop
scoring specificity and return the **first admissible INFO in authored order**. Dialogue is outside
the fight, `ARBITRATION` §1 gives it to Morrowind, and §5 precedence 1 settles it before the seam
rulings are reached. `RI-DLG01` §A and §D are amended on disk; the false clause is struck in place.

**A BUILDER OWNS THE IMPLEMENTATION. The arbiter edited nothing under `game/src/`.** The change is a
deletion, not a rewrite: keep `infoAllowed()`, the npc-own-line short-circuit, the canon register,
the cell prefix match, the actor filter and the whole return literal including `to`; delete
`converse.js:283-285` and `break` on the first survivor. **The reference implementation is
`tools/dialogue/arbiter-reference-reader.mjs` — that file is the diff.** Delete the scoring
rationale in the comment block with it.

**Two things land with it and neither is optional.**

1. **Declare the merge order.** `buildTopicIndex()` concatenates same-id topic records in
   `readdirSync().sort()` order, and **92 of 468 topic ids are declared in more than one file,
   holding 488 of the 1,280 INFOs**. Under first-match-wins that directory listing decides answers.
   §A says *authored*; a manifest keyed on the per-file `group`, or a `priority` on the topic
   record, satisfies it.
2. **Re-run the reorder and the lint, which now do something.** Under the scoring reader authored
   order decided **0.018% of resolutions in one topic**, so `order-infos.mjs --write`'s *"0 of
   75,151 answers changed"* was very nearly forced before the tool ran. Under S37, reversing
   authored order moves **18.242% of resolutions across 64 topics** — the same tool, the same
   corpus, and a control that can finally come out either way.

**Acceptance: `node tools/dialogue/arbiter-order-divergence.mjs --gate` exits 0**, with
`--self-test` (four arms) passing in the same run. At `63f41ef` the gate is **red: 58 mismatches
over 42,456 resolutions, 37 speaker/topic pairs, 8 topics**, and green against the reference
reader — so it has been watched failing and passing. Expect **6 more unhearable INFOs** (8 → 14) on
the day it lands; those are a corpus bug under `RI-DLG01` §D and the repair is to reorder the
files, never to re-score the reader.

## T. Referred, not ruled: `res` — Morrowind's result script — has no reader. The twentieth dead model.

**Found by the W1-17 round-1 critic (§E2), checked independently by `arbiter-dlg-s37` at `63f41ef`,
and kept separate from S37 on purpose: this is not a contradiction between two texts, it is a model
with nothing on the other end.** It is not the arbiter's to build.

`RI-DLG01` §A calls this pair the single most important structural fact in the file:
*"The response text is inert; the result script is what edits the world: `AddTopic …`,
`Journal A1_1_FindSpymaster 10`, `ModDisposition` …"* **This project implements the `AddTopic` half
and not the other.** Thirteen INFOs carry `res`, every one of the form
`{"journal": ["q-<name>", 10]}`, across `10-global.json`, `20-tier-a.json`, `21-tier-b.json`,
`22-tier-c.json` and `30-texture.json` — `the-dead-pay`, `the-heirs-clause`,
`the-unfinished-survey`, `the-man-in-the-water`, `the-unlisted-well`, `the-under-drain`,
`the-thinning`, `the-cleared-ground`, `the-lung-wage`, `the-petition`, `the-thorn-charter`,
`the-listening-at-soulrest`, `the-removed-name`.

**Confirmed by perturbation, not by a field census (RULES 11), against positive controls
(RULES 5) at `63f41ef`:**

```
field                                            infos edited   answers changed
res  DELETED            (Morrowind result script)         13            0   *** NO READER ***
res  REWRITTEN to garbage                                 13            0   *** NO READER ***
f    DELETED            (filter field 4, Faction)          4            0   *** NO READER ***
to   DELETED            (positive control, AddTopic)     919      113,786
x    MANGLED            (positive control, the words)   1,280      204,602
```

Reproduce with the one-liner recorded in `orchestration/status/arbiter-dlg-s37.json`. **Two layers,
not one.** `infoFor()` never carries `res` out of the reader — it is absent from the return literal,
so `Engine.conversationSay()` could not fire it even if it wanted to; and **none of the thirteen
`q-*` ids is referenced anywhere in `game/data` outside the dialogue files themselves**, so the
journal entries they would open do not exist as quests either. `f` is the same story with a smaller
blast radius: `infoAllowed()` has no faction branch.

**Under `RI-MTH07` / `ARBITRATION` §3 both are `unmeasurable ⇒ 0`.** Thirteen topics authored to
open a journal entry when asked about cannot.

**Acceptance for whoever takes it.** A `res` arm in `tools/dialogue/consume.mjs` (which today has no
arm for `res`, no arm for `f`, no arm for `rumours.json`, and **no `--break` flag at all**) that:
(a) perturbs `res` on a named INFO and observes **a journal entry appear in the running world**, not
a field change; (b) shows the paired control — the unperturbed INFO opens nothing; and (c) reports
**≥ 13 of 13 `res` INFOs with a demonstrated consumer, and `f` either wired in `infoAllowed()` as
filter field 4 or deleted from the data with a note**. The thirteen `q-*` quests must exist in
`game/data/quests/**` or the `res` payloads must be repointed at quests that do; a `res` that fires
into a quest id nothing declares is the same defect one layer along. Do not build a `res` reader
that writes a field nothing reads back (RULES 7).

## ~~S. Referred for a seam ruling: RI-WPN02 §B against RI-WPN05 §E.2~~ — RULED. **ARBITRATION S36.**

**Closed by `arbiter-wpn-s36` at `4698888`. Read `corpus/00-doctrine/ARBITRATION.md` §2 S36.**
RI-WPN02 §B governs the arc; RI-WPN05 §E.2's tip-speed ceiling yields and is re-derived per slot.
Both items are amended on disk. Compliance instrument: **`node tools/wpn-tipspeed-s36.mjs --gate`**.

**The referred figure was wrong and the correction is the interesting part.** §S said *"107 of 2,689
slots cannot satisfy both items at any tuning"*. That sentence came from `orchestration/status/W1-MASS.json`
finding 77 — *"107 are over 2x … those last are the ones no tuning reaches"* — which is a **severity
bucket relabelled as an impossibility proof**. Recomputed: the ">2×" bucket is **125**; the truly
unsatisfiable set is **465** (or **152** if you also shrink the arc to M5's floor); and the two sets
**overlap on 31 slots**. 94 of the "impossible" slots were tunable; 121 impossible ones were invisible.
The contradiction was never in a tail — **five of RI-WPN02 §B's own published melee `r1.1` cells** and
**13 of the 28 clips RI-WPN05 §E samples** could not satisfy §E.2 either.

*(A second, unrelated `107` sits in the same status file at finding 55. Two of them one paragraph
apart is very likely why the figure travelled three documents unchecked. **A number that arrives
already corroborated is the one to re-derive first.**)*

Still open from §S and **not** settled by S36, now filed as §S1–§S3 below.


## S1. Referred: RI-CMB04 §B/§C against RI-WPN02 §B — the substep count rests on a tip speed that is 6× wrong

**The same contradiction shape as §S, found while ruling it, and left for an arbiter rather than
decided.** `RI-CMB04` §B publishes a `Peak tip speed (m/s)` column topping out at **UGS 26.0**, and
§C derives `SUBSTEPS = 4` from it in as many words — *"Worst case (UGS, 0.433 m/frame) → 0.108 m per
substep ≈ one capsule radius"*. But `RI-WPN02` §B's published arc and reach columns force far more
than 26.0 m/s, and S36 has now ruled that §B's geometry governs.

Measured at `4698888` over the 2,054 swept-capsule slots on disk:

- **1,312 of them (63.9%)** travel more than one capsule radius **per substep**, which is the exact
  condition §C's rationale was written to prevent.
- The worst is `whp_hist_bindings/r2` at **156.5 m/s** — 2.608 m per frame, 0.652 m per substep
  against a 0.09 m radius, **7.24 capsule radii**.
- Honouring §C's own stated rationale at the real worst case needs **29 substeps, not 4**.

This is worse than §S was, because §S was a bar nobody could pass while this is a bar that **passes
while under-sampling the sweep** — S26's hole-in-the-hitbox failure with a different cause, on the
classes that most need continuous collision. Note also that `RI-CMB04` §B has **no row for any of the
eight classes `RI-WPN02` added** (CSW, TSW, FST, MCE, WHP, CGS, GHM, BOW), so the spin classes were
never in the substep derivation at all. Whichever way it goes, a published column moves — refer it,
do not let a builder pick a substep count.

## S2. Referred: RI-WPN05 §E has no `ranged` row, and a tool invented one

§E publishes four tier rows — light, medium, heavy, ultra. `BOW` is `ranged`. **35 BOW slots
therefore have no tip-speed ceiling anywhere in the corpus**, which is the "bow's null ceiling"
§S recorded. `tools/weapons/build-movesets.mjs` has since added `ranged: 20` to its own `BAND_TOP`,
**a figure no reference item publishes** — a tool legislating for the corpus it measures. S36
explicitly declined to invent the band. Either §E gains a fifth row or it states that ranged has no
band and says why; until then `tools/wpn-tipspeed-s36.mjs` reports those 35 as `UNCEILED` rather
than passing them. *(The related 20.56 m blade capsule is fixed: BOW `reach_m` on disk is now
1.28–1.81 m, not 22.0.)*

## S3. Not referred, recorded: three loose ends from the S36 ruling

1. **603 slots declare an arc outside their shape's `RI-WPN02` M5 band** (e.g. `whp_hist_bindings/r2`,
   a `spin` at 289.8° on a whip). A **defect under M5**, judged there — S36 neither excuses nor
   punishes it, but nobody has yet been told to fix it.
2. **`RI-WPN02` contradicts itself**: §B publishes UGS as `slash_v` at 210° while M5 requires
   `slash_v < 130°`. One item, so not a seam — it needs an item amendment, not an arbiter.
3. **`reports/W1-MASS-guard.json` is stale and its stamps are wrong.** 746 slots exceed §E.2 as
   published, not the 645 recorded; **239 of the 645 `peak_tip_speed_mps_implied` stamps disagree
   with the arc their own file publishes**, because `build-movesets.mjs:739` evaluates the guard on
   the one-handed `slotArc` while line 774 publishes `prof.arc_deg`, which for a two-handed slot is
   `slotArc × 1.18`. 238 of the 239 are `2h.*`. Also, that tool cites
   `reports/W1-MASS-RECONCILIATION.md`, **which does not exist on disk.**

## U. ~~Referred for a seam ruling: is a Souls duration a count of frames or a span of wall clock?~~ — RULED. **ARBITRATION S39.**

`W1-TOUCH-r1` §3 referred it and declined to settle it, correctly. **Ruled: the line is the INPUT
BOUNDARY, not the fight boundary.** A duration whose two endpoints are both generated by the
simulation stays `f@60` forever and may never read a wall clock. A duration whose two endpoints are
both generated by the player's hand is stamped in milliseconds from `event.timeStamp` and converted
to `f@60` **once, at the boundary**. One endpoint each → the simulation owns it. Read the row; it
carries the numbers, the sixteen figures that move, the 11,161 that do not, and the falsifier.

**The referral understated its own finding.** In its artifact
(`reports/critic-w1-touch/critic-gate-wallclock.json`, `fa96455`) five presses asked for
**20 / 60 / 120 / 250 / 500 ms** all reported **`frames_held: 1`** — wall spans of 1.6–2.1 s that
should have consumed 18–24 sim frames even at 11.6 steps/s consumed **one**. The press-duration
counter is not merely coarse, it is *uncorrelated with the press*. At 60 Hz those five presses split
**roll / roll / roll / sprint / sprint** across the 12-frame gate; measured, **5 of 5 rolled**.

**Also ruled, so nobody re-opens it:** stretched i-frames on a slow device are **correct** and are
scored on `RI-PLT01`, not as a seam violation. `loop.js` keeps real time at any rAF rate ≥ **12.00 Hz**
(`MAX_CATCHUP = 5`); below that the world enters *uniform* slow motion and the fight stays fair. The
seam defect is only that **the hand does not slow down with the world.**

### Which pieces must now change

1. **`game/src/input/hold-gate.js` — the whole remedy, one function.** `framesHeld()` becomes
   `Math.round((tUp − tDown) / STEP_MS)`. `DEFAULT_HOLD_GATE_FRAMES = 12` and `shouldPromote()` are
   unchanged. Whoever takes this owns `tools/input/arbiter-clock-s39.mjs` — S39 is **not** satisfied
   by argument (S26's lesson).
2. **`game/src/input/touch.js`, `real.js`, `gamepad.js`** — four handlers that already have the DOM
   event in scope and discard it (`touch.js:188–190` passes `(pointerId, clientX, clientY)`). Pass
   `e.timeStamp`. **Not `performance.now()` in the handler** — a starved rAF is exactly when the two
   differ, and `now()` would reproduce the bug in a new place.
3. **`game/src/core/loop.js` + the input layer — `inputNow()`, one clock source selected by mode.**
   `play` → `event.timeStamp`; `harness`/`play-instrumented` → `frame * STEP_MS`. Without this the
   fix makes M-P5 untestable, which is the mirror image of the bug.
4. **`game/src/input/real.js:446` — a bare literal `12`**, a second copy of the gate constant that
   `hold-gate.js` was created to eliminate and never reached. RULES 10. Route it through
   `holdGateFrames()` in the same change.
5. **`game/src/combat/player.js:924–926`** — the three tap/hold discriminators (`r2.charged` at 9,
   `art.2` at 13, `bow.aimed` at 9) are press-duration questions and are reclassified.
   **`charge_max_f` is NOT** — how far through a charge you are is a telegraph the enemy reads.
6. **`game/src/input/gamepad.js:355/369`** — `autozero_frames: 30` and `drift_guard.frames: 600`. A
   drift guard needing 600 *sim* frames needs **51.7 s of real time** at 11.6 steps/s.
7. **`game/src/sim/stealth/pickpocket.js:53–56/115–131`** — `holdSeconds()` is denominated in
   seconds by the corpus, both endpoints are the hand, and it is outside the fight. Cleanest case.
8. **`game/src/input/touch.js:46/303`** — `hide_after_ms_when_pad_active: 2000 → hideAfterFrames: 120`
   against `RI-JRN04` M-P22's stated *"gone within 2 s"*. At 11.6 steps/s the controls stay up
   **10.3 s**. The corpus already asked for wall clock here and the build already counted frames.
9. **`RI-JRN04` M-P5 owes an amendment.** The item's *"most load-bearing single measurement"* is
   written as *"release at each of 4, 8, 11, 12, 13, 20, 60 frames"* and driven by `stepFrames` — the
   one unit that cannot express its own failure. It must press in **ms** and assert at two rAF rates.
10. **`RI-PLT01` owes a reader for `loop.stats.catchupClamps` / `catchupDroppedMs`.** They exist, they
    are exposed at `engine.js:7887`, and **nothing in the corpus reads them.** After S39 the input
    layer stops being an accidental proxy for the frame budget, so the budget needs its own alarm.

**Not decided by S39, still owed:** the §2 roll asymmetry (a finger on the stick suppresses the touch
roll while `Space` rolls; the edge log shows `sprint:down` where `roll:down` belongs — a *routing*
fault a stamped gate will not fix), and the frame budget itself, which nobody has measured on a real
device.

## 0a. The level-up screen is refused everywhere — ULTRACODE

`engine.js:2011` gates levelling on `this.hearths.atHearth(...)`; **`HearthSystem` has no such
method.** Refused at all 29 sapwells, measured live at three while the hearth registry itself
reported `standing_at: hearth-<id>`; `setAtHearth(true)` opens it as the control. The player can
recover 4,200 souls and cannot spend one — and souls are the whole of levelling.

Also from that verdict (`corpus/90-verdicts/wave1/W1-13-r1.md`, **FAIL 4/10**): a save taken while
the death surface is up destroys the bloom, 4,200 → 0 on both routes, because the blob restores the
bloodstain *and* `hp = 0` and the next frame fires a fresh `die()` with `soulsHeld` already zero.
Not player-reachable until autosave or save-on-rest lands, at which point it is immediate.

Owner: W1-13, dispatched.

## 0d. Two purses, and the save carries the empty one

Found by the W1-13 round-2 builder while writing a probe, and it is the mechanism behind a defect
the save critic reported separately. **`fenceSell` pays into `sim.stealth.p.gold` while the save
writes `sim.progression.gold`** — measured 417 against 0. So money earned by fencing is money the
save cannot see, which is how the spendable purse comes to be destroyed on a plain round trip, and
with it the bribe and therefore the non-lethal exit.

Alongside it: **`crime.bounty` in the save is a projection rewritten from `crime.ledger` every
frame**, so editing it in a blob is silently discarded. That trap turned the builder's own control
half-green before it noticed.

## 0e. `loadState()` does not close an open screen, and a stopped world scores as a passing one

`Engine._step()` returns early while a screen is open outside combat — correct, and S14. But
`loadState()` does not close one, so a screen left open upstream **freezes every subsequent block
while the instrument keeps printing `[OK]`**. Twenty deaths produced no death, no surface, no bloom,
`damage_frame: 0` on all twenty, ten of nineteen checks failing — and nineteen `[OK]` lines.

Proved in isolation 4/4: healthy control 5 frames and a death; sheet open 0 frames and no death;
`loadState` does not rescue it; `closeMenu` restores it. Two of the same journey's headline counts
were **constants** — it printed "20 of 20 conserved" from a line that counted rows, next to "20
mismatches". Any tool that steps the world must prove the frame counter moved before it reports
anything, and every journey in the tree should be audited for the same assumption.

## 0c. Nothing reads the books back — and it is the tenth orphan of the same shape

`corpus/90-verdicts/wave1/W1-LIBRARY-r1.md`, **FAIL 3/10**. The prose is excellent — 13 read end to
end, author voice 13/13, no omniscient narrator, quest-hint ratio 0.0% — and it does not reach the
game.

- **60 of 65 books declare `topics_taught`, 116 topics, and `topics_taught` is read by nothing.**
  Opened all sixty in the engine: `topicsKnown` `[]` before, `[]` after. That field is `RI-UIX05`
  R3's exception and the item's **entire declared AR-3 crossing**.
- All three knowledge-gated **non-violent** resolutions return byte-identical refusals after the
  book is read to its last page. `knowledge_key` is read by **zero code** in `game/src`.
  `ctx.knowledge` unions only per-quest `know:` flags, whose sole writer is `reveal()`, which
  requires the id be in `deceit.revealed_by` — none of the three appears in any quest file.

The remedy is two call sites and a save field, and the critic's probes already exist and already go
red. Also charged: K1's page balancing (a last-page pass lifts p10 from 62.3 to 82.3 — the item's
own §A B8 already requires it, so no amendment is warranted), and one of the 24 contradiction pairs
is not a contradiction.

**And the separability finding, which is bigger than the books.** A one-token rule separates our
prose from Morrowind's 241 books at **92.5%**: *"eleven"* is in 49 of our 65 and 7 of their 241,
84× by rate. A prose-tic sweep across all shipped text is dispatched.

## 0b. The prohibitions are installed on the wrong object

`session-run`'s capability prohibitions install on `window.__HARNESS`, and `main.js:24` publishes
`window.__ENGINE`. The tool critic went in the back door: front door refused and recorded,
`__ENGINE.spawnNPC` **spawned**, `listNPCs` 0→1, violations still 1. `setTimeOfDay` likewise. This
is R2 §8's result through a different door, and it means every measurement that relies on a
capability profile is only as good as the door it watches. Owner: tool builder r4, dispatched.

<!-- historic, kept for the record -->
## ~~0old. A player who walks 750 m walks off the built world~~ — ULTRACODE, above everything

Confirmed independently by the capture-service critic, and it is a **game** defect, not a tooling one.

- `renderer.province.request` has exactly **four** call sites — `_applyCell`, `teleport`, `walkRoute`
  only when `opts.stream` is set, and the harness. **Nothing in `sim/step.js`, `_afterStep()` or
  `main.js`.**
- **`Province.update()` has no caller anywhere in the tree.**
- Measured: 600 fixed-step frames with the camera 3 km away leaves **25 tiles unbuilt and
  `tilesResident` 0**.
- `request()` is also the only refresh for the ground skin, cover disc, near props and night lights,
  so **the whole drawn province is anchored to the last teleport.**

The brief's central promise is a world that takes an hour to cross on foot. **It cannot currently be
walked across at all** — the streamer only ever runs when something teleports. Every regional and
art-direction measurement taken by posing a camera without teleporting was a picture of an unbuilt
world, and `shoot.mjs --direct` on province viewpoints does exactly that. Service captures are safe
(they teleport, stream and gate on residency); the direct path is not.

Owner: the world piece. Fix the pump, then re-run anything that photographed a province viewpoint
directly.

## 1. The blade is underground, and now everyone can see it — ULTRACODE

The renderer landed, so the swing is visible for the first time. It looks wrong, and the numbers
now say why:

- `cgs_drowned_reaper`'s tip sweeps **238° at a 2.87 m radius** — conformance is fine — while its
  height runs **−1.92 to −0.81 m and is above ground on 0 of 40 frames**. Inclination is −36.7° at
  rest, worsening to **−66.3°** by frame 30.
- On a halberd you watch a bare haft stab into the dirt. On a greatsword the blade lies in the
  ground several metres ahead. It reads as a character miming a swing while the weapon ploughs.

**This is a data and solver defect, not a render one**, and the renderer builder was right to refuse
to correct it in the renderer: the drawn tip is the hit socket to 0.0008 mm, and fudging the visual
would break what-you-see-is-what-hits-you, which is the one invariant that makes the swing worth
drawing. The arithmetic: `_bladeLength` solves that weapon to **3.098 m of blade** so the tip radius
equals declared `reach_m`, on a 1.75 m character whose rest pose hangs the point down — a 3.1 m
blade from a hand at ~1.0 m is underground by construction.

Owner: whoever holds `_bladeLength` / `reach_m` (W1-10). The fix is upstream of both — either the
declared reach, the blade-length solve, or the rest pose. A previous round attempted a pitch
calibration and reverted it because it cost 40% arc nonconformance; that route is known bad.

## 1a. Re-read every visual verdict taken through a posed camera

`renderer.js:424` read the player's visibility as the negation of a camera override, so **a capture
taken through a placed camera hid the player**. Confirmed by the renderer builder's own pre-fix
probe (`reports/render/render-probe-prefix.json`: `player_visible: false`, `actors_drawn: 0`).
Fixed now.

**CORRECTION — I previously wrote here that the W1-10 round-3 critic's byte-identical weapon
screenshots "contained no character at all". That is false and a blog writer caught it by opening
the artefacts.** `corpus/90-verdicts/wave1/artifacts/W1-10-r3/frames/cgs_drowned_reaper-f000.png`
plainly shows the character with the 0.95 m box at the hip, and that critic's capture script
`kritik3-motion-focused.mjs` contains **no camera override** — those shots came through the ordinary
follow camera. **The weapons finding stands entirely on its own evidence.**

What actually needs retaking is narrower: **any measurement whose capture placed a camera to
photograph a character.** Check each candidate's capture script for a `camera(...)` override before
re-running it — do not re-run the lot on my say-so, and do not assume a verdict is void because it
is visual.

## ~~1old. The character and weapon renderer~~ — DONE. Kept for the record.

Found by the W1-10 round-3 critic. **The movesets are not rendered at all.**

- `game/src/render/` contains no reference to a weapon or a bone, and no `SkinnedMesh`.
- `makeActor()` welds **one 0.95 m box for all 87 weapons**.
- `renderer.js:398–399` writes only position and yaw.
- Frame-0 screenshots of a **1.95 m sword, a 2.85 m halberd and a 2.75 m curved greatsword are
  byte-identical** (md5 `9bdb823f…`), and a full 60-frame attack changes **0.19%** of the character
  box.

This outranks every other open gap, for three reasons:

1. **The brief.** The owner asked for weapons with "a subtly unique attack pattern and unique set of
   animations". 1,133 authored clips exist. None of them reaches a screen.
2. **It is why the other defects survived.** A halberd sweeping 1.3 m underground is invisible to a
   critic who cannot see the swing. Blade inclination, arc conformance and reach were all being
   argued from numbers because there was no picture to argue from.
3. **It blocks the whole visual half of the corpus.** Every art-direction and fidelity item, the
   third-person presentation item, and every blind visual comparison are unmeasurable while the
   player character is a box.

Scope: a skinned character with a weapon socket that reads the rig the combat system already
evaluates — `CombatBody.evaluateRig()` already double-buffers weapon sockets in world space, so the
data is there and nothing consumes it. **S18** (third person always) and `RI-CAM07` govern
presentation. Judge art direction against `corpus/70-visual/refs/morrowind/` and fidelity against
`corpus/70-visual/refs/modern/`, never fidelity against 2002.

Acceptance: screenshots of three weapon classes at the same frame are **not** byte-identical; a
60-frame attack moves substantially more than 0.2% of the character box; the rendered weapon's tip
tracks the socket the hit resolution uses, so what you see is what hits you.

## 2. Tool rebuild — now at round 4, and dispatched

Superseded by `corpus/80-methods/TOOL-COVERAGE-R3.md` (**NOT SATISFIED**, six rebuilds:
`build-viability`, `experience/beat-extract`, `journey-run`, `session-run`, `cadence`, `decoupling`).
Round 3's own headline finding — two tools reading `r.frame` while every shipped trace numbers frames
`f` — is the round's indictment too: it fixed the two it found and did not ask how many siblings
there were. There were two more, both in tools R1 *and* R2 accepted, and one of them promotes a
hedged confidence-0.7 verdict to 1.0 with corroborating evidence the trace does not contain.

The R1 list below **is now fully audited and none of it is open.** AUDIT-R1-LIST checked all five
bullets on 2026-08-08 at `bea2684` — ran each tool, ran each self-test, and read R2/R3/R4 for a
later verdict. **Five of five are dead: four fixed or superseded, one already struck.** The preamble
sentence above ("kept because parts of it are still open") was the load-bearing lie: it is what let
a dispatch be spent on the gamepad bullet, which was stale by two rounds. Every bullet below is
struck **in place with its history**, because a struck bullet that says why is worth more than a
clean list. `node tools/dispatch-staleness.mjs` now re-checks the mechanical part of this file in
under a second; run it before you dispatch anything off it.

- ~~**`build-viability.mjs`** — first. It buys a false pass on the exact axis it was written to
  unblock, while its self-test reports 8/8. Two permissive substitutions: it prints "no region
  declares a tier" when `regions.json` declares `danger_tier` 1–5 on all thirteen and the engine
  consumes it; and **0 of 41 quest givers resolve to a reaction group**, so the permanent
  race-and-upbringing bar cannot fire at all. Two character dimensions stay `corpus_debt` until this
  is right.~~
  **STRUCK 2026-08-08 by AUDIT-R1-LIST. SUPERSEDED — the tool this bullet names no longer exists.**
  `tools/analysis/build-viability.mjs` was `git mv`d to **`tools/analysis/impossibility-screen.mjs`**
  by `W1-VIABILITY-SPLIT` after five straight rejections (TOOL-COVERAGE-R1…R4), and split against
  `tools/quests/viability-walk.mjs` — the screen may report *impossible* or *unmeasurable* and is
  fenced in code from ever reporting that a build is playable. Both R1 sub-claims are dead on
  today's tree, measured not assumed:
  `node tools/analysis/impossibility-screen.mjs --signature saxhleel/fighter/given/interior --explain`
  prints **`giver census: 91/91 quest givers resolve to a reaction group (0 no NPC record, 0 record
  without reaction_group)`** where R1 said 0 of 41; and the artifact carries
  `tier5.tier5_regions = ["deep-marshes","stone-wastes"]` with `tier5_survivable` actually decided,
  where R1 said it printed "no region declares a tier". `--self-test-fence` is **14/14** (ten
  falsifications go red, four controls stay green). The *open* work is not this bullet — it is
  TOOL-COVERAGE-R4 rebuild items 1, 4, 5, 6, 7, 9, which the screen prints on every run under
  `KNOWN_SCREEN_LIMITS`, and its own `--self-test` at 49/51.
  **A correction I owe, because I made the error this project keeps warning about:** I first read
  the disappearance of `build-viability.mjs` at `7cf1c58` as rule 17's `git add -A` sweep, and was
  **wrong**. `git log --follow` shows a `D` because the rename landed across commits, but the new
  file's own header names the split and `W1-VIABILITY-SPLIT.json` records the `git mv`. Read the
  successor before you diagnose a sweep. The blob is identical either way: `git show
  b96de7c:tools/analysis/build-viability.mjs | git hash-object --stdin` is `e3d6790e…`, exactly the
  hash TOOL-COVERAGE-R4 measured, so nothing was lost.
  Evidence: `orchestration/status/AUDIT-R1-LIST.json`, `orchestration/status/W1-VIABILITY-SPLIT.json`.
- ~~**`gamepad-shim.mjs`** — does not run, 3/3 crash. This is the GameSir path the owner tests on.~~
  **STRUCK 2026-08-08 by W1-GAMEPAD. This line was stale by two rounds and it cost a dispatch.**
  It is R1's finding, kept in a list whose own preamble says "parts of it are still open" — this
  was not one of the open parts. TOOL-COVERAGE-**R2** recorded "`gamepad-shim` runs (8/8, was 3/3
  crash)"; TOOL-COVERAGE-**R3** line 370 says **Accept, 12/12**. Re-run at `52cffa1` before
  anything else was touched: `node tools/journey/gamepad-shim.mjs --self-test` → **PASS 12/12,
  exit 0**. It is now 15/15 (W1-GAMEPAD added the direction check R3 named but did not charge).
  There was never any contradiction with the W1-21 r2 critic driving a real pad, either: the
  critic used `__HARNESS.gamepad()` and the shim injects one layer higher at the
  `navigator.getGamepads()` seam — RI-JRN01 §0.1(a) struck the shim for the reachability legs
  **deliberately** and kept it for the descriptor leg. Two instruments, two seams, both alive.
  Evidence: `orchestration/status/W1-GAMEPAD.json`, `reports/w1-gamepad/`.
- ~~**`journey-run.mjs`** — `--sample-quests` and `--stratified` are inert while the leg reports `ok`.~~
  **STRUCK 2026-08-08 by AUDIT-R1-LIST. FIXED — and it was already accepted in R2, one round after
  this bullet was written.** TOOL-COVERAGE-**R2** §9 says *"ACCEPT. The R1 defect is genuinely
  repaired"*. Re-measured at `bea2684`, both flags doing real work:
  `node tools/journey/journey-run.mjs --journey jrn07-quest --profile headless-small
  --sample-quests 3 --seed 4711` drew **`[Q-LEDG-14, Q-ASSZ-06, Q-MAIN-14]`**; the same command with
  `--stratified --seed 99` drew one quest per stratum from live predicates with real candidate
  counts **Q1:32, Q2:33, Q3:2, Q4:9, Q5:0**. `m_quest_sample_complete` reports **`unmeasurable`**
  naming Q5 and its reason — never `ok` — and the run exits 1. R3's *separate* `r.frame` rebuild
  (§3) is discharged too: all eleven `R4:` frame-dialect assertions in the self-test pass.
  **Bonus, and it belongs to whoever owns RI-JRN07:** R2's Referral 1 called strata Q2 and Q5 a
  genuine content gap at 0 candidates each. **Q2 now has 33. Q5 is still 0.** Half that referral is
  closed and nothing had said so.
- ~~**`cadence.mjs`** — its exclusion list is not the shipped action set.~~
  **STRUCK 2026-08-08 by AUDIT-R1-LIST. FIXED — repaired in R2, hardened again in a round-4 pass.**
  `node tools/journey/cadence.mjs --self-test` → **PASS 21/21, exit 0** at `bea2684`. The battery
  now asserts the exact opposite of this bullet, in both directions: *"the classification is TOTAL
  over the shipped closed action set"* (all 16 shipped actions in exactly one class, so none can
  fall through to "counts by name"), *"an action outside the closed set makes C1 UNMEASURABLE,
  never a pass"*, and a control proving corroborated actions **do** still count, so it is not a
  blanket refusal. Its `R4:` rows also verify all 8 `FLAG_FIELDS` are written by the shipped corpus
  (192 881 records over 67 artifacts) and go red on the five fields R3 caught.
- ~~**`competence.mjs`** — the gear clause cannot fail.~~
  **STRUCK 2026-08-08 by AUDIT-R1-LIST. FIXED — and TOOL-COVERAGE-R3 line 369 already said so:
  "Accept", 13/13.** `node tools/journey/competence.mjs --self-test` → **PASS 13/13, exit 0** at
  `bea2684`. The clause now has both arms, which is precisely what "cannot fail" denied: **RED** — a
  weapon and burden change between the two encounters VOIDS the comparison
  (`wpn-iron-longsword → wpn-ebony-greatsword`, `equip_load_pct 41 → 63`); **GREEN** — an unchanged
  kit proceeds with no blockers. It also holds the line against the opposite defect R2 charged
  ("the clause now cannot *pass*"): a two-hand stance change is reported and does **not** void,
  because a clause that voided on stance would void every real fight.

**NEW, found by this audit, and not a member of the R1 list — do not confuse the two.**

- **`journey-run.mjs --self-test` is FAIL 21/22 at `bea2684`, on a row no R1…R4 round names.**
  `node tools/journey/journey-run.mjs --self-test` → `FAIL (21/22)`; the failing row is
  **`accessor empty before any surface — pre-surface text array has 3 entries via
  __HARNESS.getRenderedText(), open=false`**. I probed the register directly rather than guessing:
  the three entries are **HUD** text at frame 0 — `surface:"menus"`, `kind:"vector"`, `clipped:false`
  — reading `"5"` (flask count), `"LIGHT"` (roll class) and `"Spark-Da…"` (attuned spell).
  **RULING (rule 0 — decided, recorded, not parked): the accessor is correct and the ASSERTION is
  stale.** The test equates *"no surface is open"* with *"nothing has been painted"*, and the HUD
  now paints on frame 0. The right repair is to scope the assertion to the surfaces it is about
  (`dialogue`, `title`) rather than to weaken it, since its stated purpose — *"if it is non-empty
  here, it is returning something other than what was drawn and every later grep is void"* — is
  still worth having. **Reversible if:** the three entries turn out to be painted by something other
  than `ui/hud.js` — then the accessor really is leaking and this row is a true positive. I did not
  make the repair: `tools/journey/journey-run.mjs` is not mine, and rule 22 forbids me grading the
  fix I would have written.

### And two more stale claims, elsewhere in THIS file, found in 110 ms

`node tools/dispatch-staleness.mjs` re-runs the mechanically checkable claims in this document. On
its first run it reported **two stale claims outside the R1 list**. Both sections belong to other
live pieces, so this is a pointer, not an edit — whoever owns them should strike them the way the
bullets above are struck:

<!-- dispatch-staleness: quoted -->
1. **§2b "The Act V conversation nobody wrote" is no longer true.** It says
   `game/data/dialogue/topics/main-quest-argument.json` **does not exist** and calls it *"the single
   largest remaining gap in the main quest"*. **The file is on disk: 42 208 bytes, 12 topics,
   `hand_authored: true`, `do_not_regenerate: true`, every info tagged `quest: "Q-MAIN-26"`.** The
   twelve-topic conversation was written. Somebody could be dispatched to write it again tomorrow —
   which is the gamepad failure exactly, in the same file, one section away. W1-17's to strike.
<!-- dispatch-staleness: quoted -->
2. **§R still names `tools/analysis/build-viability.mjs`**, the path its own ruling caused to be
   renamed to `tools/analysis/impossibility-screen.mjs`. Harmless to a careful reader and a dead
   link to everyone else.

One claim it checked came back **LIVE** and should stay: §S3's `reports/W1-MASS-RECONCILIATION.md`
really is absent. That is the half of the job people forget — an auditor that only ever finds fault
is as useless as one that never does.

## 1b. Race does not affect whether a quest is offered to you

Found by the tool builder in round 2, while establishing that a reference item's own worked example
**cannot be produced on shipped data by any correct tool**:

- `engine.js:1147` resolves an NPC's reaction group **from the NPC record field alone** — there is
  no faction-to-group table anywhere in `game/src`.
- `seedDispositions()` seeds `rec.disposition` **raw** into the table the offer gate reads.
- **31 quest givers have a record with no `reaction_group`. Nine have no record at all**
  (`dyer-sallis`, `undertaker-vaskh`, `prefect-hallow`, `quartermaster-sedd`, `harbourmistress-tesh`,
  `cutter-neeth`, `factor-belliene`, `npc-porter-eeja`, `speaker-teel-ashaan`), so the gate reads
  disposition **0 for every character signature alike**.

**So the quest-offer path is race-invariant in the running build.** That contradicts the premise the
whole setting rests on — an Argonian at home versus a Dunmer abroad — and it is the same shape as
the two defects already found and fixed nearby: the reaction matrix that was a pure oracle, and the
Argonian who was offered nothing because a differentiation check passed by subtraction.

**AMENDED after the round-2 tool critic tested the proposed fix and it did not work.** The builder
claimed either data fix unblocks this immediately. The critic applied it — minted the missing NPC
record on a shadow tree — and then **booted the engine on that same patched tree: it blocked nobody,
and the disposition clause was gone for all five signatures.** The data work is necessary and
**not sufficient**.

**The real cause is one layer deeper: `derivedDisposition()` never touches the quest path at all.**
`seedDispositions()` writes `rec.disposition` **raw** into the table the offer gate reads, so no
race or upbringing term is ever applied to a quest offer, regardless of how complete the NPC records
are. Confirmed in the running world rather than from source — six character signatures driven
through `questOffers()` returned byte-identical disposition clauses.

So dispatch **both halves or neither**: wire the derived disposition into the offer path, *and* fill
the missing records. Doing the data alone produces a build that still ignores race while every
instrument reports success — which is the exact failure this project keeps finding, bought at the
price of a dispatch.

Owner: whoever holds `character.race.access`/`character.race.dialogue` — the decomposition audit
found both paths were dropped from W1-07's declared set while the item judging them was scored into
it three times.

## 2b. The Act V conversation nobody wrote

`Q-MAIN-26` declares a twelve-topic Act V conversation and
`game/data/dialogue/topics/main-quest-argument.json` **does not exist** — the topic bodies were
never written. The main quest completes without it, but the climactic conversation of the game is
currently a declaration with no words in it. This is W1-17's (dialogue) territory and is the single
largest remaining gap in the main quest.

Orchestrator ruling already made, for whoever picks this up: the four quests that carried
`category:"main"` were magic-utility quests mislabelled by a generator shorthand, with stakes
contradicting the act band they claimed. They are recategorised to `side` and the generator is
fenced. Do not "restore" them.

## 3. Critics owed a piece that has reported

Dispatch a fresh-context critic for any piece whose builder has finished and whose verdict is stale.
Currently owed: **W1-26** (the opening as a played scene), and **W1-01** (world, round 4) once the
region capture can actually run — it needs a quiet box, since a frame costs 25 s idle and 150–260 s
under load.

## 4. Wave-1 pieces never dispatched

Over half of reference items own no path any dispatched verdict declares. `docs/PLAN.md` §3 has the
list. Wide before deep: start the unstarted ones as capacity allows, preferring anything on the
path to a playable game end to end.
