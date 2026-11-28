/**
 * Console, attract mode, pause and idle rules (MANUAL_SPEC §3, §5.11, §17.10, §17.11;
 * OVERHAUL_PLAN Phase 11, Part 4 bend 7). Pure logic, no DOM: main.ts and Game.ts wire it up.
 *
 * - SELECT cycles NOVICE → PILOT → WARRIOR → COMMANDER and shows `<LEVEL> MISSION`; START begins.
 *   Keys: Tab is SELECT, 1–4 pick a level directly, Enter is START (bend 1: the 800's console keys
 *   were F-row buttons a PC keyboard does not have).
 * - The attract mode shows the level, then `STAR RAIDERS` / `COPYRIGHT ATARI 1979` (§17.11).
 * - P pauses until the stick moves or a key is pressed (§5.11).
 * - 32768 idle loops (≈ 9.1 minutes) abort the mission to the attract mode (§3, §17.11).
 */
import { LEVELS, type MissionLevel } from '../rules/levels';
import { PHRASE, endOfMissionPhrase, type Phrase } from '../rules/messages';
import type { MissionOutcome } from '../rules/rating';
import { IDLE_LOOPS, LOOP_HZ } from '../rules/timing';
import type { Stick } from './motion';

/** What the game is doing. `ending` is the title-line end sequence; `debrief` the card after it. */
export type SessionMode = 'attract' | 'mission' | 'ending' | 'debrief';

/** SELECT: the next mission level, wrapping after COMMANDER (§3). */
export function nextLevel(level: MissionLevel): MissionLevel {
  return LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length];
}

/** The attract-mode title phrase: `<LEVEL> MISSION`, `STAR RAIDERS`, `COPYRIGHT ATARI 1979` (§17.11). */
export function attractPhrase(level: MissionLevel): Phrase {
  return [...PHRASE.MISSION[level], ...PHRASE.STAR_RAIDERS];
}

export type ConsoleCommand =
  | { type: 'select' }
  | { type: 'level'; level: MissionLevel }
  | { type: 'start' }
  | { type: 'continue' };

/**
 * The console key for a key code in a session mode, or null. In a mission the console keys do
 * nothing (they are not "unknown" keys either): the flight keys belong to Game.
 */
export function consoleCommand(mode: SessionMode, code: string): ConsoleCommand | null {
  if (mode === 'attract') {
    if (code === 'Tab') return { type: 'select' };
    if (code === 'Enter' || code === 'NumpadEnter') return { type: 'start' };
    const d = /^(?:Digit|Numpad)([1-4])$/.exec(code);
    if (d) return { type: 'level', level: LEVELS[Number(d[1]) - 1] };
    return null;
  }
  if (mode === 'ending' || mode === 'debrief') {
    if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space' || code === 'Escape') return { type: 'continue' };
  }
  return null;
}

/** Loops the end sequence takes on the title line, blank segments included. */
export function phraseLoops(phrase: Phrase): number {
  return phrase.reduce((n, s) => n + s.loops, 0);
}

/** The §17.10 end sequence as title-line segments for an outcome and its message list. */
export function endSequencePhrase(outcome: MissionOutcome, messages: readonly string[]): Phrase {
  return endOfMissionPhrase(outcome, messages);
}

/**
 * The idle timer (§3, §17.11): counts 1/60 s loops of real play time, paused or not, and expires
 * after IDLE_LOOPS. A control key or a photon resets it. Driven by the frame's deltaTime so the
 * capture script's frozen clock and __sr.step() reach it too.
 */
export class IdleTimer {
  public loops = 0;
  private carry = 0;
  public readonly limit: number;

  constructor(limit: number = IDLE_LOOPS) {
    this.limit = limit;
  }

  reset(): void {
    this.loops = 0;
    this.carry = 0;
  }

  /** Add the frame's time; true once the limit is reached. */
  advance(deltaTime: number): boolean {
    this.carry += deltaTime * LOOP_HZ + 1e-6;
    const whole = Math.floor(this.carry);
    this.carry -= whole;
    this.loops += whole;
    return this.expired;
  }

  get expired(): boolean {
    return this.loops >= this.limit;
  }
}

/**
 * P — pause (§5.11): the mission stops until the stick moves or a key is pressed. The key or stick
 * that resumes is used up. A stick already held when P was pressed must come back to the centre
 * first. Bend 7: from the pause menu, X aborts the mission (the 800's Atari key, §3).
 */
export class PauseControl {
  public paused = false;
  private stickCentred = true;

  pause(stick: Stick): void {
    this.paused = true;
    this.stickCentred = stick.x === 0 && stick.y === 0;
  }

  /** While paused: the frame's key actions and stick. Returns what happens, or null to stay paused. */
  update(actions: readonly string[], stick: Stick): 'resume' | 'abort' | null {
    if (!this.paused) return null;
    if (actions.length) {
      this.paused = false;
      return actions[0] === 'ABORT' ? 'abort' : 'resume';
    }
    const centred = stick.x === 0 && stick.y === 0;
    if (!centred && this.stickCentred) {
      this.paused = false;
      return 'resume';
    }
    if (centred) this.stickCentred = true;
    return null;
  }

  /** The pause menu's buttons. */
  resume(): void {
    this.paused = false;
  }
}
