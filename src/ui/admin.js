import { el } from './dom.js';
import { saveOverride, clearOverride } from '../content2.js';
import { heatmapGrid } from './heatmap.js';

const SESSION_KEY = 'tiphereth:admin';
const PAT_KEY = 'tiphereth:pat';

function isAuthed() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

function b64utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function commitFile(repo, path, payload, token) {
  const url = `https://api.github.com/repos/${repo.owner}/${repo.name}/contents/${path}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  const existing = await fetch(`${url}?ref=${repo.branch}`, { headers }).then((res) => (res.ok ? res.json() : null));
  const body = {
    message: `content: update ${path.split('/').pop()}`,
    content: b64utf8(`${JSON.stringify(payload, null, 2)}\n`),
    branch: repo.branch,
  };
  if (existing && existing.sha) body.sha = existing.sha;
  const res = await fetch(url, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.message || `GitHub ${res.status}`);
  }
}

function field(label, value, type = 'text') {
  const input = el('input', { class: 'admin__input', type, value: value == null ? '' : String(value) });
  return { node: el('label', { class: 'admin__field' }, el('span', { class: 'admin__label', text: label }), input), input };
}

function loginView(site) {
  const input = el('input', { class: 'admin__input', type: 'password', placeholder: '访问口令', autocomplete: 'off' });
  const note = el('div', { class: 'admin__note', text: '' });
  const submit = (event) => {
    event.preventDefault();
    if (input.value === (site.admin?.password || 'tiphereth')) {
      sessionStorage.setItem(SESSION_KEY, '1');
      window.location.reload();
    } else {
      note.textContent = 'ACCESS DENIED';
      input.value = '';
    }
  };
  return {
    el: el('section', { class: 'page' },
      el('div', { class: 'container' },
        el('form', { class: 'admin__login', onSubmit: submit },
          el('div', { class: 'admin__kicker', text: 'ADMINISTRATOR ACCESS' }),
          el('h1', { class: 'admin__title', text: 'LOG IN' }),
          input,
          el('button', { class: 'btn btn--play', type: 'submit', text: 'UNLOCK' }),
          note,
          el('p', { class: 'admin__hint', text: '口令只做前台门禁，不是安全边界；要真防护得换 Cloudflare Access。' }),
        ),
      ),
    ),
    destroy() {},
  };
}

function editorView({ content }) {
  const site = structuredClone(content.site);
  const profile = structuredClone(content.profile);
  const days = { ...(content.activity.days || {}) };

  const f = {
    name: field('站点名', site.name),
    handle: field('handle', site.handle),
    role: field('role', site.role),
    location: field('location', site.location),
    station: field('站点标识', site.station),
    intro: field('简介', site.intro),
    city: field('天气城市', site.weather?.city),
    lat: field('纬度', site.weather?.lat),
    lon: field('经度', site.weather?.lon),
    operator: field('OPERATOR', profile.operator),
    alias: field('别名', profile.alias),
    title: field('职称', profile.title),
    clearance: field('许可级别', profile.clearance),
    pstation: field('所属站点', profile.station),
    status: field('状态', profile.status),
    fileNo: field('档案号', profile.fileNo),
    photoLabel: field('照片标签', profile.photoLabel),
    bio: field('简介正文', profile.bio),
    skills: field('技能（逗号分隔）', (profile.skills || []).join(', ')),
    password: field('修改口令（留空不变）', '', 'password'),
  };
  const links = el('textarea', { class: 'admin__textarea', rows: '4' });
  links.value = (site.links || []).map((link) => `${link.label} | ${link.href}`).join('\n');

  const heatSlot = el('div', { class: 'admin__heat' });
  const renderHeat = () => {
    heatSlot.replaceChildren(heatmapGrid(days, {
      onClick: (key) => {
        days[key] = ((days[key] || 0) + 1) % 5;
        if (!days[key]) delete days[key];
        renderHeat();
      },
    }));
  };
  renderHeat();

  const status = el('div', { class: 'admin__note', text: '' });
  const pat = el('input', { class: 'admin__input', type: 'password', value: localStorage.getItem(PAT_KEY) || '', placeholder: 'GitHub token（可选，用于提交）' });

  function collect() {
    const nextSite = {
      ...site,
      name: f.name.input.value.trim(),
      handle: f.handle.input.value.trim(),
      role: f.role.input.value.trim(),
      location: f.location.input.value.trim(),
      station: f.station.input.value.trim(),
      intro: f.intro.input.value,
      weather: { city: f.city.input.value.trim(), lat: Number(f.lat.input.value) || 0, lon: Number(f.lon.input.value) || 0 },
      links: links.value.split('\n').map((line) => line.split('|')).filter((parts) => parts[0]?.trim()).map((parts) => ({ label: parts[0].trim(), href: (parts[1] || '').trim() })),
    };
    if (f.password.input.value) nextSite.admin = { password: f.password.input.value };
    const nextProfile = {
      ...profile,
      operator: f.operator.input.value.trim(),
      alias: f.alias.input.value.trim(),
      title: f.title.input.value.trim(),
      clearance: f.clearance.input.value.trim(),
      station: f.pstation.input.value.trim(),
      status: f.status.input.value.trim(),
      fileNo: f.fileNo.input.value.trim(),
      photoLabel: f.photoLabel.input.value.trim(),
      bio: f.bio.input.value,
      skills: f.skills.input.value.split(',').map((item) => item.trim()).filter(Boolean),
    };
    return { site: nextSite, profile: nextProfile, activity: { generatedAt: new Date().toISOString().slice(0, 10), days } };
  }

  const save = () => {
    saveOverride(collect());
    status.textContent = '已保存到本机，正在刷新…';
    window.setTimeout(() => window.location.reload(), 400);
  };

  const push = async () => {
    const token = pat.value.trim();
    if (!token) { status.textContent = '需要先填 GitHub token'; return; }
    localStorage.setItem(PAT_KEY, token);
    status.textContent = '正在提交…';
    try {
      const payload = collect();
      await commitFile(site.repo, 'public/content/site.json', payload.site, token);
      await commitFile(site.repo, 'public/content/profile.json', payload.profile, token);
      await commitFile(site.repo, 'public/content/activity.json', payload.activity, token);
      status.textContent = '已提交到仓库，约 1 分钟后构建完成。';
    } catch (error) {
      status.textContent = `提交失败：${error.message}`;
    }
  };

  const box = (title, ...children) => el('section', { class: 'datacard' }, el('header', { class: 'datacard__head' }, el('h2', { class: 'datacard__title', text: title })), ...children);

  return {
    el: el('section', { class: 'page' },
      el('div', { class: 'container' },
        el('div', { class: 'admin__head' },
          el('div', { class: 'admin__kicker', text: 'ADMINISTRATOR MODE' }),
          el('h1', { class: 'admin__title', text: 'EDIT ARCHIVE' }),
          el('div', { class: 'link-row' },
            el('button', { class: 'btn btn--play', type: 'button', text: '保存到本机', onClick: save }),
            el('button', { class: 'btn', type: 'button', text: '提交到仓库', onClick: push }),
            el('button', { class: 'btn', type: 'button', text: '退出', onClick: () => { sessionStorage.removeItem(SESSION_KEY); window.location.reload(); } }),
            el('button', { class: 'btn', type: 'button', text: '丢弃本机修改', onClick: () => { clearOverride(); window.location.reload(); } }),
          ),
        ),
        el('div', { class: 'admin__grid' },
          box('SITE', f.name.node, f.handle.node, f.role.node, f.location.node, f.station.node, f.intro.node, f.city.node, f.lat.node, f.lon.node, f.password.node),
          box('OPERATOR', f.operator.node, f.alias.node, f.title.node, f.clearance.node, f.pstation.node, f.status.node, f.fileNo.node, f.photoLabel.node, f.bio.node, f.skills.node),
          box('LINKS', links),
          box('ACTIVITY // 点击格子 +1', heatSlot),
          box('PUBLISH', pat, el('p', { class: 'admin__hint', text: 'token 只存本机。没 token 时保存只在当前浏览器生效。' }), status),
        ),
      ),
    ),
    destroy() {},
  };
}

export function pageAdmin({ content }) {
  return isAuthed() ? editorView({ content }) : loginView(content.site);
}
