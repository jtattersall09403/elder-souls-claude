# Q-MAIN-11 production navigation repair

The focused production trace begins the required `rev_the_rhythm` action at Helstrom's undertemple exterior (`2294.737, 2785.91`) and must reach the authored flooding-road mark at Soulrest (`639, 4891`). The previous straight-line input driver met solid world geometry after 10.3 m; `pre-road-navigation.json` records `aborted: stuck`, 1,800 consecutive stuck frames, and zero teleports.

The repair corrects the camera-relative horizontal-stick sign in both production fixed-step walkers, adds `walkPath({fromCurrent:true})` so a trace continues from the pose left by the previous world action rather than using the probe-only initial placement, and routes the quest runner along the authored road graph. Every travelled frame continues through `InputPipeline.queueInputs`, `loop.stepOnce`, and the shipped locomotion/collision/world consumers. The result rejects any discontinuity through `arrival_is_clean`.

Reproduce the bounded focused arm:

```sh
node tools/quests/mainline-chain-floor.mjs --signature-count 1 --out /tmp/w119-focused --timeout 900000
```

## Production continuation

`q1-q6-production.json` supersedes the earlier beeline checkpoint. It walks from a real Soulrest
quay pose, reaches the bootstrap speaker and both relocated Court posts through fixed-step input,
opens the Court-steps doorway with `interact`, dismisses the blocking conversation with the shipped
`block` input, walks to and interacts with the Drowned Tally prop, and exits through the inside face
of the same door. It completes Q-MAIN-01 through Q-MAIN-06 with zero teleport discontinuities. Its
bounded 2,500-frame leg then stops honestly on the still-incomplete Soulrest-to-Blackrose approach
for Q-MAIN-07; it is checkpoint evidence, not a Gate A completion claim.
