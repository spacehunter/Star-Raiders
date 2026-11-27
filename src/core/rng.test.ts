import { describe, expect, it } from 'vitest';
import { createRng, getSeed, random, setSeed } from './rng';
import { SectorSystem } from '../systems/SectorSystem';
import { DifficultyLevel } from '../game/GameState';

const draw = (fn: () => number, n: number) => Array.from({ length: n }, fn);

describe('seeded RNG', () => {
  it('gives the same sequence for the same seed', () => {
    expect(draw(createRng(1979), 1000)).toEqual(draw(createRng(1979), 1000));
  });

  it('gives different sequences for different seeds', () => {
    expect(draw(createRng(1), 20)).not.toEqual(draw(createRng(2), 20));
  });

  it('returns floats in [0, 1)', () => {
    for (const v of draw(createRng(42), 10000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('matches known mulberry32 output so the stream never drifts', () => {
    const v = draw(createRng(1), 3).map((x) => Math.floor(x * 4294967296));
    expect(v).toEqual([2693262067, 11749833, 2265367787]);
  });

  it('setSeed resets the shared generator', () => {
    setSeed(800);
    expect(getSeed()).toBe(800);
    const a = draw(random, 50);
    setSeed(800);
    expect(draw(random, 50)).toEqual(a);
  });
});

describe('galaxy generation', () => {
  const layout = (seed: number) => {
    setSeed(seed);
    const s = new SectorSystem();
    s.generateGalaxy(DifficultyLevel.COMMANDER);
    const cells: string[] = [];
    for (let y = 0; y < SectorSystem.GRID_HEIGHT; y++) {
      for (let x = 0; x < SectorSystem.GRID_WIDTH; x++) {
        const c = s.getSector(x, y)!;
        cells.push(`${c.enemies}${c.hasStarbase ? 'S' : ''}`);
      }
    }
    return cells.join(',');
  };

  it('is identical for the same seed', () => {
    expect(layout(12345)).toEqual(layout(12345));
  });

  it('differs between seeds', () => {
    expect(layout(1)).not.toEqual(layout(2));
  });
});
