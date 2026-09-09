// Medium: checkerboard-parity hunt; on a hit, target the neighbours; once two
// aligned hits fix the axis, extend along that axis only until the ship sinks.

import { extensionCandidates, targetCandidates, unknownCells } from './memory.js';

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/**
 * Hunt cells: parity chosen so the smallest remaining ship cannot hide between them.
 * Falls back to every unknown cell once the parity set is exhausted.
 * @param {import('./memory.js').Memory} memory
 */
export function huntCells(memory) {
  const unknown = unknownCells(memory);
  const parity = unknown.filter((c) => (c.row + c.col) % 2 === 0);
  return parity.length > 0 ? parity : unknown;
}

/** @type {import('./index.js').Strategy} */
export const medium = {
  level: 'medium',
  chooseShot(memory, rng) {
    const candidates = targetCandidates(memory);
    if (candidates.length > 0) return pick(rng, candidates);
    const leftovers = extensionCandidates(memory);
    if (leftovers.length > 0) return pick(rng, leftovers);
    return pick(rng, huntCells(memory));
  },
};
