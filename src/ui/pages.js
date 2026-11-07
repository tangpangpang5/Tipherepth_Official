import { el, fmtTime } from './dom.js';
import { renderMarkdown } from './markdown.js';
import { renderLibrary, renderTrack, renderWall } from './views.js';

const page = (...children) => el('section', { class: 'page' }, ...children);
const container = (...children) => el('div', { class: 'container' }, ...children);

function formatDate(value) {
  if (!value) return '—';
  const [y, m, d] = String(value).split('-');
  return `${y}.${m}.${d}`;
}

function linkList(links) {
  return el(
    'div',
    { class: 'link-row' },
    ...(links || []).map((link) =>
      el('a', { class: 'btn', href: link.href, rel: 'noopener me', text: link.label })
    )
  );
}

function postRow(post, onOpen) {
  return el(
    'a',
    { class: 'entry', href: `#/blog/${post.slug}` },
    el('span', { class: 'entry__date', text: formatDate(post.date) }),
    el(
      'span',
      { class: 'entry__main' },
      el('span', { class: 'entry__title', text: post.title }),
      el('span', { class: 'entry__summary', text: post.summary || '' })
    ),
    el('span', { class: 'entry__tags', text: (post.tags || []).join(' / ') })
  );
}

/* ---------------- 首页 ---------------- */
export function pageHome({ content, navigate }) {
  const { site, posts, works } = content;
  const root = page(
    container(
      el(
        'header',
        { class: 'hero' },
        el('div', { class: 'hero__meta', text: `${site.role || ''} // ${site.location || '—'}` }),
        el('h1', { class: 'hero__name', text: site.name }),
        el('p', { class: 'hero__slogan', text: site.slogan }),
        el('p', { class: 'hero__intro', text: site.intro }),
        linkList(site.links)
      ),
      el(
        'section',
        { class: 'section' },
        el(
          'div',
          { class: 'section__head' },
          el('h2', { text: 'RECENT LOG' }),
          el('a', { class: 'section__more', href: '#/blog', text: 'ALL ENTRIES →' })
        ),
        el('div', { class: 'entries' }, ...posts.slice(0, 4).map((post) => postRow(post)))
      ),
      el(
        'section',
        { class: 'section' },
        el(
          'div',
          { class: 'section__head' },
          el('h2', { text: 'PROJECTS' }),
          el('a', { class: 'section__more', href: '#/works', text: 'ALL WORKS →' })
        ),
        el(
          'div',
          { class: 'card-grid' },
          ...works.slice(0, 3).map((work, index) =>
            el(
              'a',
              { class: 'card', href: work.href || '#/works' },
              el('span', { class: 'card__no', text: String(index + 1).padStart(2, '0') }),
              el('span', { class: 'card__title', text: work.title }),
              el('span', { class: 'card__meta', text: [work.year, work.status].filter(Boolean).join(' / ') }),
              el('span', { class: 'card__summary', text: work.summary })
            )
          )
        )
      ),
      el(
        'section',
        { class: 'section' },
        el('div', { class: 'section__head' }, el('h2', { text: 'MUSIC ARCHIVE' })),
        el(
          'a',
          { class: 'music-cta', href: '#/music' },
          el('span', { class: 'music-cta__label', text: 'CASSETTE WALL' }),
          el('span', { class: 'music-cta__text', text: '推门进去，墙上是我这些年存下来的声音。' }),
          el('span', { class: 'music-cta__arrow', text: '→' })
        )
      )
    )
  );
  return { el: root, destroy() {} };
}

/* ---------------- 日志列表 ---------------- */
export function pageBlog({ content }) {
  const { posts } = content;
  const root = page(
    container(
      el('header', { class: 'page-head' }, el('h1', { text: 'LOG' }), el('span', { class: 'page-head__meta', text: `${posts.length} ENTRIES` })),
      el('div', { class: 'entries' }, ...posts.map((post) => postRow(post)))
    )
  );
  return { el: root, destroy() {} };
}

/* ---------------- 日志详情 ---------------- */
export function pagePost({ content, slug }) {
  const post = content.posts.find((item) => item.slug === slug);
  if (!post) {
    return { el: page(container(el('div', { class: 'empty', text: 'ENTRY NOT FOUND' }))), destroy() {} };
  }
  const root = page(
    container(
      el(
        'article',
        { class: 'post' },
        el('a', { class: 'back', href: '#/blog', text: '← LOG' }),
        el('h1', { class: 'post__title', text: post.title }),
        el('div', { class: 'post__meta', text: `${formatDate(post.date)} // ${(post.tags || []).join(' / ')}` }),
        el('div', { class: 'prose', html: renderMarkdown(post.body) })
      )
    )
  );
  return { el: root, destroy() {} };
}

/* ---------------- 作品 ---------------- */
export function pageWorks({ content }) {
  const { works } = content;
  const root = page(
    container(
      el('header', { class: 'page-head' }, el('h1', { text: 'WORKS' }), el('span', { class: 'page-head__meta', text: `${works.length} ITEMS` })),
      el(
        'div',
        { class: 'work-grid' },
        ...works.map((work, index) =>
          el(
            'a',
            { class: 'work', href: work.href || '#/works' },
            el('div', { class: 'work__top' }, el('span', { class: 'work__no', text: String(index + 1).padStart(2, '0') }), el('span', { class: 'work__status', text: work.status || '' })),
            el('h3', { class: 'work__title', text: work.title }),
            el('p', { class: 'work__summary', text: work.summary }),
            el('div', { class: 'work__stack', text: (work.stack || []).join(' · ') })
          )
        )
      )
    )
  );
  return { el: root, destroy() {} };
}

/* ---------------- 关于 ---------------- */
export function pageAbout({ content }) {
  const { site } = content;
  const root = page(
    container(
      el('header', { class: 'page-head' }, el('h1', { text: 'ABOUT' }), el('span', { class: 'page-head__meta', text: 'FILE 00' })),
      el('div', { class: 'prose' },
        el('p', { text: `${site.name}，${site.role || ''}。` }),
        el('p', { text: site.intro }),
        el('p', { text: '这个站不是简历，也不是作品集。它是一个归档处：写下来的东西、做完的东西、还在听的东西。' })
      ),
      el('div', { class: 'about-links' }, linkList(site.links)),
      el(
        'dl',
        { class: 'kv' },
        el('dt', { text: 'STACK' }), el('dd', { text: 'Vite / 原生 JS / Three.js / Cloudflare Pages' }),
        el('dt', { text: 'TYPE' }), el('dd', { text: '静态站，无后端，无追踪脚本' }),
        el('dt', { text: 'COLOR' }), el('dd', { text: '近黑底 + 硬边 + 单一警示色' })
      )
    )
  );
  return { el: root, destroy() {} };
}

/* ---------------- 音乐 ---------------- */
export function pageMusic({ dataset, player, navigate, mode, trackId }) {
  const tabs = el('nav', { class: 'tabs', 'aria-label': '音乐视图' });
  const body = el('div', { class: 'music__body' });
  let current = null;

  const setMode = (next) => {
    if (next === 'wall') window.location.hash = '#/music';
    else window.location.hash = '#/music/library';
  };

  const wallTab = el('button', { class: 'tab', type: 'button', text: 'WALL' });
  const listTab = el('button', { class: 'tab', type: 'button', text: 'INDEX' });
  wallTab.addEventListener('click', () => setMode('wall'));
  listTab.addEventListener('click', () => setMode('index'));
  tabs.append(wallTab, listTab);

  const root = page(el('div', { class: 'music' }, tabs, body));
  root.classList.add('page--flush');

  const mount = () => {
    if (current && current.destroy) current.destroy();
    body.replaceChildren();
    if (trackId) {
      wallTab.removeAttribute('aria-current');
      listTab.setAttribute('aria-current', 'page');
      current = renderTrack({ dataset, player, trackId, navigate });
    } else if (mode === 'index') {
      wallTab.removeAttribute('aria-current');
      listTab.setAttribute('aria-current', 'page');
      current = renderLibrary({ dataset, player, openTrack: (id) => navigate(`music/track/${id}`) });
    } else {
      wallTab.setAttribute('aria-current', 'page');
      listTab.removeAttribute('aria-current');
      current = renderWall({ dataset, player, openTrack: (id) => navigate(`music/track/${id}`) });
    }
    body.append(current.el);
  };

  mount();

  return {
    el: root,
    destroy() {
      if (current && current.destroy) current.destroy();
    }
  };
}

export { formatDate };
