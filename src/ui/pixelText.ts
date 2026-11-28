/**
 * Overlay text in the game's own 8×8 font (render/font.ts), drawn on small canvases and scaled
 * by whole numbers with `image-rendering: pixelated`, so menus and cards look like the screen
 * behind them and render the same in every browser and in the headless capture (no web font).
 */
import { drawText, GLYPH_COLUMNS } from '../render/font';
import { frameScale } from '../render/Renderer';

/** One run of text in one colour. */
export type Span = readonly [text: string, color: string];
export type PixelLine = readonly Span[];

/** Pixel rows per text line (7 glyph rows + 3 spacing). */
export const LINE_PX = 10;

/** The CSS pixel size of one overlay pixel: half the game frame's scale, at least 1. */
export function overlayScale(): number {
  const dpr = window.devicePixelRatio || 1;
  const k = frameScale(window.innerWidth * dpr, window.innerHeight * dpr);
  return Math.max(1, Math.round(k / 2)) / dpr;
}

/** Draw text lines at (x, y) in canvas pixels. */
export function drawLines(ctx: CanvasRenderingContext2D, lines: readonly PixelLine[], x: number, y: number): void {
  lines.forEach((line, i) => {
    let col = 0;
    for (const [text, color] of line) {
      ctx.fillStyle = color;
      drawText((px, py, w, h) => ctx.fillRect(px, py, w, h), text, x + col * GLYPH_COLUMNS, y + i * LINE_PX, 1);
      col += text.length;
    }
  });
}

/** Size a canvas to w × h native pixels and its CSS box to the overlay scale. */
export function sizeCanvas(canvas: HTMLCanvasElement, w: number, h: number): void {
  canvas.width = w;
  canvas.height = h;
  const k = overlayScale();
  canvas.style.width = `${w * k}px`;
  canvas.style.height = `${h * k}px`;
}

/** A canvas holding text lines on an optional background. */
export function textCanvas(lines: readonly PixelLine[], opts: { cols?: number; pad?: number; bg?: string } = {}): HTMLCanvasElement {
  const pad = opts.pad ?? 0;
  const cols = opts.cols ?? Math.max(1, ...lines.map((l) => l.reduce((n, [t]) => n + t.length, 0)));
  const canvas = document.createElement('canvas');
  canvas.className = 'pixel-text';
  sizeCanvas(canvas, cols * GLYPH_COLUMNS + 2 * pad, lines.length * LINE_PX - 3 + 2 * pad);
  const ctx = canvas.getContext('2d')!;
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawLines(ctx, lines, pad, pad);
  return canvas;
}

/**
 * A touch-friendly button whose label is pixel text. It never takes focus, so Enter and Tab keep
 * meaning START and SELECT, and it fires on click (mouse, pen and touch taps alike).
 */
export function pixelButton(label: string, color: string, onPress: () => void, className = ''): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.tabIndex = -1;
  btn.className = `pixel-btn ${className}`.trim();
  btn.setAttribute('aria-label', label);
  btn.dataset.label = label;
  btn.appendChild(textCanvas([[[label, color]]]));
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onPress();
  });
  return btn;
}
