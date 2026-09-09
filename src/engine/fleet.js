// Fleet definitions and random layout generation. Randomness is injected.

import { createBoard, isValidPlacement, placeShip } from './board.js';
import { DEFAULT_SIZE, neighbours, toIndex } from './coords.js';

/** @typedef {import('./board.js').Board} Board */

/** @type {{ name: string, length: number }[]} */
export const STANDARD_FLEET = Object.freeze([
  { name: 'Carrier', length: 5 },
  { name: 'Battleship', length: 4 },
  { name: 'Cruiser', length: 3 },
  { name: 'Submarine', length: 3 },
  { name: 'Destroyer', length: 2 },
].map((s) => Object.freeze(s)));

/**
 * Place a fleet at random. Ships may touch (no gap rule), so a meaningful
 * fraction of layouts contain adjacent ships. Retries whole layouts if a ship
 * cannot be placed, which is practically impossible on 10x10 but guards small grids.
 * @param {() => number} rng
 * @param {{ name: string, length: number }[]} fleet
 * @param {number} size
 * @returns {Board}
 */
export function randomFleet(rng, fleet = STANDARD_FLEET, size = DEFAULT_SIZE) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let board = createBoard(size);
    let ok = true;
    for (const spec of fleet) {
      const options = [];
      for (const orientation of ['horizontal', 'vertical']) {
        for (let row = 0; row < size; row++) {
          for (let col = 0; col < size; col++) {
            if (isValidPlacement(board, { row, col }, orientation, spec.length)) {
              options.push({ start: { row, col }, orientation });
            }
          }
        }
      }
      if (options.length === 0) { ok = false; break; }
      const pick = options[Math.floor(rng() * options.length)];
      board = placeShip(board, spec, pick.start, pick.orientation);
    }
    if (ok) return board;
  }
  throw new Error('Could not place fleet');
}

/** True if any two distinct ships occupy orthogonally adjacent cells. @param {Board} board */
export function hasTouchingShips(board) {
  for (const ship of board.ships) {
    for (const cell of ship.cells) {
      for (const n of neighbours(cell, board.size)) {
        const other = board.occupant[toIndex(n, board.size)];
        if (other !== null && other !== ship.id) return true;
      }
    }
  }
  return false;
}
