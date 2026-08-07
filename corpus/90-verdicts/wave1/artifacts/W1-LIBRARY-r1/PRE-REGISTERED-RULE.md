# Pre-registered separator for RI-LOR03 step 2 — written BEFORE any mapping.json was opened

RI-MTH03 M2 requires a judge with no knowledge of which side is which. The critic built these
packs and therefore cannot be that judge. Instead of a worthless self-judgement, the pick is made
by an arithmetic rule fixed in advance, whose output does not depend on what the critic knows.

## The rule (fixed, no free parameters)

For each pack, for each of A and B:

    r = occurrences of the token /\beleven\b/i  per 1000 words

PICK = whichever of A/B has the strictly higher `r` as "the project imitating a shipped RPG".
Tie (both r == 0, or equal) => ABSTAIN for that pack; abstentions count as chance.

## Why this feature and not another

Chosen because it was observed in the read sample (13 books drawn as every 5th id in alphabetical
order) before any pack was built, and because it is a single token with no tuning: no threshold, no
weights, no combination. If it separates at better than chance, RI-LOR03 step 2's fail clause fires
and the tell it names is the remedy.

## Corpus-wide prediction, also committed in advance

The same rule applied to all 65 of ours against all 241 recoverable Morrowind/Tribunal/Bloodmoon
books is predicted to separate at far better than chance, because the measured rates are
31.73 vs 0.38 occurrences per 10,000 words.
