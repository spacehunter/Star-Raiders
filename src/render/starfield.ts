/**
 * The starfield of the Front and Aft views (MANUAL_SPEC §17.13, §18.1; R: INITPOSVEC L9595,
 * RNDINVXY, GAMELOOP steps 8, 9, 12 and 17, FOURCOLORPIXEL L10457).
 *
 * The ROM keeps 12 single-pixel stars as points in the ship frame (KM). They rotate with the
 * stick and stream toward −z with the ship's velocity like every other space object. A star
 * that leaves the playfield (or, in the Aft view, falls more than 4096 KM behind) is replaced
 * by a new one at the far end of the view. Each star's colour comes from its distance and an
 * 8-loop counter, which makes the far ones twinkle.
 *
 * "Enhanced" (Part 4 bend 3) keeps the same rules with about 48 stars.
 */
import type { RandomFn } from '../core/rng';
import { moveInShipFrame, type Stick } from '../sim/motion';
import { projectPoint, type Pixel, type SpaceView } from './projection';

export const CLASSIC_STARS = 12;
export const ENHANCED_STARS = 48;

/** Playfield colour registers a star pixel can use: 1 = far ($A6), 2 = mid ($AA), 3 = near ($AF). */
export type StarColor = 1 | 2 | 3;

/** R: FOURCOLORPIXEL — 4 pixels of one colour per byte, indexed by range bits and COUNT8. */
export const FOURCOLORPIXEL: readonly number[] = [
  0xff, 0xff, 0xff, 0xff, 0xaa, 0xff, 0xaa, 0xff, 0xaa, 0xaa, 0xaa, 0xff, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0x55, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0x55, 0x55, 0xaa, 0x55, 0x55, 0x55, 0x55,
];

/**
 * Colour of a star pixel (0 = not drawn this loop): range index from the distance, combined
 * with the 8-loop counter (ORed in, as the ROM does), picks a byte; the pixel's column picks its
 * 2 bits (R step 17). Mid-range stars flicker between two colours as the counter runs.
 */
export function starColor(distanceKm: number, column: number, count8: number): StarColor | 0 {
  const range = Math.min(15, Math.floor(Math.abs(distanceKm) / 256));
  const byte = FOURCOLORPIXEL[((range << 1) & 0x1c) | (count8 & 7)];
  const shift = (3 - (column & 3)) * 2;
  return ((byte >> shift) & 3) as StarColor | 0;
}

export interface Star {
  x: number;
  y: number;
  z: number;
  /** Where it was drawn this loop, or null. */
  pixel: Pixel | null;
  color: StarColor | 0;
}

/** Aft-view stars further than this behind the ship are replaced (R step 17: z < −$F000). */
export const AFT_FAR_LIMIT = -4096;

/** R: INITTRAIL — trail stars use space objects 17..48: 32 slots, reused in a ring. */
export const TRAIL_SLOTS = 32;
/** R: INITTRAIL — 6 stars per trail, the first just beyond +4608 KM, then every +80 KM. */
export const TRAIL_STARS = 6;
export const TRAIL_START_Z = 0x1200;
export const TRAIL_STEP_Z = 80;
/** R: WARPSTARXTAB, WARPSTARYTAB — high bytes of a trail's x and y (signs random). */
export const WARP_STAR_X_HI = [0x04, 0x04, 0x03, 0x02] as const;
export const WARP_STAR_Y_HI = [0x02, 0x03, 0x04, 0x04] as const;

export class Starfield {
  public readonly stars: Star[] = [];
  /**
   * Hyperwarp star trails (§17.5, R: INITTRAIL): extra stars that exist from the star trail
   * phase until hyperspace. A trail star that leaves the view becomes an ordinary star, as the
   * ROM re-initialises any offscreen PLAYFIELD object.
   */
  public readonly trails: Star[] = [];
  private trailIndex = 0;

  private readonly rng: RandomFn;

  constructor(rng: RandomFn, count: number = CLASSIC_STARS, view: SpaceView = 'FRONT') {
    this.rng = rng;
    this.setCount(count, view);
  }

  /** Change the number of stars (Classic 12 / Enhanced 48). */
  setCount(count: number, view: SpaceView): void {
    this.stars.length = Math.min(this.stars.length, count);
    while (this.stars.length < count) {
      const s: Star = { x: 0, y: 0, z: 0, pixel: null, color: 0 };
      this.respawn(s, view);
      this.spread(s);
      this.stars.push(s);
    }
  }

  private byte(): number {
    return Math.floor(this.rng() * 256);
  }

  /** R: INITPOSVEC + RNDINVXY — a new star at the far end of the view. */
  respawn(s: Star, view: SpaceView): void {
    const rndY = this.byte() & 0x0f;
    const rndX = this.byte() & 0x0f;
    if (view === 'FRONT') {
      s.x = rndX * 256 + this.byte();
      s.y = rndY * 256 + this.byte();
      s.z = 0x0f00 + this.byte(); // +3840..+4095 KM
    } else {
      s.x = rndX * 256;
      s.y = rndY * 256;
      s.z = -Math.max(1, Math.max(rndX, rndY)) * 256 + 0x80; // −3712..−128 KM
    }
    if (this.byte() & 1) s.y = -s.y;
    if (this.byte() & 1) s.x = -s.x;
    s.pixel = null;
    s.color = 0;
  }

  /**
   * R: INITTRAIL — a new trail: 6 stars on one line of sight (the same x and y, picked from
   * WARPSTARXTAB/YTAB with random signs) at +4688..+5088 KM, standing still.
   */
  addTrail(): void {
    const i = this.byte() & 3;
    let x = WARP_STAR_X_HI[i] * 256 + this.byte();
    let y = WARP_STAR_Y_HI[i] * 256 + this.byte();
    if (this.byte() & 1) y = -y;
    if (this.byte() & 1) x = -x;
    for (let k = 1; k <= TRAIL_STARS; k++) {
      const s: Star = { x, y, z: TRAIL_START_Z + k * TRAIL_STEP_Z, pixel: null, color: 0 };
      if (this.trails.length < TRAIL_SLOTS) this.trails.push(s);
      else this.trails[this.trailIndex] = s;
      this.trailIndex = (this.trailIndex + 1) % TRAIL_SLOTS;
    }
  }

  /** R: CLEANUPWARP — back to the normal number of space objects: the trails are gone. */
  clearTrails(): void {
    this.trails.length = 0;
    this.trailIndex = 0;
  }

  /** Every star drawn this loop: the field plus any trail stars. */
  get all(): Star[] {
    return this.trails.length ? [...this.stars, ...this.trails] : this.stars;
  }

  /** Respawn every star for a new view (front ↔ aft). */
  resetFor(view: SpaceView): void {
    for (const s of this.stars) {
      this.respawn(s, view);
      this.spread(s);
    }
  }

  /**
   * A fresh field (new game or view) starts spread over the whole depth instead of all at the
   * far end: scaling the point toward the ship keeps its pixel but makes it nearer.
   */
  private spread(s: Star): void {
    const f = 0.15 + 0.85 * this.rng();
    s.x *= f;
    s.y *= f;
    s.z *= f;
  }

  /**
   * One game loop: rotate by the stick, move by `velocityKm` toward −z, project, replace the
   * stars that left the view and colour the rest.
   */
  loop(stick: Stick, velocityKm: number, view: SpaceView, count8: number): void {
    for (const s of this.all) {
      moveInShipFrame(s, stick, velocityKm);
      if (view === 'AFT' && s.z < AFT_FAR_LIMIT) this.respawn(s, view);
      let px = projectPoint(s.x, s.y, s.z, view);
      // A few new spots can themselves fall just off screen (the ROM retries on the next loop).
      for (let tries = 0; !px && tries < 8; tries++) {
        this.respawn(s, view);
        px = projectPoint(s.x, s.y, s.z, view);
      }
      s.pixel = px;
      s.color = px ? starColor(s.z, px.col, count8) : 0;
    }
  }
}
