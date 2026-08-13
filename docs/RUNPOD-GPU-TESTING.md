# Temporary RunPod GPU browser testing

`tools/runpod/cli.mjs` gives Codex, Claude Code, and maintainers one safe interface for temporary
hardware-GPU browser work. It exists because this repo's normal container uses SwiftShader: that
is useful for deterministic functional checks, but its frame times and native-resolution output
are not admissible hardware evidence.

## Start here

The Codespace or agent environment needs these secrets. Never put either value in a file, command
line, log, issue, or commit.

```sh
export RUNPOD_API_KEY='...'
export RUNPOD_GPU_TEMPLATE_ID='...'
```

The API key needs permission to read GPU inventory and templates and to create, read, and delete
Pods. The configured template must be a Pod template which starts `sshd`, exposes `22/tcp`, uses
an Ubuntu 24.04 NVIDIA image, has at least a 30 GB container disk, and has no persistent volume.
The runner injects a unique, ephemeral SSH public key into `PUBLIC_KEY` for every run and deletes
the private key locally afterward. An existing key can be selected with `--ssh-key` or
`RUNPOD_SSH_KEY` when a template does not support `PUBLIC_KEY`.

Check configuration and see live eligible capacity before spending anything:

```sh
npm run gpu:doctor
npm run gpu:list
```

Run the default end-to-end smoke. It installs the pinned repo dependencies, starts Xvfb, tries
hardware-capable Chromium backends, rejects software renderers, boots the actual game at
1280×720, and captures a PNG, WebM, browser logs, `nvidia-smi`, and JSON metadata:

```sh
npm run gpu:test
```

Results land under `reports/runpod-gpu/runs/<run-id>/`. Generated runs are intentionally ignored
by Git. Copy a deliberately selected artifact into a tracked evidence path only when a plan or
verdict requires it.

## Arbitrary visual tests

Pass one shell command. It runs from the snapshot root with `DISPLAY`,
`PLAYWRIGHT_BROWSERS_PATH`, `RUNPOD_ARTIFACT_DIR`, `RUNPOD_GPU_RUN_ID`, and
`RUNPOD_SOURCE_REVISION` set. Put every screenshot, video, trace, log, and result file under
`$RUNPOD_ARTIFACT_DIR`; the directory is retrieved even when the command fails.

```sh
npm run gpu:test -- \
  --command 'node tools/render/w1-30-live-proof.mjs --out "$RUNPOD_ARTIFACT_DIR/live-proof"'
```

The default snapshot is the exact current bytes (including uncommitted and untracked, non-ignored
files) under `game/`, `tools/`, `package.json`, and `play.sh`. This keeps the normal upload around
tens of megabytes instead of transferring the 705 MB reference-image corpus on every smoke.
Extend or replace that scope when a command needs more:

```sh
# Add plan-specific inputs to the exact worktree snapshot.
npm run gpu:test -- --include corpus/70-visual --include reports/w1-30 \
  --command 'node tools/render/w1-30-visual-populations.mjs'

# Test a committed revision instead of current worktree bytes.
npm run gpu:test -- --revision HEAD~1

# Build a deliberately narrow snapshot.
npm run gpu:test -- --only-path game --only-path tools/render \
  --command 'node tools/render/my-check.mjs'
```

## Cost and lifecycle safety

The committed policy is in `tools/runpod/config.json`:

- one on-demand (non-interruptible) GPU from an explicit allowlist;
- cheapest live one-GPU offer first, with the remaining allowed types as fallbacks;
- advertised and actual Pod price must both be at or below **$0.40/hour** by default;
- **20 minutes** maximum for the entire provision/install/test/retrieve lifecycle by default;
- absolute caps of $1.00/hour and 120 minutes, even if larger CLI values are supplied;
- 30 GB ephemeral container disk and `volumeInGb: 0`;
- Pod ID, GPU, cloud, hourly price, state transitions, command, and cleanup outcome in both the
  console and `lifecycle.log` / `run.json`.

Use lower per-run limits freely:

```sh
npm run gpu:test -- --max-price 0.25 --max-runtime 12
```

`SIGINT`, `SIGTERM`, command failure, timeout, transfer error, API exception, and normal success all
enter the same `finally` deletion path. A second signal forces immediate local exit and can leave a
Pod behind, as can `SIGKILL`, a dead Codespace, or a network partition during deletion. Recovery is
API-backed and restricted to this tool's name prefix and configured template:

```sh
npm run gpu:cleanup -- --dry-run
npm run gpu:cleanup
npm run gpu:cleanup -- --pod <pod-id>
```

Run cleanup before a new test after any crashed agent session. The command never targets manually
named Pods or Pods from a different known template.

## Agent invocation

For either Codex or Claude Code, the safe sequence is the same:

1. Run `npm run gpu:doctor` and stop before provisioning if it is red.
2. Run `npm run gpu:list`; do not widen the allowlist or ceiling merely to get capacity.
3. Make the test command write only to `$RUNPOD_ARTIFACT_DIR`.
4. Use `npm run gpu:test -- --command '…'` and wait for the final `Pod … terminated` line.
5. Inspect `run.json`, `worker-result.json`, and the hardware renderer string before using evidence.
6. If termination is not confirmed, immediately run `npm run gpu:cleanup -- --pod <pod-id>`.

The command can test an uncommitted Codex/Claude worktree; pushing a branch is not required. The
source metadata records the base commit, dirty state, selected paths, file count, archive size, and
SHA-256 so results cannot silently drift from the tested bytes.

## Template performance

The existing generic Ubuntu template is supported by `worker/bootstrap.sh`, which installs Node
22, the repo's pinned Playwright 1.56.1, Chromium, Xvfb, and required libraries on each ephemeral
Pod. That is the cleanest zero-infrastructure starting point but spends several minutes installing.

For repeated runs, build `tools/runpod/worker/Dockerfile`, push it to the owner's container
registry, and point a no-volume, 30 GB RunPod Pod template at it. The image extends RunPod's Ubuntu
24.04 CUDA base and preinstalls the browser stack while retaining RunPod's `/start.sh` SSH service.
Keep `RUNPOD_GPU_TEMPLATE_ID` on the generic template until the purpose-built image passes
`npm run gpu:test`; switching the environment variable is the complete rollback.

## Local self-test

The API client, price/capacity selection, no-retry create behavior, exact dirty-worktree archive,
and ephemeral SSH key generation have offline tests:

```sh
npm run gpu:selftest
```
