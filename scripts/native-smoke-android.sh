#!/usr/bin/env bash
# native-smoke-android.sh — Run Maestro Android smoke tests
# Preconditions:
#   - Android emulator running (adb devices shows a connected device)
#   - App installed on emulator
#   - maestro CLI available in PATH
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "[smoke:android] Running Maestro Android smoke test..."
echo "[smoke:android] Project: ${PROJECT_DIR}"

# Verify device is connected
if ! adb devices | grep -q "device$"; then
  echo "[smoke:android] ERROR: No Android device/emulator connected."
  echo "[smoke:android] Start an emulator with: emulator -avd <avd_name>"
  exit 1
fi

# Run the smoke test
maestro test "${PROJECT_DIR}/maestro/android-smoke.yaml"

echo "[smoke:android] Done. Screenshots in ~/.maestro/tests/"
