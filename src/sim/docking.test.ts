import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { PHRASE } from '../rules/messages';
import { VELOCITY_TAB } from '../rules/speed';
import { placeStarbase, SHAPE, STARBASE_WING_DROP, STARBASE_WING_OFFSET } from '../render/sprites';
import { Galaxy } from './galaxy';
import { MissionScore } from './rating';
import { approachVelocity } from './motion';
import { TitleLine } from './title';
import { Docking, inOrbitPosition, pmColumn, pmRow, ORBIT_MAX_Z, STARBASE_MIN_Z, VESSEL_START, type DockEvent } from './docking';
import { ZYLON_SPAWN_Z_HI, ZylonSim, type ZylonEvent, type ZylonLoopInput } from './zylons';

const input = (over: Partial<ZylonLoopInput> = {}): ZylonLoopInput => ({
  turn: { x: 0, y: 0 },
  velocity: 0,
  view: 'FRONT',
  level: 'NOVICE',
  sectorZylons: 0,
  starbaseSector: true,
  hyperwarp: false,
  count256: 0,
  computer: true,
  ...over,
});

/**
 * A pilot flying the game's docking loop: ZylonSim moves the starbase and the vessel, Docking
 * reads the orbit conditions, the title line runs ORBIT ESTABLISHED / STANDBY. Mirrors
 * Game.flyLoop → dockingLoop → dockEvent.
 */
class Pilot {
  readonly sim = new ZylonSim(createRng(1979));
  readonly docking = new Docking();
  readonly title = new TitleLine();
  readonly events: DockEvent[] = [];
  velocity = 0;
  key = 0;
  stick = { x: 0 as -1 | 0 | 1, y: 0 as -1 | 0 | 1 };
  energy = 4321;
  repaired = 0;
  loops = 0;

  constructor(starbase: { x: number; y: number; z: number }) {
    this.sim.setStarbase(starbase);
  }

  loop(): DockEvent[] {
    this.loops++;
    this.velocity = approachVelocity(this.velocity, VELOCITY_TAB[this.key]);
    this.sim.loop(input({ velocity: this.velocity, turn: this.stick, count256: this.loops & 0xff }));
    const moved = this.stick.x !== 0 || this.stick.y !== 0;
    const ev: DockEvent[] = moved ? this.docking.interrupt() : [];
    const inPosition = !moved && inOrbitPosition({ starbase: this.sim.starbase, velocity: this.velocity, newVelocity: VELOCITY_TAB[this.key] });
    const v = this.sim.vessel;
    ev.push(...this.docking.loop({ inPosition, titleHidden: this.title.current === null, vesselBehind: v.alive && v.z < 0 }));
    for (const e of ev) this.apply(e);
    this.title.loop();
    this.events.push(...ev);
    return ev;
  }

  apply(e: DockEvent): void {
    if (e === 'orbitEstablished') this.title.set(PHRASE.ORBIT_ESTABLISHED);
    if (e === 'holdTitle') this.title.clearQueue();
    if (e === 'launchVessel') this.sim.launchVessel();
    if (e === 'transferComplete') {
      this.title.set(PHRASE.TRANSFER_COMPLETE);
      this.energy = 9999;
      this.repaired++;
      this.sim.returnVessel();
    }
    if (e === 'aborted') {
      this.title.set(PHRASE.DOCKING_ABORTED);
      this.sim.recallVessel();
    }
  }

  /** A key other than G (Game.handleAction). */
  key_(action: string): void {
    if (this.docking.active && action !== 'CHART') for (const e of this.docking.interrupt()) { this.apply(e); this.events.push(e); }
    else if (action === 'SPEED_0') this.docking.retry();
    if (action.startsWith('SPEED_')) this.key = Number(action.slice(6));
  }

  run(n: number): void {
    for (let i = 0; i < n; i++) this.loop();
  }

  /** Fly at speed 2 until the starbase is closer than `stopAt` KM, then press 0 and wait. */
  approach(stopAt: number, maxLoops = 4000): void {
    this.key_('SPEED_2');
    for (let i = 0; i < maxLoops && this.sim.starbase.z >= stopAt; i++) this.loop();
    this.key_('SPEED_0');
  }
}

describe('orbit conditions (§13, §17.9; R: DOCKING)', () => {
  const at = (x: number, y: number, z: number, velocity = 0, newVelocity = 0) => inOrbitPosition({ starbase: { x, y, z }, velocity, newVelocity });

  it('PM column and row follow SCREENCOLUMN / SCREENROW (centre 125 / 122)', () => {
    expect(pmColumn(0, 300)).toBe(125);
    expect(pmColumn(-1, 300)).toBe(124);
    expect(pmRow(0, 300)).toBe(121);
    expect(pmRow(-1, 300)).toBe(122);
    expect(pmColumn(0, -1)).toBeNull();
  });

  it('a starbase centred, sitting just above the cross hair, closer than 512 KM, speed 0: orbit', () => {
    expect(at(0, 40, 300)).toBe(true);
    expect(at(0, 60, 500)).toBe(true);
  });

  it('too far (≥ 512 KM), behind us, or below the axis: no orbit', () => {
    expect(at(0, 60, ORBIT_MAX_Z)).toBe(false);
    expect(at(0, 60, 900)).toBe(false);
    expect(at(0, 40, -300)).toBe(false);
    expect(at(0, -40, 300)).toBe(false);
  });

  it('off centre sideways or too high: no orbit', () => {
    expect(at(150, 40, 300)).toBe(false);
    expect(at(-80, 40, 300)).toBe(false);
    expect(at(0, 200, 300)).toBe(false);
    // Exactly on the axis is "hanging" from the cross hair by the ROM's row window: not yet.
    expect(at(0, 0, 300)).toBe(false);
  });

  it('the ship must be stopped: velocity and new velocity both 0', () => {
    expect(at(0, 40, 300, 1, 0)).toBe(false);
    expect(at(0, 40, 300, 0, 2)).toBe(false);
  });

  it('nothing docks from the Aft view (the starbase is not between the cross hairs)', () => {
    expect(inOrbitPosition({ starbase: { x: 0, y: 40, z: 300 }, velocity: 0, newVelocity: 0, aft: true })).toBe(false);
  });
});

describe('scripted approach at speed 2 then 0 (acceptance)', () => {
  it('centred and close: ORBIT ESTABLISHED once stopped, then STANDBY, the vessel, TRANSFER COMPLETE', () => {
    const p = new Pilot({ x: 0, y: 60, z: 3000 });
    p.approach(450);
    // Nothing docks while the ship still moves.
    expect(p.events).toEqual([]);
    const stoppedAt = p.loops;
    p.run(3);
    expect(p.events[0]).toBe('orbitEstablished');
    expect(p.docking.state).toBe('orbit');
    expect(p.title.text).toBe('ORBIT ESTABLISHED');
    p.run(60);
    expect(p.title.text).toBe('STANDBY');
    // The vessel leaves the starbase once the title line goes blank.
    for (let i = 0; i < 200 && !p.sim.vessel.alive; i++) p.loop();
    expect(p.sim.vessel.alive).toBe(true);
    expect(p.sim.vessel.z).toBeGreaterThan(VESSEL_START.z - 10);
    expect(p.docking.state).toBe('transfer');
    // About 10 s (≈ 600 loops) later it passes behind us: TRANSFER COMPLETE.
    const launched = p.loops;
    for (let i = 0; i < 1000 && p.docking.state === 'transfer'; i++) p.loop();
    expect(p.docking.state).toBe('complete');
    expect(p.loops - launched).toBeGreaterThan(540);
    expect(p.loops - launched).toBeLessThan(660);
    expect(p.title.text).toBe('TRANSFER COMPLETE');
    expect(p.energy).toBe(9999);
    expect(p.repaired).toBe(1);
    expect(p.sim.vessel.vel.z).toBe(7); // flies back to the starbase
    expect(p.events.filter((e) => e !== 'holdTitle')).toEqual(['orbitEstablished', 'launchVessel', 'transferComplete']);
    expect(p.loops - stoppedAt).toBeLessThan(900);
  });

  it('the same approach off centre does not dock', () => {
    const p = new Pilot({ x: 700, y: 60, z: 3000 });
    p.approach(450);
    p.run(1500);
    expect(p.events).toEqual([]);
    expect(p.energy).toBe(4321);
  });

  it('the same approach stopped too far away does not dock', () => {
    const p = new Pilot({ x: 0, y: 60, z: 3000 });
    p.approach(900);
    p.run(1500);
    expect(p.sim.starbase.z).toBeGreaterThan(ORBIT_MAX_Z);
    expect(p.events).toEqual([]);
  });

  it('flying on at speed 2 through the starbase never docks (speed must be 0)', () => {
    const p = new Pilot({ x: 0, y: 60, z: 3000 });
    p.key_('SPEED_2');
    p.run(2500);
    expect(p.events).toEqual([]);
  });

  it('the starbase is never closer than 32 KM while we hold still (R: DOCKING)', () => {
    const p = new Pilot({ x: 0, y: 2, z: 5 });
    p.run(40);
    expect(p.sim.starbase.z).toBeGreaterThanOrEqual(STARBASE_MIN_Z);
  });
});

describe('DOCKING ABORTED (§13 step 6)', () => {
  const inOrbit = () => {
    const p = new Pilot({ x: 0, y: 40, z: 300 });
    p.run(2);
    expect(p.docking.state).toBe('orbit');
    return p;
  };

  it('any key except G during docking aborts it', () => {
    for (const key of ['SHIELDS', 'FRONT', 'SPEED_0', 'FIRE', 'LRS']) {
      const p = inOrbit();
      p.key_(key);
      expect(p.docking.state).toBe('none');
      expect(p.title.text).toBe('DOCKING ABORTED');
      // No new orbit straight away: the pilot has to retrace the steps.
      p.run(200);
      expect(p.events.filter((e) => e === 'orbitEstablished')).toHaveLength(1);
    }
  });

  it('G (the Galactic Chart) does not abort', () => {
    const p = inOrbit();
    p.key_('CHART');
    expect(p.docking.state).toBe('orbit');
    p.run(900);
    expect(p.docking.state).toBe('complete');
  });

  it('moving the stick aborts, also during the transfer, and the vessel turns back', () => {
    const p = inOrbit();
    for (let i = 0; i < 200 && !p.sim.vessel.alive; i++) p.loop();
    expect(p.docking.state).toBe('transfer');
    p.stick = { x: 1, y: 0 };
    p.loop();
    expect(p.events).toContain('aborted');
    expect(p.title.text).toBe('DOCKING ABORTED');
    expect(p.sim.vessel.alive).toBe(false);
    expect(p.energy).toBe(4321);
    expect(p.repaired).toBe(0);
  });

  it('speeding up breaks the orbit: DOCKING ABORTED', () => {
    const p = inOrbit();
    p.key = 1; // not through key_: the condition check alone must abort
    p.loop();
    expect(p.events.at(-1)).toBe('aborted');
  });

  it('after an abort, choosing speed 0 again docks again', () => {
    const p = inOrbit();
    p.key_('SHIELDS');
    p.run(10);
    p.key_('SPEED_0');
    p.loop();
    expect(p.docking.state).toBe('orbit');
    p.run(900);
    expect(p.docking.state).toBe('complete');
  });
});

describe('no repeat docking', () => {
  it('parked after TRANSFER COMPLETE, the ship never docks again', () => {
    const p = new Pilot({ x: 0, y: 40, z: 300 });
    p.run(900);
    expect(p.docking.state).toBe('complete');
    p.energy = 1234;
    p.run(6000);
    expect(p.events.filter((e) => e === 'orbitEstablished')).toHaveLength(1);
    expect(p.events.filter((e) => e === 'transferComplete')).toHaveLength(1);
    expect(p.energy).toBe(1234);
  });

  it('a key after TRANSFER COMPLETE is not DOCKING ABORTED, and leaving quietly ends it', () => {
    const p = new Pilot({ x: 0, y: 40, z: 300 });
    p.run(900);
    p.key_('SHIELDS');
    expect(p.events).not.toContain('aborted');
    p.key_('SPEED_3');
    p.run(5);
    expect(p.events).not.toContain('aborted');
    expect(p.docking.state).toBe('none');
  });
});

describe('the starbase in KM space (§17.8, §17.9; R: HYPERWARP L4842)', () => {
  it('is placed like a Zylon ship: ≥ 28928 KM ahead, x and y within the vicinity mask, random signs', () => {
    const sim = new ZylonSim(createRng(7));
    const signs = new Set<string>();
    for (const mask of [0xff, 0x0f]) {
      sim.vicinityMask = mask;
      for (let i = 0; i < 200; i++) {
        sim.placeStarbase();
        const sb = sim.starbase;
        expect(sb.alive).toBe(true);
        expect(sb.z).toBeGreaterThanOrEqual(ZYLON_SPAWN_Z_HI * 256);
        expect(Math.abs(sb.x) >> 8).toBeLessThanOrEqual(mask);
        expect(Math.abs(sb.y) >> 8).toBeLessThanOrEqual(mask);
        signs.add(`${Math.sign(sb.x)},${Math.sign(sb.y)}`);
      }
    }
    expect(signs.size).toBeGreaterThanOrEqual(4);
  });

  it('a starbase sector has no Zylon ships, Zylon torpedoes or meteors', () => {
    const sim = new ZylonSim(createRng(1979));
    sim.vicinityMask = 0xff;
    sim.placeStarbase();
    let meteors = 0;
    for (let i = 0; i < 20000; i++) {
      const ev = sim.loop(input({ sectorZylons: 4, count256: i & 0xff, velocity: 8 }));
      meteors += ev.filter((e) => e.type === 'meteorSpawned' || e.type === 'zylonSpawned' || e.type === 'zylonFired').length;
      expect(sim.liveShips).toBe(0);
      expect(sim.pl2.life).toBe(0);
    }
    expect(meteors).toBe(0);
    // Control: the same loops outside a starbase sector do bring ships and meteors.
    const other = new ZylonSim(createRng(1979));
    let spawned = 0;
    for (let i = 0; i < 2000; i++) spawned += other.loop(input({ starbaseSector: false, sectorZylons: 4, count256: i & 0xff })).length;
    expect(spawned).toBeGreaterThan(0);
  });

  it('is drawn in three parts: centre plus wings 8 PM pixels out and 4 scanlines lower', () => {
    const parts = placeStarbase(0, 40, 300, 'FRONT');
    expect(parts.map((p) => p.type)).toEqual([SHAPE.STARBASE_CENTER, SHAPE.STARBASE_LEFT, SHAPE.STARBASE_RIGHT]);
    expect(parts[1].col).toBe(parts[0].col - STARBASE_WING_OFFSET);
    expect(parts[2].col).toBe(parts[0].col + STARBASE_WING_OFFSET);
    expect(parts[1].line).toBe(parts[0].line + STARBASE_WING_DROP);
    expect(parts[0].rows).toHaveLength(16);
  });
});

describe('shooting the starbase (§14.1, §17.7, §17.10; R: COLLISION)', () => {
  it('a photon destroys it: −3, gone from the galaxy and the chart, an explosion', () => {
    const sim = new ZylonSim(createRng(3));
    sim.setStarbase({ x: -256, y: -256, z: 2000 }); // in line with the left barrel
    const galaxy = new Galaxy('NOVICE', createRng(5), { x: 8, y: 4 });
    const base = galaxy.sectors().find((s) => s.starbase)!;
    const before = galaxy.starbasesLeft;
    const version = galaxy.version;
    const score = new MissionScore();
    expect(sim.fire('FRONT', 'ok', false)).toBe('launched');
    const events: ZylonEvent[] = [];
    for (let i = 0; i < 60 && sim.starbase.alive; i++) events.push(...sim.loop(input({ count256: i })));
    expect(events.filter((e) => e.type === 'starbaseDestroyed')).toHaveLength(1);
    expect(sim.starbase.alive).toBe(false);
    expect(sim.explosion).not.toBeNull();
    // What Game.starbaseShot does with the event.
    score.starbaseShotByYou();
    expect(galaxy.removeStarbase(base.x, base.y)).toBe(true);
    expect(score.score).toBe(-3);
    expect(galaxy.starbasesLeft).toBe(before - 1);
    expect(galaxy.hasStarbase(base.x, base.y)).toBe(false);
    expect(galaxy.version).toBeGreaterThan(version);
  });

  it('a photon that misses leaves it alone', () => {
    const sim = new ZylonSim(createRng(3));
    sim.setStarbase({ x: 3000, y: 2000, z: 2000 });
    sim.fire('FRONT', 'ok', false);
    let hit = 0;
    for (let i = 0; i < 260; i++) hit += sim.loop(input({ count256: i })).filter((e) => e.type === 'starbaseDestroyed').length;
    expect(hit).toBe(0);
    expect(sim.starbase.alive).toBe(true);
  });
});
