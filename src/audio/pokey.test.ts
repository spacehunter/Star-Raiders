import { describe, expect, it } from 'vitest';
import { random, setSeed } from '../core/rng';
import { VELOCITY_TAB } from '../rules/speed';
import { FakeAudioContext, type FakeSource } from './fakeAudio';
import {
  BEEP_PATTERNS,
  DIST_NOISE,
  DIST_PURE,
  EVENT_VOICE,
  MAX_PAN,
  PokeySynth,
  SOUND_EVENTS,
  TICK_SECONDS,
  barrelPan,
  beeperProgram,
  engineRegs,
  panFor,
  programFor,
  renderProgram,
  toneHz,
  volumeGain,
  type Program,
} from './pokey';
import { audioKeyFor, audioKeyPatch } from './keys';
import { keyAction } from '../input/Input';
import { pauseHelpLines } from '../ui/PauseOverlay';

/** The tones a pure-tone program plays, as [Hz, ticks] runs (silence as [0, ticks]). */
function toneRuns(p: Program): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  for (const t of p) {
    const r = t[0];
    const hz = r.audc & 0x0f ? Math.round(toneHz(r.audf)) : 0;
    const last = runs[runs.length - 1];
    if (last && last[0] === hz) last[1]++;
    else runs.push([hz, 1]);
  }
  return runs;
}

const tones = (p: Program) => toneRuns(p).filter(([hz]) => hz > 0).map(([hz]) => hz);
const near = (hz: number, target: number) => Math.abs(hz - target) / target < 0.02;

function makeSynth(opts: { active?: boolean; muted?: boolean } = {}) {
  const ctxs: FakeAudioContext[] = [];
  const target = new EventTarget();
  const synth = new PokeySynth({
    createContext: () => {
      const c = new FakeAudioContext();
      ctxs.push(c);
      return c as unknown as BaseAudioContext;
    },
    unlockTarget: target,
    hasBeenActive: () => opts.active ?? true,
    muted: opts.muted,
    randomByte: () => 0x55,
  });
  return { synth, ctxs, target, ctx: () => ctxs[0] };
}

describe('§17.12 POKEY tones: the spec frequencies are AUDF bytes at the 64 kHz clock', () => {
  it('$18 $40 $60 $10 $20 $48 $51 give 1280, 490, 330, 1880, 970, 440, 390 Hz', () => {
    const pairs: Array<[number, number]> = [
      [0x18, 1280],
      [0x40, 490],
      [0x60, 330],
      [0x10, 1880],
      [0x20, 970],
      [0x48, 440],
      [0x51, 390],
    ];
    for (const [audf, hz] of pairs) expect(near(toneHz(audf), hz), `$${audf.toString(16)}`).toBe(true);
  });
});

describe('§17.12 beeper patterns', () => {
  it('hyperwarp transit: 1280 Hz beeps, 13×', () => {
    const t = tones(beeperProgram(BEEP_PATTERNS.hyperwarpTransit));
    expect(t).toHaveLength(13);
    expect(t.every((hz) => near(hz, 1280))).toBe(true);
  });

  it('red alert: alternating ≈490/330 Hz, 8×', () => {
    const runs = toneRuns(beeperProgram(BEEP_PATTERNS.redAlert));
    expect(runs).toHaveLength(16);
    runs.forEach(([hz], i) => expect(near(hz, i % 2 ? 330 : 490)).toBe(true));
  });

  it('acknowledge: three short ≈1880 Hz beeps', () => {
    const runs = toneRuns(beeperProgram(BEEP_PATTERNS.acknowledge));
    const t = runs.filter(([hz]) => hz > 0);
    expect(t).toHaveLength(3);
    expect(t.every(([hz, n]) => near(hz, 1880) && n * TICK_SECONDS <= 0.1)).toBe(true);
  });

  it('damage report: ≈490→970 Hz, 3×', () => {
    const t = tones(beeperProgram(BEEP_PATTERNS.damageReport));
    expect(t).toHaveLength(6);
    t.forEach((hz, i) => expect(near(hz, i % 2 ? 970 : 490)).toBe(true));
  });

  it('message from starbase: ≈440, 490, 390 Hz', () => {
    const t = tones(beeperProgram(BEEP_PATTERNS.starbaseMessage));
    expect(t).toHaveLength(3);
    [440, 490, 390].forEach((hz, i) => expect(near(t[i], hz)).toBe(true));
  });
});

describe('§17.12 noise effects', () => {
  const rb = () => 0x37;
  const len = (e: Parameters<typeof programFor>[0]) => programFor(e, rb).length * TICK_SECONDS;

  it('photon: 0.4 s, noise with a rising envelope plus a falling tone', () => {
    const p = programFor('photon', rb);
    expect(len('photon')).toBeCloseTo(0.4, 5);
    const noise = p.map((t) => t[0]);
    const tone = p.map((t) => t[1]);
    expect(noise.every((r) => (r.audc & 0xf0) === DIST_NOISE)).toBe(true);
    expect(noise[15].audc & 15).toBeGreaterThan(noise[0].audc & 15);
    expect(tone.every((r) => (r.audc & 0xf0) === DIST_PURE)).toBe(true);
    expect(toneHz(tone[20].audf)).toBeLessThan(toneHz(tone[0].audf)); // falling
  });

  it('Zylon explosion: 0.8 s, a tone sweep that turns into loud noise', () => {
    const p = programFor('zylonExplosion', rb);
    expect(len('zylonExplosion')).toBeCloseTo(0.8, 5);
    expect(p[0][0].audc & 0xf0).toBe(DIST_PURE);
    expect(toneHz(p[9][0].audf)).toBeLessThan(toneHz(p[0][0].audf));
    expect(p[10][0].audc).toBe(DIST_NOISE | 15);
  });

  it('shield explosion: about 1 s of heavier (lower) noise than the Zylon explosion', () => {
    const shield = programFor('shieldExplosion', rb);
    const zylon = programFor('zylonExplosion', rb);
    expect(len('shieldExplosion')).toBeCloseTo(1, 5);
    expect(shield.every((t) => (t[0].audc & 0xf0) === DIST_NOISE)).toBe(true);
    expect(shield[0][0].audf).toBeGreaterThan(zylon[10][0].audf); // a larger divider: lower pitch
  });

  it('starship explosion: 1 s of random-pitch noise and tone', () => {
    let n = 0;
    const p = programFor('starshipExplosion', () => (n = (n * 73 + 41) & 0xff));
    expect(p.length * TICK_SECONDS).toBeCloseTo(1, 5);
    expect(new Set(p.map((t) => t[0].audf)).size).toBeGreaterThan(20);
    expect(new Set(p.map((t) => t[0].audc & 0xf0))).toEqual(new Set([DIST_NOISE, DIST_PURE]));
  });
});

describe('§17.12 engines', () => {
  it('silent at 0; pitch and volume rise with every speed key and in hyperwarp', () => {
    expect(engineRegs(0).audc & 15).toBe(0);
    const regs = [...VELOCITY_TAB.slice(1), 254].map(engineRegs);
    for (let i = 1; i < regs.length; i++) {
      expect(regs[i].audf).toBeLessThan(regs[i - 1].audf); // smaller divider = higher pitch
      expect(regs[i].audc & 15).toBeGreaterThanOrEqual(regs[i - 1].audc & 15);
      expect(regs[i].audc & 0xf0).toBe(DIST_NOISE);
    }
    expect(regs[regs.length - 1].audc & 15).toBeGreaterThan(regs[0].audc & 15);
  });
});

describe('POKEY renderer', () => {
  it('a pure-tone program comes out at its frequency (zero crossings)', () => {
    const rate = 48000;
    const s = renderProgram(beeperProgram({ audf: [0x18], on: 60, off: 0, repeat: 1, volume: 8 }), rate);
    let crossings = 0;
    for (let i = 1; i < s.length; i++) if (s[i - 1] < 0 !== s[i] < 0) crossings++;
    const hz = crossings / 2 / (s.length / rate);
    expect(near(hz, 1280)).toBe(true);
  });

  it('volume 0 is silence and the output stays inside ±1', () => {
    expect(renderProgram([[{ audf: 10, audc: DIST_PURE }]], 8000).every((v) => v === 0)).toBe(true);
    const loud = renderProgram(programFor('starshipExplosion', () => 3), 8000);
    expect(Math.max(...loud.map(Math.abs))).toBeLessThanOrEqual(1);
  });

  it('noise never draws from the game random stream (seeded games replay)', () => {
    setSeed(1979);
    const a = [random(), random(), random()];
    setSeed(1979);
    const s = new PokeySynth({ context: new FakeAudioContext() as unknown as BaseAudioContext });
    for (const e of SOUND_EVENTS) s.play(e);
    renderProgram(programFor('starshipExplosion', () => 9), 8000);
    expect([random(), random(), random()]).toEqual(a);
  });
});

describe('PokeySynth: every §17.12 event plays through the synth', () => {
  it('each event is logged as played on its voice', () => {
    const { synth, ctx } = makeSynth();
    SOUND_EVENTS.forEach((e, i) => {
      ctx().currentTime = i * 5; // far apart: nothing still playing
      expect(synth.play(e)).toBe('played');
    });
    expect(synth.log.map((l) => [l.event, l.voice, l.result])).toEqual(SOUND_EVENTS.map((e) => [e, EVENT_VOICE[e].voice, 'played']));
    // One AudioBufferSource per event (plus the unlock blip), each with its rendered buffer.
    const sources = ctx().sources.slice(1);
    expect(sources).toHaveLength(SOUND_EVENTS.length);
    expect(sources.every((s) => (s.buffer?.duration ?? 0) > 0.15)).toBe(true);
  });

  it('engines: a looping noise source whose rate and gain follow the velocity, silent at 0', () => {
    const { synth, ctx } = makeSynth();
    synth.engine(32);
    const src = ctx().sources[1] as FakeSource;
    expect(src.loop).toBe(true);
    const gain = ctx().gains[1].gain;
    const g32 = gain.value;
    const r32 = src.playbackRate.value;
    synth.engine(112);
    expect(gain.value).toBeGreaterThan(g32);
    expect(src.playbackRate.value).toBeGreaterThan(r32);
    synth.engine(0);
    expect(gain.value).toBe(0);
    expect(synth.engineLevel.volume).toBe(0);
  });
});

describe('PokeySynth priorities (R: BEEP pattern order; explosions)', () => {
  it('a lower beeper pattern is dropped while a higher one plays; equal or higher cuts in', () => {
    const { synth, ctx } = makeSynth();
    expect(synth.play('damageReport')).toBe('played');
    ctx().currentTime = 0.1;
    expect(synth.play('hyperwarpTransit')).toBe('dropped');
    expect(synth.play('acknowledge')).toBe('dropped');
    expect(synth.play('starbaseMessage')).toBe('played');
    const [damage] = ctx().sources.slice(1);
    expect(damage.stoppedAt).toBe(0.1);
    ctx().currentTime = 10; // finished: anything plays
    expect(synth.play('hyperwarpTransit')).toBe('played');
    ctx().currentTime = 10.2;
    expect(synth.play('redAlert')).toBe('played'); // arrival's red alert cuts the transit beeps
  });

  it('explosions: Zylon < shield < starship; photons have their own voice', () => {
    const { synth, ctx } = makeSynth();
    synth.play('starshipExplosion');
    ctx().currentTime = 0.2;
    expect(synth.play('zylonExplosion')).toBe('dropped');
    expect(synth.play('shieldExplosion')).toBe('dropped');
    expect(synth.play('photon')).toBe('played');
    ctx().currentTime = 2;
    synth.play('zylonExplosion');
    ctx().currentTime = 2.1;
    expect(synth.play('shieldExplosion')).toBe('played');
  });
});

describe('Bend 8: headphone mix', () => {
  it('photons pan to their barrel (mirrored in the Aft view); objects to their screen side', () => {
    expect(barrelPan(0, false)).toBeLessThan(0);
    expect(barrelPan(1, false)).toBeGreaterThan(0);
    expect(barrelPan(0, true)).toBeGreaterThan(0);
    expect(panFor(2000, 4000, false)).toBeGreaterThan(0);
    expect(panFor(-2000, 4000, false)).toBeLessThan(0);
    expect(panFor(2000, -4000, true)).toBeLessThan(0);
    expect(panFor(0, 3000, false)).toBeCloseTo(0, 6);
    expect(Math.abs(panFor(1e6, 10, false))).toBeLessThanOrEqual(MAX_PAN);
  });

  it('a panned event goes through a StereoPanner', () => {
    const { synth, ctx } = makeSynth();
    synth.play('photon', { pan: barrelPan(1, false) });
    expect(ctx().panners[0].pan.value).toBeCloseTo(0.45, 6);
  });
});

describe('Bend 8: mute and volume', () => {
  it('mute sets the master gain to 0 at once (no ramp); unmute restores the volume', () => {
    const { synth, ctx } = makeSynth();
    synth.play('redAlert');
    ctx().currentTime = 0.5;
    synth.setMuted(true);
    const g = ctx().master.gain;
    expect(g.value).toBe(0);
    expect(g.events.slice(-2)).toEqual([
      ['cancel', 0, 0.5],
      ['set', 0, 0.5],
    ]);
    synth.setMuted(false);
    expect(g.value).toBeCloseTo(volumeGain(7), 6);
  });

  it('starting muted stays silent; events are still logged as muted', () => {
    const { synth, ctx } = makeSynth({ muted: true });
    expect(ctx().master.gain.value).toBe(0);
    synth.play('acknowledge');
    expect(synth.log[0]).toMatchObject({ event: 'acknowledge', muted: true, result: 'played' });
  });

  it('volume steps 0–10 grow the gain; 0 is silent', () => {
    expect(volumeGain(0)).toBe(0);
    for (let v = 1; v <= 10; v++) expect(volumeGain(v)).toBeGreaterThan(volumeGain(v - 1));
    expect(volumeGain(10)).toBeLessThan(1);
  });

  it('N toggles mute, - and = step the volume (and unmute); none is a game key', () => {
    expect(audioKeyFor('KeyN')).toBe('mute');
    expect(audioKeyPatch('mute', { volume: 7, muted: false })).toEqual({ volume: 7, muted: true });
    expect(audioKeyPatch('volumeUp', { volume: 10, muted: true })).toEqual({ volume: 10, muted: false });
    expect(audioKeyPatch('volumeDown', { volume: 0, muted: false })).toEqual({ volume: 0, muted: false });
    expect(audioKeyPatch('volumeDown', { volume: 7, muted: false })).toEqual({ volume: 6, muted: false });
    for (const code of ['KeyN', 'Minus', 'Equal', 'NumpadAdd', 'NumpadSubtract']) expect(keyAction(code, '', { wasd: false })).toBeNull();
  });

  it('the pause help names the sound keys and shows the setting', () => {
    const text = (l: ReturnType<typeof pauseHelpLines>) => l.map((line) => line.map(([t]) => t).join('')).join('\n');
    expect(text(pauseHelpLines(false, { volume: 4, muted: false }))).toMatch(/N\s+SOUND ON \/ MUTE[\s\S]*- =\s+VOLUME 4/);
    expect(text(pauseHelpLines(false, { volume: 4, muted: true }))).toMatch(/SOUND OFF/);
  });
});

describe('AudioContext lifecycle', () => {
  it('no context until the first key press, click or tap; then exactly one', () => {
    const { synth, ctxs, target } = makeSynth({ active: false });
    expect(synth.context).toBeNull();
    expect(synth.play('acknowledge')).toBe('silent');
    target.dispatchEvent(new Event('touchend'));
    expect(ctxs).toHaveLength(1);
    target.dispatchEvent(new Event('keydown'));
    target.dispatchEvent(new Event('click'));
    expect(ctxs).toHaveLength(1);
    expect(synth.play('acknowledge')).toBe('played');
  });

  it('a tap resumes a suspended context', () => {
    const { ctx, target } = makeSynth();
    ctx().state = 'suspended';
    target.dispatchEvent(new Event('pointerdown'));
    expect(ctx().state).toBe('running');
  });

  it('pause suspends and keeps it suspended through key presses until the game goes on', async () => {
    const { synth, ctx, target } = makeSynth();
    synth.setPaused(true);
    await Promise.resolve();
    expect(ctx().state).toBe('suspended');
    target.dispatchEvent(new Event('keydown'));
    expect(ctx().state).toBe('suspended');
    synth.setPaused(false);
    await Promise.resolve();
    expect(ctx().state).toBe('running');
  });

  it('dispose closes the context, stops every voice and removes the listeners', () => {
    const { synth, ctxs, ctx, target } = makeSynth();
    synth.engine(64);
    synth.play('redAlert');
    synth.dispose();
    expect(ctx().state).toBe('closed');
    expect(ctx().sources.slice(1).every((s) => s.stoppedAt !== null)).toBe(true);
    target.dispatchEvent(new Event('keydown'));
    expect(ctxs).toHaveLength(1);
    expect(synth.play('photon')).toBe('silent');
  });

  it('5 restarts (dispose + new synth) leave exactly one open context', () => {
    const all: FakeAudioContext[] = [];
    let synth: PokeySynth | null = null;
    for (let i = 0; i < 6; i++) {
      synth?.dispose();
      synth = new PokeySynth({
        createContext: () => {
          const c = new FakeAudioContext();
          all.push(c);
          return c as unknown as BaseAudioContext;
        },
        unlockTarget: new EventTarget(),
        hasBeenActive: () => true,
      });
      synth.play('acknowledge');
    }
    expect(all).toHaveLength(6);
    expect(all.filter((c) => c.state !== 'closed')).toHaveLength(1);
  });
});
