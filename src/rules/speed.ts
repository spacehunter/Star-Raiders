/**
 * Twin-Ion engine speeds and engine drain.
 * MANUAL_SPEC §5.1 (V table), §12.2 (engine units/second), §17.1 (VELOCITYTAB, DRAINRATETAB).
 */

/** A game starts at speed key 6 (§17.1). */
export const START_SPEED_KEY = 6;

/** §17.1 VELOCITYTAB: internal velocity in KM per game loop for keys 0..9. */
export const VELOCITY_TAB = [0, 1, 2, 4, 8, 16, 32, 64, 96, 112] as const;

/** §5.1: V as printed in the manual for keys 0..9. */
export const MANUAL_V_TAB = [0, 0, 0, 1, 3, 6, 12, 25, 37, 43] as const;

/** §17.1: V on the panel = floor(100 · velocity / 256). */
export function panelV(velocity: number): number {
  return Math.floor((100 * velocity) / 256);
}

/** V shown for a speed key once the ship has reached that key's velocity. */
export function panelVForKey(key: number): number {
  return panelV(VELOCITY_TAB[key]);
}

/** §17.1 DRAINRATETAB: engine drain in 1/256 energy units per game loop, keys 0..9. */
export const ENGINE_DRAIN_TAB = [0, 4, 6, 8, 10, 12, 14, 30, 45, 60] as const;

/** §12.2: engine drain in units per second as printed in the manual, keys 0..9. */
export const MANUAL_ENGINE_UNITS_PER_SECOND = [0, 1, 1.5, 2, 2.5, 3, 3.5, 7.5, 11.25, 15] as const;

/** §12.2 footnote: "The most efficient speed is 6 (V=12)". */
export const MOST_EFFICIENT_SPEED_KEY = 6;
