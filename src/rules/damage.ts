/**
 * Damage probabilities and the damage roll.
 * MANUAL_SPEC §7 (Damage Control), §15 (NOVICE takes no damage), §17.3 (ROM DAMAGE).
 */
import type { MissionLevel } from './levels';
import { levelIndex } from './levels';
import { MSG } from './messages';

/** §17.3 DAMAGEPROBTAB: chance (out of 256) that a hit harms a subsystem, per level. */
export const DAMAGE_CHANCE_256 = [0, 80, 180, 254] as const;

/** Subsystems in ROM order, matching the DC:PESCLR letters (§7). */
export const SUBSYSTEMS = ['photons', 'engines', 'shields', 'computer', 'sectorScan', 'radio'] as const;
export type Subsystem = (typeof SUBSYSTEMS)[number];

/** DC:PESCLR letter per subsystem (§7). */
export const SUBSYSTEM_LETTER: Readonly<Record<Subsystem, string>> = {
  photons: 'P',
  engines: 'E',
  shields: 'S',
  computer: 'C',
  sectorScan: 'L',
  radio: 'R',
};

/** §17.3: one of 8 slots is picked; slots 6 and 7 harm nothing (the built-in 2:8 miss). */
export const DAMAGE_SLOTS = 8;

/** §17.3: a Zylon torpedo with ≥ 30 loops of life left destroys instead of damaging. */
export const DESTROY_MIN_TORPEDO_LIFE = 30;

export type SubsystemStatus = 'ok' | 'damaged' | 'destroyed';
export type DamageStatus = Record<Subsystem, SubsystemStatus>;

export function allSystemsOk(): DamageStatus {
  return { photons: 'ok', engines: 'ok', shields: 'ok', computer: 'ok', sectorScan: 'ok', radio: 'ok' };
}

export interface DamageResult {
  system: Subsystem;
  status: 'damaged' | 'destroyed';
  /** Title-line phrases in order: DAMAGE CONTROL, then e.g. PHOTONS DAMAGED. */
  messages: string[];
}

/**
 * ROM DAMAGE. `randomByte` returns an integer 0..255 (the POKEY RANDOM register).
 * One draw decides both "is anything harmed" (byte < chance) and the slot (byte & 7);
 * an already destroyed system makes the ROM draw again. `torpedoLife` is the Zylon
 * torpedo's remaining life in loops; meteors pass 255 so they always destroy.
 * Returns null when nothing is harmed. Does not mutate `status`.
 */
export function rollDamage(
  level: MissionLevel,
  status: DamageStatus,
  torpedoLife: number,
  randomByte: () => number
): DamageResult | null {
  const chance = DAMAGE_CHANCE_256[levelIndex(level)];
  for (;;) {
    const r = randomByte() & 0xff;
    if (r >= chance) return null;
    const slot = r & 0x07;
    if (slot >= SUBSYSTEMS.length) return null;
    const system = SUBSYSTEMS[slot];
    if (status[system] === 'destroyed') continue;

    let destroy = torpedoLife >= DESTROY_MIN_TORPEDO_LIFE;
    // The computer and the sector scan are never both destroyed.
    if (destroy && system === 'computer' && status.sectorScan === 'destroyed') destroy = false;
    if (destroy && system === 'sectorScan' && status.computer === 'destroyed') destroy = false;

    const result = destroy ? 'destroyed' : 'damaged';
    return { system, status: result, messages: [MSG.DAMAGE_CONTROL, MSG.SUBSYSTEM[system][result]] };
  }
}
