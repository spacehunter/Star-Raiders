import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { AFT_FAR_LIMIT, CLASSIC_STARS, ENHANCED_STARS, FOURCOLORPIXEL, Starfield, starColor } from './starfield';

// MANUAL_SPEC §17.13, §18.1; R: INITPOSVEC, GAMELOOP step 17, FOURCOLORPIXEL; Part 4 bend 3.
describe('starfield', () => {
  it('has 12 stars (Classic) or 48 (Enhanced)', () => {
    expect(CLASSIC_STARS).toBe(12);
    expect(ENHANCED_STARS).toBe(48);
    const f = new Starfield(createRng(1), CLASSIC_STARS);
    expect(f.stars).toHaveLength(12);
    f.setCount(ENHANCED_STARS, 'FRONT');
    expect(f.stars).toHaveLength(48);
    f.setCount(CLASSIC_STARS, 'FRONT');
    expect(f.stars).toHaveLength(12);
  });

  it('new front stars start 3840..4095 KM ahead within ±4095 KM (INITPOSVEC)', () => {
    const f = new Starfield(createRng(7), 1);
    const s = f.stars[0];
    for (let i = 0; i < 500; i++) {
      f.respawn(s, 'FRONT');
      expect(s.z).toBeGreaterThanOrEqual(3840);
      expect(s.z).toBeLessThanOrEqual(4095);
      expect(Math.abs(s.x)).toBeLessThanOrEqual(4095);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(4095);
      f.respawn(s, 'AFT');
      expect(s.z).toBeLessThan(0);
      expect(s.z).toBeGreaterThanOrEqual(-3968);
    }
  });

  it('every star stays on screen while flying and turning (replaced when it leaves)', () => {
    for (const view of ['FRONT', 'AFT'] as const) {
      const f = new Starfield(createRng(1979), ENHANCED_STARS, view);
      for (let loop = 0; loop < 2000; loop++) {
        const stick = { x: ((loop >> 7) % 3) - 1, y: ((loop >> 8) % 3) - 1 } as const;
        f.loop(stick as { x: -1 | 0 | 1; y: -1 | 0 | 1 }, 112, view, loop & 7);
        for (const s of f.stars) {
          expect(s.pixel).not.toBeNull();
          expect(s.pixel!.col).toBeGreaterThanOrEqual(0);
          expect(s.pixel!.col).toBeLessThan(160);
          expect(s.pixel!.row).toBeGreaterThanOrEqual(0);
          expect(s.pixel!.row).toBeLessThan(100);
          if (view === 'FRONT') expect(s.z).toBeGreaterThanOrEqual(0);
          else expect(s.z).toBeGreaterThanOrEqual(AFT_FAR_LIMIT);
        }
      }
    }
  });

  it('streams outward: a star ahead drifts away from the centre as the ship flies', () => {
    const f = new Starfield(createRng(3), 1);
    const s = f.stars[0];
    Object.assign(s, { x: 400, y: 300, z: 4000 });
    f.loop({ x: 0, y: 0 }, 32, 'FRONT', 0);
    const first = { ...s.pixel! };
    for (let i = 0; i < 60; i++) f.loop({ x: 0, y: 0 }, 32, 'FRONT', 0);
    expect(s.pixel!.col).toBeGreaterThan(first.col);
    expect(s.pixel!.row).toBeLessThan(first.row);
  });

  it('is deterministic for a seed', () => {
    const a = new Starfield(createRng(42), 12);
    const b = new Starfield(createRng(42), 12);
    for (let i = 0; i < 100; i++) {
      a.loop({ x: 1, y: 0 }, 32, 'FRONT', i & 7);
      b.loop({ x: 1, y: 0 }, 32, 'FRONT', i & 7);
    }
    expect(a.stars).toEqual(b.stars);
  });

  it('colours stars by distance: near bright ($AF), far dim ($A6), mid ones flicker', () => {
    expect(FOURCOLORPIXEL).toHaveLength(32);
    // Range index 0 (closer than 256 KM): COLOR3 on most counter values.
    expect(starColor(100, 0, 0)).toBe(3);
    // Range 8 (2048..2303 KM): mid ($AA) or far ($A6), never near.
    const mid = Array.from({ length: 8 }, (_, c) => starColor(2100, 0, c));
    expect(mid).toEqual([2, 2, 2, 1, 1, 2, 1, 2]);
    // Range 15 (far): COLOR1 ($A6) on every counter value.
    for (let c = 0; c < 8; c++) expect(starColor(4000, 1, c)).toBe(1);
  });
});
