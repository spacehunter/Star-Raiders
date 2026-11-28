/**
 * Rank insignia for the debrief card (MANUAL_SPEC §14.3: "NOVICE = gold zig-zag; PILOT = gold
 * bar; WARRIOR = gold lightning bolt; COMMANDER = lightning bolt with a star, each on a dark disc
 * with a blue-green glow").
 *
 * These are code-drawn placeholders on a 32 × 32 pixel grid. To swap in art (Phase 13), put an
 * image URL in INSIGNIA_ART for a kind: drawInsignia draws the image instead, scaled to the cell.
 */
import type { Rank } from '../rules/rating';

export type InsigniaKind = 'gag' | 'novice' | 'pilot' | 'warrior' | 'commander';

/** Phase 13 hook: image URLs that replace the code-drawn insignia, by kind. */
export const INSIGNIA_ART: Partial<Record<InsigniaKind, string>> = {};

/** Size of the insignia cell in native pixels. */
export const INSIGNIA_SIZE = 32;

/** Which of the manual's four insignia a rank wears (the two gag ranks get a plain disc). */
export function insigniaKind(rank: Rank | string): InsigniaKind {
  switch (rank) {
    case 'ROOKIE':
    case 'NOVICE':
      return 'novice';
    case 'ENSIGN':
    case 'PILOT':
      return 'pilot';
    case 'ACE':
    case 'LIEUTENANT':
    case 'WARRIOR':
      return 'warrior';
    case 'CAPTAIN':
    case 'COMMANDER':
    case 'STAR COMMANDER':
      return 'commander';
    default:
      return 'gag';
  }
}

const GOLD = '#FCE08C'; // ROM $FC
const GOLD_DARK = '#B07818';
const GLOW = ['#0E3A34', '#1C6A5A', '#3CA884']; // blue-green glow, outside in
const DISC = '#0A0E1C';

/** Pixel art for the emblem on the disc: '#' gold, '+' dark gold. 16 × 16, centred. */
const EMBLEM: Record<InsigniaKind, readonly string[]> = {
  gag: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....++++++++....',
    '....++++++++....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  novice: [
    '................',
    '................',
    '................',
    '................',
    '#...##...##...#.',
    '##.####.####.##.',
    '.####.####.####.',
    '..##...##...##..',
    '................',
    '#...##...##...#.',
    '##.####.####.##.',
    '.####.####.####.',
    '..##...##...##..',
    '................',
    '................',
    '................',
  ],
  pilot: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '..############..',
    '..############..',
    '..++++++++++++..',
    '................',
    '..############..',
    '..############..',
    '..++++++++++++..',
    '................',
    '................',
    '................',
    '................',
  ],
  warrior: [
    '................',
    '.........####...',
    '........####....',
    '.......####.....',
    '......####......',
    '.....####.......',
    '....#########...',
    '...#########....',
    '.......####.....',
    '......####......',
    '.....####.......',
    '....###.........',
    '...##...........',
    '..#.............',
    '................',
    '................',
  ],
  commander: [
    '.............#..',
    '..........#.###.',
    '.........#######',
    '........####.###',
    '.......####..#.#',
    '......####......',
    '.....#########..',
    '....#########...',
    '........####....',
    '.......####.....',
    '......####......',
    '.....###........',
    '....##..........',
    '...#............',
    '................',
    '................',
  ],
};

const loaded = new Map<string, HTMLImageElement>();

/**
 * Draw a rank's insignia with its top-left at (x, y), INSIGNIA_SIZE native pixels square.
 * `onArtLoaded` is called once a swapped-in image finishes loading, so the caller can redraw.
 */
export function drawInsignia(ctx: CanvasRenderingContext2D, rank: Rank | string, x: number, y: number, onArtLoaded?: () => void): void {
  const kind = insigniaKind(rank);
  const art = INSIGNIA_ART[kind];
  if (art) {
    let img = loaded.get(art);
    if (!img) {
      img = new Image();
      img.src = art;
      loaded.set(art, img);
    }
    if (img.complete && img.naturalWidth) {
      ctx.drawImage(img, x, y, INSIGNIA_SIZE, INSIGNIA_SIZE);
      return;
    }
    if (onArtLoaded) img.addEventListener('load', onArtLoaded, { once: true });
  }
  // Glow rings and the dark disc.
  const c = INSIGNIA_SIZE / 2;
  for (let py = 0; py < INSIGNIA_SIZE; py++) {
    for (let px = 0; px < INSIGNIA_SIZE; px++) {
      const d = Math.hypot(px + 0.5 - c, py + 0.5 - c);
      let color: string | null = null;
      if (d < 11) color = DISC;
      else if (d < 12.5) color = GLOW[2];
      else if (d < 14) color = GLOW[1];
      else if (d < 15.5) color = GLOW[0];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }
  }
  const rows = EMBLEM[kind];
  for (let r = 0; r < rows.length; r++) {
    for (let col = 0; col < rows[r].length; col++) {
      const ch = rows[r][col];
      if (ch === '.') continue;
      ctx.fillStyle = ch === '#' ? GOLD : GOLD_DARK;
      ctx.fillRect(x + 8 + col, y + 8 + r, 1, 1);
    }
  }
}
