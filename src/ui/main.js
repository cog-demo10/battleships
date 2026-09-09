// Entry point: wires the game state machine to the DOM. Renders the snapshot,
// dispatches actions, and contains no rules of its own.
import { createGame } from '../game/game.js';
import { randomSeed } from '../rng.js';
import { h } from './dom.js';
import { handleGridKeys } from './grid.js';
import { renderStartScreen } from './startScreen.js';
import { renderPlacementScreen } from './placementScreen.js';
import { renderFleetBoard } from './fleetBoard.js';
import { renderTargetBoard } from './targetBoard.js';
import { renderStatusBar } from './statusBar.js';
import { renderMoveLog } from './moveLog.js';
import { renderGameOver } from './gameOver.js';

const params = new URLSearchParams(location.search);
// ?seed=N replays an exact game; ?delay=ms shortens the pause before the computer fires.
const seedParam = Number(params.get('seed'));
const seed = Number.isInteger(seedParam) && seedParam >= 0 ? seedParam : randomSeed();
const delayParam = Number(params.get('delay'));
const AI_DELAY = Number.isFinite(delayParam) && delayParam >= 0 ? delayParam : 600;

const game = createGame({ seed });
const root = document.getElementById('app');
let commit = 'dev';
let hover = null;
let aiTimer = null;

function setHover(coord) {
  const before = hover ? `${hover.row},${hover.col}` : '';
  const after = coord ? `${coord.row},${coord.col}` : '';
  if (before === after) return;
  hover = coord;
  render();
}

function scheduleAi() {
  if (aiTimer !== null) return;
  aiTimer = setTimeout(() => {
    aiTimer = null;
    game.dispatch({ type: 'AI_FIRE' });
  }, AI_DELAY);
}

function render() {
  const snap = game.snapshot();
  const active = document.activeElement;
  const focusKey = active instanceof HTMLElement ? (active.dataset.cell || active.dataset.testid) : null;

  const children = [];
  if (snap.phase === 'selecting') {
    hover = null;
    children.push(renderStartScreen(game.dispatch));
  } else if (snap.phase === 'placing') {
    children.push(renderPlacementScreen(snap, game.dispatch, { hover, setHover }));
  } else {
    if (snap.phase === 'finished') children.push(renderGameOver(snap, game.dispatch, commit));
    children.push(renderStatusBar(snap));
    children.push(h('div', { class: 'boards' }, [
      renderTargetBoard({
        view: snap.enemy,
        enabled: snap.phase === 'playing' && snap.turn === 'player',
        onSelect: (coord) => game.dispatch({ type: 'FIRE', coord }),
      }),
      renderFleetBoard({ board: snap.playerBoard, title: 'Your fleet', interactive: false }),
    ]));
    children.push(renderMoveLog(snap));
    if (snap.phase === 'playing' && snap.turn === 'ai') scheduleAi();
  }

  root.replaceChildren(...children);

  if (focusKey) {
    const again = root.querySelector(`[data-cell="${focusKey}"], [data-testid="${focusKey}"]`);
    if (again instanceof HTMLElement && !again.hasAttribute('disabled')) again.focus({ preventScroll: true });
  }
}

root.addEventListener('keydown', (e) => handleGridKeys(e, game.snapshot().size));
game.subscribe(render);
render();

fetch('./version.json', { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : null))
  .then((v) => {
    if (v && typeof v.commit === 'string' && v.commit) {
      commit = v.commit;
      document.getElementById('commit').textContent = commit;
      if (game.snapshot().phase === 'finished') render();
    }
  })
  .catch(() => { /* not deployed: footer keeps "dev" */ });
