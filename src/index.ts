interface SkillMeta {
  name: string;
  description: string;
  path: string;
}

interface Env {
  SKILL_CACHE: KVNamespace;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  SKILLS_PATH: string;
}

const CACHE_TTL = 300; // 5 minutes

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

async function fetchGithubApi(path: string, env: Env, binary = false): Promise<Response> {
  const url = `https://raw.githubusercontent.com/${env.GITHUB_REPO}/${env.GITHUB_BRANCH}/${path}`;
  return fetch(url);
}

async function listSkills(env: Env): Promise<SkillMeta[]> {
  const cached = await env.SKILL_CACHE.get<SkillMeta[]>("skills:list", "json");
  if (cached) return cached;

  try {
    const apiUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${env.SKILLS_PATH}?ref=${env.GITHUB_BRANCH}`;
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "skill-hub-worker", "Accept": "application/vnd.github+json" },
    });
    if (!res.ok) return [];

    const entries = (await res.json()) as Array<{ name: string; type: string }>;
    const skillDirs = entries.filter((e) => e.type === "dir").map((e) => e.name);

    const skills: SkillMeta[] = [];
    for (const dir of skillDirs) {
      const skillMd = await fetchGithubApi(`${env.SKILLS_PATH}/${dir}/SKILL.md`, env);
      if (!skillMd.ok) continue;
      const text = await skillMd.text();
      const { name, description } = parseFrontmatter(text, dir);
      skills.push({ name, description, path: dir });
    }

    await env.SKILL_CACHE.put("skills:list", JSON.stringify(skills), { expirationTtl: CACHE_TTL });
    return skills;
  } catch {
    return cached ?? [];
  }
}

function parseFrontmatter(content: string, fallbackName: string): { name: string; description: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { name: fallbackName, description: "" };

  const frontmatter = match[1];
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

  return {
    name: nameMatch?.[1]?.trim() ?? fallbackName,
    description: descMatch?.[1]?.trim() ?? "",
  };
}

async function getSkillContent(skillPath: string, env: Env): Promise<string | null> {
  const cacheKey = `skill:${skillPath}:SKILL.md`;
  const cached = await env.SKILL_CACHE.get(cacheKey);
  if (cached) return cached;

  const res = await fetchGithubApi(`${env.SKILLS_PATH}/${skillPath}/SKILL.md`, env);
  if (!res.ok) return null;
  const text = await res.text();
  await env.SKILL_CACHE.put(cacheKey, text, { expirationTtl: CACHE_TTL });
  return text;
}

async function getSkillFiles(skillPath: string, env: Env): Promise<string[]> {
  try {
    const apiUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/git/trees/${env.GITHUB_BRANCH}?recursive=1`;
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "skill-hub-worker" },
    });
    if (!res.ok) return ["SKILL.md"];
    const data = (await res.json()) as { tree: Array<{ path: string; type: string }> };
    return data.tree
      .filter((f) => f.path.startsWith(`${env.SKILLS_PATH}/${skillPath}/`) && f.type === "blob")
      .map((f) => f.path.replace(`${env.SKILLS_PATH}/${skillPath}/`, ""));
  } catch {
    return ["SKILL.md"];
  }
}

function renderIndex(skills: SkillMeta[]): string {
  const skillCards = skills
    .map(
      (s) => `
    <div class="skill-card">
      <h3><a href="/skills/${s.path}">${escapeHtml(s.name)}</a></h3>
      <p>${escapeHtml(s.description)}</p>
      <code>npx -y skills add ${"skill.alanzeng.com"} --skill ${s.path} --yes</code>
    </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Skill Hub</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background:#0d1117; color:#c9d1d9; padding:2rem; max-width:900px; margin:0 auto; }
  h1 { font-size:2rem; margin-bottom:.5rem; color:#58a6ff; }
  .subtitle { color:#8b949e; margin-bottom:2rem; }
  .install-banner { background:#161b22; border:1px solid #30363d; border-radius:8px; padding:1rem 1.5rem; margin-bottom:2rem; }
  .install-banner code { background:#0d1117; padding:.2rem .5rem; border-radius:4px; font-size:.9rem; color:#7ee787; }
  .skills-grid { display:grid; gap:1rem; }
  .skill-card { background:#161b22; border:1px solid #30363d; border-radius:8px; padding:1.25rem; transition:border-color .2s; }
  .skill-card:hover { border-color:#58a6ff; }
  .skill-card h3 { margin-bottom:.5rem; }
  .skill-card h3 a { color:#58a6ff; text-decoration:none; }
  .skill-card p { color:#8b949e; margin-bottom:.75rem; font-size:.95rem; }
  .skill-card code { background:#0d1117; padding:.3rem .6rem; border-radius:4px; font-size:.8rem; color:#79c0ff; display:block; overflow-x:auto; }
  footer { margin-top:3rem; padding-top:1.5rem; border-top:1px solid #21262d; color:#8b949e; font-size:.85rem; }
  footer a { color:#58a6ff; }
</style>
</head>
<body>
  <h1>Skill Hub</h1>
  <p class="subtitle">Personal skill registry for AI agents</p>
  <div class="install-banner">
    <strong>Install all skills:</strong><br>
    <code>npx -y skills add skill.alanzeng.com --skill '*' --yes</code>
  </div>
  <div class="skills-grid">${skillCards}</div>
  <footer>
    <p>API: <a href="/api/skills">/api/skills</a> | Source: <a href="https://github.com/alanzeng/skill-hub">GitHub</a></p>
  </footer>
</body>
</html>`;
}

function renderSkillPage(skill: SkillMeta, content: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${skill.name} - Skill Hub</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0d1117;color:#c9d1d9;padding:2rem;max-width:800px;margin:0 auto;line-height:1.6}
  a{color:#58a6ff;text-decoration:none}
  a:hover{text-decoration:underline}
  .back{margin-bottom:1rem;display:inline-block}
  h1{font-size:1.75rem;margin-bottom:.5rem;color:#58a6ff}
  .desc{color:#8b949e;margin-bottom:1.5rem}
  .install{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:1rem 1.5rem;margin-bottom:1.5rem}
  .install code{background:#0d1117;padding:.2rem .5rem;border-radius:4px;font-size:.9rem;color:#7ee787}
  pre{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:1rem;overflow-x:auto;white-space:pre-wrap;font-size:.9rem}
</style>
</head>
<body>
  <a class="back" href="/">&larr; Back to all skills</a>
  <h1>${escapeHtml(skill.name)}</h1>
  <p class="desc">${escapeHtml(skill.description)}</p>
  <div class="install">
    <strong>Install:</strong><br>
    <code>npx -y skills add skill.alanzeng.com --skill ${skill.path} --yes</code>
  </div>
  <pre>${escapeHtml(content)}</pre>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function generateInstallScript(skills: SkillMeta[]): string {
  const skillNames = skills.map((s) => s.path).join(" ");
  return `#!/bin/bash
# Skill Hub installer - skill.alanzeng.com
# Installs skills from the personal skill registry.
# Usage: curl -fsSL https://skill.alanzeng.com/install.sh | bash
#    or: npx -y skills add skill.alanzeng.com --skill '*' --yes

set -euo pipefail

REPO_URL="https://github.com/alanzeng/skill-hub.git"
SKILLS_DIR="\${HOME}/.agents/skills"

echo "⚡ Installing skills from skill.alanzeng.com..."

if command -v npx &>/dev/null; then
  echo "Detected npx, using skills CLI..."
  npx -y skills add skill.alanzeng.com --skill '*' --yes --global
  echo "✓ Skills installed successfully."
  exit 0
fi

echo "Falling back to git clone..."
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

git clone --depth 1 "$REPO_URL" "$TMP_DIR" 2>/dev/null
mkdir -p "$SKILLS_DIR"
for skill in ${skillNames}; do
  if [ -d "$TMP_DIR/skills/$skill" ]; then
    cp -r "$TMP_DIR/skills/$skill" "$SKILLS_DIR/"
    echo "  ✓ Installed $skill"
  fi
done

echo ""
echo "✓ All skills installed to $SKILLS_DIR"
echo "  Restart your agent to pick up new skills."
`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // CORS preflight
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
      // API: list all skills
      if (path === "/api/skills" || path === "/skills.json") {
        const skills = await listSkills(env);
        return jsonResponse(skills);
      }

      // API: single skill metadata
      const skillMetaMatch = path.match(/^\/api\/skills\/([^/]+)$/);
      if (skillMetaMatch) {
        const skillName = skillMetaMatch[1];
        const skills = await listSkills(env);
        const skill = skills.find((s) => s.path === skillName);
        if (!skill) return jsonResponse({ error: "Skill not found" }, 404);
        const content = await getSkillContent(skillName, env);
        const files = await getSkillFiles(skillName, env);
        return jsonResponse({ ...skill, files, skill_md: content });
      }

      // Raw SKILL.md
      const rawMatch = path.match(/^\/skills\/([^/]+)\/SKILL\.md$/);
      if (rawMatch) {
        const content = await getSkillContent(rawMatch[1], env);
        if (!content) return new Response("Not found", { status: 404 });
        return rawResponse(content);
      }

      // Raw file download (for install script compatibility)
      const rawFileMatch = path.match(/^\/skills\/([^/]+)\/(.+)$/);
      if (rawFileMatch) {
        const [, skillPath, filePath] = rawFileMatch;
        const res = await fetchGithubApi(`${env.SKILLS_PATH}/${skillPath}/${filePath}`, env);
        if (!res.ok) return new Response("Not found", { status: 404 });
        const contentType = filePath.endsWith(".md")
          ? "text/markdown"
          : filePath.endsWith(".json")
            ? "application/json"
            : "application/octet-stream";
        return rawResponse(await res.text(), contentType);
      }

      // Skill detail page
      const pageMatch = path.match(/^\/skills\/([^/]+)$/);
      if (pageMatch) {
        const skillName = pageMatch[1];
        const skills = await listSkills(env);
        const skill = skills.find((s) => s.path === skillName);
        if (!skill) return new Response("Not found", { status: 404 });
        const content = (await getSkillContent(skillName, env)) ?? "";
        return htmlResponse(renderSkillPage(skill, content));
      }

      // Install script
      if (path === "/install.sh" || path === "/install") {
        const skills = await listSkills(env);
        return new Response(generateInstallScript(skills), {
          headers: {
            "Content-Type": "text/x-sh; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // Root: web UI + API hub
      if (path === "/" || path === "/index.html") {
        const accept = request.headers.get("Accept") ?? "";
        if (accept.includes("application/json")) {
          const skills = await listSkills(env);
          return jsonResponse({
            name: "skill-hub",
            description: "Personal skill registry by alanzeng",
            skills_endpoint: "/api/skills",
            install: "npx -y skills add skill.alanzeng.com --skill '*' --yes",
            skill_count: skills.length,
          });
        }
        const skills = await listSkills(env);
        return htmlResponse(renderIndex(skills));
      }

      // Health check
      if (path === "/health" || path === "/healthz") {
        return jsonResponse({ status: "ok", timestamp: new Date().toISOString() });
      }

      return new Response("Not found", { status: 404 });
    } catch (err) {
      return jsonResponse({ error: String(err) }, 500);
    }
  },
};
