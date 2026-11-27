import { describe, expect, it } from 'vitest';
import {
  CLASS_TAB,
  DAMAGE_CHANCE_256,
  ENGINE_DRAIN_TAB,
  GAG_RANKS,
  LEVELS,
  LOOP_DRAIN,
  MANUAL_DRAIN_UNITS_PER_SECOND,
  MANUAL_ENGINE_UNITS_PER_SECOND,
  MANUAL_LOOPS_PER_SECOND,
  MANUAL_RANKS,
  MANUAL_V_TAB,
  MANUAL_WARP_COST,
  MISSION_BONUS,
  MSG,
  RANK_TAB,
  START_ENERGY,
  SUBUNITS_PER_UNIT,
  VELOCITY_TAB,
  WARP_ENERGY_TAB,
  ZYLON_TORPEDO_HOMING,
  allSystemsOk,
  calcWarp,
  calcWarpSectors,
  hyperwarpSteeringRequired,
  panelV,
  panelVForKey,
  rollDamage,
  starbaseCount,
  zylonCount,
} from './index';

describe('§5.1 / §17.1 speed table', () => {
  it('V on the panel matches the manual for every key', () => {
    expect(VELOCITY_TAB.map(panelV)).toEqual([...MANUAL_V_TAB]);
    expect(MANUAL_V_TAB).toEqual([0, 0, 0, 1, 3, 6, 12, 25, 37, 43]);
  });

  it('speed 6 is V12', () => {
    expect(panelVForKey(6)).toBe(12);
  });

  it('Zylon top speed key 7 is V25', () => {
    expect(panelVForKey(7)).toBe(25);
  });
});

describe('§12.2 / §17.1 engine drain', () => {
  it('manual units/second = ROM subunits per loop at 64 loops/s', () => {
    const fromRom = ENGINE_DRAIN_TAB.map((d) => (d * MANUAL_LOOPS_PER_SECOND) / SUBUNITS_PER_UNIT);
    expect(fromRom).toEqual([...MANUAL_ENGINE_UNITS_PER_SECOND]);
  });

  it('speed 6 drains 3.5 units/s', () => {
    expect(MANUAL_ENGINE_UNITS_PER_SECOND[6]).toBe(3.5);
  });

  it('manual table §12.2', () => {
    expect(MANUAL_ENGINE_UNITS_PER_SECOND).toEqual([0, 1, 1.5, 2, 2.5, 3, 3.5, 7.5, 11.25, 15]);
  });
});

describe('§12.1 / §17.1 per-loop drains', () => {
  it('shields 2/s, computer ½/s, life support ¼/s', () => {
    const perSecond = (sub: number) => (sub * MANUAL_LOOPS_PER_SECOND) / SUBUNITS_PER_UNIT;
    expect(perSecond(LOOP_DRAIN.shields)).toBe(MANUAL_DRAIN_UNITS_PER_SECOND.shields);
    expect(perSecond(LOOP_DRAIN.computer)).toBe(MANUAL_DRAIN_UNITS_PER_SECOND.computer);
    expect(perSecond(LOOP_DRAIN.lifeSupport)).toBe(MANUAL_DRAIN_UNITS_PER_SECOND.lifeSupport);
    expect(MANUAL_DRAIN_UNITS_PER_SECOND).toMatchObject({ enemyHit: 100, photon: 10, shields: 2, computer: 0.5, lifeSupport: 0.25 });
  });

  it('every mission starts with 9999', () => {
    expect(START_ENERGY).toBe(9999);
  });
});

describe('§12.3 / §17.5 warp energy and CALCWARP', () => {
  it('ROM table × 10 is the manual table', () => {
    expect(WARP_ENERGY_TAB.map((w) => w * 10)).toEqual([...MANUAL_WARP_COST]);
    expect(MANUAL_WARP_COST).toHaveLength(24);
  });

  it('a 5-sector warp costs 500', () => {
    expect(calcWarpSectors(8, 4, 13, 4).units).toBe(500);
    expect(calcWarpSectors(8, 4, 10, 7).units).toBe(500); // 2 across + 3 down
  });

  it('every sector distance 0..22 on the 16×8 chart costs the manual value', () => {
    for (let d = 0; d <= 22; d++) {
      const dx = Math.min(d, 15);
      const dy = d - dx;
      expect(calcWarpSectors(0, 0, dx, dy).units).toBe(MANUAL_WARP_COST[d]);
    }
  });

  it('a jump inside the sector costs 100', () => {
    expect(calcWarpSectors(3, 3, 3, 3)).toEqual({ distance: 0, warpEnergy: 10, units: 100 });
  });

  it('rows count half: DISTANCE = |Δrow|/2 + |Δcol|, plus DISTANCE & 3', () => {
    // 1 column + 2 rows off a sector boundary: distance 8 + 1 + 1 = 10 -> 130 + 2×10
    const c = calcWarp(0, 0, 9, 18);
    expect(c.distance).toBe(18);
    expect(c.warpEnergy).toBe(WARP_ENERGY_TAB[2] + 2);
    expect(c.units).toBe(180);
  });
});

describe('§14.2 M table and §14.3 / §17.10 ranks and classes', () => {
  it('M values', () => {
    expect(MISSION_BONUS).toEqual({
      NOVICE: { complete: 80, aborted: 60, destroyed: 40 },
      PILOT: { complete: 76, aborted: 60, destroyed: 50 },
      WARRIOR: { complete: 60, aborted: 50, destroyed: 40 },
      COMMANDER: { complete: 111, aborted: 100, destroyed: 90 },
    });
  });

  it('RANKTAB covers the manual ranges in 16-point bins', () => {
    for (const { rank, min, max } of [...GAG_RANKS, ...MANUAL_RANKS]) {
      for (let s = min; s <= max; s++) expect(RANK_TAB[s >> 4]).toBe(rank);
    }
    expect(RANK_TAB).toHaveLength(19);
  });

  it('CLASSTAB splits 16 class indices into classes 5..1', () => {
    expect(CLASS_TAB).toEqual([5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1]);
  });
});

describe('§15 / §17.4 counts per level', () => {
  it('Zylons 27/36/45/54 and starbases 3/4/5/6', () => {
    expect(LEVELS.map(zylonCount)).toEqual([27, 36, 45, 54]);
    expect(LEVELS.map(starbaseCount)).toEqual([3, 4, 5, 6]);
  });

  it('steering is automatic only at NOVICE', () => {
    expect(LEVELS.map(hyperwarpSteeringRequired)).toEqual([false, true, true, true]);
  });
});

describe('§17.7 Zylon homing per level', () => {
  it('1 / 4 / 8 / 20', () => {
    expect(LEVELS.map((l) => ZYLON_TORPEDO_HOMING[l])).toEqual([1, 4, 8, 20]);
  });
});

describe('§17.3 damage', () => {
  it('chance 0 / 80 / 180 / 254 of 256', () => {
    expect(DAMAGE_CHANCE_256).toEqual([0, 80, 180, 254]);
    expect(DAMAGE_CHANCE_256.map((c) => Math.round((c / 256) * 100))).toEqual([0, 31, 70, 99]);
  });

  it('NOVICE never takes damage', () => {
    for (let b = 0; b < 256; b++) expect(rollDamage('NOVICE', allSystemsOk(), 62, () => b)).toBeNull();
  });

  it('one byte decides chance and slot; slots 6 and 7 harm nothing', () => {
    expect(rollDamage('PILOT', allSystemsOk(), 0, () => 0x00)?.system).toBe('photons');
    expect(rollDamage('PILOT', allSystemsOk(), 0, () => 0x05)?.system).toBe('radio');
    expect(rollDamage('PILOT', allSystemsOk(), 0, () => 0x06)).toBeNull();
    expect(rollDamage('PILOT', allSystemsOk(), 0, () => 80)).toBeNull(); // 80 >= 80
    expect(rollDamage('WARRIOR', allSystemsOk(), 0, () => 80)?.system).toBe('photons');
  });

  it('PILOT harms a system on 60 of 256 bytes (80 below chance, 2 of 8 slots empty)', () => {
    let harmed = 0;
    for (let b = 0; b < 256; b++) if (rollDamage('PILOT', allSystemsOk(), 0, () => b)) harmed++;
    expect(harmed).toBe(60);
  });

  it('close torpedoes (life ≥ 30) destroy; messages name the system', () => {
    const r = rollDamage('COMMANDER', allSystemsOk(), 30, () => 0x04);
    expect(r).toEqual({ system: 'sectorScan', status: 'destroyed', messages: ['DAMAGE CONTROL', 'SECTOR SCAN DESTROYED'] });
    expect(rollDamage('COMMANDER', allSystemsOk(), 29, () => 0x01)?.messages).toEqual(['DAMAGE CONTROL', 'ENGINES DAMAGED']);
  });

  it('computer and sector scan are never both destroyed', () => {
    const s = { ...allSystemsOk(), sectorScan: 'destroyed' as const };
    expect(rollDamage('COMMANDER', s, 62, () => 0x03)?.status).toBe('damaged');
  });

  it('an already destroyed system makes the ROM draw again', () => {
    const s = { ...allSystemsOk(), photons: 'destroyed' as const };
    const bytes = [0x00, 0x02];
    expect(rollDamage('COMMANDER', s, 0, () => bytes.shift()!)?.system).toBe('shields');
  });
});

describe('message strings', () => {
  it('ROM spellings', () => {
    expect(MSG.SUBSYSTEM.radio.destroyed).toBe('SUB-SPACE RADIO DESTROYED');
    expect(MSG.ORBIT_ESTABLISHED).toBe('ORBIT ESTABLISHED');
    expect(MSG.WHATS_WRONG).toBe('WHATS WRONG?');
    expect(MSG.MISSION.COMMANDER).toBe('COMMANDER MISSION');
  });
});
