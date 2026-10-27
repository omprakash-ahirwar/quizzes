/**
 * studio/main.js — Quiz Studio controller: loads the library and switches between tabs.
 * Each tab is a module exporting create…Tab() → { el, refresh }.
 */
import { h, mount, qs } from '../../core/dom.js';
import { ensureLibrary, getLibrary, onLibraryChange } from '../../services/quizRepository.js';
import { listResults } from '../../services/resultRepository.js';
import { createBuilderTab } from './builderTab.js';
import { createImportTab } from './importTab.js';
import { createPublishTab } from './publishTab.js';
import { createResultsTab } from './resultsTab.js';

const app = qs('#app');

const builder = createBuilderTab();
const tabs = {
  build:   { label: 'Build quiz', tab: builder },
  import:  { label: 'Import CSV', tab: createImportTab({ onImported: (id) => { builder.openById(id); select('build'); } }) },
  publish: { label: 'Publish',    tab: createPublishTab(), count: () => getLibrary().filter((q) => q.slot).length },
  results: { label: 'Results',    tab: createResultsTab(), count: () => listResults().length },
};

let active = new URLSearchParams(location.hash.slice(1)).get('tab') || 'build';
if (!tabs[active]) active = 'build';

const tabBar = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Studio sections' });
const panel = h('div', { class: 'tab-panel', role: 'tabpanel' });

function renderTabBar() {
  mount(tabBar, Object.entries(tabs).map(([key, t]) =>
    h('button', { class: 'tab', role: 'tab', 'aria-selected': String(key === active), onClick: () => select(key) },
      t.label, t.count && t.count() ? h('span', { class: 'count' }, t.count()) : null)));
}

function select(key) {
  active = key;
  history.replaceState(null, '', `#tab=${key}`);
  renderTabBar();
  tabs[key].tab.refresh();
  // re-trigger the entrance animation
  mount(panel, tabs[key].tab.el);
  panel.style.animation = 'none';
  void panel.offsetWidth;
  panel.style.animation = '';
}

onLibraryChange(() => { renderTabBar(); tabs[active].tab.refresh(); });

window.addEventListener('beforeunload', (e) => {
  if (builder.hasUnsavedChanges()) { e.preventDefault(); e.returnValue = ''; }
});

async function start() {
  mount(app, h('p', { class: 'muted' }, 'Loading your library…'));
  await ensureLibrary();
  mount(app,
    h('div', { class: 'studio-head' },
      h('div', {},
        h('h1', {}, 'Quiz studio'),
        h('p', {}, 'Build quizzes, import them from CSV, publish up to five, and review results.')),
      h('a', { class: 'btn ghost', href: 'index.html?preview=1', target: '_blank', rel: 'noopener' }, 'Preview participant page')),
    tabBar,
    panel);
  select(active);
}

start();
