import { h } from './dom.js';

function describe(entry) {
  if (!entry) return 'No shots yet.';
  const who = entry.by === 'player' ? 'You' : 'Computer';
  switch (entry.kind) {
    case 'miss': return `${who} fired at ${entry.label}: miss.`;
    case 'hit': return `${who} fired at ${entry.label}: hit!`;
    case 'sunk': return `${who} fired at ${entry.label}: sunk the ${entry.shipName}!`;
    case 'win': return `${who} fired at ${entry.label}: sunk the ${entry.shipName} — all ships down!`;
    default: return '';
  }
}

export function renderStatusBar(snap) {
  const turn = snap.phase === 'finished'
    ? 'Game over'
    : (snap.turn === 'player' ? 'Your turn' : 'Computer is firing…');
  return h('section', { class: 'panel status', 'data-testid': 'status' }, [
    h('span', { class: 'badge level', 'data-testid': 'level', text: `Level: ${snap.level}` }),
    h('span', { class: 'turn', 'data-testid': 'turn', role: 'status', text: turn }),
    h('span', { 'data-testid': 'remaining', text: `Enemy ships left: ${snap.enemyRemaining} · Yours: ${snap.playerRemaining}` }),
    h('span', { 'data-testid': 'last-shot', role: 'status', text: describe(snap.lastShot) }),
  ]);
}
