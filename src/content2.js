const FALLBACK_SITE = {
  name: 'TIPHERETH',
  handle: 'tangpangpang5',
  role: '高中生 // 前端 / 视觉',
  location: 'CN',
  station: 'SITE-13 // 第三收容室',
  version: 'v0.4.0',
  weather: { city: '重庆', lat: 29.563, lon: 106.5516 },
  repo: { owner: 'tangpangpang5', name: 'Tipherepth_Official', branch: 'main' },
  links: [],
  admin: { password: 'tiphereth' },
};

const FALLBACK_PROFILE = {
  operator: 'TIPHERETH',
  alias: '',
  title: 'OPERATOR',
  clearance: 'LEVEL 3 / ARCHIVE',
  station: 'SITE-13',
  status: 'STATION ONLINE',
  fileNo: 'FILE-01',
  photoLabel: 'PHOTO CLASSIFIED',
  avatar: 'img/avatar.jpg',
  fields: [],
  skills: [],
};

export const OVERRIDE_KEY = 'tiphereth:content';

async function getJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  // Pages 对不存在的路径会回 index.html（200），这里挡掉
  if (!type.includes('json')) throw new Error(`${path} → not json`);
  return res.json();
}

function readOverride() {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || 'null') || {};
  } catch {
    return {};
  }
}

export function saveOverride(next) {
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(next));
}

export function clearOverride() {
  localStorage.removeItem(OVERRIDE_KEY);
}

export async function loadContent() {
  const override = readOverride();
  const [site, profile, activity] = await Promise.all([
    getJSON('content/site.json').catch(() => FALLBACK_SITE),
    getJSON('content/profile.json').catch(() => FALLBACK_PROFILE),
    getJSON('content/activity.json').catch(() => ({ generatedAt: '', days: {} })),
  ]);
  return {
    site: { ...FALLBACK_SITE, ...site, ...(override.site || {}) },
    profile: { ...FALLBACK_PROFILE, ...profile, ...(override.profile || {}) },
    activity: override.activity && override.activity.days ? override.activity : activity,
    local: Boolean(override.site || override.profile || override.activity),
  };
}
