/**
 * Energy constants.
 * MANUAL_SPEC §12 (manual energy usage) and §17.1 (ROM per-loop drains and lump costs).
 */

/** §12: every mission (all levels) starts with 9999 units; docking refills to 9999 (§17.9). */
export const START_ENERGY = 9999;

/** §12 / §17.1: the panel flashes below 1000 units. */
export const LOW_ENERGY_THRESHOLD = 1000;

/** §17.1: the low-energy panel alternates pink $44 / dark blue $90 every 128 loops. */
export const LOW_ENERGY_FLASH_LOOPS = 128;

/** The ROM's energy counter counts 1/256 units ("subunits"). */
export const SUBUNITS_PER_UNIT = 256;

/** §17.1: per-loop drains in subunits (the engine rate comes from ENGINE_DRAIN_TAB). */
export const LOOP_DRAIN = {
  shields: 8,
  computer: 2,
  lifeSupport: 1,
} as const;

/** §17.5 / ROM HYPERWARP: while hyperwarp is engaged the engine drain is that of key 7. */
export const HYPERWARP_ENGINE_DRAIN = 30;

/** §12.1: manual drains in units per second. */
export const MANUAL_DRAIN_UNITS_PER_SECOND = {
  enemyHit: 100,
  photon: 10,
  shields: 2,
  computer: 0.5,
  lifeSupport: 0.25,
} as const;

/**
 * The manual's per-second figures (§12.1, §12.2) are the ROM's per-loop subunit rates at
 * exactly 64 loops per second: 14/256 × 64 = 3.5, 8/256 × 64 = 2, 2/256 × 64 = ½, 1/256 × 64 = ¼.
 * The simulation runs 60 loops per second (core/clock.ts) and scales the ROM rates by 64/60 so
 * the player gets the manual's per-second drain.
 */
export const MANUAL_LOOPS_PER_SECOND = 64;

/** §17.1 lump costs, in units. */
export const COST = {
  photon: 10,
  hit: 100,
  hyperwarpAbort: 100,
  hyperspacePerLoop: 10,
} as const;

/** §17.1: crossing a 100-unit boundary costs one point of score. */
export const SCORE_UNITS_PER_POINT = 100;
