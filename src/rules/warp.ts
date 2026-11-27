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
