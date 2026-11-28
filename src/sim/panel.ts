/**
 * Control panel readouts and colours (MANUAL_SPEC §6, §5.9, §5.10, §17.1, §17.2, §17.3, §17.13;
 * R: PANELTXTTAB L10672, UPDPANEL L9772, SHOWCOORD/SHOWDIGITS L9941–10008, UPDSCREEN L7251,
 * FLUSHGAMELOOP L8792–8826, MAPTOBCD99 L8474).
 *
 *   row 1  `V:00 K:00 E:9999 T:0`
 *   row 2  ` θ:+00 Φ:+00 R:+000 `
 */
import { LOW_ENERGY_THRESHOLD } from '../rules/energy';
import type { SubsystemStatus } from '../rules/damage';

/**
 * R: MAPTOBCD99 — a byte 0..255 shown as 00..99: floor(100·b/256). The last entry is the
 * infinity sign plus a space (only the RANGE readout can reach it).
 */
export function mapTo99(byte: number): number {
  return Math.floor((100 * Math.max(0, Math.min(255, Math.floor(byte)))) / 256);
}

const two = (n: number) => String(n).padStart(2, '0');

/** V readout: velocity in KM/loop as metrons/second, ∞ in hyperspace (§17.1, §17.2). */
export function velocityReadout(velocityKm: number, hyperspace: boolean): string {
  return hyperspace ? '∞ ' : two(mapTo99(velocityKm));
}

/** K readout: Zylons destroyed, two digits. */
export function killsReadout(kills: number): string {
  return two(Math.max(0, Math.min(99, Math.floor(kills))));
}

/** E readout: four digits; the ROM blanks it when energy has run out (DECENERGY). */
export function energyReadout(energy: number): string {
  const e = Math.floor(energy);
  return e <= 0 ? '    ' : String(Math.min(9999, e)).padStart(4, '0');
}

/**
 * The ROM stores a coordinate as sign + 16 bits: v ≥ 0 is +v, v < 0 is 65536 + v with the sign
 * bit clear. SHOWCOORD inverts the high byte of negative values, so −1..−256 KM show as −00.
 */
function coordBytes(km: number): { positive: boolean; hi: number; lo: number } {
  const v = Math.max(-65536, Math.min(65535, Math.floor(km)));
  const positive = v >= 0;
  const raw = positive ? v : 65536 + v;
  const hi = raw >> 8;
  return { positive, hi: positive ? hi : hi ^ 0xff, lo: raw & 0xff };
}

/**
 * θ or Φ readout from the x or y coordinate in KM: sign and two digits in gradons
 * (high byte through MAPTOBCD99; $FF is nudged to $FE so it never shows ∞).
 */
export function angleReadout(km: number): string {
  const { positive, hi } = coordBytes(km);
  return `${positive ? '+' : '-'}${two(mapTo99(Math.min(hi, 0xfe)))}`;
}

/**
 * R readout from the z coordinate in KM: sign, two digits in centrons from the high byte, then a
 * coarse third digit 0–5 from the top four bits of the low byte. "+" is in front, "−" behind.
 * A high byte of $FF shows ∞ (the hyperwarp marker) and the third digit copies the blank.
 */
export function rangeReadout(km: number): string {
  const { positive, hi, lo } = coordBytes(km);
  const sign = positive ? '+' : '-';
  if (hi === 0xff) return `${sign}∞  `;
  return `${sign}${two(mapTo99(hi))}${mapTo99(lo >> 4)}`;
}

/**
 * The letter before the target digit (R: UPDSCREEN). The ROM's comment on `BEQ SKIP154` says
 * "Skip if Tracking Computer is on", but the code skips (keeps 'T') when ISTRACKCOMPON is zero,
 * i.e. off; on, it stores 'C'. That matches the manual: "T: changes to C: when on" (§5.10).
 */
export function trackLetter(trackingComputerOn: boolean): 'T' | 'C' {
  return trackingComputerOn ? 'C' : 'T';
}

/** §6 / §17.1: the panel warns below 1000 units (the thousands digit reads 0). */
export function isLowEnergy(energy: number): boolean {
  return Math.floor(energy) < LOW_ENERGY_THRESHOLD;
}

/** Atari colour registers the panel band and the space background take (§17.13). */
export type PanelBand = 0x90 | 0x44 | 0x26;
export type ShieldsColor = 0xa0 | 0x00;

export interface PanelColorInput {
  energy: number;
  /** The S switch (DRAINSHIELDS ≠ 0). */
  shieldsOn: boolean;
  shieldsStatus: SubsystemStatus;
}

/**
 * R: FLUSHGAMELOOP — the band and shields colours.
 *
 * Every loop COUNT256 goes up by one. The band is dark blue $90, or pink $44 while COUNT256 is
 * 128–255 and energy is below 1000: a flash of 128 loops pink, 128 loops blue. The colours are
 * stored only when COUNT256 is a multiple of 4 (the ROM's comment says 8; the code ANDs with 3).
 * With the shields switched on they show $A0, unless they are destroyed, or damaged and the
 * 200/256 roll fails: then space stays black and the band turns orange $26 ("shields out").
 */
export class PanelColors {
  public count256 = 0;
  public band: PanelBand = 0x90;
  public shields: ShieldsColor = 0x00;

  private readonly rng: () => number;

  constructor(rng: () => number) {
    this.rng = rng;
  }

  loop(s: PanelColorInput): void {
    this.count256 = (this.count256 + 1) & 0xff;
    let band: PanelBand = this.count256 >= 128 && isLowEnergy(s.energy) ? 0x44 : 0x90;
    if ((this.count256 & 3) !== 0) return;
    let shields: ShieldsColor = 0x00;
    if (s.shieldsOn) {
      shields = 0xa0;
      if (s.shieldsStatus === 'destroyed') shields = 0x00;
      else if (s.shieldsStatus === 'damaged' && Math.floor(this.rng() * 256) >= 200) shields = 0x00;
      if (shields === 0x00) band = 0x26;
    }
    this.shields = shields;
    this.band = band;
  }

  /** Shields are up and working (SHIELDSCOLOR not black): the hit test reads this. */
  get shieldsUp(): boolean {
    return this.shields !== 0x00;
  }
}
