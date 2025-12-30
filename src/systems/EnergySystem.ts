import { GameState } from '../game/GameState';

/**
 * EnergySystem - Manages energy consumption and tracking
 *
 * Energy Consumption Rates:
 * - Photon Torpedo: 5 units per shot
 * - Engine Speed 1-9: speed units per second
 * - Shields Active: 3 units per second
 * - Hyperwarp: 100-2410 based on distance
 */
export class EnergySystem {
  private gameState: GameState;

  // Energy costs
  public static readonly TORPEDO_COST = 5;
  public static readonly SHIELD_COST_PER_SECOND = 3;
  public static readonly HYPERWARP_BASE_COST = 100;
  public static readonly HYPERWARP_DISTANCE_MULTIPLIER = 165;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /**
   * Update energy consumption based on active systems
   */
  public update(deltaTime: number): void {
    // Engine energy consumption: speed units per second
    if (this.gameState.engineSpeed > 0) {
      const engineCost = this.gameState.engineSpeed * deltaTime;
      this.gameState.consumeEnergy(engineCost);
    }

    // Shield energy consumption: 3 units per second
    if (this.gameState.shieldsActive) {
      const shieldCost = EnergySystem.SHIELD_COST_PER_SECOND * deltaTime;
      if (!this.gameState.consumeEnergy(shieldCost)) {
        // Not enough energy, disable shields
        this.gameState.shieldsActive = false;
      }
    }

    // Check for game over condition
    if (this.gameState.energy <= 0) {
      this.gameState.energy = 0;
      this.gameState.isGameOver = true;
    }
  }

  /**
   * Attempt to fire a torpedo
   * Returns true if successful
   */
  public fireTorpedo(): boolean {
    if (this.gameState.damage.photonTorpedoes) {
      return false; // Weapons damaged
    }
    return this.gameState.consumeEnergy(EnergySystem.TORPEDO_COST);
  }

  /**
   * Toggle shields
   * Returns new shield state
   */
  public toggleShields(): boolean {
    if (this.gameState.damage.shields) {
      return false; // Shields damaged
    }

    // Check if we have enough energy to turn shields on
    if (!this.gameState.shieldsActive && this.gameState.energy < 10) {
      return false; // Not enough energy
    }

    this.gameState.shieldsActive = !this.gameState.shieldsActive;
    return this.gameState.shieldsActive;
  }

  /**
   * Calculate hyperwarp energy cost
   */
  public calculateHyperwarpCost(fromX: number, fromY: number, toX: number, toY: number): number {
    const distance = Math.abs(toX - fromX) + Math.abs(toY - fromY); // Manhattan distance
    return EnergySystem.HYPERWARP_BASE_COST + distance * EnergySystem.HYPERWARP_DISTANCE_MULTIPLIER;
  }

  /**
   * Attempt hyperwarp
   * Returns true if successful
   */
  public executeHyperwarp(toX: number, toY: number): boolean {
    const cost = this.calculateHyperwarpCost(
      this.gameState.sectorX,
      this.gameState.sectorY,
      toX,
      toY
    );

    if (this.gameState.consumeEnergy(cost)) {
      this.gameState.sectorX = toX;
      this.gameState.sectorY = toY;
      return true;
    }

    return false;
  }

  /**
   * Get energy as percentage
   */
  public getEnergyPercent(): number {
    return (this.gameState.energy / this.gameState.maxEnergy) * 100;
  }
}
