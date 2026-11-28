/**
 * One fixed palette table: Atari colour register values from the ROM with approximate sRGB.
 * MANUAL_SPEC §17.13 (display and colours) and §18.2 (palette).
 */
export const ROM_RGB = {
  $00: '#000000', // space
  $AF: '#C8FFE8', // near stars, title line
  $AA: '#7CE0B8', // mid stars, blip, lock marks
  $A6: '#3CA884', // far stars, crosshairs, attack box
  $A0: '#00302A', // shields-on tint
  $42: '#8C2010', // red alert background
  $90: '#1C3C9C', // panel / chart-footer background
  $44: '#C04848', // panel low-energy flash
  $26: '#B06818', // panel shields-out ("yellow" in the manual)
  $B8: '#A8F0B8', // V, T, theta, digits; chart symbols; DC OK
  $5A: '#E890E0', // K, Phi label
  $FC: '#FCE08C', // E, R label, TARGETS, DC damaged
  $5E: '#FFB8FF', // STAR DATE, DC destroyed
  $9F: '#A0C8FF', // hyperwarp marker
  $4F: '#FFA898', // title line and near stars during a red alert (PF2, R: GAMELOOP step 16)
  $60: '#24105C', // title line and near stars while the red-alert background is lit
  $28: '#F0A040', // starbase (orange $2x, Phase 3 placeholder blob)
  $58: '#C070E0', // photon torpedoes (purple $5x)
  $0E: '#E0E0E0', // Zylon ships, near (grey/white $0x)
  $06: '#808080', // Zylon ships, far
} as const;

/**
 * Approximate sRGB of any Atari colour byte (hue in the high nibble, luminance in the low).
 * Used where the ROM picks random colours (hit flash, basestar flicker); fixed elements use
 * ROM_RGB above.
 */
export function atariColor(byte: number): string {
  const hue = (byte >> 4) & 0x0f;
  const lum = byte & 0x0f;
  const l = Math.round(6 + lum * 5.6);
  if (hue === 0) return `hsl(0 0% ${l}%)`;
  const angle = (((55 - (hue - 1) * 25.7) % 360) + 360) % 360;
  return `hsl(${angle.toFixed(0)} 70% ${l}%)`;
}

/** Colours of the Galactic Chart (§8, §17.3, §17.13, §18.1). */
export const CHART_COLORS = {
  /**
   * Chart field. The ROM register is $90, but every manual photo prints it sky blue; this is
   * the photo's blue so the chart reads like the manual (MANUAL_SPEC §18.1 "sky-blue field").
   */
  field: '#1670A8',
  /** §5.9: the chart turns yellow when the shields are damaged or destroyed (ROM $26). */
  fieldShieldsDamaged: ROM_RGB.$26,
  titleBand: ROM_RGB.$00,
  title: ROM_RGB.$AF,
  /** Grid and symbols: the manual photo shows them white. */
  grid: '#F4FFF8',
  symbol: '#F4FFF8',
  dot: '#F4FFF8',
  warpEnergy: ROM_RGB.$B8,
  targets: ROM_RGB.$FC,
  dcLabel: ROM_RGB.$B8,
  dcOk: ROM_RGB.$B8,
  dcDamaged: ROM_RGB.$FC,
  dcDestroyed: ROM_RGB.$5E,
  starDate: ROM_RGB.$5E,
} as const;
