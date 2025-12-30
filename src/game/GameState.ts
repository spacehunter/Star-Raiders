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

export interface DamageState {
  engines: boolean;
  shields: boolean;
  photonTorpedoes: boolean;
  subSpaceRadio: boolean;
  longRangeScan: boolean;
  attackComputer: boolean;
}

export class GameState {
  // View state
  public currentView: ViewMode = ViewMode.FRONT;

  // Energy system
  public energy: number = 9999;
  public maxEnergy: number = 9999;

  // Engine and movement
  public engineSpeed: number = 0; // 0-9
  public maxSpeed: number = 9;

  // Shields
  public shieldsActive: boolean = false;

  // Combat stats
  public enemiesDestroyed: number = 0;
  public totalEnemies: number = 0;

  // Mission state
  public starDate: number = 2850.0;
  public missionStartTime: number = 0;
  public isPaused: boolean = false;
  public isGameOver: boolean = false;
  public isVictory: boolean = false;

  // Difficulty
  public difficulty: DifficultyLevel = DifficultyLevel.NOVICE;

  // Damage state (all start undamaged)
  public damage: DamageState = {
    engines: false,
    shields: false,
    photonTorpedoes: false,
    subSpaceRadio: false,
    longRangeScan: false,
    attackComputer: false,
  };

  // Current sector position
  public sectorX: number = 4;
  public sectorY: number = 4;

  // Starbases
  public starbasesRemaining: number = 3;

  /**
   * Reset state for new game
   */
  public reset(difficulty: DifficultyLevel = DifficultyLevel.NOVICE): void {
    this.currentView = ViewMode.FRONT;
    this.energy = 9999;
    this.maxEnergy = 9999;
    this.engineSpeed = 0;
    this.shieldsActive = false;
    this.enemiesDestroyed = 0;
    this.starDate = 2850.0;
    this.missionStartTime = Date.now();
    this.isPaused = false;
    this.isGameOver = false;
    this.isVictory = false;
    this.difficulty = difficulty;
    this.sectorX = 4;
    this.sectorY = 4;

    // Reset damage
    this.damage = {
      engines: false,
      shields: false,
      photonTorpedoes: false,
      subSpaceRadio: false,
      longRangeScan: false,
      attackComputer: false,
    };

    // Set difficulty-specific values
    switch (difficulty) {
      case DifficultyLevel.NOVICE:
        this.totalEnemies = 24;
        this.starbasesRemaining = 3;
        break;
      case DifficultyLevel.PILOT:
        this.totalEnemies = 36;
        this.starbasesRemaining = 3;
        break;
      case DifficultyLevel.WARRIOR:
        this.totalEnemies = 45;
        this.starbasesRemaining = 3;
        break;
      case DifficultyLevel.COMMANDER:
        this.totalEnemies = 60;
        this.starbasesRemaining = 4;
        this.energy = 8000; // Less starting energy
        break;
    }
  }

  /**
   * Check if energy is critically low
   */
  public isEnergyLow(): boolean {
    return this.energy < this.maxEnergy * 0.2;
  }

  /**
   * Consume energy, returns false if insufficient
   */
  public consumeEnergy(amount: number): boolean {
    if (this.energy >= amount) {
      this.energy -= amount;
      return true;
    }
    return false;
  }

  /**
   * Add energy (e.g., from starbase docking)
   */
  public addEnergy(amount: number): void {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
  }
}
