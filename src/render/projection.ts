/**
 * The ROM's perspective projection (MANUAL_SPEC §17.13; R: PROJECTION L5125, SCREENCOLUMN,
 * SCREENROW, MAPTO80 in INITIALIZE).
 *
 *   QUOTIENT = |x| / |z| · 128            (overflow above 255 = offscreen)
 *   offset   = MAPTO80[QUOTIENT] = ⌊81 · QUOTIENT / 256⌋
 *
 * The offset is measured from the playfield centre (column 80, row 50) of the 160 × 100
 * playfield. A column offset of 80 or more, or a row offset of 50 or more, is offscreen.
 * Positive x is drawn right of the centre, positive y above it. The Aft view uses the very
 * same projection on objects behind the ship (z < 0); it does not mirror x.
 */
export const PLAYFIELD_W = 160;
export const PLAYFIELD_H = 100;
export const CENTER_COL = 80;
export const CENTER_ROW = 50;

/** R: MAPTO80 — maps 0..255 to 0..80. */
export const MAPTO80: readonly number[] = Array.from({ length: 256 }, (_, i) => Math.floor((81 * i) / 256));

/**
 * Pixel offset from the centre for one coordinate (always ≥ 0), or null when the quotient
 * overflows or z = 0 (R: PROJECTION returns 255).
 */
export function projectOffset(coord: number, z: number): number | null {
  const az = Math.abs(z);
  if (az === 0) return null;
  const quotient = Math.floor((Math.abs(coord) * 128) / az);
  if (quotient > 255) return null;
  return MAPTO80[quotient];
}

export type SpaceView = 'FRONT' | 'AFT';

export interface Pixel {
  col: number;
  row: number;
}

/**
 * Playfield pixel of a point in the ship frame, or null when it is not on screen in `view`
 * (behind the viewer, outside the 160 × 100 field, or a projection overflow).
 */
export function projectPoint(x: number, y: number, z: number, view: SpaceView): Pixel | null {
  // R: "Compare sign of z-coordinate with view mode": Front shows z ≥ 0, Aft shows z < 0.
  if (view === 'FRONT' ? z < 0 : z >= 0) return null;
  const rowOff = projectOffset(y, z);
  if (rowOff === null || rowOff >= CENTER_ROW) return null;
  const colOff = projectOffset(x, z);
  if (colOff === null || colOff >= CENTER_COL) return null;
  // SCREENCOLUMN: x ≥ 0 → 80 + off, x < 0 → 80 − (off + 1).
  const col = x >= 0 ? CENTER_COL + colOff : CENTER_COL - (colOff + 1);
  // SCREENROW: y ≥ 0 → 50 − (off + 1) (upper half), y < 0 → 50 + off.
  const row = y >= 0 ? CENTER_ROW - (rowOff + 1) : CENTER_ROW + rowOff;
  return { col, row };
}
