#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


FILES = [
    "source-inventory.ndjson",
    "filtered-inventory.ndjson",
    "mapping.ndjson",
    "transform-report.ndjson",
    "content-results.ndjson",
    "resource-map.ndjson",
    "resource-results.ndjson",
    "icon-results.ndjson",
    "journal.ndjson",
]
DIRS = ["source-docs", "transformed-docs", "target-docs", "target-nodes", "downloads", "logs"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Initialize an isolated Lark migration run directory.")
    parser.add_argument("run_dir", type=Path)
    parser.add_argument("--source-profile", required=True)
    parser.add_argument("--target-profile", required=True)
    parser.add_argument("--source-root", action="append", required=True)
    parser.add_argument("--target-parent", required=True)
    parser.add_argument("--target-mode", choices=["wiki", "my-library"], required=True)
    args = parser.parse_args()

    root = args.run_dir.expanduser().resolve()
    root.mkdir(parents=True, exist_ok=False)
    for name in DIRS:
        (root / name).mkdir()
    for name in FILES:
        (root / name).touch()
    config = {
        "source_profile": args.source_profile,
        "target_profile": args.target_profile,
        "source_roots": args.source_root,
        "target_parent": args.target_parent,
        "target_mode": args.target_mode,
        "approved": False,
        "exclusions": [],
    }
    (root / "config.json").write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n")
    (root / "rollback-snapshot.json").write_text("{}\n")
    print(root)


if __name__ == "__main__":
    main()
