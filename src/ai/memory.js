// The opponent's own record of the game. It is built solely from the results the
// game reports for each shot (miss | hit | sunk + size); it never sees a Board.
// Imports from the engine are restricted to coords.js (see test/boundaries.test.js).

import { fromIndex, inBounds, neighbours, shipCells, toIndex } from '../engine/coords.js';

/** @typedef {import('../engine/coords.js').Coord} Coord */
/** @typedef {'unknown'|'miss'|'hit'|'sunk'} Known */
/** @typedef {{ kind: 'miss' } | { kind: 'hit' } | { kind: 'sunk', size: number }} AiShotResult */
/**
 * Explicit target structure: the hits believed to belong to one ship, and the
 * axis once two aligned hits establish it. Pruned on every result.
 * @typedef {{ hits: Coord[], axis: 'horizontal'|'vertical'|null }} Target
 */
/**
 * @typedef {object} Memory
 * @property {number} size
 * @property {Known[]} cells               what this player has learnt about each cell
 * @property {number[]} remainingLengths   lengths of enemy ships still afloat
 * @property {Target|null} target
 */

/**
 * @param {number} size
 * @param {number[]} fleetLengths lengths of the enemy fleet (public rules, not positions)
 * @returns {Memory}
 */
export function createMemory(size, fleetLengths) {
  return {
    size,
    cells: new Array(size * size).fill('unknown'),
    remainingLengths: fleetLengths.slice().sort((a, b) => b - a),
    target: null,
  };
}

/** @param {Memory} m @param {Coord} c */
export function known(m, c) {
  return m.cells[toIndex(c, m.size)];
}

/** @param {Memory} m @returns {Coord[]} */
export function unknownCells(m) {
  const out = [];
  for (let i = 0; i < m.cells.length; i++) if (m.cells[i] === 'unknown') out.push(fromIndex(i, m.size));
  return out;
}

/** Hits not yet attributed to a sunk ship. @param {Memory} m @returns {Coord[]} */
export function unresolvedHits(m) {
  const out = [];
  for (let i = 0; i < m.cells.length; i++) if (m.cells[i] === 'hit') out.push(fromIndex(i, m.size));
  return out;
}

function axisOf(a, b) {
  if (a.row === b.row && a.col !== b.col) return 'horizontal';
  if (a.col === b.col && a.row !== b.row) return 'vertical';
  return null;
}

/**
 * Candidate cells for the current target, derived (never cached) from the record
 * so they are pruned automatically by every recorded result:
 * - axis known: the unknown cells just beyond each end of the hit run;
 * - axis unknown: unknown orthogonal neighbours of the single hit.
 * @param {Memory} m @returns {Coord[]}
 */
export function targetCandidates(m) {
  const t = m.target;
  if (!t || t.hits.length === 0) return [];
  const out = [];
  if (t.axis) {
    const key = t.axis === 'horizontal' ? 'col' : 'row';
    const other = t.axis === 'horizontal' ? 'row' : 'col';
    const fixed = t.hits[0][other];
    const positions = t.hits.map((h) => h[key]);
    const lo = Math.min(...positions);
    const hi = Math.max(...positions);
    for (const p of [lo - 1, hi + 1]) {
      const c = t.axis === 'horizontal' ? { row: fixed, col: p } : { row: p, col: fixed };
      if (inBounds(c.row, c.col, m.size) && known(m, c) === 'unknown') out.push(c);
    }
    if (out.length > 0) return out;
    // Run is closed at both ends yet no sink: the hits span two ships. Try sideways.
    for (const h of t.hits) for (const n of neighbours(h, m.size)) if (known(m, n) === 'unknown') out.push(n);
    return out;
  }
  for (const n of neighbours(t.hits[0], m.size)) if (known(m, n) === 'unknown') out.push(n);
  return out;
}

/**
 * True if some remaining ship could still lie over `hit` without crossing a
 * miss or sunk cell. Used to reject sink attributions that would strand a hit.
 * @param {Memory} m @param {Coord} hit @param {Known[]} cells @param {number[]} lengths
 */
function coverable(m, hit, cells, lengths) {
  for (const length of new Set(lengths)) {
    for (const axis of ['horizontal', 'vertical']) {
      for (let offset = 0; offset < length; offset++) {
        const start = axis === 'horizontal'
          ? { row: hit.row, col: hit.col - offset }
          : { row: hit.row - offset, col: hit.col };
        const placement = shipCells(start, axis, length);
        const last = placement[length - 1];
        if (!inBounds(start.row, start.col, m.size) || !inBounds(last.row, last.col, m.size)) continue;
        if (placement.every((c) => { const k = cells[toIndex(c, m.size)]; return k === 'unknown' || k === 'hit'; })) return true;
      }
    }
  }
  return false;
}

/**
 * Work out which hit cells a reported sink of `size` accounts for: a straight
 * run of `size` hit cells through `at`. Candidate runs are ranked (exact-length
 * runs first, then the current target axis); the first that leaves every other
 * hit still coverable by a remaining ship wins. Falls back to marking just `at`.
 * @param {Memory} m @param {Coord} at @param {number} size @returns {Coord[]}
 */
function sunkRun(m, at, size) {
  const candidates = sunkRunCandidates(m, at, size);
  const lengths = m.remainingLengths.slice();
  const ri = lengths.indexOf(size);
  if (ri >= 0) lengths.splice(ri, 1);
  for (const run of candidates) {
    const cells = m.cells.slice();
    for (const c of run) cells[toIndex(c, m.size)] = 'sunk';
    const leftovers = [];
    for (let i = 0; i < cells.length; i++) if (cells[i] === 'hit') leftovers.push(fromIndex(i, m.size));
    if (leftovers.every((h) => coverable(m, h, cells, lengths))) return run;
  }
  return candidates[0] || [at];
}

/** @param {Memory} m @param {Coord} at @param {number} size @returns {Coord[][]} */
function sunkRunCandidates(m, at, size) {
  const axes = [];
  if (m.target && m.target.axis) axes.push(m.target.axis);
  for (const a of ['horizontal', 'vertical']) if (!axes.includes(a)) axes.push(a);
  const lines = axes.map((axis) => {
    const line = [];
    const step = axis === 'horizontal' ? { row: 0, col: 1 } : { row: 1, col: 0 };
    // Walk backwards then forwards over contiguous hits.
    let c = at;
    while (true) {
      const p = { row: c.row - step.row, col: c.col - step.col };
      if (!inBounds(p.row, p.col, m.size) || known(m, p) !== 'hit') break;
      c = p;
    }
    while (inBounds(c.row, c.col, m.size) && known(m, c) === 'hit') {
      line.push(c);
      c = { row: c.row + step.row, col: c.col + step.col };
    }
    return line;
  });
  // A run of exactly the reported size is the strongest evidence, whichever axis.
  const out = lines.filter((l) => l.length === size);
  for (const line of lines) {
    if (line.length <= size) continue;
    // Longer run than the ship: every span of `size` containing `at`, the ones
    // overlapping the current target's hits most first.
    const idx = line.findIndex((x) => x.row === at.row && x.col === at.col);
    const spans = [];
    for (let s = Math.max(0, idx - size + 1); s <= Math.min(idx, line.length - size); s++) {
      const span = line.slice(s, s + size);
      const score = m.target
        ? span.filter((w) => m.target.hits.some((h) => h.row === w.row && h.col === w.col)).length
        : 0;
      spans.push({ span, score });
    }
    spans.sort((a, b) => b.score - a.score);
    out.push(...spans.map((w) => w.span));
  }
  return out;
}

/**
 * Line-extension fallback used when the record has become inconsistent (a sink
 * was attributed to the wrong cells, which can happen with touching ships and
 * size-only sink reports): unknown cells next to any unresolved hit, preferring
 * cells that extend a straight run of hits.
 * @param {Memory} m @returns {Coord[]}
 */
export function extensionCandidates(m) {
  const scores = new Map();
  for (const h of unresolvedHits(m)) {
    for (const n of neighbours(h, m.size)) {
      if (known(m, n) !== 'unknown') continue;
      // The cell on the far side of h from n; if it is a hit, n extends a line.
      const far = { row: 2 * h.row - n.row, col: 2 * h.col - n.col };
      const extends_ = inBounds(far.row, far.col, m.size) && known(m, far) === 'hit';
      const key = toIndex(n, m.size);
      scores.set(key, (scores.get(key) || 0) + (extends_ ? 10 : 1));
    }
  }
  let best = 0;
  const out = [];
  for (const [key, score] of scores) {
    if (score > best) { best = score; out.length = 0; }
    if (score === best) out.push(fromIndex(key, m.size));
  }
  return out;
}

/**
 * Record the result of a shot this player fired. Returns a new Memory.
 * @param {Memory} m @param {Coord} coord @param {AiShotResult} result
 * @returns {Memory}
 */
export function observe(m, coord, result) {
  const cells = m.cells.slice();
  const idx = toIndex(coord, m.size);
  if (result.kind === 'miss') {
    cells[idx] = 'miss';
    return { ...m, cells };
  }
  if (result.kind === 'hit') {
    cells[idx] = 'hit';
    let target = m.target;
    if (!target) {
      target = { hits: [coord], axis: null };
    } else {
      const a = axisOf(target.hits[0], coord);
      if (target.axis ? a === target.axis : a !== null) {
        target = { hits: [...target.hits, coord], axis: target.axis || a };
      }
      // A hit off the target's line belongs to another ship; it stays unresolved
      // and is picked up once this target is sunk.
    }
    return { ...m, cells, target };
  }
  // sunk
  cells[idx] = 'hit';
  const provisional = { ...m, cells };
  const run = sunkRun(provisional, coord, result.size);
  for (const c of run) cells[toIndex(c, m.size)] = 'sunk';
  const remainingLengths = m.remainingLengths.slice();
  const ri = remainingLengths.indexOf(result.size);
  if (ri >= 0) remainingLengths.splice(ri, 1);
  const next = { ...m, cells, remainingLengths, target: null };
  // Any hits left over belong to another ship: keep hunting them.
  const leftovers = unresolvedHits(next);
  if (leftovers.length > 0) {
    const first = leftovers[0];
    const aligned = leftovers.filter((h) => h !== first && axisOf(first, h) && (h.row === first.row ? Math.abs(h.col - first.col) : Math.abs(h.row - first.row)) === 1);
    next.target = { hits: [first, ...aligned], axis: aligned.length ? axisOf(first, aligned[0]) : null };
  }
  return next;
}
