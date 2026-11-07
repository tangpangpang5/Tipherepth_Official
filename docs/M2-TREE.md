# M2 结构说明：Qliphoth 音乐树

## 页面结构

| 路由 | 视图 | 说明 |
| --- | --- | --- |
| `#/` | `pageHome` | 时钟 / 天气 / GitHub 热力图 / 个人档案卡 / 链接 / 音乐入口 |
| `#/profile` | `pageProfile` | 档案卡 / SKILLS / LINKS / PROFILE STATUS |
| `#/music` | `pageMusic` (`mode: tree`) | 逆卡巴拉生命树，10 个部门节点 |
| `#/music/library` | `pageMusic` (`mode: index`) | 同样的部门分组，改成双列索引 |
| `#/music/track/:id` | `pageMusic` (`trackId`) | 树视图 + 对应曲目高亮 |
| `#/admin` | `pageAdmin` | 口令登录后编辑站点 / 档案 / 链接，可保存本机或提交仓库 |

模块：`src/ui/tree.js`（树与索引）、`src/ui/pages2.js`（首页/档案）、`src/ui/heatmap.js`（热力图 + GitHub 取数）、`src/ui/admin.js`、`src/styles/tree.css`。

## 部门映射

| 层 | 质点 | 部门 | 英文 | 坐标 (x%, y%) |
| --- | --- | --- | --- | --- |
| Asiyah | Malkuth | 控制部 | Control Team | 50, 0 |
| Asiyah | Yesod | 情报部 | Information Team | 50, 18 |
| Asiyah | Hod | 培训部 | Training Team | 16, 18 |
| Asiyah | Netzach | 安保部 | Safety Team | 84, 18 |
| Briah | Geburah | 惩戒部 | Disciplinary Team | 16, 39 |
| Briah | Tiphereth | 中央本部 | Central Command | 50, 39 |
| Briah | Chesed | 福利部 | Welfare Team | 84, 39 |
| Atziluth | Binah | 提取部 | Extraction Team | 32, 61 |
| Atziluth | Hokma | 记录部 | Record Team | 68, 61 |
| Atziluth | Keter | 构筑部 | Architecture Team | 50, 83 |

分层与顺序依据 Lobotomy Corporation Wiki 的 Departments 页（Asiyah / Briah / Atziluth 三层，共 10 个部门）：
<https://lobotomycorporation.wiki.gg/wiki/Departments>

曲目按 `album` 字段归入部门：匹配中文名、英文名或质点代号（大小写与 `TEAM`/`部` 后缀不敏感）。匹配不到进 `UNCLASSIFIED`。

## 接口

### GitHub 公开事件（热力图）

```
GET https://api.github.com/users/{handle}/events/public?per_page=100
Accept: application/vnd.github+json
```

- 无 token、CORS 开放；未认证 60 次/小时（按访问者 IP 计）。
- 只回溯 90 天、最多 300 条公开事件，所以热力图窗口是 91 天，且不等于官方 contributions 图。
- 实现：`src/ui/heatmap.js` → `fetchGitHubActivity(user)`，按 `created_at` 的日期聚合。
- 失败时回落到 `public/content/activity.json` 的静态数据，并在标题旁标 `CACHED`。

### 天气（open-meteo）

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=29.563&longitude=106.5516
  &current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m
  &daily=temperature_2m_max,temperature_2m_min
  &timezone=auto&forecast_days=1
```

地点固定重庆（29.5630, 106.5516）；无需 key，代码在 `src/ui/pages2.js` 的 `mountWeather`。

### 头像

- 文件：`public/img/avatar.jpg`（512×512，从原图居中裁成正方形后缩放）。
- 引用：`public/content/profile.json` 的 `avatar` 字段；档案卡用 `aspect-ratio: 1 / 1` + `object-fit: cover` 显示。
- 换头像：替换该文件，或把 `avatar` 改成任意图片 URL/路径。

## 交互保留清单

- 点击曲目 → `player.playIndex(index)`；当前曲目 `aria-current`，播放中为薄荷色。
- 播放条：上一首 / 播放暂停 / 下一首 / SEQ·RND·ONE 模式 / 拖动进度 / 音量；空格切歌（音乐路由内）。
- 深链 `#/music/track/:id` 定位曲目；`#/music/library` 保留平铺索引。
- LYRICS 按钮：读取 `lyrics/<id>.lrc` 或曲目内嵌歌词，高亮当前行。
- 队列、音量、播放位置沿用 `localStorage`（`tiphereth:player`）。

## 样式

`src/styles/tree.css`（在 `pages.css` 之后加载）：树容器用 `--x/--y` 百分比定位节点，SVG 连线用 `preserveAspectRatio="none"` 的 0–100 viewBox 随容器缩放；≤900px 时树退化为纵向列表，连线与层标签隐藏。
