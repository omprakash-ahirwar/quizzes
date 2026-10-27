/**
 * dom.js — a tiny element builder so views can be written as plain functions.
 *
 *   h('button', { class: 'btn', onClick: save }, 'Save')
 *
 * Text children are always inserted as text nodes, so user content is never parsed as HTML.
 */

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  let deferredValue;

  for (const [key, val] of Object.entries(props || {})) {
    if (val == null || val === false) continue;
    if (key === 'class') el.className = val;
    else if (key === 'dataset') Object.assign(el.dataset, val);
    else if (key === 'style' && typeof val === 'object') Object.assign(el.style, val);
    else if (key.startsWith('on') && typeof val === 'function') el.addEventListener(key.slice(2).toLowerCase(), val);
    else if (key === 'value') deferredValue = val; // set after children (needed for <select>)
    else if (key === 'checked') el.checked = Boolean(val);
    else if (val === true) el.setAttribute(key, '');
    else el.setAttribute(key, val);
  }

  appendChildren(el, children);
  if (deferredValue !== undefined) el.value = deferredValue;
  return el;
}

/** Build an inline SVG element (needs the SVG namespace). */
export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Replace everything inside `root` with the given nodes. */
export function mount(root, ...nodes) {
  root.replaceChildren(...nodes.flat().filter(Boolean));
}

export const qs = (selector, root = document) => root.querySelector(selector);
