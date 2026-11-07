const CACHE = new Map();

async function fetchJson(url) {
  if (CACHE.has(url)) return CACHE.get(url);
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const data = await res.json();
  CACHE.set(url, data);
  return data;
}

const EMPTY_SITE = {
  name: 'TIPHERETH',
  handle: 'tangpangpang5',
  role: '',
  slogan: '',
  intro: '',
  links: []
};

/** 内容层：site / posts / works 三份 JSON，缺失时给空结构而不是抛错。 */
export async function loadContent() {
  const [site, posts, works] = await Promise.all([
    fetchJson('content/site.json').catch(() => EMPTY_SITE),
    fetchJson('content/posts.json').catch(() => []),
    fetchJson('content/works.json').catch(() => [])
  ]);

  const sortedPosts = [...posts].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return {
    site: { ...EMPTY_SITE, ...site },
    posts: sortedPosts,
    works: [...works].sort((a, b) => (b.year || 0) - (a.year || 0))
  };
}
