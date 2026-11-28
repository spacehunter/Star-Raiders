/**
 * 2D pixel renderer for the Front and Aft views (MANUAL_SPEC §5.3, §6, §17.2, §17.6, §17.13,
 * §18.1, §18.2; OVERHAUL_PLAN Phase 3, Phase 4 and Part 4 bends 2 and 4).
 *
 * The frame is 160 × 123 square pixels:
 *
 *   rows   0– 99  the 160 × 100 playfield
 *                 Front: rows 6–16 show the title line instead of playfield
 *                 Aft:   the top rows show the permanent "AFT VIEW" header
 *   rows 100–122  the control panel band: 3 blank rows, text row 1, 1 blank row, text row 2,
 *                 3 blank rows. Measured from the manual's HUD strip photo, where the band is
 *                 23 character pixels tall and each row is 8 tall (docs/reference/manual).
 *
 * Text uses 8 × 8 characters in playfield pixels, i.e. 20 per line like the ROM's text mode.
 * (The Atari drew them half as tall; at playfield size they read like the manual's photos.)
 *
 * The frame is scaled by a whole number so every pixel stays crisp, centred with a small safe
 * margin, and letterboxed or pillarboxed, never stretched. The optional CRT filter darkens a
 * line between pixel rows; it is off by default.
 */
import { drawPanelText, drawText, GLYPH_COLUMNS } from './font';
import { ROM_RGB, atariColor } from './palette';
import { PLAYFIELD_H, PLAYFIELD_W, projectPoint, type SpaceView } from './projection';
import { starColor, type Star } from './starfield';
import { random } from '../core/rng';
import { ATTACK_COMPUTER_LINES, BLIP_SHAPE, LOCK_MARKS, type AttackDisplay } from '../sim/attackComputer';
import { SCAN_HEADER, type ScanPicture } from './scan';
import { placeSprite, placeStarbase, SHAPE, shapeColor, type ShapeType, type SpritePlacement } from './sprites';

export const FRAME_W = PLAYFIELD_W;
export const PANEL_LINES = 23;
export const FRAME_LINES = PLAYFIELD_H + PANEL_LINES; // 123
const PANEL_TOP = PLAYFIELD_H;
/** Top rows of the panel's two text rows, inside the band (3 blank, 8, 1 blank, 8, 3 blank). */
export const PANEL_ROW_TOPS = [3, 12] as const;
/** Characters per text line (ROM text mode: 20 × 8 pixels). */
export const TEXT_COLUMNS = 20;

/** Playfield rows the title line (front) or the view header (aft) replaces, and the text's top row. */
export const TITLE_ZONE = {
  FRONT: { firstRow: 6, rows: 11, textLine: 8 },
  AFT: { firstRow: 0, rows: 10, textLine: 1 },
} as const;

/** R: AFTHEADER — the Aft view's permanent header, "      AFT VIEW      " (from column 6). */
export const AFT_HEADER = '      AFT VIEW';

/**
 * Part 4 bend 4 (readable HUD): a safe margin kept clear on every side, as a fraction of the
 * viewport, so the panel never sits under a rounded corner, notch or bezel.
 */
export const SAFE_MARGIN = 0.02;

/** Whole-number scale of the 160 × 123 frame that fits the viewport inside the safe margin. */
export function frameScale(viewW: number, viewH: number): number {
  const m = 2 * Math.round(SAFE_MARGIN * Math.min(viewW, viewH));
  return Math.max(1, Math.floor(Math.min((viewW - m) / FRAME_W, (viewH - m) / FRAME_LINES)));
}

/** Where the k-scaled frame sits in a viewport (centred, letterboxed or pillarboxed). */
export function frameRect(viewW: number, viewH: number): { x: number; y: number; w: number; h: number; k: number } {
  const k = frameScale(viewW, viewH);
  const w = FRAME_W * k;
  const h = FRAME_LINES * k;
  return { x: Math.floor((viewW - w) / 2), y: Math.floor((viewH - h) / 2), w, h, k };
}

export type SpaceObjectKind = 'fighter' | 'cruiser' | 'basestar' | 'starbase' | 'transferVessel' | 'photon' | 'zylonTorpedo' | 'meteor' | 'warpMarker';

export interface SpaceObject {
  kind: SpaceObjectKind;
  /** Ship-frame position in KM. */
  x: number;
  y: number;
  z: number;
}

/** A point in the ship frame (KM): an explosion fragment. */
export interface SpacePoint {
  x: number;
  y: number;
  z: number;
}

/** The ROM shape type each object is drawn with (§18.3; the Zylon torpedo uses the photon shape). */
export const OBJECT_SHAPE: Readonly<Record<SpaceObjectKind, ShapeType>> = {
  fighter: SHAPE.FIGHTER,
  cruiser: SHAPE.CRUISER,
  basestar: SHAPE.BASESTAR,
  starbase: SHAPE.STARBASE_CENTER,
  transferVessel: SHAPE.TRANSFER_VESSEL,
  photon: SHAPE.PHOTON,
  zylonTorpedo: SHAPE.PHOTON,
  meteor: SHAPE.METEOR,
  warpMarker: SHAPE.HYPERWARP_MARKER,
};

/** The panel's fields as text (sim/panel.ts) plus the band colour. */
export interface PanelData {
  v: string;
  k: string;
  e: string;
  /** 'T', or 'C' with the tracking computer on. */
  letter: 'T' | 'C';
  t: string;
  theta: string;
  phi: string;
  range: string;
  /** Band colour: $90, $44 (low-energy flash) or $26 (shields out). */
  band: string;
}

export interface SpaceFrame {
  view: SpaceView;
  stars: readonly Star[];
  objects: readonly SpaceObject[];
  /** Explosion fragments: single playfield pixels coloured like stars (§17.7, R step 17). */
  fragments: readonly SpacePoint[];
  /** R: COUNT256 (starbase pulse) and COUNT8 (star/fragment colours). */
  count256: number;
  /** Attack computer on: front cross hairs or aft dashes (§5.3, §17.6). */
  crosshair: boolean;
  /** The Attack Computer Display (Front view, computer on and working), or null (§11, §17.6). */
  attackComputer?: AttackDisplay | null;
  /** Shields up and working: background $A0 (§17.13). */
  shields: boolean;
  /** R: REDALERTLIFE, loops left of a red alert (0 = none). */
  redAlertLife: number;
  /** Loops left of the shields-hit flash (random background colours). */
  hitFlash: number;
  /** Text on the front view's title line, or empty. (The aft view always shows AFT VIEW.) */
  title: string;
  panel: PanelData;
}

/**
 * What the renderer draws for the Long-Range Scan (§10, §17.3): the picture from buildScan,
 * the background state and the panel. No title-line messages, cross hairs or attack computer:
 * the ROM's LRS display list has only the header and the playfield (R: DLSTFRAGLRS).
 */
export interface ScanFrame {
  picture: ScanPicture;
  shields: boolean;
  redAlertLife: number;
  hitFlash: number;
  panel: PanelData;
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

/** Every playfield pixel of the Attack Computer Display frame, as `col,row` keys (R: DRAWLINESTAB). */
export const ATTACK_FRAME_PIXELS: ReadonlySet<string> = (() => {
  const set = new Set<string>();
  for (const l of ATTACK_COMPUTER_LINES) {
    for (let i = 0; i < l.length; i++) set.add(l.down ? `${l.col},${l.row + i}` : `${l.col + i},${l.row}`);
  }
  return set;
})();

/**
 * The Attack Computer Display as coloured playfield pixels (§11, §17.6, §17.13): the frame in
 * COLOR1 ($A6), the blip and lock-on markers in COLOR2 ($AA), and COLOR3 (PF2, $AF) where the
 * blip crosses a frame line (R: DRAWLINE's transparent drawing, COLOR1 + COLOR2 = COLOR3).
 * Returns [col, row, register] with register 1, 2 or 3.
 */
export function attackComputerPixels(a: AttackDisplay): Array<[number, number, 1 | 2 | 3]> {
  const px = new Map<string, 1 | 2 | 3>();
  for (const key of ATTACK_FRAME_PIXELS) px.set(key, 1);
  for (let r = 0; r < a.blipRows; r++) {
    for (let b = 0; b < 8; b++) {
      if (!(BLIP_SHAPE[r] & (0x80 >> b))) continue;
      const key = `${a.blipCol + b},${a.blipRow + r}`;
      px.set(key, px.get(key) === 1 ? 3 : 2);
    }
  }
  // The markers are stored over whatever was there (STA, not blended).
  for (let m = 0; m < a.marks; m++) {
    for (const [c, r, w, h] of LOCK_MARKS[m]) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.set(`${c + x},${r + y}`, 2);
    }
  }
  return [...px].map(([key, reg]) => {
    const [c, r] = key.split(',').map(Number);
    return [c, r, reg];
  });
}

/**
 * One sprite drawn in Atari colours (R step 15): hue by type, luminance by range. The basestar's
 * colour is XORed with a random byte every frame (it flickers); the starbase pulses with COUNT256;
 * photon torpedo rows are ANDed with random bits (they sparkle, R step 6).
 */
export interface DrawnSprite extends SpritePlacement {
  color: number;
}

/** Sprites for one object (three for a starbase: centre and wings), or [] when not on screen. */
export function objectSprites(o: SpaceObject, view: SpaceView, count256: number, rng: () => number): DrawnSprite[] {
  if (o.kind === 'starbase') {
    // Orange, pulsing: the brightness bits are XORed with COUNT256's low nibble (§17.9, §17.13).
    return placeStarbase(o.x, o.y, o.z, view).map((p) => ({ ...p, color: shapeColor(p.type, p.range) ^ (count256 & 0x0f) }));
  }
  const place = placeSprite(OBJECT_SHAPE[o.kind], o.x, o.y, o.z, view);
  if (!place) return [];
  const byte = () => Math.floor(rng() * 256) & 0xff;
  let color = shapeColor(place.type, place.range);
  if (o.kind === 'basestar') color ^= byte();
  if (o.kind === 'photon' || o.kind === 'zylonTorpedo') place.rows = place.rows.map((r) => r & byte());
  return [{ ...place, color }];
}

export class Renderer {
  public readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  /**
   * The frame at native resolution, 160 × 123, stored with two lines per row so sprites can use
   * the Player/Missile scanline (half a playfield row). Drawing uses playfield coordinates.
   */
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
    this.frame.height = FRAME_LINES * 2;
    this.fctx = this.frame.getContext('2d')!;
    this.fctx.setTransform(1, 0, 0, 2, 0, 0);
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

  /** Draw one Long-Range Scan frame. */
  renderScan(f: ScanFrame): void {
    this.drawScan(f);
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

    // Explosion fragments: playfield pixels coloured by distance like the stars (R step 17).
    for (const p of f.fragments) {
      const px = projectPoint(p.x, p.y, p.z, f.view);
      if (!px) continue;
      const c = starColor(p.z, px.col, f.count256 & 7);
      if (c) this.pf(px.col, px.row, 1, 1, c === 3 ? pf2 : STAR_RGB[c]);
    }

    if (f.crosshair) for (const [c, r, w, h] of crosshairRects(f.view)) this.pf(c, r, w, h, ROM_RGB.$A6);
    if (f.attackComputer && f.view === 'FRONT') {
      const rgb = { 1: ROM_RGB.$A6, 2: ROM_RGB.$AA, 3: pf2 } as const;
      for (const [c, r, reg] of attackComputerPixels(f.attackComputer)) this.pf(c, r, 1, 1, rgb[reg]);
    }

    // Title line / view header: the display list shows text there, not playfield (§18.1).
    this.rect(0, zone.firstRow, FRAME_W, zone.rows, bg);
    // R: SETTITLE copies the words from column 0; the header and phrases carry their own spaces.
    const title = f.view === 'AFT' ? AFT_HEADER : f.title;
    if (title) {
      this.fctx.fillStyle = pf2;
      drawText((x, y, w, h) => this.fctx.fillRect(x, y, w, h), title.slice(0, TEXT_COLUMNS), 0, zone.textLine, 1);
    }

    // PLAYER sprites lie over the playfield and the title line (§18.3), far ones first.
    const objs = [...f.objects].sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    for (const o of objs) for (const s of objectSprites(o, f.view, f.count256, this.rng)) this.drawSprite(s);

    this.drawPanel(f.panel);
  }

  private drawScan(f: ScanFrame): void {
    const { bg: baseBg, pf2 } = backgroundColors(f);
    const bg = f.hitFlash > 0 ? atariColor(Math.floor(this.rng() * 256) & 0xf6) : baseBg;
    this.rect(0, 0, FRAME_W, PANEL_TOP, bg);
    const rgb = { 1: STAR_RGB[1], 2: STAR_RGB[2], 3: pf2 } as const;
    for (const [c, r, reg] of f.picture.pixels) this.pf(c, r, 1, 1, rgb[reg]);
    // The header line (same display list as the Aft view's).
    const zone = TITLE_ZONE.AFT;
    this.rect(0, zone.firstRow, FRAME_W, zone.rows, bg);
    this.fctx.fillStyle = pf2;
    drawText((x, y, w, h) => this.fctx.fillRect(x, y, w, h), SCAN_HEADER.slice(0, TEXT_COLUMNS), 0, zone.textLine, 1);
    // Blips are PLAYERs: over the playfield and the header.
    for (const b of f.picture.blips) {
      this.drawSprite({ type: SHAPE.PHOTON, range: 13, cell: 6, col: b.col, line: b.line, rows: b.rows, color: b.color });
    }
    this.drawPanel(f.panel);
  }

  /** One sprite, one scanline (half a playfield row) per byte, clipped to the playfield. */
  private drawSprite(s: DrawnSprite): void {
    this.fctx.fillStyle = atariColor(s.color);
    s.rows.forEach((bits, i) => {
      const line = s.line + i;
      if (line < 0 || line >= PLAYFIELD_H * 2) return;
      for (let b = 0; b < 8; b++) {
        if (!(bits & (0x80 >> b))) continue;
        const col = s.col + b;
        if (col < 0 || col >= PLAYFIELD_W) continue;
        this.fctx.fillRect(col, line / 2, 1, 0.5);
      }
    });
  }

  /**
   * §6 / §17.2 control panel: `V:00 K:00 E:9999 T:0` / ` θ:+00 Φ:+00 R:+000` on the band,
   * coloured per PANELTXTTAB (K field pink, E field yellow, Φ and R labels pink/yellow, the rest
   * mint). The band is $90, flashing $44 on low energy and $26 with the shields out.
   */
  private drawPanel(p: PanelData): void {
    this.rect(0, PANEL_TOP, FRAME_W, PANEL_LINES, p.band);
    const row1: Array<[string, string]> = [
      [`V:${p.v} `, ROM_RGB.$B8],
      [`K:${p.k}`, ROM_RGB.$5A],
      [' ', ROM_RGB.$B8],
      [`E:${p.e}`, ROM_RGB.$FC],
      [` ${p.letter}:${p.t}`, ROM_RGB.$B8],
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
    line(row1, PANEL_TOP + PANEL_ROW_TOPS[0]);
    line(row2, PANEL_TOP + PANEL_ROW_TOPS[1]);
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
    ctx.drawImage(this.frame, 0, 0, FRAME_W, FRAME_LINES * 2, r.x, r.y, r.w, r.h);
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
