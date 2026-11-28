import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { calcWarp, VEER_MASK_TAB, veerMask, veerVelocity } from '../rules/warp';
import type { MissionLevel } from '../rules/levels';
import { EnergySim } from './energy';
import {
  CHART_START,
  chartSector,
  Hyperwarp,
  HYPERSPACE_VELOCITY,
  MARKER_CENTER_COL,
  markerPm,
  steeredArrival,
  TRAIL_VELOCITY,
  vicinityIndex,
  WARP_NEW_VELOCITY,
  type WarpEvent,
} from './hyperwarp';
import { approachVelocity, type Stick } from './motion';
import { VICINITY_MASK_TABLE } from './zylons';
import { Starfield, TRAIL_SLOTS } from '../render/starfield';

type Pilot = (w: Hyperwarp) => Stick;

/** Hold the stick still. */
const HANDS_OFF: Pilot = () => ({ x: 0, y: 0 });

/**
 * A scripted pilot: keep the marker's PM column on `col` and its row between the two rows a
 * centred marker can take (118/120). Stick left moves the marker right, stick back moves it down.
 */
function holdAt(col: number): Pilot {
  return (w) => {
    const m = w.marker;
    const x = m.col < col ? -1 : m.col > col ? 1 : 0;
    const y = m.row < 118 ? 1 : m.row > 120 ? -1 : 0;
    return { x, y } as Stick;
  };
}

interface RunResult {
  events: WarpEvent[];
  loops: number;
  energy: number;
  complete: Extract<WarpEvent, { type: 'complete' }> | null;
  hyperspaceEnergy: number;
  w: Hyperwarp;
}

/**
 * Fly a jump the way Game does: velocity steps 1 per loop toward 255 (then 0), the marker is
 * turned by the pilot's stick, hyperspace loops charge 10 energy each.
 */
function fly(opts: {
  level: MissionLevel;
  from: [number, number];
  to: [number, number];
  seed: number;
  pilot?: Pilot;
  front?: (loop: number) => boolean;
  abortAt?: (w: Hyperwarp, loop: number) => boolean;
}): RunResult {
  const rng = createRng(opts.seed);
  const byte = () => Math.floor(rng() * 256);
  const w = new Hyperwarp();
  w.setDepartureSector(...opts.from);
  w.setArrivalSector(...opts.to);
  const host = { energy: 9999 };
  const energy = new EnergySim(host);
  expect(w.engage(opts.level)).toBe(true);
  let v = 12; // speed key 6
  const events: WarpEvent[] = [];
  let complete: RunResult['complete'] = null;
  let hyperspaceEnergy = 0;
  let loops = 0;
  for (; loops < 2000 && !complete; loops++) {
    if (opts.abortAt?.(w, loops)) {
      w.abort();
      energy.abortHyperwarp();
      break;
    }
    v = approachVelocity(v, w.engaged ? WARP_NEW_VELOCITY : 0);
    const turn = (opts.pilot ?? HANDS_OFF)(w);
    for (const e of w.loop({ velocity: v, front: opts.front?.(loops) ?? true, level: opts.level, turn, randomByte: byte })) {
      events.push(e);
      if (e.type === 'charge') energy.hyperspaceLoop();
      if (e.type === 'hyperspace') hyperspaceEnergy = e.warpEnergy;
      if (e.type === 'complete') complete = e;
    }
  }
  return { events, loops, energy: host.energy, complete, hyperspaceEnergy, w };
}

const SEEDS = Array.from({ length: 40 }, (_, i) => 1979 + i);

describe('§17.5 rules: VEERMASK and the marker', () => {
  it('VEERMASK follows WARPENERGY bits 7..6, not the mission level (code ≠ comment)', () => {
    expect(veerMask(true, 10)).toBe(0x9f); // 100 units
    expect(veerMask(true, 63)).toBe(0x9f); // 630
    expect(veerMask(true, 64)).toBe(0xbf); // 640
    expect(veerMask(true, 128)).toBe(0xdf); // 1280
    expect(veerMask(true, 192)).toBe(0xff); // 1920
    expect(veerMask(true, 253)).toBe(0xff);
    expect(VEER_MASK_TAB).toEqual([0x9f, 0xbf, 0xdf, 0xff]);
  });

  it('NOVICE has no veer at all', () => {
    for (const e of [10, 64, 128, 253]) expect(veerMask(false, e)).toBe(0);
    for (let b = 0; b < 256; b++) expect(veerVelocity(b, 0)).toBe(0);
  });

  it('kicks are ±16..31 below 640 energy up to ±16..127 at 1920 or more', () => {
    const range = (mask: number) => {
      const mags = Array.from({ length: 256 }, (_, b) => Math.abs(veerVelocity(b, mask)));
      return [Math.min(...mags), Math.max(...mags)];
    };
    expect(range(0x9f)).toEqual([16, 31]);
    expect(range(0xbf)).toEqual([16, 63]);
    expect(range(0xdf)).toEqual([16, 95]);
    expect(range(0xff)).toEqual([16, 127]);
    expect(veerVelocity(0x85, 0xff)).toBe(-21); // bit 7 is the sign
  });

  it('the marker starts centred: PM column 125, row 118 (x 0, y +256 KM, z $1F00)', () => {
    expect(markerPm({ x: 0, y: 256, z: 0x1f00 }, { col: 0, row: 0 })).toEqual({ col: 125, row: 118 });
  });
});

describe('§17.5 landing offset', () => {
  const chosen = { col: 8 * 5 + 3, row: 16 * 3 + 7 }; // sector (5, 3)

  it('a centred marker lands in the chosen sector', () => {
    expect(chartSector(steeredArrival(chosen, 125, 118))).toEqual({ x: 5, y: 3 });
    expect(chartSector(steeredArrival(chosen, 125, 120))).toEqual({ x: 5, y: 3 });
  });

  it('8 PM columns off-centre is one sector sideways', () => {
    expect(chartSector(steeredArrival(chosen, 125 + 8, 118))).toEqual({ x: 6, y: 3 });
    expect(chartSector(steeredArrival(chosen, 125 - 8, 118))).toEqual({ x: 4, y: 3 });
    expect(chartSector(steeredArrival(chosen, 125 + 16, 118))).toEqual({ x: 7, y: 3 });
  });

  it('16 PM rows off-centre is one sector up or down', () => {
    expect(chartSector(steeredArrival(chosen, 125, 119 + 16))).toEqual({ x: 5, y: 4 });
    expect(chartSector(steeredArrival(chosen, 125, 119 - 16))).toEqual({ x: 5, y: 2 });
  });

  it('the chart wraps at 128 PM pixels (& $7F)', () => {
    expect(steeredArrival({ col: 125, row: 0 }, 133, 119)).toEqual({ col: 5, row: 0 });
  });

  it('landing nearer the vertical middle picks a tighter vicinity mask', () => {
    expect(vicinityIndex(CHART_START.row)).toBe(3);
    expect(VICINITY_MASK_TABLE[vicinityIndex(16 * 2 + 7)]).toBe(0x0f); // middle: within 4095 KM
    expect(VICINITY_MASK_TABLE[vicinityIndex(16 * 2 + 0)]).toBe(0xff); // top edge: anywhere
  });
});

describe('§9 acceptance: scripted PILOT jumps', () => {
  it('held centred, a PILOT warp lands in the target sector (40 seeds, 3 jumps)', () => {
    const jumps: Array<[[number, number], [number, number]]> = [
      [[8, 4], [11, 4]],
      [[2, 1], [9, 6]],
      [[15, 7], [10, 2]],
    ];
    for (const [from, to] of jumps) {
      for (const seed of SEEDS) {
        const r = fly({ level: 'PILOT', from, to, seed, pilot: holdAt(MARKER_CENTER_COL) });
        expect(r.complete?.sector, `seed ${seed} ${from}→${to}`).toEqual({ x: to[0], y: to[1] });
      }
    }
  });

  it('pushed to the right cross hair, it lands one sector to the right (M §IX tactic)', () => {
    for (const seed of SEEDS) {
      // H without opening the chart: the dot is on our own sector.
      const r = fly({ level: 'PILOT', from: [6, 3], to: [6, 3], seed, pilot: holdAt(MARKER_CENTER_COL + 8) });
      expect(r.complete?.sector, `seed ${seed}`).toEqual({ x: 7, y: 3 });
    }
  });

  it('left alone, a PILOT marker drifts: some jumps miss their sector', () => {
    let missed = 0;
    for (const seed of SEEDS) {
      const r = fly({ level: 'PILOT', from: [0, 0], to: [12, 6], seed });
      if (r.complete!.sector.x !== 12 || r.complete!.sector.y !== 6) missed++;
    }
    expect(missed).toBeGreaterThan(0);
  });

  it('NOVICE: no drift, the marker never moves and every jump lands on target', () => {
    for (const seed of SEEDS) {
      const r = fly({
        level: 'NOVICE',
        from: [0, 0],
        to: [15, 7],
        seed,
        // Even leaving the front view does not randomise a NOVICE landing.
        front: (loop) => loop % 50 > 10,
        abortAt: (w) => {
          if (w.phase === 'accel') {
            expect(w.marker.vx).toBe(0);
            expect(w.marker.vy).toBe(0);
            expect([w.marker.col, w.marker.row]).toEqual([125, 118]);
          }
          return false;
        },
      });
      expect(r.w.veerMask).toBe(0);
      expect(r.complete?.sector).toEqual({ x: 15, y: 7 });
    }
  });

  it('leaving the front view (not NOVICE) randomises the landing', () => {
    const sectors = new Set<string>();
    for (const seed of SEEDS) {
      const r = fly({ level: 'PILOT', from: [8, 4], to: [9, 4], seed, pilot: holdAt(MARKER_CENTER_COL), front: () => false });
      sectors.add(`${r.complete!.sector.x},${r.complete!.sector.y}`);
    }
    expect(sectors.size).toBeGreaterThan(10);
  });
});

describe('§17.5 phases and costs', () => {
  it('trails from velocity 128, every 4 loops, with VELOCITYHI; hyperspace at 254', () => {
    const w = new Hyperwarp();
    w.engage('PILOT');
    const byte = () => 200;
    const trailsAt: number[] = [];
    let v = 120;
    let loop = 0;
    for (; v < HYPERSPACE_VELOCITY; loop++) {
      v++;
      const ev = w.loop({ velocity: v, front: true, level: 'PILOT', turn: { x: 0, y: 0 }, randomByte: byte });
      if (ev.some((e) => e.type === 'trail')) trailsAt.push(v);
      if (v >= TRAIL_VELOCITY && v < HYPERSPACE_VELOCITY) {
        expect(w.velocityBoost).toBe(256);
        expect(w.markerShown).toBe(true);
      }
    }
    expect(trailsAt[0]).toBe(128);
    expect(trailsAt.slice(0, 4)).toEqual([128, 132, 136, 140]);
    expect(w.phase).toBe('hyperspace');
    expect(w.markerShown).toBe(false);
    expect(w.velocityBoost).toBe(0);
  });

  it('the cost is charged per hyperspace loop: WARPENERGY − 1 loops of −10', () => {
    for (const [to, units] of [
      [[9, 4], 130],
      [[13, 4], 500],
      [[8, 4], 100],
    ] as const) {
      const r = fly({ level: 'NOVICE', from: [8, 4], to: [to[0], to[1]], seed: 1 });
      expect(r.hyperspaceEnergy * 10).toBe(units);
      const charges = r.events.filter((e) => e.type === 'charge').length;
      expect(charges).toBe(r.hyperspaceEnergy - 1);
      // Life support and the key-7 engine drain run in Game; here only the hyperspace loops.
      expect(9999 - r.energy).toBe(10 * (r.hyperspaceEnergy - 1));
    }
  });

  it('CALCWARP is redone on the steered arrival point when hyperspace starts', () => {
    const r = fly({ level: 'PILOT', from: [6, 3], to: [6, 3], seed: 5, pilot: holdAt(MARKER_CENTER_COL + 8) });
    const dep = { col: 6 * 8 + 3, row: 3 * 16 + 7 };
    expect(r.hyperspaceEnergy).toBe(calcWarp(dep.col, dep.row, r.complete!.arrival.col, r.complete!.arrival.row).warpEnergy);
    expect(r.hyperspaceEnergy).toBeGreaterThan(10);
  });

  it('abort (0–9) costs 100 in any phase and leaves us where we were', () => {
    for (const phase of ['accel', 'hyperspace'] as const) {
      const r = fly({
        level: 'PILOT',
        from: [3, 3],
        to: [12, 3],
        seed: 9,
        abortAt: (w) => w.phase === phase && (phase === 'accel' || w.charges >= 5),
      });
      expect(r.complete).toBeNull();
      expect(r.w.phase).toBe('off');
      expect(chartSector(r.w.departure)).toEqual({ x: 3, y: 3 });
      const charged = r.events.filter((e) => e.type === 'charge').length;
      expect(9999 - r.energy).toBe(100 + 10 * charged);
    }
    expect(new Hyperwarp().abort()).toBe(false); // nothing to abort
  });

  it('after arrival the departure is the arrival point and H can engage again', () => {
    const r = fly({ level: 'NOVICE', from: [1, 1], to: [4, 2], seed: 3 });
    expect(r.w.departure).toEqual(r.complete!.arrival);
    expect(r.w.engage('NOVICE')).toBe(true);
    expect(r.w.engage('NOVICE')).toBe(false); // ignored while engaged
  });
});

describe('§17.5 star trails (R: INITTRAIL)', () => {
  it('6 stars on one line of sight, 80 KM apart from +4688 KM, in 32 reused slots', () => {
    const f = new Starfield(createRng(7), 12, 'FRONT');
    f.addTrail();
    expect(f.trails).toHaveLength(6);
    const [a] = f.trails;
    for (const s of f.trails) {
      expect([s.x, s.y]).toEqual([a.x, a.y]);
    }
    expect(f.trails.map((s) => s.z)).toEqual([4688, 4768, 4848, 4928, 5008, 5088]);
    expect(Math.abs(a.x) >> 8).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < 10; i++) f.addTrail();
    expect(f.trails).toHaveLength(TRAIL_SLOTS);
    expect(f.all).toHaveLength(12 + TRAIL_SLOTS);
    f.clearTrails();
    expect(f.all).toHaveLength(12);
  });
});
