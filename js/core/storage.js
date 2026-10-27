/**
 * storage.js — safe JSON wrappers around localStorage.
 * Private windows or blocked storage never crash the app; reads fall back to a default.
 */

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadText(key, fallback = '') {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export function saveText(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function remove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}
