# Where the game actually starts — 2026-08-14

**What this is.** A ground-truth pass settling a factual disagreement: every recent report (the
visual audit, the first-ten-minutes builder and its critic, the orchestrator's own dispatch briefs)
treats **Lilmoth** as the starting settlement and prioritised work on that basis. **The owner has
played the deployed build and comes out of character creation in Thorn, facing a building's wall.**

**Verdict: the owner is right. The true opening — title screen, "New", the whole character-creation
scene — starts and ends in Thorn, not Lilmoth. Lilmoth is a harness/debug default that a player who
clicks "New" never passes through.** This is settled by direct citation of the game's own data and
code, not by inference, and corroborated by playing it.

Screenshots: `docs/shots/2026-08-14-spawn-truth/` (tracked; `reports/spawn-truth/shots/` is where the
tool writes them and is gitignored by `reports/.gitignore`'s blanket rule, same as every other run
artifact in this repo — the tracked copies are the ones this report cites). Tool (committed, re-runnable):
`tools/harness/spawn-truth-thorn.mjs`.

---

## 1. The two starting points, and why they've been confused

There are two different things in this codebase both called "the start", and every prior report
read the wrong one.

**`game/data/states/default.json`** — loaded whenever the engine boots with no explicit state name
(`game/src/main.js:23`: `const stateName = params.get('state') || 'default';`). Its own title says
so: *"A fresh character on the harbour steps at Lilmoth, in the Western Rootlands."* Player position
`[2766.5, 0, 5011.0]`, yaw 180. This is what every harness tool, every screenshot sweep and every
verdict in this project boots into by default, because that is the correct thing for a tool
measuring "the world" to do. **It is also, as far as this pass can find, never what a player who
opens the game and clicks New actually reaches.**

**The title screen's "New"** — `game/src/engine.js:3909-3917`, `_titleApply()`:

```js
if (id === 'new') {
  title.dismiss('new');
  title.inSession = true;
  // O6's walk starts here: the hold of the barge, a body you control, and somebody on
  // the other bench who wants your hatch-name. Nothing is explained.
  const st = this.censusBegin({});
  ...
```

`censusBegin({})` places the player in `barge-hold` — "the hold of the Gideon barge" — and drives
the whole character-creation questionnaire (race, upbringing, ten Warden-Scribe questions, a name)
through to a stamped writ at `writ-house` — "The Writ House at Tidewrack." **Neither of these two
interiors, nor anything between them, is ever Lilmoth.** The `default.json` state is not consulted
anywhere in this path.

Every report that measured "the opening" — the visual-truth audit, the first-ten-minutes builder
and critic — booted straight into `default` (Lilmoth) rather than clicking New, which is the
harness-friendly and completely reasonable thing to do for a tool, and is not what a player
experiences.

## 2. Barge-hold and the Writ House are physically in Thorn

This is not a matter of degree or interpretation. It's in the data, twice over:

**Direct tag.** `game/data/world/interiors/writ-house.json` line 5:
```json
"settlement": "thorn",
```

**The building list.** `game/data/world/settlements/thorn.json` lists both interiors as Thorn
buildings, in its `tidewrack-quay` quarter, with real Thorn province coordinates:

```json
{ "id": "barge-hold",  "name": "The Hold of the Gideon Barge", "quarter": "tidewrack-quay",
  "door": [3800,    0, 904.5] },
{ "id": "writ-house",  "name": "The Writ House at Tidewrack",  "quarter": "tidewrack-quay",
  "door": [3806.25, 0, 908.5] }
```

`writ-house.json`'s own `continuity` block gives the exact coordinate the player is placed at on
leaving: `exterior_spawn: [3808.599, 0, 909.355]` — a few metres from those two doors, all inside
Thorn's `tidewrack-quay` quarter. `game/src/sim/settlement.js`'s comment on this scene, written by a
prior agent building the arrival-measurement tool this pass reused, says it plainly: *"the whole
creation happens in two interiors, `barge-hold` and `writ-house`."* Both are Thorn.

**Played, not just read.** `tools/harness/spawn-truth-thorn.mjs` drives the real input pipeline —
`titleActivate('new')`, then `censusEnter`/`censusAnswer` through every question exactly as
`interact` would — and screenshots each stage:

| stage | shot |
|---|---|
| Title screen | `docs/shots/2026-08-14-spawn-truth/desktop-00-title.png` |
| Barge hold (creation begins) | `docs/shots/2026-08-14-spawn-truth/desktop-01-barge-hold.png` |
| Writ House, writ stamped (creation ends) | `docs/shots/2026-08-14-spawn-truth/desktop-02-writ-house-done.png` |
| Thorn's Tidewrack Quay, at the writ house's own `exterior_spawn` coordinate | `docs/shots/2026-08-14-spawn-truth/desktop-03-thorn-tidewrack-quay-establishing.png` |

The fourth shot is a placed establishing shot (`tools/harness/shot.mjs`, S34(a) "appearance"
evidence — it teleports and poses the camera, not a claim about the walk itself) at the literal
`exterior_spawn` coordinate the door hands off to. It shows dense mangrove and a building wall
immediately beside the camera — Thorn's marsh quarter, not Lilmoth's.

## 3. "Facing a building's wall" — reproduced, and the mechanism is code, not chance

Two independent things point at the same defect, and they compound.

**Inside the room, at the moment control is handed back.** `desktop-02-writ-house-done.png` is the
frame immediately after the last census answer resolves. The camera is exactly where the scripted
dialogue framing (`game/src/character/scene.js`) put it for the conversation — facing the
Warden-Scribe's desk, with, in the game's own words, *"the wall of eleven years of other people's
reed-cases"* filling the frame behind her. That framing is correct **for a conversation**; nothing
re-aims the camera when the scene hands control to the player, so the first frame anyone actually
controls is a wall of storage shelving at arm's length. A player who has not yet been told to look
around is looking at a wall.

**Leaving the building, a few steps later.** `game/src/sim/settlement.js` — `useDoor()` and
`leaveInterior()` — place the player at the door's declared position with `placeBody(sim, at)`:

```js
function placeBody(sim, at) {
  if (typeof sim.placeBody === 'function') { sim.placeBody(at[0], at[1], at[2]); return; }
  sim.player.pos[0] = at[0]; sim.player.pos[1] = at[1]; sim.player.pos[2] = at[2];
  ...
}
```

**Position only. No yaw is ever written.** Whatever direction the player was facing the instant
before the teleport — typically toward the door, i.e. back into the room, or into whatever is
immediately outside it — is exactly the direction they face the instant after, regardless of what is
actually in front of the new coordinate. This applies to every one of the 115 interiors in
`game/data/world/interiors/**`, not just this one; Thorn's writ house is simply the interior every
player meets first. A prior agent's own tool comment (`tools/harness/w1-26-r2-arrival.mjs`, written
independently of this pass) already names the same mechanism: *"`leaveInterior()` does not walk you
out, it calls `placeBody()` on the interior's declared `continuity.exterior_spawn` — a teleport."*

The establishing shot at that exact coordinate (`desktop-03-thorn-tidewrack-quay-establishing.png`)
shows why this is not a hypothetical: a building wall sits immediately beside the exit point. A
player exiting while still facing the direction they last pressed toward the door is a good
candidate for ending up staring straight at that wall rather than out over the quay.

**This pass's own attempt to walk out through the door, driven exactly like a player, also got
physically stuck** on room geometry between the desk and the door (position held at `x≈4.17`,
unable to reach the door's declared face at `x=0`) — the same stall the pre-existing
`w1-26-r2-arrival.mjs` tool hits independently. That is recorded honestly rather than papered over
(§5); it means the "spawn-moment" and walk-sequence shots in this pass's own capture use
`H.teleport()` to the interior's own documented `exterior_spawn` coordinate as a labelled fallback,
not a successful driven exit. It does not change §2's or §3's citations, which come from the data
and the door code directly, but it means nobody should cite this pass as proof the door *can* be
walked out of smoothly — that remains open, and is arguably a fourth, related defect (an obstruction
between the census end-position and the room's own exit anchor).

## 4. Why this matters for prioritisation

Every recent piece of work calls Lilmoth "the weakest of the eight settlements" and prioritises it
as the most urgent, on the premise that it's what a new player sees first
(`reports/visual-truth/2026-08-14-visual-truth.md`, `corpus/90-verdicts/wave1/W1-FIRST-TEN-MINUTES-r1.md`).
**That premise is false. A player never sees Lilmoth until well after character creation** — the
first settlement anyone meets, including the owner, is Thorn.

This is not a small reprioritisation. Thorn is not merely under-measured; per
`docs/art-direction/ART.md` §3, it is one of only **four of the eight settlements with no
art-direction target set at all**, and the worst of those four — **zero composition-valid reference
plates** (`n=0`), against helstrom's 2 and archon's 1:

```
| thorn      | 11.32 … 61.13 | 7.98 … 25.73 | unset (n=0) | unset (n=0) |
```

So the settlement every player's first ten minutes actually happens in has no colour band, no
roofline-relief target and no sky-fraction target to build toward — the art-direction board could
not set one, for lack of reference material. That gap has been invisible because the reports
measuring "the first ten minutes" were, without exception, measuring Lilmoth instead.

**What should change, stated plainly rather than left for someone else to infer:**

1. **Retarget "first ten minutes" measurement at the actual opening.** Every future first-ten-minutes
   pass should boot via the title screen and `New`, the way `spawn-truth-thorn.mjs` does, not via
   `?state=default`. A `firstTenMinutes` or equivalent harness convenience that starts from the title
   screen would stop this recurring.
2. **Thorn's reference-plate gap is now the more urgent one.** Acquiring composition-valid reference
   plates for Thorn (per `docs/REFERENCE-IMAGE-REQUEST.md`'s existing process) should be treated with
   the same urgency Lilmoth's visual work has been getting, because it is the settlement with zero
   plates and it is the one every player's first minutes happen in.
3. **The door-exit yaw defect (§3) is worth its own fix**, separable from where the game starts: no
   interior exit in the game sets a facing direction, so "walk out of any building and immediately
   face a wall" is a systemic risk, not a Thorn-specific one. It compounds with the already-diagnosed
   D1 camera-burial defect (a tree, at Lilmoth, ten seconds after spawn — see the visual-truth report
   §2 D1) in the sense that both are "the camera ends up looking at the wrong nearby geometry
   immediately after a transition," but they are independent bugs with independent causes: D1 is a
   camera arm collision failure against vegetation during motion; this is a placement call that never
   writes orientation at all, on every door in the game. **Not the same bug — do not close one by
   fixing the other.**
4. **Lilmoth's "weakest settlement, most urgent" framing should be re-examined**, not necessarily
   reversed. Lilmoth may still deserve priority on other grounds (it may be visited soon after Thorn,
   or be otherwise weak) — but "it's what the player sees first" is no longer one of those grounds
   and should be struck from that argument everywhere it appears.

## 5. What this pass could not do, reported plainly

- **The deployed build (the actual `https://jtattersall09403.github.io/...` URL) could not be
  reached from a real browser in this container.** `curl` through the container's agent proxy
  reaches it and every other external host tried (200 OK); a Playwright-launched Chromium, proxied
  the same way, resets the connection (`net::ERR_CONNECTION_RESET`) on every external host tried —
  `jtattersall09403.github.io`, `example.com`, `raw.githubusercontent.com`, `github.com` — not just
  this one. This looks like a policy or transport gap specific to browser-originated traffic through
  this proxy, not a game-specific problem, and is worth a tooling fix so future browser-based
  evidence-gathering here doesn't hit it fresh each time. **Fallen back to serving `game/` locally**,
  which — per this repo's own README — is not an approximation: *"GitHub Pages publishes this
  repository from its root, so `game/` on the web is the same directory the instruments test — there
  is no copy to go stale."* The local tree used was one commit ahead of last-known origin in ways
  unrelated to this investigation (a dialogue tone-metrics fix and dashboard regeneration only —
  checked directly, `git show --stat` on both divergent commits).
- **A clean, driven walk out through the writ house's own door was not achieved, and the planned
  fallback shot of the exterior spawn point was not captured either.** The straight-line greedy
  walker (in this pass's tool, and independently in the pre-existing
  `tools/harness/w1-26-r2-arrival.mjs`, run separately during this pass and confirmed to fail the
  same way) gets stuck on room geometry at the same coordinate both times (`x≈4.17`, short of the
  door's declared face at `x=0`) and never reaches the reach radius `sim/settlement.js` requires
  before it will open the door. This pass then tried `H.teleport()` straight to the interior's own
  `exterior_spawn` coordinate as a fallback (§3) — that call is slow-to-return with `sim.env.interior`
  still set to `'writ-house'` (`Engine.teleport()` only requests province streaming when
  `cellFor(sim.env) === 'province'`, which is false while the interior flag is still set, so the
  new position is never streamed in before `groundAt()` is asked to place it vertically) and the run
  was killed after several minutes with no further screenshot produced, rather than let it run
  indefinitely on a contended box. **So this pass has a real, data-cited `exterior_spawn` coordinate
  and a separately-captured placed shot of that exact coordinate (`shot.mjs`, §2's fourth row,
  `evidence: appearance`), but no screenshot of the literal frame immediately after a completed
  door-triggered teleport, and no 30-seconds-of-walking sequence or phone-viewport captures at all.**
  Whoever next touches the door-exit-yaw fix in §4.3 should clear `sim.env.interior` (or otherwise
  make `teleport()` interior-aware) before relying on it from an interior for future capture tooling.
- **GPU/hardware-rendered screenshots were not attempted for this pass** — SwiftShader only, which
  is sufficient for the geometric/positional claims here (which settlement, what coordinates, what's
  in frame) but not for a fidelity judgement, which this pass does not make.
- **Multi-angle orbit and a longer walk (past 30 s) were not captured**, to keep this pass inside a
  reasonable time and cost budget once the network fallback and contention (below) were accounted
  for.
- **Contention.** `node tools/contention.mjs --gate` returned WAIT (5 browser instances, 5.4-5.6
  load/core against a 4.0 ceiling) partway through this pass, with two captures already in flight.
  No third browser was launched past that point; the in-flight captures were allowed to finish rather
  than adding load. Recorded in `orchestration/status/spawn-truth-thorn-lilmoth.json`.

## 6. What was NOT changed

Per the dispatch: **nothing about where the game starts, which way the player faces, or the door-exit
placement code was modified.** This is a fact-finding pass only. `game/src/sim/settlement.js`,
`game/src/engine.js`, `game/data/states/default.json` and every interior/settlement data file are
untouched.
