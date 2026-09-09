// Shared grid renderer used by FleetBoard and TargetBoard. Every cell is a
// focusable <button> labelled "B7, unknown" so the boards are keyboard-operable.
import { h } from './dom.js';
import { toLabel } from '../engine/coords.js';

/**
 * @typedef {object} CellSpec
 * @property {string} state       accessible state word ("unknown", "miss", "hit", "sunk", "ship", "empty")
 * @property {string} [cls]       extra CSS classes
 * @property {string} [glyph]     visible glyph
 * @property {boolean} [disabled]  not focusable (own fleet during play)
 * @property {boolean} [inert]     focusable but selecting does nothing (known cells, computer's turn)
 */

/**
 * @param {object} opts
 * @param {string} opts.id
 * @param {number} opts.size
 * @param {string} opts.label            accessible name of the grid
 * @param {(coord: {row:number,col:number}) => CellSpec} opts.cell
 * @param {(coord: {row:number,col:number}) => void} [opts.onSelect]
 * @param {(coord: {row:number,col:number}|null) => void} [opts.onHover]
 */
export function renderGrid({ id, size, label, cell, onSelect, onHover }) {
  const grid = h('div', { class: 'grid', role: 'grid', 'aria-label': label, 'data-testid': id });
  grid.style.gridTemplateColumns = `auto repeat(${size}, var(--cell))`;
  grid.append(h('div', { class: 'corner', 'aria-hidden': 'true' }));
  for (let c = 0; c < size; c++) {
    grid.append(h('div', { class: 'col-label', 'aria-hidden': 'true', text: String(c + 1) }));
  }
  for (let r = 0; r < size; r++) {
    grid.append(h('div', { class: 'row-label', 'aria-hidden': 'true', text: String.fromCharCode(65 + r) }));
    for (let c = 0; c < size; c++) {
      const coord = { row: r, col: c };
      const spec = cell(coord);
      const name = toLabel(coord);
      const attrs = {
        class: `cell ${spec.cls || ''}`.trim(),
        type: 'button',
        role: 'gridcell',
        'aria-label': `${name}, ${spec.state}`,
        'data-cell': `${id}-${name}`,
        disabled: !!spec.disabled,
        'aria-disabled': spec.inert ? 'true' : false,
        text: spec.glyph || '',
      };
      if (onSelect && !spec.inert) attrs.onClick = () => onSelect(coord);
      if (onHover) {
        attrs.onMouseenter = () => onHover(coord);
        attrs.onFocus = () => onHover(coord);
      }
      grid.append(h('button', attrs));
    }
  }
  if (onHover) grid.addEventListener('mouseleave', () => onHover(null));
  return grid;
}

/** Arrow-key navigation between cells of the grid that contains `event.target`. */
export function handleGridKeys(event, size) {
  const target = /** @type {HTMLElement} */ (event.target);
  if (!(target instanceof HTMLButtonElement) || !target.dataset.cell) return;
  const grid = target.closest('.grid');
  if (!grid) return;
  const cells = [...grid.querySelectorAll('button[data-cell]')];
  const i = cells.indexOf(target);
  if (i < 0) return;
  const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size };
  const delta = moves[event.key];
  if (delta === undefined) return;
  const row = Math.floor(i / size);
  const col = i % size;
  if (event.key === 'ArrowLeft' && col === 0) return;
  if (event.key === 'ArrowRight' && col === size - 1) return;
  if (event.key === 'ArrowUp' && row === 0) return;
  if (event.key === 'ArrowDown' && row === size - 1) return;
  event.preventDefault();
  cells[i + delta].focus();
}
