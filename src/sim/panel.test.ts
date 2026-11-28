import { describe, expect, it } from 'vitest';
import {
  PanelColors,
  angleReadout,
  energyReadout,
  isLowEnergy,
  killsReadout,
  mapTo99,
  rangeReadout,
  trackLetter,
  velocityReadout,
} from './panel';
import { VELOCITY_TAB, MANUAL_V_TAB } from '../rules/speed';

// MANUAL_SPEC §2 (gradons, centrons), §6, §17.2; R: SHOWCOORD, SHOWDIGITS, MAPTOBCD99.
describe('MAPTOBCD99', () => {
  it('maps a byte to 00..99 as floor(100·b/256)', () => {
    expect([0, 1, 2, 3, 128, 254, 255].map(mapTo99)).toEqual([0, 0, 0, 1, 50, 99, 99]);
  });
});

describe('V readout (§5.1, §17.1, §17.2)', () => {
  it('prints the manual V for each speed key once reached', () => {
    expect(VELOCITY_TAB.map((v) => velocityReadout(v, false))).toEqual(MANUAL_V_TAB.map((v) => String(v).padStart(2, '0')));
  });
  it('shows ∞ in hyperspace', () => {
    expect(velocityReadout(112, true)).toBe('∞ ');
  });
});

describe('θ and Φ readouts: sign and two digits in gradons', () => {
  it('is +00 at the centre and for anything closer than 256 KM on the plus side', () => {
    expect(angleReadout(0)).toBe('+00');
    expect(angleReadout(255)).toBe('+00');
  });
  it('reads the high byte of the coordinate through MAPTOBCD99', () => {
    expect(angleReadout(256 * 3)).toBe('+01'); // hi 3 -> 1
    expect(angleReadout(256 * 31)).toBe('+12'); // the manual's θ:+12
    expect(angleReadout(256 * 26)).toBe('+10'); // and Φ:+10
  });
  it('is minus for negative coordinates; the ROM inverts the high byte so −1..−256 KM read −00', () => {
    expect(angleReadout(-1)).toBe('-00');
    expect(angleReadout(-256)).toBe('-00');
    expect(angleReadout(-257)).toBe('-00'); // inverted hi 1 -> 0
    expect(angleReadout(-256 * 7)).toBe('-02'); // the manual photo's Φ:−02
  });
  it('never shows ∞: a high byte of $FF is nudged to $FE (99)', () => {
    expect(angleReadout(65535)).toBe('+99');
    expect(angleReadout(-65536)).toBe('-99');
  });
  it('is always a sign and two digits', () => {
    for (let v = -70000; v <= 70000; v += 997) expect(angleReadout(v)).toMatch(/^[+-]\d\d$/);
  });
});

describe('R readout: sign, two digits in centrons and a coarse third digit', () => {
  it('starts at +000', () => {
    expect(rangeReadout(0)).toBe('+000');
  });
  it('takes the third digit from the top four bits of the low byte, so it only runs 0–5', () => {
    const thirds = new Set<string>();
    for (let lo = 0; lo < 256; lo++) thirds.add(rangeReadout(lo)[3]);
    expect([...thirds].sort()).toEqual(['0', '1', '2', '3', '4', '5']);
    expect(rangeReadout(0xf0)).toBe('+005');
  });
  it('reads like the manual photos', () => {
    expect(rangeReadout(11 * 256 + 0xb0)).toBe('+044'); // hi 11 -> 04, lo $B0 -> 4
    expect(rangeReadout(604 * 256 / 10)).toMatch(/^\+23\d$/); // ≈ the manual's R:+236
  });
  it('is + in front and − behind the ship', () => {
    expect(rangeReadout(5000)[0]).toBe('+');
    expect(rangeReadout(-5000)[0]).toBe('-');
  });
  it('shows ∞ for a high byte of $FF (the hyperwarp marker), blanking the third digit', () => {
    expect(rangeReadout(0xff00)).toBe('+∞  ');
  });
});

describe('T / C letter (§5.10, §17.2; R: UPDSCREEN, code over comment)', () => {
  it('is T with the tracking computer off and C with it on', () => {
    expect(trackLetter(false)).toBe('T');
    expect(trackLetter(true)).toBe('C');
  });
});

describe('K and E readouts', () => {
  it('K is two digits', () => {
    expect(killsReadout(0)).toBe('00');
    expect(killsReadout(18)).toBe('18');
    expect(killsReadout(150)).toBe('99');
  });
  it('E is four digits and the ROM blanks it at zero energy', () => {
    expect(energyReadout(9999)).toBe('9999');
    expect(energyReadout(8260.7)).toBe('8260');
    expect(energyReadout(42)).toBe('0042');
    expect(energyReadout(0)).toBe('    ');
  });
});

describe('low-energy threshold (§6, §12, §17.1)', () => {
  it('warns below 1000 units, not at 1000', () => {
    expect(isLowEnergy(1000)).toBe(false);
    expect(isLowEnergy(999.9)).toBe(true);
    expect(isLowEnergy(999)).toBe(true);
    expect(isLowEnergy(1)).toBe(true);
  });
});

// R: FLUSHGAMELOOP L8792–8826.
describe('panel band colour', () => {
  const run = (energy: number, loops: number, shieldsOn = false, status: 'ok' | 'damaged' | 'destroyed' = 'ok', rng = () => 0) => {
    const c = new PanelColors(rng);
    const bands: number[] = [];
    for (let i = 0; i < loops; i++) {
      c.loop({ energy, shieldsOn, shieldsStatus: status });
      bands.push(c.band);
    }
    return { c, bands };
  };

  it('stays dark blue $90 at 1000 units and above', () => {
    expect(new Set(run(1000, 512).bands)).toEqual(new Set([0x90]));
  });

  it('below 1000 flashes pink $44 / blue $90, 128 loops each', () => {
    const { bands } = run(999, 512);
    expect(bands.slice(0, 127).every((b) => b === 0x90)).toBe(true); // COUNT256 1..127
    expect(bands.slice(127, 255).every((b) => b === 0x44)).toBe(true); // 128..255
    expect(bands.slice(255, 383).every((b) => b === 0x90)).toBe(true); // 0..127
    expect(bands.filter((b) => b === 0x44)).toHaveLength(256);
  });

  it('only stores colours every 4th loop (the code ANDs with 3; the comment says 8)', () => {
    const c = new PanelColors(() => 0);
    for (let i = 0; i < 3; i++) c.loop({ energy: 9999, shieldsOn: true, shieldsStatus: 'ok' });
    expect(c.shieldsUp).toBe(false);
    c.loop({ energy: 9999, shieldsOn: true, shieldsStatus: 'ok' });
    expect(c.count256).toBe(4);
    expect(c.shieldsUp).toBe(true);
    expect(c.band).toBe(0x90);
  });

  it('turns orange $26 with the shields switched on but destroyed (they never come up)', () => {
    const { c, bands } = run(9999, 64, true, 'destroyed');
    expect(bands.slice(3).every((b) => b === 0x26)).toBe(true);
    expect(c.shieldsUp).toBe(false);
  });

  it('damaged shields stay up on a roll below 200/256 and go out (orange) otherwise', () => {
    expect(run(9999, 8, true, 'damaged', () => 199 / 256).c.band).toBe(0x90);
    expect(run(9999, 8, true, 'damaged', () => 199 / 256).c.shieldsUp).toBe(true);
    expect(run(9999, 8, true, 'damaged', () => 200 / 256).c.band).toBe(0x26);
    expect(run(9999, 8, true, 'damaged', () => 200 / 256).c.shieldsUp).toBe(false);
  });

  it('shields switched off: black space, normal band (orange overrides the pink flash only when out)', () => {
    expect(run(9999, 8, false, 'destroyed').c.band).toBe(0x90);
    const low = run(500, 200, true, 'destroyed').bands;
    expect(low.slice(3).every((b) => b === 0x26)).toBe(true);
  });
});
