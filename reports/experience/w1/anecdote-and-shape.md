# The anecdote instrument and the session shape — W1-25, at 9126e02

## What one recorded session leaves a player able to tell someone about
```
  read reports/sessions/exp-w1-opening/trace.jsonl: 36000 frames, 0 events

  36000 frames (10 simulated minutes) · 0 events
  candidate moments      0
  TELLABLE moments       0   (0/h — capacity, not recall)
  distinct shapes        0   
  distinct proper nouns  0
  class hints            {}
wrote reports/experience/w1/anecdote-trace.json
```

## RI-EXP02 §E, and the mandatory SAB-P control
```
content census — 2435 player-facing passages, 720 with an action-and-consequence shape and a name
  book         145 of 151
  dialogue     231 of 1279
  journal      344 of 1005
recall — ABSENT. No M3 artifact on the tree; `verified_anecdotes_per_hour` is unmeasured.
SAB-P — prose flattened: every journal entry, dialogue info and book passage replaced by
its own first sentence, from the same commit, by data filter. Nothing hand-authored.

  OK  breaking prose_flattened moved tellable passages in the shipped content from 720 to 153 (0.7875 vs required 0.5).
    (intact)             tellable=720  of 2435 passages
    prose_flattened      tellable=153  of 2435 passages
wrote reports/experience/w1/anecdote-verify.json
```

## RI-EXP03 §B, the activity histogram
```
event-histogram — 36000 frames (10 simulated minutes), 0 events
  A-EXP2: 0/10 names present in game/src/sim/events.js — missing book_read, barter_open, barter_close, menu_open, menu_close, craft, parley, crime_witnessed, travel_node, first_visit
  hour 0: H=0 bits  IDLE 1
  unclassified_fraction 1  -> VOID (hard fail 7)
wrote reports/experience/w1/event-histogram.json
```
