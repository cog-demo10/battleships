// The enemy board as the player may see it. Receives an OpponentView only:
// there is nothing here that could reveal an unsunk ship.
import { h } from './dom.js';
import { renderGrid } from './grid.js';
import { toIndex } from '../engine/coords.js';

const GLYPH = { unknown: '', miss: '•', hit: '✕', sunk: '✕' };

/**
 * @param {object} opts
 * @param {object} opts.view           OpponentView from the snapshot
 * @param {boolean} opts.enabled       player's turn
 * @param {(coord) => void} opts.onSelect
 */
export function renderTargetBoard({ view, enabled, onSelect }) {
  const grid = renderGrid({
    id: 'target',
    size: view.size,
    label: 'Target grid',
    onSelect,
    cell(coord) {
      const state = view.cells[toIndex(coord, view.size)];
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
