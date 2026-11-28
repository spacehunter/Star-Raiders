/**
 * The title line: one phrase segment at a time (MANUAL_SPEC §18.1, §17.3, §17.10;
 * R: UPDTITLE / SETTITLE L7722–7903).
 *
 * - `set(phrase)` shows a phrase at once (SETTITLE), replacing whatever was up.
 * - `enqueue(phrase)` stores it in NEWTITLEPHR. It is shown whenever the title line has gone
 *   blank, and the ROM never clears that slot after showing it: the phrase comes back each time
 *   the line goes blank again (damage reports keep repeating, the end-of-mission sequence loops)
 *   until something else is enqueued. Docking enqueues "nothing" (`clearQueue`).
 * - `loop()` runs once per game loop: each segment lasts its lifetime (60 or 254 loops), then the
 *   next segment shows; after the last one the line is hidden, and the queued phrase starts on
 *   the following loop.
 */
import type { Phrase } from '../rules/messages';

export class TitleLine {
  private phrase: Phrase | null = null;
  private index = 0;
  private life = 0;
  private queued: Phrase | null = null;

  /** The segment on the title line now, or null while the line is hidden. */
  get text(): string | null {
    return this.phrase ? this.phrase[this.index].text : null;
  }

  /** The phrase currently showing (null while hidden). */
  get current(): Phrase | null {
    return this.phrase;
  }

  /** The phrase waiting in NEWTITLEPHR. */
  get pending(): Phrase | null {
    return this.queued;
  }

  /** Loops left of the current segment. */
  get lifeLeft(): number {
    return this.life;
  }

  set(phrase: Phrase): void {
    this.phrase = phrase.length ? phrase : null;
    this.index = 0;
    this.life = this.phrase ? this.phrase[0].loops : 0;
  }

  enqueue(phrase: Phrase): void {
    this.queued = phrase.length ? phrase : null;
  }

  clearQueue(): void {
    this.queued = null;
  }

  /** Hide the line now and forget the queue (game over clears TITLEPHR before enqueuing). */
  clear(): void {
    this.phrase = null;
    this.queued = null;
    this.life = 0;
  }

  loop(): void {
    if (!this.phrase) {
      if (this.queued) this.set(this.queued);
      return;
    }
    if (--this.life > 0) return;
    if (this.index + 1 < this.phrase.length) {
      this.index++;
      this.life = this.phrase[this.index].loops;
    } else {
      this.phrase = null;
    }
  }
}
