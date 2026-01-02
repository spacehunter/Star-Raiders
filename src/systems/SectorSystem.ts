import { DifficultyLevel } from '../game/GameState';

/**
 * SectorSystem - Manages the 8x8 galactic grid and sector contents
 */

export interface SectorData {
  x: number;
  y: number;
  enemies: number; // Count of enemies in sector
  hasStarbase: boolean;
  starbaseDestroyed: boolean;
  visited: boolean;
}

export class SectorSystem {
  public static readonly GRID_SIZE = 8;
  private sectors: SectorData[][] = [];
  private totalEnemies: number = 0;
  private totalStarbases: number = 0;

  constructor() {
    this.initializeGrid();
  }

  /**
   * Initialize empty grid
   */
  private initializeGrid(): void {
    this.sectors = [];
    for (let y = 0; y < SectorSystem.GRID_SIZE; y++) {
      this.sectors[y] = [];
      for (let x = 0; x < SectorSystem.GRID_SIZE; x++) {
        this.sectors[y][x] = {
          x,
          y,
          enemies: 0,
          hasStarbase: false,
          starbaseDestroyed: false,
          visited: false,
        };
      }
    }
  }

  /**
   * Generate galaxy based on difficulty level
   */
  public generateGalaxy(difficulty: DifficultyLevel): void {
    this.initializeGrid();

    // Determine counts based on difficulty
    let enemyCount: number;
    let starbaseCount: number;

    switch (difficulty) {
      case DifficultyLevel.NOVICE:
        enemyCount = 24;
        starbaseCount = 3;
        break;
      case DifficultyLevel.PILOT:
        enemyCount = 36;
        starbaseCount = 3;
        break;
      case DifficultyLevel.WARRIOR:
        enemyCount = 45;
        starbaseCount = 3;
        break;
      case DifficultyLevel.COMMANDER:
        enemyCount = 60;
        starbaseCount = 4;
        break;
      default:
        enemyCount = 24;
        starbaseCount = 3;
    }

    this.totalEnemies = enemyCount;
    this.totalStarbases = starbaseCount;

    // Place starbases first (spread them out)
    this.placeStarbases(starbaseCount);

    // Place enemies (avoid player starting position)
    this.placeEnemies(enemyCount);

    // Mark starting sector as visited
    this.sectors[4][4].visited = true;
  }

  /**
   * Place starbases spread across the galaxy
   */
  private placeStarbases(count: number): void {
    const positions: [number, number][] = [];

    // Divide galaxy into regions for even distribution
    // Use coordinates 1-6 to prevent starbases from spawning on edges
    const regions = [
      { minX: 1, maxX: 3, minY: 1, maxY: 3 },
      { minX: 4, maxX: 6, minY: 1, maxY: 3 },
      { minX: 1, maxX: 3, minY: 4, maxY: 6 },
      { minX: 4, maxX: 6, minY: 4, maxY: 6 },
    ];

    for (let i = 0; i < count && i < regions.length; i++) {
      const region = regions[i];
      let x: number, y: number;
      let attempts = 0;

      do {
        x = region.minX + Math.floor(Math.random() * (region.maxX - region.minX + 1));
        y = region.minY + Math.floor(Math.random() * (region.maxY - region.minY + 1));
        attempts++;
      } while ((x === 4 && y === 4) && attempts < 20); // Avoid player start

      if (!positions.some(([px, py]) => px === x && py === y)) {
        positions.push([x, y]);
        this.sectors[y][x].hasStarbase = true;
      }
    }
  }

  /**
   * Place enemies across the galaxy
   */
  private placeEnemies(count: number): void {
    let placed = 0;
    const maxPerSector = 4;
    const attempts = count * 10;
    let attempt = 0;

    while (placed < count && attempt < attempts) {
      const x = Math.floor(Math.random() * SectorSystem.GRID_SIZE);
      const y = Math.floor(Math.random() * SectorSystem.GRID_SIZE);

      // Skip player starting position initially
      if (x === 4 && y === 4) {
        attempt++;
        continue;
      }

      // Check if sector can hold more enemies
      if (this.sectors[y][x].enemies < maxPerSector) {
        this.sectors[y][x].enemies++;
        placed++;
      }

      attempt++;
    }
  }

  /**
   * Get sector data
   */
  public getSector(x: number, y: number): SectorData | null {
    if (x < 0 || x >= SectorSystem.GRID_SIZE || y < 0 || y >= SectorSystem.GRID_SIZE) {
      return null;
    }
    return this.sectors[y][x];
  }

  /**
   * Get all sectors
   */
  public getAllSectors(): SectorData[][] {
    return this.sectors;
  }

  /**
   * Mark sector as visited
   */
  public visitSector(x: number, y: number): void {
    const sector = this.getSector(x, y);
    if (sector) {
      sector.visited = true;
    }
  }

  /**
   * Remove an enemy from a sector
   */
  public removeEnemy(x: number, y: number): boolean {
    const sector = this.getSector(x, y);
    if (sector && sector.enemies > 0) {
      sector.enemies--;
      this.totalEnemies--;
      return true;
    }
    return false;
  }

  /**
   * Destroy a starbase
   */
  public destroyStarbase(x: number, y: number): boolean {
    const sector = this.getSector(x, y);
    if (sector && sector.hasStarbase && !sector.starbaseDestroyed) {
      sector.starbaseDestroyed = true;
      this.totalStarbases--;
      return true;
    }
    return false;
  }

  /**
   * Check if a starbase is under attack (enemies in same sector)
   */
  public isStarbaseUnderAttack(x: number, y: number): boolean {
    const sector = this.getSector(x, y);
    return sector !== null && sector.hasStarbase && !sector.starbaseDestroyed && sector.enemies > 0;
  }

  /**
   * Get list of starbases under attack
   */
  public getStarbasesUnderAttack(): SectorData[] {
    const underAttack: SectorData[] = [];
    for (let y = 0; y < SectorSystem.GRID_SIZE; y++) {
      for (let x = 0; x < SectorSystem.GRID_SIZE; x++) {
        if (this.isStarbaseUnderAttack(x, y)) {
          underAttack.push(this.sectors[y][x]);
        }
      }
    }
    return underAttack;
  }

  /**
   * Get remaining enemy count
   */
  public getRemainingEnemies(): number {
    return this.totalEnemies;
  }

  /**
   * Get remaining starbase count
   */
  public getRemainingStarbases(): number {
    return this.totalStarbases;
  }

  /**
   * Get sector symbol for chart display
   */
  public getSectorSymbol(x: number, y: number): string {
    const sector = this.getSector(x, y);
    if (!sector) return ' ';

    // Starbase indicators take priority
    if (sector.hasStarbase && !sector.starbaseDestroyed) {
      if (sector.enemies > 0) {
        return '\u2265*'; // Starbase under attack
      }
      return '*'; // Friendly starbase
    }

    // Enemy indicators
    switch (sector.enemies) {
      case 0:
        return ' ';
      case 1:
        return '<';
      case 2:
        return '=';
      case 3:
        return '>';
      default:
        return '\u2265'; // Fleet (4+)
    }
  }
}
