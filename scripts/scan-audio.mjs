/**
 * M0 · 音频扫描器
 *
 * 读取本地音频目录 → 提取元数据与内嵌封面 → 生成 public/data/tracks.json。
 * 不依 ffmpeg、不转码、不联网；只做「把文件变成一份可构建的清单」。
 *
 * 用法：
 *   npm run scan -- --dir "D:/Music/library"
 *   npm run scan -- --dir "D:/Music/library" --limit 20
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { parseFile } from 'music-metadata';

const AUDIO_EXT = new Set(['.flac', '.wav', '.mp3', '.m4a', '.ogg', '.opus', '.aiff', '.aif']);
const IMAGE_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

function parseArgs(argv) {
  const args = { dir: null, out: 'public/data', limit: Infinity };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--dir') { args.dir = value; i += 1; }
    else if (key === '--out') { args.out = value; i += 1; }
    else if (key === '--limit') { args.limit = Number(value); i += 1; }
    else throw new Error(`未知参数：${key}`);
  }
  if (!args.dir) throw new Error('缺少 --dir（音频目录）');
  return args;
}

async function walk(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, acc);
    else if (AUDIO_EXT.has(extname(entry.name).toLowerCase())) acc.push(full);
  }
  return acc;
}

function slugify(input) {
  const base = input
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
  const hash = createHash('sha1').update(input).digest('hex').slice(0, 6);
  return `${base.slice(0, 48) || 'track'}-${hash}`;
}

const first = (value) => (Array.isArray(value) ? value[0] : value);

async function scanOne(rootDir, file, coversDir) {
  const rel = relative(rootDir, file);
  const meta = await parseFile(file, { duration: true, skipCovers: false });
  const common = meta.common ?? {};

  const title = first(common.title) || rel.replace(/\.[^.]+$/, '').split(/[\\/]/).pop();
  const artist = first(common.artist) || first(common.albumartist) || 'UNKNOWN';
  const album = first(common.album) || 'UNCATALOGUED';
  const duration = meta.format?.duration;

  const track = {
    id: slugify(`${artist}/${album}/${title}/${rel}`),
    title,
    artist,
    album,
    albumArtist: first(common.albumartist) || artist,
    year: common.year ?? null,
    trackNo: common.track?.no ?? null,
    diskNo: common.disk?.no ?? null,
    genre: common.genre ?? [],
    durationMs: Number.isFinite(duration) ? Math.round(duration * 1000) : null,
    sampleRate: meta.format?.sampleRate ?? null,
    bitDepth: meta.format?.bitsPerSample ?? null,
    codec: meta.format?.codec ?? null,
    lossless: meta.format?.lossless ?? false,
    sourcePath: rel,
    metaSource: common.title ? 'tags' : 'filename',
    cover: null,
    accent: null
  };

  const picture = first(common.picture);
  if (picture?.data) {
    const ext = IMAGE_EXT[picture.format] ?? '.jpg';
    const name = `${track.id}${ext}`;
    await writeFile(join(coversDir, name), picture.data);
    track.cover = `covers/src/${name}`;
  }

  return track;
}

async function main() {
  const args = parseArgs(process.argv);
  const rootDir = resolve(args.dir);
  const info = await stat(rootDir);
  if (!info.isDirectory()) throw new Error(`--dir 不是目录：${rootDir}`);

  const outDir = resolve(args.out);
  // 约定：--out 指向 public/data，封面写到 public/covers/src
  const coversDir = join(outDir, '..', 'covers', 'src');
  await mkdir(coversDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  const all = await walk(rootDir);
  console.log(`发现 ${all.length} 个音频文件，开始解析…`);

  const tracks = [];
  let failed = 0;
  for (const [index, file] of all.slice(0, args.limit).entries()) {
    try {
      tracks.push(await scanOne(rootDir, file, coversDir));
    } catch (error) {
      failed += 1;
      console.warn(`跳过 ${relative(rootDir, file)}：${error.message}`);
    }
    if ((index + 1) % 25 === 0) console.log(`  已解析 ${index + 1}/${all.length}`);
  }

  tracks.sort((a, b) =>
    `${a.artist}${a.album}${String(a.trackNo ?? 999)}`.localeCompare(`${b.artist}${b.album}${String(b.trackNo ?? 999)}`)
  );

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    rootName: rootDir.split(/[\\/]/).pop(),
    stats: {
      total: tracks.length,
      failed,
      lossless: tracks.filter((t) => t.lossless).length,
      withCover: tracks.filter((t) => t.cover).length
    },
    tracks
  };

  await writeFile(join(outDir, 'tracks.json'), `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`完成：${tracks.length} 首，失败 ${failed}，清单写入 ${join(outDir, 'tracks.json')}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
