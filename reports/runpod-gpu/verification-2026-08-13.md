# RunPod GPU runner verification — 2026-08-13

The repository-local runner completed its default game/browser smoke on real RunPod hardware and
returned all requested artifacts before terminating the worker.

| Field | Verified value |
| --- | --- |
| Run | `20260813-105749Z-9265` |
| Source | `0dccba2aab3d957d36fb7df6195fdd94dee8e212` plus the declared dirty worktree |
| Source archive | 1,684 files, 14,459,130 bytes, SHA-256 `2e2aec1d849d7bd9ef222dcb0f3f584c2816993c5907a3525dc3f68e01abeca8` |
| Worker | Pod `qcq80dxsmtlwwp`, Community NVIDIA RTX A2000, driver 550.127.05, 6,138 MiB VRAM |
| Price | $0.12/hour |
| Lifecycle | 125.296 seconds; maximum estimated compute cost $0.004177 |
| Browser | Chromium 141.0.7390.37, WebGL 2.0 |
| Renderer | `ANGLE (NVIDIA, Vulkan 1.3.277 (NVIDIA NVIDIA RTX A2000 (0x00002531)), NVIDIA)` |
| Game | Harness v2 ready in 16,140 ms; no uncaught page errors |
| Cleanup | Delete returned success, follow-up Pod read returned 404, cleanup dry-run found no orphan |

The generated local run directory contains `run.json`, `lifecycle.log`, the worker result,
`nvidia-smi`, browser console, bootstrap and command logs, the screenshot, and a WebM. It remains
ignored at `reports/runpod-gpu/runs/20260813-105749Z-9265/` by repository policy.

The selected screenshot is
[`docs/shots/2026-08-13-runpod-gpu-browser-smoke.png`](../../docs/shots/2026-08-13-runpod-gpu-browser-smoke.png)
(SHA-256 `0915925620cb7e96b14001694cd464b18fd39cbd9b58d2fe3970a0c793e4aa09`). The
retrieved WebM SHA-256 is `ab544afd0129eb7034ec7c24967c4e599de040d80c6d9ba59a43c9c6327061c9`.

Two earlier diagnosis Pods could not accept SSH because the generic image does not start `sshd`.
Both were cancelled deliberately and deleted by the runner's signal/finally path. Supplying the
repo-owned SSH entrypoint at Pod creation resolved the template mismatch without requiring a
RunPod-side template change.
