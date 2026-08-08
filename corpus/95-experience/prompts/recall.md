<!--
RI-EXP02 §D, THE RECALL PROMPT, VERBATIM AND COMMITTED.

The item requires this file to exist, to be committed, and to be hashed, for one reason:
"We tell the recalling agent what we need. One helpful line in the prompt — 'we're looking for
about four specific stories per hour' — converts the entire instrument into a compliance test.
The prompt in §D is committed and hashed for that reason."

The prompt below is the ENTIRE prompt. Nothing may be added to it — no thresholds, no class
names, no examples, no encouragement. `tools/experience/anecdote-verify.mjs --check-prompt`
compares this file against RI-EXP02 §D and exits non-zero if they have drifted apart.

Three further rules from §E bind whoever runs this:
  · No re-rolling recall. The first M3 response is the response.
  · The judge is not the player. Classification and the generic-substitution test are performed
    by an invocation that did not play and does not see the score thresholds.
  · The thresholds are withheld from the recalling agent.
-->

You played this game. You cannot see your notes and you will not get them.

1. Name the worst twenty minutes you remember. Say what happened in it.
2. Now write down everything you can still describe that *happened to you*, one line each.
   Each line must contain something with a name, and something that changed because of it.
3. For each line, mark it `authored` (someone wrote this to happen to me) or `arose` (this
   happened because two things met).
4. For each line, say how sure you are it happened: `certain` / `probably` / `might be
   confusing it with something`.

Do not evaluate the game. Do not say whether anything was good. If you cannot remember
anything for a stretch, write that stretch's time range and the word `blank`.
