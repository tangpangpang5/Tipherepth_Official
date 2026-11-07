import { el } from './dom.js';

export function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const DAYS = 91;

/** 13 周热力图（GitHub 公开事件只回溯 90 天） */
export function heatmapGrid(days, { counts } = {}) {
  const grid = el('div', { class: 'heatmap', role: 'img', 'aria-label': '最近 182 天活动' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cells = [];
  for (let i = DAYS - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    cells.push(d);
  }
  for (let i = 0; i < cells[0].getDay(); i += 1) grid.append(el('span', { class: 'heatmap__cell heatmap__cell--void' }));
  for (const d of cells) {
    const key = isoDate(d);
    const n = (counts || days)[key] || 0;
    grid.append(el('span', {
      class: 'heatmap__cell',
      dataset: { level: String(Math.min(4, n)), date: key },
      title: `${key} · ${n}`,
    }));
  }
  return grid;
}

/**
 * GitHub 公开事件接口（无需 token，CORS 开放）。
 * 局限：只看得到最近 90 天、最多 300 条公开事件，不等于完整 contributions 图。
 * https://docs.github.com/en/rest/activity/events#list-public-events-for-a-user
 */
export async function fetchGitHubActivity(user, { pages = 3 } = {}) {
  const days = {};
  let url = `https://api.github.com/users/${encodeURIComponent(user)}/events/public?per_page=100`;
  for (let page = 0; page < pages && url; page += 1) {
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`GitHub events ${res.status}`);
    const events = await res.json();
    if (!Array.isArray(events) || events.length === 0) break;
    for (const event of events) {
      const key = String(event.created_at || '').slice(0, 10);
      if (key) days[key] = (days[key] || 0) + 1;
    }
    if (events.length < 100) break;
    const link = res.headers.get('link') || '';
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return days;
}
