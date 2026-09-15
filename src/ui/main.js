// Entry point: wires the game state machine to the DOM. Renders the snapshot,
// dispatches actions, and contains no rules of its own.
import { createGame } from '../game/game.js';
import { readOptions } from './options.js';
import { h } from './dom.js';
import { handleGridKeys } from './grid.js';
import { renderStartScreen, officerFor } from './startScreen.js';
import { avatarSrc, loadAvatar, loadBests, recordBest, saveAvatar } from './avatar.js';
import { renderPlacementScreen } from './placementScreen.js';
import { renderFleetBoard } from './fleetBoard.js';
import { renderTargetBoard } from './targetBoard.js';
import { renderStatusBar } from './statusBar.js';
import { renderMoveLog } from './moveLog.js';
import { renderGameOver } from './gameOver.js';

const { seed, delay: AI_DELAY } = readOptions(location.search);

const game = createGame({ seed });
const root = document.getElementById('app');
let commit = 'dev';
let hover = null;
let aiTimer = null;
let rendering = false;
let selectedAvatar = loadAvatar();
let bests = loadBests();
let bestRecorded = false;

const onAvatar = (id) => {
  selectedAvatar = id;
  saveAvatar(id);
  render();
};

function setHover(coord) {
  if (rendering) return;
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

function cancelAi() {
  if (aiTimer === null) return;
  clearTimeout(aiTimer);
  aiTimer = null;
}

function render() {
  rendering = true;
  try {
    paint();
  } finally {
    rendering = false;
  }
}

function paint() {
  const snap = game.snapshot();
  if (snap.phase === 'finished' && !bestRecorded) {
    bests = recordBest(bests, snap.level, snap.stats, snap.winner);
    bestRecorded = true;
  } else if (snap.phase !== 'finished') {
    bestRecorded = false;
  }
  const active = document.activeElement;
  const focusKey = active instanceof HTMLElement ? (active.dataset.cell || active.dataset.testid) : null;

  const children = [];
  if (snap.phase === 'selecting') {
    hover = null;
    children.push(renderStartScreen(game.dispatch, { selectedAvatar, onAvatar, bestByLevel: bests }));
  } else if (snap.phase === 'placing') {
    children.push(renderPlacementScreen(snap, game.dispatch, { hover, setHover }));
  } else {
    if (snap.phase === 'finished') children.push(renderGameOver(snap, game.dispatch, commit));
    children.push(renderStatusBar(snap, game.dispatch));
    const officer = officerFor(snap.level);
    children.push(h('div', { class: 'boards' }, [
      h('div', { class: 'board-side side-target' }, [
        officer ? h('img', {
          class: 'portrait officer',
          src: officer.src,
          alt: '',
          'aria-hidden': 'true',
          loading: 'lazy',
          width: '96',
          height: '96',
        }) : null,
        renderTargetBoard({
          view: snap.enemy,
          revealed: snap.revealedFleet,
          enabled: snap.phase === 'playing' && snap.turn === 'player',
          onSelect: (coord) => game.dispatch({ type: 'FIRE', coord }),
        }),
      ]),
      h('div', { class: 'board-side side-fleet' }, [
        renderFleetBoard({ board: snap.playerBoard, title: 'Your fleet', interactive: false }),
        h('img', {
          class: 'portrait avatar',
          src: avatarSrc(selectedAvatar),
          alt: '',
          'aria-hidden': 'true',
          loading: 'lazy',
          width: '96',
          height: '96',
        }),
      ]),
    ]));
    children.push(renderMoveLog(snap));
  }
  if (snap.phase === 'playing' && snap.turn === 'ai') scheduleAi();
  else cancelAi();

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
