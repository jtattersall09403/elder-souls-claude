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
