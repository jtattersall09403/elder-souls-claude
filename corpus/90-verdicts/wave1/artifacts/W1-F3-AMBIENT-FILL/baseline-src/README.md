These two files are game/src/render/post/composite.js and game/src/render/renderer.js EXACTLY as they
stood at the pinned pre-F3 baseline eafd13168e1fed354be0afb2709051d473f09f4a ("Roadmap: F2 is
delivered on stills alone, and the directive asks for motion"), produced by `git show <sha>:<path>`.

They exist so the delete-the-fix control can be reconstructed anywhere, including on a rented GPU Pod
that has no .git — HAZARDS.md 12: the control tree must come from the PINNED sha, never from HEAD,
because a sibling whole-tree bank can carry the fix into HEAD and turn the control green for the
wrong reason.

F1 (materials) and F2 (contact shadows / SSAO) are ALREADY PRESENT in these files: the pinned commit
is after both landed. `git diff eafd1316 HEAD -- <those two paths>` is 86 insertions, 1 deletion, and
is F3 and nothing else. So restoring these two files removes F3 and leaves F1 and F2 standing, which
is what makes this control a test of F3 rather than of the whole three-remedy stack.
