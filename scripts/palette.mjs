/**
 * M0 · 封面与配色提取
 *
 * 读取 tracks.json 里的封面原图 → 生成 96/256/512 的 AVIF → 计算专辑 accent 色。
 * accent 钳制规则（见 blog-design/06-music-station.md）：
 *   S ≤ 70%、L ≤ 55%、与 --void(#08090A) 对比度 ≥ 4.5:1
 *   若与 --alert(#C8102E) 色相距离 < 15°，色相偏移 +25° 再钳制
 *
 * 用法：node scripts/palette.mjs --data data --public public
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const VOID = [8, 9, 10];
const ALERT_HUE = 351;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function parseArgs(argv) {
  const args = { data: 'data', public: 'public' };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--data') { args.data = argv[i + 1]; i += 1; }
    else if (argv[i] === '--public') { args.public = argv[i + 1]; i += 1; }
    else throw new Error(`未知参数：${argv[i]}`);
  }
  return args;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb;
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = l - c / 2;
  return rgb.map((v) => Math.round((v + m) * 255));
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const toHex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

async function dominantColor(file) {
  const { data, info } = await sharp(file).resize(64, 64, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const entry = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    entry.n += 1; entry.r += r; entry.g += g; entry.b += b;
    buckets.set(key, entry);
  }
  const ranked = [...buckets.values()]
    .map((entry) => {
      const rgb = [entry.r / entry.n, entry.g / entry.n, entry.b / entry.n];
      const [h, s, l] = rgbToHsl(...rgb);
      return { rgb, h, s, l, n: entry.n };
    })
    .filter((entry) => entry.s > 0.25 && entry.l > 0.08 && entry.l < 0.92)
    .sort((a, b) => b.n * b.s - a.n * a.s);
  return ranked[0] || null;
}

function clampAccent({ h, s, l }) {
  let hue = h;
  if (Math.min(Math.abs(hue - ALERT_HUE), 360 - Math.abs(hue - ALERT_HUE)) < 15) hue = (hue + 25) % 360;
  const sat = clamp(s, 0.15, 0.7);
  let light = clamp(l, 0.2, 0.55);
  let rgb = hslToRgb(hue, sat, light);
  for (let step = 0; step < 8 && contrast(rgb, VOID) < 4.5; step += 1) {
    light = Math.min(0.62, light + 0.04);
    rgb = hslToRgb(hue, sat, light);
  }
  return { hex: toHex(rgb), ratio: Math.round(contrast(rgb, VOID) * 100) / 100, hsl: [Math.round(hue), Math.round(sat * 100), Math.round(light * 100)] };
}

async function main() {
  const args = parseArgs(process.argv);
  const dataDir = resolve(args.data);
  const publicDir = resolve(args.public);
  const srcDir = join(publicDir, 'covers', 'src');
  const genDir = join(publicDir, 'covers', 'gen');
  await mkdir(genDir, { recursive: true });

  const manifest = JSON.parse(await readFile(join(dataDir, 'tracks.json'), 'utf8'));
  let files = [];
  try {
    files = (await readdir(srcDir)).filter((f) => !f.startsWith('.'));
  } catch {
    files = [];
  }
  const fileSet = new Set(files);

  let covers = 0;
  let accents = 0;
  for (const track of manifest.tracks) {
    const name = track.cover?.split('/').pop();
    if (!name || !fileSet.has(name)) {
      track.accent = track.accent || '#E8B10A';
      continue;
    }
    const source = join(srcDir, name);
    const stem = name.replace(/\.[^.]+$/, '');
    for (const size of [96, 256, 512]) {
      await sharp(source)
        .resize(size, size, { fit: 'cover' })
        .avif({ quality: size === 512 ? 55 : 60 })
        .toFile(join(genDir, `${stem}-${size}.avif`));
    }
    track.cover = `covers/gen/${stem}`;
    covers += 1;
    const dominant = await dominantColor(source);
    const accent = dominant ? clampAccent(dominant) : { hex: '#E8B10A', ratio: null, hsl: null };
    track.accent = accent.hex;
    track.accentMeta = accent;
    accents += 1;
  }

  await writeFile(join(dataDir, 'tracks.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`完成：处理封面 ${covers}，生成 accent ${accents}，清单已回写 ${join(dataDir, 'tracks.json')}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
