// Regression tests for the query-string defaults, i.e. the path every visitor
// without ?seed/?delay takes. Number(null) is 0, so a naive Number(params.get('seed'))
// silently gave every visitor seed 0 and a 0 ms AI pause.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readOptions, DEFAULT_AI_DELAY } from '../src/ui/options.js';

describe('readOptions', () => {
  test("readOptions('') uses a delay of 600 and a fresh seed on every call", () => {
    const a = readOptions('');
    const b = readOptions('');
    assert.equal(a.delay, 600);
    assert.equal(DEFAULT_AI_DELAY, 600);
    assert.ok(Number.isInteger(a.seed) && a.seed >= 0);
    assert.notEqual(a.seed, b.seed);
  });

  test('a fresh seed comes from the injected generator, never from Number(null) === 0', () => {
    let calls = 0;
    const fresh = () => { calls++; return 4242; };
    assert.equal(readOptions('', fresh).seed, 4242);
    assert.equal(readOptions('?delay=0', fresh).seed, 4242);
    assert.equal(calls, 2);
  });

  test("'?seed=' and '?seed=abc' fall back to a random seed rather than zero", () => {
    for (const q of ['?seed=', '?seed=abc', '?seed=%20', '?seed=-3', '?seed=1.5', '?seed=NaN']) {
      const fresh = () => 777;
      assert.equal(readOptions(q, fresh).seed, 777, q);
      const real = readOptions(q);
      assert.notEqual(real.seed, 0, `${q} must not silently become seed 0`);
    }
  });

  test("'?seed=0' returns seed zero: an explicit zero is a legitimate seed", () => {
    const fresh = () => { throw new Error('must not generate a seed when one is given'); };
    assert.equal(readOptions('?seed=0', fresh).seed, 0);
    assert.equal(readOptions('?seed=0&delay=0', fresh).seed, 0);
    assert.equal(readOptions('?seed=12345', fresh).seed, 12345);
  });

  test('delay: absent or malformed → 600; explicit values including 0 are honoured', () => {
    assert.equal(readOptions('?seed=1').delay, 600);
    assert.equal(readOptions('?delay=').delay, 600);
    assert.equal(readOptions('?delay=fast').delay, 600);
    assert.equal(readOptions('?delay=-1').delay, 600);
    assert.equal(readOptions('?delay=0').delay, 0);
    assert.equal(readOptions('?delay=250').delay, 250);
  });
});
