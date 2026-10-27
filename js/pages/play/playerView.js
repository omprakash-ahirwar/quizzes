/**
 * play/playerView.js — one question at a time, with progress, optional timer and keyboard support.
 *
 * Single-answer questions render radio buttons; multiple-answer questions render checkboxes.
 * Keys: A–D or 1–4 choose an answer (toggle on checkbox questions), Enter / → next, ← back.
 * Returns { el, destroy } so the page controller can clean up the timer and key listener.
 */
import { OPTION_LETTERS } from '../../config.js';
import { h, mount } from '../../core/dom.js';
import { themeClass } from '../../ui/quizBits.js';
import { isMultiAnswer } from '../../models/quiz.js';

export function playerView({ quiz, onFinish, onQuit }) {
  const state = {
    index: 0,
    choices: quiz.questions.map(() => []), // picked option indexes per question
    startedAt: Date.now(),
    deadline: quiz.timeLimitMin ? Date.now() + quiz.timeLimitMin * 60_000 : null,
  };

  const timerEl = h('span', { class: 'pill timer', role: 'timer', 'aria-live': 'off' });
  const countEl = h('span', { class: 'count' });
  const progressEl = h('div', { class: 'progress', 'aria-hidden': 'true' });
  const body = h('div');
  const root = h('section', { class: `view container narrow ${themeClass(quiz)}` },
    h('div', { class: 'panel' },
      h('div', { class: 'player-head' }, countEl, state.deadline ? timerEl : h('button', { class: 'btn ghost small', onClick: onQuit }, 'Quit')),
      progressEl,
      body,
    ),
  );

  /* ----- actions ----- */
  const finish = () => {
    destroy();
    onFinish({ choices: state.choices, startedAt: state.startedAt, finishedAt: Date.now() });
  };
  /** Radio: replace the pick. Checkbox: turn the option on/off (or set it to `on` when given). */
  const choose = (i, on) => {
    const q = quiz.questions[state.index];
    const picked = state.choices[state.index];
    if (!isMultiAnswer(q)) state.choices[state.index] = [i];
    else {
      const select = on ?? !picked.includes(i);
      state.choices[state.index] = select ? [...new Set([...picked, i])].sort() : picked.filter((x) => x !== i);
    }
    syncOptions();
  };
  const go = (step) => {
    const next = state.index + step;
    if (next < 0) return;
    if (next >= quiz.questions.length) return confirmFinish();
    state.index = next;
    render(true);
  };
  const confirmFinish = () => {
    const skipped = state.choices.filter((c) => !c.length).length;
    if (skipped && !confirm(`You skipped ${skipped} question${skipped > 1 ? 's' : ''}. Submit anyway?`)) return;
    finish();
  };

  /* ----- rendering ----- */
  function render(animate) {
    const q = quiz.questions[state.index];
    const last = state.index === quiz.questions.length - 1;
    countEl.textContent = `Question ${state.index + 1} of ${quiz.questions.length}`;

    mount(progressEl, quiz.questions.map((_, i) =>
      h('span', { class: i === state.index ? 'current' : state.choices[i].length ? 'done' : '' })));

    const multi = isMultiAnswer(q);
    const card = h('div', { class: animate ? 'question-card' : '' },
      h('p', { class: 'question-text', id: 'qtext' }, q.text),
      h('p', { class: 'answer-hint' },
        h('span', { class: `pill ${multi ? 'violet' : ''}` }, multi ? 'Select all that apply' : 'Choose one answer')),
      h('fieldset', { class: `options ${multi ? 'multi' : 'single'}` },
        h('legend', { class: 'sr-only' }, q.text),
        q.options.map((text, i) =>
          h('label', { class: 'option' },
            h('input', {
              type: multi ? 'checkbox' : 'radio', name: `answer-${q.id}`, value: i,
              checked: state.choices[state.index].includes(i),
              onChange: (e) => choose(i, e.target.checked),
            }),
            h('span', { class: 'key', 'aria-hidden': 'true' }, OPTION_LETTERS[i]),
            h('span', { class: 'option-text' }, text)))),
      h('div', { class: 'player-foot btn-row between' },
        h('button', { class: 'btn ghost', onClick: () => go(-1), disabled: state.index === 0 }, 'Back'),
        h('span', { class: 'kbd-hint' }, 'Tip: press A–D to answer, Enter for next'),
        h('button', { class: 'btn primary', onClick: () => go(1) }, last ? 'Submit answers' : 'Next question'),
      ),
    );
    mount(body, card);
  }

  /** Reflect state into the inputs without re-rendering (keeps focus for keyboard users). */
  function syncOptions() {
    const picked = state.choices[state.index];
    body.querySelectorAll('.option input').forEach((input) => { input.checked = picked.includes(Number(input.value)); });
    progressEl.children[state.index]?.classList.toggle('done', picked.length > 0);
  }

  /* ----- timer ----- */
  let tick = null;
  if (state.deadline) {
    const update = () => {
      const left = Math.max(0, Math.round((state.deadline - Date.now()) / 1000));
      timerEl.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left`;
      timerEl.classList.toggle('low', left <= 30);
      if (left === 0) finish();
    };
    update();
    tick = setInterval(update, 1000);
  }

  /* ----- keyboard ----- */
  function onKey(e) {
    if (e.target.closest('textarea, select, input:not([type=radio]):not([type=checkbox])')) return;
    const q = quiz.questions[state.index];
    const letter = OPTION_LETTERS.indexOf(e.key.toUpperCase());
    const digit = Number(e.key) - 1;
    const onChoice = e.target.closest('.option input');
    if (letter !== -1 && letter < q.options.length) choose(letter);
    else if (digit >= 0 && digit < q.options.length) choose(digit);
    else if (e.key === 'Enter' && !e.target.closest('button')) go(1);
    // arrow keys move between radio buttons natively, so only use them for navigation elsewhere
    else if (e.key === 'ArrowRight' && !onChoice) go(1);
    else if (e.key === 'ArrowLeft' && !onChoice) go(-1);
  }
  document.addEventListener('keydown', onKey);

  function destroy() {
    clearInterval(tick);
    document.removeEventListener('keydown', onKey);
  }

  render(true);
  return { el: root, destroy };
}
