/**
 * services/resultRepository.js — storing quiz results.
 *
 * GitHub Pages can't write files, so each result is:
 *   1. saved in this browser (localStorage),
 *   2. downloadable as results.csv (participant: their own row; studio: everything),
 *   3. optionally POSTed as a CSV row to RESULTS_ENDPOINT (e.g. a Google Sheet).
 * The studio can import results.csv files collected from participants and merge them.
 */
import { RESULTS_ENDPOINT, STORAGE_KEYS } from '../config.js';
import { loadJSON, saveJSON } from '../core/storage.js';
import { resultsFromCSV, resultsToCSV } from '../models/result.js';

export const listResults = () =>
  loadJSON(STORAGE_KEYS.results, []).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

export async function saveResult(result) {
  saveJSON(STORAGE_KEYS.results, [...listResults(), result]);
  if (RESULTS_ENDPOINT) await sendToEndpoint(result);
  return result;
}

/** Fire-and-forget POST. "no-cors" + text/plain avoids a CORS preflight for Apps Script. */
async function sendToEndpoint(result) {
  try {
    await fetch(RESULTS_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: resultsToCSV([result]),
    });
  } catch (err) {
    console.warn('Result could not be sent to RESULTS_ENDPOINT:', err);
  }
}

/** Merge results from a CSV file. Returns how many new rows were added. */
export function importResultsCSV(text) {
  const existing = listResults();
  const known = new Set(existing.map((r) => r.id));
  const incoming = resultsFromCSV(text).filter((r) => !known.has(r.id));
  saveJSON(STORAGE_KEYS.results, [...existing, ...incoming]);
  return incoming.length;
}

export const exportResultsCSV = (results = listResults()) => resultsToCSV(results);

export const clearResults = () => saveJSON(STORAGE_KEYS.results, []);

/** Per-quiz summary for the studio: attempts, average %, best score. */
export function summariseByQuiz(results) {
  const map = new Map();
  for (const r of results) {
    const s = map.get(r.quizId) || { quizId: r.quizId, quizTitle: r.quizTitle, attempts: 0, totalPercent: 0, best: null };
    s.attempts++;
    s.totalPercent += r.percent;
    if (!s.best || r.percent > s.best.percent) s.best = r;
    map.set(r.quizId, s);
  }
  return [...map.values()].map((s) => ({ ...s, avgPercent: Math.round(s.totalPercent / s.attempts) }));
}
