#!/bin/sh
# One command. §P.1 of orchestration/NEXT-DISPATCH.md asks for "clone, one command, a browser
# window", and until now there wasn't one — the game had only ever been opened by a harness on an
# ephemeral port. Two critics wrote their own server before they could play it by hand.
#
# This is a two-line shim on purpose: the work is in tools/play.mjs, which uses the same serveDir
# every instrument uses, so a person and a probe see the same build on the same headers.
exec node "$(dirname "$0")/tools/play.mjs" "$@"
