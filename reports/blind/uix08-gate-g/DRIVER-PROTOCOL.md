# How to play, and what to do afterwards

You are going to play two builds of the same game and say what you thought of them.
That is the whole task. You are not testing anything, you are not looking for bugs,
and there is nothing you are supposed to find.

**One sentence of context, and it is all you get:** *these two builds differ in how
conversations with people work.*

---

## Do not go looking

Play the builds. Do not read the game's source code, do not fetch any URL by hand,
do not look around the repository this tool lives in, and do not try to work out
which build is which before you have written your answers down. Every one of those
turns a judgement into a deduction, and a deduction is worth nothing here — we can
already do the deduction ourselves, which is exactly why we are asking a person to
play instead.

The server records every file the browser asks for. That record is read afterwards.
It is not there to catch you out; it is there so that whoever reads your answers
knows they were formed by playing.

---

## Playing

Each build has a **codename**. You will be told the two codenames and the path to
the pack. You play them **one at a time**, and you write your five answers about the
first one **before you start the second**.

A session is a file, not a live window. You write a list of things to do, run the
tool, look at the pictures it wrote, then add more things to the list and run it
again. The world is fixed-step and seeded, so re-running the same list always
replays the same session — nothing is lost between runs.

```
node tools/blind/played-pair/play.mjs \
    --pack   <the pack directory you were given> \
    --arm    <codename> \
    --script <your session file>.json \
    --out    <a directory for this session's pictures>
```

Your session file is a JSON array. Each entry is one thing you do:

| write this | and it does |
|---|---|
| `{"do":"people"}` | tells you who is standing near you |
| `{"do":"talk","who":0}` | go and talk to person 0 from that list |
| `{"do":"up"}` `{"do":"down"}` | move the cursor |
| `{"do":"left"}` `{"do":"right"}` | move the cursor between the two halves of the window |
| `{"do":"follow"}` | the confirm button, on whatever the cursor is on |
| `{"do":"leave"}` | back out |
| `{"do":"look"}` | stand still and take a picture |
| `{"do":"wait","frames":60}` | let a second of the world go by |

A picture is written after every single step, numbered in order, into your `--out`
directory. **Look at them.** They are the game; the text the tool prints is only
enough to let you steer. If you want to know what somebody said, read the picture.

**Talk to at least three different people in each build.** Spend about ten minutes
of your attention on each. You do not have to be thorough and you do not have to
finish anything.

---

## Afterwards

1. Play the first build.
2. Open `PROMPT-verbatim.txt` and answer the five questions **about that build**,
   in your own words, and save them to a file.
3. Play the second build.
4. Answer the same five questions about it, and save them to a second file.
5. Only then, open `POST-PROMPT-preference.txt`.

Do not revise your first set of answers after playing the second build. If playing
the second build changed your mind about the first, say so in the preference answer
— that is a real observation and it belongs there, not in a quiet edit.

---

## If something breaks

Say so plainly and stop. A build that will not boot, a tool that throws, a picture
that is black — none of those are your fault and none of them should be worked
around. "I could not play it, here is the error" is a useful result. Guessing what
it would have been like is not.
