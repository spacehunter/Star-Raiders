import { GameState, DifficultyLevel } from '../game/GameState';

/**
 * Rating ranks based on score
 */
export const Rank = {
  GARBAGE_SCOW_CAPTAIN: 'GARBAGE SCOW CAPTAIN',
  NOVICE: 'NOVICE',
  PILOT: 'PILOT',
  WARRIOR: 'WARRIOR',
  STAR_COMMANDER: 'STAR COMMANDER',
  ACE: 'ACE',
  LIEUTENANT: 'LIEUTENANT',
  CAPTAIN: 'CAPTAIN',
  COMMANDER: 'COMMANDER',
} as const;

export type Rank = (typeof Rank)[keyof typeof Rank];

/**
 * ScoringSystem - Calculates score and rating
 */
export class ScoringSystem {
  private gameState: GameState;

  // Score factors
  private baseScore: number = 100;
  private enemyPoints: number = 10;
  private timeBonus: number = 0;
  private energyBonus: number = 0;
  private starbasePenalty: number = 50;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /**
   * Calculate final score
   */
  public calculateScore(): number {
    let score = this.baseScore;

    // Points per enemy destroyed
    score += this.gameState.enemiesDestroyed * this.enemyPoints;

    // Time bonus (faster = better)
    const elapsedTime = (Date.now() - this.gameState.missionStartTime) / 1000 / 60; // minutes
    if (elapsedTime < 10) {
      this.timeBonus = 50;
    } else if (elapsedTime < 20) {
      this.timeBonus = 25;
    } else {
      this.timeBonus = 0;
    }
    score += this.timeBonus;

    // Energy bonus (efficiency)
    const energyPercent = (this.gameState.energy / this.gameState.maxEnergy) * 100;
    if (energyPercent > 50) {
      this.energyBonus = 30;
    } else if (energyPercent > 25) {
      this.energyBonus = 15;
    } else {
      this.energyBonus = 0;
    }
    score += this.energyBonus;

    // Penalty for lost starbases
    const starbasesLost = this.getInitialStarbases() - this.gameState.starbasesRemaining;
    score -= starbasesLost * this.starbasePenalty;

    // Difficulty multiplier
    switch (this.gameState.difficulty) {
      case DifficultyLevel.NOVICE:
        score = Math.floor(score * 0.5);
        break;
      case DifficultyLevel.PILOT:
        score = Math.floor(score * 0.75);
        break;
      case DifficultyLevel.WARRIOR:
        score = Math.floor(score * 1.0);
        break;
      case DifficultyLevel.COMMANDER:
        score = Math.floor(score * 1.5);
        break;
    }

    // Victory bonus
    if (this.gameState.isVictory) {
      score += 100;
    }

    return Math.max(0, score);
  }

  /**
   * Get rating rank based on score
   */
  public getRank(score: number): Rank {
    if (score < 80) return Rank.GARBAGE_SCOW_CAPTAIN;
    if (score < 92) return Rank.NOVICE;
    if (score < 112) return Rank.PILOT;
    if (score < 176) return Rank.WARRIOR;
    if (score < 192) return Rank.STAR_COMMANDER;
    if (score < 208) return Rank.ACE;
    if (score < 240) return Rank.LIEUTENANT;
    if (score < 280) return Rank.CAPTAIN;
    return Rank.COMMANDER;
  }

  /**
   * Get initial starbase count for difficulty
   */
  private getInitialStarbases(): number {
    switch (this.gameState.difficulty) {
      case DifficultyLevel.COMMANDER:
        return 4;
      default:
        return 3;
    }
  }

  /**
   * Get score breakdown
   */
  public getScoreBreakdown(): {
    baseScore: number;
    enemyScore: number;
    timeBonus: number;
    energyBonus: number;
    starbasePenalty: number;
    difficultyMultiplier: number;
    victoryBonus: number;
    totalScore: number;
    rank: Rank;
  } {
    const score = this.calculateScore();

    let multiplier: number;
    switch (this.gameState.difficulty) {
      case DifficultyLevel.NOVICE:
        multiplier = 0.5;
        break;
      case DifficultyLevel.PILOT:
        multiplier = 0.75;
        break;
      case DifficultyLevel.WARRIOR:
        multiplier = 1.0;
        break;
      case DifficultyLevel.COMMANDER:
        multiplier = 1.5;
        break;
      default:
        multiplier = 1.0;
    }

    return {
      baseScore: this.baseScore,
      enemyScore: this.gameState.enemiesDestroyed * this.enemyPoints,
      timeBonus: this.timeBonus,
      energyBonus: this.energyBonus,
      starbasePenalty:
        (this.getInitialStarbases() - this.gameState.starbasesRemaining) * this.starbasePenalty,
      difficultyMultiplier: multiplier,
      victoryBonus: this.gameState.isVictory ? 100 : 0,
      totalScore: score,
      rank: this.getRank(score),
    };
  }
}
