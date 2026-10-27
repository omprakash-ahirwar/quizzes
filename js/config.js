/**
 * config.js — every app-wide setting lives here.
 * Edit this file to rename the app, change limits or hook up a results endpoint.
 */

export const APP = {
  name: 'Quizora',
  /** How many quizzes can be published (shown on the participant page) at once. */
  maxPublished: 5,
};

/** Files served from the repository (relative to the site root). */
export const PATHS = {
  quizzes: 'data/quizzes.csv',
  template: 'data/template.csv',
};

/** localStorage keys. Bump the version suffix if you change the stored shape. */
export const STORAGE_KEYS = {
  library: 'quizora.library.v1',   // all quizzes in the studio (drafts + published)
  results: 'quizora.results.v1',   // quiz attempts recorded in this browser
  playerName: 'quizora.playerName',
};

/** Column order of quizzes.csv — one row per question. */
export const QUIZ_COLUMNS = [
  'quiz_id',
  'quiz_title',
  'quiz_description',
  'time_limit_min',
  'slot',
  'question',
  'question_type', // single | multiple (optional: inferred from `correct`)
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct',
  'explanation',
  'points',
];

/** Column order of results.csv — one row per attempt. */
export const RESULT_COLUMNS = [
  'result_id',
  'submitted_at',
  'quiz_id',
  'quiz_title',
  'participant',
  'score',
  'max_score',
  'percent',
  'correct_count',
  'question_count',
  'duration_sec',
  'answers',
];

/** Question types: single → radio buttons, multiple → checkboxes. */
export const QUESTION_TYPES = { single: 'single', multiple: 'multiple' };

/** Answer letters; a question can have 2–4 options. */
export const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

/** Colour theme per publish slot (slot 1 → violet, …). Classes live in components.css. */
export const SLOT_THEMES = ['violet', 'mint', 'sun', 'coral', 'sky'];

/**
 * Optional: a URL that receives each result as a CSV row (e.g. a Google Apps Script
 * web app that appends to a Google Sheet). Leave empty to keep results in the browser only.
 * See README.md → "Collecting results centrally".
 */
export const RESULTS_ENDPOINT = '';
