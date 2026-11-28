/**
 * The Long-Range Scan picture (MANUAL_SPEC §10, §17.3, §17.13, §18.1; R: GAMELOOP steps 14–15
 * L3562–3590 and L3680–3694, SCREENROW L9490–9502, INITPOSVEC L9632–9641, DRAWLINESTAB L10630,
 * DLSTFRAGLRS L10428, LRSHEADER L2716).
 *
 * A top view of the sector on the z-x plane, our ship in the centre, ahead (+z) up:
 *
 *   row offset    = MAPTO80[|z| high byte]   (off screen from 50 up: |z| ≥ 40,704 KM)
 *   column offset = MAPTO80[|x| high byte]   (off screen from 80 up: |x| ≥ 64,768 KM)
 *
 * so the screen spans about ±40,000 KM ahead/behind and ±65,000 KM to the sides, 1 pixel per
 * ≈ 800 KM. The space objects are already in the ship frame, so steering (which rotates every
 * object around us, §17.13) turns the whole picture around our ship.
 *
 * - Stars and explosion fragments are PLAYFIELD pixels (the ROM's 12 stars live at ±65,535 KM).
 * - Every live PLAYER (Zylon ships, the meteor or Zylon torpedo, photons, the starbase, the
 *   hyperwarp marker) is drawn with its shape cell 6, the scan blip, in a random colour every
 *   loop: a flashing square, or for the starbase a small cross.
 * - Our ship is five COLOR1 lines drawn by DRAWLINES, which draws nothing when the attack
 *   computer is destroyed.
 * - Damaged: SCREENROW puts each object above or below the centre at random (the mirror image).
 *   Destroyed: step 14 is skipped, only our ship is drawn.
 */
import { MAPTO80, CENTER_COL, CENTER_ROW, PLAYFIELD_W, PLAYFIELD_H, type Pixel } from './projection';
import { SHAPE, shapeRows, shapeCell, type ShapeType } from './sprites';
import { starColor, type Star, type StarColor } from './starfield';
import { scanZ, type ScanState } from '../sim/damage';

/** R: LRSHEADER — "  LONG RANGE SCAN", the view's permanent header (same place as AFT VIEW). */
export const SCAN_HEADER = '  LONG RANGE SCAN';

/** First |z| (KM) that is off the top or bottom: high byte 159, MAPTO80 = 50. */
export const SCAN_Z_LIMIT_KM = 159 * 256;
/** First |x| (KM) that is off the sides: high byte 253, MAPTO80 = 80. */
export const SCAN_X_LIMIT_KM = 253 * 256;

/**
 * The ROM's |coordinate| high byte: positive values keep theirs, negative ones are stored as
 * two's complement and inverted with EOR #$FF, i.e. (−c − 1) >> 8. Capped at 255.
 */
export function scanHi(km: number): number {
  const c = Math.floor(km);
  const hi = c >= 0 ? c >> 8 : (-c - 1) >> 8;
  return Math.min(255, hi);
}

/** Pixel offset from the centre for one coordinate (MAPTO80 of the high byte). */
export function scanOffset(km: number): number {
  return MAPTO80[scanHi(km)];
}

/**
 * Playfield pixel of a ship-frame point on the scan, or null when off screen. `z` is the
 * coordinate as drawn (after the mirror, see scanZ). +z is up, +x right.
 */
export function scanPixel(x: number, z: number): Pixel | null {
  const rowOff = scanOffset(z);
  if (rowOff >= CENTER_ROW) return null;
  const colOff = scanOffset(x);
  if (colOff >= CENTER_COL) return null;
  // SCREENCOLUMN / SCREENROW, with z in place of y.
  const col = x >= 0 ? CENTER_COL + colOff : CENTER_COL - (colOff + 1);
  const row = z >= 0 ? CENTER_ROW - (rowOff + 1) : CENTER_ROW + rowOff;
  return { col, row };
}

/**
 * The z high byte step 17 colours an LRS star by: the raw byte, not inverted for negative z,
 * so nearly every star gets the farthest (twinkling) colours.
 */
export function scanStarDistance(z: number): number {
  const c = Math.floor(z);
  return (c >= 0 ? c >> 8 : ((c >> 8) & 0xff)) * 256;
}

/** R: DRAWLINESTAB lines 17–21 — our starship (column, first row, length down). */
export const SHIP_ICON_LINES: ReadonlyArray<readonly [number, number, number]> = [
  [78, 53, 2],
  [79, 52, 2],
  [80, 50, 5],
  [81, 52, 2],
  [82, 53, 2],
];

/** Every pixel of our ship's icon as [col, row]. */
export const SHIP_ICON_PIXELS: ReadonlyArray<readonly [number, number]> = SHIP_ICON_LINES.flatMap(([c, r, n]) =>
  Array.from({ length: n }, (_, i) => [c, r + i] as const)
);

/** R: the magic z $F2 → range index 13 → shape cell 6, the scan blip. */
export const SCAN_RANGE_INDEX = 13;
export const SCAN_BLIP_CELL = shapeCell(SCAN_RANGE_INDEX);

/** The scan's kinds of PLAYER object and the shape each one's blip comes from. */
export type ScanObjectKind = 'fighter' | 'cruiser' | 'basestar' | 'starbase' | 'transferVessel' | 'photon' | 'zylonTorpedo' | 'meteor' | 'warpMarker';
export const SCAN_SHAPE: Readonly<Record<ScanObjectKind, ShapeType>> = {
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

/**
 * The blip bitmap: shape cell 6 with each ROM row drawn on two scanlines. Bend (§10 "flashing
 * squares", the manual's LRS photo): the ROM's 2 × 2-scanline blip is a 2 × 1 pixel dash at
 * playfield scale; doubled it is the square the manual shows, twice a star's size.
 */
export function scanBlipRows(type: ShapeType): number[] {
  return shapeRows(type, SCAN_BLIP_CELL).flatMap((r) => [r, r]);
}

export interface ScanObject {
  kind: ScanObjectKind;
  /** Ship-frame position in KM (y is not shown). */
  x: number;
  z: number;
}

export interface ScanBlip {
  kind: ScanObjectKind;
  /** KM as drawn: x, and z after the mirror. */
  x: number;
  z: number;
  /** Left column and top scanline (two per playfield row), like the other sprites. */
  col: number;
  line: number;
  rows: number[];
  /** Random Atari colour byte (R: LDA RANDOM as the colour mask). */
  color: number;
}

export interface ScanPicture {
  /** PLAYFIELD pixels: stars and fragments (registers 1–3) and our ship (COLOR1, blended). */
  pixels: Array<[number, number, StarColor]>;
  blips: ScanBlip[];
  /** Stars drawn. */
  stars: number;
  ship: boolean;
}

export interface ScanInput {
  scan: ScanState;
  /** Stars with their LRS pixel (unmirrored) and colour from Starfield.loop in the LRS view. */
  stars: readonly Star[];
  /** Explosion fragments in the ship frame (KM). */
  fragments: ReadonlyArray<{ x: number; z: number }>;
  objects: readonly ScanObject[];
  /** R: COUNT8 for the fragments' colours. */
  count8: number;
}

/**
 * One loop of the scan: what is drawn where. `mirrorByte` is the POKEY stream behind the
 * damaged mirror (one byte per drawn object, only when damaged); `colorByte` the blip colours.
 */
export function buildScan(input: ScanInput, mirrorByte: () => number, colorByte: () => number): ScanPicture {
  const { scan } = input;
  const px = new Map<string, StarColor>();
  const out: ScanPicture = { pixels: [], blips: [], stars: 0, ship: scan.ship };
  const put = (col: number, row: number, reg: StarColor) => {
    if (col < 0 || col >= PLAYFIELD_W || row < 0 || row >= PLAYFIELD_H) return;
    px.set(`${col},${row}`, reg);
  };

  if (scan.objects) {
    for (const s of input.stars) {
      if (!s.pixel || !s.color) continue;
      const z = scanZ(scan, s.z, mirrorByte);
      const p = z === null ? null : scanPixel(s.x, z);
      if (!p) continue;
      put(p.col, p.row, s.color);
      out.stars++;
    }
    for (const f of input.fragments) {
      const z = scanZ(scan, f.z, mirrorByte);
      const p = z === null ? null : scanPixel(f.x, z);
      if (!p) continue;
      const c = starColor(scanStarDistance(f.z), p.col, input.count8);
      if (c) put(p.col, p.row, c);
    }
    for (const o of input.objects) {
      const z = scanZ(scan, o.z, mirrorByte);
      const p = z === null ? null : scanPixel(o.x, z);
      if (!p || z === null) continue;
      // PLAYERs sit 3 PM pixels left of the column, top one row above the row (as in front).
      out.blips.push({
        kind: o.kind,
        x: o.x,
        z,
        col: p.col - 3,
        line: 2 * (p.row - 1),
        rows: scanBlipRows(SCAN_SHAPE[o.kind]),
        color: colorByte() & 0xff,
      });
    }
  }

  // Our ship in COLOR1, drawn transparently over what is there (R: DRAWLINE: 0→1, 2→3).
  if (scan.ship) {
    for (const [c, r] of SHIP_ICON_PIXELS) {
      const old = px.get(`${c},${r}`) ?? 0;
      px.set(`${c},${r}`, old === 2 || old === 3 ? 3 : 1);
    }
  }

  for (const [key, reg] of px) {
    const [c, r] = key.split(',').map(Number);
    out.pixels.push([c, r, reg]);
  }
  return out;
}
