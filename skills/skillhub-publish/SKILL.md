---
name: skillhub-publish
description: Publish new skills or update existing skills to Alan's Skill Hub at skill.alanzeng.com. Use this skill whenever you need to add, update, or remove a skill on the hub. The hub is backed by GitHub repo alanzeng423/skill-hub; publishing means committing SKILL.md files and updating index.json on the main branch.
---

# Skill Hub Publisher

This skill teaches you how to publish (add, update, or remove) skills to/from Alan's Skill Hub hosted at `https://skill.alanzeng.com`.

## Architecture

The hub is a Cloudflare Worker that reads skill metadata from `skills/index.json` and skill content from `skills/<path>/SKILL.md` in the GitHub repo `alanzeng423/skill-hub` (branch `main`). The Worker caches content in KV for 5 minutes. After pushing to GitHub, changes appear within ~5 minutes.

**To publish, you commit files to GitHub.** There are two methods depending on your environment.

## Prerequisites

- You must have `gh` CLI authenticated, OR be working in a local clone of the repo with git push access.
- The repo is: `https://github.com/alanzeng423/skill-hub`
- Branch: `main`
- Skills live under `skills/` directory; registry is `skills/index.json`.

## Method 1: Working in a local clone (preferred when repo is checked out)

The local repo path is typically `/Users/bytedance/Code/skill-hub` on the author's machine.

### Add a new skill

1. **Create the SKILL.md file** at `skills/<skill-path>/SKILL.md`. It MUST start with YAML frontmatter:

```markdown
---
name: <skill-name>
description: <one-sentence description of what the skill does>
---

# <Skill Name>

<Full skill instructions in Markdown...>
```

2. **Add supporting files** (optional): scripts, templates, examples — place them alongside SKILL.md in `skills/<skill-path>/`.

3. **Update `skills/index.json`**:
   - If the skill belongs to an existing category, add an entry to the `skills` array.
   - If adding a new category, add it to the `categories` array first.
   - Set `updated_at` to the current ISO date (YYYY-MM-DD).
   
   Skill entry schema:
   ```json
   {
     "name": "<display name>",
     "description": "<brief description>",
     "path": "<directory name under skills/>",
     "category": "<category id>",
     "tags": ["tag1", "tag2"],
     "author": "<author handle>",
     "version": "1.0.0",
     "source": "custom | upstream | forked",
     "upstream_url": "<original OSS URL, required if source is upstream or forked>"
   }
   ```

4. **Commit and push**:
   ```bash
   cd /Users/bytedance/Code/skill-hub
   git add skills/<skill-path>/ skills/index.json
   git commit -m "add: <skill-name> skill"
   git push origin main
   ```

5. **Invalidate cache** (optional, for immediate effect):
   ```bash
   npx wrangler kv key delete hub:index --remote
   ```

### Update an existing skill

1. Edit `skills/<skill-path>/SKILL.md` or supporting files.
2. If metadata changed (description, tags, version, category), update `skills/index.json` accordingly.
3. Bump `version` following semver (patch for fixes, minor for additions, major for breaking changes).
4. Commit, push, optionally clear KV cache.

### Remove a skill

1. Delete `skills/<skill-path>/` directory.
2. Remove the entry from `skills/index.json`.
3. Commit, push, clear KV cache.

## Method 2: Using GitHub API via `gh` (no local clone needed)

If you don't have a local checkout, use `gh api` or `gh repo` commands to create/update files directly via GitHub API.

### Create SKILL.md via API

```bash
# Read the current index.json first
gh api repos/alanzeng423/skill-hub/contents/skills/index.json -q .content | base64 -d > /tmp/current-index.json

# Create the SKILL.md file (base64 encoded)
gh api repos/alanzeng423/skill-hub/contents/skills/<path>/SKILL.md \
  -X PUT \
  -f message="add: <skill-name> skill" \
  -f content="$(base64 -i /path/to/SKILL.md)" \
  -f branch=main

# Update index.json - add the new skill entry, then:
gh api repos/alanzeng423/skill-hub/contents/skills/index.json \
  -X PUT \
  -f message="add: register <skill-name> in index" \
  -f content="$(base64 -i /tmp/updated-index.json)" \
  -f sha="$(gh api repos/alanzeng423/skill-hub/contents/skills/index.json -q .sha)" \
  -f branch=main
```

## Category Reference

Existing categories (use one of these unless adding a new one):

| id | name | icon |
|---|---|---|
| devops | DevOps & Deployment | 🚀 |
| cloudflare | Cloudflare | ⚡ |
| feishu | Feishu / Lark | 🐦 |
| ai | AI & LLM | 🤖 |
| frontend | Frontend | 🎨 |
| backend | Backend | ⚙️ |
| productivity | Productivity | 📋 |
| security | Security | 🔒 |
| meta | Meta | 📦 |
| other | Other | 📌 |

## Source Types

- **custom** — Original skill built by alanzeng or specifically for this hub
- **upstream** — Unmodified open-source skill mirrored for convenience (must include `upstream_url`)
- **forked** — Open-source skill with personalized modifications (must include `upstream_url`)

## After Publishing

1. Wait up to 5 minutes for KV cache to expire, or manually clear `hub:index` key.
2. Verify at `https://skill.alanzeng.com` — the new skill should appear in the list.
3. Verify the skill page renders correctly: `https://skill.alanzeng.com/skills/<path>`.
4. Verify the API: `curl https://skill.alanzeng.com/api/skills/<path>`.
5. Test installation: `npx -y skills add skill.alanzeng.com --skill <path> --yes`.

## Worker Deployment

The Worker source (`src/index.ts` and `wrangler.toml`) also lives in the same repo. If you need to change the Worker logic (not just skill content), deploy with:

```bash
cd /Users/bytedance/Code/skill-hub
npx wrangler deploy
```

After deploying the Worker, clear KV cache so fresh content is fetched.

## Important Notes

- The `gh` CLI must be authenticated as `alanzeng423` (the repo owner).
- Never commit secrets, tokens, or credentials into the skills or repo.
- Skill files (SKILL.md, scripts, templates) are public — do not include private information.
- Keep SKILL.md concise and actionable. Frontmatter `name` and `description` are required.
- Tags help agents discover skills via search — include 2-5 relevant tags.
