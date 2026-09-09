// The player's own board: ships are visible, incoming hits are marked.
import { h } from './dom.js';
import { renderGrid } from './grid.js';
import { toIndex, shipCells, inBounds } from '../engine/coords.js';

/**
 * @param {object} opts
 * @param {object} opts.board   the player's own Board (from the snapshot)
 * @param {string} opts.title
 * @param {object} [opts.preview]  { coord, orientation, length, valid } while placing
 * @param {(coord) => void} [opts.onSelect]
 * @param {(coord|null) => void} [opts.onHover]
 * @param {boolean} [opts.interactive]
 */
export function renderFleetBoard({ board, title, preview, onSelect, onHover, interactive }) {
  const previewIdx = new Set();
  if (preview && preview.coord) {
    for (const c of shipCells(preview.coord, preview.orientation, preview.length)) {
      if (inBounds(c.row, c.col, board.size)) previewIdx.add(toIndex(c, board.size));
    }
  }
  const sunkIds = new Set(board.ships
    .filter((s) => s.cells.every((c) => board.shots[toIndex(c, board.size)] === 'hit'))
    .map((s) => s.id));

  const grid = renderGrid({
    id: 'fleet',
    size: board.size,
    label: title,
    onSelect: interactive ? onSelect : undefined,
    onHover: interactive ? onHover : undefined,
    cell(coord) {
      const i = toIndex(coord, board.size);
      const occ = board.occupant[i];
      const shot = board.shots[i];
      const classes = [];
      let state = 'empty';
      let glyph = '';
      if (occ !== null) { classes.push('ship'); state = 'ship'; }
      if (shot === 'miss') { classes.push('miss'); state = 'miss'; glyph = '•'; }
      if (shot === 'hit') {
        if (sunkIds.has(occ)) { classes.push('sunk'); state = 'sunk'; } else { classes.push('hit'); state = 'hit'; }
        glyph = '✕';
      }
      if (previewIdx.has(i)) classes.push(preview.valid ? 'preview-ok' : 'preview-bad');
      return { state, cls: classes.join(' '), glyph, disabled: !interactive };
    },
  });

  return h('section', { class: 'panel board-wrap fleet', 'data-testid': 'fleet-board' }, [
    h('h2', { text: title }),
    grid,
  ]);
}
