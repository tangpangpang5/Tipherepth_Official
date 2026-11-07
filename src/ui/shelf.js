import { el } from './dom.js';
import { openDrawer } from './drawer.js';

const STATUS_LABEL = { reading: 'READING', done: 'DONE' };
const HEIGHTS = [190, 175, 160];

function spineHeight(index) {
  return HEIGHTS[index % HEIGHTS.length];
}

function bookDrawer(book, sector) {
  openDrawer({
    kicker: `FILE ${book.id.toUpperCase()} // ${sector?.label || 'ARCHIVE'}`,
    title: book.title,
    build(body) {
      body.append(
        el('dl', { class: 'drawer__fields' },
          el('div', { class: 'drawer__field' }, el('dt', { text: 'AUTHOR' }), el('dd', { text: book.author })),
          el('div', { class: 'drawer__field' }, el('dt', { text: 'STATUS' }), el('dd', { class: `drawer__status drawer__status--${book.status}`, text: STATUS_LABEL[book.status] || book.status })),
          el('div', { class: 'drawer__field' }, el('dt', { text: 'UPDATED' }), el('dd', { text: book.updated || '—' })),
          el('div', { class: 'drawer__field' }, el('dt', { text: 'SECTOR' }), el('dd', { text: book.sector })),
        ),
      );
    },
  });
}

function spine(book, sector, index) {
  const node = el('button', {
    class: 'spine',
    type: 'button',
    title: `${book.title} // ${book.author}`,
    style: { height: `${spineHeight(index)}px`, '--tone': String(index % 3) },
    dataset: { status: book.status, id: book.id },
  },
    el('span', { class: 'spine__cap', style: { background: sector?.accent || '#7A7F84' } }),
    el('span', { class: 'spine__title', text: book.title }),
  );
  node.addEventListener('click', () => bookDrawer(book, sector));
  return node;
}

function rack(sector, books, allBooks) {
  const row = el('div', { class: 'shelf__spines' });
  books.forEach((book, index) => row.append(spine(book, sector, index)));
  return el('section', { class: 'shelf__rack' },
    el('header', { class: 'shelf__head' },
      el('span', { class: 'shelf__stamp', text: sector?.label || `SECTOR-${sector?.id || '?'}` }),
      el('span', { class: 'shelf__count', text: `${books.length} / ${allBooks.length}` }),
    ),
    row,
  );
}

export function pageShelf({ content }) {
  const sectors = content.books?.sectors || [];
  const all = content.books?.books || [];
  const sectorById = new Map(sectors.map((s) => [s.id, s]));

  const state = { status: 'all', query: '' };
  const wall = el('div', { class: 'shelf__wall' });
  const count = el('span', { class: 'shelf__status', text: '' });

  const tabs = el('nav', { class: 'tabs' });
  for (const [key, label] of [['all', 'ALL'], ['reading', 'READING'], ['done', 'DONE']]) {
    const tab = el('button', { class: 'tab', type: 'button', text: label, dataset: { key }, 'aria-current': key === 'all' ? 'page' : null });
    tab.addEventListener('click', () => {
      state.status = key;
      for (const node of tabs.querySelectorAll('.tab')) node.removeAttribute('aria-current');
      tab.setAttribute('aria-current', 'page');
      render();
    });
    tabs.append(tab);
  }

  const search = el('input', { class: 'shelf__search', type: 'search', placeholder: 'SEARCH // 书名或作者' });
  search.addEventListener('input', () => {
    state.query = search.value.trim().toLowerCase();
    render();
  });

  function render() {
    const filtered = all.filter((book) => {
      if (state.status !== 'all' && book.status !== state.status) return false;
      if (!state.query) return true;
      return `${book.title} ${book.author}`.toLowerCase().includes(state.query);
    });
    wall.replaceChildren();
    for (const sector of sectors) {
      const books = filtered.filter((book) => book.sector === sector.id);
      if (!books.length) continue;
      wall.append(rack(sector, books, all.filter((b) => b.sector === sector.id)));
    }
    if (!filtered.length) wall.append(el('p', { class: 'shelf__empty', text: 'NO RECORD' }));
    count.textContent = `${filtered.length} / ${all.length} RECORDS`;
  }

  render();

  return {
    el: el('section', { class: 'page page--shelf' },
      el('div', { class: 'container container--wide' },
        el('header', { class: 'shelf__bar' }, tabs, count, search),
        wall,
      ),
    ),
    destroy() {},
  };
}

/** 首页右列：最近在读的 3 本 + 一个空槽，点击进书架 */
export function recentBooksCard(books) {
  const list = (books || []).slice(0, 4);
  const row = el('div', { class: 'cartridges' });
  for (const book of list) {
    const item = el('a', { class: 'cartridge', href: '#/shelf' },
      el('span', { class: `cartridge__flag cartridge__flag--${book.status}` }),
      el('span', { class: 'cartridge__id', text: book.id.toUpperCase() }),
      el('span', { class: 'cartridge__title', text: book.title }),
      el('span', { class: 'cartridge__meta', text: STATUS_LABEL[book.status] || book.status }),
    );
    row.append(item);
  }
  row.append(el('a', { class: 'cartridge cartridge--empty', href: '#/shelf' },
    el('span', { class: 'cartridge__id', text: 'SLOT 04' }),
    el('span', { class: 'cartridge__title', text: 'EMPTY / RESTRICTED' }),
  ));
  return el('section', { class: 'datacard' },
    el('header', { class: 'datacard__head' },
      el('span', { class: 'datacard__idx', text: '04' }),
      el('h2', { class: 'datacard__title', text: 'LOG CARTRIDGES' }),
    ),
    row,
  );
}
