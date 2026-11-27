/**
 * Simulation timing constants.
 * MANUAL_SPEC §8 (STAR DATE), §17 intro (loops and TICKs), §17.4 (star date and fleet move ticks).
 */

/** Game loops per second. The ROM runs about one loop per 1/60 s NTSC frame. */
export const LOOP_HZ = 60;

/** §17.4: the star date's last digit advances every 41 loops (CLOCKTIM counts 40..0). */
export const LOOPS_PER_STAR_DATE_TICK = 41;

/** §17.4: Zylon fleets first move after 100 star-date ticks (1.00), then every 50 (0.50). */
export const FIRST_FLEET_MOVE_TICKS = 100;
export const FLEET_MOVE_INTERVAL_TICKS = 50;

/** Star date wraps after 99.99. */
export const STAR_DATE_MODULO = 10000;
