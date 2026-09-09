// Easy: uniform random over cells not yet fired at. Uses no memory beyond the record itself.

import { unknownCells } from './memory.js';

/** @type {import('./index.js').Strategy} */
export const easy = {
  level: 'easy',
  chooseShot(memory, rng) {
    const cells = unknownCells(memory);
    return cells[Math.floor(rng() * cells.length)];
  },
};
