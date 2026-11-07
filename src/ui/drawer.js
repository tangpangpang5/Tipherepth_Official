import { el } from './dom.js';

/** 右侧抽屉：树页/书架共用。Esc 或点遮罩关闭。 */
export function openDrawer({ kicker = '', title = '', build }) {
  const body = el('div', { class: 'drawer__body' });
  const root = el('aside', { class: 'drawer', role: 'dialog', 'aria-label': title || kicker || '详情' },
    el('header', { class: 'drawer__head' },
      el('div', { class: 'drawer__meta' },
        el('span', { class: 'drawer__kicker', text: kicker }),
        el('strong', { class: 'drawer__title', text: title }),
      ),
      el('button', { class: 'drawer__close', type: 'button', text: '×', title: '关闭 (Esc)' }),
    ),
    body,
  );

  let onKey = null;
  const close = () => {
    root.classList.remove('drawer--open');
    if (onKey) document.removeEventListener('keydown', onKey);
    window.setTimeout(() => root.remove(), 160);
  };
  onKey = (event) => {
    if (event.key === 'Escape') close();
  };
  root.querySelector('.drawer__close').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  if (typeof build === 'function') build(body, { close, root });
  document.body.append(root);
  requestAnimationFrame(() => root.classList.add('drawer--open'));
  return { close, node: root, body };
}
