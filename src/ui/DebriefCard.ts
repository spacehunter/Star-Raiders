/**
 * Part 4 bend 6: the debrief card after the ROM's end sequence (MANUAL_SPEC §14, §17.10). It shows
 * the rank and class with the manual's insignia style, the score breakdown (every term of the
 * score, adding up to the total), and the local rank history. Enter, Space, Esc or the button
 * goes back to the attract mode.
 */
import type { RankRecord } from '../core/rankHistory';
import { GLYPH_COLUMNS } from '../render/font';
import { ROM_RGB } from '../render/palette';
import { OUTCOME_LABEL, type Debrief } from '../sim/debrief';
import { INSIGNIA_SIZE, drawInsignia } from './insignia';
import { LINE_PX, drawLines, pixelButton, sizeCanvas, type PixelLine } from './pixelText';

/** Characters per card line. */
export const CARD_COLUMNS = 34;
/** History entries shown. */
const HISTORY_SHOWN = 5;

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `-${-n}` : '0');

/** The card's text below the insignia: breakdown, total and history. */
export function debriefLines(d: Debrief, history: readonly RankRecord[]): PixelLine[] {
  const lbl = ROM_RGB.$AF;
  const det = ROM_RGB.$A6;
  const lines: PixelLine[] = d.lines.map((l) => {
    const pts = signed(l.points).padStart(5);
    return [
      [l.label.padEnd(17), lbl],
      [l.detail.slice(0, 11).padEnd(11), det],
      [pts, l.points < 0 ? ROM_RGB.$5A : ROM_RGB.$B8],
    ];
  });
  lines.push([['-'.repeat(CARD_COLUMNS - 1), ROM_RGB.$A6]]);
  lines.push([['TOTAL SCORE'.padEnd(28), ROM_RGB.$FC], [String(d.total).padStart(5), ROM_RGB.$FC]]);
  if (history.length) {
    lines.push([[' ', lbl]]);
    lines.push([['RANK HISTORY', ROM_RGB.$5A]]);
    for (const h of history.slice(0, HISTORY_SHOWN)) {
      const rank = `${h.rank} ${h.classNumber}`.padEnd(23);
      lines.push([[h.level.slice(0, 4).padEnd(5), det], [rank, lbl], [String(h.total).padStart(5), ROM_RGB.$B8]]);
    }
  }
  return lines;
}

export class DebriefCard {
  private readonly root: HTMLDivElement;
  private readonly onContinue: () => void;

  constructor(container: HTMLElement, onContinue: () => void) {
    this.onContinue = onContinue;
    this.root = document.createElement('div');
    this.root.className = 'overlay debrief-overlay';
    this.root.hidden = true;
    container.appendChild(this.root);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(d: Debrief, history: readonly RankRecord[]): void {
    this.root.replaceChildren();
    const card = document.createElement('div');
    card.className = 'overlay-card debrief-card';
    const canvas = document.createElement('canvas');
    canvas.className = 'pixel-text';
    const body = debriefLines(d, history);
    const pad = 4;
    const headH = Math.max(INSIGNIA_SIZE, 4 * LINE_PX) + 4;
    const w = CARD_COLUMNS * GLYPH_COLUMNS + 2 * pad;
    const h = pad + headH + body.length * LINE_PX + pad;
    sizeCanvas(canvas, w, h);
    const draw = () => {
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, w, h);
      drawInsignia(ctx, d.rating.rank, pad, pad, draw);
      const r = d.rating;
      drawLines(
        ctx,
        [
          [['STAR FLEET DEBRIEF', ROM_RGB.$A6]],
          [[r.rank, ROM_RGB.$FC]],
          [[`CLASS ${r.classNumber}`, ROM_RGB.$FC], [`  ${r.level} MISSION`, ROM_RGB.$AF]],
          [[OUTCOME_LABEL[r.outcome] + (r.outcome === 'zeroEnergy' ? ': ZERO ENERGY' : ''), r.outcome === 'complete' ? ROM_RGB.$B8 : ROM_RGB.$5A]],
        ],
        pad + INSIGNIA_SIZE + 6,
        pad - 1
      );
      drawLines(ctx, body, pad, pad + headH);
    };
    draw();
    card.appendChild(canvas);
    const buttons = document.createElement('div');
    buttons.className = 'overlay-buttons';
    buttons.appendChild(pixelButton('CONTINUE', ROM_RGB.$B8, () => this.onContinue(), 'continue-btn'));
    card.appendChild(buttons);
    this.root.appendChild(card);
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
