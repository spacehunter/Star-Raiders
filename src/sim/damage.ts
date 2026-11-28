/**
 * Damage control: subsystem states, the DAMAGE CONTROL report, repair, and the effect of each
 * state (MANUAL_SPEC §7, §17.2, §17.3; R: DAMAGE L6775, KEYBOARD L7202, UPDPANEL L9784–9796,
 * SCREENROW L9490, GAMELOOP L3569/L3856, DRAWLINES L4211, TRIGGER L6531, FLUSHGAMELOOP L8812,
 * SELECTWARP L7541, DOCKING L6295).
 *
 * The roll itself (chance per level, the 8 slots, damaged vs destroyed) is `rollDamage` in
 * rules/damage.ts. The photon, shield and radio effects live with the code they change
 * (ZylonSim.fire, PanelColors, RadioFeed); this module holds the rest and the shared state.
 */
import {
  SUBSYSTEMS,
  allSystemsOk,
  type DamageStatus,
  type Subsystem,
  type SubsystemStatus,
} from '../rules/damage';
import { PHRASE, subsystemPhrase, type Phrase } from '../rules/messages';

/**
 * The ROM keeps each state in bits 7–6 of the DC letter (GCSTATPHO..GCSTATRAD). Its comment
 * says %10 destroyed / %11 damaged, but the code is the other way round: DAMAGE ORs in COLOR2
 * (%10) for damaged and COLOR3 (%11) for destroyed, and every test reads BIT: N (bit 7) =
 * damaged or destroyed, V (bit 6) = destroyed. So OK %00, damaged %10, destroyed %11.
 */
export const STATUS_BITS: Readonly<Record<SubsystemStatus, number>> = { ok: 0x00, damaged: 0x80, destroyed: 0xc0 };

export function statusFromBits(bits: number): SubsystemStatus {
  if (bits & 0x40) return 'destroyed';
  if (bits & 0x80) return 'damaged';
  return 'ok';
}

const RANK: Record<SubsystemStatus, number> = { ok: 0, damaged: 1, destroyed: 2 };

/** The ROM ORs the new colour bits into the letter, so a state never gets better without repair. */
export function worseStatus(a: SubsystemStatus, b: SubsystemStatus): SubsystemStatus {
  return RANK[a] >= RANK[b] ? a : b;
}

// ----- Engines -----

/** R: KEYBOARD L7202 — with the engines destroyed the keys 6–9 give key 5's velocity. */
export const ENGINES_DESTROYED_MAX_KEY = 5;

/**
 * The engine key a press really selects (it sets both velocity and drain). Only destroyed
 * engines cap it, and only at the press: a speed chosen before the damage stays chosen.
 */
export function engineKeyFor(key: number, engines: SubsystemStatus): number {
  return engines === 'destroyed' ? Math.min(key, ENGINES_DESTROYED_MAX_KEY) : key;
}

/**
 * R: UPDPANEL L9784 — with the engines damaged or destroyed, every loop outside hyperwarp the
 * current velocity becomes NEWVELOCITY AND RANDOM: the speed jitters between 0 and the chosen
 * velocity. Returns the jittered velocity, or null when the engines run normally.
 */
export function jitterVelocity(
  engines: SubsystemStatus,
  newVelocity: number,
  hyperwarp: boolean,
  randomByte: () => number
): number | null {
  if (engines === 'ok' || hyperwarp) return null;
  return newVelocity & randomByte() & 0xff;
}

// ----- Attack computer -----

/** R: UPDPANEL L9795 — θ Φ R update only while the computer is OK; damaged or destroyed they freeze. */
export function computerReadoutsLive(computer: SubsystemStatus): boolean {
  return computer === 'ok';
}

/**
 * R: GAMELOOP L3856, DRAWLINES L4211 — destroyed: no cross hairs, no Attack Computer Display,
 * no lock-on and no tracking computer. Damaged keeps them all (only the readouts freeze).
 */
export function computerFunctions(computer: SubsystemStatus): boolean {
  return computer !== 'destroyed';
}

// ----- Long-Range Scan -----

/** What the Long-Range Scan may draw this loop (R: GAMELOOP L3566–3570, SCREENROW L9490). */
export interface ScanState {
  /** Draw the space objects (targets, meteors, starbase, stars). Destroyed: only our ship. */
  objects: boolean;
  /** Each object lands above or below the centre at random every loop (the mirror image). */
  mirrored: boolean;
  /**
   * Our ship's shape. The ROM draws it with DRAWLINES, which returns at once when the attack
   * computer is destroyed, so then even our ship is missing.
   */
  ship: boolean;
}

export function scanState(sectorScan: SubsystemStatus, computer: SubsystemStatus): ScanState {
  return {
    objects: sectorScan !== 'destroyed',
    mirrored: sectorScan === 'damaged',
    ship: computer !== 'destroyed',
  };
}

/**
 * The z (forward/back) coordinate an object is drawn at on the scan. OK: its own. Damaged:
 * BIT RANDOM picks the upper or lower half at random each loop, so it shows at +|z| or −|z| —
 * over a few loops every object and its reflection are both on screen. Null: not drawn.
 */
export function scanZ(scan: ScanState, z: number, randomByte: () => number): number | null {
  if (!scan.objects) return null;
  if (!scan.mirrored) return z;
  return randomByte() & 0x40 ? Math.abs(z) : -Math.abs(z);
}

// ----- Reports and repair -----

/** Where DAMAGE CONTROL and the subsystem phrase go (the title line). */
export interface TitleSink {
  set(phrase: Phrase): void;
  enqueue(phrase: Phrase): void;
}

export interface DamageReport {
  system: Subsystem;
  /** The state now (a damaged report on a destroyed system leaves it destroyed). */
  status: SubsystemStatus;
}

export interface DamageHooks {
  /**
   * R: DAMAGE L6826 plays the DAMAGE REPORT beeper pattern ($12: ≈490→970 Hz, 3×, §17.12).
   * Phase 12 makes the sound; until then this is the hook.
   */
  beep?(report: DamageReport): void;
  /** R: DAMAGE L6816 — a destroyed computer is switched off and the playfield cleared. */
  computerDestroyed?(): void;
}

/**
 * The six subsystem states and what changes them. Holds the state object by reference (the
 * game state's `damage`), so every reader sees the same states.
 */
export class DamageControl {
  /** Reports made (for the debug hook and tests). */
  public reports = 0;

  private readonly host: { damage: DamageStatus };
  private readonly title: TitleSink;
  private readonly hooks: DamageHooks;

  constructor(host: { damage: DamageStatus }, title: TitleSink, hooks: DamageHooks = {}) {
    this.host = host;
    this.title = title;
    this.hooks = hooks;
  }

  get status(): DamageStatus {
    return this.host.damage;
  }

  /** The ROM's colour bits of a DC letter (%00 / %10 / %11 in bits 7–6). */
  bits(system: Subsystem): number {
    return STATUS_BITS[this.host.damage[system]];
  }

  /**
   * R: DAMAGE after the roll: set the letter's state, enqueue the subsystem phrase, switch a
   * destroyed computer off, show DAMAGE CONTROL and sound the beep. The phrase stays queued and
   * comes back each time the title line goes blank, until docking clears the queue.
   */
  report(system: Subsystem, status: 'damaged' | 'destroyed'): DamageReport {
    const now = worseStatus(this.host.damage[system], status);
    this.host.damage[system] = now;
    this.title.enqueue(subsystemPhrase(system, status));
    if (system === 'computer' && now === 'destroyed') this.hooks.computerDestroyed?.();
    this.title.set(PHRASE.DAMAGE_CONTROL);
    this.reports++;
    const r = { system, status: now };
    this.hooks.beep?.(r);
    return r;
  }

  /**
   * Force a state exactly (debug hook): no message, no beep and no side effects, so a forced
   * state can be set up and taken back. A destroyed computer still does nothing (its effects
   * read the state), but its C switch is left as it was.
   */
  force(system: Subsystem, status: SubsystemStatus): void {
    this.host.damage[system] = status;
  }

  /** R: DOCKING L6295 — TRANSFER COMPLETE repairs all six. Docking is the only repair (§13). */
  repairAll(): void {
    const ok = allSystemsOk();
    for (const s of SUBSYSTEMS) this.host.damage[s] = ok[s];
  }

  /** Every subsystem's state, e.g. for `__sr.damage()`. */
  snapshot(): DamageStatus {
    return { ...this.host.damage };
  }
}
