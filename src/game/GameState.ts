import { START_ENERGY } from '../rules/energy';
import { START_SPEED_KEY } from '../rules/speed';
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
  public engineSpeed: number = START_SPEED_KEY; // Speed key the ship has reached
  public targetEngineSpeed: number = START_SPEED_KEY; // Speed key chosen (0–9); §17.1: a game starts at 6

  // Shields
  public shieldsActive: boolean = false;

  // Attack computer (C). Drains ½ unit/s when on (§12.1).
  public attackComputerOn: boolean = false;

  // Tracking computer (T): the panel shows C: instead of T: while it is on (§5.10, §17.2).
  public trackingComputerOn: boolean = false;

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
    this.engineSpeed = START_SPEED_KEY;
    this.targetEngineSpeed = START_SPEED_KEY;
    this.shieldsActive = false;
    this.trackingComputerOn = false;
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
}
