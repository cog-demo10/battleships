// The enemy board as the player may see it. Receives an OpponentView only:
// there is nothing here that could reveal an unsunk ship. Once the game is
// finished the snapshot also carries `revealedFleet`, and the ships the player
// never found are drawn in place.
import { h } from './dom.js';
import { renderGrid } from './grid.js';
import { toIndex } from '../engine/coords.js';

const GLYPH = { unknown: '', miss: '•', hit: '✕', sunk: '✕' };

/**
 * @param {object} opts
 * @param {object} opts.view           OpponentView from the snapshot
 * @param {boolean} opts.enabled       player's turn
 * @param {{ name: string, cells: {row:number,col:number}[] }[]} [opts.revealed]  unsunk enemy ships (finished only)
 * @param {(coord) => void} opts.onSelect
 */
export function renderTargetBoard({ view, enabled, revealed, onSelect }) {
  const revealedAt = new Map();
  for (const ship of revealed || []) {
    for (const c of ship.cells) revealedAt.set(toIndex(c, view.size), ship.name);
  }
  const grid = renderGrid({
    id: 'target',
    size: view.size,
    label: 'Target grid',
    onSelect,
    cell(coord) {
      const i = toIndex(coord, view.size);
      const state = view.cells[i];
      const shipName = revealedAt.get(i);
      if (shipName !== undefined) {
        return {
          state: state === 'hit' ? `hit, enemy ${shipName}` : `enemy ${shipName}`,
          cls: `revealed ${state === 'hit' ? 'hit' : ''}`.trim(),
          glyph: GLYPH[state],
          inert: true,
        };
      }
      return {
        state,
        cls: state === 'unknown' ? '' : state,
        glyph: GLYPH[state],
        // Known cells are inert; unknown cells are only inert while the computer is firing.
        inert: state !== 'unknown' || !enabled,
      };
    },
  });
  return h('section', { class: 'panel board-wrap target', 'data-testid': 'target-board' }, [
    h('h2', { text: 'Target grid' }),
    grid,
  ]);
}
