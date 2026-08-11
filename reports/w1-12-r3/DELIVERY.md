# W1-12 round 3 builder delivery

Commit stamp in the generated `ai-gate.json`; the committed instrument regenerates it.

## Production delta

Recovery now has bounded, turn-locked retreat locomotion. It unwinds forward attack root motion until the enemy clears `0.9*omega`; it does not cancel or shorten the authored clip, rotate the body, release the group token, or make another decision. The circling target moves from `1.6*omega` to `1.8*omega`, still within the native DANCE band (`1.25..2.2*omega`).

## Cheap-first results

* Cheap AI self-test remained discriminating: Souls 13/18, deliberately beeline control 2/18 with both native hard failures.
* Native stationary-player M3: 21/21 rows pass over seven shipped fighting statblocks at 1,800/3,600/5,400 f@60. Every row records numerator, denominator, dwell, variance, entropy, and the full state histogram.
* Delete control: removing recovery retreat worsens `inf_trash` dwell. Half/double perturbations produce different entity traces, demonstrating the live world-side consumer.
* Shipping browser path: rear and 1.5R controls remain blind; the alert ladder remains SUSPICIOUS before AGGRO; world trajectory changes under a preferred-band perturbation and restores when the model is restored. The browser path—not an assigned arena alert—was used for these perception/world claims.
* Moving fixtures retain separate stand/walk/jog/sprint/strafe/circle/back-away rows at four starting ranges and readings at 300/600/1,200/1,800 f@60. The 5.0 m/s player opens the gap. These rows are not substituted for stationary M3.
* Native heal trigger reaches PUNISH_READ in 12/12 trials for all seven fighters in the existing critic fixture. LONG_RECOVERY remains independently reported rather than substituted for heal.

## Critic entry point

Run cheap/static checks first:

```sh
node tools/combat/check-ai-units.mjs
node tools/harness/ai-probe.mjs --selftest
node tools/combat/w1-12-r3-ai-gate.mjs
```

Then enter through `orchestration/plans/W1-12.md` §3 and falsify the delivery with the existing moving, teardown, consumption, punish, and shipping-browser instruments. Independent RI-AI01 and RI-AI05 blind judgements remain critic/orchestrator work: the builder must not judge packs it builds.
