# Q-MAIN-11 production navigation repair

The focused production trace begins the required `rev_the_rhythm` action at Helstrom's undertemple exterior (`2294.737, 2785.91`) and must reach the authored flooding-road mark at Soulrest (`639, 4891`). The previous straight-line input driver met solid world geometry after 10.3 m; `pre-road-navigation.json` records `aborted: stuck`, 1,800 consecutive stuck frames, and zero teleports.

The repair corrects the camera-relative horizontal-stick sign in both production fixed-step walkers, adds `walkPath({fromCurrent:true})` so a trace continues from the pose left by the previous world action rather than using the probe-only initial placement, and routes the quest runner along the authored road graph. Every travelled frame continues through `InputPipeline.queueInputs`, `loop.stepOnce`, and the shipped locomotion/collision/world consumers. The result rejects any discontinuity through `arrival_is_clean`.

Reproduce the bounded focused arm:

```sh
node tools/quests/mainline-chain-floor.mjs --signature-count 1 --out /tmp/w119-focused --timeout 900000
```
