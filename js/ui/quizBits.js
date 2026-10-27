/**
 * ui/quizBits.js — small presentational pieces shared by the participant page and the studio.
 */
import { SLOT_THEMES } from '../config.js';
import { h } from '../core/dom.js';

/** CSS class giving a quiz its slot colour (falls back to violet). */
export const themeClass = (quiz) => `theme-${SLOT_THEMES[(quiz?.slot || 1) - 1] || 'violet'}`;

/** Tilted coloured badge with the quiz's first letter. */
export const quizGlyph = (quiz) =>
  h('span', { class: 'quiz-glyph', 'aria-hidden': 'true' }, (quiz.title.trim()[0] || 'Q').toUpperCase());

/** "8 questions", "10 min" / "No time limit" pills. */
export function quizMeta(quiz) {
  const n = quiz.questions.length;
  return h('div', { class: 'quiz-meta' },
    h('span', { class: 'pill' }, `${n} question${n === 1 ? '' : 's'}`),
    h('span', { class: 'pill' }, quiz.timeLimitMin ? `${quiz.timeLimitMin} min` : 'No time limit'),
  );
}
