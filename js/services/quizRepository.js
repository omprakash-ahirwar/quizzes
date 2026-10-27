/**
 * services/quizRepository.js — where quizzes come from and where they are kept.
 *
 *  • Live quizzes   → data/quizzes.csv in the repo (what every visitor sees on GitHub Pages).
 *  • Studio library → localStorage in the admin's browser (drafts + publish slots).
 *
 * Publishing flow: arrange the 5 slots in the studio → download quizzes.csv →
 * commit it to /data → GitHub Pages serves it to everyone.
 */
import { APP, PATHS, STORAGE_KEYS } from '../config.js';
import { loadJSON, saveJSON } from '../core/storage.js';
import { createQuiz, quizzesFromCSV, quizzesToCSV } from '../models/quiz.js';

const events = new EventTarget();

/** Run `fn(library)` whenever the studio library changes. Returns an unsubscribe function. */
export function onLibraryChange(fn) {
  const handler = () => fn(getLibrary());
  events.addEventListener('change', handler);
  return () => events.removeEventListener('change', handler);
}

/* ---------- Live quizzes (repo CSV) ---------- */

export async function fetchQuizFile(path = PATHS.quizzes) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Couldn't load ${path} (HTTP ${res.status}).`);
  return quizzesFromCSV(await res.text()).quizzes;
}

/** Published quizzes sorted by slot. If a file has no slot column, the first five are used. */
export function publishedOnly(quizzes) {
  const slotted = quizzes.filter((q) => q.slot);
  const list = slotted.length ? slotted : quizzes.slice(0, APP.maxPublished).map((q, i) => ({ ...q, slot: i + 1 }));
  return list.sort((a, b) => a.slot - b.slot).slice(0, APP.maxPublished);
}

/** Quizzes for the participant page. `preview` uses the studio's unpublished arrangement. */
export async function loadQuizzesForPlayer({ preview = false } = {}) {
  if (preview) return publishedOnly(getLibrary());
  return publishedOnly(await fetchQuizFile());
}

/* ---------- Studio library (localStorage) ---------- */

export function getLibrary() {
  return (loadJSON(STORAGE_KEYS.library, null) || []).map(createQuiz);
}

function saveLibrary(list) {
  saveJSON(STORAGE_KEYS.library, list);
  events.dispatchEvent(new Event('change'));
}

/** First visit to the studio: start the library from what's live in the repo. */
export async function ensureLibrary() {
  if (loadJSON(STORAGE_KEYS.library, null)) return getLibrary();
  let seed = [];
  try { seed = await fetchQuizFile(); } catch { /* no live file yet — start empty */ }
  saveLibrary(seed);
  return seed;
}

export function upsertQuiz(quiz) {
  const list = getLibrary();
  const stamped = { ...quiz, updatedAt: new Date().toISOString() };
  const i = list.findIndex((q) => q.id === quiz.id);
  if (i === -1) list.push(stamped); else list[i] = stamped;
  saveLibrary(list);
  return stamped;
}

/** Add imported quizzes; a quiz with an existing id replaces the old one. */
export function addQuizzes(quizzes) {
  quizzes.forEach((q) => upsertQuiz({ ...q, slot: null }));
}

export function deleteQuiz(id) {
  saveLibrary(getLibrary().filter((q) => q.id !== id));
}

/** Put a quiz in a slot (1..5), or pass slot=null to unpublish it. Any quiz already there is moved out. */
export function setSlot(quizId, slot) {
  const list = getLibrary().map((q) => {
    if (q.id === quizId) return { ...q, slot };
    if (slot && q.slot === slot) return { ...q, slot: null };
    return q;
  });
  saveLibrary(list);
}

export function clearSlot(slot) {
  saveLibrary(getLibrary().map((q) => (q.slot === slot ? { ...q, slot: null } : q)));
}

/** Throw away local edits and reload the library from the repo file. */
export async function resetLibraryFromRepo() {
  const seed = await fetchQuizFile();
  saveLibrary(seed);
  return seed;
}

/* ---------- Export ---------- */

/** quizzes.csv content to commit: published quizzes only, in slot order. */
export const exportPublishedCSV = () => quizzesToCSV(publishedOnly(getLibrary().filter((q) => q.slot)));

/** Everything in the library (useful as a backup). */
export const exportLibraryCSV = () => quizzesToCSV(getLibrary());

export const exportQuizCSV = (quiz) => quizzesToCSV([quiz]);
