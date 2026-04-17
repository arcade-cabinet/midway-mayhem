#!/usr/bin/env bash
# native-smoke-ios.sh — Run Maestro iOS smoke tests
# Preconditions:
#   - iOS Simulator running (xcrun simctl list shows a booted device)
#   - App installed on simulator
#   - maestro CLI available in PATH
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "[smoke:ios] Running Maestro iOS smoke test..."
echo "[smoke:ios] Project: ${PROJECT_DIR}"

# Verify simulator is booted
if ! xcrun simctl list devices booted 2>/dev/null | grep -q "Booted"; then
  echo "[smoke:ios] ERROR: No booted iOS Simulator found."
  echo "[smoke:ios] Boot one with: xcrun simctl boot <device-udid>"
  exit 1
fi

# Run the smoke test
maestro test "${PROJECT_DIR}/maestro/ios-smoke.yaml"

echo "[smoke:ios] Done. Screenshots in ~/.maestro/tests/"
