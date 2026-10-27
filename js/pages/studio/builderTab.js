/**
 * studio/builderTab.js — create or edit a quiz by hand.
 * Left: the library. Right: the editor for a working copy ("draft"), saved on demand.
 */
import { OPTION_LETTERS, QUESTION_TYPES, APP } from '../../config.js';
import { h, mount } from '../../core/dom.js';
import { toast } from '../../core/toast.js';
import { downloadText, slugify } from '../../core/files.js';
import { cloneQuiz, createQuestion, createQuiz, isMultiAnswer, tidyQuestion, validateQuiz } from '../../models/quiz.js';
import { deleteQuiz, exportQuizCSV, getLibrary, setSlot, upsertQuiz } from '../../services/quizRepository.js';

export function createBuilderTab() {
  let draft = newDraft();
  let dirty = false;
  let errors = [];

  const libraryEl = h('nav', { class: 'library', 'aria-label': 'Your quizzes' });
  const editorEl = h('div');
  const el = h('div', { class: 'builder' }, libraryEl, editorEl);

  function newDraft() {
    return createQuiz({ questions: [createQuestion()] });
  }

  /** Called by main.js when the tab opens or the library changes. */
  function refresh() {
    const saved = getLibrary().find((q) => q.id === draft.id);
    if (saved && !dirty) draft = cloneQuiz(saved); // pick up slot changes made elsewhere
    renderLibrary();
    renderEditor();
  }

  /** Open a quiz (or a blank one), asking before throwing away unsaved edits. */
  function open(quiz) {
    if (dirty && !confirm('You have unsaved changes. Discard them?')) return;
    draft = quiz ? cloneQuiz(quiz) : newDraft();
    dirty = false;
    errors = [];
    refresh();
  }
  /** Open a specific quiz from other tabs (e.g. right after an import). */
  function openById(id) {
    const quiz = getLibrary().find((q) => q.id === id);
    if (quiz) open(quiz);
  }

  const touch = () => { dirty = true; };

  /* ---------- Library list ---------- */
  function renderLibrary() {
    const items = getLibrary().map((q) =>
      h('button', { class: 'library-item', 'aria-current': String(q.id === draft.id), onClick: () => open(q) },
        h('b', {}, q.title || 'Untitled quiz'),
        h('span', {}, `${q.questions.length} questions, ${q.slot ? `published in slot ${q.slot}` : 'draft'}`)));
    mount(libraryEl,
      h('button', { class: 'btn primary', onClick: () => open(null) }, 'New quiz'),
      items.length ? items : h('p', { class: 'muted small' }, 'Quizzes you save or import appear here.'));
  }

  /* ---------- Editor ---------- */
  function renderEditor() {
    const isSaved = getLibrary().some((q) => q.id === draft.id);

    const field = (label, input, hint) =>
      h('label', { class: 'field' }, h('span', {}, label, hint && h('span', { class: 'hint' }, ` — ${hint}`)), input);

    const details = h('div', { class: 'panel' },
      h('div', { class: 'panel-title' },
        h('h2', {}, isSaved ? 'Edit quiz' : 'New quiz'),
        h('span', { class: `pill ${draft.slot ? 'mint' : ''}` }, draft.slot ? `Published in slot ${draft.slot}` : 'Not published')),
      field('Title', h('input', { class: 'input', value: draft.title, maxlength: 80, placeholder: 'e.g. JavaScript fundamentals',
        onInput: (e) => { draft.title = e.target.value; touch(); } })),
      field('Description', h('textarea', { class: 'textarea', rows: 2, value: draft.description, maxlength: 240,
        placeholder: 'One or two sentences shown on the quiz tile',
        onInput: (e) => { draft.description = e.target.value; touch(); } }), 'optional'),
      h('div', { class: 'field-grid' },
        field('Time limit (minutes)', h('input', { class: 'input', type: 'number', min: 0, max: 180, value: draft.timeLimitMin,
          onInput: (e) => { draft.timeLimitMin = Math.max(0, Number(e.target.value) || 0); touch(); } }), '0 = no limit')),
    );

    const questions = draft.questions.map((q, i) => questionEditor(q, i));

    const errorBox = errors.length > 0 && h('div', { class: 'errors', role: 'alert' },
      h('b', {}, 'Fix these before saving:'), h('ul', {}, errors.map((e) => h('li', {}, e))));

    const actions = h('div', { class: 'sticky-actions btn-row between' },
      h('div', { class: 'btn-row' },
        isSaved && h('button', { class: 'btn danger small', onClick: remove }, 'Delete'),
        h('button', { class: 'btn ghost small', onClick: download }, 'Download CSV')),
      h('div', { class: 'btn-row' },
        isSaved && !draft.slot && h('button', { class: 'btn ghost', onClick: publish }, 'Publish'),
        h('button', { class: 'btn primary', onClick: save }, 'Save quiz')));

    mount(editorEl, details,
      h('div', { class: 'panel' },
        h('h3', {}, `Questions (${draft.questions.length})`),
        errorBox, questions,
        h('button', { class: 'add-question', onClick: addQuestion }, '+ Add question')),
      actions);
  }

  function questionEditor(q, i) {
    const multi = isMultiAnswer(q);

    // Single answer ↔ multiple answers switch
    const typeSwitch = h('div', { class: 'type-switch', role: 'radiogroup', 'aria-label': `Answer type for question ${i + 1}` },
      [[QUESTION_TYPES.single, 'Single answer', '◉'], [QUESTION_TYPES.multiple, 'Multiple answers', '☑']].map(([type, label, icon]) =>
        h('button', { type: 'button', role: 'radio', 'aria-checked': String(q.type === type), onClick: () => setType(q, type) },
          h('span', { 'aria-hidden': 'true' }, icon), label)));

    const rows = OPTION_LETTERS.map((letter, oi) =>
      h('div', { class: `q-option-row ${q.correct.includes(oi) ? 'is-correct' : ''}` },
        h('input', { type: multi ? 'checkbox' : 'radio', name: `correct-${q.id}`, checked: q.correct.includes(oi),
          'aria-label': `Option ${letter} is correct`,
          onChange: (e) => { setCorrect(q, oi, e.target.checked); renderEditor(); } }),
        h('span', { class: 'letter' }, letter),
        h('input', { class: 'input', value: q.options[oi] || '', placeholder: oi < 2 ? `Option ${letter}` : `Option ${letter} (optional)`,
          onInput: (e) => { q.options[oi] = e.target.value; touch(); } })));

    return h('div', { class: 'q-editor' },
      h('div', { class: 'q-editor-head' },
        h('h4', {}, `Question ${i + 1}`),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn ghost icon', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onClick: () => move(i, -1) }, '↑'),
          h('button', { class: 'btn ghost icon', title: 'Move down', 'aria-label': 'Move down', disabled: i === draft.questions.length - 1, onClick: () => move(i, 1) }, '↓'),
          h('button', { class: 'btn danger icon', title: 'Remove question', 'aria-label': 'Remove question', onClick: () => removeQuestion(i) }, '✕'))),
      h('textarea', { class: 'textarea', rows: 2, value: q.text, placeholder: 'Type the question',
        style: { marginBottom: '12px' }, onInput: (e) => { q.text = e.target.value; touch(); } }),
      typeSwitch,
      h('p', { class: 'small muted', style: { margin: '0 0 8px' } },
        multi
          ? `Tick every correct option. Participants see checkboxes (${q.correct.length} ticked).`
          : 'Select the one correct option. Participants see radio buttons.'),
      rows,
      h('div', { class: 'q-extra' },
        h('label', { class: 'field' }, h('span', {}, 'Explanation', h('span', { class: 'hint' }, ' — shown after the quiz')),
          h('input', { class: 'input', value: q.explanation, onInput: (e) => { q.explanation = e.target.value; touch(); } })),
        h('label', { class: 'field' }, h('span', {}, 'Points'),
          h('input', { class: 'input', type: 'number', min: 1, max: 100, value: q.points,
            onInput: (e) => { q.points = Math.max(1, Number(e.target.value) || 1); touch(); } }))),
    );
  }

  /* ---------- Question operations ---------- */
  /** Radio (single): the clicked option becomes the only correct one. Checkbox (multiple): toggle it. */
  function setCorrect(q, index, on) {
    if (!isMultiAnswer(q)) q.correct = [index];
    else q.correct = on ? [...new Set([...q.correct, index])].sort() : q.correct.filter((c) => c !== index);
    touch();
  }
  /** Switching to single keeps only the first ticked answer. */
  function setType(q, type) {
    if (q.type === type) return;
    q.type = type;
    if (type === QUESTION_TYPES.single) q.correct = q.correct.slice(0, 1).length ? q.correct.slice(0, 1) : [0];
    touch();
    renderEditor();
  }
  function addQuestion() {
    draft.questions.push(createQuestion());
    touch();
    renderEditor();
    editorEl.querySelectorAll('.q-editor textarea')[draft.questions.length - 1]?.focus();
  }
  function removeQuestion(i) {
    if (draft.questions[i].text && !confirm('Remove this question?')) return;
    draft.questions.splice(i, 1);
    touch();
    renderEditor();
  }
  function move(i, step) {
    const [q] = draft.questions.splice(i, 1);
    draft.questions.splice(i + step, 0, q);
    touch();
    renderEditor();
  }

  /* ---------- Quiz operations ---------- */
  function save() {
    errors = validateQuiz(draft);
    if (errors.length) { renderEditor(); toast('The quiz needs a few fixes before saving.', 'error'); return false; }
    draft = cloneQuiz(upsertQuiz({ ...draft, title: draft.title.trim(), description: draft.description.trim(), questions: draft.questions.map(tidyQuestion) }));
    dirty = false;
    refresh();
    toast('Quiz saved', 'success');
    return true;
  }
  function publish() {
    if (!save()) return;
    const used = new Set(getLibrary().map((q) => q.slot).filter(Boolean));
    const free = Array.from({ length: APP.maxPublished }, (_, i) => i + 1).find((s) => !used.has(s));
    if (!free) return toast(`All ${APP.maxPublished} slots are taken. Free one in the Publish tab.`, 'error');
    setSlot(draft.id, free);
    toast(`Published in slot ${free}. Download quizzes.csv from the Publish tab to go live.`, 'success', 5000);
  }
  function remove() {
    if (!confirm(`Delete “${draft.title || 'this quiz'}”? This can’t be undone.`)) return;
    deleteQuiz(draft.id);
    dirty = false;
    open(null);
    toast('Quiz deleted');
  }
  function download() {
    if (validateQuiz(draft).length) return toast('Finish the quiz before downloading it.', 'error');
    downloadText(`${slugify(draft.title)}.csv`, exportQuizCSV({ ...draft, questions: draft.questions.map(tidyQuestion) }));
  }

  return { el, refresh, openById, hasUnsavedChanges: () => dirty };
}
