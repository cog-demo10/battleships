// Hard: probability density. For every unknown cell, count the legal placements
// of the remaining ships that are consistent with the record (no miss or sunk
// cell, and covering unresolved hits when there are any). Fire at the maximum.
// Falls back to line extension, then hunting, if the record is inconsistent.

import { fromIndex, inBounds, shipCells, toIndex } from '../engine/coords.js';
import { targetCandidates, unknownCells, unresolvedHits } from './memory.js';
import { huntCells } from './medium.js';

const HIT_WEIGHT = 50;

/**
 * Density map over cells. Exported for tests.
 * @param {import('./memory.js').Memory} m
 * @returns {number[]} score per cell index (0 for known cells)
 */
export function density(m) {
  const { size, cells, remainingLengths } = m;
  const scores = new Array(size * size).fill(0);
  const hits = unresolvedHits(m);
  const hitSet = new Set(hits.map((h) => toIndex(h, size)));
  for (const length of remainingLengths) {
    for (const orientation of ['horizontal', 'vertical']) {
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const placement = shipCells({ row, col }, orientation, length);
          const last = placement[placement.length - 1];
          if (!inBounds(last.row, last.col, size)) continue;
          let legal = true;
          let covered = 0;
          for (const c of placement) {
            const k = cells[toIndex(c, size)];
            if (k === 'miss' || k === 'sunk') { legal = false; break; }
            if (hitSet.has(toIndex(c, size))) covered++;
          }
          if (!legal) continue;
          if (hitSet.size > 0 && covered === 0) continue;
          const weight = 1 + covered * HIT_WEIGHT;
          for (const c of placement) {
            const i = toIndex(c, size);
            if (cells[i] === 'unknown') scores[i] += weight;
          }
        }
      }
    }
  }
  return scores;
}

/** @type {import('./index.js').Strategy} */
export const hard = {
  level: 'hard',
  chooseShot(memory, rng) {
    const scores = density(memory);
    let best = 0;
    const bestCells = [];
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > best) { best = scores[i]; bestCells.length = 0; }
      if (scores[i] === best && best > 0) bestCells.push(fromIndex(i, memory.size));
    }
    if (bestCells.length > 0) return bestCells[Math.floor(rng() * bestCells.length)];
    const candidates = targetCandidates(memory);
    if (candidates.length > 0) return candidates[Math.floor(rng() * candidates.length)];
    const hunt = huntCells(memory);
    if (hunt.length > 0) return hunt[Math.floor(rng() * hunt.length)];
    const unknown = unknownCells(memory);
    return unknown[Math.floor(rng() * unknown.length)];
  },
};
