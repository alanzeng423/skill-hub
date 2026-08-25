# Run artifact contract

Keep one isolated directory per migration.

```text
run/
├── config.json
├── source-inventory.ndjson
├── filtered-inventory.ndjson
├── mapping.ndjson
├── transform-report.ndjson
├── content-results.ndjson
├── resource-map.ndjson
├── resource-results.ndjson
├── icon-results.ndjson
├── journal.ndjson
├── rollback-snapshot.json
├── verification.json
├── verification.md
├── source-docs/
├── transformed-docs/
├── target-docs/
├── target-nodes/
├── downloads/
└── logs/
```

Minimum `config.json` keys:

```json
{
  "source_profile": "SOURCE_PROFILE",
  "target_profile": "TARGET_PROFILE",
  "source_roots": ["SOURCE_URL_OR_TOKEN"],
  "target_parent": "TARGET_URL_OR_TOKEN",
  "target_mode": "wiki-or-my-library",
  "approved": false,
  "exclusions": []
}
```

Minimum inventory record:

```json
{"node_token":"...","obj_token":"...","obj_type":"docx","title":"...","parent_node_token":"...","depth":0,"path":"Root / Child","has_child":false,"icon":null}
```

Minimum mapping record:

```json
{"source_node_token":"...","source_obj_token":"...","target_node_token":"...","target_obj_token":"...","obj_type":"docx","path":"Root / Child","status":"skeleton"}
```

Use stable keys and append stage results. Never store access tokens, cookies, passwords, or authorization headers in artifacts or logs.
