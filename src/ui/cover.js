import { hashString } from './dom.js';

const cache = new Map();

function hexToRgb(hex) {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * 程序化封面：无封面素材时不显示占位图，而是生成一张“档案卡”。
 * 结果是 data URL，可直接用于 <img> 与 CanvasTexture。
 */
export function coverUrl(track, size = 256) {
  if (!track) return '';
  if (track.coverBase) return `${track.coverBase}-${size >= 512 ? 512 : size >= 256 ? 256 : 96}.avif`;

  const key = `${track.id}:${size}`;
  if (cache.has(key)) return cache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = seeded(parseInt(hashString(track.id), 16) || 1);

  const accent = track.accent || '#E8B10A';
  const [ar, ag, ab] = hexToRgb(accent);

  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#141719');
  bg.addColorStop(0.55, `rgba(${ar}, ${ag}, ${ab}, 0.18)`);
  bg.addColorStop(1, '#08090A');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // 网格
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  const step = Math.max(8, Math.round(size / 16));
  for (let x = step; x < size; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, size);
    ctx.stroke();
  }

  // 斜向色带
  ctx.save();
  ctx.translate(size * 0.5, size * 0.62);
  ctx.rotate(-0.42);
  ctx.fillStyle = `rgba(${ar}, ${ag}, ${ab}, 0.9)`;
  ctx.fillRect(-size, 0, size * 2, Math.max(3, size * 0.05));
  ctx.restore();

  // 编号与标题
  ctx.fillStyle = '#D8DBD6';
  ctx.font = `600 ${Math.round(size * 0.055)}px ui-monospace, monospace`;
  ctx.fillText(`TRK ${String((track.index ?? 0) + 1).padStart(3, '0')}`, size * 0.08, size * 0.12);

  ctx.fillStyle = `rgba(${ar}, ${ag}, ${ab}, 0.95)`;
  ctx.font = `700 ${Math.round(size * 0.11)}px system-ui, sans-serif`;
  const title = track.title.length > 10 ? `${track.title.slice(0, 9)}…` : track.title;
  ctx.fillText(title, size * 0.08, size * 0.86);

  // 条形码
  ctx.fillStyle = 'rgba(216,219,214,0.75)';
  let x = size * 0.08;
  const y = size * 0.9;
  while (x < size * 0.92) {
    const w = rand() > 0.5 ? 2 : 4;
    ctx.fillRect(x, y, w, size * 0.04);
    x += w + (rand() > 0.6 ? 3 : 2);
  }

  // 噪点
  for (let i = 0; i < size * 2.5; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${rand() * 0.035})`;
    ctx.fillRect(rand() * size, rand() * size, 1, 1);
  }

  const url = canvas.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
