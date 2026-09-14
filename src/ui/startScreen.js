import { h } from './dom.js';
import { AVATARS, avatarSrc } from './avatar.js';

export const OFFICERS = [
  { level: 'easy', rank: 'Ensign', name: 'Ensign Tunstall', src: './assets/officers/ensign-tunstall.png', blurb: 'Fires wherever takes his fancy and hopes.' },
  { level: 'medium', rank: 'Lieutenant', name: 'Lieutenant Vane', src: './assets/officers/lieutenant-vane.png', blurb: 'Searches on a pattern, then works outward from whatever she hits.' },
  { level: 'hard', rank: 'Admiral', name: 'Admiral Merrick', src: './assets/officers/admiral-merrick.png', blurb: 'Counts every square a surviving ship could still occupy, and fires at the busiest one.' },
];

export const officerFor = (level) => OFFICERS.find((o) => o.level === level);

/** @param {(action: object) => void} dispatch */
export function renderStartScreen(dispatch, { selectedAvatar, onAvatar, bestByLevel }) {
  return h('section', { class: 'panel start', 'data-testid': 'start-screen' }, [
    h('div', { class: 'opponents' }, [
      h('h2', { text: 'Choose your opponent' }),
      h('p', { class: 'muted', text: 'Standard rules: 10×10 grid, five ships, alternating single shots. Sink all five to win.' }),
      h('div', { class: 'levels', role: 'group', 'aria-label': 'Difficulty' },
        OFFICERS.map(({ level, name, src, blurb }) => {
          const best = bestByLevel[level];
          const shots = best ? `${best.shots} ${best.shots === 1 ? 'shot' : 'shots'}` : '';
          return h('button', {
            type: 'button',
            'data-testid': `level-${level}`,
            onClick: () => dispatch({ type: 'SELECT_DIFFICULTY', level }),
          }, [
            h('img', { class: 'officer-portrait', src, alt: '', 'aria-hidden': 'true', loading: 'lazy', width: '80', height: '80' }),
            h('span', { class: 'card-text' }, [
              h('strong', { text: name }),
              h('small', { text: blurb }),
              best ? h('small', { class: 'best', text: `Personal best against them: ${shots}` }) : null,
            ]),
          ]);
        })),
    ]),
    h('div', { class: 'avatars' }, [
      h('h2', { text: 'Choose your avatar' }),
      h('div', { class: 'avatar-grid', role: 'group', 'aria-label': 'Avatar' },
        AVATARS.map((id, i) => h('button', {
          type: 'button',
          'aria-label': `Avatar ${i + 1}`,
          'aria-pressed': id === selectedAvatar ? 'true' : 'false',
          onClick: () => onAvatar(id),
        }, [
          h('img', { src: avatarSrc(id), alt: '', 'aria-hidden': 'true', loading: 'lazy', width: '96', height: '96' }),
        ]))),
    ]),
    h('h2', { class: 'admiralty-wordmark', text: 'Admiralty' }),
  ]);
}
