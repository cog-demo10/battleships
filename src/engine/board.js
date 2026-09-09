// Pure rules. No state, no randomness, no DOM. Inputs are never mutated.
//
// Every cell records the identity (id) of the ship occupying it. A ship is sunk
// exactly when all of its own cells have been hit; sinking is never inferred
// from geometry, so touching or collinear ships never interfere.

import { DEFAULT_SIZE, inBounds, shipCells, toIndex } from './coords.js';

/** @typedef {import('./coords.js').Coord} Coord */
/** @typedef {'horizontal'|'vertical'} Orientation */
/** @typedef {{ id: number, name: string, length: number, cells: Coord[] }} Ship */
/** @typedef {'unknown'|'miss'|'hit'} CellShot */
/**
 * @typedef {object} Board
 * @property {number} size
 * @property {Ship[]} ships
 * @property {(number|null)[]} occupant  ship id per cell index, or null
 * @property {CellShot[]} shots        shot state per cell index
 */
/**
 * @typedef {{ kind: 'miss' } | { kind: 'hit' } | { kind: 'sunk', ship: Ship } | { kind: 'win', ship: Ship }} ShotResult
 */

/** @param {number} size @returns {Board} */
export function createBoard(size = DEFAULT_SIZE) {
  return {
    size,
    ships: [],
    occupant: new Array(size * size).fill(null),
    shots: new Array(size * size).fill('unknown'),
  };
}

/**
 * Cells for a proposed ship, or null if any cell is off-grid.
 * @param {Board} board @param {Coord} start @param {Orientation} orientation @param {number} length
 */
function proposedCells(board, start, orientation, length) {
  const cells = shipCells(start, orientation, length);
  return cells.every((c) => inBounds(c.row, c.col, board.size)) ? cells : null;
}

/**
 * True when the ship fits on the grid and overlaps no existing ship. Touching is allowed.
 * @param {Board} board @param {Coord} start @param {Orientation} orientation @param {number} length
 */
export function isValidPlacement(board, start, orientation, length) {
  if (!Number.isInteger(length) || length < 1) return false;
  const cells = proposedCells(board, start, orientation, length);
  if (!cells) return false;
  return cells.every((c) => board.occupant[toIndex(c, board.size)] === null);
}

/**
 * Returns a new board with the ship added. Throws on an invalid placement.
 * @param {Board} board @param {{ name: string, length: number }} spec @param {Coord} start @param {Orientation} orientation
 * @returns {Board}
 */
export function placeShip(board, spec, start, orientation) {
  if (!isValidPlacement(board, start, orientation, spec.length)) {
    throw new Error(`Invalid placement of ${spec.name} at ${start.row},${start.col} ${orientation}`);
  }
  const cells = shipCells(start, orientation, spec.length);
  const id = board.ships.length;
  const ship = { id, name: spec.name, length: spec.length, cells };
  const occupant = board.occupant.slice();
  for (const c of cells) occupant[toIndex(c, board.size)] = id;
  return { ...board, ships: [...board.ships, ship], occupant };
}

/** @param {Board} board @param {Coord} coord */
export function shotAt(board, coord) {
  return board.shots[toIndex(coord, board.size)];
}

/** @param {Board} board @param {Ship} ship */
export function isSunk(board, ship) {
  return ship.cells.every((c) => board.shots[toIndex(c, board.size)] === 'hit');
}

/** @param {Board} board */
export function allSunk(board) {
  return board.ships.length > 0 && board.ships.every((s) => isSunk(board, s));
}

/** @param {Board} board */
export function remainingShips(board) {
  return board.ships.filter((s) => !isSunk(board, s));
}

/**
 * Fire at a cell. Throws if the cell is off-grid or already shot; callers must
 * check `shotAt` first (the game layer ignores such clicks entirely).
 * @param {Board} board @param {Coord} coord
 * @returns {{ board: Board, result: ShotResult }}
 */
export function fireAt(board, coord) {
  if (!inBounds(coord.row, coord.col, board.size)) throw new Error('Shot off grid');
  const idx = toIndex(coord, board.size);
  if (board.shots[idx] !== 'unknown') throw new Error('Cell already shot');
  const shipId = board.occupant[idx];
  const shots = board.shots.slice();
  shots[idx] = shipId === null ? 'miss' : 'hit';
  const next = { ...board, shots };
  if (shipId === null) return { board: next, result: { kind: 'miss' } };
  const ship = next.ships[shipId];
  if (!isSunk(next, ship)) return { board: next, result: { kind: 'hit' } };
  if (allSunk(next)) return { board: next, result: { kind: 'win', ship } };
  return { board: next, result: { kind: 'sunk', ship } };
}

/** @typedef {'unknown'|'miss'|'hit'|'sunk'} ViewCell */
/**
 * What an opponent may legitimately know about a board: per-cell shot results
 * (with hit cells of sunk ships upgraded to 'sunk'), the names/lengths of sunk
 * ships and the lengths of ships still afloat. Structurally cannot carry positions
 * of unsunk ships.
 * @typedef {object} OpponentView
 * @property {number} size
 * @property {ViewCell[]} cells
 * @property {{ name: string, length: number }[]} sunk
 * @property {number[]} remainingLengths
 */

/** @param {Board} board @returns {OpponentView} */
export function opponentView(board) {
  const cells = board.shots.slice();
  const sunk = [];
  const remainingLengths = [];
  for (const ship of board.ships) {
    if (isSunk(board, ship)) {
      sunk.push({ name: ship.name, length: ship.length });
      for (const c of ship.cells) cells[toIndex(c, board.size)] = 'sunk';
    } else {
      remainingLengths.push(ship.length);
    }
  }
  return { size: board.size, cells, sunk, remainingLengths };
}
