import { describe, expect, it } from 'vitest';
import { SimClock } from '../core/clock';
import { calcWarpSectors } from '../rules/warp';
import { EnergySim, drainUnitsPerSecond, loopDrainSubunits } from './energy';

function setup(energy = 9999) {
  const host = { energy };
  const log = { scoreLoss: 0, zero: 0 };
  const sim = new EnergySim(host, {
    onScoreLoss: (p) => (log.scoreLoss += p),
    onZeroEnergy: () => log.zero++,
  });
  return { host, sim, log };
}

/** Run `seconds` of loops through a real clock. */
function run(sim: EnergySim, seconds: number, load: Parameters<EnergySim['loop']>[0]) {
  new SimClock().advance(seconds, () => sim.loop(load));
}

const idle = { engineKey: 0, shields: false, computer: false };

describe('§12 / §17.1 continuous drains', () => {
  it('speed 6 drains 3.5 units/s (plus ¼ life support)', () => {
    expect(drainUnitsPerSecond({ ...idle, engineKey: 6 }) - drainUnitsPerSecond(idle)).toBe(3.5);
    const { host, sim } = setup();
    run(sim, 100, { ...idle, engineKey: 6 });
    expect(9999 - host.energy).toBe(350 + 25);
  });

  it('every engine key drains the manual rate', () => {
    const manual = [0, 1, 1.5, 2, 2.5, 3, 3.5, 7.5, 11.25, 15];
    for (let k = 0; k <= 9; k++) {
      const { host, sim } = setup();
      run(sim, 400, { ...idle, engineKey: k });
      expect(9999 - host.energy).toBe(manual[k] * 400 + 100);
    }
  });

  it('shields 2/s, computer ½/s, life support ¼/s', () => {
    const cases: Array<[Partial<typeof idle>, number]> = [
      [{}, 0.25],
      [{ shields: true }, 2.25],
      [{ computer: true }, 0.75],
      [{ shields: true, computer: true }, 2.75],
    ];
    for (const [load, perSecond] of cases) {
      const { host, sim } = setup();
      run(sim, 80, { ...idle, ...load });
      expect(9999 - host.energy).toBe(perSecond * 80);
    }
  });

  it('ROM subunits per loop: shields 8 + computer 2 + life support 1 + engine', () => {
    expect(loopDrainSubunits({ engineKey: 6, shields: true, computer: true })).toBe(8 + 2 + 1 + 14);
    expect(loopDrainSubunits({ engineKey: 0, shields: false, computer: false, hyperwarp: true })).toBe(1 + 30);
  });
});

describe('§17.1 lump costs', () => {
  it('photon 10, hit 100, abort 100', () => {
    const { host, sim } = setup();
    sim.firePhoton();
    expect(host.energy).toBe(9989);
    sim.hit();
    expect(host.energy).toBe(9889);
    sim.abortHyperwarp();
    expect(host.energy).toBe(9789);
  });

  it('hyperspace drains 10 per loop for WARPENERGY − 1 loops', () => {
    const { host, sim } = setup();
    const cost = calcWarpSectors(8, 4, 13, 4); // 5 sectors: 500
    expect(cost.units).toBe(500);
    sim.beginHyperspace(cost.warpEnergy);
    for (let i = 0; i < 200; i++) sim.loop({ ...idle, hyperwarp: true });
    const continuous = Math.floor((200 * 31 * 64) / 60 / 256);
    expect(9999 - host.energy).toBe(490 + continuous);
  });

  it('docking refills to 9999', () => {
    const { host, sim } = setup(1234);
    sim.refill();
    expect(host.energy).toBe(9999);
  });
});

describe('§17.1 score: −1 per 100-unit boundary', () => {
  it('counts boundaries crossed by 1- and 10-unit steps', () => {
    const { sim, log } = setup(9999);
    for (let i = 0; i < 10; i++) sim.firePhoton(); // 9999 -> 9899
    expect(log.scoreLoss).toBe(1);
    sim.take(1); // 9898
    expect(log.scoreLoss).toBe(1);
  });

  it('100-unit lumps never cost score (DECENERGY digit 1)', () => {
    const { sim, log } = setup(9999);
    for (let i = 0; i < 5; i++) sim.hit();
    expect(log.scoreLoss).toBe(0);
  });

  it('equals floor(energy used / 100) for continuous use from 9999', () => {
    const { host, sim, log } = setup();
    run(sim, 300, { engineKey: 9, shields: true, computer: true });
    expect(log.scoreLoss).toBe(Math.floor((9999 - host.energy) / 100));
  });
});

describe('§12 / §17.1 zero energy', () => {
  it('energy reaches 0 and aborts the mission', () => {
    const { host, sim, log } = setup(50);
    let loops = 0;
    while (!sim.zeroEnergy && loops < 100000) {
      sim.loop({ engineKey: 9, shields: true, computer: true });
      loops++;
    }
    expect(sim.zeroEnergy).toBe(true);
    expect(host.energy).toBe(0);
    expect(log.zero).toBe(1);
    // 50 units at 17.75 units/s plus the final borrow: about 3 seconds.
    expect(loops).toBeGreaterThan(160);
    expect(loops).toBeLessThan(180);
  });

  it('a full tank runs dry at speed 9 with shields and computer in about 9½ minutes', () => {
    const { sim } = setup();
    const clock = new SimClock();
    while (!sim.zeroEnergy && clock.loops < 60 * 60 * 60) {
      clock.step();
      sim.loop({ engineKey: 9, shields: true, computer: true });
    }
    expect(sim.zeroEnergy).toBe(true);
    expect(Math.round(clock.seconds)).toBe(Math.round(10000 / 17.75));
  });

  it('a photon fired at 5 units ends the mission', () => {
    const { host, sim, log } = setup(5);
    sim.firePhoton();
    expect(sim.zeroEnergy).toBe(true);
    expect(host.energy).toBe(0);
    expect(log.zero).toBe(1);
  });

  it('nothing drains or refills after zero energy', () => {
    const { host, sim, log } = setup(0);
    sim.take(1);
    expect(sim.zeroEnergy).toBe(true);
    sim.refill();
    sim.hit();
    sim.loop({ engineKey: 9, shields: true, computer: true });
    expect(host.energy).toBe(0);
    expect(log.zero).toBe(1);
  });

  it('isLow below 1000', () => {
    expect(setup(1000).sim.isLow).toBe(false);
    expect(setup(999).sim.isLow).toBe(true);
  });
});
