# Skill Hub

Personal AI skill marketplace at [skill.alanzeng.com](https://skill.alanzeng.com).

A visual registry for AI agent skills — custom-built, open-source forks with personal tweaks, and curated upstream skills. Other agents can browse, discover, and install skills via a simple API or the `npx skills` CLI.

## Features

- Visual web UI with category browsing and search
- Structured metadata: categories, tags, author, version, source type
- RESTful JSON API for agent consumption
- One-command skill installation via `npx skills`
- `skillhub-guide` meta-skill teaches agents how to use this hub
- GitHub as source of truth, Cloudflare KV for caching
- Custom domain: skill.alanzeng.com

## Architecture

```
GitHub (skills/ + index.json)  →  Cloudflare Worker  →  KV Cache (5min TTL)
                                      ↓
                     ┌────────────────┼────────────────┐
                     ↓                ↓                ↓
                  Web UI         JSON API       Raw SKILL.md
            (browsable UI)   (agent access)   (direct fetch)
```

- **Storage**: GitHub repo (`alanzeng423/skill-hub`, `skills/` directory)
- **Runtime**: Cloudflare Worker
- **Caching**: Cloudflare KV (5-minute TTL for metadata)
- **Domain**: skill.alanzeng.com (Cloudflare custom domain)

## Adding a Skill

1. Create a directory under `skills/` (e.g., `skills/my-skill/`)
2. Add a `SKILL.md` with frontmatter:
   ```markdown
   ---
   name: my-skill
   description: What this skill does, when to use it
   ---
   # My Skill
   (detailed instructions here)
   ```
3. Add any supporting files (scripts/, references/, templates/) in the same directory
4. Register the skill in `skills/index.json` with metadata:
   ```json
   {
     "name": "my-skill",
     "description": "...",
     "path": "my-skill",
     "category": "devops",
     "tags": ["deploy", "infra"],
     "author": "alanzeng",
     "version": "1.0.0",
     "source": "custom"
   }
   ```
5. Push to `main` — the hub picks up changes within 5 minutes (KV cache TTL)

### Source types

- `custom` — skills you built from scratch
- `upstream` — unmodified open-source skills mirrored for convenience
- `forked` — open-source skills with personal modifications (include `upstream_url`)

### Categories

Available categories are defined in `skills/index.json` under `categories`:
devops, cloudflare, feishu, ai, frontend, backend, productivity, security, meta, other

## API

Base URL: `https://skill.alanzeng.com`

| Endpoint | Description |
|----------|-------------|
| `GET /` | Visual web UI (browsable skill marketplace) |
| `GET /api/skills` | Full hub index: categories, skills with metadata, install commands |
| `GET /api/categories` | List all categories |
| `GET /api/skills/:name` | Single skill detail with parsed SKILL.md body |
| `GET /skills/:name/SKILL.md` | Raw SKILL.md markdown content |
| `GET /skills/:name/:file` | Raw file from within a skill directory |
| `GET /install.sh` | Shell installer script |
| `GET /health` | Health check |

## Installing Skills

```bash
# Install all skills
npx -y skills add skill.alanzeng.com --skill '*' --yes

# Install a specific skill
npx -y skills add skill.alanzeng.com --skill skillhub-guide --yes
```

For agents: install the `skillhub-guide` skill first to learn how to interact with the hub:

```bash
npx -y skills add skill.alanzeng.com --skill skillhub-guide --yes
```

## Local Development

```bash
npm install
npx wrangler dev
# Visit http://localhost:8787
```

## Deploy

```bash
npx wrangler deploy
```
