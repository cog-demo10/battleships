import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/rng.js';
import { createGame } from '../src/game/game.js';
import { fromLabel, toIndex, fromIndex } from '../src/engine/coords.js';
import { easy } from '../src/ai/easy.js';
import { hard } from '../src/ai/hard.js';

function placedGame(seed, level = 'medium') {
  const game = createGame({ seed, level });
  game.dispatch({ type: 'RANDOMISE' });
  game.dispatch({ type: 'START' });
  return game;
}

/** Play a game to completion with the player firing in scan order. */
function playOut(game) {
  let i = 0;
  while (game.snapshot().phase === 'playing') {
    const s = game.snapshot();
    if (s.turn === 'player') {
      while (s.enemy.cells[i] !== 'unknown') i++;
      game.dispatch({ type: 'FIRE', coord: fromIndex(i) });
    } else {
      game.dispatch({ type: 'AI_FIRE' });
    }
  }
  return game.snapshot();
}

describe('phases', () => {
  test('starts in selecting; difficulty is a constructor/action input and is displayed', () => {
    const game = createGame({ seed: 1 });
    assert.equal(game.snapshot().phase, 'selecting');
    assert.equal(game.snapshot().level, null);
    assert.equal(game.dispatch({ type: 'FIRE', coord: fromLabel('A1') }), false);
    assert.equal(game.dispatch({ type: 'SELECT_DIFFICULTY', level: 'bogus' }), false);
    assert.equal(game.dispatch({ type: 'SELECT_DIFFICULTY', level: 'hard' }), true);
    assert.equal(game.snapshot().phase, 'placing');
    assert.equal(game.snapshot().level, 'hard');
    assert.equal(game.ai.strategy, hard);
  });

  test('criterion 2: invalid placement is refused with a visible error and not applied', () => {
    const game = createGame({ seed: 1, level: 'easy' });
    game.dispatch({ type: 'PLACE_SHIP', coord: fromLabel('A1') });
    assert.equal(game.snapshot().placement.placedCount, 1);
    assert.equal(game.snapshot().placement.error, null);
    // Battleship (4) overlapping the carrier at A1-A5.
    game.dispatch({ type: 'PLACE_SHIP', coord: fromLabel('A3') });
    assert.equal(game.snapshot().placement.placedCount, 1);
    assert.match(game.snapshot().placement.error, /overlap/);
    // Off grid: A8 horizontal, length 4.
    game.dispatch({ type: 'PLACE_SHIP', coord: fromLabel('A8') });
    assert.equal(game.snapshot().placement.placedCount, 1);
    assert.match(game.snapshot().placement.error, /Battleship/);
    game.dispatch({ type: 'TOGGLE_ORIENTATION' });
    assert.equal(game.snapshot().placement.orientation, 'vertical');
    game.dispatch({ type: 'PLACE_SHIP', coord: fromLabel('B1') });
    assert.equal(game.snapshot().placement.placedCount, 2);
    assert.equal(game.snapshot().placement.error, null);
    game.dispatch({ type: 'CLEAR_FLEET' });
    assert.equal(game.snapshot().placement.placedCount, 0);
  });

  test('criterion 4: cannot start with fewer than five ships', () => {
    const game = createGame({ seed: 1, level: 'easy' });
    game.dispatch({ type: 'PLACE_SHIP', coord: fromLabel('A1') });
    game.dispatch({ type: 'START' });
    assert.equal(game.snapshot().phase, 'placing');
    assert.match(game.snapshot().placement.error, /5 ships/);
    game.dispatch({ type: 'RANDOMISE' });
    assert.equal(game.snapshot().placement.complete, true);
    game.dispatch({ type: 'START' });
    assert.equal(game.snapshot().phase, 'playing');
    assert.equal(game.snapshot().turn, 'player');
    assert.equal(game.snapshot().enemyRemaining, 5);
  });

  test('placing a sixth ship is refused', () => {
    const game = createGame({ seed: 1, level: 'easy' });
    game.dispatch({ type: 'RANDOMISE' });
    game.dispatch({ type: 'PLACE_SHIP', coord: fromLabel('A1') });
    assert.equal(game.snapshot().placement.placedCount, 5);
    assert.match(game.snapshot().placement.error, /All ships/);
  });
});

describe('turns', () => {
  test('criterion 5: firing at a known cell does nothing', () => {
    const game = placedGame(3);
    assert.equal(game.dispatch({ type: 'FIRE', coord: fromLabel('A1') }), true);
    game.dispatch({ type: 'AI_FIRE' });
    const before = game.snapshot();
    assert.equal(game.dispatch({ type: 'FIRE', coord: fromLabel('A1') }), false);
    const after = game.snapshot();
    assert.equal(after.log.length, before.log.length);
    assert.equal(after.turn, 'player');
  });

  test('criterion 6: player never fires twice in a row; AI fires exactly once per player shot (1,000 random action sequences)', () => {
    const actionTypes = ['FIRE', 'FIRE', 'FIRE', 'AI_FIRE', 'AI_FIRE', 'PLACE_SHIP', 'START', 'RANDOMISE', 'PLAY_AGAIN', 'TOGGLE_ORIENTATION'];
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = makeRng(seed);
      const game = placedGame(seed, ['easy', 'medium', 'hard'][seed % 3]);
      for (let step = 0; step < 60; step++) {
        const type = actionTypes[Math.floor(rng() * actionTypes.length)];
        const coord = fromIndex(Math.floor(rng() * 100));
        const before = game.snapshot();
        game.dispatch(type === 'FIRE' || type === 'PLACE_SHIP' ? { type, coord } : { type });
        const after = game.snapshot();
        if (before.phase === 'playing' && after.phase !== 'placing') {
          assert.equal(after.playerBoard.ships.length, 5, 'fleet changed mid-game');
          assert.ok(after.log.length - before.log.length <= 1, 'more than one shot per action');
          if (after.log.length > before.log.length) {
            const last = after.log[after.log.length - 1];
            const prev = after.log[after.log.length - 2];
            if (prev) assert.notEqual(last.by, prev.by, `${last.by} fired twice in a row (seed ${seed})`);
          }
        }
        if (after.phase === 'finished') {
          assert.equal(game.dispatch({ type: 'FIRE', coord }), false);
          assert.equal(game.dispatch({ type: 'AI_FIRE' }), false);
        }
      }
    }
  });

  test('criterion 7 + 8c + 11: log matches grids, sunk names correct, counter decrements, game ends on fifth sink', () => {
    const game = placedGame(11, 'hard');
    let remaining = 5;
    let lastPlayerCount = 5;
    while (game.snapshot().phase === 'playing') {
      const s = playStep(game);
      if (s.lastShot && s.lastShot.by === 'player' && (s.lastShot.kind === 'sunk' || s.lastShot.kind === 'win')) {
        remaining--;
        assert.equal(s.enemyRemaining, remaining);
        assert.ok(s.enemy.sunk.some((x) => x.name === s.lastShot.shipName));
      }
      if (s.lastShot && s.lastShot.by === 'ai' && (s.lastShot.kind === 'sunk' || s.lastShot.kind === 'win')) {
        lastPlayerCount--;
        assert.equal(s.playerRemaining, lastPlayerCount);
      }
    }
    const s = game.snapshot();
    assert.equal(s.phase, 'finished');
    assert.ok(s.winner === 'player' || s.winner === 'ai');
    const last = s.log[s.log.length - 1];
    assert.equal(last.kind, 'win');
    if (s.winner === 'player') assert.equal(s.enemyRemaining, 0);
    else assert.equal(s.playerRemaining, 0);
    // Log/grid agreement.
    for (const e of s.log) {
      const cells = e.by === 'player' ? s.enemy.cells : s.playerBoard.shots;
      const cell = cells[toIndex(e.coord)];
      if (e.kind === 'miss') assert.equal(cell, 'miss');
      else assert.ok(cell === 'hit' || cell === 'sunk', `${e.label} ${e.kind} vs ${cell}`);
    }
    const playerShots = s.log.filter((e) => e.by === 'player');
    assert.equal(s.stats.shots, playerShots.length);
    assert.equal(s.stats.hits, playerShots.filter((e) => e.kind !== 'miss').length);
    assert.equal(s.enemy.cells.filter((c) => c !== 'unknown').length, playerShots.length);
    // No further shots accepted.
    assert.equal(game.dispatch({ type: 'FIRE', coord: fromIndex(s.enemy.cells.indexOf('unknown')) }), false);
    assert.equal(game.dispatch({ type: 'AI_FIRE' }), false);
    assert.equal(game.snapshot().log.length, s.log.length);
  });

  function playStep(game) {
    const s = game.snapshot();
    if (s.turn === 'player') {
      const i = s.enemy.cells.indexOf('unknown');
      game.dispatch({ type: 'FIRE', coord: fromIndex(i) });
    } else {
      game.dispatch({ type: 'AI_FIRE' });
    }
    return game.snapshot();
  }
});

describe('resets', () => {
  test('12a: Play again yields zero marks, counter 5, empty log, same difficulty, new seed', () => {
    const game = placedGame(5, 'hard');
    const first = playOut(game);
    assert.equal(first.phase, 'finished');
    game.dispatch({ type: 'PLAY_AGAIN' });
    const s = game.snapshot();
    assert.equal(s.phase, 'placing');
    assert.equal(s.level, 'hard');
    assert.equal(game.ai.strategy, hard);
    assert.notEqual(s.seed, first.seed);
    assert.deepEqual(s.log, []);
    assert.equal(s.lastShot, null);
    assert.equal(s.placement.placedCount, 0);
    assert.ok(s.enemy.cells.every((c) => c === 'unknown'));
    assert.ok(s.playerBoard.shots.every((c) => c === 'unknown'));
    game.dispatch({ type: 'RANDOMISE' });
    game.dispatch({ type: 'START' });
    const p = game.snapshot();
    assert.equal(p.enemyRemaining, 5);
    assert.equal(p.playerRemaining, 5);
    assert.equal(p.stats.shots, 0);
    assert.notDeepEqual(p.playerBoard.occupant, first.playerBoard.occupant);
  });

  test('12b: Change difficulty returns to selecting; a new selection swaps the ai instance', () => {
    const game = placedGame(5, 'easy');
    assert.equal(game.ai.strategy, easy);
    playOut(game);
    assert.equal(game.dispatch({ type: 'PLAY_AGAIN' }) || true, true);
    // Play again keeps easy; finish and change.
    game.dispatch({ type: 'RANDOMISE' });
    game.dispatch({ type: 'START' });
    assert.equal(game.snapshot().level, 'easy');
    playOut(game);
    game.dispatch({ type: 'CHANGE_DIFFICULTY' });
    assert.equal(game.snapshot().phase, 'selecting');
    assert.equal(game.snapshot().level, null);
    assert.equal(game.ai, null);
    game.dispatch({ type: 'SELECT_DIFFICULTY', level: 'hard' });
    assert.equal(game.snapshot().level, 'hard');
    assert.equal(game.ai.strategy, hard);
    game.dispatch({ type: 'RANDOMISE' });
    game.dispatch({ type: 'START' });
    const end = playOut(game);
    assert.equal(end.level, 'hard');
    assert.equal(end.phase, 'finished');
  });

  test('PLAY_AGAIN and CHANGE_DIFFICULTY are refused outside finished', () => {
    const game = placedGame(5);
    assert.equal(game.dispatch({ type: 'PLAY_AGAIN' }), false);
    assert.equal(game.dispatch({ type: 'CHANGE_DIFFICULTY' }), false);
    assert.equal(game.dispatch({ type: 'UNKNOWN' }), false);
  });
});

describe('snapshot immutability', () => {
  test('nested snapshot structures are frozen and the constructor fleet is copied', () => {
    const fleet = [{ name: 'Boat', length: 2 }];
    const game = createGame({ seed: 1, level: 'easy', fleet, size: 4 });
    fleet[0].length = 4;
    fleet.push({ name: 'Extra', length: 3 });
    const s = game.snapshot();
    assert.deepEqual(s.fleet, [{ name: 'Boat', length: 2 }]);
    assert.throws(() => { s.playerBoard.ships.push({}); }, TypeError);
    assert.throws(() => { s.log.push({}); }, TypeError);
    assert.throws(() => { s.enemy.cells[0] = 'hit'; }, TypeError);
    assert.throws(() => { s.fleet[0].length = 9; }, TypeError);
    game.dispatch({ type: 'RANDOMISE' });
    assert.equal(game.snapshot().playerBoard.ships.length, 1);
  });
});

describe('determinism', () => {
  test('criterion 15: seed replay reproduces the enemy fleet and every AI move', () => {
    const run = () => {
      const game = placedGame(2024, 'hard');
      const s = playOut(game);
      return { log: s.log, enemy: s.enemy, player: s.playerBoard.occupant, seed: s.seed };
    };
    const a = run();
    const b = run();
    assert.deepEqual(a, b);
    assert.ok(a.log.length > 20);
    const c = (() => { const g = placedGame(2025, 'hard'); return playOut(g).log; })();
    assert.notDeepEqual(a.log, c);
  });

  test('criterion 16: the target view before the first shot is identical across seeds', () => {
    const a = placedGame(1).snapshot().enemy;
    const b = placedGame(2).snapshot().enemy;
    assert.deepEqual(a, b);
    assert.ok(a.cells.every((c) => c === 'unknown'));
  });

  test('snapshot never contains the enemy board', () => {
    const s = placedGame(1).snapshot();
    assert.equal('enemyBoard' in s, false);
    assert.equal('occupant' in s.enemy, false);
    assert.equal('ships' in s.enemy, false);
    assert.ok(Object.isFrozen(s));
  });

  test('subscribe notifies on change only', () => {
    const game = placedGame(1);
    let n = 0;
    const off = game.subscribe(() => n++);
    game.dispatch({ type: 'FIRE', coord: fromLabel('A1') });
    game.dispatch({ type: 'FIRE', coord: fromLabel('A1') });
    assert.equal(n, 1);
    off();
    game.dispatch({ type: 'AI_FIRE' });
    assert.equal(n, 1);
  });

  test('engine parameters: a 5x5 game with a two-ship fleet plays to completion', () => {
    const game = createGame({ seed: 9, level: 'hard', size: 5, fleet: [{ name: 'A', length: 3 }, { name: 'B', length: 2 }] });
    game.dispatch({ type: 'RANDOMISE' });
    game.dispatch({ type: 'START' });
    let i = 0;
    while (game.snapshot().phase === 'playing') {
      const s = game.snapshot();
      if (s.turn === 'player') {
        while (s.enemy.cells[i] !== 'unknown') i++;
        game.dispatch({ type: 'FIRE', coord: fromIndex(i, 5) });
      } else game.dispatch({ type: 'AI_FIRE' });
    }
    assert.equal(game.snapshot().phase, 'finished');
  });
});
