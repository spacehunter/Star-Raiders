import { describe, expect, it } from 'vitest';
import { CENTER_COL, CENTER_ROW, MAPTO80, projectOffset, projectPoint } from './projection';

// MANUAL_SPEC §17.13; R: PROJECTION, MAPTO80, SCREENCOLUMN, SCREENROW.
describe('ROM projection: offset = 81 · (x/z · 128) / 256', () => {
  it('MAPTO80 maps 0..255 onto 0..80', () => {
    expect(MAPTO80).toHaveLength(256);
    expect(MAPTO80[0]).toBe(0);
    expect(MAPTO80[128]).toBe(40);
    expect(MAPTO80[255]).toBe(80);
  });

  it('matches the formula for many ratios', () => {
    for (let z = 256; z <= 4096; z += 160) {
      for (let x = 0; x <= 2 * z; x += 37) {
        const q = Math.floor((128 * x) / z);
        const expected = q > 255 ? null : Math.floor((81 * q) / 256);
        expect(projectOffset(x, z)).toBe(expected);
        expect(projectOffset(-x, -z)).toBe(expected);
      }
    }
  });

  it('x = z (45°) lands 40 pixels off centre; overflow and z = 0 are offscreen', () => {
    expect(projectOffset(1000, 1000)).toBe(40);
    expect(projectOffset(2000, 1000)).toBeNull(); // quotient 256
    expect(projectOffset(5, 0)).toBeNull();
  });

  it('places pixels around column 80, row 50 like SCREENCOLUMN/SCREENROW', () => {
    expect(projectPoint(0, 0, 1000, 'FRONT')).toEqual({ col: CENTER_COL, row: CENTER_ROW - 1 });
    expect(projectPoint(-1, -1, 1000, 'FRONT')).toEqual({ col: CENTER_COL - 1, row: CENTER_ROW });
    // x/z = 1/2 → quotient 64 → offset 20; y/z = −1/4 → quotient 32 → offset 10.
    expect(projectPoint(500, -250, 1000, 'FRONT')).toEqual({ col: 100, row: 60 });
    expect(projectPoint(-500, 250, 1000, 'FRONT')).toEqual({ col: 59, row: 39 });
  });

  it('drops pixels outside the 160 × 100 playfield', () => {
    // y/z = 1.25 → quotient 160 → offset 50: below the last row.
    expect(projectPoint(0, 1250, 1000, 'FRONT')).toBeNull();
    expect(projectPoint(0, 1200, 1000, 'FRONT')).not.toBeNull();
    // x/z = 1.99 → offset 80 → right of the last column.
    expect(projectPoint(1990, 0, 1000, 'FRONT')).toBeNull();
  });

  it('front shows z ≥ 0 only; aft shows z < 0 with the same, unmirrored sides', () => {
    expect(projectPoint(500, 0, -1000, 'FRONT')).toBeNull();
    expect(projectPoint(500, 0, 1000, 'AFT')).toBeNull();
    expect(projectPoint(500, -250, -1000, 'AFT')).toEqual({ col: 100, row: 60 });
  });
});
