// The only module permitted to reference Math.random (enforced by test/boundaries.test.js).

/**
 * Deterministic PRNG (mulberry32). Same seed => same sequence, everywhere.
 * @param {number} seed 32-bit integer
 * @returns {() => number} function returning a float in [0, 1)
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @returns {number} a fresh non-deterministic 32-bit seed for a new game */
export function randomSeed() {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

/**
 * Integer in [0, n) drawn from an rng.
 * @param {() => number} rng
 * @param {number} n
 */
export function randomInt(rng, n) {
  return Math.floor(rng() * n);
}
