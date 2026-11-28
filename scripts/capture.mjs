#!/usr/bin/env node
/**
 * Deterministic screenshot capture for Star Raiders.
 *
 *   node scripts/capture.mjs [--seed 1979] [--out captures/seed-1979] [--difficulty NOVICE]
 *                            [--width 1280] [--height 800] [--url http://localhost:5173/]
 *                            [--query "stars=enhanced&crt=1"]   (extra URL parameters, e.g. settings)
 *                            [--sequence title-line]   (instead of the shots: numbered frames of a
 *                                                       timed sequence, e.g. for a GIF)
 *
 * Starts its own Vite dev server (unless --url is given), opens the game headless with
 * ?debug=1&seed=<seed>, freezes the page clock (Date, performance.now, timers and
 * requestAnimationFrame) and drives the game only through window.__sr.step(), so the
 * same seed always gives the same pixels. Writes the standard shots:
 *
 *   01-title  02-front  02a-front-crosshair  02b-shields  02c-red-alert  03-aft  04-galactic-chart  04a-chart-surrounded
 *   04b-chart-surround-holding  04c-chart-starbase-destroyed  04d-chart-damage
 *   05-long-range-scan  06-attack-computer  06a-attack-lock  06b-starbase-t2  07-hyperwarp  08-docking  10-panel-hud  10a-panel-tracking-c
 *   10b-panel-low-energy  10c-panel-shields-out  10d-panel-hyperspace  11-fighter-approach  11a-fighter-hit
 *   11b-explosion  12-meteor  12a-meteor-shot  13-fighter  13a-cruiser  13b-basestar
 *   09-zero-energy (last: mission end)
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
  const opts = { seed: 1979, difficulty: 'NOVICE', width: 1280, height: 800, out: null, url: null, query: '', sequence: null };
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
  // The ROM stores the shields colour every 4th loop (FLUSHGAMELOOP), so give it 4.
  { name: '02b-shields', run: async (sr) => sr(() => { window.__sr.setShields(true); window.__sr.step(4); }) },
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
    // Phase 6 (MANUAL_SPEC §5.3, §11, §17.6): the Attack Computer Display with the blip and the
    // A and B marks (x and y locked, not yet in range).
    name: '06-attack-computer',
    run: async (sr) =>
      sr(() => {
        window.__sr.setView('FRONT');
        window.__sr.spawn('fighter', 5000, 300, 200); // KM ahead: A and B, too far for C
        window.__sr.step(1);
        // Run to a finished blip with its marks up (a display cycle is 11 loops).
        for (let i = 0; i < 30 && !(window.__sr.attack().blipRows === 5 && window.__sr.attack().marks > 0); i++) window.__sr.step(1);
      }),
  },
  {
    // §11: all three mark pairs, A B and C: full lock-on.
    name: '06a-attack-lock',
    run: async (sr) =>
      sr(() => {
        const s = window.__sr.state;
        window.__sr.teleport(s.sectorX, s.sectorY); // empty the slots
        window.__sr.spawn('fighter', 2400, 200, 100);
        for (let i = 0; i < 40 && !(window.__sr.attack().blipRows === 5 && window.__sr.attack().marks === 3); i++) window.__sr.step(1);
      }),
  },
  {
    // §5.8 / §17.9: a starbase sector tracks the starbase as T=2.
    name: '06b-starbase-t2',
    run: async (sr) =>
      sr(() => {
        const base = window.__sr.galaxy().find((g) => g.starbase);
        if (base) window.__sr.teleport(base);
        window.__sr.step(12);
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
        if (window.__sr.state.attackComputerOn) window.__sr.press('COMPUTER'); // no display over the docking shot
        window.__sr.step(1);
        window.__sr.dock();
        window.__sr.step(50);
      }),
  },
  // Phase 4 (MANUAL_SPEC §6, §17.2, §17.13): the control panel's readouts, letters and band colours.
  {
    name: '10-panel-hud',
    run: async (sr) =>
      sr(() => {
        window.__sr.step(200); // let the docking finish
        window.__sr.setView('FRONT');
        window.__sr.killSector();
        window.__sr.setSpeed(6);
        window.__sr.spawn('fighter', 2400, 2560, -1600); // KM ahead, right and below: θ, Φ, R all non-zero
        window.__sr.setKills(18);
        window.__sr.setEnergy(8260);
        window.__sr.step(40); // V reaches 12
      }),
  },
  {
    name: '10a-panel-tracking-c',
    run: async (sr) => sr(() => { window.__sr.press('TRACKING'); window.__sr.step(10); }), // T: becomes C:
  },
  {
    name: '10b-panel-low-energy',
    run: async (sr) =>
      sr(() => {
        window.__sr.setEnergy(900);
        // Run to the pink half of the 128-loop flash.
        for (let i = 0; i < 260 && window.__sr.state.panel.band !== '#C04848'; i++) window.__sr.step(1);
        window.__sr.step(2);
      }),
  },
  {
    name: '10c-panel-shields-out',
    run: async (sr) =>
      sr(() => {
        window.__sr.setEnergy(9999);
        window.__sr.setDamage('shields', 'destroyed');
        window.__sr.press('SHIELDS'); // switched on, but destroyed: space stays black, band orange
        window.__sr.step(8);
      }),
  },
  {
    name: '10d-panel-hyperspace',
    run: async (sr) =>
      sr(() => {
        window.__sr.press('SHIELDS');
        window.__sr.setDamage('shields', 'ok');
        window.__sr.step(2);
        const s = window.__sr.state;
        window.__sr.hyperwarp((s.sectorX + 2) % 16, s.sectorY);
        window.__sr.step(160); // past the placeholder warp's midpoint: V ∞, HYPERSPACE
      }),
  },
  // Phase 5 (MANUAL_SPEC §16, §17.7, §17.8, §18.3): a fighter's H approaches, is shot and explodes;
  // a meteor is shot down; the three Zylon sprites at their largest cell. All in an empty sector.
  {
    name: '11-fighter-approach',
    run: async (sr) =>
      sr(() => {
        window.__sr.step(200); // let the hyperwarp finish
        const s = window.__sr.state;
        const empty = window.__sr.galaxy().find((g) => !g.zylons && !g.starbase && (g.x !== s.sectorX || g.y !== s.sectorY));
        window.__sr.teleport(empty);
        window.__sr.setView('FRONT');
        window.__sr.setSpeed(6);
        if (!window.__sr.state.attackComputerOn) window.__sr.press('COMPUTER');
        // The manual's NOVICE drill: shields up (S) and computer on (C). A Zylon torpedo that gets
        // through with the shields down destroys the ship (§5.9).
        if (!window.__sr.state.shieldsActive) window.__sr.press('SHIELDS');
        // In line with the right barrel (photons leave 256 KM right/left and 256 KM below).
        window.__sr.spawn('fighter', 4000, 256, -256);
        window.__sr.step(24);
        window.__sr.press('FIRE'); // left barrel
        window.__sr.press('FIRE'); // right barrel
        window.__sr.step(3);
      }),
  },
  {
    name: '11a-fighter-hit',
    run: async (sr) =>
      sr(() => {
        for (let i = 0; i < 60 && window.__sr.zylons().ships.some((z) => z.alive); i++) window.__sr.step(1);
        window.__sr.step(2);
      }),
  },
  { name: '11b-explosion', run: async (sr) => sr(() => window.__sr.step(30)) },
  {
    name: '12-meteor',
    run: async (sr) =>
      sr(() => {
        window.__sr.step(100);
        window.__sr.meteor(256, -256, 2400); // a green meteor coming straight at us
        window.__sr.step(2);
        window.__sr.press('FIRE');
        window.__sr.press('FIRE');
        window.__sr.step(4);
      }),
  },
  {
    name: '12a-meteor-shot',
    run: async (sr) =>
      sr(() => {
        for (let i = 0; i < 60 && window.__sr.zylons().pl2.life > 0; i++) window.__sr.step(1);
        window.__sr.step(3);
      }),
  },
  ...['fighter', 'cruiser', 'basestar'].map((type, i) => ({
    name: ['13-fighter', '13a-cruiser', '13b-basestar'][i],
    run: async (sr) =>
      sr((t) => {
        window.__sr.setSpeed(0);
        if (window.__sr.state.attackComputerOn) window.__sr.press('COMPUTER'); // no cross hairs over it
        window.__sr.step(40);
        const s = window.__sr.state;
        window.__sr.teleport(s.sectorX, s.sectorY); // an empty sector, nothing else in play
        window.__sr.spawn(t, 480, 0, 0); // largest shape cell, centred
        window.__sr.step(1);
      }, type),
  })),
  {
    // Phase 1: energy really runs out and aborts the mission (MANUAL_SPEC §12, §17.1, §17.10).
    name: '09-zero-energy',
    run: async (sr) =>
      sr(() => {
        const s = window.__sr.state;
        window.__sr.teleport(s.sectorX, s.sectorY); // clear the sprite shots
        if (window.__sr.state.shieldsActive) window.__sr.press('SHIELDS');
        window.__sr.press('TRACKING');
        window.__sr.setView('FRONT');
        window.__sr.setEnergy(40);
        window.__sr.setShields(true);
        window.__sr.setSpeed(9);
        window.__sr.step(400);
      }),
  },
];

/**
 * Timed sequences for --sequence <name>: `setup` runs once, then `frames` screenshots are taken
 * `every` game loops apart; `at[i]` runs just before frame i.
 */
const SEQUENCES = {
  // Phase 4 (MANUAL_SPEC §18.1, §17.3; R: UPDTITLE): one phrase segment at a time, 60 loops each.
  'title-line': {
    setup: (d) => {
      window.__sr.start(d.difficulty, d.seed);
      window.__sr.step(30);
    },
    frames: 90,
    every: 5,
    at: {
      0: () => window.__sr.press('SHIELDS'), // SHIELDS ON, 60 loops
      16: () => window.__sr.damageReport('photons', 'damaged'), // blank, DAMAGE CONTROL, then the queued phrase
      84: () => window.__sr.redAlert(), // a long phrase replaces it at once
    },
  },
  // Phase 5 (MANUAL_SPEC §17.7, §17.8, §18.3): a NOVICE fighter's H approaches, is shot, explodes.
  'fighter-kill': {
    setup: (d) => {
      window.__sr.start(d.difficulty, d.seed);
      window.__sr.step(30);
      window.__sr.press('COMPUTER');
      window.__sr.press('SHIELDS'); // the manual's NOVICE drill: S and C
      window.__sr.step(1);
      window.__sr.spawn('fighter', 4000, 256, -256); // in line with the right barrel
    },
    frames: 75,
    every: 2,
    at: {},
    // Fire both barrels once the fighter is about 2700 KM out.
    each: () => {
      const z = window.__sr.zylons();
      if (!window.__fired && z.ships.some((s) => s.alive && s.z < 2700)) {
        window.__fired = true;
        window.__sr.press('FIRE');
        window.__sr.press('FIRE');
      }
    },
  },
};

// Phase 6 (MANUAL_SPEC §11, §17.6): a fighter closes in, the marks go A, B, C, the locked salvo
// homes in and kills it.
SEQUENCES['lock-on'] = {
  setup: (d) => {
    window.__sr.start(d.difficulty, d.seed);
    window.__sr.step(30);
    const s = window.__sr.state;
    const empty = window.__sr.galaxy().find((g) => !g.zylons && !g.starbase && (g.x !== s.sectorX || g.y !== s.sectorY));
    window.__sr.teleport(empty);
    window.__sr.press('COMPUTER');
    window.__sr.press('SHIELDS');
    window.__sr.setSpeed(0);
    window.__sr.step(40); // come to a stop
    window.__sr.spawn('fighter', 7200, 2000, 1200); // up and to the right, far out
    window.__fired = false;
  },
  frames: 75,
  every: 2,
  at: {},
  // The pilot steers the blip into the middle: x first (A), then y (B); C comes with range.
  each: () => {
    const a = window.__sr.attack();
    if (window.__fired || !a.target) {
      window.__sr.stick(0, 0);
      return;
    }
    const t = a.target;
    const sx = t.x > 160 ? 1 : t.x < -160 ? -1 : 0;
    const sy = sx === 0 && a.marks >= 1 ? (t.y > 160 ? 1 : t.y < -160 ? -1 : 0) : 0;
    window.__sr.stick(sx, sy);
    if (a.marks === 3 && a.blipRows >= 3) {
      window.__fired = true;
      window.__sr.stick(0, 0);
      window.__sr.press('FIRE'); // one press: the second torpedo follows by itself
    }
  },
  probe: () => ({ ...window.__sr.attack(), photons: window.__sr.zylons().photons.filter((p) => p.life > 0).length, kills: window.__sr.state.enemiesDestroyed }),
};

// Phase 6 (MANUAL_SPEC §5.10): the tracking computer flips to the Aft view as a fighter passes.
SEQUENCES['tracking-aft'] = {
  setup: (d) => {
    window.__sr.start(d.difficulty, d.seed);
    window.__sr.step(10);
    const s = window.__sr.state;
    const empty = window.__sr.galaxy().find((g) => !g.zylons && !g.starbase && (g.x !== s.sectorX || g.y !== s.sectorY));
    window.__sr.teleport(empty);
    window.__sr.press('COMPUTER');
    window.__sr.press('SHIELDS');
    window.__sr.setSpeed(9);
    window.__sr.step(90); // reach speed 9 (112 KM/loop)
    window.__sr.press('TRACKING');
    window.__sr.step(1);
    window.__sr.spawn('fighter', 4600, 700, 500); // we overtake it
  },
  frames: 70,
  every: 2,
  at: {},
  probe: () => ({ view: window.__sr.state.currentView, ...window.__sr.attack() }),
};

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

    if (opts.sequence) {
      const seq = SEQUENCES[opts.sequence];
      if (!seq) throw new Error(`Unknown sequence ${opts.sequence}`);
      const dir = join(opts.out, `seq-${opts.sequence}`);
      await mkdir(dir, { recursive: true });
      await sr(seq.setup, { seed: opts.seed, difficulty: opts.difficulty });
      const titles = [];
      const probes = [];
      for (let i = 0; i < seq.frames; i++) {
        if (seq.at[i]) await sr(seq.at[i]);
        if (seq.each) await sr(seq.each);
        await sr(() => window.__sr.step(1));
        await page.screenshot({ path: join(dir, `${String(i).padStart(3, '0')}.png`), animations: 'disabled', caret: 'hide' });
        titles.push(await sr(() => window.__sr.state.title));
        if (seq.probe) probes.push(await sr(seq.probe));
        for (let k = 1; k < seq.every; k++) {
          if (seq.each) await sr(seq.each);
          await sr(() => window.__sr.step(1));
        }
      }
      await writeFile(join(dir, 'titles.json'), JSON.stringify({ every: seq.every, titles, probes }, null, 2) + '\n');
      console.log(`Wrote ${seq.frames} frames to ${dir}`);
      return;
    }

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
