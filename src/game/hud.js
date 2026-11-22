import { VIEW_WIDTH, HUD_HEIGHT } from '../config.js';

export function heartStates(health, maxHealth) {
  const states = [];
  for (let i = 0; i < maxHealth / 2; i++) {
    const left = health - i * 2;
    states.push(left >= 2 ? 'full' : left === 1 ? 'half' : 'empty');
  }
  return states;
}

export function drawHud(r, room) {
  const p = room.player;
  r.rect(0, 0, VIEW_WIDTH, HUD_HEIGHT, '#10141f');
  heartStates(p.health, p.maxHealth).forEach((state, i) => r.sprite(`heart_${state}`, 4 + i * 10, 4));
  r.text(room.name, VIEW_WIDTH / 2, 4, { align: 'center', color: '#e8f0f8' });
  if (p.hasKey) r.sprite('key', VIEW_WIDTH - 12, 4);
}
