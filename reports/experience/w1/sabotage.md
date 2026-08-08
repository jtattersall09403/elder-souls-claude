# The sabotage control — W1-25, run at 0f5f456

Produced by `node tools/experience/sabotage.mjs --self-test --cases`. Exit 0.
The machine-readable form is `reports/experience/w1/sabotage.json`, which the repo
deliberately does not version (see `reports/.gitignore`); this file is the record.

```
SELF-TEST — six synthetic controls with known verdicts.
ok    synthetic.live                     OK               (wanted OK)
      breaking g moved n from 100 to 40 (0.6 vs required 0.5).
        (intact)                       value=100  support=10
        g                              value=40  support=10
ok    synthetic.inert                    INERT            (wanted INERT)
      the fully-broken arm produced the same n as the intact arm (100). Breaking g changed nothing, so this control never measured the thing it names — this is the W1-04 "both arms were the walls-on arm" shape.
        (intact)                       value=100  support=10
        g                              value=100  support=10
ok    synthetic.vacuous                  VACUOUS          (wanted VACUOUS)
      arm(s) g ranged over fewer than 1 unit(s) ((intact)=52, g=0). Whatever these arms did, they did it to an empty set — this is the W1-13 "the control contained zero people" shape, and no difference between an inhabited arm and an empty one is evidence about the mechanism.
        (intact)                       value=25  support=52
        g                              value=0  support=0
ok    synthetic.masked                   MASKED           (wanted MASKED)
      the number moves only when ALL of a + b are broken; every single-factor arm is byte-identical to intact. There are 2 guards here where the piece measured one, and each measures inert alone — this is the W1-SOULS "delete either and the number stays green" shape. The next agent deletes one in good faith.
        (intact)                       value=252  support=10
        a                              value=252  support=10
        b                              value=252  support=10
        a+b                            value=0  support=10
ok    synthetic.underpowered             UNDERPOWERED     (wanted UNDERPOWERED)
      the arms differ but by 0.04, under the declared margin of 0.5.
        (intact)                       value=100  support=10
        g                              value=96  support=10
ok    synthetic.wrong-direction          WRONG_DIRECTION  (wanted WRONG_DIRECTION)
      breaking it moved the number higher, and the control declared lower.
        (intact)                       value=100  support=10
        g                              value=180  support=10
PASS  6/6 controls behaved as declared.

SELF-TEST, FALSIFICATION HALF — break the facility on purpose; each break must go red.
  ok    --break=comparator  synthetic.inert -> OK
  ok    --break=support     synthetic.vacuous -> OK
  ok    --break=factorial   synthetic.masked -> OK

SELF-TEST PASS — 6/6 synthetic verdicts correct, 3/3 injected defects caught.

HISTORICAL REPLAY — three controls this tree shipped green, replayed from the artifacts.
ok    w1-04-collision.BROKEN (pre-fix verb, replayed from §0_goes_red) INERT            (wanted INERT)
      the fully-broken arm produced the same collision shapes in the settlement cell, per town as the intact arm ([67,94,60,72,67]). Breaking walls changed nothing, so this control never measured the thing it names — this is the W1-04 "both arms were the walls-on arm" shape.
        (intact)                       value=[67,94,60,72,67]  support=360
        walls                          value=[67,94,60,72,67]  support=360
ok    w1-04-collision.FIXED (shipped verb, replayed from §0_instrument) OK               (wanted OK)
      breaking walls moved collision shapes in the settlement cell, per town from [67,94,60,72,67] to [0,0,0,0,0].
        (intact)                       value=[67,94,60,72,67]  support=360
        walls                          value=[0,0,0,0,0]  support=360
ok    w1-souls-guards.AS-RUN identity alone (one-factor delete-the-fix) INERT            (wanted INERT)
      the fully-broken arm produced the same souls paid for the same six-body fight, day and night as the intact arm ({"day_1400":252,"night_2300":342}). Breaking identity changed nothing, so this control never measured the thing it names — this is the W1-04 "both arms were the walls-on arm" shape.
        (intact)                       value={"day_1400":252,"night_2300":342}  support=6
        identity                       value={"day_1400":252,"night_2300":342}  support=6
ok    w1-souls-guards.AS-RUN boundary alone (one-factor delete-the-fix) INERT            (wanted INERT)
      the fully-broken arm produced the same souls paid for the same six-body fight, day and night as the intact arm ({"day_1400":252,"night_2300":342}). Breaking boundary changed nothing, so this control never measured the thing it names — this is the W1-04 "both arms were the walls-on arm" shape.
        (intact)                       value={"day_1400":252,"night_2300":342}  support=6
        boundary                       value={"day_1400":252,"night_2300":342}  support=6
ok    w1-souls-guards.FACTORIAL 2x2 (what the facility does instead) MASKED           (wanted MASKED)
      the number moves only when ALL of identity + boundary are broken; every single-factor arm is byte-identical to intact. There are 2 guards here where the piece measured one, and each measures inert alone — this is the W1-SOULS "delete either and the number stays green" shape. The next agent deletes one in good faith.
        (intact)                       value={"day_1400":252,"night_2300":342}  support=6
        boundary                       value={"day_1400":252,"night_2300":342}  support=6
        identity                       value={"day_1400":252,"night_2300":342}  support=6
        identity+boundary              value={"day_1400":0,"night_2300":0}  support=6
ok    w1-13-r4.NIGHT-ROSTER at the hearth (the clause that set the score) VACUOUS          (wanted VACUOUS)
      arm(s) no_rest ranged over fewer than 1 unit(s) ((intact)=52, no_rest=0). Whatever these arms did, they did it to an empty set — this is the W1-13 "the control contained zero people" shape, and no difference between an inhabited arm and an empty one is evidence about the mechanism.
        (intact)                       value=25  support=52
        no_rest                        value=0  support=0
ok    w1-13-r4.NIGHT-ROSTER in the aggregation (roster {} in every arm) VACUOUS          (wanted VACUOUS)
      arm(s) (intact), no_rest ranged over fewer than 1 unit(s) ((intact)=0, no_rest=0). Whatever these arms did, they did it to an empty set — this is the W1-13 "the control contained zero people" shape, and no difference between an inhabited arm and an empty one is evidence about the mechanism.
        (intact)                       value=0  support=0
        no_rest                        value=0  support=0
ok    w1-13-r4.MERCHANTS-CLOSED — the sound clause from the same run OK               (wanted OK)
      breaking no_rest moved shops closed over the window from 71 to 0.
        (intact)                       value=71  support=115
        no_rest                        value=0  support=115
PASS  8/8 controls behaved as declared.

```
