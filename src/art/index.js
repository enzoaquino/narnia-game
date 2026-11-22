import { PALETTE } from './palette.js';
import { TILE_SPRITES } from './tiles.js';
import { CHARACTER_SPRITES } from './characters.js';
import { ITEM_SPRITES } from './items.js';

export { PALETTE };

export const SPRITES = { ...TILE_SPRITES, ...CHARACTER_SPRITES, ...ITEM_SPRITES };

export const SPRITE_GROUPS = {
  Tiles: Object.keys(TILE_SPRITES),
  Characters: Object.keys(CHARACTER_SPRITES),
  Items: Object.keys(ITEM_SPRITES),
};
