/**
 * csv.js — dependency-free CSV reader/writer (RFC 4180).
 * Handles quoted fields, escaped quotes (""), commas and line breaks inside quotes, and a UTF-8 BOM.
 */

/** Parse CSV text into an array of rows (arrays of strings). Blank lines are skipped. */
export function parseCSV(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
      continue;
    }

    if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

/** Normalise a header: "Option A" → "option_a". */
export const normaliseHeader = (h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_');

/** Parse CSV text into objects keyed by (normalised) header. */
export function csvToObjects(text) {
  const [header, ...body] = parseCSV(text);
  if (!header) return [];
  const keys = header.map(normaliseHeader);
  return body.map((cells, index) => {
    const obj = { __row: index + 2 }; // spreadsheet row number, handy for error messages
    keys.forEach((k, i) => { obj[k] = (cells[i] ?? '').trim(); });
    return obj;
  });
}

/** Quote a single value when needed. Guards against spreadsheet formula injection. */
function escapeCell(value) {
  if (value == null) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+@\t]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Turn objects into CSV text using the given column order. */
export function objectsToCSV(objects, columns) {
  const lines = [columns.join(',')];
  for (const obj of objects) lines.push(columns.map((c) => escapeCell(obj[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}
