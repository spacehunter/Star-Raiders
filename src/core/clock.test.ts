import { describe, expect, it } from 'vitest';
import { LOOP_HZ, LOOP_SECONDS, SimClock, formatStarDate } from './clock';

describe('SimClock', () => {
  it('runs at 60 loops per second', () => {
    expect(LOOP_HZ).toBe(60);
    const c = new SimClock();
    expect(c.advance(1)).toBe(60);
    expect(c.loops).toBe(60);
    expect(c.ticks).toBe(60);
  });

  it('n steps of 1/60 s are exactly n loops', () => {
    const c = new SimClock();
    let n = 0;
    for (let i = 0; i < 10000; i++) n += c.advance(LOOP_SECONDS);
    expect(n).toBe(10000);
  });

  it('carries partial loops between frames', () => {
    const c = new SimClock();
    expect(c.advance(0.01)).toBe(0); // 0.6 loop
    expect(c.advance(0.01)).toBe(1); // 1.2 loops
    expect(c.advance(1 / 30)).toBe(2);
    expect(c.loops).toBe(3);
  });

  it('star date advances one digit every 41 loops', () => {
    const c = new SimClock();
    for (let i = 0; i < 40; i++) expect(c.step().starDateTick).toBe(false);
    expect(c.step().starDateTick).toBe(true);
    expect(c.starDate).toBe('00.01');
    c.advance(41 * 99 * LOOP_SECONDS);
    expect(c.starDateTicks).toBe(100);
    expect(c.starDate).toBe('01.00');
    expect(c.starDateValue).toBe(1);
  });

  it('fleet move ticks at star date 1.00, then every 0.50', () => {
    const c = new SimClock();
    const at: number[] = [];
    c.advance(41 * 300 * LOOP_SECONDS, (e) => {
      if (e.fleetMoveTick) at.push(c.starDateTicks);
    });
    expect(at).toEqual([100, 150, 200, 250, 300]);
    expect(c.fleetMoveTicks).toBe(5);
  });

  it('formats NN.NN and wraps after 99.99', () => {
    expect(formatStarDate(0)).toBe('00.00');
    expect(formatStarDate(4500)).toBe('45.00');
    expect(formatStarDate(9999)).toBe('99.99');
    expect(formatStarDate(10000)).toBe('00.00');
  });
});
