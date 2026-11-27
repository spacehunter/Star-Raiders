/**
 * Seeded random number generator (mulberry32).
 *
 * Every random draw in the game goes through `random()` so a run can be replayed
 * exactly from its seed. Pass `?seed=<n>` in the URL to pick the seed; otherwise a
 * fresh one is chosen at startup, so normal play is as varied as before.
 */

export type RandomFn = () => number;

/** Create an independent generator returning floats in [0, 1). */
export function createRng(seed: number): RandomFn {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function freshSeed(): number {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) {
    return c.getRandomValues(new Uint32Array(1))[0];
  }
  return (Date.now() ^ 0x9e3779b9) >>> 0;
}

function seedFromUrl(): number | null {
  const loc = (globalThis as { location?: Location }).location;
  if (!loc) return null;
  const raw = new URLSearchParams(loc.search).get('seed');
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n >>> 0 : null;
}

let currentSeed = seedFromUrl() ?? freshSeed();
let generator = createRng(currentSeed);

/** Float in [0, 1) from the shared game generator. Drop-in for Math.random(). */
export function random(): number {
  return generator();
}

/** Reset the shared generator to a seed. */
export function setSeed(seed: number): void {
  currentSeed = seed >>> 0;
  generator = createRng(currentSeed);
}

/** The seed the shared generator was last reset to. */
export function getSeed(): number {
  return currentSeed;
}
