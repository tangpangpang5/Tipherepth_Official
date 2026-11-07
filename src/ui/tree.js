import { el, fmtDuration } from './dom.js';
import { loadLyrics, activeLineIndex } from '../audio/lyrics.js';

/**
 * 逆卡巴拉生命树（Qliphoth）布局。
 * 坐标来自《Lobotomy Corporation》设施的三层世界：
 * Asiyah（控制/情报/培训/安保）在上，Briah（中央本部/惩戒/福利）在中，
 * Atziluth（提取/记录/构筑）在下。参考：
 * - https://lobotomycorporation.wiki.gg/wiki/Departments
 * - https://lobotomycorporation.wiki.gg/wiki/Sephirah
 */
export const DEPARTMENTS = [
  { id: 'malkuth', roman: 'I', code: 'MALKUTH', cn: '控制部', en: 'CONTROL TEAM', layer: 'ASIYAH', x: 50, y: 0, accent: '#7FB4C9' },
  { id: 'yesod', roman: 'II', code: 'YESOD', cn: '情报部', en: 'INFORMATION TEAM', layer: 'ASIYAH', x: 50, y: 18, accent: '#4A90A4' },
  { id: 'hod', roman: 'III', code: 'HOD', cn: '培训部', en: 'TRAINING TEAM', layer: 'ASIYAH', x: 16, y: 18, accent: '#8E7CC3' },
  { id: 'netzach', roman: 'IV', code: 'NETZACH', cn: '安保部', en: 'SAFETY TEAM', layer: 'ASIYAH', x: 84, y: 18, accent: '#6E8B74' },
  { id: 'geburah', roman: 'V', code: 'GEBURAH', cn: '惩戒部', en: 'DISCIPLINARY TEAM', layer: 'BRIAH', x: 16, y: 39, accent: '#C8102E' },
  { id: 'tiphereth', roman: 'VI', code: 'TIPHERETH', cn: '中央本部', en: 'CENTRAL COMMAND', layer: 'BRIAH', x: 50, y: 39, accent: '#E8B10A' },
  { id: 'chesed', roman: 'VII', code: 'CHESED', cn: '福利部', en: 'WELFARE TEAM', layer: 'BRIAH', x: 84, y: 39, accent: '#2E7D5B' },
  { id: 'binah', roman: 'VIII', code: 'BINAH', cn: '提取部', en: 'EXTRACTION TEAM', layer: 'ATZILUTH', x: 32, y: 61, accent: '#6E6A9C' },
  { id: 'hokma', roman: 'IX', code: 'HOKMA', cn: '记录部', en: 'RECORD TEAM', layer: 'ATZILUTH', x: 68, y: 61, accent: '#7A7F84' },
  { id: 'keter', roman: 'X', code: 'KETER', cn: '构筑部', en: 'ARCHITECTURE TEAM', layer: 'ATZILUTH', x: 50, y: 83, accent: '#CFCFC4' },
];

const EDGES = [
  ['malkuth', 'yesod'],
  ['yesod', 'hod'],
  ['yesod', 'netzach'],
  ['hod', 'geburah'],
  ['netzach', 'chesed'],
  ['geburah', 'tiphereth'],
  ['chesed', 'tiphereth'],
  ['tiphereth', 'binah'],
  ['tiphereth', 'hokma'],
  ['binah', 'keter'],
  ['hokma', 'keter'],
];

const LAYERS = [
  { id: 'ASIYAH', y: 6 },
  { id: 'BRIAH', y: 30 },
  { id: 'ATZILUTH', y: 55 },
];

const byId = new Map(DEPARTMENTS.map((d) => [d.id, d]));

function normalize(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/TEAM|部|TEAM\s*/g, '')
    .replace(/[^A-Z0-9\u4e00-\u9fa5]/g, '')
    .trim();
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

function linePath(a, b) {
  const d = byId.get(a);
  const to = byId.get(b);
  return `M ${d.x} ${d.y + 3} L ${to.x} ${to.y}`;
}

function trackRow(track, player) {
  const button = el(
    'button',
    { class: 'track', type: 'button', dataset: { id: track.id }, title: `${track.title} // ${track.album}` },
    el('span', { class: 'track__no', text: String((track.trackNo ?? track.index + 1)).padStart(2, '0') }),
    el('span', { class: 'track__title', text: track.title }),
    el('span', { class: 'track__dur', text: fmtDuration(track.durationMs) }),
  );
  button.addEventListener('click', () => player.playIndex(track.index, { autoplay: true }));
  return el('li', { class: 'node__row' }, button);
}

function deptNode(dept, tracks, player) {
  const node = el('article', { class: 'node', dataset: { dept: dept.id }, style: { '--x': `${dept.x}%`, '--y': `${dept.y}%`, '--accent': dept.accent } });
  node.append(
    el('header', { class: 'node__head' },
      el('span', { class: 'node__roman', text: dept.roman }),
      el('span', { class: 'node__code', text: dept.code }),
      el('span', { class: 'node__cn', text: dept.cn }),
      el('span', { class: 'node__en', text: dept.en }),
    ),
  );
  const list = el('ul', { class: 'node__tracks' });
  if (tracks.length) for (const track of tracks) list.append(trackRow(track, player));
  else list.append(el('li', { class: 'node__row node__row--empty' }, el('span', { class: 'node__empty', text: 'NO RECORD' })));
  node.append(list);
  node.append(el('footer', { class: 'node__foot' }, el('span', { text: `${tracks.length} TRACK${tracks.length === 1 ? '' : 'S'}` })));
  return node;
}

function renderTree(container, groups, player) {
  const tree = el('div', { class: 'tree' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'tree__lines');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  for (const [a, b] of EDGES) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', linePath(a, b));
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(path);
  }
  tree.append(svg);
  for (const layer of LAYERS) {
    tree.append(el('div', { class: 'tree__layer', style: { '--y': `${layer.y}%` }, text: layer.id }));
  }
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
    if (tracks.length) for (const track of tracks) list.append(trackRow(track, player));
    else list.append(el('li', { class: 'node__row node__row--empty' }, el('span', { class: 'node__empty', text: 'NO RECORD' })));
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
    for (const track of unfiled) list.append(trackRow(track, player));
    section.append(list);
    wrap.append(section);
  }
  container.append(wrap);
}

export function pageMusic({ dataset, player, mode = 'wall', trackId }) {
  const tracks = dataset?.tracks || [];
  const { groups, unfiled } = groupTracks(tracks);
  const total = tracks.length;

  const view = el('div', { class: 'musicview' });
  const status = el('span', { class: 'tree__status', text: `${DEPARTMENTS.length} DEPARTMENTS // ${total} TRACKS` });

  const tabs = el('nav', { class: 'tabs', 'aria-label': '视图' },
    el('a', { class: 'tab', href: '#/music', text: 'TREE', 'aria-current': mode === 'index' ? null : 'page' }),
    el('a', { class: 'tab', href: '#/music/library', text: 'INDEX', 'aria-current': mode === 'index' ? 'page' : null }),
  );

  const lyricsToggle = el('button', { class: 'btn', type: 'button', text: 'LYRICS' });
  const lyricsBody = el('div', { class: 'lyrics__body' });
  const lyricsPanel = el('aside', { class: 'lyrics', hidden: true },
    el('header', { class: 'lyrics__head' }, el('span', { text: 'LYRICS' }), el('button', { class: 'lyrics__close', type: 'button', text: '×' })),
    lyricsBody,
  );

  const page = el('section', { class: 'page page--music' },
    el('div', { class: 'container container--wide' },
      el('header', { class: 'tree__bar' }, tabs, status, lyricsToggle),
      view,
    ),
    lyricsPanel,
  );

  if (mode === 'index') renderList(view, groups, unfiled, player);
  else renderTree(view, groups, player);

  function syncPlaying() {
    const current = player.getCurrentTrack();
    const state = player.getState();
    for (const node of page.querySelectorAll('.track')) {
      if (current && node.dataset.id === current.id) node.setAttribute('aria-current', 'true');
      else node.removeAttribute('aria-current');
      node.classList.toggle('track--playing', Boolean(current && node.dataset.id === current.id && state.playing));
    }
    if (trackId) {
      const target = page.querySelector(`.track[data-id="${CSS.escape(trackId)}"]`);
      if (target && !syncPlaying.done) {
        syncPlaying.done = true;
        target.closest('.node, .deptlist__group')?.classList.add('node--focus');
      }
    }
  }

  /* 歌词：只给当前曲目 */
  let lines = [];
  let lyricsFor = null;
  let activeIndex = -1;
  const closeLyrics = () => { lyricsPanel.hidden = true; };
  lyricsPanel.querySelector('.lyrics__close').addEventListener('click', closeLyrics);

  function renderLyrics() {
    lyricsBody.replaceChildren();
    if (!lines.length) {
      lyricsBody.append(el('p', { class: 'lyrics__empty', text: 'NO LYRICS' }));
      return;
    }
    lines.forEach((line, index) => {
      lyricsBody.append(el('p', { class: 'lyrics__line', dataset: { i: String(index) }, text: line.text }));
    });
  }

  async function loadCurrentLyrics() {
    const track = player.getCurrentTrack();
    if (!track || track.id === lyricsFor) return;
    lyricsFor = track.id;
    lines = [];
    activeIndex = -1;
    renderLyrics();
    const parsed = await loadLyrics(track);
    if (lyricsFor !== track.id) return;
    lines = parsed || [];
    renderLyrics();
  }

  lyricsToggle.addEventListener('click', () => {
    lyricsPanel.hidden = !lyricsPanel.hidden;
    if (!lyricsPanel.hidden) loadCurrentLyrics();
  });

  const offChange = player.on('change', () => {
    syncPlaying();
    if (!lyricsPanel.hidden) loadCurrentLyrics();
  });
  const offState = player.on('state', syncPlaying);
  const offTime = player.on('time', (detail) => {
    if (lyricsPanel.hidden || !lines.length) return;
    const next = activeLineIndex(lines, detail?.currentTime ?? 0);
    if (next === activeIndex) return;
    activeIndex = next;
    for (const node of lyricsBody.querySelectorAll('.lyrics__line[data-active]')) node.removeAttribute('data-active');
    const node = lyricsBody.querySelector(`.lyrics__line[data-i="${next}"]`);
    if (node) {
      node.setAttribute('data-active', 'true');
      node.scrollIntoView({ block: 'center' });
    }
  });

  syncPlaying();

  return {
    el: page,
    destroy() {
      offChange();
      offState();
      offTime();
    },
  };
}
