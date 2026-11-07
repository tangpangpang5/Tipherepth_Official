import { el } from './dom.js';
import { heatmapGrid, isoDate } from './heatmap.js';

const WEATHER = {
  0: '晴', 1: '多云', 2: '多云', 3: '阴', 45: '雾', 48: '雾',
  51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨',
  66: '冻雨', 67: '冻雨', 71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
  80: '阵雨', 81: '阵雨', 82: '强阵雨', 85: '阵雪', 86: '阵雪', 95: '雷雨', 96: '雷雨', 99: '雷雨',
};

function card(idx, title, ...children) {
  return el(
    'section',
    { class: 'datacard' },
    el('header', { class: 'datacard__head' }, el('span', { class: 'datacard__idx', text: idx }), el('h2', { class: 'datacard__title', text: title })),
    ...children,
  );
}

function fileCard(site, profile) {
  const fields = el('dl', { class: 'filecard__fields' });
  for (const field of profile.fields || []) {
    fields.append(el('div', { class: 'filecard__field' }, el('dt', { text: field.k }), el('dd', { text: field.v })));
  }
  return el(
    'article',
    { class: 'filecard' },
    el('div', { class: 'filecard__head' }, el('span', { text: 'PERSONAL FILE' }), el('span', { class: 'filecard__rule' })),
    el('div', { class: 'filecard__body' },
      el('div', { class: 'filecard__photo' }, el('div', { class: 'filecard__figure' }), el('span', { class: 'filecard__tag', text: profile.photoLabel })),
      el('div', { class: 'filecard__info' },
        el('div', { class: 'filecard__chips' },
          el('span', { class: 'chip', text: profile.title }),
          el('span', { class: 'chip chip--ghost', text: profile.status }),
        ),
        el('div', { class: 'filecard__band' }, el('strong', { text: profile.operator })),
        fields,
      ),
    ),
    el('div', { class: 'filecard__foot' },
      el('span', { text: profile.fileNo }),
      el('span', { text: 'PERSONAL INFORMATION LOADED' }),
      el('span', { class: 'filecard__stamp', text: profile.clearance }),
    ),
  );
}

function clockNode(site) {

  const time = el('div', { class: 'clock__time', text: '--:--:--' });
  const date = el('div', { class: 'clock__date', text: '' });
  const tick = () => {
    const now = new Date();
    time.textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
    date.textContent = `${now.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} // ${now.toLocaleDateString('zh-CN', { weekday: 'short' })}`;
  };
  tick();
  const timer = window.setInterval(tick, 1000);
  return {
    el: card('00', 'LOCAL TIME', el('div', { class: 'clock' }, time, date, el('div', { class: 'clock__zone', text: site.station }))),
    destroy: () => window.clearInterval(timer),
  };
}

function mountWeather(node, cfg) {
  const city = cfg?.city || '北京';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${cfg?.lat ?? 39.9042}&longitude=${cfg?.lon ?? 116.4074}`
    + '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m'
    + '&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1';
  node.replaceChildren(el('div', { class: 'weather__row' }, el('span', { class: 'weather__city', text: city }), el('span', { class: 'weather__temp', text: '--' })));
  fetch(url, { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
    .then((data) => {
      const cur = data.current || {};
      const daily = data.daily || {};
      node.replaceChildren(
        el('div', { class: 'weather__row' },
          el('span', { class: 'weather__city', text: city }),
          el('span', { class: 'weather__temp', text: `${Math.round(cur.temperature_2m)}°` }),
          el('span', { class: 'weather__desc', text: WEATHER[cur.weather_code] || '—' }),
        ),
        el('div', { class: 'weather__row weather__row--dim' },
          el('span', { text: `湿度 ${cur.relative_humidity_2m ?? '--'}%` }),
          el('span', { text: `风速 ${Math.round(cur.wind_speed_10m ?? 0)} km/h` }),
          el('span', { text: `最高 ${Math.round(daily.temperature_2m_max?.[0] ?? 0)}° / 最低 ${Math.round(daily.temperature_2m_min?.[0] ?? 0)}°` }),
        ),
      );
    })
    .catch(() => {
      node.replaceChildren(el('div', { class: 'weather__row weather__row--dim' }, el('span', { text: `${city} // SIGNAL LOST` })));
    });
}

function linksRow(links) {
  return el('div', { class: 'link-row' }, ...(links || []).map((link) => el('a', { class: 'btn', href: link.href, rel: 'noopener me', text: link.label })));
}

export function pageHome({ content }) {
  const { site, profile, activity } = content;
  const clock = clockNode(site);
  const weather = el('div', { class: 'weather', text: 'LINKING…' });
  mountWeather(weather, site.weather);
  const days = activity.days || {};
  const total = Object.values(days).reduce((sum, n) => sum + n, 0);
  const active = Object.keys(days).length;

  const elm = el(
    'section',
    { class: 'page' },
    el('div', { class: 'container' },
      el('div', { class: 'console' },
        el('div', { class: 'console__col' },
          clock.el,
          card('01', 'WEATHER', weather),
          card('02', 'ACTIVITY // 182D',
            el('div', { class: 'activity__meta' }, el('span', { text: `${total} 次记录` }), el('span', { text: `${active} 天有活动` })),
            heatmapGrid(days),
          ),
        ),
        el('div', { class: 'console__col' },
          el('div', { class: 'console__row' }, fileCard(site, profile)),
          card('03', 'OPERATOR',
            el('div', { class: 'opstatus' },
              el('span', { class: 'opstatus__dot' }),
              el('span', { text: profile.status }),
              el('span', { class: 'opstatus__meta', text: profile.station }),
            ),
            el('p', { class: 'datacard__text', text: profile.bio }),
            linksRow(site.links),
          ),
          el('a', { class: 'music-cta', href: '#/music' },
            el('span', { class: 'music-cta__label', text: 'CASSETTE WALL' }),
            el('span', { class: 'music-cta__text', text: '推门进去，墙上是我这些年存下来的声音。' }),
            el('span', { class: 'music-cta__arrow', text: '→' }),
          ),
        ),
      ),
    ),
  );
  return { el: elm, destroy: () => clock.destroy() };
}

export function pageProfile({ content }) {
  const { site, profile } = content;
  const skills = el('div', { class: 'link-row' }, ...(profile.skills || []).map((s) => el('span', { class: 'chip', text: s })));
  const timeline = el('ol', { class: 'timeline' }, ...(profile.timeline || []).map((item) => el('li', { class: 'timeline__item' }, el('span', { class: 'timeline__year', text: item.year }), el('span', { class: 'timeline__text', text: item.text }))));
  return {
    el: el('section', { class: 'page' },
      el('div', { class: 'container' },
        el('div', { class: 'profile' },
          fileCard(site, profile),
          card('04', 'BIOGRAPHY', el('p', { class: 'datacard__text', text: profile.bio })),
          card('05', 'SKILLS', skills),
          card('06', 'TIMELINE', timeline),
          card('07', 'LINKS', linksRow(site.links)),
        ),
      ),
    ),
    destroy() {},
  };
}

export { card, linksRow, mountWeather, isoDate };
