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
}

interface Category {
  id: string;
  name: string;
  icon: string;
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
const HUB_URL = "https://skill.alanzeng.com";

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

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#ffffff;--bg-sub:#f6f8fa;--bg-muted:#eaeef2;
  --border:#d0d7de;--border-muted:#d8dee4;
  --fg:#1f2328;--fg-muted:#656d76;--fg-subtle:#8c959f;
  --link:#0969da;--link-hover:#0550ae;
  --red:#cf222e;--green:#1a7f37;--purple:#8250df;--orange:#bc4c00;
  --code-bg:rgba(175,184,193,.2);--pre-bg:#f6f8fa;
  --radius:6px;
  --font:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC",Helvetica,Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
}
@media(prefers-color-scheme:dark){
  :root{
    --bg:#0d1117;--bg-sub:#161b22;--bg-muted:#21262d;
    --border:#30363d;--border-muted:#30363d;
    --fg:#e6edf3;--fg-muted:#8b949e;--fg-subtle:#6e7681;
    --link:#2f81f7;--link-hover:#58a6ff;
    --red:#f85149;--green:#3fb950;--purple:#bc8cff;--orange:#d29922;
    --code-bg:rgba(110,118,129,.4);--pre-bg:#161b22;
  }
}
html{font-size:14px;line-height:1.5}
body{font-family:var(--font);background:var(--bg);color:var(--fg);-webkit-font-smoothing:antialiased}
a{color:var(--link);text-decoration:none}
a:hover{color:var(--link-hover);text-decoration:underline}
code,pre{font-family:var(--mono)}
.container{max-width:1012px;margin:0 auto;padding:0 16px}

/* Header - GitHub style */
.site-header{background:var(--bg-sub);border-bottom:1px solid var(--border);padding:12px 0}
.site-header .container{display:flex;align-items:center;gap:16px}
.brand{font-size:16px;font-weight:700;color:var(--red);white-space:nowrap;display:flex;align-items:center;gap:6px}
.brand:hover{color:var(--red);text-decoration:none;opacity:.9}
.brand-dot{width:8px;height:8px;border-radius:50%;background:var(--red);display:inline-block}
.header-install{display:flex;align-items:center;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);flex:1;max-width:460px;min-width:0}
.header-install code{flex:1;padding:5px 10px;font-size:12px;color:var(--green);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-right:1px solid var(--border)}
.header-install button{background:transparent;border:none;color:var(--fg-muted);padding:5px 10px;font-size:12px;cursor:pointer;border-radius:0 var(--radius) var(--radius) 0;white-space:nowrap;font-family:var(--font)}
.header-install button:hover{background:var(--bg-muted);color:var(--fg)}
.header-nav{display:flex;gap:16px;margin-left:auto}
.header-nav a{color:var(--fg-muted);font-size:14px}
.header-nav a:hover{color:var(--link);text-decoration:none}

/* Page title area */
.page-head{padding:32px 0 24px}
.page-head h1{font-size:24px;font-weight:600;letter-spacing:-.01em;margin-bottom:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.page-head .desc{color:var(--fg-muted);font-size:14px}
.page-head .meta{display:flex;gap:16px;margin-top:8px;font-size:12px;color:var(--fg-subtle)}
.page-head .meta strong{color:var(--fg);font-weight:600}

/* Search */
.search-bar{margin-bottom:16px}
.search-bar input{width:100%;padding:5px 12px;font-size:14px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--fg);outline:none;font-family:var(--font);line-height:20px}
.search-bar input:focus{border-color:var(--link);box-shadow:0 0 0 3px rgba(9,105,218,.3)}
.search-bar input::placeholder{color:var(--fg-subtle)}

/* Category filters */
.cats{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)}
.cat-btn{background:transparent;border:1px solid transparent;border-radius:2em;padding:3px 10px;font-size:12px;color:var(--fg-muted);cursor:pointer;transition:.1s;white-space:nowrap;font-family:var(--font);line-height:20px}
.cat-btn:hover{border-color:var(--border);color:var(--fg)}
.cat-btn.active{background:var(--bg-muted);border-color:transparent;color:var(--fg);font-weight:500}
.cat-btn .cnt{color:var(--fg-subtle);margin-left:4px}

/* Skill list */
.skill-list{padding:0 0 64px}
.skill-item{padding:24px 0;border-bottom:1px solid var(--border)}
.skill-item:last-child{border-bottom:none}
.skill-item.hidden{display:none}
.skill-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px}
.skill-title{font-size:16px;font-weight:600}
.skill-title a{color:var(--link);text-decoration:none}
.skill-title a:hover{text-decoration:underline}
.badge{font-size:11px;font-weight:500;padding:0 7px;border-radius:2em;border:1px solid;line-height:18px}
.badge-custom{color:var(--green);background:rgba(26,127,55,.1);border-color:rgba(26,127,55,.4)}
.badge-upstream{color:var(--purple);background:rgba(130,80,223,.1);border-color:rgba(130,80,223,.4)}
.badge-forked{color:var(--orange);background:rgba(188,76,0,.1);border-color:rgba(188,76,0,.4)}
.skill-ver{font-size:12px;color:var(--fg-subtle);font-family:var(--mono)}
.skill-desc{font-size:14px;color:var(--fg-muted);margin:4px 0 8px;line-height:1.5}
.skill-foot{display:flex;align-items:center;gap:16px;font-size:12px;color:var(--fg-subtle);flex-wrap:wrap}
.skill-foot .tag{color:var(--link)}
.skill-foot .tag:hover{text-decoration:underline;cursor:pointer}
.install-btn{display:inline-flex;align-items:center;gap:4px;background:var(--bg-sub);border:1px solid var(--border);border-radius:var(--radius);padding:2px 8px;font-family:var(--mono);font-size:11px;color:var(--fg-muted);cursor:pointer;transition:.1s;line-height:20px}
.install-btn:hover{border-color:var(--link);color:var(--link)}
.empty{text-align:center;padding:64px 16px;color:var(--fg-subtle);font-size:14px}

/* Skill detail */
.breadcrumb{padding:16px 0;font-size:14px;color:var(--fg-muted)}
.breadcrumb a{color:var(--fg-muted)}
.breadcrumb a:hover{color:var(--link)}
.detail-head{padding-bottom:16px;border-bottom:1px solid var(--border);margin-bottom:24px}
.detail-head h1{font-size:24px;font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.detail-desc{font-size:16px;color:var(--fg-muted);margin-bottom:8px}
.detail-meta{display:flex;gap:16px;font-size:12px;color:var(--fg-subtle);flex-wrap:wrap;align-items:center}
.detail-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.detail-tags .tag{font-size:12px;color:var(--link)}

.install-box{background:var(--bg-sub);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;margin-bottom:24px;display:flex;align-items:center;gap:8px}
.install-box code{flex:1;font-size:13px;color:var(--green);font-family:var(--mono);overflow-x:auto;white-space:nowrap}
.install-box button{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--fg-muted);padding:4px 12px;font-size:12px;cursor:pointer;font-family:var(--font);line-height:20px;transition:.1s;flex-shrink:0}
.install-box button:hover{background:var(--link);color:#fff;border-color:var(--link)}

.info-table{margin-bottom:24px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.info-row{display:flex;padding:8px 16px;border-bottom:1px solid var(--border);font-size:13px}
.info-row:last-child{border-bottom:none}
.info-row:nth-child(odd){background:var(--bg-sub)}
.info-row .k{width:100px;color:var(--fg-muted);font-weight:500;flex-shrink:0}
.info-row .v{color:var(--fg);word-break:break-all;font-family:var(--mono);font-size:12px}
.info-row .v a{color:var(--link)}
.info-row .v.plain{font-family:var(--font);font-size:13px}

/* Markdown body - GitHub style */
.markdown-body{font-size:14px;line-height:1.6;word-wrap:break-word}
.markdown-body h1,.markdown-body h2,.markdown-body h3,.markdown-body h4{margin-top:24px;margin-bottom:16px;font-weight:600;line-height:1.25}
.markdown-body h1{font-size:2em;padding-bottom:.3em;border-bottom:1px solid var(--border)}
.markdown-body h2{font-size:1.5em;padding-bottom:.3em;border-bottom:1px solid var(--border)}
.markdown-body h3{font-size:1.25em}
.markdown-body h4{font-size:1em}
.markdown-body p{margin-bottom:16px;color:var(--fg);line-height:1.7}
.markdown-body ul,.markdown-body ol{margin-bottom:16px;padding-left:2em;color:var(--fg)}
.markdown-body li{margin-bottom:4px;line-height:1.7}
.markdown-body li>p{margin-top:8px;margin-bottom:8px}
.markdown-body code{background:var(--code-bg);padding:.2em .4em;border-radius:6px;font-size:85%;color:var(--fg);font-family:var(--mono)}
.markdown-body pre{background:var(--pre-bg);border:1px solid var(--border);border-radius:var(--radius);padding:16px;overflow-x:auto;margin-bottom:16px;line-height:1.45;font-size:85%}
.markdown-body pre code{background:transparent;padding:0;border-radius:0;font-size:100%;display:block;white-space:pre;color:var(--fg)}
.markdown-body blockquote{border-left:.25em solid var(--border);padding:0 1em;color:var(--fg-muted);margin-bottom:16px}
.markdown-body blockquote p{color:var(--fg-muted)}
.markdown-body a{color:var(--link)}
.markdown-body strong{font-weight:600}
.markdown-body table{border-collapse:collapse;margin-bottom:16px;width:100%;display:block;overflow-x:auto}
.markdown-body th,.markdown-body td{border:1px solid var(--border);padding:6px 13px;font-size:14px}
.markdown-body th{background:var(--bg-sub);font-weight:600}
.markdown-body tr:nth-child(2n){background:var(--bg-sub)}
.markdown-body hr{height:1px;background:var(--border);border:0;margin:24px 0}
.markdown-body img{max-width:100%;box-sizing:content-box}

/* Footer */
.site-footer{margin-top:48px;padding:24px 0;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--fg-subtle);flex-wrap:wrap;gap:8px}
.site-footer a{color:var(--fg-muted)}
.site-footer a:hover{color:var(--link)}
`;

function copyJs(): string {
  return `function cp(b){const c=b.previousElementSibling||b.parentElement.querySelector('code');navigator.clipboard.writeText(c.textContent);const o=b.textContent;b.textContent='Copied!';setTimeout(()=>b.textContent=o,1500)}`;
}

function renderHubPage(index: HubIndex): string {
  const byCat: Record<string, SkillMeta[]> = {};
  for (const s of index.skills) { (byCat[s.category] ??= []).push(s); }

  const catBtns = index.categories
    .map(c => `<button class="cat-btn" data-cat="${c.id}" onclick="setCat('${c.id}')">${c.icon} ${escapeHtml(c.name)}<span class="cnt">${byCat[c.id]?.length ?? 0}</span></button>`)
    .join("");

  const items = index.skills.map(s => {
    const cat = index.categories.find(c => c.id === s.category);
    const tags = s.tags.map(t => `<a class="tag" onclick="filterTag('${escapeHtml(t)}');return false">#${escapeHtml(t)}</a>`).join(" ");
    const badge = s.source === "custom" ? "badge-custom" : s.source === "upstream" ? "badge-upstream" : "badge-forked";
    const cmd = `npx -y skills add ${HUB_URL.replace("https://","")} --skill ${s.path} --yes`;
    return `<div class="skill-item" data-cat="${s.category}" data-q="${(s.name+" "+s.description+" "+s.tags.join(" ")).toLowerCase()}">
  <div class="skill-head">
    <span class="skill-title"><a href="/skills/${s.path}">${cat?.icon ?? "📌"} ${escapeHtml(s.name)}</a></span>
    <span class="badge ${badge}">${s.source}</span>
    <span class="skill-ver">v${escapeHtml(s.version)}</span>
  </div>
  <p class="skill-desc">${escapeHtml(s.description)}</p>
  <div class="skill-foot">
    <span>@${escapeHtml(s.author)}</span>
    ${tags}
    <span class="install-btn" onclick="cp(this)"><code>${escapeHtml(cmd)}</code> Install</span>
  </div>
</div>`;
  }).join("");

  const totalCustom = index.skills.filter(s => s.source === "custom").length;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Alan's Skill Hub</title>
<style>${CSS}</style>
</head>
<body>
<header class="site-header"><div class="container">
  <a href="/" class="brand"><span class="brand-dot"></span>Alan's Skill Hub</a>
  <div class="header-install">
    <code>npx -y skills add skill.alanzeng.com --skill '*' --yes</code>
    <button onclick="cp(this)">Copy</button>
  </div>
  <nav class="header-nav">
    <a href="/api/skills">API</a>
    <a href="https://github.com/alanzeng423/skill-hub" target="_blank" rel="noopener">GitHub</a>
  </nav>
</div></header>

<main class="container">
  <div class="page-head">
    <h1><span class="brand-dot"></span> Skills</h1>
    <div class="meta">
      <span><strong>${index.skills.length}</strong> skills</span>
      <span><strong>${index.categories.length}</strong> categories</span>
      <span><strong>${totalCustom}</strong> custom</span>
    </div>
  </div>

  <div class="search-bar">
    <input type="text" id="q" placeholder="Search skills..." oninput="apply()">
  </div>

  <div class="cats">
    <button class="cat-btn active" data-cat="all" onclick="setCat('all')">All<span class="cnt">${index.skills.length}</span></button>
    ${catBtns}
  </div>

  <div class="skill-list">
    ${items}
    <div class="empty" id="empty" style="display:none">No matching skills.</div>
  </div>

  <footer class="site-footer">
    <span>© 2026 Alan Zeng</span>
    <div>
      <a href="/api/skills">JSON API</a> · <a href="/install.sh">Install Script</a> · <a href="https://github.com/alanzeng423/skill-hub" target="_blank" rel="noopener">Source</a>
    </div>
  </footer>
</main>

<script>${copyJs()}
let cat='all';
function setCat(c){cat=c;document.querySelectorAll('.cat-btn').forEach(b=>b.classList.toggle('active',b.dataset.cat===c));apply()}
function filterTag(t){document.getElementById('q').value=t;apply()}
function apply(){
  const q=document.getElementById('q').value.toLowerCase().trim();let n=0;
  document.querySelectorAll('.skill-item').forEach(el=>{
    const ok=cat==='all'||el.dataset.cat===cat;
    const m=!q||el.dataset.q.includes(q);
    el.classList.toggle('hidden',!(ok&&m));if(ok&&m)n++;
  });
  document.getElementById('empty').style.display=n?'none':'block';
}
</script>
</body></html>`;
}

function renderSkillPage(skill: SkillMeta, md: string, index: HubIndex): string {
  const { body } = parseFrontmatter(md);
  const cat = index.categories.find(c => c.id === skill.category);
  const badge = skill.source === "custom" ? "badge-custom" : skill.source === "upstream" ? "badge-upstream" : "badge-forked";
  const cmd = `npx -y skills add ${HUB_URL.replace("https://","")} --skill ${skill.path} --yes`;
  const tags = skill.tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join(" ");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(skill.name)} · Alan's Skill Hub</title>
<style>${CSS}</style>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" media="print" onload="this.media='all'">
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<style>
@media(prefers-color-scheme:dark){
  .hljs{background:var(--pre-bg)!important;color:var(--fg)!important}
}
</style>
</head>
<body>
<header class="site-header"><div class="container">
  <a href="/" class="brand"><span class="brand-dot"></span>Alan's Skill Hub</a>
  <nav class="header-nav">
    <a href="/api/skills">API</a>
    <a href="https://github.com/alanzeng423/skill-hub" target="_blank" rel="noopener">GitHub</a>
  </nav>
</div></header>

<main class="container">
  <nav class="breadcrumb"><a href="/">← All skills</a></nav>

  <div class="detail-head">
    <h1>${cat?.icon ?? "📌"} ${escapeHtml(skill.name)} <span class="badge ${badge}">${skill.source}</span></h1>
    <p class="detail-desc">${escapeHtml(skill.description)}</p>
    <div class="detail-meta">
      <span>v${escapeHtml(skill.version)}</span>
      <span>@${escapeHtml(skill.author)}</span>
      <span>${cat?.icon ?? "📌"} ${escapeHtml(cat?.name ?? "Other")}</span>
    </div>
    <div class="detail-tags">${tags}</div>
  </div>

  <div class="install-box">
    <code>${escapeHtml(cmd)}</code>
    <button onclick="cp(this)">Copy</button>
  </div>

  <div class="info-table">
    <div class="info-row"><span class="k">Author</span><span class="v plain">@${escapeHtml(skill.author)}</span></div>
    <div class="info-row"><span class="k">Version</span><span class="v plain">${escapeHtml(skill.version)}</span></div>
    <div class="info-row"><span class="k">Source</span><span class="v plain">${escapeHtml(skill.source)}</span></div>
    <div class="info-row"><span class="k">Category</span><span class="v plain">${escapeHtml(cat?.name ?? "Other")}</span></div>
    ${skill.upstream_url ? `<div class="info-row"><span class="k">Upstream</span><span class="v"><a href="${escapeHtml(skill.upstream_url)}" target="_blank" rel="noopener">${escapeHtml(skill.upstream_url)}</a></span></div>` : ""}
    <div class="info-row"><span class="k">GitHub</span><span class="v"><a href="https://github.com/alanzeng423/skill-hub/tree/main/skills/${skill.path}" target="_blank" rel="noopener">github.com/alanzeng423/skill-hub →</a></span></div>
    <div class="info-row"><span class="k">Raw URL</span><span class="v"><a href="/skills/${skill.path}/SKILL.md">${HUB_URL}/skills/${skill.path}/SKILL.md</a></span></div>
  </div>

  <div class="markdown-body" id="md"></div>

  <footer class="site-footer">
    <a href="/">← Alan's Skill Hub</a>
    <div>
      <a href="/api/skills/${skill.path}">JSON</a> ·
      <a href="/skills/${skill.path}/SKILL.md">Raw</a> ·
      <a href="https://github.com/alanzeng423/skill-hub/tree/main/skills/${skill.path}" target="_blank" rel="noopener">GitHub</a>
    </div>
  </footer>
</main>

<script>${copyJs()}
const md=${JSON.stringify(body)};
marked.setOptions({gfm:true,breaks:false});
document.getElementById('md').innerHTML=marked.parse(md);
document.querySelectorAll('.markdown-body pre code').forEach(b=>{try{hljs.highlightElement(b)}catch(e){}});
</script>
</body></html>`;
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
          url: HUB_URL,
          install: `npx -y skills add ${HUB_URL.replace("https://","")} --skill '*' --yes`,
          categories: index.categories,
          skills: index.skills,
          total: index.skills.length,
          updated_at: index.updated_at,
        });
      }

      if (path === "/api/categories") return jsonResponse(index.categories);

      const apiMatch = path.match(/^\/api\/skills\/([^/]+)$/);
      if (apiMatch) {
        const skill = index.skills.find(s => s.path === apiMatch[1]);
        if (!skill) return jsonResponse({ error: "Skill not found" }, 404);
        const md = await getSkillMd(skill.path, env);
        const { body, frontmatter } = md ? parseFrontmatter(md) : { body: "", frontmatter: {} };
        return jsonResponse({
          ...skill,
          install: `npx -y skills add ${HUB_URL.replace("https://","")} --skill ${skill.path} --yes`,
          raw_url: `${HUB_URL}/skills/${skill.path}/SKILL.md`,
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

      const fileMatch = path.match(/^\/skills\/([^/]+)\/(.+)$/);
      if (fileMatch) {
        const [, sp, fp] = fileMatch;
        if (fp === "SKILL.md") {
          const md = await getSkillMd(sp, env);
          if (!md) return new Response("Not found", { status: 404 });
          return rawResponse(md);
        }
        const text = await fetchRaw(`${env.SKILLS_PATH}/${sp}/${fp}`, env);
        if (!text) return new Response("Not found", { status: 404 });
        const ext = fp.split(".").pop() ?? "";
        const ct: Record<string, string> = { md: "text/markdown", json: "application/json", js: "application/javascript", ts: "application/typescript", py: "text/x-python", sh: "text/x-sh", yaml: "text/yaml", yml: "text/yaml", txt: "text/plain" };
        return rawResponse(text, ct[ext] ?? "application/octet-stream");
      }

      const pageMatch = path.match(/^\/skills\/([^/]+)$/);
      if (pageMatch) {
        const skill = index.skills.find(s => s.path === pageMatch[1]);
        if (!skill) return new Response("Not found", { status: 404 });
        const md = (await getSkillMd(skill.path, env)) ?? `# ${skill.name}\n\n${skill.description}`;
        return htmlResponse(renderSkillPage(skill, md, index));
      }

      if (path === "/install.sh" || path === "/install") {
        const lines = [
          "#!/bin/bash",
          'echo "Installing skills from skill.alanzeng.com..."',
          "if command -v npx &>/dev/null; then",
          "  npx -y skills add skill.alanzeng.com --skill '*' --yes",
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
            name: "skill-hub", url: HUB_URL,
            install: `npx -y skills add ${HUB_URL.replace("https://","")} --skill '*' --yes`,
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
