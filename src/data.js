import { hashString } from './ui/dom.js';

const REAL_URL = 'data/tracks.json';
const SAMPLE_URL = 'data/tracks.sample.json';

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function normalizeCover(raw) {
  if (!raw) return null;
  const withoutExt = raw.replace(/\.(avif|webp|png|jpe?g)$/i, '');
  return withoutExt.replace(/-(96|256|512)$/, '');
}

function normalizeTrack(track, index) {
  const id = track.id || slugify(`${track.artist || ''}-${track.title || ''}`) || `track-${index}`;
  return {
    id,
    index,
    title: track.title || 'UNTITLED',
    artist: track.artist || 'UNKNOWN',
    album: track.album || 'UNCATALOGUED',
    albumArtist: track.albumArtist || track.artist || 'UNKNOWN',
    year: track.year ?? null,
    trackNo: track.trackNo ?? null,
    durationMs: Number(track.durationMs) || 0,
    codec: track.codec || null,
    lossless: Boolean(track.lossless),
    coverBase: normalizeCover(track.cover),
    accent: track.accent || null,
    audio: track.audio || (track.hasAudio === false ? null : true),
    lyrics: track.lyrics || null,
    metaSource: track.metaSource || 'tags'
  };
}

/**
 * 数据加载：优先真实曲库，失败时退回演示数据。
 * 返回 { tracks, demo, generatedAt, rootName }。
 */
export async function loadTracks() {
  let dataset = null;
  let demo = false;

  try {
    const real = await fetchJson(REAL_URL);
    if (Array.isArray(real?.tracks) && real.tracks.length > 0) dataset = real;
  } catch (error) {
    // 没有曲库是常态：安静回退，不打扰用户
    console.info('[data] tracks.json 不可用，尝试演示数据：', error.message);
  }

  if (!dataset) {
    try {
      const sample = await fetchJson(SAMPLE_URL);
      if (Array.isArray(sample?.tracks)) {
        dataset = sample;
        demo = true;
      }
    } catch (error) {
      console.warn('[data] 演示数据也加载失败：', error.message);
    }
  }

  const tracks = (dataset?.tracks || []).map((track, index) => normalizeTrack(track, index));

  return {
    tracks,
    demo,
    generatedAt: dataset?.generatedAt || null,
    rootName: dataset?.rootName || null,
    digest: hashString(tracks.map((t) => t.id).join('|'))
  };
}

export function audioCandidates(track) {
  if (!track || track.audio === null || track.audio === false) return [];
  if (typeof track.audio === 'string') return [track.audio];
  const base = `public/audio/${track.id}`;
  const canOpus = document.createElement('audio').canPlayType('audio/ogg; codecs=opus');
  return canOpus ? [`${base}.opus`, `${base}.mp3`] : [`${base}.mp3`, `${base}.opus`];
}

export function lyricsCandidates(track) {
  if (!track) return [];
  return [`public/lyrics/${track.id}.lrc`];
}
