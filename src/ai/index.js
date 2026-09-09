// Computer opponent. Three strategies behind one interface. The opponent is told
// only the result of each of its shots (miss | hit | sunk + size) and builds its
// own record; it can never see the player's Board.

import { easy } from './easy.js';
import { medium } from './medium.js';
import { hard } from './hard.js';
import { createMemory, observe } from './memory.js';

/** @typedef {'easy'|'medium'|'hard'} Level */
/**
 * @typedef {object} Strategy
 * @property {Level} level
 * @property {(memory: import('./memory.js').Memory, rng: () => number) => import('../engine/coords.js').Coord} chooseShot
 */

export const LEVELS = Object.freeze(['easy', 'medium', 'hard']);

const STRATEGIES = { easy, medium, hard };

/**
 * @param {Level} level
 * @returns {{ level: Level, strategy: Strategy, createMemory: typeof createMemory, chooseShot: Strategy['chooseShot'], observe: typeof observe }}
 */
export function createAi(level) {
  const strategy = STRATEGIES[level];
  if (!strategy) throw new Error(`Unknown difficulty: ${level}`);
  return {
    level,
    strategy,
    createMemory,
    chooseShot: strategy.chooseShot,
    observe,
  };
}

export { createMemory, observe };
