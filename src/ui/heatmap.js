import { el } from './dom.js';

export function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const DAYS = 182;

/** 182 天（26 周）热力图；onClick 传入时可编辑 */
export function heatmapGrid(days, { onClick, counts } = {}) {
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
    const cell = el('span', {
      class: 'heatmap__cell',
      dataset: { level: String(Math.min(4, n)), date: key },
      title: `${key} · ${n}`,
    });
    if (onClick) {
      cell.classList.add('heatmap__cell--edit');
      cell.addEventListener('click', () => onClick(key, n));
    }
    grid.append(cell);
  }
  return grid;
}
