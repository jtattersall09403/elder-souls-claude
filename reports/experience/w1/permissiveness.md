# The permissiveness register — W1-25, at 9aeb839

## The register, generated from RI-EXP06 §B
```
RI-EXP06.probes.json  <- corpus/95-experience/RI-EXP06-permissiveness-budget.md
  15 entries · 15 live · 8 systemic · 2 permanent · 1 conditional
  40 assertions across 15 entries · 13 carry a "Red if" close clause
wrote corpus/95-experience/RI-EXP06.probes.json
```

## Every entry, run as a closure detector
```
breakage-probe — 15 of 15 register entries, static closure detection.
  live    B-01  Sys       The potion ladder (alchemy self-amplification)
  live    B-02  Sys       Fortify-skill stacking into a rank you have not earned
  live    B-03  Sys       The utility spell that skips a designed route
  live    B-04            Sequence break into a late region at level 1
  live    B-05      Perm  Killing someone important, early
  live    B-06      Perm  Robbing a merchant you can survive
  ABSENT  B-07            The movement scroll that kills you, used correctly
          substrate missing: the Scrolls of the Drowned Step (RI-EXP01 B09)
  live    B-08  Sys       Enchantment self-supply
  live    B-09  Sys       The disposition snowball
  ABSENT  B-10  Sys       Talking a boss out of the fight
          substrate missing: an enemy at boss tier for the parley to end
  live    B-11  Sys       Bringing a monster to a fight you did not want
  live    B-12            Selling the quest item
  live    B-13            The lock you should not be able to pick
  live    B-14  Sys       Reading the answer instead of earning it
  live    B-15            Standing where the boss cannot reach you

  ok   live_entries         15
  ok   probes_passing       13
  ok   systemic_passing     7
  ok   permanent_passing    2
  ok   regressions          0
  ok   probes_run           15
  regressions: 0
wrote reports/experience/w1/breakage-register.json
```

## The durability half, proved by injecting one closure in memory
```
  live    B-13            The lock you should not be able to pick
  live    B-14  Sys       Reading the answer instead of earning it
  live    B-15            Standing where the boss cannot reach you

  ok   live_entries         15
  BELOW probes_passing       12
  ok   systemic_passing     7
  ok   permanent_passing    2
  BELOW regressions          1
  ok   probes_run           15
  regressions: 1 — B-12
wrote reports/experience/w1/breakage-demo.json
```

## PB-RULE (RI-EXP06 §C), audited across the whole corpus
```
pbrule-audit — 145 reference items, scope: the whole corpus (PB-RULE has never been enforced, so this is the backlog)
  136 carry anti-exploit language in a scoring or threshold context
  0 carry a `preserves:` line
  136 PB-RULE violation(s)
    corpus/10-combat/RI-AI01-aggro-approach-spacing.md  (5 trigger line(s))  e.g. L? 
    corpus/10-combat/RI-AI02-telegraph-doctrine.md  (4 trigger line(s))  e.g. L? 
```
