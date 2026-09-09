import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/rng.js';
import { fromLabel, toLabel, toIndex, neighbours } from '../src/engine/coords.js';
import { createAi, LEVELS } from '../src/ai/index.js';
import { createMemory, observe, targetCandidates, unresolvedHits } from '../src/ai/memory.js';
import { density } from '../src/ai/hard.js';

const FLEET = [5, 4, 3, 3, 2];

function withResults(memory, entries) {
  let m = memory;
  for (const [label, result] of entries) {
    m = observe(m, fromLabel(label), typeof result === 'string' ? { kind: result } : result);
  }
  return m;
}

function labelsOfNextShots(level, memory, seeds = 50) {
  const ai = createAi(level);
  const out = new Set();
  for (let s = 1; s <= seeds; s++) out.add(toLabel(ai.chooseShot(memory, makeRng(s))));
  return [...out].sort();
}

describe('memory', () => {
  test('starts empty and records misses and hits without mutation', () => {
    const m0 = createMemory(10, FLEET);
    assert.deepEqual(m0.remainingLengths, [5, 4, 3, 3, 2]);
    const m1 = observe(m0, fromLabel('A1'), { kind: 'miss' });
    assert.equal(m0.cells[0], 'unknown');
    assert.equal(m1.cells[0], 'miss');
    assert.equal(m1.target, null);
    const m2 = observe(m1, fromLabel('C3'), { kind: 'hit' });
    assert.deepEqual(m2.target, { hits: [fromLabel('C3')], axis: null });
    assert.deepEqual(unresolvedHits(m2), [fromLabel('C3')]);
  });

  test('sink marks the run of hits as sunk and removes the length', () => {
    const m = withResults(createMemory(10, FLEET), [['D4', 'hit'], ['D5', 'hit'], ['D6', { kind: 'sunk', size: 3 }]]);
    for (const l of ['D4', 'D5', 'D6']) assert.equal(m.cells[toIndex(fromLabel(l))], 'sunk');
    assert.deepEqual(m.remainingLengths, [5, 4, 3, 2]);
    assert.equal(m.target, null);
    assert.deepEqual(targetCandidates(m), []);
  });

  test('sink of a shorter ship within a longer run leaves the other hits unresolved and targeted', () => {
    // Two touching collinear ships: destroyer D4-D5, cruiser D6-D8. Player hits D4..D6, sink at D5 (size 2).
    const m = withResults(createMemory(10, FLEET), [['D6', 'hit'], ['D4', 'hit'], ['D5', { kind: 'sunk', size: 2 }]]);
    assert.equal(m.cells[toIndex(fromLabel('D6'))], 'hit');
    assert.equal(m.cells[toIndex(fromLabel('D4'))], 'sunk');
    assert.equal(m.cells[toIndex(fromLabel('D5'))], 'sunk');
    assert.ok(m.target && m.target.hits.some((h) => toLabel(h) === 'D6'));
  });

  test('ambiguous sink attribution rejects the run that would strand another hit', () => {
    // Battleship E6-E9 (row E) and Destroyer F7-F8 touching below it. Hits so far:
    // E8, F8, E9, E7; then F7 reports sunk(2). Both E7-F7 and F7-F8 are 2-runs, but
    // E7-F7 would leave F8 uncoverable (F6, F9, D8, G8 are misses).
    const m = withResults(createMemory(10, [4, 2]), [
      ['F6', 'miss'], ['F9', 'miss'], ['D8', 'miss'], ['G8', 'miss'],
      ['E8', 'hit'], ['F8', 'hit'], ['E9', 'hit'], ['E7', 'hit'], ['F7', { kind: 'sunk', size: 2 }],
    ]);
    assert.equal(m.cells[toIndex(fromLabel('F7'))], 'sunk');
    assert.equal(m.cells[toIndex(fromLabel('F8'))], 'sunk');
    assert.equal(m.cells[toIndex(fromLabel('E7'))], 'hit');
    assert.deepEqual(unresolvedHits(m).map(toLabel).sort(), ['E7', 'E8', 'E9']);
    const shots = labelsOfNextShots('hard', m);
    for (const s of shots) assert.ok(['E6', 'E10'].includes(s), s);
  });

  test('a hit off the target line is kept unresolved but does not corrupt the axis', () => {
    const m = withResults(createMemory(10, FLEET), [['D4', 'hit'], ['D5', 'hit'], ['G8', 'hit']]);
    assert.equal(m.target.axis, 'horizontal');
    assert.equal(m.target.hits.length, 2);
    assert.equal(unresolvedHits(m).length, 3);
  });
});

describe('targeting (Medium and Hard), criterion 14', () => {
  for (const level of ['medium', 'hard']) {
    test(`${level}: hits at D4, D5 -> next shot in {D3, D6}`, () => {
      const m = withResults(createMemory(10, FLEET), [['D4', 'hit'], ['D5', 'hit']]);
      const shots = labelsOfNextShots(level, m);
      assert.ok(shots.length > 0);
      for (const s of shots) assert.ok(['D3', 'D6'].includes(s), `unexpected ${s}`);
    });

    test(`${level}: hits D3-D5 with D2 a miss -> D6`, () => {
      const m = withResults(createMemory(10, FLEET), [['D2', 'miss'], ['D3', 'hit'], ['D4', 'hit'], ['D5', 'hit']]);
      assert.deepEqual(labelsOfNextShots(level, m), ['D6']);
    });

    test(`${level}: single hit -> next shot is an orthogonal neighbour`, () => {
      const m = withResults(createMemory(10, FLEET), [['E5', 'hit']]);
      const allowed = neighbours(fromLabel('E5')).map(toLabel);
      for (const s of labelsOfNextShots(level, m)) assert.ok(allowed.includes(s), s);
    });

    test(`${level}: after a sink, no candidate adjacent to the wreck remains`, () => {
      const m = withResults(createMemory(10, FLEET), [['D4', 'hit'], ['D5', 'hit'], ['D6', { kind: 'sunk', size: 3 }]]);
      assert.deepEqual(targetCandidates(m), []);
      const wreckNeighbours = new Set(['D3', 'D7', 'C4', 'C5', 'C6', 'E4', 'E5', 'E6']);
      // With no information the next shot should not be biased toward the wreck.
      const shots = labelsOfNextShots(level, m, 200);
      const nearWreck = shots.filter((s) => wreckNeighbours.has(s)).length;
      assert.ok(nearWreck <= 2, `too many shots near wreck: ${nearWreck}`);
    });
  }

  test('medium hunts on a checkerboard parity until a hit', () => {
    const ai = createAi('medium');
    const m = createMemory(10, FLEET);
    for (let s = 1; s <= 100; s++) {
      const c = ai.chooseShot(m, makeRng(s));
      assert.equal((c.row + c.col) % 2, 0);
    }
  });
});

describe('hard density', () => {
  test('with exactly one legal Destroyer placement left, fires there', () => {
    let m = createMemory(10, [2]);
    // Miss everywhere except A1, A2.
    for (let i = 2; i < 100; i++) m.cells[i] = 'miss';
    const shots = labelsOfNextShots('hard', m);
    assert.ok(shots.every((s) => s === 'A1' || s === 'A2'), shots.join());
    m = observe(m, fromLabel('A1'), { kind: 'hit' });
    assert.deepEqual(labelsOfNextShots('hard', m), ['A2']);
  });

  test('treats sunk-ship cells as blocked for other ships', () => {
    // Sunk destroyer at A1-A2 (row A, cols 1-2). Cruiser remains; no placement may cross A1/A2.
    const m = withResults(createMemory(10, [3, 2]), [['A1', 'hit'], ['A2', { kind: 'sunk', size: 2 }]]);
    const d = density(m);
    // A3 can only be reached by horizontal placements starting at A3.. (not crossing A2) or vertical.
    // Check: score at A3 excludes any placement that includes A1 or A2.
    let horizontalThroughA2 = 0;
    // If sunk cells were treated as open, A3 would gain extra horizontal placements (A1-A3, A2-A4).
    const openMemory = { ...m, cells: m.cells.map((c) => (c === 'sunk' ? 'unknown' : c)) };
    const dOpen = density(openMemory);
    horizontalThroughA2 = dOpen[toIndex(fromLabel('A3'))] - d[toIndex(fromLabel('A3'))];
    assert.equal(horizontalThroughA2, 2);
    assert.equal(d[toIndex(fromLabel('A1'))], 0);
    assert.equal(d[toIndex(fromLabel('A2'))], 0);
  });

  test('unresolved hits dominate: only placements covering a hit are counted', () => {
    const m = withResults(createMemory(10, FLEET), [['E5', 'hit']]);
    const d = density(m);
    assert.equal(d[toIndex(fromLabel('A1'))], 0);
    assert.ok(d[toIndex(fromLabel('E4'))] > 0);
    assert.ok(d[toIndex(fromLabel('E6'))] > 0);
  });

  test('falls back to hunting when the record is inconsistent (no legal placements)', () => {
    let m = createMemory(10, [5]);
    // Only a 2-cell gap left: no 5-length placement can exist.
    for (let i = 2; i < 100; i++) m.cells[i] = 'miss';
    const shots = labelsOfNextShots('hard', m);
    for (const s of shots) assert.ok(['A1', 'A2'].includes(s));
  });
});

describe('interface', () => {
  test('createAi exposes level, chooseShot, observe, createMemory for each level', () => {
    for (const level of LEVELS) {
      const ai = createAi(level);
      assert.equal(ai.level, level);
      assert.equal(typeof ai.chooseShot, 'function');
      assert.equal(typeof ai.observe, 'function');
      const m = ai.createMemory(10, FLEET);
      const c = ai.chooseShot(m, makeRng(1));
      assert.ok(c.row >= 0 && c.row < 10 && c.col >= 0 && c.col < 10);
    }
    assert.throws(() => createAi('impossible'));
  });

  test('criterion 9: no level ever fires at a known cell (random walk of results)', () => {
    for (const level of LEVELS) {
      const ai = createAi(level);
      const rng = makeRng(99);
      let m = ai.createMemory(10, FLEET);
      for (let shot = 0; shot < 100; shot++) {
        const c = ai.chooseShot(m, rng);
        assert.equal(m.cells[toIndex(c)], 'unknown', `${level} refired at ${toLabel(c)}`);
        const r = rng();
        const result = r < 0.6 ? { kind: 'miss' } : r < 0.9 ? { kind: 'hit' } : { kind: 'sunk', size: 2 };
        m = ai.observe(m, c, result);
      }
    }
  });
});
