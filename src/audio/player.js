import { audioCandidates } from '../data.js';

const STORAGE_KEY = 'tiphereth:player';

function readStored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeStored(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* 隐私模式下忽略 */
  }
}

/**
 * 播放内核：一个 <audio> + 音量淡入淡出 + 队列 + 本地持久化。
 * 不依赖 Web Audio：切歌用 volume 斜坡，避免额外权限与兼容问题。
 */
export function createPlayer() {
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = 0.8;

  const listeners = new Map();
  let tracks = [];
  let currentIndex = -1;
  let mode = 'sequential';
  let fadeHandle = 0;
  let pendingAutoplay = false;
  let sourceCandidates = [];
  let sourceCursor = 0;

  const state = {
    playing: false,
    currentTime: 0,
    duration: 0,
    available: false,
    error: null
  };

  function emit(type, detail = {}) {
    for (const fn of listeners.get(type) || []) fn(detail, api);
  }

  function on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => listeners.get(type).delete(fn);
  }

  function persist() {
    writeStored({
      id: currentTrack()?.id || null,
      mode,
      volume: audio.volume,
      position: state.currentTime || 0
    });
  }

  function currentTrack() {
    return tracks[currentIndex] || null;
  }

  function fadeTo(target, ms = 180) {
    cancelAnimationFrame(fadeHandle);
    const from = audio.volume;
    const started = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - started) / ms);
      audio.volume = Math.max(0, Math.min(1, from + (target - from) * t));
      if (t < 1) fadeHandle = requestAnimationFrame(step);
    };
    fadeHandle = requestAnimationFrame(step);
  }

  function tryNextSource() {
    sourceCursor += 1;
    if (sourceCursor >= sourceCandidates.length) {
      state.available = false;
      state.playing = false;
      state.error = 'SIGNAL LOST';
      emit('error', { message: state.error });
      emit('state');
      return;
    }
    loadSource(sourceCandidates[sourceCursor]);
  }

  function loadSource(url) {
    audio.src = url;
    state.error = null;
    state.available = true;
    audio.load();
    if (pendingAutoplay) {
      pendingAutoplay = false;
      attemptPlay();
    }
  }

  function attemptPlay() {
    const promise = audio.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch((error) => {
        state.playing = false;
        state.error = error?.name === 'NotAllowedError' ? 'CLICK TO PLAY' : 'PLAYBACK ERROR';
        emit('state');
      });
    }
  }

  audio.addEventListener('timeupdate', () => {
    state.currentTime = audio.currentTime || 0;
    emit('time', { currentTime: state.currentTime, duration: state.duration });
  });

  audio.addEventListener('loadedmetadata', () => {
    state.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    emit('time', { currentTime: state.currentTime, duration: state.duration });
  });

  audio.addEventListener('play', () => {
    state.playing = true;
    emit('state');
  });

  audio.addEventListener('pause', () => {
    state.playing = false;
    emit('state');
  });

  audio.addEventListener('ended', () => {
    if (mode === 'repeat-one') {
      audio.currentTime = 0;
      attemptPlay();
      return;
    }
    next({ automatic: true });
  });

  audio.addEventListener('error', () => {
    if (audio.src) tryNextSource();
  });

  function playIndex(index, options = {}) {
    if (!tracks.length) return;
    const nextIndex = ((index % tracks.length) + tracks.length) % tracks.length;
    if (nextIndex === currentIndex && options.keepPosition) {
      attemptPlay();
      return;
    }

    currentIndex = nextIndex;
    const track = currentTrack();
    state.currentTime = 0;
    state.duration = track ? track.durationMs / 1000 : 0;
    sourceCandidates = audioCandidates(track);
    sourceCursor = 0;
    pendingAutoplay = options.autoplay !== false;

    emit('change', { track, index: currentIndex });
    persist();

    if (!sourceCandidates.length) {
      state.available = false;
      state.playing = false;
      state.error = 'NO AUDIO';
      emit('state');
      return;
    }

    fadeTo(0, 120);
    window.setTimeout(() => {
      loadSource(sourceCandidates[0]);
      fadeTo(audio.volume || 0.8, 220);
    }, 130);
  }

  function next(options = {}) {
    if (!tracks.length) return;
    if (mode === 'shuffle') {
      let index = currentIndex;
      while (tracks.length > 1 && index === currentIndex) {
        index = Math.floor(Math.random() * tracks.length);
      }
      playIndex(index, { autoplay: true });
      return;
    }
    const index = currentIndex + 1;
    if (options.automatic && mode === 'sequential' && index >= tracks.length) {
      playIndex(0, { autoplay: false });
      return;
    }
    playIndex(index, { autoplay: true });
  }

  function prev() {
    if (!tracks.length) return;
    if (state.currentTime > 3) {
      api.seek(0);
      return;
    }
    playIndex(currentIndex - 1, { autoplay: true });
  }

  function toggle() {
    if (!currentTrack()) {
      playIndex(0, { autoplay: true });
      return;
    }
    if (audio.paused) attemptPlay();
    else audio.pause();
  }

  const api = {
    on,
    getTracks: () => tracks,
    getCurrentTrack: currentTrack,
    getCurrentIndex: () => currentIndex,
    getState: () => ({ ...state, mode, volume: audio.volume }),
    setTracks(list) {
      tracks = list || [];
      const stored = readStored();
      if (stored.mode) mode = stored.mode;
      if (typeof stored.volume === 'number') audio.volume = Math.min(1, Math.max(0, stored.volume));
      const index = tracks.findIndex((t) => t.id === stored.id);
      if (index >= 0) {
        currentIndex = index;
        emit('change', { track: currentTrack(), index });
        if (stored.position > 0) {
          state.currentTime = stored.position;
        }
      }
      emit('state');
    },
    playIndex,
    toggle,
    play: () => {
      if (!currentTrack()) playIndex(0, { autoplay: true });
      else attemptPlay();
    },
    pause: () => audio.pause(),
    next,
    prev,
    seek(seconds) {
      if (!Number.isFinite(seconds)) return;
      audio.currentTime = Math.max(0, seconds);
      state.currentTime = audio.currentTime;
      emit('time', { currentTime: state.currentTime, duration: state.duration });
    },
    setMode(value) {
      mode = value;
      persist();
      emit('state');
    },
    getMode: () => mode,
    setVolume(value) {
      audio.volume = Math.min(1, Math.max(0, value));
      persist();
      emit('state');
    },
    getVolume: () => audio.volume,
    flushPosition() {
      persist();
    }
  };

  return api;
}
