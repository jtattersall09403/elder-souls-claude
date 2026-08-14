# gpu-transport-20260814 — stop `cleanup` killing other agents' Pods; make the GPU reachable

**Status:** job 1 landed; job 2 in progress
**Branch:** `codex/wave1-build-experiment`
**Task id:** `gpu-transport-20260814`

## Problem

Two things, from `reports/visual-truth/2026-08-14-visual-truth.md` §6.

1. **Destructive.** `node tools/runpod/cli.mjs cleanup` with no arguments terminated *every*
   managed Pod on the account. It killed `srd13nazorl0uc`, another agent's live Pod, mid-capture.
2. **Broken.** The GPU is unreachable. Pods provision fine (RTX A5000, API-confirmed `RUNNING`);
   the transport fails. Raw TCP is blocked, and the agent proxy's `CONNECT` re-terminates TLS while
   SSH is not TLS, so every session dies at `kex_exchange_identification`.

## What landed for job 1

Ownership is carried **in the RunPod resource name**, not in local state, so it survives a
container restart and every agent can see it: `elder-souls-gpu-o<8 hex>-<runId>`, where the slug
hashes `RUNPOD_OWNER`, else `CLAUDE_CODE_SESSION_ID`, else (weak, and it says so) the hostname.

| command | scope |
|---|---|
| `cleanup` | only Pods this agent created. Everything else is listed as PROTECTED and left alone. |
| `cleanup --pod <id>` | that Pod; refuses a foreign one without `--force` |
| `cleanup --older-than <min>` | sweeps Pods older than the absolute runtime cap, whoever owns them |
| `cleanup --all` | **refuses** and exits 3 when it would touch another agent's work |
| `cleanup --all --yes` | the old behaviour, now explicit |

The safe path is the one with no flags. Verified by mutation: replacing the ownership branch with
"terminate everything managed" turns three self-test arms red.

## Transport

`https://<podId>-<port>.proxy.runpod.net` is reachable through the agent proxy (HTTP/2, Cloudflare
404 for an unknown Pod), so the Pod runs a small HTTPS control agent (`worker/agent.py`, bearer
token, stdlib only) and the controller drives it with ordinary HTTPS. No SSH anywhere.

## files_claimed

- `tools/runpod/cli.mjs`
- `tools/runpod/lib/owner.mjs`
- `tools/runpod/lib/cleanup-plan.mjs`
- `tools/runpod/lib/lifecycle.mjs`
- `tools/runpod/lib/disk.mjs`
- `tools/runpod/lib/http-transport.mjs`
- `tools/runpod/lib/run-http.mjs`
- `tools/runpod/lib/selftest.mjs`
- `tools/runpod/worker/agent.py`
- `tools/runpod/config.json`
- `package.json` (gpu:* scripts only)
- `orchestration/status/GPU-TRANSPORT-20260814.md`
- `reports/runpod-gpu/TRANSPORT-20260814.md`

## Self-test

`node tools/runpod/cli.mjs selftest` — arms that disagree by construction, including a foreign Pod
refused and an owned Pod terminated by the same call.
