#!/usr/bin/env node
/**
 * Deterministic screenshot capture for Star Raiders.
 *
 *   node scripts/capture.mjs [--seed 1979] [--out captures/seed-1979] [--difficulty NOVICE]
 *                            [--width 1280] [--height 800] [--url http://localhost:5173/]
 *                            [--query "stars=enhanced&crt=1"]   (extra URL parameters, e.g. settings)
 *                            [--sequence title-line]   (instead of the shots: numbered frames of a
 *                                                       timed sequence, e.g. for a GIF)
 *                            [--touch 1]               (a touch-screen context: page.tap works)
 *                            [--audio 1]               (instead of the shots: the Phase 12 audio check,
 *                                                       see AUDIO_CHECK below)
 *
 * Starts its own Vite dev server (unless --url is given), opens the game headless with
 * ?debug=1&seed=<seed>, freezes the page clock (Date, performance.now, timers and
 * requestAnimationFrame) and drives the game only through window.__sr.step(), so the
 * same seed always gives the same pixels. Writes the standard shots:
 *
 *   01-title (power-on attract)  01a-attract-select  02-front (1-4 + Enter)  02a-front-crosshair  02b-shields  02c-red-alert  03-aft  04-galactic-chart  04a-chart-surrounded
 *   04b-chart-surround-holding  04c-chart-starbase-destroyed  04d-chart-damage
 *   05-long-range-scan  05a-scan-target-ahead  06-attack-computer  06a-attack-lock  06b-starbase-t2  07-hyperwarp  07a-hyperspace
 *   07b-hyperwarp-arrival  08-docking  08a-docking-standby  08b-transfer-vessel  08c-transfer-complete
 *   08d-docking-aborted  08e-lrs-starbase  10-panel-hud  10a-panel-tracking-c
 *   10b-panel-low-energy  10c-panel-shields-out  10d-panel-hyperspace  11-fighter-approach  11a-fighter-hit
 *   11b-explosion  12-meteor  12a-meteor-shot  13-fighter  13a-cruiser  13b-basestar
 *   14-dc-photons  14a-dc-engines  14b-dc-shields  14c-dc-computer  14d-dc-scan-mirror  14e-dc-scan-destroyed
 *   14e2-dc-scan-no-computer  14f-dc-radio-frozen  14g-dc-radio-repaired  14h-chart-dc-colours  14i-repaired
 *   15-pause  15a-whats-wrong
 *   09-zero-energy (mission end)  09a-end-rank  09b-debrief  09c-attract-again  09d-idle-to-attract
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
  const opts = { seed: 1979, difficulty: 'NOVICE', width: 1280, height: 800, out: null, url: null, query: '', sequence: null, touch: '0', audio: '0' };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (!(key in opts)) throw new Error(`Unknown option --${key}`);
    const value = argv[++i];
    opts[key] = ['seed', 'width', 'height'].includes(key) ? Number(value) : value;
  }
  opts.out = resolve(opts.out ?? join(ROOT, 'captures', `seed-${opts.seed}`));
  return opts;
}

const LEVELS = ['NOVICE', 'PILOT', 'WARRIOR', 'COMMANDER'];

/** Press a key as the browser would (keydown + keyup on window), inside the page. */
const KEY_IN_PAGE = `window.__key = (code, key = code) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true }));
};`;

/** Each shot runs in page context order; state carries over from the previous shot. */
const SHOTS = [
  // Phase 11 (MANUAL_SPEC §17.11): power-on is the attract mode — NOVICE MISSION over the demo flight.
  { name: '01-title', run: async (sr) => sr(() => window.__sr.step(30)) },
  {
    // SELECT (Tab) cycles to PILOT MISSION; the title goes on to STAR RAIDERS / COPYRIGHT ATARI 1979.
    name: '01a-attract-select',
    run: async (sr) => sr(() => { window.__key('Tab'); window.__sr.step(80); }),
  },
  {
    // Keyboard only: 1-4 picks the level, Enter is START (with ?seed the mission replays from it).
    name: '02-front',
    run: async (sr, o, page) => {
      await page.keyboard.press(`Digit${LEVELS.indexOf(o.difficulty) + 1}`);
      await page.keyboard.press('Enter');
      await sr(() => window.__sr.step(60));
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
    // Phase 9 (MANUAL_SPEC §10): the manual's steps — select a target, steer left until it is
    // straight ahead (above our ship), then it should be as far up the screen as it goes.
    name: '05a-scan-target-ahead',
    run: async (sr) =>
      sr(() => {
        const s = window.__sr.state;
        const empty = window.__sr.galaxy().find((g) => !g.zylons && !g.starbase && (g.x !== s.sectorX || g.y !== s.sectorY));
        window.__sr.teleport(empty);
        window.__sr.setSpeed(0);
        window.__sr.step(40);
        window.__sr.spawn('fighter', 6000, -18000, 0); // ahead-left
        window.__sr.stick(-1, 0);
        for (let i = 0; i < 200; i++) {
          const t = window.__sr.zylons().ships.find((z) => z.alive);
          if (!t || (t.z > 0 && Math.abs(t.x) < 600)) break;
          window.__sr.step(1);
        }
        window.__sr.stick(0, 0);
        window.__sr.step(1);
        window.__back = [s.sectorX, s.sectorY, s.targetEngineSpeed];
      }),
  },
  {
    // Phase 6 (MANUAL_SPEC §5.3, §11, §17.6): the Attack Computer Display with the blip and the
    // A and B marks (x and y locked, not yet in range).
    name: '06-attack-computer',
    run: async (sr) =>
      sr(() => {
        // Back to the Zylon sector of 05 (after the empty sector of 05a).
        if (window.__back) {
          window.__sr.teleport(window.__back[0], window.__back[1]);
          window.__sr.setSpeed(window.__back[2]);
        }
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
  // Phase 8 (MANUAL_SPEC §9, §17.5): H in the front view; the marker between the cross hairs and
  // the star trails (velocity ≥ 128), then HYPERSPACE (no stars, V ∞), then the arrival.
  {
    name: '07-hyperwarp',
    run: async (sr) =>
      sr(() => {
        const s = window.__sr.state;
        window.__sr.hyperwarp((s.sectorX + 3) % 16, s.sectorY);
        window.__sr.step(150); // velocity 162: star trails
      }),
  },
  {
    name: '07a-hyperspace',
    run: async (sr) =>
      sr(() => {
        for (let i = 0; i < 400 && window.__sr.warp().phase !== 'hyperspace'; i++) window.__sr.step(1);
        window.__sr.step(4);
      }),
  },
  {
    name: '07b-hyperwarp-arrival',
    run: async (sr) =>
      sr(() => {
        for (let i = 0; i < 400 && window.__sr.warp().phase !== 'off'; i++) window.__sr.step(1);
        window.__sr.step(20); // HYPERWARP COMPLETE (or RED ALERT), slowing down
      }),
  },
  // Phase 10 (MANUAL_SPEC §13, §17.9): a real starbase sector; approach at speed 2, stop with 0
  // just inside 512 KM with the starbase between the cross hairs: ORBIT ESTABLISHED, STANDBY,
  // the transfer vessel, TRANSFER COMPLETE (E 9999, all repaired).
  {
    name: '08-docking',
    run: async (sr) =>
      sr(() => {
        const s = window.__sr.state;
        window.__dockBack = [s.sectorX, s.sectorY];
        window.__sr.step(1);
        window.__sr.teleport(window.__sr.galaxy().find((g) => g.starbase));
        if (!window.__sr.state.attackComputerOn) window.__sr.press('COMPUTER');
        if (window.__sr.state.shieldsActive) window.__sr.press('SHIELDS'); // M §IX: shields off to dock
        window.__sr.setDamage('photons', 'damaged');
        window.__sr.setEnergy(3170);
        window.__sr.setSpeed(2);
        for (let i = 0; i < 400 && window.__sr.state.shipVelocity !== 2; i++) window.__sr.step(1); // slow down from the jump
        window.__sr.spawn('starbase', 1200, 0, 40);
        for (let i = 0; i < 2000 && window.__sr.starbase().starbase.z >= 450; i++) window.__sr.step(1);
        window.__sr.setSpeed(0);
        for (let i = 0; i < 20 && window.__sr.starbase().dockState !== 'orbit'; i++) window.__sr.step(1);
        window.__sr.step(10);
        // The starbase pulses with COUNT256: take the shot at the mid orange of the manual photo.
        for (let i = 0; i < 16 && (window.__sr.state.count256 & 0x0f) !== 6; i++) window.__sr.step(1);
      }),
  },
  { name: '08a-docking-standby', run: async (sr) => sr(() => window.__sr.step(60)) },
  {
    name: '08b-transfer-vessel',
    run: async (sr) =>
      sr(() => {
        for (let i = 0; i < 1000 && !(window.__sr.starbase().vessel.alive && window.__sr.starbase().vessel.z < 1400); i++) window.__sr.step(1);
      }),
  },
  {
    name: '08c-transfer-complete',
    run: async (sr) =>
      sr(() => {
        for (let i = 0; i < 1000 && window.__sr.starbase().dockState !== 'complete'; i++) window.__sr.step(1);
        window.__sr.step(20);
      }),
  },
  {
    // §13 step 6: a key (here S) during docking.
    name: '08d-docking-aborted',
    run: async (sr) =>
      sr(() => {
        window.__sr.setSpeed(1); // leave orbit quietly, then come back and dock again
        window.__sr.step(5);
        window.__sr.dock();
        window.__sr.step(80); // ORBIT ESTABLISHED, STANDBY
        window.__sr.press('SHIELDS');
        window.__sr.step(6);
      }),
  },
  {
    // The starbase of another starbase sector at its real arrival position (≥ 28928 KM ahead).
    name: '08e-lrs-starbase',
    run: async (sr) =>
      sr(() => {
        const s = window.__sr.state;
        const bases = window.__sr.galaxy().filter((g) => g.starbase && (g.x !== s.sectorX || g.y !== s.sectorY));
        window.__sr.teleport(bases[0]);
        window.__sr.setView('LONG_RANGE_SCAN');
        window.__sr.step(30);
      }),
  },
  // Phase 4 (MANUAL_SPEC §6, §17.2, §17.13): the control panel's readouts, letters and band colours.
  {
    name: '10-panel-hud',
    run: async (sr) =>
      sr(() => {
        if (window.__dockBack) window.__sr.teleport(...window.__dockBack); // back out of the starbase sector
        if (window.__sr.state.shieldsActive) window.__sr.press('SHIELDS');
        window.__sr.step(1);
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
        for (let i = 0; i < 400 && window.__sr.warp().phase !== 'hyperspace'; i++) window.__sr.step(1);
        window.__sr.step(3); // V ∞, HYPERSPACE
      }),
  },
  // Phase 5 (MANUAL_SPEC §16, §17.7, §17.8, §18.3): a fighter's H approaches, is shot and explodes;
  // a meteor is shot down; the three Zylon sprites at their largest cell. All in an empty sector.
  {
    name: '11-fighter-approach',
    run: async (sr) =>
      sr(() => {
        for (let i = 0; i < 400 && window.__sr.warp().phase !== 'off'; i++) window.__sr.step(1); // let the hyperwarp finish
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
  // Phase 7 (MANUAL_SPEC §7, §17.3): damage control. Each shot reports the damage as a hit does,
  // runs until the title line shows the subsystem phrase, and shows the effect; then repairs.
  {
    // Photons damaged: two presses, one torpedo, always from the same barrel.
    name: '14-dc-photons',
    run: async (sr) =>
      sr(() => {
        window.__sr.setView('FRONT');
        window.__sr.damageReport('photons', 'damaged');
        for (let i = 0; i < 200 && !/PHOTONS/.test(window.__sr.state.title); i++) window.__sr.step(1);
        window.__sr.press('FIRE');
        window.__sr.press('FIRE'); // blocked: the same barrel has to wait 23 loops
        window.__sr.step(4);
      }),
  },
  {
    // Engines destroyed: key 9 gives key 5, and V jitters (16 AND RANDOM: 00 or 06).
    name: '14a-dc-engines',
    run: async (sr) =>
      sr(() => {
        window.__sr.repairAll();
        window.__sr.damageReport('engines', 'destroyed');
        window.__sr.setSpeed(9);
        for (let i = 0; i < 200 && !/ENGINES/.test(window.__sr.state.title); i++) window.__sr.step(1);
        for (let i = 0; i < 40 && window.__sr.state.shipVelocity !== 16; i++) window.__sr.step(1);
      }),
  },
  {
    // Shields damaged and switched on: caught in a flicker off (black space, orange band).
    name: '14b-dc-shields',
    run: async (sr) =>
      sr(() => {
        window.__sr.repairAll();
        window.__sr.setSpeed(0);
        if (!window.__sr.state.shieldsActive) window.__sr.press('SHIELDS');
        window.__sr.step(1);
        window.__sr.damageReport('shields', 'damaged');
        for (let i = 0; i < 200 && !/SHIELDS/.test(window.__sr.state.title); i++) window.__sr.step(1);
        for (let i = 0; i < 400 && window.__sr.state.panel.band !== '#B06818'; i++) window.__sr.step(1);
      }),
  },
  {
    // Computer destroyed: switched off, no cross hairs and no display even with C on; θ Φ R frozen.
    name: '14c-dc-computer',
    run: async (sr) =>
      sr(() => {
        window.__sr.repairAll(); // shields stay up: the fighter shoots back
        if (!window.__sr.state.attackComputerOn) window.__sr.press('COMPUTER');
        window.__sr.spawn('fighter', 3000, 600, 300);
        window.__sr.step(20);
        window.__sr.damageReport('computer', 'destroyed');
        window.__sr.press('COMPUTER'); // back on: still nothing
        for (let i = 0; i < 200 && !/COMPUTER DESTROYED/.test(window.__sr.state.title); i++) window.__sr.step(1);
      }),
  },
  {
    // Sector scan damaged: each object shows at its place or mirrored through our ship, at random.
    name: '14d-dc-scan-mirror',
    run: async (sr) =>
      sr(() => {
        window.__sr.repairAll();
        window.__sr.setShields(false); // the scan's black field (shields tint it $A0 as in front)
        if (window.__sr.state.attackComputerOn) window.__sr.press('COMPUTER');
        const s = window.__sr.state;
        window.__sr.teleport(s.sectorX, s.sectorY);
        window.__sr.spawn('fighter', 20000, -12000, 0);
        window.__sr.spawn('cruiser', 9000, 15000, 0);
        window.__sr.setView('LONG_RANGE_SCAN');
        window.__sr.damageReport('sectorScan', 'damaged');
        for (let i = 0; i < 200 && !/SECTOR SCAN/.test(window.__sr.state.title); i++) window.__sr.step(1);
        // A frame where at least one object is drawn at its mirror image.
        for (let i = 0; i < 30 && !window.__sr.scan().blips.some((b) => Math.sign(b.z) !== Math.sign(window.__sr.zylons().ships.find((z) => z.alive && Math.abs(z.x - b.x) < 1)?.z ?? b.z)); i++) window.__sr.step(1);
      }),
  },
  {
    // Sector scan destroyed: only our ship.
    name: '14e-dc-scan-destroyed',
    run: async (sr) =>
      sr(() => {
        window.__sr.damageReport('sectorScan', 'destroyed');
        for (let i = 0; i < 200 && !/SECTOR SCAN/.test(window.__sr.state.title); i++) window.__sr.step(1);
      }),
  },
  {
    // Phase 9 (§17.3; R: DRAWLINES): sector scan OK, computer destroyed: the objects without our ship.
    name: '14e2-dc-scan-no-computer',
    run: async (sr) =>
      sr(() => {
        window.__sr.setDamage('sectorScan', 'ok');
        window.__sr.setDamage('computer', 'destroyed');
        window.__sr.step(2);
      }),
  },
  {
    // Radio damaged: the chart keeps the map from the moment of damage while the fleets move.
    name: '14f-dc-radio-frozen',
    run: async (sr) =>
      sr(() => {
        window.__sr.repairAll();
        const s = window.__sr.state;
        window.__sr.teleport(s.sectorX, s.sectorY);
        window.__sr.setView('GALACTIC_CHART');
        window.__sr.damageReport('radio', 'damaged');
        window.__sr.toFleetTick(3); // the fleets move; the chart does not
        for (let i = 0; i < 200 && !/SUB-SPACE RADIO/.test(window.__sr.state.title); i++) window.__sr.step(1);
      }),
  },
  {
    // Docking repairs: the chart catches up with the fleets at once.
    name: '14g-dc-radio-repaired',
    run: async (sr) => sr(() => { window.__sr.repairAll(); window.__sr.step(1); }),
  },
  {
    // §7: DC letters in all three colours — blue OK, yellow damaged, red destroyed.
    name: '14h-chart-dc-colours',
    run: async (sr) =>
      sr(() => {
        window.__sr.setDamage('photons', 'destroyed');
        window.__sr.setDamage('engines', 'damaged');
        window.__sr.setDamage('computer', 'damaged');
        window.__sr.setDamage('sectorScan', 'destroyed');
        window.__sr.setDamage('radio', 'damaged');
        window.__sr.step(1);
      }),
  },
  {
    name: '14i-repaired',
    run: async (sr) =>
      sr(() => {
        window.__sr.repairAll();
        window.__sr.setView('FRONT');
        window.__sr.setSpeed(0);
        window.__sr.step(30);
      }),
  },
  {
    // Phase 11 (MANUAL_SPEC §5.11, bend 7): P pauses; the pause menu shows the key help.
    name: '15-pause',
    run: async (sr, o, page) => {
      await page.keyboard.press('p');
      await sr(() => window.__sr.step(30)); // nothing moves while paused
    },
  },
  {
    // §17.11: any key goes on (P again here); an unknown key (Z) shows WHATS WRONG?.
    name: '15a-whats-wrong',
    run: async (sr, o, page) => {
      await page.keyboard.press('p');
      await sr(() => window.__sr.step(1));
      await page.keyboard.press('z');
      await sr(() => window.__sr.step(2));
    },
  },
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
  {
    // Phase 11 (§17.10): the end sequence on the title line reaches NEW RANK IS: / <rank>.
    name: '09a-end-rank',
    run: async (sr) =>
      sr(() => {
        const rank = window.__sr.state.rating?.rank;
        for (let i = 0; i < 1200 && window.__sr.state.title !== rank; i++) window.__sr.step(1);
        window.__sr.step(20);
      }),
  },
  {
    // Bend 6: after the end sequence, the debrief card with the score breakdown.
    name: '09b-debrief',
    run: async (sr) =>
      sr(() => {
        for (let i = 0; i < 1200 && window.__sr.session().mode !== 'debrief'; i++) window.__sr.step(1);
        window.__sr.step(10);
      }),
  },
  {
    // Enter leaves the card: back to the attract mode.
    name: '09c-attract-again',
    run: async (sr, o, page) => {
      await page.keyboard.press('Enter');
      await sr(() => window.__sr.step(20));
    },
  },
  {
    // §3 / §17.11: START again, then 9.1 idle minutes (32768 loops) return to the attract mode.
    name: '09d-idle-to-attract',
    run: async (sr, o, page) => {
      await page.keyboard.press('Enter');
      await sr(() => {
        window.__sr.step(30);
        window.__sr.setIdle(32768 - 10);
        window.__sr.step(20);
      });
    },
  },
];

/**
 * Timed sequences for --sequence <name>: `setup` runs once, then `frames` screenshots are taken
 * `every` game loops apart; `at[i]` runs just before frame i (a page function, or `{ tap: selector }`
 * to tap an on-screen button; needs --touch 1).
 */
const SEQUENCES = {
  // Phase 11 (MANUAL_SPEC §17.11): power-on attract mode; SELECT (Tab) twice, then 4 (COMMANDER).
  attract: {
    setup: () => window.__sr.step(1),
    frames: 100,
    every: 4,
    at: {
      45: () => window.__key('Tab'),
      70: () => window.__key('Tab'),
      85: () => window.__key('Digit1', '1'),
    },
    probe: () => window.__sr.session(),
  },
  // Phase 11 (§17.10, bend 6): every Zylon destroyed → MISSION COMPLETE end sequence → debrief → attract.
  'end-sequence': {
    setup: (d) => {
      window.__sr.start(d.difficulty, d.seed);
      window.__sr.step(30);
      for (const g of window.__sr.galaxy()) {
        if (!g.zylons) continue;
        window.__sr.teleport(g);
        window.__sr.killSector();
        if (window.__sr.state.missionOutcome) break;
      }
    },
    frames: 110,
    every: 6,
    at: { 100: () => window.__key('Enter') },
    probe: () => ({ mode: window.__sr.session().mode, outcome: window.__sr.state.missionOutcome, rating: window.__sr.state.rating?.title ?? null }),
  },
  // Phase 11: the SELECT and START buttons by touch: tap SELECT twice (WARRIOR), then START.
  'tap-start': {
    setup: () => window.__sr.step(1),
    frames: 12,
    every: 5,
    at: { 2: { tap: '.select-btn' }, 4: { tap: '.select-btn' }, 7: { tap: '.start-btn' } },
    probe: () => ({ ...window.__sr.session(), difficulty: window.__sr.state.difficulty, phase: window.__sr.state.phase }),
  },
  // Phase 10 (MANUAL_SPEC §13, §17.9): the full docking — approach at speed 2 in a starbase
  // sector, 0 once inside 512 KM, ORBIT ESTABLISHED, STANDBY, the transfer vessel, TRANSFER COMPLETE.
  docking: {
    setup: (d) => {
      window.__sr.start(d.difficulty, d.seed);
      window.__sr.step(10);
      window.__sr.teleport(window.__sr.galaxy().find((g) => g.starbase));
      window.__sr.press('COMPUTER');
      window.__sr.setDamage('photons', 'damaged');
      window.__sr.setEnergy(3170);
      window.__sr.spawn('starbase', 1200, 0, 40);
      window.__sr.setSpeed(2);
    },
    frames: 150,
    every: 8,
    at: {},
    each: () => {
      const b = window.__sr.starbase();
      if (b.dockState === 'none' && window.__sr.state.targetEngineSpeed !== 0 && b.starbase.z < 450) window.__sr.setSpeed(0);
    },
    probe: () => {
      const b = window.__sr.starbase();
      const s = window.__sr.state;
      return { dock: b.dockState, z: Math.round(b.starbase.z), y: b.starbase.y, vessel: b.vessel.alive ? Math.round(b.vessel.z) : null, energy: s.energy, v: s.shipVelocity, title: s.title };
    },
  },
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

// Phase 7 (MANUAL_SPEC §17.3; R: DAMAGE): a hit reports ENGINES DESTROYED. The title line shows a
// blank segment, DAMAGE CONTROL, then the queued subsystem phrase, which comes back every time the
// line goes blank until docking. Key 9 gives key 5 and V jitters.
SEQUENCES['damage-control'] = {
  setup: (d) => {
    window.__sr.start(d.difficulty, d.seed);
    window.__sr.step(130); // past the opening title
  },
  frames: 80,
  every: 5,
  at: {
    0: () => {
      window.__sr.damageReport('engines', 'destroyed');
      window.__sr.setSpeed(9);
    },
  },
  probe: () => ({ v: window.__sr.state.panel.v, key: window.__sr.state.targetEngineSpeed, beeps: window.__sr.damage().beeps }),
};

// Phase 7 (MANUAL_SPEC §7, §17.3): the damaged sector scan draws each object at its place or
// mirrored through our ship, at random each loop, so every target shows with its reflection.
SEQUENCES['scan-mirror'] = {
  setup: (d) => {
    window.__sr.start(d.difficulty, d.seed);
    window.__sr.step(10);
    const s = window.__sr.state;
    const empty = window.__sr.galaxy().find((g) => !g.zylons && !g.starbase && (g.x !== s.sectorX || g.y !== s.sectorY));
    window.__sr.teleport(empty);
    window.__sr.press('SHIELDS');
    window.__sr.setSpeed(0);
    window.__sr.step(40);
    window.__sr.spawn('fighter', 20000, -12000, 0);
    window.__sr.spawn('cruiser', 9000, 15000, 0);
    window.__sr.setDamage('sectorScan', 'damaged');
    window.__sr.setView('LONG_RANGE_SCAN');
  },
  frames: 24,
  every: 1,
  at: {},
  probe: () => window.__sr.scan(),
};

// Phase 9 (MANUAL_SPEC §10): the manual's scan procedure. A target off to the left; stick left
// swings the whole picture round our ship until the target is straight ahead, then the engines
// close in on it.
SEQUENCES['scan-steer'] = {
  setup: (d) => {
    window.__sr.start(d.difficulty, d.seed);
    window.__sr.step(10);
    const s = window.__sr.state;
    const empty = window.__sr.galaxy().find((g) => !g.zylons && !g.starbase && (g.x !== s.sectorX || g.y !== s.sectorY));
    window.__sr.teleport(empty);
    window.__sr.setSpeed(0);
    window.__sr.step(40);
    window.__sr.spawn('cruiser', 4000, -24000, 0);
    window.__sr.setView('LONG_RANGE_SCAN');
    window.__sr.step(1);
  },
  frames: 60,
  every: 2,
  at: {
    0: () => window.__sr.stick(-1, 0),
  },
  each: () => {
    const t = window.__sr.zylons().ships.find((z) => z.alive);
    if (window.__sr.state.stick.x && t && t.z > 0 && Math.abs(t.x) < 600) {
      window.__sr.stick(0, 0);
      window.__sr.setSpeed(9);
    }
  },
  probe: () => window.__sr.scan().blips.map((b) => [b.col, b.row]),
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

// Phase 8 (MANUAL_SPEC §9, §17.5): a full hyperwarp, flown by a scripted pilot that keeps the
// target marker on PM column window.__pilotCol (125 = centred) and its row centred. Run with
// --difficulty PILOT to have the marker drift. The last frames show the Galactic Chart.
function warpPilot() {
  const w = window.__sr.warp();
  if (w.phase !== 'accel') {
    window.__sr.stick(0, 0);
    return;
  }
  const m = w.marker;
  const tc = window.__pilotCol;
  window.__sr.stick(m.col < tc ? -1 : m.col > tc ? 1 : 0, m.row < 118 ? 1 : m.row > 120 ? -1 : 0);
}
const warpProbe = () => {
  const s = window.__sr.state;
  const w = window.__sr.warp();
  return { phase: w.phase, sector: [s.sectorX, s.sectorY], chosen: w.chosen, arrival: w.arrival, marker: [w.marker.col, w.marker.row], velocity: s.shipVelocity, v: s.panel.v, energy: s.energy, charges: w.charges, trailStars: w.trailStars, redAlert: s.redAlertLife };
};
const WARP_FRAMES = 140;
const WARP_EVERY = 4;
SEQUENCES['hyperwarp'] = {
  // Dot on a Zylon sector three columns over, F, H: lands there (RED ALERT).
  setup: (d) => {
    window.__sr.start(d.difficulty, d.seed);
    window.__sr.step(30);
    const s = window.__sr.state;
    const g = window.__sr.galaxy();
    const target = g.find((t) => t.zylons > 0 && t.y === s.sectorY && Math.abs(t.x - s.sectorX) >= 2) ?? { x: (s.sectorX + 3) % 16, y: s.sectorY };
    window.__pilotCol = 125;
    window.__sr.hyperwarp(target.x, target.y);
  },
  frames: WARP_FRAMES,
  every: WARP_EVERY,
  at: { [WARP_FRAMES - 4]: () => window.__sr.setView('GALACTIC_CHART') },
  each: warpPilot,
  probe: warpProbe,
};
SEQUENCES['hyperwarp-right'] = {
  // M §IX: H without the chart (the dot on our own sector), marker pushed to the right cross hair.
  setup: (d) => {
    window.__sr.start(d.difficulty, d.seed);
    window.__sr.step(30);
    const s = window.__sr.state;
    window.__pilotCol = 125 + 8;
    window.__sr.hyperwarp(s.sectorX, s.sectorY);
  },
  frames: WARP_FRAMES,
  every: WARP_EVERY,
  at: { [WARP_FRAMES - 4]: () => window.__sr.setView('GALACTIC_CHART') },
  each: warpPilot,
  probe: warpProbe,
};

// ---------------------------------------------------------------------------------------------
// Phase 12 (MANUAL_SPEC §17.12, bend 8): --audio 1
//   1. every §17.12 event fired through the game's own paths, read back from the synth's log
//   2. mute: a live analyser tap on the AudioContext destination, RMS before and after N
//   3. leak check: 5 restarts through the console keys, AudioContexts still open after each
//   4. the offline render of every event in order (OfflineAudioContext) → audio-demo.wav
// Writes audio-check.json, audio-check.txt and audio-demo.wav to --out.
// ---------------------------------------------------------------------------------------------

/** Before any page script: count every AudioContext and tap what reaches each destination. */
const AUDIO_TAP = `(() => {
  const Native = window.AudioContext;
  window.__ctxs = [];
  window.__taps = new Map();
  window.AudioContext = class extends Native {
    constructor(...a) { super(...a); window.__ctxs.push(this); }
  };
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const ctx = this.context;
    if (dest === ctx.destination && ctx instanceof Native) {
      let tap = window.__taps.get(ctx);
      if (!tap) { tap = ctx.createAnalyser(); tap.fftSize = 2048; window.__taps.set(ctx, tap); }
      connect.call(this, tap);
    }
    return connect.call(this, dest, ...rest);
  };
  window.__liveRms = () => {
    const open = window.__ctxs.filter((c) => c.state !== 'closed');
    const ctx = open[open.length - 1];
    const tap = ctx && window.__taps.get(ctx);
    if (!tap) return null;
    const d = new Float32Array(tap.fftSize);
    tap.getFloatTimeDomainData(d);
    let s = 0; for (const v of d) s += v * v;
    return Math.sqrt(s / d.length);
  };
  window.__openContexts = () => window.__ctxs.filter((c) => c.state !== 'closed').length;
})();`;

async function audioCheck(page, sr, opts) {
  const report = { seed: opts.seed, events: {}, engine: {}, mute: {}, leak: [], demo: null };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // A real key press unlocks audio (1 = NOVICE, Enter = START).
  await page.keyboard.press('Digit1');
  await page.keyboard.press('Enter');
  await sr(() => window.__sr.step(130));
  report.unlocked = await sr(() => window.__sr.audio().state);

  // 1. Every §17.12 event through the game.
  const engineAt = (key) => sr((k) => { window.__sr.setSpeed(k); window.__sr.step(150); return window.__sr.audio().engine; }, key);
  for (const k of [0, 3, 6, 9]) report.engine[`key ${k}`] = await engineAt(k);
  // __sr.step() runs game loops at once while the AudioContext keeps real time, so each group
  // of events gets real time to finish before the next (else the priorities drop the later ones).
  await sr(() => {
    const s = window.__sr.state;
    const empty = window.__sr.galaxy().find((g) => !g.zylons && !g.starbase && (g.x !== s.sectorX || g.y !== s.sectorY));
    window.__sr.teleport(empty);
    window.__sr.setSpeed(0);
    window.__sr.step(60);
    window.__sr.press('COMPUTER'); // acknowledge
    window.__sr.press('SHIELDS'); // acknowledge
    window.__sr.step(30);
    // A fighter in line with the right barrel: photons, then the Zylon explosion.
    window.__sr.spawn('fighter', 2600, 256, -256);
    window.__sr.press('FIRE');
    window.__sr.press('FIRE');
    for (let i = 0; i < 120 && !window.__sr.state.enemiesDestroyed; i++) window.__sr.step(1);
    window.__sr.step(60);
  });
  await wait(1500);
  await sr(() => {
    // A meteor into the raised shields: the shield explosion.
    window.__sr.meteor(0, 0, 120);
    for (let i = 0; i < 60 && !window.__sr.audio().counts.shieldExplosion; i++) window.__sr.step(1);
    window.__sr.step(70);
  });
  await wait(1500);
  await sr(() => {
    // DAMAGE CONTROL: the damage-report beep (R: DAMAGE → BEEP $12).
    window.__sr.damageReport('photons', 'damaged');
    window.__sr.step(60);
  });
  await wait(1500);
  await sr(() => {
    // STARBASE SURROUNDED: the message-from-starbase tune.
    window.__sr.surround();
    window.__sr.toFleetTick(1);
    window.__sr.step(60);
  });
  await wait(1500);
  await sr(() => {
    // Hyperwarp into a Zylon sector: the transit beeps, then RED ALERT on arrival.
    const now = window.__sr.state;
    const target = window.__sr.galaxy().find((g) => g.zylons > 0 && !g.starbase && (g.x !== now.sectorX || g.y !== now.sectorY));
    window.__sr.hyperwarp(target.x, target.y);
    for (let i = 0; i < 900 && window.__sr.warp().phase !== 'off'; i++) window.__sr.step(1);
    window.__sr.step(150);
  });
  await wait(1500);
  await sr(() => {
    // Shields down and a meteor: the starship explosion, then the end sequence.
    window.__sr.setShields(false);
    window.__sr.step(4);
    window.__sr.meteor(0, 0, 120);
    for (let i = 0; i < 60 && window.__sr.state.phase === 'mission'; i++) window.__sr.step(1);
    window.__sr.step(30);
  });
  const audio = await sr(() => window.__sr.audio());
  report.counts = audio.counts;
  report.log = audio.log;
  report.afterEnd = { phase: (await sr(() => window.__sr.state)).phase, engine: audio.engine, voices: audio.voices };
  const EVENTS = ['photon', 'zylonExplosion', 'shieldExplosion', 'starshipExplosion', 'hyperwarpTransit', 'redAlert', 'acknowledge', 'damageReport', 'starbaseMessage'];
  for (const e of EVENTS) report.events[e] = audio.log.filter((l) => l.event === e && l.result === 'played').length;

  // 2. Mute, live: back into a mission, engines at speed 9, then N.
  await page.keyboard.press('Enter'); // skip the end sequence
  await page.keyboard.press('Enter'); // leave the debrief
  await page.keyboard.press('Enter'); // START
  await sr(() => { window.__sr.setSpeed(9); window.__sr.step(120); window.__sr.press('SHIELDS'); window.__sr.step(1); });
  await wait(250);
  report.mute.rmsBefore = await sr(() => window.__liveRms());
  await page.keyboard.press('KeyN');
  await wait(60);
  report.mute.rmsAfter60ms = await sr(() => window.__liveRms());
  await sr(() => { window.__sr.press('FIRE'); window.__sr.damageReport('engines', 'damaged'); window.__sr.step(2); });
  await wait(200);
  report.mute.rmsWhileMutedWithEvents = await sr(() => window.__liveRms());
  report.mute.setting = await sr(() => ({ muted: window.__sr.audio().muted, stored: JSON.parse(localStorage.getItem('star-raiders.settings')).muted }));
  await page.keyboard.press('KeyN');
  await wait(250);
  report.mute.rmsAfterUnmute = await sr(() => window.__liveRms());
  report.mute.pass = report.mute.rmsBefore > 0.005 && report.mute.rmsAfter60ms === 0 && report.mute.rmsWhileMutedWithEvents === 0 && report.mute.rmsAfterUnmute > 0.005;

  // 3. Leak check: 5 restarts through the console (abort, skip, leave the debrief, START).
  for (let i = 1; i <= 5; i++) {
    await sr(() => window.__sr.abort());
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await sr(() => window.__sr.step(10));
    await wait(150); // close() settles on the audio thread
    report.leak.push(await sr(() => ({ created: window.__ctxs.length, open: window.__openContexts(), session: window.__sr.session().mode, state: window.__sr.audio().state })));
  }
  report.leakPass = report.leak[report.leak.length - 1].open === 1;

  // 4. Offline render of every event in order.
  const demo = await sr(() => window.__sr.audioDemo());
  await writeFile(join(opts.out, 'audio-demo.wav'), Buffer.from(demo.wav, 'base64'));
  report.demo = { seconds: demo.seconds, sampleRate: demo.sampleRate, cues: demo.rms };

  // Everything off before the browser closes.
  await sr(() => window.__sr.abort());
  report.everyEventPlayed = EVENTS.every((e) => report.events[e] > 0);
  await writeFile(join(opts.out, 'audio-check.json'), JSON.stringify(report, null, 2) + '\n');

  const lines = [];
  lines.push(`Star Raiders Phase 12 audio check (MANUAL_SPEC §17.12), seed ${opts.seed}, headless Chromium`);
  lines.push('');
  lines.push('1. Every §17.12 event, fired through the game and played by the POKEY synth:');
  for (const e of EVENTS) lines.push(`   ${e.padEnd(18)} played ${report.events[e]}×`);
  lines.push(`   engines            ${Object.entries(report.engine).map(([k, v]) => `${k}: AUDF $${v.audf.toString(16)} vol ${v.volume}`).join(' | ')}`);
  lines.push(`   after the ship blew up: phase ${report.afterEnd.phase}, engine vol ${report.afterEnd.engine.volume}, voices ${JSON.stringify(report.afterEnd.voices)}`);
  lines.push(`   => ${report.everyEventPlayed ? 'PASS' : 'FAIL'}`);
  lines.push('   Synth log (n, event, voice, priority, result, pan):');
  for (const l of report.log) lines.push(`     ${String(l.n).padStart(3)} ${l.event.padEnd(18)} ${l.voice.padEnd(9)} p${String(l.priority).padEnd(3)} ${l.result.padEnd(8)} pan ${l.pan.toFixed(2)}`);
  lines.push('');
  lines.push('2. Mute (N), measured on a live analyser at the AudioContext destination:');
  lines.push(`   RMS before ${report.mute.rmsBefore?.toFixed(4)}  60 ms after N ${report.mute.rmsAfter60ms}  muted + new events ${report.mute.rmsWhileMutedWithEvents}  after N again ${report.mute.rmsAfterUnmute?.toFixed(4)}`);
  lines.push(`   setting muted=${report.mute.setting.muted}, stored in localStorage=${report.mute.setting.stored}  => ${report.mute.pass ? 'PASS' : 'FAIL'}`);
  lines.push('');
  lines.push('3. Leak check: AudioContexts after each restart (abort → Enter → Enter → Enter/START):');
  report.leak.forEach((l, i) => lines.push(`   restart ${i + 1}: created ${l.created}, open ${l.open}, session ${l.session}, context ${l.state}`));
  lines.push(`   => ${report.leakPass ? 'PASS' : 'FAIL'}: exactly ${report.leak[report.leak.length - 1].open} AudioContext alive after 5 restarts`);
  lines.push('');
  lines.push(`4. Offline render (OfflineAudioContext, ${demo.sampleRate} Hz stereo, ${demo.seconds.toFixed(1)} s) → audio-demo.wav:`);
  for (const c of demo.rms) lines.push(`   ${c.t.toFixed(2).padStart(6)} s  ${String(c.what).padEnd(18)} RMS L ${c.left.toFixed(4)} R ${c.right.toFixed(4)}`);
  const text = lines.join('\n') + '\n';
  await writeFile(join(opts.out, 'audio-check.txt'), text);
  console.log(text);
  if (!report.everyEventPlayed || !report.mute.pass || !report.leakPass) process.exitCode = 1;
}

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
      hasTouch: opts.touch === '1',
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
    if (opts.audio === '1') await page.addInitScript(AUDIO_TAP);

    const url = new URL(base);
    url.searchParams.set('debug', '1');
    url.searchParams.set('seed', String(opts.seed));
    for (const [k, v] of new URLSearchParams(opts.query)) url.searchParams.set(k, v);
    await page.goto(url.toString(), { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__sr !== undefined);
    await page.evaluate(KEY_IN_PAGE);
    await page.evaluate(() => document.fonts.ready);

    const sr = (fn, arg) => page.evaluate(fn, arg);

    if (opts.audio === '1') {
      await audioCheck(page, sr, opts);
      return;
    }

    if (opts.sequence) {
      const seq = SEQUENCES[opts.sequence];
      if (!seq) throw new Error(`Unknown sequence ${opts.sequence}`);
      const dir = join(opts.out, `seq-${opts.sequence}`);
      await mkdir(dir, { recursive: true });
      await sr(seq.setup, { seed: opts.seed, difficulty: opts.difficulty });
      const titles = [];
      const probes = [];
      for (let i = 0; i < seq.frames; i++) {
        if (seq.at[i]?.tap) await page.tap(seq.at[i].tap);
        else if (seq.at[i]) await sr(seq.at[i]);
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
      await shot.run(sr, { seed: opts.seed, difficulty: opts.difficulty }, page);
      await page.evaluate(() => document.fonts.ready);
      const file = join(opts.out, `${shot.name}.png`);
      await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
      const hash = createHash('sha256').update(await readFile(file)).digest('hex');
      manifest.shots[shot.name] = hash;
      const st = await page.evaluate(() => {
        const s = window.__sr.state;
        return s && { session: window.__sr.session().mode, phase: s.phase, paused: s.paused, title: s.title, energy: s.energy, starDate: s.starDate, score: s.score, loops: s.loops, outcome: s.missionOutcome, rating: s.rating?.title ?? null, zylons: s.remainingEnemies, starbases: s.starbasesLeft, chartTitle: s.chartTitle, chartRenders: s.chartRenders };
      });
      if (st) (manifest.state ??= {})[shot.name] = st;
      console.log(`${shot.name.padEnd(20)} ${hash.slice(0, 16)}${st ? `  [${st.session}${st.paused ? ' paused' : ''}] "${st.title.trim()}" E:${st.energy} STAR DATE:${st.starDate} score:${st.score}${st.rating ? ` ${st.outcome} -> ${st.rating}` : ''}` : ''}`);
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
