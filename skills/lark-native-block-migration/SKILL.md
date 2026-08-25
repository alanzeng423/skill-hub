---
name: lark-native-block-migration
description: Inventory, plan, execute, resume, and verify high-fidelity cross-tenant migration of Lark/Feishu Docx trees, My Library directories, and Wiki hierarchies using native document blocks. Use when moving Lark or Feishu cloud documents between domains/profiles while preserving titles, parent-child structure, text formatting, images, attachments, icons, embedded Sheets/Bases, and internal links; also use for migration dry-runs, repair, or post-migration fidelity audits.
---

# Lark/Feishu Native Block Migration

Migrate semantic document structures with Lark CLI and native APIs. Do not use DOCX export/import as the primary path for Docx content.

## Required companion skills

Read `lark-shared`, `lark-doc`, `lark-wiki`, and `lark-drive` before acting. Read `lark-sheets` or `lark-base` when those resources occur. Use `lark-openapi-explorer` only when the CLI lacks a required native operation.

## Inputs

Resolve or ask for:

- source and target Lark CLI profiles;
- source roots: Wiki/Doc URLs, node tokens, or My Library selections;
- target Wiki parent or My Library root;
- inclusion/exclusion rules;
- required treatment for unsupported blocks;
- a fresh run directory outside the skill folder.

Never write tenant domains, tokens, user IDs, or credentials into this skill. Store run-specific values only in the run directory.

## Safety contract

Split every new migration into two phases.

1. Perform read-only discovery and present the exact migration list, object counts, unsupported features, storage estimate where available, and fidelity plan.
2. Wait for explicit user approval before creating, importing, moving, overwriting, or deleting target objects.

Treat the source as read-only. Never delete the source. Never clean up target artifacts unless the user separately approves the exact deletion list. Take a target-parent snapshot before writes. Prefer a new empty target subtree so rollback means deleting only mapped target nodes.

## Workflow

### 1. Preflight identities and permissions

- Run auth status for both profiles as user and record domain, user identity, scopes, and token health.
- Confirm the source and target profiles are not accidentally reversed.
- Resolve source roots and target parent metadata.
- Check target write permission and quota before migration.

### 2. Build a complete inventory

- Recursively enumerate every selected source node with pagination.
- Record `node_token`, `obj_token`, `obj_type`, title, parent, depth, path, child flag, URL, icon, and creation/update metadata when exposed.
- Fetch every Docx in full detail. Count structural tags and extract media, attachments, whiteboards, Sheet/Base blocks, document references, tasks, synced blocks, and unsupported plugin blocks.
- Deduplicate resources by source token without deduplicating directory nodes.
- Apply exclusions to a separate filtered inventory; preserve the original inventory.
- Stop if pagination, permissions, or fetch failures make the inventory incomplete.

Initialize a run directory with `scripts/init_run.py`. Use the artifact schemas in [artifacts.md](references/artifacts.md).

### 3. Produce the plan

Present:

- the full source tree and total count by object type;
- excluded paths and reason;
- native-preservation strategy for each block class;
- explicit semantic degradations;
- expected temporary local storage and target storage impact;
- execution order, validation gates, and rollback boundary.

Use [fidelity.md](references/fidelity.md) for the preservation matrix. Do not claim “完全一致” when a block must be rasterized, flattened, or converted to a link/card.

### 4. Create target skeletons top-down

- Sort filtered inventory by depth and path.
- Create Docx/Wiki nodes under the mapped target parent.
- Export/import object types that have no native cross-tenant copy, then move them into the target Wiki hierarchy.
- Append one mapping record immediately after each successful creation. Never defer the mapping write.
- Make creation idempotent: skip only a source node with a confirmed live mapped target.
- Preserve icons through the native icon field/API after node creation; verify them separately from titles.

### 5. Transform Docx content

- Fetch native XML/block content from the source.
- Rewrite in-scope internal document references with the node/object mapping.
- Replace cross-tenant resource tokens with deterministic placeholders before writing content.
- Preserve supported native structure: headings, paragraphs, rich text, lists, quotes, callouts, code, equations, tables, checkboxes, columns/grids, bookmarks, and dividers.
- Keep out-of-scope links as source hyperlinks and report them.
- Record every transformation and degradation per document.

### 6. Migrate resources

- Images and attachments: download from the source profile and upload/insert into the mapped target Docx. Retain original filename and presentation mode when supported.
- Embedded Sheets: export/import the workbook, validate sheet order/titles, map source to target workbook/sheet IDs, then insert a native Sheet block. Expect the Docx insertion step to create another private workbook token; verify the final block does not reference the source tenant.
- Embedded Bases: export/import the Base and use a supported native embedded block or document reference card. Report any loss of view/dashboard/workflow behavior.
- Whiteboards: prefer native structural export/import if supported. Otherwise insert a labeled visual snapshot and report that editability was lost.
- Tasks, synced blocks, plugin/readonly blocks: preserve native semantics only when cross-tenant APIs support them; otherwise apply the user-approved degradation.

After insertion, remove placeholders and scan all target Docx content for leftovers.

### 7. Resume and repair safely

- Keep append-only NDJSON journals for skeleton, content, resource, icon, and verification stages.
- Determine completion from the latest record for a stable source/target key.
- Retry failed stages only; never recreate successful target nodes.
- When a target object disappeared or was manually moved, inspect it before deciding whether to repair the map or recreate it.

### 8. Verify by reading the target back

- Recursively inventory the target subtree.
- Compare node count, object type, title, icon, parent relationship, and exact child sets.
- Fetch each target Docx and compare structural block counts and resource counts against the source.
- Assert that attachments are uploaded, media placeholders are absent, and no in-scope source tokens remain.
- Validate imported Sheet/Base metadata and mapped IDs.
- Produce machine-readable JSON plus a concise Markdown report listing pass/fail per document and every approved degradation.
- Do not declare completion while any required node is missing or any unexpected degradation is unresolved.

Run `scripts/verify_artifacts.py RUN_DIR` for local artifact consistency before the final report. This complements, but does not replace, live target read-back.

## Completion report

Report source/target roots, mapped counts by type, verified documents, media/resource counts, icons verified, exclusions, failures, degradations, storage-heavy attachments, and rollback scope. Link the destination root and any failed document directly.
