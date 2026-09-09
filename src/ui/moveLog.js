import { h } from './dom.js';

const WORD = { miss: 'miss', hit: 'hit', sunk: 'sunk', win: 'sunk' };

export function renderMoveLog(snap) {
  const items = snap.log.map((e) => h('li', {
    class: e.by,
    'data-testid': 'log-entry',
    'data-by': e.by,
    'data-label': e.label,
    'data-kind': WORD[e.kind],
    text: `${e.by === 'player' ? 'You' : 'Computer'}: ${e.label} — ${WORD[e.kind]}${e.shipName ? ` (${e.shipName})` : ''}`,
  }));
  const list = h('ol', { class: 'log', 'data-testid': 'log', 'aria-label': 'Move log' }, items);
  return h('section', { class: 'panel' }, [
    h('h2', { text: 'Move log' }),
    items.length ? list : h('p', { class: 'muted', text: 'No moves yet.' }),
  ]);
}
