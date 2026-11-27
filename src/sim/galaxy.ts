/**
 * The galaxy: 16 × 8 sectors of Zylon groups and starbases, fleet movement and the
 * starbase surround. Replaces the old SectorSystem and StarbaseAttackSystem.
 *
 * MANUAL_SPEC §8 (Galactic Chart), §8.1 (fleet movement), §8.2 (starbase surround),
 * §7 (Sub-Space Radio), §15 (counts per level) and §17.4 (ROM INITIALIZE / FLUSHGAMELOOP).
 *
 * One map, like the ROM's GCMEMMAP: one byte per sector holding the number of Zylon ships
 * there (0..4) and a starbase flag. Everything that asks "how many Zylons" (the chart,
 * TARGETS, the ships spawned on arrival, the kill counter and the victory check) reads this
 * map, so the counts can never drift apart from the ships in play.
 */
import { random, type RandomFn } from '../core/rng';
import { GROUP_SIZES, groupsPerSize, starbaseCount, type MissionLevel } from '../rules/levels';
import type { SubsystemStatus } from '../rules/damage';

export const GALAXY_COLUMNS = 16;
export const GALAXY_ROWS = 8;
/** §17.4: you start at column 8, row 4. */
export const START_SECTOR: Readonly<SectorPos> = { x: 8, y: 4 };

/** §17.4: a group moves on a move tick with this chance out of 256, by its ship count. */
export const MOVE_CHANCE_256: Readonly<Record<number, number>> = { 1: 255, 2: 255, 3: 192, 4: 32 };
/** §17.4: the hunted starbase is re-chosen every 8 move ticks. */
export const HUNT_RECHOOSE_MOVES = 8;
/** §17.4 / §8.2: a surrounded starbase falls 100 star-date ticks (1.00) after the surround. */
export const SURROUND_DESTROY_TICKS = 100;
/** §8.2: two Zylon ships are made from the debris of a destroyed starbase. */
export const DEBRIS_ZYLONS = 2;

export interface SectorPos {
  x: number;
  y: number;
}

export interface SectorInfo extends SectorPos {
  /** Zylon ships in the sector (0..4). */
  zylons: number;
  starbase: boolean;
}

export type GalaxyEvent =
  | { type: 'starbaseSurrounded'; x: number; y: number }
  | { type: 'starbaseDestroyed'; x: number; y: number }
  | { type: 'zylonDestroyed'; x: number; y: number; remaining: number }
  | { type: 'allZylonsDestroyed' };

/** N, E, S, W. */
const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const index = (x: number, y: number) => y * GALAXY_COLUMNS + x;
const inBounds = (x: number, y: number) => x >= 0 && x < GALAXY_COLUMNS && y >= 0 && y < GALAXY_ROWS;

export class Galaxy {
  public readonly level: MissionLevel;
  /** Zylon ships per sector, row-major. */
  private readonly zylons = new Array<number>(GALAXY_COLUMNS * GALAXY_ROWS).fill(0);
  private readonly starbases = new Array<boolean>(GALAXY_COLUMNS * GALAXY_ROWS).fill(false);
  private readonly rng: RandomFn;

  /** Starbase the whole Zylon fleet is closing on (§8.1: one at a time). */
  public hunted: SectorPos | null = null;
  /** Surround in progress: the starbase and the star-date tick it was announced. */
  public surround: (SectorPos & { sinceTick: number }) | null = null;
  /** Move ticks run so far. */
  public moveTicks = 0;
  /** Starbases the Zylons have destroyed. */
  public starbasesLost = 0;
  /** Bumped on every change, so views can redraw only when something changed. */
  public version = 0;

  constructor(level: MissionLevel, rng: RandomFn = random, start: SectorPos = START_SECTOR) {
    this.level = level;
    this.rng = rng;
    this.populate(start);
  }

  // ---------------------------------------------------------------- set-up (§17.4)

  /**
   * ROM INITIALIZE: level+3 groups each of 2, 3 and 4 ships in empty sectors, then level+3
   * starbases, never on the border and never next to Zylons. The start sector stays empty.
   * A starbase also never starts next to another starbase: the neighbour test is "sector
   * empty", which a starbase fails too (otherwise that starbase could never be surrounded).
   */
  private populate(start: SectorPos): void {
    const n = groupsPerSize(this.level);
    const isStart = (x: number, y: number) => x === start.x && y === start.y;

    for (const size of GROUP_SIZES) {
      for (let i = 0; i < n; i++) {
        const free = this.cells((x, y) => !isStart(x, y) && this.isEmpty(x, y));
        const c = this.pick(free);
        this.zylons[index(c.x, c.y)] = size;
      }
    }

    for (let i = 0; i < starbaseCount(this.level); i++) {
      const ok = this.cells(
        (x, y) =>
          x > 0 &&
          x < GALAXY_COLUMNS - 1 &&
          y > 0 &&
          y < GALAXY_ROWS - 1 &&
          !isStart(x, y) &&
          this.isEmpty(x, y) &&
          NEIGHBOURS.every(([dx, dy]) => this.isEmpty(x + dx, y + dy))
      );
      if (ok.length === 0) break; // cannot happen with the ROM counts; guard anyway
      const c = this.pick(ok);
      this.starbases[index(c.x, c.y)] = true;
    }
    this.version++;
  }

  // ---------------------------------------------------------------- queries

  public zylonsAt(x: number, y: number): number {
    return inBounds(x, y) ? this.zylons[index(x, y)] : 0;
  }

  public hasStarbase(x: number, y: number): boolean {
    return inBounds(x, y) && this.starbases[index(x, y)];
  }

  public sector(x: number, y: number): SectorInfo | null {
    if (!inBounds(x, y)) return null;
    return { x, y, zylons: this.zylonsAt(x, y), starbase: this.hasStarbase(x, y) };
  }

  /** All 128 sectors, row-major (a copy). */
  public sectors(): SectorInfo[] {
    return this.cells(() => true).map(({ x, y }) => this.sector(x, y)!);
  }

  /** Zylon ships left in the whole galaxy. */
  public get zylonsLeft(): number {
    return this.zylons.reduce((a, b) => a + b, 0);
  }

  public get starbasesLeft(): number {
    return this.starbases.filter(Boolean).length;
  }

  /** §8.2: all four N/E/S/W neighbours hold Zylons. */
  public isSurrounded(x: number, y: number): boolean {
    return NEIGHBOURS.every(([dx, dy]) => this.zylonsAt(x + dx, y + dy) > 0);
  }

  // ---------------------------------------------------------------- the player's fight

  /**
   * One Zylon ship in (x, y) destroyed by the player. The only way ships leave the map
   * besides fleet moves, which never touch the player's sector.
   */
  public destroyZylon(x: number, y: number): GalaxyEvent[] {
    if (this.zylonsAt(x, y) <= 0) return [];
    this.zylons[index(x, y)]--;
    this.version++;
    const remaining = this.zylonsLeft;
    const events: GalaxyEvent[] = [{ type: 'zylonDestroyed', x, y, remaining }];
    if (remaining === 0) events.push({ type: 'allZylonsDestroyed' });
    return events;
  }

  /** A starbase destroyed by the player's own torpedo (§14: -3; scoring is the caller's). */
  public removeStarbase(x: number, y: number): boolean {
    if (!this.hasStarbase(x, y)) return false;
    this.starbases[index(x, y)] = false;
    if (this.hunted && this.hunted.x === x && this.hunted.y === y) this.hunted = null;
    if (this.surround && this.surround.x === x && this.surround.y === y) this.surround = null;
    this.version++;
    return true;
  }

  // ---------------------------------------------------------------- fleet move tick (§17.4)

  /**
   * One Zylon move tick (every 0.50 star date, first at 1.00; core/clock.ts reports it).
   * `player` is your sector; `starDateTicks` the star date × 100.
   *
   * 1. A pending surround that has lasted 1.00 star date destroys the starbase if it is
   *    still surrounded: it becomes a 2-Zylon sector (`STARBASE DESTROYED`).
   * 2. The hunted starbase is chosen (at start, when it is gone, and every 8 moves unless it
   *    is surrounded).
   * 3. Each group moves one sector toward it with chance 255/192/32 of 256 for 1–2/3/4
   *    ships, never into your sector or an occupied one. The group in your sector holds.
   * 4. A newly surrounded hunted starbase is announced (`STARBASE SURROUNDED`).
   */
  public moveTick(player: SectorPos, starDateTicks: number): GalaxyEvent[] {
    const events: GalaxyEvent[] = [];
    let changed = false;

    // 1. Destruction 1.00 star date after the surround
    const s = this.surround;
    if (s && starDateTicks - s.sinceTick >= SURROUND_DESTROY_TICKS) {
      this.surround = null;
      if (this.hasStarbase(s.x, s.y) && this.isSurrounded(s.x, s.y)) {
        this.starbases[index(s.x, s.y)] = false;
        this.zylons[index(s.x, s.y)] = DEBRIS_ZYLONS;
        this.starbasesLost++;
        if (this.hunted && this.hunted.x === s.x && this.hunted.y === s.y) this.hunted = null;
        events.push({ type: 'starbaseDestroyed', x: s.x, y: s.y });
        changed = true;
      }
    }

    // 2. Choose the hunted starbase
    const huntedGone = !this.hunted || !this.hasStarbase(this.hunted.x, this.hunted.y);
    const rechoose =
      this.moveTicks % HUNT_RECHOOSE_MOVES === 0 && !(this.hunted && this.isSurrounded(this.hunted.x, this.hunted.y));
    if (huntedGone || rechoose) {
      const bases = this.cells((x, y) => this.hasStarbase(x, y));
      this.hunted = bases.length ? this.pick(bases) : null;
    }
    this.moveTicks++;

    // 3. Move the groups (each at most once per tick)
    const target = this.hunted;
    if (target) {
      const groups = this.cells((x, y) => this.zylonsAt(x, y) > 0);
      for (const g of groups) {
        if (g.x === player.x && g.y === player.y) continue;
        const ships = this.zylonsAt(g.x, g.y);
        if (this.byte() >= MOVE_CHANCE_256[ships]) continue;
        const dx = Math.sign(target.x - g.x);
        const dy = Math.sign(target.y - g.y);
        const steps: Array<[number, number]> = [];
        if (dx !== 0) steps.push([dx, 0]);
        if (dy !== 0) steps.push([0, dy]);
        if (steps.length === 2 && this.rng() < 0.5) steps.reverse();
        for (const [sx, sy] of steps) {
          const nx = g.x + sx;
          const ny = g.y + sy;
          if (!inBounds(nx, ny) || (nx === player.x && ny === player.y) || !this.isEmpty(nx, ny)) continue;
          this.zylons[index(nx, ny)] = ships;
          this.zylons[index(g.x, g.y)] = 0;
          changed = true;
          break;
        }
      }
    }

    // 4. Surround check on the hunted starbase
    if (this.surround && !this.isSurrounded(this.surround.x, this.surround.y)) {
      this.surround = null; // a neighbour was cleared in time
    }
    if (target && !this.surround && this.hasStarbase(target.x, target.y) && this.isSurrounded(target.x, target.y)) {
      this.surround = { x: target.x, y: target.y, sinceTick: starDateTicks };
      events.push({ type: 'starbaseSurrounded', x: target.x, y: target.y });
    }

    if (changed) this.version++;
    return events;
  }

  // ---------------------------------------------------------------- debug

  /**
   * Debug/evidence only: move existing groups (farthest first) into the empty neighbours of
   * the hunted starbase (or the first one), so a surround happens at the next move tick.
   * Ship totals are unchanged. Returns the starbase or null.
   */
  public debugSurround(player: SectorPos): SectorPos | null {
    // A starbase whose four neighbours can all hold Zylons (no starbase, not your sector).
    const fillable = (b: SectorPos) =>
      NEIGHBOURS.every(([dx, dy]) => {
        const nx = b.x + dx;
        const ny = b.y + dy;
        return inBounds(nx, ny) && !this.hasStarbase(nx, ny) && !(nx === player.x && ny === player.y);
      });
    const candidates = this.cells((x, y) => this.hasStarbase(x, y) && fillable({ x, y }));
    const base =
      this.hunted && candidates.some((c) => c.x === this.hunted!.x && c.y === this.hunted!.y)
        ? this.hunted
        : candidates[0];
    if (!base) return null;
    this.hunted = { x: base.x, y: base.y };
    const dist = (c: SectorPos) => Math.abs(c.x - base.x) + Math.abs(c.y - base.y);
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = base.x + dx;
      const ny = base.y + dy;
      if (this.zylonsAt(nx, ny) > 0) continue;
      const from = this.cells(
        (x, y) =>
          this.zylonsAt(x, y) > 0 &&
          !(x === player.x && y === player.y) &&
          !NEIGHBOURS.some(([ex, ey]) => base.x + ex === x && base.y + ey === y)
      ).sort((a, b) => dist(b) - dist(a))[0];
      if (!from) return null;
      this.zylons[index(nx, ny)] = this.zylonsAt(from.x, from.y);
      this.zylons[index(from.x, from.y)] = 0;
    }
    this.version++;
    return { x: base.x, y: base.y };
  }

  // ---------------------------------------------------------------- helpers

  private isEmpty(x: number, y: number): boolean {
    return this.zylons[index(x, y)] === 0 && !this.starbases[index(x, y)];
  }

  private cells(pred: (x: number, y: number) => boolean): SectorPos[] {
    const out: SectorPos[] = [];
    for (let y = 0; y < GALAXY_ROWS; y++) {
      for (let x = 0; x < GALAXY_COLUMNS; x++) if (pred(x, y)) out.push({ x, y });
    }
    return out;
  }

  private pick<T>(items: T[]): T {
    return items[Math.floor(this.rng() * items.length)];
  }

  /** A POKEY-style random byte 0..255. */
  private byte(): number {
    return Math.floor(this.rng() * 256);
  }
}

/**
 * What the Galactic Chart is allowed to show, given the Sub-Space Radio (§7, §17.3).
 *
 * - OK: the live map.
 * - Damaged: the chart freezes at the moment of damage; moving the cursor still reads the
 *   live TARGETS count of each sector.
 * - Destroyed: frozen chart and frozen TARGETS; no STARBASE SURROUNDED/DESTROYED messages.
 *
 * Call `sync()` every loop (or whenever damage changes) so the freeze happens at the moment
 * of damage, not when the chart is next opened.
 */
export class RadioFeed {
  private frozen: SectorInfo[] | null = null;
  private status: SubsystemStatus = 'ok';
  /** Bumped when what the chart may show changes. */
  public version = 0;
  private lastGalaxyVersion = -1;

  private readonly galaxy: Galaxy;

  constructor(galaxy: Galaxy) {
    this.galaxy = galaxy;
  }

  public sync(radio: SubsystemStatus): void {
    if (radio !== this.status) {
      this.status = radio;
      this.frozen = radio === 'ok' ? null : (this.frozen ?? this.galaxy.sectors());
      this.version++;
    }
    if (radio !== 'destroyed' && this.galaxy.version !== this.lastGalaxyVersion) {
      // Live TARGETS (and, when OK, the live map) changed.
      this.lastGalaxyVersion = this.galaxy.version;
      this.version++;
    }
  }

  public get radio(): SubsystemStatus {
    return this.status;
  }

  /** Sector map to draw. */
  public sectors(): readonly SectorInfo[] {
    return this.frozen ?? this.galaxy.sectors();
  }

  /** TARGETS for the cursor sector. */
  public targets(x: number, y: number): number {
    if (this.status === 'destroyed' && this.frozen) return this.frozen[index(x, y)].zylons;
    return this.galaxy.zylonsAt(x, y);
  }

  /** Whether STARBASE SURROUNDED / DESTROYED reach the title line. */
  public get relaysMessages(): boolean {
    return this.status !== 'destroyed';
  }
}
