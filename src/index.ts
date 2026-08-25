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
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}

function rawResponse(text: string, contentType = "text/markdown"): Response {
  return new Response(text, {
    headers: {
      "Content-Type": `${contentType}; charset=utf-8`,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60",
    },
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

function parseSkillContent(md: string): { body: string; frontmatter: Record<string, string> } {
  const match = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { body: md, frontmatter: {} };
  const fm: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return { body: match[2].trim(), frontmatter: fm };
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/\n- (.+)/g, '\n<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, (line) => {
      if (line.startsWith('<') || line.trim() === '') return line;
      return `<p>${line}</p>`;
    });
}

function renderHubPage(index: HubIndex): string {
  const skillsByCategory: Record<string, SkillMeta[]> = {};
  for (const s of index.skills) {
    if (!skillsByCategory[s.category]) skillsByCategory[s.category] = [];
    skillsByCategory[s.category].push(s);
  }

  const categoryTabs = index.categories
    .map(
      (c) => {
        const count = skillsByCategory[c.id]?.length ?? 0;
        return `<button class="cat-tab" data-cat="${c.id}" onclick="filterCategory('${c.id}')">
          <span class="cat-icon">${c.icon}</span>
          <span class="cat-name">${escapeHtml(c.name)}</span>
          <span class="cat-count">${count}</span>
        </button>`;
      }
    )
    .join("");

  const allSkillsCount = index.skills.length;
  const allTab = `<button class="cat-tab active" data-cat="all" onclick="filterCategory('all')">
    <span class="cat-icon">📚</span>
    <span class="cat-name">All</span>
    <span class="cat-count">${allSkillsCount}</span>
  </button>`;

  const sourceLabels: Record<string, string> = {
    custom: '<span class="source-badge source-custom">Custom</span>',
    upstream: '<span class="source-badge source-upstream">Upstream</span>',
    forked: '<span class="source-badge source-forked">Forked</span>',
  };

  const renderSkillCards = (skills: SkillMeta[]) =>
    skills
      .map(
        (s) => {
          const cat = index.categories.find((c) => c.id === s.category);
          return `
    <a class="skill-card" href="/skills/${s.path}" data-category="${s.category}" data-tags="${s.tags.join(",")}" data-name="${escapeHtml(s.name).toLowerCase()}" data-desc="${escapeHtml(s.description).toLowerCase()}">
      <div class="skill-card-header">
        <span class="skill-cat-icon">${cat?.icon ?? "📌"}</span>
        <div class="skill-title-group">
          <h3 class="skill-name">${escapeHtml(s.name)}</h3>
          ${sourceLabels[s.source] ?? ""}
        </div>
        <span class="skill-version">v${escapeHtml(s.version)}</span>
      </div>
      <p class="skill-desc">${escapeHtml(s.description)}</p>
      <div class="skill-tags">
        ${s.tags.map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join("")}
      </div>
      <div class="skill-card-footer">
        <span class="skill-author">@${escapeHtml(s.author)}</span>
        <span class="skill-arrow">→</span>
      </div>
    </a>`;
        }
      )
      .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Skill Hub — alanzeng</title>
<style>
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  :root{
    --bg:#0a0e14;--bg2:#111820;--bg3:#1a2332;--border:#1e2d3d;
    --fg:#e6edf3;--fg2:#8b949e;--fg3:#6e7681;
    --accent:#58a6ff;--accent2:#79c0ff;--green:#3fb950;--purple:#bc8cff;
    --orange:#d29922;--red:#f85149;
    --radius:12px;--radius-sm:8px;
  }
  html{font-size:16px;scroll-behavior:smooth}
  body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Roboto,"Noto Sans SC",sans-serif;background:var(--bg);color:var(--fg);line-height:1.6;min-height:100vh}

  /* Navbar */
  .navbar{position:sticky;top:0;z-index:100;background:rgba(10,14,20,.85);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);padding:.85rem 1.5rem;display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap}
  .logo{display:flex;align-items:center;gap:.6rem;font-size:1.25rem;font-weight:700;color:#f85149;text-decoration:none;white-space:nowrap}
  .logo-icon{font-size:1.5rem}
  .install-box{display:flex;align-items:center;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.35rem .5rem .35rem .85rem;gap:.5rem;flex:1;max-width:480px;min-width:240px}
  .install-box code{font-size:.78rem;color:var(--green);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:"SF Mono",Menlo,Consolas,monospace}
  .copy-btn{background:var(--bg3);border:1px solid var(--border);color:var(--fg2);border-radius:6px;padding:.3rem .6rem;font-size:.75rem;cursor:pointer;transition:.15s}
  .copy-btn:hover{background:var(--accent);color:#fff;border-color:var(--accent)}
  .nav-links{display:flex;gap:1rem;margin-left:auto}
  .nav-links a{color:var(--fg2);text-decoration:none;font-size:.9rem;transition:color .15s}
  .nav-links a:hover{color:var(--accent)}

  /* Hero */
  .hero{text-align:center;padding:3.5rem 1.5rem 2rem;max-width:760px;margin:0 auto}
  .hero-badge{display:inline-flex;align-items:center;gap:.4rem;background:rgba(88,166,255,.1);border:1px solid rgba(88,166,255,.2);border-radius:100px;padding:.3rem .9rem;font-size:.8rem;color:var(--accent);margin-bottom:1.25rem}
  .hero h1{font-size:2.75rem;font-weight:800;letter-spacing:-.02em;margin-bottom:.75rem;background:linear-gradient(135deg,var(--accent),var(--purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .hero p{font-size:1.15rem;color:var(--fg2);max-width:540px;margin:0 auto 1.5rem}
  .hero-stats{display:flex;gap:2rem;justify-content:center;flex-wrap:wrap}
  .stat{text-align:center}
  .stat-num{font-size:1.75rem;font-weight:700;color:var(--accent2)}
  .stat-label{font-size:.8rem;color:var(--fg3);text-transform:uppercase;letter-spacing:.06em}

  /* Search */
  .search-section{max-width:680px;margin:0 auto 1.5rem;padding:0 1.5rem}
  .search-box{position:relative}
  .search-box input{width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:.85rem 1rem .85rem 2.8rem;font-size:.95rem;color:var(--fg);outline:none;transition:border-color .15s,box-shadow .15s}
  .search-box input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(88,166,255,.12)}
  .search-box input::placeholder{color:var(--fg3)}
  .search-icon{position:absolute;left:.9rem;top:50%;transform:translateY(-50%);color:var(--fg3);font-size:1.05rem}

  /* Categories */
  .categories{max-width:1100px;margin:0 auto;padding:0 1.5rem 1.5rem;display:flex;gap:.5rem;flex-wrap:wrap}
  .cat-tab{display:flex;align-items:center;gap:.4rem;background:var(--bg2);border:1px solid var(--border);border-radius:100px;padding:.4rem .85rem;font-size:.82rem;color:var(--fg2);cursor:pointer;transition:.15s;white-space:nowrap}
  .cat-tab:hover{border-color:var(--accent);color:var(--fg)}
  .cat-tab.active{background:rgba(88,166,255,.1);border-color:var(--accent);color:var(--accent)}
  .cat-icon{font-size:.95rem}
  .cat-count{background:var(--bg3);border-radius:100px;padding:0 .45rem;font-size:.72rem;color:var(--fg3)}
  .cat-tab.active .cat-count{background:rgba(88,166,255,.15);color:var(--accent)}

  /* Skills grid */
  .skills-container{max-width:1100px;margin:0 auto;padding:0 1.5rem 4rem}
  .skills-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1rem}
  .skill-card{display:block;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1.25rem;text-decoration:none;color:inherit;transition:.2s;cursor:pointer}
  .skill-card:hover{border-color:var(--accent);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.3)}
  .skill-card.hidden{display:none}
  .skill-card-header{display:flex;align-items:center;gap:.6rem;margin-bottom:.6rem}
  .skill-cat-icon{font-size:1.25rem}
  .skill-title-group{flex:1;display:flex;align-items:center;gap:.45rem;min-width:0}
  .skill-name{font-size:1.05rem;font-weight:600;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .skill-version{font-size:.7rem;color:var(--fg3);font-family:"SF Mono",Menlo,monospace}
  .source-badge{font-size:.65rem;padding:.1rem .45rem;border-radius:4px;font-weight:600;text-transform:uppercase;letter-spacing:.03em}
  .source-custom{background:rgba(63,185,80,.12);color:var(--green)}
  .source-upstream{background:rgba(188,140,255,.12);color:var(--purple)}
  .source-forked{background:rgba(210,153,34,.12);color:var(--orange)}
  .skill-desc{font-size:.88rem;color:var(--fg2);margin-bottom:.75rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.5}
  .skill-tags{display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.75rem}
  .tag{font-size:.72rem;color:var(--fg3);background:var(--bg3);padding:.15rem .45rem;border-radius:4px}
  .skill-card-footer{display:flex;align-items:center;justify-content:space-between;padding-top:.6rem;border-top:1px solid var(--border)}
  .skill-author{font-size:.78rem;color:var(--fg3)}
  .skill-arrow{font-size:1rem;color:var(--fg3);transition:transform .15s,color .15s}
  .skill-card:hover .skill-arrow{color:var(--accent);transform:translateX(3px)}

  .empty-state{text-align:center;padding:3rem 1rem;color:var(--fg3);grid-column:1/-1;display:none}
  .empty-state.visible{display:block}
  .empty-state-icon{font-size:3rem;margin-bottom:1rem;opacity:.5}

  /* Footer */
  footer{max-width:1100px;margin:0 auto;padding:2rem 1.5rem;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;color:var(--fg3);font-size:.82rem}
  footer a{color:var(--fg2);text-decoration:none}
  footer a:hover{color:var(--accent)}
  .footer-links{display:flex;gap:1.25rem}

  /* Responsive */
  @media(max-width:640px){
    .hero h1{font-size:1.85rem}
    .hero p{font-size:1rem}
    .skills-grid{grid-template-columns:1fr}
    .navbar{gap:.75rem}
    .install-box{order:10;width:100%;max-width:none}
  }
</style>
</head>
<body>

<nav class="navbar">
  <a href="/" class="logo"><span class="logo-icon">⚡</span> Alan's Skill Hub</a>
  <div class="install-box">
    <code>npx -y skills add skill.alanzeng.com --skill '*' --yes</code>
    <button class="copy-btn" onclick="copyInstall(this)">Copy</button>
  </div>
  <div class="nav-links">
    <a href="/api/skills">API</a>
    <a href="https://github.com/alanzeng423/skill-hub" target="_blank" rel="noopener">GitHub</a>
  </div>
</nav>

<section class="hero">
  <div class="hero-badge">● Personal Skill Registry</div>
  <h1>Skills for AI Agents</h1>
  <div class="hero-stats">
    <div class="stat"><div class="stat-num" id="skill-count">${allSkillsCount}</div><div class="stat-label">Skills</div></div>
    <div class="stat"><div class="stat-num">${index.categories.length}</div><div class="stat-label">Categories</div></div>
    <div class="stat"><div class="stat-num" id="custom-count">${index.skills.filter((s) => s.source === "custom").length}</div><div class="stat-label">Custom</div></div>
  </div>
</section>

<div class="search-section">
  <div class="search-box">
    <span class="search-icon">🔍</span>
    <input type="text" id="search" placeholder="Search skills by name, description, or tag..." oninput="filterSkills()">
  </div>
</div>

<div class="categories" id="categories">
  ${allTab}${categoryTabs}
</div>

<div class="skills-container">
  <div class="skills-grid" id="grid">
    ${renderSkillCards(index.skills)}
    <div class="empty-state" id="empty">
      <div class="empty-state-icon">🔍</div>
      <p>No skills match your search.</p>
    </div>
  </div>
</div>

<footer>
  <span>© 2026 alanzeng · Skill Hub</span>
  <div class="footer-links">
    <a href="/api/skills">JSON API</a>
    <a href="/install.sh">Install Script</a>
    <a href="https://github.com/alanzeng423/skill-hub" target="_blank" rel="noopener">Source</a>
  </div>
</footer>

<script>
let activeCat = 'all';
function filterCategory(cat) {
  activeCat = cat;
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
  filterSkills();
}
function filterSkills() {
  const q = document.getElementById('search').value.toLowerCase().trim();
  const cards = document.querySelectorAll('.skill-card');
  let visible = 0;
  cards.forEach(card => {
    const name = card.dataset.name;
    const desc = card.dataset.desc;
    const tags = card.dataset.tags;
    const cat = card.dataset.category;
    const matchCat = activeCat === 'all' || cat === activeCat;
    const matchQ = !q || name.includes(q) || desc.includes(q) || tags.includes(q);
    const show = matchCat && matchQ;
    card.classList.toggle('hidden', !show);
    if (show) visible++;
  });
  document.getElementById('empty').classList.toggle('visible', visible === 0);
}
function copyInstall(btn) {
  const code = btn.parentElement.querySelector('code').textContent;
  navigator.clipboard.writeText(code);
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy', 1500);
}
</script>
</body>
</html>`;
}

function renderSkillPage(skill: SkillMeta, md: string, index: HubIndex): string {
  const { body, frontmatter } = parseSkillContent(md);
  const cat = index.categories.find((c) => c.id === skill.category);
  const html = markdownToHtml(body);

  const sourceLabels: Record<string, { label: string; cls: string }> = {
    custom: { label: "Custom", cls: "source-custom" },
    upstream: { label: "Upstream", cls: "source-upstream" },
    forked: { label: "Forked", cls: "source-forked" },
  };
  const source = sourceLabels[skill.source];

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${skill.name} — Skill Hub</title>
<style>
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  :root{--bg:#0a0e14;--bg2:#111820;--bg3:#1a2332;--border:#1e2d3d;--fg:#e6edf3;--fg2:#8b949e;--fg3:#6e7681;--accent:#58a6ff;--accent2:#79c0ff;--green:#3fb950;--purple:#bc8cff;--orange:#d29922;--radius:12px;--radius-sm:8px}
  body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Roboto,"Noto Sans SC",sans-serif;background:var(--bg);color:var(--fg);line-height:1.7}
  .container{max-width:780px;margin:0 auto;padding:2rem 1.5rem 4rem}
  .back{color:var(--fg3);text-decoration:none;font-size:.9rem;display:inline-flex;align-items:center;gap:.3rem;margin-bottom:1.5rem;transition:color .15s}
  .back:hover{color:var(--accent)}
  .skill-header{margin-bottom:2rem;padding-bottom:2rem;border-bottom:1px solid var(--border)}
  .skill-meta-row{display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap}
  .cat-badge{display:inline-flex;align-items:center;gap:.3rem;background:var(--bg2);border:1px solid var(--border);border-radius:100px;padding:.3rem .75rem;font-size:.8rem;color:var(--fg2)}
  .source-badge{font-size:.7rem;padding:.15rem .5rem;border-radius:4px;font-weight:600;text-transform:uppercase;letter-spacing:.03em}
  .source-custom{background:rgba(63,185,80,.12);color:var(--green)}
  .source-upstream{background:rgba(188,140,255,.12);color:var(--purple)}
  .source-forked{background:rgba(210,153,34,.12);color:var(--orange)}
  .version-badge{font-size:.75rem;color:var(--fg3);font-family:"SF Mono",Menlo,monospace}
  h1{font-size:2rem;font-weight:800;margin-bottom:.5rem;display:flex;align-items:center;gap:.6rem}
  .h1-icon{font-size:1.75rem}
  .desc{font-size:1.1rem;color:var(--fg2);margin-bottom:1.25rem}
  .tags{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1.5rem}
  .tag{font-size:.78rem;color:var(--fg3);background:var(--bg3);padding:.2rem .55rem;border-radius:6px}
  .install-section{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1.25rem 1.5rem;margin-bottom:2rem}
  .install-section h3{font-size:.9rem;color:var(--fg2);margin-bottom:.75rem;font-weight:500}
  .install-row{display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem}
  .install-row code{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.55rem .75rem;font-size:.85rem;color:var(--green);font-family:"SF Mono",Menlo,Consolas,monospace;overflow-x:auto;white-space:nowrap}
  .copy-btn{background:var(--bg3);border:1px solid var(--border);color:var(--fg2);border-radius:6px;padding:.5rem .8rem;font-size:.8rem;cursor:pointer;transition:.15s;white-space:nowrap}
  .copy-btn:hover{background:var(--accent);color:#fff;border-color:var(--accent)}
  .info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin-top:1rem}
  .info-item{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.75rem 1rem}
  .info-label{font-size:.7rem;color:var(--fg3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.2rem}
  .info-value{font-size:.9rem;color:var(--fg2)}
  .content h1,.content h2,.content h3{margin:1.5rem 0 .75rem;color:var(--fg)}
  .content h1{font-size:1.5rem}
  .content h2{font-size:1.25rem}
  .content h3{font-size:1.1rem}
  .content p{margin-bottom:.75rem;color:var(--fg2)}
  .content ul,.content ol{margin-bottom:.75rem;padding-left:1.5rem;color:var(--fg2)}
  .content li{margin-bottom:.3rem}
  .content code{background:var(--bg3);padding:.15rem .4rem;border-radius:4px;font-size:.88rem;font-family:"SF Mono",Menlo,Consolas,monospace;color:var(--accent2)}
  .content pre{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:1rem;overflow-x:auto;margin-bottom:1rem}
  .content pre code{background:none;padding:0;font-size:.82rem}
  .content a{color:var(--accent);text-decoration:none}
  .content a:hover{text-decoration:underline}
  .content strong{color:var(--fg)}
  footer{margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;color:var(--fg3);font-size:.82rem}
  footer a{color:var(--fg2);text-decoration:none}
  footer a:hover{color:var(--accent)}
  @media(max-width:640px){h1{font-size:1.5rem}.install-row{flex-direction:column;align-items:stretch}}
</style>
</head>
<body>
<div class="container">
  <a href="/" class="back">← Back to all skills</a>

  <div class="skill-header">
    <div class="skill-meta-row">
      <span class="cat-badge">${cat?.icon ?? "📌"} ${escapeHtml(cat?.name ?? "Other")}</span>
      ${source ? `<span class="source-badge ${source.cls}">${source.label}</span>` : ""}
      <span class="version-badge">v${escapeHtml(skill.version)}</span>
    </div>
    <h1><span class="h1-icon">${cat?.icon ?? "📌"}</span> ${escapeHtml(skill.name)}</h1>
    <p class="desc">${escapeHtml(skill.description)}</p>
    <div class="tags">${skill.tags.map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join("")}</div>

    <div class="install-section">
      <h3>Install this skill</h3>
      <div class="install-row">
        <code>npx -y skills add skill.alanzeng.com --skill ${skill.path} --yes</code>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      ${skill.upstream_url ? `<div class="install-row"><code style="font-size:.78rem;color:var(--fg3)">Based on: ${escapeHtml(skill.upstream_url)}</code></div>` : ""}
    </div>

    <div class="info-grid">
      <div class="info-item"><div class="info-label">Author</div><div class="info-value">@${escapeHtml(skill.author)}</div></div>
      <div class="info-item"><div class="info-label">Version</div><div class="info-value">${escapeHtml(skill.version)}</div></div>
      <div class="info-item"><div class="info-label">Source</div><div class="info-value">${escapeHtml(skill.source)}</div></div>
      <div class="info-item"><div class="info-label">Path</div><div class="info-value" style="font-family:monospace;font-size:.78rem">${escapeHtml(skill.path)}</div></div>
    </div>
  </div>

  <div class="content">${html}</div>

  <footer>
    <a href="/">← Skill Hub</a>
    <div>
      <a href="/api/skills/${skill.path}">JSON</a> ·
      <a href="/skills/${skill.path}/SKILL.md">Raw</a> ·
      <a href="https://github.com/${skill.repo ?? "alanzeng423/skill-hub"}/tree/main/skills/${skill.path}" target="_blank" rel="noopener">GitHub</a>
    </div>
  </footer>
</div>
<script>
function copyCode(btn) {
  const code = btn.parentElement.querySelector('code').textContent;
  navigator.clipboard.writeText(code);
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy', 1500);
}
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

      // JSON API: full index
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

      // JSON API: categories
      if (path === "/api/categories") {
        return jsonResponse(index.categories);
      }

      // JSON API: single skill
      const skillApiMatch = path.match(/^\/api\/skills\/([^/]+)$/);
      if (skillApiMatch) {
        const skillName = skillApiMatch[1];
        const skill = index.skills.find((s) => s.path === skillName);
        if (!skill) return jsonResponse({ error: "Skill not found" }, 404);
        const md = await getSkillMd(skillName, env);
        const { body, frontmatter } = md ? parseSkillContent(md) : { body: "", frontmatter: {} };
        return jsonResponse({
          ...skill,
          install: `npx -y skills add skill.alanzeng.com --skill ${skill.path} --yes`,
          raw_url: `https://skill.alanzeng.com/skills/${skill.path}/SKILL.md`,
          github_url: `https://github.com/${env.GITHUB_REPO}/tree/${env.GITHUB_BRANCH}/${env.SKILLS_PATH}/${skill.path}`,
          body,
          frontmatter,
        });
      }

      // Raw SKILL.md
      const rawMatch = path.match(/^\/skills\/([^/]+)\/SKILL\.md$/);
      if (rawMatch) {
        const md = await getSkillMd(rawMatch[1], env);
        if (!md) return new Response("Not found", { status: 404 });
        return rawResponse(md);
      }

      // Raw file
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

      // Skill detail page
      const pageMatch = path.match(/^\/skills\/([^/]+)$/);
      if (pageMatch) {
        const skillName = pageMatch[1];
        const skill = index.skills.find((s) => s.path === skillName);
        if (!skill) return new Response("Not found", { status: 404 });
        const md = (await getSkillMd(skillName, env)) ?? `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n# ${skill.name}\n\n${skill.description}`;
        return htmlResponse(renderSkillPage(skill, md, index));
      }

      // Install script
      if (path === "/install.sh" || path === "/install") {
        const lines = [
          "#!/bin/bash",
          "# Skill Hub installer - skill.alanzeng.com",
          'echo "⚡ Installing skills from skill.alanzeng.com..."',
          "if command -v npx &>/dev/null; then",
          '  npx -y skills add skill.alanzeng.com --skill \'*\' --yes',
          '  echo "✓ Skills installed. Restart your agent."',
          "  exit 0",
          "fi",
          'echo "npx not found. Install Node.js first: https://nodejs.org"',
          "exit 1",
        ];
        return new Response(lines.join("\n"), {
          headers: { "Content-Type": "text/x-sh; charset=utf-8", "Access-Control-Allow-Origin": "*" },
        });
      }

      // Health
      if (path === "/health" || path === "/healthz") {
        return jsonResponse({ status: "ok", skills: index.skills.length, timestamp: new Date().toISOString() });
      }

      // Root
      if (path === "/" || path === "/index.html") {
        const accept = request.headers.get("Accept") ?? "";
        if (accept.includes("application/json")) {
          return jsonResponse({
            name: "skill-hub",
            description: "Personal skill registry by alanzeng",
            url: "https://skill.alanzeng.com",
            install: "npx -y skills add skill.alanzeng.com --skill '*' --yes",
            total_skills: index.skills.length,
            categories_count: index.categories.length,
            endpoints: {
              skills: "/api/skills",
              categories: "/api/categories",
              skill: "/api/skills/:name",
              raw_skill: "/skills/:name/SKILL.md",
              install: "/install.sh",
            },
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
