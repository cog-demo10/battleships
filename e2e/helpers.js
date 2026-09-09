import { expect } from '@playwright/test';

/**
 * Open the game, failing the test at teardown if the page logged any console
 * error or threw an uncaught exception.
 */
export async function openGame(page, { seed = 1, delay = 0 } = {}) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`./?seed=${seed}&delay=${delay}`);
  await expect(page.getByTestId('start-screen')).toBeVisible();
  return {
    assertNoErrors: () => expect(errors, 'console errors').toEqual([]),
  };
}

export async function startGame(page, level = 'medium') {
  await page.getByTestId(`level-${level}`).click();
  await expect(page.getByTestId('placement-screen')).toBeVisible();
  await page.getByTestId('randomise').click();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('status')).toBeVisible();
}

export function targetCell(page, label) {
  return page.locator(`[data-cell="target-${label}"]`);
}

export function unknownTargetCells(page) {
  return page.locator('[data-testid="target"] button[aria-label$=", unknown"]');
}

export async function waitForPlayerTurn(page) {
  await expect(page.getByTestId('turn')).toHaveText(/Your turn|Game over/);
}

/** Fire at the first unknown cell (row-major) until the game ends. */
export async function playToEnd(page, maxShots = 100) {
  for (let i = 0; i < maxShots; i++) {
    if (await page.getByTestId('game-over').count()) return;
    await unknownTargetCells(page).first().click();
    await waitForPlayerTurn(page);
  }
  await expect(page.getByTestId('game-over')).toBeVisible();
}

/** Parse the move log into structured entries. */
export async function readLog(page) {
  return page.getByTestId('log-entry').evaluateAll((els) => els.map((e, i) => ({
    n: i + 1, by: e.dataset.by, label: e.dataset.label, kind: e.dataset.kind,
  })));
}

/** Read the target board into { label: state } from the accessible labels. */
export async function readTargetBoard(page) {
  return page.locator('[data-testid="target"] button').evaluateAll((els) => Object.fromEntries(
    els.map((e) => e.getAttribute('aria-label').split(', ')),
  ));
}
