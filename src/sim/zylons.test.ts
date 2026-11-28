import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { allSystemsOk, type DamageStatus } from '../rules/damage';
import { COST } from '../rules/energy';
import { SHAPE, shapeRows } from '../render/sprites';
import {
  BASESTAR_MAX_TORPEDO_AGE,
  EXPLOSION_FRAGMENTS,
  EXPLOSION_LIFE,
  MAX_ZYLON_SHIPS,
  METEOR_SPEED,
  PHOTON_LIFE,
  PHOTON_REFIRE_LOOPS,
  resolveShipHit,
  ZYLON_SHAPE_TABLE,
  ZYLON_TORPEDO_LIFE,
  ZylonSim,
  type ZylonEvent,
  type ZylonLoopInput,
} from './zylons';

const input = (over: Partial<ZylonLoopInput> = {}): ZylonLoopInput => ({
  turn: { x: 0, y: 0 },
  velocity: 0,
  view: 'FRONT',
  level: 'NOVICE',
  sectorZylons: 0,
  starbaseSector: false,
  hyperwarp: false,
  count256: 0,
  computer: true,
  ...over,
});

/** Run `n` loops with COUNT256 counting like the ROM's; returns every event. */
function run(sim: ZylonSim, n: number, over: Partial<ZylonLoopInput> = {}, start = 0): ZylonEvent[] {
  const out: ZylonEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...sim.loop(input({ count256: (start + i) & 0xff, ...over })));
  return out;
}

/** A photon of a given age flying straight at a target on the axis. */
function photonAt(sim: ZylonSim, slot: number, age: number, z: number): void {
  Object.assign(sim.photons[slot], { life: PHOTON_LIFE - age, x: 0, y: 0, z, vel: { x: 0, y: 0, z: 0 } });
}

// MANUAL_SPEC §17.8: type mix 4/8 fighter, 3/8 cruiser, 1/8 basestar on every level.
describe('Zylon type mix', () => {
  it('ZYLONSHAPTAB holds 4 fighters, 3 cruisers and 1 basestar in 8 slots', () => {
    const count = (t: string) => ZYLON_SHAPE_TABLE.filter((x) => x === t).length;
    expect(ZYLON_SHAPE_TABLE).toHaveLength(8);
    expect([count('fighter'), count('cruiser'), count('basestar')]).toEqual([4, 3, 1]);
  });

  it('spawned ships follow the mix on every level', () => {
    for (const level of ['NOVICE', 'PILOT', 'WARRIOR', 'COMMANDER'] as const) {
      const sim = new ZylonSim(createRng(7));
      const seen = { fighter: 0, cruiser: 0, basestar: 0 };
      for (let i = 0; i < 4000; i++) {
        sim.clear();
        for (const e of run(sim, 4, { level, sectorZylons: 1 })) if (e.type === 'zylonSpawned') seen[e.zylon]++;
      }
      const total = seen.fighter + seen.cruiser + seen.basestar;
      expect(total).toBe(4000);
      expect(seen.fighter / total).toBeCloseTo(4 / 8, 1);
      expect(seen.cruiser / total).toBeCloseTo(3 / 8, 1);
      expect(seen.basestar / total).toBeCloseTo(1 / 8, 1);
    }
  });
});

// §17.8: at most two ships and one torpedo; new ones replace the dead while the count allows.
describe('ships and torpedo limits', () => {
  it('never more than 2 ships in play, and never more than the sector holds', () => {
    for (const count of [1, 2, 4]) {
      const sim = new ZylonSim(createRng(count));
      for (let i = 0; i < 3000; i++) {
        sim.loop(input({ count256: i & 0xff, sectorZylons: count, velocity: 32 }));
        expect(sim.liveShips).toBeLessThanOrEqual(Math.min(MAX_ZYLON_SHIPS, count));
      }
      expect(sim.liveShips).toBe(Math.min(MAX_ZYLON_SHIPS, count));
    }
  });

  it('spawns at least 28928 KM ahead', () => {
    const sim = new ZylonSim(createRng(3));
    run(sim, 8, { sectorZylons: 2 });
    for (const s of sim.ships) expect(s.z).toBeGreaterThanOrEqual(28928 - 2 * 62);
  });

  it('a new torpedo only once the old one has gone (one PLAYER2)', () => {
    const sim = new ZylonSim(createRng(11));
    sim.spawn('fighter', { x: 0, y: 0, z: 4000 }, false);
    const fired = run(sim, 400, { sectorZylons: 1 }).filter((e) => e.type === 'zylonFired');
    expect(fired.length).toBeGreaterThan(1);
    // A launch never replaces a torpedo still in flight.
    const sim2 = new ZylonSim(createRng(11));
    sim2.spawn('fighter', { x: 0, y: 0, z: 4000 }, false);
    for (let i = 0; i < 400; i++) {
      const flying = sim2.torpedoFlying;
      const ev = sim2.loop(input({ count256: i & 0xff, sectorZylons: 1 }));
      if (ev.some((e) => e.type === 'zylonFired')) expect(flying, `loop ${i}`).toBe(false);
    }
  });

  it('no Zylons, torpedoes or meteors in a starbase sector or during hyperwarp', () => {
    for (const over of [{ starbaseSector: true }, { hyperwarp: true }]) {
      const sim = new ZylonSim(createRng(5));
      const ev = run(sim, 2000, { sectorZylons: 3, ...over });
      expect(ev).toHaveLength(0);
      expect(sim.liveShips).toBe(0);
    }
  });
});

// §17.7: Zylon torpedo rules.
describe('Zylon torpedo', () => {
  it('fires only near our plane and within 8192 KM; never from behind at NOVICE', () => {
    const fires = (level: 'NOVICE' | 'PILOT', pos: { x: number; y: number; z: number }) => {
      const sim = new ZylonSim(createRng(1));
      sim.spawn('fighter', pos, false);
      sim.ships[0].milestoneTimer = 10_000; // hold its course
      return run(sim, 9, { level, sectorZylons: 1 }).some((e) => e.type === 'zylonFired');
    };
    expect(fires('NOVICE', { x: 0, y: 0, z: 6000 })).toBe(true);
    expect(fires('NOVICE', { x: 0, y: 0, z: 9000 })).toBe(false); // too far
    expect(fires('NOVICE', { x: 0, y: 2000, z: 6000 })).toBe(false); // above our plane
    expect(fires('NOVICE', { x: 0, y: 0, z: -3000 })).toBe(false); // behind, NOVICE
    expect(fires('PILOT', { x: 0, y: 0, z: -3000 })).toBe(true); // behind, PILOT
  });

  it('homes toward our axis at 1 / 4 / 8 / 20 KM per loop by level', () => {
    for (const [level, h] of [['NOVICE', 1], ['PILOT', 4], ['WARRIOR', 8], ['COMMANDER', 20]] as const) {
      const sim = new ZylonSim(createRng(1));
      Object.assign(sim.pl2, { kind: 'torpedo', life: 62, x: 3000, y: -3000, z: 5000, vel: { x: 0, y: 0, z: -80 } });
      sim.loop(input({ level, count256: 1 }));
      expect(sim.pl2.vel).toEqual({ x: -h, y: h, z: -80 });
    }
  });

  it('lives 62 loops', () => {
    const sim = new ZylonSim(createRng(1));
    sim.spawn('fighter', { x: 0, y: 0, z: 6000 }, false);
    sim.ships[0].milestoneTimer = 10_000;
    let i = 0;
    while (!sim.loop(input({ count256: i & 0xff, sectorZylons: 1 })).some((e) => e.type === 'zylonFired')) i++;
    expect(sim.pl2.kind).toBe('torpedo');
    expect(sim.pl2.life).toBe(ZYLON_TORPEDO_LIFE - 1);
    run(sim, ZYLON_TORPEDO_LIFE - 2, {}, i + 1);
    expect(sim.pl2.life).toBe(1);
    run(sim, 1, {}, i + ZYLON_TORPEDO_LIFE);
    expect(sim.pl2.life).toBe(0);
  });
});

// §17.7: photons alternate barrels, a barrel refires after 23 loops, life 255, 10 energy each.
describe('photon torpedoes', () => {
  it('alternate left and right barrels', () => {
    const sim = new ZylonSim(createRng(1));
    expect(sim.fire('FRONT', 'ok', false)).toBe(true);
    expect(sim.photons[0].x).toBe(-256);
    expect(sim.fire('FRONT', 'ok', false)).toBe(true);
    expect(sim.photons[1].x).toBe(256);
    expect(sim.photons.map((p) => p.y)).toEqual([-256, -256]);
  });

  it('a barrel refires only once its last torpedo is more than 23 loops old (life < 232)', () => {
    const sim = new ZylonSim(createRng(1));
    expect(PHOTON_REFIRE_LOOPS).toBe(23);
    sim.fire('FRONT', 'ok', false); // left
    sim.fire('FRONT', 'ok', false); // right, at once
    for (let loop = 1; loop <= 23; loop++) {
      run(sim, 1);
      expect(sim.fire('FRONT', 'ok', false), `loop ${loop}`).toBe(false);
    }
    run(sim, 1);
    expect(sim.fire('FRONT', 'ok', false)).toBe(true); // left again after 23 loops
  });

  it('damaged photons fire one barrel every 23 loops; destroyed ones never', () => {
    const sim = new ZylonSim(createRng(1));
    expect(sim.fire('FRONT', 'damaged', false)).toBe(true);
    expect(sim.fire('FRONT', 'damaged', false)).toBe(false);
    run(sim, 23);
    expect(sim.fire('FRONT', 'damaged', false)).toBe(false);
    run(sim, 1);
    expect(sim.fire('FRONT', 'damaged', false)).toBe(true);
    expect(sim.photons[1].life).toBe(0); // always the same barrel
    const dead = new ZylonSim(createRng(1));
    expect(dead.fire('FRONT', 'destroyed', false)).toBe(false);
  });

  it('fly 102 KM per loop for 255 loops, aft photons fly backwards; cost 10', () => {
    const sim = new ZylonSim(createRng(1));
    sim.fire('AFT', 'ok', false);
    run(sim, 1, { velocity: 64 });
    expect(sim.photons[0].z).toBe(1 - 102); // not carried by our velocity
    run(sim, 253);
    expect(sim.photons[0].life).toBe(1);
    run(sim, 1);
    expect(sim.photons[0].life).toBe(0);
    expect(COST.photon).toBe(10);
  });

  it('sparkle: each frame shows a random subset of the shape', async () => {
    const { objectSprites } = await import('../render/Renderer');
    const rng = createRng(2);
    const full = shapeRows(SHAPE.PHOTON, 1);
    const frames = Array.from({ length: 4 }, () => objectSprites({ kind: 'photon', x: 0, y: 0, z: 2600 }, 'FRONT', 0, rng)[0].rows);
    for (const rows of frames) rows.forEach((r, i) => expect(r & ~full[i]).toBe(0));
    expect(new Set(frames.map((f) => f.join())).size).toBeGreaterThan(1);
  });
});

// §17.7: hits, the basestar rule and explosions.
describe('photon hits', () => {
  it('destroys a fighter in front, scoring through zylonDestroyed', () => {
    const sim = new ZylonSim(createRng(1));
    sim.spawn('fighter', { x: 0, y: 0, z: 2000 }, false);
    photonAt(sim, 0, 40, 1900);
    const ev = sim.loop(input({ sectorZylons: 1 }));
    expect(ev).toContainEqual(expect.objectContaining({ type: 'zylonDestroyed', zylon: 'fighter', slot: 0 }));
    expect(sim.ships[0].alive).toBe(false);
    expect(sim.photons[0].life).toBe(0);
  });

  it(`a basestar dies only to a torpedo younger than ${BASESTAR_MAX_TORPEDO_AGE} loops`, () => {
    const hit = (age: number) => {
      const sim = new ZylonSim(createRng(1));
      sim.spawn('basestar', { x: 0, y: 0, z: 1200 }, false);
      sim.ships[0].milestoneTimer = 10_000;
      photonAt(sim, 0, age, 1100);
      const ev = sim.loop(input({ sectorZylons: 1 }));
      return { ev, alive: sim.ships[0].alive, photon: sim.photons[0].life, explosion: sim.explosion !== null };
    };
    const young = hit(14);
    expect(young.alive).toBe(false);
    expect(young.ev).toContainEqual(expect.objectContaining({ type: 'zylonDestroyed', zylon: 'basestar' }));
    const old = hit(15);
    expect(old.alive).toBe(true);
    expect(old.ev).toContainEqual(expect.objectContaining({ type: 'basestarHit' }));
    expect(old.ev.some((e) => e.type === 'zylonDestroyed')).toBe(false);
    expect(old.photon).toBe(0); // the torpedo is spent
    expect(old.explosion).toBe(true); // and bursts on the hull
  });

  it('misses outside the depth window (HITMINZTAB/HITMAXZTAB)', () => {
    const sim = new ZylonSim(createRng(1));
    sim.spawn('fighter', { x: 0, y: 0, z: 6000 }, false);
    photonAt(sim, 0, 5, 300); // overlaps on screen, but far nearer than the ship
    expect(sim.loop(input({ sectorZylons: 1 })).some((e) => e.type === 'zylonDestroyed')).toBe(false);
  });

  it('explosions are 32 fragments, −7..+7 KM per loop, for 128 loops', () => {
    const sim = new ZylonSim(createRng(1));
    sim.spawn('cruiser', { x: 0, y: 0, z: 2000 }, false);
    photonAt(sim, 0, 40, 1900);
    sim.loop(input({ sectorZylons: 1 }));
    expect(sim.explosion!.fragments).toHaveLength(EXPLOSION_FRAGMENTS);
    for (const f of sim.explosion!.fragments) for (const v of [f.vel.x, f.vel.y, f.vel.z]) expect(Math.abs(v)).toBeLessThanOrEqual(7);
    expect(sim.explosion!.life).toBe(EXPLOSION_LIFE - 1);
    run(sim, EXPLOSION_LIFE - 1);
    expect(sim.explosion).toBeNull();
  });
});

// §5.9, §17.7: shields up −100 per hit; down = destroyed.
describe('being hit', () => {
  const damage = (): DamageStatus => allSystemsOk();
  const byte = (v: number) => () => v;

  it('shields down: a Zylon torpedo destroys the ship', () => {
    const r = resolveShipHit({ shieldsUp: false, level: 'NOVICE', damage: damage(), by: 'torpedo', torpedoLife: 20, randomByte: byte(0) });
    expect(r.destroyed).toBe(true);
  });

  it('shields up: costs 100 energy, the ship survives', () => {
    const r = resolveShipHit({ shieldsUp: true, level: 'COMMANDER', damage: damage(), by: 'torpedo', torpedoLife: 20, randomByte: byte(0) });
    expect(r).toMatchObject({ destroyed: false, energy: 100 });
    expect(r.damage?.status).toBe('damaged'); // fired from far: damaged, not destroyed
  });

  it('a torpedo that reaches our ship raises shipHit and is used up', () => {
    const sim = new ZylonSim(createRng(1));
    Object.assign(sim.pl2, { kind: 'torpedo', life: 30, x: 0, y: 0, z: 200, vel: { x: 0, y: 0, z: -80 } });
    const ev = sim.loop(input({ count256: 1 }));
    expect(ev).toContainEqual({ type: 'shipHit', by: 'torpedo', torpedoLife: 30 });
    expect(sim.pl2.life).toBe(0);
    expect(sim.explosion).not.toBeNull();
  });
});

// §16, §17.7: meteors.
describe('meteors', () => {
  it('about 4 in 256 tries while PLAYER2 is free; with Zylons about, never on their steering loop', () => {
    const rate = (sectorZylons: number) => {
      const sim = new ZylonSim(createRng(9));
      let spawned = 0;
      let tries = 0;
      for (let i = 0; i < 40000; i++) {
        sim.pl2.life = 0; // keep the slot free
        if (sectorZylons) for (const s of sim.ships) s.alive = true;
        const ev = sim.loop(input({ count256: i & 0xff, sectorZylons }));
        if (ev.some((e) => e.type === 'meteorSpawned')) {
          spawned++;
          if (sectorZylons) expect(i & 3).not.toBe(0); // the fourth loop steers a ship instead
        }
        if (!sectorZylons || (i & 3) !== 0) tries++;
      }
      return spawned / tries;
    };
    for (const r of [rate(0), rate(2)]) {
      expect(r).toBeGreaterThan(2 / 256);
      expect(r).toBeLessThan(6 / 256);
    }
  });

  it('start 3840 KM ahead and fly straight at us at −8 KM per loop plus our speed', () => {
    const sim = new ZylonSim(createRng(9));
    let i = 0;
    while (!sim.loop(input({ count256: i & 0xff })).some((e) => e.type === 'meteorSpawned')) i++;
    const m = sim.pl2;
    expect(m.kind).toBe('meteor');
    expect(m.z).toBe(0x0f00);
    expect(Math.abs(m.x) % 256).toBe(0);
    const z = m.z;
    sim.loop(input({ count256: 1, velocity: 32 }));
    expect(m.z).toBe(z - METEOR_SPEED - 32);
  });

  it('a photon destroys a meteor (no score)', () => {
    const sim = new ZylonSim(createRng(1));
    Object.assign(sim.pl2, { kind: 'meteor', life: 60, x: 0, y: 0, z: 2000, vel: { x: 0, y: 0, z: -8 } });
    photonAt(sim, 0, 30, 1900);
    const ev = sim.loop(input({ count256: 1 }));
    expect(ev).toContainEqual({ type: 'shotDown', kind: 'meteor' });
    expect(ev.some((e) => e.type === 'zylonDestroyed')).toBe(false);
    expect(sim.pl2.life).toBe(0);
  });

  it('a meteor hit destroys the ship with shields down', () => {
    const sim = new ZylonSim(createRng(1));
    Object.assign(sim.pl2, { kind: 'meteor', life: 60, x: 0, y: 0, z: 100, vel: { x: 0, y: 0, z: -8 } });
    const ev = sim.loop(input({ count256: 1 }));
    expect(ev).toContainEqual({ type: 'shipHit', by: 'meteor', torpedoLife: 60 });
    const r = resolveShipHit({ shieldsUp: false, level: 'NOVICE', damage: allSystemsOk(), by: 'meteor', torpedoLife: 60, randomByte: () => 0 });
    expect(r.destroyed).toBe(true);
  });

  it('with shields up a meteor cannot damage at NOVICE, and always destroys a subsystem otherwise', () => {
    const novice = resolveShipHit({ shieldsUp: true, level: 'NOVICE', damage: allSystemsOk(), by: 'meteor', torpedoLife: 60, randomByte: () => 0 });
    expect(novice).toMatchObject({ destroyed: false, damage: null, energy: 100 });
    const pilot = resolveShipHit({ shieldsUp: true, level: 'PILOT', damage: allSystemsOk(), by: 'meteor', torpedoLife: 60, randomByte: () => 1 });
    expect(pilot.damage).toMatchObject({ system: 'engines', status: 'destroyed' });
  });
});

// §17.8: back attacks on WARRIOR and COMMANDER only; ships swing with our turns.
describe('Zylon flight', () => {
  it('back attacks happen only on WARRIOR and COMMANDER (about 19%)', () => {
    for (const level of ['NOVICE', 'PILOT', 'WARRIOR', 'COMMANDER'] as const) {
      const sim = new ZylonSim(createRng(21));
      let back = 0;
      let rolls = 0;
      for (let i = 0; i < 4000; i++) {
        sim.clear();
        run(sim, 12, { level, sectorZylons: 1 }); // creation, then the first milestone roll
        rolls++;
        if (sim.ships.some((s) => s.alive && s.backAttack)) back++;
      }
      if (level === 'NOVICE' || level === 'PILOT') expect(back).toBe(0);
      else expect(back / rolls).toBeCloseTo(48 / 256, 1);
    }
  });

  it('in the attack pattern a close ship weaves toward the cross hairs and dives to 2560 KM', () => {
    const sim = new ZylonSim(createRng(4));
    sim.spawn('fighter', { x: 3000, y: -3000, z: 5000 }, false);
    run(sim, 8, { sectorZylons: 1 });
    expect(sim.ships[0].milestone).toEqual({ x: 15, y: 0, z: 15 }); // left, up, inbound
  });

  it('velocity indices follow the stick (the ROM adds JOYSTICKX in front, subtracts aft)', () => {
    const sim = new ZylonSim(createRng(4));
    sim.spawn('fighter', { x: 0, y: 0, z: 20000 }, false);
    const s = sim.ships[0];
    s.velIndex = { x: 7, y: 7, z: 7 };
    s.followTimer = { x: 0, y: 0 };
    sim.loop(input({ turn: { x: 1, y: 0 }, count256: 1, sectorZylons: 1 }));
    expect(s.velIndex.x).toBe(8);
    s.followTimer.x = 0;
    sim.loop(input({ turn: { x: 1, y: 0 }, view: 'AFT', count256: 1, sectorZylons: 1 }));
    expect(s.velIndex.x).toBe(7);
  });
});
