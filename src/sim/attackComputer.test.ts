import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import {
  ATTACK_COMPUTER_BOX,
  ATTACK_COMPUTER_LINES,
  AttackComputer,
  BLIP_DELAY_START,
  LOCK_ON_LIFE,
  blipColumn,
  blipRow,
  lockLevel,
  trackingView,
} from './attackComputer';
import { HOMING_VELOCITY_TABLE, homingVelocity, ZylonSim, type ZylonEvent, type ZylonLoopInput } from './zylons';
import { attackComputerPixels, ATTACK_FRAME_PIXELS } from '../render/Renderer';

const input = (over: Partial<ZylonLoopInput> = {}): ZylonLoopInput => ({
  turn: { x: 0, y: 0 },
  velocity: 0,
  view: 'FRONT',
  level: 'NOVICE',
  sectorZylons: 0,
  starbaseSector: false,
  hyperwarp: false,
  count256: 1, // not a Zylon-steering loop: the placed ship flies straight
  computer: true,
  ...over,
});

/** A computer that has just finished a display cycle on `target`. */
function settled(target: { x: number; y: number; z: number }): AttackComputer {
  const a = new AttackComputer();
  for (let i = 0; i < 6; i++) a.loop(target);
  return a;
}

// MANUAL_SPEC §17.6 / R: DRAWLINESTAB — the display's frame.
describe('attack computer display geometry', () => {
  it('outer box spans cols 119–148 × rows 70–86, inner box cols 126–140 × rows 75–81', () => {
    const cols = [...ATTACK_FRAME_PIXELS].map((k) => Number(k.split(',')[0]));
    const rows = [...ATTACK_FRAME_PIXELS].map((k) => Number(k.split(',')[1]));
    expect([Math.min(...cols), Math.max(...cols), Math.min(...rows), Math.max(...rows)]).toEqual([
      ATTACK_COMPUTER_BOX.col0,
      ATTACK_COMPUTER_BOX.col1,
      ATTACK_COMPUTER_BOX.row0,
      ATTACK_COMPUTER_BOX.row1,
    ]);
    expect([119, 148, 70, 86]).toEqual([ATTACK_COMPUTER_BOX.col0, ATTACK_COMPUTER_BOX.col1, ATTACK_COMPUTER_BOX.row0, ATTACK_COMPUTER_BOX.row1]);
    // Inner box corners and the ticks to the outer box.
    for (const key of ['126,75', '140,75', '126,81', '140,81', '133,71', '133,85', '120,78', '147,78']) {
      expect(ATTACK_FRAME_PIXELS.has(key), key).toBe(true);
    }
    expect(ATTACK_FRAME_PIXELS.has('133,76')).toBe(false); // the inner box is open
    expect(ATTACK_COMPUTER_LINES).toHaveLength(12);
  });

  it('the blip is the 6 × 5 ROM shape, COLOR3 where it crosses a frame line', () => {
    const px = attackComputerPixels({ blipCol: 131, blipRow: 77, blipRows: 5, marks: 0 });
    const blip = px.filter(([, , reg]) => reg !== 1).map(([c, r]) => `${c},${r}`);
    const expected: string[] = [];
    ['#....#', '#.##.#', '######', '#.##.#', '#....#'].forEach((line, r) =>
      [...line].forEach((ch, c) => ch === '#' && expected.push(`${131 + c},${77 + r}`))
    );
    expect(blip.sort()).toEqual(expected.sort());
    // Centred, the blip's bottom row lies on the inner box's bottom line (row 81): COLOR3 there.
    expect(px.filter(([, , reg]) => reg === 3).map(([c, r]) => `${c},${r}`).sort()).toEqual(['131,81', '136,81']);
    // Pushed onto the right inner edge (col 140) it shows COLOR3 there.
    const edge = attackComputerPixels({ blipCol: 140, blipRow: 77, blipRows: 5, marks: 0 });
    expect(edge.some(([c, , reg]) => c === 140 && reg === 3)).toBe(true);
  });

  it('marker pairs: A upper bars, B lower bars, C two 2 × 2 blocks at the bottom', () => {
    const lit = (marks: 0 | 1 | 2 | 3) =>
      new Set(attackComputerPixels({ blipCol: 131, blipRow: 77, blipRows: 0, marks }).filter(([, , r]) => r === 2).map(([c, r]) => `${c},${r}`));
    expect([...lit(1)].sort()).toEqual(['120,76', '121,76', '122,76', '123,76', '144,76', '145,76', '146,76', '147,76'].sort());
    expect(lit(2).has('120,80') && lit(2).has('147,80')).toBe(true);
    expect(lit(2).size).toBe(16);
    for (const k of ['128,84', '129,84', '128,85', '129,85', '136,84', '137,84', '136,85', '137,85']) expect(lit(3).has(k), k).toBe(true);
    expect(lit(3).size).toBe(24);
  });
});

// R: UPDATTCOMP — the blip's place from the target's x and y high bytes.
describe('blip position', () => {
  it('maps x to columns 120..142 around 131 and y to rows 71..81 around 77', () => {
    expect(blipColumn(0)).toBe(131);
    expect(blipColumn(256)).toBe(132);
    expect(blipColumn(-1)).toBe(130);
    expect(blipColumn(11 * 256)).toBe(142);
    expect(blipColumn(40000)).toBe(142);
    expect(blipColumn(-11 * 256)).toBe(120);
    expect(blipColumn(-40000)).toBe(120);
    expect(blipRow(0)).toBe(76); // just above the axis
    expect(blipRow(-1)).toBe(77);
    expect(blipRow(40000)).toBe(71); // far above
    expect(blipRow(-40000)).toBe(81); // far below
  });
});

// MANUAL_SPEC §11, §17.6: the A/B/C lock windows.
describe('lock windows', () => {
  const level = (x: number, y: number, z: number) => lockLevel(blipColumn(x), blipRow(y), z);

  it('A: x within −512..+511 KM', () => {
    expect(level(511, 5000, 2000)).toBe(1);
    expect(level(-512, 5000, 2000)).toBe(1);
    expect(level(512, 0, 2000)).toBe(0);
    expect(level(-513, 0, 2000)).toBe(0);
  });

  it('B: A plus y within −512..+511 KM', () => {
    expect(level(0, 511, 5000)).toBe(2);
    expect(level(0, -512, 5000)).toBe(2);
    expect(level(0, 512, 2000)).toBe(1);
    expect(level(0, -513, 2000)).toBe(1);
    expect(level(5000, 0, 2000)).toBe(0); // y alone never lights B
  });

  it('C: A and B and in front, closer than 3072 KM', () => {
    expect(level(0, 0, 3071)).toBe(3);
    expect(level(0, 0, 0)).toBe(3);
    expect(level(0, 0, 3072)).toBe(2);
    expect(level(0, 0, -100)).toBe(2); // behind the ship: never in range
  });
});

describe('display cycle', () => {
  it('waits out the delay, recalculates on blip cycle 10, then draws one blip row per loop', () => {
    const a = new AttackComputer();
    expect(a.cycle).toBe(BLIP_DELAY_START);
    const t = { x: 0, y: -1, z: 2000 };
    for (let i = 0; i < 5; i++) a.loop(t); // cycles 5..9
    expect(a.marks).toBe(0);
    a.loop(t); // cycle 10
    expect(a.marks).toBe(3);
    expect(a.inLockOn).toBe(true);
    expect(a.blipRows).toBe(0);
    const rows: number[] = [];
    for (let i = 0; i < 5; i++) {
      a.loop(t);
      rows.push(a.blipRows);
    }
    expect(rows).toEqual([1, 2, 3, 4, 5]);
    for (let i = 0; i < 5; i++) a.loop(t);
    expect(a.blipRows).toBe(5);
    a.loop(t); // the next cycle 10: 11 loops later
    expect(a.blipRows).toBe(0);
  });

  it('the markers follow the target as it closes in: A, then B, then C', () => {
    const a = new AttackComputer();
    const seen: number[] = [];
    for (const t of [
      { x: 0, y: 2000, z: 6000 },
      { x: 0, y: 0, z: 5000 },
      { x: 0, y: 0, z: 2500 },
    ]) {
      for (let i = 0; i < 11; i++) a.loop(t);
      seen.push(a.marks);
    }
    expect(seen).toEqual([1, 2, 3]);
  });

  it('the blip vanishes when the target is gone', () => {
    const a = settled({ x: 0, y: 0, z: 1000 });
    for (let i = 0; i < 10; i++) a.loop({ x: 0, y: 0, z: 1000 });
    expect(a.blipRows).toBe(5);
    a.loop(null);
    expect([a.blipRows, a.marks, a.inLockOn]).toEqual([0, 0, false]);
  });

  it('firing without lock hides the markers for 12 display cycles; with lock they stay', () => {
    const off = { x: 0, y: 0, z: 6000 }; // A and B, no C
    const a = settled(off);
    expect(a.marks).toBe(2);
    a.triggered();
    expect(a.lockOnLife).toBe(LOCK_ON_LIFE);
    let hidden = 0;
    for (let cycle = 0; cycle < 20; cycle++) {
      for (let i = 0; i < 11; i++) a.loop(off);
      if (a.marks !== 0) break;
      hidden++;
    }
    expect(hidden).toBe(LOCK_ON_LIFE - 1);
    expect(a.marks).toBe(2);
    const locked = settled({ x: 0, y: 0, z: 2000 });
    locked.triggered();
    expect(locked.lockOnLife).toBe(0);
  });

  it('a view change or C/S/T press clears the display and drops the lock', () => {
    const a = settled({ x: 0, y: 0, z: 2000 });
    expect(a.inLockOn).toBe(true);
    a.reset();
    expect([a.marks, a.blipRows, a.inLockOn, a.cycle]).toEqual([0, 0, false, BLIP_DELAY_START]);
  });
});

// MANUAL_SPEC §5.8: M toggles between target 0 and 1.
describe('M: manual target selector', () => {
  it('switches T between 0 and 1, and from 2 or 3 back to 1 or 0', () => {
    const sim = new ZylonSim(createRng(1));
    expect(sim.trackDigit).toBe(0);
    sim.toggleTarget();
    expect(sim.trackDigit).toBe(1);
    sim.toggleTarget();
    expect(sim.trackDigit).toBe(0);
    sim.trackDigit = 2;
    sim.toggleTarget();
    expect(sim.trackDigit).toBe(1);
    sim.trackDigit = 3;
    sim.toggleTarget();
    expect(sim.trackDigit).toBe(0);
  });

  it('the selected ship is the one tracked while both are alive; T=2 is kept', () => {
    const sim = new ZylonSim(createRng(1));
    sim.spawn('fighter', { x: 0, y: 0, z: 6000 });
    sim.spawn('cruiser', { x: 1000, y: 0, z: 7000 });
    sim.toggleTarget();
    sim.loop(input());
    expect(sim.trackDigit).toBe(1);
    expect(sim.trackedShip()?.type).toBe('cruiser');
    sim.trackDigit = 2;
    sim.loop(input());
    expect(sim.trackDigit).toBe(2);
  });
});

// MANUAL_SPEC §5.10, §17.6: the tracking computer flips the view to keep the target in sight.
describe('tracking computer', () => {
  it('switches to the Aft view when the target is behind, and back when it is ahead', () => {
    expect(trackingView('FRONT', 500)).toBeNull();
    expect(trackingView('FRONT', -1)).toBe('AFT');
    expect(trackingView('AFT', -500)).toBeNull();
    expect(trackingView('AFT', 0)).toBe('FRONT');
  });

  it('follows a Zylon that flies past the ship', () => {
    const sim = new ZylonSim(createRng(1));
    sim.spawn('fighter', { x: 300, y: 300, z: 800 });
    sim.ships[0].vel.z = -62; // heads in at full speed
    let view: 'FRONT' | 'AFT' = 'FRONT';
    const flips: number[] = [];
    for (let loop = 0; loop < 40; loop++) {
      sim.loop(input({ view }));
      const t = sim.trackedShip();
      const next: 'FRONT' | 'AFT' | null = t ? trackingView(view, t.z) : null;
      if (next) {
        view = next;
        flips.push(loop);
      }
    }
    expect(view).toBe('AFT');
    expect(flips).toHaveLength(1);
  });
});

// R: HOMINGVEL / HOMVELTAB — locked torpedoes home in.
describe('homing photons', () => {
  it('HOMVELTAB velocities by PM pixel difference', () => {
    expect(HOMING_VELOCITY_TABLE).toEqual([0, 8, 16, 24, 40, 48, 56, 64]);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 30].map(homingVelocity)).toEqual([-0, -8, -16, -24, -40, -48, -56, -64, -64]);
    expect([-1, -2, -3, -4, -7, -8, -30].map(homingVelocity)).toEqual([0, 8, 16, 24, 56, 64, 64]);
  });

  /** A fighter in full lock (x 400, y 300, z 2500 KM: A, B and C) but off both barrels' straight paths. */
  function salvo(lockedOn: boolean): { events: ZylonEvent[]; sim: ZylonSim } {
    const target = { x: 400, y: 300, z: 2500 };
    expect(lockLevel(blipColumn(target.x), blipRow(target.y), target.z)).toBe(3);
    const sim = new ZylonSim(createRng(7));
    sim.spawn('fighter', target);
    sim.ships[0].velIndex = { x: 7, y: 7, z: 7 }; // hold still
    sim.ships[0].milestone = { x: 7, y: 7, z: 7 };
    expect(sim.fire('FRONT', 'ok', false, lockedOn)).toBe('launched');
    const events: ZylonEvent[] = [];
    for (let i = 0; i < 60 && sim.ships[0].alive; i++) events.push(...sim.loop(input({ count256: i })));
    return { events, sim };
  }

  it('a locked salvo steers into the target and kills it; the same shot unlocked misses', () => {
    const locked = salvo(true);
    expect(locked.events.some((e) => e.type === 'zylonDestroyed')).toBe(true);
    const unlocked = salvo(false);
    expect(unlocked.events.some((e) => e.type === 'zylonDestroyed')).toBe(false);
    expect(unlocked.sim.photons.every((p) => p.vel.x === 0 && p.vel.y === 0)).toBe(true);
  });

  it('steers right toward a target on the right, upward only', () => {
    const sim = new ZylonSim(createRng(7));
    sim.spawn('fighter', { x: 900, y: -2500, z: 3000 }); // drawn right of and below photon 0
    sim.fire('FRONT', 'ok', false, true);
    for (let i = 0; i < 4; i++) sim.loop(input()); // drawn once 2+ loops out of the barrel
    expect(sim.photons[0].vel.x).toBeGreaterThan(0);
    expect(sim.photons[0].vel.y).toBe(0); // target below photon 0: no downward homing in the ROM
  });

  it('the kill clears homing; an unlocked press turns it off', () => {
    const { sim } = salvo(true);
    expect(sim.homing).toBe(false);
    const s2 = new ZylonSim(createRng(1));
    s2.fire('FRONT', 'ok', false, true);
    expect(s2.homing).toBe(true);
    for (let i = 0; i < 30; i++) s2.loop(input());
    s2.fire('FRONT', 'ok', false, false);
    expect(s2.homing).toBe(false);
  });
});

// MANUAL_SPEC §17.6: with full lock the second torpedo fires automatically.
describe('automatic second torpedo', () => {
  it('a locked press launches the other barrel on the next loop', () => {
    const sim = new ZylonSim(createRng(1));
    expect(sim.fire('FRONT', 'ok', false, true)).toBe('launched');
    expect(sim.photons[1].life).toBe(0);
    const events = sim.loop(input());
    expect(events.filter((e) => e.type === 'autoFired')).toHaveLength(1);
    expect(sim.photons[1].life).toBeGreaterThan(0);
    expect(sim.photons[1].x).toBe(256); // right barrel
    expect(sim.loop(input()).some((e) => e.type === 'autoFired')).toBe(false); // only one
  });

  it('an unlocked press fires one torpedo only', () => {
    const sim = new ZylonSim(createRng(1));
    sim.fire('FRONT', 'ok', false, false);
    expect(sim.loop(input()).some((e) => e.type === 'autoFired')).toBe(false);
    expect(sim.photons[1].life).toBe(0);
  });

  it('destroyed photons: the press sets up the lock but nothing launches', () => {
    const sim = new ZylonSim(createRng(1));
    expect(sim.fire('FRONT', 'destroyed', false, true)).toBe('noLaunch');
    expect(sim.loop(input({ photonStatus: 'destroyed' })).some((e) => e.type === 'autoFired')).toBe(false);
  });
});
