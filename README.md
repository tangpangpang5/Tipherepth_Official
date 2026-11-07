# Tipherepth_Official

月亮计划风格的音乐档案站：**3D 卡带墙 + 本地音频播放器**。
设计依据见本地设计集 `blog-design/06-music-station.md`（3D 场景、音频管线、性能预算、降级矩阵）。

## 当前状态：M1

- 2D 视图（列表 / 曲目 / 歌词）与播放器可用
- 3D 卡带墙按需加载：无 WebGL 或低端设备自动退回 2D
- **没有曲库时自动进入 DEMO 模式**（`data/tracks.sample.json`，封面程序生成，无音频）

## 开发

```bash
npm install
npm run dev        # http://127.0.0.1:5177
npm run build      # 产物在 dist/
```

## 接入自己的曲库

```bash
# 1. 扫描元数据与内嵌封面（不转码、不改源文件）
npm run scan -- --dir "D:/Music/library"

# 2. 封面转 AVIF + 计算 accent（S≤70% / L≤55% / 对比度≥4.5:1）
npm run palette

# 3. FLAC/WAV → opus 96k + mp3 192k 回退（需 ffmpeg 在 PATH）
npm run transcode -- --dir "D:/Music/library"
```

产物路径：`data/tracks.json`、`public/covers/`、`public/audio/`（后两者已 gitignore）。

## 目录

```
src/
  main.js            入口：加载数据 → 检测能力 → 挂载应用
  data.js            数据加载与归一化（tracks.json → sample 回退）
  audio/player.js    播放内核（Audio + 淡入淡出 + 队列 + 持久化）
  audio/lyrics.js    .lrc 解析与时间轴
  ui/                壳、路由、视图、播放条、程序化封面
  scene/wall.js      three.js 卡带墙（动态 import）
  styles/            设计 token 与布局
scripts/             扫描 / 取色 / 转码
```

## 约定

- 全站 0 圆角，切角用 `clip-path`（`.chamfer`）
- 动效只碰 `transform` / `opacity`，并响应 `prefers-reduced-motion`
- 3D 不进入首屏关键路径：无 WebGL 时不得报错，直接给 2D

## 许可证

代码 MIT（见 LICENSE）。音频、封面与第三方素材版权归各自权利人，不入库。
