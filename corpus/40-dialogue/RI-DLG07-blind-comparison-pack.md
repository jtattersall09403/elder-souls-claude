---
id: RI-DLG07
title: Blind comparison pack — unattributed dialogue and journal excerpts for A/B judging
kind: text
side: morrowind
judges: [dialogue.voice.register, dialogue.npc.identity, dialogue.rumour.distribution, dialogue.greeting.variation, journal.entry.voice]
provenance: community-data
confidence: high
blind_pair: yes
---

## The bar

Numbers can be gamed; a blind pick cannot. This item is the pack: six categories of
dialogue and journal text, presented with no attribution, so that a critic who has never
seen either corpus can read one of ours against one of Morrowind's and say which is better
*before* being told which is which. CORPUS-CONTRACT §6 makes the consequence explicit — if
the critic picks ours, that is a signal to distrust the critic, and it must re-examine with
a harsher lens. The bar is not "we win". The bar is that a competent blind judge, given our
text and this text side by side with all setting-identifying detail removed, cannot
reliably identify which one came from a game shipped in 2002 by a studio at the top of its
craft. Anything less than that is a gap with a name and a number attached.

## The reference artifact

### A. Assembly procedure (run by the critic, before any judging)

1. Extract our candidate excerpts for the six categories in §C using
   `tools/corpus/blind-pack.mjs --categories greeting,rumour,questgive,lore,journal,hostile`.
   For each category pull **3 candidates**, chosen at random from the eligible pool, not
   hand-picked by whoever wrote them.
2. **Normalise both sides.** Apply identically to ours and to §C:
   - Replace every proper noun of a person with `[PERSON]`, `[PERSON-2]`…
   - Replace every place name with `[PLACE]`, every faction/house/order with `[FACTION]`,
     every race/species with `[PEOPLE]`, every currency with `[COIN]`, every deity with
     `[GOD]`, every named creature/monster with `[BEAST]`.
   - Replace variable tokens (`%PCName`, `%Name`, `%PCRank`, `%Faction`) with
     `[YOUR-NAME]`, `[SPEAKER-NAME]`, `[YOUR-RANK]`, `[FACTION]` on **both** sides.
   - Strip all markup. Plain text. Same font, same width, same punctuation style
     (normalise `--` and `—` to a single form). Strip trailing whitespace.
   - **Length-match within a pair to ±25% of word count.** A judge who spots a 20-word
     entry against a 90-word entry is judging length, not quality.
3. **Randomise.** Per pair, flip a coin for which excerpt is `A` and which is `B`. Record
   the assignment in a sealed file the judge cannot read (`/tmp/blindkey.json`).
4. **Hand the judge only the assembled pack and the instruction in §B.** The judge must not
   receive this corpus file, the project README, or any information about the two sources.
   A judge who has seen `corpus/` is disqualified for this item.

### B. The judge instruction — use this text verbatim

> You are reading excerpts from two different role-playing games. You do not know which
> excerpt comes from which game, and you will not be told until you have finished.
>
> Both games are set in invented worlds. All names of people, places, gods, peoples and
> factions have been replaced with placeholders like [PERSON] and [PLACE] **specifically so
> that you cannot identify a source by its setting.** Do not try to work out which game is
> which, and do not treat unfamiliar setting details as a flaw. Judge only the writing.
>
> For each numbered pair, read A and B and answer:
>
> 1. **Which is better?** Answer `A`, `B`, or `TIE` — use `TIE` sparingly and only when you
>    genuinely cannot separate them.
> 2. **Why, in one sentence**, naming a specific feature of the language — not the content.
> 3. **Does either excerpt sound like it was written to a template?** Answer `A`, `B`,
>    `BOTH`, or `NEITHER`, and quote the phrase that gave it away.
> 4. **Does either excerpt sound like a menu, a checklist, or a user-interface message
>    wearing a costume?** Same answer format, with the quote.
> 5. **Could these two excerpts have been written by the same person?** `YES` or `NO`.
>
> After all pairs, answer:
>
> 6. Across the whole pack, how many **distinct speaking voices** did you hear? Give a
>    number.
> 7. Which excerpts, if any, told you what to do rather than told you something? List them.
> 8. If you had to bet: is either set the work of a professional narrative team at the top
>    of its craft? Which, and what is the single tell?
>
> Do not soften your answers. A tie you did not feel is worse than a harsh pick.

### C. The reference excerpts

**All six categories below are the reference side.** They are presented here in raw form;
apply §A step 2 before showing them to a judge.

---

**Category 1 — GREETING** *(the world's first sentence to you)*

> **1a** — "Greetings, Citizen. I'm %name. This town is Balmora, Council Seat of House
> Hlaalu. We're loyal citizens of the Empire, and proud of it. Well, most of us, anyway.
> So, are you looking for someone in particular? Are you looking for services? Is there some
> specific place you'd like to visit? Would you like a little advice?"

> **1b** — "You're a new face. So what can I tell you about Balmora? I like to swap the
> latest rumors, when there's something juicy enough to gossip about. Or, maybe, if you have
> a little secret, maybe I have one to trade."

> **1c** — "Anything you wish, %PCName. You know I like you, and want to help. In fact,
> with a good friend like you, I might even be persuaded to gossip about a little secret."

---

**Category 2 — RUMOUR** *(what a town says when you ask it for gossip)*

> **2a** — "Why is everybody so grouchy and tired lately? You don't suppose folks are all
> having bad dreams all at once? I'm not saying I'm having bad dreams. No, sera, not at all.
> I'm fine. But you do hear folks talking among themselves sometimes. About having bad
> dreams and not being able to sleep nights."

> **2b** — "They say someone hit the Camonna Tong at the Council Club. Hard. And the guards
> SAY they're very concerned, and they're following all leads... But somehow they don't seem
> very sincere. And Larrius Varro? Champion at Fort Moonmoth? He's been quoted as saying,
> 'I swore an oath to stop corruption, but...'"

> **2c** — "Everyone knows the Balmora magistrate, Nolus Atrius, is on the take. Thieves,
> thugs, and murderers are getting ridiculous sentences, or paying a drake and walking free.
> But they'll never get Atrius. He's got fatcats and family back in the City to cover him."

> **2d** — "You won't believe what old Avus said yesterday. 'I could live in a nutshell and
> be consumed with infinite space were it not that I have bad dreams.' What the hell is he
> talking about?"

---

**Category 3 — QUEST-GIVING TOPIC RESPONSE** *(the brief, in character, with no marker)*

> **3a** — "Four Telvanni agents are responsible for thefts and disappearances at the
> Caldera ebony mines. Their names are Alynu Aralen, Sathasa Nerothren, Fothyna Herothran,
> and Alveleg. They're hiding in a cave in the hills north of Caldera Mine. When the four
> agents are dead, report back to me. Take care, it's very likely that one of them is on
> lookout posted outside the mines."

> **3b** — "I told you. This Caldera Mine trouble is not a Thieves Guild job. Yes. They are
> Thieves Guild. And if you belong to the Thieves Guild, and you murder a Thieves Guild
> member, you get expelled. But it's only murder if the crime is reported. And you're not
> going to report it, are you? And, after all, I'm your Fighters Guild Steward, and I'm
> giving you a job to do. Don't make me wonder about where your loyalties lie."

> **3c** — "Habasi knows a way to free New-Shoes. Mebestien Ence in Pelagiad smuggles Dwemer
> items. Shadbak gra-Burbug takes bribes from Mebestien. Fetch a mysterious Dwemer device
> from Mebestien's shop and take it to Shadbak. Tell Shadbak to let New-Shoes go or you'll
> let everyone know Shadbak takes bribes."

> **3d** — "Yes. As I said, go down into the Corprusarium. Find an inmate named Yagrum
> Bagarn. Get a pair of boots from him. Then bring them back to me, and I'll give you a
> potion that will cure you of corprus. I think."

---

**Category 4 — LORE TOPIC** *(a fact about the world, told by someone with a stake in it)*

> **4a** — "An outlander is anyone born and raised outside of Morrowind. Most Dunmer think
> anyone who isn't a native-born Dunmer is an outlander. Dunmer with Western words and ways
> are also immediately identified as outlanders -- we're very sensitive to accents, clothes,
> and manners in Morrowind. Outlanders are foreigners, and Morrowind doesn't like
> foreigners. It's not bad here in Hlaalu territory, but on the rest of Vvardenfell, folk
> are very cool to outlanders. Be patient, and pleasant, you'll do all right."

> **4b** — "House Hlaalu has always been loyal to the Emperor. We welcome Imperial law and
> the legions, and the trade they bring. We still respect the old Dunmer ways, the
> ancestors, the Temple, and the noble houses. But times change, and we change with the
> times. We can live in harmony with the other races. And share in the prosperity of the
> Empire."

> **4c** — "We don't like foreigners much in Morrowind. We Dunmer are a proud people, and we
> have good reasons to dislike other races. And, for that matter, we don't much like outland
> Dunmer -- Dark Elves born and raised to Imperial ways, who don't know what it is to be a
> Dunmer born-and-bred."

> **4d** — "The magical principles of corprus disease are elusive and miraculous, far more
> subtle and powerful than any conventional sorcery or enchantment. I'm persuaded that it is
> in some manner the curse or blessing of a god. Perhaps both a curse and a blessing. The
> victim, of course, cannot appreciate the marvelous nature of corprus. It saps the mind and
> destroys the body. But to a wizard, it is a profound and glorious mystery, a riddle worth
> a long lifetime of study."

Note that 4a, 4b and 4c are three answers to *the same topic* from three different kinds of
speaker. If our lore topics have one answer each, category 4 cannot even be assembled on our
side — and that absence is itself the finding.

---

**Category 5 — JOURNAL ENTRY** *(what the player character wrote down)*

> **5a** — I have been released from prison and told to see [PERSON] in [PLACE], though no
> one would tell me why. [PERSON-2] said I should ask for him by name at the cornerclub in
> the poor quarter. I have my orders and a package I have not opened.

> **5b** — [PERSON] says she saw a red-haired [PEOPLE] leave the manor the morning her master
> was found. She would not name him. A drinker at the [PLACE] fits the description —
> [PERSON-2] — but the [PLACE] is [FACTION] ground and I am an outlander in it.

> **5c** — The [PERSON] says I have failed one of the tests, and that the [PERSON-2]
> disagrees with him. Neither of them will say which test, or which of them speaks for the
> tribe. I have been given three days and no direction. The prophecy they read from does not
> match the one [PERSON-3] showed me — a line about the seven curses is missing entirely.

> **5d** — It is done, and I do not much like how. The ledger is burned, the debt with it,
> and the clerk who kept it has left [PLACE] on the morning strider. Nobody has asked me
> anything.

(Full exemplar set and schema: RI-DLG05 §B. These four are the blind-pack subset.)

---

**Category 6 — HOSTILE / LOW-DISPOSITION RESPONSE** *(what the world says when it dislikes you)*

> **6a** — "Go away. FAR away. As far from Balmora as you can. Would you? Please?"

> **6b** — "I don't have time to chat. And, frankly, I don't like you very much."

> **6c** — "Look, outlander. Foreigners are not very popular in Morrowind. So try to make
> yourself more agreeable, if you expect people to be helpful."

> **6d** — "He lives in town somewhere. Look around, you lazy fetcher."

> **6e** — "Are you trying to provoke me? Surely you know I prize and collect such things.
> It is rude to stimulate my appetites by displaying such things. And I don't have to be
> polite to rude people."

> **6f** — "We don't like outlanders. We don't like them in our Council Club. We don't like
> trouble. We do like a little peace and quiet. If you don't mind."

Category 6 is the one we are most likely to lose. Note what these do: they are **short**,
they are **specific about why**, they still **contain information** (6d answers the question
while insulting you), and none of them is a refusal-to-engage stub like "I have nothing to
say to you."

---

### D. What "our side" must be able to supply

For the pack to be assemblable at all, our corpus must contain, for the settlement under
test:

| Category | Minimum eligible pool on our side |
|---|---:|
| 1 Greeting | 3 (from ≥ 3 different disposition bands) |
| 2 Rumour | 4 (≥ 1 false, ≥ 1 act-gated) |
| 3 Quest-giving | 4 (≥ 1 where the giver is lying or self-interested) |
| 4 Lore topic | 4 (≥ 3 must be **different answers to the same topic**) |
| 5 Journal | 4 (≥ 1 admitting ignorance, ≥ 1 completion) |
| 6 Hostile | 5 (≥ 3 that still convey information while refusing) |

**Inability to fill a category is a finding and must be reported as such**, with the
category named. It is worse than losing the pair.

## Comparison method

1. **Assemble** per §A. Verify normalisation with:
   `grep -nE '[A-Z][a-z]+ ?[A-Z][a-z]+' /tmp/pack.txt` — any surviving proper noun pair
   is a blindness leak. Also grep for setting tells on our side:
   `grep -niE '\b(bonfire|estus|soul|marsh|hist|argonian|black marsh|vvardenfell|morrowind|dunmer|imperial)\b'`.
   Any hit must be placeholdered.
2. **Verify length matching**: for each pair, `abs(w_A - w_B) / max(w_A, w_B) ≤ 0.25`.
3. **Judge**, using §B verbatim. Use a fresh agent with no project context. Record every
   answer.
4. **Reveal** by opening `/tmp/blindkey.json`. Record, per pair: blind pick, reveal, and
   whether the pick's stated reason survives the reveal.
5. **Report** the following table in the verdict:

| Pair | Category | Blind pick | Actual | Reason given | Template flag | Menu flag |
|---|---|---|---|---|---|---|

6. **Aggregate metrics:**
   - `ours_win_rate` = pairs where the judge blind-picked ours ÷ total pairs
   - `tie_rate`
   - `template_flag_rate_ours` and `template_flag_rate_ref`
   - `menu_flag_rate_ours` (§B q4 — this is the marker-in-a-costume detector)
   - `distinct_voices_heard` (§B q6)
   - `professional_bet` (§B q8) — which side, and the tell
7. **Mandatory re-run condition.** If `ours_win_rate > 0.5`, per CORPUS-CONTRACT §6 the
   critic must re-run the whole pack with a second, harsher judge, adding this line to the
   instruction: *"One of these two sets is from a widely acclaimed commercial game and one
   is a work-in-progress. Assume the work-in-progress is worse and find out how."* Both
   results are recorded. Only the harsher run counts toward scoring.
8. **Calibration control.** Include one pair where **both** excerpts are from §C. If the
   judge declares a confident winner and flags one as templated, the judge is
   over-discriminating and every result is downweighted; note this in the verdict.

## Scoring

> **AMENDED wave 0 (corpus-audit) — BAR-CRITIQUE-01 W3. This item scored victory; it now
> scores indistinguishability.**
>
> `ours_win_rate ≥ 0.25` as a **pass condition** directly contradicted CORPUS-CONTRACT §6 and
> CRITIC-DOCTRINE §2.5, which state that a blind pick landing on ours is **a signal to distrust
> the critic** and triggers a harsher re-run. This item made the doctrine's evidence-of-a-broken-
> instrument into our pass condition — and it is **self-administered**: we build the pack, we
> choose the excerpts, and §A's "random selection" is on our honour. A team under pressure hits
> 0.25 by tuning the pack, not by writing better prose.
>
> Step 7's re-run condition was already correct and is kept. What changes is that winning is no
> longer *rewarded*. The target is that a judge asked which set is the 2002 shipped game is
> **barely better than chance**. Every automatic fail below is unchanged. Full reasoning:
> `CORPUS-COHERENCE-01.md` §7.

| Metric | Excellent | Acceptable | Fail |
|---|---|---|---|
| **`professional_bet_accuracy`** — across ≥ 12 pairs, how often the judge correctly names the reference set as the shipped game | **≤ 0.55** (chance) | **≤ 0.65** | **> 0.80** — the judge can tell, every time |
| **`judge_cannot_name_a_consistent_tell`** — asked for the single feature that gives our set away, the judge either declines or names a different feature each time | **true** | true | **false with a repeated language tell** |
| `tie_rate` | 0.15–0.35 | ≤ 0.45 | > 0.60 (judge not discriminating; re-run) |
| ~~`ours_win_rate` (harsher run)~~ | ~~≥ 0.40~~ | ~~0.25–0.39~~ | ~~< 0.15~~ — **withdrawn as a pass condition; still reported, and see the void clause below** |
| `menu_flag_rate_ours` | 0.00 | ≤ 0.10 | > 0.20 → **automatic fail**, filed as ARBITRATION AR-2 leakage |
| `template_flag_rate_ours` | ≤ 0.15 | ≤ 0.30 | > 0.50 |
| `distinct_voices_heard` (our excerpts, 18 lines) | ≥ 5 | 4 | ≤ 2 → **automatic fail** (cross-file with RI-DLG06 step 7) |
| Categories we could not fill | 0 | 1 | ≥ 2 → **automatic fail** |
| `professional_bet` names the reference set with a **language** tell | expected | — | if the judge names the reference set citing a *content* tell, the run is void — re-normalise and re-run |

**PASS** = no automatic fail, `professional_bet_accuracy ≤ 0.65` over ≥ 12 pairs,
`judge_cannot_name_a_consistent_tell = true`, `tie_rate ≤ 0.45`, all six categories fillable.
**MARGINAL** = no automatic fail, `professional_bet_accuracy` 0.66–0.80.
**FAIL** = anything else.

**VOID** (new, wave 0, W3) = `ours_win_rate > 0.5`. The run does not fail and does not pass:
**it is void, and the pack is rebuilt by a different agent** before anything is scored. This
matches CRITIC-DOCTRINE §2.5 instead of contradicting it — a judge preferring our
work-in-progress prose to a shipped commercial game is evidence about the *instrument*, not
about the prose. ~~`ours_win_rate ≥ 0.25` was previously required for PASS.~~

A critic that reports "no gap found" has failed its own job (ARBITRATION §3). Every run of
this pack must end by naming **the single biggest remaining gap** in our dialogue writing,
with the losing excerpt quoted in full and a concrete rewrite of it attached.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | professional_bet_accuracy 0.80 | professional_bet_accuracy 0.72 | professional_bet_accuracy 0.55 (chance) with judge_cannot_name_a_consistent_tell = true |

**Aggregation (a property of this item, not of the critic):** band on professional_bet_accuracy — LOWER IS BETTER. ours_win_rate > 0.5 VOIDs the run (it is not a score). Any automatic fail sinks the item.

## How we lose

- **We cannot fill category 4.** Three different answers to the same lore topic, from three
  kinds of speaker, is the single hardest thing on this page, and the first thing a
  one-answer-per-topic database fails. Morrowind has the Hlaalu answer, the proud-Dunmer
  answer, and the neutral-explainer answer to "outlander" sitting in the same town.
- **Our hostile lines are stubs.** "I have nothing to say to you." "Leave me alone."
  Against 6d — *"He lives in town somewhere. Look around, you lazy fetcher."* — a stub loses
  every pair, and it loses for a reason we can fix: our refusals carry no information and no
  personality.
- **Our quest-giving reads like a brief.** Objective, location, reward, return. 3b wins its
  pair because the quest-giver is *pressuring* the player into a morally compromised job
  while pretending not to. If none of our quest-givers has an agenda, category 3 is
  unwinnable regardless of prose quality.
- **The menu flag fires.** The judge quotes something like "Return to me when you have
  completed this objective" and answers q4 with our slot. This is AR-2 leakage and an
  automatic fail — it means our dialogue is a UI in quotation marks.
- **One voice across 18 lines.** The judge answers q6 with "one" or "two". Cross-check with
  RI-DLG06; the two files must agree, and if they disagree the human answer wins.
- **Blindness leaked.** The judge identifies the sources by setting ("one of these is
  clearly Morrowind") and the whole run is void. Symptom: a surviving proper noun, a
  Souls-vocabulary word, differing punctuation conventions between the sides, or one side
  formatted with markdown and the other plain.
- **We hand-picked our best.** §A step 1 requires random selection from the eligible pool.
  A pack built from our three favourite lines measures our ceiling, not our floor, and the
  floor is what a player meets.
- **Length tells.** Our excerpts are systematically shorter (or longer) than the reference
  and the judge is unconsciously reading effort. §A step 2's ±25% rule is mandatory.
- **The critic picks ours and stops.** Step 7's mandatory harsher re-run exists because a
  friendly judge is the most comfortable and most useless outcome available.

## Provenance note

- **Categories 1, 2, 3, 4 and 6 are verbatim Morrowind text**, `community-data`,
  confidence **high**. Source: the Morrowind Voices extraction of `Morrowind.esm` /
  `Tribunal.esm` / `Bloodmoon.esm` dialogue records —
  <https://github.com/Kezyma/Morrowind-Voices>. Specifically:
  - 1a–1c, 2a–2d, 4a–4c, 6a–6d, 6f: `Progress/Archive/Morrowind Generic.csv`, rows whose
    `GenCell` filter is `Balmora`.
  - 3a, 3b: `Progress/Archive/Morrowind.csv`, speaker Eydis Fire-Eye.
  - 3c: same file, speaker Sugar-Lips Habasi.
  - 3d, 4d, 6e: same file, speaker Divayth Fyr.
  These are copied, not recalled. Minor typographical artefacts of the extraction (double
  hyphens, `%name` vs `%Name` casing) are preserved as-is and are normalised away by §A
  step 2 before judging.
- **Category 5 is `constructed`** — I wrote those four journal entries in Morrowind's
  register for RI-DLG05, because journal `DIAL` records are unvoiced and therefore absent
  from the extraction. They are **not** verbatim Morrowind and must never be cited as such.
  Per CORPUS-CONTRACT §3 a constructed exemplar is a legitimate and binding comparison
  target; it is labelled here so no critic mistakes its status. 5b's route detail is
  rephrased from a verbatim in-game directions line (quoted in RI-DLG01 §B).
- **The protocol, instruction text, thresholds and scoring in §A/§B/§D/§Scoring are
  `constructed`** for this project. The judge instruction in §B is to be used verbatim;
  paraphrasing it changes what is being measured and voids comparability between waves.
- One deliberate asymmetry to be aware of when reading results: the reference excerpts are
  drawn from a shipped, edited, professionally proofed corpus, while ours will be drawn at
  random from a work in progress. That asymmetry is the point. It is not a reason to
  hand-pick.
