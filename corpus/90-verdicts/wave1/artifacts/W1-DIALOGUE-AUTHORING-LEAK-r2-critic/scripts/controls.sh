#!/usr/bin/env bash
# controls.sh — the round-2 critic's INDEPENDENT re-run of every control the round claims.
#
# Each control hand-authors the defect into the SHIPPED artefact (HAZARDS §31 rule 4), runs all
# four checks, records exit codes AND the grep evidence before/after, then restores the tree.
# Nothing here is inherited from the round-2 status file: the expected column is written from
# HAZARDS §31 and RI-MTH07, and the observed column is whatever comes out.
#
# Exit-code tuple printed as: leaks / consumer / voice / bookfold
set -uo pipefail
cd "$(dirname "$0")/../../../../../.." || exit 1
ROOT=$PWD
LEAK='Say it in one line. Local. Useful.'

run_all () {
  local a b c d
  node tools/dialogue/check-authoring-leaks.mjs   >/tmp/cw-leaks.txt    2>&1; a=$?
  node tools/dialogue/check-greeting-consumer.mjs >/tmp/cw-consumer.txt 2>&1; b=$?
  node tools/dialogue/check-greeting-voice.mjs    >/tmp/cw-voice.txt    2>&1; c=$?
  node tools/books/check-book-fold.mjs            >/tmp/cw-book.txt     2>&1; d=$?
  echo "    EXITS  leaks=$a consumer=$b voice=$c bookfold=$d"
  echo "$a/$b/$c/$d"
}

grepcount () { grep -c -- "$1" "$2" 2>/dev/null || true; }

restore () {
  git checkout -- game/data/dialogue/greetings.json game/data/dialogue/faction-refusals.json \
                  tools/dialogue/gen-greetings.mjs game/src/engine.js game/src/data/fold-books.js 2>/dev/null
  rm -f tools/dialogue/.tmp-* 2>/dev/null
}

banner () { echo; echo "==================== $* ===================="; }

trap restore EXIT

banner "BASELINE  (expect 0/0/0/0)"
run_all >/dev/null; run_all | tail -1 >/dev/null

banner "CONTROL A — delete the load-order guard INSIDE foldBooks()  (expect bookfold red)"
python3 - <<'PY'
import re,io
p='game/src/data/fold-books.js'
s=open(p).read()
before=s
# neutralise the guard condition so the fold reverts to last-write-wins
s2=s.replace("typeof existing.text === 'string' && typeof b.text !== 'string'","false")
assert s2!=before, 'guard needle not found'
open(p,'w').write(s2)
print('  patched fold-books.js: guard condition -> false')
PY
run_all
restore

banner "CONTROL B — leak at the AUTHORED SOURCE + regenerate  (expect leaks+consumer red)"
python3 - <<PY
p='tools/dialogue/gen-greetings.mjs'
s=open(p).read()
n="'Company time, and Leyawiin bought it.'"
assert n in s
open(p,'w').write(s.replace(n,"'Say it in one line.'",1))
print('  patched generator STANCE[RG-BWC].cold[3] -> the leak')
PY
node tools/dialogue/gen-greetings.mjs >/dev/null 2>&1
echo "    grep 'Say it in one line' in shipped greetings.json BEFORE checks: $(grepcount 'Say it in one line' game/data/dialogue/greetings.json)"
run_all
echo "    grep AFTER checks: $(grepcount 'Say it in one line' game/data/dialogue/greetings.json)"
restore

banner "CONTROL B2 — leak at the source, NO regenerate  (expect leaks red off source text alone)"
python3 - <<PY
p='tools/dialogue/gen-greetings.mjs'
s=open(p).read()
n="'Company time, and Leyawiin bought it.'"
open(p,'w').write(s.replace(n,"'Say it in one line.'",1))
PY
echo "    grep in shipped greetings.json (must stay 0): $(grepcount 'Say it in one line' game/data/dialogue/greetings.json)"
run_all
echo "    grep in shipped greetings.json after: $(grepcount 'Say it in one line' game/data/dialogue/greetings.json)"
restore

banner "CONTROL C — revert engine.js call site, leave foldBooks() correct  (expect leaks+bookfold red)"
python3 - <<'PY'
p='game/src/engine.js'
s=open(p).read()
n='foldBooks(this.data.books)'
assert n in s, 'call site needle absent'
i=s.index(n)
print('  call site context:', repr(s[max(0,i-90):i+40]))
s2=s.replace(n,'(() => { const books = new Map(); for (const doc of Object.values(this.data.books || {})) { if (Array.isArray(doc.books)) for (const b of doc.books) books.set(b.id, b); else if (doc.id) books.set(doc.id, doc); } return books; })()',1)
open(p,'w').write(s2)
print('  reverted to the old inline last-write-wins fold')
PY
run_all
restore

banner "CONTROL D — hand-author the leak into SHIPPED greetings.json  (expect red AND evidence survives)"
python3 - <<PY
import json
p='game/data/dialogue/greetings.json'
d=json.load(open(p))
d['pools'][180]['lines'][3]="$LEAK"
json.dump(d,open(p,'w'),indent=2)
open(p,'a').write('\n')
print('  wrote the leak into .pools[180].lines[3]')
PY
B=$(grepcount 'Say it in one line' game/data/dialogue/greetings.json); echo "    grep BEFORE run: $B"
S1=$(sha256sum game/data/dialogue/greetings.json | cut -c1-16)
run_all
A2=$(grepcount 'Say it in one line' game/data/dialogue/greetings.json); echo "    grep AFTER  run: $A2"
S2=$(sha256sum game/data/dialogue/greetings.json | cut -c1-16)
echo "    sha256(greetings.json) before=$S1 after=$S2  -> $([ "$S1" = "$S2" ] && echo UNTOUCHED || echo MUTATED)"
echo "    what the leaks check named:"; grep -A2 'FLAGGED' /tmp/cw-leaks.txt | head -5
restore

banner "CONTROL E — leak into a SPOKEN faction-refusal line  (expect leaks red)"
python3 - <<PY
import json
p='game/data/dialogue/faction-refusals.json'
d=json.load(open(p))
d['factions']['the_rootkeepers']['reputation']="TODO: say it in one line. Placeholder — keep it short, writer."
json.dump(d,open(p,'w'),indent=2)
open(p,'a').write('\n')
print('  wrote the leak into .factions.the_rootkeepers.reputation')
PY
echo "    grep BEFORE: $(grepcount 'Placeholder' game/data/dialogue/faction-refusals.json)"
run_all
echo "    grep AFTER : $(grepcount 'Placeholder' game/data/dialogue/faction-refusals.json)"
grep -A2 'FLAGGED' /tmp/cw-leaks.txt | head -5
restore

banner "CONTROL F — put round 1's REJECTED line back in the slot  (expect voice red, leaks green)"
python3 - <<'PY'
import json
p='game/data/dialogue/greetings.json'
d=json.load(open(p))
for i in range(180,185):
    l=d['pools'][i]['lines'][3]
    d['pools'][i]['lines'][3]=l.replace('Company time, and Leyawiin bought it.','The writ says nothing about talk.')
json.dump(d,open(p,'w'),indent=2); open(p,'a').write('\n')
print('  substituted round 1 line into all 5 RG-BWC/cold[3] cells')
PY
run_all
echo "    voice check said:"; grep -E 'FAIL|ok  ' /tmp/cw-voice.txt | head -8
restore

banner "CONTROL G1 — generator guard stripped + leak in shipped file (expect leaks red, evidence survives)"
python3 - <<PY
import json
p='tools/dialogue/gen-greetings.mjs'
s=open(p).read()
n='if (RUN_DIRECTLY) {'
assert n in s
open(p,'w').write(s.replace(n,'if (true) {',1))
q='game/data/dialogue/greetings.json'
d=json.load(open(q)); d['pools'][180]['lines'][3]="$LEAK"
json.dump(d,open(q,'w'),indent=2); open(q,'a').write('\n')
print('  RUN_DIRECTLY -> true, and the leak hand-authored into the shipped file')
PY
echo "    grep BEFORE: $(grepcount 'Say it in one line' game/data/dialogue/greetings.json)"
run_all
echo "    grep AFTER : $(grepcount 'Say it in one line' game/data/dialogue/greetings.json)"
restore

banner "CONTROL G2 — round-1 shape reconstructed on a COPY of the check (expect exit 4 tripwire)"
python3 - <<PY
import json
p='tools/dialogue/gen-greetings.mjs'
s=open(p).read()
open(p,'w').write(s.replace('if (RUN_DIRECTLY) {','if (true) {',1))
c='tools/dialogue/check-authoring-leaks.mjs'
s=open(c).read()
# restore the round-1 shape: import the generator for its side effect
s=s.replace("function main() {","async function main() {\n  await import('./gen-greetings.mjs');",1)
s=s.replace("\nmain();","\nawait main();")
open('/tmp/cw-r1shape.mjs','w').write(s)
q='game/data/dialogue/greetings.json'
d=json.load(open(q)); d['pools'][180]['lines'][3]="$LEAK"
json.dump(d,open(q,'w'),indent=2); open(q,'a').write('\n')
print('  round-1 shape written to /tmp/cw-r1shape.mjs (copy, not the shipped check)')
PY
cp /tmp/cw-r1shape.mjs tools/dialogue/.tmp-r1shape.mjs
echo "    grep BEFORE: $(grepcount 'Say it in one line' game/data/dialogue/greetings.json)"
node tools/dialogue/.tmp-r1shape.mjs >/tmp/cw-g2.txt 2>&1; echo "    round-1-shaped check EXIT=$?"
head -3 /tmp/cw-g2.txt; grep -c 'EVIDENCE-MUTATION TRIPWIRE' /tmp/cw-g2.txt | sed 's/^/    tripwire lines: /'
echo "    grep AFTER : $(grepcount 'Say it in one line' game/data/dialogue/greetings.json)"
rm -f tools/dialogue/.tmp-r1shape.mjs
restore

banner "TREE RESTORED?"
git status --short -- game/data tools/dialogue tools/books tools/lib game/src/engine.js game/src/data
sha256sum game/data/dialogue/greetings.json game/data/dialogue/faction-refusals.json \
          tools/dialogue/gen-greetings.mjs game/src/engine.js game/src/data/fold-books.js
