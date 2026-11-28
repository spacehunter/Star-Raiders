import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { objectSprites } from './Renderer';
import { placeSprite, SHAPE, SHAPE_CELLS, shapeColor, shapeRows, spritesOverlap, viewDistanceHi } from './sprites';

const art = (rows: number[]) => rows.map((r) => r.toString(2).padStart(8, '0').replace(/0/g, '.').replace(/1/g, '#'));

// MANUAL_SPEC §18.3: the manual's sprite plates are the ROM bitmaps at their largest size.
describe('ROM sprite bitmaps', () => {
  it('fighter: the 12-row H', () => {
    expect(art(shapeRows(SHAPE.FIGHTER, 0))).toEqual([
      '#......#', '#......#', '#......#', '#......#', '#.####.#', '########',
      '########', '#.####.#', '#......#', '#......#', '#......#', '#......#',
    ]);
  });
  it('cruiser: the 9-row arch', () => {
    expect(art(shapeRows(SHAPE.CRUISER, 0))).toEqual([
      '...##...', '..####..', '.######.', '.######.', '##.##.##', '##....##', '#......#', '#......#', '#......#',
    ]);
  });
  it('basestar: the 10-row diamond with wing bars', () => {
    expect(art(shapeRows(SHAPE.BASESTAR, 0))).toEqual([
      '...##...', '..####..', '.######.', '########', '...##...', '...##...', '########', '.######.', '..####..', '...##...',
    ]);
  });
  it('photon / meteor: the 16-row ball', () => {
    expect(shapeRows(SHAPE.PHOTON, 0)).toHaveLength(16);
    expect(shapeRows(SHAPE.METEOR, 0)).toEqual(shapeRows(SHAPE.PHOTON, 0));
  });
});

// §17.13: 8 size cells by distance, brightness falls with range, nothing beyond 8192 KM.
describe('distance cells and brightness', () => {
  it('8 cells per shape, never growing with distance', () => {
    for (const type of [SHAPE.FIGHTER, SHAPE.CRUISER, SHAPE.BASESTAR, SHAPE.PHOTON]) {
      const heights = Array.from({ length: SHAPE_CELLS }, (_, c) => shapeRows(type, c).length);
      for (let c = 1; c < SHAPE_CELLS; c++) expect(heights[c]).toBeLessThanOrEqual(heights[c - 1]);
    }
  });

  it('the cell is the |z| high byte / 2, in the view direction; ≥ 8192 KM is not drawn', () => {
    expect(placeSprite(SHAPE.FIGHTER, 0, 0, 500, 'FRONT')!.cell).toBe(0);
    expect(placeSprite(SHAPE.FIGHTER, 0, 0, 1024, 'FRONT')!.cell).toBe(2);
    expect(placeSprite(SHAPE.FIGHTER, 0, 0, 8191, 'FRONT')!.cell).toBe(7);
    expect(placeSprite(SHAPE.FIGHTER, 0, 0, 8192, 'FRONT')).toBeNull();
    expect(placeSprite(SHAPE.FIGHTER, 0, 0, -1024, 'FRONT')).toBeNull();
    expect(placeSprite(SHAPE.FIGHTER, 0, 0, -1024, 'AFT')!.cell).toBe(1);
    expect(viewDistanceHi(-1, 'AFT')).toBe(0);
  });

  it('Zylons are grey: $0E near down to $04 far', () => {
    expect(shapeColor(SHAPE.FIGHTER, 0)).toBe(0x0e);
    expect(shapeColor(SHAPE.FIGHTER, 15)).toBe(0x04);
    expect(shapeColor(SHAPE.PHOTON, 0) & 0xf0).toBe(0x50); // purple
    expect(shapeColor(SHAPE.METEOR, 0) & 0xf0).toBe(0xa0); // green
  });

  it('the basestar flickers: its colour changes from frame to frame', () => {
    const rng = createRng(3);
    const colors = new Set(
      Array.from({ length: 8 }, () => objectSprites({ kind: 'basestar', x: 0, y: 0, z: 2000 }, 'FRONT', 0, rng)[0].color)
    );
    expect(colors.size).toBeGreaterThan(4);
    const fighter = new Set(
      Array.from({ length: 8 }, () => objectSprites({ kind: 'fighter', x: 0, y: 0, z: 2000 }, 'FRONT', 0, rng)[0].color)
    );
    expect([...fighter]).toEqual([0x0a]); // range 7: $0A, steady
  });

  it('the starbase is a centre and two wings', () => {
    const parts = objectSprites({ kind: 'starbase', x: 0, y: 0, z: 1000 }, 'FRONT', 0, createRng(1));
    expect(parts.map((p) => p.type)).toEqual([SHAPE.STARBASE_CENTER, SHAPE.STARBASE_LEFT, SHAPE.STARBASE_RIGHT]);
    expect(parts[1].col).toBe(parts[0].col - 8);
    expect(parts[2].col).toBe(parts[0].col + 8);
  });
});

describe('collision (Player/Missile overlap)', () => {
  it('needs a lit pixel in common', () => {
    const a = placeSprite(SHAPE.FIGHTER, 0, 0, 500, 'FRONT')!;
    expect(spritesOverlap(a, { ...a })).toBe(true);
    expect(spritesOverlap(a, { ...a, col: a.col + 8 })).toBe(false);
    // The H is hollow: a 1-pixel dot inside the top gap does not touch it.
    expect(spritesOverlap(a, { ...a, col: a.col + 3, rows: [0x80], line: a.line })).toBe(false);
  });
});
