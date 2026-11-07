import { el, fmtDuration } from './dom.js';
import { coverUrl } from './cover.js';
import { activeLineIndex, loadLyrics } from '../audio/lyrics.js';

function viewShell(...children) {
  return el('section', { class: 'view' }, ...children);
}

/* ---------------- 卡带墙 ---------------- */
export function renderWall({ dataset, player, openTrack }) {
  const canvasHost = el('div', { class: 'wall__stage' });
  const indexLabel = el('div', { class: 'hud__index', text: 'ARCHIVE // 00' });
  const title = el('h2', { class: 'hud__title', text: 'NO TRACK' });
  const artist = el('div', { class: 'hud__artist', text: '—' });

  const hud = el(
    'div',
    { class: 'hud', hidden: 'hidden' },
    el('div', { class: 'hud__row' }, indexLabel, el('div', { class: 'hud__index', text: 'DRAG / WHEEL / CLICK' })),
    el('div', { class: 'hud__row' }, el('div', {}, title, artist))
  );

  const wall = el('div', { class: 'wall' }, canvasHost, hud);
  const root = viewShell(wall);

  let handle = null;
  let destroyed = false;
  const offChange = player.on('change', () => {
    const current = player.getCurrentTrack();
    if (!current) return;
    indexLabel.textContent = `ARCHIVE // ${String(current.index + 1).padStart(2, '0')}`;
    title.textContent = current.title;
    artist.textContent = `${current.artist} // ${current.album}`;
  });

  function showFallback(message) {
    canvasHost.replaceChildren(
      el('div', { class: 'wall__fallback' }, el('div', { text: message }), el('div', { text: 'PRESS L FOR LIBRARY' }))
    );
    hud.removeAttribute('hidden');
  }

  if (!dataset.tracks.length) {
    showFallback('NO TRACKS // RUN npm run scan');
    return { el: root, destroy: () => offChange() };
  }

  // 注意：相对路径从 src/ui/ 出发，所以是 ../scene/wall.js
  import('../scene/wall.js')
    .then((mod) => {
      if (destroyed) return;
      handle = mod.mountWall({
        container: canvasHost,
        tracks: dataset.tracks,
        startIndex: Math.max(0, player.getCurrentIndex()),
        onSelect(index) {
          player.playIndex(index, { autoplay: true });
          const track = dataset.tracks[index];
          if (track) openTrack(track.id);
        },
        onFocus(index) {
          const track = dataset.tracks[index];
          if (!track) return;
          indexLabel.textContent = `ARCHIVE // ${String(index + 1).padStart(2, '0')}`;
          title.textContent = track.title;
          artist.textContent = `${track.artist} // ${track.album}`;
        }
      });
      hud.removeAttribute('hidden');
    })
    .catch((error) => {
      console.warn('[wall] 3D 不可用，回退 2D：', error);
      showFallback('3D UNAVAILABLE // 2D FALLBACK');
    });

  return {
    el: root,
    destroy() {
      destroyed = true;
      offChange();
      if (handle) handle.dispose();
    }
  };
}

/* ---------------- 列表 ---------------- */
export function renderLibrary({ dataset, player, openTrack }) {
  const rows = el('ul', { class: 'list' });
  let query = '';

  function paint() {
    const keyword = query.trim().toLowerCase();
    const entries = dataset.tracks.map((track, index) => ({ track, index }));
    const visible = keyword
      ? entries.filter(({ track }) => `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(keyword))
      : entries;

    rows.replaceChildren(
      ...visible.map(({ track, index }) => {
        const row = el(
          'li',
          {
            class: 'row',
            tabindex: '0',
            dataset: { index: String(index) },
            'aria-current': player.getCurrentIndex() === index ? 'true' : 'false'
          },
          el('span', { class: 'row__no', text: String(index + 1).padStart(3, '0') }),
          el('img', { class: 'row__cover', src: coverUrl(track, 96), alt: '', loading: 'lazy' }),
          el(
            'div',
            { class: 'row__main' },
            el('div', { class: 'row__title', text: track.title }),
            el('div', { class: 'row__sub', text: `${track.artist} — ${track.album}` })
          ),
          el('span', { class: 'row__dur', text: fmtDuration(track.durationMs) }),
          el('span', { class: 'row__accent', style: { background: track.accent || 'var(--hazard)' } })
        );

        row.addEventListener('click', () => {
          player.playIndex(index, { autoplay: true });
          highlight(index);
        });
        row.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            player.playIndex(index, { autoplay: true });
            openTrack(track.id);
          }
        });
        return row;
      })
    );

    if (!visible.length) rows.append(el('li', { class: 'empty', text: 'NO MATCH' }));
  }

  function highlight(index) {
    for (const row of rows.children) {
      if (row.dataset && row.dataset.index === String(index)) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    }
  }

  const input = el('input', {
    type: 'search',
    placeholder: 'SEARCH // 标题 / 艺术家 / 专辑',
    'aria-label': '搜索曲目'
  });
  input.addEventListener('input', () => {
    query = input.value;
    paint();
  });

  const root = viewShell(
    el(
      'header',
      { class: 'view-head' },
      el('h1', { text: 'ARCHIVE INDEX' }),
      el('span', { class: 'view-head__count', text: `${dataset.tracks.length} TRACKS` })
    ),
    el('div', { class: 'search' }, el('span', { class: 'hud__index', text: '>' }), input),
    rows
  );

  paint();
  return { el: root, destroy() {} };
}

/* ---------------- 曲目详情 ---------------- */
export function renderTrack({ dataset, player, trackId, navigate }) {
  const track = dataset.tracks.find((item) => item.id === trackId) || null;
  if (!track) {
    return { el: viewShell(el('div', { class: 'empty', text: 'TRACK NOT FOUND' })), destroy() {} };
  }

  const lyricsBox = el('div', { class: 'lyrics' }, el('div', { class: 'lyrics__empty', text: 'NO LYRIC DATA' }));
  let lines = null;
  let lineNodes = [];
  let active = -1;

  function markActive(index) {
    if (index === active) return;
    active = index;
    lineNodes.forEach((node, i) => node.setAttribute('data-active', i === index ? 'true' : 'false'));
    const node = lineNodes[index];
    if (node && node.scrollIntoView) node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  const offTime = player.on('time', (detail) => {
    if (!lines || player.getCurrentTrack()?.id !== track.id) return;
    markActive(activeLineIndex(lines, detail.currentTime || 0));
  });

  loadLyrics(track).then((result) => {
    lines = result;
    if (!lines || !lines.length) return;
    lineNodes = lines.map((line) => el('div', { class: 'lyrics__line', text: line.text }));
    lyricsBox.replaceChildren(...lineNodes);
  });

  const playButton = el('button', {
    class: 'btn',
    type: 'button',
    text: player.getCurrentTrack()?.id === track.id && player.getState().playing ? '❚❚ PAUSE' : '▶ PLAY'
  });
  playButton.addEventListener('click', () => {
    if (player.getCurrentTrack()?.id === track.id) {
      player.toggle();
      return;
    }
    player.playIndex(dataset.tracks.indexOf(track), { autoplay: true });
  });

  const backButton = el('button', { class: 'btn', type: 'button', text: 'BACK TO INDEX' });
  backButton.addEventListener('click', () => navigate('library'));

  const kv = el(
    'dl',
    { class: 'track__kv' },
    el('dt', { text: 'ALBUM' }), el('dd', { text: track.album }),
    el('dt', { text: 'YEAR' }), el('dd', { text: track.year ? String(track.year) : '—' }),
    el('dt', { text: 'DURATION' }), el('dd', { text: fmtDuration(track.durationMs) }),
    el('dt', { text: 'CODEC' }), el('dd', { text: track.codec || (track.lossless ? 'LOSSLESS' : 'UNKNOWN') }),
    el('dt', { text: 'META' }), el('dd', { text: track.metaSource === 'tags' ? 'TAGS' : 'FROM FILENAME' })
  );

  const root = viewShell(
    el(
      'div',
      { class: 'track' },
      el('img', { class: 'track__cover', src: coverUrl(track, 512), alt: `${track.title} 封面` }),
      el(
        'div',
        { class: 'track__meta' },
        el('div', { class: 'track__artist', text: track.artist }),
        el('h1', { text: track.title }),
        el('div', { style: { display: 'flex', gap: '8px', margin: '12px 0' } }, playButton, backButton),
        kv,
        lyricsBox
      )
    )
  );

  return {
    el: root,
    destroy() {
      offTime();
    }
  };
}
