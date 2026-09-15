---
name: battleships-ui-testing
description: Run local visual and end-to-end Battleships UI checks without accessing hidden enemy state.
---

# Local setup
- Plain ES modules; no build or login. Run `npm run serve` in the repo.
- The default port is 4173. If occupied, use `PORT=4174 npm run serve` and follow the printed URL; do not terminate an unknown existing service.
- Use `?seed=11&delay=0` for repeatable fast games. Reload resets the seeded game; Change difficulty/Play again may advance the game's seed.
- localStorage is origin/port-specific. Avatar is `battleships.avatar`; per-level winning bests are `battleships.best`. Prefer a fresh origin over deleting an existing user's data.

# UI paths and visual checks
- Landing officer cards have test IDs `level-easy`, `level-medium`, `level-hard`.
- Avatar buttons use accessible names `Avatar 1` through `Avatar 5`; selected state is `aria-pressed=true`.
- Start a game: officer card → `randomise` → `start`.
- Complete game: `result`, `go-shots` summarize outcome; `change-difficulty` returns to landing.
- DOM landing order intentionally differs from visual order: first Tab is easy, second medium. Verify visual ordering using screenshots.
- Check mobile at an exact 360 CSS pixel viewport; scroll to lazy-loaded images before inspecting completeness.

# Full games without cheating
- Fire by clicking `[data-testid="target"] button`; read only those buttons' public coordinate/state aria-labels.
- Wait for `[data-testid="turn"]` to show `Your turn` or for `game-over` after each shot.
- A checkerboard hunt with adjacent-`hit` targeting is fast enough to win on easy. Never inspect hidden fleet data or call game dispatch directly.
- Reload seed 11, Randomise once, and vary forward/reverse checkerboard hunt order to exercise different legitimate winning scores.
- Compare the rendered personal-best line to `go-shots`, then verify a better win replaces it, a worse win preserves it, and a loss creates no best.

## Devin Secrets Needed
None for local runtime testing.
