#!/usr/bin/env bash
set -euo pipefail
STATE_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.claude/state/task-batch"
mkdir -p "$STATE_DIR"
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$STATE_DIR/.last-compaction"
exit 0
