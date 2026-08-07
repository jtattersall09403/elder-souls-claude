# input-checks — raw output

`node tools/journey/input-checks.mjs --group <g> --out reports/journeys/input-checks/repo-<g>`

**Run one group per invocation.** They share a page: the touch group's reachability sweep presses
`interact` once per control, which opens a conversation, and `_conversationStep` then calls
`consumeUI(CENSUS_ACTIONS)` every frame — which zeroes `moveX/moveY`. A combined run reports a
working virtual stick as `[0,0]`.

| directory | group | result |
|---|---|---|
| `repo-desktop/` | `--group desktop` | 16/16 — RI-JRN03 M-K1..M-K24 |
| `repo-pad/` | `--group pad --self-test` | 16/16, and **5/5 instruments went red** under a perturbation of their own model |
| `repo-touch/` | `--group touch` | 5/5 — RI-JRN04 §G |
| `repo-viewport/` | `--group viewport` | 4/4 — RI-JRN04 §F |
| `repo-rebind/` | `--group rebind` | 4/4 — RI-JRN03 §E |
| `repo-shim/` | `--shim x2s-hid-dualsense --group pad` | 15/16 — the descriptor leg through `tools/journey/gamepad-shim.mjs`. `L6` fails only here: the shim's own pad sits at `getGamepads()[0]` alongside the two synthetic pads the check pushes, so its "both pads gone" step does not remove the third. Two instruments interacting, not a build behaviour — the same check passes in `repo-pad/`. |

Written by W1-08 / W1-29. A builder does not grade itself with a tool it wrote
(`orchestration/TOOL-LOOP.md` rule 1): these are evidence for a critic to re-run.
