# Battleships

A single-player Battleships game against the computer, written in plain HTML,
CSS and JavaScript. No framework, no build step, nothing to install to play.

**Play it:** https://cog-demo10.github.io/battleships/

## How it plays

1. **Pick an opponent** – Easy, Medium or Hard. The level stays on screen for
   the whole game.
2. **Place your fleet** – five ships (Carrier 5, Battleship 4, Cruiser 3,
   Submarine 3, Destroyer 2) on a 10×10 grid. Click a cell for the ship's
   left/top end; the *Orientation* button flips between horizontal and vertical.
   A placement that overlaps another ship or runs off the grid is refused with a
   message and nothing changes. *Randomise* lays out a valid fleet for you
   (ships may touch). You cannot start until all five are placed.
3. **Take turns** – click a cell on the *Target grid* to fire. The computer
   fires back after a short pause. Your own board shows where you've been hit.
   The status line shows whose turn it is and the last result; the move log
   lists every shot. When a ship is sunk it is named.
4. **Game over** – the first side to sink all five ships wins. The final screen
   shows the result, your shot count and accuracy, the game's *seed* and the
   deployed build, and the target grid turns round: any enemy ships you never
   found are drawn in place, outlined in yellow so they stand apart from the
   ones you sank. *Play again* keeps the level and deals a new game; *Change
   difficulty* returns to the start screen.

Everything works from the keyboard: Tab to a board, move with the arrow keys,
fire with Enter or Space. Every cell is announced as "B7, unknown", "B7, hit",
and so on. The layout fits a 360px-wide phone, with the target grid on top.

## How the computer plays

The computer never sees your board. After each of its shots it is told only
*miss*, *hit*, or *sunk* plus the size of the ship it sank, and it works
everything else out from its own record of past shots.

| Level  | Strategy | Typical shots to win |
|--------|----------|----------------------|
| Easy   | Fires at a random cell it hasn't tried. Remembers nothing. | ~95 |
| Medium | Hunts on a checkerboard (every ship must cross it). On a hit it tries the neighbours; once two hits line up it only extends along that line until the ship sinks, then goes back to hunting. | ~52 |
| Hard   | For every unknown cell, counts the ways the remaining ships could still be placed given all misses, hits and wrecks, and fires where that count is highest. Cells that would explain an unresolved hit are weighted heavily. | ~45 |

These numbers come from `test/simulation.test.js`, which plays all three levels
against 500 random fleets and prints a mean / median / 90th-percentile table.

Each game has a **seed**. The same seed with the same moves reproduces the same
enemy fleet and the same computer shots, so a game can be replayed exactly:
open `?seed=12345` on the URL.

## File layout

```
index.html, styles.css      the page
version.json                build stamp shown in the footer (written on deploy)
src/
  rng.js                    the only place random numbers come from
  engine/                   the rules: grid coordinates, boards, ships, fleets
  ai/                       the three computer opponents and their memory
  game/                     the turn-by-turn state machine that ties rules and AI together
  ui/                       everything that touches the page
test/                       unit tests (Node's built-in runner)
e2e/                        browser tests (Playwright) and a tiny static server
.github/workflows/          CI on every push; deploy to GitHub Pages from main
```

The rules (`engine`), the opponents (`ai`) and the state machine (`game`) never
touch the page, so they can be tested in Node without a browser. The opponents
are only allowed to import `engine/coords.js`; a test fails if they reach for
anything that knows where ships are.

## Running the tests

You need [Node.js](https://nodejs.org/) 22 or later.

```sh
git clone https://github.com/cog-demo10/battleships.git
cd battleships
npm test               # unit, property, simulation and import-boundary tests
npm run coverage       # same, with a line-coverage report (engine/ai/game must be >= 90%)

npm ci                 # once: installs Playwright, the only development dependency
npx playwright install --with-deps chromium
npm run test:e2e       # plays full games in a real browser; fails on any console error
```

To play locally: `npm run serve` and open http://localhost:4173/.

## Licence

MIT – see [LICENSE](LICENSE).
