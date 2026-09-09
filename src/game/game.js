// Game state machine. The only module that imports both engine and ai.
//
//   selecting -> placing -> playing(playerTurn | aiTurn) -> finished
//   finished -> placing   (PLAY_AGAIN: same level, new seed)
//   finished -> selecting (CHANGE_DIFFICULTY)
//
// All randomness comes from one rng seeded per game; seed + actions replays exactly.

import { makeRng, randomInt } from '../rng.js';
import {
  createBoard, isValidPlacement, placeShip, fireAt, opponentView, shotAt, remainingShips,
} from '../engine/board.js';
import { STANDARD_FLEET, randomFleet } from '../engine/fleet.js';
import { DEFAULT_SIZE, toLabel } from '../engine/coords.js';
import { createAi, LEVELS } from '../ai/index.js';

/** @typedef {import('../engine/coords.js').Coord} Coord */
/** @typedef {import('../engine/board.js').Board} Board */
/** @typedef {import('../engine/board.js').ShotResult} ShotResult */
/** @typedef {import('../ai/index.js').Level} Level */
/** @typedef {'selecting'|'placing'|'playing'|'finished'} Phase */
/** @typedef {'player'|'ai'|null} Turn */
/**
 * @typedef {object} LogEntry
 * @property {number} n         1-based move number
 * @property {'player'|'ai'} by
 * @property {Coord} coord
 * @property {string} label
 * @property {'miss'|'hit'|'sunk'|'win'} kind
 * @property {string} [shipName]
 */
/**
 * @typedef {{ type: 'SELECT_DIFFICULTY', level: Level }
 *  | { type: 'PLACE_SHIP', coord: Coord }
 *  | { type: 'TOGGLE_ORIENTATION' }
 *  | { type: 'RANDOMISE' }
 *  | { type: 'CLEAR_FLEET' }
 *  | { type: 'START' }
 *  | { type: 'FIRE', coord: Coord }
 *  | { type: 'AI_FIRE' }
 *  | { type: 'PLAY_AGAIN' }
 *  | { type: 'CHANGE_DIFFICULTY' }} Action
 */

/**
 * @param {{ seed: number, size?: number, fleet?: { name: string, length: number }[], level?: Level }} options
 *   `level` skips the selecting phase (used by tests and replays).
 */
export function createGame({ seed, size = DEFAULT_SIZE, fleet = STANDARD_FLEET, level }) {
  let rng = makeRng(seed);
  /** @type {Phase} */ let phase = 'selecting';
  /** @type {Turn} */ let turn = null;
  /** @type {Level|null} */ let currentLevel = null;
  let ai = null;
  let aiMemory = null;
  /** @type {Board} */ let playerBoard = createBoard(size);
  /** @type {Board} */ let enemyBoard = createBoard(size);
  /** @type {'horizontal'|'vertical'} */ let orientation = 'horizontal';
  /** @type {string|null} */ let placementError = null;
  /** @type {LogEntry[]} */ let log = [];
  /** @type {LogEntry|null} */ let lastShot = null;
  /** @type {'player'|'ai'|null} */ let winner = null;
  let currentSeed = seed;
  const listeners = new Set();

  function enterPlacing() {
    playerBoard = createBoard(size);
    enemyBoard = createBoard(size);
    orientation = 'horizontal';
    placementError = null;
    log = [];
    lastShot = null;
    winner = null;
    turn = null;
    aiMemory = null;
    phase = 'placing';
  }

  function selectDifficulty(level) {
    if (!LEVELS.includes(level)) return false;
    currentLevel = level;
    ai = createAi(level);
    enterPlacing();
    return true;
  }

  function nextSpec() {
    return fleet[playerBoard.ships.length] || null;
  }

  function place(coord) {
    const spec = nextSpec();
    if (!spec) { placementError = 'All ships are placed'; return false; }
    if (!isValidPlacement(playerBoard, coord, orientation, spec.length)) {
      placementError = `Cannot place ${spec.name} at ${toLabel(coord)} ${orientation}: it would overlap another ship or leave the grid`;
      return false;
    }
    playerBoard = placeShip(playerBoard, spec, coord, orientation);
    placementError = null;
    return true;
  }

  function start() {
    if (playerBoard.ships.length !== fleet.length) {
      placementError = `Place all ${fleet.length} ships before starting`;
      return false;
    }
    enemyBoard = randomFleet(rng, fleet, size);
    aiMemory = ai.createMemory(size, fleet.map((s) => s.length));
    phase = 'playing';
    turn = 'player';
    placementError = null;
    return true;
  }

  /** @param {'player'|'ai'} by @param {Coord} coord @param {ShotResult} result */
  function record(by, coord, result) {
    const entry = { n: log.length + 1, by, coord, label: toLabel(coord), kind: result.kind };
    if (result.kind === 'sunk' || result.kind === 'win') entry.shipName = result.ship.name;
    log = [...log, entry];
    lastShot = entry;
  }

  function playerFire(coord) {
    if (shotAt(enemyBoard, coord) !== 'unknown') return false;
    const { board, result } = fireAt(enemyBoard, coord);
    enemyBoard = board;
    record('player', coord, result);
    if (result.kind === 'win') { phase = 'finished'; winner = 'player'; turn = null; } else turn = 'ai';
    return true;
  }

  function aiFire() {
    const coord = ai.chooseShot(aiMemory, rng);
    if (shotAt(playerBoard, coord) !== 'unknown') throw new Error(`AI fired at a known cell ${toLabel(coord)}`);
    const { board, result } = fireAt(playerBoard, coord);
    playerBoard = board;
    record('ai', coord, result);
    // The opponent learns only miss / hit / sunk + size; never the board.
    const redacted = result.kind === 'miss' || result.kind === 'hit'
      ? { kind: result.kind }
      : { kind: 'sunk', size: result.ship.length };
    aiMemory = ai.observe(aiMemory, coord, redacted);
    if (result.kind === 'win') { phase = 'finished'; winner = 'ai'; turn = null; } else turn = 'player';
    return true;
  }

  /**
   * Apply an action. Returns true if it changed the state, false if it was refused
   * (wrong phase, wrong turn, known cell). Never throws for out-of-turn input.
   * @param {Action} action
   */
  function dispatch(action) {
    let changed = false;
    switch (action.type) {
      case 'SELECT_DIFFICULTY':
        changed = phase === 'selecting' && selectDifficulty(action.level);
        break;
      case 'PLACE_SHIP':
        if (phase === 'placing') { place(action.coord); changed = true; }
        break;
      case 'TOGGLE_ORIENTATION':
        if (phase === 'placing') { orientation = orientation === 'horizontal' ? 'vertical' : 'horizontal'; changed = true; }
        break;
      case 'RANDOMISE':
        if (phase === 'placing') { playerBoard = randomFleet(rng, fleet, size); placementError = null; changed = true; }
        break;
      case 'CLEAR_FLEET':
        if (phase === 'placing') { playerBoard = createBoard(size); placementError = null; changed = true; }
        break;
      case 'START':
        if (phase === 'placing') { start(); changed = true; }
        break;
      case 'FIRE':
        changed = phase === 'playing' && turn === 'player' && playerFire(action.coord);
        break;
      case 'AI_FIRE':
        changed = phase === 'playing' && turn === 'ai' && aiFire();
        break;
      case 'PLAY_AGAIN':
        if (phase === 'finished') {
          currentSeed = randomInt(rng, 4294967296);
          rng = makeRng(currentSeed);
          enterPlacing();
          changed = true;
        }
        break;
      case 'CHANGE_DIFFICULTY':
        if (phase === 'finished') {
          currentSeed = randomInt(rng, 4294967296);
          rng = makeRng(currentSeed);
          currentLevel = null;
          ai = null;
          enterPlacing();
          phase = 'selecting';
          changed = true;
        }
        break;
      default:
        changed = false;
    }
    if (changed) for (const fn of listeners) fn();
    return changed;
  }

  function snapshot() {
    const shots = log.filter((e) => e.by === 'player');
    const hits = shots.filter((e) => e.kind !== 'miss').length;
    return Object.freeze({
      phase,
      turn,
      level: currentLevel,
      seed: currentSeed,
      size,
      fleet,
      playerBoard,
      enemy: opponentView(enemyBoard),
      enemyRemaining: remainingShips(enemyBoard).length,
      playerRemaining: remainingShips(playerBoard).length,
      placement: {
        nextShip: phase === 'placing' ? nextSpec() : null,
        orientation,
        error: placementError,
        placedCount: playerBoard.ships.length,
        complete: playerBoard.ships.length === fleet.length,
      },
      log,
      lastShot,
      winner,
      stats: {
        shots: shots.length,
        hits,
        accuracy: shots.length ? hits / shots.length : 0,
      },
    });
  }

  if (level) selectDifficulty(level);

  return {
    dispatch,
    snapshot,
    /** @param {() => void} fn */
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** The active AI instance (tests assert its type changes with difficulty). */
    get ai() { return ai; },
  };
}
