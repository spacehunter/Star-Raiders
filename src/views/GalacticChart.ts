/**
 * Galactic Chart view (MANUAL_SPEC §8, §7, §5.9, §17.3, §17.4, §17.13, §18.1).
 *
 * The whole screen becomes the chart: the title on a black band, a blue field with a white
 * 16 × 8 grid and the ROM's chart symbols, two dots (your position and the hyperwarp
 * destination), and three footer lines:
 *
 *   WARP ENERGY:nnn0
 *   TARGETS:n  DC:PESCLR
 *   STAR DATE:00.00
 *
 * Drawn on one canvas, and only when something it shows has changed (not every frame).
 */
import { drawText, GLYPH_COLUMNS, GLYPH_ROWS } from '../render/font';
import { CHART_COLORS } from '../render/palette';
import { SUBSYSTEMS, SUBSYSTEM_LETTER, type DamageStatus } from '../rules/damage';
import { GALAXY_COLUMNS, GALAXY_ROWS, type SectorInfo, type SectorPos } from '../sim/galaxy';

/**
 * §17.4 chart symbol sprites, 8 × 8: the left column and bottom row are the grid lines,
 * so only rows 0–6 and columns 1–7 are the symbol.
 */
export const CHART_SYMBOLS = {
  patrol: [
    '#.......',
    '#.##....',
    '#..##...',
    '#.#####.',
    '#..##...',
    '#.##....',
    '#.......',
    '########',
  ],
  taskForce: [
    '#.......',
    '#...###.',
    '#.......',
    '#.###...',
    '#.......',
    '#..###..',
    '#.......',
    '########',
  ],
  fleet: [
    '#.......',
    '#..##...',
    '#.......',
    '#.##.##.',
    '#.......',
    '#...##..',
    '#.......',
    '########',
  ],
  starbase: [
    '#.......',
    '#.#.#.#.',
    '#..###..',
    '#.#####.',
    '#..###..',
    '#.#.#.#.',
    '#.......',
    '########',
  ],
} as const;

export type ChartSymbol = keyof typeof CHART_SYMBOLS;

/** §8 / §17.4: which symbol a sector shows. 1–2 ships share the patrol symbol. */
export function chartSymbol(s: Pick<SectorInfo, 'zylons' | 'starbase'>): ChartSymbol | null {
  if (s.starbase) return 'starbase';
  if (s.zylons >= 4) return 'fleet';
  if (s.zylons === 3) return 'taskForce';
  if (s.zylons > 0) return 'patrol';
  return null;
}

export interface ChartData {
  /** Text on the title band: GALACTIC CHART, or a title-line message. */
  title: string;
  /** Bumped by RadioFeed whenever the sector map it shows changes. */
  sectorsVersion: number;
  sectors: () => readonly SectorInfo[];
  player: SectorPos;
  cursor: SectorPos;
  /** WARP ENERGY in energy units (CALCWARP × 10). */
  warpEnergy: number;
  /** TARGETS: Zylons in the cursor sector. */
  targets: number;
  starDate: string;
  damage: DamageStatus;
}

/** Footer line texts, exactly as drawn (§8). */
export function footerLines(d: Pick<ChartData, 'warpEnergy' | 'targets' | 'starDate'>): [string, string, string] {
  const warp = String(Math.max(0, Math.min(9999, Math.round(d.warpEnergy)))).padStart(4, '0');
  return [`WARP ENERGY:${warp}`, `TARGETS:${d.targets}  DC:PESCLR`, `STAR DATE:${d.starDate}`];
}

// Layout in logical pixels: one ROM pixel = 4 logical pixels; the screen is 640 × 440.
const W = 640;
const H = 440;
const U = 4; // ROM pixel
const CELL = 8 * U;
const BAND_H = 11 * U;
const TITLE_PX = U;
const GRID_X = (W - (GALAXY_COLUMNS * CELL + U)) / 2;
const GRID_Y = BAND_H + 4 * U;
const FOOTER_PX = 3;
const FOOTER_Y = GRID_Y + GALAXY_ROWS * CELL + 5 * U;
const FOOTER_PITCH = 8 * U;

export class GalacticChart {
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private isVisible = false;
  private lastKey = '';
  private last: ChartData | null = null;
  /** Number of times the chart was actually drawn (debug/evidence). */
  public renders = 0;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'galactic-chart';
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      // Above the panel's message overlay (1000): on the chart, messages use the title band.
      zIndex: '1100',
      display: 'none',
      background: CHART_COLORS.field,
    } satisfies Partial<CSSStyleDeclaration>);
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, { width: '100%', height: '100%', display: 'block' });
    this.root.appendChild(this.canvas);
    container.appendChild(this.root);
    this.ctx = this.canvas.getContext('2d')!;
    window.addEventListener('resize', this.onResize);
  }

  public show(): void {
    this.isVisible = true;
    this.root.style.display = 'block';
    this.lastKey = ''; // force a draw at the new size
  }

  public hide(): void {
    this.isVisible = false;
    this.root.style.display = 'none';
  }

  public get visible(): boolean {
    return this.isVisible;
  }

  /** Draw if visible and anything shown has changed. Returns true when it drew. */
  public render(d: ChartData): boolean {
    this.last = d;
    if (!this.isVisible) return false;
    const key = [
      d.title,
      d.sectorsVersion,
      d.player.x,
      d.player.y,
      d.cursor.x,
      d.cursor.y,
      d.warpEnergy,
      d.targets,
      d.starDate,
      SUBSYSTEMS.map((s) => d.damage[s]).join(),
      this.canvas.clientWidth,
      this.canvas.clientHeight,
    ].join('|');
    if (key === this.lastKey) return false;
    this.lastKey = key;
    this.draw(d);
    this.renders++;
    return true;
  }

  private onResize = (): void => {
    this.lastKey = '';
    if (this.last) this.render(this.last);
  };

  private draw(d: ChartData): void {
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const ch = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    const f = Math.min(cw / W, ch / H);
    const ox = (cw - W * f) / 2;
    const oy = (ch - H * f) / 2;
    const ctx = this.ctx;
    const plot = (x: number, y: number, w: number, h: number) => {
      const x0 = Math.round(ox + x * f);
      const y0 = Math.round(oy + y * f);
      ctx.fillRect(x0, y0, Math.round(ox + (x + w) * f) - x0, Math.round(oy + (y + h) * f) - y0);
    };

    // Field: blue, or yellow when the shields are damaged or destroyed (§5.9)
    const shieldsHurt = d.damage.shields !== 'ok';
    const field = shieldsHurt ? CHART_COLORS.fieldShieldsDamaged : CHART_COLORS.field;
    this.root.style.background = field;
    ctx.fillStyle = field;
    ctx.fillRect(0, 0, cw, ch);

    // Title band, black, reaching the top of the screen
    ctx.fillStyle = CHART_COLORS.titleBand;
    ctx.fillRect(0, 0, cw, Math.round(oy + BAND_H * f));
    ctx.fillStyle = CHART_COLORS.title;
    const title = d.title.slice(0, 20);
    const tw = title.length * GLYPH_COLUMNS * TITLE_PX;
    drawText(plot, title, (W - tw) / 2, (BAND_H - GLYPH_ROWS * TITLE_PX) / 2, TITLE_PX);

    // Grid: left column and bottom row of every cell, plus the top and right borders
    ctx.fillStyle = CHART_COLORS.grid;
    const gw = GALAXY_COLUMNS * CELL;
    const gh = GALAXY_ROWS * CELL;
    plot(GRID_X, GRID_Y - U, gw + U, U);
    for (let r = 0; r < GALAXY_ROWS; r++) plot(GRID_X, GRID_Y + r * CELL + 7 * U, gw + U, U);
    for (let c = 0; c <= GALAXY_COLUMNS; c++) plot(GRID_X + c * CELL, GRID_Y - U, U, gh + U);

    // Symbols
    ctx.fillStyle = CHART_COLORS.symbol;
    for (const s of d.sectors()) {
      const sym = chartSymbol(s);
      if (!sym) continue;
      const rows = CHART_SYMBOLS[sym];
      const cx = GRID_X + s.x * CELL;
      const cy = GRID_Y + s.y * CELL;
      for (let r = 0; r < 7; r++) {
        for (let c = 1; c < 8; c++) if (rows[r][c] === '#') plot(cx + c * U, cy + r * U, U, U);
      }
    }

    // Two dots: present position and hyperwarp destination (§8)
    ctx.fillStyle = CHART_COLORS.dot;
    for (const p of [d.player, d.cursor]) {
      plot(GRID_X + p.x * CELL + 4 * U, GRID_Y + p.y * CELL + 3 * U, 2 * U, 2 * U);
    }

    // Footer (§8, colours §17.3 / §17.13)
    const [l1, l2, l3] = footerLines(d);
    const cwid = GLYPH_COLUMNS * FOOTER_PX;
    const line = (text: string, row: number, color: string, at = 0, centreOn = text) => {
      const x = (W - centreOn.length * cwid) / 2 + at * cwid;
      ctx.fillStyle = color;
      drawText(plot, text, x, FOOTER_Y + row * FOOTER_PITCH, FOOTER_PX);
    };
    line(l1, 0, CHART_COLORS.warpEnergy);
    const targets = l2.slice(0, l2.indexOf('DC:'));
    line(targets.trimEnd(), 1, CHART_COLORS.targets, 0, l2);
    const dcAt = l2.indexOf('DC:');
    line('DC:', 1, CHART_COLORS.dcLabel, dcAt, l2);
    SUBSYSTEMS.forEach((sys, i) => {
      const st = d.damage[sys];
      const color = st === 'ok' ? CHART_COLORS.dcOk : st === 'damaged' ? CHART_COLORS.dcDamaged : CHART_COLORS.dcDestroyed;
      line(SUBSYSTEM_LETTER[sys], 1, color, dcAt + 3 + i, l2);
    });
    line(l3, 2, CHART_COLORS.starDate);
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.root.remove();
  }
}
