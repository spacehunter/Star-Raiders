#!/usr/bin/env node
/**
 * Deterministic screenshot capture for Star Raiders.
 *
 *   node scripts/capture.mjs [--seed 1979] [--out captures/seed-1979] [--difficulty NOVICE]
 *                            [--width 1280] [--height 800] [--url http://localhost:5173/]
 *                            [--query "stars=enhanced&crt=1"]   (extra URL parameters, e.g. settings)
 *
 * Starts its own Vite dev server (unless --url is given), opens the game headless with
 * ?debug=1&seed=<seed>, freezes the page clock (Date, performance.now, timers and
 * requestAnimationFrame) and drives the game only through window.__sr.step(), so the
 * same seed always gives the same pixels. Writes the standard shots:
 *
 *   01-title  02-front  02a-front-crosshair  02b-shields  02c-red-alert  03-aft  04-galactic-chart  04a-chart-surrounded
 *   04b-chart-surround-holding  04c-chart-starbase-destroyed  04d-chart-damage
 *   05-long-range-scan  06-attack-computer  07-hyperwarp  08-docking  09-zero-energy
 *
 * plus manifest.json with each file's SHA-256. Later phases reuse this script; add new
 * shots to SHOTS below rather than writing another harness.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const opts = { seed: 1979, difficulty: 'NOVICE', width: 1280, height: 800, out: null, url: null, query: '' };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (!(key in opts)) throw new Error(`Unknown option --${key}`);
    const value = argv[++i];
    opts[key] = ['seed', 'width', 'height'].includes(key) ? Number(value) : value;
  }
  opts.out = resolve(opts.out ?? join(ROOT, 'captures', `seed-${opts.seed}`));
  return opts;
}

/** Each shot runs in page context order; state carries over from the previous shot. */
const SHOTS = [
  { name: '01-title', run: async () => {} },
  {
    name: '02-front',
    run: async (sr, o) => {
      await sr((d) => {
        window.__sr.start(d.difficulty, d.seed);
        window.__sr.step(60);
      }, o);
    },
  },
  // Phase 3 (MANUAL_SPEC §5.3, §17.6, §17.13): C shows the cross hairs; shields tint; red alert.
  {
    name: '02a-front-crosshair',
    run: async (sr) => sr(() => { window.__sr.press('COMPUTER'); window.__sr.step(70); }),
  },
  { name: '02b-shields', run: async (sr) => sr(() => { window.__sr.setShields(true); window.__sr.step(2); }) },
  {
    name: '02c-red-alert',
    run: async (sr) =>
      sr(() => {
        window.__sr.setShields(false);
        window.__sr.redAlert(120); // bit 5 set: the dark red background half of the flash
        window.__sr.step(2);
      }),
  },
  {
    name: '03-aft',
    run: async (sr) => sr(() => { window.__sr.redAlert(0); window.__sr.setView('AFT'); window.__sr.step(30); }),
  },
  {
    name: '04-galactic-chart',
    run: async (sr) => sr(() => { window.__sr.setView('GALACTIC_CHART'); window.__sr.step(10); }),
  },
  // Phase 2 (MANUAL_SPEC §8.2, §17.4): a starbase surrounded, then destroyed 1.00 star date later.
  {
    name: '04a-chart-surrounded',
    run: async (sr) =>
      sr(() => {
        const base = window.__sr.surround();
        if (base) window.__sr.moveCursor(base.x, base.y);
        window.__sr.toFleetTick(1); // star date 1.00: STARBASE SURROUNDED
        window.__sr.step(1);
      }),
  },
  {
    name: '04b-chart-surround-holding',
    run: async (sr) => sr(() => { window.__sr.toFleetTick(1); window.__sr.step(1); }), // 1.50: still standing
  },
  {
    name: '04c-chart-starbase-destroyed',
    run: async (sr) => sr(() => { window.__sr.toFleetTick(1); window.__sr.step(1); }), // 2.00: a 2-Zylon sector
  },
  {
    // §7 / §17.3 / §5.9: DC letters in all three states, shields damaged turn the chart yellow.
    name: '04d-chart-damage',
    run: async (sr) =>
      sr(() => {
        window.__sr.setDamage('photons', 'damaged');
        window.__sr.setDamage('computer', 'destroyed');
        window.__sr.setDamage('shields', 'damaged');
        window.__sr.step(1);
      }),
  },
  {
    name: '05-long-range-scan',
    run: async (sr) =>
      sr(() => {
        for (const sys of ['photons', 'computer', 'shields']) window.__sr.setDamage(sys, 'ok');
        // Jump to the first sector holding Zylons so the scan has something on it.
        const target = window.__sr.galaxy().find((s) => s.zylons > 0);
        if (target) window.__sr.teleport(target);
        window.__sr.setView('LONG_RANGE_SCAN');
        window.__sr.step(30);
      }),
  },
  {
    name: '06-attack-computer',
    run: async (sr) =>
      sr(() => {
        window.__sr.setView('FRONT');
        window.__sr.spawn('fighter', 40);
        window.__sr.step(20);
      }),
  },
  {
    name: '07-hyperwarp',
    run: async (sr) =>
      sr(() => {
        const s = window.__sr.state;
        window.__sr.hyperwarp((s.sectorX + 3) % 16, s.sectorY);
        window.__sr.step(120);
      }),
  },
  {
    name: '08-docking',
    run: async (sr) =>
      sr(() => {
        window.__sr.step(300); // let the hyperwarp finish
        window.__sr.dock();
        window.__sr.step(50);
      }),
  },
  {
    // Phase 1: energy really runs out and aborts the mission (MANUAL_SPEC §12, §17.1, §17.10).
    name: '09-zero-energy',
    run: async (sr) =>
      sr(() => {
        window.__sr.step(200); // let the docking finish
        window.__sr.setView('FRONT');
        window.__sr.setEnergy(40);
        window.__sr.setShields(true);
        window.__sr.setSpeed(9);
        window.__sr.step(400);
      }),
  },
];

async function startServer() {
  const { createServer } = await import('vite');
  const server = await createServer({
    root: ROOT,
    logLevel: 'error',
    server: { port: 0, strictPort: false, host: '127.0.0.1' },
  });
  await server.listen();
  const url = server.resolvedUrls?.local?.[0];
  if (!url) throw new Error('Vite did not report a URL');
  return { server, url };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  await mkdir(opts.out, { recursive: true });

  let server = null;
  let browser = null;
  try {
    let base = opts.url;
    if (!base) ({ server, url: base } = await startServer());

    browser = await chromium.launch({
      headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', '--disable-gpu-rasterization'],
    });
    const context = await browser.newContext({
      viewport: { width: opts.width, height: opts.height },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    // Freeze time before any page script runs. The real-time loops never tick on their
    // own; the game advances only through __sr.step().
    const epoch = new Date('1980-01-01T00:00:00Z');
    await page.clock.install({ time: epoch });
    await page.clock.pauseAt(epoch);

    const url = new URL(base);
    url.searchParams.set('debug', '1');
    url.searchParams.set('seed', String(opts.seed));
    for (const [k, v] of new URLSearchParams(opts.query)) url.searchParams.set(k, v);
    await page.goto(url.toString(), { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__sr !== undefined);
    await page.evaluate(() => document.fonts.ready);

    const sr = (fn, arg) => page.evaluate(fn, arg);
    const manifest = { seed: opts.seed, difficulty: opts.difficulty, viewport: [opts.width, opts.height], shots: {} };

    for (const shot of SHOTS) {
      await shot.run(sr, { seed: opts.seed, difficulty: opts.difficulty });
      await page.evaluate(() => document.fonts.ready);
      const file = join(opts.out, `${shot.name}.png`);
      await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
      const hash = createHash('sha256').update(await readFile(file)).digest('hex');
      manifest.shots[shot.name] = hash;
      const st = await page.evaluate(() => {
        const s = window.__sr.state;
        return s && { energy: s.energy, starDate: s.starDate, score: s.score, loops: s.loops, outcome: s.missionOutcome, rating: s.rating?.title ?? null, zylons: s.remainingEnemies, starbases: s.starbasesLeft, chartTitle: s.chartTitle, chartRenders: s.chartRenders };
      });
      if (st) (manifest.state ??= {})[shot.name] = st;
      console.log(`${shot.name.padEnd(20)} ${hash.slice(0, 16)}${st ? `  E:${st.energy} STAR DATE:${st.starDate} score:${st.score}${st.rating ? ` ${st.outcome} -> ${st.rating}` : ''}` : ''}`);
    }

    if (errors.length) {
      manifest.pageErrors = errors;
      console.warn(`Page errors:\n  ${errors.join('\n  ')}`);
    }
    await writeFile(join(opts.out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(`Wrote ${SHOTS.length} shots to ${opts.out}`);
  } finally {
    await browser?.close();
    await server?.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
