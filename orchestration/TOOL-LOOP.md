# Keeping the project's instruments real

> User direction: *"just make sure that our project has all the tools it needs… The critical thing
> is that our loop keeps running, no builder ever 'checks its own homework', and that our team
> continues to evaluate everything it builds against the high bars we have set."*

## The failure this exists to prevent

A reference item's `## Comparison method` names a command. If that command does not exist, the
item does not measure anything — but it still *scores*. Three bar critiques found the damage:

- **67 of the 82 tools named across 144 items did not exist on disk.**
- `W1-09` scored 4/10 three rounds running with three of its twelve bars unpassable by any build.
- `W1-07` could not reach its gate by arithmetic: 42 points needed, 30 attainable, because two
  items take `min-over-axes` across an axis blocked on a tool nobody had written.
- `RI-EXP01` had never been run on any build at all.
- `RI-JRN01` scored 0 for twenty grey frames and 0 for a rendered scene with two NPCs and
  dialogue better written than Morrowind's.

Four builders were charged for defects that were the corpus's. That is the cost of a phantom tool,
and it is paid silently — every one of those verdicts looked authoritative.

## Rule 1 — build the instrument when you need it

**Any agent, builder or critic, that finds a method naming a tool which does not exist writes that
tool then and there.** Do not skip the method. Do not substitute a piece-local probe with the same
name. Do not score the dimension zero and move on.

This is the fast path and it should handle most cases. Three constraints on it:

- **The item is the specification.** Build what the `## Comparison method` describes, not a simpler
  thing wearing its name.
- **A critic that writes a tool must say so in its verdict**, under `method_deviations`, naming the
  tool and what it now measures. A tool written mid-critique is still evidence, but the reader must
  know it was minted for the occasion.
- **A builder that writes a tool does not thereby get to grade itself with it.** The tool is
  infrastructure; the verdict is still a separate agent's with fresh context. See rule 3.

If the tool cannot be written honestly — because the system it measures does not exist — then
**write it so it reports the absence and exits non-zero with a reason.** Never stub it to pass.
`corpus_debt` exists for exactly this: a dimension blocked only by a missing system is debt against
the corpus, not a zero against the build.

## Rule 2 — the coverage sweep runs on its own

`node tools/corpus-index.mjs` emits a **C8** warning per phantom tool. It is a warning in wave 1 and
becomes a **hard error from wave 2**, so the debt cannot be carried indefinitely.

The orchestration tick checks the C8 count every half hour. When it is non-zero and no tool agent is
running, it dispatches the **tool builder** (`W1-TOOLS`), prioritised by how many items each tool
unblocks and how badly the block distorts a score — an axis feeding a `min-over-axes` item outranks
a standalone dimension, because one blocked axis pins the whole item at zero.

## Rule 3 — a separate critic checks the instruments

**The tool builder never verifies its own tools.** A **tool critic** with fresh context runs after
it and asks the questions a coverage count cannot:

1. **Does the tool measure what the item's method specifies**, or something adjacent that was
   easier to write?
2. **Can the tool fail?** Break the thing it measures on purpose and confirm it goes red. A probe
   that cannot fail is worse than no probe — several wave-1 probes passed against disconnected
   models, empty result lists and vacuous controls, and each one bought a false pass.
3. **Does it measure the running world or the design document?** A tool that reads `regions.json`
   and reports on regions is measuring the paperwork. `RI-MTH07` is binding here.
4. **Does it grant itself the thing under test?** Every magic probe in the tree, including two
   written by a critic, opened by setting all magic skills to 100 — which is exactly why a frozen
   skill register survived two rounds.
5. **Does every flag it advertises actually work?** `cmb-reach.mjs --verify` was asserted in two
   files and silently ignored. A flag that lies is worse than a missing flag.

The tool critic's verdict goes to `corpus/80-methods/TOOL-COVERAGE-Rn.md` and either lists the
tools that must be rebuilt — which sends the builder round again — or records **SATISFIED**. The
loop runs until a tool critic is satisfied, exactly as the build loop runs until a build critic is.

## Rule 4 — coverage is reported, not assumed

The C8 count appears on the Build status page. A verdict whose score depends on a tool written in
the same round says so. The point of all of this is that a number on that page means something,
and a phantom tool is the most efficient way to make a number mean nothing at all.
