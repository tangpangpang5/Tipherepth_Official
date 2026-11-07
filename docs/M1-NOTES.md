# M1 实现说明

> 本文件记录本轮交付的边界与已知风险。代码未经实际运行验证（开发环境 shell 不可用），以下「已验证」仅指静态审阅。

## 已完成

| 模块 | 状态 | 备注 |
|---|---|---|
| Vite 工程 + 设计 token | ✅ | `src/styles/tokens.css` 对齐 design/01 |
| 壳层 / 路由 / 快捷键 | ✅ | hash 路由，无需服务端重写 |
| 列表视图 + 搜索 | ✅ | 点击播放，Enter 开详情 |
| 曲目详情 + 歌词 | ✅ | LRC 异步加载，按时间轴高亮 |
| 播放器 | ✅ | 单 `<audio>`、音量淡入淡出、队列、localStorage 恢复 |
| 3D 卡带墙 | ✅ | 动态 import；25 槽位滑动窗口；程序化几何与标签 |
| 降级 | ✅ | WebGL 不可用 / 低端设备直接 2D 提示 |
| 曲库脚本 | ✅ | 扫描 / 取色 / 转码 |

## 已知未验证点（优先回归）

1. `npm install && npm run dev` 是否能一次通过（依赖版本：three 0.183 / vite 7）。
2. `src/scene/wall.js` 的拾取：`group.userData.index` 在 `tagGroups()` 中写入，点击路径依赖它。
3. 3D 首帧尺寸：`ResizeObserver` 观测的是 `.wall`（父元素），若首次回调早于布局可能拿到 0，已做 `if (!width || !height) return`。
4. 没有真实音频时，播放按钮会落到 `NO AUDIO` / `SIGNAL LOST`，属预期。
5. `.lrc` 放在 `public/lyrics/<id>.lrc`，文件名必须与 `tracks.json` 的 `id` 一致。

## 下一步（M2）

- 真实曲库接入后校准 accent 对比度
- 卡带墙选中抽出的 camera 推近转场（当前点击即跳详情）
- 移动端手势与单手握持布局
- 图片/音频懒加载与 R2 改造
