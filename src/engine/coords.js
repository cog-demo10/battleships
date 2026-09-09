// Coordinate helpers. Pure functions, no Board knowledge. The AI layer may import this file only.

/** @typedef {{ row: number, col: number }} Coord */

export const DEFAULT_SIZE = 10;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** @param {number} row @param {number} col @param {number} size */
export function inBounds(row, col, size = DEFAULT_SIZE) {
  return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && col >= 0 && row < size && col < size;
}

/** "B7": letter = row, number = column (1-based). @param {Coord} c */
export function toLabel({ row, col }) {
  return `${LETTERS[row]}${col + 1}`;
}

/** Inverse of toLabel. @param {string} label */
export function fromLabel(label) {
  const m = /^([A-Z])(\d+)$/.exec(label.trim().toUpperCase());
  if (!m) throw new Error(`Bad coordinate label: ${label}`);
  return { row: LETTERS.indexOf(m[1]), col: Number(m[2]) - 1 };
}

/** @param {Coord} c @param {number} size */
export function toIndex({ row, col }, size = DEFAULT_SIZE) {
  return row * size + col;
}

/** @param {number} index @param {number} size */
export function fromIndex(index, size = DEFAULT_SIZE) {
  return { row: Math.floor(index / size), col: index % size };
}

/** @param {Coord} a @param {Coord} b */
export function sameCoord(a, b) {
  return a.row === b.row && a.col === b.col;
}

/**
 * Orthogonal neighbours inside the grid, in order up, right, down, left.
 * @param {Coord} c @param {number} size
 * @returns {Coord[]}
 */
export function neighbours({ row, col }, size = DEFAULT_SIZE) {
  const out = [];
  for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {
    const r = row + dr;
    const c = col + dc;
    if (inBounds(r, c, size)) out.push({ row: r, col: c });
  }
  return out;
}

/**
 * The cells a ship of `length` would occupy from `start` in `orientation`.
 * Does not check bounds; use inBounds on the result.
 * @param {Coord} start
 * @param {'horizontal'|'vertical'} orientation
 * @param {number} length
 * @returns {Coord[]}
 */
export function shipCells(start, orientation, length) {
  const cells = [];
  for (let i = 0; i < length; i++) {
    cells.push(
      orientation === 'horizontal'
        ? { row: start.row, col: start.col + i }
        : { row: start.row + i, col: start.col },
    );
  }
  return cells;
}
