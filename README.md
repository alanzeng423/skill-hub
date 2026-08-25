# Skill Hub

Personal AI skill registry deployed at [skill.alanzeng.com](https://skill.alanzeng.com).

## Architecture

- **Storage**: GitHub (this repo, `skills/` directory)
- **Runtime**: Cloudflare Worker
- **Caching**: Cloudflare KV (5-minute TTL)
- **Domain**: skill.alanzeng.com (Cloudflare custom domain)

## How it works

Skills are stored as directories under `skills/` in this repo, each containing a `SKILL.md` with frontmatter:

```markdown
---
name: my-skill
description: What this skill does
---

# My Skill
(skill content here)
```

The Worker reads skills directly from GitHub's raw content API, caches metadata in KV, and serves:

- `GET /` - Web UI listing all skills with install commands
- `GET /api/skills` - JSON API listing all skills
- `GET /api/skills/:name` - Full skill metadata and SKILL.md content
- `GET /skills/:name/SKILL.md` - Raw SKILL.md for direct fetching
- `GET /install.sh` - Shell installer script

## Adding a skill

1. Create a directory under `skills/` with a `SKILL.md`
2. Push to `main` branch on GitHub
3. The Worker will pick it up within 5 minutes (KV cache TTL)

## Installing skills

From any agent that supports the `skills` CLI:

```bash
# Install all skills
npx -y skills add skill.alanzeng.com --skill '*' --yes

# Install a specific skill
npx -y skills add skill.alanzeng.com --skill skill-hub-hello --yes
```

Or via curl:

```bash
curl -fsSL https://skill.alanzeng.com/install.sh | bash
```

## Local development

```bash
npm install
npx wrangler dev
```

## Deploy

```bash
npx wrangler deploy
```
