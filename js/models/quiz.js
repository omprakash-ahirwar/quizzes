/**
 * models/quiz.js — the Quiz shape, validation, and conversion to/from CSV rows.
 *
 * Quiz      { id, title, description, timeLimitMin, slot, questions[], updatedAt }
 * Question  { id, type, text, options[2..4], correct (array of option indexes), explanation, points }
 *
 * type 'single'   → exactly one correct option; shown with radio buttons.
 * type 'multiple' → one or more correct options; shown with checkboxes. Participants must pick
 *                   exactly the correct set to earn the points.
 * When no type is given it is inferred: more than one correct option → 'multiple', otherwise 'single'.
 * `slot` is 1..5 when the quiz is published, otherwise null.
 */
import { OPTION_LETTERS, QUIZ_COLUMNS, QUESTION_TYPES, APP } from '../config.js';
import { csvToObjects, objectsToCSV } from '../core/csv.js';
import { uid, slugify } from '../core/files.js';

/* ---------- Correct-answer helpers ---------- */

/** Accepts 2, [0, 2] or undefined → sorted, unique array of indexes (default [0]). */
export function normaliseCorrect(value) {
  const list = (Array.isArray(value) ? value : [value]).map(Number).filter((n) => Number.isInteger(n) && n >= 0);
  const unique = [...new Set(list)].sort((a, b) => a - b);
  return unique.length ? unique : [0];
}

export const isMultiAnswer = (q) => q.type === QUESTION_TYPES.multiple;

/** "Multiple", "checkbox", "m" → 'multiple'; "single", "radio", "s" → 'single'; anything else → null. */
export function parseQuestionType(value) {
  const v = String(value || '').trim().toLowerCase();
  if (['multiple', 'multi', 'm', 'checkbox', 'many'].includes(v)) return QUESTION_TYPES.multiple;
  if (['single', 's', 'radio', 'one'].includes(v)) return QUESTION_TYPES.single;
  return null;
}

/** True when two index arrays contain the same options (order doesn't matter). */
export function sameAnswer(a = [], b = []) {
  const setB = new Set(b);
  return a.length === setB.size && a.every((v) => setB.has(v));
}

/** [0, 2] → "A;C" (the format used in the CSV `correct` column). */
export const correctToLetters = (correct) => correct.map((i) => OPTION_LETTERS[i]).join(';');

/* ---------- Factories ---------- */

export function createQuestion(data = {}) {
  let correct = data.correct == null ? [0] : normaliseCorrect(data.correct);
  const type = parseQuestionType(data.type) || (correct.length > 1 ? QUESTION_TYPES.multiple : QUESTION_TYPES.single);
  if (type === QUESTION_TYPES.single) correct = correct.slice(0, 1);
  return {
    id: data.id || uid('q'),
    type,
    text: data.text || '',
    options: data.options?.length ? [...data.options] : ['', '', '', ''],
    correct,
    explanation: data.explanation || '',
    points: Number(data.points) > 0 ? Number(data.points) : 1,
  };
}

export function createQuiz(data = {}) {
  const slot = Number(data.slot);
  return {
    id: data.id || uid('quiz'),
    title: data.title || '',
    description: data.description || '',
    timeLimitMin: Number(data.timeLimitMin) > 0 ? Number(data.timeLimitMin) : 0,
    slot: slot >= 1 && slot <= APP.maxPublished ? slot : null,
    questions: (data.questions || []).map(createQuestion),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

export const cloneQuiz = (quiz) => createQuiz(JSON.parse(JSON.stringify(quiz)));

export const maxScore = (quiz) => quiz.questions.reduce((sum, q) => sum + q.points, 0);

/* ---------- Validation ---------- */

/** Returns a list of human-readable problems; an empty list means the quiz is ready. */
export function validateQuiz(quiz) {
  const errors = [];
  if (!quiz.title.trim()) errors.push('Give the quiz a title.');
  if (!quiz.questions.length) errors.push('Add at least one question.');

  quiz.questions.forEach((q, i) => {
    const n = `Question ${i + 1}`;
    const filled = q.options.filter((o) => o.trim());
    if (!q.text.trim()) errors.push(`${n}: write the question text.`);
    if (filled.length < 2) errors.push(`${n}: add at least two answer options.`);
    if (!q.correct.length) errors.push(`${n}: mark the correct answer.`);
    else if (!isMultiAnswer(q) && q.correct.length > 1) errors.push(`${n}: a single-answer question can have only one correct option.`);
    else if (q.correct.some((c) => !q.options[c]?.trim())) errors.push(`${n}: a ticked correct answer is empty.`);
  });
  return errors;
}

/** Drop empty options while keeping the correct answers pointing at the right ones. */
export function tidyQuestion(q) {
  const kept = q.options.map((text, i) => ({ text: text.trim(), i })).filter((o) => o.text);
  const correct = q.correct.map((c) => kept.findIndex((o) => o.i === c)).filter((c) => c !== -1);
  return { ...q, text: q.text.trim(), options: kept.map((o) => o.text), correct: correct.length ? normaliseCorrect(correct) : [] };
}

/* ---------- CSV → quizzes ---------- */

/** One token → option index: "B", "2" or the option's own text. Returns -1 if no match. */
function resolveToken(token, options) {
  const v = token.trim();
  const byLetter = OPTION_LETTERS.indexOf(v.toUpperCase());
  if (byLetter !== -1) return byLetter;
  if (/^[1-4]$/.test(v)) return Number(v) - 1;
  return options.findIndex((o) => o && o.toLowerCase() === v.toLowerCase());
}

/**
 * Work out the correct option(s). Accepts "B", "A;C", "A|C", "A,C", "AC", "1;3",
 * or the exact text of a single option. Returns an index array, or null if anything doesn't match.
 */
function resolveCorrect(raw, options) {
  const v = String(raw || '').trim();
  if (!v) return null;

  const whole = options.findIndex((o) => o && o.toLowerCase() === v.toLowerCase());
  if (whole !== -1) return [whole]; // option text that happens to contain separators

  const tokens = /^[A-Da-d]{2,4}$/.test(v) ? v.split('') : v.split(/[;|,]+/).filter((t) => t.trim());
  const indexes = tokens.map((t) => resolveToken(t, options));
  return indexes.every((i) => i !== -1 && options[i]) ? normaliseCorrect(indexes) : null;
}

/**
 * Parse quizzes.csv text. Rows sharing a quiz_id (or quiz_title) become one quiz.
 * `defaults` fills in quiz details when the file only contains question columns.
 * Returns { quizzes, errors } — rows with problems are skipped and reported.
 */
export function quizzesFromCSV(text, defaults = {}) {
  const rows = csvToObjects(text);
  const errors = [];
  const byKey = new Map();

  if (!rows.length) return { quizzes: [], errors: ['The file has no data rows.'] };
  if (!('question' in rows[0])) return { quizzes: [], errors: ['Missing a "question" column. Download the template to see the expected columns.'] };

  for (const row of rows) {
    const title = row.quiz_title || defaults.title || 'Untitled quiz';
    const key = row.quiz_id || slugify(title);

    if (!byKey.has(key)) {
      byKey.set(key, createQuiz({
        id: row.quiz_id || defaults.id || uid('quiz'),
        title,
        description: row.quiz_description || defaults.description || '',
        timeLimitMin: row.time_limit_min || defaults.timeLimitMin || 0,
        slot: row.slot,
      }));
    }

    const options = OPTION_LETTERS.map((l) => row[`option_${l.toLowerCase()}`] || '');
    const correct = resolveCorrect(row.correct, options);
    const where = `Row ${row.__row}`;

    if (!row.question) { errors.push(`${where}: question is empty — skipped.`); continue; }
    if (options.filter(Boolean).length < 2) { errors.push(`${where}: needs at least two options — skipped.`); continue; }
    if (!correct) { errors.push(`${where}: correct answer "${row.correct}" doesn't match the options (use A–D, or A;C for several) — skipped.`); continue; }

    const typeRaw = row.question_type || row.type || '';
    const type = parseQuestionType(typeRaw);
    if (typeRaw && !type) { errors.push(`${where}: question_type "${typeRaw}" should be single or multiple — skipped.`); continue; }
    if (type === QUESTION_TYPES.single && correct.length > 1) {
      errors.push(`${where}: marked single but has ${correct.length} correct answers (${row.correct}) — set question_type to multiple. Skipped.`);
      continue;
    }

    byKey.get(key).questions.push(tidyQuestion(createQuestion({
      type, text: row.question, options, correct, explanation: row.explanation, points: row.points,
    })));
  }

  const quizzes = [...byKey.values()].filter((q) => q.questions.length);
  return { quizzes, errors };
}

/* ---------- quizzes → CSV ---------- */

export function quizzesToCSV(quizzes) {
  const rows = [];
  for (const quiz of quizzes) {
    quiz.questions.forEach((q) => {
      const row = {
        quiz_id: quiz.id,
        quiz_title: quiz.title,
        quiz_description: quiz.description,
        time_limit_min: quiz.timeLimitMin || '',
        slot: quiz.slot || '',
        question: q.text,
        question_type: q.type,
        correct: correctToLetters(q.correct),
        explanation: q.explanation,
        points: q.points,
      };
      OPTION_LETTERS.forEach((l, i) => { row[`option_${l.toLowerCase()}`] = q.options[i] || ''; });
      rows.push(row);
    });
  }
  return objectsToCSV(rows, QUIZ_COLUMNS);
}
