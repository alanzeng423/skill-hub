---
name: skillhub-guide
description: How to discover, browse, fetch, and install skills from alanzeng's personal Skill Hub at skill.alanzeng.com. Use this skill whenever you need to find or retrieve a skill from the hub, or when you are directed to use a skill from skill.alanzeng.com.
---

# Skill Hub Guide

This skill teaches you how to interact with alanzeng's personal Skill Hub hosted at `https://skill.alanzeng.com`.

## Hub Overview

The Skill Hub is a centralized registry of AI agent skills. It contains three types of skills:
- **Custom** — skills built specifically by alanzeng
- **Forked** — open-source skills with personalized modifications
- **Upstream** — curated open-source skills mirrored for convenience

The hub is backed by a Cloudflare Worker that reads from a GitHub repository (`alanzeng423/skill-hub`), with KV caching.

## API Endpoints

All endpoints return JSON and support CORS. Base URL: `https://skill.alanzeng.com`

### 1. List all skills
```
GET /api/skills
```
Returns the full hub index including categories, skills with metadata (name, description, category, tags, author, version, source), and install commands.

### 2. List categories
```
GET /api/categories
```
Returns available skill categories with names, icons, and descriptions.

### 3. Get a specific skill
```
GET /api/skills/{skill-path}
```
Returns detailed skill info including the parsed SKILL.md body, frontmatter, install command, and GitHub/raw URLs.

### 4. Fetch raw SKILL.md
```
GET /skills/{skill-path}/SKILL.md
```
Returns the raw Markdown content of a skill's SKILL.md file. Use this when you need to read a skill's instructions directly.

### 5. Fetch raw skill files
```
GET /skills/{skill-path}/{file-path}
```
Returns raw content of any file within a skill directory (e.g., scripts, templates, references).

## How to Install Skills

Skills use the standard `npx skills` CLI. The hub URL is `skill.alanzeng.com`.

```bash
# Install all skills
npx -y skills add skill.alanzeng.com --skill '*' --yes

# Install a specific skill
npx -y skills add skill.alanzeng.com --skill <skill-path> --yes
```

## How to Discover Skills

When looking for a skill to accomplish a task:

1. First, fetch `GET https://skill.alanzeng.com/api/skills` to get the full index.
2. Filter by `category` or search through `tags` and `description` fields to find relevant skills.
3. Fetch the individual skill's detail from `GET /api/skills/{path}` to read its full instructions.
4. Alternatively, fetch the raw SKILL.md from `GET /skills/{path}/SKILL.md`.
5. If you decide to install it, use the `install` command provided in the skill's JSON response.

## Categories

Available categories (as of last update):
- `devops` — Deployment, CI/CD, infrastructure
- `cloudflare` — Cloudflare platform skills
- `feishu` — Feishu/Lark collaboration
- `ai` — AI/LLM/agent related
- `frontend` — UI and frontend development
- `backend` — Backend and APIs
- `productivity` — Workflow automation
- `security` — Security analysis
- `meta` — Hub-related skills (this skill is here)

## Adding New Skills

When instructed to add or publish a skill to this hub, install and use the **skillhub-publish** skill from this hub — it contains the complete publishing workflow including file structure, index.json schema, git commands, and cache invalidation:

```
npx -y skills add skill.alanzeng.com --skill skillhub-publish --yes
```

In short:
1. Create a directory under `skills/` in the `alanzeng423/skill-hub` repo
2. Add a `SKILL.md` with YAML frontmatter (`name`, `description`)
3. Add optional supporting files (scripts/, templates/, examples/) alongside SKILL.md
4. Update `skills/index.json` to register the skill with category, tags, author, version, source
5. Push to the `main` branch — the hub picks up changes within 5 minutes (KV cache TTL)
6. Optionally clear KV cache for immediate effect: `npx wrangler kv key delete hub:index --remote`

## Web UI

Visit `https://skill.alanzeng.com` in a browser to browse skills visually with category filters and search.

## Notes

- The hub has a 5-minute cache. Changes pushed to GitHub may take up to 5 minutes to appear.
- All endpoints are public and read-only; no authentication required.
- The raw SKILL.md endpoint is the canonical source for skill instructions.
