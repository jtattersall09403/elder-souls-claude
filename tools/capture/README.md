# The capture service

One browser for the whole box, a queue, and a build-keyed cache.

> **ARBITRATION.md S34.** Read it before using this. In one line: a capture that is evidence of
> **appearance** may be placed and cached; a capture that is evidence of **arrival** may not, and
> this service will refuse to take it.

## Use it

```bash
node tools/harness/shot.mjs --viewpoint VP01
node tools/harness/shot.mjs --at 4210,9880 --yaw 135 --time 11 --weather storm
node tools/harness/shot.mjs --status
```

It prints a path and exits. You do not have to start anything: the first call starts the daemon,
and it is idempotent, so N agents racing produce one daemon and one browser.

From a tool:

```js
import { capture, captureMany, CaptureSession } from '../capture/client.mjs';

const shot = await capture({
  evidence_of: 'appearance',              // required; 'arrival' is refused (S34(b))
  claim: 'what this picture is for',      // checked — see "the arrival gate" below
  place: { x: 4210, z: 9880 },            // teleport here
  pose: { yaw_deg: 135, pitch_deg: 4, eye_m: 1.7, fov: 70 },
  time: 11, weather: 'storm',
  width: 1280, height: 720,
});
shot.path        // the PNG
shot.cached      // was it already rendered on this build?
shot.settle      // the settle proof, all three gates
shot.provenance  // arrival, build key, git sha, admissibility
```

For many frames use one `CaptureSession` rather than N one-shots: the daemon's scheduler treats a
connection as one claimant, so a long pack on one connection cannot starve another agent.

The session also does read-only world queries against the warm engine, batched into one round trip
— so a sampler no longer needs its own browser just to ask where the ground is:

```js
const r = await session.query([['getTerrainAt', x, z], ['getWaterAt', x, z]]);
```

## Why it exists

Boot costs ~9 s and each further shot ~2.2 s, so batching inside a tool was never the problem.
Every agent running its own browser was: at peak, forty `headless_shell` processes on four cores,
each independently re-rendering the same world, driving load to 44–103 and a 1280×720 frame from
25 s to 150–260 s. The W1-01 round-4 builder's 117-frame region pack managed three frames in
twelve minutes and had to be abandoned, so the piece's headline number went unmeasured.

## What it does and does not buy you

Measured, same 13 frames (`province-shots --per 1 --passes day`), same box, same window:

| | wall clock | per frame |
|---|---|---|
| the old private-browser path (`--direct`) | **204 s** | 15.7 s |
| through the daemon, cold cache | **285 s** | 21.9 s |
| through the daemon, warm cache | **3 s** | 0.23 s |

**A single agent doing a cold pack is about 40% slower through the daemon, not faster**, and
saying otherwise would be a lie. The extra time is the S34 settle proof: three renders where the
old path took one. Per-capture phase breakdown at 1280×720: `settle_ms` 12.1 s, `place_ms`
(teleport + province drain) 1.5 s, `screenshot_ms` 0.27 s.

What it buys is the other three things:

1. **A repeat is free** — 3 s against 204 s for the same 13 frames, 68×.
2. **N agents do not become N browsers.** The old path's 15.7 s/frame is only available to one
   agent at a time; fourteen agents each holding a browser is what turned 25 s/frame into
   150–260 s/frame and killed the round-4 pack. See `CONTENTION.json`.
3. **Every frame now carries a settle proof and its provenance.** The old path had neither, and
   the frames it produced could not be distinguished from photographs of a world that had not
   finished loading.

## What is admissible (S34)

Every capture this service produces is **placed**: it teleports and it poses the camera. Nothing
walks anywhere. Under S34(a) that is legitimate evidence of *appearance* — what a region looks
like, whether two regions are distinguishable, whether an impact frame reads, whether a menu is
legible. Under S34(b) it is **not** evidence of *arrival*, and a verdict citing one of these
frames for an arrival claim is **VOID**.

Every capture therefore carries, in its sidecar `.json` and in the client's return value:

| field | meaning |
|---|---|
| `provenance.arrival` | always `"placed"` — this service has no walking mode |
| `provenance.build_key` | `game@<16 hex>` — a content hash of the whole `game/` tree |
| `provenance.git_sha` / `git_dirty` | the human-readable half |
| `settle` | the three-gate settle proof, with the threshold and the gap it was judged against |
| `cached` | whether these bytes were rendered for this request or an earlier identical one |

### The arrival gate

`tools/capture/arrival.mjs` refuses, before doing any work:

- `evidence_of: "arrival"` or `"walked"` — said plainly;
- `arrival: "walked"` — asking the service to lie about provenance;
- `evidence_of` missing — there is no default that guesses for you;
- a `claim` / `for` / `purpose` / `note` naming `RI-JRN*` or `RI-WLD03`, **whatever it is
  labelled** — the label does not get to overrule the claim;
- a claim containing *arrival, reach, reachability, traversal, walkable, route, crossing, journey,
  duration, how long, elapsed, timed, en route* and the rest of the list in that file.

For an arrival claim, walk it: `tools/world/reachability-walk.mjs`, or `__HARNESS.walkRoute()` /
`walkPath()`.

The word list is **deliberately over-inclusive** and its false positives are accepted. "The bridge
at the crossing" is refused even though what it wants is a picture of a bridge, because the
classifier cannot distinguish that from "the crossing is passable", and the two mistakes do not
cost the same: a wrongly refused appearance capture costs one re-worded claim; a wrongly permitted
arrival capture voids a verdict. The remedy — saying what the picture is actually evidence of,
"the bridge's stonework and silhouette" — is a better claim than the one that tripped the gate.

## The settle proof, and why it has three gates

S34: *"a placed capture must prove it is settled… A capture is settled only if two frames taken
some frames apart are stable within a declared threshold; an unsettled frame is an error, never a
quiet pass."*

Image stability **alone is not sufficient on this build**, and that is measured rather than
assumed. The province streamer is pumped from `engine.teleport()` and `engine._applyCell()` and
from nowhere inside the fixed step, so a camera posed where the player has never been looks at a
world with no tiles in it — and goes on looking at the same empty world for as many frames as you
step. Two frames twelve frames apart are then **byte-identical**. Measured, 5 of 5 controls:
`changed_frac = 0.000000` with 19–25 tiles unbuilt. A gate made only of image stability passes
every one of them.

So:

| gate | asks | measured by | must be |
|---|---|---|---|
| **G1 residency** | is the world the camera sees actually built? | `streamAround(camX, camZ, 0)` — budget 0 builds nothing, so `queued` is a pure read | `queued === 0` |
| **G2 quiescence** | is the streamer finished? | `built === 0`, `getWorldStats().streaming.tilesQueued === 0` | both zero |
| **G3 stability** | has it stopped moving? | three frames A(t), B(t+12), C(t+24); `excess = max(0, \|A−B\| − \|B−C\|)` | `≤ 0.005` |

G1 and G2 answer *is the world there*. G3 answers *has it stopped moving*. Neither answers the
other.

### The metric, and why it is ambient-corrected

The obvious metric does not work. This world is alive — ground cover sways, ash falls, rain falls,
water moves — and over a 12-frame gap a legitimately settled frame moves up to **8.7% of its
pixels** while a frame with terrain still arriving can move as little as **0.6%**. The two
populations overlap completely: `separated: false` at every block size from 4 to 48 px.

`|A−B|` is the fraction of 4×4-pixel blocks of a 384×216 thumbnail whose mean RGB moved by more
than 8/255 on any channel. `|B−C|` is the same scene's own ambient motion, measured in the same
place, under the same conditions, over the same gap. Subtracting it leaves only change that
happened in the first interval and not the second — which is the signature of content arriving and
then stopping.

Measured (`reports/capture/SETTLE-CALIBRATION.json`, 13 regions × 4 condition sets settled,
5 partial-stream, 5 absent):

```
settled     excess ≤ 0.00251     (10 of 13 exactly 0)
lighting    excess = 0           (this build converges lighting in one frame)
streaming   excess ∈ [0.01157, 0.14120]
absent      excess = 0           ← G1's job, not G3's
```

**Threshold 0.005** is the geometric middle of the empty band: 2.0× above the worst settled frame,
2.3× below the mildest streaming one. It fires on all five streaming cases. It is not a number
picked to be unreachable.

A frame that fails G3 is retried up to three times, stepping four more gaps of settle frames each
time, and delivered only if an attempt passes all three gates. That is *wait longer and re-prove*,
which is what a settle test is for — not *raise the threshold until nothing fires*. The attempts
and the frames spent are recorded in the proof.

## Prove it yourself

```bash
node tools/capture/falsify.mjs           # attacks the service; non-zero if any attack succeeds
node tools/capture/concurrency-test.mjs  # N processes, counts browsers from /proc
node tools/capture/cache-test.mjs        # hit timing + build invalidation (edits game/, restores it)
node tools/capture/calibrate-settle.mjs  # re-derives the threshold from measurement
```

`falsify.mjs` includes the control that makes the refusals mean something: the same capture with
the service's streaming remedy left in **must succeed**, otherwise "it refused" proves only that
it refuses everything.

## Operating it

```
reports/runs/.capture/capd.sock    unix domain socket
reports/runs/.capture/capd.lock    O_EXCL start lock (pid + socket)
reports/runs/.capture/capd.log     the daemon's log
reports/runs/capture-cache/<build_key>/<cache_key>.png|.json
```

- **Starting** is automatic and race-free, and the exclusion is the **bind**, not the lock file.
  `listen()` on a unix socket path is atomic — the kernel lets exactly one process bind it. The
  lock file only serialises removing a *corpse* socket left by a killed daemon.
  The first version had this the other way round and its own log caught it: it treated a lock as
  stale when the holder's pid was alive but its socket did not yet answer, which is exactly the
  window between taking the lock and finishing `listen()`. Six agents racing produced **four**
  processes all logging "listening on", three orphaned daemons and three orphaned browsers.
  Verified after the fix: eight daemons launched simultaneously produce one "listening on" line
  and one process; six client processes racing a cold daemon produce one "booting browser" and
  four "another capture daemon already owns … - exiting".
- **Only the owner cleans up.** `shutdown()` unlinks the socket only if this process bound it.
  Found the hard way: killing a leftover daemon that had *lost* the race removed the live
  daemon's socket out from under a 40-frame job.
- **A client that dies** loses its queued jobs; a job already in flight finishes and is written to
  the cache (the work is done), and its reply is dropped.
- **Fairness** is per-connection round-robin. A 117-frame pack does not make a one-frame client
  wait 117 frames.
- **Idle**: the browser is closed after 180 s idle, the daemon exits after 1800 s. Assume it can
  vanish — the client re-ensures it on a dead socket.
- **Build staleness**: the daemon watches `game/` with a cheap stat signature, and on a real
  content change drops the browser (which is holding the old code) and adopts a new build key.
  New captures land in a new cache bucket; the old build's pictures stay on disk to be diffed.
  An mtime that moves without content moving does **not** invalidate.
- **A broken `game/`** does not take the daemon down. `launchGame()` reports failure through
  `die()` → `process.exit()`, which for a shared daemon is a respawn loop; the boot therefore runs
  with `process.exit` swapped for a throw, and a game that will not boot becomes a `GAME_BROKEN`
  job error with a 15 s backoff while the daemon stays up.
- **Pinning**: `--pin-build` freezes the build key so a long pack is drawn by ONE game. Measured
  during this piece's own benchmark, another builder edited `game/` four times in three minutes
  and an unpinned daemon correctly threw the browser away each time — which would have made a
  117-frame pack a mixture of four different games. A pinned capture still records the drift
  (`tree_has_since_moved_to`), so it never claims to be of the current tree.
- `node tools/capture/server.mjs --status | --stop`.

## Reading the test reports

The box is **shared**: 24 browser processes belonging to other agents were live during these
runs. Every browser-count assertion is therefore on the **delta** from that test's own baseline,
never on an absolute — an assertion of "one browser on the box" would fail for reasons that have
nothing to do with the service, which is the same class of mistake as a probe that cannot fail.
Load averages are recorded alongside every timing for the same reason.

## Existing capture paths

`tools/harness/shoot.mjs`, `tools/world/province-shots.mjs` and `tools/world/w1-01-r4-shots.mjs`
route through the service by default and keep their original private-browser path under
`--direct`. Their output schemas are unchanged apart from added S34 provenance fields.
