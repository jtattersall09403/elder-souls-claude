# BAR-CRITIQUE-01 — is the corpus sufficient?

**Critic:** bar-critic, wave 0. **Date:** 2026-08-05.
**Scope:** all 64 reference items on disk across `10-combat`, `20-progression`, `30-quests`,
`40-dialogue`, `50-world`, `60-lore`, `70-visual`, `80-methods`, plus all of `00-doctrine`.
**Not on disk and therefore not judged:** `corpus/15-camera/`, `corpus/85-platform/`,
`corpus/86-ui/`, `corpus/87-audio/` — these directories do not exist. No RI-CAM*, RI-PLT*,
RI-UIX*, RI-AUD* file exists anywhere in the tree. Where this critique names those areas
as gaps, it is describing the state of the repository at the time of reading, not
pre-judging work in flight.

---

# 1. VERDICT: **INSUFFICIENT**

Not because the items are bad. They are, item for item, the best-specified game-design bars
I have seen: falsifiable, hostile to their own authors, and written with a `## How we lose`
section that reads like a post-mortem from the future. RI-CMB01's boolean-flag roll,
RI-AI05's health-sponge substitution, RI-DLG06's "voice = vocabulary swap", RI-LOR06's
"the critic flattens us" — these are the observations of people who have actually watched
projects die.

The corpus is insufficient for a different reason: **it measures the game's parts and never
the game.** Sixty-four items, two hundred subsystem paths, and not one of them observes a
person playing for an hour and asks whether anything happened. A build could score at or
above the bar on every item in this repository and be a joyless, competent, sterile thing —
and the corpus as constructed would have no instrument capable of noticing, no verdict
field to record it in, and no agent with standing to say it.

That is the headline. Below it sit twelve further gaps, nine bars I believe are actively
wrong or gameable, and a set of load-bearing thin spots where a whole pillar of the brief
rests on one item — or on an item that, because of a front-matter bug, currently judges
nothing at all.

---

# 2. The single biggest thing our bar cannot see

## The only agent that plays the game is constitutionally forbidden from having an opinion about it.

### 2.1 The argument

Read `COHERENCE-AGENT.md` §2 and §1 together. §2 commissions the single most valuable
activity in the entire process: **T1, the through-line run** — a fresh agent, fresh save,
plays from the opening location to the furthest content the wave produced, on foot, for
(per the schema example) ninety-six minutes, capturing a route log, screenshots at every
region entry, and the full journal exported verbatim. That is the only place in the whole
corpus where anyone experiences this game the way a player will.

Then §1 says:

> **Remit in one line: it fixes COHERENCE, never QUALITY.**
> The coherence agent may not re-score a piece, may not overturn a verdict, may not open or
> close a gap in the gap ledger, and may not raise or lower any per-piece score.

And its out-of-remit column reads, verbatim: *"A boss being unfun"*, *"A region's prose being
bad"*, *"A faction quest being shallow"*.

So: the one agent that plays the game start to finish is explicitly barred from saying it is
not fun. It refers those observations to per-piece critics — who never play the game, who
receive one subsystem path, who measure a 60-second combat trace or a 30-minute walk probe
or a static quest-file dump, and whose doctrine (CRITIC-DOCTRINE §1.1) *forbids* them from
judging anything they did not measure with an instrument. There is no instrument for "the
tenth hour was boring". CRITIC-DOCTRINE §2.1 rung 5 even names the hazard — *"ask what a
player notices in the first minute, then what they notice in the tenth hour; the tenth-hour
failure is almost always there and almost always unmeasured"* — and then hands the critic no
way to look at hour ten, because its assigned items all terminate inside a 60-second window.

The longest observation window anywhere in the corpus is RI-WLD08's ten-minute ambient-event
probe. The longest *play* window is RI-WLD01's 58-minute walk probe, which runs with **combat
disabled** and is scored purely on stopwatch and speed samples. Everything else is a trace, a
static dump, a screenshot at a fixed pose, or a simulation. RI-PRG06 predicts the player's
level at the end of each region *by simulation*, from a table of soul values, and never once
requires anyone to actually reach that level by playing.

### 2.2 Why this is fatal rather than merely incomplete

Both reference games are remembered as *sequences of experienced events*, not as
configurations of properties.

Nobody remembers Morrowind for its topic-graph out-degree. They remember: the boat, the
census office, the wizard falling out of the sky at Seyda Neen, Fargoth's ring, Caius Cosades
telling you to go join a guild and come back in twenty hours, the first time a Telvanni tower
appeared on the horizon, being told you are not the Nerevarine by someone who is right.

Nobody remembers Dark Souls for its i-frame count. They remember: the Asylum Demon dropping
through the ceiling, the first bonfire, the moment the Undead Burg lift opened onto Firelink,
the Taurus Demon, the archers on the buttress, Sif.

Every one of those is a *composed, timed, located event* — the intersection of five systems at
one moment. The corpus can verify that all five systems exist, that each is inside its band,
and that they do not contradict each other. It cannot verify that the intersection ever
happens. And a corpus of this quality creates enormous pressure to build to it: builders will
optimise the measured properties, because those are what get scored, and the unmeasured
composition — the *event* — is nobody's deliverable.

The concrete shape of the failure: **a game where every dial reads correct and nothing is
memorable.** RI-CMB07's fingerprint passes, RI-AI06's boss has eleven checks green,
RI-WLD02's TTNIT median is 41 s, RI-DLG02's Lilmoth has 21,000 unique words, and the honest
answer to "what happened in your first three hours?" is "I walked around a well-made swamp
and hit things correctly."

### 2.3 The proposal — an experience area with standing

Three parts. All buildable now, before any code exists.

**(a) A new area, `corpus/95-experience/`, and a new critic role, `critic.experience`.**
Add a `experience.*` root to `subsystems.json`:
`experience.opening.hook`, `experience.session.shape`, `experience.memory.moments`,
`experience.novelty.curve`, `experience.ending.landing`, `experience.difficulty.arc`.

**(b) A new doctrine file, `PLAYTHROUGH-CRITIC.md`,** modelled on `COHERENCE-AGENT.md` but
with the opposite remit: **it judges QUALITY, never COHERENCE.** It plays; it scores; its
verdicts enter the gap ledger like any other. It is a per-*piece* critic whose piece is
"the game". Conflict-of-interest and evidence rules from `CRITIC-DOCTRINE` apply unchanged —
its artifacts are session transcripts, timestamped route logs, screenshot sequences, and
its own recall protocol outputs.

**(c) Five reference items.** Sketched to the contract so someone can write them from here.

---

**`RI-EXP01` — The first sixty minutes.**
`kind: structure` · `side: neutral` · `judges: [experience.opening.hook]` ·
`provenance: canonical-recall` · `blind_pair: yes`

*The reference artifact:* two minute-by-minute beat sheets, laid side by side. **Morrowind,
Seyda Neen, 0–60 min**: released from the hold; a name and a face and a set of questions that
are also a class system; a census officer who wants paperwork; a package you are not allowed
to read; a town of nine people, one of whom is lying about a ring and one of whom is a tax
collector who will shortly be dead in a marsh; a wizard who falls out of the sky and leaves
you a pair of boots you cannot walk in; a giant flea that leaves at intervals. **Dark Souls,
Northern Undead Asylum + Firelink, 0–60 min**: a cell, a corpse with a key, a knight who
gives you a flask and tells you a prophecy he does not believe; a demon that drops through
the ceiling and cannot be beaten with the broken hilt you are holding; a corridor that
teaches the roll; the demon again, now beatable; a bird; a bonfire; three directions, two of
which will kill you.

*What the artifact encodes, per beat:* `t_min`, `who acts`, `what the player learns`,
`what verb is taught`, `is it given or found`, `is it explained`, `does it kill you`.

*Comparison method:* run a scripted-but-naive session (`--profile first-hour`, seeded, no
debug commands, no prior knowledge injected into the driving agent) for 60 simulated
minutes. Emit a beat log. Compute:
- **T-choice** — minutes to the first decision with two consequences that persist.
- **T-found** — minutes to the first content the player *discovered* rather than was handed.
- **T-death** — minutes to the first death.
- **V-taught** — distinct player verbs exercised at least twice (roll, block, parry, heal,
  ask, bribe, steal, pick, read, rest).
- **N-odd** — count of authored events with no explanation offered and no quest attached.
- **N-persons** — named NPCs with ≥3 topics and a stated opinion about another named NPC.

*Threshold:* `T-choice ≤ 12 min`, `T-found ≤ 15 min`, `T-death ≤ 25 min`, `V-taught ≥ 6`,
`N-odd ≥ 2`, `N-persons ≥ 4`. **Hard fail:** the first hour contains no death, or no
discovery, or the player is told what they are (a chosen one, the prophesied anything)
before minute 45.

---

**`RI-EXP02` — The anecdote census (the memorability instrument).**
`kind: text` · `judges: [experience.memory.moments]` · `blind_pair: yes`

*The bar:* a game is memorable if a player who has stopped playing can, without notes, tell
you specific stories. This is measurable with agents precisely because agents have a
context boundary you can enforce.

*Method:* (1) Agent A plays three 90-minute sessions and writes only a raw event log — no
commentary, no evaluation. (2) The log is discarded from context. (3) A **fresh** Agent B is
given only the *screenshots and the route log* (no journal, no design docs) and asked:
"Write down everything you can describe that happened, one line each. Then mark each line:
was this authored for you, or did it arise?" (4) Count **anecdotes**: entries of the form
"I did X and then Y happened" containing at least one specific proper noun and one
consequence. (5) Independently: hand Agent C the same set of anecdotes from our game and a
constructed reference set of 20 Morrowind/Souls anecdotes, unlabelled, and ask which set
came from a game people still talk about twenty years later.

*Threshold:* `anecdotes_per_hour ≥ 4`; `arose_fraction ≥ 0.25` (a quarter of memorable
events were not directly authored as beats); ≥ 3 anecdotes that no design document
predicted. **Hard fail:** `anecdotes_per_hour < 1.5` — three hours of play produced fewer
than five things worth saying out loud. This is exactly the "competent and dead" state the
rest of the corpus cannot see.

---

**`RI-EXP03` — Session shape.** `judges: [experience.session.shape]`
Bar: a 90-minute sitting must have an arc — an intention formed, an interruption, a
discovery that changes the intention, a risk taken, a resolution or a memorable failure, and
a reason to start the next session. Method: annotate three sessions against a six-beat
template; measure `beats_present`, `intention_changes`, `time_in_transit_fraction`,
`time_in_menus_fraction`, `unfinished_thread_at_stop`. Thresholds: ≥5 of 6 beats in ≥2 of 3
sessions; transit ≤ 0.30; menus ≤ 0.08; an unfinished thread present at every stop point.

---

**`RI-EXP04` — Novelty curve (the anti-front-loading instrument).**
`judges: [experience.novelty.curve]`
Bar: the rate at which the world shows the player something it has never shown before must
not collapse. Method: over a 12-hour instrumented playthrough, log every *first* encounter
with a distinct creature archetype, architecture vocabulary, strangeness element (RI-WLD05
list), enemy question (RI-AI05 roles), systemic rule, and faction. Bin by hour, compute
`first_time_events_per_hour` and its decay exponent. Thresholds: ≥ 1 first-time event per
40 minutes sustained through hour 10; decay from hour 1 to hour 10 no steeper than 3:1;
**hard fail** if any 90-minute window after hour 2 contains zero first-time events. This
item is also the direct fix for wrong-bar **W1** below.

---

**`RI-EXP05` — The ending, and the world after it.**
`judges: [experience.ending.landing]`
Bar: both the intended ending and RI-QST06's backpath must (a) be reachable, (b) change
world state visibly for at least 20 minutes of post-ending play or state a refusal in
fiction, (c) be *arguable* — the antagonist's case survives it. Method: complete both
routes; export final journal, world flags, and ten NPC reactions each; blind-present the
final conversation to a judge alongside a reference (Vivec/Dagoth Ur, Gwyn/the Kiln) and ask
which ending believes its own argument. **Hard fail:** the two endings differ only in a
final flag; or the antagonist is refuted by the game rather than by the player.

---

# 3. Ranked gaps

Ranked by how much worse the game gets if we ship without them. Rank 1 is §2 above and is
not repeated.

---

### Rank 2 — The Arbitration Rule is policed in one direction only. Nothing checks whether the seam is *too clean*.

**What's missing.** `AR-1` and `AR-2` are leakage detectors: they fire when Souls contaminates
the world or Morrowind contaminates the fight. Both are excellent and both are asymmetric.
There is no `AR-3`: the check that fires when the two halves of the game **do not touch at
all**.

Read the seam rulings as a set and you find eighteen decouplings. S13 locks dialogue out of
combat. S14 forbids the pause. RI-PRG07 makes it an **automatic AR-1 fail** if inventory
Burden affects the roll by any amount — *"all four multipliers exactly 1.00 in combat"*.
RI-PRG03 makes it an automatic fail if any skill is read during hit resolution. RI-CMB03
requires Fatigue and stamina to be two separate bars that never interact. Each ruling is
individually correct. Their sum is a membrane, and nobody has measured whether anything
crosses it.

**Why passing without it produces a worse game.** Because the best moments in both reference
games are membrane crossings. In Morrowind: levitating out of a fight; paralysing a guard;
talking a hostile Ordinator down; a Restore Health potion you brewed twenty hours ago
deciding a fight. In Dark Souls: luring a knight off a ledge; the plunging attack from the
ladder; opening a shortcut *because* you learned the level while dying in it. A game that
passes every item here can be two products stapled together — an out-of-fight RPG whose
eighteen hours of investment change nothing that happens in the ten seconds when it matters,
and a fight system whose outcome changes nothing about the world you return to. The corpus
guarantees the fight is Souls and the world is Morrowind. It does not guarantee they are the
same game.

**Proposal.**
- Area `corpus/95-experience/` (or a new `00-doctrine` amendment). **`RI-CMP01` — the
  cross-system payoff matrix.** `kind: structure`, `judges: [coherence.systems.composition,
  experience.session.shape]`.
  *Artifact:* an N×N matrix over the game's declared systems (combat, stamina, poise,
  equip-load, skills, attributes, disposition, faction rank, gold, alchemy, magic, stealth,
  crime, weather, tide, time-of-day, terrain), each cell marked `directed` /
  `emergent` / `none`, with the specific mechanism named for every non-`none` cell.
  *Comparison method:* every claimed cell must be demonstrated **in play**, in a trace or a
  transcript, not in a data file — the same evidence rule as CRITIC-DOCTRINE §1.2.
  *Threshold:* ≥ 35% of pairs non-`none`; **≥ 8 cells that cross the fight boundary in
  either direction** (an out-of-fight investment that changes a fight outcome, or a fight
  outcome that changes the world); every crossing cell demonstrated without violating AR-1
  or AR-2. **Hard fail:** fewer than 4 crossing cells — the two halves are bolted together.
- Amend `ARBITRATION.md` §3 with **AR-3 (seam sterility)**: *"Did the fight and the world
  fail to touch? A build in which no out-of-fight decision changes any in-fight outcome, and
  no in-fight outcome changes any world state beyond souls and corpses, has satisfied the
  letter of the Arbitration Rule and destroyed its purpose."*

---

### Rank 3 — The corpus has an anti-exploit monoculture. No bar defends the player's right to break the game.

**What's missing.** Count the hard fails aimed at player cleverness: RI-PRG03's Cost Gate
(*"any no-cost action grants progress → Morrowind's grind is shipped"*); RI-PRG05's flip
invariant (*"**any** profitable flip → automatic fail"*), farming ceiling, and un-buyables;
RI-PRG06's non-farmable bosses; RI-PRG08's no-respawn-farmable materials, no respec, no
reclaim, exact 84-material budget; RI-PRG01's no-respec and no-training-attributes;
RI-DLG04's non-retryable persuasion; RI-PRG04's unforgiving bloodstain; RI-AI05's anti-farm
ratio; RI-WLD07's bonfire scarcity. Ten-plus automatic fails, all pointing the same way.

Every one is defensible in isolation. Collectively they specify a game that **cannot be
broken**, and the corpus contains nothing pointing the other way — no bar that rewards a
system being generous enough to be abused, no budget for the player outsmarting the designer.

**Why passing without it produces a worse game.** Morrowind is a cult classic substantially
*because* it can be broken. The alchemy loop, the 100-point jump, the Boots of Blinding
Speed with a Resist Magicka trick, killing Vivec, the fact that you can murder the entire
main quest and the game shrugs and tells you the thread of prophecy is severed but "you may
still" — these are not bugs the community tolerated, they are the reason people still talk
about it. A world that permits stupidity is a world that feels *real* rather than
*administered*. Dark Souls has the same property at lower volume: soul farming, item
duplication in the sequels, poise stacking, the entire culture of "you're supposed to lose".

Ship this corpus as written and we produce a beautifully sealed system with no give in it —
the most common way a modern homage fails. The corpus is currently better at preventing the
failure modes of a live-service economy than at producing the texture of a 2002 single-player
RPG.

**Proposal.** **`RI-EXP06` — the permissiveness budget.**
`area: 95-experience` · `kind: structure` · `judges: [experience.permissiveness]` (new path) ·
`provenance: constructed` · `blind_pair: no`.
*Artifact:* an explicit register of **at least 12 sanctioned breakages** — combinations the
design knows are exploitable, deliberately does not close, and prices in fiction: e.g. a
spell effect that stacks, a merchant who can be robbed if you can survive the town, a
faction rank obtainable by murdering everyone above you, a route into a late region at level
4 that will kill you 40 times and then not, an ingredient combination that is silly, a
quest completable by killing the quest-giver.
*Comparison method:* for each register entry, a scripted probe must **succeed** in
performing the breakage. The register's entries are asserted as *working*, exactly the way
every other item asserts a mechanic works.
*Threshold:* ≥ 12 entries, ≥ 4 of them systemic (arising from two systems meeting rather
than from one lenient number), ≥ 2 that produce a permanent, unrecoverable world state.
**Hard fail:** zero sanctioned breakages, or every entry is a single tuned number rather than
a system interaction. **Cross-rule:** an item in `20-progression` may not add a new
anti-exploit hard fail without naming which register entry it does *not* close.

---

### Rank 4 — Magic does not exist in the taxonomy.

**What's missing.** `subsystems.json` contains exactly one magic path: `combat.magic.casting`,
and it is a **hole**. There is no path for spell*making*, enchanting, spell effects outside
combat (levitation, mark/recall, open, water-walking, telekinesis, intervention), magicka as
a resource, spell absorption, or magical items. There is no seam ruling in `ARBITRATION.md`
§2 for magic at all — S1–S18 do not mention it once. A builder handed "make the magic system"
today has no bar, no ruling, and no arbitration for the obvious collision (Souls-style
committed casting with FP inside the fight vs Morrowind's spellmaking and utility magic
outside it).

The corpus knows this and hasn't noticed. RI-WLD05's own reference table of Morrowind's
eighteen strangeness elements lists as item 13: *"Levitation and slowfall as normal, expected
traversal — **systemic**"*. RI-PRG03 gates *"which spells can be equipped at all"* on skills.
RI-PRG05 prices *"spells"* in the gold economy. RI-CMB08 forbids *"an instant heal usable in
combat"* and warns that alchemy leakage *"will arrive via the quest and economy work"*. Four
items depend on a magic system that has no path, no item, and no ruling.

**Why passing without it produces a worse game.** "Morrowind in almost every system" without
spellmaking and enchanting is Morrowind with its most distinctive system amputated. Custom
spellmaking is the single mechanism that turns Morrowind from an RPG into a toy box, and it
is the engine of almost every emergent story anyone tells about it. It is also, per rank 3,
the main source of sanctioned breakage. Without it, `progression.build.identity` (already a
hole) has almost nothing to be identified *by* except weapon class — which is precisely the
poverty RI-PRG02 says it exists to fix.

**Proposal.**
- **`ARBITRATION.md` amendment S19 — Magic.** Proposed ruling: **SPLIT.** *Inside the fight,
  Souls owns casting* — cast frames, animation commitment, a spell as a committed action with
  startup/active/recovery, a resource bar, no instant-cast escape, no pausing to swap. *Outside
  the fight, Morrowind owns magic entirely* — spellmaking with a cost formula, enchanting,
  utility effects that change traversal and quest resolution, magicka as a build resource, and
  the right to make something absurd. A spell created out of combat must be usable in combat
  under Souls' frame rules; a spell that trivialises the fight is a *tuning* failure, not a
  design failure, and is judged under RI-CMB frame data like any other move.
- **`RI-MAG01` — the spell effect catalogue and the spellmaking cost formula.**
  `kind: number`, `judges: [magic.effects.catalogue, magic.spellmaking.formula]`.
  *Artifact:* Morrowind's effect taxonomy transposed (restore/damage/fortify/drain, alteration
  utility, illusion social, mysticism transport, conjuration), with a cost formula in
  magnitude × duration × area × range. *Threshold:* ≥ 40 effects; ≥ 12 with a use outside the
  fight that changes traversal or quest resolution; a player-facing spellmaking UI that can
  produce a spell no designer authored; **hard fail** if every effect is a damage or heal
  effect, or if spellmaking is absent.
- **`RI-MAG02` — casting inside the fight.** `judges: [combat.magic.casting]`. Frame data per
  school, commitment probe, resource economy, and the AR-1 checks (no cast-cancel, no
  i-frames on cast, no instant utility escape).
- **`RI-MAG03` — enchanting and magical items.** `judges: [magic.enchant.economy,
  world.loot.placement]`. Scarcity, soul-gem-equivalent economy in *gold* not souls (S15),
  and the crossing into RI-PRG08's upgrade budget.

---

### Rank 5 — Nothing judges impact. The combat is specified to *measure* like Souls, not to *feel* like it.

**What's missing.** Fifteen combat items cover frames, hitboxes, stamina, poise, lock-on, AI,
bosses, encounters, healing — and not one covers what happens in the 120 ms after a sword
lands. There is no bar for hitstop, hit-reaction animation, camera shake, screen effects,
weapon trail, blood/impact VFX, or **any combat audio whatsoever**. The subsystem path
`combat.feedback.hitstop` ("Hitstop, impact vfx/sfx, damage legibility") exists and is mapped
in INDEX.md to exactly one item: **RI-MTH03, the blind-comparison protocol** — a methods
document about how to strip labels off a pack. That is not a bar. It is a hole with a
signpost pointing at it, which is worse than a hole, because CORPUS-CONTRACT §4 says a
builder must not start on a hole and this path does not read as one.

`audio.combat.impact`, `audio.music.policy` and `audio.voice.policy` are all holes.
`audio.ambience.region` — the fourth and last audio path — is judged by RI-WLD04, a world
item. There are four audio paths in a two-hundred-path taxonomy for a game whose combat
identity is substantially auditory.

**Why passing without it produces a worse game.** Souls combat feels the way it does because
of a synchronised bundle: 4–8 frames of hitstop scaled by weapon class, a hit-reaction that
moves the target's mass, a specific low-frequency thunk, and a parry that produces a metallic
ring you can hear before you can see the riposte prompt. Strip all of that and keep every
frame count in RI-CMB02 exactly — the result is a game that traces identically to Dark Souls
and feels like swinging a pool noodle at a mannequin. This is *the* classic failure of
Souls-likes and the corpus has no defence against it. It also silently destroys work that
*is* specified: RI-AI02's telegraph doctrine assumes the player can read an enemy windup at
gameplay distance, and RI-VIS08 D1's 40-pixel readability test is the only thing protecting
it — a visual item, in another area, that RI-VIS08 itself warns *"is skipped because it feels
pedantic"*.

**Proposal.**
- **`RI-CMB09` — impact, hitstop and the feedback bundle.** `kind: number`,
  `side: souls`, `judges: [combat.feedback.hitstop, combat.feedback.reaction]`,
  `blind_pair: yes`.
  *Artifact:* a per-weapon-class table of `hitstop_frames` (attacker and target, which may
  differ), `hit_reaction_clip`, `reaction_displacement_m`, `camera_shake_amplitude_deg` and
  `decay_frames`, `vfx_id`, `sfx_id`, `sfx_onset_offset_frames`, plus the four differentiated
  cases: normal hit, hit on a blocked guard, hit on hyperarmour, and the critical/riposte.
  *Comparison method:* from the existing combat trace plus a new `feedback` stream — for each
  damage event, assert simulation-frame advancement pauses or slows for exactly the declared
  frames; assert target root displacement is non-zero and scales monotonically with weapon
  class; assert `sfx_onset` within ±1 frame of `hit_active`; assert the four cases produce
  four *distinguishable* bundles (pairwise distance over the feature vector ≥ threshold).
  Blind pack: two 3-second video captures of the same swing, ours and a reference, at
  identical resolution, muted and unmuted, judge asked which one landed.
  *Threshold:* hitstop present on 100% of damage events, in the band 2–10 frames, monotone in
  weapon class; four distinguishable bundles; zero damage events with no audio; **hard fail**
  if hitstop is implemented in seconds rather than frames, if it is applied to the render
  loop rather than the simulation (which would break RI-MTH02), or if it is absent.
- **`RI-AUD01` — combat audio.** `judges: [audio.combat.impact]`. Distinct layers for
  swing / hit-flesh / hit-armour / block / parry / guard-break / stagger / death, per weapon
  material class; onset within one frame; audible above ambience; a parry ring that is
  identifiable with the screen off. **Hard fail:** one shared hit sound; or audio driven by
  animation events in the render loop.
- Until `RI-CMB09` exists, **remove RI-MTH03 from `combat.feedback.hitstop`'s judging list**
  so the path shows honestly as a hole and no builder starts on it.

---

### Rank 6 — The camera has one subsystem path and no reference item, against an eighteen-clause seam ruling.

**What's missing.** Seam **S18** — added by explicit user direction — is the longest ruling in
`ARBITRATION.md`, and it enumerates: over-the-shoulder orbital camera; spring-arm collision
and pull-in; lock-on framing that keeps both combatants in frame; soft-lock steering;
camera-relative movement with the character turning to face velocity; target-switch flick;
vertical clamp; auto-recentre-on-sprint; fixed-height pivot; third-person in exploration,
dialogue, menus and cutscenes; no first-person mode anywhere.

The taxonomy answers with one path, `combat.camera.behaviour`. Its judges are RI-CMB06 (whose
M5 "camera spring" is 15 of 100 weight, and covers spring vs snap, rate clamp and framing —
three of the eighteen clauses), RI-AI06 (one arena clause about the camera going inside a
large boss), and RI-MTH01 (the harness's `camera()` pose call, which is a measurement tool).
There is no path for the exploration camera, dialogue framing, interior collision behaviour,
FOV, motion sickness, or the third-person body being readable enough to time your own
recovery frames off — which S18 states is the *reason* the ruling exists.

**Why passing without it produces a worse game.** The camera is the single most common reason
a third-person browser game is unplayable. A spring arm that clips through mangrove roots and
boardwalk railings — which is 70% of this world's geometry — makes the game physically
unpleasant within ninety seconds, and no item in the corpus would record it. `corpus/15-camera/`
does not exist on disk; if RI-CAM* items are in flight elsewhere, this gap closes, but as the
repository stands the user's most explicit single instruction has less coverage than
`progression.crafting.alchemy`.

**Proposal.** A `camera.*` root with ≥ 6 paths (`camera.thirdperson.rig`,
`camera.collision.springarm`, `camera.lockon.framing`, `camera.explore.behaviour`,
`camera.dialogue.framing`, `camera.comfort`), and **`RI-CAM01` — the third-person rig**:
*artifact* a numeric rig table (pivot height, arm length, FOV, pitch clamp, yaw rate,
recentre delay, collision probe radius, pull-in curve, occlusion fade); *method* a scripted
traversal through the three worst geometries in the game (mangrove root cluster, interior
doorway ≤1.2 m, boardwalk with railing) recording per-frame `arm_length`, `player_occluded`,
`camera_penetrations`; *threshold* zero frames with the player mesh occluded > 6 consecutive
frames, zero geometry penetrations, arm-length derivative bounded (no pops), and — the
S18-specific check — the player's own recovery animation legible in ≥ 95% of combat frames.

---

### Rank 7 — Nobody audits the corpus. It has the exact incoherence it exists to prevent in the game.

**What's missing.** `COHERENCE-AGENT.md` exists because parallel agents building a game
produce seams. Sixty-four reference items were written by parallel agents. Nothing audits
them against each other. There is a `tools/corpus-index.mjs` that validates *front-matter
paths*, and it is currently reporting **19 errors and 34 holes** — but nothing validates the
*numbers*.

Concrete collisions found by reading, in twenty minutes, without tooling:

1. **Two definitions of "a minute of travel", differing by 70%.** RI-AI07 §A defines the
   traversal minute as *"one minute of movement along the critical path at reference walk
   speed **3.4 m·s⁻¹** (204 m per TM)"*. RI-WLD01 and ARBITRATION **S17** pin walk speed at
   **2.0 m/s** and forbid lowering it; RI-WLD02 computes at **120 m/min**. Every density,
   sightline and beat-structure number in RI-AI07 is therefore stated in units 70% larger
   than the units the world is built in. A critic measuring "enemies per traversal minute"
   will get a different answer depending on which item it read last.
2. **The enemy budget is over-committed.** RI-PRG06 fixes **576 hand-placed enemies** for the
   entire game and makes every soul value depend on it. RI-WLD07 requires **8 Souls-loop
   dungeons at 25–60 enemies each** = 200–480. That leaves as few as 96 enemies for 82 caves,
   160 settlement interiors, 13 regions and 14.5 km² of overworld — while RI-WLD02 **D9**
   demands *0.7–1.2 hostile groups per minute of wilderness road walking* on a road network
   whose longest path is 79 minutes. These cannot all be true.
3. **The authoring budget is unstated and enormous.** RI-DLG02 sets Balmora-class settlements
   at a floor derived from 38,760 unique words; `settlements.json` declares 8 named + 16 minor
   settlements, 269 named NPCs, 160 named interiors. RI-LOR03 wants ≥40 books at median ≥500
   words. RI-QST01 wants ≥24 quests per faction line; RI-QST07 wants ≥5.5×N side quests. Nobody
   has summed it. When the sum turns out to be several million words, the corpus's count
   thresholds become the *only* thing that gets satisfied, by the duplication that a dozen
   items individually warn about.

**Why passing without it produces a worse game.** Because contradictory bars are worse than
missing ones: a builder satisfies whichever it read, a critic fails work that satisfied the
other, and the gap ledger fills with gaps that are artefacts of the corpus rather than
defects in the game. And because an unaudited aggregate budget guarantees the specific
failure of *uniform thinning* — every count met, every count met by duplication.

**Proposal.** **`RI-MTH05` — corpus internal consistency**, plus a `CORPUS-COHERENCE-AGENT`
run before each wave (the mirror of `COHERENCE-AGENT.md`, pointed at the corpus).
*Artifact:* a machine-readable **shared-constants registry**,
`corpus/00-doctrine/constants.json` — walk speed, jog, sprint, world dimensions, crossing
time, enemy count, POI count, settlement counts, gold total, souls total, material count,
day length, rest-point count — each with exactly one owning item.
*Comparison method:* a script that greps every RI for numeric literals matching registry
keys and fails on divergence; plus an aggregate budget sheet summing every count threshold in
the corpus into totals for enemies, locations, interiors, NPCs, quests, words, and unique
assets, cross-checked against `settlements.json`/`regions.json`/`world-scale.json`.
*Threshold:* zero divergences from the registry; every aggregate total carries a named owner
and a stated feasibility argument; **hard fail** on any constant with two values in two items.

---

### Rank 8 — Stealth, crime and justice have no subsystem paths at all, and three items depend on them.

**What's missing.** `grep` of `subsystems.json` for `sneak`, `stealth`, `crime`, `bounty`,
`witness`, `pickpocket`: **zero hits.** Yet: RI-QST05 makes **sneak** and **steal** two of the
five load-bearing solution verbs and hard-fails if any verb has zero quests; RI-CMB05 §D
specifies a backstab sector and invulnerability frames, which presupposes an unaware state
that only a detection model can produce; `world.property.ownership` ("Owned things, theft,
witnesses, and consequence") is judged by **RI-QST08, an item about quest reward design**;
`world.locks.security` is judged by **RI-PRG03, an item about skill growth curves**.

**Why passing without it produces a worse game.** RI-QST05 names its own most likely failure —
*"Combat as the default because combat is what we built. Sneak has no detection model,
security has no lock model, so every 'alternative' degrades into a dialogue box"* — and then
the corpus makes that failure structurally certain by giving the builder no path to build
against and the critic no item to judge. The 30% pacifist floor will be met by speechcraft,
which is the item's own top-listed failure mode.

**Proposal.** A `stealth.*` root (`stealth.detection.model`, `stealth.sneak.movement`,
`stealth.theft.pickpocket`) and a `crime.*` root (`crime.witness.model`, `crime.bounty.economy`,
`crime.guard.response`, `crime.faction.consequence`).
**`RI-STL01` — the detection model:** artifact = per-NPC sight cone, light level response,
sound radius per movement mode, awareness ladder (unaware → suspicious → searching →
alerted → hostile) with dwell times; method = scripted approach probes at eight angles × four
light levels × three movement speeds, dumping the awareness state per frame; threshold = a
monotone, learnable relationship between light/sound/distance and detection, ≥3 distinguishable
awareness states observable from the NPC's animation alone, and a backstab reachable from
`unaware` only. **Hard fail:** detection is a distance check.
**`RI-CRM01` — crime and consequence:** artifact = the offence table (theft, trespass, assault,
murder) × witness class × faction, with bounty amounts in **gold** (S15), guard response, and
the paths out (pay, flee, fight, faction favour); threshold = every offence has ≥2 exits; a
witness-free crime produces no bounty; **hard fail:** a global omniscient bounty.

---

### Rank 9 — The player's verb list is smaller than the corpus assumes.

**What's missing.** There is no bar and no path for: **player ranged combat** (bows, thrown) —
yet RI-PRG05 prices *arrows* as a recurring gold sink and RI-AI05 populates the world with
ranged enemies the player can never answer in kind; **kick / guard-break as a player action** —
yet RI-AI05 §7 requires the TURTLE archetype to *"ship with its answer (guard break / kick /
charged heavy) already in the player's kit"*; **charged heavy attacks** (`combat.attack.charge`
is a hole, and RI-AI05 depends on it); **two-handing**; **jump and plunging attacks**; **fall
damage**; **item use in combat other than the flask**; **weapon/shield swapping**.

**Why passing without it produces a worse game.** The enemy roster is specified as *a set of
questions* (RI-AI05). Several of those questions have no answer in the player's kit, so the
roster degenerates to "walk up and R1" — which is exactly the flatness RI-AI05 exists to
prevent, arriving from the player's side where nobody is looking.

**Proposal.** **`RI-CMB10` — the player moveset contract.** `judges: [combat.attack.moveset,
combat.attack.charge, combat.weapon.identity]`. *Artifact:* the complete verb list with frame
data per verb per weapon class, and an explicit **answer matrix**: each RI-AI05 archetype × the
player verb that answers it, with the level/region at which that verb is first available.
*Threshold:* every archetype has ≥1 answer available before its first appearance; ≥9 distinct
verbs; a ranged option exists; **hard fail:** any archetype whose only answer is "out-range it",
or a verb priced in the economy (arrows) with no mechanic behind it.
Plus **`RI-CMB11` — weapon identity** (closing the `combat.weapon.identity` hole): the
blind test is "hand a critic three unlabelled 20-second traces from three weapon classes and
have it describe three different fighting styles."

---

### Rank 10 — Character creation, race and birthsign: no path, no item, and two items depend on them.

**What's missing.** No path for character creation, race, birthsign/equivalent, or starting
class. Yet RI-DLG01 §C states the player begins with *"exactly nine topics, granted at
character creation"*; RI-DLG04's disposition formula is built on a **race-relations matrix**
and its top failure mode is *"the Argonian-in-Black-Marsh premise of our setting pays
nothing"*; RI-PRG02's reason for existing is its six-distinct-characters axis, and
`progression.build.identity` is a **hole**.

**Why passing without it produces a worse game.** In a game set in Black Marsh, *what you are*
is the premise. An Argonian returning, a lukiul raised in Cyrodiil, an outsider — that choice
should reshape disposition, dialogue availability, faction access and half the game's tone
from minute one. Without a creation system it becomes a cosmetic dropdown, and the setting's
single sharpest dramatic lever is unpulled.

**Proposal.** `character.*` root; **`RI-CHR01` — origin, race and the opening questionnaire.**
*Artifact:* the origin table (≥6 origins with starting attribute/skill deltas, a starting
disposition modifier per faction and per race-pair, one unique starting topic, and one
permanently closed door); the birthsign-equivalent table (≥12, each a real mechanical
identity, at least 4 with a drawback). *Method:* run the first 20 minutes from three
different origins with the same seed and diff the transcript — dialogue offered, prices
quoted, greetings received, doors open. *Threshold:* ≥ 25% of the first-20-minute transcript
differs by origin; ≥ 3 topics origin-exclusive; **hard fail:** origin affects only starting
stats.

---

### Rank 11 — No opacity budget. Every bar pushes toward legibility; none protects mystery.

**What's missing.** RI-WLD06 requires ≥3 named landmarks visible from every settlement gate,
100% of junctions signposted with correct bearings, ≥9/10 quest destinations reachable from
journal prose. RI-DLG05 requires ≥7/10 direction tests reachable and calls unnavigable poetry
*"exactly as bad as a coordinate"*. RI-QST04 hard-fails any quest missing `directions`. All of
these are correct and necessary — markerlessness must be paid for.

But there is no counter-bar. Nothing in the corpus requires that **some** things are not
explained, not signposted, not findable except by accident, by paying attention to a
throwaway line, or by being wrong first. Nothing budgets for the player being lost. Morrowind
trusts and disrespects the player simultaneously — that duality is the texture the brief
names, and only one half of it is specified here.

**Why passing without it produces a worse game.** A world in which every destination is
reachable from prose, every junction is signed, and every quest carries directions is a
*legible* world — and legibility taken to 100% is a marker system implemented in text. The
corpus's own AR-2 check would not fire, because there is no arrow on screen. The feeling
would be gone anyway.

**Proposal.** **`RI-WLD09` — the opacity budget.** `judges: [world.wayfinding.directions,
experience.novelty.curve]`. *Artifact:* a register of deliberately opaque content: ≥ 15 things
that exist and are *not* signposted, *not* journal-directed, and *not* offered — findable only
by exploration, by an overheard line, by a book, or by being told by someone you had no reason
to talk to. Includes ≥ 3 locations reachable only by an unobvious route, ≥ 2 quests whose
solution requires knowledge the journal never records, and ≥ 5 places the world never mentions
at all. *Method:* a fresh agent with no design access plays 6 hours and its discovery log is
diffed against the register; separately, verify each entry is *not* named in any journal entry
or signpost. *Threshold:* ≥ 15 entries; ≥ 60% of the register undiscovered by a 6-hour
first-time player; ≥ 1 quest solvable only via a book. **Hard fail:** zero content outside the
signposted set; or any register entry that is merely hidden rather than *unexplained*.
**Cross-rule:** RI-WLD06's M29 destination test is scored **only over quest destinations**, and
may not be extended to the world's total location set.

---

### Rank 12 — Tone is checked for consistency and never for existence.

**What's missing.** `coherence.tone.crossregion` is judged by doctrine (COHERENCE-AGENT C1) and
asks whether registers are *consistent* region to region. RI-DLG06 measures whether archetypes
are *differentiated*. RI-LOR03 requires books that are bad on purpose. RI-VIS07 asks whether a
frame could be Skyrim. Nothing anywhere asks what this game's tone **is**, or whether it has
one, or whether it is ever funny, cruel, bathetic, or indifferent.

A build could be uniformly, competently earnest — every NPC differentiated, every register
consistent, every book contradicting another — and be tonally dead. Morrowind's texture is
that a world-ending prophecy and a man who lost his ring are delivered in the same flat
voice, that a god insults you, that a tax collector's corpse is a comedy and a tragedy in the
same quest, that the game does not care whether you are having a good time.

**Proposal.** **`RI-DLG08` — tonal range and the indifference ratio.**
*Artifact:* a tone rubric with 6 registers (deadpan, portentous, petty, cruel, absurd,
bureaucratic) and an exemplar set of 18 Morrowind lines, three per register.
*Method:* sample 60 random dialogue entries and 20 journal entries; a blind judge assigns each
to a register or `none`; compute distribution entropy. Separately compute the **indifference
ratio**: fraction of authored NPC content whose text does not reference the player, their
deeds, or their titles at all. Separately compute the **bathos count**: quests where the
stakes stated by the giver and the stakes revealed by the world differ by ≥2 tiers in either
direction. *Threshold:* ≥5 of 6 registers present at ≥5% each; entropy ≥ 2.0 bits;
indifference ratio 0.45–0.75 (a world that neither ignores you entirely nor performs for you);
bathos count ≥ 6. **Hard fail:** one register above 60% — the whole game speaks in one voice.

---

### Rank 13 — The platform budget is a hole, while "good for a browser game" is a banned defence.

**What's missing.** `platform.perf.framerate` and `platform.perf.memory` are holes.
CRITIC-DOCTRINE §2.4.3 makes *"good for a browser game" / "good for Three.js" / "reasonable
given scope"* **void-triggering** as a defence, with the caveat *"Platform limits are judged
only where a `platform.*` item explicitly sets the budget"* — and no such item exists.

**Why passing without it produces a worse game.** As the corpus stands there is no legitimate
way to trade fidelity against frame time. RI-VIS04 explicitly forbids the trade — *"'It runs
at 60fps though.' ... That is a legitimate engineering tradeoff and an illegitimate judging
one"* — and points at "a different axis with a different corpus area" that does not exist.
The predictable outcome: builders chase RI-VIS03's twelve metrics with no counterweight,
the game runs at 22 fps on a laptop, RI-CMB01's frame-exact roll becomes unmeasurable in a
real browser, and the first thing a human notices is the one thing nothing measures.

**Proposal.** **`RI-PLT01` — the frame budget.** `judges: [platform.perf.framerate,
platform.perf.memory]`. *Artifact:* a per-scenario budget table (fen exterior, settlement
interior, boss arena, 6-enemy encounter) × target hardware class, in ms per frame split by
CPU sim / CPU render / GPU, plus heap and GPU-memory ceilings and a 60-minute leak slope.
*Method:* real browser run, frame-time series, percentiles, long-task census.
*Threshold:* p50 ≤ 16.7 ms and **p99 ≤ 33 ms** in all four scenarios; zero frames > 100 ms
outside declared load boundaries; heap slope ≤ 2 MB/min over 60 minutes.
**Hard fail:** simulation frame rate coupled to render rate (which would void RI-MTH02 and
every combat item). Then amend CRITIC-DOCTRINE §2.4.3 to cite RI-PLT01 as the budget.

---

# 4. Wrong or gameable bars

Items I believe would push the build in the wrong direction, or would be satisfied by
something bad. Each with the specific change.

**W1 — RI-WLD05: "≥22 of the 30 strangeness elements encounterable in the first 30 minutes."**
This is the most consequential wrong threshold in the corpus. It mandates that 73% of the
world's entire novelty vocabulary is available within half an hour. Neither reference game
does this and both would fail it: Morrowind's Telvanni towers, Vivec, the Ghostfence, Dwemer
ruins and Sixth House shrines arrive over dozens of hours; Dark Souls' Anor Londo is hour ten.
A build that satisfies M24 has a *flat surprise curve* — every subsequent hour shows the
player recombinations of things they already saw. The item's stated intent ("strangeness as
hero assets only" is the failure it is guarding against) is right; the instrument is wrong,
because it fixes the guard to the opening rather than to the whole run.
**Change:** replace M24's threshold with a *distribution* requirement: **≤ 12 of 30 elements
encounterable in the first 30 minutes**, **≥ 26 of 30 encountered by hour 10**, and **no
90-minute window after hour 2 with zero first-time elements**. Keep M23's ≥6-instances rule
unchanged. Delegate the curve to the proposed RI-EXP04, and make RI-WLD05 cite it.

**W2 — RI-WLD02: TTNIT median ≤ 45 s, p90 ≤ 90 s, longest "nothing" stretch ≤ 150 s.**
These three together make sustained emptiness *illegal everywhere*. Vvardenfell is not
uniformly dense: Molag Amur, the deep Ashlands and Sheogorad are deliberately long, hostile
and empty, and that emptiness is where scale, dread and the relief of arrival come from.
A hard cap of 150 s on the longest nothing-stretch anywhere on the road network forbids the
Deep Marshes from being the Deep Marshes. It also invites exactly the POI-inflation M7 tries
to catch, because the cheapest way to satisfy a p90 is to sprinkle.
**Change:** make the density contract **per region**, not global. Add a **negative-space
requirement** as a peer of D1: *at least 12% of road-network kilometres must have TTNIT > 3
minutes, and at least two regions must have a median TTNIT > 2 minutes.* Keep D1/D2 as
**settled-region** thresholds. Reword the score-0 clause accordingly. Density is a rhythm,
and the current bar measures only its mean.

**W3 — RI-DLG07: `ours_win_rate ≥ 0.25` required for PASS; `< 0.15` = FAIL.**
This directly contradicts CORPUS-CONTRACT §6 and CRITIC-DOCTRINE §2.5, which state that a
blind pick landing on ours is *a signal to distrust the critic* and triggers a harsher re-run.
DLG07 makes winning a pass condition. It therefore rewards the outcome the doctrine treats as
evidence of a defective instrument, and it is self-administered (we build the pack, we choose
the excerpts, §A's "random selection" is on our honour). A team under pressure hits 0.25 by
tuning the pack, not the prose.
**Change:** score **indistinguishability**, not victory. Replace `ours_win_rate` with:
`tie_rate` in band, `judge_cannot_name_a_consistent_tell = true`, and
`professional_bet_accuracy ≤ 0.65` across ≥ 12 pairs — i.e. the judge, asked which set is
the 2002 shipped game, is barely better than chance. Keep every automatic fail. Add: if
`ours_win_rate > 0.5`, the run is **void** and the pack is rebuilt by a different agent —
matching §2.5 rather than contradicting it.

**W4 — RI-AI07's traversal minute (3.4 m/s, 204 m) vs ARBITRATION S17 / RI-WLD01 (2.0 m/s).**
Two authoritative definitions of the same unit, 70% apart. Every density, beat-structure,
runback and sightline number in RI-AI07 is stated in units the world is not built in.
**Change:** one owner. Recommend RI-AI07 amends to the **2.0 m/s / 120 m** traversal minute
and restates §D's bands accordingly (2.8 enemies/TM at 204 m becomes ~1.65 at 120 m — the
same physical density, correctly labelled), or, if AI07's numbers were tuned against the
Souls jog, it must declare `TM_souls` as a *distinct named unit* and every consumer must say
which one it means. Register the constant in the proposed `constants.json`.

**W5 — `combat.feedback.hitstop` mapped to RI-MTH03.**
A blind-comparison *protocol* is listed in INDEX.md as the judging item for combat impact.
This is worse than a hole: a hole stops a builder (CORPUS-CONTRACT §4); a false mapping tells
them to proceed and tells the critic it has a bar.
**Change:** remove `combat.feel` from RI-MTH03's `judges:` list. The path reverts to a hole
until RI-CMB09 exists. Audit the other `judges:` lists for the same pattern — RI-MTH03 also
claims `visual.fidelity`, `visual.artdirection`, `dialogue.prose` and `quests.structure`,
none of which a protocol document can bar.

**W6 — RI-QST05's PACIFIST-ALL ≥ 30% hard fail, with no stealth or crime system in the taxonomy.**
The item mandates a measurable pacifist fraction and names its own likeliest satisfaction —
"speechcraft solves everything" — as its top failure mode. With sneak and theft having no
subsystem path, no reference item and therefore no builder assignment, speechcraft is the
*only* buildable route to 30%. A threshold whose only reachable satisfaction is its own named
failure is gameable by construction.
**Change:** keep the threshold and make VERB-SPREAD ≤ 40% a **hard fail** rather than a band
condition, and make RI-QST05 formally *depend* on the proposed RI-STL01 and RI-CRM01 —
declaring in the item that if those systems are absent, PACIFIST-ALL is `unmeasurable` and
scores **0**, per CRITIC-DOCTRINE §7.3, rather than being satisfied by dialogue.

**W7 — Cross-area score scales are not comparable, and `pass_threshold: 6.0` is applied across them.**
`10-combat` uses weighted sums where 70/100 is "gap named, remediable" and <70 is "we lose".
`20-progression` uses **min over axes** where any axis below 6 fails. `70-visual` uses
`min(ART, FIDELITY)` with hard caps. `30-quests` uses bands. `50-world` uses 0–10 with
"WE LOSE" clauses. A "6" therefore means five different things, and SCORING.md §3 lets the
critic choose `mean` / `min` / `weighted-mean` per piece.
**Change:** SCORING.md §1.2 already sets native-band ceilings; make the mapping **mandatory
and tabulated per item** — each item's `## Scoring` section must state, in a fixed row, the
native score that maps to ladder 4, 6 and 8. Without that, the ladder is a translation nobody
can check and the aggregate progress number is noise.

**W8 — RI-AI05's "any trash enemy requiring > 20 light attacks to kill" hard fail.**
No fixture is pinned: weapon, upgrade level (+0 vs +10 is a 1.92× swing per RI-PRG08),
character level, or skill grade. Measured with a +10 weapon at level 60, every enemy passes.
**Change:** pin the measurement to a named fixture — `wave-standard-build`, `+0 weapon`,
`region-entry level from RI-PRG06 §5` — and state it in the check.

**W9 — RI-PRG07's "Burden clamped to exactly 1.00 inside COMBAT" as an automatic AR-1 fail.**
Not wrong under the Arbitration Rule as written, and I am not asking to overturn it. But it
is the corpus's clearest single instance of a rule that *forbids composition*, and it is
stated as an automatic fail, which is the strongest instrument available. It means the
player's most Morrowind-shaped decision — what am I carrying — is guaranteed to be irrelevant
to the fight, and it is the template other items will copy.
**Change:** no change to the ruling; add the counterweight. The proposed **AR-3** and
**RI-CMP01** must exist alongside it, so that "the seam is impermeable here" is a *local*
decision measured against a global requirement that it be permeable somewhere.

---

# 5. Load-bearing thin spots

Where a pillar of the brief rests on too little. Counts from `node tools/corpus-index.mjs`
and INDEX.md as generated 2026-08-05T22:58:12Z.

**5.1 The main quest — one item.** The user asked for *"Original main quest ... at Morrowind's
depth"*. `quests.mainline.prophecy`, `quests.mainline.acts` and `quests.mainline.antagonist`
are carried by **RI-QST06 alone** (2,765 words; LOR01/02/05/06 touch `mainline.prophecy` for
canon only). Combat has **15 items and 48 paths**. The single most-requested creative
deliverable in the brief has one item, no blind pack of its own beyond DLG07's generic one,
and no bar at all for its endings. **Remedy:** split QST06 into architecture, antagonist, and
endings; add the proposed RI-EXP05.

**5.2 Nineteen front-matter errors mean several items judge nothing.**
`RI-CMB08` (healing) declares four `judges:` paths — `combat.player.heal`,
`combat.resource.charges`, `progression.restsite.refill`, `combat.encounter.pacing` — and
**all four are unresolvable**. In INDEX.md, `combat.heal.charges` and `combat.death.corpserun`
are therefore judged by **RI-PRG04 only**; the 3,155-word item that actually specifies the
flask is invisible to the index and will not be handed to the critic who judges healing.
`RI-WLD08` (the living world — the corpus's single best liveness instrument) has **5 of 7
paths dead**, so `world.npc.population` is judged by RI-AI07 and RI-WLD03 and *not* by the
item about NPC schedules and ecology. `RI-LOR05` has **8 dead paths**, `RI-LOR06` has 2.
**The stated hole count of 34 is understated**, and the hand-off lists are wrong today.
**Remedy:** fix the front matter before any wave starts; make `corpus-index.mjs --check`
a blocking CI gate, which the INDEX header already asks for and nothing enforces.

**5.3 Whole systems judged by an item about something else.**
- `world.persistence.state` — "dropped, moved, and taken things stay that way" — judged by
  **RI-DLG03 (greetings and rumours)**.
- `world.property.ownership` — theft, witnesses, consequence — judged by **RI-QST08 (reward
  design)**.
- `world.locks.security` — judged by **RI-PRG03 (skills by use)**.
- `ui.hud.combat` — health/stamina legibility under pressure — judged by **RI-WLD06
  (navigation without markers)**.
- `progression.inventory.model` — judged by **RI-QST08**.
- `progression.crafting.alchemy` — the whole crafting loop — judged by **RI-PRG03**, one axis.
- `coherence.systems.composition` — judged by **RI-WLD05 (the strangeness bar)**, checks
  M22–M26, which are about weird objects.
Each of these is a system with a bar that was written to measure a different system.

**5.4 Audio: 4 paths, 3 holes, 1 judged by a world item.** For a game whose combat identity is
half auditory and whose region identity RI-WLD04 says is *"the single cheapest way to double
region legibility"*. RI-WLD06 additionally makes four audible landmarks (rock flutes, the
Hive's chord, the bell buoy, the Deep Marshes' silence) load-bearing for **navigation** — and
the item that would judge them does not exist.

**5.5 UI: 4 of 8 paths are holes**, including `ui.hud.minimalism`, which is the *enforcement
point* for AR-2/S8 (no markers). The most-cited arbitration rule in the corpus has no item
judging the surface it applies to.

**5.6 Lore: `lore.canon.argonian` is a hole.** Argonian culture, Hist, naming, biology,
outsider perception — in a game set in Black Marsh. RI-LOR01 covers the canon *registry* and
RI-LOR04 the phonology; nothing judges whether the Argonians are *written well*. Similarly
`lore.canon.geography` and `lore.book.unreliability` (the property RI-LOR03 and RI-LOR06 both
depend on) are holes.

**5.7 Combat holes cluster around player agency, not enemy design.** Of ten combat holes,
seven are player-side: cancel rules, roll recovery, stamina exhaustion, charge attacks,
weapon identity, lock-on switching, input latency. The enemy is specified to seven items'
depth; the player's own kit has gaps. This is the inverse of where a Souls-like usually fails
and suggests the AI author was thorough and the player-side author ran out of items.

---

# 6. What would have to be true for me to return SUFFICIENT

Checkable. This is the gate.

**G1.** `corpus/95-experience/` exists with a `critic.experience` role, a
`PLAYTHROUGH-CRITIC.md` doctrine that grants **scoring authority over quality across the whole
game**, and at least **RI-EXP01 (first hour)**, **RI-EXP02 (anecdote census)** and
**RI-EXP04 (novelty curve)** written to CORPUS-CONTRACT §2 with executable comparison methods.
An `experience.*` root exists in `subsystems.json`.

**G2.** `ARBITRATION.md` §3 carries **AR-3 (seam sterility)**, and **RI-CMP01 (cross-system
payoff matrix)** exists with a numeric floor on boundary-crossing interactions.

**G3.** **RI-EXP06 (permissiveness budget)** exists, with ≥12 registered sanctioned breakages
that are asserted to *work*; and no item in `20-progression` may add an anti-exploit hard fail
without naming a register entry it leaves open.

**G4.** Magic exists in the corpus: **ARBITRATION S19**, plus **RI-MAG01** (effects +
spellmaking) and **RI-MAG02** (casting in the fight) at minimum. `magic.*` paths exist and
`combat.magic.casting` is no longer a hole.

**G5.** **RI-CMB09 (impact/hitstop/feedback)** and **RI-AUD01 (combat audio)** exist, and
`combat.feedback.hitstop` no longer lists RI-MTH03 as its judge.

**G6.** A `camera.*` root with ≥6 paths exists and **RI-CAM01** covers the S18 clause list —
spring-arm collision, framing, recentre, clamp, and the own-body-legibility check — with
thresholds measured in the game's three worst geometries.

**G7.** `corpus/00-doctrine/constants.json` exists with a single owner per shared constant;
**RI-MTH05 (corpus internal consistency)** exists; the walk-speed / traversal-minute
contradiction (W4) is resolved by amendment; the enemy-budget contradiction (§3 rank 7 item 2)
is reconciled with an explicit arithmetic reconciliation recorded in one item; and an
aggregate content-budget sheet exists with a stated feasibility argument.

**G8.** `stealth.*` and `crime.*` roots exist with **RI-STL01** and **RI-CRM01**; RI-QST05 is
amended per W6 to score `unmeasurable → 0` if they are absent.

**G9.** **RI-CMB10 (player moveset contract with the archetype answer matrix)** and
**RI-CMB11 (weapon identity)** exist; `combat.attack.charge` and `combat.weapon.identity` are
no longer holes; the arrows priced in RI-PRG05 have a mechanic.

**G10.** `character.*` exists with **RI-CHR01**; `progression.build.identity` is no longer a
hole.

**G11.** **RI-WLD09 (opacity budget)** and **RI-DLG08 (tonal range and indifference ratio)**
exist.

**G12.** **RI-PLT01 (frame and memory budget)** exists and CRITIC-DOCTRINE §2.4.3 cites it,
so the fidelity/performance trade is judgeable rather than banned.

**G13.** The wrong bars W1, W2, W3, W4, W5, W6, W7, W8 are amended as specified (W9 is
satisfied by G2).

**G14.** `node tools/corpus-index.mjs` reports **0 front-matter errors**, and
`--check` is a blocking CI gate. The reported hole count is then honest; every remaining hole
is either filled or explicitly accepted in writing by the dimension owner with a reason.

**G15.** Every one of the user's stated requirements maps to ≥1 reference item. As of this
reading the following map to **zero**: magic/spellmaking/enchanting; character creation and
race; stealth; crime and justice; player ranged combat; hit impact and combat audio; the
camera beyond three lock-on clauses; the endings; the first hour; the shape of a session;
whether it is fun.

---

## Closing note

The people who wrote this corpus were not lazy and were not vague. They were thorough in
exactly the direction thoroughness is easiest to demonstrate: downward, into each subsystem,
with more checks and finer thresholds. Sixteen items have a `## How we lose` section listing
more than ten specific failure modes each. That is real work and most of it will hold.

What nobody did — because it is nobody's assignment, and because the process is structured to
prevent it — was step back and ask what the whole thing adds up to. The corpus contains an
agent whose entire job is to catch exactly that failure in the *game*, and it forbade that
agent from applying its own instrument to the *bar*. That is the shape of the blind spot, and
it is the shape of the fix: give something standing to play the game, and give something
standing to read the corpus as one document.

**INSUFFICIENT.** Fifteen gate conditions above. I expect to see this again.
