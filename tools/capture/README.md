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

**Rebuilt after CAPTURE-SERVICE-R1 beat it 28 times out of 30.** The first version was a denylist of
exact words, read out of four field names, with `evidence_of` defaulting to `appearance` when it was
absent. Inflections walked past every stem (`traverse` past `travers`, `crossings` past `crossing`);
the words a reachability claim actually uses were never on the list (`passable`, `accessible`, `you
can get to`, `hike`, `trek`, `egress`); `String(raw)` turned `claim: {item: 'RI-JRN04'}` into
`"[object Object]"`, which matches nothing; six fields a real report carries were never read; and
omitting the declaration entirely was PERMITTED.

A denylist of words cannot work, because the space of English ways to assert a journey is not
enumerable and the gate loses to every phrasing it did not think of. **So the gate is inverted.**

| layer | what it does | can it permit? |
|---|---|---|
| **A — the declaration** | `evidence_of` is **required**, must be a string, and must be an exact token of a **closed vocabulary** (`PURPOSES` in `arrival.mjs`). Appearance tokens pass; arrival tokens are refused with the S34(b) explanation; **anything else — absent, empty, misspelt, invented, an object, an array — is refused.** There is no default. | yes, and only this layer can |
| **B — reference-item class** | every string anywhere in the spec, at any depth, keys included, scanned for `RI-JRN*` / `RI-WLD03` | no, refuse only |
| **C — contradiction** | the same recursive scan for stems (prefix-matched, so inflections cannot escape), whole words, phrases and durations that assert a journey | no, refuse only |

Because B and C can only ever refuse, **the gate's soundness does not rest on the completeness of a
word list.** That is the whole point of the inversion. They exist to catch a caller whose free text
contradicts its own declaration, which is what laundering looks like.

Acceptance is **no longer silent**. `classify()` returns an `audit` block — the declared purpose,
its class, and every string the scan read — and the daemon banks it in the manifest as
`arrival_gate`. The R1 critic's finding (f) was that a laundered capture left no trace of what it
was requested for; a later audit can now find one.

For an arrival claim, walk it: `tools/world/reachability-walk.mjs`, or `__HARNESS.walkRoute()` /
`walkPath()`.

**What this does not claim.** It does not recognise every English sentence that asserts a journey;
nothing can. It claims something narrower and checkable: no capture leaves this service without an
explicit, recognised declaration of what it is evidence of, that declaration is recorded beside the
picture, and the admissibility statement names it. A verdict citing a capture declared
`region-appearance` for a reachability claim is VOID **by inspection of the sidecar**, which is
S34's own final defence and does not depend on this file being clever.

## The cache is a store of pixels, not a source of provenance

The worst finding in R1: the daemon read the sidecar `.json` out of the cache bucket, checked two
fields, and returned the whole manifest **verbatim** as its own answer. A manifest written by hand
next to a 1×1 PNG was served through the ordinary client API in **24 ms**, stamped
`arrival: "walked"`, `evidence_of: "arrival"`, `settled: true`, with a recorded `sha256` of
`not-even-the-hash-of-this-file`. No browser booted and no gate ran.

Three layers now stand between the bucket and the caller, ordered so the load-bearing one needs no
secret:

1. **The daemon re-derives provenance, always.** `provenanceBlock()` is the only thing that ever
   builds a provenance block, on a render and on a hit alike, and it *asserts* `arrival: "placed"`
   rather than taking it from anywhere — the daemon knows unconditionally that it has no walking
   mode. Nothing read off disk contributes. Even a perfectly signed manifest claiming `walked`
   cannot make the service say `walked`.
2. **The bytes are checked.** `sha256(png)` must equal the manifest's own recorded hash. This is not
   only an attack surface: the write path is not atomic across the pair, so a killed daemon can
   leave a mismatched one.
3. **The manifest is authenticated.** Every manifest carries an HMAC over the fields later relied
   upon. One without a valid signature was not written by this daemon. *Honest limit:* every agent
   here runs as the same user, so this authenticates "this daemon wrote this", not "no local process
   could forge it" — layer 1 is what holds in that case.

Any failure is a **cache miss** — re-render, re-prove, overwrite — never an error and never a
refusal. And `provenance.served_from_cache` is now `true` on a hit, in the answer *and* rewritten
into the sidecar, because S34 names that flag and `HARNESS.md` §6 tells readers to look for it.

`no_cache` also means what it says now. It used to mean "do not read" while still writing, so a
request that altered how the picture was produced (`__no_camera_stream` removes the camera
stream-drain and photographs an emptier world) could bank the result under the legitimate key. It
neither writes a manifest nor touches the banked filename.

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
| **G1 residency** | is the world the camera sees actually built? | `__HARNESS.provinceResidency(x, z)` — computes the want-set from the streamer's own geometry and reads it. **Read-only** | `queued === 0` |
| **G2 quiescence** | is the streamer finished? | `built === 0`, `tilesQueued === 0` | both zero |
| **G3a deceleration** | did something arrive and then stop? | `excess = max(0, d1 − d2)` | `≤ 0.005` |
| **G3b acceleration** | is it arriving *after* the frame that ships? | `rise = max(0, d2 − d1)`, failing only if `rise > 0.005` **and** `d2 > 1.5 × d1` | both, or pass |
| **G3c accumulation** | is it arriving *steadily*? | `gamma = d13 / max(d1, d2)` | `≤ 1.35` |

over three frames A(t), B(t+12), C(t+24), where **B is the frame that ships**, `d1 = |A−B|`,
`d2 = |B−C|` and `d13 = |A−C|`.

G1 and G2 answer *is the world there*. G3 answers *has it stopped moving*. Neither answers the
other.

**Why G3 is three gates.** R1's G3 was one number, `excess = max(0, d1 − d2)`, and the critic
certified three shapes of unsettled world with it. `max(0, ·)` means `d2` is never looked at once it
exceeds `d1` — so a world exploding into existence *after* the delivered frame passed with a `d2`
fifty-six times the threshold. And subtracting `d2` removes any change that is **steady** across all
three frames, so an arrival at a constant rate is subtracted out along with the ambient floor.

**Why the third comparison earns its place.** The critic's slow loader (`d1 = 0.060, d2 = 0.055`) and
the measured settled marauders-coast frame (`d1 = 0.0644, d2 = 0.0640`) are numerically the same
pair. *No function of `(d1, d2)` can certify one and refuse the other.* `|A−C|` separates them:
ambient motion is **stationary** — the cover that swayed in the first interval is the cover that sways
in the second, over the same blocks, so `|A−C|` stays the size of one interval — while arrival
**accumulates** into new blocks, so `|A−C|` approaches the sum. Measured gamma 1.02 against 1.83.
And it costs no extra frame: A and C are frames the proof already holds.

**Every gate fails closed.** A gate that could not run records `ran: false` and `pass: false` with
the reason in `why`. R1 wrapped the residency read in `try/catch` and substituted
`{queued: 0, …}`, after which the proof said `G1 pass: true` — so a manifest reading
"settled, G1 pass" could mean "the gate ran and the world was there" *or* "the gate never ran", and
no reader could tell them apart. There is now no combination of inputs for which a missing
measurement produces `settled: true`.

**And the probe no longer demolishes what it measures.** G1 used to call `streamAround(x, z, 0)`,
documented as a pure read because a budget of 0 builds nothing. It is not one: `province.request()`
re-focuses the streamer, rebuilds the ground skin, the near-prop disc and the cover disc, and
releases every resident tile outside the new want-set, all before any budget is consulted — and it
runs *between* the two frames the proof compares. The critic measured it taking `tilesResident`
25 → 0 and meshes 247 → 5. `provinceResidency()` reads instead, and if the verb is missing G1
**fails** rather than falling back.

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
# the CRITIC's instrument. Not written by the service's builder; exits non-zero when an attack
# SUCCEEDS. This is the bar the service is held to, and it must not be edited to pass.
node tools/capture/critic-r1-probe.mjs --gates --key --metric --forge --sticky --isolate

node tools/capture/settle-shapes.mjs     # does G3 discriminate, and by WHICH gate? (offline, ~40 ms)
node tools/capture/falsify.mjs           # attacks the service; non-zero if any attack succeeds
node tools/capture/concurrency-test.mjs  # N processes, counts browsers from /proc
node tools/capture/cache-test.mjs        # hit timing + build invalidation (edits game/, restores it)
node tools/capture/calibrate-settle.mjs  # re-derives the threshold from measurement (records d13/gamma)
```

`falsify.mjs` includes the control that makes the refusals mean something: the same capture with
the service's streaming remedy left in **must succeed**, otherwise "it refused" proves only that
it refuses everything.

**`settle-shapes.mjs` exists because the critic's `--metric` phase can no longer fail.** That is
not a criticism of it — it is the attack that found R1's blind spot. But it calls `judge()` with a
residency object that has no `ran` field, and the rebuilt gates fail closed on exactly that, so all
five of its rows are refused by G1 before G3 is consulted; and its `wrong` predicate counts only
false *passes*, so five blanket refusals score clean. **Deleting G3b and G3c entirely leaves it
green** — confirmed by deleting them. `settle-shapes.mjs` hands `judge()` a complete residency
reading and a complete triad so the verdict is decided by G3 and nothing else, and it asserts
**which sub-gate refused**, because a case that fails for a reason other than the one it names is
not evidence for the thing it names.

A probe you have not tried to break is a probe you do not know the strength of. Every gate here was
removed on a copy of the tree and the instrument confirmed to go red:

| removed | what the instrument said |
|---|---|
| `readCache()` (trust the sidecar again) | `P3-cache-forgery` **BEATEN — SERVED in 25 ms: arrival=walked, sha256 recorded=not-even-the-hash-of-this-file** (R1 measured 24 ms) |
| the declaration gate's fail-closed default + recursive scan | `P1-gate-laundering` 0/30 → **11/30 accepted** |
| `__no_camera_stream` from the canonical spec | `P2-cache-key-honesty` **1 dishonest**, `P2b` red |
| `ACC_RATIO` loosened to 3.0 | `settle-shapes` **2 misjudged** — steady arrival certified SETTLED |
| `ACC_RATIO` tightened to 1.01 | `settle-shapes` **6 misjudged** — three *real* settled frames refused |

The last two are a two-sided falsification: the bound sits in a band with a real edge on each side.

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
