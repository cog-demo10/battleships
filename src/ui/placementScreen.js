import { h } from './dom.js';
import { renderFleetBoard } from './fleetBoard.js';

/**
 * @param {ReturnType<import('../game/game.js').createGame>['snapshot']} snap
 * @param {(action: object) => void} dispatch
 * @param {{ hover: object|null, setHover: (c) => void }} ui
 */
export function renderPlacementScreen(snap, dispatch, ui) {
  const { placement, playerBoard, fleet, level } = snap;
  const next = placement.nextShip;
  const preview = next && ui.hover
    ? {
      coord: ui.hover,
      orientation: placement.orientation,
      length: next.length,
      valid: placement.canPlaceAt(ui.hover),
    }
    : null;

  const instructions = next
    ? `Place your ${next.name} (${next.length} cells), ${placement.orientation}. Click a cell for its ${placement.orientation === 'horizontal' ? 'left' : 'top'} end.`
    : 'All ships placed. Ready to start.';

  return h('div', { 'data-testid': 'placement-screen' }, [
    h('section', { class: 'panel' }, [
      h('h2', {}, ['Place your fleet ', h('span', { class: 'badge level', 'data-testid': 'level', text: `Level: ${level}` })]),
      h('p', { 'data-testid': 'placement-instructions', text: instructions }),
      h('div', { class: 'placement-controls' }, [
        h('button', {
          type: 'button', 'data-testid': 'orientation',
          'aria-pressed': placement.orientation === 'vertical' ? 'true' : 'false',
          onClick: () => dispatch({ type: 'TOGGLE_ORIENTATION' }),
          text: `Orientation: ${placement.orientation}`,
        }),
        h('button', { type: 'button', 'data-testid': 'randomise', onClick: () => dispatch({ type: 'RANDOMISE' }), text: 'Randomise' }),
        h('button', { type: 'button', 'data-testid': 'clear', onClick: () => dispatch({ type: 'CLEAR_FLEET' }), text: 'Clear' }),
        h('button', {
          type: 'button', class: 'primary', 'data-testid': 'start',
          disabled: !placement.complete,
          onClick: () => dispatch({ type: 'START' }),
          text: 'Start game',
        }),
      ]),
      h('ul', { class: 'fleet-list', 'aria-label': 'Ships' }, fleet.map((s, i) => h('li', {
        class: i < placement.placedCount ? 'placed' : (i === placement.placedCount ? 'current' : ''),
        text: `${s.name} (${s.length})`,
      }))),
      h('p', { class: 'error', role: 'alert', 'data-testid': 'placement-error', text: placement.error || '' }),
    ]),
    renderFleetBoard({
      board: playerBoard,
      title: 'Your fleet',
      preview,
      interactive: true,
      onSelect: (coord) => dispatch({ type: 'PLACE_SHIP', coord }),
      onHover: ui.setHover,
    }),
  ]);
}
