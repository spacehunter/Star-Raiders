/**
 * 2D pixel renderer for the Front and Aft views (MANUAL_SPEC §5.3, §6, §17.2, §17.6, §17.13,
 * §18.1, §18.2; OVERHAUL_PLAN Phase 3 and Part 4 bends 2 and 4).
 *
 * The frame is 160 × 120 square pixels, laid out like the ROM's display lists
 * (R: DLSTFRAG L10417):
 *
 *   rows   0– 99  the 160 × 100 playfield
 *                 Front: rows 6–16 show the title line instead of playfield
 *                 Aft:   the top rows show the permanent "AFT VIEW" header
 *   rows 100–119  the control panel band, two 20-character rows
 *
 * Text uses 8 × 8 characters in playfield pixels, i.e. 20 per line like the ROM's text mode.
 * (The Atari drew them half as tall; at playfield size they read like the manual's photos.)
 *
 * 160 × 120 is exactly 4:3. The frame is scaled by a whole number so every pixel stays crisp,
 * centred, and pillarboxed on 16:9 screens, never stretched. The optional CRT filter darkens a
 * line between pixel rows; it is off by default.
 */
import { drawPanelText, drawText, GLYPH_COLUMNS } from './font';
import { ROM_RGB, atariColor } from './palette';
import { CENTER_COL, CENTER_ROW, PLAYFIELD_H, PLAYFIELD_W, projectPoint, type SpaceView } from './projection';
import type { Star } from './starfield';
import { random } from '../core/rng';

export const FRAME_W = PLAYFIELD_W;
export const PANEL_LINES = 20;
export const FRAME_LINES = PLAYFIELD_H + PANEL_LINES; // 120
const PANEL_TOP = PLAYFIELD_H;

/** Playfield rows the title line (front) or the view header (aft) replaces, and the text's top row. */
export const TITLE_ZONE = {
  FRONT: { firstRow: 6, rows: 11, textLine: 8 },
  AFT: { firstRow: 0, rows: 10, textLine: 1 },
} as const;

/** R: AFTHEADER — the Aft view's permanent header. */
export const AFT_HEADER = 'AFT VIEW';

/** Whole-number scale of the 160 × 120 frame that fits the viewport. */
export function frameScale(viewW: number, viewH: number): number {
  return Math.max(1, Math.floor(Math.min(viewW / FRAME_W, viewH / FRAME_LINES)));
}

/** Where the k-scaled frame sits in a viewport (centred, letterboxed or pillarboxed). */
export function frameRect(viewW: number, viewH: number): { x: number; y: number; w: number; h: number; k: number } {
  const k = frameScale(viewW, viewH);
  const w = FRAME_W * k;
  const h = FRAME_LINES * k;
  return { x: Math.floor((viewW - w) / 2), y: Math.floor((viewH - h) / 2), w, h, k };
}

export type SpaceObjectKind = 'zylon' | 'starbase' | 'photon' | 'zylonTorpedo';

export interface SpaceObject {
  kind: SpaceObjectKind;
  /** Ship-frame position in KM. */
  x: number;
  y: number;
  z: number;
}

export interface PanelData {
  v: string;
  k: string;
  e: string;
  t: string;
  theta: string;
  phi: string;
  range: string;
}

export interface SpaceFrame {
  view: SpaceView;
  stars: readonly Star[];
  objects: readonly SpaceObject[];
  /** Attack computer on: front cross hairs or aft dashes (§5.3, §17.6). */
  crosshair: boolean;
  /** Shields up and working: background $A0 (§17.13). */
  shields: boolean;
  /** R: REDALERTLIFE, loops left of a red alert (0 = none). */
  redAlertLife: number;
  /** Loops left of the shields-hit flash (random background colours). */
  hitFlash: number;
  /** Text on the front view's title line, or empty. (The aft view always shows AFT VIEW.) */
  title: string;
  panel: PanelData;
  /** Hyperwarp target marker, as a pixel offset from the playfield centre. */
  warpMarker: { dx: number; dy: number } | null;
}

/** Colours of the three star registers: PF0 far, PF1 mid, PF2 near (§17.13). */
const STAR_RGB = { 1: ROM_RGB.$A6, 2: ROM_RGB.$AA } as const;

/** §17.13 / R step 16: background and PF2 (near stars, title) for the current alert state. */
export function backgroundColors(f: Pick<SpaceFrame, 'shields' | 'redAlertLife'>): { bg: string; pf2: string } {
  let bg: string = f.shields ? ROM_RGB.$A0 : ROM_RGB.$00;
  let pf2: string = ROM_RGB.$AF;
  if (f.redAlertLife > 0) {
    pf2 = ROM_RGB.$4F;
    // "Switch colors every 32 game loops" on bit 5 of the remaining life.
    if (f.redAlertLife & 0x20) {
      bg = ROM_RGB.$42;
      pf2 = ROM_RGB.$60;
    }
  }
  return { bg, pf2 };
}

/** §17.6 front cross hairs and aft dashes, as playfield [col, row, w, h] rectangles. */
export function crosshairRects(view: SpaceView): Array<[number, number, number, number]> {
  const bars: Array<[number, number, number, number]> = [
    [62, 50, 15, 1], // cols 62–76
    [84, 50, 15, 1], // cols 84–98
  ];
  if (view === 'FRONT') {
    bars.push([80, 40, 1, 7]); // rows 40–46
    bars.push([80, 54, 1, 7]); // rows 54–60
  }
  return bars;
}

/** Placeholder blob size (playfield pixels) by distance; the ROM sprites arrive in Phase 5. */
export function blobSize(distanceKm: number): number {
  const d = Math.abs(distanceKm);
  if (d < 1024) return 4;
  if (d < 2560) return 3;
  if (d < 5120) return 2;
  return 1;
}

const OBJECT_RGB: Record<SpaceObjectKind, (d: number) => string> = {
  // §17.13: Zylons grey/white, brightness falling with distance.
  zylon: (d) => (d < 2560 ? ROM_RGB.$0E : ROM_RGB.$06),
  starbase: () => ROM_RGB.$28,
  photon: () => ROM_RGB.$58,
  zylonTorpedo: () => ROM_RGB.$0E,
};

export class Renderer {
  public readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  /** The frame at native resolution, 160 × 120. */
  private readonly frame: HTMLCanvasElement;
  private readonly fctx: CanvasRenderingContext2D;
  private crt = false;
  private rng: () => number = random;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.frame = document.createElement('canvas');
    this.frame.width = FRAME_W;
    this.frame.height = FRAME_LINES;
    this.fctx = this.frame.getContext('2d')!;
  }

  /** Random source for the hit flash (the game's seeded stream keeps captures deterministic). */
  setRandom(rng: () => number): void {
    this.rng = rng;
  }

  setCrt(on: boolean): void {
    this.crt = on;
  }

  dispose(): void {
    this.canvas.remove();
  }

  /** Draw one Front/Aft frame. */
  render(f: SpaceFrame): void {
    this.drawFrame(f);
    this.present();
  }

  private rect(col: number, line: number, w: number, h: number, color: string): void {
    this.fctx.fillStyle = color;
    this.fctx.fillRect(col, line, w, h);
  }

  /** A playfield pixel rectangle, clipped to the playfield. */
  private pf(col: number, row: number, w: number, h: number, color: string): void {
    const c0 = Math.max(0, col);
    const r0 = Math.max(0, row);
    const c1 = Math.min(PLAYFIELD_W, col + w);
    const r1 = Math.min(PLAYFIELD_H, row + h);
    if (c1 <= c0 || r1 <= r0) return;
    this.rect(c0, r0, c1 - c0, r1 - r0, color);
  }

  private drawFrame(f: SpaceFrame): void {
    const { bg: baseBg, pf2 } = backgroundColors(f);
    const bg = f.hitFlash > 0 ? atariColor(Math.floor(this.rng() * 256) & 0xf6) : baseBg;

    // The background register covers the playfield and the title line.
    this.rect(0, 0, FRAME_W, PANEL_TOP, bg);
    const zone = TITLE_ZONE[f.view];

    // Stars: one playfield pixel each (§17.13).
    for (const s of f.stars) {
      if (!s.pixel || !s.color) continue;
      this.pf(s.pixel.col, s.pixel.row, 1, 1, s.color === 3 ? pf2 : STAR_RGB[s.color]);
    }

    // Objects: placeholder blobs, far ones first.
    const objs = [...f.objects].sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    for (const o of objs) {
      const px = projectPoint(o.x, o.y, o.z, f.view);
      if (!px) continue;
      const d = Math.hypot(o.x, o.y, o.z);
      const size = o.kind === 'photon' || o.kind === 'zylonTorpedo' ? Math.min(2, blobSize(d)) : blobSize(d);
      const half = Math.floor(size / 2);
      this.pf(px.col - half, px.row - half, size, size, OBJECT_RGB[o.kind](d));
    }

    if (f.warpMarker) this.drawWarpMarker(f.warpMarker.dx, f.warpMarker.dy);

    if (f.crosshair) for (const [c, r, w, h] of crosshairRects(f.view)) this.pf(c, r, w, h, ROM_RGB.$A6);

    // Title line / view header: the display list shows text there, not playfield (§18.1).
    this.rect(0, zone.firstRow, FRAME_W, zone.rows, bg);
    const title = f.view === 'AFT' ? AFT_HEADER : f.title;
    if (title) {
      const text = title.slice(0, FRAME_W / GLYPH_COLUMNS);
      const x0 = Math.floor((FRAME_W - text.length * GLYPH_COLUMNS) / 2);
      this.fctx.fillStyle = pf2;
      drawText((x, y, w, h) => this.fctx.fillRect(x, y, w, h), text, x0, zone.textLine, 1);
    }

    this.drawPanel(f.panel);
  }

  /** §18.3 hyperwarp target marker, sky blue, around an offset from the centre. */
  private drawWarpMarker(dx: number, dy: number): void {
    const shape = ['..#.#..', '###.###', '.......', '###.###', '..#.#..'];
    const c0 = CENTER_COL + Math.round(dx) - 3;
    const r0 = CENTER_ROW + Math.round(dy) - 2;
    shape.forEach((line, r) => {
      for (let c = 0; c < line.length; c++) if (line[c] === '#') this.pf(c0 + c, r0 + r, 1, 1, ROM_RGB.$9F);
    });
  }

  /**
   * §6 / §17.2 control panel: `V:00 K:00 E:9999 T:0` / ` θ:+00 Φ:+00 R:+000` on the $90 band,
   * coloured per PANELTXTTAB (K field pink, E field yellow, Φ and R labels pink/yellow, the rest
   * mint). Phase 4 adds the panel's flashes and readout rules.
   */
  private drawPanel(p: PanelData): void {
    this.rect(0, PANEL_TOP, FRAME_W, PANEL_LINES, ROM_RGB.$90);
    const row1: Array<[string, string]> = [
      [`V:${p.v} `, ROM_RGB.$B8],
      [`K:${p.k}`, ROM_RGB.$5A],
      [' ', ROM_RGB.$B8],
      [`E:${p.e}`, ROM_RGB.$FC],
      [` ${p.t}`, ROM_RGB.$B8],
    ];
    const row2: Array<[string, string]> = [
      [' θ:', ROM_RGB.$B8],
      [p.theta, ROM_RGB.$B8],
      [' ', ROM_RGB.$B8],
      ['Φ:', ROM_RGB.$5A],
      [p.phi, ROM_RGB.$B8],
      [' ', ROM_RGB.$B8],
      ['R:', ROM_RGB.$FC],
      [p.range, ROM_RGB.$B8],
    ];
    const line = (parts: Array<[string, string]>, top: number) => {
      let col = 0;
      for (const [text, color] of parts) {
        this.fctx.fillStyle = color;
        drawPanelText((x, y, w, h) => this.fctx.fillRect(x, y, w, h), text, col, top);
        col += text.length * GLYPH_COLUMNS;
      }
    };
    // R: panel display list — 1 blank line, text row, gap, text row (8 rows each in the ROM font).
    line(row1, PANEL_TOP + 1);
    line(row2, PANEL_TOP + 11);
  }

  /** Scale the native frame onto the screen canvas by a whole number, centred. */
  private present(): void {
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const ch = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    const ctx = this.ctx;
    const r = frameRect(cw, ch);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(this.frame, 0, 0, FRAME_W, FRAME_LINES, r.x, r.y, r.w, r.h);
    if (this.crt && r.k >= 2) {
      // Two scanlines per pixel row like the Atari's: darken the bottom of each half row.
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      const half = r.k / 2;
      const gap = Math.max(1, Math.floor(r.k / 6));
      for (let line = 0; line < FRAME_LINES * 2; line++) {
        ctx.fillRect(r.x, Math.round(r.y + (line + 1) * half) - gap, r.w, gap);
      }
    }
  }
}
