import { el } from './dom.js';
import { createPlayerBar } from './player-bar.js';
import { pageMusic } from './tree.js';
import { pageHome, pageProfile } from './pages2.js';
import { pageShelf } from './shelf.js';
import { pageAdmin } from './admin.js';

function parseHash() {
  const raw = (window.location.hash || '#/').replace(/^#\/?/, '');
  const [head, ...rest] = raw.split('/').filter(Boolean);
  if (!head) return { name: 'home' };
  if (head === 'profile') return { name: 'profile' };
  if (head === 'shelf') return { name: 'shelf' };
  if (head === 'admin') return { name: 'admin' };
  if (head === 'music') {
    if (rest[0] === 'library') return { name: 'music', mode: 'index' };
    if (rest[0] === 'track' && rest[1]) return { name: 'music', mode: 'tree', trackId: decodeURIComponent(rest[1]) };
    return { name: 'music', mode: 'tree' };
  }
  return { name: 'home' };
}

export function createApp({ dataset, content, player }) {
  const root = el('div', { class: 'app' });
  const main = el('main', { class: 'main' });
  const navLinks = new Map();
  let viewHandle = null;
  let playerBar = null;
  let clockTimer = 0;

  const go = (path) => {
    const next = '#/' + String(path || '').replace(/^#?\/?/, '');
    if (window.location.hash === next) render();
    else window.location.hash = next;
  };

  const NAV = [
    ['home', 'HOME', ''],
    ['profile', 'PROFILE', 'profile'],
    ['shelf', 'SHELF', 'shelf'],
  ];

  function buildTopbar() {
    const links = NAV.map(([key, label, path]) => {
      const link = el('a', { class: 'navlink', href: `#/${path}`, text: label });
      navLinks.set(key, link);
      return link;
    });
    const music = el('a', { class: 'navlink navlink--music', href: '#/music' });
    music.append(el('span', { class: 'navlink__dot' }), document.createTextNode('MUSIC'));
    navLinks.set('music', music);
    links.push(music);

    const clock = el('span', { class: 'topbar__clock', text: '' });
    const tick = () => { clock.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false }); };
    tick();
    clockTimer = window.setInterval(tick, 1000);

    const admin = el('a', { class: 'navlink navlink--admin', href: '#/admin', text: 'ADMIN' });
    navLinks.set('admin', admin);
    const demo = dataset.demo ? el('span', { class: 'badge badge--demo', text: 'DEMO' }) : null;

    return el(
      'header',
      { class: 'topbar' },
      el(
        'a',
        { class: 'brand', href: '#/' },
        el('span', { class: 'brand__mark' }),
        el('span', { class: 'brand__name', text: content.site.name }),
        el('span', { class: 'brand__sub', text: 'ARCHIVE' }),
      ),
      el('nav', { class: 'nav', 'aria-label': '主导航' }, ...links),
      el('div', { class: 'topbar__meta' }, admin, demo, clock),
    );
  }

  function setCurrent(name) {
    for (const [key, link] of navLinks) {
      if (key === name) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  function render() {
    const route = parseHash();
    if (viewHandle && viewHandle.destroy) viewHandle.destroy();
    viewHandle = null;
    main.replaceChildren();

    if (route.name === 'home') viewHandle = pageHome({ content, navigate: go });
    else if (route.name === 'profile') viewHandle = pageProfile({ content, navigate: go });
    else if (route.name === 'shelf') viewHandle = pageShelf({ content, navigate: go });
    else if (route.name === 'admin') viewHandle = pageAdmin({ content, navigate: go });
    else if (route.name === 'music') {
      viewHandle = pageMusic({
        dataset,
        player,
        navigate: go,
        mode: route.mode,
        trackId: route.trackId,
      });
    }

    main.append(viewHandle.el);
    setCurrent(route.name);
    main.scrollTop = 0;
    main.classList.remove('is-swap');
    void main.offsetWidth;
    main.classList.add('is-swap');
  }

  function mount(node) {
    root.append(buildTopbar(), main);
    playerBar = createPlayerBar({ player });
    root.append(playerBar.el);
    node.replaceChildren(root);
    window.addEventListener('hashchange', render);
    render();
    window.addEventListener('keydown', (event) => {
      const tag = (event.target && event.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return;
      if (event.code === 'Space') {
        const isMusic = (window.location.hash || '').includes('music');
        if (!isMusic) return;
        event.preventDefault();
        player.toggle();
      }
    });
    return app;
  }

  function destroy() {
    window.removeEventListener('hashchange', render);
    if (clockTimer) window.clearInterval(clockTimer);
    if (viewHandle && viewHandle.destroy) viewHandle.destroy();
    if (playerBar) playerBar.destroy();
  }

  const app = { mount, navigate: go, destroy };
  return app;
}
