# Bugs

This project has no issue tracker. Software engineering, implementation and technical validation were carried out through Devin (the engineering agent); product decisions and manual gameplay/acceptance were done by the author. This document records the bugs found and how each was fixed. Every entry points at the commit that made the change; run `git show <sha>` to see the exact diff.

## Testing methodology

Confidence in the game was built from four complementary feedback loops.

**Automated code review (Devin Review).** Each pull request was reviewed by Devin Review, which comments on the diff before merge. It caught defects 1–3 on PR #2 (`src/ai/memory.js`, `src/game/game.js`, `src/ui/main.js`) before the fix commits landed. It is not a substitute for tests: on PR #8 it reported "No Issues Found" even though that PR fixed defect 7.

**Technical validation (through Devin).** The project has an automated suite run with `node --test`, with a coverage gate requiring ≥ 90% line coverage across the `engine`, `ai` and `game` modules. It includes a 500-fleet × 3-level simulation that plays every fleet to completion from a redacted view, import-boundary and `Math.random`-ban checks enforced as tests, and a Playwright end-to-end suite (desktop and 360px) that fails on any browser console error. Both suites run in CI.

**Manual gameplay / user acceptance.** The author also played and reviewed the game as a user — checking whether the experience behaved as expected and felt complete, rather than only whether tests passed.

**Deployed-product verification.** The published GitHub Pages build (https://cog-demo10.github.io/battleships/) was also checked. A post-deploy CI job verifies the live build carries the deployed commit and runs a browser smoke test against the live URL. This distinction mattered: at least one defect passed locally but only showed up on the published site.

## 1. The computer could blame a sink on the wrong squares

**Observed behaviour.** When the computer sank one of your ships it was told only the ship's size, not which squares it occupied. Where two ships touched, it sometimes marked the wrong run of hits as the wreck and then kept firing around squares that were already dead.

**Cause.** `sunkRun` in `src/ai/memory.js` took the first straight run of hits through the sunk square that was at least the reported size, without checking whether that choice stranded another hit where no remaining ship could sit.

**Fix.** `sunkRun` now ranks candidate runs (exact-length runs first, then the current target axis) and picks the first that leaves every other hit still coverable by a remaining ship. A line-extension fallback, `extensionCandidates`, was added for when the record has become inconsistent; `hard.js` and `medium.js` use it.

**Verification.** Regression test in `test/ai.test.js`; the same commit added the 500-fleet simulation (`test/simulation.test.js`) and the CI workflow.

**How it was found.** Automated code review (Devin Review) on PR #2 — a review comment on `src/ai/memory.js` flagged that touching ships corrupt the target memory, raised before the fix commit.

**Commit.** `8fb137ff`.

## 2. The same mis-attribution survived on ships end-to-end; snapshots were mutable

**Observed behaviour.** With two ships placed end to end on one line, the tie-break above could still assign a sink to the neighbouring ship's squares. The later sink then had a hit run shorter than its size, so the computer fell back to marking a single square and kept chasing stale "hits". Separately, `createGame` returned game snapshots whose nested objects were writable and which held a reference to the caller's `fleet` array, so a caller could alter internal state.

**Cause.** `sunkRun` had no path for a run shorter than the ship, and `observe` never revisited hits that had become impossible to cover. In `src/game/game.js`, `snapshot()` used a shallow `Object.freeze` and the `fleet` option was used as-is.

**Fix.** In `src/ai/memory.js`, when no candidate run exists `sunkRun` re-reads the wreck as any span of `size` hit-or-sunk squares through the sunk square, preferring the span with the most hits; after each sink, `observe` marks any leftover hit that no remaining ship could cover as sunk so it stops being a lead. In `src/game/game.js`, a `deepFreeze` helper freezes snapshots recursively and `createGame` copies the fleet input (`{ name, length }` only) before freezing it.

**Verification.** Tests in `test/ai.test.js` and `test/game.test.js`.

**How it was found.** Automated code review (Devin Review) on PR #2 — a review comment on `src/game/game.js` flagged that snapshots expose mutable game state.

**Commit.** `ac02c4bd`.

## 3. Opening the page with no options always dealt the same game with no pause

**Observed behaviour.** Loading the page without a query string always used seed 0 (the identical game every time) and fired the computer's shots with no pause.

**Cause.** `src/ui/main.js` did `Number(params.get('seed'))`; `URLSearchParams.get` returns `null` for an absent parameter and `Number(null)` is `0`, which passed the "non-negative integer" check instead of falling through to a random seed / the 600 ms default.

**Fix.** A `numericParam(name, valid, fallback)` helper treats an absent or blank parameter as missing and only then validates the number. The parsing was then extracted into a pure `readOptions(searchString)` in `src/ui/options.js` (called by `main.js` with `location.search`) so it could be tested without a browser.

**Verification.** An end-to-end test in `e2e/game.spec.js` loads the page twice with no query string and checks that the two games differ and that the computer's pause is real; `test/options.test.js` covers the no-parameter defaults, an explicit `seed=0` (which must be honoured, not treated as missing) and malformed values.

**How it was found.** Automated code review (Devin Review) on PR #2 — a review comment on `src/ui/main.js` flagged that default visits reuse seed zero (`Number(null)` selecting seed 0).

**Commit.** `45240d17` (with the testability extraction in `53bedcec`).

## 4. The hit marker was hard to read over the scorch effect

**Observed behaviour.** After the board was restyled, the letter/marker shown on a hit square was drawn in near-black over a dark "scorch burst" background, making it difficult to read.

**Cause.** The reskin (`7a975439`) set the hit-cell text colour to a very dark value while the cell's decorative background was also dark, leaving too little contrast, in `styles.css`.

**Fix.** The hit and sunk markers now use light text with a dark halo (text shadow) and the scorch burst was lightened slightly, in `styles.css`.

**Verification.** Verified manually by reviewing the board; there is no automated legibility test.

**How it was found.** Manual review of the board after the reskin.

**Commit.** `23ae5be2`.

## 5. Portraits crowded the boards; a personal best could be overwritten

**Observed behaviour.** On two-column layouts between 720px and 900px the officer portraits sat beside the grids and squeezed them. Separately, a personal best saved by another tab (or an earlier game in the same tab) could be replaced by a worse score.

**Cause.** `styles.css` put the portrait-row layout in the same media query as the two-column boards. `recordBest` in `src/ui/avatar.js` compared against the `bests` object it was handed, which could be staler than what was in `localStorage`.

**Fix.** The portrait-row layout and 96px size moved to their own `@media (min-width: 900px)` block. `recordBest` now merges its argument with `loadBests()` before comparing, and returns the merged record when the score is not a new best.

**Verification.** Verified manually — the layout at the affected breakpoints and the best-score behaviour were checked; this commit did not add an automated test.

**How it was found.** Manual review of the layout at the affected breakpoints and of the best-score behaviour.

**Commit.** `b0f1e2a2`.

## 6. Officer and avatar images were missing on the live site

**Observed behaviour.** The officer and avatar PNGs displayed correctly when running locally but were absent on the deployed GitHub Pages site.

**Cause.** The deploy workflow assembled the published site by copying a fixed list of files into the artifact and did not include the `assets/` folder, so the images were never published.

**Fix.** `assets` was added to the files copied into the Pages artifact in `.github/workflows/deploy.yml`.

**Verification.** Confirmed by re-checking the deployed site, where the images now load; the deploy workflow also runs a post-deploy job asserting the live build carries the deployed commit.

**How it was found.** Noticed by the author while playing/reviewing the deployed game.

**Commit.** `ce43cabc`.

## 7. The computer fired after you had already left the game

**Observed behaviour.** Pressing *Home* (or otherwise leaving the playing phase) during the pause before the computer's shot did not stop it; the pending timer still fired and dispatched a move against a game that was no longer on screen.

**Cause.** `paint()` in `src/ui/main.js` scheduled the computer's shot when it was its turn but nothing cleared the pending timer when the phase changed.

**Fix.** Added `cancelAi()`; every paint now either schedules the computer's shot (playing phase, its turn) or cancels any pending timer.

**Verification.** End-to-end regression test in `e2e/game.spec.js`.

**How it was found (inferred).** Not documented at the time. It was not flagged by automated code review (Devin Review reported "No Issues Found" on PR #8) and was not caught by the automated test suite. The fix landed in PR #8 immediately after the Home button feature (`7cb0c311`), which first made it possible to leave the game mid-turn; the inference from that commit sequence is that the engineer anticipated or hit the race while building the Home button.

**Commit.** `b1e74a7b`.
