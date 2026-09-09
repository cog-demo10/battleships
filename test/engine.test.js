import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/rng.js';
import {
  createBoard, isValidPlacement, placeShip, fireAt, allSunk, isSunk, opponentView, shotAt, remainingShips,
} from '../src/engine/board.js';
import { neighbours, toLabel, fromLabel, shipCells, inBounds, toIndex, fromIndex } from '../src/engine/coords.js';
import { STANDARD_FLEET, randomFleet, hasTouchingShips } from '../src/engine/fleet.js';

describe('coords', () => {
  test('toLabel / fromLabel round-trip every cell', () => {
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const c = { row, col };
        assert.deepEqual(fromLabel(toLabel(c)), c);
      }
    }
    assert.equal(toLabel({ row: 1, col: 6 }), 'B7');
    assert.equal(toLabel({ row: 9, col: 9 }), 'J10');
  });

  test('toIndex / fromIndex round-trip', () => {
    for (let i = 0; i < 100; i++) assert.equal(toIndex(fromIndex(i)), i);
  });

  test('neighbours: edge-of-board off-by-ones for every cell (§5)', () => {
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const ns = neighbours({ row, col });
        const expected = 4 - (row === 0) - (row === 9) - (col === 0) - (col === 9);
        assert.equal(ns.length, expected, `neighbours of ${toLabel({ row, col })}`);
        for (const n of ns) {
          assert.ok(inBounds(n.row, n.col));
          assert.equal(Math.abs(n.row - row) + Math.abs(n.col - col), 1);
        }
      }
    }
    assert.deepEqual(neighbours({ row: 0, col: 0 }), [{ row: 0, col: 1 }, { row: 1, col: 0 }]);
  });

  test('shipCells lays out along the chosen axis', () => {
    assert.deepEqual(shipCells({ row: 2, col: 3 }, 'horizontal', 3), [
      { row: 2, col: 3 }, { row: 2, col: 4 }, { row: 2, col: 5 },
    ]);
    assert.deepEqual(shipCells({ row: 2, col: 3 }, 'vertical', 2), [{ row: 2, col: 3 }, { row: 3, col: 3 }]);
  });
});

describe('placement', () => {
  test('property: validity over all cells x orientations x lengths matches bounds (§5)', () => {
    const board = createBoard();
    for (let length = 1; length <= 5; length++) {
      for (const orientation of ['horizontal', 'vertical']) {
        for (let row = 0; row < 10; row++) {
          for (let col = 0; col < 10; col++) {
            const fits = orientation === 'horizontal' ? col + length <= 10 : row + length <= 10;
            assert.equal(isValidPlacement(board, { row, col }, orientation, length), fits,
              `${toLabel({ row, col })} ${orientation} ${length}`);
          }
        }
      }
    }
  });

  test('overlap is refused, touching is allowed (criterion 2)', () => {
    let board = placeShip(createBoard(), { name: 'Cruiser', length: 3 }, { row: 4, col: 4 }, 'horizontal');
    assert.equal(isValidPlacement(board, { row: 4, col: 5 }, 'vertical', 2), false);
    assert.equal(isValidPlacement(board, { row: 3, col: 4 }, 'vertical', 1), true);
    assert.equal(isValidPlacement(board, { row: 5, col: 4 }, 'horizontal', 3), true);
    assert.throws(() => placeShip(board, { name: 'X', length: 2 }, { row: 4, col: 6 }, 'horizontal'));
    assert.throws(() => placeShip(board, { name: 'X', length: 2 }, { row: 9, col: 9 }, 'horizontal'));
    assert.equal(isValidPlacement(board, { row: 0, col: 0 }, 'horizontal', 0), false);
    board = placeShip(board, { name: 'Destroyer', length: 2 }, { row: 5, col: 4 }, 'horizontal');
    assert.equal(board.ships.length, 2);
  });

  test('placeShip does not mutate its input', () => {
    const board = createBoard();
    const before = JSON.stringify(board);
    placeShip(board, { name: 'X', length: 2 }, { row: 0, col: 0 }, 'horizontal');
    assert.equal(JSON.stringify(board), before);
  });

  test('every occupied cell stores the identity of its ship', () => {
    const board = placeShip(createBoard(), { name: 'A', length: 2 }, { row: 0, col: 0 }, 'horizontal');
    const b2 = placeShip(board, { name: 'B', length: 2 }, { row: 1, col: 0 }, 'horizontal');
    assert.equal(b2.occupant[toIndex({ row: 0, col: 1 })], 0);
    assert.equal(b2.occupant[toIndex({ row: 1, col: 1 })], 1);
    assert.equal(b2.occupant[toIndex({ row: 2, col: 1 })], null);
  });
});

describe('firing', () => {
  test('miss, hit, sunk, win and refusal of repeat shots', () => {
    let board = placeShip(createBoard(), { name: 'Destroyer', length: 2 }, { row: 0, col: 0 }, 'horizontal');
    board = placeShip(board, { name: 'Sub', length: 3 }, { row: 5, col: 5 }, 'vertical');
    let r = fireAt(board, { row: 9, col: 9 });
    assert.equal(r.result.kind, 'miss');
    board = r.board;
    assert.throws(() => fireAt(board, { row: 9, col: 9 }), /already/);
    assert.throws(() => fireAt(board, { row: 10, col: 0 }), /off grid/);
    r = fireAt(board, { row: 0, col: 0 });
    assert.equal(r.result.kind, 'hit');
    r = fireAt(r.board, { row: 0, col: 1 });
    assert.equal(r.result.kind, 'sunk');
    assert.equal(r.result.ship.name, 'Destroyer');
    board = r.board;
    assert.equal(remainingShips(board).length, 1);
    for (const row of [5, 6]) board = fireAt(board, { row, col: 5 }).board;
    r = fireAt(board, { row: 7, col: 5 });
    assert.equal(r.result.kind, 'win');
    assert.equal(r.result.ship.name, 'Sub');
    assert.ok(allSunk(r.board));
    assert.equal(shotAt(r.board, { row: 9, col: 9 }), 'miss');
  });

  test('fireAt does not mutate its input', () => {
    const board = placeShip(createBoard(), { name: 'X', length: 2 }, { row: 0, col: 0 }, 'horizontal');
    const before = JSON.stringify(board);
    fireAt(board, { row: 0, col: 0 });
    assert.equal(JSON.stringify(board), before);
  });

  test('allSunk is false for an empty board', () => {
    assert.equal(allSunk(createBoard()), false);
  });

  test('8a/8b exhaustive: for every touching or collinear pair, a ship sinks iff all its own cells are hit and the other is untouched', () => {
    // Ship A fixed; ship B enumerated over every legal placement that touches A or lies on its line.
    const A = { name: 'A', length: 3 };
    const B = { name: 'B', length: 2 };
    let pairs = 0;
    for (const ao of ['horizontal', 'vertical']) {
      for (let ar = 0; ar < 10; ar++) for (let ac = 0; ac < 10; ac++) {
        const base = createBoard();
        if (!isValidPlacement(base, { row: ar, col: ac }, ao, A.length)) continue;
        const withA = placeShip(base, A, { row: ar, col: ac }, ao);
        const aCells = withA.ships[0].cells;
        for (const bo of ['horizontal', 'vertical']) {
          for (let br = 0; br < 10; br++) for (let bc = 0; bc < 10; bc++) {
            if (!isValidPlacement(withA, { row: br, col: bc }, bo, B.length)) continue;
            const bCells = shipCells({ row: br, col: bc }, bo, B.length);
            const touching = bCells.some((b) => neighbours(b).some((n) => aCells.some((a) => a.row === n.row && a.col === n.col)));
            const collinear = ao === bo && (ao === 'horizontal' ? br === ar : bc === ac);
            if (!touching && !collinear) continue;
            pairs++;
            let board = placeShip(withA, B, { row: br, col: bc }, bo);
            // Hit all of A but the last cell: A not sunk, B untouched.
            for (const c of aCells.slice(0, -1)) {
              const r = fireAt(board, c);
              assert.equal(r.result.kind, 'hit');
              board = r.board;
            }
            assert.equal(isSunk(board, board.ships[0]), false);
            const r = fireAt(board, aCells[aCells.length - 1]);
            assert.equal(r.result.kind, 'sunk');
            assert.equal(r.result.ship.name, 'A');
            board = r.board;
            for (const c of bCells) assert.equal(shotAt(board, c), 'unknown', 'sinking A changed a cell of B');
            assert.equal(isSunk(board, board.ships[1]), false);
            assert.equal(remainingShips(board).length, 1);
            // Now sink B: it must report win, not before.
            const r1 = fireAt(board, bCells[0]);
            assert.equal(r1.result.kind, 'hit');
            const r2 = fireAt(r1.board, bCells[1]);
            assert.equal(r2.result.kind, 'win');
            assert.equal(r2.result.ship.name, 'B');
          }
        }
      }
    }
    assert.ok(pairs > 1000, `expected many pairs, got ${pairs}`);
  });
});

describe('opponentView', () => {
  test('never exposes positions of unsunk ships; upgrades sunk cells; counts lengths', () => {
    let board = placeShip(createBoard(), { name: 'Destroyer', length: 2 }, { row: 0, col: 0 }, 'horizontal');
    board = placeShip(board, { name: 'Cruiser', length: 3 }, { row: 2, col: 0 }, 'horizontal');
    let view = opponentView(board);
    assert.ok(view.cells.every((c) => c === 'unknown'));
    assert.deepEqual(view.remainingLengths, [2, 3]);
    assert.deepEqual(view.sunk, []);
    assert.equal(Object.keys(view).sort().join(), 'cells,remainingLengths,size,sunk');
    board = fireAt(board, { row: 0, col: 0 }).board;
    board = fireAt(board, { row: 2, col: 0 }).board;
    board = fireAt(board, { row: 0, col: 1 }).board;
    view = opponentView(board);
    assert.equal(view.cells[toIndex({ row: 0, col: 0 })], 'sunk');
    assert.equal(view.cells[toIndex({ row: 0, col: 1 })], 'sunk');
    assert.equal(view.cells[toIndex({ row: 2, col: 0 })], 'hit');
    assert.equal(view.cells[toIndex({ row: 2, col: 1 })], 'unknown');
    assert.deepEqual(view.remainingLengths, [3]);
    assert.deepEqual(view.sunk, [{ name: 'Destroyer', length: 2 }]);
  });
});

describe('randomFleet', () => {
  test('criterion 3: 10,000 seeded runs, zero invalid layouts, >=10% touching', () => {
    let touching = 0;
    for (let seed = 1; seed <= 10000; seed++) {
      const board = randomFleet(makeRng(seed));
      assert.equal(board.ships.length, 5);
      const occupied = board.occupant.filter((o) => o !== null).length;
      assert.equal(occupied, 17, `seed ${seed}: overlap`);
      for (const ship of board.ships) {
        assert.equal(ship.cells.length, ship.length);
        for (const c of ship.cells) {
          assert.ok(inBounds(c.row, c.col), `seed ${seed}: off grid`);
          assert.equal(board.occupant[toIndex(c)], ship.id);
        }
      }
      if (hasTouchingShips(board)) touching++;
    }
    assert.ok(touching >= 1000, `touching layouts: ${touching}`);
  });

  test('is deterministic for a seed and different across seeds', () => {
    assert.deepEqual(randomFleet(makeRng(42)).occupant, randomFleet(makeRng(42)).occupant);
    assert.notDeepEqual(randomFleet(makeRng(42)).occupant, randomFleet(makeRng(43)).occupant);
    assert.deepEqual(STANDARD_FLEET.map((s) => s.length), [5, 4, 3, 3, 2]);
  });

  test('hasTouchingShips detects adjacency only between distinct ships', () => {
    let board = placeShip(createBoard(), { name: 'A', length: 3 }, { row: 0, col: 0 }, 'horizontal');
    assert.equal(hasTouchingShips(board), false);
    board = placeShip(board, { name: 'B', length: 2 }, { row: 5, col: 5 }, 'vertical');
    assert.equal(hasTouchingShips(board), false);
    board = placeShip(board, { name: 'C', length: 2 }, { row: 1, col: 0 }, 'horizontal');
    assert.equal(hasTouchingShips(board), true);
  });

  test('works on a small grid with a custom fleet', () => {
    const board = randomFleet(makeRng(7), [{ name: 'A', length: 2 }, { name: 'B', length: 2 }], 3);
    assert.equal(board.size, 3);
    assert.equal(board.ships.length, 2);
  });
});

describe('rng', () => {
  test('makeRng is deterministic and in [0,1)', () => {
    const a = makeRng(123); const b = makeRng(123);
    for (let i = 0; i < 100; i++) {
      const x = a();
      assert.equal(x, b());
      assert.ok(x >= 0 && x < 1);
    }
  });
});
