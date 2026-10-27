/**
 * play/introView.js — quiz details plus the participant's name before starting.
 */
import { STORAGE_KEYS } from '../../config.js';
import { h } from '../../core/dom.js';
import { loadText, saveText } from '../../core/storage.js';
import { themeClass, quizGlyph, quizMeta } from '../../ui/quizBits.js';

export function introView({ quiz, onStart, onBack }) {
  const nameInput = h('input', {
    class: 'input', id: 'participant', name: 'participant', required: true, maxlength: 60,
    autocomplete: 'name', placeholder: 'e.g. Priya Sharma', value: loadText(STORAGE_KEYS.playerName),
  });

  const form = h('form', {
    onSubmit: (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return nameInput.focus();
      saveText(STORAGE_KEYS.playerName, name);
      onStart(name);
    },
  },
    h('label', { class: 'field', for: 'participant' }, h('span', {}, 'Your name'), nameInput),
    h('button', { class: 'btn primary', type: 'submit' }, 'Start quiz'),
    h('div', { class: 'btn-row', style: { justifyContent: 'center', marginTop: '12px' } },
      h('button', { class: 'btn ghost small', type: 'button', onClick: onBack }, 'Back to all quizzes')),
  );

  setTimeout(() => nameInput.focus(), 50);

  return h('section', { class: `view container narrow ${themeClass(quiz)}` },
    h('div', { class: 'panel intro' },
      quizGlyph(quiz),
      h('h2', {}, quiz.title),
      quiz.description && h('p', { class: 'muted' }, quiz.description),
      quizMeta(quiz),
      form,
    ),
  );
}
