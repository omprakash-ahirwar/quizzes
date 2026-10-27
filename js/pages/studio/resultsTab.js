/**
 * studio/resultsTab.js — results recorded in this browser plus any results.csv files imported.
 */
import { h, mount } from '../../core/dom.js';
import { toast } from '../../core/toast.js';
import { downloadText, readFileText } from '../../core/files.js';
import { formatDuration } from '../../models/result.js';
import {
  clearResults, exportResultsCSV, importResultsCSV, listResults, summariseByQuiz,
} from '../../services/resultRepository.js';

export function createResultsTab() {
  let filter = '';
  const el = h('div');

  const fileInput = h('input', {
    type: 'file', accept: '.csv,text/csv', multiple: true, class: 'sr-only',
    onChange: async (e) => {
      let added = 0;
      for (const file of e.target.files) added += importResultsCSV(await readFileText(file));
      e.target.value = '';
      toast(added ? `Imported ${added} new result${added > 1 ? 's' : ''}` : 'No new results found in that file', added ? 'success' : 'info');
      refresh();
    },
  });

  const bar = (pct) => h('div', { class: 'bar', title: `${pct}%` }, h('i', { style: { width: `${pct}%` } }));

  function refresh() {
    const all = listResults();
    const rows = filter ? all.filter((r) => r.quizId === filter) : all;
    const summary = summariseByQuiz(all);
    const avg = all.length ? Math.round(all.reduce((s, r) => s + r.percent, 0) / all.length) : 0;
    const people = new Set(all.map((r) => r.participant.toLowerCase())).size;

    const toolbar = h('div', { class: 'btn-row' },
      h('label', { class: 'btn ghost small' }, fileInput, 'Import results CSV'),
      h('button', { class: 'btn primary small', disabled: !rows.length,
        onClick: () => downloadText('results.csv', exportResultsCSV(rows)) }, filter ? 'Download filtered CSV' : 'Download results.csv'),
      h('button', { class: 'btn danger small', disabled: !all.length,
        onClick: () => { if (confirm('Delete all results stored in this browser?')) { clearResults(); refresh(); toast('Results cleared'); } } }, 'Clear'));

    if (!all.length) {
      return mount(el, h('div', { class: 'panel' },
        h('div', { class: 'panel-title' }, h('h2', {}, 'Results'), toolbar),
        h('div', { class: 'empty' },
          h('h3', {}, 'No results yet'),
          h('p', {}, 'Attempts made in this browser show up here. Import results.csv files that participants send you to see everyone together.'))));
    }

    mount(el,
      h('div', { class: 'panel' },
        h('div', { class: 'panel-title' }, h('h2', {}, 'Results'), toolbar),
        h('div', { class: 'stats', style: { margin: '10px 0 22px' } },
          h('div', { class: 'stat' }, h('b', {}, all.length), h('span', {}, 'attempts')),
          h('div', { class: 'stat' }, h('b', {}, people), h('span', {}, 'participants')),
          h('div', { class: 'stat' }, h('b', {}, `${avg}%`), h('span', {}, 'average score'))),
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Quiz'), h('th', { class: 'num' }, 'Attempts'), h('th', {}, 'Average'), h('th', {}, 'Top scorer'))),
          h('tbody', {}, summary.map((s) => h('tr', {},
            h('td', {}, s.quizTitle),
            h('td', { class: 'num' }, s.attempts),
            h('td', {}, h('div', { class: 'btn-row' }, bar(s.avgPercent), `${s.avgPercent}%`)),
            h('td', {}, `${s.best.participant} (${s.best.percent}%)`))))))),

      h('div', { class: 'panel' },
        h('div', { class: 'panel-title' },
          h('h3', {}, 'All attempts'),
          h('select', { class: 'select', style: { width: 'auto' }, 'aria-label': 'Filter by quiz', value: filter,
            onChange: (e) => { filter = e.target.value; refresh(); } },
            h('option', { value: '' }, 'All quizzes'),
            summary.map((s) => h('option', { value: s.quizId }, s.quizTitle)))),
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', {}, h('tr', {},
            h('th', {}, 'When'), h('th', {}, 'Participant'), h('th', {}, 'Quiz'),
            h('th', { class: 'num' }, 'Score'), h('th', {}, 'Percent'), h('th', { class: 'num' }, 'Time'))),
          h('tbody', {}, rows.map((r) => h('tr', {},
            h('td', {}, new Date(r.submittedAt).toLocaleString()),
            h('td', {}, r.participant),
            h('td', {}, r.quizTitle),
            h('td', { class: 'num' }, `${r.score}/${r.maxScore}`),
            h('td', {}, h('div', { class: 'btn-row' }, bar(r.percent), `${r.percent}%`)),
            h('td', { class: 'num' }, formatDuration(r.durationSec)))))))),
    );
  }

  return { el, refresh };
}
