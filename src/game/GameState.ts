import { START_ENERGY } from '../rules/energy';
import { allSystemsOk, type DamageStatus } from '../rules/damage';
import type { MissionOutcome } from '../rules/rating';
import type { MissionRating } from '../sim/rating';

/**
 * GameState - Central state management for the game
 */

export const ViewMode = {
  FRONT: 'FRONT',
  AFT: 'AFT',
  GALACTIC_CHART: 'GALACTIC_CHART',
  LONG_RANGE_SCAN: 'LONG_RANGE_SCAN',
} as const;

export type ViewMode = (typeof ViewMode)[keyof typeof ViewMode];

export const DifficultyLevel = {
  NOVICE: 'NOVICE',
  PILOT: 'PILOT',
  WARRIOR: 'WARRIOR',
  COMMANDER: 'COMMANDER',
} as const;

export type DifficultyLevel = (typeof DifficultyLevel)[keyof typeof DifficultyLevel];

export class GameState {
  // View state
  public currentView: ViewMode = ViewMode.FRONT;

  // Energy (MANUAL_SPEC §12): whole units; sim/energy.ts drains it
  public energy: number = START_ENERGY;

  // Engine and movement
  public engineSpeed: number = 0; // Current visible speed
  public targetEngineSpeed: number = 0; // Desired speed (set by keys)

  // Shields
  public shieldsActive: boolean = false;

  // Attack computer (C). Drains ½ unit/s when on (§12.1). No toggle key yet (Phase 6).
  public attackComputerOn: boolean = false;

  // Hull integrity
  public hull: number = 100;
  public maxHull: number = 100;

  // Combat stats
  public isUnderAttack: boolean = false;
  public enemiesDestroyed: number = 0;

  // Mission state
  public starDate: string = '00.00'; // NN.NN from core/clock.ts (§8, §17.4)
  public score: number = 0; // running score (§17.10); the total adds M at the end
  public missionOutcome: MissionOutcome | null = null;
  public rating: MissionRating | null = null;
  public isPaused: boolean = false;
  public isGameOver: boolean = false;
  public isVictory: boolean = false;

  // Difficulty
  public difficulty: DifficultyLevel = DifficultyLevel.NOVICE;

  // Damage Control: ok / damaged / destroyed per subsystem (§7, §17.3)
  public damage: DamageStatus = allSystemsOk();

  // Current sector position
  public sectorX: number = 8;
  public sectorY: number = 4;

  /**
   * Reset state for new game
   */
  public reset(difficulty: DifficultyLevel = DifficultyLevel.NOVICE): void {
    this.currentView = ViewMode.FRONT;
    this.energy = START_ENERGY;
    this.engineSpeed = 0;
    this.shieldsActive = false;
    this.hull = 100;
    this.maxHull = 100;
    this.isUnderAttack = false;
    this.enemiesDestroyed = 0;
    this.attackComputerOn = false;
    this.starDate = '00.00';
    this.score = 0;
    this.missionOutcome = null;
    this.rating = null;
    this.isPaused = false;
    this.isGameOver = false;
    this.isVictory = false;
    this.difficulty = difficulty;
    this.sectorX = 8;
    this.sectorY = 4;

    this.damage = allSystemsOk();
  }

  /**
   * Apply damage to hull, returns true if hull destroyed
   */
  public takeDamage(amount: number): boolean {
    this.hull = Math.max(0, this.hull - amount);
    return this.hull <= 0;
  }

  /**
   * Check if hull is critically low
   */
  public isHullLow(): boolean {
    return this.hull < this.maxHull * 0.25;
  }

  /**
   * Repair hull (e.g., from starbase docking)
   */
  public repairHull(amount: number): void {
    this.hull = Math.min(this.maxHull, this.hull + amount);
  }
}
