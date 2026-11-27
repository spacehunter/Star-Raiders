/**
 * Rating tables.
 * MANUAL_SPEC §14 (formula, M table, ranks, classes) and §17.10 (ROM GAMEOVER, RANKTAB, CLASSTAB).
 */
import type { MissionLevel } from './levels';

export type MissionOutcome = 'complete' | 'zeroEnergy' | 'destroyed' | 'aborted';

/**
 * §14.2 values for M (ROM BONUSTAB). The ROM uses the "mission aborted" column for both
 * zero energy and the player's abort key.
 */
export const MISSION_BONUS: Readonly<Record<MissionLevel, { complete: number; aborted: number; destroyed: number }>> = {
  NOVICE: { complete: 80, aborted: 60, destroyed: 40 },
  PILOT: { complete: 76, aborted: 60, destroyed: 50 },
  WARRIOR: { complete: 60, aborted: 50, destroyed: 40 },
  COMMANDER: { complete: 111, aborted: 100, destroyed: 90 },
};

export function missionBonus(level: MissionLevel, outcome: MissionOutcome): number {
  const row = MISSION_BONUS[level];
  return outcome === 'complete' ? row.complete : outcome === 'destroyed' ? row.destroyed : row.aborted;
}

/** §14.1 / §17.10: running-score changes. */
export const SCORE = {
  zylonDestroyed: 6,
  starbaseShotByYou: -3,
  starbaseDestroyedByZylons: -18,
  fleetMoveTick: -1,
  energy100Used: -1,
} as const;

/** §17.10 RANKTAB: rank per index = total score / 16, limited to 0..18. */
export const RANK_TAB = [
  'GALACTIC COOK',
  'GARBAGE SCOW CAPTAIN',
  'GARBAGE SCOW CAPTAIN',
  'ROOKIE',
  'ROOKIE',
  'NOVICE',
  'NOVICE',
  'ENSIGN',
  'ENSIGN',
  'PILOT',
  'PILOT',
  'ACE',
  'LIEUTENANT',
  'WARRIOR',
  'CAPTAIN',
  'COMMANDER',
  'COMMANDER',
  'STAR COMMANDER',
  'STAR COMMANDER',
] as const;
export type Rank = (typeof RANK_TAB)[number];

/** §17.10 CLASSTAB: class digit per class index 0..15. */
export const CLASS_TAB = [5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1] as const;

/** Highest rank index; totals at or above 19 × 16 = 304 rate STAR COMMANDER class 1. */
export const MAX_RANK_INDEX = 18;

/** §14.3: the manual's rank table (score ranges). */
export const MANUAL_RANKS: ReadonlyArray<{ rank: Rank; min: number; max: number }> = [
  { rank: 'ROOKIE', min: 48, max: 79 },
  { rank: 'NOVICE', min: 80, max: 111 },
  { rank: 'ENSIGN', min: 112, max: 143 },
  { rank: 'PILOT', min: 144, max: 175 },
  { rank: 'ACE', min: 176, max: 191 },
  { rank: 'LIEUTENANT', min: 192, max: 207 },
  { rank: 'WARRIOR', min: 208, max: 223 },
  { rank: 'CAPTAIN', min: 224, max: 239 },
  { rank: 'COMMANDER', min: 240, max: 271 },
  { rank: 'STAR COMMANDER', min: 272, max: 303 },
];

/** §14.3 / §17.10: gag ranks below 48 points. */
export const GAG_RANKS: ReadonlyArray<{ rank: Rank; min: number; max: number }> = [
  { rank: 'GALACTIC COOK', min: 0, max: 15 },
  { rank: 'GARBAGE SCOW CAPTAIN', min: 16, max: 47 },
];
