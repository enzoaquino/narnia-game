// Every tunable number lives here.
// Units: pixels, seconds, and half-hearts for health.

export const GAME_TITLE = 'Through the Wardrobe';
export const GAME_SUBTITLE = 'A Narnia Adventure';

export const TILE = 16;
export const ROOM_COLS = 16;
export const ROOM_ROWS = 11;
export const HUD_HEIGHT = 16;
export const VIEW_WIDTH = TILE * ROOM_COLS; // 256
export const VIEW_HEIGHT = TILE * ROOM_ROWS + HUD_HEIGHT; // 192
export const MIN_SCALE = 2;

export const STEP = 1 / 60; // fixed update timestep
export const MAX_FRAME = 0.25; // longest frame we simulate (e.g. after a tab switch)

export const PLAYER = {
  box: { w: 12, h: 12 },
  spriteOffset: { x: 2, y: 4 }, // sprite is drawn at (x - ox, y - oy)
  speed: 64,
  maxHealth: 6,
  swordTime: 0.25,
  swordCooldown: 0.15,
  swordReach: 12,
  swordWidth: 8,
  invulnTime: 1.0,
  knockbackSpeed: 160,
  knockbackTime: 0.15,
  walkFrameTime: 0.15,
  cornerNudge: 6,
};

export const WOLF = {
  box: { w: 12, h: 12 },
  spriteOffset: { x: 2, y: 4 },
  wanderSpeed: 28,
  chaseSpeed: 44,
  chaseRadius: 56,
  wanderMinTime: 0.6,
  wanderMaxTime: 1.6,
  health: 2,
  damage: 1,
  hurtTime: 0.3, // must be longer than PLAYER.swordTime so one swing = one hit
  knockbackSpeed: 150,
  knockbackTime: 0.15,
  heartDropChance: 0.35,
  walkFrameTime: 0.2,
};

export const NPC = { talkDistance: 22, noticeDistance: 48 };
export const PICKUP_SIZE = 8;
export const HEART_HEAL = 2;
export const DOOR_OPEN_TIME = 0.5;
export const DEATH_PAUSE = 1.0;

export const DIALOGUE = {
  charsPerSecond: 40,
  maxCharsPerLine: 44,
  linesPerPage: 3,
};

export const TOUCH = {
  deadZone: 0.25, // fraction of the D-pad radius where a finger presses nothing
};
