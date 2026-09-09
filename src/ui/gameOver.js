import { h } from './dom.js';

/**
 * @param {object} snap
 * @param {(action: object) => void} dispatch
 * @param {string} commit  deployed short commit hash (or "dev")
 */
export function renderGameOver(snap, dispatch, commit) {
  const won = snap.winner === 'player';
  const pct = `${Math.round(snap.stats.accuracy * 100)}%`;
  return h('section', { class: 'panel gameover', 'data-testid': 'game-over', role: 'dialog', 'aria-labelledby': 'gameover-title' }, [
    h('h2', { id: 'gameover-title', 'data-testid': 'result', text: won ? 'You win!' : 'You lose' }),
    h('dl', {}, [
      h('dt', { text: 'Level' }), h('dd', { 'data-testid': 'go-level', text: snap.level }),
      h('dt', { text: 'Your shots' }), h('dd', { 'data-testid': 'go-shots', text: String(snap.stats.shots) }),
      h('dt', { text: 'Accuracy' }), h('dd', { 'data-testid': 'go-accuracy', text: `${pct} (${snap.stats.hits}/${snap.stats.shots})` }),
      h('dt', { text: 'Seed' }), h('dd', { 'data-testid': 'go-seed', text: String(snap.seed) }),
      h('dt', { text: 'Build' }), h('dd', { 'data-testid': 'go-commit', text: commit }),
    ]),
    h('div', { class: 'actions' }, [
      h('button', { type: 'button', class: 'primary', 'data-testid': 'play-again', onClick: () => dispatch({ type: 'PLAY_AGAIN' }), text: 'Play again' }),
      h('button', { type: 'button', 'data-testid': 'change-difficulty', onClick: () => dispatch({ type: 'CHANGE_DIFFICULTY' }), text: 'Change difficulty' }),
    ]),
  ]);
}
