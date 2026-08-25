interface SkillMeta {
  name: string;
  description: string;
  path: string;
  category: string;
  tags: string[];
  author: string;
  version: string;
  source: "custom" | "upstream" | "forked";
  upstream_url?: string;
  repo?: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface HubIndex {
  version: number;
  updated_at: string;
  categories: Category[];
  skills: SkillMeta[];
}

interface Env {
  SKILL_CACHE: KVNamespace;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  SKILLS_PATH: string;
}

const CACHE_TTL = 300;
const CACHE_TTL_LONG = 1800;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60",
    },
  });
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" },
  });
}

function rawResponse(text: string, contentType = "text/markdown"): Response {
  return new Response(text, {
    headers: { "Content-Type": `${contentType}; charset=utf-8`, "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" },
  });
}

async function fetchRaw(path: string, env: Env): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${env.GITHUB_REPO}/${env.GITHUB_BRANCH}/${path}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.text();
}

async function getIndex(env: Env): Promise<HubIndex> {
  const cached = await env.SKILL_CACHE.get<HubIndex>("hub:index", "json");
  if (cached) return cached;
  const text = await fetchRaw(`${env.SKILLS_PATH}/index.json`, env);
  if (!text) return { version: 1, updated_at: new Date().toISOString(), categories: [], skills: [] };
  const index: HubIndex = JSON.parse(text);
  await env.SKILL_CACHE.put("hub:index", JSON.stringify(index), { expirationTtl: CACHE_TTL });
  return index;
}

async function getSkillMd(skillPath: string, env: Env): Promise<string | null> {
  const cacheKey = `skill:${skillPath}:md`;
  const cached = await env.SKILL_CACHE.get(cacheKey);
  if (cached) return cached;
  const text = await fetchRaw(`${env.SKILLS_PATH}/${skillPath}/SKILL.md`, env);
  if (!text) return null;
  await env.SKILL_CACHE.put(cacheKey, text, { expirationTtl: CACHE_TTL_LONG });
  return text;
}

function parseFrontmatter(md: string): { body: string; frontmatter: Record<string, string> } {
  const match = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { body: md, frontmatter: {} };
  const fm: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return { body: match[2].trim(), frontmatter: fm };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const PAGE_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#ffffff;--bg2:#f6f8fa;--bg3:#eef1f5;
  --border:#d0d7de;--border2:#d8dee4;
  --fg:#1f2328;--fg2:#656d76;--fg3:#8b949e;
  --accent:#0969da;--accent-hover:#0550ae;
  --green:#1a7f37;--green-bg:#dafbe1;--green-border:#4ac26b;
  --purple:#8250df;--purple-bg:#f5f0ff;--purple-border:#d8b4fe;
  --orange:#bc4c00;--orange-bg:#fff1e5;--orange-border:#fb8f44;
  --red:#cf222e;
  --radius:6px;--radius-md:8px;--radius-lg:12px;
  --font:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC",Helvetica,Arial,sans-serif;
  --mono:"SF Mono",Monaco,Consolas,"Liberation Mono",monospace;
}
@media(prefers-color-scheme:dark){
  :root{
    --bg:#0d1117;--bg2:#161b22;--bg3:#21262d;
    --border:#30363d;--border2:#30363d;
    --fg:#e6edf3;--fg2:#8b949e;--fg3:#6e7681;
    --accent:#2f81f7;--accent-hover:#58a6ff;
    --green:#3fb950;--green-bg:#033a16;--green-border:#238636;
    --purple:#bc8cff;--purple-bg:#1f1f3a;--purple-border:#8957e5;
    --orange:#d29922;--orange-bg:#3b2a0e;--orange-border:#9e6a03;
    --red:#f85149;
  }
}
html{font-size:15px}
body{font-family:var(--font);background:var(--bg);color:var(--fg);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}
a:hover{color:var(--accent-hover);text-decoration:underline}
code{font-family:var(--mono);font-size:.87em}
.container{max-width:1012px;margin:0 auto;padding:0 24px}

/* Header */
.header{border-bottom:1px solid var(--border);background:var(--bg2)}
.header-inner{display:flex;align-items:center;gap:16px;padding:12px 24px;max-width:1280px;margin:0 auto}
.brand{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:600;color:var(--fg);text-decoration:none;white-space:nowrap}
.brand:hover{text-decoration:none;color:var(--fg)}
.brand-icon{font-size:20px}
.install-box{display:flex;align-items:center;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);flex:1;max-width:480px;min-width:0}
.install-box code{flex:1;padding:6px 10px;font-size:12px;color:var(--green);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);border-right:1px solid var(--border)}
.install-box button{background:transparent;border:none;color:var(--fg2);padding:6px 10px;font-size:12px;cursor:pointer;border-radius:0 var(--radius) var(--radius) 0;white-space:nowrap}
.install-box button:hover{background:var(--bg3);color:var(--fg)}
.header-links{display:flex;gap:16px;margin-left:auto}
.header-links a{color:var(--fg2);font-size:14px}
.header-links a:hover{color:var(--accent);text-decoration:none}

/* Hero */
.hero{text-align:center;padding:48px 24px 32px;max-width:720px;margin:0 auto}
.hero h1{font-size:32px;font-weight:700;letter-spacing:-.02em;margin-bottom:8px}
.hero .subtitle{font-size:16px;color:var(--fg2);margin-bottom:24px}
.hero-badge{display:inline-flex;align-items:center;gap:6px;background:var(--green-bg);border:1px solid var(--green-border);color:var(--green);border-radius:2em;padding:3px 12px;font-size:12px;font-weight:500;margin-bottom:16px}
.stats{display:flex;gap:32px;justify-content:center}
.stat{text-align:center}
.stat-num{font-size:24px;font-weight:600;color:var(--fg)}
.stat-label{font-size:12px;color:var(--fg3);text-transform:uppercase;letter-spacing:.04em}

/* Search */
.search-wrap{max-width:1012px;margin:0 auto 20px;padding:0 24px}
.search-input{width:100%;padding:8px 12px;font-size:14px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--fg);outline:none;font-family:var(--font)}
.search-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(9,105,218,.15)}
.search-input::placeholder{color:var(--fg3)}

/* Categories */
.cats{max-width:1012px;margin:0 auto 24px;padding:0 24px;display:flex;gap:6px;flex-wrap:wrap}
.cat-btn{display:inline-flex;align-items:center;gap:5px;background:transparent;border:1px solid var(--border);border-radius:2em;padding:4px 12px;font-size:13px;color:var(--fg2);cursor:pointer;transition:.1s;white-space:nowrap;font-family:var(--font)}
.cat-btn:hover{border-color:var(--accent);color:var(--fg);background:var(--bg)}
.cat-btn.active{background:var(--accent);border-color:var(--accent);color:#fff}
.cat-btn .count{font-size:11px;color:var(--fg3);background:var(--bg3);border-radius:10px;padding:0 6px;line-height:18px}
.cat-btn.active .count{background:rgba(255,255,255,.2);color:#fff}

/* Repo list - GitHub style */
.repo-list{max-width:1012px;margin:0 auto;padding:0 24px 64px}
.repo-item{padding:16px 0;border-bottom:1px solid var(--border)}
.repo-item:last-child{border-bottom:none}
.repo-item.hidden{display:none}
.repo-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.repo-name{font-size:16px;font-weight:600}
.repo-name a{color:var(--accent);text-decoration:none}
.repo-name a:hover{text-decoration:underline}
.repo-name .prefix{color:var(--fg2);font-weight:400}
.badge{font-size:11px;font-weight:500;padding:1px 7px;border-radius:2em;border:1px solid;line-height:18px}
.badge-custom{color:var(--green);background:var(--green-bg);border-color:var(--green-border)}
.badge-upstream{color:var(--purple);background:var(--purple-bg);border-color:var(--purple-border)}
.badge-forked{color:var(--orange);background:var(--orange-bg);border-color:var(--orange-border)}
.repo-version{font-size:12px;color:var(--fg3);font-family:var(--mono)}
.repo-desc{font-size:14px;color:var(--fg2);margin-bottom:8px;line-height:1.5}
.repo-meta{display:flex;align-items:center;gap:16px;font-size:12px;color:var(--fg3);flex-wrap:wrap}
.repo-meta .tag{display:inline-block;color:var(--accent);font-size:12px}
.repo-meta .tag:hover{text-decoration:underline}
.repo-meta .author{display:inline-flex;align-items:center;gap:3px}
.install-inline{display:inline-flex;align-items:center;gap:4px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:2px 6px;font-family:var(--mono);font-size:11px;color:var(--fg2);cursor:pointer;transition:.1s}
.install-inline:hover{border-color:var(--accent);color:var(--accent)}
.install-inline code{display:none}
.empty{text-align:center;padding:48px 24px;color:var(--fg3);font-size:14px}
.empty-icon{font-size:32px;margin-bottom:8px;opacity:.6}

/* Skill detail page */
.breadcrumb{padding:16px 0;font-size:14px}
.breadcrumb a{color:var(--fg2)}
.skill-title{padding-bottom:16px;border-bottom:1px solid var(--border);margin-bottom:24px}
.skill-title h1{font-size:28px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.skill-desc{font-size:16px;color:var(--fg2);margin-bottom:12px}
.skill-badges{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.skill-tags{display:flex;gap:4px;flex-wrap:wrap}
.skill-tags .tag{font-size:12px;color:var(--accent)}
.install-block{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;margin-bottom:24px}
.install-block .label{font-size:12px;font-weight:600;color:var(--fg);margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em}
.install-row{display:flex;gap:0;align-items:stretch;margin-bottom:0}
.install-row code{flex:1;display:block;background:var(--bg);border:1px solid var(--border);border-right:none;border-radius:var(--radius) 0 0 var(--radius);padding:8px 12px;font-size:13px;color:var(--fg);font-family:var(--mono);overflow-x:auto;white-space:nowrap}
.install-row button{background:var(--bg);border:1px solid var(--border);border-radius:0 var(--radius) var(--radius) 0;color:var(--fg2);padding:8px 14px;font-size:13px;cursor:pointer;font-family:var(--font);white-space:nowrap;transition:.1s}
.install-row button:hover{background:var(--accent);color:#fff;border-color:var(--accent)}
.info-table{margin-bottom:24px}
.info-row{display:flex;padding:8px 0;border-bottom:1px solid var(--border2);font-size:14px}
.info-row:last-child{border-bottom:none}
.info-row .info-label{width:120px;color:var(--fg3);font-weight:500;flex-shrink:0}
.info-row .info-val{color:var(--fg2);font-family:var(--mono);font-size:13px;word-break:break-all}
.info-row .info-val.plain{font-family:var(--font)}
.markdown-body h2{font-size:20px;font-weight:600;margin:32px 0 16px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.markdown-body h2:first-child{margin-top:0}
.markdown-body h3{font-size:17px;font-weight:600;margin:24px 0 12px}
.markdown-body p{margin-bottom:12px;color:var(--fg);line-height:1.7}
.markdown-body ul,.markdown-body ol{margin-bottom:12px;padding-left:24px;color:var(--fg)}
.markdown-body li{margin-bottom:4px;line-height:1.7}
.markdown-body code{background:var(--bg3);padding:2px 6px;border-radius:4px;font-size:85%;color:var(--accent)}
.markdown-body pre{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;overflow-x:auto;margin-bottom:16px;line-height:1.5}
.markdown-body pre code{background:none;padding:0;font-size:13px;color:var(--fg);border-radius:0}
.markdown-body blockquote{border-left:3px solid var(--border);padding-left:16px;color:var(--fg2);margin-bottom:12px}
.markdown-body a{color:var(--accent)}
.markdown-body strong{font-weight:600;color:var(--fg)}
.markdown-body table{border-collapse:collapse;margin-bottom:16px;width:100%}
.markdown-body th,.markdown-body td{border:1px solid var(--border);padding:6px 12px;font-size:14px;text-align:left}
.markdown-body th{background:var(--bg2);font-weight:600}
.page-footer{margin-top:48px;padding:24px 0;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--fg3);flex-wrap:wrap;gap:8px}
.page-footer a{color:var(--fg2)}
`;

const SHARED_JS = `
function copyText(btn) {
  const code = btn.previousElementSibling;
  navigator.clipboard.writeText(code.textContent);
  const orig = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = orig, 1500);
}
`;

function renderHubPage(index: HubIndex): string {
  const skillsByCategory: Record<string, SkillMeta[]> = {};
  for (const s of index.skills) {
    if (!skillsByCategory[s.category]) skillsByCategory[s.category] = [];
    skillsByCategory[s.category].push(s);
  }

  const catButtons = index.categories
    .map((c) => {
      const count = skillsByCategory[c.id]?.length ?? 0;
      return `<button class="cat-btn" data-cat="${c.id}" onclick="setCat('${c.id}')"><span>${c.icon}</span> ${escapeHtml(c.name)} <span class="count">${count}</span></button>`;
    })
    .join("");

  const totalCustom = index.skills.filter((s) => s.source === "custom").length;

  const items = index.skills
    .map((s) => {
      const cat = index.categories.find((c) => c.id === s.category);
      const tagHtml = s.tags.map((t) => `<a class="tag" href="#" onclick="filterTag('${escapeHtml(t)}');return false">#${escapeHtml(t)}</a>`).join(" ");
      const sourceBadge = s.source === "custom"
        ? '<span class="badge badge-custom">Custom</span>'
        : s.source === "upstream"
          ? '<span class="badge badge-upstream">Upstream</span>'
          : '<span class="badge badge-forked">Forked</span>';
      const installCmd = `npx -y skills add skill.alanzeng.com --skill ${s.path} --yes`;
      return `<div class="repo-item" data-cat="${s.category}" data-name="${escapeHtml(s.name).toLowerCase()}" data-desc="${escapeHtml(s.description).toLowerCase()}" data-tags="${s.tags.join(",").toLowerCase()}">
  <div class="repo-head">
    <span class="repo-name"><span class="prefix">${cat?.icon ?? "📌"} </span><a href="/skills/${s.path}">${escapeHtml(s.name)}</a></span>
    ${sourceBadge}
    <span class="repo-version">v${escapeHtml(s.version)}</span>
  </div>
  <p class="repo-desc">${escapeHtml(s.description)}</p>
  <div class="repo-meta">
    <span class="author">@${escapeHtml(s.author)}</span>
    ${tagHtml ? `<span>${tagHtml}</span>` : ""}
    <span class="install-inline" onclick="copyText(this)"><code>${escapeHtml(installCmd)}</code> Install</span>
  </div>
</div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Alan's Skill Hub</title>
<style>${PAGE_CSS}</style>
</head>
<body>

<header class="header">
  <div class="header-inner">
    <a href="/" class="brand"><span class="brand-icon">⚡</span> Alan's Skill Hub</a>
    <div class="install-box">
      <code>npx -y skills add skill.alanzeng.com --skill '*' --yes</code>
      <button onclick="copyText(this)">Copy</button>
    </div>
    <nav class="header-links">
      <a href="/api/skills">API</a>
      <a href="https://github.com/alanzeng423/skill-hub" target="_blank" rel="noopener">GitHub</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="hero-badge">● Personal Skill Registry</div>
  <h1>Skills for AI Agents</h1>
  <p class="subtitle">A curated collection of custom, forked, and upstream AI agent skills.</p>
  <div class="stats">
    <div class="stat"><div class="stat-num" id="totalCount">${index.skills.length}</div><div class="stat-label">Skills</div></div>
    <div class="stat"><div class="stat-num">${index.categories.length}</div><div class="stat-label">Categories</div></div>
    <div class="stat"><div class="stat-num">${totalCustom}</div><div class="stat-label">Custom</div></div>
  </div>
</section>

<div class="search-wrap">
  <input class="search-input" type="text" id="q" placeholder="Search skills by name, description, or tag..." oninput="apply()">
</div>

<div class="cats">
  <button class="cat-btn active" data-cat="all" onclick="setCat('all')"><span>📚</span> All <span class="count">${index.skills.length}</span></button>
  ${catButtons}
</div>

<div class="repo-list">
  ${items}
  <div class="empty" id="empty" style="display:none"><div class="empty-icon">🔍</div><p>No skills match your search.</p></div>
</div>

<div class="container page-footer">
  <span>© 2026 Alan</span>
  <div>
    <a href="/api/skills">JSON API</a> · <a href="/install.sh">Install Script</a> · <a href="https://github.com/alanzeng423/skill-hub" target="_blank" rel="noopener">Source</a>
  </div>
</div>

<script>
${SHARED_JS}
let activeCat='all';
function setCat(cat){activeCat=cat;document.querySelectorAll('.cat-btn').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));apply()}
function filterTag(t){document.getElementById('q').value=t;apply()}
function apply(){
  const q=document.getElementById('q').value.toLowerCase().trim();
  let vis=0;
  document.querySelectorAll('.repo-item').forEach(el=>{
    const ok=activeCat==='all'||el.dataset.cat===activeCat;
    const m=!q||el.dataset.name.includes(q)||el.dataset.desc.includes(q)||el.dataset.tags.split(',').some(t=>t.includes(q));
    el.classList.toggle('hidden',!(ok&&m));
    if(ok&&m)vis++;
  });
  document.getElementById('empty').style.display=vis?'none':'block';
}
</script>
</body>
</html>`;
}

function renderSkillPage(skill: SkillMeta, md: string, index: HubIndex): string {
  const { body } = parseFrontmatter(md);
  const cat = index.categories.find((c) => c.id === skill.category);
  const sourceBadge = skill.source === "custom"
    ? '<span class="badge badge-custom">Custom</span>'
    : skill.source === "upstream"
      ? '<span class="badge badge-upstream">Upstream</span>'
      : '<span class="badge badge-forked">Forked</span>';
  const installCmd = `npx -y skills add skill.alanzeng.com --skill ${skill.path} --yes`;
  const tagsHtml = skill.tags.map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join(" ");
  const escapedBody = JSON.stringify(body);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(skill.name)} · Alan's Skill Hub</title>
<style>${PAGE_CSS}</style>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
</head>
<body>
<header class="header">
  <div class="header-inner">
    <a href="/" class="brand"><span class="brand-icon">⚡</span> Alan's Skill Hub</a>
    <nav class="header-links">
      <a href="/api/skills">API</a>
      <a href="https://github.com/alanzeng423/skill-hub" target="_blank" rel="noopener">GitHub</a>
    </nav>
  </div>
</header>

<div class="container">
  <nav class="breadcrumb"><a href="/">← All skills</a></nav>

  <div class="skill-title">
    <h1>${cat?.icon ?? "📌"} ${escapeHtml(skill.name)} ${sourceBadge}</h1>
    <p class="skill-desc">${escapeHtml(skill.description)}</p>
    <div class="skill-badges">
      <span class="repo-version">v${escapeHtml(skill.version)}</span>
      <span>@${escapeHtml(skill.author)}</span>
      <span>${cat?.icon ?? "📌"} ${escapeHtml(cat?.name ?? "Other")}</span>
    </div>
    <div class="skill-tags">${tagsHtml}</div>
  </div>

  <div class="install-block">
    <div class="label">Install</div>
    <div class="install-row">
      <code>${escapeHtml(installCmd)}</code>
      <button onclick="copyText(this)">Copy</button>
    </div>
  </div>

  <div class="info-table">
    <div class="info-row"><span class="info-label">Author</span><span class="info-val plain">@${escapeHtml(skill.author)}</span></div>
    <div class="info-row"><span class="info-label">Version</span><span class="info-val plain">${escapeHtml(skill.version)}</span></div>
    <div class="info-row"><span class="info-label">Source</span><span class="info-val plain">${escapeHtml(skill.source)}</span></div>
    <div class="info-row"><span class="info-label">Category</span><span class="info-val plain">${cat?.name ?? "Other"}</span></div>
    ${skill.upstream_url ? `<div class="info-row"><span class="info-label">Upstream</span><span class="info-val"><a href="${escapeHtml(skill.upstream_url)}" target="_blank" rel="noopener">${escapeHtml(skill.upstream_url)}</a></span></div>` : ""}
    <div class="info-row"><span class="info-label">GitHub</span><span class="info-val"><a href="https://github.com/alanzeng423/skill-hub/tree/main/skills/${skill.path}" target="_blank" rel="noopener">View on GitHub →</a></span></div>
    <div class="info-row"><span class="info-label">Raw</span><span class="info-val"><a href="/skills/${skill.path}/SKILL.md">SKILL.md</a></span></div>
  </div>

  <div class="markdown-body" id="content"></div>

  <footer class="page-footer">
    <a href="/">← Alan's Skill Hub</a>
    <div>
      <a href="/api/skills/${skill.path}">JSON</a> ·
      <a href="/skills/${skill.path}/SKILL.md">Raw</a> ·
      <a href="https://github.com/alanzeng423/skill-hub/tree/main/skills/${skill.path}" target="_blank" rel="noopener">GitHub</a>
    </div>
  </footer>
</div>

<script>
${SHARED_JS}
const md = ${escapedBody};
marked.setOptions({gfm:true,breaks:false});
document.getElementById('content').innerHTML = marked.parse(md);
</script>
</body>
</html>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    try {
      const index = await getIndex(env);

      if (path === "/api/skills" || path === "/skills.json") {
        return jsonResponse({
          name: "skill-hub",
          description: "Personal skill registry by alanzeng",
          url: "https://skill.alanzeng.com",
          install: "npx -y skills add skill.alanzeng.com --skill '*' --yes",
          categories: index.categories,
          skills: index.skills,
          total: index.skills.length,
          updated_at: index.updated_at,
        });
      }

      if (path === "/api/categories") return jsonResponse(index.categories);

      const skillApiMatch = path.match(/^\/api\/skills\/([^/]+)$/);
      if (skillApiMatch) {
        const skill = index.skills.find((s) => s.path === skillApiMatch[1]);
        if (!skill) return jsonResponse({ error: "Skill not found" }, 404);
        const md = await getSkillMd(skill.path, env);
        const { body, frontmatter } = md ? parseFrontmatter(md) : { body: "", frontmatter: {} };
        return jsonResponse({
          ...skill,
          install: `npx -y skills add skill.alanzeng.com --skill ${skill.path} --yes`,
          raw_url: `https://skill.alanzeng.com/skills/${skill.path}/SKILL.md`,
          github_url: `https://github.com/${env.GITHUB_REPO}/tree/${env.GITHUB_BRANCH}/${env.SKILLS_PATH}/${skill.path}`,
          body,
          frontmatter,
        });
      }

      const rawMatch = path.match(/^\/skills\/([^/]+)\/SKILL\.md$/);
      if (rawMatch) {
        const md = await getSkillMd(rawMatch[1], env);
        if (!md) return new Response("Not found", { status: 404 });
        return rawResponse(md);
      }

      const rawFileMatch = path.match(/^\/skills\/([^/]+)\/(.+)$/);
      if (rawFileMatch) {
        const [, skillPath, filePath] = rawFileMatch;
        if (filePath === "SKILL.md") {
          const md = await getSkillMd(skillPath, env);
          if (!md) return new Response("Not found", { status: 404 });
          return rawResponse(md);
        }
        const text = await fetchRaw(`${env.SKILLS_PATH}/${skillPath}/${filePath}`, env);
        if (!text) return new Response("Not found", { status: 404 });
        const ext = filePath.split(".").pop() ?? "";
        const ct: Record<string, string> = { md: "text/markdown", json: "application/json", js: "application/javascript", ts: "application/typescript", py: "text/x-python", sh: "text/x-sh", yaml: "text/yaml", yml: "text/yaml", txt: "text/plain" };
        return rawResponse(text, ct[ext] ?? "application/octet-stream");
      }

      const pageMatch = path.match(/^\/skills\/([^/]+)$/);
      if (pageMatch) {
        const skill = index.skills.find((s) => s.path === pageMatch[1]);
        if (!skill) return new Response("Not found", { status: 404 });
        const md = (await getSkillMd(skill.path, env)) ?? `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n# ${skill.name}\n\n${skill.description}`;
        return htmlResponse(renderSkillPage(skill, md, index));
      }

      if (path === "/install.sh" || path === "/install") {
        const lines = [
          "#!/bin/bash",
          'echo "Installing skills from skill.alanzeng.com..."',
          "if command -v npx &>/dev/null; then",
          '  npx -y skills add skill.alanzeng.com --skill \'*\' --yes',
          '  echo "Done. Restart your agent."',
          "else",
          '  echo "Install Node.js first: https://nodejs.org"',
          "fi",
        ];
        return new Response(lines.join("\n"), { headers: { "Content-Type": "text/x-sh; charset=utf-8", "Access-Control-Allow-Origin": "*" } });
      }

      if (path === "/health" || path === "/healthz") {
        return jsonResponse({ status: "ok", skills: index.skills.length, timestamp: new Date().toISOString() });
      }

      if (path === "/" || path === "/index.html") {
        const accept = request.headers.get("Accept") ?? "";
        if (accept.includes("application/json")) {
          return jsonResponse({
            name: "skill-hub", url: "https://skill.alanzeng.com",
            install: "npx -y skills add skill.alanzeng.com --skill '*' --yes",
            total_skills: index.skills.length, categories_count: index.categories.length,
            endpoints: { skills: "/api/skills", categories: "/api/categories", skill: "/api/skills/:name", raw: "/skills/:name/SKILL.md", install: "/install.sh" },
          });
        }
        return htmlResponse(renderHubPage(index));
      }

      return new Response("Not found", { status: 404 });
    } catch (err) {
      return jsonResponse({ error: String(err) }, 500);
    }
  },
};
