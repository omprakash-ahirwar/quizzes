/**
 * studio/importTab.js — create quizzes from a CSV file (drag & drop, file picker or paste).
 */
import { PATHS, QUIZ_COLUMNS } from '../../config.js';
import { h, mount } from '../../core/dom.js';
import { toast } from '../../core/toast.js';
import { readFileText } from '../../core/files.js';
import { quizzesFromCSV } from '../../models/quiz.js';
import { addQuizzes } from '../../services/quizRepository.js';

const SAMPLE = `question,question_type,option_a,option_b,option_c,option_d,correct,explanation,points
What does CSS stand for?,single,Cascading Style Sheets,Creative Style System,Computer Styled Sections,,A,CSS controls presentation.,1
Which tag links a stylesheet?,single,<style>,<link>,<css>,<script>,B,<link rel="stylesheet"> loads an external file.,1
Which of these are CSS units?,multiple,px,rem,kg,vh,A;B;D,"Several correct letters, separated by ;",2`;

export function createImportTab({ onImported }) {
  let parsed = null; // { quizzes, errors }

  const titleInput = h('input', { class: 'input', placeholder: 'Used when the CSV has no quiz_title column' });
  const timeInput = h('input', { class: 'input', type: 'number', min: 0, value: 0 });
  const pasteInput = h('textarea', { class: 'textarea', rows: 5, placeholder: 'Or paste CSV text here' });
  const fileInput = h('input', { type: 'file', accept: '.csv,text/csv', class: 'sr-only', onChange: (e) => handleFile(e.target.files[0]) });
  const previewEl = h('div');

  const dropzone = h('label', { class: 'dropzone', tabindex: 0 },
    fileInput,
    h('span', { class: 'dropzone-icon', 'aria-hidden': 'true' }, '⇪'),
    h('b', {}, 'Drop a CSV file here'),
    h('span', { class: 'muted' }, 'or click to choose a file from your computer'));

  dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  ['dragenter', 'dragover'].forEach((t) => dropzone.addEventListener(t, (e) => { e.preventDefault(); dropzone.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => dropzone.addEventListener(t, () => dropzone.classList.remove('over')));
  dropzone.addEventListener('drop', (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); });

  async function handleFile(file) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') return toast('Choose a .csv file.', 'error');
    if (!titleInput.value.trim()) titleInput.value = file.name.replace(/\.csv$/i, '').replace(/[-_]+/g, ' ');
    parse(await readFileText(file));
    fileInput.value = '';
  }

  function parse(text) {
    parsed = quizzesFromCSV(text, { title: titleInput.value.trim() || 'Imported quiz', timeLimitMin: Number(timeInput.value) || 0 });
    renderPreview();
  }

  function renderPreview() {
    if (!parsed) return mount(previewEl);
    const { quizzes, errors } = parsed;
    mount(previewEl, h('div', { class: 'panel' },
      h('h3', {}, quizzes.length ? `Found ${quizzes.length} quiz${quizzes.length > 1 ? 'zes' : ''}` : 'Nothing to import'),
      errors.length > 0 && h('div', { class: 'errors' }, h('b', {}, `${errors.length} row${errors.length > 1 ? 's' : ''} need attention:`),
        h('ul', {}, errors.slice(0, 8).map((e) => h('li', {}, e)), errors.length > 8 && h('li', {}, `…and ${errors.length - 8} more`))),
      quizzes.length > 0 && h('div', { class: 'table-wrap', style: { marginBottom: '18px' } },
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Quiz'), h('th', { class: 'num' }, 'Questions'), h('th', { class: 'num' }, 'Time limit'))),
          h('tbody', {}, quizzes.map((q) => h('tr', {},
            h('td', {}, q.title), h('td', { class: 'num' }, q.questions.length), h('td', { class: 'num' }, q.timeLimitMin ? `${q.timeLimitMin} min` : '—')))))),
      quizzes.length > 0 && h('div', { class: 'btn-row end' },
        h('button', { class: 'btn ghost', onClick: () => { parsed = null; renderPreview(); } }, 'Cancel'),
        h('button', { class: 'btn primary', onClick: confirmImport }, 'Add to library')),
    ));
    previewEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function confirmImport() {
    addQuizzes(parsed.quizzes);
    toast(`Added ${parsed.quizzes.length} quiz${parsed.quizzes.length > 1 ? 'zes' : ''} to the library`, 'success');
    const first = parsed.quizzes[0];
    parsed = null;
    pasteInput.value = '';
    renderPreview();
    onImported?.(first.id);
  }

  const el = h('div', {},
    h('div', { class: 'panel' },
      h('h2', {}, 'Import from CSV'),
      h('p', { class: 'muted' }, 'One row per question. Files exported from this studio re-import as-is, and one file can hold several quizzes.'),
      dropzone,
      h('div', { class: 'field-grid', style: { marginTop: '20px' } },
        h('label', { class: 'field' }, h('span', {}, 'Quiz title', h('span', { class: 'hint' }, ' — if not in the file')), titleInput),
        h('label', { class: 'field' }, h('span', {}, 'Time limit (minutes)', h('span', { class: 'hint' }, ' — 0 = none')), timeInput)),
      pasteInput,
      h('div', { class: 'btn-row end', style: { marginTop: '12px' } },
        h('button', { class: 'btn ghost', onClick: () => pasteInput.value.trim() ? parse(pasteInput.value) : toast('Paste some CSV first.', 'error') }, 'Read pasted CSV')),
    ),
    previewEl,
    h('div', { class: 'panel' },
      h('div', { class: 'panel-title' },
        h('h3', {}, 'CSV format'),
        h('a', { class: 'btn ghost small', href: PATHS.template, download: 'quiz-template.csv' }, 'Download template')),
      h('p', { class: 'muted small' },
        'Required: question, option_a, option_b, correct (A–D, or A;C for several). Optional: question_type (single = radio buttons, multiple = checkboxes; worked out from correct when blank), option_c, option_d, explanation, points, ',
        'and quiz_id, quiz_title, quiz_description, time_limit_min, slot to put several quizzes in one file.'),
      h('pre', { class: 'code-sample' }, SAMPLE),
      h('p', { class: 'muted small', style: { marginTop: '12px' } }, `Full column order: ${QUIZ_COLUMNS.join(', ')}`)),
  );

  return { el, refresh: () => {} };
}
