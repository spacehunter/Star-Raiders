import { describe, expect, it } from 'vitest';
import { IdleTimer, PauseControl, attractPhrase, consoleCommand, endSequencePhrase, nextLevel, phraseLoops } from './session';
import { rateMission } from './rating';
import { TitleLine } from './title';
import { PHRASE, type Phrase } from '../rules/messages';
import { IDLE_LOOPS } from '../rules/timing';
import type { MissionOutcome } from '../rules/rating';

/** Every segment a phrase shows on the title line, in order, by running the TitleLine loop. */
function play(phrase: Phrase): { shown: string[]; loops: number } {
  const t = new TitleLine();
  t.set(phrase);
  const shown: string[] = [];
  let loops = 0;
  while (t.current) {
    const text = t.text!;
    if (shown[shown.length - 1] !== text) shown.push(text);
    t.loop();
    loops++;
  }
  return { shown, loops };
}

describe('§17.10 end sequence on the title line, for every way a mission ends', () => {
  const cases: Array<[MissionOutcome, number, string[]]> = [
    // NOVICE complete: 80 + 10 = 90 → NOVICE class 4.
    ['complete', 10, ['STAR FLEET TO', 'STAR CRUISER 7', 'MISSION COMPLETE', 'NEW RANK IS:', 'NOVICE', 'CLASS 4', 'CONGRATULATIONS']],
    // Zero energy: 60 + 30 = 90.
    ['zeroEnergy', 30, ['STAR FLEET TO', 'STAR CRUISER 7', 'MISSION ABORTED', 'ZERO ENERGY', 'NEW RANK IS:', 'NOVICE', 'CLASS 4', 'REPORT TO BASE', 'FOR TRAINING']],
    // Destroyed: 40 + 0 = 40 → GARBAGE SCOW CAPTAIN (16–47), class from the low bits.
    ['destroyed', 0, ['STAR FLEET TO', 'ALL UNITS', 'STAR CRUISER 7', 'DESTROYED', 'BY ZYLON FIRE', 'POSTHUMOUS RANK IS:', 'GARBAGE SCOW CAPTAIN', 'CLASS 2']],
    // Aborted (Atari key / pause menu X): 60 + 101 = 161 → PILOT class 3.
    ['aborted', 101, ['STAR FLEET TO', 'STAR CRUISER 7', 'MISSION ABORTED', 'NEW RANK IS:', 'PILOT', 'CLASS 3', 'CONGRATULATIONS']],
  ];

  for (const [outcome, score, lines] of cases) {
    it(`${outcome}: ${lines.join(' / ')}`, () => {
      const r = rateMission('NOVICE', outcome, score);
      const phrase = endSequencePhrase(outcome, r.messages);
      const { shown, loops } = play(phrase);
      // A blank segment first; the destroyed sequence also ends on one.
      expect(shown[0]).toBe(' ');
      const words = shown.filter((s) => s.trim());
      expect(words).toEqual(lines);
      expect(words.slice(-3)).toContain(`CLASS ${r.classNumber}`);
      // Each segment 60 loops; the sequence is over (line hidden) after phraseLoops loops.
      expect(loops).toBe(phraseLoops(phrase));
      expect(loops).toBe(60 * phrase.length);
    });
  }

  it('the rank segments follow NEW RANK IS: / POSTHUMOUS RANK IS:', () => {
    const r = rateMission('COMMANDER', 'complete', 200); // 311 → STAR COMMANDER class 1
    const words = play(endSequencePhrase('complete', r.messages)).shown.filter((s) => s.trim());
    const i = words.indexOf('NEW RANK IS:');
    expect(words.slice(i, i + 3)).toEqual(['NEW RANK IS:', 'STAR COMMANDER', 'CLASS 1']);
  });
});

describe('§3 / §17.11 attract mode and console keys', () => {
  it('attract title: level, STAR RAIDERS, COPYRIGHT ATARI 1979', () => {
    expect(play(attractPhrase('NOVICE')).shown.map((s) => s.trim())).toEqual(['NOVICE MISSION', 'STAR RAIDERS', 'COPYRIGHT ATARI 1979']);
    expect(attractPhrase('COMMANDER')[0].text).toBe('COMMANDER MISSION');
  });

  it('SELECT cycles NOVICE → PILOT → WARRIOR → COMMANDER → NOVICE', () => {
    expect(nextLevel('NOVICE')).toBe('PILOT');
    expect(nextLevel('PILOT')).toBe('WARRIOR');
    expect(nextLevel('WARRIOR')).toBe('COMMANDER');
    expect(nextLevel('COMMANDER')).toBe('NOVICE');
  });

  it('Tab is SELECT, 1–4 pick a level, Enter is START; nothing in a mission', () => {
    expect(consoleCommand('attract', 'Tab')).toEqual({ type: 'select' });
    expect(consoleCommand('attract', 'Enter')).toEqual({ type: 'start' });
    expect(consoleCommand('attract', 'Digit3')).toEqual({ type: 'level', level: 'WARRIOR' });
    expect(consoleCommand('attract', 'Numpad4')).toEqual({ type: 'level', level: 'COMMANDER' });
    expect(consoleCommand('attract', 'Digit5')).toBeNull();
    expect(consoleCommand('mission', 'Enter')).toBeNull();
    expect(consoleCommand('mission', 'Tab')).toBeNull();
    expect(consoleCommand('mission', 'Digit1')).toBeNull();
  });

  it('Enter, Space or Esc moves on from the end sequence and the debrief card', () => {
    for (const mode of ['ending', 'debrief'] as const) {
      for (const code of ['Enter', 'Space', 'Escape']) expect(consoleCommand(mode, code)).toEqual({ type: 'continue' });
      expect(consoleCommand(mode, 'KeyZ')).toBeNull();
    }
  });
});

describe('§3 / §17.11 idle timeout', () => {
  it('expires after 32768 loops (≈ 9.1 minutes), not before', () => {
    expect(IDLE_LOOPS).toBe(32768);
    expect(IDLE_LOOPS / 60 / 60).toBeCloseTo(9.1, 1);
    const t = new IdleTimer();
    for (let i = 0; i < IDLE_LOOPS - 1; i++) expect(t.advance(1 / 60)).toBe(false);
    expect(t.advance(1 / 60)).toBe(true);
  });

  it('runs on frame time of any length and resets on a key', () => {
    const t = new IdleTimer();
    t.advance(8 * 60); // 8 minutes in one go
    expect(t.expired).toBe(false);
    t.reset();
    t.advance(8 * 60);
    expect(t.expired).toBe(false);
    t.advance(1.2 * 60);
    expect(t.expired).toBe(true);
  });
});

describe('§5.11 pause', () => {
  const centre = { x: 0, y: 0 } as const;
  const left = { x: -1, y: 0 } as const;

  it('stays paused until a key is pressed', () => {
    const p = new PauseControl();
    p.pause(centre);
    for (let i = 0; i < 100; i++) expect(p.update([], centre)).toBeNull();
    expect(p.paused).toBe(true);
    expect(p.update(['SHIELDS'], centre)).toBe('resume');
    expect(p.paused).toBe(false);
  });

  it('moving the stick continues', () => {
    const p = new PauseControl();
    p.pause(centre);
    expect(p.update([], left)).toBe('resume');
  });

  it('a stick held when P was pressed must come back to the centre first', () => {
    const p = new PauseControl();
    p.pause(left);
    expect(p.update([], left)).toBeNull();
    expect(p.update([], centre)).toBeNull();
    expect(p.update([], { x: 0, y: 1 })).toBe('resume');
  });

  it('X in the pause menu aborts; P again resumes', () => {
    const p = new PauseControl();
    p.pause(centre);
    expect(p.update(['ABORT'], centre)).toBe('abort');
    p.pause(centre);
    expect(p.update(['PAUSE'], centre)).toBe('resume');
  });

  it('does nothing when not paused', () => {
    expect(new PauseControl().update(['FIRE'], left)).toBeNull();
  });
});

describe('§17.11 WHATS WRONG?', () => {
  it('is one 60-loop segment on the title line', () => {
    expect(play(PHRASE.WHATS_WRONG)).toEqual({ shown: ['WHATS WRONG?'], loops: 60 });
  });
});
