/**
 * Fixed-timestep simulation clock (MANUAL_SPEC §17 intro, §8, §17.4).
 *
 * The ROM counts time in game loops (about one per 1/60 s frame) and TICKs (one per
 * 1/60 s vertical blank). Here both run at exactly LOOP_HZ, one TICK per loop, so the
 * simulation is frame-rate independent: `advance(dt)` runs as many whole loops as the
 * elapsed time holds and carries the remainder to the next frame.
 *
 * The star date's last digit advances every 41 loops (shown NN.NN). Zylon fleets move on
 * star-date tick 100 and then every 50 ticks; each move tick is reported so the rating
 * can charge its -1 (§17.10).
 */
import {
  FIRST_FLEET_MOVE_TICKS,
  FLEET_MOVE_INTERVAL_TICKS,
  LOOP_HZ,
  LOOPS_PER_STAR_DATE_TICK,
  STAR_DATE_MODULO,
} from '../rules/timing';

export { LOOP_HZ };

/** Length of one loop in seconds. */
export const LOOP_SECONDS = 1 / LOOP_HZ;

export interface LoopEvents {
  /** Loop number, 1-based. */
  loop: number;
  /** The star date advanced by one digit this loop. */
  starDateTick: boolean;
  /** A Zylon fleet move tick happened this loop. */
  fleetMoveTick: boolean;
}

/** Tolerance so that n steps of 1/60 s always make exactly n loops despite float rounding. */
const EPSILON = 1e-6;

export class SimClock {
  /** Game loops run. */
  public loops = 0;
  /** TICKs (vertical blanks) elapsed; one per loop at LOOP_HZ. */
  public ticks = 0;
  /** Star-date digits elapsed (star date × 100). */
  public starDateTicks = 0;
  /** Fleet move ticks so far. */
  public fleetMoveTicks = 0;

  private clockTimer = LOOPS_PER_STAR_DATE_TICK - 1;
  private fleetTimer = FIRST_FLEET_MOVE_TICKS - 1;
  private pending = 0;

  /**
   * Add elapsed seconds and run every whole loop it completes, calling `onLoop` for each.
   * Returns the number of loops run.
   */
  public advance(seconds: number, onLoop?: (events: LoopEvents) => void): number {
    this.pending += Math.max(0, seconds) * LOOP_HZ;
    let n = 0;
    while (this.pending >= 1 - EPSILON) {
      this.pending -= 1;
      const events = this.step();
      onLoop?.(events);
      n++;
    }
    if (this.pending < 0) this.pending = 0;
    return n;
  }

  /** Run exactly one loop. */
  public step(): LoopEvents {
    this.loops++;
    this.ticks++;
    let starDateTick = false;
    let fleetMoveTick = false;

    // ROM FLUSHGAMELOOP: DEC CLOCKTIM / BPL, reset to 40 -> one digit every 41 loops.
    this.clockTimer--;
    if (this.clockTimer < 0) {
      this.clockTimer = LOOPS_PER_STAR_DATE_TICK - 1;
      this.starDateTicks++;
      starDateTick = true;

      // ZYLONUNITTIM starts at 99, then resets to 49 after each move.
      this.fleetTimer--;
      if (this.fleetTimer < 0) {
        this.fleetTimer = FLEET_MOVE_INTERVAL_TICKS - 1;
        this.fleetMoveTicks++;
        fleetMoveTick = true;
      }
    }
    return { loop: this.loops, starDateTick, fleetMoveTick };
  }

  /** Star date as a number, e.g. 1.23. */
  public get starDateValue(): number {
    return (this.starDateTicks % STAR_DATE_MODULO) / 100;
  }

  /** Star date as the chart shows it: NN.NN. */
  public get starDate(): string {
    return formatStarDate(this.starDateTicks);
  }

  /** Simulated seconds elapsed. */
  public get seconds(): number {
    return this.loops / LOOP_HZ;
  }
}

/** Format star-date ticks as NN.NN (wraps after 99.99). */
export function formatStarDate(starDateTicks: number): string {
  const t = ((starDateTicks % STAR_DATE_MODULO) + STAR_DATE_MODULO) % STAR_DATE_MODULO;
  const s = t.toString().padStart(4, '0');
  return `${s.slice(0, 2)}.${s.slice(2)}`;
}
