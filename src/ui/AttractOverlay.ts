/**
 * The console in attract mode (MANUAL_SPEC §3, §17.11): on-screen SELECT and START buttons that
 * work by mouse or touch, the keys for them, the last rank from the local history, and the
 * look/control settings (bends 1–3, formerly on the old title menu). The title itself is the
 * game's own title line over the demo flight; this sits on the black band where the control
 * panel is during a mission.
 */
import { getSettings, updateSettings, type Settings } from '../core/settings';
import type { RankRecord } from '../core/rankHistory';
import { frameRect, PLAYFIELD_ROWS_FOR_OVERLAY } from './layout';
import { ROM_RGB } from '../render/palette';
import { pixelButton, textCanvas } from './pixelText';
import type { MissionLevel } from '../rules/levels';

export interface ConsoleActions {
  select(): void;
  start(): void;
}

const OPTIONS: Array<{ label: (s: Settings) => string; next: (s: Settings) => Partial<Settings> }> = [
  { label: (s) => `STARS:${s.stars === 'enhanced' ? 'MORE' : 'ROM'}`, next: (s) => ({ stars: s.stars === 'enhanced' ? 'classic' : 'enhanced' }) },
  { label: (s) => `CRT:${s.crt ? 'ON' : 'OFF'}`, next: (s) => ({ crt: !s.crt }) },
  { label: (s) => `WASD:${s.wasd ? 'ON' : 'OFF'}`, next: (s) => ({ wasd: !s.wasd }) },
  { label: (s) => `MOUSE:${s.mouse ? 'ON' : 'OFF'}`, next: (s) => ({ mouse: !s.mouse }) },
];

export class AttractOverlay {
  private readonly root: HTMLDivElement;
  private readonly actions: ConsoleActions;
  private level: MissionLevel = 'NOVICE';
  private last: RankRecord | null = null;

  constructor(container: HTMLElement, actions: ConsoleActions) {
    this.actions = actions;
    this.root = document.createElement('div');
    this.root.className = 'attract-console';
    this.root.hidden = true;
    container.appendChild(this.root);
    window.addEventListener('resize', this.layout);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(level: MissionLevel, last: RankRecord | null): void {
    this.level = level;
    this.last = last;
    this.build();
    this.root.hidden = false;
    this.layout();
  }

  hide(): void {
    this.root.hidden = true;
  }

  private build(): void {
    this.root.replaceChildren();
    const row = document.createElement('div');
    row.className = 'console-row';
    row.append(
      pixelButton('SELECT', ROM_RGB.$FC, () => this.actions.select(), 'select-btn'),
      pixelButton('START', ROM_RGB.$B8, () => this.actions.start(), 'start-btn')
    );
    const hint = textCanvas([
      [['TAB', ROM_RGB.$FC], [' OR ', ROM_RGB.$A6], ['1-4', ROM_RGB.$FC], [' SELECT  ', ROM_RGB.$AF], ['ENTER', ROM_RGB.$B8], [' START', ROM_RGB.$AF]],
      this.last
        ? [['LAST RANK: ', ROM_RGB.$A6], [`${this.last.rank} CLASS ${this.last.classNumber}`, ROM_RGB.$5A]]
        : [[`${this.level} MISSION`, ROM_RGB.$A6]],
    ]);
    hint.classList.add('console-hint');
    const opts = document.createElement('div');
    opts.className = 'console-options';
    const s = getSettings();
    for (const o of OPTIONS) {
      opts.appendChild(
        pixelButton(o.label(s), ROM_RGB.$A6, () => {
          updateSettings(o.next(getSettings()));
          this.build();
          this.layout();
        }, 'option-btn')
      );
    }
    this.root.append(row, hint, opts);
  }

  /** Sit on the black band below the playfield, in CSS pixels. */
  private layout = (): void => {
    if (this.root.hidden) return;
    const r = frameRect(window.innerWidth, window.innerHeight);
    this.root.style.left = `${r.x}px`;
    this.root.style.width = `${r.w}px`;
    this.root.style.top = `${r.y + PLAYFIELD_ROWS_FOR_OVERLAY * r.k}px`;
  };

  dispose(): void {
    window.removeEventListener('resize', this.layout);
    this.root.remove();
  }
}
