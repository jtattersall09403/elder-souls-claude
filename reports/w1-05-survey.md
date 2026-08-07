# W1-05 — roads, signposts, and getting there without a marker

**Piece:** `docs/PLAN.md` §3 W1-05. **Seams:** S35 (supersedes S30), S28, S17. **Rules:** `RI-MTH07`
CONSUMPTION, AR-2.
**Status of this document:** builder's survey and working notes. I do not grade this piece.

---

## 0. What changed under this piece halfway through, and what it cost

My predecessor was told there was no map at all — seam **S30**, *"there is nowhere to put a pin"* —
and wrote to that. The project's owner **overruled S30 and replaced it with S35**: there *is* a map,
and it is a record of ground the player has already walked. No marker, no route line, no "show on
map", no distance readout, no travel by clicking, and no square for a place nobody has stood in.

**Nothing in this piece was wasted, and the reason is in S35's own text:** a map that shows only
where you have already been cannot get you anywhere new. Wayfinding still has to work with the map
shut, so the signposts, the spoken directions and the steer-by landmarks are exactly what they were.
What changed is the *framing*, and four comments that asserted no map exists have been corrected.
The map itself and the `RI-UIX04` JU8 amendment belong to another builder and are not touched here.

---

## 1. What existed before this piece

| Layer | Before | Now |
|---|---|---|
| **L1 — the road** | `roads.json`: 10 legs, 25,056.9 m of trunk, built and drawn | unchanged (one id fix, §4) |
| **L2 — signposts** | **nothing.** Zero posts anywhere in the repo | 32 posts, 68 arms, drawn and readable |
| **L3 — spoken directions** | 32 `q.directions` strings, quest-gated only | + 20 routes / 46 answers, ungated |
| **waystations** | 9 in `roads.json`, read by **tools only** | 9 of them now carry a post, and a lamp |
| **night on the road** | **nothing lit** within 160 m of either named route, over 6.8 km and 12.4 km | 12 lit posts; 61 % of the crossing, 62 % of the long way |

Three things were orphan data before this piece and are not now: the waystations, the signpost layer
(which did not exist), and `road-directions.json` (§3).

---

## 2. Consumption — the rule this project has failed twelve times

`RI-MTH07` asks for the world-side consumer by name and for a perturbation that moves behaviour.

| Model | World-side consumer | Perturbation that moves the world |
|---|---|---|
| `world/signposts.json` | `field.setSignposts` → `province.js#_signposts` (drawn per tile), `Engine.signRead()` (read through the ordinary `interact` reach) | move a post and the mesh moves; edit an arm and the drawn panel changes |
| `dialogue/road-directions.json` | `topic-supply.js#RoadBook` → `engine.js#_installTopicSupply.roadsFor` → `converse.js` `extra` → spoken verbatim | edit an answer's `x` and one named person in one named town says something different |
| `dialogue/topics/60-roads.json` | the ordinary topic index (`converse.js#infoFor`) | delete a topic and the road keyword stops resolving |
| `roads.json` waystations | 9 waystation signposts | — |
| `signposts[].lamp` (the waylamp) | `province.js#_signposts` draws a `waylamp:<id>` emissive; `province.js#updateSignatureLights` puts a real `PointLight` of the post's colour at the post, pooled into the existing two-light budget | `tools/world/waylamp-probe.mjs` C5: strip `lamp` off `field.signs` and the light at the post goes out |

### The hole this piece actually found

`game/data/dialogue/road-directions.json` — 23 KB, 20 routes, 46 authored answers — **was not in
`game/data/index.json` at all.** It was never fetched. No code path could reach it. It is now
indexed, has its own engine load branch, and is read.

That is the twelfth instance of the same failure, and it is worth naming the shape precisely,
because it is not "somebody forgot to write a reader":

> **The file was well-formed, schema-tagged, provenance-stamped, and completely inert.** Every
> check in the tree passed with it on disk. `check-data` counts indexed files, so a file that is
> not indexed is not a file it can miss.

A second, subtler one came out of the same work: the 8 topic ids `road-directions.json` used —
`the road to Gideon` and its siblings — **did not exist in `dialogue/topics/`**. All 20 routes would
have failed audit check D. They exist now (`60-roads.json`), and they fold to the same keys through
`core/topics.js`. Two `to:` edges I wrote in that new file were *themselves* dangling on first
draft and were caught by checking rather than by assuming. The defect class is fractal.

**And one the journey probe found that no static check could:** four NPCs standing in Soulrest
offered **zero** road topics, because `RoadBook.settlementOf` read only `npc.settlement`, which an
NPC instantiated from a state file often does not carry. `rumourFor` already fell back to
`sim.env.settlement`; `roadsFor` now does too. In node the model read perfectly. In the game nobody
said anything. That is exactly the gap between "the data is right" and "the world does it".

---

## 3. The three wayfinding layers, as built

### L2 — the posts

32 posts, 68 arms: 3 junction (Helstrom, Archon, Blackrose — every node of degree ≥ 3), 20 approach,
9 waystation. Four styles, and they are not decoration: `painted-board` (15), `knife-marks` (11),
`milestone` (2), `tide-pole` (4). **11 posts are glyph-only** — root-glyph cut into wood or clay,
with no numerals — because a province where every sign is a legible Imperial milepost is a province
the Legion finished conquering.

Distances are shown on Legion mileposts and on nothing else, which is the same rule Morrowind's own
signage follows and is why the Helstrom legionary's answer can promise a number and the villager's
cannot.

### L3 — what people say

20 directed routes (`helstrom-to-gideon` is not the same sentence as `gideon-to-helstrom`), 46
answers keyed to 15 speaker archetypes, every one of which some NPC in `game/data/npcs/` actually
is. **20 true, 22 vague, 4 wrong.**

The 22 vague ones are the point as much as the true ones — real directions from real people mostly
are vague, and *"where the ground goes hard and stays hard, and once it is hard you just keep on it,
because it does not go anywhere else"* is followable without being precise.

**On the four wrong ones.** `RI-JRN07` U4: a world where everyone is honest is not this world. But a
lie nobody can catch is not a feature, it is a defect, so every wrong answer carries `tell` (what in
the world contradicts it, in plain English) and `tell_ids` (the specific posts, waystations, legs or
regions a careful player can go and check). The Helstrom innkeeper sends you south to Gideon;
Gideon is west; the Helstrom junction post has four arms and one of them says so, and the Gideon
road is the only road out of Helstrom signed on Legion mileposts. `signpost-audit.mjs` check E
resolves every one of those ids and fails if one dangles.

### The prose bar — and the reason it was not being applied to this file at all

`tools/check-prose.mjs` is the gate the blind judge's verdict produced: a questions floor, an
exclamation band, a sting cap, an And-opener band, a contraction band, and a tic list, every bar a
multiple of the *measured* Morrowind rate. I ran it on this piece's output. **It printed the whole
corpus and not one word about `road-directions.json`.**

The reason is worth writing down because it is the same defect class as everything else in this
report. `ourText()` walks `game/data/dialogue` and knows seven shapes — `topics[].infos[].x`,
greetings, pools, lines, race-gated, nodes, rumours. `road-directions.json` keeps its lines at
**`routes[].answers[].x`**, a shape it did not know. The tool's own comment says a new dialogue
shape should "show up as a file with zero lines rather than as a silently-passing file"; this was
worse than that — 46 spoken lines and 2,032 words did not show up as a *file*. One additive line in
the collector fixed it (`--self-test` still passes both directions). `answers[].tell` is authoring
metadata that is never spoken to anybody and is deliberately left unmeasured.

Once the gate could see the file, it failed **five bars**. After the pass:

| per 10k | before | after | Morrowind |
|---|---|---|---|
| questions | 4.9 | **76.6** | 159.2 |
| exclamations | 0.0 | **15.3** | 21.3 |
| **sting** (the closing punchline) | 24.6 | **0.00** | 3.4 |
| And/But/So openers | 9.8 | **25.5** | 64.0 |
| contractions | 0.0 | **296.1** | 292.3 |
| `"that is what/why/all"` tics | 3 | **0** | — |

`topics/60-roads.json` went the same way (questions 0.0 → 70.3, sting 24.0 → 0.00). Corpus-wide
dialogue moved with them: questions 31.99 → 41.08, sting 25.71 → 16.55, contractions 182.7 → 198.6.

**The instruction the rewrite actually followed was the judge's one-liner: *a directions line should
give directions*.** So the punchlines did not become blander sentences — where possible they became
navigation. The coast road's closer used to be a joke about the wind:

> *"Boards on whalebone posts, all of them leaning the same way, which is the way the wind has been
> going since the first post went in."*

and is now a steer you can use:

> *"The posts are whalebone with boards nailed on, and they all lean the same way — inland, off the
> water. If they're leaning at you, you've turned round."*

Likewise the questions are not decoration for a metric. They are the thing the judge said was
missing — *nobody in our world asks the player anything* — and in a directions file they are the
questions a person giving directions actually asks: *Can you read a number? How much water are you
carrying? Are you going now or in the morning? Did you look at the poles?*

---

## 4. What the audit found — `tools/world/signpost-audit.mjs`

Nine checks. A–G and I fail the run; H reports a number this piece does not own the data for.

**Every one of A–F was proven falsifiable** by breaking the thing it measures on purpose — an arm
named `Vivec`, a bearing turned 180°, a leg `helstrom-vivec`, an invented topic, a `tell_id` naming
nothing, an actor `dwemer-centurion` — and confirming the tool went red and exited 1, then restored
clean. A probe that cannot fail is worse than no probe.

### G found a real one

`roads.json` `named_routes.long_way` named **two legs that do not exist**: `thorn-stormhold` and
`blackrose-soulrest` (the real ids are `stormhold-thorn` and `soulrest-blackrose`). `build-roads.mjs`
*composed* leg ids from the order the route walks its settlements instead of *resolving* them, so any
leg authored in the opposite direction produced a dangling id.

Nothing broke at boot, and that is the interesting part: `Engine.walkRoute()` resolves legs by
**settlement pair** and never reads the `legs` array at all, so the field sat there being wrong with
no symptom. `build-hearths.mjs` *does* walk `named_routes.crossing.legs` by id, and escaped only
because the crossing happens to be authored in its walking direction. **A field that is right by
luck is a trap set for whoever reads it next** — it is what broke my own first measurement. Generator
fixed to resolve, both ids corrected, check added.

### I found that the prose half of this piece's own rule had never been checked

Check A stops a **signpost** naming somewhere that does not exist. Nothing stopped a **sentence**
doing it — and the sentences name far more places than the posts do: *Rootway Post*,
*Ceyatatar-Zel*, *Tenmarch Bridge*, *Mudwater Landing*, *Nine-Mud*, *Xal-Ithix*, *Bone Ladder*, *the
Leaning Stone*. `road-directions.json`'s own note has always **claimed** that every place named in
it is a record in `pois.json`. Until check I, that claim was an assertion in a comment.

It is worse in prose than on a post, too: a player who walks twenty minutes looking for Tenmarch
Bridge and finds no bridge stops believing the *next* set of directions as well.

All 46 answers pass. **Building the check found two bugs in the check and one in the prose**, and the
two in the check are the more useful pair:

1. The alias generator derived short forms from the raw name, so `Fired-Cold Well (Archon–Thorn)`
   yielded `Fired-Cold Well` and never `Fired-Cold` — a **failure on a name that does exist**, which
   is exactly the false positive that gets a checker switched off.
2. The first version skipped any capitalised run at the **start** of a sentence. So
   *"Past Vivec Bridge, over the two bridges"* passed — **and so did the falsification test I wrote
   to prove the check works**, because the lie I planted to break it landed in the blind spot. A
   probe that cannot fail is worse than no probe, and mine could not fail in precisely the place I
   was aiming it. Now only single-word sentence openers are skipped, and the same planted lie gives
   `FAIL [I] … names "Past Vivec Bridge"`, exit 1, restored clean.

And one in the prose, mine, from the pass in §3: I had written *"there is an island of red rock off
the coast on your way out"* into an answer marked `truth: "true"`. **There is no island POI anywhere
in `pois.json`.** It is now a claim I checked against the leg's own height profile — `archon-thorn`
runs y 3.4 → 9.1 → 13.7 → 30.2 → 13.3 across its quartiles — so *"the ground stays low nearly the
whole way and then climbs hard in the last stretch"* is both true and usable. **A `true` answer that
is not true is the same defect as a dangling signpost,** and I nearly shipped one while fixing the
prose bars.

### H — the landmark gap: measured, diagnosed, and then fixed from this side of it

The brief flagged that the crossing road never passes within the 160 m lamp range of a glowing
signature. Measured, against both named routes:

| Route | length | nearest **glowing** signature | glowing within 160 m | **unlit** within 160 m |
|---|---|---|---|---|
| THE CROSSING | 6,816 m | **162.1 m** | **0** | 57 (nearest 7.8 m) |
| THE LONG WAY | 9,367 m | **257 m** | **0** | 102 (nearest 6.9 m) |

*(The brief's figure was 281 m; I get 162.1 m for the nearest. Either way the answer to the question
that matters is zero, and the discrepancy is probably a different sampling of the road.)*

**The cause is structural and it is one line.** Of the 13 signature kinds in
`game/src/world/signature.js`, exactly **one** is placed deliberately beside a road —
`imperial_milestone`, `wants: 'roadside'` — and its `glow` is **0**. Every kind that *does* glow
(welkynd pillar, naga kiln dome, dye vat, voriplasm, swamp jelly canopy, comb cliff, beached hull
house) is placed by region fill and then *actively pushed off the road* by `build-signatures.mjs`'s
`rdist.d < rdist.seg.hw * 3.4 + reach + 4`. So a walker on the crossing at night passes 57
landmarks and not one of them is lit. It is not bad luck; it is what the placement rules ask for.

**I did not move `signatures.json`,** and I still have not: it is `RI-WLD04` M19's artefact, 840
instances, 7 of 13 kinds are landform and moving them moves the ground other pieces are measured on.
But "not my data" is a reason not to touch *that* file, not a reason to leave the road dark. So the
fix went in on this side of the line: **the road lights itself.**

#### The waylamp

`build-signposts.mjs#lampFor` puts a lamp on the **9 waystation posts** and the **3 junction
posts** — 12 of 32 — and on nothing else. The rule is about where a traveller stops, not about
coverage:

* a **waystation** is a shelter, a shrine or a well, and the reason it is a waystation is that
  people break there; two of the nine are literally shrines and one is called *Ash Shelter*;
* a **junction** is the one place on the network where being wrong in the dark costs you an hour,
  so it is the one place worth the oil;
* the 20 **approach** posts stay dark on purpose. From an approach you can already see the town,
  and if everything is lit then nothing is a landmark.

**The colour is not decoration.** It is read straight out of `SIGNATURE_KINDS` by region, so a lamp
burns whatever that region's own signature burns:

| Post | Region | Colour from |
|---|---|---|
| Welkynd Shrine (Helstrom–Blackrose) | Blackwood | `welkynd_pillar` `#5FC8FF` |
| Fired-Cold Well (Archon–Thorn) | Clay Moor | `naga_kiln_dome` `#FF6A22` |
| Tide-Pole Post, Stilt-Rest | Eastern Rootlands | `swamp_jelly_canopy` `#7CFFC8` |
| Corpse-Lily Shrine ×2 | Deep Marshes | `voriplasm` `#9C6BE0` |
| Lichen Post, Archon junction | Crimson Coast | `open_dye_vat` `#C0223A` |
| Legion Milepost, Ash Shelter, Helstrom & Blackrose junctions | (no glowing signature) | lamp-oil `#FFC061` |

That is `RI-WLD04` M17 step 6's own principle — *a region is identifiable at night by light it
owns* — applied to the road, and it means **a lit post tells you which region you have walked into
as well as which way to go.** It also costs nothing extra to render: `province.js` pools the
waylamps into the existing `updateSignatureLights` two-light budget rather than adding lights of
its own, because six dynamic lights was measured at 3.75 minutes a frame on this rasteriser.

#### What it actually bought, and the residual, honestly

Check H no longer asks "is there a lit thing on this route" — one lamp would satisfy that and tell a
walker nothing. It asks **how far you walk in the dark with nothing to steer at**:

| Route | waylamps on route | longest dark stretch | lit fraction | before |
|---|---|---|---|---|
| THE CROSSING | 3 | **2,676 m** of 6,816 | 0.607 | 100 % dark |
| THE LONG WAY | 5 | **4,719 m** of 12,382 | 0.619 | 100 % dark |

**The residual has one cause and it is a data gap, not a lighting one: five of the ten legs have no
waystation at all** — `stormhold-helstrom`, `helstrom-gideon`, `gideon-soulrest`,
`soulrest-blackrose`, `blackrose-lilmoth` — so those legs have no mid-leg furniture of any kind to
hang a lamp on. Adding waystations means `roads.json` plus `build-pois` plus `build-hearths`, and
that is not this piece's to move mid-wave. **H stays a warning and never a failure,** for exactly the
reason it always did: the signature half of it belongs to `RI-WLD04`, and the recommended fix there
is unchanged — give one glowing non-landform kind a `roadside` placement. `welkynd_pillar` is the
obvious candidate: already non-landform, already glowing, and an Ayleid pillar standing by a Legion
road is the exact image the Helstrom legionary's directions already describe.

---

## 5. Can a player actually get there? — `tools/world/wayfind-journey.mjs`

`Engine.walkRoute()` already proves the road is walkable, by walking down the very polyline it was
handed. It cannot prove anybody could *find* it. So this probe has two phases.

**Phase A — the blind navigator**, in bare Node. It is given the destination's **name** and nothing
else, and may use only three things a person standing in the world has: `field.onRoadAt` (is the
ground under me road), `field.nearestSign` (the post I am close enough to read), and the settlement
records (I can tell when I am standing in a town). It is **not** given `roads.json`'s legs, its
points, or its named routes.

Where a single road does not reach, it follows **the chain of places** — a breadth-first search over
the routes `road-directions.json` can actually *speak*. That is not map knowledge; it is the graph of
"somebody here can describe this road", which is the only graph a person ever has, and it is exactly
what `60-roads.json` says out loud when you ask the wrong person: *"South, but not from here. You
want somebody in Helstrom or in Lilmoth for that."*

**Result, Soulrest → Lilmoth (two hops, via Blackrose): ARRIVED — 3,206.3 m, 26.7 min, 5 posts read,
5 steering decisions taken at posts**, including a **108.2° turn** at `sign-junction-blackrose`.

**The ablation.** Stub `field.nearestSign` to null — the road is untouched, the posts are gone — and
the same walker is **LOST**. The posts are doing the steering, not the road alone. Without this the
probe would have been measuring the road and calling it wayfinding.

Across all 10 adjacent settlement pairs: **7 arrive, 3 do not.**

**The three failures, honestly.** Stormhold→Helstrom, Helstrom→Archon and Archon→Thorn defeat the
navigator. Stormhold→Helstrom is diagnosed exactly: that leg carries a **526 m viaduct** (points
42–87, 50.3 m at its highest) which **hairpins at point 43** — the carriageway reverses through about
140° inside 9.7 m, fifty metres in the air. `onRoadAt` is 2D and sees both carriageways as the same
place, so a greedy road-follower oscillates and gives up. **A player would not**: they can see the
road ahead is at a different height. So this is a limitation of my navigator rather than a defect in
the road — but it is worth knowing that three of ten legs cannot be followed by road-presence alone,
and a critic should not read "7 of 10" as "70% of the province is reachable".

**Phase B — the body**, in the browser: the capsule walks the navigator's *own* waypoints through
`walkPath`, with real inputs and the real fixed step. Results in `reports/w1-05-journey.json`.

**Three traps in phase B, all mine, all worth recording.** The probe reported `aborted: 'stuck'`,
`path_m: 0` for a full run because the sign reader opened in the previous step was left **open** and
was swallowing the walk's inputs. And `rendered_text` is nested under `getUIState().surface`, not at
the top level, and needs a render pass — the probe runs at `renderRate 0`. Also: `api.js`'s own
comment names a `sceneCensus()` that **does not exist** on the harness.

#### The third one is the interesting one: a trace is not a route

The run before this one walked **17,929 m of a 3,206 m journey**, took 111 simulated minutes,
finished 592 m short — and **never aborted**. `longest_stuck_frames: 0`, `mired_frames: 0`. It was
not stuck. It was busy.

Found offline, with no browser, by reading the path I had handed it. `plan.path` is the navigator's
**trace**: every position it stood at, including the places it stopped and turned 108° to read a
post. Around waypoint 814 the trace runs

> z = 4820.1 → 4823.0 → 4825.7 → **4828.6** → 4824.2 → 4821.3

— it doubles back through about 8 m. `Engine.walkPath` advances to the next waypoint only once the
body is within `lookahead_m` (4.5 m) **of that waypoint**, so a trace that reverses inside the
lookahead makes the follower walk backwards, re-acquire, and walk forwards again, for as long as you
let it.

**That is a defect in what I handed the body, not in the province and not in the road.** A player who
pauses at a signpost does not have to walk the pause. So `tidyPath()` turns the trace into a route
first — bounded loop removal, which is the shape a recorded turn-on-the-spot makes and is not a shape
a road makes, with the window bounded so a route that legitimately passes near its own earlier self
is not short-circuited into a shortcut nobody walked. Measured on this journey:

| | points | metres |
|---|---|---|
| raw trace | 1,035 | 3,206 |
| tidied route | 506 | **3,091** |

It removed **115 m — 3.6%** — and **zero sharp reversals (>120°) remain**. Both numbers are written
into `phase_b_route` every run, so if the tidy ever takes real distance instead of dither, the report
says so and a reader can refuse the run.

**Load caveat.** The box was at `loadavg` 24–48 across the browser phase, well over the ~12 that
`AGENT-PROTOCOL` says distorts measurements. Arrival and abort are behavioural rather than timed, so
they stand; any *duration* in the phase B block should not be quoted.

#### The honest headline: nobody has yet made Phase B arrive anywhere

The paragraphs above describe Phase A — the blind navigator's *plan* — arriving. **Phase B, the real
capsule actually walking that plan with `walkPath()`, has never once arrived, in three independent
attempts, and the three failures converge on the same spot.**

| attempt | path source | ends | offset from target | deepest water |
|---|---|---|---|---|
| Soulrest→Lilmoth (two hops, tidied trace) | this tool's navigator + `tidyPath()` | (2188.3, 4993.7) | 579.2 m | 27.37 m at (2410.1, 5052) |
| Soulrest→Blackrose (one hop, tidied trace) | this tool's navigator + `tidyPath()` | (2188.3, 4993.7) | 612.9 m | 27.37 m at (2410.1, 5052) |
| Soulrest→Blackrose, **raw leg centreline** | `roads.json`, no navigator, no tidy, `tools/world/rawleg-check.mjs` | (2195.6, 4994.9) | 617.3 m | 27.37 m at (2409.7, 5051.4) |

The third row is the one that matters: it does not touch a single line of this tool's own code, and
it still leaves the road and drowns within about 10 m of where the other two ended up, 400,000
frames (111 simulated minutes) later. **Three independently-generated paths converging on the same
patch of ~30 m-deep water, none of them recovering, is evidence of a defect in the road or the walk
step — not in this piece's probe.** Full numbers: `reports/w1-05-journey.json`
(`CONFIRMED_NOT_A_PROBE_ARTIFACT`), `reports/w1-05-journey-onehop.json`,
`reports/w1-05-rawleg-check.json`.

**What was not settled, and why: the box.** Isolating the exact frame the capsule leaves the road
needs either a shorter, instrumented walk or a quiet box to run one on, and this session never had
one — `loadavg` sat at 12–42 against 4 cores for the whole of it, several times the rule-21 cap, from
other agents' work rather than this piece's own. A **clean-route positive proof** — a pair with no
causeway near it, e.g. `gideon-soulrest` (no `deck_spans`, no tide gate; Phase A already arrives for
it, `reports/w1-05-journey-gideon-soulrest.json`) — was planned and not attempted for the same reason:
launching a fourth ~10-minute browser run on top of 18–42 already in flight would not have produced a
trustworthy number, and the coordinator said plainly not to force it. **So the honest answer to "can a
player get there" is: the plan says yes, and every attempt this piece made to prove it with the actual
body says no, and the fault has been narrowed to the road/water system rather than to this piece's own
measurement — but nobody has yet watched a player arrive.**

---

## 6. Reconciled: the viewpoint anchors

`tools/harness/viewpoints-province.json`'s 17 viewpoints carried `anchor: "region_blackwood"` and
twelve siblings. **None of those 13 states exists in `game/data/states`.**

They were not harmless. `shot.mjs:107` and `shoot.mjs:157` both do `v.state || v.anchor` and hand the
result to `loadState`, where `hOpt` **swallows the failure** — so a shot taken through either tool
loaded nothing, kept whatever state happened to be resident, and was then **labelled with an anchor
it had never been taken at.** A silently wrong label on a picture is worse than a missing one,
because a missing one gets fixed.

Renamed to `region`, which is what the field always meant; all 13 now resolve against
`world/regions.json`. Positioning is and always was `province.teleport`, which
`province-shots.mjs` honours and which never read `anchor` at all.

---

## 7. Still open, for whoever picks this up

0. **THE PHASE B WATER TRAP — highest priority, see §5.** Three independent Phase-B body walks,
   including one using the raw `roads.json` centreline with none of this tool's own code, all leave
   the `soulrest-blackrose` leg (or a route that crosses it) and converge on the same ~30 m-deep
   water within about 10 m of each other, and none recovers inside a 400,000-frame budget. This is
   confirmed to be reproducible and NOT an artifact of the navigator or `tidyPath()`. NOT YET
   isolated: the exact frame/position the capsule leaves the road, and whether the cause is in
   `field.depthAt`/`heightAt` near that leg, the tide cycle (`water.json` `tide.cycle_real_min: 12` —
   9 full cycles pass inside one 111-minute walk) interacting with a low crossing, or a current/drift
   term in the swim band (W5) that outruns the capsule's own 1.10 m/s. Start from
   `reports/w1-05-journey.json`'s `deepest_water_on_the_walk` and `tools/world/rawleg-check.mjs`
   (cheap to rerun on other legs) rather than repeating an 111-minute walk from scratch. Also worth a
   clean-route positive control the moment the box is quiet: `node tools/world/wayfind-journey.mjs
   --from Gideon --to Soulrest` — Phase A already arrives for it and it crosses no causeway.
1. **`pois.json` is stale against `roads.json`.** It declares 8 waystations named *Wayshrine of the
   Root*, *Pole Camp*, *Vat-Keeper's Hut*, *Kiln Post*; `roads.json` has 9, named *Legion Milepost*,
   *Ash Shelter*, *Corpse-Lily Shrine* ×2, *Welkynd Shrine*, *Lichen Post*, *Fired-Cold Well*,
   *Tide-Pole Post*, *Stilt-Rest*. Only two agree. `build-pois.mjs` derives from `roads.json`, so
   `pois.json` was built against an older `roads.json` and never rebuilt. Rebuilding it is not this
   piece's call because other pieces resolve names against it.
2. **Five of the ten legs have no waystation at all** — `stormhold-helstrom`, `helstrom-gideon`,
   `gideon-soulrest`, `soulrest-blackrose`, `blackrose-lilmoth`. This is the single cause of both
   remaining wayfinding residuals: those legs have no mid-leg furniture to hang a waylamp on (§4 H),
   and a walker on them gets no mid-leg reassurance of any kind. Fixing it means `roads.json` plus
   `build-pois.mjs` plus `build-hearths.mjs`, which is more than one piece.
3. **The signature half of the night landmark gap** (§4 H) still belongs to `RI-WLD04`: the fix is
   one `wants: 'roadside'` on a glowing non-landform kind. The road now lights itself regardless.
4. **The three unfollowable legs** (§5) — worth a navigator that reads height, or worth knowing.
5. **`sceneCensus()`** is named in `harness/api.js`'s documentation and does not exist.
6. **`ourText()` in `check-prose.mjs` knows eight dialogue shapes and there is no test that the set
   is complete.** This piece's file was invisible to the gate for its whole life (§3). Anything in
   `game/data/dialogue` whose lines are not in one of those eight shapes is ungraded prose, and the
   tool cannot currently tell you which files those are. A "files with zero measured words" line in
   the summary would have caught this on day one.
