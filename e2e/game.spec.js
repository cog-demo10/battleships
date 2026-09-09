import { test, expect } from '@playwright/test';
import {
  openGame, startGame, targetCell, unknownTargetCells, waitForPlayerTurn, playToEnd, readLog, readTargetBoard,
} from './helpers.js';

test.describe('full games', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    test(`criteria 1, 7, 8c, 11, 12c: a complete game on ${level} with no console errors`, async ({ page }) => {
      const game = await openGame(page, { seed: 11 });
      await startGame(page, level);
      await expect(page.getByTestId('level')).toHaveText(`Level: ${level}`);

      let sunkSeen = 0;
      for (let i = 0; i < 100 && (await page.getByTestId('game-over').count()) === 0; i++) {
        await unknownTargetCells(page).first().click();
        await waitForPlayerTurn(page);
        const log = await readLog(page);
        const last = log.filter((e) => e.by === 'player').at(-1);
        if (last.kind === 'sunk') {
          sunkSeen++;
          // 8c: the sunk message names a ship and the counter decrements by one.
          await expect(page.getByTestId('log-entry').nth(last.n - 1))
            .toHaveText(/sunk \((Carrier|Battleship|Cruiser|Submarine|Destroyer)\)/);
          if (await page.getByTestId('game-over').count() === 0) {
            await expect(page.getByTestId('remaining')).toContainText(`Enemy ships left: ${5 - sunkSeen}`);
          }
        }
      }
      await expect(page.getByTestId('game-over')).toBeVisible();
      await expect(page.getByTestId('level')).toHaveText(`Level: ${level}`);
      await expect(page.getByTestId('go-level')).toHaveText(level);
      await expect(page.getByTestId('go-seed')).toHaveText('11');
      await expect(page.getByTestId('go-commit')).not.toBeEmpty();

      // 7: move log and grid never disagree.
      const log = await readLog(page);
      const board = await readTargetBoard(page);
      const playerShots = log.filter((e) => e.by === 'player');
      for (const e of playerShots) {
        const state = board[e.label];
        if (e.kind === 'miss') expect(state).toBe('miss');
        else expect(['hit', 'sunk']).toContain(state);
      }
      const known = Object.values(board).filter((s) => s !== 'unknown').length;
      expect(known).toBe(playerShots.length);
      // AI fires exactly once per player shot (unless the player's shot ended the game).
      const aiShots = log.filter((e) => e.by === 'ai').length;
      const playerWon = (await page.getByTestId('result').textContent()) === 'You win!';
      expect(aiShots).toBe(playerWon ? playerShots.length - 1 : playerShots.length);
      await expect(page.getByTestId('go-shots')).toHaveText(String(playerShots.length));

      // 11: the game is over; no further shots are accepted.
      const before = log.length;
      await unknownTargetCells(page).first().click({ force: true });
      expect((await readLog(page)).length).toBe(before);
      game.assertNoErrors();
    });
  }
});

test('criterion 2: overlapping and off-grid placements are visibly refused, not applied', async ({ page }) => {
  const game = await openGame(page);
  await page.getByTestId('level-easy').click();
  const fleetCell = (label) => page.locator(`[data-cell="fleet-${label}"]`);

  await fleetCell('A1').click(); // Carrier A1–A5 horizontal
  await expect(page.getByTestId('placement-instructions')).toContainText('Battleship');
  await expect(fleetCell('A5')).toHaveAttribute('aria-label', 'A5, ship');

  await fleetCell('A3').click(); // overlaps the Carrier
  await expect(page.getByTestId('placement-error')).toContainText(/overlap|leave the grid/);
  await expect(page.getByTestId('placement-instructions')).toContainText('Battleship');
  await expect(fleetCell('A6')).toHaveAttribute('aria-label', 'A6, empty');

  await fleetCell('B8').click(); // Battleship B8–B11 runs off the grid
  await expect(page.getByTestId('placement-error')).toContainText(/overlap|leave the grid/);
  await expect(page.getByTestId('placement-instructions')).toContainText('Battleship');
  await expect(fleetCell('B8')).toHaveAttribute('aria-label', 'B8, empty');

  await page.getByTestId('orientation').click();
  await expect(page.getByTestId('orientation')).toHaveText(/vertical/);
  await fleetCell('I1').click(); // vertical from I would need rows I–L
  await expect(page.getByTestId('placement-error')).toContainText(/overlap|leave the grid/);

  await fleetCell('B1').click(); // valid: B1–E1 vertical
  await expect(page.getByTestId('placement-error')).toHaveText('');
  await expect(page.getByTestId('placement-instructions')).toContainText('Cruiser');
  game.assertNoErrors();
});

test('criterion 4: cannot start with fewer than five ships', async ({ page }) => {
  const game = await openGame(page);
  await page.getByTestId('level-easy').click();
  await expect(page.getByTestId('start')).toBeDisabled();
  await page.locator('[data-cell="fleet-A1"]').click();
  await expect(page.getByTestId('start')).toBeDisabled();
  await page.getByTestId('randomise').click();
  await expect(page.getByTestId('start')).toBeEnabled();
  await page.getByTestId('clear').click();
  await expect(page.getByTestId('start')).toBeDisabled();
  game.assertNoErrors();
});

test('criteria 5, 6: clicking a known cell does nothing; player never fires twice in a row', async ({ page }) => {
  const game = await openGame(page, { seed: 3, delay: 300 });
  await startGame(page, 'easy');
  await targetCell(page, 'E5').click();
  // The computer is "thinking": further clicks must be ignored.
  await expect(page.getByTestId('turn')).toHaveText('Computer is firing…');
  await targetCell(page, 'F5').click({ force: true });
  await waitForPlayerTurn(page);
  let log = await readLog(page);
  expect(log.map((e) => e.by)).toEqual(['player', 'ai']);
  expect(log[0].label).toBe('E5');

  await targetCell(page, 'E5').click({ force: true }); // known cell
  await page.waitForTimeout(400);
  log = await readLog(page);
  expect(log).toHaveLength(2);
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
  game.assertNoErrors();
});

test('criteria 12a, 12b: Play again resets the board on the same level; Change difficulty returns to start', async ({ page }) => {
  const game = await openGame(page, { seed: 5 });
  await startGame(page, 'hard');
  await playToEnd(page);
  await expect(page.getByTestId('go-level')).toHaveText('hard');
  const seedBefore = await page.getByTestId('go-seed').textContent();

  await page.getByTestId('play-again').click();
  await expect(page.getByTestId('placement-screen')).toBeVisible();
  await expect(page.getByTestId('level')).toHaveText('Level: hard');
  await page.getByTestId('randomise').click();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('remaining')).toContainText('Enemy ships left: 5');
  await expect(page.getByTestId('log-entry')).toHaveCount(0);
  const board = await readTargetBoard(page);
  expect(Object.values(board).every((s) => s === 'unknown')).toBe(true);
  await expect(page.getByTestId('level')).toHaveText('Level: hard');

  await playToEnd(page);
  expect(await page.getByTestId('go-seed').textContent()).not.toBe(seedBefore);
  await page.getByTestId('change-difficulty').click();
  await expect(page.getByTestId('start-screen')).toBeVisible();
  await startGame(page, 'easy');
  await expect(page.getByTestId('level')).toHaveText('Level: easy');
  game.assertNoErrors();
});

test('criterion 16: target-board DOM before the first shot is byte-identical across seeds', async ({ page }) => {
  const html = [];
  for (const seed of [101, 202]) {
    const game = await openGame(page, { seed });
    await startGame(page, 'medium');
    html.push(await page.getByTestId('target').evaluate((el) => el.outerHTML));
    // Nothing in the whole document may differ either — enemy positions must not exist anywhere.
    game.assertNoErrors();
  }
  expect(html[0]).toBe(html[1]);
  expect(html[0]).not.toMatch(/ship|occupant/);
});

test('criterion 20: footer shows the build stamp', async ({ page }) => {
  const game = await openGame(page);
  await expect(page.getByTestId('commit')).toHaveText(/^[0-9a-f]{7,40}$|^dev$/);
  game.assertNoErrors();
});
