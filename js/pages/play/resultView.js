/**
 * play/resultView.js — score ring, summary and a question-by-question review.
 */
import { OPTION_LETTERS } from '../../config.js';
import { h, svg } from '../../core/dom.js';
import { downloadText, slugify } from '../../core/files.js';
import { decodeAnswers, formatDuration, resultsToCSV } from '../../models/result.js';
import { themeClass } from '../../ui/quizBits.js';
import { sameAnswer } from '../../models/quiz.js';

/** [0, 2] → "A. Paris, C. Rome" */
const describe = (q, picks) => picks.map((i) => `${OPTION_LETTERS[i]}. ${q.options[i]}`).join(', ');

function verdict(percent) {
  if (percent === 100) return 'Perfect score!';
  if (percent >= 80) return 'Excellent work.';
  if (percent >= 60) return 'Nicely done.';
  if (percent >= 40) return 'Good effort — review and try again.';
  return 'Keep practising — you’ll get there.';
}

function scoreRing(percent) {
  const r = 78;
  const c = 2 * Math.PI * r;
  const value = svg('circle', { class: 'value', cx: 90, cy: 90, r, 'stroke-dasharray': c, 'stroke-dashoffset': c });
  // animate after insertion
  requestAnimationFrame(() => requestAnimationFrame(() => value.setAttribute('stroke-dashoffset', c * (1 - percent / 100))));
  return h('div', { class: 'score-ring', role: 'img', 'aria-label': `Score ${percent} percent` },
    svg('svg', { viewBox: '0 0 180 180' }, svg('circle', { class: 'track', cx: 90, cy: 90, r }), value),
    h('div', { class: 'label' }, h('b', {}, `${percent}%`), h('span', {}, 'score')),
  );
}

export function resultView({ quiz, result, onRetry, onHome }) {
  const chosen = decodeAnswers(result.answers);

  const review = quiz.questions.map((q, i) => {
    const pick = chosen[i] || [];
    const right = sameAnswer(pick, q.correct);
    return h('div', { class: `review-item ${right ? 'correct' : ''}` },
      h('h4', {}, `${i + 1}. ${q.text}`),
      h('div', { class: 'answers' },
        !pick.length
          ? h('span', { class: 'pill sun' }, 'Skipped')
          : h('span', { class: `pill ${right ? 'mint' : 'coral'}` }, `Your answer: ${describe(q, pick)}`),
        !right && h('span', { class: 'pill mint' }, `Correct: ${describe(q, q.correct)}`),
      ),
      q.explanation && h('p', { class: 'explain' }, q.explanation),
    );
  });

  const download = () =>
    downloadText(`result-${slugify(quiz.title)}-${slugify(result.participant)}.csv`, resultsToCSV([result]));

  return h('section', { class: `view container narrow ${themeClass(quiz)}` },
    h('div', { class: 'panel' },
      h('div', { class: 'result-top' },
        scoreRing(result.percent),
        h('div', {},
          h('h2', {}, verdict(result.percent)),
          h('p', { class: 'muted' }, `${result.participant}, you scored ${result.score} of ${result.maxScore} points on “${quiz.title}”.`),
          h('div', { class: 'stats', style: { marginBottom: '18px' } },
            h('div', { class: 'stat' }, h('b', {}, `${result.correctCount}/${result.questionCount}`), h('span', {}, 'correct')),
            h('div', { class: 'stat' }, h('b', {}, formatDuration(result.durationSec)), h('span', {}, 'time taken')),
          ),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn primary', onClick: onRetry }, 'Try again'),
            h('button', { class: 'btn ghost', onClick: download }, 'Download result (CSV)'),
            h('button', { class: 'btn ghost', onClick: onHome }, 'All quizzes'),
          ),
        ),
      ),
    ),
    h('div', { class: 'panel' }, h('h3', {}, 'Review your answers'), h('div', { class: 'review' }, review)),
  );
}
