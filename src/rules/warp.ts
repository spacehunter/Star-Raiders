/**
 * Hyperwarp energy table and CALCWARP.
 * MANUAL_SPEC §12.3 (cost by distance) and §17.5 (ROM CALCWARP).
 */

/** §17.5 WARPENERGYTAB: hyperwarp energy / 10, indexed by block distance in sectors. */
export const WARP_ENERGY_TAB = [
  10, 13, 16, 20, 23, 50, 70, 80, 90, 120, 125, 130, 135, 140, 155, 170, 184, 200, 208, 216, 223, 232,
  241, 250,
] as const;

/** §12.3: hyperwarp cost in units as printed in the manual, for 0..23 sectors. */
export const MANUAL_WARP_COST = [
  100, 130, 160, 200, 230, 500, 700, 800, 900, 1200, 1250, 1300, 1350, 1400, 1550, 1700, 1840, 2000,
  2080, 2160, 2230, 2320, 2410, 2500,
] as const;

/**
 * Chart marker units: one sector is 8 Player/Missile columns wide and 16 single-line rows high
 * (§17.5; the ROM halves DELTAR because single-line PM pixels are half as high as wide).
 */
export const CHART_COLUMN_UNITS = 8;
export const CHART_ROW_UNITS = 16;

export interface WarpCost {
  /** DISTANCE = |Δrow| / 2 + |Δcol| in chart units. */
  distance: number;
  /** WARPENERGY: hyperwarp energy / 10, also the hyperspace length in loops + 1. */
  warpEnergy: number;
  /** Energy shown on the chart as WARP ENERGY (warpEnergy × 10). */
  units: number;
}

/**
 * ROM CALCWARP on marker positions in chart units (column, row).
 * WARPENERGY = WARPENERGYTAB[DISTANCE / 8] + (DISTANCE & 3).
 */
export function calcWarp(depColumn: number, depRow: number, arrColumn: number, arrRow: number): WarpCost {
  const deltaC = Math.abs(arrColumn - depColumn);
  const deltaR = Math.abs(arrRow - depRow);
  const distance = (deltaR >> 1) + deltaC;
  const index = Math.min(distance >> 3, WARP_ENERGY_TAB.length - 1);
  const warpEnergy = WARP_ENERGY_TAB[index] + (distance & 3);
  return { distance, warpEnergy, units: warpEnergy * 10 };
}

/** CALCWARP between two sector positions on the 16 × 8 chart (markers at the same spot in each sector). */
export function calcWarpSectors(fromX: number, fromY: number, toX: number, toY: number): WarpCost {
  return calcWarp(
    fromX * CHART_COLUMN_UNITS,
    fromY * CHART_ROW_UNITS,
    toX * CHART_COLUMN_UNITS,
    toY * CHART_ROW_UNITS
  );
}

/**
 * §17.5 R: VEERMASKTAB ($BED7) — sign-magnitude masks for the hyperwarp marker's random veer-off
 * velocity: ±16..31, ±16..63, ±16..95, ±16..127 KM per loop. The ROM's comment ties the entries
 * to the mission level, but the code (KEYBOARD 'H', L7303) indexes the table with bits 7..6 of
 * WARPENERGY: the kicks grow with the cost of the jump (MANUAL_SPEC §17.5 code ≠ comment).
 */
export const VEER_MASK_TAB = [0x9f, 0xbf, 0xdf, 0xff] as const;

/** VEERMASK for a jump: 0 on NOVICE (no drift, "hyperwarp automatically", §9), else by WARPENERGY. */
export function veerMask(steeringRequired: boolean, warpEnergy: number): number {
  if (!steeringRequired) return 0;
  return VEER_MASK_TAB[(warpEnergy >> 6) & 3];
}

/** A random veer-off velocity: (RANDOM OR $10) AND VEERMASK, read as sign-magnitude (bit 7 = minus). */
export function veerVelocity(randomByte: number, mask: number): number {
  const v = (randomByte | 0x10) & mask;
  return v & 0x80 ? -(v & 0x7f) : v & 0x7f;
}
