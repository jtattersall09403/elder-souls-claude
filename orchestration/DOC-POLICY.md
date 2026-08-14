# How documents work here

**Owner, 2026-08-14 evening:** *"I want our repo to be nice and clean and clearly focused on what we
are now doing and that doesn't require every subagent to ingest a huge amount of context of the form
'this was what we were doing then we changed our mind then we decided to do x and then actually now
we're doing y'… you do need to preserve all the critical stuff that we have developed along the way
that is still critical."*

## The number that makes this urgent

**Measured 2026-08-14: the mandatory cold-start read path is ~145,000 tokens.** Every agent pays it
before doing anything. Three files are 110k of it — `orchestration/INDEX.md` (51k, **generated**),
`corpus/00-doctrine/ARBITRATION.md` (42k, with single table rows of **24,561 characters**), and
`orchestration/COST.md` (17k).

This is not tidiness. At the fleet's scale it is plausibly **the largest single cost lever in the
project**, larger than model routing. Treat a token saved on the read path as a token saved on every
agent, forever.

## The one rule that resolves the tension

Cleaning up pulls against the thing this project learned the hard way — that **superseded rulings left
standing with no pointer** cause agents to rebuild defects, and that documents making **false claims
about what the repo contains** misdirect work for days. Both were found on 2026-08-14, repeatedly.

The resolution:

> **Separate the instruction from the evidence for it.**
> The instruction is present tense, short, and on the read path.
> The evidence — forensics, superseded rulings, post-mortems, the history of how we got here — is
> preserved in full, and moved **off** the read path.

## The rules

1. **NOTHING IS DELETED. Things are relocated.** Move history to `orchestration/archive/`, and leave a
   one-line pointer where it was. Two reasons, and the second matters more: *"this is no longer
   relevant"* is itself a claim, and a false one destroys work; and a cleanup is exactly the moment
   somebody tidies away something load-bearing. Relocation is reversible in a way deletion is not.
   (Git history preserves everything regardless — but nobody reads git history to find a rule.)
2. **Operational documents are written in the present tense.** No "we used to", no "then we changed
   our mind". If a rule was superseded, the operational document states **only the rule that binds
   now**, with a pointer to the archive for anyone who needs to know why.
3. **Keep the visceral reason, one line.** *"Never run this recipe — it deleted 22,209 lines of
   finished work"* is obeyed. *"Never run this recipe"* gets re-derived by the next clever agent. One
   sentence of consequence stays inline; the full forensic goes to the archive.
4. **A document may not assert anything about the repo that is not checked.** Counts, "we have no X",
   "n=0", file inventories — either verify at write time or attribute and date the claim.
   `tools/check-citations.mjs` exists for this and runs in `pre-commit`.
5. **Generated files are fixed at the generator, never by hand.** `INDEX.md` says so at the top and it
   is true. If a generated file is too big, the generator is what changes.
6. **An index points; it does not contain.** The purpose of an index is to let an agent find the one
   thing it needs without reading the other ninety-nine.
7. **Every operational document names its owner and what it is for, in the first three lines**, so an
   agent can tell in five seconds whether to keep reading.

## The target shape

`CLAUDE.md` is the front door and stays short: the goal, the standing rules, and **pointers** to the
few documents an agent might need. From `CLAUDE.md`, any agent should reach what it needs in **at most
two hops**, without reading anything it does not need.

## The acceptance test for any cleanup

Both halves are required, and the second is the one that stops a cleanup doing harm:

1. **The measured cold-start read path is materially smaller.** Report before and after, in tokens.
2. **A named list of critical facts is still reachable within two hops of `CLAUDE.md`.** Write the
   list *before* cleaning, check it after. A cleanup that hits its token target and loses a hazard has
   failed, and it will fail silently unless something is checking.

A cleanup that reports only the token number has reported the easy half.
