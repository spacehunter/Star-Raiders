/**
 * Damage control (MANUAL_SPEC §7, §17.2, §17.3): every subsystem forced into every state, and
 * the effect of that state, through the code the game runs.
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { GameState } from '../game/GameState';
import { ControlPanel } from '../ui/ControlPanel';
import { SUBSYSTEMS, allSystemsOk, rollDamage, type DamageStatus, type Subsystem, type SubsystemStatus } from '../rules/damage';
import { PHRASE, subsystemPhrase } from '../rules/messages';
import { VELOCITY_TAB } from '../rules/speed';
import { Galaxy, RadioFeed, START_SECTOR } from './galaxy';
import { PanelColors } from './panel';
import { TitleLine } from './title';
import { ZylonSim } from './zylons';
import {
  DamageControl,
  ENGINES_DESTROYED_MAX_KEY,
  STATUS_BITS,
  computerFunctions,
  computerReadoutsLive,
  engineKeyFor,
  jitterVelocity,
  scanState,
  scanZ,
  statusFromBits,
  worseStatus,
} from './damage';

const STATES: SubsystemStatus[] = ['ok', 'damaged', 'destroyed'];

const forced = (system: Subsystem, status: SubsystemStatus) => {
  const host = { damage: allSystemsOk() };
  const dc = new DamageControl(host, new TitleLine());
  dc.force(system, status);
  return host.damage;
};

/** Each subsystem's observable effect, measured through the game's own code. */
const EFFECT: Record<Subsystem, (d: DamageStatus) => unknown> = {
  // Barrels used by 4 presses 24 loops apart (the refire wait), and how many launched.
  photons: (d) => {
    const sim = new ZylonSim(createRng(1));
    const barrels = new Set<number>();
    let launched = 0;
    for (let i = 0; i < 4; i++) {
      const b = sim.barrel;
      if (sim.fire('FRONT', d.photons, false) === 'launched') {
        launched++;
        barrels.add(b);
      }
      for (let k = 0; k < 24; k++) sim.loop({ turn: { x: 0, y: 0 }, velocity: 0, view: 'FRONT', level: 'NOVICE', sectorZylons: 0, starbaseSector: false, hyperwarp: false, count256: k, computer: true, photonStatus: d.photons });
    }
    return { launched, barrels: barrels.size };
  },
  // Key 9 pressed, then 200 loops of velocity: the key selected and the distinct speeds seen.
  engines: (d) => {
    const key = engineKeyFor(9, d.engines);
    const rng = createRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const v = jitterVelocity(d.engines, VELOCITY_TAB[key], false, () => Math.floor(rng() * 256));
      seen.add(v ?? VELOCITY_TAB[key]);
    }
    return { key, speeds: seen.size, max: Math.max(...seen) };
  },
  // Shields switched on for 1024 loops: how many 4-loop colour stores had them up.
  shields: (d) => {
    const c = new PanelColors(createRng(9));
    let up = 0;
    for (let i = 0; i < 1024; i++) {
      c.loop({ energy: 9999, shieldsOn: true, shieldsStatus: d.shields });
      if ((c.count256 & 3) === 0 && c.shieldsUp) up++;
    }
    return up === 256 ? 'steady' : up === 0 ? 'off' : 'flicker';
  },
  // θ Φ R after the target moves, and whether the cross hairs / display / lock work.
  computer: (d) => {
    const gs = new GameState();
    gs.damage = d;
    const panel = new ControlPanel(gs, () => 0);
    panel.loop({ x: 2560, y: -1600, z: 2400 });
    const before = panel.panelData(0, false);
    gs.damage.computer = d.computer; // (the state was set before the first loop)
    panel.loop({ x: -5000, y: 3000, z: 9000 });
    const after = panel.panelData(0, false);
    const frozen = before.theta === after.theta && before.phi === after.phi && before.range === after.range;
    return { readouts: frozen ? 'frozen' : 'live', crosshairs: computerFunctions(d.computer) };
  },
  // Two blips, one ahead and one behind, drawn for 64 loops: what the scan shows.
  sectorScan: (d) => {
    const scan = scanState(d.sectorScan, d.computer);
    const rng = createRng(3);
    const zs = new Set<number>();
    for (let i = 0; i < 64; i++) {
      for (const z of [8000, -12000]) {
        const shown = scanZ(scan, z, () => Math.floor(rng() * 256));
        if (shown !== null) zs.add(shown);
      }
    }
    return { positions: [...zs].sort((a, b) => a - b), ship: scan.ship };
  },
  // The chart after the fleets move, and whether STARBASE SURROUNDED/DESTROYED get through.
  radio: (d) => {
    const g = new Galaxy('PILOT', createRng(5));
    const feed = new RadioFeed(g);
    feed.sync(d.radio);
    const before = JSON.stringify(feed.sectors());
    const c = g.sectors().find((s) => s.zylons > 0)!;
    const targetsBefore = feed.targets(c.x, c.y);
    g.destroyZylon(c.x, c.y);
    feed.sync(d.radio);
    return {
      chart: JSON.stringify(feed.sectors()) === before ? 'frozen' : 'live',
      targets: feed.targets(c.x, c.y) === targetsBefore ? 'frozen' : 'live',
      messages: feed.relaysMessages,
    };
  },
};

const EXPECTED: Record<Subsystem, Record<SubsystemStatus, unknown>> = {
  photons: {
    ok: { launched: 4, barrels: 2 },
    damaged: { launched: 4, barrels: 1 }, // one barrel only
    destroyed: { launched: 0, barrels: 0 }, // no fire
  },
  engines: {
    ok: { key: 9, speeds: 1, max: 112 },
    damaged: { key: 9, speeds: 8, max: 112 }, // 112 AND RANDOM: 0, 16, … 112
    destroyed: { key: 5, speeds: 2, max: 16 }, // capped at key 5 (16 KM/loop) and still jittering
  },
  shields: { ok: 'steady', damaged: 'flicker', destroyed: 'off' },
  computer: {
    ok: { readouts: 'live', crosshairs: true },
    damaged: { readouts: 'frozen', crosshairs: true },
    destroyed: { readouts: 'frozen', crosshairs: false },
  },
  sectorScan: {
    ok: { positions: [-12000, 8000], ship: true },
    damaged: { positions: [-12000, -8000, 8000, 12000], ship: true }, // each object and its mirror image
    destroyed: { positions: [], ship: true }, // only our ship
  },
  radio: {
    ok: { chart: 'live', targets: 'live', messages: true },
    damaged: { chart: 'frozen', targets: 'live', messages: true },
    destroyed: { chart: 'frozen', targets: 'frozen', messages: false },
  },
};

describe('§17.3 each subsystem in each state', () => {
  for (const system of SUBSYSTEMS) {
    for (const status of STATES) {
      it(`${system} ${status}`, () => {
        const d = forced(system, status);
        // Only this subsystem changed.
        for (const other of SUBSYSTEMS) expect(d[other]).toBe(other === system ? status : 'ok');
        expect(EFFECT[system](d)).toEqual(EXPECTED[system][status]);
      });
    }
  }
});

describe('§17.3 effect details', () => {
  it('damaged photons keep using the barrel they had; OK ones alternate', () => {
    const sim = new ZylonSim(createRng(1));
    sim.barrel = 1;
    sim.fire('FRONT', 'damaged', false);
    expect(sim.barrel).toBe(1);
    expect(sim.photons[1].life).toBeGreaterThan(0);
    expect(sim.photons[0].life).toBe(0);
  });

  it('engines: only destroyed caps the key, and only for keys 6–9', () => {
    for (let k = 0; k <= 9; k++) {
      expect(engineKeyFor(k, 'ok')).toBe(k);
      expect(engineKeyFor(k, 'damaged')).toBe(k);
      expect(engineKeyFor(k, 'destroyed')).toBe(Math.min(k, ENGINES_DESTROYED_MAX_KEY));
    }
  });

  it('engines: the jitter is NEWVELOCITY AND RANDOM, and stops in hyperwarp', () => {
    expect(jitterVelocity('damaged', 32, false, () => 0xff)).toBe(32);
    expect(jitterVelocity('damaged', 32, false, () => 0xdf)).toBe(0);
    expect(jitterVelocity('destroyed', 96, false, () => 0x21)).toBe(32);
    expect(jitterVelocity('damaged', 32, true, () => 0)).toBeNull();
    expect(jitterVelocity('ok', 32, false, () => 0)).toBeNull();
  });

  it('damaged shields are up about 200/256 of the time', () => {
    const c = new PanelColors(createRng(11));
    let up = 0;
    let stores = 0;
    for (let i = 0; i < 4 * 4096; i++) {
      c.loop({ energy: 9999, shieldsOn: true, shieldsStatus: 'damaged' });
      if ((c.count256 & 3) === 0) {
        stores++;
        if (c.shieldsUp) up++;
      }
    }
    expect(up / stores).toBeGreaterThan(0.74);
    expect(up / stores).toBeLessThan(0.82);
  });

  it('a destroyed computer is switched off (R: DAMAGE) and hides our ship on the scan (R: DRAWLINES)', () => {
    const host = { damage: allSystemsOk() };
    let off = 0;
    const dc = new DamageControl(host, new TitleLine(), { computerDestroyed: () => off++ });
    dc.report('computer', 'damaged');
    expect(off).toBe(0);
    dc.report('computer', 'destroyed');
    expect(off).toBe(1);
    expect(computerReadoutsLive('damaged')).toBe(false);
    expect(scanState('ok', 'destroyed')).toEqual({ objects: true, mirrored: false, ship: false });
  });
});

describe('§17.3 state bits (code, not the comment)', () => {
  it('OK %00, damaged %10, destroyed %11 in bits 7–6', () => {
    expect(STATUS_BITS).toEqual({ ok: 0b00 << 6, damaged: 0b10 << 6, destroyed: 0b11 << 6 });
    for (const s of STATES) expect(statusFromBits(STATUS_BITS[s] | 0x10)).toBe(s);
  });

  it('a state never improves without repair', () => {
    expect(worseStatus('destroyed', 'damaged')).toBe('destroyed');
    expect(worseStatus('damaged', 'destroyed')).toBe('destroyed');
    expect(worseStatus('ok', 'damaged')).toBe('damaged');
    const host = { damage: allSystemsOk() };
    const dc = new DamageControl(host, new TitleLine());
    dc.report('engines', 'destroyed');
    expect(dc.report('engines', 'damaged').status).toBe('destroyed');
    expect(dc.bits('engines')).toBe(0xc0);
  });
});

describe('§17.3 DAMAGE CONTROL messages, beep and repair', () => {
  it('blank, DAMAGE CONTROL, then the subsystem phrase, which repeats until docking clears it', () => {
    const title = new TitleLine();
    const host = { damage: allSystemsOk() };
    const beeps: string[] = [];
    const dc = new DamageControl(host, title, { beep: (r) => beeps.push(`${r.system} ${r.status}`) });
    dc.report('sectorScan', 'damaged');
    expect(beeps).toEqual(['sectorScan damaged']);
    expect(title.current).toBe(PHRASE.DAMAGE_CONTROL);
    expect(title.pending).toEqual(subsystemPhrase('sectorScan', 'damaged'));

    const seen: string[] = [];
    for (let i = 0; i < 2000; i++) {
      title.loop();
      const t = title.text;
      if (t !== null && t.trim() && seen[seen.length - 1] !== t) seen.push(t);
    }
    expect(seen.slice(0, 4)).toEqual(['DAMAGE CONTROL', 'SECTOR SCAN', 'DAMAGED', 'SECTOR SCAN']);

    title.clearQueue(); // R: DOCKING enqueues nothing
    dc.repairAll();
    expect(host.damage).toEqual(allSystemsOk());
  });

  it('every subsystem has its ROM phrase in both states', () => {
    const words: string[] = [];
    for (const s of SUBSYSTEMS)
      for (const st of ['damaged', 'destroyed'] as const)
        words.push(
          subsystemPhrase(s, st)
            .map((x) => x.text.trim())
            .filter(Boolean)
            .join(' ')
        );
    expect(words).toEqual([
      'PHOTONS DAMAGED', 'PHOTONS DESTROYED', 'ENGINES DAMAGED', 'ENGINES DESTROYED',
      'SHIELDS DAMAGED', 'SHIELDS DESTROYED', 'COMPUTER DAMAGED', 'COMPUTER DESTROYED',
      'SECTOR SCAN DAMAGED', 'SECTOR SCAN DESTROYED', 'SUB-SPACE RADIO DAMAGED', 'SUB-SPACE RADIO DESTROYED',
    ]);
  });

  it('repairAll restores all six from any mix; only docking calls it', () => {
    const host = { damage: allSystemsOk() };
    const dc = new DamageControl(host, new TitleLine());
    SUBSYSTEMS.forEach((s, i) => dc.force(s, STATES[i % 3]));
    expect(Object.values(host.damage)).toContain('destroyed');
    dc.repairAll();
    expect(host.damage).toEqual(allSystemsOk());
  });

  it('the roll feeds the report: rates per level and damaged vs destroyed by torpedo age', () => {
    const rate = (level: 'NOVICE' | 'PILOT' | 'WARRIOR' | 'COMMANDER') => {
      let n = 0;
      for (let b = 0; b < 256; b++) if (rollDamage(level, allSystemsOk(), 0, () => b)) n++;
      return n;
    };
    // chance/256 of the bytes harm something, and 6 of each 8 slots are subsystems.
    expect([rate('NOVICE'), rate('PILOT'), rate('WARRIOR'), rate('COMMANDER')]).toEqual([0, 60, 136, 192]);
    expect(rollDamage('PILOT', allSystemsOk(), 29, () => 2)?.status).toBe('damaged');
    expect(rollDamage('PILOT', allSystemsOk(), 30, () => 2)?.status).toBe('destroyed');
    // Not both computer and scan destroyed.
    const d = { ...allSystemsOk(), sectorScan: 'destroyed' as const };
    expect(rollDamage('COMMANDER', d, 60, () => 3)?.status).toBe('damaged');
  });
});

describe('§7 the radio freeze holds from the moment of damage', () => {
  it('the chart keeps the map it had when the radio was hit, and repair brings it back', () => {
    const g = new Galaxy('WARRIOR', createRng(1979), START_SECTOR);
    const feed = new RadioFeed(g);
    feed.sync('ok');
    const atDamage = JSON.stringify(g.sectors());
    feed.sync('damaged');
    const c = g.sectors().find((s) => s.zylons > 0)!;
    g.destroyZylon(c.x, c.y);
    expect(JSON.stringify(feed.sectors())).toBe(atDamage);
    feed.sync('ok');
    expect(JSON.stringify(feed.sectors())).toBe(JSON.stringify(g.sectors()));
  });
});
