/**
 * Controls (MANUAL_SPEC §4 joystick, §5 control keys; OVERHAUL_PLAN Part 4 bend 1).
 *
 * The original had a digital joystick and the keyboard. Here the stick can be:
 *   - the arrow keys (or numeric keypad 8/4/6/2), always;
 *   - W/A/S/D when that setting is on (then Aft view moves to R and Shields to Q);
 *   - a gamepad's left stick or D-pad (button A or the right trigger fires);
 *   - the mouse with pointer lock, when that setting is on (click fires).
 * Space is the fire button. Each source gives the ROM's digital directions (−1, 0, +1).
 *
 * Key presses are edge-triggered through an event queue: every keydown becomes one action
 * that the game drains once per update, so a tap shorter than a frame is never lost.
 * The stick is the opposite: a level read once per game loop.
 */
import { getSettings, type Settings } from '../core/settings';
import type { Stick } from '../sim/motion';

export type Action =
  | 'FRONT'
  | 'AFT'
  | 'CHART'
  | 'LRS'
  | 'HYPERWARP'
  | 'SHIELDS'
  | 'COMPUTER'
  | 'TRACKING'
  | 'MANUAL_TARGET'
  | 'PAUSE'
  | 'ABORT'
  | 'UNKNOWN'
  | 'FIRE'
  | 'STICK_LEFT'
  | 'STICK_RIGHT'
  | 'STICK_FORWARD'
  | 'STICK_BACK'
  | `SPEED_${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

type StickDir = 'left' | 'right' | 'forward' | 'back';

const STICK_ACTION: Record<StickDir, Action> = {
  left: 'STICK_LEFT',
  right: 'STICK_RIGHT',
  forward: 'STICK_FORWARD',
  back: 'STICK_BACK',
};

/** Which stick direction a key holds, if any. */
export function stickDirForKey(code: string, s: Pick<Settings, 'wasd'>): StickDir | null {
  switch (code) {
    case 'ArrowLeft':
    case 'Numpad4':
      return 'left';
    case 'ArrowRight':
    case 'Numpad6':
      return 'right';
    case 'ArrowUp':
    case 'Numpad8':
      return 'forward';
    case 'ArrowDown':
    case 'Numpad2':
      return 'back';
  }
  if (s.wasd) {
    if (code === 'KeyA') return 'left';
    if (code === 'KeyD') return 'right';
    if (code === 'KeyW') return 'forward';
    if (code === 'KeyS') return 'back';
  }
  return null;
}

/** The action of one key press (§5), or null for keys the game ignores. */
export function actionForKey(code: string, s: Pick<Settings, 'wasd'>): Action | null {
  const dir = stickDirForKey(code, s);
  if (dir) return STICK_ACTION[dir];
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  if (digit && !(code.startsWith('Numpad') && '2468'.includes(digit[1]))) {
    return `SPEED_${Number(digit[1]) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
  }
  switch (code) {
    case 'Space':
      return 'FIRE';
    case 'KeyF':
      return 'FRONT';
    case 'KeyA':
      return s.wasd ? null : 'AFT';
    case 'KeyR':
      return s.wasd ? 'AFT' : null;
    case 'KeyS':
      return s.wasd ? null : 'SHIELDS';
    case 'KeyQ':
      return s.wasd ? 'SHIELDS' : null;
    case 'KeyG':
      return 'CHART';
    case 'KeyL':
      return 'LRS';
    case 'KeyH':
      return 'HYPERWARP';
    case 'KeyC':
      return 'COMPUTER';
    case 'KeyT':
      return 'TRACKING';
    case 'KeyM':
      return 'MANUAL_TARGET';
    case 'KeyP':
    case 'Escape':
      // §5.11 P; bend 7: Esc opens the same pause menu.
      return 'PAUSE';
    case 'KeyX':
      // Bend 7: X in the pause menu aborts the mission (the 800's Atari key, §3). Outside the
      // menu Game treats it like any other unknown key.
      return 'ABORT';
  }
  return null;
}

/**
 * The action of one key press including the ROM's catch-all: a character key the game does not
 * use is 'UNKNOWN' (title line `WHATS WRONG?`, §17.11). Modifier, function, Tab and Enter keys
 * give null: they are not keys of the 800's keyboard matrix the ROM would complain about.
 */
export function keyAction(code: string, key: string, s: Pick<Settings, 'wasd'>): Action | null {
  const action = actionForKey(code, s);
  if (action) return action;
  if (stickDirForKey(code, s)) return null;
  const charKey = /^(?:Key[A-Z]|Digit[0-9]|Numpad[0-9]|Minus|Equal|Bracket(?:Left|Right)|Backslash|Semicolon|Quote|Comma|Period|Slash|Backquote|IntlBackslash|NumpadAdd|NumpadSubtract|NumpadMultiply|NumpadDivide|NumpadDecimal)$/;
  if (charKey.test(code) || (key.length === 1 && key !== ' ')) return 'UNKNOWN';
  return null;
}

const clampDir = (v: number): -1 | 0 | 1 => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** Mouse travel (CSS px) per 0.89° stick step. */
export const MOUSE_PX_PER_STEP = 4;
/** At most this many steps of mouse travel are banked, so a big flick does not turn for seconds. */
const MOUSE_MAX_BANK = MOUSE_PX_PER_STEP * 24;
const GAMEPAD_DEADZONE = 0.4;

export class Input {
  private readonly queue: Action[] = [];
  private readonly held = new Set<StickDir>();
  private readonly heldKeys = new Map<string, StickDir>();
  private mouseX = 0;
  private mouseY = 0;
  private padStick: Stick = { x: 0, y: 0 };
  private padButtons: boolean[] = [];
  private padDirs = { left: false, right: false, forward: false, back: false };

  private readonly surface: HTMLElement;

  constructor(surface: HTMLElement) {
    this.surface = surface;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('mousemove', this.onMouseMove);
    surface.addEventListener('mousedown', this.onMouseDown);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.surface.removeEventListener('mousedown', this.onMouseDown);
    if (document.pointerLockElement === this.surface) document.exitPointerLock?.();
  }

  /** Queue an action as if its key was pressed (debug hook, touch buttons). */
  push(action: Action): void {
    this.queue.push(action);
  }

  /** All actions since the last call, in order. Also polls the gamepad. */
  drain(): Action[] {
    this.pollGamepad();
    return this.queue.splice(0, this.queue.length);
  }

  /**
   * The stick for one game loop: keys, gamepad and banked mouse travel combined. Call once per
   * loop; each call spends at most one step of mouse travel per axis.
   */
  readStick(): Stick {
    let x = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0) + this.padStick.x;
    let y = (this.held.has('back') ? 1 : 0) - (this.held.has('forward') ? 1 : 0) + this.padStick.y;
    if (this.mouseX >= MOUSE_PX_PER_STEP) {
      x += 1;
      this.mouseX -= MOUSE_PX_PER_STEP;
    } else if (this.mouseX <= -MOUSE_PX_PER_STEP) {
      x -= 1;
      this.mouseX += MOUSE_PX_PER_STEP;
    }
    // Mouse up (negative movementY) pulls the stick back: the nose follows the mouse.
    if (this.mouseY <= -MOUSE_PX_PER_STEP) {
      y += 1;
      this.mouseY += MOUSE_PX_PER_STEP;
    } else if (this.mouseY >= MOUSE_PX_PER_STEP) {
      y -= 1;
      this.mouseY -= MOUSE_PX_PER_STEP;
    }
    return { x: clampDir(x), y: clampDir(y) };
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const s = getSettings();
    const dir = stickDirForKey(e.code, s);
    const action = keyAction(e.code, e.key ?? '', s);
    if (dir || action === 'FIRE') e.preventDefault();
    if (dir) {
      this.held.add(dir);
      this.heldKeys.set(e.code, dir);
    }
    if (e.repeat || !action) return;
    this.queue.push(action);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const dir = this.heldKeys.get(e.code);
    if (!dir) return;
    this.heldKeys.delete(e.code);
    if (![...this.heldKeys.values()].includes(dir)) this.held.delete(dir);
  };

  private onBlur = (): void => {
    this.held.clear();
    this.heldKeys.clear();
    this.mouseX = this.mouseY = 0;
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!getSettings().mouse) return;
    if (document.pointerLockElement !== this.surface) {
      this.surface.requestPointerLock?.();
      return;
    }
    if (e.button === 0) this.queue.push('FIRE');
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!getSettings().mouse || document.pointerLockElement !== this.surface) return;
    const bank = (v: number) => Math.max(-MOUSE_MAX_BANK, Math.min(MOUSE_MAX_BANK, v));
    this.mouseX = bank(this.mouseX + e.movementX);
    this.mouseY = bank(this.mouseY + e.movementY);
  };

  private pollGamepad(): void {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find((p): p is Gamepad => !!p && p.connected);
    if (!pad) {
      this.padStick = { x: 0, y: 0 };
      return;
    }
    const pressed = (i: number) => !!pad.buttons[i]?.pressed;
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    const dirs = {
      left: ax < -GAMEPAD_DEADZONE || pressed(14),
      right: ax > GAMEPAD_DEADZONE || pressed(15),
      forward: ay < -GAMEPAD_DEADZONE || pressed(12),
      back: ay > GAMEPAD_DEADZONE || pressed(13),
    };
    for (const d of Object.keys(dirs) as StickDir[]) {
      if (dirs[d] && !this.padDirs[d]) this.queue.push(STICK_ACTION[d]);
    }
    this.padDirs = dirs;
    this.padStick = {
      x: clampDir((dirs.right ? 1 : 0) - (dirs.left ? 1 : 0)),
      y: clampDir((dirs.back ? 1 : 0) - (dirs.forward ? 1 : 0)),
    };
    // A (0) or right trigger (7) is the fire button, edge-triggered like a key.
    const fire = pressed(0) || pressed(7);
    if (fire && !(this.padButtons[0] || this.padButtons[7])) this.queue.push('FIRE');
    this.padButtons = pad.buttons.map((b) => b.pressed);
  }
}
