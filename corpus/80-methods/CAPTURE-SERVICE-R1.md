# CAPTURE-SERVICE-R1 — the critic's verdict on the shared capture service

> `TOOL-LOOP.md` rule 3, and the rule that creates this role: **no builder ever checks its own
> homework.** I did not write `tools/capture/` and I am not defending it. `falsify.mjs` is the
> builder's own instrument and tests six laundering variants its author imagined; every attack
> below was written by me, in `tools/capture/critic-r1-probe.mjs`, and every number below came out
> of a run on this box. `node tools/harness/boot-check.mjs` **PASS** before every measurement
> (13.6 s equivalent; `smoke.mjs` never boots the engine, which is why the check is named).
>
> **Verdict: NOT SATISFIED.** Seven rebuilds. I beat both gates. The arrival gate accepts **28 of
> 30** laundering specs it has never seen, and the cache will hand you a capture stamped
> `arrival: "walked"` in **24 milliseconds**.

| | |
|---|---|
| Verdict | **NOT SATISFIED** — 7 rebuilds, 0 of them cosmetic |
| Gates beaten | **both**. S34(b) broken *through the service's own client API* (P3); the settle proof certifies three shapes of unsettled world (P6) |
| Settle threshold under a middle case | **does not survive.** Steady arrival at 30% of blocks per interval is certified SETTLED |
| Streamer defect | **REAL, CONFIRMED INDEPENDENTLY, and broader than reported.** Escalate as a game defect |
| Single worst thing | **the daemon replays cache manifests it did not write.** A hand-written sidecar makes the service assert that the player walked there |
| What is genuinely good | G1 is the right gate and it does catch the loophole; the build key is content-based and mtime-proof; the bind-as-exclusion race fix is correct; the 40% cold cost is stated plainly rather than hidden |

My own instrument: `tools/capture/critic-r1-probe.mjs`
(`--gates --key --metric` offline, `--forge` needs a daemon but no browser, `--sticky` 3 renders,
`--streamer` its own browser). Report: `reports/capture/CRITIC-PROBE.json`. It exits non-zero when
an attack **succeeds**. `--isolate` gives it a private socket and cache so it cannot disturb the
shared daemon; six of the seven findings below reproduce in under a minute.

---

## 1. THE ARRIVAL GATE — beaten 28 times out of 30

`arrival.mjs` `classify()` is a pure function, so I attacked it directly rather than through a
browser: attacking it through the daemon would only have hidden which specs got through.

```
node tools/capture/critic-r1-probe.mjs --gates
BEATEN  P1-gate-laundering  28/30 laundering specs ACCEPTED by classify()
```

Every one of the 30 is a request for a picture that would be cited as evidence of **arrival**. Two
were refused — and both only because I happened to write the phrase *"on foot"*, which is on the
word list. Nothing else fired.

**a. Morphology.** `WORD_RE` is word-boundary matched, so inflections walk straight past a list
that contains their stems:

| spec `claim` | on the list | accepted |
|---|---|---|
| `the player can traverse the mire` | `travers`, `traversal`, `traversable` | **yes** — `travers` is followed by `e`, which is alphanumeric, so the boundary fails |
| `both crossings are passable at low tide` | `crossing` | **yes** — plural |
| `the two routes out of the delta are usable` | `route` | **yes** — plural |
| `the player got here walking, unaided` | `walked`, `walkable` | **yes** |
| `the player reaches the shrine from the south gate` | `reach`, `reached` | **yes** |
| `arrivals at the west stair` | `arrival` | **yes** |

**b. Synonyms the list never had** — and these are the words a reachability claim actually uses:
`passable`, `accessible`, `you can get to`, `hike`, `trek`, `egress`, `navigate`, `it takes 340
seconds from the dock`, `how far the player can go`. All nine accepted. S34 names *"reachability,
traversal, the crossing, whether a route is walkable"*; the gate catches the corpus's vocabulary
and misses English.

**c. Field shape.** `classify` does `String(raw)`. Hand it a structured claim and the check
evaporates:

```js
claim: { item: 'RI-JRN04', text: 'is the crossing walkable' }   // -> "[object Object]" -> ACCEPTED
claim: [{ item: 'RI-JRN04' }]                                   // -> "[object Object]" -> ACCEPTED
```

**d. Fields the gate never reads.** It inspects exactly four names — `claim`, `for`, `purpose`,
`note`. A report carries `title`, `item`, `ri`, `caption`, `tags`, `description`. All six accepted,
including `item: 'RI-JRN04'` — the reference item S34 names **explicitly** — passed verbatim.

**e. The declaration defaults to permitted.** `arrival.mjs:66` reads
`String(spec.evidence_of || spec.evidence || 'appearance')`. Omit it and you get `appearance`.
`falsify.mjs` A2f is labelled *"evidence_of omitted entirely — must not default to permitted"* and
it does **not test that**: its spec also carries `claim: 'reachability of the north shore'`, so the
refusal it records comes from the claim. Remove the claim, as I did, and the capture is taken. A
test that passes for a reason other than the one it names is not evidence for the thing it names.

**f. And when the gate accepts, it records nothing.** `canonicalSpec()` drops `evidence_of`,
`claim`, `title`, `item` — measured, `P2b-canonical-drops`. So the manifest of a laundered capture
carries no trace of what it was requested for, and no later audit can find it. The gate's only
output is a refusal; acceptance is silent.

**This does not by itself void S34(a).** Everything this service emits is stamped
`arrival: "placed"`, and S34's final defence is that a verdict citing a placed capture for an
arrival claim is VOID. That defence still stands. What does not stand is the builder's claim that
the gate is *"deliberately hard to launder"* and that *"the claim id is checked independently of the
label"*. It is trivially launderable, and 28 of 30 is the measurement.

---

## 2. THE CACHE — beaten in 24 ms, and this is the worst thing in the service

`runJob()` step 2 reads the sidecar `.json` out of the cache bucket, checks two fields
(`build.build_key` and `settle.settled`), and then returns **`{...man}`** — the whole manifest,
verbatim — to the client as the service's own answer.

I wrote a manifest by hand into the bucket, next to a 1×1 PNG, and asked for it through the
ordinary `CaptureSession.capture()` API:

```
node tools/capture/critic-r1-probe.mjs --isolate --forge
BEATEN  P3-cache-forgery  SERVED in 24 ms: arrival=walked, evidence_of=arrival, settled=true,
        sha256 recorded=not-even-the-hash-of-this-file,
        actual=c414cd0e204de974f73753c7e28d7638e7b3691bb8b1a2bab6b25bb7fed7ce77
```

The service handed back a capture whose provenance says

> `arrival: "walked"`, `evidence_of: "arrival"`,
> `placement: "the player walked here from the south gate, unaided"`,
> `ruling: "RI-JRN04: admissible as evidence of ARRIVAL"`

with `settled: true` and all three gates recorded as passing. No browser was booted. No gate ran.
**S34(b) is broken through the service's own front door**, and the honest half of S34 — that every
capture records its provenance — is broken with it, because the provenance the caller receives was
not derived by the thing that took the picture.

Two aggravations:

- **The bytes are not checked.** The manifest's `sha256` is fiction and the daemon does not notice.
  This is not only an attack: any truncated, half-copied or foreign PNG in the bucket is served as
  a settled capture under an authoritative-looking hash. The cache lives in
  `reports/runs/capture-cache/`, which is gitignored, unprotected, and shared by every agent on the
  box. The socket is `chmod 600`; the thing behind it is not.
- **It cannot be dismissed as forgery.** The daemon's *own* write path is not atomic across the
  pair — `renameSync(png)` then `writeFileSync(json)` — and it is the daemon, not the attacker,
  that decides to trust whatever the pair says on the next hit. The fix is the same either way:
  **re-derive the provenance block on a hit** (the daemon knows, unconditionally, that everything
  it serves is `placed`), and **verify the PNG against the manifest's sha256**, treating a mismatch
  as a miss.

### 2b. S34's cache flag is wrong on every hit

S34: *"Every capture records its provenance — `arrival: placed|walked`, the build sha, the settle
proof, **and whether it was served from cache**."* `HARNESS.md` §6 repeats it: *"Every capture
carries … and whether it came from cache, in a sidecar `.json`."*

Measured (`P3b`): on a hit, `cached: true` sits at the top level of the response, and
`provenance.served_from_cache` is **`false`** — because it was written once at render time and is
replayed unchanged. The sidecar on disk says `false` for ever. A reader who does what `HARNESS.md`
tells them to do — read the sidecar — can never learn that a capture came from cache. `falsify.mjs`
A4 checks `typeof out.cached === 'boolean'`, i.e. a different field, and A5 does not look at the
provenance flag at all, so the builder's own suite cannot see this.

### 2c. The cache key does not determine the picture

This is the cache's central promise and it is false. Measured, three renders,
`P4-spec-determinism`:

| order | spec | sha256 |
|---|---|---|
| 1 | `place(A)`, **no time, no weather** | `54822b05d5de…` |
| 2 | `place(A)`, `time: 1`, `weather: storm` | (conditioned) |
| 3 | `place(A)`, **no time, no weather** — byte-identical spec to row 1 | `ce6b6e011369…` |

Control, run separately: the **same** spec three times back to back is byte-identical
(`3da4742d0c0d` ×3, ~50 s each), so this is not clock drift and not nondeterminism.

The mechanism is in the code and the experiment confirms it. `setTimeOfDay`/`setWeather` write
`sim.env` and nothing puts it back; `performCapture` reloads only when
`loadedState !== spec.state || worldDirty || !spec.place`. A `place`→`place` sequence — the
builder's own declared fast path — never reloads, so **a spec that omits a condition inherits the
previous job's condition**. `canonicalSpec` records `time: null, weather: null` and the cache banks
a night storm under it.

That is not an exotic path. It is exactly what `shot.mjs --at <x>,<z>` sends when the caller does
not pass `--time`, which is the documented headline usage on line 7 of the tool's own help.

### 2d. Two smaller key defects

- **`__no_camera_stream` changes the picture and is not in the key** (`P2-cache-key-honesty`, the
  one dishonest mutation of nine). It is the falsification hook that removes the streaming remedy.
  It is also not recorded in the manifest, because `canonicalSpec` drops it.
- **`no_cache` means "do not read"; it still writes.** So a request that deliberately alters how
  the picture is produced can bank the result under the legitimate key. The two combined are a
  cache-poisoning primitive; G1 closes it today only because the emptier world it produces usually
  fails residency.

---

## 3. THE SETTLE PROOF — sound in its central idea, unsound at three edges

**The idea is right and I want to say so first.** G1 (residency) is the gate that closes the
loophole, the reasoning behind it is correct, and the ambient correction is genuinely necessary:
in the builder's own data, settled scenes reach `d1 = 0.128` while a streaming scene can sit at
`d1 = 0.0116`, so no absolute two-frame threshold separates them. That argument survives.

### 3a. The threshold does not survive a middle case

I fed shapes of change to the service's **own** `judge()` at its **own** declared threshold
(`P6-metric-blind-spots`, offline, no browser):

| world | d1 | d2 | excess | verdict | ought to be |
|---|---|---|---|---|---|
| **steady arrival** — 30% of blocks arrive per interval, still arriving | 0.30 | 0.30 | 0 | **SETTLED** | unsettled |
| **slow loader** — still arriving across both intervals | 0.060 | 0.055 | 0.005 | **SETTLED** | unsettled |
| **accelerating arrival** — the world explodes into existence *after* the delivered frame | 0.02 | 0.14 | 0 | **SETTLED** | unsettled |
| the builder's calibrated streaming case | 0.0293 | 0.0174 | 0.0119 | unsettled | unsettled |
| a live scene, cover swaying steadily | 0.087 | 0.0865 | 0.0005 | SETTLED | SETTLED |

`excess = max(0, d1 − d2)` measures **deceleration**, not motion. Any arrival process that is
steady across 24 frames is subtracted out along with the ambient floor, and `max(0, ·)` means a
`d2` fifty-six times the threshold is never looked at at all — even though `d2` is the interval
that starts at the frame which **ships**. The threshold sits in an empty band; the band is empty
because only one shape of change was ever put in it.

### 3b. The calibration's streaming population is entirely caught by G1 anyway

Read out of `reports/capture/SETTLE-CALIBRATION.json`:

```
streaming (n=5):  d2 = 0.00000 in 5 of 5,  resid.queued = 18..23 in 5 of 5
settled   (n=13): excess = 0 in 10 of 13; the band's floor (0.00251) is ONE observation
                  (valus-ridge, day-ashfall). d1 = 0 exactly in 6 of 13.
absent    (n=5):  excess = 0, queued = 25 — G1's job, as the builder says
```

`d2 = 0` in every streaming sample means those worlds arrived in one burst between A and B and were
**completely still** by B. They are not "still streaming" frames; they are frames where the world
was absent when A was taken. And all five carry `queued` of 18–23, so **G1 refuses all five on its
own**. There is not one calibration sample in which G3 is the gate that must fire. Its threshold
has never been validated against a case it alone must catch — which is precisely the class my three
middle cases occupy.

### 3c. G1 and G2 fail open, and the proof cannot tell you

`performCapture` wraps the residency read in `try/catch` and substitutes
`{ queued: 0, built: 0, tiles_queued: 0, not_in_province: true }`. `judge()` then records
`G1_residency: { pass: true }`, `G2_quiescence: { pass: true }` — and **does not copy
`not_in_province` into the proof**. The same free pass applies when `camX === null`. So a manifest
saying `settled: true, G1 pass: true` may mean "the gate ran and the world was there" or "the gate
never ran", and no reader can distinguish them. A gate that cannot report its own absence is the
same defect this project rejected twice in the tool loop.

### 3d. G1's probe is not the "pure read" it is documented to be

`settle.mjs` claims `streamAround(x, z, 0)` is *"a pure read of how much of what this camera can see
does not exist yet"*. It is not: `streamAround` calls `province.request()`, and `request()`
(`game/src/world/province.js:181`) rebuilds the ground skin, the near-prop disc and the cover disc,
and **releases every resident tile outside the new want-set**. Measured in my own probe, at a camera
3 km from the last teleport:

```
before the probe:  tilesResident 25,  meshes 247,  instances 49,967
after  the probe:  tilesResident  0,  meshes   5,  instances  2,583
```

The measurement demolished the world it was measuring. It runs **between frames A and B** — the two
frames G3 compares. In the ordinary path the remedy has already focused the streamer at the camera
so the rebuild is a no-op, which is why this has not bitten; it is one skipped remedy away from
putting the instrument's own side effect into `d1`.

---

## 4. THE STREAMER FINDING — CONFIRMED, INDEPENDENTLY, AND IT IS BIGGER THAN REPORTED

The builder's central finding is that `renderer.province` is never pumped from the fixed step.
**It holds.** I confirmed it two ways.

**By exhaustive call-site enumeration.** `renderer.province.request|pump|drain` appears in
`game/src` at exactly four places:

```
engine.js:2511   _applyCell()                    request + drain
engine.js:3277   teleport()                      request + drain
engine.js:4422   walkRoute()  — only if opts.stream, request + pump(1) every 90 frames
harness/api.js:249  streamAround()               the harness verb
```

Nothing in `sim/step.js`, nothing in `Engine._afterStep()` (engine.js:2767), nothing in `main.js`.
`Province.update(x, z, budget)` exists at province.js:667 and **has no caller anywhere in the
repo** — the per-frame updater was written and never wired.

**By measurement**, `P5-streamer-from-step`, my own browser, no daemon: teleport to A, pose the
camera 3+ km away at B, `stepFrames(600)`, then probe B.

```
after teleport A:      queued  0,  tilesResident 25
after 600 fixed steps: queued 25,  tilesResident  0,  tilesQueued 25
```

600 frames of simulation moved the streamer by nothing.

**And it is broader than the builder reported.** `request()` is also the only thing that refreshes
the 34 m ground skin, the 70 m ground-cover disc, the 90 m near-prop disc and the night signature
lights (`province.js:183-186`). So it is not just tiles: **the entire drawn province is anchored to
the last teleport**, and it neither follows the player nor the camera.

### Escalation — this is a game defect, not a capture defect

> **GAME DEFECT, for the queue.** The drawn province — tiles, ground skin, cover disc, near props,
> night lights — is anchored to the last `Engine.teleport()` / `_applyCell()`. The fixed step and
> the main loop never pump it. The resident ring is 5×5 tiles of 300 m (`RADIUS = 2`), so a player
> who walks more than ~750 m from where they last teleported walks off the built world, and it does
> not come back. `Province.update()` is the fix that was written and never called.

I did not close the walking half by measurement and I will not claim I did: my walk probe
(`P5b`) put `walkPath()` through 4,000 frames in the deep-marshes and it covered **41.8 m** — a
mire finding that belongs to another piece, not a streaming result. The walking claim above rests on
the call-site enumeration, which is exhaustive; the posed-camera claim rests on both.

**Consequence for published numbers.** Placed captures taken through this service are *safe*: the
daemon teleports (streaming at the body) and then calls `streamAround` at the camera, and G1 checks
the result. `province-shots.mjs --direct` also calls `streamAround` and honestly records
`"direct browser; no settle proof taken"`. The exposure is `shoot.mjs --direct` on the province
viewpoints, which poses a camera **without** teleporting and without streaming at it: on this
engine that camera looks at whatever ring the last `_applyCell()` built. Any regional-distinctness
number taken through that path predates every gate in this service and should be re-taken through
it — which is cheap now, and is the strongest argument the service has.

---

## 5. THE THREE FAILING TESTS — one unfinished, two honest limits with a fixable instrument

**Queue fairness — UNFINISHED, though the refusal to loosen the bar is right.** The builder
reports 74,046 ms for a one-frame client behind a 40-frame pack, 4.6× better than FIFO, against a
bar of 4 frame-times, and writes *"I did not close why"*. I closed it. I re-implemented `nextJob()`
exactly as written and drove it with the test's own queue shape:

```
2 connections, 40 jobs on A, 1 job on B arriving second:
dispatch order: A0 B0 A1 A2 A3 A4     — B0 is job 2 of 41
```

**The scheduler is fair.** The round-robin dispatches the small client second, not eighth. So 74 s
is not starvation; it is 2–3 *real* frames, because frames are heterogeneous (a cold region costs
40–55 s on this box — I measured 48–53 s at 640×360 — while the pack's median was 8.5 s) and the
bar compares a wall time against a median it does not belong to. The measurement is honest, the bar
is wrong, and the right quantity was available in the daemon the whole time: **count the jobs
dispatched ahead of the small one**, which `inflight`/`nextJob` already know. Diagnosable in ten
minutes; left red instead. That is unfinished work, not a limit.

**Both contention tests — HONEST LIMITS.** `browsers_added = 2` on a box where other agents start
browsers inside the window is not a fact about the daemon, and the builder says so and refuses to
loosen it. That is the right call and it is the behaviour the two previous critics asked for. But
the instrument is fixable: the attributable evidence is the daemon's own `booting browser` line,
and I verified it survives — `reports/runs/.capture/capd.log` shows one `listening on` and one
`booting browser` per daemon generation, plus `another capture daemon already owns … - exiting` for
a loser. Assert on that (attributable) and keep the `/proc` delta as context (not attributable).
I did not re-run the 8-way start race; the bind-as-exclusion argument is correct and the log is
consistent with it.

---

## 6. THE 40% COLD COST — the trade is right, the third frame is not what buys it

The service costs 21.9 s/frame cold against 15.7 s direct, and the builder states it plainly. **The
trade is right in kind**: at N=4 the wall clocks are equal (93.2 vs 98.3 s) but the old path added
four browsers and 12.2 to the load average while the service added none, and time-to-ready went
14.4–17.2 s → 0.38 s. On four cores, "one browser cannot multiply" is worth more than 40% of one
agent's throughput. Nothing in this section is a rebuild.

But the justification offered for the third frame is wrong. `phase_ms` puts `settle_ms` at 12,140
of 13,647, and S34 is invoked as the reason: *"the price S34 sets: three frames instead of one."*
S34 sets no such price — it says *"two frames taken some frames apart"*. The third frame is the
builder's own (good) invention, and the calibration shows what it actually buys: with `d2 = 0` in
5 of 5 streaming samples, the ambient subtraction does **nothing** on the streaming side. It exists
to prevent **false refusals** on the 3 of 13 live scenes where `excess > 0`. That is worth having —
and it can be had for less.

**A cheaper honest proof, from the builder's own numbers: take C only when `d1 > threshold`.**
If the first interval is already inside the threshold, no subtraction can push it out, so C cannot
change the verdict. In the calibration, `d1 ≤ 0.005` in **7 of 13** settled frames (6 of them
exactly 0). Those seven pay two frames instead of three, no verdict moves, and the expensive cases
— the live coasts — still get the full correction. That is a ~15–20% cut in settle cost for zero
loss of rigour, and it should be taken together with the fix in §3a (a `d2` bound), which costs
nothing at all.

---

## REBUILD LIST

| # | What | Why |
|---|---|---|
| **R1** | **Re-derive provenance on a cache hit and verify the PNG.** The daemon knows unconditionally that it serves `placed`; it must stamp that itself rather than replay a manifest. Check `sha256(png)` against the manifest and treat a mismatch as a miss. | P3: `arrival: "walked"` served in 24 ms. Breaks S34(b) through the service's own API. |
| **R2** | **Set `provenance.served_from_cache = true` on hits**, in the object returned *and* in anything `shot.mjs --out` copies out. | S34 names the flag; `HARNESS.md` §6 claims it; it is `false` on every hit. |
| **R3** | **Rebuild the arrival classifier.** Stem/prefix matching instead of exact words; scan every string in the spec recursively, not four field names; refuse a non-string `claim` instead of stringifying it; require `evidence_of` explicitly with no default; and **record the accepted claim in the manifest** so acceptance is auditable. Fix `falsify.mjs` A2f, which does not test what it says. | P1: 28 of 30. |
| **R4** | **Make a spec determine its picture.** Either reload before any capture that does not pin `time`/`weather`/`tide`, or read the env back after posing and put the observed values in the manifest and the key. | P4: identical specs, different pictures. The cache promise is false for the documented headline usage. |
| **R5** | **Every image-affecting input in the key** (`__no_camera_stream`), and `no_cache` must not write. | P2: the one dishonest mutation of nine, plus a poisoning primitive. |
| **R6** | **Settle proof:** bound `d2` (the delivered frame's own interval) as well as `excess`; add a monotonicity or fourth-frame test so steady arrival is visible; record `not_in_province` / "gate did not run" in the proof instead of `pass: true`; re-calibrate against at least one population G1 does not already catch. | P6 (three shapes certified settled), §3b (no G3-only sample), §3c (fails open silently). |
| **R7** | **A read-only residency verb.** `streamAround(x, z, 0)` mutates: it rebuilds three camera-following discs and releases tiles. G1 needs a `provinceResidency(x, z)` that computes the want-set and returns the shortfall without touching the scene. | §3d: the probe took the world from 247 meshes to 5. |

**Escalated separately, not a capture rebuild:** the province streamer defect in §4. It is a game
defect, it is confirmed, and it is the reason G1 has to exist at all.

---

## WHAT I DID NOT FIND WRONG

Said plainly, because a critic that only accuses is as useless as a builder that only agrees.

- **G1 is the right gate.** The insight that image stability alone passes a photograph of nothing is
  correct, it was measured before the gate was written, and 5 of 5 absent controls prove it.
- **The build key is honest.** Content hash of `game/**`, not a git sha, with the stat signature
  used only as a change detector — over-invalidating, which is the safe direction. C3 (identical
  bytes, moved mtime → still a hit) and C4 (the marker read back out of the running page, so the
  browser really is serving the new code) are both the right tests, and I did not break either.
- **The race fix is correct.** `listen()` on a unix path *is* the atomic operation; the lock file
  correctly demoted to serialising corpse removal; `I_OWN_SOCKET` guarding the unlink is exactly
  the "a process must not clean up a resource it does not own" rule.
- **The failure honesty is real.** Three of the builder's own tests are left red. The `--pin-build`
  finding (another builder edited `game/` four times in three minutes, which would have made a
  117-frame pack a mixture of four games) is the kind of thing that only gets written down by
  someone not protecting a number.

One small thing to sweep with R5: `ES_CAPTURE_SOCK` does not isolate a daemon. `LOG_PATH` and
`LOCK_PATH` are pinned to `RUNS_DIR/.capture`, so my isolated daemon wrote into the shared
`capd.log` and contended for the shared `capd.lock`. Derive all three from the socket path.
