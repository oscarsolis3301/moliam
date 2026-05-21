export const QUESTION_DURATION_MS = 25_000;

// Projectile-throw mini-game (waiting room after a player has answered).
// Each player gets a fixed ammo budget per question and a brief cooldown
// between throws so the host's screen doesn't get carpet-bombed.
export const THROW_AMMO_PER_QUESTION = 12;
export const THROW_COOLDOWN_MS = 750;
export const THROW_KINDS = ['tomato', 'plane', 'pie', 'sparkle'] as const;
export type ThrowKind = (typeof THROW_KINDS)[number];
export const ANSWER_GRACE_MS = 1_000;
export const MAX_QUESTIONS_PER_QUIZ = 100;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_PLAYERS_PER_SESSION = 50;
export const NAME_MIN = 1;
export const NAME_MAX = 20;
export const OPTIONS_PER_QUESTION = 4;
export const REVEAL_TO_LEADERBOARD_MS = 3_000;

export const SESSION_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const SESSION_CODE_LENGTH = 6;

export const SHAPES = ['triangle', 'diamond', 'circle', 'square'] as const;
export type Shape = (typeof SHAPES)[number];

export const COLORS = ['red', 'blue', 'yellow', 'green'] as const;
export type Color = (typeof COLORS)[number];

export const TILE_DEFS: ReadonlyArray<{ shape: Shape; color: Color }> = [
  { shape: 'triangle', color: 'red' },
  { shape: 'diamond', color: 'blue' },
  { shape: 'circle', color: 'yellow' },
  { shape: 'square', color: 'green' },
];
