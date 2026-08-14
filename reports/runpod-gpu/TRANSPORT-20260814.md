# The GPU is reachable — 2026-08-14

Two problems, from `reports/visual-truth/2026-08-14-visual-truth.md` §6. Both are fixed, and both
fixes are verified by something other than my own say-so.

---

## 1. `cleanup` was a fleet-wide kill switch. It is not any more.

`node tools/runpod/cli.mjs cleanup` with no arguments terminated **every** managed Pod on the
account. On 2026-08-14 it killed `srd13nazorl0uc`, another agent's live Pod, mid-capture.

**Correction, and it matters: the first version of this fix was insufficient and a sibling agent
caught it.** Ownership was scoped to a slug hashed from `CLAUDE_CODE_SESSION_ID`, which I asserted
distinguished agents. It does not — it identifies the **container**. At 10:11 a bare `cleanup`
terminated a sibling's live Pod *through* the guard, and the run.json record is unambiguous: four
runs started by different sibling agents (pids 16932, 2919, 12075, 4498) all carry the same slug
`e9b0d69d`. My self-test passed throughout because every arm *injected* distinct slugs; nothing
ever checked that two real sibling agents get different ones. The arms disagreed about the
classification logic and agreed, wrongly, about the identity source.

**So there are now two guards, because each covers the other's blind spot.**

| guard | separates | survives |
|---|---|---|
| owner tag in the RunPod resource name | containers, accounts, worktrees | container restarts |
| per-process claim in `/tmp` (`lib/claims.mjs`) | **sibling agents in one container** | not restarts — and pids are meaningless after one anyway |

A bare `cleanup` now reaps a Pod only when the process that claimed it is gone, or when it has no
claim at all *and* is past the 120-minute runtime cap. A Pod three minutes old with no claim is
protected, because in a shared container that is far more likely to be a sibling's live run than an
orphan. Claim liveness checks the pid **and** its recorded start time, so a recycled pid does not
read as live.

**The name mechanism, unchanged.** Ownership travels **in the RunPod resource name**, not in a
local file:

```
elder-souls-gpu-o<8 hex>-<runId>          e.g. elder-souls-gpu-oe9b0d69d-20260814-094028Z-30266
elder-souls-ephemeral-o<8 hex>-<runId>
```

Names were chosen over local state deliberately. The container has restarted twice in a day; a
lease file in `/tmp` would vanish exactly when orphan cleanup matters most, and one in the repo
would not be visible from a different worktree. A name on RunPod is visible to every agent,
survives everything, and needs no coordination. The slug hashes `RUNPOD_OWNER`, else
`CLAUDE_CODE_SESSION_ID`, else the hostname — and the hostname case is **reported as weak out
loud**, because every agent on this box shares one.

| command | what it may destroy |
|---|---|
| `cleanup` | only Pods this agent created. Everything else is printed as `PROTECTED` with the reason and the exact command that would remove it. |
| `cleanup --pod <id>` | that Pod. Refuses one owned by another agent unless `--force`. |
| `cleanup --older-than <min>` | Pods older than `<min>`, whoever owns them. Floored at the 120-minute absolute runtime cap, because no compliant run can still hold a Pod that old. This is the safe way to reap an orphan left by a dead agent. |
| `cleanup --all` | **refuses** and exits 3 when it would touch work this agent does not own. |
| `cleanup --all --yes` | the old behaviour, now something you have to ask for twice. |

The literal `o` in the owner segment exists because the old run IDs start with a date —
`20260814-...` is eight hex characters, and without a marker a legacy name would parse as a Pod
owned by agent `20260814`. There is a self-test arm for exactly that.

**Evidence both guards are load-bearing, not decorative.** Two mutations on a copy. Replacing the
ownership branch with "terminate everything managed" — the original behaviour — reddens three arms.
Separately, disabling only the live-claim check reddens
`cleanup/sibling-agent-live-pod-survives-despite-an-identical-owner-slug`, the arm that reproduces
the 10:11 incident exactly: same owner slug, live sibling pid, must survive.

**And the honest note on identity.** `RUNPOD_OWNER` is the only genuinely per-agent source. The CLI
now prints the *scope* of whatever it resolved (`agent`, `container`, `box`) rather than implying
the slug separates agents, because that implication is what made the second incident possible.

---

## 2. The transport: HTTPS works, SSH cannot, and the difference is not fixable

**What fails, and why it is not worth another hour.** Raw outbound TCP is blocked in this
container. The agent proxy will `CONNECT` to a Pod's SSH port, but `/root/.ccr/README.md` is
explicit that TLS is re-terminated at the egress proxy — and SSH is not TLS, so the tunnelled
session dies at `kex_exchange_identification: Connection closed by remote host`. That README also
lists what is *not* supported and will not be made to work: WebSocket upgrades, non-443 HTTPS
ports, raw-TCP databases. SSH to a Pod is in that family. No amount of client configuration changes
it, and the two obvious workarounds are both forbidden and were not attempted: a wildcard SSH
config changes behaviour for every other agent on this box, and disabling TLS verification or
unsetting `HTTPS_PROXY` is out of bounds.

**What works.** RunPod publishes every Pod's HTTP ports at
`https://<podId>-<port>.proxy.runpod.net`. That is ordinary TLS on 443 to a Cloudflare-fronted
host, exactly the shape the egress proxy is built to pass. The probe that settled it, before a
single Pod was rented:

```
$ curl -sS -D- https://abcdef1234-8888.proxy.runpod.net/
HTTP/1.1 200 Connection Established      <- the agent proxy accepted the CONNECT
HTTP/2 404                               <- Cloudflare, for a Pod that does not exist
server: cloudflare
```

A 404 for a nonexistent Pod is the whole answer: the host is allowed and TLS terminates cleanly.

**So the Pod is driven over HTTPS and never held open.** `tools/runpod/worker/agent.py` is a
Python-stdlib control agent baked into the container start command as base64, so it is listening
seconds after the container starts, before anything is installed. It exposes `/healthz`, `/exec`
(async job plus polling, because a request held open for the length of a render would be cut by an
intermediary), `/job`, `/upload` (8 MiB chunks), `/tar` and `/df`. The proxy URL is **public**, so
every route requires `Authorization: Bearer` against a per-run token compared in constant time, and
the agent refuses to start with a token under 32 characters.

### It was measured, twice, on real hardware

| | probe run | full run |
|---|---|---|
| Pod | `tecf37bs0iuzop` | `qau614kytem49r` |
| GPU | **NVIDIA RTX A4500**, driver 570.195.03, 20470 MiB | **NVIDIA RTX A5000**, driver 580.159.04, 24564 MiB |
| price | $0.25/hr | $0.27/hr |
| wall clock, start to Pod terminated | **57 s** | **2 m 51 s** |
| what it proved | transport, GPU, artefact retrieval | the game rendering on hardware GL |
| artefacts | 3 files | 11 files, including a 1280×720 frame and a video |

The full run's renderer string, reported by the browser on the Pod:

```
ANGLE (NVIDIA, Vulkan 1.4.312 (NVIDIA NVIDIA RTX A5000 (0x00002231)), NVIDIA)
```

**That is not SwiftShader.**
`docs/shots/2026-08-14-gpu-transport/2026-08-14-first-hardware-gpu-frame-rtx-a5000.png` is the
first frame of this game rendered on a real GPU — 1280×720, the Lilmoth spawn view, HUD and compass
present. The visual programme can stop labelling everything software-rendered, for anything it
takes this way. (`reports/runpod-gpu/runs/**/artifacts/` is gitignored like every other run
artifact directory, so the frame, the renderer JSON and the probe's `nvidia-smi` are copied into
`docs/shots/` where evidence is versioned.)

Both Pods and both ephemeral templates were terminated with deletion API-confirmed, and the account
was re-checked afterwards: zero live Pods, zero leftover ephemeral templates. Total spend for the
whole investigation is under five minutes of GPU time.

### Cost of a frame

The full path costs about three minutes of Pod time, of which roughly 45 seconds is the Node and
Playwright install. `--no-bootstrap` skips that when the command only needs to interrogate the GPU.
A capture campaign should take many shots inside one `--command` rather than paying provisioning
per frame.

---

## 3. A full disk can no longer look like a clean run

The box hit 100% on 2026-08-14 and captures were failing silently with `ENOSPC` until ~9 GB of
stale clones were cleared. A run that writes nothing looks exactly like a run that worked, which is
the worst shape a tool can have.

`tools/lib/browser.mjs` now checks free space in `launchGame` and dies loudly when it is short. All
247 harness tools reach the browser through that one function, so this is one edit rather than 247.
`ELDER_SOULS_MIN_FREE_MB` lowers the floor when a small run really is intended. The GPU runner has
the same guard before it rents anything, plus `writeFileLoud` and an ENOSPC classifier so a failed
write names the disk instead of vanishing into a best-effort `catch`.

---

## 4. What I could not do

- **SSH still does not work, and I am not claiming otherwise.** `--transport ssh` is kept for
  environments where raw TCP works; from this container it will fail exactly as before. That is a
  property of the egress policy, not a bug in the tool.
- **The RunPod proxy takes 40–90 seconds to start routing** after a Pod reports `RUNNING` (8 and 15
  poll attempts on the two runs). The controller retries, so it is only latency, but a run budget
  under about four minutes will not survive it.
- **No render campaign has been taken yet.** What is proven is one frame and one video from the
  smoke test. Pointing `vt-play.mjs`, `vt-seethrough.mjs` and `vt-world.mjs` at this transport — the
  many-angles, many-hours evidence directive §2 asks for — is the next piece of work and belongs to
  whoever owns the visual programme, not to this one.
- **I got the ownership model wrong the first time and shipped it.** It took a sibling agent losing
  a Pod to find it, which is the correct outcome for the project and a poor one for my own testing:
  the self-test never questioned its own premise. The claim layer closes it, but the general lesson
  is the one already in the directives — a green self-test is necessary and never sufficient, and an
  arm that fabricates its own fixtures cannot falsify an assumption baked into those fixtures.
- **Claims do not survive a container restart.** That is deliberate (pids are meaningless
  afterwards), and it is why the age floor exists as the backstop for unclaimed Pods.
- **This work was clobbered once mid-flight and had to be rewritten.** A concurrent agent's
  checkout removed `tools/runpod/lib/run-http.mjs`, the `launchGame` disk guard and the CLI's
  transport wiring from the worktree after they had been written and used for the two live runs;
  `git gc --prune=now` had already collected the staged blobs, so nothing was recoverable and the
  files were rewritten from source. Worth knowing because it is the same silent-clobber failure
  Ruling O1 names, and it will happen to somebody else.

---

## Reproducing any of this

```
node tools/runpod/cli.mjs selftest                      # 15 arms, no network, no spend
node tools/runpod/cli.mjs run --no-bootstrap --max-runtime 12 --only-path package.json \
  --command 'nvidia-smi > "$RUNPOD_ARTIFACT_DIR/nvidia-smi.txt" 2>&1'
node tools/runpod/cli.mjs run --max-runtime 35          # the full path, ending in a GPU frame
node tools/runpod/cli.mjs cleanup                       # safe by default
```

Run metadata, including the exact snapshot sha256 each Pod ran, is in
`reports/runpod-gpu/runs/*/run.json`.
