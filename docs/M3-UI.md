# M3 视觉与动效：采纳记录

Gemini 网页版当时返回错误（换模型/标签页均复现），改用 Google AI Studio（Gemini 3.8 Flash）拿到评审。以下记录采纳与筛除。

## 采纳（已落地）

| Gemini 建议 | 落地位置 |
| --- | --- |
| 卡片三档边框 + inset 高光 + `4px 4px 0 #040405` 硬投影（blur=0） | `src/styles/lc2.css` `.datacard` |
| Impact 紧缩 `letter-spacing:-.04em` + 强制大写 | `.clock__time` / `.filecard__band strong` / `.admin__title` |
| 奶油纸卡加顶部 16px 机架夹具条 + 硬投影 | `.filecard::before` |
| 薄荷点由平滑呼吸改为 `steps(1)` 荧光管频闪 | `@keyframes tube-flicker` |
| 机械切角（10px 斜角） | `.chamfer`（播放器封面/进度条） |
| 90° 直角管线：底槽 5px `#18181c` + 信号线 1px 奶黄 `.2` + 拐点焊点 | `tree.js` `orthogonal()` + `.tree__pipe/.tree__signal/.tree__joint` |
| 树节点瘦身：只留部门代号 + 曲目数，点开才看曲目 | `tree.js` `deptNode()` + `deptDrawer()` |
| 首页留白补「卡带槽」：44px 高、左侧状态色条、编号、空槽虚线 | `shelf.js` `recentBooksCard()` |
| 书脊墙：扇区货架、书脊 28px 宽、三档高度、竖排文字、顶部 6px 色标 | `shelf.js` + `.spine` |
| 卡榫按压：hover 只换边框色，active `translate(2px,2px)` + 投影收缩 40ms | `.btn` / `.cartridge` / `.spine` |
| 同屏循环动画 ≤2 | 仅保留频闪点与路由扫线（扫线非循环） |

## 筛除（与「克制」「实机优先」冲突）

- 卡片四角 4×4 直角角码：四角码在每个卡上会变成噪音，改为顶部 2px 渐变饰条。
- 页面进入时的整页 Glitch / 视差：超预算。
- 书架 hover 弹固定浮层：改为右侧抽屉，避免浮层遮挡书脊。
- 章节建议里的彩色书脊：保留深色底 + 顶部色标，不整根上色。

## 新增接口/数据

- `public/content/books.json`：`{ generatedAt, sectors[], books[] }`，每本 `{id,title,author,status:'reading'|'done',sector,updated}`。
- 书架路由 `#/shelf`；后台 BOOKS 区批量编辑（每行 `书名 | 作者 | 在读/读完 | 分区`），保存时保留已有 id/updated。
- 抽屉组件 `src/ui/drawer.js`：Esc / 点 × 关闭，树页与书架共用。
