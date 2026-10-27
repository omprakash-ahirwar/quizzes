/**
 * play/main.js — participant page controller.
 * Flow: list → intro (name) → player → result. Each screen is a view function in this folder.
 */
import { h, mount, qs } from '../../core/dom.js';
import { toast } from '../../core/toast.js';
import { scoreAttempt } from '../../models/result.js';
import { loadQuizzesForPlayer } from '../../services/quizRepository.js';
import { saveResult } from '../../services/resultRepository.js';
import { listView } from './listView.js';
import { introView } from './introView.js';
import { playerView } from './playerView.js';
import { resultView } from './resultView.js';

const app = qs('#app');
const preview = new URLSearchParams(location.search).has('preview');
let quizzes = [];
let cleanup = null;

/** Swap the screen, running the previous screen's cleanup first. */
function show(view) {
  cleanup?.();
  cleanup = view.destroy || null;
  mount(app, view.el || view);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const showList = () => show(listView({ quizzes, preview, onPick: showIntro }));

const showIntro = (quiz) => show(introView({ quiz, onBack: showList, onStart: (name) => showPlayer(quiz, name) }));

function showPlayer(quiz, participant) {
  show(playerView({
    quiz,
    onQuit: () => confirm('Leave this quiz? Your answers won’t be saved.') && showList(),
    onFinish: async (attempt) => {
      const result = scoreAttempt({ quiz, participant, ...attempt });
      await saveResult(result);
      show(resultView({ quiz, result, onRetry: () => showPlayer(quiz, participant), onHome: showList }));
    },
  }));
}

async function start() {
  mount(app, h('p', { class: 'muted' }, 'Loading quizzes…'));
  try {
    quizzes = await loadQuizzesForPlayer({ preview });
  } catch (err) {
    console.error(err);
    toast('Couldn’t load the quizzes. If you opened the file directly, run a local server (see README).', 'error', 6000);
  }
  // Deep link: index.html?quiz=<id> opens a quiz directly
  const linked = quizzes.find((q) => q.id === new URLSearchParams(location.search).get('quiz'));
  linked ? showIntro(linked) : showList();
}

start();
