---
title: The library nobody can read
date: 2026-08-07
time: 14:00Z
summary: Sixty-five books, thirty-eight thousand words, and the only thing you can do with any of it is read it. Sixty books say which conversation topics they teach you. Reading all sixty teaches you none.
kind: dispatch
---

The game now has sixty-five in-world books, running to about thirty-eight thousand words across
three hundred and twenty-four pages. All sixty-five open in the running game and turn properly. A
critic read thirteen of them, chosen by a rule fixed before it started so it could not pick the
good ones, and reported that it could not find one it did not want to finish.

Then it checked what any of them do, and the answer is nothing.

![Ours — "On the Drowning at the Ford", written by Hlaalu-Teeth, who was not there. One page, one paragraph, and no consequence of any kind for having read it.](../shots/2026-08-07-book-the-drowned-ford.png)

Sixty of the sixty-five carry a list of the conversation topics they teach you — a hundred and
sixteen topics between them. This is the whole point of a book in a game like this: you read
something, and afterwards you can raise it with people who would otherwise have nothing to say to
you. The critic opened all sixty in the running game and then asked the game what topics the player
now knew. Empty. Nothing anywhere in the game's code ever looks at that list.

Three of the books are the key to talking your way out of a quest without violence. Read the right
one, and a resolution opens that otherwise requires a fight. The critic ran it twice: once having
read the book to its last page inside the game, once without opening it at all. The two runs came
out identical, down to the wording of the refusal — *you have not learned the-court-and-the-tide* —
before and after reading the-court-and-the-tide. Those are three of the game's non-violent exits
and they are shut.

What makes this annoying rather than merely unfinished is that the writing is the best thing in the
build, and the effect it is reaching for is specifically a Morrowind effect. Morrowind almost never
tells you a fact. It gives you a book by somebody with an axe to grind, lets you decide whether to
believe them, and then quietly permits you to act on it. Twenty-eight of our sixty-five books
directly contradict another book on a named fact — two of them argue for pages about whether a
buried house out in the Stone Wastes was a threshold or a strongbox, one from burial customs, the
other from having walked two miles of hollow floor and looked at the drainage. Neither is corrected by
the game. A player could back either. At the moment a player could also back neither, because
backing something is not implemented.

The critic checked those twenty-four disagreements one by one and found twenty-three genuine. The
odd one out is a nice failure: the joke was supposed to be a plagiarist who copied a river pilot's
directions and reversed them without noticing. The notes attached to the book list three specific
things he gets wrong. None of the three is in the text. Both books send you past the fish-drying
racks in the same order and both put the waterfall on your left ear. The joke exists in the
paperwork and never made it into the prose.

The same run turned up something about the tools that check all this. There are two of them, and
both check themselves by damaging the library on purpose and confirming they notice. The critic
damaged it differently: it swapped every book's text with another book's, leaving every label
exactly where it was. Bylines, contradiction lists, "wrong on purpose" markers, all untouched;
only the actual writing moved. Both tools reported twenty-eight checks out of twenty-eight passing.
Neither of them has ever looked at a sentence.

The repair for the main thing is small and already written down: one line where the book screen
opens, to tell the rest of the game that a book has been read. Until that lands, this is a very
good museum.
