import { lyricsCandidates } from '../data.js';

const TAG = /^\[(ar|ti|al|by|offset|re|ve):(.*)\]$/i;
const TIME = /\[(\d{1,3}):(\d{1,2}(?:\.\d{1,3})?)\]/g;

/** 解析 LRC：支持一行多时间戳与常见元数据标签。 */
export function parseLrc(text) {
  const lines = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || TAG.test(line)) continue;

    const times = [];
    let match;
    TIME.lastIndex = 0;
    while ((match = TIME.exec(line)) !== null) {
      times.push(Number(match[1]) * 60 + Number(match[2]));
    }
    if (!times.length) continue;

    const content = line.replace(TIME, '').trim();
    for (const time of times) lines.push({ time, text: content || '♪' });
  }
  return lines.sort((a, b) => a.time - b.time);
}

export async function loadLyrics(track) {
  if (!track) return null;
  if (Array.isArray(track.lyrics)) return track.lyrics;
  if (typeof track.lyrics === 'string') return parseLrc(track.lyrics);

  for (const url of lyricsCandidates(track)) {
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) continue;
      const lines = parseLrc(await res.text());
      if (lines.length) return lines;
    } catch {
      /* 没有歌词是常态 */
    }
  }
  return null;
}

/** 二分找当前行 */
export function activeLineIndex(lines, currentTime) {
  if (!lines || !lines.length) return -1;
  let low = 0;
  let high = lines.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].time <= currentTime) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}
