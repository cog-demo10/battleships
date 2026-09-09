// Page options from the query string. Pure: takes the search string, touches no DOM,
// so the defaults every real visitor gets can be unit tested in Node.
//   ?seed=N   replays an exact game (N a non-negative integer; 0 is legitimate)
//   ?delay=ms pause before the computer fires (default 600)

import { randomSeed } from '../rng.js';

export const DEFAULT_AI_DELAY = 600;

/**
 * @param {string} searchString  e.g. location.search ('' or '?seed=12&delay=0')
 * @param {() => number} [freshSeed]  injected for tests; defaults to rng.randomSeed
 * @returns {{ seed: number, delay: number }}
 */
export function readOptions(searchString, freshSeed = randomSeed) {
  const params = new URLSearchParams(searchString);
  return {
    seed: numericParam(params, 'seed', Number.isInteger, freshSeed),
    delay: numericParam(params, 'delay', Number.isFinite, () => DEFAULT_AI_DELAY),
  };
}

/** Absent, blank or malformed → fallback(); otherwise the non-negative number. */
function numericParam(params, name, valid, fallback) {
  const raw = params.get(name);
  if (raw === null || raw.trim() === '') return fallback();
  const n = Number(raw);
  return valid(n) && n >= 0 ? n : fallback();
}
