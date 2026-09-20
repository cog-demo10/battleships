# Bugs

A log of bugs found in this project and how each was fixed. There is no issue
tracker; this file is compiled from the git history, so every entry points at
the commit that made the change. Run `git show <sha>` to see the exact diff.
Entries are in the order the fixes landed.

## AI could attribute a sink to the wrong cells

*Symptom* – when the computer sank a ship it was only told the ship's size,
not which cells. Where two ships touched it sometimes marked the wrong run of
hits as the wreck, then kept hunting around cells that were already dead.

*Cause* – `sunkRun` in `src/ai/memory.js` took the first straight run of hits
through the sunk cell that was at least the reported size, without checking
whether the choice left some other hit in a place no remaining ship could
occupy.

*Fix* – `sunkRun` now ranks every candidate run (exact-length runs first,
then the current target axis) and picks the first that leaves every other hit
still `coverable` by a remaining ship. `extensionCandidates` was added as a
line-extension fallback for when the record has become inconsistent; `hard.js`
and `medium.js` use it. Regression test in `test/ai.test.js`; the same commit
added the 500-fleet simulation test and CI workflow.

Commit `8fb137ff`.

## AI still mis-attributed sinks on touching collinear ships; snapshots were mutable

*Symptom* – with two ships end to end on one line, the tie-break above could
still assign a sink to cells of the neighbouring ship. The later sink then had
a contiguous hit run shorter than its size and the AI fell back to marking a
single cell, leaving stale "hits" it kept chasing. Separately, `createGame`
returned snapshots whose nested objects were writable and kept a reference to
the caller's `fleet` array, so a caller could alter internal state.

*Cause* – `sunkRun` had no path for "run shorter than the ship", and
`observe` never revisited hits that had become impossible to cover. In
`src/game/game.js`, `snapshot()` used a shallow `Object.freeze` and the
`fleet` option was used as-is.

*Fix* – in `src/ai/memory.js`, when no candidate run exists `sunkRun` re-reads
the wreck as any span of `size` hit-or-sunk cells through the sunk cell,
preferring the span with the most hits; after each sink `observe` marks any
leftover hit that no remaining ship could cover as `sunk` so it stops being a
lead. In `src/game/game.js`, a `deepFreeze` helper freezes snapshots
recursively and `createGame` copies the fleet input (`{ name, length }` only)
before freezing it. Tests in `test/ai.test.js` and `test/game.test.js`.

Commit `ac02c4bd`.

## Missing `?seed` / `?delay` parsed as 0

*Symptom* – opening the page with no query string always dealt seed 0 (the
same game every time) and fired the computer's shots with no pause.

*Cause* – `src/ui/main.js` did `Number(params.get('seed'))`;
`URLSearchParams.get` returns `null` for an absent parameter and
`Number(null)` is `0`, which passed the "non-negative integer" check and so
never fell through to `randomSeed()` / the 600 ms default.

*Fix* – a `numericParam(name, valid, fallback)` helper treats an absent or
blank parameter as missing and only then validates the number. An e2e test in
`e2e/game.spec.js` loads the page without a query string twice and checks the
two games differ (and that the computer's pause is real).

Commit `45240d17`.

## Follow-up: option parsing made testable

*Symptom* – the fix above lived inside `main.js`, which touches the DOM, so it
could only be checked in a browser.

*Fix* – extracted `readOptions(searchString)` into `src/ui/options.js` as a
pure function; `main.js` calls it with `location.search`. `test/options.test.js`
covers the no-parameter defaults, an explicit `seed=0` (which must be honoured,
not treated as missing), and malformed values.

Commit `53bedcec`.

## Portraits crowded the boards; `recordBest` could overwrite a newer best

*Symptom* – on two-column layouts between 720px and 900px the officer
portraits sat beside the grids and squeezed them. Also, a personal best saved
by another tab (or an earlier game in the same tab) could be replaced by a
worse score.

*Cause* – `styles.css` put the portrait row layout in the same media query as
the two-column boards. `recordBest` in `src/ui/avatar.js` compared against the
`bests` object it was handed, which could be older than what was in
`localStorage`.

*Fix* – the row layout and 96px portrait size moved to their own
`@media (min-width: 900px)` block. `recordBest` first merges the argument with
`loadBests()` and compares the new score against the merged record, returning
the merged record when the score is not a new best.

Commit `b0f1e2a2`.

## AI shot fired after leaving the game

*Symptom* – pressing *Home* (or otherwise leaving the playing phase) during
the pause before the computer's shot did not stop the shot; the pending
`setTimeout` still fired and dispatched a move against a game that was no
longer on screen.

*Cause* – `paint()` in `src/ui/main.js` called `scheduleAi()` when it was the
computer's turn but nothing ever cleared `aiTimer` when the phase changed.

*Fix* – added `cancelAi()`; every paint now either schedules the AI (playing
phase, AI turn) or cancels any pending timer. e2e regression in
`e2e/game.spec.js`.

Commit `b1e74a7b`.
