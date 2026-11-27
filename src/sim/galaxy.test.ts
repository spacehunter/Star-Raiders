import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { SimClock } from '../core/clock';
import { LEVELS, type MissionLevel } from '../rules/levels';
import {
  Galaxy,
  GALAXY_COLUMNS,
  GALAXY_ROWS,
  MOVE_CHANCE_256,
  RadioFeed,
  START_SECTOR,
  SURROUND_DESTROY_TICKS,
  type GalaxyEvent,
  type SectorPos,
} from './galaxy';

const make = (level: MissionLevel, seed = 1979) => new Galaxy(level, createRng(seed));

/** Run the real clock and call moveTick on every fleet move tick, like Game.simLoop. */
function runTicks(g: Galaxy, player: SectorPos, moveTicks: number, clock = new SimClock()) {
  const events: Array<GalaxyEvent & { tick: number }> = [];
  const target = clock.fleetMoveTicks + moveTicks;
  while (clock.fleetMoveTicks < target) {
    const e = clock.step();
    if (e.fleetMoveTick) {
      for (const ev of g.moveTick(player, clock.starDateTicks)) events.push({ ...ev, tick: clock.starDateTicks });
    }
  }
  return { events, clock };
}

describe('galaxy set-up (§15, §17.4)', () => {
  const expected: Record<MissionLevel, { zylons: number; bases: number; groups: number }> = {
    NOVICE: { zylons: 27, bases: 3, groups: 3 },
    PILOT: { zylons: 36, bases: 4, groups: 4 },
    WARRIOR: { zylons: 45, bases: 5, groups: 5 },
    COMMANDER: { zylons: 54, bases: 6, groups: 6 },
  };

  for (const level of LEVELS) {
    it(`${level}: ${expected[level].zylons} Zylons in level+3 groups of 2, 3 and 4, ${expected[level].bases} starbases`, () => {
      for (let seed = 1; seed <= 50; seed++) {
        const g = make(level, seed);
        const s = g.sectors();
        expect(g.zylonsLeft).toBe(expected[level].zylons);
        expect(g.starbasesLeft).toBe(expected[level].bases);
        for (const size of [2, 3, 4]) {
          expect(s.filter((c) => c.zylons === size).length).toBe(expected[level].groups);
        }
        expect(s.filter((c) => c.zylons === 1).length).toBe(0);
      }
    });
  }

  it('starbases never start on the border, next to Zylons or another starbase; the start sector is empty', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 200; seed++) {
        const g = make(level, seed);
        expect(g.sector(START_SECTOR.x, START_SECTOR.y)).toMatchObject({ zylons: 0, starbase: false });
        for (const c of g.sectors().filter((c) => c.starbase)) {
          expect(c.x).toBeGreaterThan(0);
          expect(c.x).toBeLessThan(GALAXY_COLUMNS - 1);
          expect(c.y).toBeGreaterThan(0);
          expect(c.y).toBeLessThan(GALAXY_ROWS - 1);
          expect(c.zylons).toBe(0);
          for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            expect(g.zylonsAt(c.x + dx, c.y + dy)).toBe(0);
            expect(g.hasStarbase(c.x + dx, c.y + dy)).toBe(false);
          }
        }
      }
    }
  });

  it('is identical for the same seed and differs between seeds', () => {
    const layout = (seed: number) => JSON.stringify(make('COMMANDER', seed).sectors());
    expect(layout(12345)).toEqual(layout(12345));
    expect(layout(1)).not.toEqual(layout(2));
  });
});

describe('fleet movement (§8.1, §17.4)', () => {
  it('moves on star date 1.00 and then every 0.50, one sector at a time, never changing totals', () => {
    const g = make('WARRIOR');
    const clock = new SimClock();
    const ticksAtMove: number[] = [];
    let before = g.sectors();
    while (ticksAtMove.length < 6) {
      const e = clock.step();
      if (!e.fleetMoveTick) continue;
      ticksAtMove.push(clock.starDateTicks);
      g.moveTick(START_SECTOR, clock.starDateTicks);
      const after = g.sectors();
      // Every group that left a sector appears in an orthogonal neighbour.
      for (const c of before.filter((c) => c.zylons > 0 && after[c.y * 16 + c.x].zylons === 0)) {
        const landed = after.filter(
          (d) => d.zylons === c.zylons && Math.abs(d.x - c.x) + Math.abs(d.y - c.y) === 1 && before[d.y * 16 + d.x].zylons === 0
        );
        expect(landed.length).toBeGreaterThan(0);
      }
      expect(g.zylonsLeft).toBe(45);
      before = after;
    }
    expect(ticksAtMove).toEqual([100, 150, 200, 250, 300, 350]);
  });

  it('moves 1–2 ship groups 255/256, 3 ship groups 192/256 and 4 ship groups 32/256 of ticks', () => {
    expect(MOVE_CHANCE_256).toEqual({ 1: 255, 2: 255, 3: 192, 4: 32 });
    // Measure: a lone group far from a starbase, with nothing in its way.
    for (const [ships, chance] of [[2, 255], [3, 192], [4, 32]] as const) {
      let moved = 0;
      const trials = 4000;
      for (let i = 0; i < trials; i++) {
        const g = make('NOVICE', i + 7);
        const grid = g as unknown as { zylons: number[]; starbases: boolean[] };
        grid.zylons.fill(0);
        grid.starbases.fill(false);
        grid.starbases[4 * 16 + 14] = true;
        grid.zylons[4 * 16 + 2] = ships;
        g.moveTick({ x: 0, y: 0 }, 100);
        if (grid.zylons[4 * 16 + 2] === 0) moved++;
      }
      expect(moved / trials).toBeCloseTo(chance / 256, 1);
    }
  });

  it('closes on one hunted starbase at a time and never enters an occupied sector', () => {
    const g = make('COMMANDER', 42);
    const { clock } = runTicks(g, START_SECTOR, 1);
    const hunted = g.hunted!;
    expect(g.hasStarbase(hunted.x, hunted.y)).toBe(true);
    const dist = () =>
      g
        .sectors()
        .filter((c) => c.zylons > 0)
        .reduce((a, c) => a + Math.abs(c.x - hunted.x) + Math.abs(c.y - hunted.y), 0);
    const d0 = dist();
    runTicks(g, START_SECTOR, 6, clock);
    if (g.hunted && g.hunted.x === hunted.x && g.hunted.y === hunted.y) expect(dist()).toBeLessThan(d0);
    for (const c of g.sectors()) {
      expect(c.zylons).toBeLessThanOrEqual(4);
      if (c.starbase) expect(c.zylons).toBe(0);
    }
  });

  it('never moves a fleet into the player sector, and the group in it holds (500 seeds × 40 ticks)', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const level = LEVELS[seed % 4];
      const g = make(level, seed);
      const rng = createRng(seed * 31);
      // Put the player somewhere, possibly next to a starbase or inside a Zylon sector.
      const player = { x: Math.floor(rng() * 16), y: Math.floor(rng() * 8) };
      if (g.hasStarbase(player.x, player.y)) continue;
      const held = g.zylonsAt(player.x, player.y);
      const clock = new SimClock();
      for (let t = 0; t < 40; t++) {
        const r = runTicks(g, player, 1, clock);
        // A starbase destroyed in the player's own sector is the only way it can change.
        const debrisHere = r.events.some((e) => e.type === 'starbaseDestroyed' && e.x === player.x && e.y === player.y);
        expect(debrisHere).toBe(false);
        expect(g.zylonsAt(player.x, player.y)).toBe(held);
      }
    }
  });
});

describe('starbase surround (§8.2, §17.4)', () => {
  /** A hand-made galaxy: one starbase at (5,3) and four groups closing on it. */
  function surroundSetup() {
    const g = make('PILOT', 3);
    const grid = g as unknown as { zylons: number[]; starbases: boolean[] };
    grid.zylons.fill(0);
    grid.starbases.fill(false);
    grid.starbases[3 * 16 + 5] = true;
    grid.zylons[2 * 16 + 5] = 2; // N, already adjacent
    grid.zylons[3 * 16 + 6] = 3; // E, already adjacent
    grid.zylons[4 * 16 + 5] = 2; // S, already adjacent
    grid.zylons[3 * 16 + 3] = 2; // two west: moves into W (255/256)
    grid.zylons[0 * 16 + 15] = 4; // far away
    return g;
  }

  it('STARBASE SURROUNDED, then STARBASE DESTROYED exactly 1.00 star date later, leaving 2 Zylons', () => {
    const g = surroundSetup();
    const total = g.zylonsLeft;
    const { events } = runTicks(g, START_SECTOR, 6);
    const sur = events.filter((e) => e.type === 'starbaseSurrounded');
    const des = events.filter((e) => e.type === 'starbaseDestroyed');
    expect(sur.length).toBe(1);
    expect(des.length).toBe(1);
    expect(sur[0]).toMatchObject({ x: 5, y: 3 });
    expect(des[0]).toMatchObject({ x: 5, y: 3 });
    expect(des[0].tick - sur[0].tick).toBe(SURROUND_DESTROY_TICKS);
    // The destroyed starbase is now a 2-Zylon sector.
    expect(g.hasStarbase(5, 3)).toBe(false);
    expect(g.zylonsAt(5, 3)).toBe(2);
    expect(g.zylonsLeft).toBe(total + 2);
    expect(g.starbasesLost).toBe(1);
  });

  it('is still standing 0.50 after the surround', () => {
    const g = surroundSetup();
    const clock = new SimClock();
    const first = runTicks(g, START_SECTOR, 1, clock).events; // W fills on tick 100 (255/256)
    expect(first.map((e) => e.type)).toEqual(['starbaseSurrounded']);
    const second = runTicks(g, START_SECTOR, 1, clock).events; // 150
    expect(second).toEqual([]);
    expect(g.hasStarbase(5, 3)).toBe(true);
    const third = runTicks(g, START_SECTOR, 1, clock).events; // 200
    expect(third.map((e) => e.type)).toContain('starbaseDestroyed');
  });

  it('clearing a neighbour within the 1.00 saves the starbase', () => {
    const g = surroundSetup();
    const clock = new SimClock();
    runTicks(g, START_SECTOR, 1, clock);
    expect(g.surround).not.toBeNull();
    // The player warps into the north group and destroys both ships.
    const player = { x: 5, y: 2 };
    g.destroyZylon(5, 2);
    g.destroyZylon(5, 2);
    const later = runTicks(g, player, 4, clock).events;
    expect(later.some((e) => e.type === 'starbaseDestroyed')).toBe(false);
    expect(g.hasStarbase(5, 3)).toBe(true);
  });

  it('the player sitting in a neighbour sector blocks the surround', () => {
    const g = surroundSetup();
    const { events } = runTicks(g, { x: 4, y: 3 }, 8);
    expect(events.some((e) => e.type === 'starbaseSurrounded')).toBe(false);
  });
});

describe('one source for counts and victory (§1 mission end, §17.10)', () => {
  it('destroying every Zylon ends the mission, even with fleets moving and starbases falling', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 20; seed++) {
        const g = make(level, seed);
        const start = g.zylonsLeft;
        const clock = new SimClock();
        let player: SectorPos = { ...START_SECTOR };
        let kills = 0;
        let victory = 0;
        let guard = 0;
        while (g.zylonsLeft > 0 && guard++ < 1000) {
          // Fleets move a few times while the player flies to the next Zylon sector.
          for (const e of runTicks(g, player, 3, clock).events) expect(e.type).not.toBe('allZylonsDestroyed');
          const next = g.sectors().find((c) => c.zylons > 0)!;
          player = { x: next.x, y: next.y };
          // On arrival the game spawns exactly this many ships; destroy each one.
          const ships = g.zylonsAt(player.x, player.y);
          for (let i = 0; i < ships; i++) {
            const ev = g.destroyZylon(player.x, player.y);
            kills++;
            if (ev.some((e) => e.type === 'allZylonsDestroyed')) victory++;
          }
          expect(g.zylonsAt(player.x, player.y)).toBe(0);
        }
        expect(g.zylonsLeft).toBe(0);
        expect(victory).toBe(1);
        expect(kills).toBe(start + 2 * g.starbasesLost);
      }
    }
  });

  it('a kill in an empty sector changes nothing', () => {
    const g = make('NOVICE');
    const before = g.zylonsLeft;
    expect(g.destroyZylon(START_SECTOR.x, START_SECTOR.y)).toEqual([]);
    expect(g.zylonsLeft).toBe(before);
  });
});

describe('Sub-Space Radio and the chart (§7, §17.3)', () => {
  it('damaged freezes the chart but TARGETS stays live; destroyed freezes both and mutes messages', () => {
    const g = make('PILOT', 5);
    const feed = new RadioFeed(g);
    feed.sync('ok');
    const before = JSON.stringify(feed.sectors());
    feed.sync('damaged');
    const clock = new SimClock();
    runTicks(g, START_SECTOR, 4, clock);
    expect(JSON.stringify(g.sectors())).not.toEqual(before); // fleets really moved
    expect(JSON.stringify(feed.sectors())).toEqual(before); // chart did not
    const c = g.sectors().find((s) => s.zylons > 0)!;
    expect(feed.targets(c.x, c.y)).toBe(c.zylons);
    expect(feed.relaysMessages).toBe(true);

    feed.sync('destroyed');
    const frozenTargets = feed.targets(c.x, c.y);
    g.destroyZylon(c.x, c.y);
    expect(feed.targets(c.x, c.y)).toBe(frozenTargets);
    expect(feed.relaysMessages).toBe(false);

    feed.sync('ok'); // repaired at a starbase
    expect(JSON.stringify(feed.sectors())).toEqual(JSON.stringify(g.sectors()));
  });
});
