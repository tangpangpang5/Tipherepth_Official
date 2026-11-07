/**
 * M0 · 转码
 *
 * FLAC/WAV 源 → public/audio/<id>.opus (96k) + .mp3 (192k 回退)
 * 原文件不复制、不移动；R2 上传是独立步骤（后续 M4）。
 *
 * 依赖系统 ffmpeg（Windows 需在 PATH 中，或传 --ffmpeg 指定路径）。
 *
 * 用法：
 *   node scripts/transcode.mjs --dir "D:/Music/library" --data data --public public
 *   node scripts/transcode.mjs --dir "D:/Music/library" --only <trackId>
 */
import { spawn } from 'node:child_process';
import { access, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

function parseArgs(argv) {
  const args = { dir: null, data: 'data', public: 'public', ffmpeg: 'ffmpeg', only: null, force: false };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--dir') { args.dir = value; i += 1; }
    else if (key === '--data') { args.data = value; i += 1; }
    else if (key === '--public') { args.public = value; i += 1; }
    else if (key === '--ffmpeg') { args.ffmpeg = value; i += 1; }
    else if (key === '--only') { args.only = value; i += 1; }
    else if (key === '--force') args.force = true;
    else throw new Error(`未知参数：${key}`);
  }
  if (!args.dir) throw new Error('缺少 --dir（音频目录）');
  return args;
}

const exists = async (path) => {
  try { await access(path); return true; } catch { return false; }
};

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} 退出码 ${code}：${stderr.split('\n').slice(-3).join(' ')}`));
    });
  });
}

async function transcodeOne(args, track, outDir) {
  const source = join(resolve(args.dir), track.sourcePath);
  const opus = join(outDir, `${track.id}.opus`);
  const mp3 = join(outDir, `${track.id}.mp3`);

  if (args.force || !(await exists(opus))) {
    await run(args.ffmpeg, ['-y', '-v', 'error', '-i', source, '-vn', '-c:a', 'libopus', '-b:a', '96k', '-vbr', 'on', opus]);
  }
  if (args.force || !(await exists(mp3))) {
    await run(args.ffmpeg, ['-y', '-v', 'error', '-i', source, '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', mp3]);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const manifest = JSON.parse(await readFile(join(resolve(args.data), 'tracks.json'), 'utf8'));
  const outDir = join(resolve(args.public), 'audio');
  await mkdir(outDir, { recursive: true });

  const queue = args.only ? manifest.tracks.filter((t) => t.id === args.only) : manifest.tracks;
  if (!queue.length) throw new Error(args.only ? `找不到曲目 ${args.only}` : '清单为空');

  console.log(`待转码 ${queue.length} 首（opus 96k + mp3 192k 回退）…`);
  let done = 0;
  let failed = 0;
  let cursor = 0;
  const CONCURRENCY = 2;

  async function worker() {
    while (cursor < queue.length) {
      const track = queue[cursor];
      cursor += 1;
      try {
        await transcodeOne(args, track, outDir);
        done += 1;
        if (done % 10 === 0) console.log(`  完成 ${done}/${queue.length}`);
      } catch (error) {
        failed += 1;
        console.warn(`失败 ${track.title}：${error.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`完成：${done} 首，失败 ${failed}，输出目录 ${outDir}`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
