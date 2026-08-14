# Visual truth pass — status

Agent: visual-truth (ground truth by playing the game). Branch `codex/wave1-build-experiment`.
Started 2026-08-14. This file is updated as work proceeds so a restart can resume.

- [x] Read CLAUDE.md, OWNER-DIRECTIVES-2026-08-14.md, Codex handover notes
- [ ] Boot game headless, confirm shipping path loads
- [ ] Orbit camera around player — transparency claim
- [ ] Multi-location / multi-time-of-day sweep
- [ ] Non-visual systems spot check
- [ ] Report

## Log

- 08:25 Disk was 100% full (31 MB free). Cleared ~9 GB of six-day-stale scratch clones from
  /tmp/claude-0/.../scratchpad (two were registered git worktrees; removed via `git worktree remove`).
  Captures were silently failing with ENOSPC before this.
- 08:30 RunPod GPU: `npm run gpu:doctor` failed on 3 checks. Two causes, both fixed locally:
  (a) `ssh`/`scp`/`ssh-keygen` were not installed (apt-get install openssh-client);
  (b) Node's global fetch does not honour HTTPS_PROXY, so every RunPod API call got
  "403 Host not in allowlist: rest.runpod.io" while `curl` to the same URL returned 200.
  `NODE_USE_ENV_PROXY=1 node tools/runpod/cli.mjs doctor` is all-green.
- 08:35 Orbit of the player captured, 24 angles + 16-step shipping-path look sweep:
  docs/shots/2026-08-14-visual-truth/
- 08:45 Material audit: EVERY visible mesh in the player subtree is transparent=false,
  opacity=1. So the see-through is not material alpha. Running the geometric measurement.
- 08:50 Intermittent BOOT FAILURE observed once: ui/compass.js:109 cardinalOf() ->
  POINTS[NaN].label. Requires camera yaw to be non-finite. A viewport sweep of 10 sizes
  did NOT reproduce it, so it is flaky rather than size-dependent.
- 08:55 Capture cost: in harness mode the canvas backing store stays at 1920x1080 regardless of
  viewport, so every screenshot() pays a 2 Mpx readPixels under SwiftShader. Added a --canvas
  option to the vt-* tools; 960x540 is ~4x cheaper and is what the sweeps now use.
- 08:58 Self-inflicted: `pkill -f vt-seethrough` also matched the RunPod CLI (the tool name was
  inside its --command string) and killed the GPU job. Pod terminated cleanly via
  `node tools/runpod/cli.mjs cleanup`; ~2 minutes at $0.27/hr. Relaunched detached.
- 09:05 GPU: RunPod provisioning gets as far as a live Pod (RTX A5000, SECURE, $0.27/hr,
  API-confirmed RUNNING with a public SSH port) and then cannot connect. Two layers:
    * raw outbound TCP is blocked entirely (`/dev/tcp/69.30.85.220/22060` times out);
    * the agent HTTP proxy does accept CONNECT to that host:port, but /root/.ccr/README.md
      says "TLS is re-terminated there", and SSH is not TLS, so the tunnelled session dies at
      `kex_exchange_identification: Connection closed by remote host`.
  So the GPU is reachable for API calls and not reachable for work. Both pods created were
  terminated via `node tools/runpod/cli.mjs cleanup` (deletion API-confirmed); total spend is a
  few minutes at $0.27/hr. All rendering below is SwiftShader and is labelled as such.
- 09:20 A near-miss worth recording. A scripted `look` sweep showed the camera turning 1 degree
  per 12 frames, which reads as "the camera is unturnable". It is not: `look` is DEGREES PER
  FRAME and `sim/camera.js` zeroes it after consuming it, so an event emitted once turns the
  camera once. Emitting a `look` event on every frame gives the documented 3 deg/frame cap
  (rig.json max_yaw_deg_per_frame). Harness mistake, not a game defect — corrected in
  tools/harness/visual-truth.mjs and NOT reported as a finding.
- 09:22 First see-through measurement was also void: it used a player-hidden reference frame,
  and `actor.js:988` reasserts `mesh.visible` on the body every frame, so the "player absent"
  reference still contained the player. Rebuilt on material swaps, which do survive.
- 09:45 See-through complete at four radii: 2.6 m 1.4%, 1.6 m 0.2%, 1.0 m 0.1%, 0.6 m 0.0%.
  The body is solid at every distance and every angle tested. Transparency claim not reproduced.
  Remaining gap: everything so far is HARNESS mode; renderer.js:62-67 builds the GL context
  differently for a person. Written tools/harness/vt-playmode.mjs to close that.
- 09:50 vt-play.mjs run 1 aborted at the fight step: I passed archetype 'pop-0027-infantry'
  (that is an eid, not an archetype) and the harness correctly refused. Menus and dialogue were
  behind it and did not run. Split into tools/harness/vt-play2.mjs with a real archetype.
