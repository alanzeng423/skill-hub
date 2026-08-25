#!/usr/bin/env python3
import argparse
import json
from collections import Counter
from pathlib import Path


def rows(path: Path):
    if not path.exists():
        return []
    result = []
    for line_no, line in enumerate(path.read_text().splitlines(), 1):
        if not line.strip():
            continue
        try:
            result.append(json.loads(line))
        except json.JSONDecodeError as exc:
            raise SystemExit(f"{path}:{line_no}: invalid JSON: {exc}") from exc
    return result


def latest(records, key_fields):
    result = {}
    for record in records:
        key = tuple(record.get(field) for field in key_fields)
        result[key] = record
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate local artifacts for a Lark migration run.")
    parser.add_argument("run_dir", type=Path)
    args = parser.parse_args()
    root = args.run_dir.expanduser().resolve()

    config = json.loads((root / "config.json").read_text())
    inventory = rows(root / "filtered-inventory.ndjson")
    mapping = rows(root / "mapping.ndjson")
    map_latest = latest(mapping, ["source_node_token"])
    errors = []

    required_config = ["source_profile", "target_profile", "source_roots", "target_parent", "target_mode", "approved"]
    for field in required_config:
        if field not in config:
            errors.append(f"config missing {field}")
    if config.get("source_profile") == config.get("target_profile"):
        errors.append("source_profile and target_profile are identical")

    inventory_tokens = {item.get("node_token") for item in inventory}
    for item in inventory:
        token = item.get("node_token")
        if not token or not item.get("obj_token") or not item.get("path"):
            errors.append(f"incomplete inventory record: {item}")
            continue
        parent = item.get("parent_node_token")
        if parent and parent not in inventory_tokens:
            errors.append(f"unresolved source parent for {item.get('path')}: {parent}")
        mapped = map_latest.get((token,))
        if config.get("approved") and not mapped:
            errors.append(f"missing mapping for {item.get('path')}")
        if mapped and mapped.get("obj_type") != item.get("obj_type"):
            errors.append(f"object type mismatch for {item.get('path')}")

    target_nodes = [record.get("target_node_token") for record in map_latest.values() if record.get("target_node_token")]
    duplicates = [token for token, count in Counter(target_nodes).items() if count > 1]
    if duplicates:
        errors.append(f"duplicate target node mappings: {duplicates}")

    summary = {
        "approved": bool(config.get("approved")),
        "inventory": len(inventory),
        "mapped": len(map_latest),
        "types": dict(Counter(item.get("obj_type", "unknown") for item in inventory)),
        "errors": errors,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()
