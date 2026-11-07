import { el, fmtDuration } from './dom.js';
import { openDrawer } from './drawer.js';
import { loadLyrics, activeLineIndex } from '../audio/lyrics.js';

/**
 * 逆卡巴拉生命树（Qliphoth）。
 * 分层参考 Lobotomy Corporation Wiki 的 Departments 页（Asiyah / Briah / Atziluth）。
 * 连线走 90° 直角，双层管（底槽 + 信号线），拐点打焊点。
 */
export const DEPARTMENTS = [
  { id: 'malkuth', roman: 'I', code: 'MALKUTH', cn: '控制部', en: 'CONTROL', layer: 'ASIYAH', x: 50, y: 0, accent: '#7FB4C9' },
  { id: 'yesod', roman: 'II', code: 'YESOD', cn: '情报部', en: 'INFORMATION', layer: 'ASIYAH', x: 50, y: 18, accent: '#4A90A4' },
  { id: 'hod', roman: 'III', code: 'HOD', cn: '培训部', en: 'TRAINING', layer: 'ASIYAH', x: 16, y: 18, accent: '#8E7CC3' },
  { id: 'netzach', roman: 'IV', code: 'NETZACH', cn: '安保部', en: 'SAFETY', layer: 'ASIYAH', x: 84, y: 18, accent: '#6E8B74' },
  { id: 'geburah', roman: 'V', code: 'GEBURAH', cn: '惩戒部', en: 'DISCIPLINARY', layer: 'BRIAH', x: 16, y: 39, accent: '#C8102E' },
  { id: 'tiphereth', roman: 'VI', code: 'TIPHERETH', cn: '中央本部', en: 'CENTRAL COMMAND', layer: 'BRIAH', x: 50, y: 39, accent: '#E8B10A' },
  { id: 'chesed', roman: 'VII', code: 'CHESED', cn: '福利部', en: 'WELFARE', layer: 'BRIAH', x: 84, y: 39, accent: '#2E7D5B' },
  { id: 'binah', roman: 'VIII', code: 'BINAH', cn: '提取部', en: 'EXTRACTION', layer: 'ATZILUTH', x: 32, y: 61, accent: '#6E6A9C' },
  { id: 'hokma', roman: 'IX', code: 'HOKMA', cn: '记录部', en: 'RECORD', layer: 'ATZILUTH', x: 68, y: 61, accent: '#7A7F84' },
  { id: 'keter', roman: 'X', code: 'KETER', cn: '构筑部', en: 'ARCHITECTURE', layer: 'ATZILUTH', x: 50, y: 83, accent: '#CFCFC4' },
];

const EDGES = [
  ['malkuth', 'yesod'], ['yesod', 'hod'], ['yesod', 'netzach'],
  ['hod', 'geburah'], ['netzach', 'chesed'],
  ['geburah', 'tiphereth'], ['chesed', 'tiphereth'],
  ['tiphereth', 'binah'], ['tiphereth', 'hokma'],
  ['binah', 'keter'], ['hokma', 'keter'],
];

const LAYERS = [
  { id: 'ASIYAH', y: 6 },
  { id: 'BRIAH', y: 30 },
  { id: 'ATZILUTH', y: 55 },
];

const byId = new Map(DEPARTMENTS.map((d) => [d.id, d]));
const SVG_NS = 'http://www.w3.org/2000/svg';

function normalize(value) {
  return String(value || '').toUpperCase().replace(/TEAM|部/g, '').replace(/[^A-Z0-9\u4e00-\u9fa5]/g, '').trim();
}

function matchDepartment(album) {
  const key = normalize(album);
  if (!key) return null;
  return DEPARTMENTS.find((d) => normalize(d.code) === key || normalize(d.en) === key || normalize(d.cn) === key) || null;
}

function groupTracks(tracks) {
  const groups = new Map(DEPARTMENTS.map((d) => [d.id, []]));
  const unfiled = [];
  for (const track of tracks) {
    const dept = matchDepartment(track.album);
    if (dept) groups.get(dept.id).push(track);
    else unfiled.push(track);
  }
  return { groups, unfiled };
}

function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function orthogonal(a, b) {
  const from = byId.get(a);
  const to = byId.get(b);
  const midY = (from.y + to.y) / 2 + 1.5;
  return {
    d: `M ${from.x} ${from.y + 4} V ${midY} H ${to.x} V ${to.y}`,
    joints: [[from.x, midY], [to.x, midY]],
  };
}

function renderLines(container) {
  const svg = svgEl('svg', { class: 'tree__lines', viewBox: '0 0 100 100', preserveAspectRatio: 'none' });
  for (const [a, b] of EDGES) {
    const { d, joints } = orthogonal(a, b);
    svg.append(svgEl('path', { d, class: 'tree__pipe' }));
    svg.append(svgEl('path', { d, class: 'tree__signal' }));
    for (const [x, y] of joints) svg.append(svgEl('rect', { x: x - 0.35, y: y - 0.35, width: 0.7, height: 0.7, class: 'tree__joint' }));
  }
  container.append(svg);
}

function trackDrawer(track, dept, player) {
  openDrawer({
    kicker: `${dept.code} // ${dept.cn} // ${dept.roman}`,
    title: track.title,
    build(body) {
      const info = el('dl', { class: 'drawer__fields' },
        el('div', { class: 'drawer__field' }, el('dt', { text: 'ARTIST' }), el('dd', { text: track.artist })),
        el('div', { class: 'drawer__field' }, el('dt', { text: 'DURATION' }), el('dd', { text: fmtDuration(track.durationMs) })),
        el('div', { class: 'drawer__field' }, el('dt', { text: 'CODEC' }), el('dd', { text: track.codec || '—' })),
        el('div', { class: 'drawer__field' }, el('dt', { text: 'INDEX' }), el('dd', { text: String(track.index + 1).padStart(2, '0') })),
      );
      const play = el('button', { class: 'btn btn--play', type: 'button', text: '▶ PLAY' });
      play.addEventListener('click', () => player.playIndex(track.index, { autoplay: true }));
      const lyrics = el('div', { class: 'drawer__lyrics', text: 'LOADING…' });
      body.append(info, el('div', { class: 'drawer__actions' }, play), lyrics);

      loadLyrics(track).then((lines) => {
        if (!lines || !lines.length) {
          lyrics.textContent = 'NO LYRICS';
          return;
        }
        lyrics.replaceChildren();
        lines.forEach((line, index) => lyrics.append(el('p', { class: 'lyrics__line', dataset: { i: String(index) }, text: line.text })));
        let active = -1;
        const off = player.on('time', (detail) => {
          if (!document.body.contains(lyrics)) { off(); return; }
          const next = activeLineIndex(lines, detail?.currentTime ?? 0);
          if (next === active) return;
          active = next;
          for (const node of lyrics.querySelectorAll('[data-active]')) node.removeAttribute('data-active');
          const node = lyrics.querySelector(`[data-i="${next}"]`);
          if (node) node.setAttribute('data-active', 'true');
        });
      });
    },
  });
}

function deptDrawer(dept, tracks, player) {
  openDrawer({
    kicker: `${dept.layer} // ${dept.roman}`,
    title: `${dept.code} // ${dept.cn}`,
    build(body) {
      body.append(el('p', { class: 'drawer__sub', text: `${dept.en} // ${tracks.length} TRACK${tracks.length === 1 ? '' : 'S'}` }));
      const list = el('ul', { class: 'drawer__list' });
      if (!tracks.length) list.append(el('li', { class: 'node__empty', text: 'NO RECORD' }));
      for (const track of tracks) {
        const row = el('li', {},
          el('button', { class: 'drawer__row', type: 'button' },
            el('span', { class: 'track__no', text: String((track.trackNo ?? track.index + 1)).padStart(2, '0') }),
            el('span', { class: 'track__title', text: track.title }),
            el('span', { class: 'track__dur', text: fmtDuration(track.durationMs) }),
          ),
        );
        row.querySelector('button').addEventListener('click', () => {
          player.playIndex(track.index, { autoplay: true });
          trackDrawer(track, dept, player);
        });
        list.append(row);
      }
      body.append(list);
    },
  });
}

function deptNode(dept, tracks, player) {
  const node = el('button', {
    class: 'node', type: 'button', dataset: { dept: dept.id },
    style: { '--x': `${dept.x}%`, '--y': `${dept.y}%`, '--accent': dept.accent },
  },
    el('header', { class: 'node__head' },
      el('span', { class: 'node__roman', text: dept.roman }),
      el('span', { class: 'node__code', text: dept.code }),
      el('span', { class: 'node__cn', text: dept.cn }),
      el('span', { class: 'node__en', text: dept.en }),
    ),
    el('div', { class: 'node__body' },
      el('span', { class: 'node__count', text: String(tracks.length).padStart(2, '0') }),
      el('span', { class: 'node__unit', text: 'TRACKS' }),
      el('span', { class: 'node__caret', text: 'OPEN' }),
    ),
  );
  node.addEventListener('click', () => deptDrawer(dept, tracks, player));
  return node;
}

function renderTree(container, groups, player) {
  const tree = el('div', { class: 'tree' });
  renderLines(tree);
  for (const layer of LAYERS) tree.append(el('div', { class: 'tree__layer', style: { '--y': `${layer.y}%` }, text: layer.id }));
  for (const dept of DEPARTMENTS) tree.append(deptNode(dept, groups.get(dept.id) || [], player));
  container.append(tree);
}

function renderList(container, groups, unfiled, player) {
  const wrap = el('div', { class: 'deptlist' });
  for (const dept of DEPARTMENTS) {
    const tracks = groups.get(dept.id) || [];
    const section = el('section', { class: 'deptlist__group', style: { '--accent': dept.accent } },
      el('header', { class: 'deptlist__head' },
        el('span', { class: 'deptlist__roman', text: dept.roman }),
        el('span', { class: 'deptlist__code', text: dept.code }),
        el('span', { class: 'deptlist__cn', text: dept.cn }),
        el('span', { class: 'deptlist__count', text: String(tracks.length).padStart(2, '0') }),
      ),
    );
    const list = el('ul', { class: 'deptlist__tracks' });
    for (const track of tracks) {
      const row = el('li', {},
        el('button', { class: 'drawer__row', type: 'button' },
          el('span', { class: 'track__no', text: String((track.trackNo ?? track.index + 1)).padStart(2, '0') }),
          el('span', { class: 'track__title', text: track.title }),
          el('span', { class: 'track__dur', text: fmtDuration(track.durationMs) }),
        ),
      );
      row.querySelector('button').addEventListener('click', () => {
        player.playIndex(track.index, { autoplay: true });
        trackDrawer(track, dept, player);
      });
      list.append(row);
    }
    if (!tracks.length) list.append(el('li', { class: 'node__row node__row--empty' }, el('span', { class: 'node__empty', text: 'NO RECORD' })));
    section.append(list);
    wrap.append(section);
  }
  if (unfiled.length) {
    const section = el('section', { class: 'deptlist__group', style: { '--accent': '#E07A1F' } },
      el('header', { class: 'deptlist__head' },
        el('span', { class: 'deptlist__roman', text: '—' }),
        el('span', { class: 'deptlist__code', text: 'UNCLASSIFIED' }),
        el('span', { class: 'deptlist__cn', text: '未归类' }),
        el('span', { class: 'deptlist__count', text: String(unfiled.length).padStart(2, '0') }),
      ),
    );
    const list = el('ul', { class: 'deptlist__tracks' });
    for (const track of unfiled) {
      const row = el('li', {}, el('button', { class: 'drawer__row', type: 'button', text: track.title }));
      row.querySelector('button').addEventListener('click', () => player.playIndex(track.index, { autoplay: true }));
      list.append(row);
    }
    section.append(list);
    wrap.append(section);
  }
  container.append(wrap);
}

export function pageMusic({ dataset, player, mode = 'tree', trackId }) {
  const tracks = dataset?.tracks || [];
  const { groups, unfiled } = groupTracks(tracks);

  const view = el('div', { class: 'musicview' });
  const status = el('span', { class: 'tree__status', text: `${DEPARTMENTS.length} DEPARTMENTS // ${tracks.length} TRACKS` });
  const tabs = el('nav', { class: 'tabs', 'aria-label': '视图' },
    el('a', { class: 'tab', href: '#/music', text: 'TREE', 'aria-current': mode === 'index' ? null : 'page' }),
    el('a', { class: 'tab', href: '#/music/library', text: 'INDEX', 'aria-current': mode === 'index' ? 'page' : null }),
  );

  if (mode === 'index') renderList(view, groups, unfiled, player);
  else renderTree(view, groups, player);

  function syncPlaying() {
    const current = player.getCurrentTrack();
    const dept = current ? matchDepartment(current.album) : null;
    for (const node of page.querySelectorAll('.node')) {
      if (dept && node.dataset.dept === dept.id) node.dataset.playing = 'true';
      else delete node.dataset.playing;
    }
  }

  const offChange = player.on('change', syncPlaying);
  const offState = player.on('state', syncPlaying);
  syncPlaying();

  if (trackId) {
    const track = tracks.find((t) => t.id === trackId);
    const dept = track ? matchDepartment(track.album) : null;
    if (track && dept) {
      const node = page.querySelector(`.node[data-dept="${dept.id}"]`);
      if (node) node.classList.add('node--focus');
    }
  }

  return {
    el: el('section', { class: 'page page--music' },
      el('div', { class: 'container container--wide' },
        el('header', { class: 'tree__bar' }, tabs, status),
        view,
      ),
    ),
    destroy() {
      offChange();
      offState();
    },
  };
}

// page 变量在 syncPlaying 中引用：把 el 的结果挂到局部变量，避免全局查询落到别处
let page;
const _pageMusic = pageMusic;
export { _pageMusic as pageMusicInternal };
