/**
 * models/result.js — scoring a quiz attempt and converting results to/from CSV.
 *
 * Result { id, submittedAt, quizId, quizTitle, participant, score, maxScore, percent,
 *          correctCount, questionCount, durationSec, answers }
 * `answers` is stored compactly in CSV as "1:B|2:AC|3:-" (question number : chosen letter(s), "-" = skipped).
 */
import { OPTION_LETTERS, RESULT_COLUMNS } from '../config.js';
import { csvToObjects, objectsToCSV } from '../core/csv.js';
import { uid } from '../core/files.js';
import { maxScore, sameAnswer } from './quiz.js';

/**
 * Score an attempt. `choices[i]` is the array of option indexes picked for question i ([] = skipped).
 * A question scores its points only when the picked set exactly matches the correct set.
 */
export function scoreAttempt({ quiz, participant, choices, startedAt, finishedAt = Date.now() }) {
  let score = 0;
  let correctCount = 0;
  quiz.questions.forEach((q, i) => {
    if (sameAnswer(choices[i], q.correct)) { score += q.points; correctCount++; }
  });
  const max = maxScore(quiz);

  return {
    id: uid('r'),
    submittedAt: new Date(finishedAt).toISOString(),
    quizId: quiz.id,
    quizTitle: quiz.title,
    participant: participant.trim(),
    score,
    maxScore: max,
    percent: max ? Math.round((score / max) * 100) : 0,
    correctCount,
    questionCount: quiz.questions.length,
    durationSec: Math.max(0, Math.round((finishedAt - startedAt) / 1000)),
    answers: encodeAnswers(choices),
  };
}

export const encodeAnswers = (choices) =>
  choices.map((c, i) => `${i + 1}:${c?.length ? c.map((x) => OPTION_LETTERS[x]).join('') : '-'}`).join('|');

/** "1:B|2:AC|3:-" → [[1], [0, 2], []] */
export function decodeAnswers(str) {
  return String(str || '').split('|').filter(Boolean).map((part) =>
    (part.split(':')[1] || '').split('').map((l) => OPTION_LETTERS.indexOf(l)).filter((i) => i !== -1));
}

/* ---------- CSV ---------- */

const toRow = (r) => ({
  result_id: r.id,
  submitted_at: r.submittedAt,
  quiz_id: r.quizId,
  quiz_title: r.quizTitle,
  participant: r.participant,
  score: r.score,
  max_score: r.maxScore,
  percent: r.percent,
  correct_count: r.correctCount,
  question_count: r.questionCount,
  duration_sec: r.durationSec,
  answers: r.answers,
});

export const resultsToCSV = (results) => objectsToCSV(results.map(toRow), RESULT_COLUMNS);

export function resultsFromCSV(text) {
  return csvToObjects(text)
    .filter((row) => row.quiz_id && row.participant)
    .map((row) => ({
      id: row.result_id || uid('r'),
      submittedAt: row.submitted_at,
      quizId: row.quiz_id,
      quizTitle: row.quiz_title,
      participant: row.participant,
      score: Number(row.score) || 0,
      maxScore: Number(row.max_score) || 0,
      percent: Number(row.percent) || 0,
      correctCount: Number(row.correct_count) || 0,
      questionCount: Number(row.question_count) || 0,
      durationSec: Number(row.duration_sec) || 0,
      answers: row.answers,
    }));
}

/** 75 → "1m 15s" */
export function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}
