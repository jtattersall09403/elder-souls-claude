# W1-08 builder delivery — desktop keyboard and mouse

Candidate: current local commit (stamp after commit). This is builder evidence, not an independent verdict. JC-03N and every fresh/naive judgement row remain **NOT_RUN**.

## Shipping action ledger

All rows below use the real DOM device layer, fixed-step pipeline, and the world/UI consumer rather than treating profile JSON as proof. The bounded native sweep observed 16/16 primary routes, one edge under repeat, one-frame p100 latency over 200 events, and zero pipeline losses over 10,000 events.

| Player deed | Desktop primary / secondary | Semantics and shipping consumer |
|---|---|---|
| Move | W/S/A/D; arrows | held vector; traversal displaces the player |
| Look | locked mouse movement; click-drag fallback | accumulated linear deltas turn/clamp the rendered camera |
| Light attack | Mouse0 / F | discrete edge; combat player starts a light swing |
| Heavy attack | R / Mouse3 | discrete/charge path; combat player starts or charges a heavy swing |
| Roll | Space / Mouse4 | discrete edge; player enters roll commitment |
| Block | Mouse2 / Q | held; combat guard state and stamina consumption |
| Parry | Mouse1 / V | discrete edge; parry window is armed |
| Sprint | Left Shift | held with movement; traversal selects sprint speed/stamina use |
| Jump | X | discrete edge; traversal jump commitment |
| Interact / parley seam | E / Enter | discrete edge; world interactable/dialogue consumer commits |
| Use item | 1 | discrete edge; combat inventory consumer uses the quick item |
| Target lock | Tab / Mouse1 hold | discrete/hold gate; camera/combat target changes |
| Two-hand | G | discrete edge; live loadout stance changes |
| Swap right | 3 / wheel up | discrete edge; right quick slot changes |
| Swap left | 4 / wheel down | discrete edge; left quick slot changes |
| Menu / pause / back | Escape / M | pointer-lock loss opens the visible bindings/settings ledger; a second Escape closes it and requests lock again |
| Crouch | C / Z | discrete toggle; traversal stealth posture changes |
| Cycle spell | T / 2 | discrete edge; the attuned spell selection changes |

## Native desktop lifecycle and conflict ledger

| Path | Builder result / evidence |
|---|---|
| Layout portability | Physical `KeyboardEvent.code`; QWERTY/AZERTY/QWERTZ behaviour preserved while displayed labels come from the layout map. |
| Simultaneous input | The existing 2-key-rollover sprint/roll/attack path remains exercised; mouse buttons do not consume a keyboard matrix slot. |
| Repeat | Repeat keydown is rejected; one light action from a 120-frame hold. |
| Focus / blur / visibility | All held actions release within one fixed frame; no post-commitment displacement. |
| Pointer lock | Initial action gesture requests lock; loss releases inputs and opens a visible settings ledger; permanent failure retains click-drag look. |
| Mouse hazards | Context menu, scrolling, tab focus and browser navigation are suppressed on the game canvas. |
| Rebinding | The live `RebindModel.view()` is now painted into the composited canvas. Its localised labels, conflict owner, zero-binding refusal, reserved-control refusal and persisted live map are player-visible/doable rather than harness-only. |
| Rebinding modality seam | Keyboard, both shipped pad profiles, and touch each completed the shared surface in the native rebind check (4/4 checks overall). W1-29 mappings/lifecycle/touch layout were not replaced. |
| Mobile regression control | The touch group remained 5/5, including sixteen-action reachability, four simultaneous pointers, floating stick, two-second pad fade, and safe-area placement. |
| Render consumption | A live browser opening the keyboard ledger reported `open:true`, `rows_drawn:20`, 23 registered binding elements including furniture/message, and one rendered instruction entry for the settings-only message. Screenshot was inspected from `/tmp` and is intentionally not committed. |

## Independent rows deliberately left open

* JC-03N naive first-time-user protocol: **NOT_RUN** (builder independence).
* Native independent scoring and HF1–HF10 verdict: **NOT_RUN** (critic-owned; this document does not declare PASS).
* Fresh-browser-profile first-ever origin permission judgement: **NOT_RUN** by the builder; the critic launcher must use a fresh user-data directory.

## Exact critic entry point

From the repository root, start with the authoritative item and then run each stateful group separately:

```bash
node tools/harness/smoke.mjs
node tools/journey/input-checks.mjs --group desktop --out reports/journeys/critic-w1-08/desktop
node tools/journey/input-checks.mjs --group rebind --out reports/journeys/critic-w1-08/rebind
node tools/journey/input-checks.mjs --group viewport --out reports/journeys/critic-w1-08/viewport
node tools/journey/input-checks.mjs --self-test --out reports/journeys/critic-w1-08/self-test
node tools/journey/journey-run.mjs --journey jrn03-desktop --seed 4711 --profile desktop-1080p --input-mode real --layouts qwerty,azerty,qwertz --out reports/journeys/critic-w1-08/jrn03
```

Then dispatch isolated fleet role **JC-03N** exactly as `corpus/88-journeys/RI-JRN03-desktop-controls.md` specifies. Do not give that participant this report, the source, corpus, keymap, or prior screenshots.
