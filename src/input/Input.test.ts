import { describe, expect, it } from 'vitest';
import { actionForKey, stickDirForKey } from './Input';

// MANUAL_SPEC §4, §5; Part 4 bend 1.
describe('key map', () => {
  const classic = { wasd: false };
  const wasd = { wasd: true };

  it('arrows and keypad are always the stick; Space fires', () => {
    expect(stickDirForKey('ArrowLeft', classic)).toBe('left');
    expect(stickDirForKey('ArrowUp', classic)).toBe('forward');
    expect(stickDirForKey('Numpad2', classic)).toBe('back');
    expect(actionForKey('Space', classic)).toBe('FIRE');
  });

  it('keeps the manual keys: A aft, S shields, F, G, L, H, C, T, M, P and 0–9', () => {
    expect(actionForKey('KeyA', classic)).toBe('AFT');
    expect(actionForKey('KeyS', classic)).toBe('SHIELDS');
    expect(actionForKey('KeyF', classic)).toBe('FRONT');
    expect(actionForKey('KeyG', classic)).toBe('CHART');
    expect(actionForKey('KeyL', classic)).toBe('LRS');
    expect(actionForKey('KeyH', classic)).toBe('HYPERWARP');
    expect(actionForKey('KeyC', classic)).toBe('COMPUTER');
    expect(actionForKey('KeyT', classic)).toBe('TRACKING');
    expect(actionForKey('KeyM', classic)).toBe('MANUAL_TARGET');
    expect(actionForKey('KeyP', classic)).toBe('PAUSE');
    expect(actionForKey('Digit6', classic)).toBe('SPEED_6');
    expect(actionForKey('Numpad9', classic)).toBe('SPEED_9');
    expect(stickDirForKey('KeyW', classic)).toBeNull();
  });

  it('with WASD on, W/A/S/D steer and Aft/Shields move to R/Q', () => {
    expect(stickDirForKey('KeyA', wasd)).toBe('left');
    expect(stickDirForKey('KeyD', wasd)).toBe('right');
    expect(stickDirForKey('KeyW', wasd)).toBe('forward');
    expect(stickDirForKey('KeyS', wasd)).toBe('back');
    expect(actionForKey('KeyR', wasd)).toBe('AFT');
    expect(actionForKey('KeyQ', wasd)).toBe('SHIELDS');
    expect(actionForKey('KeyR', classic)).toBeNull();
  });
});
