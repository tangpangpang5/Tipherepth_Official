import { el } from './dom.js';
import { createPlayerBar } from './player-bar.js';
import { renderLibrary, renderTrack, renderWall } from './views.js';

const ROUTE_RE = /^#\/?([a-z-]+)?(?:\/(.+))?$/;

function parseHash() {
  const raw = window.location.hash || '#/';
  const match = raw.match(ROUTE_RE);
  const name = (match && match[1]) || 'wall';
  const param = match && match[2] ? decodeURIComponent(match[2]) : null;
  if (name === 'library') return { route: 'library', trackId: null };
  if (name === 'track' && param) return { route: 'track', trackId: param };
  return { route: 'wall', trackId: null };
}

export function createApp({ dataset, player }) {
  const root = el('div', { class: 'app' });
  const main = el('div', { class: 'main' });
  const navLinks = new Map();
  let viewHandle = null;
  let playerBar = null;
  let clockTimer = 0;

  function navigate(path) {
    const next = '#/' + String(path || '').replace(/^#?\/?/, '');
    if (window.location.hash === next) render();
    else window.location.hash = next;
  }

  function openTrack(id) {
    if (!id) return;
    navigate(`track/${encodeURIComponent(id)}`);
  }

  function openWall() {
    navigate('wall');
  }

  function setCurrent(route) {
    for (const [key, link] of navLinks) {
      if (key === route) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  function buildTopbar() {
    const nav = el(
      'nav',
      { class: 'topbar__nav', 'aria-label': '视图切换' },
      el('a', { class: 'navlink', href: '#/wall', text: 'WALL' }),
      el('a', { class: 'navlink', href: '#/library', text: 'LIBRARY' })
    );
    navLinks.set('wall', nav.children[0]);
    navLinks.set('library', nav.children[1]);

    const badge = dataset.demo
      ? el('span', { class: 'badge badge--demo', text: 'DEMO DATA' })
      : el('span', { class: 'badge', text: `${dataset.tracks.length} TRACKS` });

    const clock = el('span', { class: 'mono', text: '' });
    const tick = () => {
      const now = new Date();
      clock.textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
    };
    tick();
    clockTimer = window.setInterval(tick, 1000);

    return el(
      'header',
      { class: 'topbar' },
      el(
        'a',
        { class: 'brand', href: '#/wall' },
        el('span', { class: 'brand__mark' }),
        el('span', { text: 'TIPHERETH // ARCHIVE' }),
        el('span', { class: 'status-light', dataset: { state: dataset.demo ? 'demo' : 'ok' } })
      ),
      el('div', { class: 'topbar__meta' }, badge, nav, clock)
    );
  }

  function render() {
    const { route, trackId } = parseHash();
    if (viewHandle && typeof viewHandle.destroy === 'function') viewHandle.destroy();
    viewHandle = null;
    main.replaceChildren();

    const ctx = { dataset, player, navigate, openTrack, openWall };

    if (route === 'library') {
      viewHandle = renderLibrary(ctx);
    } else if (route === 'track') {
      viewHandle = renderTrack({ ...ctx, trackId });
    } else {
      viewHandle = renderWall(ctx);
    }

    main.append(viewHandle.el);
    setCurrent(route);
  }

  function mount(node) {
    root.append(buildTopbar(), main);
    playerBar = createPlayerBar({ player });
    root.append(playerBar.el);
    node.replaceChildren(root);

    window.addEventListener('hashchange', render);
    render();

    // 全局快捷键：空格播放/暂停，←/→ 切歌，Esc 回墙
    window.addEventListener('keydown', (event) => {
      const tag = (event.target && event.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return;
      if (event.code === 'Space') {
        event.preventDefault();
        player.toggle();
      } else if (event.code === 'ArrowRight' && event.shiftKey) {
        player.next({});
      } else if (event.code === 'ArrowLeft' && event.shiftKey) {
        player.prev();
      } else if (event.code === 'KeyL') {
        navigate('library');
      } else if (event.code === 'KeyW') {
        navigate('wall');
      } else if (event.code === 'Escape') {
        navigate('wall');
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

  const app = { mount, navigate, openTrack, destroy };
  return app;
}
