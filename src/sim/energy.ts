/**
 * Energy simulation: MANUAL_SPEC §12 (energy usage) and §17.1 (ROM UPDPANEL / DECENERGY).
 *
 * - Every loop adds the drains (shields 8, computer 2, life support 1, engine rate) in 1/256
 *   units to a counter; each carry costs one unit. The ROM rates are scaled by 64/LOOP_HZ so
 *   the player gets the manual's per-second figures (see rules/energy.ts).
 * - Lump costs: photon 10, hit 100, hyperwarp abort 100, hyperspace 10 per loop (sim/hyperwarp.ts
 *   charges WARPENERGY − 1 of them).
 * - Taking 1 or 10 units across a 100-unit boundary costs one point of score (the ROM's
 *   "energy used / 100"); 100-unit lumps never do, as in DECENERGY.
 * - Taking energy below zero ends the mission: energy shows 0 and `zeroEnergy` is set
 *   ("MISSION ABORTED / ZERO ENERGY").
 */
import {
  COST,
  HYPERWARP_ENGINE_DRAIN,
  LOOP_DRAIN,
  LOW_ENERGY_THRESHOLD,
  MANUAL_LOOPS_PER_SECOND,
  SCORE_UNITS_PER_POINT,
  START_ENERGY,
  SUBUNITS_PER_UNIT,
} from '../rules/energy';
import { ENGINE_DRAIN_TAB } from '../rules/speed';
import { LOOP_HZ } from '../rules/timing';

/** Whatever holds the ENERGY readout (GameState in the game, a plain object in tests). */
export interface EnergyHost {
  energy: number;
}

/** What is switched on during a loop. */
export interface EnergyLoad {
  /** Selected speed key 0..9 (the ROM sets the engine drain from the key pressed). */
  engineKey: number;
  shields: boolean;
  computer: boolean;
  /** Hyperwarp engaged: the engine drain is that of key 7. */
  hyperwarp?: boolean;
}

export interface EnergyCallbacks {
  /** Score points lost to energy use (always 1 per call). */
  onScoreLoss?: (points: number) => void;
  /** Energy ran out; the mission is aborted. */
  onZeroEnergy?: () => void;
}

/** One unit in counter steps: the counter holds subunits × MANUAL_LOOPS_PER_SECOND. */
const COUNTER_PER_UNIT = SUBUNITS_PER_UNIT * LOOP_HZ;

/** ROM subunits drained per loop for a load (shields + computer + life support + engines). */
export function loopDrainSubunits(load: EnergyLoad): number {
  const engine = load.hyperwarp ? HYPERWARP_ENGINE_DRAIN : (ENGINE_DRAIN_TAB[clampKey(load.engineKey)] ?? 0);
  return (
    (load.shields ? LOOP_DRAIN.shields : 0) + (load.computer ? LOOP_DRAIN.computer : 0) + LOOP_DRAIN.lifeSupport + engine
  );
}

/** Units drained per second by a load at LOOP_HZ (equals the manual's §12 figures). */
export function drainUnitsPerSecond(load: EnergyLoad): number {
  return (loopDrainSubunits(load) * MANUAL_LOOPS_PER_SECOND) / SUBUNITS_PER_UNIT;
}

function clampKey(key: number): number {
  return Math.max(0, Math.min(9, Math.round(key)));
}

export class EnergySim {
  public zeroEnergy = false;
  /** Total units taken this mission (for reports; the score uses boundary crossings). */
  public unitsUsed = 0;

  private readonly host: EnergyHost;
  private readonly callbacks: EnergyCallbacks;
  private counter = 0;

  constructor(host: EnergyHost, callbacks: EnergyCallbacks = {}) {
    this.host = host;
    this.callbacks = callbacks;
  }

  /** Run one loop's continuous drains. */
  public loop(load: EnergyLoad): void {
    if (this.zeroEnergy) return;
    this.counter += loopDrainSubunits(load) * MANUAL_LOOPS_PER_SECOND;
    while (this.counter >= COUNTER_PER_UNIT && !this.zeroEnergy) {
      this.counter -= COUNTER_PER_UNIT;
      this.take(1);
    }
  }

  /** A photon torpedo was launched: −10. */
  public firePhoton(): void {
    this.take(COST.photon);
  }

  /** Hit by a Zylon torpedo or a meteor: −100. */
  public hit(): void {
    this.take(COST.hit);
  }

  /** Hyperwarp aborted with a 0–9 key: −100 (R: ABORTWARP). */
  public abortHyperwarp(): void {
    this.take(COST.hyperwarpAbort);
  }

  /** One hyperspace loop: −10 (R: HYPERWARP "DEC WARPENERGY", DECENERGY). */
  public hyperspaceLoop(): void {
    this.take(COST.hyperspacePerLoop);
  }

  /** TRANSFER COMPLETE: energy back to 9999. */
  public refill(): void {
    if (this.zeroEnergy) return;
    this.host.energy = START_ENERGY;
  }

  /** Below 1000 units the panel flashes. */
  public get isLow(): boolean {
    return this.host.energy < LOW_ENERGY_THRESHOLD;
  }

  /**
   * ROM DECENERGY for 1, 10 or 100 units (it also accepts other amounts as a sum of those).
   * Returns false once energy has run out.
   */
  public take(units: number): boolean {
    if (this.zeroEnergy) return false;
    const before = this.host.energy;
    const after = before - units;
    this.unitsUsed += Math.min(units, Math.max(0, before));
    // Only the tens-digit borrow costs score, so 100-unit lumps never do.
    if (units % SCORE_UNITS_PER_POINT !== 0) {
      const crossed = Math.floor(before / SCORE_UNITS_PER_POINT) - Math.floor(after / SCORE_UNITS_PER_POINT);
      for (let i = 0; i < crossed; i++) this.callbacks.onScoreLoss?.(1);
    }
    if (after < 0) {
      this.host.energy = 0;
      this.zeroEnergy = true;
      this.callbacks.onZeroEnergy?.();
      return false;
    }
    this.host.energy = after;
    return true;
  }
}
