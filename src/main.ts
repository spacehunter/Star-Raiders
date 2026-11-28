/**
 * Power-on, attract mode, START, the mission, the end sequence, the debrief and back
 * (MANUAL_SPEC §3, §17.10, §17.11; OVERHAUL_PLAN Phase 11, Part 4 bends 6 and 7).
 *
 * There is no separate title screen: the game itself is the attract screen (§17.11). One Game in
 * attract mode flies the demo; START replaces it with a mission Game; when the mission ends that
 * Game plays the end sequence over its own demo flight, the debrief card follows, and the same
 * Game goes back to the attract title.
 */
import './style.css';
import { Game } from './game/Game';
import type { DifficultyLevel } from './game/GameState';
import { installDebugHook } from './core/debug';
import { seedFromUrl, setSeed } from './core/rng';
import { addRankRecord, loadRankHistory } from './core/rankHistory';
import { consoleCommand, nextLevel, type SessionMode } from './sim/session';
import type { Debrief } from './sim/debrief';
import type { MissionLevel } from './rules/levels';
import { AttractOverlay } from './ui/AttractOverlay';
import { DebriefCard } from './ui/DebriefCard';

class StarRaiders {
  private readonly container: HTMLElement;
  private game: Game;
  private level: MissionLevel = 'NOVICE';
  private mode: SessionMode = 'attract';
  private readonly attract: AttractOverlay;
  private readonly debriefCard: DebriefCard;

  constructor(container: HTMLElement) {
    this.container = container;
    this.attract = new AttractOverlay(container, { select: () => this.select(), start: () => this.start() });
    this.debriefCard = new DebriefCard(container, () => this.continue());
    window.addEventListener('keydown', this.onKeyDown);
    // Power-on: NOVICE MISSION, then STAR RAIDERS / COPYRIGHT ATARI 1979 over the demo flight.
    this.game = new Game(container, this.level, { mode: 'attract' });
    this.game.start();
    this.showAttract();
  }

  getGame(): Game {
    return this.game;
  }

  /** The console's mode: a mission whose end sequence is playing counts as 'ending'. */
  get sessionMode(): SessionMode {
    if (this.mode === 'mission' && this.game.currentPhase === 'ending') return 'ending';
    return this.mode;
  }

  get selectedLevel(): MissionLevel {
    return this.level;
  }

  /** SELECT: the next level (§3). */
  select(): void {
    if (this.mode !== 'attract') return;
    this.setLevel(nextLevel(this.level));
  }

  setLevel(level: MissionLevel): void {
    if (this.mode !== 'attract') return;
    this.level = level;
    this.game.showAttract(level);
    this.showAttract();
  }

  /** START (§3). With ?seed=<n> every mission replays from that seed. */
  start(level: MissionLevel = this.level): void {
    this.level = level;
    const seed = seedFromUrl();
    if (seed !== null) setSeed(seed);
    this.startMission(level);
  }

  /** Start a mission with the RNG as it is (the debug hook seeds it first). */
  startMission(level: DifficultyLevel): void {
    this.level = level;
    this.game.dispose();
    this.attract.hide();
    this.debriefCard.hide();
    this.mode = 'mission';
    this.game = new Game(this.container, level, {
      mode: 'mission',
      onEndSequence: (d) => this.showDebrief(d),
      onIdle: () => this.backToAttract(),
    });
    this.game.start();
  }

  /** Enter / Space / Esc: skip the end sequence, or leave the debrief card. */
  continue(): void {
    const mode = this.sessionMode;
    if (mode === 'ending') this.game.skipEndSequence();
    else if (mode === 'debrief') this.backToAttract();
  }

  private showDebrief(d: Debrief): void {
    this.mode = 'debrief';
    const r = d.rating;
    const history = addRankRecord({
      at: new Date().toISOString(),
      level: r.level,
      outcome: r.outcome,
      rank: r.rank,
      classNumber: r.classNumber,
      total: r.total,
    });
    this.debriefCard.show(d, history);
  }

  private backToAttract(): void {
    this.debriefCard.hide();
    this.mode = 'attract';
    this.game.showAttract(this.level);
    this.showAttract();
  }

  private showAttract(): void {
    this.attract.show(this.level, loadRankHistory()[0] ?? null);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Tab is SELECT here, never focus navigation.
    if (e.code === 'Tab') e.preventDefault();
    if (e.repeat) return;
    const cmd = consoleCommand(this.sessionMode, e.code);
    if (!cmd) return;
    e.preventDefault();
    switch (cmd.type) {
      case 'select':
        return this.select();
      case 'level':
        return this.setLevel(cmd.level);
      case 'start':
        return this.start();
      case 'continue':
        return this.continue();
    }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('game-container');
  if (!container) {
    console.error('Game container not found');
    return;
  }

  const app = new StarRaiders(container);

  if (new URLSearchParams(window.location.search).get('debug') === '1') {
    installDebugHook({
      getGame: () => app.getGame(),
      startGame: (difficulty) => app.startMission(difficulty),
      session: () => ({ mode: app.sessionMode, level: app.selectedLevel }),
    });
  }
});
