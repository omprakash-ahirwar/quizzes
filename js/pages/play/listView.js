/**
 * play/listView.js — the landing screen: up to five published quizzes as tiles.
 */
import { h } from '../../core/dom.js';
import { themeClass, quizGlyph, quizMeta } from '../../ui/quizBits.js';

export function listView({ quizzes, preview, onPick }) {
  const banner = preview && h('div', { class: 'preview-banner' },
    h('span', {}, 'Preview: showing the quizzes arranged in the studio, not the live ones.'),
    h('a', { class: 'btn small ghost', href: './' }, 'Show live quizzes'),
  );

  const grid = quizzes.length
    ? h('div', { class: 'quiz-grid' }, quizzes.map((quiz) => quizTile(quiz, onPick)))
    : h('div', { class: 'empty' },
        h('h3', {}, 'No quizzes yet'),
        h('p', {}, 'Publish a quiz from the studio and it will appear here.'),
        h('a', { class: 'btn primary', href: 'admin.html' }, 'Open the studio'));

  return h('section', { class: 'view' },
    banner,
    h('div', { class: 'hero' },
      h('h1', {}, 'Pick a quiz and see how much you know.'),
      h('p', {}, 'Answer at your own pace, then review every question with the right answer and why.'),
    ),
    grid,
  );
}

function quizTile(quiz, onPick) {
  return h('button', { class: `quiz-tile ${themeClass(quiz)}`, onClick: () => onPick(quiz) },
    quizGlyph(quiz),
    h('h3', {}, quiz.title),
    h('p', {}, quiz.description || 'Test yourself.'),
    quizMeta(quiz),
    h('span', { class: 'start-label' }, 'Start quiz'),
  );
}
