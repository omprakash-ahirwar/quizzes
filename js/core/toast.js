/**
 * toast.js — short status messages at the bottom of the screen.
 *   toast('Quiz saved', 'success')   types: 'info' | 'success' | 'error'
 */
import { h } from './dom.js';

function container() {
  let box = document.getElementById('toasts');
  if (!box) {
    box = h('div', { id: 'toasts', class: 'toasts', 'aria-live': 'polite' });
    document.body.append(box);
  }
  return box;
}

export function toast(message, type = 'info', ms = 3200) {
  const node = h('div', { class: `toast ${type}`, role: type === 'error' ? 'alert' : 'status' }, message);
  const box = container();
  box.append(node);
  while (box.children.length > 3) box.firstElementChild.remove(); // keep the stack short
  setTimeout(() => {
    node.classList.add('leaving');
    setTimeout(() => node.remove(), 300);
  }, ms);
}
