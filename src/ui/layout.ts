/** Where the renderer's frame sits on the page, in CSS pixels (the renderer works in device pixels). */
import { frameRect as deviceFrameRect } from '../render/Renderer';
import { PLAYFIELD_H } from '../render/projection';

/** Playfield rows above the control panel band (overlays on the band start here). */
export const PLAYFIELD_ROWS_FOR_OVERLAY = PLAYFIELD_H;

export function frameRect(cssW: number, cssH: number): { x: number; y: number; w: number; h: number; k: number } {
  const dpr = window.devicePixelRatio || 1;
  const r = deviceFrameRect(Math.round(cssW * dpr), Math.round(cssH * dpr));
  return { x: r.x / dpr, y: r.y / dpr, w: r.w / dpr, h: r.h / dpr, k: r.k / dpr };
}
