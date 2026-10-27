/**
 * studio/publishTab.js — arrange up to five quizzes into publish slots and export quizzes.csv.
 */
import { APP, PATHS, SLOT_THEMES } from '../../config.js';
import { h, mount } from '../../core/dom.js';
import { toast } from '../../core/toast.js';
import { downloadText } from '../../core/files.js';
import {
  clearSlot, exportLibraryCSV, exportPublishedCSV, getLibrary, resetLibraryFromRepo, setSlot,
} from '../../services/quizRepository.js';

export function createPublishTab() {
  const el = h('div');

  function refresh() {
    const library = getLibrary();
    const publishedCount = library.filter((q) => q.slot).length;

    const slots = Array.from({ length: APP.maxPublished }, (_, i) => {
      const slot = i + 1;
      const quiz = library.find((q) => q.slot === slot);
      const select = h('select', {
        class: 'select', 'aria-label': `Quiz in slot ${slot}`, value: quiz?.id || '',
        onChange: (e) => (e.target.value ? setSlot(e.target.value, slot) : clearSlot(slot)),
      },
        h('option', { value: '' }, 'Empty'),
        library.map((q) => h('option', { value: q.id }, q.title + (q.slot && q.slot !== slot ? ` (slot ${q.slot})` : ''))));

      return h('div', { class: `slot theme-${SLOT_THEMES[i]} ${quiz ? '' : 'empty-slot'}` },
        h('span', { class: 'slot-name' }, `Slot ${slot}`),
        h('h4', {}, quiz ? quiz.title : 'Empty'),
        h('p', {}, quiz ? `${quiz.questions.length} questions${quiz.timeLimitMin ? `, ${quiz.timeLimitMin} min` : ''}` : 'Choose a quiz to publish here.'),
        select);
    });

    const downloadPublished = () => {
      if (!publishedCount) return toast('Put at least one quiz in a slot first.', 'error');
      downloadText('quizzes.csv', exportPublishedCSV());
      toast('Downloaded quizzes.csv — commit it to the data folder to go live.', 'success', 5000);
    };

    const reset = async () => {
      if (!confirm('Replace your studio library with the live quizzes.csv? Unpublished drafts will be lost.')) return;
      try { await resetLibraryFromRepo(); toast('Library reloaded from the live file', 'success'); }
      catch (err) { toast(err.message, 'error'); }
    };

    mount(el,
      h('div', { class: 'panel' },
        h('div', { class: 'panel-title' },
          h('h2', {}, 'Publish slots'),
          h('span', { class: 'pill violet' }, `${publishedCount} of ${APP.maxPublished} in use`)),
        h('p', { class: 'muted' }, 'Participants see these quizzes, in this order. A quiz can only sit in one slot.'),
        library.length ? h('div', { class: 'slots' }, slots)
          : h('div', { class: 'empty' }, h('h3', {}, 'Your library is empty'), h('p', {}, 'Build or import a quiz first, then publish it here.'))),

      h('div', { class: 'panel' },
        h('h2', {}, 'Go live on GitHub Pages'),
        h('ol', { class: 'steps' },
          h('li', {}, h('div', {},
            h('b', {}, 'Preview'), h('p', { class: 'muted small' }, 'See the participant page with this arrangement before anyone else does.'),
            h('a', { class: 'btn ghost small', href: 'index.html?preview=1', target: '_blank', rel: 'noopener' }, 'Open preview'))),
          h('li', {}, h('div', {},
            h('b', {}, 'Download quizzes.csv'), h('p', { class: 'muted small' }, 'Contains the published quizzes and their slot numbers.'),
            h('button', { class: 'btn primary small', onClick: downloadPublished }, 'Download quizzes.csv'))),
          h('li', {}, h('div', {},
            h('b', {}, 'Commit it to the repository'),
            h('p', { class: 'muted small' }, 'Replace ', h('code', {}, PATHS.quizzes),
              ' (GitHub → data folder → Add file → Upload files). Pages updates within a minute or two.'))),
        ),
        h('div', { class: 'btn-row', style: { marginTop: '22px' } },
          h('button', { class: 'btn ghost small', onClick: () => downloadText('quiz-library-backup.csv', exportLibraryCSV()) }, 'Back up whole library'),
          h('button', { class: 'btn ghost small', onClick: reset }, 'Reload from live file')),
      ),
    );
  }

  return { el, refresh };
}
