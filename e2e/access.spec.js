import { test, expect } from '@playwright/test';
import { openGame, startGame, readLog, waitForPlayerTurn } from './helpers.js';

test('criterion 17: a game can be played with the keyboard only; cells are labelled with coordinate and state', async ({ page }) => {
  const game = await openGame(page, { seed: 9 });

  // Start screen: Tab to the difficulty buttons, choose Medium with Enter.
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('level-easy')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('level-medium')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('placement-screen')).toBeVisible();

  // Placement: Tab to Randomise, then Start.
  await page.getByTestId('randomise').focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('start').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('level')).toHaveText('Level: medium');

  // Play: focus the first target cell, move with arrows, fire with Enter/Space.
  await page.locator('[data-cell="target-A1"]').focus();
  await expect(page.locator('[data-cell="target-A1"]')).toHaveAttribute('aria-label', 'A1, unknown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-cell="target-B2"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await waitForPlayerTurn(page);
  let log = await readLog(page);
  expect(log[0]).toMatchObject({ by: 'player', label: 'B2' });
  await expect(page.locator('[data-cell="target-B2"]')).toHaveAttribute('aria-label', /^B2, (miss|hit|sunk)$/);
  // Focus is preserved across the re-render so the player can keep going.
  await expect(page.locator('[data-cell="target-B2"]')).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await waitForPlayerTurn(page);
  log = await readLog(page);
  expect(log.filter((e) => e.by === 'player').map((e) => e.label)).toEqual(['B2', 'B3']);

  // Every cell on both boards carries "<coord>, <state>".
  const labels = await page.locator('[data-testid="target"] button, [data-testid="fleet"] button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(labels).toHaveLength(200);
  for (const l of labels) expect(l).toMatch(/^[A-J](10|[1-9]), (unknown|miss|hit|sunk|ship|empty)$/);
  game.assertNoErrors();
});

test('mobile: at 360px the boards stack with the target board first and nothing overflows', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'only meaningful at 360px');
  const game = await openGame(page, { seed: 2 });
  await startGame(page, 'easy');
  const target = await page.getByTestId('target-board').boundingBox();
  const fleet = await page.getByTestId('fleet-board').boundingBox();
  expect(target.y + target.height).toBeLessThanOrEqual(fleet.y + 1);
  expect(target.x).toBeCloseTo(fleet.x, 0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(target.width).toBeLessThanOrEqual(360);
  game.assertNoErrors();
});

test('page loads without console errors and shows the start screen', async ({ page }) => {
  const started = Date.now();
  const game = await openGame(page);
  expect(Date.now() - started).toBeLessThan(3000);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Battleship: The Admiralty');
  game.assertNoErrors();
});
