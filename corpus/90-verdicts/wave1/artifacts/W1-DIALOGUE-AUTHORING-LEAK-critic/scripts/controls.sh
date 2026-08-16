#!/usr/bin/env bash
# Critic's negative controls for W1-DIALOGUE-AUTHORING-LEAK.
# Every arm mutates the tree, runs a check, prints the exit code, and RESTORES from git.
# Run from the repo root. Requires a clean working tree for the four touched files.
set -u
cd "$(git rev-parse --show-toplevel)"
TOUCHED="game/src/data/fold-books.js game/src/engine.js tools/dialogue/gen-greetings.mjs game/data/dialogue/greetings.json game/data/dialogue/faction-refusals.json"
restore() { git checkout -- $TOUCHED 2>/dev/null; }
trap restore EXIT

hr() { echo; echo "=================================================================="; echo "$*"; echo "=================================================================="; }

hr "BASELINE — all three checks on the tree as landed at 43d26e6e"
node tools/dialogue/check-authoring-leaks.mjs --self-test >/dev/null 2>&1; echo "check-authoring-leaks   EXIT=$?  (expect 0)"
node tools/dialogue/check-greeting-consumer.mjs   >/dev/null 2>&1; echo "check-greeting-consumer EXIT=$?  (expect 0)"
node tools/books/check-book-fold.mjs --self-test  >/dev/null 2>&1; echo "check-book-fold         EXIT=$?  (expect 0)"
restore

hr "CONTROL A — delete the guard INSIDE foldBooks(). The old number must come back."
python3 - <<'PY'
p='game/src/data/fold-books.js'; s=open(p).read()
g="        if (existing && typeof existing.text === 'string' && typeof b.text !== 'string') continue;\n"
assert g in s, 'guard line not found — this control is stale, fix it'
open(p,'w').write(s.replace(g,''))
PY
node tools/books/check-book-fold.mjs --self-test 2>&1 | grep -E "FIXED arm|FAIL:"
node tools/books/check-book-fold.mjs --self-test >/dev/null 2>&1; echo "check-book-fold EXIT=$?  (expect 1 — control PASSES if this is 1)"
restore

hr "CONTROL B — reintroduce the leak at the authored source. Both dialogue checks must fail."
python3 - <<'PY'
p='tools/dialogue/gen-greetings.mjs'; s=open(p).read()
old="'The writ says nothing about talk.'"
assert old in s
open(p,'w').write(s.replace(old,"'Say it in one line.'",1))
PY
node tools/dialogue/gen-greetings.mjs >/dev/null 2>&1
node tools/dialogue/check-authoring-leaks.mjs   >/dev/null 2>&1; echo "check-authoring-leaks   EXIT=$?  (expect 1)"
node tools/dialogue/check-greeting-consumer.mjs >/dev/null 2>&1; echo "check-greeting-consumer EXIT=$?  (expect 1)"
restore; node tools/dialogue/gen-greetings.mjs >/dev/null 2>&1; restore

hr "CONTROL C — revert engine.js's CALL SITE to the old inline fold; leave foldBooks() correct."
echo "This is the coupling control: the game ships the defect again, foldBooks() is still right."
python3 - <<'PY'
p='game/src/engine.js'; s=open(p).read()
old="    const books = foldBooks(this.data.books);"
assert old in s
new="""    const books = new Map();
    for (const doc of Object.values(this.data.books || {})) {
      if (Array.isArray(doc.books)) for (const b of doc.books) books.set(b.id, b);
      else if (doc.id) books.set(doc.id, doc);
    }"""
open(p,'w').write(s.replace(old,new))
PY
node tools/books/check-book-fold.mjs --self-test  >/dev/null 2>&1; echo "check-book-fold         EXIT=$?  (expect 1 if the check guards the game; it returns 0)"
node tools/dialogue/check-authoring-leaks.mjs     >/dev/null 2>&1; echo "check-authoring-leaks   EXIT=$?"
node tools/dialogue/check-greeting-consumer.mjs   >/dev/null 2>&1; echo "check-greeting-consumer EXIT=$?"
restore

hr "CONTROL D — hand-author the leak straight into the SHIPPED greetings.json (no generator)."
python3 - <<'PY'
import json
p='game/data/dialogue/greetings.json'; d=json.load(open(p))
d['pools'][0]['lines'][0]='TODO: placeholder line, keep it short. Say it in one line.'
json.dump(d,open(p,'w'),indent=2)
PY
echo "occurrences of the leak in the shipped file BEFORE the check: $(grep -c 'Say it in one line' game/data/dialogue/greetings.json)"
node tools/dialogue/check-authoring-leaks.mjs >/dev/null 2>&1; echo "check-authoring-leaks   EXIT=$?  (expect 1; it returns 0)"
echo "occurrences AFTER the check ran:                            $(grep -c 'Say it in one line' game/data/dialogue/greetings.json)"
echo "-> the check REGENERATES the file it scans, so it erased the defect and reported its absence."
restore

hr "CONTROL E — hand-author the leak into a SPOKEN faction-refusal line (key not in TEXT_KEYS)."
python3 - <<'PY'
import json
p='game/data/dialogue/faction-refusals.json'; d=json.load(open(p))
f=list(d['factions'])[0]
d['factions'][f]['reputation']='TODO: say it in one line. Placeholder — keep it short, writer.'
json.dump(d,open(p,'w'),indent=2)
print('injected into factions.%s.reputation — spoken by FactionRefusals.speak()'%f)
PY
node tools/dialogue/check-authoring-leaks.mjs >/dev/null 2>&1; echo "check-authoring-leaks   EXIT=$?  (expect 1; it returns 0)"
restore

hr "DONE — tree restored"
git status --short $TOUCHED
