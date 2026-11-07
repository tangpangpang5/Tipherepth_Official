import { clamp, el, fmtTime } from './dom.js';
import { coverUrl } from './cover.js';

const MODE_LABEL = { sequential: 'SEQ', shuffle: 'RND', 'repeat-one': 'ONE' };
const MODE_ORDER = ['sequential', 'shuffle', 'repeat-one'];

export function createPlayerBar({ player }) {
  const cover = el('div', { class: 'player__cover chamfer' });
  const title = el('div', { class: 'player__title', text: 'NO TRACK' });
  const artist = el('div', { class: 'player__artist', text: '—' });

  const prevBtn = el('button', { class: 'btn', type: 'button', title: '上一首 (Shift+←)', text: '|◀' });
  const playBtn = el('button', { class: 'btn btn--play', type: 'button', title: '播放 / 暂停 (空格)', text: '▶' });
  const nextBtn = el('button', { class: 'btn', type: 'button', title: '下一首 (Shift+→)', text: '▶|' });
  const modeBtn = el('button', { class: 'btn', type: 'button', title: '播放模式', text: 'SEQ' });

  const curTime = el('span', { class: 'progress__time', text: '--:--' });
  const durTime = el('span', { class: 'progress__time', text: '--:--' });
  const fill = el('div', { class: 'progress__fill' });
  const track = el('div', { class: 'progress__track chamfer' }, fill);

  const volFill = el('div', { class: 'volume__fill' });
  const vol = el('div', { class: 'volume' }, volFill);

  const root = el(
    'footer',
    { class: 'player' },
    el('div', { class: 'player__now' }, cover, el('div', { class: 'player__meta' }, title, artist)),
    el(
      'div',
      { class: 'player__center' },
      el('div', { class: 'transport' }, prevBtn, playBtn, nextBtn, modeBtn),
      el('div', { class: 'progress' }, curTime, track, durTime)
    ),
    el('div', { class: 'player__right' }, vol)
  );

  function updateTrack() {
    const current = player.getCurrentTrack();
    if (!current) {
      title.textContent = 'NO TRACK';
      artist.textContent = '—';
      cover.style.backgroundImage = '';
      return;
    }
    title.textContent = current.title;
    artist.textContent = `${current.artist} // ${current.album}`;
    cover.style.backgroundImage = `url("${coverUrl(current, 96)}")`;
    cover.style.backgroundSize = 'cover';
    document.documentElement.style.setProperty('--accent', current.accent || '#E8B10A');
  }

  function updateState() {
    const state = player.getState();
    playBtn.textContent = state.playing ? '❚❚' : '▶';
    playBtn.dataset.state = state.playing ? 'playing' : 'paused';
    playBtn.disabled = !player.getCurrentTrack();
    prevBtn.disabled = !player.getCurrentTrack();
    nextBtn.disabled = !player.getCurrentTrack();
    modeBtn.textContent = MODE_LABEL[state.mode] || 'SEQ';
    volFill.style.width = `${Math.round(state.volume * 100)}%`;
    if (state.error) {
      artist.textContent = state.error;
    }
  }

  function updateTime(detail) {
    const duration = detail?.duration ?? player.getState().duration ?? 0;
    const current = detail?.currentTime ?? player.getState().currentTime ?? 0;
    curTime.textContent = fmtTime(current);
    durTime.textContent = fmtTime(duration);
    const ratio = duration > 0 ? clamp(current / duration, 0, 1) : 0;
    fill.style.width = `${(ratio * 100).toFixed(2)}%`;
  }

  function bindScrub(node, handler) {
    let dragging = false;
    const apply = (event) => {
      const rect = node.getBoundingClientRect();
      if (!rect.width) return;
      handler(clamp((event.clientX - rect.left) / rect.width, 0, 1));
    };
    node.addEventListener('pointerdown', (event) => {
      dragging = true;
      node.setPointerCapture?.(event.pointerId);
      apply(event);
    });
    node.addEventListener('pointermove', (event) => {
      if (dragging) apply(event);
    });
    node.addEventListener('pointerup', (event) => {
      dragging = false;
      node.releasePointerCapture?.(event.pointerId);
    });
    node.addEventListener('pointercancel', () => {
      dragging = false;
    });
  }

  prevBtn.addEventListener('click', () => player.prev());
  nextBtn.addEventListener('click', () => player.next({}));
  playBtn.addEventListener('click', () => player.toggle());
  modeBtn.addEventListener('click', () => {
    const current = player.getMode();
    const index = MODE_ORDER.indexOf(current);
    player.setMode(MODE_ORDER[(index + 1) % MODE_ORDER.length]);
  });

  bindScrub(track, (ratio) => {
    const duration = player.getState().duration || 0;
    if (duration > 0) player.seek(ratio * duration);
  });

  bindScrub(vol, (ratio) => player.setVolume(ratio));

  const offChange = player.on('change', updateTrack);
  const offState = player.on('state', () => {
    updateState();
    updateTrack();
  });
  const offTime = player.on('time', updateTime);

  updateTrack();
  updateState();
  updateTime({});

  return {
    el: root,
    destroy() {
      offChange();
      offState();
      offTime();
    }
  };
}
