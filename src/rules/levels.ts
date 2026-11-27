/**
 * Mission levels and the per-level tables.
 * MANUAL_SPEC §15 (skill levels), §17.3 (damage chance), §17.4 (counts), §17.7 (Zylon homing).
 */

export const LEVELS = ['NOVICE', 'PILOT', 'WARRIOR', 'COMMANDER'] as const;
export type MissionLevel = (typeof LEVELS)[number];

/** Level index 0..3 as the ROM's MISSIONLEVEL uses it. */
export function levelIndex(level: MissionLevel): number {
  const i = LEVELS.indexOf(level);
  if (i < 0) throw new Error(`Unknown mission level ${level}`);
  return i;
}

/**
 * §17.4: per level the ROM places level+3 sectors each of 2-ship, 3-ship and 4-ship
 * Zylon groups, plus level+3 starbases.
 */
export const GROUP_SIZES = [2, 3, 4] as const;

export function groupsPerSize(level: MissionLevel): number {
  return levelIndex(level) + 3;
}

/** §15 / §17.4: 27 / 36 / 45 / 54 Zylon starships. */
export function zylonCount(level: MissionLevel): number {
  return groupsPerSize(level) * GROUP_SIZES.reduce((a, b) => a + b, 0);
}

/** §15 / §17.4: 3 / 4 / 5 / 6 starbases. */
export function starbaseCount(level: MissionLevel): number {
  return groupsPerSize(level);
}

/** §15: hyperwarp steering is automatic only at NOVICE. */
export function hyperwarpSteeringRequired(level: MissionLevel): boolean {
  return level !== 'NOVICE';
}

/**
 * §17.7: Zylon photon torpedo homing toward your axis, per level
 * (NOVICE 1, PILOT 4, WARRIOR 8, COMMANDER 20).
 */
export const ZYLON_TORPEDO_HOMING: Readonly<Record<MissionLevel, number>> = {
  NOVICE: 1,
  PILOT: 4,
  WARRIOR: 8,
  COMMANDER: 20,
};

/** §17.7: Zylons fire from behind on every level except NOVICE. */
export function zylonsFireFromBehind(level: MissionLevel): boolean {
  return level !== 'NOVICE';
}
