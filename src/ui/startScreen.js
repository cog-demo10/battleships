import { h } from './dom.js';

const LEVELS = [
  { level: 'easy', title: 'Easy', blurb: 'Fires at random. Never remembers a hit.' },
  { level: 'medium', title: 'Medium', blurb: 'Hunts on a checkerboard, then follows up hits along a line.' },
  { level: 'hard', title: 'Hard', blurb: 'Weighs every unknown cell by how many ways a ship could still fit there.' },
];

/** @param {(action: object) => void} dispatch */
export function renderStartScreen(dispatch) {
  return h('section', { class: 'panel start', 'data-testid': 'start-screen' }, [
    h('h2', { text: 'Choose your opponent' }),
    h('p', { class: 'muted', text: 'Standard rules: 10×10 grid, five ships, alternating single shots. Sink all five to win.' }),
    h('div', { class: 'levels', role: 'group', 'aria-label': 'Difficulty' },
      LEVELS.map(({ level, title, blurb }) => h('button', {
        type: 'button',
        'data-testid': `level-${level}`,
        onClick: () => dispatch({ type: 'SELECT_DIFFICULTY', level }),
      }, [h('strong', { text: title }), h('small', { text: blurb })]))),
  ]);
}
